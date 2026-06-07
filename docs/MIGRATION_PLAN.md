# MIGRATION_PLAN.md — RA Assessment MVP

**Versión**: 1.0
**Fecha**: 2026-06-01
**Objetivo**: Migrar RA-Assessment-App de FastAPI+PostgreSQL+Hetzner a Supabase+GitHub Pages
**Repo original**: RA-Assessment-App (201 tests, S0-S5 completos)
**Repo destino**: RA-Assessment-MVP (este repo)

---

## Resumen Ejecutivo

Convertir una aplicación FastAPI con ~40 endpoints Python en una aplicación
estática HTML/JS vanilla que habla directamente con Supabase (PostgREST + Auth +
Edge Functions). El frontend se sirve desde GitHub Pages. No hay servidor
propio. No hay costo de hosting (Supabase free tier + GitHub Pages gratuito).

---

## 1. Comparación de Arquitecturas

| Capa | Actual (RA-Assessment-App) | Destino (RA-Assessment-MVP) |
|------|---------------------------|----------------------------|
| **Frontend** | HTML/JS vanilla servido por FastAPI/Caddy | HTML/JS vanilla servido por GitHub Pages |
| **Backend** | FastAPI (Python 3.12) | Supabase (PostgREST + Edge Functions) |
| **Base de datos** | PostgreSQL 16 en Hetzner | PostgreSQL 15 en Supabase |
| **Auth** | JWT httpOnly cookies + JTI blocklist | Supabase Auth (JWT en localStorage) |
| **Rate limiting** | slowapi + fail2ban | Supabase built-in |
| **Sanitización** | bleach.clean() en Python | Edge Function (Deno) |
| **Reportes PDF** | WeasyPrint en Python | Edge Function (Deno + pdf-lib o jsPDF) |
| **Reportes XLSX** | openpyxl en Python | Edge Function (Deno + SheetJS) |
| **Import CSV/XLSX** | openpyxl + parseo defensivo Python | Edge Function (Deno) |
| **Email** | Seam no-op (Python) | Edge Function + Resend/SendGrid |
| **Deploy** | deploy.sh → Hetzner CAX11 | git push → GitHub Pages |
| **CI/Tests** | pytest 201 tests | Playwright E2E tests (7 existentes) |

---

## 2. Estrategia de Migración

### Fase 1 — Fundación Supabase (Semana 1)
- Crear proyecto Supabase
- Migrar schema SQL (~20 tablas)
- Configurar Supabase Auth
- Crear seed data inicial (admin, líder, docente demo)
- Probar conexión desde frontend local

### Fase 2 — Core Funcional (Semana 2)
- Auth: reemplazar JWT cookies por Supabase Auth en frontend JS
- Módulos: CRUD vía Supabase JS client + RLS
- Períodos: CRUD vía Supabase JS client + RLS
- Rúbricas: CRUD vía Supabase JS client + RLS
- Calificaciones (assessments): CRUD vía Supabase JS client
- Dashboard docente/líder funcional

### Fase 3 — Features Avanzadas (Semana 3)
- Análisis cualitativo (module_analysis)
- Análisis del líder (leader_analysis)
- Plan de acción (action_plans)
- Cierre y reapertura de período
- Recordatorios (reminder_log)

### Fase 4 — Reportes y Utilidades (Semana 4)
- Reporte ABET PDF/XLSX (Edge Function)
- Informe del líder PDF/DOCX (Edge Function)
- Carga masiva CSV/XLSX (Edge Function)
- Habeas data y supresión

### Fase 5 — Deploy y Pulido (Semana 5)
- Configurar GitHub Pages
- Verificar mobile-first
- WCAG 2.1 AA
- DNS personalizado (opcional)

---

## 3. Lo Que Se Conserva (sin cambios)

| Archivo/Carpeta | Por qué |
|-----------------|---------|
| `frontend/` completo | HTML/CSS/JS ya usa vanilla — compatible con GH Pages |
| `docs/PRD.md` | Fuente de verdad del producto |
| `docs/DATA_MODEL.md` | Schema de referencia (se traduce a SQL) |
| `docs/ARCHITECTURE.md` | Se reescribe para Supabase |
| `docs/ROLE_PERMISSION_MATRIX.md` | Roles no cambian |
| `docs/SECURITY_PRIVACY.md` | Principios de seguridad se mantienen |
| `docs/UX_IUB_RULES.md` | Design tokens IUB no cambian |
| `memory/` | Se actualiza con nueva arquitectura |
| `tests/e2e/` | Tests Playwright se adaptan a Supabase |
| `frontend/static/templates/` | Plantillas CSV reutilizables |

