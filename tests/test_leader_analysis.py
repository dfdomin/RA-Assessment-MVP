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
BASE_URL = "/api/v1/periods/{}/leader-analysis"


@pytest_asyncio.fixture
async def la_client():
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
            email="admin.la@iub.edu.co",
            full_name="Admin LA",
            role="admin",
            hashed_password=hash_password("Admin1234!"),
            is_active=True,
            auth_provider="local",
        )
        leader = User(
            email="leader.la@iub.edu.co",
            full_name="Leader LA",
            role="leader",
            hashed_password=hash_password("Leader1234!"),
            is_active=True,
            auth_provider="local",
        )
        other_leader = User(
            email="other.leader.la@iub.edu.co",
            full_name="Other Leader LA",
            role="leader",
            hashed_password=hash_password("Leader1234!"),
            is_active=True,
            auth_provider="local",
        )
        teacher = User(
            email="teacher.la@iub.edu.co",
            full_name="Teacher LA",
            role="teacher",
            hashed_password=hash_password("Teacher1234!"),
            is_active=True,
            auth_provider="local",
        )
        db.add_all([admin, leader, other_leader, teacher])
        await db.flush()

        line = PropedeuticLine(code="LP-LA", name="Línea LA", is_active=True)
        db.add(line)
        await db.flush()

        program = Program(
            propedeutic_line_id=line.id,
            name="Ingeniería de Sistemas LA",
            code="IS-LA",
            cycle_level="tecnología",
            faculty="FIET",
        )
        other_program = Program(
            propedeutic_line_id=line.id,
            name="Otro Programa LA",
            code="OP-LA",
            cycle_level="tecnología",
            faculty="FIET",
        )
        db.add_all([program, other_program])
        await db.flush()

        db.add(ProgramMembership(user_id=leader.id, program_id=program.id, role="leader"))
        db.add(ProgramMembership(user_id=other_leader.id, program_id=other_program.id, role="leader"))
        await db.flush()

        so = StudentOutcome(
            code="RA-LA",
            description="Resultado de Aprendizaje LA",
            is_active=True,
            program_id=program.id,
        )
        db.add(so)
        await db.flush()

        period = Period(
            name="2024-2 LA",
            student_outcome_id=so.id,
            start_date=date(2024, 8, 1),
            end_date=date(2024, 12, 1),
            status="open",
            created_by=admin.id,
        )
        db.add(period)
        await db.flush()

        rubric = Rubric(student_outcome_id=so.id, period_id=period.id)
        db.add(rubric)
        await db.flush()

        pi1 = PerfIndicator(
            rubric_id=rubric.id,
            code="PI-LA-1",
            description="Primer indicador LA",
            pi_weight=Decimal("60.00"),
            is_active=True,
            position=1,
        )
        pi2 = PerfIndicator(
            rubric_id=rubric.id,
            code="PI-LA-2",
            description="Segundo indicador LA",
            pi_weight=Decimal("40.00"),
            is_active=True,
            position=2,
        )
        db.add_all([pi1, pi2])
        await db.flush()

        period.rubric_id = rubric.id

        module = Module(
            period_id=period.id,
            course_code="MAT101-LA",
            course_name="Cálculo LA",
            group_name="G1",
            status="in_progress",
        )
        db.add(module)
        await db.flush()

        db.add(ModuleAssignment(module_id=module.id, user_id=teacher.id))
        await db.commit()

        ids = {
            "period_id": period.id,
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
    resp = await client.post(LOGIN_URL, json={"email": email, "password": password})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_admin_gets_empty_leader_analysis(la_client):
    client, ids = la_client
    await _login(client, "admin.la@iub.edu.co", "Admin1234!")

    resp = await client.get(BASE_URL.format(ids["period_id"]))

    assert resp.status_code == 200
    data = resp.json()
    assert data["period_id"] == ids["period_id"]
    assert data["analyses"] == []


@pytest.mark.asyncio
async def test_leader_with_membership_can_save_and_retrieve_analysis(la_client):
    client, ids = la_client
    await _login(client, "leader.la@iub.edu.co", "Leader1234!")

    resp = await client.put(
        BASE_URL.format(ids["period_id"]),
        json={
            "analyses": [
                {"perf_indicator_id": ids["pi1_id"], "analysis_text": "Análisis consolidado PI 1"}
            ]
        },
    )
    assert resp.status_code == 200
    assert resp.json()["saved"] == 1

    resp = await client.get(BASE_URL.format(ids["period_id"]))
    assert resp.status_code == 200
    analyses = resp.json()["analyses"]
    assert len(analyses) == 1
    assert analyses[0]["perf_indicator_id"] == ids["pi1_id"]
    assert analyses[0]["analysis_text"] == "Análisis consolidado PI 1"


@pytest.mark.asyncio
async def test_admin_can_save_leader_analysis(la_client):
    client, ids = la_client
    await _login(client, "admin.la@iub.edu.co", "Admin1234!")

    resp = await client.put(
        BASE_URL.format(ids["period_id"]),
        json={
            "analyses": [
                {"perf_indicator_id": ids["pi1_id"], "analysis_text": "Admin saves analysis"},
                {"perf_indicator_id": ids["pi2_id"], "analysis_text": "Admin saves PI 2"},
            ]
        },
    )

    assert resp.status_code == 200
    assert resp.json()["saved"] == 2


@pytest.mark.asyncio
async def test_teacher_can_read_leader_analysis(la_client):
    client, ids = la_client
    await _login(client, "teacher.la@iub.edu.co", "Teacher1234!")

    resp = await client.get(BASE_URL.format(ids["period_id"]))

    assert resp.status_code == 200
    assert "analyses" in resp.json()


@pytest.mark.asyncio
async def test_teacher_cannot_write_leader_analysis(la_client):
    client, ids = la_client
    await _login(client, "teacher.la@iub.edu.co", "Teacher1234!")

    resp = await client.put(
        BASE_URL.format(ids["period_id"]),
        json={"analyses": [{"perf_indicator_id": ids["pi1_id"], "analysis_text": "Intento docente"}]},
    )

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_leader_without_membership_cannot_write_leader_analysis(la_client):
    client, ids = la_client
    await _login(client, "other.leader.la@iub.edu.co", "Leader1234!")

    resp = await client.put(
        BASE_URL.format(ids["period_id"]),
        json={"analyses": [{"perf_indicator_id": ids["pi1_id"], "analysis_text": "Sin membresía"}]},
    )

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_analysis_text_is_sanitized_of_html(la_client):
    client, ids = la_client
    await _login(client, "leader.la@iub.edu.co", "Leader1234!")

    await client.put(
        BASE_URL.format(ids["period_id"]),
        json={
            "analyses": [
                {
                    "perf_indicator_id": ids["pi1_id"],
                    "analysis_text": "<b>Texto</b> con <script>alert(1)</script> HTML",
                }
            ]
        },
    )

    resp = await client.get(BASE_URL.format(ids["period_id"]))
    text = resp.json()["analyses"][0]["analysis_text"]
    assert "<b>" not in text
    assert "<script>" not in text
    assert "Texto" in text


@pytest.mark.asyncio
async def test_analysis_upsert_is_idempotent(la_client):
    client, ids = la_client
    await _login(client, "leader.la@iub.edu.co", "Leader1234!")

    await client.put(
        BASE_URL.format(ids["period_id"]),
        json={"analyses": [{"perf_indicator_id": ids["pi1_id"], "analysis_text": "Primera versión"}]},
    )
    await client.put(
        BASE_URL.format(ids["period_id"]),
        json={"analyses": [{"perf_indicator_id": ids["pi1_id"], "analysis_text": "Segunda versión"}]},
    )

    resp = await client.get(BASE_URL.format(ids["period_id"]))
    analyses = resp.json()["analyses"]
    assert len(analyses) == 1
    assert analyses[0]["analysis_text"] == "Segunda versión"


@pytest.mark.asyncio
async def test_period_not_found_returns_404(la_client):
    client, _ids = la_client
    await _login(client, "admin.la@iub.edu.co", "Admin1234!")

    resp = await client.get(BASE_URL.format(99999))

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_invalid_pi_returns_422(la_client):
    client, ids = la_client
    await _login(client, "leader.la@iub.edu.co", "Leader1234!")

    resp = await client.put(
        BASE_URL.format(ids["period_id"]),
        json={"analyses": [{"perf_indicator_id": 99999, "analysis_text": "PI inválido"}]},
    )

    assert resp.status_code == 422
