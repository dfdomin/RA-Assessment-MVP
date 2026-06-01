import json
import os
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.request import urlopen

import pytest
from sqlalchemy import create_engine

ROOT = Path(__file__).resolve().parents[2]
PYTHON_EXEC = sys.executable


def _find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _seed_admin(sync_db_url: str) -> None:
    from src.core.security import hash_password
    from src.db.base import Base
    import src.models  # noqa: F401 — register all models with Base.metadata

    sync_engine = create_engine(sync_db_url)
    Base.metadata.create_all(sync_engine)

    with sync_engine.begin() as conn:
        from sqlalchemy import text

        conn.execute(
            text(
                "INSERT INTO users (email, full_name, role, hashed_password, is_active, auth_provider) "
                "VALUES (:email, :full_name, :role, :hashed_password, :is_active, :auth_provider)"
            ),
            {
                "email": "admin@iub.edu.co",
                "full_name": "Administrador Sistema",
                "role": "admin",
                "hashed_password": hash_password("Admin1234!"),
                "is_active": True,
                "auth_provider": "local",
            },
        )
        conn.execute(
            text(
                "INSERT INTO users (email, full_name, role, hashed_password, is_active, auth_provider) "
                "VALUES (:email, :full_name, :role, :hashed_password, :is_active, :auth_provider)"
            ),
            {
                "email": "docente@iub.edu.co",
                "full_name": "Docente Demo",
                "role": "teacher",
                "hashed_password": hash_password("Docente1234!"),
                "is_active": True,
                "auth_provider": "local",
            },
        )
        conn.execute(
            text(
                "INSERT INTO users (email, full_name, role, hashed_password, is_active, auth_provider) "
                "VALUES (:email, :full_name, :role, :hashed_password, :is_active, :auth_provider)"
            ),
            {
                "email": "lider@iub.edu.co",
                "full_name": "Líder Demo",
                "role": "leader",
                "hashed_password": hash_password("Lider1234!"),
                "is_active": True,
                "auth_provider": "local",
            },
        )

        admin_id = conn.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": "admin@iub.edu.co"},
        ).scalar_one()
        teacher_id = conn.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": "docente@iub.edu.co"},
        ).scalar_one()
        leader_id = conn.execute(
            text("SELECT id FROM users WHERE email = :email"),
            {"email": "lider@iub.edu.co"},
        ).scalar_one()

        conn.execute(
            text(
                "INSERT INTO propedeutic_lines (name, code, is_active) "
                "VALUES (:name, :code, :is_active)"
            ),
            {
                "name": "Línea Propedéutica de Ingeniería",
                "code": "LP-ING",
                "is_active": True,
            },
        )
        line_id = conn.execute(
            text("SELECT id FROM propedeutic_lines WHERE code = :code"),
            {"code": "LP-ING"},
        ).scalar_one()

        conn.execute(
            text(
                "INSERT INTO programs (propedeutic_line_id, name, code, cycle_level, faculty, is_active) "
                "VALUES (:propedeutic_line_id, :name, :code, :cycle_level, :faculty, :is_active)"
            ),
            {
                "propedeutic_line_id": line_id,
                "name": "Ingeniería Telemática",
                "code": "ING-TEL",
                "cycle_level": "profesional",
                "faculty": "Ingeniería",
                "is_active": True,
            },
        )
        program_id = conn.execute(
            text("SELECT id FROM programs WHERE code = :code"),
            {"code": "ING-TEL"},
        ).scalar_one()

        conn.execute(
            text(
                "INSERT INTO program_memberships (user_id, program_id, role) "
                "VALUES (:user_id, :program_id, :role)"
            ),
            {"user_id": leader_id, "program_id": program_id, "role": "leader"},
        )

        conn.execute(
            text(
                "INSERT INTO student_outcomes (code, description, is_active, program_id) "
                "VALUES (:code, :description, :is_active, :program_id)"
            ),
            {
                "code": "SO-1",
                "description": "Aplicar conocimientos de matemáticas y ciencias.",
                "is_active": True,
                "program_id": program_id,
            },
        )
        so_id = conn.execute(
            text("SELECT id FROM student_outcomes WHERE code = :code"),
            {"code": "SO-1"},
        ).scalar_one()

        conn.execute(
            text(
                "INSERT INTO periods (name, student_outcome_id, start_date, end_date, status, created_by) "
                "VALUES (:name, :student_outcome_id, :start_date, :end_date, :status, :created_by)"
            ),
            {
                "name": "2026-1 E2E",
                "student_outcome_id": so_id,
                "start_date": "2026-01-15",
                "end_date": "2026-06-15",
                "status": "draft",
                "created_by": admin_id,
            },
        )
        period_id = conn.execute(
            text("SELECT id FROM periods WHERE name = :name"),
            {"name": "2026-1 E2E"},
        ).scalar_one()

        conn.execute(
            text(
                "INSERT INTO rubrics (student_outcome_id, period_id) "
                "VALUES (:student_outcome_id, :period_id)"
            ),
            {"student_outcome_id": so_id, "period_id": period_id},
        )
        rubric_id = conn.execute(
            text("SELECT id FROM rubrics WHERE period_id = :period_id"),
            {"period_id": period_id},
        ).scalar_one()
        conn.execute(
            text("UPDATE periods SET rubric_id = :rubric_id WHERE id = :period_id"),
            {"rubric_id": rubric_id, "period_id": period_id},
        )
        conn.execute(
            text(
                "INSERT INTO perf_indicators "
                "(rubric_id, code, description, pi_weight, is_active, position) "
                "VALUES (:rubric_id, :code, :description, :pi_weight, :is_active, :position)"
            ),
            {
                "rubric_id": rubric_id,
                "code": "PI-1",
                "description": "Resuelve problemas aplicando fundamentos matemáticos.",
                "pi_weight": 100,
                "is_active": True,
                "position": 1,
            },
        )
        pi_id = conn.execute(
            text("SELECT id FROM perf_indicators WHERE code = :code"),
            {"code": "PI-1"},
        ).scalar_one()
        for level_value, label in [
            (1, "Poor"),
            (2, "Inadequate"),
            (3, "Adequate"),
            (4, "Exemplary"),
        ]:
            conn.execute(
                text(
                    "INSERT INTO pi_levels "
                    "(perf_indicator_id, level_value, label, descriptor) "
                    "VALUES (:perf_indicator_id, :level_value, :label, :descriptor)"
                ),
                {
                    "perf_indicator_id": pi_id,
                    "level_value": level_value,
                    "label": label,
                    "descriptor": f"Descriptor {label}",
                },
            )

        conn.execute(
            text(
                "INSERT INTO modules (period_id, course_code, course_name, group_name, status) "
                "VALUES (:period_id, :course_code, :course_name, :group_name, :status)"
            ),
            {
                "period_id": period_id,
                "course_code": "MAT-101",
                "course_name": "Cálculo Diferencial",
                "group_name": "A1",
                "status": "pending",
            },
        )
        module_id = conn.execute(
            text("SELECT id FROM modules WHERE course_code = :course_code"),
            {"course_code": "MAT-101"},
        ).scalar_one()

        conn.execute(
            text(
                "INSERT INTO module_staff (module_id, user_id) "
                "VALUES (:module_id, :user_id)"
            ),
            {"module_id": module_id, "user_id": teacher_id},
        )

    sync_engine.dispose()


