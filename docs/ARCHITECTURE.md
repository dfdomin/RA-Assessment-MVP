# ARCHITECTURE.md — RA Assessment App / MVP

**Versión del documento**: 2.0 (MVP Supabase)  
**Fecha**: 2026-06-07  
**Referencia PRD**: v2.3  
**Audiencia**: Desarrolladores, DevOps, revisores de arquitectura

> Un desarrollador que lea este documento debe entender el sistema en 10 minutos, sin necesidad de leer el PRD ni ningún otro documento.

---

## 0. Arquitectura activa — RA-Assessment-MVP (Supabase)

**Stack activo** en este repositorio (junio 2026):

| Capa | Tecnología |
|------|------------|
| Frontend | HTML/CSS/JS vanilla en `frontend/` — Supabase JS client v2 (CDN) |
| API datos | Supabase PostgREST + Row Level Security |
| Auth | Supabase Auth (`auth.users` → `public.users`) |
| Lógica compleja | Edge Functions Deno en `supabase/functions/` |
| Base de datos | PostgreSQL en Supabase (`supabase/migrations/`) |
| Hosting | GitHub Pages (`.github/workflows/deploy.yml`) |
| Referencia legacy | FastAPI en `src/` — ver [`src/LEGACY.md`](../src/LEGACY.md) |

```mermaid
graph TB
    Browser["Navegador"]
    GHPages["GitHub Pages\nfrontend/*.html"]
    SupaAuth["Supabase Auth"]
    PostgREST["PostgREST + RLS"]
    EdgeFn["Edge Functions\nreport / import / habeas"]
    PG["PostgreSQL"]

    Browser --> GHPages
    Browser --> SupaAuth
    Browser --> PostgREST
    Browser --> EdgeFn
    SupaAuth --> PG
    PostgREST --> PG
    EdgeFn --> PG
```

### Edge Functions

| Función | Propósito | Puerto desde |
|---------|-----------|--------------|
| `sanitize` | Limpieza HTML + safe_cell_value | `src/services/sanitize.py` |
| `report-abet` | Preview JSON + export PDF/XLSX | `src/services/report.py` |
| `report-leader` | Export PDF/DOCX informe líder | `src/services/leader_report.py` |
| `bulk-import` | Carga masiva CSV/XLSX | `src/services/parser.py` |
| `habeas-data` | Consulta y supresión Ley 1581 | `src/api/routers/admin.py` |

### Seguridad MVP

- **RLS** reemplaza `verify_module_ownership()` y `require_role()` del FastAPI
- Funciones helper: `user_has_role()`, `is_module_teacher()` en migración `0008_rls_policies.sql`
- Edge Functions validan JWT del caller y re-verifican rol antes de operaciones admin

### Deploy

1. `git push` a `main` → GitHub Actions inyecta cache-bust (`scripts/inject-cache-bust.sh`) → GitHub Pages
2. Migraciones SQL → `supabase db push` (manual o CI con secrets)
3. Edge Functions → `supabase functions deploy`

---

## 1. Descripción del Sistema

La **RA Assessment App** reemplaza un flujo manual de Excel/VBA que el programa de Tecnología en Gestión Administrativa (TGA) de la IUB usa para el assessment de Resultados de Aprendizaje (RA/SO) requeridos por ABET. El sistema permite a los docentes registrar calificaciones por estudiante, escribir análisis cualitativos y al líder del programa consolidar resultados, generar reportes ABET formales y gestionar el ciclo completo desde una interfaz web.

### Stack legacy (referencia — `src/`)

**Stack principal**: FastAPI (Python 3.12) + PostgreSQL 16 + HTML/JS estático  
**Infraestructura**: Hetzner CAX11 ARM64 (~€4.29/mes) + Caddy 2 (TLS automático)  
**Deploy**: Git push → post-receive hook → `deploy.sh` (pip-audit + Bandit + systemd restart)

---

## 2. Estructura del Repositorio

