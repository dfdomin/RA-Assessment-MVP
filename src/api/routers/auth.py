from datetime import datetime, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from jose import JWTError
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db
from src.core.config import settings
from src.core.security import decode_jwt, encode_jwt, verify_password
from src.models.security import RevokedToken, SecurityEvent
from src.models.user import User

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


async def _log(
    db: AsyncSession,
    event: str,
    ip: str,
    user_id: int | None = None,
    severity: str = "INFO",
    detail: dict | None = None,
) -> None:
    ev = SecurityEvent(
        event=event, user_id=user_id, ip=ip, severity=severity, detail=detail
    )
    db.add(ev)
    await db.commit()


@router.post("/login")
@limiter.limit("5/minute")
async def login(
    request: Request,
    response: Response,
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    ip = (request.client.host if request.client else None) or "unknown"

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if (
        user is None
        or not user.hashed_password
        or not verify_password(body.password, user.hashed_password)
    ):
        await _log(db, "login_failed", ip, severity="WARN", detail={"email": body.email})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Account disabled"
        )

    token, _jti = encode_jwt(user.id, user.role)
    await _log(db, "login_success", ip, user_id=user.id)

    response.set_cookie(
        key="ra_session",
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.APP_ENV == "production",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    return {"message": "Login successful", "role": user.role}


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    ra_session: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
):
    ip = (request.client.host if request.client else None) or "unknown"

    if ra_session:
        try:
            payload = decode_jwt(ra_session)
            jti: str | None = payload.get("jti")
            exp = payload.get("exp")
            if jti and exp:
                expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)
                db.add(RevokedToken(jti=jti, expires_at=expires_at))
                await db.commit()
                uid = payload.get("sub")
                await _log(db, "logout", ip, user_id=int(uid) if uid else None)
        except JWTError:
            pass  # Invalid token — still clear the cookie

    response.delete_cookie(key="ra_session", samesite="lax")
    return {"message": "Logged out"}
