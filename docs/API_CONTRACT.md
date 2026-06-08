# API_CONTRACT.md — RA Assessment App

**Versión del documento**: 1.0  
**Fecha**: 2026-05-15  
**Referencia PRD**: §8 (API REST) y secciones de features F01–F15  
**Audiencia**: Desarrolladores frontend, integradores, QA

> Un desarrollador frontend que lea este documento puede integrar con la API sin necesidad de leer el PRD.

---

## 1. Convenciones Generales

### Base URL

```
Producción:  https://ra-assessment.iub.edu.co/api/v1
Desarrollo:  http://localhost:8000/api/v1
```

### Autenticación

- Todos los endpoints protegidos requieren un JWT válido almacenado en **cookie httpOnly** (`ra_session`).
- El cookie se emite al hacer login y se invalida al hacer logout (JTI insertado en `revoked_tokens`).
- Expiración: **8 horas** desde la emisión.
- En cada request autenticado el servidor verifica: firma JWT válida + JTI no revocado + rol suficiente.

### Roles

| Rol | Valor en token | Descripción |
|---|---|---|
| `admin` | `"admin"` | Administrador del sistema — acceso total |
| `leader` | `"leader"` | Líder del programa — gestiona períodos, genera reportes; puede evaluar módulos solo si está asignado en `module_staff` |
| `teacher` | `"teacher"` | Docente — accede solo a sus módulos asignados |

**Autorización contextual de módulos**: para acciones de escritura sobre módulos (`PUT /modules/{id}/assessments`, `POST /modules/{id}/students/import`, `PUT /modules/{id}/qualitative`, `PUT /modules/{id}/submit`), el rol global no basta. El usuario debe estar asignado al módulo en `module_staff`. Esto permite que un `leader` autorizado administrativamente actúe como evaluador de su propio RA/SO o de otro RA/SO sin abrir acceso a módulos no asignados.

### Códigos de Error Comunes

| Código | Significado |
|---|---|
| `400` | Bad Request — parámetros inválidos o falta `consent_acknowledged` |
| `401` | Unauthorized — sin cookie JWT o token expirado |
| `403` | Forbidden — rol insuficiente para el endpoint |
| `404` | Not Found — recurso no existe **o** el docente no tiene acceso a él (IDOR intencional) |
| `413` | Payload Too Large — archivo supera 2 MB |
| `415` | Unsupported Media Type — tipo de archivo no permitido |
| `422` | Unprocessable Entity — validación Pydantic falló (incluye suma de pesos ≠ 100%) |
| `429` | Too Many Requests — rate limit excedido |

### Rate Limits

| Endpoint / Operación | Límite | Scope |
|---|---|---|
| `POST /auth/login` | 5 req / minuto | Por IP |
| `POST /periods/{id}/reminders` | 15 destinatarios / 60 s | Por usuario |

### Paginación

Los endpoints de listado que pueden retornar muchos registros aceptan query params `?page=1&page_size=50`.

---

## 2. Grupo AUTH

### `POST /auth/login`

Autentica al usuario y emite el cookie de sesión.

**Rate limit**: 5 req/min por IP. Cada fallo registra `login_failed` en el audit log.

**Request**:
```json
{
  "email": "docente@iub.edu.co",
  "password": "contraseña_plana"
}
```

**Response 200**:
```json
{
  "user_id": 42,
  "full_name": "María García",
  "role": "teacher",
  "expires_at": "2026-05-15T22:00:00Z"
}
```
Cookie `ra_session` (httpOnly, Secure, SameSite=Strict) emitido en el header `Set-Cookie`.

**Errores**: `401` credenciales incorrectas | `429` rate limit

---

### `POST /auth/logout`

Invalida el token actual (inserta JTI en `revoked_tokens`).

**Auth requerida**: Sí  
**Response 200**: `{ "message": "Logged out successfully" }`

---

### `GET /auth/oidc/microsoft`

Redirige al flujo de autenticación Microsoft OIDC. Solo disponible si `MICROSOFT_CLIENT_ID` está configurado en el servidor.

**Auth requerida**: No  
**Response**: `302 Redirect` a `login.microsoftonline.com`  
**Si OIDC no configurado**: `503 Service Unavailable`

---

### `GET /auth/oidc/microsoft/callback`