```
ra-assessment/
├── src/
│   ├── api/                  # FastAPI: routers, dependencias, schemas Pydantic
│   │   ├── routers/          # Un archivo por grupo de endpoints
│   │   │   ├── auth.py       # POST /auth/login, /auth/logout, OIDC callbacks
│   │   │   ├── periods.py    # GET/POST /periods, PUT /periods/{id}/close
│   │   │   ├── rubrics.py    # GET/POST /rubrics, POST /rubrics/{id}/clone
│   │   │   ├── modules.py    # GET/PUT módulos del período
│   │   │   ├── assessments.py # GET/PUT calificaciones por módulo
│   │   │   ├── students.py   # POST /modules/{id}/students/import
│   │   │   ├── qualitative.py # GET/PUT análisis cualitativo
│   │   │   ├── report.py     # GET /periods/{id}/report (.json, .pdf, .xlsx)
│   │   │   ├── leader_report.py # GET/PUT /periods/{id}/leader-report (.pdf, .docx)
│   │   │   ├── notifications.py # Tracking y recordatorios F13
│   │   │   └── admin.py      # Carga masiva F15, habeas data, CRUD admin
│   │   ├── deps.py           # get_db, get_current_user, require_role, verify_module_ownership
│   │   └── schemas/          # Pydantic models request/response
│   ├── core/
│   │   ├── config.py         # Settings (pydantic-settings, carga .env)
│   │   ├── security.py       # JWT encode/decode, bcrypt, JTI blocklist
│   │   └── logging.py        # Security audit log (JSON Lines → security.jsonl)
│   ├── db/
│   │   ├── models.py         # SQLAlchemy 2.x ORM models (async)
│   │   └── session.py        # AsyncEngine + AsyncSession factory
│   ├── services/             # Lógica de negocio desacoplada de HTTP
│   │   ├── assessment.py     # Cálculo Total Score, Standard, distribución de niveles
│   │   ├── report.py         # Generación PDF (WeasyPrint) y XLSX (openpyxl)
│   │   ├── leader_report.py  # Generación PDF/DOCX del informe del líder (F14)
│   │   ├── parser.py         # Parser defensivo CSV/XLSX (F03, F15) — ver §17 PRD
│   │   ├── email.py          # SMTP relay via Gmail App Password (F13)
│   │   └── sanitize.py       # bleach.clean() + safe_cell_value()
│   └── integration/          # Ports & Adapters — ingesta de datos externos (F16)
│       ├── contracts.py      # SyncPayload — contrato universal sin dependencias externas
│       ├── sync_service.py   # SyncService — puerto de entrada; valida y persiste
│       └── adapters/
│           ├── file_adapter.py   # CSV/Excel → SyncPayload (refactoriza parser de F15, S5)
│           ├── oracle_adapter.py # Academusoft Oracle → SyncPayload (condicional, S7)
│           └── rest_adapter.py   # Template para SIS REST futuro (estructura ahora, S7+)
├── frontend/                 # HTML + CSS + JS estático (servido por Caddy desde /var/www/ra-assessment/frontend/)
│   ├── index.html            # Pantalla de login
│   ├── dashboard.html        # Dashboard según rol (docente/líder/admin)
│   ├── assets/
│   │   ├── css/
│   │   │   ├── style.css     # Estilos @media screen (paleta IUB)
│   │   │   └── print.css     # Estilos @media print
│   │   └── js/               # Vanilla JS por módulo funcional
│   └── components/           # Fragmentos HTML reutilizables (header, footer, breadcrumb)
├── docs/                     # Documentación técnica
│   ├── PRD.md                # Product Requirements Document v2.2
│   ├── ARCHITECTURE.md       # Este archivo
│   ├── DATA_MODEL.md         # Modelo de datos completo con diagrama ER
│   ├── API_CONTRACT.md       # Contrato de la API REST
│   ├── SECURITY_PRIVACY.md   # Postura de seguridad y Ley 1581/2012
│   ├── ROLE_PERMISSION_MATRIX.md  # Matriz roles × recursos × acciones
│   ├── TRACEABILITY_MATRIX.md     # Trazabilidad PRD → implementación
│   └── TEST_PLAN.md          # Plan de pruebas por sprint S1–S6
├── memory/                   # Estado del proyecto (para retomar sesiones de IA)
│   ├── PROJECT_STATE.md      # Estado actual, sprint activo, métricas de progreso
│   ├── NEXT_STEPS.md         # Próximas tareas atómicas ordenadas por prioridad
│   └── DECISIONS.md          # Registro de decisiones de arquitectura (ADR simplificado)
├── tests/
│   ├── unit/                 # pytest: cálculos de scores, parsers, sanitizadores
│   ├── integration/          # pytest + httpx AsyncClient: endpoints completos
│   └── security/             # IDOR, rate limiting, CSV injection, habeas data
├── scripts/
│   ├── deploy.sh             # pip-audit → Bandit → alembic upgrade → systemd restart
│   └── backup-ra.sh          # pg_dump + GPG encrypt + rclone → Cloudflare R2
├── static/
│   └── templates/            # Plantillas CSV descargables (F15)
│       ├── template_rubricas.csv
│       ├── template_usuarios.csv
│       ├── template_modulos.csv
│       └── template_estudiantes.csv
├── alembic/                  # Migraciones de base de datos
│   ├── env.py
│   ├── alembic.ini
│   └── versions/             # Archivos de migración numerados (0001_, 0002_…)
├── .env.example              # Plantilla de variables de entorno (sin valores reales)
├── requirements.in           # Dependencias directas (pip-tools)
└── requirements.txt          # Lockfile con hashes SHA-256 (pip-compile --generate-hashes)
```

