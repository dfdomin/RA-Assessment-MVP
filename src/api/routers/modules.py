from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import ensure_module_period_open, get_current_user, get_db, require_role, verify_module_ownership
from src.api.schemas.modules import ModuleResponse, ModuleTeacher
from src.models.assessment import Assessment
from src.models.module import Module, ModuleAssignment
from src.models.module_analysis import ModuleAnalysis
from src.models.period import Period
from src.models.program import ProgramMembership
from src.models.rubric import PerfIndicator
from src.models.security import SecurityEvent
from src.models.student import ModuleStudent
from src.models.student_outcome import StudentOutcome
from src.models.user import User

router = APIRouter(tags=["modules"])


def _module_to_response(module: Module, progress: tuple[int, int] = (0, 0)) -> ModuleResponse:
    teacher = None
    if module.assignments:
        assigned_user = module.assignments[0].user
        teacher = ModuleTeacher(id=assigned_user.id, full_name=assigned_user.full_name)

    students_active, students_graded = progress

    return ModuleResponse(
        id=module.id,
        course_code=module.course_code,
        course_name=module.course_name,
        group_name=module.group_name,
        status=module.status,
        teacher=teacher,
        students_active=students_active,
        students_graded=students_graded,
        last_updated=module.submitted_at,
    )


async def _get_active_pi_ids(period: Period, db: AsyncSession) -> list[int]:
    if period.rubric_id is None:
        return []

    result = await db.execute(
        select(PerfIndicator.id)
        .where(
            PerfIndicator.rubric_id == period.rubric_id,
            PerfIndicator.is_active.is_(True),
        )
        .order_by(PerfIndicator.position)
    )
    return list(result.scalars().all())


async def _module_progress_by_id(
    module_ids: list[int],
    active_pi_ids: list[int],
    db: AsyncSession,
) -> dict[int, tuple[int, int]]:
    progress = {module_id: (0, 0) for module_id in module_ids}
    if not module_ids:
        return progress

    if not active_pi_ids:
        result = await db.execute(
            select(ModuleStudent.module_id, func.count(ModuleStudent.id))
            .where(
                ModuleStudent.module_id.in_(module_ids),
                ModuleStudent.status == "active",
            )
            .group_by(ModuleStudent.module_id)
        )
        for module_id, active_count in result.all():
            progress[module_id] = (active_count, 0)
        return progress

    result = await db.execute(
        select(
            ModuleStudent.module_id,
            ModuleStudent.id,
            func.count(func.distinct(Assessment.perf_indicator_id)).label("graded_pi_count"),
        )
        .outerjoin(
            Assessment,
            and_(
                Assessment.module_student_id == ModuleStudent.id,
                Assessment.perf_indicator_id.in_(active_pi_ids),
            ),
        )
        .where(
            ModuleStudent.module_id.in_(module_ids),
            ModuleStudent.status == "active",
        )
        .group_by(ModuleStudent.module_id, ModuleStudent.id)
    )

    active_counts = {module_id: 0 for module_id in module_ids}
    graded_counts = {module_id: 0 for module_id in module_ids}
    required_pi_count = len(active_pi_ids)

    for module_id, _module_student_id, graded_pi_count in result.all():
        active_counts[module_id] += 1
        if graded_pi_count == required_pi_count:
            graded_counts[module_id] += 1

    return {
        module_id: (active_counts[module_id], graded_counts[module_id])
        for module_id in module_ids
    }


