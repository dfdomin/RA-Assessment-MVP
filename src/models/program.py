from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.base import Base


class PropedeuticLine(Base):
    __tablename__ = "propedeutic_lines"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    programs = relationship("Program", back_populates="propedeutic_line")


class Program(Base):
    __tablename__ = "programs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    propedeutic_line_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("propedeutic_lines.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    # técnico | tecnología | profesional
    cycle_level: Mapped[str] = mapped_column(String(20), nullable=False)
    faculty: Mapped[str | None] = mapped_column(String(120), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    propedeutic_line = relationship("PropedeuticLine", back_populates="programs")
    student_outcomes = relationship("StudentOutcome", back_populates="program")
    memberships = relationship("ProgramMembership", back_populates="program")


class ProgramMembership(Base):
    """Maps a user (leader or teacher) to a specific program with a program-scoped role."""

    __tablename__ = "program_memberships"
    __table_args__ = (
        UniqueConstraint("user_id", "program_id", name="uq_program_membership"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    program_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("programs.id"), nullable=False
    )
    # leader | teacher
    role: Mapped[str] = mapped_column(String(20), nullable=False)

    user = relationship("User", back_populates="program_memberships")
    program = relationship("Program", back_populates="memberships")
