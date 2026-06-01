import bleach
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import get_current_user, get_db, require_role
from src.api.schemas.leader_analysis import (
    LeaderAnalysisItem,
    LeaderAnalysisResponse,
    LeaderAnalysisUpdate,
)
from src.models.leader_analysis import LeaderAnalysis
from src.models.module import Module, ModuleAssignment
from src.models.period import Period
from src.models.program import ProgramMembership
from src.models.rubric import PerfIndicator
from src.models.security import SecurityEvent
from src.models.student_outcome import StudentOutcome
from src.models.user import User

router = APIRouter(tags=["leader_analysis"])


async def _get_period_for_read(period_id: int, current_user: User, db: AsyncSession) -> Period:
    """Return the period for read access — 404 on deny (IDOR prevention)."""
    if current_user.role == "admin":
        period = await db.get(Period, period_id)
        if period is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Period not found")
        return period

    if current_user.role == "leader":
        result = await db.execute(
            select(Period)
            .join(StudentOutcome, Period.student_outcome_id == StudentOutcome.id)
            .join(ProgramMembership, ProgramMembership.program_id == StudentOutcome.program_id)
            .where(Period.id == period_id, ProgramMembership.user_id == current_user.id)
        )
        period = result.scalar_one_or_none()
        if period is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Period not found")
        return period

    # teacher: readable if they have any module in the period
    result = await db.execute(
        select(Period)
        .join(Module, Module.period_id == Period.id)
        .join(ModuleAssignment, ModuleAssignment.module_id == Module.id)
        .where(Period.id == period_id, ModuleAssignment.user_id == current_user.id)
    )
    period = result.scalar_one_or_none()
    if period is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Period not found")
    return period


async def _get_period_for_write(period_id: int, current_user: User, db: AsyncSession) -> Period:
    """Return the period for write access — admin free, leader by membership, teacher 403."""
    if current_user.role == "teacher":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    if current_user.role == "admin":
        period = await db.get(Period, period_id)
        if period is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Period not found")
        return period

    # leader: verify program membership
    result = await db.execute(
        select(Period)
        .join(StudentOutcome, Period.student_outcome_id == StudentOutcome.id)
        .join(ProgramMembership, ProgramMembership.program_id == StudentOutcome.program_id)
        .where(Period.id == period_id, ProgramMembership.user_id == current_user.id)
    )
    period = result.scalar_one_or_none()
    if period is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Period not found")
    return period


@router.get("/periods/{period_id}/leader-analysis", response_model=LeaderAnalysisResponse)
async def get_leader_analysis(
    period_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    period = await _get_period_for_read(period_id, current_user, db)

    result = await db.execute(
        select(LeaderAnalysis)
        .where(LeaderAnalysis.period_id == period.id)
        .options(selectinload(LeaderAnalysis.perf_indicator))
        .order_by(LeaderAnalysis.perf_indicator_id)
    )
    analyses = result.scalars().all()

    return LeaderAnalysisResponse(
        period_id=period.id,
        analyses=[
            LeaderAnalysisItem(
                perf_indicator_id=a.perf_indicator_id,
                pi_code=a.perf_indicator.code,
                analysis_text=a.analysis_text,
            )
            for a in analyses
        ],
    )


@router.put("/periods/{period_id}/leader-analysis", status_code=status.HTTP_200_OK)
async def save_leader_analysis(
    period_id: int,
    body: LeaderAnalysisUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    period = await _get_period_for_write(period_id, current_user, db)

    # Collect valid active PI IDs from the period's rubric
    valid_pi_ids: set[int] = set()
    if period.rubric_id:
        pi_result = await db.execute(
            select(PerfIndicator.id).where(
                PerfIndicator.rubric_id == period.rubric_id,
                PerfIndicator.is_active.is_(True),
            )
        )
        valid_pi_ids = set(pi_result.scalars().all())

    for item in body.analyses:
        if valid_pi_ids and item.perf_indicator_id not in valid_pi_ids:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"perf_indicator_id {item.perf_indicator_id} is not an active PI for this period",
            )

        clean_text = bleach.clean(item.analysis_text, tags=[], strip=True)

        existing = await db.execute(
            select(LeaderAnalysis).where(
                LeaderAnalysis.period_id == period.id,
                LeaderAnalysis.perf_indicator_id == item.perf_indicator_id,
            )
        )
        record = existing.scalar_one_or_none()
        if record:
            record.analysis_text = clean_text
            record.updated_by = current_user.id
        else:
            db.add(
                LeaderAnalysis(
                    period_id=period.id,
                    perf_indicator_id=item.perf_indicator_id,
                    analysis_text=clean_text,
                    updated_by=current_user.id,
                )
            )

    db.add(
        SecurityEvent(
            event="leader_analysis_saved",
            user_id=current_user.id,
            severity="INFO",
            detail={"period_id": period_id, "count": len(body.analyses)},
        )
    )
    await db.commit()
    return {"period_id": period_id, "saved": len(body.analyses)}
