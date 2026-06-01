from datetime import date

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
from src.models.student_outcome import StudentOutcome
from src.models.user import User


PERIODS_URL = "/api/v1/periods"
LOGIN_URL = "/api/v1/auth/login"


@pytest_asyncio.fixture
async def periods_client():
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
            email="admin.periods@iub.edu.co",
            full_name="Admin Periods",
            role="admin",
            hashed_password=hash_password("Admin1234!"),
            is_active=True,
            auth_provider="local",
        )
        leader = User(
            email="leader.periods@iub.edu.co",
            full_name="Leader Periods",
            role="leader",
            hashed_password=hash_password("Leader1234!"),
            is_active=True,
            auth_provider="local",
        )
        teacher = User(
            email="teacher.periods@iub.edu.co",
            full_name="Teacher Periods",
            role="teacher",
            hashed_password=hash_password("Teacher1234!"),
            is_active=True,
            auth_provider="local",
        )
        line = PropedeuticLine(name="Gestión Administrativa", code="LP-GESTION-P", is_active=True)
        db.add(line)
        await db.flush()
        program = Program(
            propedeutic_line_id=line.id,
            name="Tecnología en Gestión Administrativa",
            code="TGA-P",
            cycle_level="tecnología",
            faculty="FCCEA",
        )
        db.add(program)
        await db.flush()
        db.add_all([admin, leader, teacher])
        await db.flush()
        student_outcome = StudentOutcome(
            code="RA1",
            description="Resultado de aprendizaje 1",
            is_active=True,
            program_id=program.id,
        )
        db.add(student_outcome)
        await db.flush()
        db.add(ProgramMembership(user_id=leader.id, program_id=program.id, role="leader"))
        await db.flush()

        assigned_period = Period(
            name="TGA RA1 2026-1",
            student_outcome_id=student_outcome.id,
            start_date=date(2026, 1, 15),
            end_date=date(2026, 5, 30),
            status="open",
            created_by=leader.id,
        )
        unassigned_period = Period(
            name="TGA RA1 2026-2",
            student_outcome_id=student_outcome.id,
            start_date=date(2026, 8, 1),
            end_date=date(2026, 12, 15),
            status="draft",
            created_by=leader.id,
        )
        db.add_all([assigned_period, unassigned_period])
        await db.flush()

        assigned_module = Module(
            period_id=assigned_period.id,
            course_code="TGA101",
            course_name="Gestion administrativa",
            group_name="A",
            status="completed",
        )
        pending_module = Module(
            period_id=assigned_period.id,
            course_code="TGA102",
            course_name="Procesos administrativos",
            group_name="B",
            status="pending",
        )
        db.add_all([assigned_module, pending_module])
        await db.flush()
        db.add(ModuleAssignment(module_id=assigned_module.id, user_id=teacher.id))
        await db.commit()

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
        yield client, student_outcome.id

    app.dependency_overrides.clear()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


async def login(client: AsyncClient, email: str, password: str) -> None:
    response = await client.post(LOGIN_URL, json={"email": email, "password": password})
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_admin_lists_all_periods_with_module_counts(periods_client):
    client, _student_outcome_id = periods_client
    await login(client, "admin.periods@iub.edu.co", "Admin1234!")

    response = await client.get(PERIODS_URL)

    assert response.status_code == 200
    data = response.json()
    assert [period["name"] for period in data] == ["TGA RA1 2026-1", "TGA RA1 2026-2"]
    assert data[0]["student_outcome_code"] == "RA1"
    assert data[0]["modules_total"] == 2
    assert data[0]["modules_completed"] == 1
    assert data[1]["modules_total"] == 0


@pytest.mark.asyncio
async def test_teacher_lists_only_periods_with_assigned_modules(periods_client):
    client, _student_outcome_id = periods_client
    await login(client, "teacher.periods@iub.edu.co", "Teacher1234!")

    response = await client.get(PERIODS_URL)

    assert response.status_code == 200
    data = response.json()
    assert [period["name"] for period in data] == ["TGA RA1 2026-1"]


@pytest.mark.asyncio
async def test_leader_creates_period(periods_client):
    client, student_outcome_id = periods_client
    await login(client, "leader.periods@iub.edu.co", "Leader1234!")

    response = await client.post(
        PERIODS_URL,
        json={
            "name": "TGA RA1 2027-1",
            "student_outcome_id": student_outcome_id,
            "start_date": "2027-01-15",
            "end_date": "2027-05-30",
        },
    )

    assert response.status_code == 201
    assert response.json() == {
        "id": 3,
        "name": "TGA RA1 2027-1",
        "status": "draft",
    }


@pytest.mark.asyncio
async def test_leader_creates_period_by_cloning_modules_and_assignments(periods_client):
    client, student_outcome_id = periods_client
    await login(client, "leader.periods@iub.edu.co", "Leader1234!")

    response = await client.post(
        PERIODS_URL,
        json={
            "name": "TGA RA1 2027-2",
            "student_outcome_id": student_outcome_id,
            "start_date": "2027-08-01",
            "end_date": "2027-12-15",
            "clone_from_period_id": 1,
        },
    )

    assert response.status_code == 201

    list_response = await client.get(PERIODS_URL)
    cloned = next(
        period
        for period in list_response.json()
        if period["name"] == "TGA RA1 2027-2"
    )
    assert cloned["modules_total"] == 2
    assert cloned["modules_completed"] == 0

    await login(client, "teacher.periods@iub.edu.co", "Teacher1234!")
    teacher_response = await client.get(PERIODS_URL)
    assert [period["name"] for period in teacher_response.json()] == [
        "TGA RA1 2026-1",
        "TGA RA1 2027-2",
    ]


@pytest.mark.asyncio
async def test_teacher_cannot_create_period(periods_client):
    client, student_outcome_id = periods_client
    await login(client, "teacher.periods@iub.edu.co", "Teacher1234!")

    response = await client.post(
        PERIODS_URL,
        json={
            "name": "TGA RA1 2027-2",
            "student_outcome_id": student_outcome_id,
            "start_date": "2027-08-01",
            "end_date": "2027-12-15",
        },
    )

    assert response.status_code == 403
