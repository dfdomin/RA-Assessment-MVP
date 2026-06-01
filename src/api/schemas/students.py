from pydantic import BaseModel


class StudentImportRow(BaseModel):
    internal_id: str
    full_name: str
    action: str  # "created" | "enrolled" | "updated" | "already_enrolled"


class StudentImportResponse(BaseModel):
    module_id: int
    imported: int
    updated: int
    skipped: int
    errors: list[dict]
    students: list[StudentImportRow]


class StudentAssessmentSummary(BaseModel):
    perf_indicator_id: int
    pi_code: str
    level: int


class ActivePerfIndicatorSummary(BaseModel):
    id: int
    code: str


class ModuleStudentSummary(BaseModel):
    module_student_id: int
    internal_id: str
    document_number: str
    full_name: str
    status: str
    assessments: list[StudentAssessmentSummary]
    graded_pi_count: int
    missing_pi_count: int
    is_fully_graded: bool


class ModuleStudentsResponse(BaseModel):
    module_id: int
    active_students: int
    fully_graded_students: int
    active_pi_count: int
    active_perf_indicators: list[ActivePerfIndicatorSummary]
    students: list[ModuleStudentSummary]
