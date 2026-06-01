"""
Tests S5-03/F16 — SyncPayload, file adapter, and Admin sync endpoints.

Covers the Ports & Adapters entrypoint without requiring Oracle or external
systems: JSON payloads and CSV/XLSX rows must converge into SyncPayload, preview
must be non-mutating, apply must upsert through SyncService, and consent is
enforced at service level for Ley 1581/2012.
"""
from datetime import date
import io

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from starlette.datastructures import UploadFile

from src.api.deps import get_db
from src.api.main import app
from src.core.security import hash_password
from src.db.base import Base
from src.integration.contracts import SyncPayload
from src.integration.adapters.file_adapter import payload_from_uploads
from src.models.integration import OracleSyncLog
from src.models.module import Module, ModuleAssignment
from src.models.period import Period
from src.models.program import Program, PropedeuticLine
from src.models.security import SecurityEvent
from src.models.student import ModuleStudent, Student
from src.models.student_outcome import StudentOutcome
from src.models.user import User

LOGIN_URL = "/api/v1/auth/login"


@pytest_asyncio.fixture
async def sync_client():
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
            email="admin.sync@iub.edu.co",
            full_name="Admin Sync",
            role="admin",
            hashed_password=hash_password("Admin1234!"),
            is_active=True,
            auth_provider="local",
        )
        teacher = User(
            email="teacher.sync@iub.edu.co",
            full_name="Teacher Sync",
            role="teacher",
            hashed_password=hash_password("Teacher1234!"),
            is_active=True,
            auth_provider="local",
        )
        db.add_all([admin, teacher])
        await db.flush()

        line = PropedeuticLine(name="Gestión Administrativa", code="LP-SYNC")
        db.add(line)
        await db.flush()
        program = Program(
            propedeutic_line_id=line.id,
            name="Tecnología en Gestión Administrativa",
            code="TGA-SYNC",
            cycle_level="tecnología",
            faculty="FCCEA",
        )
        db.add(program)
        await db.flush()
        so = StudentOutcome(
            code="RA-SYNC",
            description="Resultado sync",
            program_id=program.id,
        )
        db.add(so)
        await db.flush()
        period = Period(
            name="TGA-RA1-2026-1",
            student_outcome_id=so.id,
            start_date=date(2026, 1, 15),
            end_date=date(2026, 5, 30),
            status="open",
            created_by=admin.id,
        )
        db.add(period)
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
        yield client, session_factory

    app.dependency_overrides.clear()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


async def _login(client: AsyncClient, email: str, password: str) -> None:
    response = await client.post(LOGIN_URL, json={"email": email, "password": password})
    assert response.status_code == 200


def _sync_payload(source: str = "csv", consent: bool = True) -> dict:
    return {
        "periodo_codigo": "TGA-RA1-2026-1",
        "docentes": [
            {
                "email": "mgarcia.sync@iub.edu.co",
                "full_name": "María García",
                "role": "teacher",
                "pege_id": "PEGE-1001",
            }
        ],
        "modulos": [
            {
                "course_code": "ADM101",
                "course_name": "Administración I",
                "group_name": "01",
                "docente_email": "mgarcia.sync@iub.edu.co",
            }
        ],
        "estudiantes": [
            {
                "internal_id": "EST-SYNC-001",
                "document_number": "100200300",
                "full_name": "Ana Rodríguez",
                "modulo_id": "ADM101-01",
            }
        ],
        "source": source,
        "consent_acknowledged": consent,
    }


def test_sync_payload_validates_minimal_contract():
    payload = SyncPayload.model_validate(_sync_payload(source="academusoft"))

    assert payload.source == "academusoft"
    assert payload.docentes[0].email == "mgarcia.sync@iub.edu.co"
    assert payload.modulos[0].docente_email == "mgarcia.sync@iub.edu.co"
    assert payload.estudiantes[0].modulo_id == "ADM101-01"


