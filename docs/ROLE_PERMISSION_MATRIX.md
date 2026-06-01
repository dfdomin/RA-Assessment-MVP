# ROLE_PERMISSION_MATRIX.md — RA Assessment App

**Versión del documento**: 1.0  
**Fecha**: 2026-05-15  
**Referencia PRD**: §8 (API REST — autorización por endpoint), §3 (Roles), §16 (Postura de Seguridad)  
**Audiencia**: Desarrolladores, revisores de seguridad, QA

> Esta matriz cubre el 100% de los endpoints del PRD §8. Un revisor de seguridad puede verificar que no haya endpoint sin control de acceso.

---

## 1. Definición de Roles

| Rol | Valor en token | Descripción |
|---|---|---|
| **Admin** | `"admin"` | Acceso total al sistema; gestiona usuarios, configuraciones y carga masiva |
| **Líder** | `"leader"` | Gestiona períodos, rúbricas, módulos del programa; genera reportes; envía recordatorios. Puede actuar como evaluador de módulo solo si está asignado en `module_staff` |
| **Docente** | `"teacher"` | Accede **solo a sus módulos asignados**; ingresa calificaciones y análisis |

### Notas sobre casos límite

- **Líder que también es evaluador/docente**: el sistema soporta que un usuario con rol `leader` sea evaluador de un módulo de su propio RA/SO o de otro RA/SO. La condición no depende del RA/SO sino de la asignación explícita en `module_staff`. En endpoints de escritura de módulo, `verify_module_ownership` aplica igual a `leader` y `teacher`; el rol `leader` no bypassa ownership.
- **Un docente con múltiples módulos**: accede a todos sus módulos asignados en el período activo, pero solo a los suyos. `verify_module_ownership` verifica por cada módulo individualmente.
- **Admin actuando como líder**: el Admin tiene acceso a todos los endpoints del Líder. Puede crear períodos, configurar rúbricas y generar reportes sin ser explícitamente el líder del programa.
- **Política administrativa aprobada**: la IUB permite la asignación de un líder como evaluador si queda registrada en `module_staff`. Si el programa requiere revisión por pares o segundo aprobador en un caso particular, se documenta fuera del control de acceso; el software conserva la trazabilidad de quién evaluó y bajo qué asignación.

---

## 2. Leyenda de la Matriz

| Símbolo | Significado |
|---|---|
| ✅ | Acceso permitido sin restricción adicional |
| ✅ (propio) | Acceso permitido solo a recursos propios (via `verify_module_ownership`) |
| ❌ | Acceso denegado — retorna `403 Forbidden` |
| 🔒 | Acceso permitido con restricción especial documentada |

---

## 3. Matriz Completa de Permisos

### 3.1 Grupo AUTH

| Endpoint | Admin | Líder | Docente | Notas |
|---|---|---|---|---|
| `POST /auth/login` | ✅ | ✅ | ✅ | Sin autenticación previa; rate limit 5/min/IP |
| `POST /auth/logout` | ✅ | ✅ | ✅ | Revoca el propio token (JTI blocklist) |
| `GET /auth/oidc/microsoft` | ✅ | ✅ | ✅ | Solo disponible si `MICROSOFT_CLIENT_ID` configurado |
| `GET /auth/oidc/microsoft/callback` | ✅ | ✅ | ✅ | Callback OIDC — valida `id_token` antes de crear sesión |

---

### 3.2 Grupo PERIODS

| Endpoint | Admin | Líder | Docente | Notas |
|---|---|---|---|---|
| `GET /periods` | ✅ (todos) | ✅ (todos) | ✅ (propio) | Docente ve solo períodos donde tiene módulos asignados |
| `POST /periods` | ✅ | ✅ | ❌ | — |
| `PUT /periods/{id}/close` | ✅ | ✅ | ❌ | Registra `period_closed` en audit log |

---

### 3.3 Grupo RUBRICS

| Endpoint | Admin | Líder | Docente | Notas |
|---|---|---|---|---|
| `GET /rubrics` | ✅ | ✅ | ✅ | Docente puede leer rúbrica del período activo (obligatorio para F03 Pantalla 3b) |
| `POST /rubrics` | ✅ | ✅ | ❌ | Suma de pesos = 100% enforced en Pydantic |
| `POST /rubrics/{id}/clone` | ✅ | ✅ | ❌ | Clona PIs y descriptores; líder puede editar antes de abrir período |

