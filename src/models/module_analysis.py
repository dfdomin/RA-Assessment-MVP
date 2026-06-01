from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.base import Base


class ModuleAnalysis(Base):
    __tablename__ = "module_analysis"
    __table_args__ = (
        UniqueConstraint(
            "module_id", "perf_indicator_id", name="uq_module_analysis_module_pi"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    module_id: Mapped[int] = mapped_column(ForeignKey("modules.id"), nullable=False)
    perf_indicator_id: Mapped[int] = mapped_column(
        ForeignKey("perf_indicators.id"), nullable=False
    )
    analysis_text: Mapped[str] = mapped_column(Text, nullable=False)
    saved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    module = relationship("Module")
    perf_indicator = relationship("PerfIndicator")
