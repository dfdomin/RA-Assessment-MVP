"""
Tests S2-02 — Qualitative analysis (PUT/GET /modules/{id}/qualitative).
Covers: bleach sanitization, ownership control, text length validation, upsert.
"""
from datetime import date
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from src.api.deps import get_db
from src.api.main import app
from src.core.security import hash_password
from src.db.base import Base
from src.models.module import Module, ModuleAssignment
from src.models.period import Period
from src.models.program import Program, ProgramMembership, PropedeuticLine
from src.models.rubric import PerfIndicator, Rubric
from src.models.student_outcome import StudentOutcome
from src.models.user import User

LOGIN_URL = "/api/v1/auth/login"


@pytest_asyncio.fixture
async def qualitative_client():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with factory() as db:
        leader = User(
            email="leader.qual@iub.edu.co",
            full_name="Leader Qual",
            role="leader",
            hashed_password=hash_password("Leader1234!"),
            is_active=True,
            auth_provider="local",
        )
        teacher = User(
            email="teacher.qual@iub.edu.co",
            full_name="Teacher Qual",
            role="teacher",
            hashed_password=hash_password("Teacher1234!"),
            is_active=True,
            auth_provider="local",
        )
        other_teacher = User(
            email="other.teacher.qual@iub.edu.co",
            full_name="Other Teacher Qual",
            role="teacher",
            hashed_password=hash_password("Teacher1234!"),
            is_active=True,
            auth_provider="local",
        )
        db.add_all([leader, teacher, other_teacher])
        await db.flush()

        line = PropedeuticLine(name="Gestión Administrativa", code="LP-GESTION-Q", is_active=True)
        db.add(line)
        await db.flush()
        program = Program(
            propedeutic_line_id=line.id,
            name="Tecnología en Gestión Administrativa",
            code="TGA-Q",
            cycle_level="tecnología",
            faculty="FCCEA",
        )
        db.add(program)
        await db.flush()
        db.add(ProgramMembership(user_id=leader.id, program_id=program.id, role="leader"))
        so = StudentOutcome(
            code="RA1-Q",
            description="RA 1 Qual",
            is_active=True,
            program_id=program.id,
        )
        db.add(so)
        await db.flush()

        period = Period(
            name="TGA Q RA1 2026-1",
            student_outcome_id=so.id,
            start_date=date(2026, 1, 15),
            end_date=date(2026, 5, 30),
            status="open",
            created_by=leader.id,
        )
        db.add(period)
        await db.flush()

        rubric = Rubric(student_outcome_id=so.id, period_id=period.id)
        db.add(rubric)
        await db.flush()

        pi1 = PerfIndicator(
            rubric_id=rubric.id, code="PI1-Q", description="PI 1 Q",
            pi_weight=Decimal("60.00"), is_active=True, position=1,
        )
        pi2 = PerfIndicator(
            rubric_id=rubric.id, code="PI2-Q", description="PI 2 Q",
            pi_weight=Decimal("40.00"), is_active=True, position=2,
        )
        db.add_all([pi1, pi2])
        await db.flush()

        period.rubric_id = rubric.id
        await db.flush()

        module = Module(
            period_id=period.id,
            course_code="TGA301-Q",
            course_name="Módulo cualitativo",
            group_name="A",
            status="in_progress",
        )
        db.add(module)
        await db.flush()
        db.add(ModuleAssignment(module_id=module.id, user_id=teacher.id))
        await db.commit()

        ids = {
            "module_id": module.id,
            "pi1_id": pi1.id,
            "pi2_id": pi2.id,
        }

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
        yield client, ids

    app.dependency_overrides.clear()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


async def _login(client: AsyncClient, email: str, password: str) -> None:
    r = await client.post(LOGIN_URL, json={"email": email, "password": password})
    assert r.status_code == 200


# ---------------------------------------------------------------------------
# PUT /modules/{id}/qualitative
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_assigned_teacher_saves_qualitative(qualitative_client):
    client, ids = qualitative_client
    await _login(client, "teacher.qual@iub.edu.co", "Teacher1234!")

    r = await client.put(
        f"/api/v1/modules/{ids['module_id']}/qualitative",
        json={"analyses": [
            {"perf_indicator_id": ids["pi1_id"], "analysis_text": "El 80% alcanzó nivel adecuado."},
        ]},
    )

    assert r.status_code == 200
    assert r.json()["saved"] == 1