@pytest.mark.asyncio
async def test_file_adapter_builds_sync_payload_from_csv_uploads():
    teachers = UploadFile(
        filename="docentes.csv",
        file=io.BytesIO(
            b"email,full_name,role,pege_id\nmgarcia.sync@iub.edu.co,Maria Garcia,teacher,PEGE-1001\n"
        ),
        headers={"content-type": "text/csv"},
    )
    modules = UploadFile(
        filename="modulos.csv",
        file=io.BytesIO(
            b"course_code,course_name,group_name,docente_email\nADM101,Administracion I,01,mgarcia.sync@iub.edu.co\n"
        ),
        headers={"content-type": "text/csv"},
    )
    students = UploadFile(
        filename="estudiantes.csv",
        file=io.BytesIO(
            b"internal_id,document_number,full_name,modulo_id\nEST-SYNC-001,100200300,Ana Rodriguez,ADM101-01\n"
        ),
        headers={"content-type": "text/csv"},
    )

    payload = await payload_from_uploads(
        periodo_codigo="TGA-RA1-2026-1",
        docentes_file=teachers,
        modulos_file=modules,
        estudiantes_file=students,
        consent_acknowledged=True,
    )

    assert payload.source == "csv"
    assert payload.docentes[0].pege_id == "PEGE-1001"
    assert payload.modulos[0].course_code == "ADM101"
    assert payload.estudiantes[0].document_number == "100200300"


@pytest.mark.asyncio
async def test_sync_preview_is_admin_only_and_does_not_write(sync_client):
    client, session_factory = sync_client
    await _login(client, "teacher.sync@iub.edu.co", "Teacher1234!")
    forbidden = await client.post("/api/v1/admin/sync/preview", json=_sync_payload())
    assert forbidden.status_code == 403

    await _login(client, "admin.sync@iub.edu.co", "Admin1234!")
    response = await client.post("/api/v1/admin/sync/preview", json=_sync_payload())

    assert response.status_code == 200
    assert response.json() == {
        "valid": True,
        "docentes_count": 1,
        "modulos_count": 1,
        "estudiantes_count": 1,
        "errors": [],
    }
    async with session_factory() as db:
        synced_user = (
            await db.execute(select(User).where(User.email == "mgarcia.sync@iub.edu.co"))
        ).scalar_one_or_none()
    assert synced_user is None


@pytest.mark.asyncio
async def test_sync_apply_upserts_records_and_writes_audit_log(sync_client):
    client, session_factory = sync_client
    await _login(client, "admin.sync@iub.edu.co", "Admin1234!")

    response = await client.post("/api/v1/admin/sync/apply", json=_sync_payload())

    assert response.status_code == 207
    data = response.json()
    assert data["docentes_imported"] == 1
    assert data["modulos_imported"] == 1
    assert data["estudiantes_imported"] == 1
    assert data["errors"] == []

    async with session_factory() as db:
        teacher = (
            await db.execute(select(User).where(User.email == "mgarcia.sync@iub.edu.co"))
        ).scalar_one()
        module = (
            await db.execute(
                select(Module).where(
                    Module.course_code == "ADM101",
                    Module.group_name == "01",
                )
            )
        ).scalar_one()
        student = (
            await db.execute(select(Student).where(Student.internal_id == "EST-SYNC-001"))
        ).scalar_one()
        assignment = (
            await db.execute(
                select(ModuleAssignment).where(
                    ModuleAssignment.module_id == module.id,
                    ModuleAssignment.user_id == teacher.id,
                )
            )
        ).scalar_one()
        enrollment = (
            await db.execute(
                select(ModuleStudent).where(
                    ModuleStudent.module_id == module.id,
                    ModuleStudent.student_id == student.id,
                )
            )
        ).scalar_one()
        event = (
            await db.execute(select(SecurityEvent).where(SecurityEvent.event == "sync_applied"))
        ).scalar_one()
        sync_log = (await db.execute(select(OracleSyncLog))).scalar_one()

    assert teacher.pege_id == "PEGE-1001"
    assert assignment.id > 0
    assert enrollment.status == "active"
    assert event.detail["source"] == "csv"
    assert sync_log.periodo_codigo == "TGA-RA1-2026-1"
    assert sync_log.estudiantes_count == 1


@pytest.mark.asyncio
async def test_sync_service_consent_gate_rejects_before_writing(sync_client):
    client, session_factory = sync_client
    await _login(client, "admin.sync@iub.edu.co", "Admin1234!")

    response = await client.post(
        "/api/v1/admin/sync/apply",
        json=_sync_payload(consent=False),
    )

    assert response.status_code == 400
    assert "Ley 1581/2012" in response.json()["detail"]
    async with session_factory() as db:
        synced_user = (
            await db.execute(select(User).where(User.email == "mgarcia.sync@iub.edu.co"))
        ).scalar_one_or_none()
        sync_log = (await db.execute(select(OracleSyncLog))).scalar_one_or_none()
    assert synced_user is None
    assert sync_log is None
