from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.base import Base


class Rubric(Base):
    __tablename__ = "rubrics"
    __table_args__ = (
        Index("ix_rubrics_student_outcome_id", "student_outcome_id"),
        Index("ix_rubrics_period_id", "period_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    student_outcome_id: Mapped[int] = mapped_column(
        ForeignKey("student_outcomes.id"), nullable=False
    )
    period_id: Mapped[int] = mapped_column(ForeignKey("periods.id"), nullable=False)
    cloned_from: Mapped[int | None] = mapped_column(ForeignKey("rubrics.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    student_outcome = relationship("StudentOutcome", back_populates="rubrics")
    period = relationship("Period", back_populates="rubrics", foreign_keys=[period_id])
    source_rubric = relationship("Rubric", remote_side=[id], foreign_keys=[cloned_from])
    pis = relationship(
        "PerfIndicator", back_populates="rubric", cascade="all, delete-orphan"
    )
    thresholds = relationship(
        "LevelThreshold",
        back_populates="rubric",
        cascade="all, delete-orphan",
        uselist=False,
    )


class PerfIndicator(Base):
    __tablename__ = "perf_indicators"
    __table_args__ = (
        UniqueConstraint("rubric_id", "code", name="uq_perf_indicators_rubric_code"),
        Index("ix_perf_indicators_rubric_id", "rubric_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    rubric_id: Mapped[int] = mapped_column(ForeignKey("rubrics.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(10), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    pi_weight: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("0.00"), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)

    rubric = relationship("Rubric", back_populates="pis")
    levels = relationship("PILevel", back_populates="perf_indicator", cascade="all, delete-orphan")


class PILevel(Base):
    __tablename__ = "pi_levels"
    __table_args__ = (
        UniqueConstraint(
            "perf_indicator_id", "level_value", name="uq_pi_levels_indicator_level"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    perf_indicator_id: Mapped[int] = mapped_column(
        ForeignKey("perf_indicators.id"), nullable=False
    )
    level_value: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str] = mapped_column(String(20), nullable=False)
    descriptor: Mapped[str] = mapped_column(Text, nullable=False)

    perf_indicator = relationship("PerfIndicator", back_populates="levels")


class LevelThreshold(Base):
    __tablename__ = "level_thresholds"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    rubric_id: Mapped[int] = mapped_column(
        ForeignKey("rubrics.id"), unique=True, nullable=False
    )
    poor_max: Mapped[Decimal] = mapped_column(
        Numeric(4, 2), default=Decimal("2.00"), nullable=False
    )
    inadequate_max: Mapped[Decimal] = mapped_column(
        Numeric(4, 2), default=Decimal("3.00"), nullable=False
    )
    adequate_max: Mapped[Decimal] = mapped_column(
        Numeric(4, 2), default=Decimal("4.00"), nullable=False
    )

    rubric = relationship("Rubric", back_populates="thresholds")
