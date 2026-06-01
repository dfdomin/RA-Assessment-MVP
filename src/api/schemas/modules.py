from datetime import datetime

from pydantic import BaseModel


class ModuleTeacher(BaseModel):
    id: int
    full_name: str


class ModuleResponse(BaseModel):
    id: int
    course_code: str
    course_name: str
    group_name: str
    status: str
    teacher: ModuleTeacher | None
    students_active: int
    students_graded: int
    last_updated: datetime | None
