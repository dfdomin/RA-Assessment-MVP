from fastapi import Cookie, Depends, HTTPException, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.security import decode_jwt
from src.db.base import async_session_factory
from src.models.module import Module, ModuleAssignment
from src.models.period import Period
from src.models.program import Program, ProgramMembership
from src.models.security import RevokedToken
from src.models.user import User


async def get_db():
    async with async_session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def get_current_user(
    ra_session: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    if ra_session is None:
        raise exc

    try:
        payload = decode_jwt(ra_session)
    except JWTError:
        raise exc

    jti: str | None = payload.get("jti")
    user_id: str | None = payload.get("sub")
    if not jti or not user_id:
        raise exc

    revoked = await db.execute(select(RevokedToken).where(RevokedToken.jti == jti))
    if revoked.scalar_one_or_none() is not None:
        raise exc

    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise exc

    return user


def require_role(*roles: str):
    async def _checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return _checker


async def verify_program_access(
    program_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Program:
    """Return the Program if current_user is admin or has a ProgramMembership for it.

    Always raises 404 (never 403) to prevent IDOR information disclosure.
    """
    if current_user.role == "admin":
        program = await db.get(Program, program_id)
        if program is None or not program.is_active:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
        return program

    result = await db.execute(
        select(Program)
        .join(ProgramMembership, ProgramMembership.program_id == Program.id)
        .where(
            Program.id == program_id,
            Program.is_active.is_(True),
            ProgramMembership.user_id == current_user.id,
        )
    )
    program = result.scalar_one_or_none()
    if program is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Program not found")
    return program


async def verify_module_ownership(
    module_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Module:
    result = await db.execute(
        select(Module)
        .join(ModuleAssignment, Module.id == ModuleAssignment.module_id)
        .where(
            Module.id == module_id,
            ModuleAssignment.user_id == current_user.id,
        )
    )
    module = result.scalar_one_or_none()
    if module is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Module not found",
        )

    return module


async def ensure_module_period_open(module: Module, db: AsyncSession) -> None:
    period = await db.get(Period, module.period_id)
    if period is not None and period.status == "closed":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Period is closed",
        )
