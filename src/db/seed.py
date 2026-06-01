"""Run with: python -m src.db.seed"""
import asyncio

from sqlalchemy import select

from src.core.security import hash_password
from src.db.base import async_session_factory, engine, Base
from src.models import User, Period  # noqa: F401 — registers tables
from src.models import RevokedToken, SecurityEvent  # noqa: F401


_USERS = [
    {
        "email": "admin@iub.edu.co",
        "full_name": "Administrador Sistema",
        "role": "admin",
        "password": "Admin1234!",
    },
    {
        "email": "lider@iub.edu.co",
        "full_name": "Líder Académico",
        "role": "leader",
        "password": "Lider1234!",
    },
    {
        "email": "docente@iub.edu.co",
        "full_name": "Docente Demo",
        "role": "teacher",
        "password": "Docente1234!",
    },
]


async def seed() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as db:
        for data in _USERS:
            result = await db.execute(select(User).where(User.email == data["email"]))
            user = result.scalar_one_or_none()
            if user is None:
                db.add(
                    User(
                        email=data["email"],
                        full_name=data["full_name"],
                        role=data["role"],
                        hashed_password=hash_password(data["password"]),
                        is_active=True,
                        auth_provider="local",
                    )
                )
        await db.commit()
        print("Seed complete.")


if __name__ == "__main__":
    asyncio.run(seed())
