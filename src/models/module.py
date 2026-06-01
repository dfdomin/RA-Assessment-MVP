from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.base import Base


class Module(Base):
    __tablename__ = "modules"
    __table_args__ = (
        Index("ix_modules_period_id", "period_id"),
        Index("ix_modules_status", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    period_id: Mapped[int] = mapped_column(ForeignKey("periods.id"), nullable=False)
    course_code: Mapped[str] = mapped_column(String(30), nullable=False)
    course_name: Mapped[str] = mapped_column(String(200), nullable=False)
    group_name: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    period = relationship("Period", back_populates="modules")
    assignments = relationship(
        "ModuleAssignment",
        back_populates="module",
        cascade="all, delete-orphan",
    )
    module_students = relationship(
        "ModuleStudent",
        back_populates="module",
        cascade="all, delete-orphan",
    )


class ModuleAssignment(Base):
    __tablename__ = "module_staff"
    __table_args__ = (
        UniqueConstraint("module_id", "user_id", name="uq_module_staff_module_user"),
        Index("ix_module_staff_user_id", "user_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    module_id: Mapped[int] = mapped_column(ForeignKey("modules.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    module = relationship("Module", back_populates="assignments")
    user = relationship("User")
