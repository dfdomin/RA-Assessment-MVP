from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read_frontend(path: str) -> str:
    return (ROOT / "frontend" / path).read_text(encoding="utf-8")


def test_role_mode_js_exports_storage_helpers():
    js = read_frontend("js/role_mode.js")
    assert "sessionStorage" in js
    assert "ra_work_mode" in js
    assert "ra_role_picker_seen" in js
    assert "getWorkMode" in js
    assert "setWorkMode" in js
    assert "detectUserCapabilities" in js


def test_role_select_page_declares_mode_picker():
    html = read_frontend("role-select.html")
    assert "¿Cómo quieres trabajar hoy?" in html
    assert 'name="work-mode"' in html
    assert 'value="teacher"' in html
    assert 'value="leader"' in html
    assert 'class="card role-select-card-wrap"' in html
    assert 'class="site-header"' in html
    assert "./js/role_mode.js" in html
    assert "./js/role_select.js" in html