---

### 3.4 Grupo MODULES

| Endpoint | Admin | Líder | Docente | Notas |
|---|---|---|---|---|
| `GET /periods/{period_id}/modules` | ✅ (todos) | ✅ (todos) | ✅ (propio) | Docente ve solo sus módulos asignados en el período |
| `PUT /modules/{id}/submit` | ❌ | ✅ (propio) | ✅ (propio) | `verify_module_ownership` — error 404 si no está asignado; todos los estudiantes activos deben estar calificados |

**Nota importante**: el Admin **no** puede hacer submit de un módulo. El submit es una acción del evaluador asignado que certifica sus propios datos. Un líder solo puede hacer submit si también está asignado como evaluador en `module_staff`.

---

### 3.5 Grupo ASSESSMENTS

| Endpoint | Admin | Líder | Docente | Notas |
|---|---|---|---|---|
| `GET /modules/{id}/assessments` | ✅ | ✅ | ✅ (propio) | Docente: `verify_module_ownership`; Admin/Líder: acceso a todos |
| `PUT /modules/{id}/assessments` | ❌ | ✅ (propio) | ✅ (propio) | `verify_module_ownership`; upsert por `module_student_id + perf_indicator_id` |

**Nota**: Admin y Líder tienen acceso de **lectura** a todas las calificaciones por rol de supervisión. La escritura solo la hace el evaluador asignado en `module_staff`; esto incluye líderes asignados explícitamente.

---

### 3.6 Grupo STUDENTS

| Endpoint | Admin | Líder | Docente | Notas |
|---|---|---|---|---|
| `POST /modules/{id}/students/import` | ❌ | ✅ (propio) | ✅ (propio) | `verify_module_ownership`; parser defensivo: 2 MB, UTF-8, regex, anti-formula |

**Nota**: la importación masiva de estudiantes para un módulo específico es responsabilidad del docente. La importación masiva para todo un período es responsabilidad del Admin (F15, endpoint `/admin/bulk/students`).

---

### 3.7 Grupo QUALITATIVE (Análisis Cualitativo del Docente)

| Endpoint | Admin | Líder | Docente | Notas |
|---|---|---|---|---|
| `GET /modules/{id}/qualitative` | ✅ | ✅ | ✅ (propio) | Líder puede leer el análisis de cualquier docente desde el dashboard |
| `PUT /modules/{id}/qualitative` | ❌ | ✅ (propio) | ✅ (propio) | `verify_module_ownership`; `bleach.clean()` antes de persistir |

**Nota**: Admin y Líder pueden **leer** el análisis cualitativo de todos los docentes por rol de supervisión. La escritura solo la hace el evaluador asignado en `module_staff`; esto incluye líderes asignados explícitamente.

---

### 3.8 Grupo REPORT (Reporte ABET Final — F07)

| Endpoint | Admin | Líder | Docente | Notas |
|---|---|---|---|---|
| `GET /periods/{id}/report` | ✅ | ✅ | ❌ | JSON para previsualización; disponible en cualquier estado del período |
| `GET /periods/{id}/report/pdf` | ✅ | ✅ | ❌ | Requiere `leader_analysis` y `action_plans` completos; registra `report_exported` |
| `GET /periods/{id}/report/xlsx` | ✅ | ✅ | ❌ | `safe_cell_value()` en todas las celdas de datos de usuarios |

---

### 3.9 Grupo LEADER REPORT (Informe del Líder — F14)

| Endpoint | Admin | Líder | Docente | Notas |
|---|---|---|---|---|
| `GET /periods/{id}/leader-report` | ✅ | ✅ | ❌ | Borrador con métricas y análisis de docentes (solo lectura) |
| `PUT /periods/{id}/leader-report` | ✅ | ✅ | ❌ | Guarda conclusiones del líder por PI (autosave parcial permitido) |
| `GET /periods/{id}/leader-report/pdf` | ✅ | ✅ | ❌ | Registra `leader_report_generated` en audit log |
| `GET /periods/{id}/leader-report/docx` | ✅ | ✅ | ❌ | Sin macros ni fórmulas ejecutables; registra `leader_report_generated` |

**Nota**: en v1, los docentes **no tienen acceso** al informe del líder. Está documentado como restricción para v2 (ver PRD §12).

---

### 3.10 Grupo NOTIFICATIONS (Seguimiento y Recordatorios — F13)

