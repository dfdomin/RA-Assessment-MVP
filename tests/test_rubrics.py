"""
Tests S1-19 — Rúbricas
Cubre: U-S1-04, U-S1-05, U-S1-06, I-S1-06, I-S1-07, S-S1-05
"""
from datetime import date
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from src.api.deps import get_db
from src.api.main import app
from src.api.schemas.rubrics import LevelInput, PIInput, RubricInput
from src.core.security import hash_password
from src.db.base import Base
from src.models.period import Period
from src.models.program import Program, PropedeuticLine
from src.models.student_outcome import StudentOutcome
from src.models.user import User

RUBRICS_URL = "/api/v1/rubrics"
LOGIN_URL = "/api/v1/auth/login"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_levels() -> list[dict]:
    return [
        {"level_value": 1, "label": "Poor", "descriptor": "Below expectations"},
        {"level_value": 2, "label": "Inadequate", "descriptor": "Partially meets"},
        {"level_value": 3, "label": "Adequate", "descriptor": "Meets expectations"},
        {"level_value": 4, "label": "Exemplary", "descriptor": "Exceeds expectations"},
    ]


def _make_pi_inputs(weights: list[float], active_flags: list[bool] | None = None) -> list[dict]:
    if active_flags is None:
        active_flags = [True] * len(weights)
    return [
        {
            "code": f"PI{i+1}",
            "description": f"Performance indicator {i+1}",
            "pi_weight": str(w),
            "is_active": active_flags[i],
            "levels": _make_levels(),
        }
        for i, w in enumerate(weights)
    ]


# ---------------------------------------------------------------------------
# Unit tests — Pydantic validation only (no HTTP)
# ---------------------------------------------------------------------------

class TestRubricWeightValidator:
    """U-S1-04, U-S1-05, U-S1-06"""

    def test_rejects_weights_not_summing_to_100(self):
        """U-S1-04: validator raises when active PI weights ≠ 100%."""
        pis = [
            PIInput(
                code="PI1", description="PI 1",
                pi_weight=Decimal("40.00"), is_active=True,
                levels=[LevelInput(level_value=1, label="L1", descriptor="D1")],
            ),
            PIInput(
                code="PI2", description="PI 2",
                pi_weight=Decimal("30.00"), is_active=True,
                levels=[LevelInput(level_value=1, label="L1", descriptor="D1")],
            ),
        ]
        with pytest.raises(ValidationError) as exc_info:
            RubricInput(student_outcome_id=1, period_id=1, perf_indicators=pis)

        assert "70.00" in str(exc_info.value)

    def test_accepts_weights_summing_to_exactly_100(self):
        """U-S1-05: validator passes when active weights = 100.00 exactly."""
        pis = [
            PIInput(
                code="PI1", description="PI 1",
                pi_weight=Decimal("60.00"), is_active=True,
                levels=[LevelInput(level_value=1, label="L1", descriptor="D1")],
            ),
            PIInput(
                code="PI2", description="PI 2",
                pi_weight=Decimal("40.00"), is_active=True,
                levels=[LevelInput(level_value=1, label="L1", descriptor="D1")],
            ),
        ]
        rubric = RubricInput(student_outcome_id=1, period_id=1, perf_indicators=pis)
        assert len(rubric.perf_indicators) == 2

    def test_inactive_pis_excluded_from_weight_sum(self):
        """U-S1-06: inactive PIs are not counted toward the 100% sum."""
        pis = [
            PIInput(
                code="PI1", description="PI 1",
                pi_weight=Decimal("60.00"), is_active=True,
                levels=[LevelInput(level_value=1, label="L1", descriptor="D1")],
            ),
            PIInput(
                code="PI2", description="PI 2",
                pi_weight=Decimal("40.00"), is_active=True,
                levels=[LevelInput(level_value=1, label="L1", descriptor="D1")],
            ),
            PIInput(
                code="PI3", description="PI inactivo",
                pi_weight=Decimal("25.00"), is_active=False,
                levels=[LevelInput(level_value=1, label="L1", descriptor="D1")],
            ),
        ]
        # Active weights = 60 + 40 = 100 → must pass even with inactive PI3 (25)
        rubric = RubricInput(student_outcome_id=1, period_id=1, perf_indicators=pis)
        assert len(rubric.perf_indicators) == 3


