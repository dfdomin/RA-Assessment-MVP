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
async def period_close_client():
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
            email="admin.close@iub.edu.co",
            full_name="Admin Close",
            role="admin",
            hashed_password=hash_password("Admin1234!"),
            is_active=True,
            auth_provider="local",
        )
        leader = User(
            email="leader.close@iub.edu.co",
            full_name="Leader Close",
            role="leader",
            hashed_password=hash_password("Leader1234!"),
            is_active=True,
            auth_provider="local",
        )
        other_leader = User(
            email="other.leader.close@iub.edu.co",
            full_name="Other Leader Close",
            role="leader",
            hashed_password=hash_password("Leader1234!"),
            is_active=True,
            auth_provider="local",
        )
        teacher = User(
            email="teacher.close@iub.edu.co",
            full_name="Teacher Close",
            role="teacher",
            hashed_password=hash_password("Teacher1234!"),
            is_active=True,
            auth_provider="local",
        )
        db.add_all([admin, leader, other_leader, teacher])
        await db.flush()

        line = PropedeuticLine(name="Gestión Administrativa", code="LP-CLOSE", is_active=True)
        db.add(line)
        await db.flush()
        program = Program(
            propedeutic_line_id=line.id,
            name="Tecnología en Gestión Administrativa",
            code="TGA-CLOSE",
            cycle_level="tecnología",
            faculty="FCCEA",
        )
        other_program = Program(
            propedeutic_line_id=line.id,
            name="Tecnología en Otro Programa",
            code="TOP-CLOSE",
            cycle_level="tecnología",
            faculty="FCCEA",
        )
        db.add_all([program, other_program])
        await db.flush()
        db.add(ProgramMembership(user_id=leader.id, program_id=program.id, role="leader"))
        db.add(ProgramMembership(user_id=other_leader.id, program_id=other_program.id, role="leader"))

        so = StudentOutcome(
            code="RA-CLOSE",
            description="RA cierre",
            is_active=True,
            program_id=program.id,
        )
        db.add(so)
        await db.flush()

        completed_period = Period(
            name="TGA Cierre completo 2026-1",
            student_outcome_id=so.id,
            start_date=date(2026, 1, 15),
            end_date=date(2026, 5, 30),
            status="open",
            created_by=leader.id,
        )
        pending_period = Period(
            name="TGA Cierre pendiente 2026-1",
            student_outcome_id=so.id,
            start_date=date(2026, 1, 15),
            end_date=date(2026, 5, 30),
            status="open",
            created_by=leader.id,
        )
        closed_period = Period(
            name="TGA Cierre bloqueado 2026-1",
            student_outcome_id=so.id,
            start_date=date(2026, 1, 15),
            end_date=date(2026, 5, 30),
            status="closed",
            created_by=leader.id,
        )
        db.add_all([completed_period, pending_period, closed_period])
        await db.flush()

        rubric = Rubric(student_outcome_id=so.id, period_id=closed_period.id)
        db.add(rubric)
        await db.flush()
        pi = PerfIndicator(
            rubric_id=rubric.id,
            code="PI-CLOSE",
            description="PI cierre",
            pi_weight=Decimal("100.00"),
            is_active=True,
            position=1,
        )
        db.add(pi)
        await db.flush()
        closed_period.rubric_id = rubric.id

        completed_module = Module(
            period_id=completed_period.id,
            course_code="CLOSE101",
            course_name="Módulo completo",
            group_name="A",
            status="completed",
        )
        pending_module = Module(
            period_id=pending_period.id,
            course_code="CLOSE102",
            course_name="Módulo pendiente",
            group_name="B",
            status="pending",
        )
        closed_module = Module(
            period_id=closed_period.id,
            course_code="CLOSE103",
            course_name="Módulo cerrado",
            group_name="C",
            status="completed",
        )
        db.add_all([completed_module, pending_module, closed_module])
        await db.flush()
        db.add(ModuleAssignment(module_id=closed_module.id, user_id=teacher.id))

        student = Student(
            internal_id="S-CLOSE-001",
            document_number="999",
            full_name="Estudiante Cierre",
        )
        db.add(student)
        await db.flush()
        ms = ModuleStudent(module_id=closed_module.id, student_id=student.id, status="active")
        db.add(ms)
        await db.commit()

        ids = {
            "completed_period_id": completed_period.id,
            "pending_period_id": pending_period.id,
            "closed_module_id": closed_module.id,
            "module_student_id": ms.id,
            "pi_id": pi.id,
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
        yield client, ids, factory

    app.dependency_overrides.clear()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


async def _login(client: AsyncClient, email: str, password: str) -> None:
    response = await client.post(LOGIN_URL, json={"email": email, "password": password})
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_leader_closes_completed_period_and_writes_audit_event(period_close_client):
    client, ids, factory = period_close_client
    await _login(client, "leader.close@iub.edu.co", "Leader1234!")

    response = await client.put(
        f"/api/v1/periods/{ids['completed_period_id']}/close",
        json={"force": False},
    )

    assert response.status_code == 200
    assert response.json() == {
        "period_id": ids["completed_period_id"],
        "status": "closed",
        "modules_pending": [],
    }

    async with factory() as db:
        period = await db.get(Period, ids["completed_period_id"])
        event = await db.scalar(
            select(SecurityEvent).where(SecurityEvent.event == "period_closed")
        )
    assert period.status == "closed"
    assert event is not None
    assert event.detail["period_id"] == ids["completed_period_id"]


@pytest.mark.asyncio
async def test_close_period_without_force_returns_pending_modules(period_close_client):
    client, ids, _factory = period_close_client
    await _login(client, "leader.close@iub.edu.co", "Leader1234!")

    response = await client.put(
        f"/api/v1/periods/{ids['pending_period_id']}/close",
        json={"force": False},
    )

    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail["reason"] == "modules_pending"
    assert detail["modules_pending"][0]["course_code"] == "CLOSE102"


@pytest.mark.asyncio
async def test_close_period_with_force_closes_even_with_pending_modules(period_close_client):
    client, ids, _factory = period_close_client
    await _login(client, "leader.close@iub.edu.co", "Leader1234!")

    response = await client.put(
        f"/api/v1/periods/{ids['pending_period_id']}/close",
        json={"force": True},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "closed"
    assert response.json()["modules_pending"][0]["course_code"] == "CLOSE102"


@pytest.mark.asyncio
async def test_teacher_cannot_close_period(period_close_client):
    client, ids, _factory = period_close_client
    await _login(client, "teacher.close@iub.edu.co", "Teacher1234!")

    response = await client.put(
        f"/api/v1/periods/{ids['completed_period_id']}/close",
        json={"force": False},
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_closed_period_blocks_teacher_assessment_writes(period_close_client):
    client, ids, _factory = period_close_client
    await _login(client, "teacher.close@iub.edu.co", "Teacher1234!")

    response = await client.put(
        f"/api/v1/modules/{ids['closed_module_id']}/assessments",
        json={
            "assessments": [
                {
                    "module_student_id": ids["module_student_id"],
                    "perf_indicator_id": ids["pi_id"],
                    "level": 3,
                }
            ]
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Period is closed"
