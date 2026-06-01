# PROJECT_STATE.md — RA Assessment App

**Última actualización**: 2026-05-27 (sesión 42 — INFRA-04 backup evidence prep)
**Sprint activo**: S5 — F15/F16 Carga Masiva Admin + Ports & Adapters + backups/infra prep (S1 + S1.5 + S2 + S3 + S4 completados; E2E-PG-02 ✅; S5-01 CSV templates ✅; S5-02 bulk imports ✅; S5-03 SyncService/file adapter ✅; S5-04 backup script ✅; S5-05 XLSX distribución ✅; S5-06 runbook INFRA-01 ✅; INFRA-01 evidence template ✅; INFRA-02 Caddy template/evidence ✅; INFRA-03 fail2ban template/evidence ✅; INFRA-04 backup evidence template ✅)
**S0**: ✅ | **S1**: ✅ 38 tests | **S1.5 multi-programa**: ✅ 54/54 tests | **S2**: ✅ S2-01 a S2-05 + FE + E2E API/PG/PW implementados | **S3**: ✅ S3-01 + S3-02 + S3-03 | **S4**: S4-01 ✅ + S4-02 ✅ + S4-03 ✅ + S4-04 ✅ + S4-05 ✅ + S4-06 ✅ + S4-07 ✅ | **S5**: S5-01 templates ✅ + S5-02 bulk imports ✅ + S5-03 F16 sync ✅ + S5-04 backup script ✅ + S5-05 XLSX distribución ✅ + S5-06 runbook INFRA-01 ✅ + INFRA-01/02/03/04 evidence templates ✅ | **201/201 tests locales + PG opt-in 5/5 passing contra PostgreSQL 16 real**

> Este archivo puede copiarse directamente al contexto de una nueva sesión de Claude o Codex para retomar el trabajo sin pérdida de contexto.

---

## 1. Qué Es Este Proyecto

La **RA Assessment App** reemplaza un flujo manual de Excel/VBA que los programas académicos de la Institución Universitaria de Barranquilla (IUB) usan para el assessment de Resultados de Aprendizaje (RA/SO) requeridos por ABET.

**Stack**: FastAPI (Python 3.12) + PostgreSQL 16 + HTML/JS estático (servido por Caddy en Hetzner)  
**Infraestructura**: Hetzner CAX11 ARM64 + Caddy 2  
**Referencia técnica principal**: `docs/PRD.md` (v2.3 — F17 + §12 enmendado)

---

## 2. Estado por Capa

| Capa | Estado | Detalle |
|---|---|---|
| **Documentación técnica** | ✅ Completada (S0 + S1 + F17) | 9 archivos en `/docs/` — incluye PRD v2.3, IMPLEMENTATION_PLAN_F17, council-transcript |
| **Memoria del proyecto** | ✅ Al día (sesión 42) | `PROJECT_STATE`, `NEXT_STEPS` y `SESSION_LOG` actualizados con INFRA-04 backup evidence prep |
| **Backend FastAPI** | ✅ Base S0 + períodos S1-14/S3-01 + rúbricas S1-16 + módulos S2-01 a S2-05 + S4 leader/action/report/notifications/leader-report/habeas-data + S5 admin bulk/sync | `src/api/main.py`, routers admin+auth+health+periods+rubrics+modules+assessments+qualitative+students+leader_analysis+action_plans+reports+notifications, deps, config, security, db/base, modelos, servicios de reporte/sanitización/email/parser e integración F16 |
| **Base de datos** | ✅ Modelos S1 + S1.5 multi-programa + S4 + F16; PostgreSQL local activo | Modelos: User, RevokedToken, SecurityEvent, Period, StudentOutcome (program_id NOT NULL), Rubric, PerfIndicator, PILevel, LevelThreshold, Module, ModuleAssignment, PropedeuticLine, Program, **ProgramMembership**, LeaderAnalysis, **ActionPlan**, **ReminderLog**, **LeaderReportDraft**, **OracleSyncLog**; Alembic 0001 pendiente staging; Docker Desktop 4.73.0 + Docker 29.4.3 + Compose v5.1.3 instalados; contenedor `ra_postgres` con imagen `postgres:16-alpine` y PostgreSQL `16.14` saludable en `localhost:5432` |
| **Autenticación** | ✅ Base S0 completa | JWT httpOnly cookie, JTI blocklist, bcrypt, require_role, rate limit 5/min |
| **Frontend** | ✅ Base S0 + dashboard S2-FE-01 + líder S4-04/S4-05/S4-06 + calificación S2-FE-02 + wizard S3-02 | index.html + dashboard.html con vista docente/líder, progreso de módulos, preview de reporte, cierre, envío real de recordatorios F13, análisis líder editable por PI e informe F14 PDF/DOCX + assessment.html con wizard de 5 pasos + css/main.css + js/auth.js + js/dashboard.js + js/module_assessment.js |
| **Tests** | ✅ 201/201 passing locales + PG opt-in 5/5 contra PostgreSQL real | + test_habeas_data (4) + test_period_close (5) + test_period_reopen (10) + test_assessments (12) + test_qualitative (6) + test_student_import (10) + test_students (3) + test_flow_submit (4 E2E API) + test_frontend_dashboard (9 estáticos) + test_frontend_assessment (5 estáticos) + test_e2e_scaffold (6 estáticos) + tests/e2e smoke (1) + test_auth_flow (3 browser E2E) + test_conformidad (3 browser E2E) + test_assessment_wizard (1 browser E2E) + test_leader_analysis (10) + test_action_plan (9) + test_report (11) + test_notifications (6) + test_postgres_staging (PG-01..PG-05 passing contra PostgreSQL 16 real) + test_admin_templates (6 S5-01) + test_admin_bulk (7 S5-02) + test_sync (5 S5-03/F16) + test_backup_script (2 S5-04/INFRA-04a) + test_server_operations_runbook (6 S5-06/INFRA-01/02/03/04 prep/evidence) |
| **CI/Deploy scripts** | ✅ S1-18 + S5-04 backup script | `deploy.sh`: pip-audit → bandit -ll -ii → pip --require-hashes → pytest → alembic → systemctl; `scripts/backup-ra.sh`: pg_dump → gzip → GPG encrypt → rclone copy |
| **Plantillas CSV + carga masiva** | ✅ S5-01 + S5-02 + S5-03 completados | 4 plantillas en `frontend/static/templates/`; `GET /api/v1/admin/templates/{entity}` Admin-only; `POST /api/v1/admin/bulk/{rubrics|users|modules|students}` con 207 Multi-Status; F16 `SyncPayload`, `file_adapter.py`, `SyncService` y `/admin/sync/*` |

---

## 3. Qué Existe en el Repositorio

