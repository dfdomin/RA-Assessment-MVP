#!/usr/bin/env python3
"""
Rename a demo user in Supabase Auth + public.users.

Usage:
  python3 scripts/rename_demo_user.py --dry-run
  python3 scripts/rename_demo_user.py
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

OLD_EMAIL = "jorly.berdugo@iub.edu.co"
NEW_EMAIL = "john.doe@iub.edu.co"
NEW_FULL_NAME = "John Doe (A reemplazar)"


def load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--old-email", default=OLD_EMAIL)
    parser.add_argument("--new-email", default=NEW_EMAIL)
    parser.add_argument("--full-name", default=NEW_FULL_NAME)
    args = parser.parse_args()

    try:
        from supabase import create_client
    except ImportError:
        print("pip install supabase", file=sys.stderr)
        return 1

    load_env_file(ROOT / ".env")
    load_env_file(ROOT / ".env.local")

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SECRET_KEY")
    if not url or not key:
        print("Falta SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env", file=sys.stderr)
        return 1

    sb = create_client(url, key)
    row = (
        sb.table("users")
        .select("id, email, full_name, role")
        .eq("email", args.old_email)
        .maybe_single()
        .execute()
    ).data
    if not row:
        print(f"No se encontró usuario con email {args.old_email}", file=sys.stderr)
        return 1

    print("Antes:", row)
    if args.dry_run:
        print(
            f"[dry-run] actualizaría a: email={args.new_email}, "
            f"full_name={args.full_name!r}"
        )
        return 0

    uid = row["id"]
    sb.auth.admin.update_user_by_id(
        uid,
        {
            "email": args.new_email,
            "email_confirm": True,
            "user_metadata": {"full_name": args.full_name},
        },
    )
    updated = (
        sb.table("users")
        .update({"email": args.new_email, "full_name": args.full_name})
        .eq("id", uid)
        .select("id, email, full_name, role")
        .execute()
    ).data
    print("Después:", updated)
    print("Listo. Login demo:", args.new_email, "(misma contraseña Demo1234!)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
