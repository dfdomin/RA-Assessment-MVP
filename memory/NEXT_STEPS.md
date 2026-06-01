# NEXT_STEPS.md — RA Assessment App

**Última actualización**: 2026-05-27 (sesión 42 — INFRA-04 backup evidence prep)
**Sprint activo**: S5 — F15/F16 Carga Masiva Admin + Ports & Adapters + backups/infra prep (`S5-01` templates ✅; `S5-02` bulk import endpoints ✅; `S5-03` SyncService/file adapter ✅; `S5-04` backup script ✅; `S5-05` XLSX distribución ✅; `S5-06` runbook INFRA-01 ✅; INFRA-01 evidence template ✅; INFRA-02 Caddy template/evidence ✅; INFRA-03 fail2ban template/evidence ✅; INFRA-04 backup evidence template ✅)
**S1**: ✅ 38/38 tests | **S1.5**: ✅ 54/54 | **S2**: ✅ API + PG + FE + Playwright base | **S3**: ✅ S3-01 + S3-02 + S3-03 | **S4**: S4-01 ✅ + S4-02 ✅ + S4-03 ✅ + S4-04 ✅ + S4-05 ✅ + S4-06 ✅ + S4-07 ✅ | **S5**: S5-01 ✅ + S5-02 ✅ + S5-03 ✅ + S5-04 ✅ + S5-05 ✅ + S5-06 ✅ + INFRA-01/02/03/04 evidence templates ✅ → **201/201 tests locales + PG opt-in 5/5 passing contra PostgreSQL 16 real**

> Las tareas están ordenadas por prioridad y dependencia. Cada tarea es atómica (< 2 horas). Una tarea tiene criterio de done verificable antes de marcarla como completada.

---

## ✅ Completado en S0 (base técnica)

Los siguientes bloques de S1 ya están implementados:
- S1-01 a S1-05 (estructura, config, db/base) → `src/` completo
- S1-08 (security.py — JWT, bcrypt, JTI blocklist) → implementado
- S1-10 (deps.py — get_current_user, require_role) → implementado
- S1-11 (auth.py — login/logout con rate limit) → implementado
- S1-12 (main.py — FastAPI app) → implementado
- S1-02/03 (requirements.in, .env.example) → implementado
- S1-07 parcial (alembic configurado, migración 0001 para tablas base) → implementado
- S1-06 (modelos SQLAlchemy de negocio: SO, rúbricas, PIs, niveles, umbrales, módulos y asignaciones) → implementado
- S1-13 (schemas Pydantic de períodos) → implementado
- S1-14 (router de períodos GET/POST) → implementado
- S1-15 (schemas Pydantic de rúbricas con validator pesos) → implementado
- S1-16 (router de rúbricas GET/POST/clone) → implementado + registrado en main.py
- S1-17 (scripts/seed_admin.py CLI) → implementado
- S1-18 (deploy.sh con --require-hashes + bandit -ll -ii + orden correcto) → implementado
- S1-19 (test_security_core.py — U-S1-01/02/03) → implementado
- Tests de auth, seguridad, períodos, rúbricas, security core y module ownership → 38/38 passing
- Base S2 de ownership contextual → `verify_module_ownership()` implementado y probado para docente/líder asignado

**Nota**: `bcrypt` debe permanecer en `==4.0.1` — bcrypt 4.x+ es incompatible con passlib en Python 3.13.

---

## Sprint S1 — Auth + Períodos + Rúbricas (pendiente)

Las siguientes tareas completan S1. La base técnica está lista; ahora se construyen los dominios de negocio.

---

### Bloque completado: Modelos de Negocio S1

**TAREA S1-06**: ✅ Crear modelos SQLAlchemy para las tablas de negocio de S1

- **Descripción**: Añadir a `src/models/`: `StudentOutcome`, `Rubric`, `PerfIndicator`, `PILevel`, `LevelThreshold`, `Module`, `ModuleAssignment`. Referencia: `docs/DATA_MODEL.md §3.2–3.7`.
- **Criterio de done**: `from src.models import Rubric, Module` sin error; `alembic/env.py` carga `src.models` completo para autogenerate. Migración Alembic S1 pendiente; ejecutar `alembic revision --autogenerate -m "init"` con `docker compose up -d db` activo.
- **Dependencias**: base S0 completa
- **Verificación**: `.venv/bin/python -c "from src.models import Rubric, Module, StudentOutcome, Period; ..."` ✅; `.venv/bin/python -m pytest tests/` → 11/11 passing ✅

### Bloque 5: Router de Períodos

**TAREA S1-13**: ✅ Crear `src/api/schemas/periods.py` — Schemas Pydantic de períodos

- **Descripción**: `PeriodCreate` (name, student_outcome_id, start_date, end_date, clone_from_period_id opcional); `PeriodResponse` (id, name, status, módulos_total, módulos_completados).
- **Criterio de done**: `from src.api.schemas.periods import PeriodCreate` sin error de importación. Confirmado por importación indirecta desde tests de router.
- **Dependencias**: S1-01
- **Verificación**: `.venv/bin/python -m pytest tests/test_periods.py` → 5/5 passing ✅

---

**TAREA S1-14**: ✅ Crear `src/api/routers/periods.py` — GET y POST de períodos

- **Descripción**: `GET /periods` (retorna períodos filtrados por rol); `POST /periods` (rol Admin/Líder requerido, crea período, notifica docentes si hay módulos asignados).
- **Criterio de done**: Tests `I-S1-04`, `I-S1-05` del TEST_PLAN pasan.
- **Dependencias**: S1-10, S1-13
- **Implementado**: `GET /api/v1/periods` lista con conteos de módulos y filtrado docente por asignación; `POST /api/v1/periods` crea períodos con rol admin/líder, valida SO, duplicados y clonación opcional inicial.
- **Verificación**: `.venv/bin/python -m pytest tests/test_periods.py` → 5/5 passing ✅; `.venv/bin/python -m pytest tests/` → 16/16 passing ✅

---

### Bloque 6: Router de Rúbricas

**TAREA S1-15**: ✅ Crear `src/api/schemas/rubrics.py` — Schemas Pydantic de rúbricas con validator de pesos

- **Descripción**: `PIInput` (code, description, pi_weight, is_active, levels: List[LevelInput]); `RubricInput` con `@field_validator("perf_indicators")` que verifica suma de pesos activos = 100 (tolerancia ±0.01); `RubricResponse`.
- **Verificación**: Tests `U-S1-04`, `U-S1-05`, `U-S1-06`, `S-S1-05` passing ✅

---

**TAREA S1-16**: ✅ Crear `src/api/routers/rubrics.py` — GET, POST y clone de rúbricas

- **Descripción**: `GET /rubrics` (todos los roles); `POST /rubrics` (Admin/Líder, crea rúbrica con PIs y niveles); `POST /rubrics/{id}/clone` (Admin/Líder).
- **Nota**: Router registrado en `src/api/main.py`.
- **Verificación**: Tests `I-S1-06`, `I-S1-07` passing ✅; 24/24 tests ✅

---

### Bloque 7: Script de Seed y Script de Deploy

**TAREA S1-17**: ✅ Crear script de seed con usuario Admin inicial

- **Descripción**: `scripts/seed_admin.py` con argparse (--email, --password); idempotente (no corre si ya hay usuarios).
- **Verificación**: `python scripts/seed_admin.py --email admin@iub.edu.co --password changeme123` ✅

---

**TAREA S1-18**: ✅ `deploy.sh` — Pipeline de deploy con seguridad

- **Implementado**: orden pip-audit → bandit -ll -ii → pip --require-hashes → pytest → alembic → systemctl; `set -euo pipefail`; `requirements.txt` regenerado con pip-compile --generate-hashes.
- **Verificación**: `bandit -r src/ -ll -ii` → CLEAN; `pip install --require-hashes -r requirements.txt` → SUCCESS ✅

---

### Bloque 8: Tests de S1

**TAREA S1-19**: ✅ Tests del TEST_PLAN de S1

- **Implementado**: `tests/test_security_core.py` — U-S1-01/02/03 (encode_jwt, decode_jwt expirado, bcrypt hash/verify). Todos los tests previos de auth/períodos/rúbricas cubren I-S1-01 a I-S1-07, S-S1-01 a S-S1-05.
- **Verificación**: `pytest tests/` → **34/34 passing** antes de ownership contextual; suite actual 38/38 ✅