```
docs/
  PRD.md                    ← PRD v2.3 — F17 + §12 enmendado (fuente de verdad del producto)
  ARCHITECTURE.md           ← ✅ Completado (incluye §9 Ports & Adapters)
  DATA_MODEL.md             ← ✅ Completado (incluye §3.23 propedeutic_lines, §3.24 programs, §3.2 program_id FK)
  API_CONTRACT.md           ← ✅ Completado (incluye §13 Grupo SYNC)
  SECURITY_PRIVACY.md       ← ✅ Completado (incluye §7.5 consent_acknowledged)
  ROLE_PERMISSION_MATRIX.md ← ✅ Completado (incluye §7 F17 — sin rol dean en v1)
  IMPLEMENTATION_PLAN_F17.md ← ✅ Nuevo — plan completo S7 (migración, seed, router, tests)
  council-transcript-20260516-083133.md ← ✅ Nuevo — LLM Council sobre Dean/Líneas Propedéuticas
  TRACEABILITY_MATRIX.md    ← ✅ Completado (incluye F16)
  TEST_PLAN.md              ← ✅ Completado (incluye §3.4 SyncService, §8 oracle_adapter)

memory/
  PROJECT_STATE.md          ← Este archivo ✅
  NEXT_STEPS.md             ← ✅ Con tareas S1 y prerequisitos S7
  DECISIONS.md              ← ✅ Con ADR-13 Ports & Adapters + ADR-14 líderes-evaluadores

src/                        ← ✅ Base S0 completa
  __init__.py
  api/
    __init__.py
    main.py                 ← FastAPI app factory (lifespan, CORS, slowapi, logging)
    deps.py                 ← get_db, get_current_user, require_role, verify_module_ownership, ensure_module_period_open
    routers/
      __init__.py
      admin.py              ← GET /api/v1/admin/habeas-data/{doc} + PUT /api/v1/admin/suppress/{student_id} + templates/bulk F15
      auth.py               ← POST /api/v1/auth/login, POST /api/v1/auth/logout
      health.py             ← GET /health, GET /api/v1/me
      periods.py            ← GET/POST /api/v1/periods con filtrado por rol
      rubrics.py            ← GET/POST /api/v1/rubrics; POST /api/v1/rubrics/{id}/clone
      modules.py            ← GET /api/v1/periods/{period_id}/modules + PUT /modules/{id}/submit
      assessments.py        ← GET/PUT /api/v1/modules/{id}/assessments
      qualitative.py        ← GET/PUT /api/v1/modules/{id}/qualitative (bleach.clean)
      students.py           ← GET /api/v1/modules/{id}/students + POST /api/v1/modules/{id}/students/import
      action_plans.py       ← GET/PUT /api/v1/periods/{id}/action-plan
      reports.py            ← GET /periods/{id}/report/preview + export PDF/XLSX + leader-report F14 PDF/DOCX
      notifications.py      ← GET tracking, GET preview y POST reminders F13
    schemas/
      admin.py              ← HabeasDataResponse + SuppressedStudentResponse
      periods.py            ← PeriodCreate, PeriodCreated, PeriodResponse, PeriodCloseRequest/Response
      rubrics.py            ← PIInput, RubricInput (validator pesos), RubricResponse, CloneRubricRequest/Response
      modules.py            ← ModuleResponse + ModuleTeacher
      assessments.py        ← AssessmentInput, AssessmentsUpdate, StudentResult, AssessmentsResponse
      qualitative.py        ← AnalysisInput, QualitativeUpdate, AnalysisItem, QualitativeResponse
      students.py           ← StudentImportRow, StudentImportResponse, ModuleStudentsResponse
      leader_report.py      ← LeaderReportUpdate/Response para conclusiones F14
  core/
    __init__.py
    config.py               ← Settings (pydantic-settings)
    security.py             ← hash_password, verify_password, encode_jwt, decode_jwt
  db/
    __init__.py
    base.py                 ← Base, engine, async_session_factory
    seed.py                 ← Script de seed: admin, lider, docente
  models/
    __init__.py
    user.py                 ← User (incluye pege_id, microsoft_oid)
    security.py             ← RevokedToken, SecurityEvent
    period.py               ← Period alineado con DATA_MODEL §3.3
    student_outcome.py      ← StudentOutcome (+ program_id FK nullable v2)
    rubric.py               ← Rubric, PerfIndicator, PILevel, LevelThreshold
    module.py               ← Module, ModuleAssignment (tabla module_staff)
    program.py              ← PropedeuticLine, Program, ProgramMembership
    student.py              ← Student, ModuleStudent (tabla module_students)
    assessment.py           ← Assessment (calificación por module_student + PI)
    module_analysis.py      ← ModuleAnalysis (análisis cualitativo por módulo + PI)
    action_plan.py          ← ActionPlan (plan de acción por período + PI)
    reminder.py             ← ReminderLog (historial de recordatorios F13)
    leader_report.py        ← LeaderReportDraft (conclusiones regenerables F14)
    integration.py          ← OracleSyncLog (auditoría F16 sync)
  integration/
    contracts.py            ← SyncPayload + Docente/Modulo/EstudianteRecord (F16)
    sync_service.py         ← SyncService preview/apply con consentimiento Ley 1581
    adapters/
      file_adapter.py       ← CSV/XLSX → SyncPayload, reutiliza parser F15
      oracle_adapter.py     ← stub documentado hasta PREREQ-01/02/03
      rest_adapter.py       ← template futuro para SIS REST
  services/
    sanitize.py             ← safe_cell_value() contra Excel/CSV injection
    report.py               ← agregación F07/F14 + render PDF/XLSX/DOCX
    email.py                ← seam SMTP/no-op para recordatorios F13
    parser.py               ← parser defensivo CSV/XLSX reutilizable para carga masiva F15

alembic/                    ← ✅ Base S0 completa
  env.py                    ← Async env.py con create_async_engine
  script.py.mako
  versions/
    0001_initial_schema.py  ← users, revoked_tokens, security_events (JSONB), periods

frontend/                   ← ✅ Base S0 + dashboard S2-FE-01/S4-04 + pantalla de calificación S2-FE-02 (IUB DG-TSI-09-V4)
  index.html                ← Login page: form semántico, sin popups
  dashboard.html            ← Dashboard con selector de período, tabla de módulos, panel líder, progreso, reporte, cierre, recordatorio y análisis por PI
  assessment.html           ← Wizard de calificación por módulo con información, calificaciones, distribución, análisis y submit
  css/main.css              ← Variables #1E2843/#FFDF2D, Open Sans, header/main/footer
  js/auth.js                ← fetch POST /auth/login, inline error, redirect
  js/dashboard.js           ← dashboard docente/líder, progreso real, recordatorios e informe F14
  js/module_assessment.js   ← wizard F05; fetch /students, /assessments, /qualitative; PUT assessments/qualitative/submit

tests/                      ← ✅ 201/201 passing locales + 5/5 PG opt-in passing con PostgreSQL real
  __init__.py
  conftest.py               ← SQLite StaticPool, async_client, limiter reset autouse, PG opt-in con NullPool por test
  test_health.py            ← GET /health → 200, GET /api/v1/me → 401
  test_auth.py              ← login, wrong pw, unknown email, 429 en 6to intento, logout+blocklist, JTI revocado
  test_security_model.py    ← SecurityEvent insert, RevokedToken insert/query/absent
  test_periods.py           ← GET/POST periods, conteos de modulos, filtrado docente, 403 docente
  test_period_close.py      ← S3-01: PUT /periods/{id}/close, force, audit log, read-only guard
  test_period_reopen.py     ← S3-03: PUT /periods/{id}/reopen (admin only), PUT /modules/{id}/reopen (admin/leader)
  test_rubrics.py           ← U-S1-04/05/06 (Pydantic weights), I-S1-06/07 (422/201), S-S1-05 (bypass bloqueado), 403 docente
  test_security_core.py     ← U-S1-01 (encode_jwt fields), U-S1-02 (expired token), U-S1-03 (bcrypt hash/verify)
  test_module_ownership.py  ← verify_module_ownership para docente y líder-evaluador asignado/no asignado
  test_modules.py           ← S2-01/S2-05: listado de módulos por período para admin/líder/docente + progreso real
  test_student_import.py    ← S2-03: CSV/XLSX import, consent gate, 413, MIME, formula injection, upsert
  test_action_plan.py       ← S4-02: plan de acción por PI con sugerencia automática y audit log
  test_notifications.py     ← S4-05/F13: tracking, preview, recordatorios, throttle y audit log
  test_students.py          ← S2-04: listado de estudiantes con progreso de calificación y ownership
  test_habeas_data.py       ← S4-07: habeas data, supresión y audit log sin cédula completa
  test_frontend_dashboard.py ← S2-FE-01/S4: contrato estático del dashboard de módulos/progreso/líder/F14 + contrato ModuleResponse
  test_report.py            ← S4-03/S4-06/S5-05: reporte ABET PDF/XLSX con distribución detallada + informe líder PDF/DOCX
  test_frontend_assessment.py ← S2-FE-02/S3-02: contrato estático de pantalla de calificación/análisis/submit + wizard
  test_e2e_scaffold.py     ← E2E-PW-01/02/03: contrato estático de dependencias, marcador y tests Playwright
  test_sync.py             ← S5-03/F16: SyncPayload, file_adapter, SyncService y /admin/sync/*
  test_backup_script.py    ← S5-04/INFRA-04a: script de backup GPG con binarios falsos
  test_server_operations_runbook.py ← S5-06/INFRA-01/02/03/04 prep: runbook de hardening/Caddy/fail2ban/backups, evidencia requerida y plantillas de evidencia
  e2e/
    __init__.py
    conftest.py            ← e2e_server SQLite temporal + browser_page Playwright sync API
    test_smoke.py          ← smoke colectable marcado e2e
    test_auth_flow.py      ← PW-01 a PW-03: login, error inline, logout
    test_conformidad.py    ← PW-04 a PW-05: DG-TSI-09-V4 y dashboard docente
    test_assessment_wizard.py ← PW-06: wizard docente y submit bloqueado hasta completar
  test_postgres_staging.py  ← E2E-PG-01/02: 5 tests PostgreSQL opt-in via TEST_PG_URL, passing contra PostgreSQL 16 real

scripts/
  seed_admin.py             ← CLI: --email, --password; crea admin solo si tabla users está vacía

alembic.ini                 ← ✅
requirements.in             ← ✅ (incluye bcrypt==4.0.1 pin + playwright + pytest-playwright)
requirements.txt            ← ✅ Generado con pip-compile --generate-hashes (hashes SHA-256 por paquete)
pyproject.toml              ← ✅ asyncio_mode=auto, markers pg/e2e, bandit config
.env.example                ← ✅ Todas las variables documentadas
deploy.sh                   ← ✅ pip-audit → bandit → pytest → alembic → systemctl
```

---

## 4. Decisiones Tomadas

| Decisión | Fecha | Detalle |
|---|---|---|
| Stack técnico | 2026-05-15 | FastAPI + SQLAlchemy async + PostgreSQL 16 + HTML/JS estático |
| Infraestructura | 2026-05-15 | Hetzner CAX11 ARM64 + Caddy 2 + Cloudflare R2 |
| PDF generation | 2026-05-15 | WeasyPrint (no LibreOffice) |
| DOCX generation | 2026-05-18 | F14 implementado como paquete OOXML mínimo con stdlib `zipfile` y `safe_cell_value()`; `python-docx` queda como dependencia opcional/documental si se decide migrar el renderer |
| Autenticación | 2026-05-15 | JWT en cookie httpOnly, 8 h, JTI blocklist |
| Sanitización | 2026-05-15 | bleach.clean() para campos de texto; safe_cell_value() para exportaciones |
| Excel parsing | 2026-05-15 | openpyxl con read_only=True, data_only=True |
| Supresión de datos | 2026-05-15 | Anonimización (no eliminación física) — Ley 1581/2012 |
| Estructura de repo | 2026-05-15 | `src/api/`, `src/core/`, `src/db/`, `src/services/` |
| Método de desarrollo | 2026-05-15 | Phased AI-assisted: vertical slices con tests y human review |
| Líderes como evaluadores | 2026-05-16 | Permitidos si están asignados en `module_staff`; `leader` no bypassa `verify_module_ownership` |
| Rol dean — F17 | 2026-05-16 | No existe rol `dean` en v1; resumen institucional generado por Admin/Líder como PDF exportable. Decisión: LLM Council 2026-05-16 |
| Jerarquía propedéutica | 2026-05-16 | Modelada en `propedeutic_lines` + `programs` desde v1 (sin migración hasta staging); UI multi-programa en v2 post-despliegue TGA |

Ver `memory/DECISIONS.md` para el registro completo con contexto y alternativas evaluadas.

---

## 5. Sprints

| Sprint | Estado | Features | Gate de seguridad |
|---|---|---|---|
| **S0** | ✅ Completo | Documentación + base técnica (FastAPI, modelos, auth, frontend, tests) | Bandit 0 medium/high · 11/11 tests ✅ |
| **S1** | ⬜ En progreso | F10 Auth + F09 Períodos + F01 Rúbricas; completados S1-06/13/14/15/16/17/18/19; pendiente S1-20 (human checkpoint) | require_role + JWT blocklist + rate limiting |
| **S2** | ✅ Completo | F02 Info Módulo + F03 Calificaciones + Pantalla 3b; S2-01 a S2-05 + S2-FE-01 + S2-FE-02 + E2E-API-01 + E2E-PG-01 + E2E-PG-02 + E2E-PW-01 + E2E-PW-02 + E2E-PW-03 implementados | verify_module_ownership + bleach + parser defensivo + PG opt-in + Playwright auth/conformidad + DG-TSI-09-V4 |
| **S3** | ✅ Completo | F04 Análisis + F04b Distribución + F05 Wizard + F06 Cierre; S3-01 + S3-02 + S3-03 implementados | security_events + fail2ban + UFW |
| **S4** | ⬜ En progreso | F07 Reporte + F11 Plan de Acción + F08 Dashboard + F13 + F14 + habeas data; S4-01 leader_analysis + S4-02 action_plans + S4-03 report export + S4-04 leader dashboard + S4-05 reminders/tracking + S4-06 leader report + S4-07 privacy gate implementados | safe_cell_value + habeas data + throttle F13 + leader_report_generated |
| **S5** | ⬜ En progreso | F03 import CSV + F15 Carga masiva (S5-01/S5-02 ✅) + F16 file_adapter/SyncService (S5-03 ✅) + backup script GPG (S5-04 ✅) + Excel export completo (S5-05 ✅) + runbook INFRA-01 (S5-06 ✅) | Parser defensivo + Bandit + SyncPayload consent gate + backups GPG + evidencia operativa |
| **S6** | ⬜ Pendiente | F12 Microsoft OIDC (nice-to-have) | Validación criptográfica id_token |