| Endpoint | Admin | Líder | Docente | Notas |
|---|---|---|---|---|
| `GET /periods/{id}/tracking` | ✅ | ✅ | ❌ | Métricas por docente — un docente no puede ver las métricas de otros |
| `POST /periods/{id}/reminders` | ✅ | ✅ | ❌ | Rate limit: 15 destinatarios/60s por usuario; solo acepta `recipient_ids` internos |
| `GET /periods/{id}/reminders/preview` | ✅ | ✅ | ❌ | Previsualización del correo con variables resueltas |

**Seguridad específica de F13**: la API valida que todos los `recipient_ids` sean usuarios con asignación activa en el período. Rechaza cualquier email o ID externo, previniendo open relay accidental.

---

### 3.11 Grupo ADMIN — Habeas Data (Ley 1581/2012)

| Endpoint | Admin | Líder | Docente | Notas |
|---|---|---|---|---|
| `GET /admin/habeas-data/{doc_number}` | ✅ | ❌ | ❌ | Solo Admin; registra `habeas_data_accessed` en audit log |
| `PUT /admin/suppress/{student_id}` | ✅ | ❌ | ❌ | Solo Admin; anonimización (no eliminación física) |

---

### 3.12 Grupo ADMIN BULK — Carga Masiva (F15)

| Endpoint | Admin | Líder | Docente | Notas |
|---|---|---|---|---|
| `POST /admin/bulk/rubrics` | ✅ | ❌ | ❌ | Parser defensivo; `207 Multi-Status` con errores por fila |
| `POST /admin/bulk/users` | ✅ | ❌ | ❌ | Crea cuentas con contraseña temporal; envía correo de activación |
| `POST /admin/bulk/modules` | ✅ | ❌ | ❌ | Valida que `docente_email` exista en `users` |
| `POST /admin/bulk/students` | ✅ | ❌ | ❌ | Requiere `consent_acknowledged: true` (Ley 1581/2012) |

---

### 3.13 Grupo ADMIN — CRUD Individual (F15)

| Endpoint | Admin | Líder | Docente | Notas |
|---|---|---|---|---|
| `GET /admin/rubrics` | ✅ | ❌ | ❌ | — |
| `POST /admin/rubrics` | ✅ | ❌ | ❌ | Mismas validaciones que la importación masiva |
| `PUT /admin/rubrics/{id}` | ✅ | ❌ | ❌ | — |
| `GET /admin/users` | ✅ | ❌ | ❌ | — |
| `POST /admin/users` | ✅ | ❌ | ❌ | — |
| `PUT /admin/users/{id}` | ✅ | ❌ | ❌ | — |
| `GET /admin/modules` | ✅ | ❌ | ❌ | — |
| `POST /admin/modules` | ✅ | ❌ | ❌ | — |
| `PUT /admin/modules/{id}` | ✅ | ❌ | ❌ | — |
| `GET /admin/templates/{entity}` | ✅ | ❌ | ❌ | Archivos estáticos CSV; `{entity}`: rubrics\|users\|modules\|students |

---

## 4. Resumen de Acceso por Rol

| Grupo de Endpoints | Admin | Líder | Docente |
|---|---|---|---|
| Auth (login/logout/OIDC) | ✅ | ✅ | ✅ |
| Períodos (listar/crear/cerrar) | ✅ | ✅ | Solo lectura (propios) |
| Rúbricas (listar/crear/clonar) | ✅ | ✅ | Solo lectura |
| Módulos (listar) | ✅ (todos) | ✅ (todos) | ✅ (propios) |
| Módulos (submit) | ❌ | ❌ | ✅ (propios) |
| Calificaciones (leer) | ✅ | ✅ | ✅ (propios) |
| Calificaciones (escribir) | ❌ | ❌ | ✅ (propios) |
| Import estudiantes (F03) | ❌ | ❌ | ✅ (propios) |
| Análisis cualitativo (leer) | ✅ | ✅ | ✅ (propios) |
| Análisis cualitativo (escribir) | ❌ | ❌ | ✅ (propios) |
| Reporte ABET final (F07) | ✅ | ✅ | ❌ |
| Informe del líder (F14) | ✅ | ✅ | ❌ |
| Seguimiento y recordatorios (F13) | ✅ | ✅ | ❌ |
| Habeas data | ✅ | ❌ | ❌ |
| Carga masiva y CRUD admin (F15) | ✅ | ❌ | ❌ |

