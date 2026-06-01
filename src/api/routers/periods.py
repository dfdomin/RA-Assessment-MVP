from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import get_current_user, get_db, require_role
from src.api.routers.rubrics import clone_rubric_to_period
from src.api.schemas.periods import (
    PendingModule,
    PeriodCloseRequest,
    PeriodCloseResponse,
    PeriodCreate,
    PeriodCreated,
    PeriodReopenResponse,
    PeriodResponse,
)
from src.models.module import Module, ModuleAssignment
from src.models.period import Period
from src.models.program import ProgramMembership
from src.models.rubric import PerfIndicator, Rubric
from src.models.security import SecurityEvent
from src.models.student_outcome import StudentOutcome
from src.models.user import User

router = APIRouter(prefix="/periods", tags=["periods"])

_PERIOD_LOAD = [
    selectinload(Period.student_outcome),
    selectinload(Period.modules),
]


def _period_to_response(period: Period) -> PeriodResponse:
    modules_total = len(period.modules)
    modules_completed = sum(1 for module in period.modules if module.status == "completed")
    return PeriodResponse(
        id=period.id,
        name=period.name,
        student_outcome_code=period.student_outcome.code,
        status=period.status,
        start_date=period.start_date,
        end_date=period.end_date,
        modules_total=modules_total,
        modules_completed=modules_completed,
    )


async def _clone_modules_to_period(
    db: AsyncSession,
    source_period: Period,
    target_period: Period,
) -> None:
    for module in source_period.modules:
        cloned_module = Module(
            period_id=target_period.id,
            course_code=module.course_code,
            course_name=module.course_name,
            group_name=module.group_name,
            status="pending",
        )
        db.add(cloned_module)
        await db.flush()
        for assignment in module.assignments:
            db.add(
                ModuleAssignment(
                    module_id=cloned_module.id,
                    user_id=assignment.user_id,
                )
            )


@router.get("", response_model=list[PeriodResponse])
async def list_periods(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Period).options(*_PERIOD_LOAD).order_by(Period.start_date, Period.id)

    if current_user.role == "teacher":
        stmt = (
            stmt.join(Period.modules)
            .join(Module.assignments)
            .where(ModuleAssignment.user_id == current_user.id)
        )
    elif current_user.role == "leader":
        stmt = (
            stmt.join(Period.student_outcome)
            .join(ProgramMembership, ProgramMembership.program_id == StudentOutcome.program_id)
            .where(ProgramMembership.user_id == current_user.id)
        )

    result = await db.execute(stmt)
    periods = result.scalars().unique().all()
    return [_period_to_response(period) for period in periods]


@router.post("", status_code=status.HTTP_201_CREATED, response_model=PeriodCreated)
async def create_period(
    body: PeriodCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "leader")),
):
    student_outcome = await db.get(StudentOutcome, body.student_outcome_id)
    if student_outcome is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="student_outcome_id does not exist",
        )

    if current_user.role == "leader":
        membership = await db.execute(
            select(ProgramMembership).where(
                ProgramMembership.user_id == current_user.id,
                ProgramMembership.program_id == student_outcome.program_id,
            )
        )
        if membership.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="student_outcome_id does not exist",
            )

    duplicate = await db.execute(select(Period).where(Period.name == body.name))
    if duplicate.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="period name already exists",
        )

    source_period: Period | None = None
    if body.clone_from_period_id is not None:
        source_result = await db.execute(
            select(Period)
            .where(Period.id == body.clone_from_period_id)
            .options(
                selectinload(Period.modules).selectinload(Module.assignments),
            )
        )
        source_period = source_result.scalar_one_or_none()
        if source_period is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="clone_from_period_id does not exist",
            )

    period = Period(
        name=body.name,
        student_outcome_id=body.student_outcome_id,
        start_date=body.start_date,
        end_date=body.end_date,
        status="draft",
        created_by=current_user.id,
    )
    db.add(period)
    await db.flush()

    if source_period is not None:
        await _clone_modules_to_period(db, source_period, period)
        if source_period.rubric_id is not None:
            rubric_result = await db.execute(
                select(Rubric)
                .where(Rubric.id == source_period.rubric_id)
                .options(
                    selectinload(Rubric.pis).selectinload(PerfIndicator.levels),
                    selectinload(Rubric.thresholds),
                )
            )
            source_rubric = rubric_result.scalar_one_or_none()
            if source_rubric is not None:
                cloned_rubric = await clone_rubric_to_period(db, source_rubric, period.id)
                await db.flush()
                period.rubric_id = cloned_rubric.id

    await db.commit()
    await db.refresh(period)
    return period


@router.put("/{period_id}/close", response_model=PeriodCloseResponse)
async def close_period(
    period_id: int,
    body: PeriodCloseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "leader")),
):
    stmt = (
        select(Period)
        .where(Period.id == period_id)
        .options(selectinload(Period.modules), selectinload(Period.student_outcome))
    )

    if current_user.role == "leader":
        stmt = (
            stmt.join(Period.student_outcome)
            .join(ProgramMembership, ProgramMembership.program_id == StudentOutcome.program_id)
            .where(ProgramMembership.user_id == current_user.id)
        )

    result = await db.execute(stmt)
    period = result.scalars().unique().one_or_none()
    if period is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Period not found")

    pending_modules = [
        PendingModule(
            id=module.id,
            course_code=module.course_code,
            course_name=module.course_name,
            group_name=module.group_name,
            status=module.status,
        )
        for module in period.modules
        if module.status != "completed"
    ]

    if pending_modules and not body.force:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "reason": "modules_pending",
                "modules_pending": [module.model_dump() for module in pending_modules],
            },
        )

    period.status = "closed"
    db.add(
        SecurityEvent(
            event="period_closed",
            user_id=current_user.id,
            severity="INFO",
            detail={
                "period_id": period.id,
                "force": body.force,
                "modules_pending": [module.model_dump() for module in pending_modules],
            },
        )
    )
    await db.commit()

    return PeriodCloseResponse(
        period_id=period.id,
        status=period.status,
        modules_pending=pending_modules,
    )


@router.put("/{period_id}/reopen", response_model=PeriodReopenResponse)
async def reopen_period(
    period_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    period = await db.get(Period, period_id)
    if period is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Period not found")

    if period.status != "closed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"reason": "period_not_closed"},
        )

    period.status = "open"
    db.add(
        SecurityEvent(
            event="period_reopened",
            user_id=current_user.id,
            severity="INFO",
            detail={"period_id": period.id},
        )
    )
    await db.commit()

    return PeriodReopenResponse(period_id=period.id, status=period.status)