---

## 6. Bloqueantes Conocidos

| Bloqueante | Impacto | Resolución pendiente |
|---|---|---|
| `MICROSOFT_CLIENT_ID`/`TENANT_ID`/`SECRET` no configurados | F12 no disponible | Coordinar con administrador Microsoft de la IUB; no bloqueante para S1–S5 |
| Llave GPG/cron/restore de backups no configurados en servidor | Script versionado existe, pero el backup productivo requiere material GPG offline, rclone remoto y prueba de restauración | Generar par de llaves GPG, configurar `BACKUP_RCLONE_REMOTE`, instalar cron y restaurar backup de prueba antes de producción |
| Plantilla HTML del reporte ABET no revisada con el líder del programa | El reporte PDF podría no ser aceptado por ABET | Reunión de revisión antes de S4 |
| Oracle schema de Academusoft no confirmado (PREREQ-01) | oracle_adapter.py no puede escribirse | Coordinar con DBA — no bloqueante hasta S7 |

---

## 7. Métricas de Progreso

| Métrica | Estado actual | Meta |
|---|---|---|
| Features documentadas (F01–F15) | 15/15 (100%) | 15/15 |
| Features implementadas | F10 base (auth) parcial; F09 periods API base; F01 base de datos S1-06 preparada | 15/15 antes de producción |
| Endpoints documentados | 40+ (100% del PRD §8) | 100% |
| Tablas DB documentadas | 21/21 (100%) | 21/21 |
| Pruebas de seguridad por sprint | 5–6 por sprint (documentadas) | ≥1 por sprint (implementadas) |
| Conformidad IUB DG-TSI-09-V4 | Automatizable cubierto por E2E-PW-03; revisión humana pendiente | 100% antes de deploy a producción |

---

## 8. Contexto Técnico Rápido

Para un agente de IA que retoma el trabajo:

1. **La fuente de verdad del producto es `docs/PRD.md` (v2.2)** — leerlo antes de implementar cualquier feature.
2. **La estructura objetivo del repo es `src/api/`, `src/core/`, `src/db/`, `src/services/`** — el directorio `backend/` actual debe renombrarse.
3. **Cada endpoint de evaluador que toca un módulo necesita `verify_module_ownership`** — aplica a `teacher` y a `leader` asignado en `module_staff`; ver `docs/ROLE_PERMISSION_MATRIX.md §5`.
4. **El error de IDOR es siempre 404, nunca 403** — intencionalmente ambiguo.
5. **La suma de pesos de PIs = 100% se valida en Pydantic, no solo en frontend** — ver `docs/SECURITY_PRIVACY.md §3.2`.
6. **`bleach.clean()` antes de persistir cualquier campo de texto libre**.
7. **`safe_cell_value()` en todas las celdas con datos de usuarios en exportaciones XLSX/DOCX**.
8. **`consent_acknowledged: true` requerido en `POST /admin/bulk/students` y en `SyncPayload` con estudiantes** — Ley 1581/2012.
9. **F16 ya tiene puerto app-agnostic (`SyncService`)** — Oracle sigue diferido; los adaptadores deben producir `SyncPayload` y no escribir directamente en DB.
10. **S5-04 ya tiene script de backup cifrado** — `scripts/backup-ra.sh` exige `DATABASE_URL`/`BACKUP_DATABASE_URL`, `BACKUP_GPG_RECIPIENT`, `BACKUP_RCLONE_REMOTE`, `pg_dump`, `gpg`, `gzip` y `rclone`; todavía falta ejecutar cron/restauración en servidor real.
11. **S5-05 refuerza la paridad XLSX** — `render_xlsx()` escribe la distribución por PI/nivel con descriptor, porcentaje, conteo y `TOTAL CONSOLIDADO`; mantener `safe_cell_value()` para toda celda.
12. **S5-06 prepara INFRA-01 sin marcarla como ejecutada** — `docs/SERVER_OPERATIONS_RUNBOOK.md` define comandos, rollback y evidencia para hardening Hetzner; INFRA-01 solo se completa con ejecución y evidencia real del servidor.
13. **INFRA-01 ya tiene plantilla de evidencia versionada** — `docs/ops/INFRA_01_EVIDENCE_TEMPLATE.md` separa identidad del servidor, SSH, UFW, PostgreSQL loopback, unattended-upgrades, rollback y firmas sin pegar secretos.
14. **INFRA-02 ya tiene Caddyfile y plantilla de evidencia versionados** — `docs/ops/Caddyfile.ra-assessment` enruta `/health` y `/api/*` a Uvicorn y sirve el frontend desde `/var/www/ra-assessment/frontend`; `docs/ops/INFRA_02_EVIDENCE_TEMPLATE.md` captura TLS, smoke tests, rollback y firmas.
15. **INFRA-03 ya tiene plantillas fail2ban y evidencia versionadas** — `docs/ops/fail2ban-ra-assessment-filter.conf`, `docs/ops/fail2ban-ra-assessment-jail.conf` y `docs/ops/INFRA_03_EVIDENCE_TEMPLATE.md` preparan el jail `ra-assessment` para `login_failed` sin cerrar la tarea real del servidor.
16. **INFRA-04 ya tiene plantilla de evidencia y runbook de restore drill** — `docs/ops/INFRA_04_EVIDENCE_TEMPLATE.md` registra GPG publico, rclone/R2, cron, backup manual, limpieza de plaintext y restauracion aislada; `INFRA-04` real sigue pendiente hasta evidencia en Hetzner.

---

## 9. Último Trabajo Implementado

### 2026-05-27 (sesión 42) — INFRA-04 backup evidence prep

- Se añadió `docs/ops/INFRA_04_EVIDENCE_TEMPLATE.md` para registrar GPG public key, rclone remote, cron, backup manual, limpieza de plaintext, restore drill, rollback y firmas sin secretos.
- Se amplió `docs/SERVER_OPERATIONS_RUNBOOK.md` con una sección `INFRA-04` que cubre pre-chequeos, `BACKUP_GPG_RECIPIENT`, `BACKUP_RCLONE_REMOTE`, cron diario `0 2 * * *`, ejecución manual y restore drill aislado con `gpg --decrypt`, `gunzip` y `psql`.
- Se actualizó `docs/SECURITY_PRIVACY.md` para enlazar la plantilla `INFRA_04_EVIDENCE_TEMPLATE.md`.
- Se amplió `tests/test_server_operations_runbook.py` de 5 a 6 pruebas y se mantuvieron `tests/test_backup_script.py` como foco del script.
- Verificación RED: el test nuevo falló por `docs/ops/INFRA_04_EVIDENCE_TEMPLATE.md` inexistente.
- Verificación GREEN: `tests/test_server_operations_runbook.py` pasó 6/6; foco backup/runbook pasó 8/8.
- Suite completa: `PYTHONPATH=.venv/lib/python3.13/site-packages PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers python3 -m pytest tests/ -q` pasó `201 passed, 5 skipped, 10 warnings`.
- Importante: esto no completa `INFRA-04`; la llave GPG offline, rclone/R2, cron y restore drill reales en servidor siguen pendientes.

### 2026-05-27 (sesión 41) — INFRA-03 fail2ban prep

- Se añadieron `docs/ops/fail2ban-ra-assessment-filter.conf` y `docs/ops/fail2ban-ra-assessment-jail.conf` como plantillas versionadas para bloquear 5 eventos `login_failed` en 60 segundos durante 1 hora mediante UFW.
- Se añadió `docs/ops/INFRA_03_EVIDENCE_TEMPLATE.md` para registrar validación de filtro, estado del jail, prueba de ban, rollback y firmas sin secretos.
- Se amplió `docs/SERVER_OPERATIONS_RUNBOOK.md` con una sección `INFRA-03` y se actualizó `docs/SECURITY_PRIVACY.md` para enlazar las plantillas.
- Se amplió `tests/test_server_operations_runbook.py` de 4 a 5 pruebas.
- Verificación RED: el test nuevo falló por `docs/ops/fail2ban-ra-assessment-filter.conf` inexistente.
- Verificación GREEN: `tests/test_server_operations_runbook.py` pasó 5/5.
- Suite completa: `PYTHONPATH=.venv/lib/python3.13/site-packages PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers python3 -m pytest tests/ -q` pasó `200 passed, 5 skipped, 10 warnings`.
- Importante: esto no completa `INFRA-03`; la operación real de fail2ban en Hetzner sigue pendiente.

### 2026-05-27 (sesión 40) — INFRA-02 Caddy prep

- Se añadió `docs/ops/Caddyfile.ra-assessment` como plantilla versionada para Caddy 2 con TLS automático, headers básicos, `/health` y `/api/*` hacia `127.0.0.1:8000`, y frontend estático desde `/var/www/ra-assessment/frontend`.
- Se añadió `docs/ops/INFRA_02_EVIDENCE_TEMPLATE.md` para registrar DNS, Caddy validation, TLS, `/health`, API, frontend y rollback sin secretos.
- Se amplió `docs/SERVER_OPERATIONS_RUNBOOK.md` con una sección `INFRA-02` y se actualizó `docs/SECURITY_PRIVACY.md §9.5` para enlazar las plantillas.
- Se amplió `tests/test_server_operations_runbook.py` de 3 a 4 pruebas; el test nuevo protege que `/health` no caiga al frontend estático.
- Verificación RED: el test nuevo falló por `docs/ops/Caddyfile.ra-assessment` inexistente.
- Verificación GREEN: `tests/test_server_operations_runbook.py` pasó 4/4.
- Verificación completa: `PYTHONPATH=.venv/lib/python3.13/site-packages PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers python3 -m pytest tests/ -q` pasó `199 passed, 5 skipped, 10 warnings`.
- Limitación: `caddy` no está instalado localmente, por lo que `caddy validate` queda para el servidor o una máquina con Caddy instalado.
- Importante: esto no completa `INFRA-02`; la operación real de Caddy/TLS en Hetzner sigue pendiente.

