from datetime import date

from pydantic import BaseModel, ConfigDict, field_validator


class PeriodCreate(BaseModel):
    name: str
    student_outcome_id: int
    start_date: date
    end_date: date
    clone_from_period_id: int | None = None

    @field_validator("end_date", mode="after")
    @classmethod
    def end_after_start(cls, v: date, info) -> date:
        start = info.data.get("start_date")
        if start and v <= start:
            raise ValueError("end_date must be after start_date")
        return v


class PeriodCreated(BaseModel):
    id: int
    name: str
    status: str

    model_config = ConfigDict(from_attributes=True)


class PeriodResponse(BaseModel):
    id: int
    name: str
    student_outcome_code: str
    status: str
    start_date: date
    end_date: date
    modules_total: int
    modules_completed: int


class PeriodCloseRequest(BaseModel):
    force: bool = False


class PendingModule(BaseModel):
    id: int
    course_code: str
    course_name: str
    group_name: str
    status: str


class PeriodCloseResponse(BaseModel):
    period_id: int
    status: str
    modules_pending: list[PendingModule]


class PeriodReopenResponse(BaseModel):
    period_id: int
    status: str