---

**TAREA S1-20**: Revisión de seguridad de S1 — human checkpoint

- **Descripción**: Revisar manualmente: (1) que `verify_module_ownership` esté en el plan para S2; (2) que las cookies emitidas sean httpOnly y Secure; (3) que el audit log escribe correctamente para `login_success` y `login_failed`; (4) que `deploy.sh` falla correctamente ante CVEs.
- **Avance 2026-05-16**: punto (1) confirmado y reforzado. Además, se implementó la base técnica de `verify_module_ownership()` para soportar líderes-evaluadores asignados por `module_staff`.
- **Criterio de done**: Lista de verificación firmada en `memory/HUMAN_REVIEW.md` con fecha.
- **Dependencias**: S1-19

---

## ✅ S1.5 — Fundación Multi-Programa (completado sesión 6)

Decisión humana: multi-programa es v1, no v2. El council fue revertido.

- `ProgramMembership` ORM + tabla `program_memberships` ✅
- `student_outcome.program_id NOT NULL` ✅
- `verify_program_access()` en deps.py (siempre 404, nunca 403) ✅
- `src/api/schemas/programs.py` — schemas Pydantic ✅
- `src/api/routers/programs.py` — 6 endpoints CRUD ✅
- `GET /periods` actualizado: líder filtra por membresía de programa ✅
- `POST /periods` actualizado: líder verifica acceso al SO del programa ✅
- `tests/test_programs.py` — 16 tests de control de acceso ✅
- **54/54 tests, 0 regresiones, bandit CLEAN** ✅

---

## ✅ F17 — Base Arquitectónica (completado sesión 5)

Las siguientes tareas del council 2026-05-16 están implementadas:

- **PRD v2.3**: §12 enmendado, F17 especificado completamente ✅
- **DATA_MODEL §3.23**: tabla `propedeutic_lines` documentada ✅
- **DATA_MODEL §3.24**: tabla `programs` documentada ✅
- **DATA_MODEL §3.2**: `student_outcomes.program_id FK` nullable documentada ✅
- **ROLE_PERMISSION_MATRIX §7**: acceso F17 Admin/Líder sin rol `dean` ✅
- **`src/models/program.py`**: ORM `PropedeuticLine`, `Program` ✅
- **`src/models/student_outcome.py`**: `program_id FK` nullable añadida ✅
- **`src/models/__init__.py`**: exports `PropedeuticLine`, `Program` ✅
- **`docs/IMPLEMENTATION_PLAN_F17.md`**: plan S7 completo con tasks, tests, prereqs ✅
- **38/38 tests passing** — 0 regresiones ✅

**Implementación de router F17 y migración**: Sprint S7 (post-despliegue TGA v1).  
Referencia: `docs/IMPLEMENTATION_PLAN_F17.md`.

---

## Sprint S2 — Nota de diseño aprobada antes de iniciar endpoints de módulos

**Regla aprobada**: un usuario con rol global `leader` puede actuar como evaluador de un módulo de su propio RA/SO o de otro RA/SO solo si está asignado explícitamente en `module_staff`. Para endpoints de escritura de módulo, `verify_module_ownership` aplica igual a `teacher` y `leader`; el rol `leader` no bypassa ownership.

**Base implementada**:
- `src/api/deps.py`: `verify_module_ownership(module_id, current_user, db)` retorna el módulo asignado o `404`.
- `tests/test_module_ownership.py`: 4/4 passing para líder asignado a RA propio, líder asignado a otro RA, líder no asignado y docente asignado.
- Verificación completa: `.venv/bin/python -m pytest tests/ -q` → 38/38; `.venv/bin/bandit -r src/ -ll -ii` → 0 medium/high.

**TAREA S2-01**: ✅ Crear `src/api/routers/modules.py` — listado de módulos por período

- **Verificación focalizada**: `.venv/bin/python -m pytest tests/test_modules.py -q` → 3/3 passing ✅

**TAREA S2-02**: ✅ Assessments, qualitative analysis, y submit

- **Implementado**:
  - `src/models/student.py` — `Student`, `ModuleStudent`
  - `src/models/assessment.py` — `Assessment`
  - `src/models/module_analysis.py` — `ModuleAnalysis`
  - `src/api/routers/assessments.py` — `GET/PUT /modules/{id}/assessments` con distribución y upsert
  - `src/api/routers/qualitative.py` — `GET/PUT /modules/{id}/qualitative` con `bleach.clean()`
  - `PUT /modules/{id}/submit` en `modules.py` — valida calificaciones + análisis (409 si falta)
  - `tests/test_assessments.py` (12 tests) + `tests/test_qualitative.py` (6 tests)
- **Criterio de done**: ownership protege escritura; bleach sanitiza texto; submit valida completitud con 409 específico.
- **Verificación**: `tests/` → **75/75 passing** ✅ · bandit → 0 medium/high ✅

**TAREA S2-03**: ✅ Importación de estudiantes (`POST /modules/{id}/students/import`)

- **Implementado**: parser defensivo CSV/XLSX (`openpyxl read_only=True, data_only=True`), límite 2 MB (413), máximo 100 estudiantes (422), bloqueo de fórmulas (`=`, `+`, `-`, `@`, `|`, `%`) por fila, `consent_acknowledged` vía Form (Ley 1581/2012), MIME type validation, upsert `Student` + `ModuleStudent`, `SecurityEvent("students_imported")`.
- **Verificación**: `tests/test_student_import.py` → 10/10 passing ✅ · suite completa 85/85 ✅ · bandit CLEAN ✅

**TAREA S2-04**: ✅ Listado de estudiantes del módulo (`GET /modules/{id}/students`)

- **Implementado**: `GET /api/v1/modules/{id}/students` en `src/api/routers/students.py`, con `ModuleStudentsResponse`, `ModuleStudentSummary` y `StudentAssessmentSummary`.
- **Comportamiento**: retorna estudiantes matriculados, estado (`active`/`excluded`), calificaciones por PI activo, `graded_pi_count`, `missing_pi_count`, `is_fully_graded`, totales `active_students`, `fully_graded_students` y `active_pi_count`.
- **Seguridad**: admin lee cualquier módulo; líder lee módulos de programas donde tiene `ProgramMembership`; docente requiere ownership por `module_staff` y recibe 404 si no está asignado.
- **Verificación focalizada**: `tests/test_students.py` → 2/2 passing ✅

**TAREA S2-05**: ✅ Calcular progreso real en listado de módulos (`GET /periods/{period_id}/modules`)

- **Implementado**: `students_active` se calcula desde `module_students.status="active"` y `students_graded` desde estudiantes activos con calificación para todos los PIs activos de la rúbrica vigente.
- **Verificación focalizada**: `tests/test_modules.py` → 3/3 passing ✅
- **Verificación completa**: `tests/` → 91/91 passing ✅
- **Verificación de seguridad**: `bandit -r src/ -ll -ii` → 0 medium/high ✅

**TAREA S2-FE-01**: ✅ Pantalla/frontend mínima que consume el listado de módulos con progreso real

- **Descripción**: convertir `frontend/dashboard.html` de stub post-login a dashboard funcional mínimo: cargar usuario, períodos y `GET /periods/{period_id}/modules`; mostrar docentes, estado, activos, calificados, pendientes y acción de calificar.
- **Implementado**: `frontend/dashboard.html` con selector de período, tabla y estados accesibles; `frontend/js/dashboard.js` con fetch autenticado (`credentials: "same-origin"`) y render de progreso real; `frontend/css/main.css` con layout de panel, tabla responsive, filtro y estados.
- **Verificación RED**: `tests/test_frontend_dashboard.py` falló primero por superficie/JS inexistentes ✅.
- **Verificación focalizada**: `.venv/bin/python -m pytest tests/test_frontend_dashboard.py -q` → 3/3 passing ✅.
- **Verificación completa**: `.venv/bin/python -m pytest tests/ -q` → 94 passed, 5 skipped ✅.
- **Verificación de seguridad**: `.venv/bin/bandit -r src/ -ll -ii` → 0 medium/high ✅.
- **Verificación sintáctica**: `node --check frontend/js/dashboard.js` → sin errores ✅.

