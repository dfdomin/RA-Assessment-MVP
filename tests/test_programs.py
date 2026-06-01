"""
Tests for multi-program architecture: PropedeuticLines, Programs, ProgramMemberships.
Covers admin CRUD and program-scoped access control for leaders and teachers.
"""
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from src.api.deps import get_db
from src.api.main import app
from src.core.security import hash_password
from src.db.base import Base
from src.models.program import Program, ProgramMembership, PropedeuticLine
from src.models.student_outcome import StudentOutcome
from src.models.user import User

LOGIN_URL = "/api/v1/auth/login"
LINES_URL = "/api/v1/propedeutic-lines"
PROGRAMS_URL = "/api/v1/programs"


@pytest_asyncio.fixture
async def programs_client():
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
            email="admin.prog@iub.edu.co",
            full_name="Admin Programs",
            role="admin",
            hashed_password=hash_password("Admin1234!"),
            is_active=True,
            auth_provider="local",
        )
        leader = User(
            email="leader.prog@iub.edu.co",
            full_name="Leader TGA",
            role="leader",
            hashed_password=hash_password("Leader1234!"),
            is_active=True,
            auth_provider="local",
        )
        teacher = User(
            email="teacher.prog@iub.edu.co",
            full_name="Teacher TGA",
            role="teacher",
            hashed_password=hash_password("Teacher1234!"),
            is_active=True,
            auth_provider="local",
        )
        db.add_all([admin, leader, teacher])
        await db.flush()

        line_gestion = PropedeuticLine(name="Gestión Administrativa", code="LP-GESTION-T", is_active=True)
        line_info = PropedeuticLine(name="Informática", code="LP-INFORMATICA-T", is_active=True)
        db.add_all([line_gestion, line_info])
        await db.flush()

        tga = Program(
            propedeutic_line_id=line_gestion.id,
            name="Tecnología en Gestión Administrativa",
            code="TGA-T",
            cycle_level="tecnología",
            faculty="FCCEA",
        )
        teli = Program(
            propedeutic_line_id=line_info.id,
            name="Ingeniería Telemática",
            code="ING-TELI-T",
            cycle_level="profesional",
            faculty="FCIT",
        )
        db.add_all([tga, teli])
        await db.flush()

        # Leader is member of TGA only
        db.add(ProgramMembership(user_id=leader.id, program_id=tga.id, role="leader"))
        await db.commit()

        ids = {
            "line_gestion_id": line_gestion.id,
            "line_info_id": line_info.id,
            "tga_id": tga.id,
            "teli_id": teli.id,
            "leader_id": leader.id,
            "teacher_id": teacher.id,
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
# PropedeuticLines
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_admin_lists_propedeutic_lines(programs_client):
    client, _ = programs_client
    await _login(client, "admin.prog@iub.edu.co", "Admin1234!")

    r = await client.get(LINES_URL)

    assert r.status_code == 200
    codes = [line["code"] for line in r.json()]
    assert "LP-GESTION-T" in codes
    assert "LP-INFORMATICA-T" in codes


@pytest.mark.asyncio
async def test_leader_lists_propedeutic_lines(programs_client):
    client, _ = programs_client
    await _login(client, "leader.prog@iub.edu.co", "Leader1234!")

    r = await client.get(LINES_URL)

    assert r.status_code == 200


@pytest.mark.asyncio
async def test_teacher_cannot_list_propedeutic_lines(programs_client):
    client, _ = programs_client
    await _login(client, "teacher.prog@iub.edu.co", "Teacher1234!")

    r = await client.get(LINES_URL)

    assert r.status_code == 403


@pytest.mark.asyncio
async def test_admin_creates_propedeutic_line(programs_client):
    client, _ = programs_client
    await _login(client, "admin.prog@iub.edu.co", "Admin1234!")

    r = await client.post(LINES_URL, json={"name": "Nueva Línea", "code": "LP-NUEVA"})

    assert r.status_code == 201
    assert r.json()["code"] == "LP-NUEVA"


@pytest.mark.asyncio
async def test_admin_cannot_create_duplicate_line_code(programs_client):
    client, _ = programs_client
    await _login(client, "admin.prog@iub.edu.co", "Admin1234!")

    r = await client.post(LINES_URL, json={"name": "Dup", "code": "LP-GESTION-T"})

    assert r.status_code == 422


@pytest.mark.asyncio
async def test_leader_cannot_create_propedeutic_line(programs_client):
    client, _ = programs_client
    await _login(client, "leader.prog@iub.edu.co", "Leader1234!")

    r = await client.post(LINES_URL, json={"name": "Nueva", "code": "LP-X"})

    assert r.status_code == 403


# ---------------------------------------------------------------------------
# Programs
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_admin_lists_all_programs(programs_client):
    client, ids = programs_client
    await _login(client, "admin.prog@iub.edu.co", "Admin1234!")

    r = await client.get(PROGRAMS_URL)

    assert r.status_code == 200
    codes = [p["code"] for p in r.json()]
    assert "TGA-T" in codes
    assert "ING-TELI-T" in codes


@pytest.mark.asyncio
async def test_leader_lists_only_own_programs(programs_client):
    client, _ = programs_client
    await _login(client, "leader.prog@iub.edu.co", "Leader1234!")

    r = await client.get(PROGRAMS_URL)

    assert r.status_code == 200
    codes = [p["code"] for p in r.json()]
    assert codes == ["TGA-T"]


@pytest.mark.asyncio
async def test_teacher_without_membership_sees_no_programs(programs_client):
    client, _ = programs_client
    await _login(client, "teacher.prog@iub.edu.co", "Teacher1234!")

    r = await client.get(PROGRAMS_URL)

    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.asyncio
async def test_admin_creates_program(programs_client):
    client, ids = programs_client
    await _login(client, "admin.prog@iub.edu.co", "Admin1234!")

    r = await client.post(PROGRAMS_URL, json={
        "propedeutic_line_id": ids["line_gestion_id"],
        "name": "Profesional en Negocios",
        "code": "ING-NEG-T",
        "cycle_level": "profesional",
        "faculty": "FCCEA",
    })

    assert r.status_code == 201
    assert r.json()["code"] == "ING-NEG-T"


@pytest.mark.asyncio
async def test_admin_cannot_create_program_with_invalid_line(programs_client):
    client, _ = programs_client
    await _login(client, "admin.prog@iub.edu.co", "Admin1234!")

    r = await client.post(PROGRAMS_URL, json={
        "propedeutic_line_id": 99999,
        "name": "Fantasma",
        "code": "GHOST",
        "cycle_level": "profesional",
    })

    assert r.status_code == 422


@pytest.mark.asyncio
async def test_leader_cannot_create_program(programs_client):
    client, ids = programs_client
    await _login(client, "leader.prog@iub.edu.co", "Leader1234!")

    r = await client.post(PROGRAMS_URL, json={
        "propedeutic_line_id": ids["line_gestion_id"],
        "name": "Nuevo",
        "code": "NVO",
        "cycle_level": "tecnología",
    })

    assert r.status_code == 403


# ---------------------------------------------------------------------------
# Program Memberships
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_admin_adds_teacher_to_program(programs_client):
    client, ids = programs_client
    await _login(client, "admin.prog@iub.edu.co", "Admin1234!")

    r = await client.post(
        f"/api/v1/programs/{ids['tga_id']}/members",
        json={"user_id": ids["teacher_id"], "role": "teacher"},
    )

    assert r.status_code == 201
    assert r.json()["role"] == "teacher"
    assert r.json()["program_id"] == ids["tga_id"]


@pytest.mark.asyncio
async def test_admin_cannot_add_duplicate_membership(programs_client):
    client, ids = programs_client
    await _login(client, "admin.prog@iub.edu.co", "Admin1234!")

    # leader already has membership in TGA-T
    r = await client.post(
        f"/api/v1/programs/{ids['tga_id']}/members",
        json={"user_id": ids["leader_id"], "role": "leader"},
    )

    assert r.status_code == 422


@pytest.mark.asyncio
async def test_admin_removes_member_from_program(programs_client):
    client, ids = programs_client
    await _login(client, "admin.prog@iub.edu.co", "Admin1234!")

    r = await client.delete(
        f"/api/v1/programs/{ids['tga_id']}/members/{ids['leader_id']}"
    )

    assert r.status_code == 204


@pytest.mark.asyncio
async def test_leader_cannot_manage_memberships(programs_client):
    client, ids = programs_client
    await _login(client, "leader.prog@iub.edu.co", "Leader1234!")

    r = await client.post(
        f"/api/v1/programs/{ids['tga_id']}/members",
        json={"user_id": ids["teacher_id"], "role": "teacher"},
    )

    assert r.status_code == 403