Callback del flujo OIDC. Valida el `id_token` (firma criptográfica, `iss`, `aud`, `exp`) y crea la sesión interna.

**Auth requerida**: No  
**Response 200**: igual que `/auth/login` exitoso  
**Errores**: `401` validación del id_token falló | `403` usuario no registrado en el sistema (estado pendiente de rol)

---

## 3. Grupo PERIODS

### `GET /periods`

Lista períodos académicos. El docente solo ve los períodos donde tiene módulos asignados.

**Auth requerida**: Sí  
**Roles permitidos**: Admin, Líder (todos), Docente (filtrado)

**Response 200**:
```json
[
  {
    "id": 1,
    "name": "TGA RA1 2024-2",
    "student_outcome_code": "RA1",
    "status": "open",
    "start_date": "2024-09-01",
    "end_date": "2024-12-15",
    "modules_total": 8,
    "modules_completed": 5
  }
]
```

---

### `POST /periods`

Crea un nuevo período académico.

**Roles permitidos**: Admin, Líder

**Request**:
```json
{
  "name": "TGA RA1 2025-1",
  "student_outcome_id": 1,
  "start_date": "2025-01-15",
  "end_date": "2025-05-30",
  "clone_from_period_id": 1
}
```
El campo `clone_from_period_id` es opcional; si se provee, clona la rúbrica y los módulos del período origen.

**Response 201**:
```json
{ "id": 2, "name": "TGA RA1 2025-1", "status": "draft" }
```

**Errores**: `422` nombre duplicado o `student_outcome_id` inexistente

---

### `PUT /periods/{id}/close`

Cierra el período de captura. Después del cierre, los docentes no pueden modificar calificaciones.

**Roles permitidos**: Admin, Líder  
**Nota de seguridad**: la acción se registra en `security_events` con evento `period_closed`.

**Request**:
```json
{
  "force": false
}
```
Si `force: false` y hay módulos sin completar, devuelve `409 Conflict` con la lista de módulos pendientes. Si `force: true`, cierra con advertencia.

**Response 200**:
```json
{
  "period_id": 1,
  "status": "closed",
  "modules_pending": []
}
```

---

## 4. Grupo RUBRICS

### `GET /rubrics`

Lista rúbricas con sus PIs y pesos.

**Roles permitidos**: Admin, Líder, Docente (solo lectura)

**Response 200**:
```json
[
  {
    "id": 1,
    "student_outcome_code": "RA1",
    "period_id": 1,
    "perf_indicators": [
      {
        "id": 10,
        "code": "PI1",
        "description": "Identificar necesidades y problemáticas…",
        "pi_weight": 30.00,
        "is_active": true,
        "levels": [
          { "level_value": 1, "label": "Poor", "descriptor": "El estudiante no logra…" },
          { "level_value": 2, "label": "Inadequate", "descriptor": "El estudiante…" },
          { "level_value": 4, "label": "Adequate", "descriptor": "El estudiante…" },
          { "level_value": 5, "label": "Exemplary", "descriptor": "El estudiante…" }
        ]
      }
    ]
  }
]
```

---

### `POST /rubrics`

Crea una nueva rúbrica para un período/SO. **La suma de `pi_weight` de PIs activos debe ser exactamente 100.**

**Roles permitidos**: Admin, Líder

**Request**:
```json
{
  "student_outcome_id": 1,
  "period_id": 2,
  "perf_indicators": [
    {
      "code": "PI1",
      "description": "Identificar necesidades…",
      "pi_weight": 30.00,
      "is_active": true,
      "levels": [
        { "level_value": 1, "label": "Poor", "descriptor": "…" },
        { "level_value": 2, "label": "Inadequate", "descriptor": "…" },
        { "level_value": 4, "label": "Adequate", "descriptor": "…" },
        { "level_value": 5, "label": "Exemplary", "descriptor": "…" }
      ]
    }
  ]
}
```

**Errores**: `422` si la suma de pesos activos ≠ 100%

---

### `POST /rubrics/{id}/clone`

Clona una rúbrica existente para un nuevo período, preservando PIs y descriptores.

**Roles permitidos**: Admin, Líder

**Request**:
```json
{ "target_period_id": 3 }
```

**Response 201**:
```json
{ "id": 5, "cloned_from": 1, "period_id": 3 }
```