**TAREA S2-FE-02**: ✅ Pantalla/frontend mínima de calificación de módulo

- **Descripción**: crear pantalla estática enlazada desde el dashboard para `module_id`, cargar estudiantes/calificaciones/análisis y permitir guardar `PUT /assessments`, guardar `PUT /qualitative` y enviar `PUT /submit`.
- **Implementado**: `frontend/assessment.html`, `frontend/js/module_assessment.js`, estilos de assessment en `frontend/css/main.css`, enlace `dashboard.js` → `/assessment.html?module_id={id}`.
- **Verificación RED**: `tests/test_frontend_assessment.py` falló primero por superficie/JS inexistentes y enlace antiguo ✅.
- **Verificación focalizada**: `.venv/bin/python -m pytest tests/test_frontend_assessment.py -q` → 4/4 passing ✅.
- **Verificación frontend**: `.venv/bin/python -m pytest tests/test_frontend_dashboard.py tests/test_frontend_assessment.py -q` → 7/7 passing ✅.
- **Verificación completa**: `.venv/bin/python -m pytest tests/ -q` → 98 passed, 5 skipped ✅.
- **Verificación de seguridad**: `.venv/bin/bandit -r src/ -ll -ii` → 0 medium/high ✅.
- **Verificación sintáctica**: `node --check frontend/js/dashboard.js` y `node --check frontend/js/module_assessment.js` → sin errores ✅.
- **Limitación**: QA visual Browser/Playwright no ejecutado; no hay herramienta Browser callable ni dependencias Playwright instaladas todavía.

**Siguiente**: continuar S5 con cierre operativo de infraestructura en el servidor Hetzner: INFRA-01/02/03/04 siguen pendientes de evidencia real; las plantillas y runbooks versionados ya preparan la captura de evidencia.

---

## Pruebas End-to-End (tres capas — ver `docs/TEST_PLAN.md §11` y `memory/DECISIONS.md ADR-15`)

### Capa 1 — Flujos API Encadenados (🔄 sin nueva infraestructura — implementar en S2)

**TAREA E2E-API-01**: ✅ Crear `tests/test_flow_submit.py` — flujos de submit encadenados

- **Descripción**: implementar los 4 flujos E2E de la capa 1 (`E2E-01` a `E2E-04`). Reutiliza pytest + httpx + SQLite `StaticPool`. No requiere cambios en `conftest.py` ni en `pyproject.toml`. Se integra automáticamente en `pytest tests/`.
- **Tests a implementar**:
  - `test_full_module_flow` — login → import CSV → PUT assessments (todos los PIs) → PUT qualitative (todos los PIs) → PUT submit → `{"status": "completed"}`
  - `test_leader_reads_completed_module` — (continúa del anterior) → login líder → GET assessments + GET qualitative → ambos `200` con datos reales
  - `test_submit_gates_in_sequence` — PUT submit sin calificaciones → `409 students_without_grades` → PUT assessments → PUT submit → `409 missing_qualitative_analysis` → PUT qualitative → PUT submit → `200`
  - `test_idempotent_import_then_grade` — import CSV × 2 (segundo → `skipped=N`) → GET assessments para obtener IDs reales → PUT assessments → PUT submit → `200`
- **Criterio de done**: `pytest tests/test_flow_submit.py -q` → 4/4 passing; suite completa sin regresiones; bandit CLEAN.
- **Verificación**: completado en sesión 11; suite completa actual 111/111 + 5 PG skipped ✅.
- **Dependencias**: S2-01 a S2-04 completados ✅

---

### Capa 2 — PostgreSQL Staging (🔄 activada por `TEST_PG_URL` — antes del primer deploy)

**TAREA E2E-PG-01**: ✅ Añadir fixture `pg_engine` y mark `pg` a `tests/conftest.py`

- **Descripción**: añadir fixture de sesión `pg_engine` que salta (`pytest.skip`) si `TEST_PG_URL` no está definida; añadir `@pytest.mark.pg` en los 5 tests PG-01–05 documentados en `TEST_PLAN.md §11.2`. En CI local: `docker compose up -d db && TEST_PG_URL=postgresql+asyncpg://ra:local_only@localhost:5432/ra_test pytest tests/ -m pg`.
- **Implementado**: `tests/conftest.py` tiene `pg_engine` + `pg_session`; `pyproject.toml` registra `pg`; `tests/test_postgres_staging.py` contiene PG-01 a PG-05.
- **Tests implementados**: PG-01 (JSON/JSONB round-trip) · PG-02 (ON CONFLICT upsert Assessment) · PG-03 (ON CONFLICT upsert ModuleAnalysis) · PG-04 (flujo E2E-01 vía endpoints con sesión PG) · PG-05 (NUMERIC serialization en `pi_weight`).
- **Verificación local sin PG**: `pytest tests/test_postgres_staging.py -q` → 5 skipped ✅; `pytest tests/ -q` → 91 passed, 5 skipped ✅; Bandit → 0 medium/high ✅.
- **Criterio de done**: `TEST_PG_URL=postgresql+asyncpg://ra:local_only@localhost:5432/ra_test pytest tests/test_postgres_staging.py -m pg -v` → 5/5 passing.
- **Dependencias**: `docker-compose.yml` ✅ (sesión 29) · E2E-API-01 completado ✅

**TAREA E2E-PG-02**: ✅ Ejecutar PG-01 a PG-05 contra PostgreSQL real

- **Descripción**: con PostgreSQL local levantado vía `docker compose up -d db` y `TEST_PG_URL` configurada, ejecutar la suite PG opt-in para confirmar JSON/JSONB, upsert PostgreSQL, flujo E2E vía endpoints y `NUMERIC(5,2)`.
- **Comando**: `docker compose up -d db && TEST_PG_URL=postgresql+asyncpg://ra:local_only@localhost:5432/ra_test .venv/bin/python -m pytest tests/test_postgres_staging.py -m pg -v`
- **Criterio de done**: 5/5 passing sin skips ✅.
- **Dependencias**: `docker-compose.yml` ✅ (sesión 29) · `TEST_PG_URL` en `.env.example` ✅ · Docker Desktop 4.73.0 / Docker 29.4.3 / Compose v5.1.3 instalados ✅ · `ra_postgres` saludable con `postgres:16-alpine` / PostgreSQL 16.14 ✅.
- **Implementado 2026-05-19 sesión 32**: `tests/conftest.py` ajustado para que `pg_engine` sea function-scoped y use `NullPool`; esto evita reutilización de conexiones asyncpg entre event loops de pytest-asyncio.
- **Verificación RED**: suite PG real fallaba con `1 passed, 4 errors` por `Future attached to a different loop` / `another operation is in progress`.
- **Verificación GREEN**: `TEST_PG_URL=postgresql+asyncpg://ra:local_only@localhost:5432/ra_test .venv/bin/python -m pytest tests/test_postgres_staging.py -m pg -q` → `5 passed`.
- **Verificación completa**: `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers .venv/bin/python -m pytest tests/ -q` → `174 passed, 5 skipped, 10 warnings`.
- **Nota de seguridad**: `TEST_PG_URL` debe apuntar a una base descartable/test-owned. No usar una base con datos reales ni una staging compartida sin estrategia explícita de reset.

---

### Capa 3 — Playwright Browser E2E (✅ frontend base S2 completada)

**TAREA E2E-PW-01**: ✅ Añadir `playwright` + `pytest-playwright` a `requirements.in` y crear `tests/e2e/`

