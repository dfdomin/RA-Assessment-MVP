from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Text, func
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column

from src.db.base import Base


class ReminderLog(Base):
    __tablename__ = "reminder_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    period_id: Mapped[int] = mapped_column(ForeignKey("periods.id"), nullable=False)
    sent_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    recipient_ids: Mapped[list[int]] = mapped_column(JSON, nullable=False)
    message_body: Mapped[str] = mapped_column(Text, nullable=False)
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