---

## 5. Grupo MODULES

### `GET /periods/{period_id}/modules`

Lista los módulos de un período con su estado de completitud.

**Roles permitidos**: Admin, Líder (todos los módulos); Docente (solo sus módulos asignados)

**Response 200**:
```json
[
  {
    "id": 1,
    "course_code": "CONT101",
    "course_name": "Contabilidad I",
    "group_name": "A",
    "status": "in_progress",
    "teacher": { "id": 42, "full_name": "María García" },
    "students_active": 31,
    "students_graded": 28,
    "last_updated": "2026-05-14T18:30:00Z"
  }
]
```

---

### `PUT /modules/{id}/submit`

El docente envía su módulo como completado. Verifica que todos los estudiantes activos tengan todos los PIs activos calificados y todos los análisis escritos.

**Roles permitidos**: Docente o Líder asignado al módulo  
**Seguridad**: `verify_module_ownership` — devuelve `404` si el usuario no está asignado al módulo

**Response 200**:
```json
{ "module_id": 1, "status": "completed", "submitted_at": "2026-05-15T14:00:00Z" }
```

**Errores**: `409 Conflict` si hay estudiantes activos sin calificar o análisis faltantes

---

## 6. Grupo ASSESSMENTS

### `GET /modules/{id}/assessments`

Obtiene todas las calificaciones del módulo con distribución de niveles calculada.

**Roles permitidos**: Admin, Líder; Docente o Líder asignado (módulo propio — `verify_module_ownership`)

**Response 200**:
```json
{
  "module_id": 1,
  "students": [
    {
      "module_student_id": 100,
      "student_name": "García Pérez, María",
      "status": "active",
      "assessments": [
        { "perf_indicator_id": 10, "pi_code": "PI1", "level": 4 }
      ],
      "total_score": 3.15,
      "standard": "Medium"
    }
  ],
  "distribution": {
    "PI1": { "Poor": 6, "Inadequate": 16, "Adequate": 58, "Exemplary": 20 }
  }
}
```

---

### `PUT /modules/{id}/assessments`

Guarda (como borrador o final) las calificaciones de uno o más estudiantes.

**Roles permitidos**: Docente o Líder asignado al módulo  
**Seguridad**: `verify_module_ownership`

**Request**:
```json
{
  "assessments": [
    { "module_student_id": 100, "perf_indicator_id": 10, "level": 4 },
    { "module_student_id": 100, "perf_indicator_id": 11, "level": 5 }
  ]
}
```
Acepta uno o múltiples registros en el mismo request (upsert por `module_student_id + perf_indicator_id`).

**Errores**: `422` si `level` ∉ {1, 2, 4, 5} (el valor 3 no existe) | `404` ownership check falla

---

## 7. Grupo STUDENTS

### `POST /functions/v1/students-import` (MVP — Edge Function)

Reemplaza en producción a los endpoints FastAPI legacy. Mismo contrato lógico ADR-0002.

**Request** (`multipart/form-data`):

| Campo | Valores |
|---|---|
| `action` | `preview` \| `import` |
| `module_id` | ID del módulo |
| `file` | PDF Academusoft (`application/pdf`) |
| `consent_acknowledged` | `true` — obligatorio solo en `action=import` |

**Roles**: docente asignado en `module_staff` (vía JWT Supabase).

---

### `POST /modules/{id}/students/import/preview` (legacy FastAPI)

Parsea un PDF Academusoft sin escribir en BD (ADR-0002). Referencia en `src/`.

**Roles permitidos**: Docente o Líder asignado al módulo  
**MIME**: `application/pdf` únicamente

**Response 200**:
```json
{
  "module_id": 12,
  "pdf_materia": "ADM18-PROCESAMIENTO DE LA INFORMACIÓN…",
  "pdf_group": "1_CE_G2",
  "pdf_course_code": "ADM18",
  "students": [
    { "roster_position": 1, "document_number": "1042856266", "full_name": "AFANADOR VIDES SHARIT" }
  ],
  "warnings": ["2 estudiantes activos del módulo no aparecen en este PDF — revíselos y exclúyalos si corresponde."]
}
```

**422** si Materia/Grupo del PDF no coinciden con el módulo abierto.

---

### `POST /modules/{id}/students/import`