- **Descripción**: añadir las dos dependencias a `requirements.in` (verificar con `pip-audit`); crear `tests/e2e/__init__.py` y `tests/e2e/conftest.py` con fixture `browser_context` que apunta a `BASE_URL = os.getenv("E2E_BASE_URL", "http://localhost:8000")`; instalar browsers con `playwright install chromium`.
- **Criterio de done**: `pytest tests/e2e/ --collect-only` muestra tests sin error de importación; `playwright install chromium` sin error en ARM64 (Hetzner).
- **Implementado**: `requirements.in` + `requirements.txt` con hashes; marker `e2e` en `pyproject.toml`; `tests/e2e/__init__.py`, `tests/e2e/conftest.py`, `tests/e2e/test_smoke.py`; `tests/test_e2e_scaffold.py`; Chromium instalado localmente en `.playwright-browsers` e ignorado en git.
- **Verificación RED**: `.venv/bin/python -m pytest tests/test_e2e_scaffold.py -q` → 4 fallos esperados ✅.
- **Verificación focalizada**: `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers .venv/bin/python -m pytest tests/test_e2e_scaffold.py tests/e2e/ -q` → 5/5 passing ✅.
- **Verificación collect-only**: `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers .venv/bin/python -m pytest tests/e2e/ --collect-only -q` → 1 test collected ✅.
- **Verificación completa**: `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers .venv/bin/python -m pytest tests/ -q` → 103 passed, 5 skipped ✅.
- **Verificación seguridad**: `bandit -r src/ -ll -ii` → 0 medium/high; `pip-audit -r requirements.txt --cache-dir .pip-audit-cache --disable-pip` → No known vulnerabilities found ✅.
- **Dependencias**: `playwright` compatible con ARM64 ✅ · servidor levantado en staging pendiente para E2E-PW-02

**TAREA E2E-PW-02**: ✅ Implementar `tests/e2e/test_auth_flow.py` — PW-01 a PW-03

- **Tests**: `test_pw01_login_success` (PW-01) · `test_pw02_login_wrong_password_inline_error` (PW-02) · `test_pw03_logout_revokes_session` (PW-03).
- **Implementado**: las 3 pruebas usan Playwright sync API vía fixture `browser_page` propio (evitando incompatibilidad `pytest-playwright` + `pytest-asyncio` 1.x). El fixture `e2e_server` (module scope) levanta la app en subprocess con SQLite temporal, seed de usuarios, y health polling. El frontend estático se sirve condicionalmente desde `main.py` (`APP_ENV` en `development`/`test_e2e`).
- **Criterio de done**: `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers pytest tests/e2e/ -v` → 4/4 passing (3 auth + 1 smoke); suite completa `pytest tests/ -q` → 107 passed, 5 skipped; Bandit → 0 medium/high; pip-audit → No known vulnerabilities found.
- **Dependencias**: E2E-PW-01 completado ✅ · Seed de admin y docente incluido en fixture ✅

**TAREA E2E-PW-03**: ✅ Implementar `tests/e2e/test_conformidad.py` — PW-04 a PW-05

- **Tests**: `test_dg_tsi_09_v4_colors_and_structure` (PW-04 — verifica paleta CSS, header/footer, sin scroll horizontal) · `test_teacher_dashboard_shows_modules` (PW-05 — tabla de módulos visible tras login docente).
- **Implementado**: `tests/e2e/test_conformidad.py` con PW-04/PW-05; `tests/e2e/conftest.py` ahora siembra línea propedéutica, programa, SO, período, módulo `Cálculo Diferencial` y asignación a `Docente Demo`; `frontend/js/dashboard.js` consume `ModuleResponse.group_name` y `ModuleResponse.teacher.full_name`.
- **Verificación RED**: `tests/test_e2e_scaffold.py` falló por archivo E2E inexistente; `tests/test_frontend_dashboard.py` falló por contrato frontend/backend incorrecto ✅.
- **Criterio de done**: `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers .venv/bin/python -m pytest tests/e2e/ -q` → 6/6 passing; suite completa → 111 passed, 5 skipped; Bandit → 0 medium/high.
- **Dependencias**: E2E-PW-02 completado ✅ · dashboard frontend implementado ✅

---

## Sprint S3 — Análisis, Wizard y Cierre

**TAREA S3-01**: ✅ Implementar cierre de período (`PUT /periods/{id}/close`)

- **Descripción**: cerrar período de captura con `force`, devolver lista de módulos pendientes si existen, registrar `period_closed` en `security_events`, y dejar escrituras de módulo en modo read-only cuando el período está cerrado.
- **Implementado**:
  - `src/api/schemas/periods.py` — `PeriodCloseRequest`, `PendingModule`, `PeriodCloseResponse`.
  - `src/api/routers/periods.py` — `PUT /api/v1/periods/{id}/close` con `409 modules_pending` si `force=false`.
  - `src/api/deps.py` — `ensure_module_period_open()`.
  - Guard de período cerrado en `PUT /modules/{id}/assessments`, `PUT /modules/{id}/qualitative`, `POST /modules/{id}/students/import` y `PUT /modules/{id}/submit`.
  - `tests/test_period_close.py` — 5 pruebas S3-01.
- **Verificación RED**: `tests/test_period_close.py` falló primero por endpoint inexistente y escritura permitida en período cerrado ✅.
- **Verificación focalizada**: `.venv/bin/python -m pytest tests/test_period_close.py tests/test_periods.py tests/test_assessments.py tests/test_qualitative.py tests/test_student_import.py tests/test_flow_submit.py -q` → 42/42 passing ✅.
- **Verificación completa**: `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers .venv/bin/python -m pytest tests/ -q` → 116 passed, 5 skipped ✅.
- **Verificación seguridad**: `.venv/bin/bandit -r src/ -ll -ii` → 0 medium/high ✅.
- **Dependencias**: S2 endpoints de módulo completados ✅.

**TAREA S3-02**: ✅ Crear/ajustar wizard frontend del flujo docente (F05)

- **Descripción**: convertir `assessment.html`/`module_assessment.js` en flujo wizard con pasos visibles: información general, estudiantes/calificaciones, distribución, análisis y confirmación/envío. El paso "Enviar" debe quedar deshabilitado hasta que calificaciones y análisis estén completos.
- **Implementado**:
  - `frontend/assessment.html` — wizard de 5 pasos con paneles `general`, `grading`, `distribution`, `analysis` y `submit`.
  - `frontend/js/module_assessment.js` — navegación de pasos, resumen del módulo, distribución por PI, checklist de preparación y bloqueo de submit hasta completitud.
  - `src/api/schemas/students.py` + `src/api/routers/students.py` — `active_perf_indicators` para renderizar PIs activos aunque no existan calificaciones previas.
  - `frontend/css/main.css` — estilos responsive para pasos, paneles, distribución y navegación.
  - `tests/test_frontend_assessment.py` — contrato estático ampliado de 4 a 5 pruebas.
  - `tests/test_students.py` — contrato API ampliado para metadatos de PIs activos.
  - `tests/e2e/test_assessment_wizard.py` — PW-06 flujo docente mínimo.
- **Criterio de done**: tests estáticos + Playwright mínimo del flujo docente; sin popups de nueva ventana; no pierde datos al navegar entre pasos porque los borradores ya persisten vía endpoints existentes. ✅
- **Verificación RED**: `tests/test_frontend_assessment.py` falló por wizard inexistente; `tests/e2e/test_assessment_wizard.py` falló por ausencia de `.wizard-steps` ✅
- **Verificación focalizada**: `.venv/bin/python -m pytest tests/test_frontend_assessment.py -q` → 5/5 passing; `.venv/bin/python -m pytest tests/test_students.py -q` → 3/3 passing; `node --check frontend/js/module_assessment.js` → sin errores; `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers .venv/bin/python -m pytest tests/e2e/test_assessment_wizard.py -q` → 1/1 passing ✅
- **Verificación frontend/E2E**: `.venv/bin/python -m pytest tests/test_students.py tests/test_frontend_dashboard.py tests/test_frontend_assessment.py -q` → 12/12 passing; `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers .venv/bin/python -m pytest tests/e2e/ -q` → 7/7 passing ✅
- **Verificación completa**: `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers .venv/bin/python -m pytest tests/ -q` → 119 passed, 5 skipped ✅
- **Dependencias**: S2-FE-02, S3-01.

**TAREA S3-03**: ✅ Reapertura administrativa de período y módulo (F06)

- **Implementado**:
  - `PUT /api/v1/periods/{id}/reopen` — solo Admin; reabre período cerrado a "open"; audita `period_reopened` en `security_events`.
  - `PUT /api/v1/modules/{id}/reopen` — Admin o Líder con membresía de programa; reabre módulo completado a "in_progress"; limpia `submitted_at`; audita `module_reopened`; leader sin membresía → 404 (IDOR); teacher → 403.
  - `PeriodReopenResponse` añadida a `src/api/schemas/periods.py`.
  - `tests/test_period_reopen.py` — 10 tests TDD.
