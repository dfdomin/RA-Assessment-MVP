from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import get_current_user, get_db, require_role
from src.api.schemas.rubrics import (
    CloneRubricRequest,
    CloneRubricResponse,
    PIResponse,
    RubricInput,
    RubricResponse,
)
from src.models.period import Period
from src.models.rubric import LevelThreshold, PerfIndicator, PILevel, Rubric
from src.models.user import User

router = APIRouter(prefix="/rubrics", tags=["rubrics"])

_RUBRIC_LOAD = [
    selectinload(Rubric.student_outcome),
    selectinload(Rubric.pis).selectinload(PerfIndicator.levels),
]


def _rubric_to_response(rubric: Rubric) -> RubricResponse:
    return RubricResponse(
        id=rubric.id,
        student_outcome_code=rubric.student_outcome.code,
        period_id=rubric.period_id,
        cloned_from=rubric.cloned_from,
        perf_indicators=[
            PIResponse.model_validate(pi)
            for pi in sorted(rubric.pis, key=lambda x: x.position)
        ],
    )


async def clone_rubric_to_period(
    db: AsyncSession, source: Rubric, target_period_id: int
) -> Rubric:
    """Clone a rubric and all its children into target_period_id."""
    new_rubric = Rubric(
        student_outcome_id=source.student_outcome_id,
        period_id=target_period_id,
        cloned_from=source.id,
    )
    db.add(new_rubric)
    await db.flush()

    for pi in source.pis:
        new_pi = PerfIndicator(
            rubric_id=new_rubric.id,
            code=pi.code,
            description=pi.description,
            pi_weight=pi.pi_weight,
            is_active=pi.is_active,
            position=pi.position,
        )
        db.add(new_pi)
        await db.flush()
        for lv in pi.levels:
            db.add(
                PILevel(
                    perf_indicator_id=new_pi.id,
                    level_value=lv.level_value,
                    label=lv.label,
                    descriptor=lv.descriptor,
                )
            )

    if source.thresholds:
        t = source.thresholds
        db.add(
            LevelThreshold(
                rubric_id=new_rubric.id,
                poor_max=t.poor_max,
                inadequate_max=t.inadequate_max,
                adequate_max=t.adequate_max,
            )
        )
    else:
        db.add(LevelThreshold(rubric_id=new_rubric.id))

    return new_rubric


@router.get("", response_model=list[RubricResponse])
async def list_rubrics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Rubric).options(*_RUBRIC_LOAD))
    return [_rubric_to_response(r) for r in result.scalars().all()]


@router.post("", status_code=status.HTTP_201_CREATED, response_model=RubricResponse)
async def create_rubric(
    body: RubricInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "leader")),
):
    period = await db.get(Period, body.period_id)
    if period is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="period_id does not exist",
        )

    rubric = Rubric(
        student_outcome_id=body.student_outcome_id,
        period_id=body.period_id,
    )
    db.add(rubric)
    await db.flush()

    for pos, pi_in in enumerate(body.perf_indicators, start=1):
        pi = PerfIndicator(
            rubric_id=rubric.id,
            code=pi_in.code,
            description=pi_in.description,
            pi_weight=pi_in.pi_weight,
            is_active=pi_in.is_active,
            position=pos,
        )
        db.add(pi)
        await db.flush()
        for lv in pi_in.levels:
            db.add(
                PILevel(
                    perf_indicator_id=pi.id,
                    level_value=lv.level_value,
                    label=lv.label,
                    descriptor=lv.descriptor,
                )
            )

    db.add(LevelThreshold(rubric_id=rubric.id))
    await db.commit()

    result = await db.execute(
        select(Rubric).where(Rubric.id == rubric.id).options(*_RUBRIC_LOAD)
    )
    return _rubric_to_response(result.scalar_one())


@router.post(
    "/{rubric_id}/clone",
    status_code=status.HTTP_201_CREATED,
    response_model=CloneRubricResponse,
)
async def clone_rubric(
    rubric_id: int,
    body: CloneRubricRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin", "leader")),
):
    src_result = await db.execute(
        select(Rubric)
        .where(Rubric.id == rubric_id)
        .options(
            selectinload(Rubric.pis).selectinload(PerfIndicator.levels),
            selectinload(Rubric.thresholds),
        )
    )
    source = src_result.scalar_one_or_none()
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rubric not found")

    target_period = await db.get(Period, body.target_period_id)
    if target_period is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="target_period_id does not exist",
        )

    new_rubric = await clone_rubric_to_period(db, source, body.target_period_id)
    await db.commit()
    await db.refresh(new_rubric)
    return new_rubric
