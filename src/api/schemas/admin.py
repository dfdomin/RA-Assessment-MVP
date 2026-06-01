from pydantic import BaseModel


class HabeasAssessment(BaseModel):
    perf_indicator_id: int
    pi_code: str
    level: int


class HabeasModule(BaseModel):
    module_id: int
    course_code: str
    course_name: str
    group_name: str
    status: str
    enrollment_status: str
    assessments: list[HabeasAssessment]


class HabeasStudent(BaseModel):
    id: int
    internal_id: str
    document_number: str
    full_name: str
    is_suppressed: bool
    modules: list[HabeasModule]


class HabeasDataResponse(BaseModel):
    document_number: str
    match_count: int
    students: list[HabeasStudent]


class SuppressedStudentResponse(BaseModel):
    id: int
    internal_id: str
    document_number: str
    full_name: str
    is_suppressed: bool