# ---------------------------------------------------------------------------
# Fixture for integration/security tests
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def rubrics_client():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with session_factory() as db:
        leader = User(
            email="leader.rubrics@iub.edu.co",
            full_name="Leader Rubrics",
            role="leader",
            hashed_password=hash_password("Leader1234!"),
            is_active=True,
            auth_provider="local",
        )
        teacher = User(
            email="teacher.rubrics@iub.edu.co",
            full_name="Teacher Rubrics",
            role="teacher",
            hashed_password=hash_password("Teacher1234!"),
            is_active=True,
            auth_provider="local",
        )
        db.add_all([leader, teacher])
        await db.flush()
        line = PropedeuticLine(name="Gestión Administrativa", code="LP-GESTION-R", is_active=True)
        db.add(line)
        await db.flush()
        program = Program(
            propedeutic_line_id=line.id,
            name="Tecnología en Gestión Administrativa",
            code="TGA-R",
            cycle_level="tecnología",
            faculty="FCCEA",
        )
        db.add(program)
        await db.flush()
        so = StudentOutcome(
            code="RA2",
            description="Resultado de aprendizaje 2",
            is_active=True,
            program_id=program.id,
        )
        db.add(so)
        await db.flush()

        period = Period(
            name="TGA RA2 2026-1",
            student_outcome_id=so.id,
            start_date=date(2026, 1, 15),
            end_date=date(2026, 5, 30),
            status="open",
            created_by=leader.id,
        )
        db.add(period)
        await db.commit()
        await db.refresh(period)
        period_id = period.id
        so_id = so.id

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
        yield client, period_id, so_id

    app.dependency_overrides.clear()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


async def _login(client: AsyncClient, email: str, password: str) -> None:
    r = await client.post(LOGIN_URL, json={"email": email, "password": password})
    assert r.status_code == 200


# ---------------------------------------------------------------------------
# Integration tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_rubric_invalid_weights_returns_422(rubrics_client):
    """I-S1-06: rúbrica con pesos ≠ 100% → 422."""
    client, period_id, so_id = rubrics_client
    await _login(client, "leader.rubrics@iub.edu.co", "Leader1234!")

    payload = {
        "student_outcome_id": so_id,
        "period_id": period_id,
        "perf_indicators": _make_pi_inputs([40.0, 30.0]),  # suma = 70%
    }
    response = await client.post(RUBRICS_URL, json=payload)

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_rubric_valid_weights_returns_201(rubrics_client):
    """I-S1-07: rúbrica válida (pesos = 100%) → 201 con estructura correcta."""
    client, period_id, so_id = rubrics_client
    await _login(client, "leader.rubrics@iub.edu.co", "Leader1234!")

    payload = {
        "student_outcome_id": so_id,
        "period_id": period_id,
        "perf_indicators": _make_pi_inputs([60.0, 40.0]),
    }
    response = await client.post(RUBRICS_URL, json=payload)

    assert response.status_code == 201
    data = response.json()
    assert data["period_id"] == period_id
    assert data["student_outcome_code"] == "RA2"
    assert len(data["perf_indicators"]) == 2
    assert data["perf_indicators"][0]["code"] == "PI1"
    assert len(data["perf_indicators"][0]["levels"]) == 4


@pytest.mark.asyncio
async def test_list_rubrics_returns_created_rubric(rubrics_client):
    """GET /rubrics devuelve la rúbrica recién creada."""
    client, period_id, so_id = rubrics_client
    await _login(client, "leader.rubrics@iub.edu.co", "Leader1234!")

    await client.post(RUBRICS_URL, json={
        "student_outcome_id": so_id,
        "period_id": period_id,
        "perf_indicators": _make_pi_inputs([50.0, 50.0]),
    })

    response = await client.get(RUBRICS_URL)
    assert response.status_code == 200
    assert len(response.json()) == 1


# ---------------------------------------------------------------------------
# Security test
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_rubric_weight_bypass_blocked_by_api(rubrics_client):
    """S-S1-05: enviar rúbrica con pesos ≠ 100% directamente a la API → 422.

    Verifica que la validación Pydantic opera en el servidor y no es
    bypasseable omitiendo el frontend.
    """
    client, period_id, so_id = rubrics_client
    await _login(client, "leader.rubrics@iub.edu.co", "Leader1234!")

    # Attempt to bypass frontend: weights sum to 99.99, outside ±0.01 tolerance
    payload = {
        "student_outcome_id": so_id,
        "period_id": period_id,
        "perf_indicators": _make_pi_inputs([49.98, 50.00]),  # sum = 99.98
    }
    response = await client.post(RUBRICS_URL, json=payload)

    assert response.status_code == 422
    detail = str(response.json())
    assert "99.98" in detail or "100" in detail


@pytest.mark.asyncio
async def test_teacher_cannot_create_rubric(rubrics_client):
    """S-S1-03 (rubrics): docente recibe 403 al intentar crear rúbrica."""
    client, period_id, so_id = rubrics_client
    await _login(client, "teacher.rubrics@iub.edu.co", "Teacher1234!")

    payload = {
        "student_outcome_id": so_id,
        "period_id": period_id,
        "perf_indicators": _make_pi_inputs([100.0]),
    }
    response = await client.post(RUBRICS_URL, json=payload)

    assert response.status_code == 403