- **Verificación**: `tests/test_period_reopen.py` → 10/10 passing ✅ · suite completa 129/129 ✅ · bandit → 0 medium/high ✅.
- **Dependencias**: S3-01 ✅.

---

## Sprint S4 — Reporte ABET + Plan de Acción + Dashboard Líder

**TAREA S4-01**: ✅ Análisis consolidado del líder por PI (`leader_analysis` table)

- **Implementado**:
  - `src/models/leader_analysis.py` — ORM `LeaderAnalysis` (period_id FK, perf_indicator_id FK, analysis_text TEXT, updated_at, updated_by FK); UQ (period_id, perf_indicator_id).
  - `src/api/schemas/leader_analysis.py` — `LeaderAnalysisInput` (validator 2000 chars), `LeaderAnalysisUpdate`, `LeaderAnalysisItem`, `LeaderAnalysisResponse`.
  - `src/api/routers/leader_analysis.py` — `GET /periods/{id}/leader-analysis` (admin/leader/teacher read-only) + `PUT /periods/{id}/leader-analysis` (admin/leader; teacher→403; líder sin membresía→404 IDOR; bleach.clean(); upsert; PI inválido→422; SecurityEvent `leader_analysis_saved`).
  - `tests/test_leader_analysis.py` — 10 tests TDD.
  - `tests/e2e/test_conformidad.py::test_pw05` — corregido timing issue (wait_for_selector genérico → wait_for contenido objetivo).
- **Verificación**: `tests/test_leader_analysis.py` → 10/10 ✅ · suite completa 139/139 ✅ · bandit → 0 medium/high ✅.
- **Dependencias**: S3 completado ✅.

**TAREA S4-02**: ✅ Registro del Plan de Acción por PI (`action_plans` table — F11)

- **Implementado**:
  - `src/models/action_plan.py` — ORM `ActionPlan` con UQ `(period_id, perf_indicator_id)`.
  - `src/api/schemas/action_plan.py` — validación de `action_type` (`corrective|preventive|improvement`), campos requeridos, límites de texto y respuesta por PI.
  - `src/api/routers/action_plans.py` — `GET /periods/{id}/action-plan` (admin/leader/teacher read-only) + `PUT /periods/{id}/action-plan` (admin/leader; teacher→403; líder sin membresía→404 IDOR; bleach.clean(); upsert; PI inválido→422; SecurityEvent `action_plan_saved`).
  - Sugerencia automática: mayoría Poor/Inadequate → `corrective`; mayoría Adequate → `preventive`; mayoría Exemplary → `improvement`; empates se resuelven conservadoramente hacia el nivel más bajo.
  - `tests/test_action_plan.py` — 9 tests TDD.
- **Verificación**: `tests/test_action_plan.py` → 9/9 ✅ · suite completa 148/148 ✅ · bandit → 0 medium/high ✅.
- **Dependencias**: S4-01 ✅.

**TAREA S4-03**: ✅ Generación del Reporte Final ABET (F07) — PDF + Excel

- **Descripción**: `GET /periods/{id}/report/preview` (JSON con las 4 secciones); `GET /periods/{id}/report/export?format=pdf` (WeasyPrint); `GET /periods/{id}/report/export?format=xlsx` (openpyxl con `safe_cell_value()` obligatorio en todas las celdas de usuario). Requiere `leader_analysis` y `action_plans` completos para todas las PIs activas. Secciones: encabezado, distribución, análisis del líder, plan de acción.
- **Implementado**:
  - `src/api/routers/reports.py` — `GET /periods/{id}/report/preview`, `GET /periods/{id}/report/export?format=pdf|xlsx` y aliases legacy `/report`, `/report/pdf`, `/report/xlsx`; roles admin/leader; teacher→403; líder sin membresía→404.
  - `src/services/report.py` — agregación de encabezado, módulos con estudiantes activos, distribución por PI, análisis docente/líder, plan de acción, export PDF y XLSX.
  - `src/services/sanitize.py` — `safe_cell_value()` contra prefijos `=`, `+`, `-`, `@`, `|`, `%`.
  - `requirements.in` + `requirements.txt` — `weasyprint==68.1` con hashes; el renderer usa WeasyPrint cuando las librerías nativas están disponibles y fallback PDF mínimo si falta `libgobject` local.
  - `tests/test_report.py` — 5 tests TDD para preview, permisos, prerequisitos, PDF/audit log y sanitización XLSX.
- **Verificación**: `tests/test_report.py` → 5/5 ✅ · S4 focalizado (`test_report`, `test_action_plan`, `test_leader_analysis`) → 24/24 ✅ · suite completa → 153/153 ✅ + 5 PG skipped · bandit → 0 medium/high ✅ · pip-audit → sin vulnerabilidades conocidas ✅.
- **Dependencias**: S4-01 ✅, S4-02 ✅.

**TAREA S4-04**: ✅ Dashboard del Líder (F08) — frontend

- **Descripción**: actualizar `frontend/dashboard.html` con vista específica para líder: barra de progreso de módulos completados, botones "Ver reporte" → preview F07, "Cerrar período", "Enviar recordatorio" (F13). Vista de análisis del líder por PI editable directamente desde el dashboard.
- **Implementado**:
  - `frontend/dashboard.html` — panel específico de líder con barra de progreso del período, acciones "Ver reporte", "Cerrar período", "Enviar recordatorio", preview de reporte y formulario de análisis por PI.
  - `frontend/js/dashboard.js` — detecta rol `leader`, carga módulos/progreso, consume `report/preview`, `action-plan` y `leader-analysis`, guarda análisis con `PUT /leader-analysis`, cierra período con `PUT /close` y deja recordatorio F13 como placeholder visible.
  - `frontend/css/main.css` — estilos responsive del panel líder, progreso y formulario de análisis.
  - `tests/e2e/conftest.py` — seed E2E con líder, membresía de programa, rúbrica y PI activa.
  - `tests/test_frontend_dashboard.py` — pruebas estáticas S4-04.
  - `tests/e2e/test_conformidad.py::test_pw07_leader_dashboard_shows_editable_analysis_by_pi` — líder ve y guarda análisis editable por PI.
- **Criterio de done**: pruebas estáticas HTML/JS y Playwright PW-07 (líder ve análisis editable por PI) ✅.
- **Verificación**: RED estático inicial → 2 fallos por superficie/calls inexistentes ✅ · `tests/test_frontend_dashboard.py tests/test_frontend_assessment.py` → 11/11 ✅ · `tests/e2e/test_conformidad.py` → 3/3 ✅ · suite completa → 156/156 ✅ + 5 PG skipped · bandit → 0 medium/high ✅ · `node --check frontend/js/dashboard.js` ✅.
- **Dependencias**: S4-01 ✅, S4-02 ✅, S4-03 ✅.

**TAREA S4-05**: ✅ Seguimiento y recordatorios a docentes pendientes (F13)

- **Descripción**: implementar tracking por período, previsualización y envío auditado de recordatorios desde el dashboard del líder, con control anti-spam y validación de destinatarios internos.
- **Implementado**:
  - `src/models/reminder.py` — `ReminderLog` con `period_id`, `sent_by`, `recipient_ids`, `message_body`, `sent_at`.
  - `src/api/schemas/notifications.py` — schemas de tracking, preview y envío.
  - `src/api/routers/notifications.py` — `GET /periods/{id}/tracking`, `GET /periods/{id}/reminders/preview`, `POST /periods/{id}/reminders`.
  - `src/services/email.py` — seam no-op para envío de recordatorios sin credenciales SMTP locales.
  - `frontend/js/dashboard.js` — botón "Enviar recordatorio" consume tracking, preview y reminders con feedback inline.
  - `tests/test_notifications.py` — 6 tests TDD; `tests/test_frontend_dashboard.py` ampliado a 7 tests.
- **Criterio de done**: roles Admin/Líder; Teacher → 403; líder sin membresía → 404; destinatarios fuera del período → 400; throttle 15 destinatarios/60s → 429; audit log `reminder_sent` sin emails; dashboard llama endpoints reales.
- **Verificación**: RED backend → 6 fallos por endpoints inexistentes ✅ · RED frontend → 1 fallo por placeholder ✅ · foco S4/F13 → 37/37 ✅ · suite completa → 163/163 ✅ + 5 PG skipped · bandit → 0 medium/high ✅ · `node --check frontend/js/dashboard.js` ✅.
- **Dependencias**: S4-04 ✅.

