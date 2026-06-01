"""
Tests S5-01 — CSV template download endpoint (F15).
Covers: admin downloads templates, teacher gets 403, invalid entity gets 404.
"""
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from src.api.deps import get_db
from src.api.main import app
from src.core.security import hash_password
from src.db.base import Base
from src.models.user import User

LOGIN_URL = "/api/v1/auth/login"

VALID_ENTITIES = ["rubrics", "users", "modules", "students"]
ENTITY_FILENAMES = {
    "rubrics": "template_rubricas.csv",
    "users": "template_usuarios.csv",
    "modules": "template_modulos.csv",
    "students": "template_estudiantes.csv",
}


@pytest_asyncio.fixture
async def templates_client():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with factory() as db:
        admin = User(
            email="admin.tpl@iub.edu.co",
            full_name="Admin Templates",
            role="admin",
            hashed_password=hash_password("Admin1234!"),
            is_active=True,
            auth_provider="local",
        )
        teacher = User(
            email="teacher.tpl@iub.edu.co",
            full_name="Teacher Templates",
            role="teacher",
            hashed_password=hash_password("Teacher1234!"),
            is_active=True,
            auth_provider="local",
        )
        db.add_all([admin, teacher])
        await db.commit()

    async def _override_get_db():
        async with factory() as session:
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


async def _login(client: AsyncClient, email: str, password: str) -> None:
    r = await client.post(LOGIN_URL, json={"email": email, "password": password})
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_admin_downloads_rubrics_template(templates_client):
    client = templates_client
    await _login(client, "admin.tpl@iub.edu.co", "Admin1234!")

    r = await client.get("/api/v1/admin/templates/rubrics")

    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")
    assert "template_rubricas.csv" in r.headers.get("content-disposition", "")
    body = r.text
    assert "SO_codigo" in body
    assert "PI_codigo" in body
    assert "peso_pct" in body


@pytest.mark.asyncio
async def test_admin_downloads_users_template(templates_client):
    client = templates_client
    await _login(client, "admin.tpl@iub.edu.co", "Admin1234!")

    r = await client.get("/api/v1/admin/templates/users")

    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")
    assert "template_usuarios.csv" in r.headers.get("content-disposition", "")
    body = r.text
    assert "nombre_completo" in body
    assert "email_institucional" in body
    assert "rol" in body


@pytest.mark.asyncio
async def test_admin_downloads_modules_template(templates_client):
    client = templates_client
    await _login(client, "admin.tpl@iub.edu.co", "Admin1234!")

    r = await client.get("/api/v1/admin/templates/modules")

    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")
    assert "template_modulos.csv" in r.headers.get("content-disposition", "")
    body = r.text
    assert "period_id" in body
    assert "curso_codigo" in body
    assert "docente_email" in body


@pytest.mark.asyncio
async def test_admin_downloads_students_template(templates_client):
    client = templates_client
    await _login(client, "admin.tpl@iub.edu.co", "Admin1234!")

    r = await client.get("/api/v1/admin/templates/students")

    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")
    assert "template_estudiantes.csv" in r.headers.get("content-disposition", "")
    body = r.text
    assert "ID_interno" in body
    assert "numero_documento" in body
    assert "modulo_id" in body


@pytest.mark.asyncio
async def test_teacher_cannot_download_template(templates_client):
    client = templates_client
    await _login(client, "teacher.tpl@iub.edu.co", "Teacher1234!")

    r = await client.get("/api/v1/admin/templates/rubrics")

    assert r.status_code == 403


@pytest.mark.asyncio
async def test_invalid_entity_returns_404(templates_client):
    client = templates_client
    await _login(client, "admin.tpl@iub.edu.co", "Admin1234!")

    r = await client.get("/api/v1/admin/templates/invalid_entity")

    assert r.status_code == 404
