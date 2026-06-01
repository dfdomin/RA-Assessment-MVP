from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    # Global role: admin (platform-wide) | leader | teacher (program-scoped via program_memberships)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    hashed_password: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    auth_provider: Mapped[str] = mapped_column(
        String(20), default="local", nullable=False
    )
    microsoft_oid: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    pege_id: Mapped[str | None] = mapped_column(String(50), unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    program_memberships = relationship("ProgramMembership", back_populates="user")