**TAREA S4-06**: ✅ Informe del Líder regenerable PDF/DOCX (F14)

- **Descripción**: implementar borrador editable de conclusiones por PI para el líder, preview con métricas consolidadas y exportación PDF/DOCX desde el dashboard.
- **Implementado**:
  - `src/models/leader_report.py` — `LeaderReportDraft` con UQ `(period_id, perf_indicator_id)`.
  - `src/api/schemas/leader_report.py` — schemas de conclusiones y respuesta del informe.
  - `src/api/routers/reports.py` — `GET/PUT /periods/{id}/leader-report`, `GET /leader-report/pdf`, `GET /leader-report/docx`.
  - `src/services/report.py` — agregación F14, render PDF y DOCX OOXML mínimo con `safe_cell_value()`.
  - `frontend/dashboard.html` + `frontend/js/dashboard.js` — formulario de conclusiones y botones PDF/DOCX.
  - `tests/test_report.py` ampliado a 10 tests; `tests/test_frontend_dashboard.py` ampliado a 9 tests.
- **Criterio de done**: Admin/Líder acceden; Teacher → 403; guardado sanitiza HTML; DOCX neutraliza texto tipo fórmula; exportaciones registran `leader_report_generated`.
- **Verificación**: RED backend → 5 fallos por endpoints F14 inexistentes ✅ · RED frontend → 2 fallos por superficie F14 ausente ✅ · foco S4/F14 → 38/38 ✅ · bandit → 0 medium/high ✅ · `node --check frontend/js/dashboard.js` ✅.
- **Dependencias**: S4-01 ✅, S4-02 ✅, S4-03 ✅, S4-04 ✅.

**TAREA S4-07**: ✅ Habeas Data y supresión de datos personales (Ley 1581/2012)

- **Descripción**: cerrar el gate de privacidad de S4 con endpoint de acceso del titular y endpoint de supresión por anonimización, preservando trazabilidad ABET.
- **Implementado**:
  - `src/api/routers/admin.py` — `GET /api/v1/admin/habeas-data/{doc_number}` y `PUT /api/v1/admin/suppress/{student_id}`.
  - `src/api/schemas/admin.py` — respuesta estructurada de titular, módulos, calificaciones y estudiante suprimido.
  - `src/api/main.py` — registro del router admin.
  - `tests/test_habeas_data.py` — 4 tests TDD.
- **Criterio de done**: solo Admin accede; Teacher → 403; `GET habeas-data` retorna datos del titular con módulos y calificaciones; `PUT suppress` anonimiza `full_name`, `document_number` e `is_suppressed` sin borrar assessments; audit log usa hash parcial y no guarda cédula completa.
- **Verificación**: RED → 4 fallos esperados por endpoints inexistentes ✅ · foco privacidad/estudiantes/auth → 26/26 ✅ · bandit → 0 medium/high ✅ · suite completa → 174 passed, 5 skipped, 10 warnings ✅.
- **Dependencias**: modelos `Student`, `ModuleStudent`, `Assessment`, `SecurityEvent` existentes ✅.

---

## Sprint S5 — F15 Carga Masiva Admin + Plantillas CSV

**TAREA S5-01**: ✅ Plantillas CSV descargables + endpoint de descarga admin

- **Descripción**: crear 4 archivos CSV de plantilla en `frontend/static/templates/` y exponer `GET /api/v1/admin/templates/{entity}` (roles: Admin) que los sirve con `Content-Disposition: attachment`.
- **Entidades y archivos**:
  - `rubrics` → `template_rubricas.csv` (SO_codigo, PI_codigo, descriptores x4, peso_pct)
  - `users` → `template_usuarios.csv` (nombre_completo, email_institucional, rol, programa)
  - `modules` → `template_modulos.csv` (period_id, curso_codigo, curso_nombre, grupo, docente_email)
  - `students` → `template_estudiantes.csv` (ID_interno, numero_documento, nombre_completo, modulo_id)
- **Seguridad**: solo Admin; entidad inválida → 404; Teacher → 403.
- **Implementado**:
  - `frontend/static/templates/template_rubricas.csv` ✅
  - `frontend/static/templates/template_usuarios.csv` ✅
  - `frontend/static/templates/template_modulos.csv` ✅
  - `frontend/static/templates/template_estudiantes.csv` ✅
  - `src/api/routers/admin.py` — `GET /api/v1/admin/templates/{entity}` ✅
  - `tests/test_admin_templates.py` — 6 tests TDD ✅
- **Verificación**: RED 5 fallos → GREEN 6/6 → suite completa 180/180 ✅ · bandit → 0 medium/high ✅.
- **Dependencias**: S4-07 ✅.

**TAREA S5-02**: ✅ Endpoints de carga masiva F15 (`POST /admin/bulk/{entity}`)

- **Descripción**: implementar los 4 endpoints de importación masiva Admin-only con parser defensivo (límite 2 MB, encoding UTF-8 estricto, regex por campo, bloqueo de prefijos de fórmula, `openpyxl read_only=True data_only=True`), procesamiento parcial, respuesta `207 Multi-Status` con `imported`, `failed`, `errors[]` por fila, y registro de SecurityEvent por entidad.
- **Endpoints**:
  - `POST /api/v1/admin/bulk/rubrics` — upsert por `SO_codigo+PI_codigo`; valida suma pesos = 100 por SO
  - `POST /api/v1/admin/bulk/users` — upsert por `email`; contraseña temporal; crea `ProgramMembership` si hay `programa`
  - `POST /api/v1/admin/bulk/modules` — upsert por `(period_id, curso_codigo, grupo)`; valida `docente_email` existe
  - `POST /api/v1/admin/bulk/students` — upsert por `document_number+module_id`; requiere `consent_acknowledged: true`
- **Seguridad**: Admin exclusivo; Teacher/Líder → 403.
- **SecurityEvents**: `bulk_import_rubrics`, `bulk_import_users`, `bulk_import_modules`, `bulk_import_students`.
- **Criterio de done**: `pytest tests/test_admin_bulk.py -q` → todos passing; suite completa sin regresiones; bandit CLEAN.
- **Implementado**:
  - `src/services/parser.py` — parser defensivo CSV/XLSX reutilizable con límite 2 MB, UTF-8 estricto, MIME CSV/XLSX, bloqueo de fórmulas, regex por campo y `openpyxl` en modo `read_only=True, data_only=True`.
  - `src/api/routers/admin.py` — `POST /api/v1/admin/bulk/{rubrics|users|modules|students}` con respuesta `207 Multi-Status`.
  - `tests/test_admin_bulk.py` — 7 tests TDD para Admin-only, consentimiento, errores parciales, upsert/creación de usuarios, módulos, estudiantes, rúbricas y eventos.
- **Verificación RED**: `tests/test_admin_bulk.py` falló 7/7 por endpoint inexistente ✅.
- **Verificación GREEN**: `tests/test_admin_bulk.py` → 7/7 ✅; foco `test_admin_bulk.py test_admin_templates.py test_student_import.py` → 23/23 ✅; suite completa → `187 passed, 5 skipped, 10 warnings` ✅; Bandit → 0 medium/high ✅.
- **Dependencias**: S5-01 ✅.

**TAREA S5-03**: ✅ F16 `SyncPayload`, `file_adapter.py`, `SyncService` y endpoints `/admin/sync/*`

