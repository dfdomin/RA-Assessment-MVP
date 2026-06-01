"""Unit tests for SecurityEvent and RevokedToken ORM models."""
import pytest
import pytest_asyncio
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from src.db.base import Base
from src.models.security import RevokedToken, SecurityEvent


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with factory() as session:
        yield session
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.mark.asyncio
async def test_security_event_insert(db_session):
    ev = SecurityEvent(
        event="login_test",
        user_id=1,
        ip="127.0.0.1",
        severity="INFO",
        detail={"key": "value"},
    )
    db_session.add(ev)
    await db_session.commit()

    result = await db_session.execute(
        select(SecurityEvent).where(SecurityEvent.event == "login_test")
    )
    fetched = result.scalar_one()
    assert fetched.user_id == 1
    assert fetched.severity == "INFO"
    assert fetched.detail == {"key": "value"}


@pytest.mark.asyncio
async def test_revoked_token_insert_and_query(db_session):
    jti = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    expires = datetime.now(timezone.utc) + timedelta(hours=8)
    db_session.add(RevokedToken(jti=jti, expires_at=expires))
    await db_session.commit()

    result = await db_session.execute(
        select(RevokedToken).where(RevokedToken.jti == jti)
    )
    token = result.scalar_one()
    assert token.jti == jti


@pytest.mark.asyncio
async def test_revoked_token_absent(db_session):
    result = await db_session.execute(
        select(RevokedToken).where(RevokedToken.jti == "nonexistent-jti")
    )
    assert result.scalar_one_or_none() is None