### 2026-05-27 (sesión 39) — INFRA-01 evidence template

- Se añadió `docs/ops/INFRA_01_EVIDENCE_TEMPLATE.md` como artefacto copiable para registrar la ejecución real de `INFRA-01` sin secretos.
- Se enlazó la plantilla desde `docs/SERVER_OPERATIONS_RUNBOOK.md` y `docs/SECURITY_PRIVACY.md §9.5`.
- Se amplió `tests/test_server_operations_runbook.py` de 2 a 3 pruebas para exigir que runbook, checklist de seguridad y plantilla permanezcan conectados.
- Verificación RED: el test nuevo falló por plantilla inexistente.
- Verificación GREEN: `tests/test_server_operations_runbook.py` pasó 3/3.
- Verificación completa: `PYTHONPATH=.venv/lib/python3.13/site-packages PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers python3 -m pytest tests/ -q` pasó `198 passed, 5 skipped, 10 warnings`.
- Nota de entorno: `.venv/bin/python` y `.venv/bin/pytest` no son ejecutables funcionales en esta copia; se usó `python3` con `PYTHONPATH` al site-packages del venv. La suite E2E requiere `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers` y permiso para abrir puertos localhost.
- Importante: esto no completa `INFRA-01`; la operación real en Hetzner sigue pendiente.

### 2026-05-22 (sesión 38) — S5-06 runbook INFRA-01

- Se añadió `docs/SERVER_OPERATIONS_RUNBOOK.md` como runbook operativo para hardening del servidor Hetzner.
- El runbook cubre pre-chequeo, rollback, SSH solo con llaves, UFW 22/80/443, PostgreSQL loopback, unattended-upgrades, relación con fail2ban y formato de evidencia.
- Se enlazó el runbook desde `docs/SECURITY_PRIVACY.md §9.5`.
- Se añadió `tests/test_server_operations_runbook.py` para exigir que la documentación operativa contenga pasos y evidencias mínimas antes de ejecutar `INFRA-01`.
- Verificación RED: el test falló por `docs/SERVER_OPERATIONS_RUNBOOK.md` inexistente.
- Verificación GREEN: `tests/test_server_operations_runbook.py` pasó 2/2; suite completa pasó `197 passed, 5 skipped, 10 warnings`; Bandit 0 medium/high.
- Importante: esto no completa `INFRA-01`; solo deja la ejecución real del servidor preparada y verificable para otro agente u operador.

### 2026-05-20 (sesión 37) — S5-05 paridad XLSX de distribución

- Se ajustó `render_xlsx()` para que la hoja `Distribucion` use columnas `PI`, `Descripcion PI`, `Nivel`, `Descriptor`, `Modulo`, `Porcentaje`, `Conteo`.
- La exportación ahora escribe filas por nivel para cada módulo y filas `TOTAL CONSOLIDADO` con porcentajes ponderados y conteos agregados.
- Se mantiene `_append_safe()` en todas las filas, preservando la mitigación contra Excel/CSV injection.
- Se añadió `test_xlsx_export_includes_excel_parity_distribution_details` en `tests/test_report.py`.
- Verificación RED: el test falló porque la hoja anterior solo exponía `PI`, `Modulo`, `Poor`, `Inadequate`, `Adequate`, `Exemplary`.
- Verificación GREEN: test nuevo + sanitización XLSX pasó 2/2; `tests/test_report.py` pasó 11/11; suite completa pasó `195 passed, 5 skipped, 10 warnings`; Bandit 0 medium/high.

### 2026-05-20 (sesión 36) — S5-04 backup GPG script implementado

- Se añadió `scripts/backup-ra.sh` con `set -Eeuo pipefail`, validación explícita de entorno/comandos, dump PostgreSQL, compresión gzip, cifrado GPG y subida por `rclone`.
- El script acepta `DATABASE_URL` o `BACKUP_DATABASE_URL`; convierte `postgresql+asyncpg://` a `postgresql://` para compatibilidad con `pg_dump`.
- Se eliminan dumps `.sql.gz` sin cifrar mediante trap de salida; el archivo cifrado `.sql.gz.gpg` queda disponible para subida/restauración.
- Se documentó `BACKUP_RCLONE_REMOTE` en `.env.example`, `docs/ARCHITECTURE.md`, `docs/SECURITY_PRIVACY.md` y `docs/PRD.md`.
- Se añadió `tests/test_backup_script.py` con binarios falsos de `pg_dump`, `gpg` y `rclone` para probar el flujo sin tocar base real ni llave GPG real.
- Verificación RED: `tests/test_backup_script.py` falló por `scripts/backup-ra.sh` inexistente.
- Verificación GREEN: `tests/test_backup_script.py` pasó 2/2; `bash -n scripts/backup-ra.sh` OK; suite completa pasó `194 passed, 5 skipped, 10 warnings`; Bandit 0 medium/high.
- Pendiente operativo: configurar llave GPG offline, rclone R2, cron y restaurar un backup de prueba en entorno aislado.

### 2026-05-19 (sesión 35) — S5-03 F16 SyncService/file adapter implementado

- Se añadió `src/integration/contracts.py` con `SyncPayload`, `DocenteRecord`, `ModuloRecord` y `EstudianteRecord`.
- Se añadió `src/integration/adapters/file_adapter.py` para convertir archivos CSV/XLSX en `SyncPayload` reutilizando el parser defensivo de F15.
- Se añadió `src/integration/sync_service.py`: `preview()` no persiste datos; `apply()` hace upsert de docentes, módulos, asignaciones, estudiantes y matrículas; el gate de consentimiento Ley 1581 vive en el servicio, no en el adaptador.
- Se añadió `OracleSyncLog` en `src/models/integration.py` y endpoints Admin `POST /api/v1/admin/sync/preview`, `POST /api/v1/admin/sync/apply`, `GET /api/v1/admin/sync/log`.
- Se dejaron stubs documentados para `oracle_adapter.py` y `rest_adapter.py`; Oracle sigue bloqueado por PREREQ-01/02/03.
- Verificación RED: `tests/test_sync.py` falló por `ModuleNotFoundError: src.integration`.
- Verificación GREEN: `tests/test_sync.py` pasó 5/5; foco S5/F16 pasó 28/28; suite completa pasó `192 passed, 5 skipped, 10 warnings`; Bandit 0 medium/high.

### 2026-05-19 (sesión 34) — S5-02 admin bulk imports implementado

- Se añadió `POST /api/v1/admin/bulk/{rubrics|users|modules|students}` en `src/api/routers/admin.py`, exclusivo para Admin y con respuesta `207 Multi-Status`.
- Se creó `src/services/parser.py` como parser defensivo CSV/XLSX: límite 2 MB, UTF-8 estricto, MIME CSV/XLSX, bloqueo de prefijos de fórmula, regex por campo y `openpyxl.load_workbook(read_only=True, data_only=True)`.
- Importación masiva implementada: rúbricas por `SO_codigo+PI_codigo` con validación de pesos = 100 por SO y asociación al período abierto/draft; usuarios por email con contraseña temporal y `ProgramMembership`; módulos por `(period_id, curso_codigo, grupo)` con validación de docente; estudiantes por `document_number+module_id` con `consent_acknowledged=true`.
- Auditoría: `bulk_import_rubrics`, `bulk_import_users`, `bulk_import_modules`, `bulk_import_students` en `security_events`, con severidad `WARN` si hay filas fallidas.
- Verificación RED: `tests/test_admin_bulk.py` falló 7/7 por endpoint inexistente.
- Verificación GREEN: `tests/test_admin_bulk.py` pasó 7/7; foco admin/parser pasó 23/23; suite completa pasó `187 passed, 5 skipped, 10 warnings`; Bandit 0 medium/high.

### 2026-05-19 (sesión 32) — E2E-PG-02 completado contra PostgreSQL 16 real

- Se corrigió el fixture PostgreSQL opt-in en `tests/conftest.py`: `pg_engine` ahora es por test y usa `NullPool`, evitando reutilizar conexiones asyncpg entre event loops de pytest-asyncio.
- RED confirmado: `TEST_PG_URL=postgresql+asyncpg://ra:local_only@localhost:5432/ra_test .venv/bin/python -m pytest tests/test_postgres_staging.py -m pg -q` fallaba con `1 passed, 4 errors` por `Future attached to a different loop` / `another operation is in progress`.
- GREEN confirmado: el mismo comando contra `ra_postgres` en Docker/PostgreSQL 16.14 pasó `5 passed`.
- Verificación completa local: `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers .venv/bin/python -m pytest tests/ -q` pasó `174 passed, 5 skipped, 10 warnings`.
- Estado de `E2E-PG-02`: completado; la infraestructura local PostgreSQL 16 queda utilizable para pruebas reales sin mezclar conexiones entre tests.

### 2026-05-18 (sesión 31) — Docker Desktop + PostgreSQL 16 local instalados

- Se instaló Docker Desktop 4.73.0 vía Homebrew Cask.
- Verificación de cliente/daemon: `docker --version` → Docker 29.4.3; `docker compose version` → v5.1.3; `docker info` responde fuera del sandbox.
- Se detuvo `postgresql@16` de Homebrew porque ocupaba `localhost:5432`.
- Se levantó `docker compose up -d db` con el `docker-compose.yml` del proyecto.
- PostgreSQL local del proyecto queda en `ra_postgres`, imagen `postgres:16-alpine`, versión interna `16.14`, puerto `localhost:5432`, usuario `ra`, base `ra_test`, password `local_only`.
- Verificación de infraestructura: `docker compose ps` → `ra_postgres` Up/healthy; `docker exec ra_postgres pg_isready -U ra -d ra_test` → accepting connections; `SHOW server_version;` → `16.14`.
- Verificación PG opt-in: dentro del sandbox falló por permisos de conexión a `::1:5432`; fuera del sandbox ejecutó contra PostgreSQL real y obtuvo `1 passed, 4 errors`.
- Estado de `E2E-PG-02`: parcialmente ejecutado, no completado. PG-01 pasa; PG-02..PG-05 fallan por fixture async/loop (`tests/conftest.py`) con `Future attached to a different loop` / `another operation is in progress`.
- Siguiente tarea recomendada: corregir `pg_engine`/`pg_session` para que cada test PG use un engine/conexión compatible con el loop de pytest-asyncio o dispose correctamente entre tests; después repetir `TEST_PG_URL=postgresql+asyncpg://ra:local_only@localhost:5432/ra_test .venv/bin/python -m pytest tests/test_postgres_staging.py -m pg -v`.

