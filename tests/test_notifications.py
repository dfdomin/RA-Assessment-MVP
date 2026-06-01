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
from src.models.program import Program, ProgramMembership, PropedeuticLine
from src.models.rubric import PerfIndicator, Rubric
from src.models.security import SecurityEvent
from src.models.student import ModuleStudent, Student
from src.models.student_outcome import StudentOutcome
from src.models.user import User

LOGIN_URL = "/api/v1/auth/login"


@pytest_asyncio.fixture
async def notifications_client():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with session_factory() as db:
        admin = User(
            email="admin.notify@iub.edu.co",
            full_name="Admin Notify",
            role="admin",
            hashed_password=hash_password("Admin1234!"),
            is_active=True,
            auth_provider="local",
        )
        leader = User(
            email="leader.notify@iub.edu.co",
            full_name="Leader Notify",
            role="leader",
            hashed_password=hash_password("Leader1234!"),
            is_active=True,
            auth_provider="local",
        )
        other_leader = User(
            email="other.leader.notify@iub.edu.co",
            full_name="Other Leader Notify",
            role="leader",
            hashed_password=hash_password("Leader1234!"),
            is_active=True,
            auth_provider="local",
        )
        teacher = User(
            email="teacher.notify@iub.edu.co",
            full_name="Teacher Notify",
            role="teacher",
            hashed_password=hash_password("Teacher1234!"),
            is_active=True,
            auth_provider="local",
        )
        other_teacher = User(
            email="other.teacher.notify@iub.edu.co",
            full_name="Other Teacher Notify",
            role="teacher",
            hashed_password=hash_password("Teacher1234!"),
            is_active=True,
            auth_provider="local",
        )
        outsider = User(
            email="outsider.notify@iub.edu.co",
            full_name="Outsider Notify",
            role="teacher",
            hashed_password=hash_password("Teacher1234!"),
            is_active=True,
            auth_provider="local",
        )
        db.add_all([admin, leader, other_leader, teacher, other_teacher, outsider])
        await db.flush()

        line = PropedeuticLine(name="Telemática", code="LP-TEL-N", is_active=True)
        db.add(line)
        await db.flush()
        program = Program(
            propedeutic_line_id=line.id,
            name="Ingeniería Telemática",
            code="INGTEL-N",
            cycle_level="profesional",
            faculty="FI",
        )
        db.add(program)
        await db.flush()
        db.add(ProgramMembership(user_id=leader.id, program_id=program.id, role="leader"))

        so = StudentOutcome(
            code="RA-N",
            description="RA notificaciones",
            is_active=True,
            program_id=program.id,
        )
        db.add(so)
        await db.flush()
        period = Period(
            name="RA-N 2026-1",
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
        pi = PerfIndicator(
            rubric_id=rubric.id,
            code="PI-N1",
            description="PI notificaciones",
            pi_weight=Decimal("100.00"),
            is_active=True,
            position=1,
        )
        db.add(pi)
        await db.flush()
        period.rubric_id = rubric.id

        pending_module = Module(
            period_id=period.id,
            course_code="TEL101",
            course_name="Redes I",
            group_name="A",
            status="in_progress",
        )
        completed_module = Module(
            period_id=period.id,
            course_code="TEL102",
            course_name="Telecomunicaciones",
            group_name="B",
            status="completed",
        )
        db.add_all([pending_module, completed_module])
        await db.flush()
        db.add_all(
            [
                ModuleAssignment(module_id=pending_module.id, user_id=teacher.id),
                ModuleAssignment(module_id=completed_module.id, user_id=other_teacher.id),
            ]
        )
        await db.flush()

        students = [
            Student(internal_id="NOT-S001", document_number="9001", full_name="Uno"),
            Student(internal_id="NOT-S002", document_number="9002", full_name="Dos"),
        ]
        db.add_all(students)
        await db.flush()
        module_students = [
            ModuleStudent(module_id=pending_module.id, student_id=students[0].id, status="active"),
            ModuleStudent(module_id=pending_module.id, student_id=students[1].id, status="active"),
        ]
        db.add_all(module_students)
        await db.flush()
        db.add(Assessment(module_student_id=module_students[0].id, perf_indicator_id=pi.id, level=3))
        await db.commit()

        ids = {
            "period_id": period.id,
            "teacher_id": teacher.id,
            "other_teacher_id": other_teacher.id,
            "outsider_id": outsider.id,
        }

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
        yield client, session_factory, ids

    app.dependency_overrides.clear()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


async def _login(client: AsyncClient, email: str, password: str) -> None:
    resp = await client.post(LOGIN_URL, json={"email": email, "password": password})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_leader_gets_tracking_metrics_for_period_modules(notifications_client):
    client, _session_factory, ids = notifications_client
    await _login(client, "leader.notify@iub.edu.co", "Leader1234!")

    resp = await client.get(f"/api/v1/periods/{ids['period_id']}/tracking")

    assert resp.status_code == 200
    rows = resp.json()
    assert len(rows) == 2
    pending = next(row for row in rows if row["course_name"] == "Redes I")
    assert pending["teacher"]["id"] == ids["teacher_id"]
    assert pending["students_active"] == 2
    assert pending["students_graded"] == 1
    assert pending["progress_pct"] == 50
    assert pending["days_remaining"] >= 0


@pytest.mark.asyncio
async def test_teacher_cannot_access_tracking(notifications_client):
    client, _session_factory, ids = notifications_client
    await _login(client, "teacher.notify@iub.edu.co", "Teacher1234!")

    resp = await client.get(f"/api/v1/periods/{ids['period_id']}/tracking")

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_reminder_preview_resolves_first_pending_teacher_variables(notifications_client):
    client, _session_factory, ids = notifications_client
    await _login(client, "admin.notify@iub.edu.co", "Admin1234!")

    resp = await client.get(
        f"/api/v1/periods/{ids['period_id']}/reminders/preview",
        params={
            "recipient_ids": str(ids["teacher_id"]),
            "message_body": "Hola {nombre_docente}: {modulo} va en {avance_pct}% ({dias_restantes} días).",
        },
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["recipient"]["id"] == ids["teacher_id"]
    assert "Teacher Notify" in body["subject"]
    assert "Redes I" in body["preview_body"]
    assert "{modulo}" not in body["preview_body"]


@pytest.mark.asyncio
async def test_reminders_reject_recipient_outside_period(notifications_client):
    client, _session_factory, ids = notifications_client
    await _login(client, "leader.notify@iub.edu.co", "Leader1234!")

    resp = await client.post(
        f"/api/v1/periods/{ids['period_id']}/reminders",
        json={
            "recipient_ids": [ids["outsider_id"]],
            "message_body": "Hola {nombre_docente}",
        },
    )

    assert resp.status_code == 400
    assert resp.json()["detail"]["reason"] == "invalid_recipient_ids"


@pytest.mark.asyncio
async def test_reminders_log_internal_recipient_ids_without_external_emails(notifications_client):
    client, session_factory, ids = notifications_client
    await _login(client, "leader.notify@iub.edu.co", "Leader1234!")

    resp = await client.post(
        f"/api/v1/periods/{ids['period_id']}/reminders",
        json={
            "recipient_ids": [ids["teacher_id"]],
            "message_body": "Hola {nombre_docente}, revisa {modulo}.",
        },
    )

    assert resp.status_code == 200
    assert resp.json() == {"sent": 1, "failed": 0}
    async with session_factory() as db:
        event = (
            await db.execute(select(SecurityEvent).where(SecurityEvent.event == "reminder_sent"))
        ).scalar_one()
    assert event.detail["period_id"] == ids["period_id"]
    assert event.detail["recipient_ids"] == [ids["teacher_id"]]
    assert "teacher.notify@iub.edu.co" not in str(event.detail)


@pytest.mark.asyncio
async def test_reminders_throttle_by_recipient_count_per_user(notifications_client):
    client, _session_factory, ids = notifications_client
    await _login(client, "admin.notify@iub.edu.co", "Admin1234!")

    first = await client.post(
        f"/api/v1/periods/{ids['period_id']}/reminders",
        json={
            "recipient_ids": [ids["teacher_id"]] * 15,
            "message_body": "Hola {nombre_docente}",
        },
    )
    second = await client.post(
        f"/api/v1/periods/{ids['period_id']}/reminders",
        json={
            "recipient_ids": [ids["teacher_id"]],
            "message_body": "Hola {nombre_docente}",
        },
    )

    assert first.status_code == 200
    assert second.status_code == 429
    assert second.json()["detail"]["reason"] == "reminder_rate_limit_exceeded"
