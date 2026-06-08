"""
Tests S2-02 — Assessments (PUT/GET /modules/{id}/assessments) and submit.
Covers: ownership control, level validation, distribution, 409 on incomplete submit.
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
from src.models.assessment import Assessment
from src.models.module import Module, ModuleAssignment
from src.models.module_analysis import ModuleAnalysis
from src.models.period import Period
from src.models.program import Program, ProgramMembership, PropedeuticLine
from src.models.rubric import PerfIndicator, Rubric
from src.models.student import ModuleStudent, Student
from src.models.student_outcome import StudentOutcome
from src.models.user import User

LOGIN_URL = "/api/v1/auth/login"


@pytest_asyncio.fixture
async def assessment_client():
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
            email="admin.assess@iub.edu.co",
            full_name="Admin Assess",
            role="admin",
            hashed_password=hash_password("Admin1234!"),
            is_active=True,
            auth_provider="local",
        )
        leader = User(
            email="leader.assess@iub.edu.co",
            full_name="Leader Assess",
            role="leader",
            hashed_password=hash_password("Leader1234!"),
            is_active=True,
            auth_provider="local",
        )
        teacher = User(
            email="teacher.assess@iub.edu.co",
            full_name="Teacher Assess",
            role="teacher",
            hashed_password=hash_password("Teacher1234!"),
            is_active=True,
            auth_provider="local",
        )
        other_teacher = User(
            email="other.teacher.assess@iub.edu.co",
            full_name="Other Teacher Assess",
            role="teacher",
            hashed_password=hash_password("Teacher1234!"),
            is_active=True,
            auth_provider="local",
        )
        db.add_all([admin, leader, teacher, other_teacher])
        await db.flush()

        line = PropedeuticLine(name="Gestión Administrativa", code="LP-GESTION-AS", is_active=True)
        db.add(line)
        await db.flush()
        program = Program(
            propedeutic_line_id=line.id,
            name="Tecnología en Gestión Administrativa",
            code="TGA-AS",
            cycle_level="tecnología",
            faculty="FCCEA",
        )
        db.add(program)
        await db.flush()
        db.add(ProgramMembership(user_id=leader.id, program_id=program.id, role="leader"))
        so = StudentOutcome(
            code="RA1-AS",
            description="RA 1 Assessments",
            is_active=True,
            program_id=program.id,
        )
        db.add(so)
        await db.flush()

        period = Period(
            name="TGA AS RA1 2026-1",
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
            rubric_id=rubric.id, code="PI1-AS", description="PI 1",
            pi_weight=Decimal("60.00"), is_active=True, position=1,
        )
        pi2 = PerfIndicator(
            rubric_id=rubric.id, code="PI2-AS", description="PI 2",
            pi_weight=Decimal("40.00"), is_active=True, position=2,
        )
        db.add_all([pi1, pi2])
        await db.flush()

        # Link rubric to period as active rubric
        period.rubric_id = rubric.id
        await db.flush()

        module = Module(
            period_id=period.id,
            course_code="TGA201-AS",
            course_name="Gestión de proyectos",
            group_name="A",
            status="in_progress",
        )
        other_module = Module(
            period_id=period.id,
            course_code="TGA202-AS",
            course_name="Otro curso",
            group_name="B",
            status="pending",
        )
        db.add_all([module, other_module])
        await db.flush()

        db.add(ModuleAssignment(module_id=module.id, user_id=teacher.id))
        db.add(ModuleAssignment(module_id=other_module.id, user_id=other_teacher.id))
        await db.flush()

        student = Student(
            internal_id="S001-AS", document_number="12345678", full_name="García Pérez, María"
        )
        db.add(student)
        await db.flush()

        ms = ModuleStudent(module_id=module.id, student_id=student.id, status="active")
        db.add(ms)
        await db.commit()

        ids = {
            "module_id": module.id,
            "other_module_id": other_module.id,
            "pi1_id": pi1.id,
            "pi2_id": pi2.id,
            "ms_id": ms.id,
            "rubric_id": rubric.id,
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
# PUT /modules/{id}/assessments
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_assigned_teacher_saves_assessments(assessment_client):
    client, ids = assessment_client
    await _login(client, "teacher.assess@iub.edu.co", "Teacher1234!")

    r = await client.put(
        f"/api/v1/modules/{ids['module_id']}/assessments",
        json={"assessments": [
            {"module_student_id": ids["ms_id"], "perf_indicator_id": ids["pi1_id"], "level": 4},
            {"module_student_id": ids["ms_id"], "perf_indicator_id": ids["pi2_id"], "level": 5},
        ]},
    )

    assert r.status_code == 200
    assert r.json()["saved"] == 2


@pytest.mark.asyncio
async def test_unassigned_teacher_cannot_save_assessments(assessment_client):
    client, ids = assessment_client
    await _login(client, "other.teacher.assess@iub.edu.co", "Teacher1234!")

    r = await client.put(
        f"/api/v1/modules/{ids['module_id']}/assessments",
        json={"assessments": [
            {"module_student_id": ids["ms_id"], "perf_indicator_id": ids["pi1_id"], "level": 2},
        ]},
    )

    assert r.status_code == 404


@pytest.mark.asyncio
async def test_invalid_level_returns_422(assessment_client):
    client, ids = assessment_client
    await _login(client, "teacher.assess@iub.edu.co", "Teacher1234!")

    r = await client.put(
        f"/api/v1/modules/{ids['module_id']}/assessments",
        json={"assessments": [
            {"module_student_id": ids["ms_id"], "perf_indicator_id": ids["pi1_id"], "level": 3},
        ]},
    )

    assert r.status_code == 422


@pytest.mark.asyncio
async def test_foreign_module_student_rejected(assessment_client):
    """Sending a module_student_id from a different module → 422."""
    client, ids = assessment_client
    await _login(client, "teacher.assess@iub.edu.co", "Teacher1234!")

    r = await client.put(
        f"/api/v1/modules/{ids['module_id']}/assessments",
        json={"assessments": [
            {"module_student_id": 99999, "perf_indicator_id": ids["pi1_id"], "level": 4},
        ]},
    )

    assert r.status_code == 422


# ---------------------------------------------------------------------------
# GET /modules/{id}/assessments
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_admin_views_assessments_with_distribution(assessment_client):
    client, ids = assessment_client
    await _login(client, "admin.assess@iub.edu.co", "Admin1234!")

    # Save a grade first
    await _login(client, "teacher.assess@iub.edu.co", "Teacher1234!")
    await client.put(
        f"/api/v1/modules/{ids['module_id']}/assessments",
        json={"assessments": [
            {"module_student_id": ids["ms_id"], "perf_indicator_id": ids["pi1_id"], "level": 4},
        ]},
    )
    await _login(client, "admin.assess@iub.edu.co", "Admin1234!")

    r = await client.get(f"/api/v1/modules/{ids['module_id']}/assessments")

    assert r.status_code == 200
    data = r.json()
    assert data["module_id"] == ids["module_id"]
    assert len(data["students"]) == 1
    assert "PI1-AS" in data["distribution"]
    student = data["students"][0]
    assert student["student_name"] == "García Pérez, María"
    assert len(student["assessments"]) == 1
    assert student["assessments"][0]["level"] == 4


@pytest.mark.asyncio
async def test_assigned_teacher_views_own_module_assessments(assessment_client):
    client, ids = assessment_client
    await _login(client, "teacher.assess@iub.edu.co", "Teacher1234!")

    r = await client.get(f"/api/v1/modules/{ids['module_id']}/assessments")

    assert r.status_code == 200


@pytest.mark.asyncio
async def test_unassigned_teacher_cannot_view_assessments(assessment_client):
    client, ids = assessment_client
    await _login(client, "other.teacher.assess@iub.edu.co", "Teacher1234!")

    r = await client.get(f"/api/v1/modules/{ids['module_id']}/assessments")

    assert r.status_code == 404


@pytest.mark.asyncio
async def test_upsert_updates_existing_grade(assessment_client):
    """Saving the same (module_student_id, pi_id) twice updates, not duplicates."""
    client, ids = assessment_client
    await _login(client, "teacher.assess@iub.edu.co", "Teacher1234!")

    await client.put(
        f"/api/v1/modules/{ids['module_id']}/assessments",
        json={"assessments": [
            {"module_student_id": ids["ms_id"], "perf_indicator_id": ids["pi1_id"], "level": 2},
        ]},
    )
    await client.put(
        f"/api/v1/modules/{ids['module_id']}/assessments",
        json={"assessments": [
            {"module_student_id": ids["ms_id"], "perf_indicator_id": ids["pi1_id"], "level": 5},
        ]},
    )

    r = await client.get(f"/api/v1/modules/{ids['module_id']}/assessments")
    data = r.json()
    grade = next(a for a in data["students"][0]["assessments"] if a["perf_indicator_id"] == ids["pi1_id"])
    assert grade["level"] == 5


# ---------------------------------------------------------------------------
# PUT /modules/{id}/submit
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_submit_without_grades_returns_409(assessment_client):
    client, ids = assessment_client
    await _login(client, "teacher.assess@iub.edu.co", "Teacher1234!")

    r = await client.put(f"/api/v1/modules/{ids['module_id']}/submit")

    assert r.status_code == 409
    assert r.json()["detail"]["reason"] == "students_without_grades"


@pytest.mark.asyncio
async def test_submit_without_analysis_returns_409(assessment_client):
    """All grades present but no qualitative analysis → 409."""
    client, ids = assessment_client
    await _login(client, "teacher.assess@iub.edu.co", "Teacher1234!")

    # Save all grades
    await client.put(
        f"/api/v1/modules/{ids['module_id']}/assessments",
        json={"assessments": [
            {"module_student_id": ids["ms_id"], "perf_indicator_id": ids["pi1_id"], "level": 4},
            {"module_student_id": ids["ms_id"], "perf_indicator_id": ids["pi2_id"], "level": 5},
        ]},
    )

    r = await client.put(f"/api/v1/modules/{ids['module_id']}/submit")

    assert r.status_code == 409
    assert r.json()["detail"]["reason"] == "missing_qualitative_analysis"


@pytest.mark.asyncio
async def test_submit_completes_when_all_requirements_met(assessment_client):
    """All grades + all analyses present → 200 with status=completed."""
    client, ids = assessment_client
    await _login(client, "teacher.assess@iub.edu.co", "Teacher1234!")

    await client.put(
        f"/api/v1/modules/{ids['module_id']}/assessments",
        json={"assessments": [
            {"module_student_id": ids["ms_id"], "perf_indicator_id": ids["pi1_id"], "level": 4},
            {"module_student_id": ids["ms_id"], "perf_indicator_id": ids["pi2_id"], "level": 5},
        ]},
    )
    await client.put(
        f"/api/v1/modules/{ids['module_id']}/qualitative",
        json={"analyses": [
            {"perf_indicator_id": ids["pi1_id"], "analysis_text": "El 80% alcanzó nivel adecuado."},
            {"perf_indicator_id": ids["pi2_id"], "analysis_text": "Los estudiantes mostraron dominio."},
        ]},
    )

    r = await client.put(f"/api/v1/modules/{ids['module_id']}/submit")

    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "completed"
    assert data["module_id"] == ids["module_id"]
    assert "submitted_at" in data


@pytest.mark.asyncio
async def test_unassigned_teacher_cannot_submit(assessment_client):
    client, ids = assessment_client
    await _login(client, "other.teacher.assess@iub.edu.co", "Teacher1234!")

    r = await client.put(f"/api/v1/modules/{ids['module_id']}/submit")

    assert r.status_code == 404
