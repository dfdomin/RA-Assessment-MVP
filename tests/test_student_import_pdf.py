"""API tests for Academusoft PDF student import (ADR-0002)."""

from datetime import date
from pathlib import Path

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
from src.models.rubric import Rubric
from src.models.student import ModuleStudent, Student
from src.models.student_outcome import StudentOutcome
from src.models.user import User

ROOT = Path(__file__).resolve().parents[1]
PDF_17 = ROOT / "Reporte_Estudiantes-17.pdf"
PDF_MIME = "application/pdf"
LOGIN_URL = "/api/v1/auth/login"


@pytest_asyncio.fixture
async def pdf_import_client():
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
            email="teacher.pdf@iub.edu.co",
            full_name="Teacher PDF",
            role="teacher",
            hashed_password=hash_password("Teacher1234!"),
            is_active=True,
            auth_provider="local",
        )
        leader = User(
            email="leader.pdf@iub.edu.co",
            full_name="Leader PDF",
            role="leader",
            hashed_password=hash_password("Leader1234!"),
            is_active=True,
            auth_provider="local",
        )
        db.add_all([teacher, leader])
        await db.flush()

        line = PropedeuticLine(name="Gestión PDF", code="LP-PDF", is_active=True)
        db.add(line)
        await db.flush()
        program = Program(
            propedeutic_line_id=line.id,
            name="Programa PDF",
            code="PDF-PROG",
            cycle_level="tecnología",
            faculty="FCCEA",
        )
        db.add(program)
        await db.flush()
        db.add(ProgramMembership(user_id=leader.id, program_id=program.id, role="leader"))
        so = StudentOutcome(
            code="RA-PDF",
            description="RA PDF",
            is_active=True,
            program_id=program.id,
        )
        db.add(so)
        await db.flush()

        period = Period(
            name="PDF 2026-1",
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
            course_code="ADM18",
            course_name="Procesamiento de la Información",
            group_name="1_CE_G2",
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
        yield client, ids, factory

    app.dependency_overrides.clear()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


async def _login(client: AsyncClient) -> None:
    response = await client.post(
        LOGIN_URL,
        json={"email": "teacher.pdf@iub.edu.co", "password": "Teacher1234!"},
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_pdf_preview_returns_38_students(pdf_import_client):
    client, ids, _factory = pdf_import_client
    await _login(client)

    response = await client.post(
        f"/api/v1/modules/{ids['module_id']}/students/import/preview",
        files={"file": ("Reporte_Estudiantes-17.pdf", PDF_17.read_bytes(), PDF_MIME)},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["pdf_course_code"] == "ADM18"
    assert data["pdf_group"] == "1_CE_G2"
    assert len(data["students"]) == 38
    assert data["students"][0]["roster_position"] == 1


@pytest.mark.asyncio
async def test_pdf_preview_rejects_wrong_module(pdf_import_client):
    client, ids, factory = pdf_import_client
    await _login(client)

    async with factory() as db:
        module = await db.get(Module, ids["module_id"])
        module.group_name = "GRUPO_INCORRECTO"
        await db.commit()

    response = await client.post(
        f"/api/v1/modules/{ids['module_id']}/students/import/preview",
        files={"file": ("Reporte_Estudiantes-17.pdf", PDF_17.read_bytes(), PDF_MIME)},
    )

    assert response.status_code == 422
    assert "GRUPO_INCORRECTO" in response.json()["detail"]


@pytest.mark.asyncio
async def test_pdf_import_creates_students_with_roster_positions(pdf_import_client):
    client, ids, factory = pdf_import_client
    await _login(client)

    response = await client.post(
        f"/api/v1/modules/{ids['module_id']}/students/import",
        data={"consent_acknowledged": "true"},
        files={"file": ("Reporte_Estudiantes-17.pdf", PDF_17.read_bytes(), PDF_MIME)},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["imported"] == 38
    assert data["errors"] == []

    async with factory() as db:
        rows = (
            await db.execute(
                select(ModuleStudent)
                .where(ModuleStudent.module_id == ids["module_id"])
                .order_by(ModuleStudent.roster_position)
            )
        ).scalars().all()
        assert len(rows) == 38
        assert rows[0].roster_position == 1
        assert rows[-1].roster_position == 38

        student = (
            await db.execute(select(Student).where(Student.document_number == "1042856266"))
        ).scalar_one()
        assert student.internal_id == "1042856266"
        assert student.full_name == "AFANADOR VIDES SHARIT"


@pytest.mark.asyncio
async def test_pdf_import_warns_when_active_student_missing_from_pdf(pdf_import_client):
    client, ids, factory = pdf_import_client
    await _login(client)

    async with factory() as db:
        orphan = Student(
            internal_id="9999999999",
            document_number="9999999999",
            full_name="Estudiante Huérfano",
        )
        db.add(orphan)
        await db.flush()
        db.add(
            ModuleStudent(
                module_id=ids["module_id"],
                student_id=orphan.id,
                roster_position=99,
                status="active",
            )
        )
        await db.commit()

    preview = await client.post(
        f"/api/v1/modules/{ids['module_id']}/students/import/preview",
        files={"file": ("Reporte_Estudiantes-17.pdf", PDF_17.read_bytes(), PDF_MIME)},
    )
    assert preview.status_code == 200
    assert "no aparecen en este PDF" in preview.json()["warnings"][0]

    imported = await client.post(
        f"/api/v1/modules/{ids['module_id']}/students/import",
        data={"consent_acknowledged": "true"},
        files={"file": ("Reporte_Estudiantes-17.pdf", PDF_17.read_bytes(), PDF_MIME)},
    )
    assert imported.status_code == 200
    assert imported.json()["warnings"]
