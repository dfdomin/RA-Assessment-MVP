#!/usr/bin/env python3
"""
Seed ra_consolidator_assignments from reviews/mapping_2025-2_analysis.json.

Requires: measurement_cycles + programs + student_outcomes + users in Supabase.
Matches consolidator by normalized full_name; program by alias from Excel labels.

Usage (after supabase db push and users imported):
  python3 scripts/seed_consolidators_from_mapping.py --dry-run
  python3 scripts/seed_consolidators_from_mapping.py --ensure-leaders --dry-run
  python3 scripts/seed_consolidators_from_mapping.py --ensure-leaders
"""
from __future__ import annotations

import argparse
import json
import os
import re
import secrets
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAPPING_JSON = ROOT / "reviews" / "mapping_2025-2_analysis.json"
CYCLE_CODE = "2025-2"
DEFAULT_SUPABASE_URL = "https://whjjervbojyktkhvvmte.supabase.co"
EMAIL_DOMAIN = "unibarranquilla.edu.co"


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


PROGRAM_ALIASES: dict[str, list[str]] = {
    "TGA": ["TG Administrativa", "Tecnología en Gestión Administrativa", "TGA"],
    "ING-NEGOCIOS": [
        "Inteligencia de Negocios",
        "Profesional en Inteligencia de Negocios",
    ],
    "CE": ["Comercio Exterior"],
    "TGLI": ["TG Logística Internacional", "Tecnología en Gestión Logística Internacional"],
    "ANI": ["Adm. Neg. Internacionales", "Adm. Negocios Internacionales"],
}

USER_ALIASES: dict[str, list[str]] = {
    "J. PERTUZ": ["J PERTUZ", "JUAN PERTUZ", "JORGE PERTUZ"],
}


def normalize_name(value: str) -> str:
    text = unicodedata.normalize("NFKD", value or "")
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"\s+", " ", text.strip().upper())
    return text


def email_slug_from_name(full_name: str) -> str:
    text = unicodedata.normalize("NFKD", full_name or "")
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"[^A-Za-z0-9]+", ".", text.strip().lower())
    text = re.sub(r"\.+", ".", text).strip(".")
    return text or "lider"


def load_mapping() -> dict:
    return json.loads(MAPPING_JSON.read_text(encoding="utf-8"))


def program_code_for_label(programs: list[dict], label: str) -> str | None:
    norm_label = normalize_name(label)
    for code, aliases in PROGRAM_ALIASES.items():
        for alias in aliases:
            if normalize_name(alias) == norm_label:
                for p in programs:
                    if p.get("code") == code:
                        return code
    for p in programs:
        if normalize_name(p.get("name", "")) == norm_label:
            return p["code"]
    return None


def find_user_by_name(users_by_name: dict[str, dict], users: list[dict], leader_name: str) -> dict | None:
    norm = normalize_name(leader_name)
    if norm in users_by_name:
        return users_by_name[norm]
    for alias in USER_ALIASES.get(leader_name, []):
        hit = users_by_name.get(normalize_name(alias))
        if hit:
            return hit
    parts = [p for p in norm.replace(".", " ").split() if p]
    if len(parts) >= 2:
        last = parts[-1]
        for u in users:
            un = normalize_name(u.get("full_name", ""))
            if last in un.split():
                return u
    return None


def required_leader_names(mapping: dict) -> list[str]:
    names = sorted({v for v in mapping.get("canonical_leaders", {}).values()})
    return names


