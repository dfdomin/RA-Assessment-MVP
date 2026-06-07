#!/usr/bin/env python3
"""Read-only Supabase snapshot for review planning. Requires SUPABASE_SECRET_KEY env."""
from __future__ import annotations

import json
import os
import sys
import urllib.parse
import urllib.request

URL = os.environ.get("SUPABASE_URL", "https://whjjervbojyktkhvvmte.supabase.co").rstrip("/")
KEY = os.environ.get("SUPABASE_SECRET_KEY", "")


def fetch(path: str, params: dict | None = None) -> list:
    if not KEY:
        print("Set SUPABASE_SECRET_KEY", file=sys.stderr)
        sys.exit(1)
    qs = urllib.parse.urlencode(params or {})
    req_url = f"{URL}/rest/v1/{path}" + (f"?{qs}" if qs else "")
    req = urllib.request.Request(
        req_url,
        headers={
            "apikey": KEY,
            "Authorization": f"Bearer {KEY}",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode())
        return data if isinstance(data, list) else [data]


def main() -> None:
    users = fetch("users", {"select": "id,email,full_name,role,is_active", "order": "role.asc,email.asc"})
    staff = fetch("module_staff", {"select": "module_id,user_id"})
    periods = fetch("periods", {"select": "id,name,status", "order": "created_at.desc"})
    modules = fetch(
        "modules",
        {
            "select": "id,course_code,course_name,group_name,period_id,module_staff(user_id,users(email)),module_students(id,status)",
        },
    )

    staff_by_user: dict[str, int] = {}
    for row in staff:
        uid = row["user_id"]
        staff_by_user[uid] = staff_by_user.get(uid, 0) + 1

    user_by_id = {u["id"]: u for u in users}
    teachers = [u for u in users if u.get("role") == "teacher"]
    leaders = [u for u in users if u.get("role") in ("leader", "admin")]

    docente = next((u for u in users if u.get("email") == "docente@iub.edu.co"), None)
    docente_modules = staff_by_user.get(docente["id"], 0) if docente else 0

    modules_enriched = []
    for m in modules:
        active = sum(1 for ms in (m.get("module_students") or []) if ms.get("status") == "active")
        teachers_assigned = [
            (s.get("users") or {}).get("email") for s in (m.get("module_staff") or [])
        ]
        modules_enriched.append(
            {
                "module_id": m["id"],
                "period_id": m["period_id"],
                "course_code": m.get("course_code"),
                "course_name": m.get("course_name"),
                "group_name": m.get("group_name"),
                "active_students": active,
                "teachers": [t for t in teachers_assigned if t],
            }
        )

    modules_enriched.sort(key=lambda x: x["active_students"], reverse=True)

    teacher_summary = []
    for u in teachers:
        teacher_summary.append(
            {
                "email": u["email"],
                "full_name": u["full_name"],
                "modules": staff_by_user.get(u["id"], 0),
            }
        )
    teacher_summary.sort(key=lambda x: x["modules"], reverse=True)

    report = {
        "user_count": len(users),
        "teacher_count": len(teachers),
        "leader_admin_count": len(leaders),
        "module_staff_total": len(staff),
        "docente": {
            "email": "docente@iub.edu.co",
            "full_name": docente.get("full_name") if docente else None,
            "modules_assigned": docente_modules,
        },
        "periods": periods,
        "teachers": teacher_summary,
        "leaders": [
            {"email": u["email"], "full_name": u["full_name"], "role": u["role"]} for u in leaders
        ],
        "top_modules_for_wizard": [m for m in modules_enriched if m["active_students"] > 0][:15],
        "modules_without_teacher_with_students": [
            m for m in modules_enriched if not m["teachers"] and m["active_students"] > 0
        ][:15],
    }

    out_path = os.environ.get("SNAPSHOT_OUT", "reviews/supabase_snapshot.json")
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
