# Legacy FastAPI Tests

Python tests under `tests/` (except `test_frontend_*.py`, `test_supabase_stack.py`, and `e2e/test_supabase_frontend.py`) target the **FastAPI reference stack** in `src/`.

## MVP-active tests

| File | Purpose |
|------|---------|
| `test_frontend_dashboard.py` | Static asserts on Supabase dashboard JS |
| `test_frontend_assessment.py` | Static asserts on Supabase wizard JS |
| `test_supabase_stack.py` | Edge Functions, migrations, CI wiring |
| `e2e/test_supabase_frontend.py` | Login/auth Edge Function scaffold |

## Legacy E2E

`tests/e2e/conftest.py` spins up uvicorn + SQLite for FastAPI browser tests. Keep for reference until Supabase live E2E credentials are configured in CI.

Run legacy suite:

```bash
docker compose up -d db
pytest tests/ -q
```

Run MVP static suite:

```bash
pytest tests/test_frontend_dashboard.py tests/test_frontend_assessment.py tests/test_supabase_stack.py tests/e2e/test_supabase_frontend.py -q
```