**Nota sobre estado actual**: El repositorio tiene un directorio `backend/` (esqueleto vacío) en lugar de `src/`. Esta estructura debe migrarse a `src/` al iniciar S1 para seguir las convenciones documentadas aquí.

---

## 3. Diagrama de Componentes

```mermaid
graph TB
    subgraph "Cliente"
        Browser["Navegador\nChrome / Firefox / Edge"]
    end

    subgraph "Hetzner CAX11 — ARM64 (servidor único)"
        Caddy["Caddy 2\nTLS automático · Archivos estáticos · Reverse proxy\n:443 → frontend/ o :8000"]

        Frontend["Frontend Estático\nHTML + CSS + Vanilla JS\n/var/www/ra-assessment/frontend/"]

        subgraph "FastAPI App — systemd service"
            API["Uvicorn async\nFastAPI app"]
            Routers["API Routers\nauth · periods · modules\nassessments · report · admin"]
            Deps["Dependencies\nrequire_role()\nverify_module_ownership()"]
            Services["Services\nassessment · report · parser\nemail · sanitize"]
            Models["SQLAlchemy 2.x async\nORM Models"]
        end

        DB["PostgreSQL 16\nlocalhost:5432"]
        Logs["/var/log/ra-assessment/\nsecurity.jsonl"]
        Fail2ban["fail2ban\n5+ login_failed / 60s → ban 1h"]
        UFW["UFW Firewall\n22 · 80 · 443 únicamente"]
    end

    subgraph "Servicios Externos"
        Gmail["Gmail SMTP\nApp Password\n(recordatorios F13)"]
        R2["Cloudflare R2\nBackups GPG cifrados\n(free tier 10 GB)"]
        MicrosoftAD["Microsoft Azure AD\nOIDC — opcional F12"]
    end

    Browser -->|"HTTPS 443"| Caddy
    Caddy -->|"/* → file_server"| Frontend
    Caddy -->|"proxy_pass /api/* → :8000"| API
    API --> Routers --> Deps --> Services --> Models --> DB
    Services -->|"log_security_event()"| Logs
    Logs --> Fail2ban
    Services -->|"SMTP 587/465"| Gmail
    Services -->|"OIDC (si configurado)"| MicrosoftAD
    DB -->|"pg_dump diario cifrado GPG"| R2

    style DB fill:#336791,color:#fff
    style Caddy fill:#00adef,color:#fff
    style Frontend fill:#f0db4f,color:#333
    style UFW fill:#e74c3c,color:#fff
```

---

## 4. Capas del Sistema

### 4.1 Frontend (HTML/JS estático)

