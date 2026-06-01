from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column

from src.db.base import Base


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"

    jti: Mapped[str] = mapped_column(String(36), primary_key=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class SecurityEvent(Base):
    __tablename__ = "security_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ts: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    event: Mapped[str] = mapped_column(String(100), nullable=False)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    severity: Mapped[str] = mapped_column(String(10), default="INFO", nullable=False)
    detail: Mapped[dict | None] = mapped_column(JSON, nullable=True)