---

## 4. Lo Que Se Elimina (reemplazado por Supabase)

| Archivo/Carpeta | Reemplazado por |
|-----------------|----------------|
| `src/api/` (todo) | Supabase JS client + RLS + Edge Functions |
| `src/core/` (config, security) | Supabase Auth + Vault |
| `src/db/` (base, seed) | Supabase SQL migrations + seed.sql |
| `src/models/` (SQLAlchemy) | SQL migrations en `supabase/migrations/` |
| `src/services/` (report, email, parser, sanitize) | Edge Functions en `supabase/functions/` |
| `src/integration/` (SyncPayload, adapters) | Futuro: Edge Function sync |
| `alembic/` | Supabase CLI migrations |
| `deploy.sh` | GitHub Actions deploy |
| `docker-compose.yml` | Supabase local CLI |
| `requirements.in / requirements.txt` | No aplica |
| `pyproject.toml` | No aplica (o se reduce a config de tests) |
| `scripts/backup-ra.sh` | Supabase backups automáticos |
| `scripts/seed_admin.py` | `supabase/seed.sql` |
| `tests/` (Python tests) | Tests E2E Playwright + tests SQL |
| `.venv/` | No aplica |

---

## 5. Estructura Objetivo del Repositorio

```
RA-Assessment-MVP/
├── index.html                      # Landing page → redirige a frontend/
├── frontend/
│   ├── index.html                  # Login page (Supabase Auth)
│   ├── dashboard.html              # Dashboard docente/líder
│   ├── assessment.html             # Wizard de calificación
│   ├── css/
│   │   └── main.css                # IUB design tokens (sin cambios)
│   ├── js/
│   │   ├── supabase-client.js      # NEW: init Supabase JS client
│   │   ├── auth.js                 # REWRITE: Supabase Auth
│   │   ├── dashboard.js            # REWRITE: Supabase queries
│   │   ├── module_assessment.js    # REWRITE: Supabase queries
│   │   └── api.js                  # NEW: helper functions for Supabase calls
│   └── static/
│       └── templates/              # CSV templates (sin cambios)
├── supabase/
│   ├── config.toml                 # Supabase project config
│   ├── migrations/                 # SQL migrations (ordered)
│   │   ├── 0001_users.sql
│   │   ├── 0002_student_outcomes.sql
│   │   ├── 0003_periods_rubrics.sql
│   │   ├── 0004_modules_students.sql
│   │   ├── 0005_assessments_analysis.sql
│   │   ├── 0006_leader_actions.sql
│   │   ├── 0007_security_events.sql
│   │   └── 0008_rls_policies.sql   # Row Level Security
│   ├── seed.sql                    # Datos demo (admin, líder, docente)
│   └── functions/                  # Edge Functions (Deno/TypeScript)
│       ├── sanitize/               # bleach.clean() + safe_cell_value()
│       ├── report-abet/            # Generación PDF/XLSX reporte ABET
│       ├── report-leader/          # Generación PDF/DOCX informe líder
│       ├── bulk-import/            # Carga masiva CSV/XLSX
│       ├── reminders/              # Envío de recordatorios (email)
│       └── habeas-data/            # Consulta y supresión Ley 1581
├── docs/                           # Documentación (actualizada)
│   ├── PRD.md
│   ├── ARCHITECTURE.md             # REWRITE: arquitectura Supabase
│   ├── DATA_MODEL.md               # UPDATE: tipos Supabase
│   ├── MIGRATION_PLAN.md           # Este archivo
│   └── ...
├── memory/                         # Memoria del proyecto (actualizada)
├── tests/
│   └── e2e/                        # Tests Playwright (adaptados)
├── .github/
│   └── workflows/
│       └── deploy.yml              # GitHub Actions → Pages
├── .gitignore
└── README.md
```

---

## 6. Migración del Modelo de Datos

### 6.1 Tablas a migrar (20 tablas)

Cada tabla del DATA_MODEL se convierte en una migración SQL. Los tipos
SQLAlchemy se traducen a PostgreSQL nativo (compatible con Supabase):

| SQLAlchemy | PostgreSQL (Supabase) |
|-----------|----------------------|
| `Column(Integer, primary_key=True)` | `SERIAL PRIMARY KEY` o `BIGINT GENERATED BY DEFAULT AS IDENTITY` |
| `Column(String(200))` | `VARCHAR(200)` |
| `Column(Text)` | `TEXT` |
| `Column(Boolean, default=True)` | `BOOLEAN DEFAULT TRUE` |
| `Column(DateTime(timezone=True))` | `TIMESTAMPTZ` |
| `Column(Numeric(5,2))` | `NUMERIC(5,2)` |
| `Column(JSONB)` | `JSONB` |
| `ForeignKey("users.id")` | `REFERENCES users(id)` |
| `UniqueConstraint(...)` | `UNIQUE(...)` |