### 2026-05-18 (sesión 30) — Revisión colaborativa de PG local

- Se revisaron los cambios realizados por otro agente sobre PostgreSQL local con Docker Compose.
- Se conservó `docker-compose.yml` como mecanismo válido para hacer ejecutable `E2E-PG-02` localmente.
- Se corrigió el estado de E2E-PG-02: pasa a **desbloqueable/pendiente de ejecución real**, no completado, porque no hay evidencia de PG-01 a PG-05 passing.
- En el runtime actual, `docker compose config` no pudo ejecutarse porque `docker` no está instalado/disponible (`command not found`).
- Se complementaron PRD, Architecture, Security/Privacy, Traceability, Test Plan, README, `.env.example`, DECISIONS y memorias con reglas de base descartable/test-owned, reset, criterios de done y separación entre PostgreSQL local de pruebas y staging Hetzner/Caddy.
- Verificación pendiente: `docker compose up -d db` + `TEST_PG_URL=postgresql+asyncpg://ra:local_only@localhost:5432/ra_test .venv/bin/python -m pytest tests/test_postgres_staging.py -m pg -v` → requiere Docker Desktop/Engine activo.

### 2026-05-18 (sesión 28) — S4-07 Habeas Data y supresión Ley 1581

- `E2E-PG-02` permanece bloqueado porque `TEST_PG_URL` no está definido.
- Se implementó el router admin de privacidad con `GET /api/v1/admin/habeas-data/{doc_number}` y `PUT /api/v1/admin/suppress/{student_id}`.
- `GET /admin/habeas-data/{doc_number}` retorna coincidencias del titular con datos del estudiante, módulos asociados y calificaciones por PI.
- `PUT /admin/suppress/{student_id}` anonimiza sin borrar: `full_name='[SUPRIMIDO]'`, `document_number='[SUPRIMIDO-{id}]'`, `is_suppressed=true`, preservando relaciones y calificaciones históricas para trazabilidad ABET.
- Ambos endpoints son solo Admin; Teacher recibe 403.
- El audit log registra `habeas_data_accessed` y `student_suppressed` usando hash parcial del documento; no persiste la cédula completa en `security_events.detail`.
- Verificación RED ejecutada: `tests/test_habeas_data.py` → 4 fallos esperados por endpoints inexistentes.
- Verificación focalizada ejecutada: `tests/test_habeas_data.py tests/test_students.py tests/test_student_import.py tests/test_auth.py tests/test_security_model.py` → 26/26 passing.
- Verificación de seguridad ejecutada: `.venv/bin/bandit -r src/ -ll -ii` → 0 medium/high.
- Verificación completa ejecutada: `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers .venv/bin/python -m pytest tests/ -q` → 174 passed, 5 skipped, 10 warnings.

### 2026-05-18 (sesión 27) — S4-06 informe del líder F14

- `E2E-PG-02` permanece bloqueado porque `TEST_PG_URL` no está definido.
- Se implementó `LeaderReportDraft` para guardar conclusiones regenerables por `(period_id, perf_indicator_id)`.
- Se añadieron `GET/PUT /api/v1/periods/{id}/leader-report` y exportaciones `GET /leader-report/pdf` y `GET /leader-report/docx`.
- El informe consolida distribución por PI, análisis docente, síntesis del líder, plan de acción y conclusión editable del líder.
- Se sanitiza con `bleach.clean()` al guardar y se aplica `safe_cell_value()` al renderizar DOCX para bloquear textos tipo fórmula (`=`, `+`, `-`, `@`, `|`, `%`).
- Se registra `leader_report_generated` en `security_events` con `period_id` y `format`.
- Se actualizó el dashboard del líder con formulario de conclusiones y botones PDF/DOCX.
- Se amplió `tests/test_report.py` a 10 pruebas y `tests/test_frontend_dashboard.py` a 9 pruebas.
- Verificación RED ejecutada: `tests/test_report.py` → 5 fallos esperados por endpoints F14 inexistentes; `tests/test_frontend_dashboard.py` → 2 fallos esperados por superficie F14 ausente.
- Verificación focalizada ejecutada: `tests/test_report.py tests/test_frontend_dashboard.py tests/test_action_plan.py tests/test_leader_analysis.py` → 38/38 passing ✅; `node --check frontend/js/dashboard.js` → OK ✅.
- Verificación de seguridad ejecutada: `.venv/bin/bandit -r src/ -ll -ii` → 0 medium/high ✅.

### 2026-05-18 (sesión 26) — S4-05 seguimiento y recordatorios F13

- `E2E-PG-02` permanece bloqueado porque `TEST_PG_URL` no está definido.
- Se implementó `GET /api/v1/periods/{id}/tracking` — Admin y Líder con membresía de programa consultan métricas por módulo/docente: estado, estudiantes activos, estudiantes calificados, porcentaje de avance, `last_access` y días restantes. Teacher → 403.
- Se implementó `GET /api/v1/periods/{id}/reminders/preview` — resuelve variables del mensaje para el primer destinatario elegible (`{nombre_docente}`, `{modulo}`, `{avance_pct}`, `{dias_restantes}`, `{login_url}`).
- Se implementó `POST /api/v1/periods/{id}/reminders` — acepta solo `recipient_ids` internos asignados a módulos no completados del período; rechaza destinatarios externos al período con 400; aplica throttle por usuario de 15 destinatarios/60s con 429; registra `reminder_sent` sin emails en `security_events`.
- Se creó `src/models/reminder.py` con `ReminderLog` y `src/services/email.py` como seam de envío no-op para poder verificar el contrato sin credenciales SMTP locales.
- Se actualizó `frontend/js/dashboard.js`: el botón "Enviar recordatorio" carga tracking, previsualiza el primer mensaje y envía recordatorios a docentes pendientes con feedback inline.
- Se creó `tests/test_notifications.py` con 6 tests TDD y se amplió `tests/test_frontend_dashboard.py` a 7 pruebas.
- Verificación RED ejecutada: `tests/test_notifications.py` → 6/6 fallos esperados por endpoints inexistentes; `tests/test_frontend_dashboard.py` → 1 fallo esperado por placeholder de recordatorio.
- Verificación focalizada ejecutada: `tests/test_notifications.py tests/test_frontend_dashboard.py tests/test_report.py tests/test_action_plan.py tests/test_leader_analysis.py` → 37/37 passing ✅; `node --check frontend/js/dashboard.js` → OK ✅.
- Verificación completa ejecutada: `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers .venv/bin/python -m pytest tests/ -q` → 163 passed, 5 skipped ✅.
- Verificación de seguridad ejecutada: `.venv/bin/bandit -r src/ -ll -ii` → 0 medium/high ✅.

### 2026-05-18 (sesión 23) — S4-02 plan de acción por PI

- `E2E-PG-02` permanece bloqueado porque `TEST_PG_URL` no está definido.
- Se implementó `GET /api/v1/periods/{id}/action-plan` — Admin, Líder (membresía de programa) y Teacher (solo lectura vía módulo asignado) pueden leer el plan de acción del período. El endpoint devuelve una fila por PI activo, con `standard` consolidado, `suggested_action_type`, `action_type` efectivo y campos existentes si ya fueron guardados.
- Se implementó `PUT /api/v1/periods/{id}/action-plan` — Admin o Líder (membresía verificada) pueden guardar/actualizar plan por PI. Teacher → 403. Líder sin membresía → 404 (IDOR prevention). `description`, `responsible` y `estimated_date` se sanitizan con `bleach.clean()`. Upsert por `(period_id, perf_indicator_id)`. PI inválido → 422. Audita `action_plan_saved` en `security_events`.
- Se creó `src/models/action_plan.py` con tabla `action_plans` (period_id FK, perf_indicator_id FK, action_type, description, responsible, estimated_date, implemented, updated_by, updated_at).
- Se creó `src/api/schemas/action_plan.py` con `ActionPlanInput`, `ActionPlanUpdate`, `ActionPlanItem`, `ActionPlanResponse` y validación de `action_type` (`corrective|preventive|improvement`).
- Se creó `src/api/routers/action_plans.py` y se registró en `src/api/main.py`.
- Se creó `tests/test_action_plan.py` con 9 tests TDD.
- Verificación RED ejecutada: `tests/test_action_plan.py` → 8/9 fallos esperados ✅ (1 falso positivo por 404 de endpoint inexistente).
- Verificación focalizada ejecutada: `tests/test_action_plan.py` → 9/9 passing ✅.
- Verificación ampliada ejecutada: `tests/test_action_plan.py tests/test_leader_analysis.py tests/test_assessments.py` → 31/31 passing ✅.
- Verificación completa ejecutada: `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers .venv/bin/python -m pytest tests/ -q` → 148 passed, 5 skipped ✅.
- Verificación de seguridad ejecutada: `.venv/bin/bandit -r src/ -ll -ii` → 0 medium/high ✅.

### 2026-05-18 (sesión 22) — S4-01 análisis consolidado del líder

- `E2E-PG-02` permanece bloqueado porque `TEST_PG_URL` no está definido.
- Se implementó `GET /api/v1/periods/{id}/leader-analysis` — Admin, Líder (membresía de programa) y Teacher (solo lectura vía módulo asignado) pueden leer el análisis consolidado del líder. Teacher → solo lectura; el endpoint lee análisis existentes ordenados por PI.
- Se implementó `PUT /api/v1/periods/{id}/leader-analysis` — Admin o Líder (membresía verificada) pueden guardar/actualizar el análisis por PI. Teacher → 403. Líder sin membresía → 404 (IDOR prevention). Cada `analysis_text` se sanitiza con `bleach.clean()`. Upsert por `(period_id, perf_indicator_id)`. PI inválido → 422. Audita `leader_analysis_saved` en `security_events`.
- Se creó `src/models/leader_analysis.py` con tabla `leader_analysis` (period_id FK, perf_indicator_id FK, analysis_text TEXT, updated_at, updated_by FK → users).
- Se creó `src/api/schemas/leader_analysis.py` con `LeaderAnalysisInput` (validator 2000 chars), `LeaderAnalysisUpdate`, `LeaderAnalysisItem`, `LeaderAnalysisResponse`.
- Se creó `tests/test_leader_analysis.py` con 10 tests TDD.
- Se corrigió `tests/e2e/test_conformidad.py::test_pw05` — `wait_for_selector` de fila genérica reemplazado por `locator("text=Cálculo Diferencial").wait_for(state="visible")` para evitar condición de carrera con fila placeholder.
- Verificación RED ejecutada: `tests/test_leader_analysis.py` → 8/10 fallos esperados ✅
- Verificación focalizada ejecutada: `tests/test_leader_analysis.py` → 10/10 passing ✅
- Verificación completa ejecutada: `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers .venv/bin/python -m pytest tests/ -q` → 139 passed, 5 skipped ✅
- Verificación de seguridad ejecutada: `.venv/bin/bandit -r src/ -ll -ii` → 0 medium/high ✅