Importa la lista de estudiantes desde PDF Academusoft, CSV o XLSX.

**Roles permitidos**: Docente o Líder asignado al módulo
**Seguridad**: `verify_module_ownership`
**Seguridad**: parser defensivo — ver `SECURITY_PRIVACY.md §3`

**Request**: `multipart/form-data`
```
file: [reporte.pdf | archivo.csv | archivo.xlsx]
consent_acknowledged: true   # obligatorio (Ley 1581/2012)
```

**Límites del parser**:
- Tamaño máximo: **2 MB**
- Máximo de estudiantes: **100 por import**
- MIME types: `application/pdf`, `text/csv`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- PDF: upsert por `document_number`; `internal_id` = documento; `roster_position` = columna `No.`
- CSV/XLSX: columnas `internal_id, document_number, full_name`; rechaza fórmulas (`=`, `+`, `-`, `@`, `|`, `%`)

**Response 200**:
```json
{
  "module_id": 12,
  "imported": 31,
  "updated": 0,
  "skipped": 0,
  "errors": [],
  "warnings": [],
  "students": [{ "internal_id": "1042856266", "full_name": "…", "action": "created" }]
}
```

**Errores**: `413` archivo > 2 MB | `415` tipo MIME no permitido | `422` campo inválido o fórmula detectada

---

## 8. Grupo QUALITATIVE

### `GET /modules/{id}/qualitative`

Obtiene el análisis cualitativo del docente por PI.

**Roles permitidos**: Admin, Líder; Docente o Líder asignado (módulo propio — `verify_module_ownership`)

**Response 200**:
```json
{
  "module_id": 1,
  "analyses": [
    {
      "perf_indicator_id": 10,
      "pi_code": "PI1",
      "analysis_text": "Los resultados muestran que el 64% de los estudiantes…"
    }
  ]
}
```

---

### `PUT /modules/{id}/qualitative`

Guarda el análisis cualitativo. El texto se sanitiza con `bleach.clean()` antes de persistir.

**Roles permitidos**: Docente o Líder asignado al módulo  
**Seguridad**: `verify_module_ownership`; sanitización HTML obligatoria

**Request**:
```json
{
  "analyses": [
    {
      "perf_indicator_id": 10,
      "analysis_text": "El análisis indica que…"
    }
  ]
}
```

**Errores**: `422` si `analysis_text` supera 2000 caracteres | `404` ownership check

---

## 9. Grupo REPORT (Reporte ABET Final — F07)

### `GET /periods/{id}/report`

Retorna los datos del reporte consolidado en formato JSON (para previsualización en el frontend).

**Roles permitidos**: Admin, Líder

**Response 200** (estructura resumida):
```json
{
  "period": { "name": "TGA RA1 2024-2", "status": "closed" },
  "student_outcome": { "code": "RA1", "description": "…" },
  "modules_summary": [...],
  "distribution_by_pi": {
    "PI1": {
      "description": "Identificar necesidades…",
      "by_module": [
        { "module_id": 1, "Poor": 2, "Inadequate": 5, "Adequate": 18, "Exemplary": 6 }
      ],
      "consolidated": { "Poor": 10, "Inadequate": 20, "Adequate": 55, "Exemplary": 15 }
    }
  },
  "leader_analysis": { "PI1": "La síntesis del líder indica que…" },
  "action_plans": [...]
}
```

---

### `GET /periods/{id}/report/pdf`

Genera y descarga el reporte en PDF (WeasyPrint). Registra `report_exported` en audit log.

**Roles permitidos**: Admin, Líder  
**Response**: `Content-Type: application/pdf`; `Content-Disposition: attachment; filename="reporte-RA1-2024-2.pdf"`

**Prerequisitos para descarga**: `leader_analysis` y `action_plans` completos para todos los PIs activos (si no, `409 Conflict` con lista de PIs faltantes).

---

### `GET /periods/{id}/report/xlsx`

Genera y descarga el reporte en Excel (.xlsx). Aplica `safe_cell_value()` en todas las celdas con datos de usuarios.

