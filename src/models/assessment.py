from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.base import Base


class Assessment(Base):
    __tablename__ = "assessments"
    __table_args__ = (
        UniqueConstraint(
            "module_student_id", "perf_indicator_id", name="uq_assessment_student_pi"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    module_student_id: Mapped[int] = mapped_column(
        ForeignKey("module_students.id"), nullable=False
    )
    perf_indicator_id: Mapped[int] = mapped_column(
        ForeignKey("perf_indicators.id"), nullable=False
    )
    level: Mapped[int] = mapped_column(Integer, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    module_student = relationship("ModuleStudent", back_populates="assessments")
    perf_indicator = relationship("PerfIndicator")