### 6.2 Tablas que cambian

| Tabla | Cambio |
|-------|--------|
| `users` | `hashed_password` se elimina (Supabase Auth maneja passwords). Se añade `auth_id UUID REFERENCES auth.users(id)`. |
| `revoked_tokens` | Se elimina — Supabase Auth maneja sesiones. |
| `oracle_sync_log` | Se mantiene pero no se usa hasta F17. |

### 6.3 Row Level Security (RLS)

Cada tabla requiere políticas RLS que reemplazan `verify_module_ownership()`
y `require_role()`:

```sql
-- Ejemplo: solo el docente asignado puede escribir assessments de su módulo
CREATE POLICY "teacher_write_own_module_assessments"
ON assessments FOR INSERT
WITH CHECK (
  auth.uid() IN (
    SELECT u.id FROM users u
    JOIN module_staff ms ON ms.user_id = u.id
    JOIN module_students mst ON mst.id = module_student_id
    WHERE ms.module_id = mst.module_id
  )
);
```

---

## 7. Migración de Auth

### Actual
- POST /auth/login → JWT httpOnly cookie
- POST /auth/logout → JTI blocklist
- verify_module_ownership() en cada endpoint
- require_role() para admin/leader

### Destino
- Supabase Auth UI o `supabase.auth.signInWithPassword()`
- Session manejada por Supabase JS client (localStorage)
- RLS policies en PostgreSQL para ownership
- `users.role` verificado vía RLS o app logic

### Impacto en frontend
- `frontend/js/auth.js`: reescribir completamente
- `frontend/js/dashboard.js`: cambiar `fetch()` a `supabase.from()`
- Todas las llamadas API cambian de `/api/v1/...` a `supabase.from('table').select()`

---

## 8. Migración de Lógica de Negocio

### 8.1 Endpoints que se convierten en queries Supabase directas

Todos los GET/POST/PUT simples se convierten en llamadas al Supabase JS client:

```javascript
// Antes: GET /api/v1/periods
const res = await fetch('/api/v1/periods', { credentials: 'same-origin' });
const data = await res.json();

// Ahora: Supabase
const { data, error } = await supabase
  .from('periods')
  .select('*, modules:modules(count)');
```

### 8.2 Lógica compleja → Edge Functions

| Feature | Edge Function | Justificación |
|---------|---------------|---------------|
| Carga masiva CSV/XLSX | `bulk-import` | Parseo defensivo, validación, upsert masivo |
| Reporte ABET PDF | `report-abet` | Agregación de datos + render PDF |
| Reporte ABET XLSX | `report-abet` | safe_cell_value() + formato institucional |
| Informe líder PDF/DOCX | `report-leader` | Consolidación de análisis + render |
| Recordatorios email | `reminders` | Envío SMTP con throttle |
| Sanitización texto | `sanitize` | bleach.clean() + safe_cell_value() |
| Cierre de período | `period-close` | Validación de módulos pendientes + transacción |
| Habeas data | `habeas-data` | Consulta de titular + supresión |

### 8.3 Ejemplo: Edge Function de sanitización

```typescript
// supabase/functions/sanitize/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const { text, mode } = await req.json();
  
  if (mode === "clean") {
    // bleach.clean() equivalent: strip all HTML
    const cleaned = text.replace(/<[^>]*>/g, "");
    return new Response(JSON.stringify({ result: cleaned }));
  }
  
  if (mode === "safe_cell") {
    // safe_cell_value() equivalent
    const prefixes = ["=", "+", "-", "@", "\t", "\r"];
    const safe = prefixes.some(p => text.startsWith(p)) ? `'${text}` : text;
    return new Response(JSON.stringify({ result: safe }));
  }
  
  return new Response(JSON.stringify({ error: "Invalid mode" }), { status: 400 });
});
```

---

## 9. GitHub Pages — Configuración

### 9.1 Estructura de archivos para GH Pages

GitHub Pages sirve desde la raíz del repo o desde `/docs`. Usaremos la raíz:

```
RA-Assessment-MVP/
├── index.html              → https://dfdomin.github.io/RA-Assessment-MVP/
├── frontend/
│   ├── dashboard.html      → https://.../frontend/dashboard.html
│   └── ...
```

### 9.2 GitHub Actions workflow (deploy automático)

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - uses: actions/deploy-pages@v4
```