- **Descripción**: implementar la rebanada S5 de F16 Ports & Adapters: contrato universal `SyncPayload`, adaptador CSV/XLSX que reutiliza el parser defensivo de F15, servicio `SyncService` con `preview/apply`, auditoría `sync_applied` + `oracle_sync_log`, y endpoints Admin `POST /admin/sync/preview`, `POST /admin/sync/apply`, `GET /admin/sync/log`.
- **Seguridad**: Admin exclusivo; `preview()` no persiste datos; `consent_acknowledged: true` se valida en `SyncService` para cualquier payload con estudiantes, de modo que ningún adaptador pueda bypassear Ley 1581/2012.
- **Implementado**:
  - `src/integration/contracts.py` — `SyncPayload`, `DocenteRecord`, `ModuloRecord`, `EstudianteRecord` ✅
  - `src/integration/adapters/file_adapter.py` — CSV/XLSX → `SyncPayload` reutilizando `parse_upload_rows()` ✅
  - `src/integration/sync_service.py` — `preview()` no mutante y `apply()` con upsert de docentes, módulos, asignaciones, estudiantes y matrículas ✅
  - `src/models/integration.py` — `OracleSyncLog` ✅
  - `src/api/routers/admin.py` — `POST /admin/sync/preview`, `POST /admin/sync/apply`, `GET /admin/sync/log` ✅
  - `src/integration/adapters/oracle_adapter.py` y `rest_adapter.py` — stubs documentados ✅
  - `tests/test_sync.py` — 5 tests TDD ✅
- **Verificación RED**: `tests/test_sync.py` falló por `ModuleNotFoundError: src.integration` ✅.
- **Verificación GREEN**: `tests/test_sync.py` → 5/5 ✅; foco S5/F16 (`test_sync.py test_admin_bulk.py test_admin_templates.py test_student_import.py`) → 28/28 ✅; suite completa → `192 passed, 5 skipped, 10 warnings` ✅; Bandit → 0 medium/high ✅.
- **Dependencias**: S5-02 ✅; Oracle real sigue bloqueado por PREREQ-01/02/03.

---

**TAREA S5-04**: ✅ Script versionado de backup GPG (`scripts/backup-ra.sh`) — subtask técnica de INFRA-04

- **Descripción**: crear un script defensivo para backups diarios de PostgreSQL cifrados antes de salir del servidor: `pg_dump` → `gzip` → `gpg --encrypt` → `rclone copy`.
- **Implementado**:
  - `scripts/backup-ra.sh` — `set -Eeuo pipefail`, validación de `DATABASE_URL`/`BACKUP_DATABASE_URL`, `BACKUP_GPG_RECIPIENT`, `BACKUP_RCLONE_REMOTE` y comandos requeridos.
  - Conversión de `postgresql+asyncpg://` a `postgresql://` para que `pg_dump` pueda usar la URL de la app sin duplicar secretos.
  - Limpieza automática del dump `.sql.gz` sin cifrar mediante trap de salida.
  - `.env.example`, `docs/PRD.md`, `docs/ARCHITECTURE.md` y `docs/SECURITY_PRIVACY.md` documentan `BACKUP_RCLONE_REMOTE`.
  - `tests/test_backup_script.py` — 2 tests TDD con binarios falsos de `pg_dump`, `gpg` y `rclone`.
- **Verificación RED**: `tests/test_backup_script.py` falló por `scripts/backup-ra.sh` inexistente ✅.
- **Verificación GREEN**: `tests/test_backup_script.py` → 2/2 ✅; `bash -n scripts/backup-ra.sh` → OK ✅; suite completa → `194 passed, 5 skipped, 10 warnings` ✅; Bandit → 0 medium/high ✅.
- **Pendiente operativo**: INFRA-04 completo requiere generar llave GPG offline, configurar rclone/R2, instalar cron y restaurar un backup de prueba en entorno aislado.
- **Dependencias**: PostgreSQL local/productivo configurado; `rclone` y `gpg` disponibles en servidor.

---

**TAREA S5-05**: ✅ Paridad XLSX de distribución del reporte final

- **Descripción**: ajustar la exportación `.xlsx` del reporte final para que la hoja `Distribucion` no sea solo conteos por módulo, sino una matriz compatible con el formato institucional: PI, descripción del PI, nivel, descriptor, módulo, porcentaje y conteo.
- **Implementado**:
  - `src/services/report.py` — `render_xlsx()` escribe filas por nivel para cada módulo y agrega `TOTAL CONSOLIDADO` con porcentajes ponderados y conteos por nivel.
  - `tests/test_report.py` — test TDD que verifica encabezado, descriptores de niveles, porcentajes por módulo y fila consolidada.
- **Seguridad**: se mantiene `_append_safe()`/`safe_cell_value()` en todas las celdas escritas al Excel.
- **Verificación RED**: `test_xlsx_export_includes_excel_parity_distribution_details` falló porque la hoja tenía formato simple `PI, Modulo, Poor...` ✅.
- **Verificación GREEN**: test nuevo + sanitización XLSX → 2/2 ✅; `tests/test_report.py` → 11/11 ✅; suite completa → `195 passed, 5 skipped, 10 warnings` ✅; Bandit → 0 medium/high ✅.
- **Dependencias**: S4-03 reporte final ✅.

---

**TAREA S5-06**: ✅ Runbook operativo para `INFRA-01` hardening del servidor

- **Descripción**: preparar la ejecución real de `INFRA-01` con un runbook versionado que indique comandos, rollback, evidencias y límites de seguridad para el servidor Hetzner.
- **Implementado**:
  - `docs/SERVER_OPERATIONS_RUNBOOK.md` — pasos para pre-chequeo, SSH solo con llaves, UFW 22/80/443, PostgreSQL loopback, unattended-upgrades, relación con fail2ban y formato de evidencia.
  - `docs/SECURITY_PRIVACY.md` — enlace desde §9.5 al runbook y advertencia de que `INFRA-01` requiere evidencia real del servidor.
  - `tests/test_server_operations_runbook.py` — 2 tests TDD que bloquean regresiones del runbook.
- **Criterio de done**: el runbook existe, contiene pasos verificables para `INFRA-01`, exige evidencia antes de marcar la tarea completa y advierte no pegar secretos.
- **Verificación RED**: `tests/test_server_operations_runbook.py` falló por runbook inexistente ✅.
- **Verificación GREEN**: `tests/test_server_operations_runbook.py` → 2/2 ✅; suite completa → `197 passed, 5 skipped, 10 warnings` ✅; Bandit → 0 medium/high ✅.
- **Nota importante**: `INFRA-01` como operación de servidor sigue pendiente. Esta tarea solo prepara la ejecución reproducible; no sustituye la evidencia real de Hetzner.
- **Dependencias**: decisiones previas de infraestructura + `docs/SECURITY_PRIVACY.md §9.5`.

---

**TAREA S5-07**: ✅ Plantillas operativas para `INFRA-03` fail2ban

- **Descripción**: preparar la ejecución real de `INFRA-03` con plantillas versionadas para el filtro/jail `ra-assessment`, runbook de instalación/validación y plantilla de evidencia.
- **Implementado**:
  - `docs/ops/fail2ban-ra-assessment-filter.conf` — filtro para eventos JSONL `login_failed` con campo `ip`.
  - `docs/ops/fail2ban-ra-assessment-jail.conf` — jail `ra-assessment` con `logpath = /var/log/ra-assessment/security.jsonl`, `maxretry = 5`, `findtime = 60`, `bantime = 3600` y `action = ufw[name=ra-assessment]`.
  - `docs/ops/INFRA_03_EVIDENCE_TEMPLATE.md` — evidencia para validación de filtro, estado del jail, prueba de ban, rollback y firmas.
  - `docs/SERVER_OPERATIONS_RUNBOOK.md` — sección `INFRA-03` con pre-chequeos, instalación, `fail2ban-regex`, `fail2ban-client status ra-assessment` y prueba controlada de 5 failed logins.
  - `docs/SECURITY_PRIVACY.md` — enlaces a las plantillas y advertencia de evidencia real.
  - `tests/test_server_operations_runbook.py` — prueba TDD de artefactos INFRA-03.
- **Criterio de done**: los artefactos versionados permiten copiar/validar el jail y capturar evidencia sin secretos antes de marcar `INFRA-03` como completo.
- **Verificación RED**: `tests/test_server_operations_runbook.py` falló por `docs/ops/fail2ban-ra-assessment-filter.conf` inexistente ✅.
- **Verificación GREEN**: `tests/test_server_operations_runbook.py` → 5/5 ✅; suite completa → `200 passed, 5 skipped, 10 warnings` ✅.
- **Nota importante**: `INFRA-03` como operación de servidor sigue pendiente. Esta tarea solo prepara la ejecución reproducible; no sustituye la evidencia real de Hetzner.
- **Dependencias**: audit log `login_failed` existente, UFW activo y `docs/SECURITY_PRIVACY.md §6.2/§9.5`.

