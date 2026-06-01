from datetime import date
from decimal import Decimal
import csv
import io

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert

from src.api.deps import get_db
from src.api.main import app
from src.core.security import hash_password
from src.models.assessment import Assessment
from src.models.module import Module, ModuleAssignment
from src.models.module_analysis import ModuleAnalysis
from src.models.period import Period
from src.models.program import Program, PropedeuticLine
from src.models.rubric import PerfIndicator, Rubric
from src.models.security import SecurityEvent
from src.models.student import ModuleStudent, Student
from src.models.student_outcome import StudentOutcome
from src.models.user import User

pytestmark = [pytest.mark.asyncio, pytest.mark.pg]


def _make_csv(rows: list[dict]) -> bytes:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=["internal_id", "document_number", "full_name"])
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue().encode("utf-8")


async def _seed_pg_module(db, *, with_student: bool = True):
    teacher = User(
        email="teacher.pg@iub.edu.co",
        full_name="Teacher PG",
        role="teacher",
        hashed_password=hash_password("Teacher1234!"),
        is_active=True,
        auth_provider="local",
    )
    db.add(teacher)
    await db.flush()

    line = PropedeuticLine(name="Linea PG", code="LP-PG", is_active=True)
    db.add(line)
    await db.flush()

    program = Program(
        propedeutic_line_id=line.id,
        name="Programa PG",
        code="PG-TST",
        cycle_level="profesional",
        faculty="FCEIA",
    )
    db.add(program)
    await db.flush()

    so = StudentOutcome(
        code="RA-PG",
        description="Resultado PG",
        is_active=True,
        program_id=program.id,
    )
    db.add(so)
    await db.flush()

    period = Period(
        name="Periodo PG",
        student_outcome_id=so.id,
        start_date=date(2026, 1, 15),
        end_date=date(2026, 5, 30),
        status="open",
        created_by=teacher.id,
    )
    db.add(period)
    await db.flush()

    rubric = Rubric(student_outcome_id=so.id, period_id=period.id)
    db.add(rubric)
    await db.flush()
    period.rubric_id = rubric.id

    pi = PerfIndicator(
        rubric_id=rubric.id,
        code="PG-PI-1",
        description="PI PG",
        pi_weight=Decimal("60.00"),
        is_active=True,
        position=1,
    )
    db.add(pi)
    await db.flush()

    module = Module(
        period_id=period.id,
        course_code="PG101",
        course_name="Modulo PG",
        group_name="A",
        status="in_progress",
    )
    db.add(module)
    await db.flush()
    db.add(ModuleAssignment(module_id=module.id, user_id=teacher.id))

    module_student = None
    if with_student:
        student = Student(
            internal_id="PG-S01",
            document_number="90000001",
            full_name="Estudiante PG",
        )
        db.add(student)
        await db.flush()

        module_student = ModuleStudent(
            module_id=module.id,
            student_id=student.id,
            status="active",
        )
        db.add(module_student)
        await db.flush()
    await db.commit()

    return module, module_student, pi


async def test_pg_01_security_event_detail_round_trips_jsonb(pg_session):
    event = SecurityEvent(
        event="pg_jsonb_roundtrip",
        severity="INFO",
        detail={"nested": {"ok": True}, "counts": [1, 2, 3]},
    )
    pg_session.add(event)
    await pg_session.commit()

    saved = await pg_session.scalar(
        select(SecurityEvent).where(SecurityEvent.event == "pg_jsonb_roundtrip")
    )

    assert saved.detail == {"nested": {"ok": True}, "counts": [1, 2, 3]}


async def test_pg_02_assessment_upsert_keeps_single_row(pg_session):
    _, module_student, pi = await _seed_pg_module(pg_session)

    stmt = insert(Assessment).values(
        module_student_id=module_student.id,
        perf_indicator_id=pi.id,
        level=2,
    )
    await pg_session.execute(
        stmt.on_conflict_do_update(
            index_elements=["module_student_id", "perf_indicator_id"],
            set_={"level": 4},
        )
    )
    await pg_session.execute(
        stmt.on_conflict_do_update(
            index_elements=["module_student_id", "perf_indicator_id"],
            set_={"level": 3},
        )
    )
    await pg_session.commit()

    count = await pg_session.scalar(select(func.count()).select_from(Assessment))
    level = await pg_session.scalar(select(Assessment.level))

    assert count == 1
    assert level == 3


async def test_pg_03_module_analysis_upsert_keeps_single_row(pg_session):
    module, _, pi = await _seed_pg_module(pg_session)

    stmt = insert(ModuleAnalysis).values(
        module_id=module.id,
        perf_indicator_id=pi.id,
        analysis_text="Primera version",
    )
    await pg_session.execute(
        stmt.on_conflict_do_update(
            index_elements=["module_id", "perf_indicator_id"],
            set_={"analysis_text": "Segunda version"},
        )
    )
    await pg_session.execute(
        stmt.on_conflict_do_update(
            index_elements=["module_id", "perf_indicator_id"],
            set_={"analysis_text": "Version final"},
        )
    )
    await pg_session.commit()

    count = await pg_session.scalar(select(func.count()).select_from(ModuleAnalysis))
    analysis_text = await pg_session.scalar(select(ModuleAnalysis.analysis_text))

    assert count == 1
    assert analysis_text == "Version final"


async def test_pg_04_full_flow_data_can_reach_completed_state(pg_session):
    module, _, pi = await _seed_pg_module(pg_session, with_student=False)

    async def _override_get_db():
        yield pg_session

    app.dependency_overrides[get_db] = _override_get_db
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/auth/login",
                json={"email": "teacher.pg@iub.edu.co", "password": "Teacher1234!"},
            )
            assert response.status_code == 200

            response = await client.post(
                f"/api/v1/modules/{module.id}/students/import",
                data={"consent_acknowledged": "true"},
                files={
                    "file": (
                        "students.csv",
                        _make_csv([
                            {
                                "internal_id": "PG-S02",
                                "document_number": "90000002",
                                "full_name": "Estudiante PG Dos",
                            }
                        ]),
                        "text/csv",
                    )
                },
            )
            assert response.status_code == 200

            response = await client.get(f"/api/v1/modules/{module.id}/assessments")
            assert response.status_code == 200
            module_student_id = response.json()["students"][0]["module_student_id"]

            response = await client.put(
                f"/api/v1/modules/{module.id}/assessments",
                json={
                    "assessments": [
                        {
                            "module_student_id": module_student_id,
                            "perf_indicator_id": pi.id,
                            "level": 4,
                        }
                    ]
                },
            )
            assert response.status_code == 200

            response = await client.put(
                f"/api/v1/modules/{module.id}/qualitative",
                json={
                    "analyses": [
                        {"perf_indicator_id": pi.id, "analysis_text": "Completo"}
                    ]
                },
            )
            assert response.status_code == 200

            response = await client.put(f"/api/v1/modules/{module.id}/submit")
            assert response.status_code == 200
            assert response.json()["status"] == "completed"
    finally:
        app.dependency_overrides.clear()


async def test_pg_05_numeric_pi_weight_round_trips_as_decimal(pg_session):
    _, _, pi = await _seed_pg_module(pg_session)

    weight = await pg_session.scalar(
        select(PerfIndicator.pi_weight).where(PerfIndicator.id == pi.id)
    )

    assert weight == Decimal("60.00")
    assert str(weight) == "60.00"
