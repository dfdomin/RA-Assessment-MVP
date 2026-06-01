from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user, get_db, require_role
from src.api.schemas.programs import (
    ProgramCreate,
    ProgramMembershipCreate,
    ProgramMembershipResponse,
    ProgramResponse,
    PropedeuticLineCreate,
    PropedeuticLineResponse,
)
from src.models.program import Program, ProgramMembership, PropedeuticLine
from src.models.user import User

router = APIRouter(tags=["programs"])


# ---------------------------------------------------------------------------
# Propedeutic Lines
# ---------------------------------------------------------------------------


@router.get("/propedeutic-lines", response_model=list[PropedeuticLineResponse])
async def list_propedeutic_lines(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("admin", "leader")),
):
    result = await db.execute(
        select(PropedeuticLine).where(PropedeuticLine.is_active.is_(True)).order_by(PropedeuticLine.code)
    )
    return result.scalars().all()


@router.post(
    "/propedeutic-lines",
    status_code=status.HTTP_201_CREATED,
    response_model=PropedeuticLineResponse,
)
async def create_propedeutic_line(
    body: PropedeuticLineCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    duplicate = await db.execute(
        select(PropedeuticLine).where(PropedeuticLine.code == body.code)
    )
    if duplicate.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="propedeutic line code already exists",
        )
    line = PropedeuticLine(name=body.name, code=body.code)
    db.add(line)
    await db.commit()
    await db.refresh(line)
    return line


# ---------------------------------------------------------------------------
# Programs
# ---------------------------------------------------------------------------


@router.get("/programs", response_model=list[ProgramResponse])
async def list_programs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Program).where(Program.is_active.is_(True)).order_by(Program.code)

    if current_user.role != "admin":
        stmt = (
            stmt.join(ProgramMembership, ProgramMembership.program_id == Program.id)
            .where(ProgramMembership.user_id == current_user.id)
        )

    result = await db.execute(stmt)
    return result.scalars().unique().all()


@router.post("/programs", status_code=status.HTTP_201_CREATED, response_model=ProgramResponse)
async def create_program(
    body: ProgramCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    line = await db.get(PropedeuticLine, body.propedeutic_line_id)
    if line is None or not line.is_active:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="propedeutic_line_id does not exist",
        )

    duplicate = await db.execute(select(Program).where(Program.code == body.code))
    if duplicate.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="program code already exists",
        )

    program = Program(
        propedeutic_line_id=body.propedeutic_line_id,
        name=body.name,
        code=body.code,
        cycle_level=body.cycle_level,
        faculty=body.faculty,
    )
    db.add(program)
    await db.commit()
    await db.refresh(program)
    return program


# ---------------------------------------------------------------------------
# Program Memberships
# ---------------------------------------------------------------------------


@router.post(
    "/programs/{program_id}/members",
    status_code=status.HTTP_201_CREATED,
    response_model=ProgramMembershipResponse,
)
async def add_program_member(
    program_id: int,
    body: ProgramMembershipCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    program = await db.get(Program, program_id)
    if program is None or not program.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")

    # Check user exists
    user = await db.get(User, body.user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="user_id does not exist"
        )

    duplicate = await db.execute(
        select(ProgramMembership).where(
            ProgramMembership.user_id == body.user_id,
            ProgramMembership.program_id == program_id,
        )
    )
    if duplicate.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="user already has a membership in this program",
        )

    membership = ProgramMembership(
        user_id=body.user_id,
        program_id=program_id,
        role=body.role,
    )
    db.add(membership)
    await db.commit()
    await db.refresh(membership)
    return membership


@router.delete(
    "/programs/{program_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_program_member(
    program_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    result = await db.execute(
        select(ProgramMembership).where(
            ProgramMembership.program_id == program_id,
            ProgramMembership.user_id == user_id,
        )
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membership not found")

    await db.delete(membership)
    await db.commit()