**Roles permitidos**: Admin, Líder  
**Seguridad**: todos los campos de texto de usuarios son prefijados con `'` si comienzan con `=`, `+`, `-`, `@`, `|`, `%`  
**Response**: `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

---

## 10. Grupo LEADER REPORT (Informe del Líder — F14)

### `GET /periods/{period_id}/leader-report`

Obtiene el borrador actual del informe del líder con métricas consolidadas.

**Roles permitidos**: Admin, Líder

**Response 200**:
```json
{
  "period_id": 1,
  "pi_conclusions": {
    "10": "Las conclusiones del PI1 indican que…",
    "11": ""
  },
  "metrics_by_pi": { "PI1": { "Poor": 10, "Inadequate": 20, "Adequate": 55, "Exemplary": 15 } },
  "teacher_analyses": {
    "PI1": [
      { "module": "Contabilidad I — A", "text": "El análisis del docente…" }
    ]
  },
  "last_updated": "2026-05-14T18:30:00Z"
}
```

---

### `PUT /periods/{period_id}/leader-report`

Guarda las conclusiones del líder por PI (autosave — puede guardarse parcialmente).

**Roles permitidos**: Admin, Líder

**Request**:
```json
{
  "pi_conclusions": {
    "10": "Las conclusiones del PI1 indican que el programa debe reforzar…",
    "11": "El PI2 muestra resultados satisfactorios en la mayoría de módulos…"
  }
}
```

**Response 200**: `{ "saved": true, "last_updated": "2026-05-15T14:00:00Z" }`

---

### `GET /periods/{period_id}/leader-report/pdf`

Genera y descarga el informe del líder en PDF. Registra `leader_report_generated` en audit log.

**Roles permitidos**: Admin, Líder  
**Response**: `Content-Type: application/pdf`  
**Nombre de archivo**: `informe-lider-{periodo}-{YYYYMMDD-HHmmss}.pdf`

---

### `GET /periods/{period_id}/leader-report/docx`

Genera y descarga el informe del líder en DOCX. No contiene macros ni fórmulas ejecutables.

**Roles permitidos**: Admin, Líder  
**Seguridad**: `safe_cell_value()` aplicado en todos los campos de texto de usuarios  
**Response**: `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`

---

## 11. Grupo NOTIFICATIONS (Seguimiento y Recordatorios — F13)

### `GET /periods/{period_id}/tracking`

Retorna métricas de avance por docente en el período.

**Roles permitidos**: Admin, Líder

**Response 200**:
```json
[
  {
    "module_id": 1,
    "course_name": "Contabilidad I",
    "group_name": "A",
    "teacher": { "id": 42, "full_name": "María García", "email": "mgarcia@iub.edu.co" },
    "status": "in_progress",
    "students_graded": 28,
    "students_active": 31,
    "progress_pct": 90,
    "last_access": "2026-05-14T10:00:00Z",
    "days_remaining": 5
  }
]
```

---

### `POST /periods/{period_id}/reminders`

Envía correos de recordatorio a docentes con módulos pendientes.

**Roles permitidos**: Admin, Líder  
**Rate limit**: 15 destinatarios / 60 s por usuario  
**Seguridad**: solo acepta `recipient_ids` que sean usuarios con asignación activa en el período; rechaza emails externos.

**Request**:
```json
{
  "recipient_ids": [42, 43, 47],
  "message_body": "Estimado {nombre_docente}, te recordamos que el módulo {modulo} tiene un avance del {avance_pct}%..."
}
```

**Response 200**: `{ "sent": 3, "failed": 0 }`  
**Errores**: `400` si algún `recipient_id` no pertenece al período | `429` rate limit

---

### `GET /periods/{period_id}/reminders/preview`

Previsualiza el correo con variables resueltas para el primer destinatario de la lista.

**Roles permitidos**: Admin, Líder

**Request** (query params): `?recipient_ids=42,43&message_body=...`

**Response 200**:
```json
{
  "preview_for": { "id": 42, "full_name": "María García" },
  "subject": "Recordatorio: Assessment RA1 — módulo pendiente",
  "body_resolved": "Estimada María García, te recordamos que el módulo Contabilidad I — Grupo A tiene un avance del 90%..."
}
```

---

## 12. Grupo ADMIN — Habeas Data (Ley 1581/2012)

### `GET /admin/habeas-data/{doc_number}`

Exporta todos los datos del titular para responder peticiones de acceso (Artículo 8, Ley 1581/2012).

**Roles permitidos**: Admin **únicamente**  
**Seguridad**: registra `habeas_data_accessed` en audit log con hash parcial del documento

**Response 200**:
```json
{
  "document_number": "1234567890",
  "full_name": "García Pérez, María",
  "internal_id": "20241001",
  "modules": [
    {
      "period": "TGA RA1 2024-2",
      "course": "Contabilidad I — A",
      "assessments_count": 4,
      "is_suppressed": false
    }
  ]
}
```

---

### `PUT /admin/suppress/{student_id}`

Anonimiza los datos del estudiante (no eliminación física). Preserva integridad de reportes ABET.

**Roles permitidos**: Admin **únicamente**

**Response 200**:
```json
{ "student_id": 100, "suppressed": true, "suppressed_at": "2026-05-15T14:00:00Z" }
```

---

## 13. Grupo ADMIN BULK — Carga Masiva y CRUD Individual (F15)

Todos los endpoints de este grupo requieren rol **Admin exclusivamente**.

### `POST /admin/bulk/rubrics`

Importa rúbricas desde CSV/XLSX. Responde con `207 Multi-Status` con reporte fila a fila.

**Request**: `multipart/form-data; file=[archivo]`

**Response 207**:
```json
{
  "imported": 42,
  "failed": 2,
  "errors": [
    { "row": 5, "field": "pi_weight", "reason": "Los PIs del SO RA1 suman 95%, se requiere 100%" }
  ]
}
```

---

### `POST /admin/bulk/users`

Importa usuarios (docentes y líderes) desde CSV/XLSX. Crea cuentas con contraseña temporal y envía correo de activación.

**Formato CSV**: `nombre_completo | email_institucional | rol | programa`

**Response 207**: igual que `/admin/bulk/rubrics`

---

### `POST /admin/bulk/modules`

Importa módulos y asignaciones de un período desde CSV/XLSX.

**Formato CSV**: `period_id | curso_codigo | curso_nombre | grupo | docente_email`

**Response 207**: igual que `/admin/bulk/rubrics`

---

### `POST /admin/bulk/students`

Importa estudiantes desde CSV/XLSX. **Requiere `consent_acknowledged: true`** en el body.

**Request**: `multipart/form-data`
```
file=[archivo]
consent_acknowledged=true
```

**Errores**: `400` si `consent_acknowledged` es `false` o está ausente

**Response 207**: igual que `/admin/bulk/rubrics`

---

### CRUD Individual de Rúbricas

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/admin/rubrics` | Lista todas las rúbricas |
| `POST` | `/admin/rubrics` | Crea rúbrica individual (mismo schema que `POST /rubrics`) |
| `PUT` | `/admin/rubrics/{id}` | Edita rúbrica individual |

