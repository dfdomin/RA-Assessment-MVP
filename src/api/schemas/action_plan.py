from typing import Literal

from pydantic import BaseModel, field_validator

ActionType = Literal["corrective", "preventive", "improvement"]


class ActionPlanInput(BaseModel):
    perf_indicator_id: int
    action_type: ActionType
    description: str
    responsible: str
    estimated_date: str
    implemented: bool = False

    @field_validator("description")
    @classmethod
    def description_max_2000(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("description is required")
        if len(value) > 2000:
            raise ValueError("description must not exceed 2000 characters")
        return value

    @field_validator("responsible")
    @classmethod
    def responsible_max_200(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("responsible is required")
        if len(value) > 200:
            raise ValueError("responsible must not exceed 200 characters")
        return value

    @field_validator("estimated_date")
    @classmethod
    def estimated_date_max_20(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("estimated_date is required")
        if len(value) > 20:
            raise ValueError("estimated_date must not exceed 20 characters")
        return value


class ActionPlanUpdate(BaseModel):
    plans: list[ActionPlanInput]


class ActionPlanItem(BaseModel):
    perf_indicator_id: int
    pi_code: str
    standard: str
    suggested_action_type: ActionType
    action_type: ActionType
    description: str | None = None
    responsible: str | None = None
    estimated_date: str | None = None
    implemented: bool = False


class ActionPlanResponse(BaseModel):
    period_id: int
    plans: list[ActionPlanItem]
