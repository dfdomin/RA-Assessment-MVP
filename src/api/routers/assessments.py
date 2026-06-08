from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import ensure_module_period_open, get_current_user, get_db, verify_module_ownership
from src.api.schemas.assessments import AssessmentsResponse, AssessmentsUpdate, StudentAssessmentItem, StudentResult
from src.models.assessment import Assessment
from src.models.module import Module, ModuleAssignment
from src.models.module_analysis import ModuleAnalysis
from src.models.period import Period
from src.models.program import ProgramMembership
from src.models.rubric import PerfIndicator, Rubric
from src.models.security import SecurityEvent
from src.models.student import ModuleStudent
from src.models.student_outcome import StudentOutcome
from src.domain.levels import LEVEL_LABELS_EN
from src.models.user import User

router = APIRouter(tags=["assessments"])

_LEVEL_LABELS = LEVEL_LABELS_EN


def _standard_from_score(score: float) -> str:
    if score < 2.0:
        return "Poor"
    if score < 3.0:
        return "Inadequate"
    if score < 3.5:
        return "Adequate"
    return "Exemplary"


async def _get_module_for_read(
    module_id: int, current_user: User, db: AsyncSession
) -> Module:
    """Return the module if current_user can read its assessments (404 on deny)."""
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

    # teacher: must be assigned to the module
    return await verify_module_ownership(module_id, current_user, db)


@router.get("/modules/{module_id}/assessments", response_model=AssessmentsResponse)
async def get_assessments(
    module_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    module = await _get_module_for_read(module_id, current_user, db)

    # Load module students with their assessments and student names
    ms_result = await db.execute(
        select(ModuleStudent)
        .where(ModuleStudent.module_id == module.id)
        .options(
            selectinload(ModuleStudent.student),
            selectinload(ModuleStudent.assessments).selectinload(Assessment.perf_indicator),
        )
        .order_by(ModuleStudent.id)
    )
    module_students = ms_result.scalars().unique().all()

    # Load active PIs for the module's period rubric (for weighted score)
    period = await db.get(Period, module.period_id)
    active_pis: list[PerfIndicator] = []
    if period and period.rubric_id:
        pi_result = await db.execute(
            select(PerfIndicator)
            .where(PerfIndicator.rubric_id == period.rubric_id, PerfIndicator.is_active.is_(True))
            .order_by(PerfIndicator.position)
        )
        active_pis = list(pi_result.scalars().all())

    pi_weight_map = {pi.id: float(pi.pi_weight) for pi in active_pis}
    pi_code_map = {pi.id: pi.code for pi in active_pis}

    student_results: list[StudentResult] = []
    distribution: dict[str, dict[str, int]] = {
        pi.code: {"Poor": 0, "Inadequate": 0, "Adequate": 0, "Exemplary": 0}
        for pi in active_pis
    }

    for ms in module_students:
        items: list[StudentAssessmentItem] = []
        total_score = 0.0

        for a in ms.assessments:
            pi_code = pi_code_map.get(a.perf_indicator_id, a.perf_indicator.code)
            items.append(
                StudentAssessmentItem(
                    perf_indicator_id=a.perf_indicator_id,
                    pi_code=pi_code,
                    level=a.level,
                )
            )
            weight = pi_weight_map.get(a.perf_indicator_id, 0.0)
            total_score += (weight / 100.0) * a.level

            label = _LEVEL_LABELS.get(a.level, "Poor")
            if pi_code in distribution:
                distribution[pi_code][label] += 1

        student_results.append(
            StudentResult(
                module_student_id=ms.id,
                student_name=ms.student.full_name,
                status=ms.status,
                assessments=items,
                total_score=round(total_score, 2),
                standard=_standard_from_score(total_score),
            )
        )

    return AssessmentsResponse(
        module_id=module.id,
        students=student_results,
        distribution=distribution,
    )


@router.put("/modules/{module_id}/assessments", status_code=status.HTTP_200_OK)
async def save_assessments(
    module_id: int,
    body: AssessmentsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    module = await verify_module_ownership(module_id, current_user, db)
    await ensure_module_period_open(module, db)

    # Collect valid module_student IDs for this module
    ms_ids_result = await db.execute(
        select(ModuleStudent.id).where(ModuleStudent.module_id == module.id)
    )
    valid_ms_ids = {row for row in ms_ids_result.scalars().all()}

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

    now = datetime.now(timezone.utc)

    for item in body.assessments:
        if item.module_student_id not in valid_ms_ids:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"module_student_id {item.module_student_id} does not belong to this module",
            )
        if item.perf_indicator_id not in valid_pi_ids:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"perf_indicator_id {item.perf_indicator_id} is not an active PI for this module",
            )

        existing = await db.execute(
            select(Assessment).where(
                Assessment.module_student_id == item.module_student_id,
                Assessment.perf_indicator_id == item.perf_indicator_id,
            )
        )
        assessment = existing.scalar_one_or_none()
        if assessment:
            assessment.level = item.level
            assessment.updated_at = now
        else:
            db.add(
                Assessment(
                    module_student_id=item.module_student_id,
                    perf_indicator_id=item.perf_indicator_id,
                    level=item.level,
                    updated_at=now,
                )
            )

    db.add(
        SecurityEvent(
            event="assessments_saved",
            user_id=current_user.id,
            severity="INFO",
            detail={"module_id": module_id, "count": len(body.assessments)},
        )
    )
    await db.commit()
    return {"module_id": module_id, "saved": len(body.assessments)}
