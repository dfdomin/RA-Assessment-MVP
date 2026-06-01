from typing import Any

from pydantic import BaseModel, field_validator


class LeaderReportConclusionInput(BaseModel):
    perf_indicator_id: int
    conclusion_text: str

    @field_validator("conclusion_text")
    @classmethod
    def conclusion_max_3000(cls, value: str) -> str:
        if len(value) > 3000:
            raise ValueError("conclusion_text must not exceed 3000 characters")
        return value


class LeaderReportUpdate(BaseModel):
    conclusions: list[LeaderReportConclusionInput]


class LeaderReportItem(BaseModel):
    perf_indicator_id: int
    pi_code: str
    pi_description: str
    distribution: dict[str, Any]
    teacher_analysis: list[dict[str, str]]
    leader_analysis: str
    action_plan: dict[str, Any] | None
    conclusion_text: str


class LeaderReportResponse(BaseModel):
    period: dict[str, Any]
    student_outcome: dict[str, Any]
    items: list[LeaderReportItem]
