import os

# Must be set before any src imports so Settings() picks them up at module load.
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only")

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool, StaticPool

from src.api.deps import get_db
from src.api.main import app
from src.api.routers.auth import limiter
from src.core.security import hash_password
from src.db.base import Base
from src.models.user import User

PG_URL = os.getenv("TEST_PG_URL")


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Prevent rate-limit state from bleeding between tests."""
    limiter._storage.reset()
    yield
    limiter._storage.reset()


@pytest_asyncio.fixture
async def pg_engine():
    """PostgreSQL staging engine, enabled only when TEST_PG_URL is set."""
    if not PG_URL:
        pytest.skip("TEST_PG_URL not set — staging tests skipped")
    if not PG_URL.startswith("postgresql+asyncpg://"):
        pytest.skip("TEST_PG_URL must use postgresql+asyncpg://")
    engine = create_async_engine(PG_URL, echo=False, poolclass=NullPool)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def pg_session(pg_engine):
    """Clean PostgreSQL schema per test so PG E2E checks are isolated."""
    async with pg_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(
        pg_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        yield session

    async with pg_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def async_client():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with session_factory() as db:
        db.add_all([
            User(
                email="admin@iub.edu.co",
                full_name="Administrador Sistema",
                role="admin",
                hashed_password=hash_password("Admin1234!"),
                is_active=True,
                auth_provider="local",
            ),
            User(
                email="lider@iub.edu.co",
                full_name="Líder Académico",
                role="leader",
                hashed_password=hash_password("Lider1234!"),
                is_active=True,
                auth_provider="local",
            ),
            User(
                email="docente@iub.edu.co",
                full_name="Docente Demo",
                role="teacher",
                hashed_password=hash_password("Docente1234!"),
                is_active=True,
                auth_provider="local",
            ),
        ])
        await db.commit()

    async def _override_get_db():
        async with session_factory() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = _override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()
