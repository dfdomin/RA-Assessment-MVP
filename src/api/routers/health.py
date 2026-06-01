from fastapi import APIRouter, Depends

from src.api.deps import require_role
from src.models.user import User

router = APIRouter(tags=["system"])


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/api/v1/me")
async def me(
    current_user: User = Depends(require_role("admin", "leader", "teacher")),
):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
    }
