"""
E2E-API-01 — Flujos de submit encadenados (E2E-01 a E2E-04).
Capa 1 de la estrategia E2E: pytest + httpx + SQLite StaticPool, sin infraestructura adicional.
Ver docs/TEST_PLAN.md §11.1 y memory/DECISIONS.md ADR-15.
"""
import csv
import io
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


def _make_csv(rows: list[dict]) -> bytes:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=["internal_id", "document_number", "full_name"])
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue().encode("utf-8")


async def _login(client: AsyncClient, email: str, password: str) -> None:
    r = await client.post(LOGIN_URL, json={"email": email, "password": password})
    assert r.status_code == 200


async def _import_csv(client: AsyncClient, module_id: int, rows: list[dict]) -> dict:
    r = await client.post(
        f"/api/v1/modules/{module_id}/students/import",
        data={"consent_acknowledged": "true"},
        files={"file": ("students.csv", _make_csv(rows), "text/csv")},
    )
    assert r.status_code == 200
    return r.json()


@pytest_asyncio.fixture
async def flow_client():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with factory() as db:
        teacher = User(
            email="teacher.e2e@iub.edu.co",
            full_name="Teacher E2E",
            role="teacher",
            hashed_password=hash_password("Teacher1234!"),
            is_active=True,
            auth_provider="local",
        )
        leader = User(
            email="leader.e2e@iub.edu.co",
            full_name="Leader E2E",
            role="leader",
            hashed_password=hash_password("Leader1234!"),
            is_active=True,
            auth_provider="local",
        )
        db.add_all([teacher, leader])
        await db.flush()

        line = PropedeuticLine(name="Sistemas E2E", code="LP-SIS-E2E", is_active=True)
        db.add(line)
        await db.flush()

        program = Program(
            propedeutic_line_id=line.id,
            name="Ingeniería de Sistemas E2E",
            code="IS-E2E",
            cycle_level="pregrado",
            faculty="FCEIA",
        )
        db.add(program)
        await db.flush()

        db.add(ProgramMembership(user_id=leader.id, program_id=program.id, role="leader"))

        so = StudentOutcome(
            code="RA1-E2E",
            description="RA 1 E2E",
            is_active=True,
            program_id=program.id,
        )
        db.add(so)
        await db.flush()

        period = Period(
            name="IS E2E RA1 2026-1",
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
        period.rubric_id = rubric.id

        pi1 = PerfIndicator(
            rubric_id=rubric.id,
            code="PI-E2E-01",
            description="Indicador E2E 1",
            pi_weight=Decimal("60.00"),
            is_active=True,
            position=1,
        )
        pi2 = PerfIndicator(
            rubric_id=rubric.id,
            code="PI-E2E-02",
            description="Indicador E2E 2",
            pi_weight=Decimal("40.00"),
            is_active=True,
            position=2,
        )
        db.add_all([pi1, pi2])
        await db.flush()

        module = Module(
            period_id=period.id,
            course_code="IS301-E2E",
            course_name="Módulo E2E",
            group_name="A",
            status="in_progress",
        )
        db.add(module)
        await db.flush()
        db.add(ModuleAssignment(module_id=module.id, user_id=teacher.id))

        await db.commit()
        ids = {
            "module_id": module.id,
            "pi_ids": [pi1.id, pi2.id],
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


# ---------------------------------------------------------------------------
# E2E-01: flujo completo — import → grade → qualitative → submit
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_full_module_flow(flow_client):
    """E2E-01: login → import → PUT assessments → PUT qualitative → PUT submit → completed."""
    client, ids = flow_client
    module_id = ids["module_id"]
    pi_ids = ids["pi_ids"]

    await _login(client, "teacher.e2e@iub.edu.co", "Teacher1234!")

    import_data = await _import_csv(client, module_id, [
        {"internal_id": "E2E-S01", "document_number": "10000001", "full_name": "Estudiante Uno"},
        {"internal_id": "E2E-S02", "document_number": "10000002", "full_name": "Estudiante Dos"},
    ])
    assert import_data["imported"] == 2

    # GET assessments to obtain real module_student_ids before grading
    r = await client.get(f"/api/v1/modules/{module_id}/assessments")
    assert r.status_code == 200
    students = r.json()["students"]
    assert len(students) == 2
    ms_ids = [s["module_student_id"] for s in students]

    r = await client.put(f"/api/v1/modules/{module_id}/assessments", json={
        "assessments": [
            {"module_student_id": ms_id, "perf_indicator_id": pi_id, "level": 3}
            for ms_id in ms_ids
            for pi_id in pi_ids
        ]
    })
    assert r.status_code == 200
    assert r.json()["saved"] == 4  # 2 students × 2 PIs

    r = await client.put(f"/api/v1/modules/{module_id}/qualitative", json={
        "analyses": [
            {"perf_indicator_id": pi_id, "analysis_text": f"Análisis PI {pi_id} — nivel logrado."}
            for pi_id in pi_ids
        ]
    })
    assert r.status_code == 200
    assert r.json()["saved"] == 2

    r = await client.put(f"/api/v1/modules/{module_id}/submit")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "completed"
    assert data["module_id"] == module_id
    assert "submitted_at" in data


# ---------------------------------------------------------------------------
# E2E-02: líder lee datos reales de un módulo completado por el docente
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_leader_reads_completed_module(flow_client):
    """E2E-02: leader reads real assessment and qualitative data after teacher completes module."""
    client, ids = flow_client
    module_id = ids["module_id"]
    pi_ids = ids["pi_ids"]

    # Complete the module as teacher
    await _login(client, "teacher.e2e@iub.edu.co", "Teacher1234!")
    await _import_csv(client, module_id, [
        {"internal_id": "E2E-S03", "document_number": "10000003", "full_name": "Estudiante Tres"},
    ])

    r = await client.get(f"/api/v1/modules/{module_id}/assessments")
    ms_ids = [s["module_student_id"] for s in r.json()["students"]]

    await client.put(f"/api/v1/modules/{module_id}/assessments", json={
        "assessments": [
            {"module_student_id": ms_id, "perf_indicator_id": pi_id, "level": 4}
            for ms_id in ms_ids
            for pi_id in pi_ids
        ]
    })
    await client.put(f"/api/v1/modules/{module_id}/qualitative", json={
        "analyses": [
            {"perf_indicator_id": pi_id, "analysis_text": "Todos los estudiantes alcanzaron nivel Exemplary."}
            for pi_id in pi_ids
        ]
    })
    r = await client.put(f"/api/v1/modules/{module_id}/submit")
    assert r.status_code == 200

    # Switch to leader and verify read access returns real data
    await _login(client, "leader.e2e@iub.edu.co", "Leader1234!")

    r = await client.get(f"/api/v1/modules/{module_id}/assessments")
    assert r.status_code == 200
    assess_data = r.json()
    assert assess_data["module_id"] == module_id
    assert len(assess_data["students"]) == 1
    assert len(assess_data["students"][0]["assessments"]) == 2  # both PIs graded

    r = await client.get(f"/api/v1/modules/{module_id}/qualitative")
    assert r.status_code == 200
    qual_data = r.json()
    assert qual_data["module_id"] == module_id
    assert len(qual_data["analyses"]) == 2  # both PIs analyzed


# ---------------------------------------------------------------------------
# E2E-03: submit bloqueado en secuencia — grades gate → qualitative gate → OK
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_submit_gates_in_sequence(flow_client):
    """E2E-03: submit rejected at grades gate, then at qualitative gate, then succeeds."""
    client, ids = flow_client
    module_id = ids["module_id"]
    pi_ids = ids["pi_ids"]

    await _login(client, "teacher.e2e@iub.edu.co", "Teacher1234!")
    await _import_csv(client, module_id, [
        {"internal_id": "E2E-S04", "document_number": "10000004", "full_name": "Estudiante Cuatro"},
    ])

    # Gate 1: no grades → 409 students_without_grades
    r = await client.put(f"/api/v1/modules/{module_id}/submit")
    assert r.status_code == 409
    assert r.json()["detail"]["reason"] == "students_without_grades"

    # Grade all students on all PIs
    r = await client.get(f"/api/v1/modules/{module_id}/assessments")
    ms_ids = [s["module_student_id"] for s in r.json()["students"]]
    await client.put(f"/api/v1/modules/{module_id}/assessments", json={
        "assessments": [
            {"module_student_id": ms_id, "perf_indicator_id": pi_id, "level": 2}
            for ms_id in ms_ids
            for pi_id in pi_ids
        ]
    })

    # Gate 2: grades complete but no qualitative → 409 missing_qualitative_analysis
    r = await client.put(f"/api/v1/modules/{module_id}/submit")
    assert r.status_code == 409
    assert r.json()["detail"]["reason"] == "missing_qualitative_analysis"

    # Add qualitative analysis for all PIs
    await client.put(f"/api/v1/modules/{module_id}/qualitative", json={
        "analyses": [
            {"perf_indicator_id": pi_id, "analysis_text": "Análisis completo tras superar ambas gates."}
            for pi_id in pi_ids
        ]
    })

    # Both gates cleared → submit succeeds
    r = await client.put(f"/api/v1/modules/{module_id}/submit")
    assert r.status_code == 200
    assert r.json()["status"] == "completed"


# ---------------------------------------------------------------------------
# E2E-04: import idempotente → calificar desde IDs reales → submit
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_idempotent_import_then_grade(flow_client):
    """E2E-04: second import skips all rows; grade using IDs from GET; submit succeeds."""
    client, ids = flow_client
    module_id = ids["module_id"]
    pi_ids = ids["pi_ids"]

    students_rows = [
        {"internal_id": "E2E-S05", "document_number": "10000005", "full_name": "Estudiante Cinco"},
        {"internal_id": "E2E-S06", "document_number": "10000006", "full_name": "Estudiante Seis"},
    ]

    await _login(client, "teacher.e2e@iub.edu.co", "Teacher1234!")

    # First import: creates 2 students
    data = await _import_csv(client, module_id, students_rows)
    assert data["imported"] == 2
    assert data["skipped"] == 0

    # Second import of identical data: both skipped as already_enrolled
    data = await _import_csv(client, module_id, students_rows)
    assert data["skipped"] == 2
    assert data["imported"] == 0
    assert all(s["action"] == "already_enrolled" for s in data["students"])

    # GET assessments to obtain real module_student_ids (no duplicates despite double import)
    r = await client.get(f"/api/v1/modules/{module_id}/assessments")
    assert r.status_code == 200
    students = r.json()["students"]
    assert len(students) == 2
    ms_ids = [s["module_student_id"] for s in students]

    # Grade all students × all PIs using IDs from the GET response
    r = await client.put(f"/api/v1/modules/{module_id}/assessments", json={
        "assessments": [
            {"module_student_id": ms_id, "perf_indicator_id": pi_id, "level": 3}
            for ms_id in ms_ids
            for pi_id in pi_ids
        ]
    })
    assert r.status_code == 200

    await client.put(f"/api/v1/modules/{module_id}/qualitative", json={
        "analyses": [
            {"perf_indicator_id": pi_id, "analysis_text": "Análisis post-import idempotente."}
            for pi_id in pi_ids
        ]
    })

    r = await client.put(f"/api/v1/modules/{module_id}/submit")
    assert r.status_code == 200
    assert r.json()["status"] == "completed"