def ensure_leader_users(sb, users: list[dict], leader_names: list[str], dry_run: bool) -> list[dict]:
    users_by_name = {normalize_name(u["full_name"]): u for u in users}
    created = 0
    for name in leader_names:
        if find_user_by_name(users_by_name, users, name):
            continue
        email = f"{email_slug_from_name(name)}@{EMAIL_DOMAIN}"
        if dry_run:
            print(f"  [dry-run] crearía líder: {name} <{email}> role=leader")
            placeholder = {"id": f"dry-run-{email_slug_from_name(name)}", "full_name": name, "email": email}
            users.append(placeholder)
            users_by_name[normalize_name(name)] = placeholder
            continue
        password = secrets.token_urlsafe(16)
        auth_user = sb.auth.admin.create_user(
            {
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {"full_name": name},
            }
        )
        uid = auth_user.user.id
        sb.table("users").upsert(
            {
                "id": uid,
                "email": email,
                "full_name": name,
                "role": "leader",
                "auth_provider": "local",
                "is_active": True,
            }
        ).execute()
        users.append({"id": uid, "full_name": name, "email": email})
        users_by_name[normalize_name(name)] = users[-1]
        created += 1
        print(f"  Creado líder: {name} <{email}> (contraseña temporal en logs del operador)")
    if not dry_run and created:
        print(f"Líderes creados: {created}")
    return users


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--ensure-leaders",
        action="store_true",
        help="Crea en Auth+users los líderes del mapeo que aún no existan",
    )
    args = parser.parse_args()

    try:
        from supabase import create_client
    except ImportError:
        print("pip install supabase", file=sys.stderr)
        return 1

    load_env_file(ROOT / ".env")
    load_env_file(ROOT / ".env.local")

    url = os.environ.get("SUPABASE_URL", DEFAULT_SUPABASE_URL)
    key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_SECRET_KEY")
        or os.environ.get("SUPABASE_ANON_KEY")
    )
    if not key:
        print(
            "Falta SUPABASE_SERVICE_ROLE_KEY.\n"
            "1. Supabase Dashboard → Project Settings → API → service_role (secret)\n"
            "2. Crea un archivo .env en la raíz del repo con:\n"
            "   SUPABASE_URL=https://whjjervbojyktkhvvmte.supabase.co\n"
            "   SUPABASE_SERVICE_ROLE_KEY=tu_clave_aqui",
            file=sys.stderr,
        )
        return 1

    mapping = load_mapping()
    sb = create_client(url, key)

    cycle = (
        sb.table("measurement_cycles").select("id").eq("code", CYCLE_CODE).single().execute()
    ).data
    programs = sb.table("programs").select("id, code, name").execute().data or []
    outcomes = sb.table("student_outcomes").select("id, code").execute().data or []
    users = sb.table("users").select("id, full_name, email").execute().data or []

    if args.ensure_leaders:
        print("Comprobando líderes del mapeo…")
        users = ensure_leader_users(sb, users, required_leader_names(mapping), args.dry_run)

    users_by_name = {normalize_name(u["full_name"]): u for u in users}
    outcomes_by_code = {o["code"]: o for o in outcomes}
    programs_by_code = {p["code"]: p for p in programs}

    rows = []
    missing: list[str] = []

    for key, leader_name in mapping.get("canonical_leaders", {}).items():
        prog_label, ra_code = key.split("|", 1)
        prog_code = program_code_for_label(programs, prog_label)
        if not prog_code:
            missing.append(f"program:{prog_label}")
            continue
        so = outcomes_by_code.get(ra_code)
        if not so:
            missing.append(f"so:{ra_code}")
            continue
        user = find_user_by_name(users_by_name, users, leader_name)
        if not user:
            missing.append(f"user:{leader_name}")
            continue
        rows.append(
            {
                "cycle_id": cycle["id"],
                "program_id": programs_by_code[prog_code]["id"],
                "student_outcome_id": so["id"],
                "consolidator_user_id": user["id"],
            }
        )

    print(f"Assignments to upsert: {len(rows)}")
    if missing:
        unique_missing = sorted(set(missing))
        print(f"Unresolved ({len(unique_missing)}):")
        for item in unique_missing:
            print(f"  - {item}")
        if any(m.startswith("program:") for m in unique_missing):
            print(
                "\nSugerencia: ejecuta `supabase db push --linked --yes` "
                "para aplicar la migración 0014 (programas CE, ANI, TGLI)."
            )
        if any(m.startswith("user:") for m in unique_missing):
            print(
                "Sugerencia: vuelve a correr con `--ensure-leaders` "
                "para crear líderes faltantes en Auth+users."
            )

    if args.dry_run:
        return 0

    for row in rows:
        sb.table("ra_consolidator_assignments").upsert(
            row, on_conflict="cycle_id,program_id,student_outcome_id"
        ).execute()

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
