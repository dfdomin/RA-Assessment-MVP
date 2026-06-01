from datetime import datetime
from datetime import date

from sqlalchemy import Date, DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.base import Base


class Period(Base):
    __tablename__ = "periods"
    __table_args__ = (
        Index("ix_periods_student_outcome_id", "student_outcome_id"),
        Index("ix_periods_status", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    student_outcome_id: Mapped[int] = mapped_column(
        ForeignKey("student_outcomes.id"), nullable=False
    )
    rubric_id: Mapped[int | None] = mapped_column(
        ForeignKey("rubrics.id", name="fk_periods_rubric_id", use_alter=True),
        nullable=True,
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    student_outcome = relationship("StudentOutcome", back_populates="periods")
    creator = relationship("User")
    active_rubric = relationship("Rubric", foreign_keys=[rubric_id], post_update=True)
    rubrics = relationship(
        "Rubric",
        back_populates="period",
        cascade="all, delete-orphan",
        foreign_keys="Rubric.period_id",
    )
    modules = relationship("Module", back_populates="period", cascade="all, delete-orphan")