---

### CRUD Individual de Usuarios

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/admin/users` | Lista usuarios (`?role=teacher&is_active=true`) |
| `POST` | `/admin/users` | Crea usuario individual; genera contraseña temporal |
| `PUT` | `/admin/users/{id}` | Edita usuario (nombre, rol, estado) |

**Request `POST /admin/users`**:
```json
{
  "full_name": "Juan López",
  "email": "jlopez@iub.edu.co",
  "role": "teacher"
}
```

---

### CRUD Individual de Módulos

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/admin/modules` | Lista módulos de un período (`?period_id=1`) |
| `POST` | `/admin/modules` | Crea módulo individual |
| `PUT` | `/admin/modules/{id}` | Edita módulo (curso, grupo, docente asignado) |

---

### `GET /admin/templates/{entity}`

Descarga plantilla CSV de ejemplo para la entidad especificada.

**Parámetro `{entity}`**: `rubrics` | `users` | `modules` | `students`  
**Response**: `Content-Type: text/csv`; archivo estático desde `/static/templates/template_{entity}.csv`

---

## 13. Grupo SYNC (F16 — Ports & Adapters)

Endpoints de sincronización de datos externos mediante el contrato `SyncPayload`. Solo disponibles para rol `Admin`. Internamente consumen `SyncService` — el adaptador que produjo el payload es transparente para la API.

### `POST /admin/sync/preview`

Valida un `SyncPayload` sin persistir ningún dato. Permite al Admin verificar errores antes de aplicar.