@router.get("/periods/{period_id}/modules", response_model=list[ModuleResponse])
async def list_modules_for_period(
    period_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    period_stmt = select(Period).where(Period.id == period_id)

    if current_user.role == "leader":
        period_stmt = (
            period_stmt.join(Period.student_outcome)
            .join(ProgramMembership, ProgramMembership.program_id == StudentOutcome.program_id)
            .where(ProgramMembership.user_id == current_user.id)
        )

    period_result = await db.execute(period_stmt)
    period = period_result.scalar_one_or_none()
    if period is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Period not found")

    modules_stmt = (
        select(Module)
        .where(Module.period_id == period_id)
        .options(selectinload(Module.assignments).selectinload(ModuleAssignment.user))
        .order_by(Module.id)
    )

    if current_user.role == "teacher":
        modules_stmt = (
            modules_stmt.join(Module.assignments)
            .where(ModuleAssignment.user_id == current_user.id)
        )

    result = await db.execute(modules_stmt)
    modules = result.scalars().unique().all()
    module_ids = [module.id for module in modules]
    active_pi_ids = await _get_active_pi_ids(period, db)
    progress_by_id = await _module_progress_by_id(module_ids, active_pi_ids, db)

    return [_module_to_response(module, progress_by_id[module.id]) for module in modules]


@router.put("/modules/{module_id}/submit", status_code=status.HTTP_200_OK)
async def submit_module(
    module_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    module = await verify_module_ownership(module_id, current_user, db)
    await ensure_module_period_open(module, db)

    period = await db.get(Period, module.period_id)

    # Collect active PI IDs from the period's active rubric
    active_pi_ids: set[int] = set()
    if period and period.rubric_id:
        pi_result = await db.execute(
            select(PerfIndicator.id).where(
                PerfIndicator.rubric_id == period.rubric_id,
                PerfIndicator.is_active.is_(True),
            )
        )
        active_pi_ids = {row for row in pi_result.scalars().all()}

    # Collect active module_student IDs
    ms_result = await db.execute(
        select(ModuleStudent.id).where(
            ModuleStudent.module_id == module.id,
            ModuleStudent.status == "active",
        )
    )
    active_ms_ids = [row for row in ms_result.scalars().all()]

    # Check every active student has all active PIs graded
    missing_grades: list[dict] = []
    for ms_id in active_ms_ids:
        graded_pi_result = await db.execute(
            select(Assessment.perf_indicator_id).where(Assessment.module_student_id == ms_id)
        )
        graded_pi_ids = set(graded_pi_result.scalars().all())
        ungraded = active_pi_ids - graded_pi_ids
        if ungraded:
            missing_grades.append({"module_student_id": ms_id, "missing_pi_ids": list(ungraded)})

    if missing_grades:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"reason": "students_without_grades", "missing": missing_grades},
        )

    # Check all active PIs have a qualitative analysis
    analysis_result = await db.execute(
        select(ModuleAnalysis.perf_indicator_id).where(ModuleAnalysis.module_id == module.id)
    )
    analyzed_pi_ids = set(analysis_result.scalars().all())
    missing_analysis = active_pi_ids - analyzed_pi_ids
    if missing_analysis:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"reason": "missing_qualitative_analysis", "missing_pi_ids": list(missing_analysis)},
        )

    now = datetime.now(timezone.utc)
    module.status = "completed"
    module.submitted_at = now

    db.add(
        SecurityEvent(
            event="module_submitted",
            user_id=current_user.id,
            severity="INFO",
            detail={"module_id": module_id},
        )
    )
    await db.commit()

    return {
        "module_id": module_id,
        "status": "completed",
        "submitted_at": now.isoformat(),
    }


@router.put("/modules/{module_id}/reopen", status_code=status.HTTP_200_OK)
async def reopen_module(
    module_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "leader")),
):
    module = await db.get(Module, module_id)
    if module is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found")

    if current_user.role == "leader":
        period = await db.get(Period, module.period_id)
        so = await db.get(StudentOutcome, period.student_outcome_id)
        membership = await db.scalar(
            select(ProgramMembership).where(
                ProgramMembership.user_id == current_user.id,
                ProgramMembership.program_id == so.program_id,
            )
        )
        if membership is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found")

    if module.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"reason": "module_not_completed"},
        )

    module.status = "in_progress"
    module.submitted_at = None

    db.add(
        SecurityEvent(
            event="module_reopened",
            user_id=current_user.id,
            severity="INFO",
            detail={"module_id": module_id},
        )
    )
    await db.commit()

    return {"module_id": module_id, "status": "in_progress"}
