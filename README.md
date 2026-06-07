# RA Assessment MVP

**MVP de la aplicación de assessment de Resultados de Aprendizaje (ABET) para IUB/Unibarranquilla.**

Este repositorio es la versión migrada a **Supabase + GitHub Pages** del proyecto original [RA-Assessment-App](https://github.com/dfdomin/RA-Assessment-App) (FastAPI + PostgreSQL + Hetzner).

## ¿Por qué este MVP?

El objetivo es probar que la aplicación funciona completamente sin necesidad de un servidor propio (Hetzner), usando:

- **Supabase** (free tier) como backend: base de datos PostgreSQL, autenticación, y Edge Functions
- **GitHub Pages** como hosting estático gratuito para el frontend HTML/CSS/JS

Si el MVP funciona, se puede decidir si mantener Supabase o migrar a Hetzner.

## Stack activo (MVP)

| Componente | Tecnología |
|------------|-----------|
| Frontend | HTML/CSS/JS vanilla + Supabase JS client (CDN) |
| Backend | Supabase PostgREST + Auth + Edge Functions (Deno) |
| Base de datos | PostgreSQL 15/17 (Supabase) con RLS |
| Auth | Supabase Auth (sesión en localStorage) |
| Hosting | GitHub Pages |
| Reportes / import / habeas | Edge Functions en `supabase/functions/` |

## Stack legacy (referencia)

La carpeta [`src/`](src/LEGACY.md) conserva la implementación FastAPI completa (201 tests, ~40 endpoints). **No es el stack activo.** Sirve como especificación ejecutable para portar lógica a Edge Functions.

## Estado (~60 % migrado)

| Bloque | Estado |
|--------|--------|
| A — Setup Supabase | Completado (9 migraciones SQL + RLS) |
| B — Auth y core | Completado (frontend JS reescrito) |
| C — CRUD módulos/calificaciones | Completado (wizard + dashboard) |
| D — Features de líder | Completado (análisis, recordatorios, cierre básico) |
| E — Reportes | En progreso (Edge Functions + wiring frontend) |
| F — Carga masiva y admin | En progreso (Edge Functions bulk-import + habeas-data) |
| G — Deploy y QA | En progreso (GitHub Actions + tests Supabase) |

Ver progreso detallado en [`docs/MIGRATION_PLAN.md`](docs/MIGRATION_PLAN.md) y tareas abiertas en [`memory/NEXT_STEPS.md`](memory/NEXT_STEPS.md).

## Estructura

```
frontend/              → HTML/CSS/JS (páginas estáticas, stack activo)
supabase/
  migrations/        → Schema SQL + RLS
  functions/           → Edge Functions (reportes, import, habeas)
src/                   → FastAPI legacy (referencia — ver src/LEGACY.md)
docs/                  → PRD, arquitectura, matriz de roles
tests/                 → pytest (legacy FastAPI + tests estáticos MVP)
tests/e2e/             → Playwright (adaptación Supabase en curso)
memory/                → Estado del proyecto para sesiones de IA
.github/workflows/     → Deploy GitHub Pages + CI
```

## Guía rápida

1. Leer [`docs/PRD.md`](docs/PRD.md) — fuente de verdad del producto
2. Leer [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — arquitectura MVP (Supabase) + referencia FastAPI
3. Leer [`docs/MIGRATION_PLAN.md`](docs/MIGRATION_PLAN.md) — plan de migración y tareas restantes
4. Revisar [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) y [`docs/ROLE_PERMISSION_MATRIX.md`](docs/ROLE_PERMISSION_MATRIX.md)

## Revisión visual automatizada (Playwright)

```bash
pip install playwright && playwright install chromium
python3 -m http.server 8765 &   # en otra terminal

# Vistas públicas (login)
python scripts/visual_review.py --base-url http://127.0.0.1:8765

# GitHub Pages desplegado
python scripts/visual_review.py --base-url https://dfdomin.github.io/RA-Assessment-MVP

# Con auth para dashboard + wizard
REVIEW_EMAIL=tu@iub.edu.co REVIEW_PASSWORD=*** \
  python scripts/visual_review.py --base-url https://dfdomin.github.io/RA-Assessment-MVP
```

Salida: `reviews/visual_<timestamp>/` (screenshots + `FINDINGS.md` + `report.json`).  
CI: workflow `.github/workflows/visual-review.yml` (manual + PRs que toquen `frontend/`).

## Desarrollo local

```bash
# Frontend estático (abrir en navegador o servidor local)
open frontend/index.html

# Edge Functions (requiere Supabase CLI)
supabase functions serve

# Tests estáticos del frontend MVP
pytest tests/test_frontend_dashboard.py tests/test_frontend_assessment.py -q

# Tests legacy FastAPI (referencia)
docker compose up -d db
pytest tests/ -q
```

## Repo original

El desarrollo completo (S0–S5, 201 tests, ~40 endpoints) está en:
https://github.com/dfdomin/RA-Assessment-App

---

**IUB / Unibarranquilla — Facultad de Ciencias Económicas y Administrativas**