### 2026-05-18 (sesión 21) — S3-03 reapertura administrativa (F06)

- `E2E-PG-02` permanece bloqueado porque `TEST_PG_URL` no está definido.
- Se implementó `PUT /api/v1/periods/{id}/reopen` — solo Admin puede reabrir un período cerrado; la acción queda auditada en `security_events` con evento `period_reopened`.
- Se implementó `PUT /api/v1/modules/{id}/reopen` — Admin o Líder (con membresía de programa verificada vía cadena Module→Period→SO→program_id) puede reabrir un módulo completado sin reabrir todo el período. Teacher recibe 403; líder sin membresía recibe 404 (IDOR). El módulo queda en `in_progress` y `submitted_at` se limpia para permitir re-submit. La acción queda auditada con evento `module_reopened`.
- Se añadió `PeriodReopenResponse` a `src/api/schemas/periods.py`.
- Se creó `tests/test_period_reopen.py` con 10 tests TDD que cubren: admin puede reabrir, leader/teacher bloqueados en período, admin restringe a solo-admin, 409 para estado incorrecto, leader puede reabrir módulo con membresía, admin puede cualquier módulo, teacher bloqueado en módulo, 404 para leader sin membresía, módulo en período cerrado puede reabrirse sin reabrir período.
- Verificación RED ejecutada: 9/10 fallos esperados ✅ (1 falso positivo por 404 de endpoint inexistente)
- Verificación focalizada ejecutada: `tests/test_period_reopen.py` → 10/10 passing ✅
- Verificación completa ejecutada: `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers .venv/bin/python -m pytest tests/ -q` → 129 passed, 5 skipped ✅
- Verificación de seguridad ejecutada: `.venv/bin/bandit -r src/ -ll -ii` → 0 medium/high ✅

### 2026-05-18 (sesión 20) — S3-02 wizard docente

- `E2E-PG-02` permanece bloqueado porque `TEST_PG_URL` no está definido; se continuó con S3.
- Se convirtió `frontend/assessment.html` en un wizard F05 de 5 pasos: información general, estudiantes/calificaciones, distribución de desempeño, análisis cualitativo y confirmación/envío.
- Se actualizó `frontend/js/module_assessment.js` con navegación de pasos, resumen del módulo, render de distribución, checklist de preparación y bloqueo de `Enviar módulo` hasta que calificaciones y análisis estén completos.
- Se extendió `GET /modules/{id}/students` con `active_perf_indicators` para que el wizard pueda renderizar indicadores activos aunque aún no existan calificaciones guardadas.
- Se ampliaron estilos en `frontend/css/main.css` para pasos, paneles, resumen, distribución, lista de preparación y navegación responsive.
- Se amplió `tests/test_frontend_assessment.py` de 4 a 5 pruebas estáticas, `tests/test_students.py` de 2 a 3 pruebas para metadatos de PIs activos, y se agregó `tests/e2e/test_assessment_wizard.py` con PW-06: login docente → dashboard → Calificar → wizard visible → submit bloqueado → navegación a distribución.
- Verificación RED ejecutada: `tests/test_frontend_assessment.py` falló por wizard inexistente y `tests/e2e/test_assessment_wizard.py` falló por ausencia de `.wizard-steps` ✅
- Verificación focalizada ejecutada: `.venv/bin/python -m pytest tests/test_frontend_assessment.py -q` → 5/5 passing; `.venv/bin/python -m pytest tests/test_students.py -q` → 3/3 passing; `node --check frontend/js/module_assessment.js` → sin errores; `tests/e2e/test_assessment_wizard.py` → 1/1 passing ✅
- Verificación frontend/E2E ejecutada: `.venv/bin/python -m pytest tests/test_students.py tests/test_frontend_dashboard.py tests/test_frontend_assessment.py -q` → 12/12 passing; `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers .venv/bin/python -m pytest tests/e2e/ -q` → 7/7 passing ✅
- Verificación completa ejecutada: `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers .venv/bin/python -m pytest tests/ -q` → 119 passed, 5 skipped ✅

### 2026-05-17 (sesión 19) — S3-01 cierre de período

- `E2E-PG-02` permanece bloqueado porque `TEST_PG_URL` no está definido; por el plan, se inició S3.
- Se implementó `PUT /api/v1/periods/{id}/close` con request `{ "force": false }`, respuesta `PeriodCloseResponse`, validación de módulos pendientes y cierre forzado con advertencia.
- El cierre queda auditado en `security_events` con evento `period_closed`, `user_id`, `period_id`, `force` y lista de módulos pendientes.
- Se agregó `ensure_module_period_open()` en `src/api/deps.py` y se aplicó a escrituras de módulo: calificaciones, análisis cualitativo, importación de estudiantes y submit. En período cerrado devuelven `403 "Period is closed"`.
- Se agregó `tests/test_period_close.py` con 5 pruebas para cierre exitoso, bloqueo por pendientes sin force, cierre forzado, denegación a docente y bloqueo read-only de calificaciones.
- Verificación RED ejecutada: `tests/test_period_close.py` falló primero por endpoint inexistente y escritura permitida en período cerrado ✅
- Verificación focalizada ejecutada: `.venv/bin/python -m pytest tests/test_period_close.py tests/test_periods.py tests/test_assessments.py tests/test_qualitative.py tests/test_student_import.py tests/test_flow_submit.py -q` → 42/42 passing ✅
- Verificación completa ejecutada: `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers .venv/bin/python -m pytest tests/ -q` → 116 passed, 5 skipped ✅
- Verificación de seguridad ejecutada: `.venv/bin/bandit -r src/ -ll -ii` → 0 medium/high ✅

### 2026-05-17 (sesión 18) — E2E-PW-03 conformidad DG-TSI-09-V4