@pytest.fixture(scope="module")
def e2e_server():
    port = _find_free_port()
    tmpdir = tempfile.mkdtemp(prefix="ra_e2e_")
    db_path = os.path.join(tmpdir, "e2e_test.db")
    db_url = f"sqlite+aiosqlite:///{db_path}"
    sync_url = f"sqlite:///{db_path}"

    _seed_admin(sync_url)

    env = {
        **os.environ,
        "APP_ENV": "test_e2e",
        "DATABASE_URL": db_url,
        "SECRET_KEY": "e2e-test-secret-key",
        "ALLOWED_ORIGINS": json.dumps([f"http://localhost:{port}"]),
    }

    proc = subprocess.Popen(
        [
            PYTHON_EXEC,
            "-m",
            "uvicorn",
            "src.api.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
        ],
        cwd=str(ROOT),
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    base_url = f"http://localhost:{port}"

    deadline = time.monotonic() + 15
    ready = False
    while time.monotonic() < deadline:
        try:
            urlopen(f"{base_url}/health", timeout=1)
            ready = True
            break
        except Exception:
            time.sleep(0.3)

    if not ready:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()
        raise RuntimeError("E2E server did not start within 15s")

    yield base_url

    proc.send_signal(signal.SIGTERM)
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait()

    shutil.rmtree(tmpdir, ignore_errors=True)


@pytest.fixture(scope="module")
def base_url_for_e2e(e2e_server) -> str:
    return e2e_server


@pytest.fixture
def browser_page(base_url_for_e2e):
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(base_url=base_url_for_e2e)
        page = context.new_page()
        yield page
        context.close()
        browser.close()
