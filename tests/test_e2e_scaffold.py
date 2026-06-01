from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read_text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_playwright_dependencies_are_declared():
    requirements = read_text("requirements.in")

    assert "playwright" in requirements
    assert "pytest-playwright" in requirements


def test_e2e_pytest_marker_is_registered():
    pyproject = read_text("pyproject.toml")

    assert '"e2e: Browser end-to-end tests' in pyproject


def test_e2e_scaffold_defines_e2e_server_and_page():
    conftest = read_text("tests/e2e/conftest.py")

    assert "def e2e_server" in conftest
    assert "def base_url_for_e2e" in conftest
    assert "def browser_page" in conftest
    assert "sync_playwright" in conftest


def test_e2e_scaffold_has_collectable_smoke_test():
    smoke = read_text("tests/e2e/test_smoke.py")

    assert "@pytest.mark.e2e" in smoke
    assert "test_e2e_scaffold_is_collectable" in smoke


def test_e2e_auth_flow_tests_declared():
    auth_flow = read_text("tests/e2e/test_auth_flow.py")

    assert "@pytest.mark.e2e" in auth_flow
    assert "def test_pw01_login_success" in auth_flow
    assert "def test_pw02_login_wrong_password_inline_error" in auth_flow
    assert "def test_pw03_logout_revokes_session" in auth_flow


def test_e2e_conformidad_tests_declared():
    conformidad = read_text("tests/e2e/test_conformidad.py")
    conftest = read_text("tests/e2e/conftest.py")

    assert "@pytest.mark.e2e" in conformidad
    assert "def test_pw04_dg_tsi_09_v4_colors_and_structure" in conformidad
    assert "def test_pw05_teacher_dashboard_shows_modules" in conformidad
    assert "Docente Demo" in conftest
    assert "Cálculo Diferencial" in conftest
