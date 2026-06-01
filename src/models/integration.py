from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.base import Base


class OracleSyncLog(Base):
    __tablename__ = "oracle_sync_log"
    __table_args__ = (
        Index("ix_oracle_sync_log_ts", "ts"),
        Index("ix_oracle_sync_log_source", "source"),
        Index("ix_oracle_sync_log_admin_id", "admin_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ts: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    source: Mapped[str] = mapped_column(String(30), nullable=False)
    periodo_codigo: Mapped[str] = mapped_column(String(100), nullable=False)
    docentes_count: Mapped[int] = mapped_column(Integer, nullable=False)
    modulos_count: Mapped[int] = mapped_column(Integer, nullable=False)
    estudiantes_count: Mapped[int] = mapped_column(Integer, nullable=False)
    admin_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    detail: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    admin = relationship("User")

