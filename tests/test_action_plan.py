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
BASE_URL = "/api/v1/periods/{}/action-plan"


@pytest_asyncio.fixture
async def action_plan_client():
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
            email="admin.ap@iub.edu.co",
            full_name="Admin AP",
            role="admin",
            hashed_password=hash_password("Admin1234!"),
            is_active=True,
            auth_provider="local",
        )
        leader = User(
            email="leader.ap@iub.edu.co",
            full_name="Leader AP",
            role="leader",
            hashed_password=hash_password("Leader1234!"),
            is_active=True,
            auth_provider="local",
        )
        other_leader = User(
            email="other.leader.ap@iub.edu.co",
            full_name="Other Leader AP",
            role="leader",
            hashed_password=hash_password("Leader1234!"),
            is_active=True,
            auth_provider="local",
        )
        teacher = User(
            email="teacher.ap@iub.edu.co",
            full_name="Teacher AP",
            role="teacher",
            hashed_password=hash_password("Teacher1234!"),
            is_active=True,
            auth_provider="local",
        )
        db.add_all([admin, leader, other_leader, teacher])
        await db.flush()

        line = PropedeuticLine(code="LP-AP", name="Línea AP", is_active=True)
        db.add(line)
        await db.flush()

        program = Program(
            propedeutic_line_id=line.id,
            name="Ingeniería de Sistemas AP",
            code="IS-AP",
            cycle_level="tecnología",
            faculty="FIET",
        )
        other_program = Program(
            propedeutic_line_id=line.id,
            name="Otro Programa AP",
            code="OP-AP",
            cycle_level="tecnología",
            faculty="FIET",
        )
        db.add_all([program, other_program])
        await db.flush()

        db.add(ProgramMembership(user_id=leader.id, program_id=program.id, role="leader"))
        db.add(ProgramMembership(user_id=other_leader.id, program_id=other_program.id, role="leader"))
        await db.flush()

        so = StudentOutcome(
            code="RA-AP",
            description="Resultado de Aprendizaje AP",
            is_active=True,
            program_id=program.id,
        )
        db.add(so)
        await db.flush()

        period = Period(
            name="2024-2 AP",
            student_outcome_id=so.id,
            start_date=date(2024, 8, 1),
            end_date=date(2024, 12, 1),
            status="closed",
            created_by=admin.id,
        )
        db.add(period)
        await db.flush()

        rubric = Rubric(student_outcome_id=so.id, period_id=period.id)
        db.add(rubric)
        await db.flush()

        pi_low = PerfIndicator(
            rubric_id=rubric.id,
            code="PI-AP-1",
            description="Indicador con mayoría baja",
            pi_weight=Decimal("50.00"),
            is_active=True,
            position=1,
        )
        pi_high = PerfIndicator(
            rubric_id=rubric.id,
            code="PI-AP-2",
            description="Indicador con mayoría alta",
            pi_weight=Decimal("50.00"),
            is_active=True,
            position=2,
        )
        db.add_all([pi_low, pi_high])
        await db.flush()

        period.rubric_id = rubric.id

        module = Module(
            period_id=period.id,
            course_code="MAT101-AP",
            course_name="Cálculo AP",
            group_name="G1",
            status="completed",
        )
        db.add(module)
        await db.flush()

        students = [
            Student(internal_id=f"AP-{i}", document_number=f"100{i}", full_name=f"Estudiante AP {i}")
            for i in range(1, 4)
        ]
        db.add_all(students)
        await db.flush()

        module_students = [
            ModuleStudent(module_id=module.id, student_id=student.id, status="active")
            for student in students
        ]
        db.add_all(module_students)
        await db.flush()

        db.add_all(
            [
                Assessment(module_student_id=module_students[0].id, perf_indicator_id=pi_low.id, level=1),
                Assessment(module_student_id=module_students[1].id, perf_indicator_id=pi_low.id, level=1),
                Assessment(module_student_id=module_students[2].id, perf_indicator_id=pi_low.id, level=2),
                Assessment(module_student_id=module_students[0].id, perf_indicator_id=pi_high.id, level=4),
                Assessment(module_student_id=module_students[1].id, perf_indicator_id=pi_high.id, level=4),
                Assessment(module_student_id=module_students[2].id, perf_indicator_id=pi_high.id, level=3),
            ]
        )
        db.add(ModuleAssignment(module_id=module.id, user_id=teacher.id))
        await db.commit()

        ids = {"period_id": period.id, "pi_low_id": pi_low.id, "pi_high_id": pi_high.id}

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
    resp = await client.post(LOGIN_URL, json={"email": email, "password": password})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_admin_gets_action_plan_with_suggested_types(action_plan_client):
    client, ids, _factory = action_plan_client
    await _login(client, "admin.ap@iub.edu.co", "Admin1234!")

    resp = await client.get(BASE_URL.format(ids["period_id"]))

    assert resp.status_code == 200
    data = resp.json()
    assert data["period_id"] == ids["period_id"]
    plans = {item["perf_indicator_id"]: item for item in data["plans"]}
    assert plans[ids["pi_low_id"]]["suggested_action_type"] == "corrective"
    assert plans[ids["pi_high_id"]]["suggested_action_type"] == "improvement"
    assert plans[ids["pi_low_id"]]["action_type"] == "corrective"