**Roles**: Admin  
**Request**:
```json
{
  "periodo_codigo": "TGA-RA1-2025-1",
  "docentes": [{ "email": "jlopez@iub.edu.co", "full_name": "Juan López", "role": "teacher" }],
  "modulos": [{ "course_code": "ADM101", "course_name": "Administración I", "group_name": "01", "docente_email": "jlopez@iub.edu.co" }],
  "estudiantes": [{ "internal_id": "20250001", "document_number": "1012345678", "full_name": "Ana García", "modulo_id": "ADM101-01" }],
  "source": "csv",
  "consent_acknowledged": true
}
```

**Response 200** (payload válido):
```json
{
  "valid": true,
  "docentes_count": 12,
  "modulos_count": 8,
  "estudiantes_count": 246,
  "errors": []
}
```

**Response 422** (errores de validación):
```json
{
  "valid": false,
  "errors": [
    { "record_type": "estudiante", "index": 5, "field": "document_number", "reason": "Formato inválido" }
  ]
}
```

**Response 400**: `consent_acknowledged: false` con estudiantes en el payload → mensaje Ley 1581/2012.

---

### `POST /admin/sync/apply`

Aplica el `SyncPayload` validado (upsert por clave natural en `users`, `modules`, `students`). Registra `sync_applied` en `security_events` y crea fila en `oracle_sync_log`.

**Roles**: Admin  
**Request**: mismo schema que `POST /admin/sync/preview`.

**Response 207** (procesamiento parcial — mismo comportamiento que F15):
```json
{
  "docentes_imported": 12,
  "modulos_imported": 8,
  "estudiantes_imported": 246,
  "errors": []
}
```

**Response 400**: `consent_acknowledged: false` con estudiantes → el upsert no se ejecuta.

**Audit**: evento `sync_applied` en `security_events` con `source`, `periodo_codigo`, `counts`, `admin_id`.

---

### `GET /admin/sync/log`

Historial de sincronizaciones ejecutadas. Lee de `oracle_sync_log`.

**Roles**: Admin  
**Query params**: `?page=1&page_size=20&source=csv`

**Response 200**:
```json
[
  {
    "id": 14,
    "ts": "2025-10-15T09:32:00Z",
    "source": "csv",
    "periodo_codigo": "TGA-RA1-2025-1",
    "docentes_count": 12,
    "modulos_count": 8,
    "estudiantes_count": 246,
    "admin_id": 1,
    "detail": null
  }
]
```

---

## 14. Seguridad Transversal de la API

### Protección IDOR (`verify_module_ownership`)

Aplicada en **todos** los endpoints con `{module_id}` accesibles por docentes:

```
GET  /modules/{id}/assessments
PUT  /modules/{id}/assessments
POST /modules/{id}/students/import
GET  /modules/{id}/qualitative
PUT  /modules/{id}/qualitative
PUT  /modules/{id}/submit
```

El error retornado siempre es `404 Not Found` — nunca `403` — para no confirmar la existencia del recurso a un atacante.

### Sanitización de Texto

- Campos de análisis (`PUT /modules/{id}/qualitative`, `PUT /periods/{id}/leader-report`): `bleach.clean(text, tags=[], strip=True)` antes de persistir.
- Exportaciones PDF/XLSX/DOCX: `safe_cell_value()` en todas las celdas con datos de usuarios (previene Excel/DOCX injection).

### Registro en Audit Log

Los siguientes endpoints registran eventos en `security_events`:

| Endpoint | Evento registrado |
|---|---|
| `POST /auth/login` (exitoso) | `login_success` |
| `POST /auth/login` (fallido) | `login_failed` |
| `POST /auth/login` (rate limited) | `login_rate_limited` |
| `PUT /periods/{id}/close` | `period_closed` |
| `GET /periods/{id}/report/pdf` | `report_exported` |
| `GET /periods/{id}/report/xlsx` | `report_exported` |
| `POST /modules/{id}/students/import` | `student_imported` |
| `GET /admin/habeas-data/{doc}` | `habeas_data_accessed` |
| `GET /auth/oidc/microsoft/callback` | `oidc_login_success` / `oidc_login_failed` |
| `POST /periods/{id}/reminders` | `reminder_sent` |
| `GET /periods/{id}/leader-report/pdf` | `leader_report_generated` |
| `GET /periods/{id}/leader-report/docx` | `leader_report_generated` |
| `POST /admin/bulk/*` | `bulk_import_{entity}` |
