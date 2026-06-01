import bleach
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import ensure_module_period_open, get_current_user, get_db, verify_module_ownership
from src.api.schemas.qualitative import AnalysisItem, QualitativeResponse, QualitativeUpdate
from src.models.module import Module, ModuleAssignment
from src.models.module_analysis import ModuleAnalysis
from src.models.period import Period
from src.models.program import ProgramMembership
from src.models.rubric import PerfIndicator
from src.models.security import SecurityEvent
from src.models.student_outcome import StudentOutcome
from src.models.user import User

router = APIRouter(tags=["qualitative"])


async def _get_module_for_read(
    module_id: int, current_user: User, db
) -> Module:
    """Return the module for read access (404 on deny, consistent with IDOR policy)."""
    if current_user.role == "admin":
        module = await db.get(Module, module_id)
        if module is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found")
        return module

    if current_user.role == "leader":
        result = await db.execute(
            select(Module)
            .join(Period, Module.period_id == Period.id)
            .join(StudentOutcome, Period.student_outcome_id == StudentOutcome.id)
            .join(ProgramMembership, ProgramMembership.program_id == StudentOutcome.program_id)
            .where(Module.id == module_id, ProgramMembership.user_id == current_user.id)
        )
        module = result.scalar_one_or_none()
        if module is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found")
        return module

    return await verify_module_ownership(module_id, current_user, db)


@router.get("/modules/{module_id}/qualitative", response_model=QualitativeResponse)
async def get_qualitative(
    module_id: int,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    module = await _get_module_for_read(module_id, current_user, db)

    result = await db.execute(
        select(ModuleAnalysis)
        .where(ModuleAnalysis.module_id == module.id)
        .options(selectinload(ModuleAnalysis.perf_indicator))
        .order_by(ModuleAnalysis.perf_indicator_id)
    )
    analyses = result.scalars().all()

    return QualitativeResponse(
        module_id=module.id,
        analyses=[
            AnalysisItem(
                perf_indicator_id=a.perf_indicator_id,
                pi_code=a.perf_indicator.code,
                analysis_text=a.analysis_text,
            )
            for a in analyses
        ],
    )


@router.put("/modules/{module_id}/qualitative", status_code=status.HTTP_200_OK)
async def save_qualitative(
    module_id: int,
    body: QualitativeUpdate,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    module = await verify_module_ownership(module_id, current_user, db)
    await ensure_module_period_open(module, db)

    # Collect valid PI IDs from the active rubric
    period = await db.get(Period, module.period_id)
    valid_pi_ids: set[int] = set()
    if period and period.rubric_id:
        pi_ids_result = await db.execute(
            select(PerfIndicator.id).where(
                PerfIndicator.rubric_id == period.rubric_id,
                PerfIndicator.is_active.is_(True),
            )
        )
        valid_pi_ids = {row for row in pi_ids_result.scalars().all()}

    for item in body.analyses:
        if valid_pi_ids and item.perf_indicator_id not in valid_pi_ids:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"perf_indicator_id {item.perf_indicator_id} is not an active PI for this module",
            )

        # Sanitize free-text before persisting
        clean_text = bleach.clean(item.analysis_text, tags=[], strip=True)

        existing = await db.execute(
            select(ModuleAnalysis).where(
                ModuleAnalysis.module_id == module.id,
                ModuleAnalysis.perf_indicator_id == item.perf_indicator_id,
            )
        )
        analysis = existing.scalar_one_or_none()
        if analysis:
            analysis.analysis_text = clean_text
        else:
            db.add(
                ModuleAnalysis(
                    module_id=module.id,
                    perf_indicator_id=item.perf_indicator_id,
                    analysis_text=clean_text,
                )
            )

    db.add(
        SecurityEvent(
            event="qualitative_saved",
            user_id=current_user.id,
            severity="INFO",
            detail={"module_id": module_id, "count": len(body.analyses)},
        )
    )
    await db.commit()
    return {"module_id": module_id, "saved": len(body.analyses)}
