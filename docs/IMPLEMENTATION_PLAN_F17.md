# IMPLEMENTATION_PLAN_F17.md — Reporte Ejecutivo por Línea Propedéutica

**Versión**: 1.0  
**Fecha**: 2026-05-16  
**Referencia PRD**: F17 (§8), §12 enmendado, DATA_MODEL §3.23–3.24  
**Decisión origen**: LLM Council 2026-05-16 (`docs/council-transcript-20260516-083133.md`)  
**Sprint de implementación**: S7 (post-despliegue TGA v1)

---

## 1. Contexto y Decisiones Arquitectónicas

### 1.1 Qué se implementó en S1 (esta sesión)

| Artefacto | Estado |
|---|---|
| PRD §12 enmendado — multi-programa reclasificado a v2 | ✅ Completado |
| PRD F17 especificado completo | ✅ Completado |
| DATA_MODEL §3.23 `propedeutic_lines` | ✅ Completado |
| DATA_MODEL §3.24 `programs` | ✅ Completado |
| DATA_MODEL §3.2 `student_outcomes.program_id` (FK nullable) | ✅ Completado |
| ROLE_PERMISSION_MATRIX §7 — F17 sin rol `dean` separado | ✅ Completado |
| `src/models/program.py` — ORM `PropedeuticLine`, `Program` | ✅ Completado |
| `src/models/student_outcome.py` — `program_id FK` nullable | ✅ Completado |
| `src/models/__init__.py` — exports actualizados | ✅ Completado |
| 38/38 tests pasando — 0 regresiones | ✅ Verificado |

### 1.2 Qué NO se implementa hasta S7

- Migración Alembic para `propedeutic_lines` y `programs` (requiere PostgreSQL en staging)
- Seed de datos reales IUB
- Router `dean_report.py` con endpoints de summary y PDF
- Tests de integración de F17

### 1.3 Decisión sobre el rol `dean`

**No existe `dean` como rol de usuario en v1.** El resumen ejecutivo institucional lo genera el Admin o Líder y lo envía al Decano como PDF. Esto:
- Reduce la superficie de ataque (un usuario menos con credenciales)
- Elimina complejidad de autorización para un caso de uso esporádico
- Es consistente con el uso real del cargo (1-2 veces por período)

---

## 2. Tareas S7 — Implementación F17 Completa

### TAREA S7-01: Migración Alembic `0002_programs_propedeutic_lines`

**Descripción**: Generar y aplicar migración que crea `propedeutic_lines`, `programs` y añade `program_id` a `student_outcomes`.

```bash
alembic revision --autogenerate -m "programs_propedeutic_lines"
alembic upgrade head
```

**Criterio de done**: `alembic current` muestra la revisión `0002`; tablas visibles en PostgreSQL staging.  
**Dependencias**: PREREQ-S7-01 (PostgreSQL staging disponible con S1–S6 migrado).

---

### TAREA S7-02: Seed de programas e instituciones IUB reales

**Descripción**: Crear `scripts/seed_programs.py` que inserta datos reales de la IUB.

```python
PROPEDEUTIC_LINES = [
    {"code": "LP-INFORMATICA", "name": "Informática y Telecomunicaciones"},
    {"code": "LP-GESTION",    "name": "Gestión Administrativa"},
]

PROGRAMS = [
    # LP-INFORMATICA
    {"code": "TEC-TELECOM",    "name": "Técnico en Telecomunicaciones",    "cycle_level": "técnico",     "faculty": "FCIT"},
    {"code": "TGLI",           "name": "Tecnología en Telemática y Redes", "cycle_level": "tecnología",  "faculty": "FCIT"},
    {"code": "ING-TELEMATICA", "name": "Ingeniería Telemática",            "cycle_level": "profesional", "faculty": "FCIT"},
    # LP-GESTION
    {"code": "TGA",            "name": "Tecnología en Gestión Administrativa", "cycle_level": "tecnología",  "faculty": "FCCEA"},
    {"code": "ING-NEGOCIOS",   "name": "Profesional en Inteligencia de Negocios", "cycle_level": "profesional", "faculty": "FCCEA"},
]
```

**Criterio de done**: `python scripts/seed_programs.py --env staging` inserta sin duplicados; idempotente.

---

### TAREA S7-03: Router `src/api/routers/dean_report.py`

**Endpoints**:

