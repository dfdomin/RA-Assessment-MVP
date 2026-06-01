#!/usr/bin/env python
"""Create an initial admin user if the users table is empty.

Usage:
    python scripts/seed_admin.py --email admin@iub.edu.co --password changeme123

The script is idempotent: if any user already exists it exits without changes.
DATABASE_URL must be set in the environment or in .env.
"""
import argparse
import asyncio
import sys

from sqlalchemy import func, select

from src.core.security import hash_password
from src.db.base import async_session_factory, engine, Base
import src.models  # noqa: F401 — registers all ORM tables


async def seed_admin(email: str, password: str) -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as db:
        count = (await db.execute(select(func.count()).select_from(
            __import__("src.models.user", fromlist=["User"]).User
        ))).scalar_one()

        if count > 0:
            print(f"Users table already has {count} row(s). Skipping seed.")
            return

        from src.models.user import User
        db.add(User(
            email=email,
            full_name="Administrador Sistema",
            role="admin",
            hashed_password=hash_password(password),
            is_active=True,
            auth_provider="local",
        ))
        await db.commit()
        print(f"Admin user created: {email}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed initial admin user")
    parser.add_argument("--email", required=True, help="Admin email address")
    parser.add_argument("--password", required=True, help="Admin password (min 8 chars)")
    args = parser.parse_args()

    if len(args.password) < 8:
        print("Error: password must be at least 8 characters.", file=sys.stderr)
        sys.exit(1)

    asyncio.run(seed_admin(args.email, args.password))


if __name__ == "__main__":
    main()
