from datetime import datetime

from pydantic import BaseModel, Field


class TrackingTeacher(BaseModel):
    id: int
    full_name: str
    email: str


class TrackingItem(BaseModel):
    module_id: int
    course_name: str
    group_name: str
    teacher: TrackingTeacher | None
    status: str
    students_graded: int
    students_active: int
    progress_pct: int
    last_access: datetime | None
    days_remaining: int


class ReminderRequest(BaseModel):
    recipient_ids: list[int] = Field(min_length=1, max_length=15)
    message_body: str = Field(min_length=1, max_length=2000)


class ReminderSendResponse(BaseModel):
    sent: int
    failed: int


class ReminderPreviewResponse(BaseModel):
    recipient: TrackingTeacher
    subject: str
    preview_body: str