@pytest.mark.asyncio
async def test_bleach_strips_html_from_analysis(qualitative_client):
    """S-S2-01: bleach.clean() removes injected HTML before persisting."""
    client, ids = qualitative_client
    await _login(client, "teacher.qual@iub.edu.co", "Teacher1234!")

    await client.put(
        f"/api/v1/modules/{ids['module_id']}/qualitative",
        json={"analyses": [
            {"perf_indicator_id": ids["pi1_id"],
             "analysis_text": "<script>alert('xss')</script>Texto válido"},
        ]},
    )

    r = await client.get(f"/api/v1/modules/{ids['module_id']}/qualitative")
    assert r.status_code == 200
    saved_text = r.json()["analyses"][0]["analysis_text"]
    assert "<script>" not in saved_text
    assert "Texto válido" in saved_text


@pytest.mark.asyncio
async def test_analysis_text_too_long_returns_422(qualitative_client):
    client, ids = qualitative_client
    await _login(client, "teacher.qual@iub.edu.co", "Teacher1234!")

    r = await client.put(
        f"/api/v1/modules/{ids['module_id']}/qualitative",
        json={"analyses": [
            {"perf_indicator_id": ids["pi1_id"], "analysis_text": "A" * 2001},
        ]},
    )

    assert r.status_code == 422


@pytest.mark.asyncio
async def test_unassigned_teacher_cannot_save_qualitative(qualitative_client):
    client, ids = qualitative_client
    await _login(client, "other.teacher.qual@iub.edu.co", "Teacher1234!")

    r = await client.put(
        f"/api/v1/modules/{ids['module_id']}/qualitative",
        json={"analyses": [
            {"perf_indicator_id": ids["pi1_id"], "analysis_text": "Intento no autorizado"},
        ]},
    )

    assert r.status_code == 404


# ---------------------------------------------------------------------------
# GET /modules/{id}/qualitative
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_leader_views_qualitative_for_program_module(qualitative_client):
    client, ids = qualitative_client
    await _login(client, "teacher.qual@iub.edu.co", "Teacher1234!")
    await client.put(
        f"/api/v1/modules/{ids['module_id']}/qualitative",
        json={"analyses": [
            {"perf_indicator_id": ids["pi1_id"], "analysis_text": "Análisis de PI 1"},
            {"perf_indicator_id": ids["pi2_id"], "analysis_text": "Análisis de PI 2"},
        ]},
    )

    await _login(client, "leader.qual@iub.edu.co", "Leader1234!")
    r = await client.get(f"/api/v1/modules/{ids['module_id']}/qualitative")

    assert r.status_code == 200
    data = r.json()
    assert data["module_id"] == ids["module_id"]
    assert len(data["analyses"]) == 2
    pi_codes = {a["pi_code"] for a in data["analyses"]}
    assert "PI1-Q" in pi_codes
    assert "PI2-Q" in pi_codes


@pytest.mark.asyncio
async def test_upsert_qualitative_updates_existing(qualitative_client):
    """Saving the same PI twice replaces the text."""
    client, ids = qualitative_client
    await _login(client, "teacher.qual@iub.edu.co", "Teacher1234!")

    await client.put(
        f"/api/v1/modules/{ids['module_id']}/qualitative",
        json={"analyses": [
            {"perf_indicator_id": ids["pi1_id"], "analysis_text": "Versión inicial"},
        ]},
    )
    await client.put(
        f"/api/v1/modules/{ids['module_id']}/qualitative",
        json={"analyses": [
            {"perf_indicator_id": ids["pi1_id"], "analysis_text": "Versión actualizada"},
        ]},
    )

    r = await client.get(f"/api/v1/modules/{ids['module_id']}/qualitative")
    text = r.json()["analyses"][0]["analysis_text"]
    assert text == "Versión actualizada"
