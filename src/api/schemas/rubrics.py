from decimal import Decimal

from pydantic import BaseModel, ConfigDict, field_validator


class LevelInput(BaseModel):
    level_value: int
    label: str
    descriptor: str


class PIInput(BaseModel):
    code: str
    description: str
    pi_weight: Decimal
    is_active: bool = True
    levels: list[LevelInput]


class RubricInput(BaseModel):
    student_outcome_id: int
    period_id: int
    perf_indicators: list[PIInput]

    @field_validator("perf_indicators")
    @classmethod
    def validate_weights(cls, pis: list[PIInput]) -> list[PIInput]:
        if not pis:
            raise ValueError("perf_indicators must not be empty")
        active_weight = sum((pi.pi_weight for pi in pis if pi.is_active), Decimal("0"))
        if abs(active_weight - Decimal("100")) > Decimal("0.01"):
            raise ValueError(
                f"Active PI weights must sum to 100.00 (got {active_weight:.2f})"
            )
        return pis


class CloneRubricRequest(BaseModel):
    target_period_id: int


class LevelResponse(BaseModel):
    level_value: int
    label: str
    descriptor: str

    model_config = ConfigDict(from_attributes=True)


class PIResponse(BaseModel):
    id: int
    code: str
    description: str
    pi_weight: Decimal
    is_active: bool
    levels: list[LevelResponse]

    model_config = ConfigDict(from_attributes=True)


class RubricResponse(BaseModel):
    id: int
    student_outcome_code: str
    period_id: int
    cloned_from: int | None
    perf_indicators: list[PIResponse]


class CloneRubricResponse(BaseModel):
    id: int
    cloned_from: int | None
    period_id: int

    model_config = ConfigDict(from_attributes=True)