---

## 10. Limitaciones y Riesgos

### 10.1 Lo que NO se puede hacer igual que en FastAPI

| Feature | Limitación | Alternativa |
|---------|-----------|-------------|
| Reporte PDF server-side | Edge Functions tienen límite de 10s/request | Generar en cliente con jsPDF, o usar Edge Function con timeout extendido |
| Carga masiva >2MB | Edge Functions límite ~6MB payload | Chunked upload o procesar en cliente |
| Rate limiting granular | Supabase rate limits son por proyecto, no por endpoint | Usar RLS + contadores en tabla |
| JWT blocklist inmediata | Supabase Auth no soporta JTI blocklist | Usar `auth.users.banned_until` o Edge Function |
| Email desde el servidor | Edge Functions pueden enviar email | Usar Resend, SendGrid o Supabase SMTP |

### 10.2 Funcionalidades diferidas (fuera del MVP)

- **F12 Microsoft OIDC**: Requiere Azure AD config. Se puede añadir luego como provider de Supabase Auth.
- **F17 oracle_adapter**: Bloqueado por PREREQ-01/02/03. Fuera del alcance del MVP.
- **Backups GPG**: Supabase maneja backups automáticos en plan Pro. En free tier, export manual.

---

## 11. Orden de Ejecución (28 tareas)

### Bloque A — Setup Supabase (4 tareas)
- [x] A1. Crear proyecto Supabase (free tier)
- [x] A2. Instalar Supabase CLI local
- [x] A3. Escribir migraciones SQL para 20 tablas
- [x] A4. Ejecutar migraciones y verificar schema

### Bloque B — Auth y Core (5 tareas)
- [x] B1. Configurar Supabase Auth en frontend (signIn, signOut, session)
- [x] B2. Reescribir frontend/js/auth.js con Supabase
- [x] B3. Migrar seed data (admin, líder, docente)
- [x] B4. Adaptar frontend/js/dashboard.js — queries de períodos/módulos
- [x] B5. Escribir RLS policies para users, periods, modules

### Bloque C — CRUD Módulos y Calificaciones (4 tareas)
- [x] C1. Adaptar frontend/js/module_assessment.js
- [x] C2. Escribir RLS policies para assessments, module_analysis
- [x] C3. Adaptar wizard de calificación (5 pasos)
- [x] C4. Adaptar import de estudiantes (Edge Function `bulk-import`)

### Bloque D — Features de líder (4 tareas)
- [x] D1. Adaptar leader_analysis en dashboard
- [x] D2. Adaptar action_plans en dashboard
- [x] D3. Adaptar cierre/re-apertura de período (cliente; validación server pendiente)
- [x] D4. Adaptar recordatorios (insert en `reminder_log`)

### Bloque E — Reportes (4 tareas)
- [x] E1. Edge Function reporte ABET PDF
- [x] E2. Edge Function reporte ABET XLSX
- [x] E3. Edge Function informe líder PDF/DOCX
- [x] E4. Adaptar frontend para descarga de reportes (`frontend/js/api.js`)

### Bloque F — Carga Masiva y Admin (3 tareas)
- [x] F1. Edge Function bulk-import (CSV/XLSX)
- [ ] F2. Adaptar frontend admin para carga masiva (UI admin pendiente)
- [x] F3. Edge Function habeas-data

### Bloque G — Deploy y QA (4 tareas)
- [x] G1. Configurar GitHub Actions → Pages
- [ ] G2. Verificar deploy en https://dfdomin.github.io/RA-Assessment-MVP/
- [x] G3. Adaptar tests frontend/E2E para Supabase (estáticos + scaffold live)
- [ ] G4. Mobile-first audit + WCAG 2.1 AA

---

## 12. Notas para el Desarrollo

1. **No mezclar los dos repos**: RA-Assessment-App (FastAPI) sigue intacto. Este MVP es independiente.
2. **Supabase JS client v2**: usar `@supabase/supabase-js` desde CDN (no npm).
3. **Sin build step**: igual que el original, todo es vanilla HTML/CSS/JS.
4. **RLS primero**: escribir políticas RLS ANTES de adaptar el frontend. Así los queries fallan rápido si hay bugs de permisos.
5. **Edge Functions en Deno/TypeScript**: no Python. Sintaxis similar pero ecosistema diferente.
6. **La imagen de referencia "Falta seguir ese estilo.png" NO existe en este repo** — si se necesita, copiarla del original.

---

> **Archivo generado**: 2026-06-01 · RA-Assessment-MVP · IUB/Unibarranquilla