---

**TAREA S5-08**: ✅ Plantilla operativa para `INFRA-04` backups GPG y restore drill

- **Descripción**: preparar la ejecución real de `INFRA-04` con una plantilla de evidencia y runbook para backups diarios cifrados, subida R2 por rclone y restauración en entorno aislado.
- **Implementado**:
  - `docs/ops/INFRA_04_EVIDENCE_TEMPLATE.md` — evidencia para GPG public key, rclone remote, cron, backup manual, limpieza de plaintext, restore drill, rollback y firmas.
  - `docs/SERVER_OPERATIONS_RUNBOOK.md` — sección `INFRA-04` con pre-chequeos, `BACKUP_GPG_RECIPIENT`, `BACKUP_RCLONE_REMOTE`, `gpg --list-keys`, `rclone lsd`, cron `0 2 * * *`, ejecución manual y restore drill con `gpg --decrypt`, `gunzip` y `psql`.
  - `docs/SECURITY_PRIVACY.md` — enlace a la plantilla de evidencia operativa.
  - `tests/test_server_operations_runbook.py` — prueba TDD de artefactos INFRA-04.
- **Criterio de done**: los artefactos versionados permiten configurar y evidenciar backup cifrado diario y restore drill sin pegar secretos antes de marcar `INFRA-04` como completo.
- **Verificación RED**: `tests/test_server_operations_runbook.py` falló por `docs/ops/INFRA_04_EVIDENCE_TEMPLATE.md` inexistente ✅.
- **Verificación GREEN**: `tests/test_server_operations_runbook.py` → 6/6 ✅; foco `tests/test_backup_script.py tests/test_server_operations_runbook.py` → 8/8 ✅; suite completa → `201 passed, 5 skipped, 10 warnings` ✅.
- **Nota importante**: `INFRA-04` como operación de servidor sigue pendiente. Esta tarea solo prepara la ejecución reproducible; no sustituye la evidencia real de Hetzner.
- **Dependencias**: `scripts/backup-ra.sh` ✅, GPG/rclone/cron disponibles en servidor y material de llave privada GPG offline.

---

## Tareas de Infraestructura (paralelas a S1, antes del primer deploy)

Estas tareas se realizan en el servidor Hetzner, no en el código. Pueden hacerse en paralelo al desarrollo de S1.

**TAREA INFRA-01**: Hardening del servidor Hetzner

- ✅ Runbook operativo versionado en `docs/SERVER_OPERATIONS_RUNBOOK.md` (preparación S5-06; no equivale a ejecución en servidor)
- ✅ Plantilla de evidencia versionada en `docs/ops/INFRA_01_EVIDENCE_TEMPLATE.md` (preparación; no equivale a ejecución en servidor)
- Deshabilitar `PasswordAuthentication` en SSH
- Configurar UFW: deny all + allow 22/80/443
- Verificar que PostgreSQL solo escucha en `localhost:5432`
- Instalar unattended-upgrades (solo security updates)
- **Criterio de done**: Checklist de hardening de `SECURITY_PRIVACY.md §9.5` completado al 100%

**TAREA INFRA-02**: Configurar Caddy 2 con TLS automático

- ✅ Plantilla Caddyfile versionada en `docs/ops/Caddyfile.ra-assessment` (preparación; no equivale a ejecución en servidor)
- ✅ Plantilla de evidencia versionada en `docs/ops/INFRA_02_EVIDENCE_TEMPLATE.md` (preparación; no equivale a ejecución en servidor)
- **Criterio de done**: `https://ra-assessment.iub.edu.co/health` retorna `{"status": "ok"}`

**TAREA INFRA-03**: Configurar fail2ban con el jail `ra-assessment`

- ✅ Plantilla de filtro versionada en `docs/ops/fail2ban-ra-assessment-filter.conf` (preparación; no equivale a ejecución en servidor)
- ✅ Plantilla de jail versionada en `docs/ops/fail2ban-ra-assessment-jail.conf` (preparación; no equivale a ejecución en servidor)
- ✅ Plantilla de evidencia versionada en `docs/ops/INFRA_03_EVIDENCE_TEMPLATE.md` (preparación; no equivale a ejecución en servidor)
- **Criterio de done**: `fail2ban-client status ra-assessment` muestra el jail activo; 5 logins fallidos desde una IP de prueba activa el ban

**TAREA INFRA-04**: Configurar backup GPG diario

- ✅ Script versionado `scripts/backup-ra.sh` implementado y probado sin tocar base/GPG real
- ✅ Plantilla de evidencia versionada en `docs/ops/INFRA_04_EVIDENCE_TEMPLATE.md` (preparación; no equivale a ejecución en servidor)
- Generar par de llaves GPG; almacenar llave privada offline
- Configurar `BACKUP_RCLONE_REMOTE` y credenciales rclone/R2 en el servidor
- Configurar cron con `scripts/backup-ra.sh`
- **Criterio de done**: Restaurar un backup de prueba exitosamente en entorno aislado

---

## Orden de Implementación Recomendado

```
S1-01 → S1-02 → S1-03
      ↓
S1-04 → S1-05 → S1-06 → S1-07
      ↓
S1-08 → S1-09 → S1-10
      ↓
S1-11 → S1-12
      ↓
S1-13 → S1-14
S1-15 → S1-16
      ↓
S1-17 → S1-18 → S1-19 → S1-20
```

Paralelo: INFRA-01 a INFRA-04 en el servidor Hetzner.

---

## Prerequisitos para S7 — oracle_adapter.py (F16)

Las siguientes tareas son **externas al codebase** y **bloquean el inicio de S7**. No bloquean S1–S6. Deben resolverse en paralelo al desarrollo, coordinando con las áreas correspondientes de la IUB.

---

**PREREQ-01**: Confirmación del schema Oracle de Academusoft por el DBA de la IUB

- **Descripción**: Obtener el schema de las tablas Oracle de Academusoft que contienen datos de docentes, módulos y estudiantes. Específicamente: nombre de tablas, nombres de columnas, tipos de datos, y clave de join entre docentes y módulos. Verificar si existe un campo equivalente a `pege_id` (ID del docente en Academusoft) para el mapeo a `users.pege_id`.
- **Criterio de done**: Documento con schema Oracle recibido del DBA; mapeo explícito de columnas Oracle → campos `SyncPayload` completado y revisado.
- **Responsable externo**: DBA o administrador de sistemas de la IUB
- **Impacto si no se cumple**: `oracle_adapter.py` no puede escribirse; solo el stub vacío existe.

---

**PREREQ-02**: Disponibilidad de entorno Oracle de prueba para CI

- **Descripción**: Obtener acceso a un entorno Oracle de prueba (staging de Academusoft o instancia Oracle separada con datos sintéticos) que permita ejecutar las pruebas de integración de `oracle_adapter.py` en CI sin afectar producción.
- **Criterio de done**: `oracle_adapter.py` puede conectarse al entorno de prueba desde el servidor de CI; las pruebas I-S7-01, I-S7-02 e I-S7-03 del TEST_PLAN.md pasan en CI automáticamente.
- **Responsable externo**: Administrador de TI / DBA de la IUB
- **Impacto si no se cumple**: Las pruebas de `oracle_adapter.py` solo pueden correr manualmente, no en CI; el gate de seguridad de S7 no puede ser automatizado.

---

**PREREQ-03**: Concepto jurídico de Ley 1581/2012 para extracción masiva directa desde Oracle

- **Descripción**: Obtener concepto escrito del área jurídica de la IUB que avale la conexión directa de la app al SIS Oracle para extracción automática de datos personales de estudiantes (cédulas, nombres). La extracción vía `file_adapter.py` (CSV manual) ya tiene su control en `consent_acknowledged`; la extracción automática vía `oracle_adapter.py` es un flujo diferente que requiere validación legal específica.
- **Criterio de done**: Concepto jurídico escrito recibido, archivado en carpeta del proyecto (fuera del repo), y revisado por el responsable del tratamiento de datos de la IUB.
- **Responsable externo**: Área jurídica de la IUB / responsable de privacidad
- **Impacto si no se cumple**: `oracle_adapter.py` no puede habilitarse en producción aunque el código esté completo; el modo degradado (disabled) permanece activo.
