"""Tests for contextual module ownership authorization."""

from datetime import date

import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from src.api.deps import verify_module_ownership
from src.db.base import Base
from src.models.module import Module, ModuleAssignment
from src.models.period import Period
from src.models.program import Program, PropedeuticLine
from src.models.student_outcome import StudentOutcome
from src.models.user import User


@pytest_asyncio.fixture
async def ownership_db():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with factory() as session:
        leader = User(
            email="leader.ownership@iub.edu.co",
            full_name="Leader Evaluator",
            role="leader",
            hashed_password="x",
        )
        other_leader = User(
            email="other.leader.ownership@iub.edu.co",
            full_name="Other Leader",
            role="leader",
            hashed_password="x",
        )
        teacher = User(
            email="teacher.ownership@iub.edu.co",
            full_name="Teacher Evaluator",
            role="teacher",
            hashed_password="x",
        )
        session.add_all([leader, other_leader, teacher])
        await session.flush()
        line = PropedeuticLine(name="Gestión Administrativa", code="LP-GESTION-O", is_active=True)
        session.add(line)
        await session.flush()
        program = Program(
            propedeutic_line_id=line.id,
            name="Tecnología en Gestión Administrativa",
            code="TGA-O",
            cycle_level="tecnología",
        )
        session.add(program)
        await session.flush()
        so_own = StudentOutcome(code="RA1", description="Owned RA", is_active=True, program_id=program.id)
        so_other = StudentOutcome(code="RA2", description="Other RA", is_active=True, program_id=program.id)
        session.add_all([so_own, so_other])
        await session.flush()

        own_period = Period(
            name="RA1 2026-1",
            student_outcome_id=so_own.id,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 6, 30),
            status="draft",
            created_by=leader.id,
        )
        other_period = Period(
            name="RA2 2026-1",
            student_outcome_id=so_other.id,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 6, 30),
            status="draft",
            created_by=other_leader.id,
        )
        session.add_all([own_period, other_period])
        await session.flush()

        own_module = Module(
            period_id=own_period.id,
            course_code="OWN101",
            course_name="Own RA module",
            group_name="A",
        )
        other_module = Module(
            period_id=other_period.id,
            course_code="OTH101",
            course_name="Other RA module",
            group_name="B",
        )
        unassigned_module = Module(
            period_id=other_period.id,
            course_code="OTH102",
            course_name="Unassigned module",
            group_name="C",
        )
        session.add_all([own_module, other_module, unassigned_module])
        await session.flush()

        session.add_all(
            [
                ModuleAssignment(module_id=own_module.id, user_id=leader.id),
                ModuleAssignment(module_id=other_module.id, user_id=leader.id),
                ModuleAssignment(module_id=unassigned_module.id, user_id=teacher.id),
            ]
        )
        await session.commit()

        yield {
            "session": session,
            "leader": leader,
            "teacher": teacher,
            "own_module": own_module,
            "other_module": other_module,
            "unassigned_module": unassigned_module,
        }

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.mark.asyncio
async def test_leader_assigned_to_own_ra_module_has_module_ownership(ownership_db):
    module = await verify_module_ownership(
        ownership_db["own_module"].id,
        current_user=ownership_db["leader"],
        db=ownership_db["session"],
    )

    assert module.id == ownership_db["own_module"].id


@pytest.mark.asyncio
async def test_leader_assigned_to_other_ra_module_has_module_ownership(ownership_db):
    module = await verify_module_ownership(
        ownership_db["other_module"].id,
        current_user=ownership_db["leader"],
        db=ownership_db["session"],
    )

    assert module.id == ownership_db["other_module"].id


@pytest.mark.asyncio
async def test_leader_not_assigned_to_module_gets_404(ownership_db):
    with pytest.raises(HTTPException) as exc_info:
        await verify_module_ownership(
            ownership_db["unassigned_module"].id,
            current_user=ownership_db["leader"],
            db=ownership_db["session"],
        )

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_teacher_assigned_to_module_has_module_ownership(ownership_db):
    module = await verify_module_ownership(
        ownership_db["unassigned_module"].id,
        current_user=ownership_db["teacher"],
        db=ownership_db["session"],
    )

    assert module.id == ownership_db["unassigned_module"].id