- Se implementó `tests/e2e/test_conformidad.py` con PW-04 y PW-05: validación de paleta DG-TSI-09-V4 (#1E2843/#FFDF2D), header/footer/logo, ausencia de scroll horizontal en viewport desktop, y dashboard docente con módulos reales tras login.
- Se amplió el fixture `e2e_server` para sembrar línea propedéutica, programa, SO, período, módulo `Cálculo Diferencial` y asignación a `Docente Demo`; esto permite probar dashboard docente con datos reales sin infraestructura externa.
- Se corrigió `frontend/js/dashboard.js` para consumir el contrato real de `ModuleResponse`: `group_name` y `teacher.full_name` en lugar de `group_code`/`teachers`.
- Se agregaron contratos estáticos en `tests/test_frontend_dashboard.py` y `tests/test_e2e_scaffold.py` para prevenir regresión del contrato frontend/backend y asegurar que PW-04/PW-05 existan.
- Verificación RED ejecutada: `tests/test_e2e_scaffold.py` falló por ausencia de `tests/e2e/test_conformidad.py`; `tests/test_frontend_dashboard.py` falló por uso de nombres incorrectos del contrato.
- Verificación focalizada ejecutada: `.venv/bin/python -m pytest tests/test_frontend_dashboard.py tests/test_e2e_scaffold.py -q` → 10/10 passing ✅
- Verificación E2E ejecutada: `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers .venv/bin/python -m pytest tests/e2e/ -q` → 6/6 passing ✅
- Verificación completa ejecutada: `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers .venv/bin/python -m pytest tests/ -q` → 111 passed, 5 skipped ✅
- Verificación de seguridad ejecutada: `.venv/bin/bandit -r src/ -ll -ii` → 0 medium/high ✅

### 2026-05-17 (sesión 17) — E2E-PW-02 auth flow browser E2E

- Se implementaron 3 pruebas browser E2E para el flujo de autenticación: PW-01 login exitoso con redirect a dashboard, PW-02 contraseña incorrecta con error inline, y PW-03 logout revoca sesión.
- Se creó un fixture `e2e_server` (module scope) que levanta la app FastAPI en un subprocess con SQLite temporal, seed de usuarios admin+docente, polling de health, y teardown automático (SIGTERM + rmtree).
- Se añadió `StaticFiles` mount condicional en `src/api/main.py` (`APP_ENV in ("development", "test_e2e")`) para servir el frontend estático durante las pruebas E2E.
- Se detectó incompatibilidad entre `pytest-playwright` (fixture `page`) y `pytest-asyncio` 1.3.0 (`Runner.run() cannot be called from a running event loop`). La solución fue usar `playwright.sync_api` directamente en un fixture `browser_page` propio, eliminando la dependencia de los fixtures de `pytest-playwright`.
- Se corrigió el path de `_frontend_dir` en `main.py` de `parents[3]` a `parents[2]` (off-by-one).
- Se renombró `base_url` a `base_url_for_e2e` para evitar colisión con `pytest-base-url`.
- Se actualizó `tests/test_e2e_scaffold.py` con 5 pruebas estáticas: dependencias, marker, fixtures de conftest, smoke y auth flow tests declarados.
- Verificación completa ejecutada: `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers .venv/bin/python -m pytest tests/ -q` → 107 passed, 5 skipped ✅
- Verificación de seguridad ejecutada: `.venv/bin/bandit -r src/ -ll -ii` → 0 medium/high ✅; `.venv/bin/pip-audit -r requirements.txt --cache-dir .pip-audit-cache --disable-pip` → No known vulnerabilities found ✅
- El flujo completo `pytest tests/` sin flags ahora funciona sin conflictos entre asyncio y Playwright.

### 2026-05-17 (sesión 16) — E2E-PW-01 scaffold Playwright

- `E2E-PG-02` permanece bloqueado porque `TEST_PG_URL` no está definido; se avanzó con la siguiente tarea implementable del plan: base Playwright para pruebas browser E2E.
- Se añadieron `playwright` y `pytest-playwright` a `requirements.in` y se regeneró `requirements.txt` con `pip-compile --generate-hashes`.
- Se registró el marcador `e2e` en `pyproject.toml`.
- Se creó `tests/e2e/` con `__init__.py`, `conftest.py` y `test_smoke.py`; el fixture `base_url` lee `E2E_BASE_URL` con default `http://localhost:8000` y `browser_context` crea un contexto Playwright por prueba.
- Se creó `tests/test_e2e_scaffold.py` con 4 pruebas TDD estáticas para declarar dependencias, marker, fixture y smoke test colectable.
- Se instaló Chromium localmente con `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers .venv/bin/python -m playwright install chromium`; `.playwright-browsers/`, `.pip-tools-cache/` y `.pip-audit-cache/` quedaron ignorados en `.gitignore`.
- Durante verificación con plugin real, `pytest-base-url` exigió `base_url` con scope de sesión; se corrigió el fixture y se agregó aserción estática para prevenir regresión.
- Verificación RED ejecutada: `.venv/bin/python -m pytest tests/test_e2e_scaffold.py -q` → 4 fallos esperados por dependencias/scaffold inexistentes ✅
- Verificación focalizada ejecutada: `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers .venv/bin/python -m pytest tests/test_e2e_scaffold.py tests/e2e/ -q` → 5/5 passing ✅
- Verificación collect-only ejecutada: `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers .venv/bin/python -m pytest tests/e2e/ --collect-only -q` → 1 test collected ✅
- Verificación completa ejecutada: `PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers .venv/bin/python -m pytest tests/ -q` → 103 passed, 5 skipped ✅
- Verificación de seguridad ejecutada: `.venv/bin/bandit -r src/ -ll -ii` → 0 medium/high ✅; `.venv/bin/pip-audit -r requirements.txt --cache-dir .pip-audit-cache --disable-pip` → No known vulnerabilities found ✅

### 2026-05-17 (sesión 15) — S2-FE-02 pantalla de calificación de módulo

- `E2E-PG-02` permanece bloqueado porque `TEST_PG_URL` no está definido; se avanzó con la alternativa documentada de S2: pantalla de calificación del módulo.
- Se creó `frontend/assessment.html` con tabla de estudiantes/indicadores, sección de análisis cualitativo por PI y botones para guardar calificaciones, guardar análisis y enviar módulo.
- Se creó `frontend/js/module_assessment.js` para leer `module_id` desde query string, cargar `/students`, `/assessments` y `/qualitative`, renderizar selects de nivel 1–4, guardar `PUT /assessments`, guardar `PUT /qualitative` y ejecutar `PUT /submit`.
- Se actualizó `frontend/js/dashboard.js` para enlazar cada módulo a `/assessment.html?module_id={id}`.
- Se extendió `frontend/css/main.css` con estilos de assessment, textareas, selectores de nivel, botón compacto y paneles responsive.
- Se creó `tests/test_frontend_assessment.py` con 4 pruebas TDD estáticas para contrato HTML/JS, endpoints, acciones y enlace desde dashboard.
- Verificación RED ejecutada: `.venv/bin/python -m pytest tests/test_frontend_assessment.py -q` → 4 fallos esperados por superficie/JS inexistentes ✅
- Verificación focalizada ejecutada: `.venv/bin/python -m pytest tests/test_frontend_assessment.py -q` → 4/4 passing ✅
- Verificación frontend ejecutada: `.venv/bin/python -m pytest tests/test_frontend_dashboard.py tests/test_frontend_assessment.py -q` → 7/7 passing ✅
- Verificación completa ejecutada: `.venv/bin/python -m pytest tests/ -q` → 98 passed, 5 skipped ✅
- Verificación de seguridad ejecutada: `.venv/bin/bandit -r src/ -ll -ii` → 0 medium/high ✅
- Verificación sintáctica ejecutada: `node --check frontend/js/dashboard.js` y `node --check frontend/js/module_assessment.js` → sin errores ✅
- Limitación: Browser/Playwright visual QA no se ejecutó porque no hay herramienta Browser callable ni configuración Playwright instalada; queda pendiente para `E2E-PW-01`.

### 2026-05-17 (sesión 14) — S2-FE-01 dashboard de módulos

- Como `TEST_PG_URL` no está disponible, `E2E-PG-02` permanece bloqueado por infraestructura externa y se avanzó con la alternativa documentada en S2: pantalla/frontend mínima que consume el listado de módulos con progreso real.
- Se actualizó `frontend/dashboard.html` para incluir selector de período, estado accesible, tabla de módulos y botón de logout fuera de estilos inline.
- Se creó `frontend/js/dashboard.js` para cargar `/api/v1/me`, `/api/v1/periods` y `/api/v1/periods/{period_id}/modules` con `credentials: "same-origin"`, renderizar docentes, estado, activos, calificados y pendientes.
- Se extendió `frontend/css/main.css` con layout del dashboard, tabla responsive, filtro de período, estados visuales y enlace de acción.
- Se creó `tests/test_frontend_dashboard.py` con 3 pruebas TDD estáticas para contrato HTML/JS y progreso real.
- Verificación RED ejecutada: `.venv/bin/python -m pytest tests/test_frontend_dashboard.py -q` → 3 fallos esperados por superficie/JS inexistentes ✅
- Verificación focalizada ejecutada: `.venv/bin/python -m pytest tests/test_frontend_dashboard.py -q` → 3/3 passing ✅
- Verificación completa ejecutada: `.venv/bin/python -m pytest tests/ -q` → 94 passed, 5 skipped ✅
- Verificación de seguridad ejecutada: `.venv/bin/bandit -r src/ -ll -ii` → 0 medium/high ✅
- Verificación sintáctica ejecutada: `node --check frontend/js/dashboard.js` → sin errores ✅

### 2026-05-17 (sesión 13) — E2E-PG-01 arnés PostgreSQL opt-in

- Se añadió `pg_engine` en `tests/conftest.py`, activado solo cuando existe `TEST_PG_URL` y restringido a URLs `postgresql+asyncpg://`.
- Se añadió `pg_session`, que recrea el esquema con `Base.metadata.drop_all/create_all` por test para aislar las pruebas PostgreSQL.
- Se registró el marcador `pg` en `pyproject.toml`.
- Se creó `tests/test_postgres_staging.py` con 5 pruebas opt-in: JSON/JSONB round-trip, upsert PostgreSQL de `Assessment`, upsert PostgreSQL de `ModuleAnalysis`, flujo E2E-01 vía endpoints contra sesión PG, y round-trip `NUMERIC(5,2)` como `Decimal("60.00")`.
- Sin `TEST_PG_URL`, las pruebas PG se recolectan y se saltan de forma controlada.
- Verificación focalizada ejecutada: `.venv/bin/python -m pytest tests/test_postgres_staging.py -q` → 5 skipped ✅
- Verificación completa ejecutada: `.venv/bin/python -m pytest tests/ -q` → 91 passed, 5 skipped ✅
- Verificación de seguridad ejecutada: `.venv/bin/bandit -r src/ -ll -ii` → 0 medium/high ✅
- Pendiente externo: ejecutar `TEST_PG_URL=postgresql+asyncpg://... .venv/bin/python -m pytest tests/test_postgres_staging.py -m pg -v` cuando exista una base PostgreSQL staging válida.

### 2026-05-17 (sesión 12) — S2-05 progreso real de módulos

- Se actualizó `GET /api/v1/periods/{period_id}/modules` para calcular `students_active` y `students_graded` desde datos reales.
- `students_active` cuenta `module_students` con `status="active"` por módulo.
- `students_graded` cuenta estudiantes activos que tienen una calificación para cada PI activo de la rúbrica vigente del período.
- Si el período no tiene rúbrica activa o PIs activos, el endpoint conserva `students_graded=0` y reporta el conteo real de estudiantes activos.
- Se extendió `tests/test_modules.py` con un caso TDD que cubre 3 estudiantes activos, 1 excluido y 2 completamente calificados.
- Verificación focalizada ejecutada: `.venv/bin/python -m pytest tests/test_modules.py -q` → 3/3 passing ✅
- Verificación completa ejecutada: `.venv/bin/python -m pytest tests/ -q` → 91/91 passing ✅
- Verificación de seguridad ejecutada: `.venv/bin/bandit -r src/ -ll -ii` → 0 medium/high ✅

### 2026-05-17 (sesión 11) — E2E-API-01 flujos encadenados

- Se creó `tests/test_flow_submit.py` con 4 flujos E2E API: flujo completo, lectura del líder, gates secuenciales de submit e importación idempotente.
- Los tests encadenan login, import CSV, GET/PUT assessments, PUT qualitative y PUT submit usando SQLite `StaticPool`.
- Verificación completa ejecutada en sesión 11: `tests/` → 91/91 passing ✅
- Verificación de seguridad ejecutada: `bandit -r src/ -ll -ii` → 0 medium/high ✅

### 2026-05-17 (sesión 10) — S2-04 student list endpoint

- Se extendió `src/api/schemas/students.py` con `StudentAssessmentSummary`, `ModuleStudentSummary` y `ModuleStudentsResponse`.
- Se implementó `GET /api/v1/modules/{id}/students` en `src/api/routers/students.py`.
- La respuesta del endpoint incluye:
  - `active_students`
  - `fully_graded_students`
  - `active_pi_count`
  - estudiantes matriculados con `internal_id`, `document_number`, `full_name`, `status`
  - calificaciones por PI activo
  - `graded_pi_count`, `missing_pi_count`, `is_fully_graded`
- Se aplicó el mismo patrón de lectura segura por rol usado en assessments:
  - admin lee cualquier módulo existente.
  - leader lee módulos de programas donde tiene `ProgramMembership`.
  - teacher requiere `module_staff` vía `verify_module_ownership`.
- Se creó `tests/test_students.py` con 2 pruebas: docente asignado lista progreso de calificación; docente no asignado recibe 404.
- Verificación focalizada ejecutada: `.venv/bin/python -m pytest tests/test_students.py -q` → 2/2 passing ✅
- Verificación completa ejecutada: `.venv/bin/python -m pytest tests/ -q` → 87/87 passing ✅
- Verificación de seguridad ejecutada: `.venv/bin/bandit -r src/ -ll -ii` → 0 medium/high ✅

### 2026-05-17 (sesión 9) — S2-03 student import endpoint

- Se crearon `src/api/schemas/students.py` (`StudentImportRow`, `StudentImportResponse`) y `src/api/routers/students.py`.
- Endpoint `POST /api/v1/modules/{id}/students/import` implementado con:
  - Validación de `consent_acknowledged` vía `Form(str)` — 422 si no es "true" (Ley 1581/2012).
  - Validación de MIME type: solo `text/csv` y `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` — 422 para otros.
  - `verify_module_ownership` antes de leer el archivo (auth antes de I/O).
  - Lectura limitada a `_MAX_FILE_BYTES + 1` bytes para detectar archivos de más de 2 MB — 413.
  - Parser CSV: `csv.DictReader` sobre `StringIO`, decode `utf-8-sig` para soportar BOM.
  - Parser XLSX: `openpyxl.load_workbook(read_only=True, data_only=True)` con `iter_rows(values_only=True)`.
  - Bloqueo de fórmulas en cada campo: valores que inician con `=`, `+`, `-`, `@`, `|`, `%` se rechazan por fila (error en respuesta, no falla global).
  - Límite de 100 estudiantes por importación — 422 si se excede.
  - Upsert de `Student` por `internal_id` y de `ModuleStudent` por `(module_id, student_id)`.
  - Acciones reportadas por fila: `created`, `enrolled`, `updated`, `already_enrolled`.
  - `SecurityEvent("students_imported")` con métricas por importación.
- Se añadió `openpyxl` a `requirements.in` e instalado en `.venv`.
- Se registró el router en `src/api/main.py`.
- Se creó `tests/test_student_import.py` con 10 tests de integración.
- Verificación focalizada: `tests/test_student_import.py` → 10/10 passing ✅
- Verificación completa: `tests/` → **85/85 passing** ✅
- Verificación de seguridad: `bandit -r src/ -ll -ii` → 0 medium/high ✅

### 2026-05-17 (sesión 8) — S2-02 assessments + qualitative + submit

- Se crearon 3 modelos ORM: `Student`/`ModuleStudent` (`student.py`), `Assessment` (`assessment.py`), `ModuleAnalysis` (`module_analysis.py`).
- Se añadió relación `module_students` a `Module`.
- Se crearon schemas Pydantic: `assessments.py` y `qualitative.py`.
- Se crearon 2 routers nuevos:
  - `assessments.py`: `GET/PUT /modules/{id}/assessments` — calificaciones por estudiante/PI, distribución calculada, upsert, `SecurityEvent("assessments_saved")`.
  - `qualitative.py`: `GET/PUT /modules/{id}/qualitative` — análisis por PI, `bleach.clean(tags=[], strip=True)`, upsert, `SecurityEvent("qualitative_saved")`.
- Se añadió `PUT /modules/{id}/submit` a `modules.py`: valida calificaciones completas y análisis cualitativos (409 si falta algo); registra `SecurityEvent("module_submitted")`.
- Acceso de lectura diferenciado: admin libre, líder por `ProgramMembership`, teacher por `ModuleAssignment`.
- Acceso de escritura: siempre `verify_module_ownership` (igual para teacher y leader asignado).
- Se añadió `bleach` a `requirements.in`.
- Se crearon 18 tests nuevos: `test_assessments.py` (12) + `test_qualitative.py` (6).
- Verificación focalizada: `tests/test_assessments.py tests/test_qualitative.py` → 18/18 passing ✅
- Verificación completa: `tests/` → **75/75 passing** ✅
- Verificación de seguridad: `bandit -r src/ -ll -ii` → 0 medium/high ✅

### 2026-05-16 (sesión 7) — S2-01 listado de módulos por período

- Se implementó `GET /api/v1/periods/{period_id}/modules` en `src/api/routers/modules.py`.
- Se añadió `src/api/schemas/modules.py` con `ModuleResponse` y `ModuleTeacher`.
- Se registró el router en `src/api/main.py`.
- Reglas de acceso implementadas:
  - `admin`: ve todos los módulos del período.
  - `leader`: ve módulos de períodos cuyo RA/SO pertenece a un programa donde tiene `ProgramMembership`.
  - `teacher`: ve solo módulos donde aparece en `module_staff`.
- La respuesta incluye `teacher`, `students_active`, `students_graded` y `last_updated`; los conteos de estudiantes quedan en `0` hasta implementar modelos/endpoints de estudiantes y assessments.
- Se creó `tests/test_modules.py` con 3 pruebas de integración.
- Verificación focalizada ejecutada: `.venv/bin/python -m pytest tests/test_modules.py -q` → 3/3 passing ✅
- Verificación completa ejecutada: `.venv/bin/python -m pytest tests/ -q` → 57/57 passing ✅
- Verificación de seguridad ejecutada: `.venv/bin/bandit -r src/ -ll -ii` → 0 medium/high ✅

### 2026-05-16 (sesión 4) — Autorización contextual para líderes-evaluadores

- Se documentó la decisión aprobada administrativamente: un líder puede actuar como evaluador de un módulo de su propio RA/SO o de otro RA/SO solo si está asignado en `module_staff`.
- Se actualizó la cadena PRD → documentos derivados: `PRD.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `API_CONTRACT.md`, `ROLE_PERMISSION_MATRIX.md`, `SECURITY_PRIVACY.md`, `TEST_PLAN.md`, `TRACEABILITY_MATRIX.md`.
- Se añadió ADR-14 en `memory/DECISIONS.md`.
- Se implementó `verify_module_ownership()` en `src/api/deps.py` con retorno 404 si el usuario no está asignado al módulo.
- Se creó `tests/test_module_ownership.py` con casos para líder asignado a módulo de RA propio, líder asignado a otro RA, líder no asignado y docente asignado.
- Verificación ejecutada: `.venv/bin/python -m pytest tests/test_module_ownership.py -q` → 4/4 passing ✅
- Verificación ejecutada: `.venv/bin/python -m pytest tests/ -q` → 38/38 passing ✅
- Verificación ejecutada: `.venv/bin/bandit -r src/ -ll -ii` → 0 medium/high ✅

### 2026-05-16 (sesión 3) — S1-18 Deploy pipeline + S1-19 Unit tests security.py

- **S1-18 — deploy.sh reescrito**: orden corregido (pip-audit primero, luego bandit, luego install), bandit con `-ll -ii` sin `--exit-zero`, pip install con `--require-hashes`. `requirements.txt` regenerado con `pip-compile --generate-hashes` (pip-tools 7.5.3).
- **S1-19 — completado**: creado `tests/test_security_core.py` con 10 tests cubriendo:
  - U-S1-01: `encode_jwt()` produce `sub`, `role`, `jti`, `exp` correctos; JTIs únicos; `exp` en el futuro.
  - U-S1-02: `decode_jwt()` lanza `ExpiredSignatureError` con token vencido; `JWTError` con token alterado.
  - U-S1-03: `hash_password()` produce hash bcrypt verificable; contraseña incorrecta falla; hash ≠ texto plano; sal aleatoria por llamada.
- **Bandit**: `bandit -r src/ -ll -ii` → CLEAN (0 hallazgos medium/high) ✅
- **Verificación**: `.venv/bin/python -m pytest tests/` → **34/34 passing** ✅

### 2026-05-16 (sesión 2) — S1-15/S1-16/S1-17/S1-19 Rúbricas completas + seed CLI

- Se confirmó que `src/api/schemas/rubrics.py` (S1-15) ya existía: `PIInput`, `RubricInput` con `@field_validator("perf_indicators")` (suma ±0.01), `RubricResponse`, `CloneRubricRequest/Response`.
- Se confirmó que `src/api/routers/rubrics.py` (S1-16) ya existía con `GET /api/v1/rubrics`, `POST /api/v1/rubrics` y `POST /api/v1/rubrics/{id}/clone`.
- Se registró el router de rúbricas en `src/api/main.py` (faltaba el `include_router`).
- Se creó `tests/test_rubrics.py` (S1-19 parcial) con 8 tests que cubren:
  - U-S1-04: Pydantic rechaza pesos ≠ 100%
  - U-S1-05: Pydantic acepta pesos = 100%
  - U-S1-06: PIs inactivos excluidos de la suma
  - I-S1-06: POST /rubrics con pesos ≠ 100% → 422
  - I-S1-07: POST /rubrics con pesos = 100% → 201 con estructura correcta
  - GET /rubrics lista rúbricas creadas
  - S-S1-05: bypass del frontend bloqueado por validación de servidor → 422
  - 403 para docentes que intentan crear rúbricas
- Se creó `scripts/seed_admin.py` (S1-17) con argparse (--email, --password), idempotente (no corre si ya hay usuarios).
- Verificación: `.venv/bin/python -m pytest tests/` → **24/24 passing** ✅

### 2026-05-16 — S1-14 Router de períodos

- Se confirmó que `src/api/schemas/periods.py` ya existía y cubría S1-13: `PeriodCreate`, `PeriodCreated` y `PeriodResponse`, incluyendo validación `end_date > start_date`.
- Se creó `src/api/routers/periods.py` con:
  - `GET /api/v1/periods` para usuarios autenticados.
  - Filtrado por rol: admin/líder ven todos los períodos; docente solo ve períodos donde tiene módulos asignados.
  - Conteos `modules_total` y `modules_completed`.
  - `POST /api/v1/periods` restringido a admin/líder mediante `require_role("admin", "leader")`.
  - Validación de `student_outcome_id`, nombre duplicado y `clone_from_period_id`.
  - Soporte inicial de clonación de módulos/asignaciones y rúbrica activa cuando se provee `clone_from_period_id`.
- Se registró el router en `src/api/main.py`.
- Se añadieron pruebas de integración en `tests/test_periods.py`.
- Verificación ejecutada: `.venv/bin/python -m pytest tests/test_periods.py` → 5/5 passing ✅
- Verificación ejecutada: `.venv/bin/python -m pytest tests/` → 16/16 passing ✅

### 2026-05-15 — S1-06 Modelos de negocio S1

- Se añadieron modelos SQLAlchemy para `StudentOutcome`, `Rubric`, `PerfIndicator`, `PILevel`, `LevelThreshold`, `Module` y `ModuleAssignment`.
- `ModuleAssignment` mapea la tabla documentada como `module_staff`.
- `Period` quedó alineado con `docs/DATA_MODEL.md §3.3`: `student_outcome_id`, `rubric_id`, `start_date`, `end_date`, `status`, `created_by`, `created_at`.
- `alembic/env.py` ahora importa `src.models` completo para que `Base.metadata` incluya los modelos nuevos en autogenerate.
- Verificación ejecutada: `.venv/bin/python -c "from src.models import Rubric, Module, StudentOutcome, Period; ..."` ✅
- Verificación ejecutada: `.venv/bin/python -m pytest tests/` → 11/11 passing ✅
- Pendiente técnico: crear migración Alembic S1. PostgreSQL local disponible desde sesión 29 vía `docker compose up -d db`; ejecutar `alembic revision --autogenerate -m "init"` y `alembic upgrade head` contra esa BD.
