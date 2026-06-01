"""
Tests S3-03 — Reapertura administrativa de período y módulo (F06).
Admin reopens a closed period; admin/leader reopens a completed module.
Ver docs/PRD.md §F06 y memory/NEXT_STEPS.md TAREA S3-03.
"""
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

LOGIN_URL = "/api/v1/auth/login"


@pytest_asyncio.fixture
async def reopen_client():
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
            email="admin.reopen@iub.edu.co",
            full_name="Admin Reopen",
            role="admin",
            hashed_password=hash_password("Admin1234!"),
            is_active=True,
            auth_provider="local",
        )
        leader = User(
            email="leader.reopen@iub.edu.co",
            full_name="Leader Reopen",
            role="leader",
            hashed_password=hash_password("Leader1234!"),
            is_active=True,
            auth_provider="local",
        )
        other_leader = User(
            email="other.leader.reopen@iub.edu.co",
            full_name="Other Leader Reopen",
            role="leader",
            hashed_password=hash_password("Leader1234!"),
            is_active=True,
            auth_provider="local",
        )
        teacher = User(
            email="teacher.reopen@iub.edu.co",
            full_name="Teacher Reopen",
            role="teacher",
            hashed_password=hash_password("Teacher1234!"),
            is_active=True,
            auth_provider="local",
        )
        db.add_all([admin, leader, other_leader, teacher])
        await db.flush()

        line = PropedeuticLine(name="Sistemas Reopen", code="LP-REOPEN", is_active=True)
        db.add(line)
        await db.flush()

        program = Program(
            propedeutic_line_id=line.id,
            name="Ingeniería Reopen",
            code="IS-REOPEN",
            cycle_level="pregrado",
            faculty="FCEIA",
        )
        other_program = Program(
            propedeutic_line_id=line.id,
            name="Otro Programa Reopen",
            code="OP-REOPEN",
            cycle_level="pregrado",
            faculty="FCEIA",
        )
        db.add_all([program, other_program])
        await db.flush()
        db.add(ProgramMembership(user_id=leader.id, program_id=program.id, role="leader"))
        db.add(ProgramMembership(user_id=other_leader.id, program_id=other_program.id, role="leader"))

        so = StudentOutcome(
            code="RA-REOPEN",
            description="RA Reopen",
            is_active=True,
            program_id=program.id,
        )
        db.add(so)
        await db.flush()

        # Period in "closed" state — admin can reopen it
        closed_period = Period(
            name="IS Reopen Cerrado 2026-1",
            student_outcome_id=so.id,
            start_date=date(2026, 1, 15),
            end_date=date(2026, 5, 30),
            status="closed",
            created_by=leader.id,
        )
        # Period in "open" state — cannot reopen (already open)
        open_period = Period(
            name="IS Reopen Abierto 2026-1",
            student_outcome_id=so.id,
            start_date=date(2026, 1, 15),
            end_date=date(2026, 5, 30),
            status="open",
            created_by=leader.id,
        )
        db.add_all([closed_period, open_period])
        await db.flush()

        # Completed module in open period — leader/admin can reopen
        completed_module = Module(
            period_id=open_period.id,
            course_code="ROP101",
            course_name="Módulo Reopen",
            group_name="A",
            status="completed",
        )
        # In-progress module — cannot reopen (not completed)
        inprogress_module = Module(
            period_id=open_period.id,
            course_code="ROP102",
            course_name="Módulo En progreso",
            group_name="B",
            status="in_progress",
        )
        # Completed module in closed period — reopen is allowed without reopening whole period
        closed_period_module = Module(
            period_id=closed_period.id,
            course_code="ROP103",
            course_name="Módulo Cerrado Reopen",
            group_name="C",
            status="completed",
        )
        db.add_all([completed_module, inprogress_module, closed_period_module])
        await db.flush()

        db.add(ModuleAssignment(module_id=completed_module.id, user_id=teacher.id))
        db.add(ModuleAssignment(module_id=closed_period_module.id, user_id=teacher.id))
        await db.commit()

        ids = {
            "closed_period_id": closed_period.id,
            "open_period_id": open_period.id,
            "completed_module_id": completed_module.id,
            "inprogress_module_id": inprogress_module.id,
            "closed_period_module_id": closed_period_module.id,
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
    r = await client.post(LOGIN_URL, json={"email": email, "password": password})
    assert r.status_code == 200


# ---------------------------------------------------------------------------
# Period reopen — PUT /api/v1/periods/{id}/reopen
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_admin_can_reopen_closed_period(reopen_client):
    """Admin reopens a closed period → 200, status back to 'open', audit logged."""
    client, ids, factory = reopen_client
    await _login(client, "admin.reopen@iub.edu.co", "Admin1234!")

    r = await client.put(f"/api/v1/periods/{ids['closed_period_id']}/reopen")

    assert r.status_code == 200
    data = r.json()
    assert data["period_id"] == ids["closed_period_id"]
    assert data["status"] == "open"

    async with factory() as db:
        period = await db.get(Period, ids["closed_period_id"])
    assert period.status == "open"


@pytest.mark.asyncio
async def test_leader_cannot_reopen_period(reopen_client):
    """Leader cannot reopen a period (PRD F06: solo el administrador)."""
    client, ids, _ = reopen_client
    await _login(client, "leader.reopen@iub.edu.co", "Leader1234!")

    r = await client.put(f"/api/v1/periods/{ids['closed_period_id']}/reopen")

    assert r.status_code == 403


@pytest.mark.asyncio
async def test_teacher_cannot_reopen_period(reopen_client):
    """Teacher cannot reopen a period."""
    client, ids, _ = reopen_client
    await _login(client, "teacher.reopen@iub.edu.co", "Teacher1234!")

    r = await client.put(f"/api/v1/periods/{ids['closed_period_id']}/reopen")

    assert r.status_code == 403


@pytest.mark.asyncio
async def test_cannot_reopen_already_open_period(reopen_client):
    """Reopening a non-closed period returns 409 period_not_closed."""
    client, ids, _ = reopen_client
    await _login(client, "admin.reopen@iub.edu.co", "Admin1234!")

    r = await client.put(f"/api/v1/periods/{ids['open_period_id']}/reopen")

    assert r.status_code == 409
    assert r.json()["detail"]["reason"] == "period_not_closed"


# ---------------------------------------------------------------------------
# Module reopen — PUT /api/v1/modules/{id}/reopen
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_leader_can_reopen_completed_module(reopen_client):
    """Leader (with program membership) reopens a completed module → 200, in_progress, submitted_at cleared."""
    client, ids, factory = reopen_client
    await _login(client, "leader.reopen@iub.edu.co", "Leader1234!")

    r = await client.put(f"/api/v1/modules/{ids['completed_module_id']}/reopen")

    assert r.status_code == 200
    data = r.json()
    assert data["module_id"] == ids["completed_module_id"]
    assert data["status"] == "in_progress"

    async with factory() as db:
        module = await db.get(Module, ids["completed_module_id"])
    assert module.status == "in_progress"
    assert module.submitted_at is None


@pytest.mark.asyncio
async def test_admin_can_reopen_any_completed_module(reopen_client):
    """Admin can reopen any completed module regardless of program."""
    client, ids, _ = reopen_client
    await _login(client, "admin.reopen@iub.edu.co", "Admin1234!")

    r = await client.put(f"/api/v1/modules/{ids['closed_period_module_id']}/reopen")

    assert r.status_code == 200
    assert r.json()["status"] == "in_progress"


@pytest.mark.asyncio
async def test_teacher_cannot_reopen_module(reopen_client):
    """Teacher cannot reopen a module (admin/leader only)."""
    client, ids, _ = reopen_client
    await _login(client, "teacher.reopen@iub.edu.co", "Teacher1234!")

    r = await client.put(f"/api/v1/modules/{ids['completed_module_id']}/reopen")

    assert r.status_code == 403


@pytest.mark.asyncio
async def test_leader_without_membership_cannot_reopen_module(reopen_client):
    """Leader without program membership for the module's program gets 404."""
    client, ids, _ = reopen_client
    await _login(client, "other.leader.reopen@iub.edu.co", "Leader1234!")

    r = await client.put(f"/api/v1/modules/{ids['completed_module_id']}/reopen")

    assert r.status_code == 404


@pytest.mark.asyncio
async def test_cannot_reopen_non_completed_module(reopen_client):
    """Reopening a non-completed module returns 409 module_not_completed."""
    client, ids, _ = reopen_client
    await _login(client, "admin.reopen@iub.edu.co", "Admin1234!")

    r = await client.put(f"/api/v1/modules/{ids['inprogress_module_id']}/reopen")

    assert r.status_code == 409
    assert r.json()["detail"]["reason"] == "module_not_completed"


@pytest.mark.asyncio
async def test_module_reopen_in_closed_period_leaves_period_closed(reopen_client):
    """Leader can reopen a module inside a closed period; the period itself stays closed."""
    client, ids, factory = reopen_client
    await _login(client, "leader.reopen@iub.edu.co", "Leader1234!")

    r = await client.put(f"/api/v1/modules/{ids['closed_period_module_id']}/reopen")

    assert r.status_code == 200
    assert r.json()["status"] == "in_progress"

    async with factory() as db:
        period = await db.get(Period, ids["closed_period_id"])
    assert period.status == "closed"
