from sqlalchemy import Boolean, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.base import Base


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    internal_id: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    document_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    pege_id: Mapped[str | None] = mapped_column(String(50), unique=True, nullable=True)
    is_suppressed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    module_students = relationship("ModuleStudent", back_populates="student")


class ModuleStudent(Base):
    __tablename__ = "module_students"
    __table_args__ = (
        UniqueConstraint("module_id", "student_id", name="uq_module_student"),
        Index("ix_module_students_module_id", "module_id"),
        Index("ix_module_students_module_roster", "module_id", "roster_position"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    module_id: Mapped[int] = mapped_column(ForeignKey("modules.id"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)
    roster_position: Mapped[int] = mapped_column(default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)

    module = relationship("Module", back_populates="module_students")
    student = relationship("Student", back_populates="module_students")
    assessments = relationship(
        "Assessment", back_populates="module_student", cascade="all, delete-orphan"
    )