```
GET  /api/v1/propedeutic-lines
     → Lista líneas activas. Roles: admin, leader.

GET  /api/v1/propedeutic-lines/{id}/summary
     → Agrega resultados por programa en la línea.
     → Retorna JSON con distribución de niveles por SO, períodos cerrados, estado plan de acción.
     → Roles: admin, leader.

GET  /api/v1/propedeutic-lines/{id}/report/pdf
     → Genera PDF del summary anterior.
     → Content-Type: application/pdf; Content-Disposition: attachment.
     → Roles: admin, leader.

GET  /api/v1/programs
     → Lista programas. Query param: ?propedeutic_line_id=1
     → Roles: admin, leader.
```

**Librerías para PDF**: `reportlab` o `weasyprint` (decidir en S7 según disponibilidad en servidor Hetzner).

**Criterio de done**: Los 4 endpoints retornan datos correctos; datos son agregados (sin info individual de estudiantes); tests I-S7-F17-01 a 04 pasan.

---

### TAREA S7-04: Schemas Pydantic para F17

**Archivo**: `src/api/schemas/dean_report.py`

```python
class ProgramSummary(BaseModel):
    program_code: str
    program_name: str
    cycle_level: str
    closed_periods: int
    outcomes: list[OutcomeSummary]
    action_plan_status: str  # "compliant" | "pending" | "overdue"

class OutcomeSummary(BaseModel):
    so_code: str
    poor_pct: float
    inadequate_pct: float
    adequate_pct: float
    exemplary_pct: float

class PropedeuticLineSummary(BaseModel):
    line_code: str
    line_name: str
    programs: list[ProgramSummary]
    generated_at: datetime
```

---

### TAREA S7-05: Tests de F17

**Archivo**: `tests/test_dean_report.py`

| Test ID | Descripción |
|---|---|
| I-S7-F17-01 | Admin puede acceder a `GET /propedeutic-lines` |
| I-S7-F17-02 | Líder puede acceder a `GET /propedeutic-lines/{id}/summary` |
| I-S7-F17-03 | Docente recibe 403 en `GET /propedeutic-lines/{id}/summary` |
| I-S7-F17-04 | Summary no contiene datos individuales de estudiantes |
| I-S7-F17-05 | `GET /propedeutic-lines/{id}/report/pdf` retorna Content-Type `application/pdf` |
| S-S7-F17-01 | Inyección de `propedeutic_line_id` inválido retorna 422 |

---

### TAREA S7-06: Registrar router en `main.py`

```python
from src.api.routers import dean_report
app.include_router(dean_report.router, prefix="/api/v1")
```

---

## 3. Diagrama de Secuencia — `GET /propedeutic-lines/{id}/summary`

```
Cliente (Líder/Admin)
    │
    ├─► GET /api/v1/propedeutic-lines/2/summary
    │       Cookie: httpOnly JWT
    │
    ▼
FastAPI Router
    ├─ verify JWT + role in ["admin", "leader"]
    ├─ SELECT programs WHERE propedeutic_line_id = 2
    │
    ├─ FOR each program:
    │    SELECT student_outcomes WHERE program_id = program.id
    │    FOR each SO:
    │      SELECT assessments WHERE period.status = "closed"
    │      AGGREGATE level distribution (COUNT GROUP BY level_label)
    │      COMPUTE percentages
    │
    └─► JSON response: PropedeuticLineSummary
```

---

## 4. Prerequisitos para S7

| Prereq | Descripción | Responsable |
|---|---|---|
| PREREQ-S7-01 | PostgreSQL staging con TGA v1 desplegado y al menos 1 período cerrado | DevOps / DBA |
| PREREQ-S7-02 | Datos reales de programas IUB confirmados por Vicerrectoría Académica | Coordinador TGA |
| PREREQ-S7-03 | Decisión sobre librería PDF (reportlab vs weasyprint) según entorno Hetzner | Dev |
| PREREQ-S7-04 | Concepto jurídico confirmado para agregación de datos inter-programa (ver PREREQ-03 general) | Área jurídica IUB |

---

## 5. Criterio de Done para S7 completo

```
✅ alembic upgrade head — 0002 aplicada en staging
✅ seed_programs.py — 5 programas + 2 líneas insertados
✅ GET /propedeutic-lines/2/summary → JSON con datos TGA (al menos 1 período cerrado real)
✅ GET /propedeutic-lines/2/report/pdf → PDF descargable
✅ pytest tests/test_dean_report.py → 6/6 passing
✅ bandit -r src/ -ll -ii → 0 medium/high
✅ Docente recibe 403 en todos los endpoints F17
✅ Sin datos individuales de estudiantes en ninguna respuesta F17
```