@pytest.mark.asyncio
async def test_leader_with_membership_can_save_and_retrieve_action_plan(action_plan_client):
    client, ids, _factory = action_plan_client
    await _login(client, "leader.ap@iub.edu.co", "Leader1234!")

    resp = await client.put(
        BASE_URL.format(ids["period_id"]),
        json={
            "plans": [
                {
                    "perf_indicator_id": ids["pi_low_id"],
                    "action_type": "preventive",
                    "description": "Revisar secuencia de ejercicios",
                    "responsible": "Comité curricular",
                    "estimated_date": "2025-01",
                }
            ]
        },
    )
    assert resp.status_code == 200
    assert resp.json()["saved"] == 1

    resp = await client.get(BASE_URL.format(ids["period_id"]))
    plan = next(item for item in resp.json()["plans"] if item["perf_indicator_id"] == ids["pi_low_id"])
    assert plan["action_type"] == "preventive"
    assert plan["description"] == "Revisar secuencia de ejercicios"
    assert plan["responsible"] == "Comité curricular"
    assert plan["estimated_date"] == "2025-01"
    assert plan["implemented"] is False


@pytest.mark.asyncio
async def test_teacher_can_read_action_plan_but_cannot_write(action_plan_client):
    client, ids, _factory = action_plan_client
    await _login(client, "teacher.ap@iub.edu.co", "Teacher1234!")

    resp = await client.get(BASE_URL.format(ids["period_id"]))
    assert resp.status_code == 200

    resp = await client.put(
        BASE_URL.format(ids["period_id"]),
        json={
            "plans": [
                {
                    "perf_indicator_id": ids["pi_low_id"],
                    "action_type": "corrective",
                    "description": "Intento docente",
                    "responsible": "Docente",
                    "estimated_date": "2025-01",
                }
            ]
        },
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_leader_without_membership_cannot_write_action_plan(action_plan_client):
    client, ids, _factory = action_plan_client
    await _login(client, "other.leader.ap@iub.edu.co", "Leader1234!")

    resp = await client.put(
        BASE_URL.format(ids["period_id"]),
        json={
            "plans": [
                {
                    "perf_indicator_id": ids["pi_low_id"],
                    "action_type": "corrective",
                    "description": "Sin membresía",
                    "responsible": "Otro líder",
                    "estimated_date": "2025-01",
                }
            ]
        },
    )

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_action_plan_text_fields_are_sanitized(action_plan_client):
    client, ids, _factory = action_plan_client
    await _login(client, "leader.ap@iub.edu.co", "Leader1234!")

    await client.put(
        BASE_URL.format(ids["period_id"]),
        json={
            "plans": [
                {
                    "perf_indicator_id": ids["pi_low_id"],
                    "action_type": "corrective",
                    "description": "<b>Acción</b><script>alert(1)</script>",
                    "responsible": "<i>Líder</i>",
                    "estimated_date": "2025-01",
                }
            ]
        },
    )

    resp = await client.get(BASE_URL.format(ids["period_id"]))
    plan = next(item for item in resp.json()["plans"] if item["perf_indicator_id"] == ids["pi_low_id"])
    assert "<" not in plan["description"]
    assert "<" not in plan["responsible"]
    assert "Acción" in plan["description"]
    assert "Líder" in plan["responsible"]


@pytest.mark.asyncio
async def test_action_plan_upsert_is_idempotent(action_plan_client):
    client, ids, _factory = action_plan_client
    await _login(client, "leader.ap@iub.edu.co", "Leader1234!")

    payload = {
        "plans": [
            {
                "perf_indicator_id": ids["pi_low_id"],
                "action_type": "corrective",
                "description": "Primera versión",
                "responsible": "Programa",
                "estimated_date": "2025-01",
            }
        ]
    }
    await client.put(BASE_URL.format(ids["period_id"]), json=payload)
    payload["plans"][0]["description"] = "Segunda versión"
    payload["plans"][0]["implemented"] = True
    await client.put(BASE_URL.format(ids["period_id"]), json=payload)

    resp = await client.get(BASE_URL.format(ids["period_id"]))
    plans = [item for item in resp.json()["plans"] if item["description"]]
    assert len(plans) == 1
    assert plans[0]["description"] == "Segunda versión"
    assert plans[0]["implemented"] is True


@pytest.mark.asyncio
async def test_invalid_pi_returns_422(action_plan_client):
    client, ids, _factory = action_plan_client
    await _login(client, "leader.ap@iub.edu.co", "Leader1234!")

    resp = await client.put(
        BASE_URL.format(ids["period_id"]),
        json={
            "plans": [
                {
                    "perf_indicator_id": 99999,
                    "action_type": "corrective",
                    "description": "PI inválido",
                    "responsible": "Programa",
                    "estimated_date": "2025-01",
                }
            ]
        },
    )

    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_invalid_action_type_returns_422(action_plan_client):
    client, ids, _factory = action_plan_client
    await _login(client, "leader.ap@iub.edu.co", "Leader1234!")

    resp = await client.put(
        BASE_URL.format(ids["period_id"]),
        json={
            "plans": [
                {
                    "perf_indicator_id": ids["pi_low_id"],
                    "action_type": "other",
                    "description": "Tipo inválido",
                    "responsible": "Programa",
                    "estimated_date": "2025-01",
                }
            ]
        },
    )

    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_action_plan_save_writes_audit_event(action_plan_client):
    client, ids, factory = action_plan_client
    await _login(client, "leader.ap@iub.edu.co", "Leader1234!")

    resp = await client.put(
        BASE_URL.format(ids["period_id"]),
        json={
            "plans": [
                {
                    "perf_indicator_id": ids["pi_low_id"],
                    "action_type": "corrective",
                    "description": "Auditable",
                    "responsible": "Programa",
                    "estimated_date": "2025-01",
                }
            ]
        },
    )
    assert resp.status_code == 200

    async with factory() as db:
        result = await db.execute(
            select(SecurityEvent).where(SecurityEvent.event == "action_plan_saved")
        )
        event = result.scalar_one_or_none()
        assert event is not None
        assert event.detail["period_id"] == ids["period_id"]
        assert event.detail["count"] == 1
