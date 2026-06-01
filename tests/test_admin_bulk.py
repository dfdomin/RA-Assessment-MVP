"""
Tests S5-02 — Admin bulk import endpoints (F15).

Covers defensive parsing, Admin-only access, 207 Multi-Status responses,
partial processing, consent gate, and SecurityEvent auditing.
"""
from datetime import date

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
async def bulk_client():
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
            email="admin.bulk@iub.edu.co",
            full_name="Admin Bulk",
            role="admin",
            hashed_password=hash_password("Admin1234!"),
            is_active=True,
            auth_provider="local",
        )
        leader = User(
            email="leader.bulk@iub.edu.co",
            full_name="Leader Bulk",
            role="leader",
            hashed_password=hash_password("Leader1234!"),
            is_active=True,
            auth_provider="local",
        )
        teacher = User(
            email="teacher.bulk@iub.edu.co",
            full_name="Teacher Bulk",
            role="teacher",
            hashed_password=hash_password("Teacher1234!"),
            is_active=True,
            auth_provider="local",
        )
        db.add_all([admin, leader, teacher])
        await db.flush()

        line = PropedeuticLine(
            name="Gestión Administrativa",
            code="LP-BULK",
            is_active=True,
        )
        db.add(line)
        await db.flush()
        program = Program(
            propedeutic_line_id=line.id,
            name="Tecnología en Gestión Administrativa",
            code="TGA-BULK",
            cycle_level="tecnología",
            faculty="FCCEA",
        )
        db.add(program)
        await db.flush()

        so = StudentOutcome(
            code="RA1",
            description="Resultado de aprendizaje 1",
            is_active=True,
            program_id=program.id,
        )
        db.add(so)
        await db.flush()

        period = Period(
            name="TGA BULK 2026-1",
            student_outcome_id=so.id,
            start_date=date(2026, 1, 15),
            end_date=date(2026, 5, 30),
            status="open",
            created_by=admin.id,
        )
        db.add(period)
        await db.flush()

        module = Module(
            period_id=period.id,
            course_code="TGA101",
            course_name="Gestión administrativa",
            group_name="A",
            status="pending",
        )
        db.add(module)
        await db.flush()
        db.add(ModuleAssignment(module_id=module.id, user_id=teacher.id))
        await db.commit()

        ids = {
            "program_id": program.id,
            "period_id": period.id,
            "module_id": module.id,
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
    response = await client.post(LOGIN_URL, json={"email": email, "password": password})
    assert response.status_code == 200


def _csv_file(content: str) -> dict[str, tuple[str, bytes, str]]:
    return {"file": ("bulk.csv", content.encode("utf-8"), "text/csv")}


@pytest.mark.asyncio
async def test_teacher_cannot_use_bulk_endpoints(bulk_client):
    client, _, _ = bulk_client
    await _login(client, "teacher.bulk@iub.edu.co", "Teacher1234!")

    response = await client.post(
        "/api/v1/admin/bulk/users",
        files=_csv_file("nombre_completo,email_institucional,rol,programa\n"),
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_bulk_students_requires_consent(bulk_client):
    client, _, ids = bulk_client
    await _login(client, "admin.bulk@iub.edu.co", "Admin1234!")

    response = await client.post(
        "/api/v1/admin/bulk/students",
        files=_csv_file(
            "ID_interno,numero_documento,nombre_completo,modulo_id\n"
            f"EST001,1234567890,Ana Rodríguez,{ids['module_id']}\n"
        ),
    )

    assert response.status_code == 400
    assert "consentimiento informado" in response.json()["detail"]


@pytest.mark.asyncio
async def test_bulk_students_imports_valid_rows_and_reports_formula_errors(bulk_client):
    client, session_factory, ids = bulk_client
    await _login(client, "admin.bulk@iub.edu.co", "Admin1234!")

    response = await client.post(
        "/api/v1/admin/bulk/students",
        data={"consent_acknowledged": "true"},
        files=_csv_file(
            "ID_interno,numero_documento,nombre_completo,modulo_id\n"
            f"EST001,1234567890,Ana Rodríguez,{ids['module_id']}\n"
            f"EST002,2222222222,=cmd,{ids['module_id']}\n"
        ),
    )

    assert response.status_code == 207
    data = response.json()
    assert data["imported"] == 1
    assert data["failed"] == 1
    assert data["errors"][0]["row"] == 3
    assert "Formula injection" in data["errors"][0]["reason"]

    async with session_factory() as db:
        student = (
            await db.execute(select(Student).where(Student.internal_id == "EST001"))
        ).scalar_one()
        enrollment = (
            await db.execute(
                select(ModuleStudent).where(
                    ModuleStudent.module_id == ids["module_id"],
                    ModuleStudent.student_id == student.id,
                )
            )
        ).scalar_one()
        event = (
            await db.execute(
                select(SecurityEvent).where(SecurityEvent.event == "bulk_import_students")
            )
        ).scalar_one()

    assert enrollment.status == "active"
    assert event.detail["imported"] == 1
    assert event.detail["consent_acknowledged"] is True


@pytest.mark.asyncio
async def test_bulk_users_creates_user_and_program_membership(bulk_client):
    client, session_factory, _ = bulk_client
    await _login(client, "admin.bulk@iub.edu.co", "Admin1234!")

    response = await client.post(
        "/api/v1/admin/bulk/users",
        files=_csv_file(
            "nombre_completo,email_institucional,rol,programa\n"
            "María García,mgarcia.bulk@iub.edu.co,docente,Tecnología en Gestión Administrativa\n"
            "Inválido,not-an-email,docente,Tecnología en Gestión Administrativa\n"
        ),
    )

    assert response.status_code == 207
    data = response.json()
    assert data["imported"] == 1
    assert data["failed"] == 1
    assert data["errors"][0]["field"] == "email_institucional"

    async with session_factory() as db:
        user = (
            await db.execute(select(User).where(User.email == "mgarcia.bulk@iub.edu.co"))
        ).scalar_one()
        membership = (
            await db.execute(
                select(ProgramMembership).where(ProgramMembership.user_id == user.id)
            )
        ).scalar_one()

    assert user.role == "teacher"
    assert user.hashed_password
    assert membership.role == "teacher"


@pytest.mark.asyncio
async def test_bulk_modules_creates_module_assignment_and_reports_missing_teacher(bulk_client):
    client, session_factory, ids = bulk_client
    await _login(client, "admin.bulk@iub.edu.co", "Admin1234!")

    response = await client.post(
        "/api/v1/admin/bulk/modules",
        files=_csv_file(
            "period_id,curso_codigo,curso_nombre,grupo,docente_email\n"
            f"{ids['period_id']},TGA202,Costos,B,teacher.bulk@iub.edu.co\n"
            f"{ids['period_id']},TGA203,Auditoría,C,missing@iub.edu.co\n"
        ),
    )

    assert response.status_code == 207
    data = response.json()
    assert data["imported"] == 1
    assert data["failed"] == 1
    assert "Docente no registrado" in data["errors"][0]["reason"]

    async with session_factory() as db:
        module = (
            await db.execute(
                select(Module).where(
                    Module.period_id == ids["period_id"],
                    Module.course_code == "TGA202",
                    Module.group_name == "B",
                )
            )
        ).scalar_one()
        assignment = (
            await db.execute(
                select(ModuleAssignment).where(ModuleAssignment.module_id == module.id)
            )
        ).scalar_one()

    assert assignment.user_id > 0


@pytest.mark.asyncio
async def test_bulk_rubrics_rejects_so_group_when_weights_do_not_sum_100(bulk_client):
    client, session_factory, _ = bulk_client
    await _login(client, "admin.bulk@iub.edu.co", "Admin1234!")

    response = await client.post(
        "/api/v1/admin/bulk/rubrics",
        files=_csv_file(
            "SO_codigo,SO_descripcion,PI_codigo,PI_descripcion,"
            "Poor_descriptor,Inadequate_descriptor,Adequate_descriptor,Exemplary_descriptor,peso_pct\n"
            "RA1,Resultado,PI1,Indicador 1,Poor,Inadequate,Adequate,Exemplary,50\n"
            "RA1,Resultado,PI2,Indicador 2,Poor,Inadequate,Adequate,Exemplary,45\n"
        ),
    )

    assert response.status_code == 207
    data = response.json()
    assert data["imported"] == 0
    assert data["failed"] == 2
    assert "suman 95.00%" in data["errors"][0]["reason"]

    async with session_factory() as db:
        count = len((await db.execute(select(Rubric))).scalars().all())
    assert count == 0


@pytest.mark.asyncio
async def test_bulk_rubrics_creates_active_rubric_for_open_period(bulk_client):
    client, session_factory, ids = bulk_client
    await _login(client, "admin.bulk@iub.edu.co", "Admin1234!")

    response = await client.post(
        "/api/v1/admin/bulk/rubrics",
        files=_csv_file(
            "SO_codigo,SO_descripcion,PI_codigo,PI_descripcion,"
            "Poor_descriptor,Inadequate_descriptor,Adequate_descriptor,Exemplary_descriptor,peso_pct\n"
            "RA1,Resultado,PI1,Indicador 1,Poor,Inadequate,Adequate,Exemplary,60\n"
            "RA1,Resultado,PI2,Indicador 2,Poor,Inadequate,Adequate,Exemplary,40\n"
        ),
    )

    assert response.status_code == 207
    data = response.json()
    assert data["imported"] == 2
    assert data["failed"] == 0

    async with session_factory() as db:
        period = await db.get(Period, ids["period_id"])
        rubric = await db.get(Rubric, period.rubric_id)
        pis = (
            await db.execute(
                select(PerfIndicator)
                .where(PerfIndicator.rubric_id == rubric.id)
                .order_by(PerfIndicator.position)
            )
        ).scalars().all()
        event = (
            await db.execute(
                select(SecurityEvent).where(SecurityEvent.event == "bulk_import_rubrics")
            )
        ).scalar_one()

    assert [pi.code for pi in pis] == ["PI1", "PI2"]
    assert str(pis[0].pi_weight) == "60.00"
    assert event.detail["imported"] == 2
