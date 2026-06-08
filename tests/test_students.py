"""
Tests S2-04 — Student list (GET /modules/{id}/students).
Covers: module ownership, grade visibility, and per-student completion status.
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
from src.models.period import Period
from src.models.program import Program, ProgramMembership, PropedeuticLine
from src.models.rubric import PerfIndicator, Rubric
from src.models.student import ModuleStudent, Student
from src.models.student_outcome import StudentOutcome
from src.models.user import User

LOGIN_URL = "/api/v1/auth/login"


@pytest_asyncio.fixture
async def students_client():
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
            email="teacher.students@iub.edu.co",
            full_name="Teacher Students",
            role="teacher",
            hashed_password=hash_password("Teacher1234!"),
            is_active=True,
            auth_provider="local",
        )
        other_teacher = User(
            email="other.students@iub.edu.co",
            full_name="Other Teacher Students",
            role="teacher",
            hashed_password=hash_password("Teacher1234!"),
            is_active=True,
            auth_provider="local",
        )
        leader = User(
            email="leader.students@iub.edu.co",
            full_name="Leader Students",
            role="leader",
            hashed_password=hash_password("Leader1234!"),
            is_active=True,
            auth_provider="local",
        )
        db.add_all([teacher, other_teacher, leader])
        await db.flush()

        line = PropedeuticLine(name="Gestión Administrativa", code="LP-GESTION-ST", is_active=True)
        db.add(line)
        await db.flush()
        program = Program(
            propedeutic_line_id=line.id,
            name="Tecnología en Gestión Administrativa",
            code="TGA-ST",
            cycle_level="tecnología",
            faculty="FCCEA",
        )
        db.add(program)
        await db.flush()
        db.add(ProgramMembership(user_id=leader.id, program_id=program.id, role="leader"))
        so = StudentOutcome(
            code="RA1-ST",
            description="RA 1 Students",
            is_active=True,
            program_id=program.id,
        )
        db.add(so)
        await db.flush()

        period = Period(
            name="TGA ST RA1 2026-1",
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
            rubric_id=rubric.id,
            code="PI1-ST",
            description="PI 1",
            pi_weight=Decimal("50.00"),
            is_active=True,
            position=1,
        )
        pi2 = PerfIndicator(
            rubric_id=rubric.id,
            code="PI2-ST",
            description="PI 2",
            pi_weight=Decimal("50.00"),
            is_active=True,
            position=2,
        )
        db.add_all([pi1, pi2])
        await db.flush()
        period.rubric_id = rubric.id

        module = Module(
            period_id=period.id,
            course_code="TGA401-ST",
            course_name="Módulo Students",
            group_name="A",
            status="in_progress",
        )
        db.add(module)
        await db.flush()
        db.add(ModuleAssignment(module_id=module.id, user_id=teacher.id))

        complete_student = Student(
            internal_id="S001-ST",
            document_number="11111111",
            full_name="Completa, Ana",
        )
        incomplete_student = Student(
            internal_id="S002-ST",
            document_number="22222222",
            full_name="Incompleto, Luis",
        )
        db.add_all([complete_student, incomplete_student])
        await db.flush()

        complete_ms = ModuleStudent(module_id=module.id, student_id=complete_student.id, status="active")
        incomplete_ms = ModuleStudent(module_id=module.id, student_id=incomplete_student.id, status="active")
        db.add_all([complete_ms, incomplete_ms])
        await db.flush()

        db.add_all([
            Assessment(module_student_id=complete_ms.id, perf_indicator_id=pi1.id, level=4),
            Assessment(module_student_id=complete_ms.id, perf_indicator_id=pi2.id, level=5),
            Assessment(module_student_id=incomplete_ms.id, perf_indicator_id=pi1.id, level=2),
        ])
        await db.commit()

        ids = {"module_id": module.id}

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


@pytest.mark.asyncio
async def test_assigned_teacher_lists_students_with_completion_status(students_client):
    client, ids = students_client
    await _login(client, "teacher.students@iub.edu.co", "Teacher1234!")

    r = await client.get(f"/api/v1/modules/{ids['module_id']}/students")

    assert r.status_code == 200
    data = r.json()
    assert data["module_id"] == ids["module_id"]
    assert data["active_students"] == 2
    assert data["fully_graded_students"] == 1
    assert data["active_pi_count"] == 2

    complete = data["students"][0]
    incomplete = data["students"][1]
    assert complete["full_name"] == "Completa, Ana"
    assert complete["is_fully_graded"] is True
    assert complete["missing_pi_count"] == 0
    assert [grade["pi_code"] for grade in complete["assessments"]] == ["PI1-ST", "PI2-ST"]

    assert incomplete["full_name"] == "Incompleto, Luis"
    assert incomplete["is_fully_graded"] is False
    assert incomplete["missing_pi_count"] == 1
    assert incomplete["assessments"][0]["level"] == 2


@pytest.mark.asyncio
async def test_student_list_includes_active_pi_metadata_for_empty_grades(students_client):
    client, ids = students_client
    await _login(client, "teacher.students@iub.edu.co", "Teacher1234!")

    r = await client.get(f"/api/v1/modules/{ids['module_id']}/students")

    assert r.status_code == 200
    data = r.json()
    assert data["active_perf_indicators"] == [
        {"id": 1, "code": "PI1-ST"},
        {"id": 2, "code": "PI2-ST"},
    ]


@pytest.mark.asyncio
async def test_unassigned_teacher_cannot_list_students(students_client):
    client, ids = students_client
    await _login(client, "other.students@iub.edu.co", "Teacher1234!")

    r = await client.get(f"/api/v1/modules/{ids['module_id']}/students")

    assert r.status_code == 404
