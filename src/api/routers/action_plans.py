from collections import Counter, defaultdict

import bleach
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user, get_db
from src.api.schemas.action_plan import ActionPlanItem, ActionPlanResponse, ActionPlanUpdate
from src.models.action_plan import ActionPlan
from src.models.assessment import Assessment
from src.models.module import Module, ModuleAssignment
from src.models.period import Period
from src.models.program import ProgramMembership
from src.models.rubric import PerfIndicator
from src.models.security import SecurityEvent
from src.models.student import ModuleStudent
from src.models.student_outcome import StudentOutcome
from src.models.user import User

router = APIRouter(tags=["action_plans"])


async def _get_period_for_read(period_id: int, current_user: User, db: AsyncSession) -> Period:
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
    if current_user.role == "teacher":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    if current_user.role == "admin":
        period = await db.get(Period, period_id)
        if period is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Period not found")
        return period

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


async def _active_pis_for_period(period: Period, db: AsyncSession) -> list[PerfIndicator]:
    if not period.rubric_id:
        return []

    result = await db.execute(
        select(PerfIndicator)
        .where(PerfIndicator.rubric_id == period.rubric_id, PerfIndicator.is_active.is_(True))
        .order_by(PerfIndicator.position)
    )
    return list(result.scalars().all())


async def _level_counts_by_pi(period_id: int, db: AsyncSession) -> dict[int, Counter[int]]:
    result = await db.execute(
        select(Assessment.perf_indicator_id, Assessment.level)
        .join(ModuleStudent, Assessment.module_student_id == ModuleStudent.id)
        .join(Module, ModuleStudent.module_id == Module.id)
        .where(Module.period_id == period_id, ModuleStudent.status == "active")
    )

    counts: dict[int, Counter[int]] = defaultdict(Counter)
    for perf_indicator_id, level in result.all():
        counts[perf_indicator_id][level] += 1
    return counts


def _suggest_action_type(level_counts: Counter[int]) -> tuple[str, str]:
    if not level_counts:
        return "Medium", "preventive"

    max_count = max(level_counts.values())
    majority_level = min(level for level, count in level_counts.items() if count == max_count)
    if majority_level <= 2:
        return "Low", "corrective"
    if majority_level == 3:
        return "Medium", "preventive"
    return "High", "improvement"


@router.get("/periods/{period_id}/action-plan", response_model=ActionPlanResponse)
async def get_action_plan(
    period_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    period = await _get_period_for_read(period_id, current_user, db)
    active_pis = await _active_pis_for_period(period, db)
    counts_by_pi = await _level_counts_by_pi(period.id, db)

    plans_result = await db.execute(
        select(ActionPlan).where(ActionPlan.period_id == period.id)
    )
    existing = {plan.perf_indicator_id: plan for plan in plans_result.scalars().all()}

    items: list[ActionPlanItem] = []
    for pi in active_pis:
        standard, suggested = _suggest_action_type(counts_by_pi.get(pi.id, Counter()))
        plan = existing.get(pi.id)
        items.append(
            ActionPlanItem(
                perf_indicator_id=pi.id,
                pi_code=pi.code,
                standard=standard,
                suggested_action_type=suggested,
                action_type=plan.action_type if plan else suggested,
                description=plan.description if plan else None,
                responsible=plan.responsible if plan else None,
                estimated_date=plan.estimated_date if plan else None,
                implemented=plan.implemented if plan else False,
            )
        )

    return ActionPlanResponse(period_id=period.id, plans=items)


@router.put("/periods/{period_id}/action-plan", status_code=status.HTTP_200_OK)
async def save_action_plan(
    period_id: int,
    body: ActionPlanUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    period = await _get_period_for_write(period_id, current_user, db)
    active_pis = await _active_pis_for_period(period, db)
    valid_pi_ids = {pi.id for pi in active_pis}

    for item in body.plans:
        if item.perf_indicator_id not in valid_pi_ids:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"perf_indicator_id {item.perf_indicator_id} is not an active PI for this period",
            )

        description = bleach.clean(item.description, tags=[], strip=True)
        responsible = bleach.clean(item.responsible, tags=[], strip=True)
        estimated_date = bleach.clean(item.estimated_date, tags=[], strip=True)

        existing = await db.execute(
            select(ActionPlan).where(
                ActionPlan.period_id == period.id,
                ActionPlan.perf_indicator_id == item.perf_indicator_id,
            )
        )
        record = existing.scalar_one_or_none()
        if record:
            record.action_type = item.action_type
            record.description = description
            record.responsible = responsible
            record.estimated_date = estimated_date
            record.implemented = item.implemented
            record.updated_by = current_user.id
        else:
            db.add(
                ActionPlan(
                    period_id=period.id,
                    perf_indicator_id=item.perf_indicator_id,
                    action_type=item.action_type,
                    description=description,
                    responsible=responsible,
                    estimated_date=estimated_date,
                    implemented=item.implemented,
                    updated_by=current_user.id,
                )
            )

    db.add(
        SecurityEvent(
            event="action_plan_saved",
            user_id=current_user.id,
            severity="INFO",
            detail={"period_id": period_id, "count": len(body.plans)},
        )
    )
    await db.commit()
    return {"period_id": period_id, "saved": len(body.plans)}
