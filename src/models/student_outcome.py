from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.base import Base


class StudentOutcome(Base):
    __tablename__ = "student_outcomes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    program_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("programs.id"), nullable=False
    )

    periods = relationship("Period", back_populates="student_outcome")
    rubrics = relationship("Rubric", back_populates="student_outcome")
    program = relationship("Program", back_populates="student_outcomes")
