from datetime import date
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
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
from src.models.student import ModuleStudent, Student
from src.models.student_outcome import StudentOutcome
from src.models.user import User


LOGIN_URL = "/api/v1/auth/login"


@pytest_asyncio.fixture
async def modules_client():
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
            email="admin.modules@iub.edu.co",
            full_name="Admin Modules",
            role="admin",
            hashed_password=hash_password("Admin1234!"),
            is_active=True,
            auth_provider="local",
        )
        leader = User(
            email="leader.modules@iub.edu.co",
            full_name="Leader Modules",
            role="leader",
            hashed_password=hash_password("Leader1234!"),
            is_active=True,
            auth_provider="local",
        )
        teacher = User(
            email="teacher.modules@iub.edu.co",
            full_name="Teacher Modules",
            role="teacher",
            hashed_password=hash_password("Teacher1234!"),
            is_active=True,
            auth_provider="local",
        )
        other_teacher = User(
            email="other.teacher.modules@iub.edu.co",
            full_name="Other Teacher Modules",
            role="teacher",
            hashed_password=hash_password("Teacher1234!"),
            is_active=True,
            auth_provider="local",
        )
        db.add_all([admin, leader, teacher, other_teacher])
        await db.flush()

        line = PropedeuticLine(name="Gestión Administrativa", code="LP-GESTION-M", is_active=True)
        db.add(line)
        await db.flush()
        program = Program(
            propedeutic_line_id=line.id,
            name="Tecnología en Gestión Administrativa",
            code="TGA-M",
            cycle_level="tecnología",
            faculty="FCCEA",
        )
        db.add(program)
        await db.flush()
        db.add(ProgramMembership(user_id=leader.id, program_id=program.id, role="leader"))
        student_outcome = StudentOutcome(
            code="RA1",
            description="Resultado de aprendizaje 1",
            is_active=True,
            program_id=program.id,
        )
        db.add(student_outcome)
        await db.flush()

        period = Period(
            name="TGA RA1 2026-1",
            student_outcome_id=student_outcome.id,
            start_date=date(2026, 1, 15),
            end_date=date(2026, 5, 30),
            status="open",
            created_by=leader.id,
        )
        db.add(period)
        await db.flush()

        rubric = Rubric(student_outcome_id=student_outcome.id, period_id=period.id)
        db.add(rubric)
        await db.flush()
        pi1 = PerfIndicator(
            rubric_id=rubric.id,
            code="PI1-M",
            description="PI 1",
            pi_weight=Decimal("50.00"),
            is_active=True,
            position=1,
        )
        pi2 = PerfIndicator(
            rubric_id=rubric.id,
            code="PI2-M",
            description="PI 2",
            pi_weight=Decimal("50.00"),
            is_active=True,
            position=2,
        )
        db.add_all([pi1, pi2])
        await db.flush()
        period.rubric_id = rubric.id

        assigned_module = Module(
            period_id=period.id,
            course_code="TGA101",
            course_name="Gestión administrativa",
            group_name="A",
            status="in_progress",
        )
        other_module = Module(
            period_id=period.id,
            course_code="TGA102",
            course_name="Procesos administrativos",
            group_name="B",
            status="pending",
        )
        db.add_all([assigned_module, other_module])
        await db.flush()
        db.add_all(
            [
                ModuleAssignment(module_id=assigned_module.id, user_id=teacher.id),
                ModuleAssignment(module_id=other_module.id, user_id=other_teacher.id),
            ]
        )
        await db.commit()

        period_id = period.id
        assigned_module_id = assigned_module.id
        pi_ids = [pi1.id, pi2.id]

    async with session_factory() as db:
        students = [
            Student(internal_id="MOD-S001", document_number="1001", full_name="Completa Uno"),
            Student(internal_id="MOD-S002", document_number="1002", full_name="Completa Dos"),
            Student(internal_id="MOD-S003", document_number="1003", full_name="Incompleta Tres"),
            Student(internal_id="MOD-S004", document_number="1004", full_name="Excluida Cuatro"),
        ]
        db.add_all(students)
        await db.flush()

        module_students = [
            ModuleStudent(module_id=assigned_module_id, student_id=students[0].id, status="active"),
            ModuleStudent(module_id=assigned_module_id, student_id=students[1].id, status="active"),
            ModuleStudent(module_id=assigned_module_id, student_id=students[2].id, status="active"),
            ModuleStudent(module_id=assigned_module_id, student_id=students[3].id, status="excluded"),
        ]
        db.add_all(module_students)
        await db.flush()
        db.add_all(
            [
                Assessment(module_student_id=module_students[0].id, perf_indicator_id=pi_ids[0], level=3),
                Assessment(module_student_id=module_students[0].id, perf_indicator_id=pi_ids[1], level=4),
                Assessment(module_student_id=module_students[1].id, perf_indicator_id=pi_ids[0], level=2),
                Assessment(module_student_id=module_students[1].id, perf_indicator_id=pi_ids[1], level=3),
                Assessment(module_student_id=module_students[2].id, perf_indicator_id=pi_ids[0], level=2),
            ]
        )
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
        yield client, period_id

    app.dependency_overrides.clear()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


async def login(client: AsyncClient, email: str, password: str) -> None:
    response = await client.post(LOGIN_URL, json={"email": email, "password": password})
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_admin_lists_all_modules_for_period(modules_client):
    client, period_id = modules_client
    await login(client, "admin.modules@iub.edu.co", "Admin1234!")

    response = await client.get(f"/api/v1/periods/{period_id}/modules")

    assert response.status_code == 200
    data = response.json()
    assert [module["course_code"] for module in data] == ["TGA101", "TGA102"]
    assert data[0]["teacher"]["full_name"] == "Teacher Modules"
    assert isinstance(data[0]["teacher"]["id"], int)
    assert data[0]["students_active"] == 3
    assert data[0]["students_graded"] == 2
    assert data[1]["students_active"] == 0
    assert data[1]["students_graded"] == 0


@pytest.mark.asyncio
async def test_teacher_lists_only_assigned_modules_for_period(modules_client):
    client, period_id = modules_client
    await login(client, "teacher.modules@iub.edu.co", "Teacher1234!")

    response = await client.get(f"/api/v1/periods/{period_id}/modules")

    assert response.status_code == 200
    data = response.json()
    assert [module["course_code"] for module in data] == ["TGA101"]


@pytest.mark.asyncio
async def test_leader_lists_modules_for_program_membership(modules_client):
    client, period_id = modules_client
    await login(client, "leader.modules@iub.edu.co", "Leader1234!")

    response = await client.get(f"/api/v1/periods/{period_id}/modules")

    assert response.status_code == 200
    data = response.json()
    assert [module["course_code"] for module in data] == ["TGA101", "TGA102"]
