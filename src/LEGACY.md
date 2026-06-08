# Legacy FastAPI Stack — Reference Only

**Status**: Frozen / reference implementation  
**Active stack**: Supabase + GitHub Pages (see root [`README.md`](../README.md))

## Purpose

This directory contains the original RA Assessment App backend (~6,000 LOC Python, 201 pytest tests). It is **not** the production path for RA-Assessment-MVP.

Keep it until Supabase Edge Functions reach functional parity for:

- ABET report PDF/XLSX (`src/services/report.py`)
- Leader report PDF/DOCX (`src/services/leader_report.py`)
- Bulk CSV/XLSX import (`src/services/parser.py` + `src/api/routers/admin.py`) — **parity in** `bulk-import` + `_shared/students_roster.ts`
- Teacher PDF student list (`src/services/academusoft_pdf.py` + `src/api/routers/students.py`) — **parity in** `students-import` + `_shared/academusoft_pdf.ts`
- Habeas data query/suppression (`src/api/routers/admin.py`)

## When to use

| Use `src/` when… | Use `supabase/` + `frontend/` when… |
|------------------|-------------------------------------|
| Porting business logic to Edge Functions | Running or deploying the MVP |
| Running legacy pytest contract tests | Adding features to the active product |
| Understanding endpoint behavior from tests | Writing RLS policies or frontend JS |

## Running locally (optional)

```bash
docker compose up -d db
pip install --require-hashes -r requirements.txt
uvicorn src.api.main:app --reload
pytest tests/ -q
```

## Decommission plan

After Edge Functions + Playwright Supabase tests pass:

1. Tag release `legacy-fastapi-final`
2. Move `src/`, `alembic/`, `deploy.sh`, FastAPI tests to branch `legacy/fastapi`
3. Remove from `main` per `docs/MIGRATION_PLAN.md` §4

Do **not** delete until traceability matrix confirms parity with PRD F03, F07, F14, F15, habeas data.
