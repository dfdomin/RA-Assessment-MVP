"""
Tests S2-03 — Student import (POST /modules/{id}/students/import).
Covers: CSV/XLSX parsing, consent gate, file size limit, formula injection,
student count limit, ownership control, upsert (update + already_enrolled).
"""
import csv
import io
from datetime import date

import openpyxl
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
from src.models.rubric import Rubric
from src.models.student_outcome import StudentOutcome
from src.models.user import User

LOGIN_URL = "/api/v1/auth/login"
XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _make_csv(rows: list[dict]) -> bytes:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=["internal_id", "document_number", "full_name"])
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue().encode("utf-8")


def _make_xlsx(rows: list[dict]) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["internal_id", "document_number", "full_name"])
    for row in rows:
        ws.append([row["internal_id"], row["document_number"], row["full_name"]])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


@pytest_asyncio.fixture
async def import_client():
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
            email="teacher.si@iub.edu.co",
            full_name="Teacher SI",
            role="teacher",
            hashed_password=hash_password("Teacher1234!"),
            is_active=True,
            auth_provider="local",
        )
        other_teacher = User(
            email="other.si@iub.edu.co",
            full_name="Other SI",
            role="teacher",
            hashed_password=hash_password("Teacher1234!"),
            is_active=True,
            auth_provider="local",
        )
        leader = User(
            email="leader.si@iub.edu.co",
            full_name="Leader SI",
            role="leader",
            hashed_password=hash_password("Leader1234!"),
            is_active=True,
            auth_provider="local",
        )
        db.add_all([teacher, other_teacher, leader])
        await db.flush()

        line = PropedeuticLine(name="Gestión Administrativa", code="LP-GESTION-SI", is_active=True)
        db.add(line)
        await db.flush()
        program = Program(
            propedeutic_line_id=line.id,
            name="Tecnología en Gestión Administrativa",
            code="TGA-SI",
            cycle_level="tecnología",
            faculty="FCCEA",
        )
        db.add(program)
        await db.flush()
        db.add(ProgramMembership(user_id=leader.id, program_id=program.id, role="leader"))
        so = StudentOutcome(
            code="RA1-SI",
            description="RA 1 SI",
            is_active=True,
            program_id=program.id,
        )
        db.add(so)
        await db.flush()

        period = Period(
            name="TGA SI RA1 2026-1",
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
        await db.flush()

        module = Module(
            period_id=period.id,
            course_code="TGA301-SI",
            course_name="Módulo SI",
            group_name="A",
            status="in_progress",
        )
        db.add(module)
        await db.flush()
        db.add(ModuleAssignment(module_id=module.id, user_id=teacher.id))
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


# ---------------------------------------------------------------------------
# POST /modules/{id}/students/import
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_csv_import_creates_students(import_client):
    client, ids = import_client
    await _login(client, "teacher.si@iub.edu.co", "Teacher1234!")

    csv_bytes = _make_csv([
        {"internal_id": "S001-SI", "document_number": "11111111", "full_name": "García, María"},
        {"internal_id": "S002-SI", "document_number": "22222222", "full_name": "López, Juan"},
    ])

    r = await client.post(
        f"/api/v1/modules/{ids['module_id']}/students/import",
        data={"consent_acknowledged": "true"},
        files={"file": ("students.csv", csv_bytes, "text/csv")},
    )

    assert r.status_code == 200
    data = r.json()
    assert data["imported"] == 2
    assert data["updated"] == 0
    assert data["skipped"] == 0
    assert data["errors"] == []
    assert len(data["students"]) == 2
    assert all(s["action"] == "created" for s in data["students"])


@pytest.mark.asyncio
async def test_xlsx_import_creates_students(import_client):
    client, ids = import_client
    await _login(client, "teacher.si@iub.edu.co", "Teacher1234!")

    xlsx_bytes = _make_xlsx([
        {"internal_id": "S003-SI", "document_number": "33333333", "full_name": "Martínez, Ana"},
    ])

    r = await client.post(
        f"/api/v1/modules/{ids['module_id']}/students/import",
        data={"consent_acknowledged": "true"},
        files={"file": ("students.xlsx", xlsx_bytes, XLSX_MIME)},
    )

    assert r.status_code == 200
    data = r.json()
    assert data["imported"] == 1
    assert data["students"][0]["action"] == "created"


@pytest.mark.asyncio
async def test_consent_not_acknowledged_returns_422(import_client):
    client, ids = import_client
    await _login(client, "teacher.si@iub.edu.co", "Teacher1234!")

    csv_bytes = _make_csv([
        {"internal_id": "S004-SI", "document_number": "44444444", "full_name": "Rodríguez, Carlos"},
    ])

    r = await client.post(
        f"/api/v1/modules/{ids['module_id']}/students/import",
        data={"consent_acknowledged": "false"},
        files={"file": ("students.csv", csv_bytes, "text/csv")},
    )

    assert r.status_code == 422


@pytest.mark.asyncio
async def test_invalid_mime_type_returns_422(import_client):
    client, ids = import_client
    await _login(client, "teacher.si@iub.edu.co", "Teacher1234!")

    r = await client.post(
        f"/api/v1/modules/{ids['module_id']}/students/import",
        data={"consent_acknowledged": "true"},
        files={"file": ("students.txt", b"data", "text/plain")},
    )

    assert r.status_code == 422


@pytest.mark.asyncio
async def test_file_too_large_returns_413(import_client):
    client, ids = import_client
    await _login(client, "teacher.si@iub.edu.co", "Teacher1234!")

    large_content = b"a" * (2 * 1024 * 1024 + 1)

    r = await client.post(
        f"/api/v1/modules/{ids['module_id']}/students/import",
        data={"consent_acknowledged": "true"},
        files={"file": ("big.csv", large_content, "text/csv")},
    )

    assert r.status_code == 413


@pytest.mark.asyncio
async def test_formula_injection_blocked(import_client):
    """Row with a formula injection character is skipped; clean rows are imported."""
    client, ids = import_client
    await _login(client, "teacher.si@iub.edu.co", "Teacher1234!")

    csv_bytes = _make_csv([
        {"internal_id": "=SUM(A1)", "document_number": "55555555", "full_name": "Hacker"},
        {"internal_id": "S005-SI", "document_number": "55555556", "full_name": "Safe Student"},
    ])

    r = await client.post(
        f"/api/v1/modules/{ids['module_id']}/students/import",
        data={"consent_acknowledged": "true"},
        files={"file": ("students.csv", csv_bytes, "text/csv")},
    )

    assert r.status_code == 200
    data = r.json()
    assert data["imported"] == 1
    assert len(data["errors"]) == 1
    assert "Formula injection" in data["errors"][0]["error"]


@pytest.mark.asyncio
async def test_max_students_limit_enforced(import_client):
    client, ids = import_client
    await _login(client, "teacher.si@iub.edu.co", "Teacher1234!")

    rows = [
        {
            "internal_id": f"SLIM{i:04d}",
            "document_number": str(10000000 + i),
            "full_name": f"Student {i}",
        }
        for i in range(101)
    ]
    csv_bytes = _make_csv(rows)

    r = await client.post(
        f"/api/v1/modules/{ids['module_id']}/students/import",
        data={"consent_acknowledged": "true"},
        files={"file": ("students.csv", csv_bytes, "text/csv")},
    )

    assert r.status_code == 422


@pytest.mark.asyncio
async def test_unassigned_teacher_cannot_import(import_client):
    client, ids = import_client
    await _login(client, "other.si@iub.edu.co", "Teacher1234!")

    csv_bytes = _make_csv([
        {"internal_id": "S006-SI", "document_number": "66666666", "full_name": "Unauthorized"},
    ])

    r = await client.post(
        f"/api/v1/modules/{ids['module_id']}/students/import",
        data={"consent_acknowledged": "true"},
        files={"file": ("students.csv", csv_bytes, "text/csv")},
    )

    assert r.status_code == 404


@pytest.mark.asyncio
async def test_upsert_updates_student_data(import_client):
    """Importing the same internal_id with a new name updates the student record."""
    client, ids = import_client
    await _login(client, "teacher.si@iub.edu.co", "Teacher1234!")

    first = _make_csv([
        {"internal_id": "S007-SI", "document_number": "77777777", "full_name": "Nombre Original"},
    ])
    await client.post(
        f"/api/v1/modules/{ids['module_id']}/students/import",
        data={"consent_acknowledged": "true"},
        files={"file": ("s.csv", first, "text/csv")},
    )

    second = _make_csv([
        {"internal_id": "S007-SI", "document_number": "77777777", "full_name": "Nombre Actualizado"},
    ])
    r = await client.post(
        f"/api/v1/modules/{ids['module_id']}/students/import",
        data={"consent_acknowledged": "true"},
        files={"file": ("s.csv", second, "text/csv")},
    )

    assert r.status_code == 200
    data = r.json()
    assert data["updated"] == 1
    assert data["students"][0]["full_name"] == "Nombre Actualizado"
    assert data["students"][0]["action"] == "updated"


@pytest.mark.asyncio
async def test_already_enrolled_counted_as_skipped(import_client):
    """Importing identical data twice counts the second import as skipped."""
    client, ids = import_client
    await _login(client, "teacher.si@iub.edu.co", "Teacher1234!")

    csv_bytes = _make_csv([
        {"internal_id": "S008-SI", "document_number": "88888888", "full_name": "Already Enrolled"},
    ])

    await client.post(
        f"/api/v1/modules/{ids['module_id']}/students/import",
        data={"consent_acknowledged": "true"},
        files={"file": ("s.csv", csv_bytes, "text/csv")},
    )
    r = await client.post(
        f"/api/v1/modules/{ids['module_id']}/students/import",
        data={"consent_acknowledged": "true"},
        files={"file": ("s.csv", csv_bytes, "text/csv")},
    )

    assert r.status_code == 200
    data = r.json()
    assert data["skipped"] == 1
    assert data["imported"] == 0
    assert data["students"][0]["action"] == "already_enrolled"