---

## 5. Verificación de `verify_module_ownership`

La dependencia `verify_module_ownership` **debe estar presente** en los siguientes endpoints para prevenir IDOR:

| Endpoint | ¿Tiene verify_module_ownership? | Comportamiento si falla |
|---|---|---|
| `GET /modules/{id}/assessments` (docente) | ✅ Sí | 404 Not Found |
| `PUT /modules/{id}/assessments` (docente o líder asignado) | ✅ Sí | 404 Not Found |
| `POST /modules/{id}/students/import` (docente o líder asignado) | ✅ Sí | 404 Not Found |
| `GET /modules/{id}/qualitative` (docente) | ✅ Sí | 404 Not Found |
| `PUT /modules/{id}/qualitative` (docente o líder asignado) | ✅ Sí | 404 Not Found |
| `PUT /modules/{id}/submit` (docente o líder asignado) | ✅ Sí | 404 Not Found |

**Regla**: el error es siempre `404 Not Found`, nunca `403 Forbidden`, para no confirmar la existencia del recurso a un atacante que intente IDOR.

**Test obligatorio (gate de S2)**: prueba de IDOR manual donde un docente o líder-evaluador intenta acceder al módulo de otro evaluador modificando el `module_id` en la URL — debe retornar 404 en todos los casos.

---

## 6. Acciones Distinguidas: Propio vs. Ajeno

| Acción | Docente sobre su módulo | Docente sobre módulo ajeno | Líder asignado al módulo | Líder no asignado |
|---|---|---|---|---|
| Ver calificaciones | ✅ | ❌ (404) | ✅ | ✅ (read-only por supervisión) |
| Editar calificaciones | ✅ | ❌ (404) | ✅ | ❌ (404) |
| Ver análisis cualitativo | ✅ | ❌ (404) | ✅ | ✅ (read-only por supervisión) |
| Editar análisis cualitativo | ✅ | ❌ (404) | ✅ | ❌ (404) |
| Importar estudiantes | ✅ | ❌ (404) | ✅ | ❌ (404) |
| Submit del módulo | ✅ | ❌ (404) | ✅ | ❌ (404) |
| Ver estado del módulo en dashboard | ✅ | ❌ | ✅ | ✅ |

---

## 7. Resumen Institucional por Línea Propedéutica (F17 — v2)

> **Decisión de diseño (LLM Council 2026-05-16)**: no existe rol `dean` separado en v1. El resumen ejecutivo institucional es accesible para Admin y Líder con sus credenciales existentes. El Decano recibe el reporte como PDF generado por Admin/Líder.

### 7.1 Endpoints F17

| Endpoint | Admin | Líder | Docente | Notas |
|---|---|---|---|---|
| `GET /propedeutic-lines` | ✅ | ✅ | ❌ | Lista líneas propedéuticas activas |
| `GET /propedeutic-lines/{id}/summary` | ✅ | ✅ | ❌ | Agrega resultados por programa en la línea; retorna JSON |
| `GET /propedeutic-lines/{id}/report/pdf` | ✅ | ✅ | ❌ | Genera PDF exportable del resumen institucional |
| `GET /programs` | ✅ | ✅ | ❌ | Lista programas (filtrable por `propedeutic_line_id`) |

### 7.2 Restricciones de privacidad en F17

- Los endpoints de resumen institucional retornan **datos agregados únicamente** — nunca datos individuales de estudiantes (nombres, cédulas, calificaciones por persona).
- El PDF exportable incluye: nombre de programa, número de períodos cerrados, distribución porcentual de niveles (Poor/Inadequate/Adequate/Exemplary) por SO, estado del plan de acción.
- El Docente nunca accede a estos endpoints — retorna `403 Forbidden`.

### 7.3 Roadmap de implementación F17

| Sprint | Tarea |
|---|---|
| **S1 (actual)** | Tablas `programs` y `propedeutic_lines` modeladas en DATA_MODEL.md; ORM SQLAlchemy creado (`src/models/program.py`); FK opcionales en `student_outcomes` y `periods` |
| **S7 (post-TGA)** | Migración Alembic `0002_programs_propedeutic_lines.py`; seed de programas IUB reales; router `dean_report.py`; tests de integración y seguridad |
| Reabrir módulo (post-cierre) | ❌ | ❌ | ✅ (si además es líder del periodo) | ✅ (si es líder del periodo) |
