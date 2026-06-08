"""
Tests S4 privacy gate — Habeas Data and student suppression.
Covers Ley 1581 access, admin-only authorization, anonymization, and audit logging.
"""
from datetime import date
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from src.api.deps import get_db
from src.api.main import app
from src.core.security import hash_password
from src.db.base import Base
from src.models.assessment import Assessment
from src.models.module import Module, ModuleAssignment
from src.models.period import Period
from src.models.program import Program, PropedeuticLine
from src.models.rubric import PerfIndicator, Rubric
from src.models.security import SecurityEvent
from src.models.student import ModuleStudent, Student
from src.models.student_outcome import StudentOutcome
from src.models.user import User

LOGIN_URL = "/api/v1/auth/login"


@pytest_asyncio.fixture
async def habeas_client():
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
            email="admin.habeas@iub.edu.co",
            full_name="Admin Habeas",
            role="admin",
            hashed_password=hash_password("Admin1234!"),
            is_active=True,
            auth_provider="local",
        )
        teacher = User(
            email="teacher.habeas@iub.edu.co",
            full_name="Teacher Habeas",
            role="teacher",
            hashed_password=hash_password("Teacher1234!"),
            is_active=True,
            auth_provider="local",
        )
        db.add_all([admin, teacher])
        await db.flush()

        line = PropedeuticLine(name="Gestión Administrativa", code="LP-HAB", is_active=True)
        db.add(line)
        await db.flush()
        program = Program(
            propedeutic_line_id=line.id,
            name="Tecnología en Gestión Administrativa",
            code="TGA-HAB",
            cycle_level="tecnología",
            faculty="FCCEA",
        )
        db.add(program)
        await db.flush()
        so = StudentOutcome(
            code="RA1-HAB",
            description="RA 1 Habeas",
            is_active=True,
            program_id=program.id,
        )
        db.add(so)
        await db.flush()

        period = Period(
            name="TGA HAB RA1 2026-1",
            student_outcome_id=so.id,
            start_date=date(2026, 1, 15),
            end_date=date(2026, 5, 30),
            status="closed",
            created_by=admin.id,
        )
        db.add(period)
        await db.flush()

        rubric = Rubric(student_outcome_id=so.id, period_id=period.id)
        db.add(rubric)
        await db.flush()
        pi = PerfIndicator(
            rubric_id=rubric.id,
            code="PI1-HAB",
            description="PI 1 Habeas",
            pi_weight=Decimal("100.00"),
            is_active=True,
            position=1,
        )
        db.add(pi)
        await db.flush()
        period.rubric_id = rubric.id

        module = Module(
            period_id=period.id,
            course_code="TGA501-HAB",
            course_name="Módulo Habeas",
            group_name="A",
            status="completed",
        )
        db.add(module)
        await db.flush()
        db.add(ModuleAssignment(module_id=module.id, user_id=teacher.id))

        student = Student(
            internal_id="S001-HAB",
            document_number="123456789",
            full_name="Titular Habeas",
        )
        db.add(student)
        await db.flush()
        module_student = ModuleStudent(module_id=module.id, student_id=student.id, status="active")
        db.add(module_student)
        await db.flush()
        db.add(Assessment(module_student_id=module_student.id, perf_indicator_id=pi.id, level=5))
        await db.commit()

        ids = {"student_id": student.id}

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
        yield client, ids, factory

    app.dependency_overrides.clear()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


async def _login(client: AsyncClient, email: str, password: str) -> None:
    r = await client.post(LOGIN_URL, json={"email": email, "password": password})
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_admin_reads_habeas_data_and_audit_log_omits_raw_document(habeas_client):
    client, _, factory = habeas_client
    await _login(client, "admin.habeas@iub.edu.co", "Admin1234!")

    r = await client.get("/api/v1/admin/habeas-data/123456789")

    assert r.status_code == 200
    data = r.json()
    assert data["document_number"] == "123456789"
    assert data["students"][0]["full_name"] == "Titular Habeas"
    assert data["students"][0]["modules"][0]["course_code"] == "TGA501-HAB"
    assert data["students"][0]["modules"][0]["assessments"][0]["pi_code"] == "PI1-HAB"
    assert data["students"][0]["modules"][0]["assessments"][0]["level"] == 4

    async with factory() as db:
        event = (
            await db.execute(
                select(SecurityEvent).where(SecurityEvent.event == "habeas_data_accessed")
            )
        ).scalar_one()
        assert event.detail["document_hash"] != "123456789"
        assert "123456789" not in str(event.detail)


@pytest.mark.asyncio
async def test_teacher_cannot_read_habeas_data(habeas_client):
    client, _, _ = habeas_client
    await _login(client, "teacher.habeas@iub.edu.co", "Teacher1234!")

    r = await client.get("/api/v1/admin/habeas-data/123456789")

    assert r.status_code == 403


@pytest.mark.asyncio
async def test_admin_suppresses_student_without_deleting_assessments(habeas_client):
    client, ids, factory = habeas_client
    await _login(client, "admin.habeas@iub.edu.co", "Admin1234!")

    r = await client.put(f"/api/v1/admin/suppress/{ids['student_id']}")

    assert r.status_code == 200
    data = r.json()
    assert data["id"] == ids["student_id"]
    assert data["full_name"] == "[SUPRIMIDO]"
    assert data["document_number"] == f"[SUPRIMIDO-{ids['student_id']}]"
    assert data["is_suppressed"] is True

    async with factory() as db:
        student = await db.get(Student, ids["student_id"])
        assessment_count = len(
            (
                await db.execute(
                    select(Assessment)
                    .join(ModuleStudent, ModuleStudent.id == Assessment.module_student_id)
                    .where(ModuleStudent.student_id == ids["student_id"])
                )
            ).scalars().all()
        )
        event = (
            await db.execute(
                select(SecurityEvent).where(SecurityEvent.event == "student_suppressed")
            )
        ).scalar_one()

        assert student is not None
        assert student.full_name == "[SUPRIMIDO]"
        assert assessment_count == 1
        assert event.detail["document_hash"] != "123456789"
        assert "123456789" not in str(event.detail)


@pytest.mark.asyncio
async def test_teacher_cannot_suppress_student(habeas_client):
    client, ids, _ = habeas_client
    await _login(client, "teacher.habeas@iub.edu.co", "Teacher1234!")

    r = await client.put(f"/api/v1/admin/suppress/{ids['student_id']}")

    assert r.status_code == 403
