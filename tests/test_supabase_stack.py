from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FUNCTIONS = ROOT / "supabase" / "functions"


def test_edge_functions_exist():
    expected = [
        "sanitize/index.ts",
        "report-abet/index.ts",
        "report-leader/index.ts",
        "bulk-import/index.ts",
        "habeas-data/index.ts",
    ]
    for rel in expected:
        assert (FUNCTIONS / rel).is_file(), f"Missing edge function: {rel}"


def test_shared_modules_exist():
    for rel in ["_shared/cors.ts", "_shared/auth.ts", "_shared/sanitize.ts"]:
        assert (FUNCTIONS / rel).is_file()


def test_migrations_include_rls_and_data_ops():
    migrations = (ROOT / "supabase" / "migrations").glob("*.sql")
    names = {p.name for p in migrations}
    assert "0008_rls_policies.sql" in names
    assert "0010_users_rls_seed.sql" in names
    assert "0011_auto_assign_module_staff.sql" in names


def test_github_workflows_exist():
    assert (ROOT / ".github/workflows/deploy.yml").is_file()
    assert (ROOT / ".github/workflows/tests.yml").is_file()


def test_legacy_documented():
    legacy = (ROOT / "src/LEGACY.md").read_text(encoding="utf-8")
    assert "reference" in legacy.lower()
    assert "Frozen" in legacy or "frozen" in legacy


def test_cache_bust_script_exists():
    script = ROOT / "scripts/inject-cache-bust.sh"
    assert script.is_file()
    content = script.read_text(encoding="utf-8")
    assert "BUILD_SHA" in content