| Aspecto | Detalle |
|---|---|
| Tecnología | HTML5 + CSS3 + Vanilla JavaScript (sin framework, sin build step) |
| Despliegue | Caddy 2 `file_server` desde `/var/www/ra-assessment/frontend/` — mismo origen que la API |
| Diseño | Guía IUB DG-TSI-09-V4: paleta `#1E2843`/`#FFDF2D`, tipografía Arial/Open Sans, estructura header + contenido + footer |
| Comunicación | `fetch()` contra `/api/v1/*`; cookie httpOnly para sesión (JWT); mismo origen → sin CORS, sin `credentials: 'include'` |
| Validaciones | El frontend valida para UX; **todas las validaciones críticas se replican en la API** |

El frontend no contiene lógica de negocio. Toda regla de negocio (suma de pesos = 100%, completitud del módulo, ownership) está enforced en el backend.

### 4.2 Backend (FastAPI + Python 3.12)

| Aspecto | Detalle |
|---|---|
| Servidor | Uvicorn (async ASGI), gestionado por systemd |
| Autenticación | JWT en cookie httpOnly, expiración 8 h, JTI blocklist en `revoked_tokens` |
| Autorización | `require_role()` por endpoint + `verify_module_ownership()` para permisos contextuales de módulo (`teacher` y `leader` asignados en `module_staff`) |
| Seguridad | `bleach` (sanitiza campos texto), `safe_cell_value()` (exportaciones), `slowapi` (rate limiting) |
| RAM estimada | ~60 MB en reposo; ~200 MB en pico con 30 docentes |

**Flujo de autorización en cada request:**

```
Request
  ↓ slowapi: ¿rate limit excedido? → 429
  ↓ Pydantic: ¿body válido? → 422
  ↓ get_current_user: ¿JWT válido y JTI no revocado? → 401
  ↓ require_role(): ¿rol suficiente? → 403
  ↓ verify_module_ownership(): ¿usuario asignado al módulo en module_staff? → 404
  ↓ Service: lógica de negocio
  ↓ SQLAlchemy async: query/write PostgreSQL
  ↓ log_security_event(): append a security.jsonl
  ↓ Response
```

**Regla de líderes-evaluadores**: el rol global `leader` sirve para supervisión, gestión de períodos/rúbricas/reportes y navegación. Para escribir datos de assessment de un módulo, el líder debe estar asignado como evaluador en `module_staff`, igual que un docente. Esto permite líderes evaluando su propio RA/SO u otro RA/SO sin conceder acceso por rol global a módulos no asignados.

### 4.3 Base de Datos (PostgreSQL 16)

| Aspecto | Detalle |
|---|---|
| Acceso | Solo desde `localhost:5432` — no expuesto a red |
| ORM | SQLAlchemy 2.x async (sin SQL crudo en el codebase) |
| Migraciones | Alembic — cada cambio de schema en un archivo versionado |
| JSONB | Usado en `pi_levels.descriptors`, `leader_report_drafts.pi_conclusions`, `reminder_log.recipient_ids` |
| Backup | `pg_dump` diario cifrado GPG → Cloudflare R2 |

Ver `DATA_MODEL.md` para el esquema completo de tablas, columnas, índices y relaciones.

### 4.4 Infraestructura

