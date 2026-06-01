from pydantic import BaseModel, field_validator


class AssessmentInput(BaseModel):
    module_student_id: int
    perf_indicator_id: int
    level: int

    @field_validator("level")
    @classmethod
    def level_must_be_1_to_4(cls, v: int) -> int:
        if v not in (1, 2, 3, 4):
            raise ValueError("level must be 1, 2, 3, or 4")
        return v


class AssessmentsUpdate(BaseModel):
    assessments: list[AssessmentInput]


class StudentAssessmentItem(BaseModel):
    perf_indicator_id: int
    pi_code: str
    level: int


class StudentResult(BaseModel):
    module_student_id: int
    student_name: str
    status: str
    assessments: list[StudentAssessmentItem]
    total_score: float
    standard: str


class AssessmentsResponse(BaseModel):
    module_id: int
    students: list[StudentResult]
    distribution: dict[str, dict[str, int]]


class SubmitResponse(BaseModel):
    module_id: int
    status: str
    submitted_at: str
