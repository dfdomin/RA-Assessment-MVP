"""Static E2E scaffold for Supabase MVP frontend (no live Supabase required)."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read_frontend(path: str) -> str:
    return (ROOT / "frontend" / path).read_text(encoding="utf-8")


def test_login_page_loads_supabase_stack():
    html = read_frontend("index.html")
    assert "@supabase/supabase-js" in html
    assert "./js/supabase-client.js" in html
    assert "./js/auth.js" in html


def test_auth_js_uses_supabase_sign_in():
    js = read_frontend("js/auth.js")
    assert "signInWithPassword" in js
    assert 'fetch("/api/v1/auth/login"' not in js


def test_api_js_declares_edge_function_helpers():
    js = read_frontend("js/api.js")
    for fn in ["report-abet", "report-leader", "bulk-import", "habeas-data", "sanitize"]:
        assert fn in js