| Componente | Spec | Rol |
|---|---|---|
| Hetzner CAX11 | ARM64, 2 vCPU, 4 GB RAM, 40 GB NVMe | Servidor único de aplicación |
| Caddy 2 | ~15 MB RAM | TLS automático (Let's Encrypt) + reverse proxy |
| UFW | — | Firewall: deny all incoming, allow 22/80/443 |
| fail2ban | — | Bloquea IPs con ≥5 `login_failed` en 60 s (1 h de ban) |
| systemd | — | Gestiona el proceso Uvicorn (restart automático) |

---

## 5. Decisiones de Diseño Clave

| Decisión | Elección | Razón principal |
|---|---|---|
| Framework backend | FastAPI + SQLAlchemy async | Async nativo, Pydantic para validación, OpenAPI auto-generado |
| Frontend | Vanilla JS + HTML estático (Caddy) | Sin build step; mismo origen que la API → `SameSite=Strict` nativo, sin CORS, un solo dominio y TLS cert |
| PDF generation | WeasyPrint (HTML → PDF) | Sin dependencia de LibreOffice; ~50 ms para informe típico de 5 PIs |
| DOCX generation | python-docx | Requerido para F14 (informe del líder); comparable en CPU a WeasyPrint |
| Autenticación | JWT en cookie httpOnly | Sin riesgo de XSS (vs. localStorage); expira en 8 h; JTI blocklist para logout inmediato |
| Sanitización HTML | bleach.clean(tags=[]) | Elimina todo HTML/JS de campos de texto antes de persistir |
| Excel import | openpyxl (read_only=True, data_only=True) | No ejecuta fórmulas ni macros VBA embebidas |
| ORM | SQLAlchemy 2.x async | Sin SQL crudo → SQL injection mitigado estructuralmente |
| Supresión de datos | Anonimización, no eliminación física | Preserva integridad referencial de reportes ABET cerrados; cumple Ley 1581 |
| Infraestructura | Hetzner CAX11 (ARM64) | €3.79/mes, RAM suficiente para 30 docentes simultáneos |
| Reverse proxy | Caddy 2 | TLS automático zero-config; ~15 MB RAM |
| Rate limiting | slowapi + fail2ban | slowapi en capa app (429); fail2ban en capa OS (ban por IP a nivel firewall) |

Ver `memory/DECISIONS.md` para el registro completo con contexto, alternativas evaluadas y consecuencias.

---

## 6. Convenciones de Código

### Python (backend)

- **Estilo**: PEP 8; enforced con `ruff` (linter) y `black` (formatter)
- **Type hints**: obligatorios en todas las funciones públicas
- **Async**: todos los endpoints y queries de DB son `async def` con `await`
- **Sin SQL crudo**: toda interacción con DB a través de SQLAlchemy ORM
- **Imports**: absolutos desde raíz del paquete (`from src.core.security import ...`)
- **Validadores Pydantic**: todas las reglas de negocio críticas replicadas como `@field_validator`
- **Error IDOR**: siempre `404 Not Found` para recursos no accesibles, nunca `403`

### JavaScript (frontend)

- **Sin framework**: funciones puras, módulos ES6 (`import`/`export`)
- **Fetch API**: sin `credentials: 'include'` — mismo origen con la API, el browser envía el cookie JWT automáticamente (`credentials: 'same-origin'` es el default)
- **Sin `eval()`**: prohibido por política de seguridad de contenido
- **Accesibilidad**: `aria-label` en iconos de acción; `<label for>` en todos los inputs; `<fieldset>+<legend>` en radio groups

### Nomenclatura

| Contexto | Convención | Ejemplo |
|---|---|---|
| Tablas DB | `snake_case` singular | `module`, `student`, `assessment` |
| Endpoints | kebab-case | `/periods/{id}/leader-report` |
| Variables Python | `snake_case` | `module_staff` |
| Constantes | `UPPER_SNAKE_CASE` | `MAX_FILE_BYTES`, `FORMULA_PREFIXES` |
| Eventos audit | `snake_case` descriptivo | `login_failed`, `report_exported` |
| Migraciones Alembic | prefijo numérico + descripción | `0001_initial_schema.py` |

---

## 7. Flujo de Deploy

```bash
# deploy.sh — disparado por git post-receive hook en el servidor

#!/bin/bash
set -e

cd /srv/ra-assessment

# 1. Obtener últimos cambios
git pull origin main

# 2. Verificar CVEs en dependencias (bloquea deploy si encuentra alguno)
pip-audit --require-hashes -r requirements.txt
echo "✓ pip-audit: sin CVEs"

# 3. Análisis estático de seguridad (bloquea si hay issues HIGH o MEDIUM)
bandit -r src/ -ll -ii
echo "✓ bandit: sin issues de seguridad"

# 4. Instalar dependencias (con verificación de hashes)
pip install --require-hashes -r requirements.txt

# 5. Aplicar migraciones de base de datos
alembic upgrade head
echo "✓ migraciones aplicadas"

# 6. Reiniciar el servicio
systemctl restart ra-assessment
echo "✓ servicio reiniciado"
```

El deploy **falla de forma segura**: si `pip-audit` detecta CVEs o `bandit` encuentra issues de severidad media-alta, el script termina con `exit 1` y el servicio no se reinicia.

### 7.1 Configuración de Caddy (Caddyfile)

Caddy sirve tanto los archivos estáticos del frontend como el proxy a la API desde el mismo dominio. Esto garantiza mismo origen y elimina CORS:

```caddy
# /etc/caddy/Caddyfile
ra-assessment.iub.edu.co {

    # API: proxy hacia Uvicorn
    handle /api/* {
        reverse_proxy localhost:8000
    }

    # Frontend: archivos estáticos (SPA con fallback a index.html)
    handle {
        root * /var/www/ra-assessment/frontend
        try_files {path} /index.html
        file_server
    }
}
```

El deploy del frontend consiste en copiar los archivos HTML/CSS/JS al directorio `/var/www/ra-assessment/frontend/` — sin reiniciar Caddy ni el servicio FastAPI:

```bash
# Paso 7 en deploy.sh — sincronizar assets del frontend
rsync -av --delete frontend/ /var/www/ra-assessment/frontend/
echo "✓ frontend sincronizado"
```

---

## 8. Variables de Entorno

Las variables sensibles se almacenan en `/srv/ra-assessment/.env` (permisos `600`, fuera de git). Ver `.env.example` en la raíz para la plantilla.

| Variable | Requerida | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | `postgresql+asyncpg://ra_user:PASS@localhost/ra_assessment` |
| `TEST_PG_URL` | No | Solo desarrollo/CI: PostgreSQL 16 descartable para tests PG opt-in (`docker compose up -d db`) |
| `SECRET_KEY` | Sí | 64 bytes aleatorios para firmar JWT (`openssl rand -hex 32`) |
| `GMAIL_APP_PASSWORD` | Sí | App Password de Gmail para SMTP relay (F13) |
| `BACKUP_GPG_RECIPIENT` | Sí | Fingerprint del receptor GPG para backups cifrados |
| `BACKUP_RCLONE_REMOTE` | Sí | Destino rclone para backups cifrados, por ejemplo `r2:ra-assessment-backups/` |
| `MICROSOFT_CLIENT_ID` | No | Azure AD — si presente, habilita F12 (OIDC Microsoft) |
| `MICROSOFT_CLIENT_SECRET` | No | Azure AD — requerido junto con `CLIENT_ID` |
| `MICROSOFT_TENANT_ID` | No | Azure AD — requerido junto con `CLIENT_ID` |

Ver `SECURITY_PRIVACY.md §4` para el procedimiento completo de gestión de secretos.

### 8.1 Entornos de Prueba con PostgreSQL Real

El flujo local rápido sigue usando SQLite para tests unitarios e integración de alta velocidad. Para validar paridad con producción, `TEST_PG_URL` apunta a una base PostgreSQL 16 descartable/test-owned. La implementación local preferida es `docker-compose.yml` con servicio `db` (`postgres:16-alpine`).

Reglas:
- La base de `TEST_PG_URL` no contiene datos reales.
- Los tests PG pueden recrear schema/datos sin conservar estado.
- La evidencia de cierre de `E2E-PG-02` requiere PG-01 a PG-05 passing sin skips.
- Staging Hetzner/Caddy sigue siendo necesario para validar TLS, reverse proxy, rutas estáticas y comportamiento HTTP de despliegue.

---

## 9. Capa de Integración de Datos (Ports & Adapters)

Toda ingesta de datos desde fuentes externas pasa por una capa de integración estructurada como **Ports & Adapters**. El backend de assessment no depende de ningún sistema externo directamente; solo conoce el contrato `SyncPayload`.

### 9.1 Capas y Flujo

```
Fuentes externas           Adaptadores                  Contrato       Puerto          Almacenamiento
───────────────────────    ──────────────────────────   ────────────   ─────────────   ──────────────
Academusoft (Oracle DB) → oracle_adapter.py ──────────┐
CSV/Excel manual ────────→ file_adapter.py  ──────────┼──→ SyncPayload ──→ SyncService ──→ PostgreSQL
SIS REST futuro ─────────→ rest_adapter.py  ──────────┘  (validación)    (upsert +
                                                                           audit log)
```

### 9.2 Contrato Central (`src/integration/contracts.py`)

```python
from pydantic import BaseModel
from typing import List

class DocenteRecord(BaseModel):
    email: str
    full_name: str
    role: str = "teacher"

class ModuloRecord(BaseModel):
    course_code: str
    course_name: str
    group_name: str
    docente_email: str

class EstudianteRecord(BaseModel):
    internal_id: str
    document_number: str
    full_name: str
    modulo_id: str

class SyncPayload(BaseModel):
    periodo_codigo: str
    docentes: List[DocenteRecord]
    modulos: List[ModuloRecord]
    estudiantes: List[EstudianteRecord]
    source: str  # 'academusoft' | 'csv' | 'rest' | 'manual'
    consent_acknowledged: bool = False  # Ley 1581/2012 — obligatorio para estudiantes
```

### 9.3 Puerto de Entrada (`src/integration/sync_service.py`)

`SyncService` es el único código que escribe en PostgreSQL a partir de datos externos. Valida `consent_acknowledged` antes de procesar estudiantes (rechaza con `ValueError` si es `False`), ejecuta upsert por clave natural, y registra `sync_applied` en `security_events` con `source` y `counts`.

### 9.4 Adaptadores

| Adaptador | Archivo | Sprint | Estado |
|---|---|---|---|
| CSV/Excel | `src/integration/adapters/file_adapter.py` | S5 — refactoriza `src/services/parser.py` de F15 | Planificado |
| Oracle (Academusoft) | `src/integration/adapters/oracle_adapter.py` | S7 — condicional (ver §9.5) | Stub vacío hasta S7 |
| REST SIS | `src/integration/adapters/rest_adapter.py` | Template ahora, código S7+ | Template vacío |

### 9.5 Prerequisitos para `oracle_adapter.py`

`oracle_adapter.py` está documentado pero **no puede implementarse** hasta que se cumplan tres condiciones externas al codebase (ver `memory/NEXT_STEPS.md` PREREQ-01 a PREREQ-03):

1. **Schema Oracle confirmado por DBA de la IUB** — mapeo de tablas Academusoft → `SyncPayload` verificado.
2. **Entorno Oracle de prueba disponible para CI** — sin él, las pruebas de integración no pueden automatizarse.
3. **Concepto jurídico Ley 1581/2012 del área jurídica de la IUB** — la extracción automática de datos personales en volumen requiere aval legal formal.

Hasta que se cumplan estos prerequisitos, `oracle_adapter.py` permanece como archivo vacío con docstring de estado. El sistema opera normalmente con `file_adapter.py` (CSV).

**Nota sobre propiedad de datos**: el sistema es dueño de los datos de assessment (calificaciones, análisis, rúbricas). Los datos de matrícula (estudiantes, módulos, docentes) provienen del SIS. La capa `src/integration/` hace explícita esta distinción y permite que ambas capas evolucionen independientemente.

---

## 10. Lecturas Complementarias

| Documento | Ruta | Cuándo leerlo |
|---|---|---|
| Modelo de datos | `docs/DATA_MODEL.md` | Antes de modificar tablas o escribir migraciones |
| Contrato de la API | `docs/API_CONTRACT.md` | Antes de implementar o consumir endpoints |
| Seguridad y privacidad | `docs/SECURITY_PRIVACY.md` | Antes de cambios en auth, parsers o exportaciones |
| Matriz de permisos | `docs/ROLE_PERMISSION_MATRIX.md` | Al agregar endpoints o roles |
| Trazabilidad | `docs/TRACEABILITY_MATRIX.md` | Al priorizar features o auditar cobertura |
| Plan de pruebas | `docs/TEST_PLAN.md` | Al iniciar cada sprint |
| Estado actual | `memory/PROJECT_STATE.md` | Al iniciar una nueva sesión de trabajo |
| Próximos pasos | `memory/NEXT_STEPS.md` | Al iniciar una sesión de trabajo |
| Decisiones ADR | `memory/DECISIONS.md` | Al evaluar cambios arquitectónicos |
