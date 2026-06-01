from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.base import Base


class ActionPlan(Base):
    __tablename__ = "action_plans"
    __table_args__ = (
        UniqueConstraint("period_id", "perf_indicator_id", name="uq_action_plans_period_pi"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    period_id: Mapped[int] = mapped_column(ForeignKey("periods.id"), nullable=False)
    perf_indicator_id: Mapped[int] = mapped_column(
        ForeignKey("perf_indicators.id"), nullable=False
    )
    action_type: Mapped[str] = mapped_column(String(20), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    responsible: Mapped[str] = mapped_column(String(200), nullable=False)
    estimated_date: Mapped[str] = mapped_column(String(20), nullable=False)
    implemented: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    updated_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    period = relationship("Period")
    perf_indicator = relationship("PerfIndicator")
