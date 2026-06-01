# RA Assessment App

Aplicacion web para reemplazar el flujo Excel/VBA de assessment de Resultados de Aprendizaje del programa Tecnologia en Gestion Administrativa.

## Stack previsto

- Backend: FastAPI
- Base de datos: PostgreSQL
- Frontend: HTML, CSS y JavaScript estatico
- Migraciones: Alembic
- Reportes: WeasyPrint, openpyxl y python-docx
- Seguridad: JWT en cookie httpOnly, RBAC, audit log, rate limiting, Bandit, pip-audit

## Estado actual

Este repositorio inicia en fase **S0 — Architecture & Continuity Spine**.

Antes de implementar features, revisar:

- `docs/PRD.md`
- `docs/llm_council_ra_assessment_resultado.md`
- `memory/PROJECT_STATE.md`
- `memory/NEXT_STEPS.md`
- `memory/DECISIONS.md`

## Desarrollo local con PostgreSQL

Para ejecutar los tests de integración contra PostgreSQL real (capa 2 del plan E2E):

```bash
# 1. Levantar PostgreSQL 16 con Docker
docker compose up -d db

# 2. Correr los tests PG opt-in
TEST_PG_URL=postgresql+asyncpg://ra:local_only@localhost:5432/ra_test \
  .venv/bin/python -m pytest tests/ -m pg -v

# 3. Bajar el contenedor al terminar
docker compose down
```

Requiere Docker Desktop o Docker Engine disponible. Esta base es solo para pruebas locales y debe tratarse como descartable; no usarla con datos reales.

Ver `docs/TEST_PLAN.md §11.2` para la lista completa de tests PG-01 a PG-05 y `memory/DECISIONS.md ADR-16` para la justificación de esta estrategia.

## Flujo de trabajo

1. Leer los archivos de `memory/`.
2. Elegir un slice pequeno.
3. Implementar con pruebas.
4. Ejecutar validaciones.
5. Actualizar documentacion y memoria.
6. Commit pequeno y revisable.
