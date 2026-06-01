# TRACEABILITY_MATRIX.md — RA Assessment App

**Versión del documento**: 1.0  
**Fecha**: 2026-05-15  
**Referencia PRD**: §5 (Features F01–F15), §8 (API REST), §7 (Modelo de Datos), §14 (Sprints)  
**Audiencia**: Desarrolladores, product owner, auditores ABET, QA

> Esta matriz cubre las 15 features F01–F15 sin excepción. Un auditor puede verificar la trazabilidad completa entre el Excel original y la implementación web.

---

## 1. Leyenda

| Campo | Descripción |
|---|---|
| **Feature** | ID de la feature (F01–F15) según PRD |
| **Origen Excel** | Macro VBA, hoja o celda del archivo `Data_Assessment_TGA_RA1_2024-2.xlsm` de origen |
| **Endpoints API** | Endpoints REST que implementan la feature |
| **Tablas DB** | Tablas principales involucradas |
| **Pantallas UI** | Pantallas del flujo de usuario |
| **Sprint** | Sprint de implementación (S1–S6) |
| **Criterios clave** | Criterios de aceptación más críticos (no exhaustivos — ver PRD para la lista completa) |
| **Riesgos** | Riesgos de implementación identificados |

---

## 2. Matriz F01–F15

### F01 — Gestión de Rúbricas

| Campo | Detalle |
|---|---|
| **Origen Excel** | Hoja `RUBRIC` + hojas `RA1`–`RA5`, `SO6`, `SO7`; celdas de peso `J12/M12/P12/S12/V12/Y12`; fórmula `=SUM(B9:B14)` con validación en `RUBRIC!C15` |
| **Endpoints API** | `GET /rubrics` · `POST /rubrics` · `POST /rubrics/{id}/clone` · `GET /admin/rubrics` · `POST /admin/rubrics` · `PUT /admin/rubrics/{id}` |
| **Tablas DB** | `rubrics` · `perf_indicators` · `pi_levels` · `level_thresholds` |
| **Pantallas UI** | Dashboard del líder → Crear/Editar Rúbrica · Pantalla 3b (revisión de rúbrica vigente antes de calificar) |
| **Sprint** | S1 |
| **Criterios clave** | Suma de pesos de PIs activos = 100% enforced en Pydantic y en frontend · Pre-carga de descriptores del período anterior · Un PI puede desactivarse sin eliminarse (peso → 0) · No editable si el período está cerrado |
| **Riesgos** | La validación de suma de pesos tiene que ser exacta (tolerancia ±0.01) para manejar decimales de punto flotante; usar `NUMERIC(5,2)` en DB, no `FLOAT` |

---

### F02 — Registro de Información General del Módulo

| Campo | Detalle |
|---|---|
| **Origen Excel** | Hoja `EF_ASESSM_SO_GENERIC`, celdas B5 (curso), D5 (grupo), D7 (docente), B8 (período) |
| **Endpoints API** | `GET /periods/{id}/modules` · (el contenido de F02 es pre-llenado desde los datos de asignación del período, no tiene endpoint propio de edición) |
| **Tablas DB** | `modules` · `module_staff` · `users` · `periods` |
| **Pantallas UI** | Pantalla 2: Información General del Módulo (wizard step 1) |
| **Sprint** | S2 |
| **Criterios clave** | Evaluador no editable: nombre del usuario asignado en `module_staff` (auto desde login) · Un líder puede aparecer como evaluador si fue asignado administrativamente · Período (auto desde período activo) · Total de estudiantes (auto-calculado) · Campo Grupo confirmable por el evaluador |
| **Riesgos** | Si un docente tiene múltiples módulos en el mismo período, debe poder seleccionar cuál completar primero — la navegación del dashboard debe manejar esto correctamente |

---

### F03 — Registro de Calificaciones por Estudiante

| Campo | Detalle |
|---|---|
| **Origen Excel** | Hoja `EF_ASESSM_SO_GENERIC` filas 15–81 (calificaciones); hoja `STUDENTS LIST` columnas A–C (lista de estudiantes); celdas I/L/O/R/U/X (Score por PI); celdas H/K/N/Q/T/W (Level auto); celdas J/M/P/S/V/Y (% auto); columnas E (Total Score), F (Overall Level), G (Standard) |
| **Endpoints API** | `GET /modules/{id}/assessments` · `PUT /modules/{id}/assessments` · `POST /modules/{id}/students/import` |
| **Tablas DB** | `students` · `module_students` · `student_exclusions` · `assessments` · `perf_indicators` |
| **Pantallas UI** | Pantalla 3: Lista de Estudiantes · Pantalla 4: Grilla de Calificaciones |
| **Sprint** | S2 (calificaciones), S5 (importación CSV/Excel) |
| **Criterios clave** | Selector de 4 niveles discretos (no numérico) · `verify_module_ownership` en todos los endpoints de escritura de módulo, aplicado igual a docentes y líderes asignados · Exclusión de estudiantes con motivo documentado (4 categorías) · Regla de completitud: Activos = Calificados para poder hacer submit · Total Score y Standard calculados por API en runtime (no en DB) |
| **Riesgos** | La fórmula de Total Score requiere `pi_weight` exactos de la rúbrica activa — asegurar que se carga la rúbrica correcta del período activo, no una versión anterior. El parser defensivo de CSV/XLSX es la superficie de ataque más amplia — ver `SECURITY_PRIVACY.md §8` |

---

### F04 — Análisis Cualitativo por PI (Nivel Módulo — Docente)

| Campo | Detalle |
|---|---|
| **Origen VBA** | Botón `Pegar_Analisis` / `CommandButton3` — pegaba texto libre en rango `Analisis_Pegar_N` (fila 79 de cada hoja `EF_ASESSM_SO#`) |
| **Endpoints API** | `GET /modules/{id}/qualitative` · `PUT /modules/{id}/qualitative` |
| **Tablas DB** | `module_analysis` |
| **Pantallas UI** | Pantalla 6: Análisis Cualitativo por PI (wizard step 4) |
| **Sprint** | S3 |
| **Criterios clave** | Texto libre hasta 2000 caracteres · Placeholder orientador configurable · Sanitización `bleach.clean()` antes de persistir · Escritura permitida solo al evaluador asignado en `module_staff` (docente o líder) · Obligatorio para submit del módulo · Guardado como borrador entre sesiones |
| **Riesgos** | El placeholder orientador debe configurarse por el Admin, no hardcodeado — requiere una tabla de configuración o variable de entorno. Considerar agregar `system_config` en S3 |

---

### F04b — Reporte de Distribución por Módulo

| Campo | Detalle |
|---|---|
| **Origen Excel** | Mini-tabla en filas 53–62 de cada hoja `EF_ASESSM_SO#_CODIG_MODULO_N`; fórmula `=COUNTIF(H14:H53,"Poor")/COUNTA(H14:H53)` |
| **Endpoints API** | `GET /modules/{id}/assessments` (incluye campo `distribution` en la respuesta) |
| **Tablas DB** | `assessments` · `perf_indicators` · `module_students` |
| **Pantallas UI** | Pantalla 5: Distribución del Módulo (visible en tiempo real durante calificación y en Pantalla 7 antes del submit) |
| **Sprint** | S3 |
| **Criterios clave** | Porcentaje como métrica primaria (no conteo absoluto) · Denominador = estudiantes activos (excluidos no cuentan) · Suma 100% por fila de PI (tolerancia ±1% por redondeo) · Calculado en tiempo real |
| **Riesgos** | El cálculo en tiempo real puede generar múltiples requests al servidor; considerar debounce en el frontend (300ms) para no saturar la API con cada clic |

---

### F05 — Navegación entre Módulos (Wizard)

| Campo | Detalle |
|---|---|
| **Origen VBA** | Botón `Next_Group` / `CommandButton4` — ocultaba hoja actual y mostraba la siguiente |
| **Endpoints API** | No tiene endpoints propios — es una capa de navegación frontend que consume los endpoints de F02–F04b |
| **Tablas DB** | `modules` (campo `status`) |
| **Pantallas UI** | Wizard de 5 pasos: `[Info General] → [Estudiantes] → [Calificaciones + Distribución] → [Análisis] → [Enviar]` |
| **Sprint** | S3 |
| **Criterios clave** | El docente puede navegar hacia atrás sin perder datos · El paso "Enviar" solo se habilita cuando Activos = Calificados y todos los análisis están escritos · Estado visual por paso (completado / en progreso / pendiente) |
| **Riesgos** | La sincronización del estado del wizard con el backend (para persistir el borrador) requiere autosave cuidadoso — si el usuario cierra el navegador a mitad, los datos deben persistir |

---

### F06 — Cierre y Finalización del Período

| Campo | Detalle |
|---|---|
| **Origen VBA** | Botón `Finalizar_Registros` / `CommandButton5` — ejecutaba `Eliminar_PIs`, `Eliminar_Consolidados`, `Eliminar_Columnas` y ocultaba hojas de módulo |
| **Endpoints API** | `PUT /periods/{id}/close` |
| **Tablas DB** | `periods` (campo `status` → `'closed'`) · `security_events` (`period_closed`) |
| **Pantallas UI** | Dashboard del líder → botón "Cerrar Período" → dialog de confirmación con módulos pendientes |
| **Sprint** | S3 |
| **Criterios clave** | Solo el Líder puede cerrar · Reversible solo por Admin · Después del cierre, datos en modo read-only para docentes · El líder puede reabrir un módulo individual sin reabrir todo el período · Acción registrada en audit log |
| **Riesgos** | La reapertura de un módulo individual (sin reabrir el período) requiere un endpoint adicional no listado explícitamente en el PRD — documentar como tarea pendiente de S3 |

---

### F07 — Generación del Reporte Final (ABET)

| Campo | Detalle |
|---|---|
| **Origen VBA** | Hoja `FINAL_REPORT_ASESSMT_SO` + macros `Eliminar_PIs`, `Eliminar_Consolidados`, `Eliminar_Columnas` |
| **Endpoints API** | `GET /periods/{id}/report` · `GET /periods/{id}/report/pdf` · `GET /periods/{id}/report/xlsx` |
| **Tablas DB** | `periods` · `rubrics` · `perf_indicators` · `assessments` · `module_analysis` · `leader_analysis` · `action_plans` · `reports` |
| **Pantallas UI** | Dashboard del líder → "Previsualizar/Exportar Reporte" · 4 secciones: Encabezado · Distribución por PI · Análisis del líder · Plan de acción |
| **Sprint** | S4 |
| **Criterios clave** | `safe_cell_value()` en todas las celdas XLSX con datos de usuarios · Módulos con 0 estudiantes no aparecen (equivale a `Eliminar_Consolidados`) · PIs sin datos no aparecen (equivale a `Eliminar_PIs`) · Exportación requiere `leader_analysis` y `action_plans` completos |
| **Riesgos** | El formato del PDF/Excel debe ser compatible con el reporte institucional existente — requiere revisión con el líder del programa antes de S4. WeasyPrint necesita plantilla HTML fiel al formato ABET |

---

### F08 — Dashboard del Líder

| Campo | Detalle |
|---|---|
| **Origen Excel** | No existía en el Excel — el líder revisaba manualmente cada hoja |
| **Endpoints API** | `GET /periods` · `GET /periods/{id}/modules` · `GET /periods/{id}/tracking` |
| **Tablas DB** | `periods` · `modules` · `module_staff` · `users` |
| **Pantallas UI** | Dashboard del líder: período activo · barra de progreso · tabla de módulos con estado · botones de acción rápida |
| **Sprint** | S4 |
| **Criterios clave** | Vista en tiempo real de progreso por módulo (Pendiente / En progreso / Completado) · Distingue rol de supervisión (`leader`) de rol contextual de evaluador (`module_staff`) · Botón "Enviar recordatorio" integrado (F13) · Acceso a previsualización del reporte desde el dashboard |
| **Riesgos** | La integración del tracking (F13) con el dashboard requiere que ambas features se desarrollen en el mismo sprint (S4) para no crear inconsistencias de UX |

---

### F09 — Gestión de Períodos Académicos

| Campo | Detalle |
|---|---|
| **Origen Excel** | No existía — el líder creaba un nuevo archivo Excel por período |
| **Endpoints API** | `GET /periods` · `POST /periods` · `PUT /periods/{id}/close` |
| **Tablas DB** | `periods` · `student_outcomes` · `rubrics` · `modules` · `module_staff` |
| **Pantallas UI** | Dashboard del líder → "Crear Período" · formulario de creación/configuración |
| **Sprint** | S1 |
| **Criterios clave** | Un período puede clonarse del anterior · Al crear el período, cada docente asignado recibe notificación por email · No se puede crear sin al menos 1 módulo con docente asignado · No se puede abrir un período cuya rúbrica tenga pesos ≠ 100% |
| **Riesgos** | La clonación del período (rúbrica + módulos) debe ser transaccional — si falla a mitad, no debe quedar en estado inconsistente |

---

### F10 — Autenticación y Control de Acceso

| Campo | Detalle |
|---|---|
| **Origen Excel** | No existía — cualquiera con acceso a la carpeta compartida podía abrir el archivo |
| **Endpoints API** | `POST /auth/login` · `POST /auth/logout` · `GET /auth/oidc/microsoft` · `GET /auth/oidc/microsoft/callback` |
| **Tablas DB** | `users` · `revoked_tokens` · `security_events` |
| **Pantallas UI** | Pantalla de login (login nativo + botón Microsoft OIDC si configurado) |
| **Sprint** | S1 |
| **Criterios clave** | JWT en cookie httpOnly (no localStorage) · Rate limiting 5/min por IP · JTI blocklist para logout inmediato · `require_role()` en cada endpoint protegido · `verify_module_ownership()` para permisos contextuales de módulo, incluyendo líderes-evaluadores · bcrypt para contraseñas |
| **Riesgos** | La migración inicial de usuarios requiere un mecanismo de creación de cuentas por el Admin antes del primer uso — no hay registro abierto |

---

### F11 — Registro del Plan de Acción (Closing the Loop)

| Campo | Detalle |
|---|---|
| **Origen Excel** | Hoja `Conversion` — columna `Decision` con tipo de acción por Standard |
| **Endpoints API** | Parte de `GET /periods/{id}/report` (incluye `action_plans`) · Endpoint de escritura integrado en el flujo del reporte |
| **Tablas DB** | `action_plans` |
| **Pantallas UI** | Sección 4 del reporte final → formulario de plan de acción por PI |
| **Sprint** | S4 |
| **Criterios clave** | Tipo de acción sugerida automáticamente según Standard del PI (corrective/preventive/improvement) · El tipo es editable por el líder · Descripción, responsable y fecha estimada requeridos para exportar el reporte · Editable después del cierre del período · Historial de acciones del período anterior visible |
| **Riesgos** | La sugerencia automática del tipo de acción requiere calcular el Standard consolidado del período — asegurar que este cálculo esté disponible antes de F11 |

---

### F12 — Autenticación Microsoft OIDC (Nice-to-Have)

| Campo | Detalle |
|---|---|
| **Origen Excel** | N/A — feature nueva |
| **Endpoints API** | `GET /auth/oidc/microsoft` · `GET /auth/oidc/microsoft/callback` |
| **Tablas DB** | `users.microsoft_oid` · `users.auth_provider` · `security_events` (oidc_login_*) |
| **Pantallas UI** | Pantalla de login → botón "Ingresar con cuenta institucional Microsoft" (condicional) |
| **Sprint** | S6 (nice-to-have) |
| **Criterios clave** | Feature deshabilitada si las 3 variables de entorno Azure AD no están configuradas · Validación criptográfica del `id_token` (firma, iss, aud, exp) con authlib · Usuario nuevo queda en estado pendiente de rol hasta asignación manual · JWT interno independiente de la sesión Microsoft |
| **Riesgos** | La configuración del tenant en Azure AD la realiza el administrador de Microsoft de la institución — dependencia externa que puede retrasar S6. F12 es nice-to-have; S6 no es bloqueante para producción |

---

### F13 — Seguimiento y Notificación de Docentes Pendientes

| Campo | Detalle |
|---|---|
| **Origen Excel** | No existía — el líder hacía seguimiento manualmente por correo |
| **Endpoints API** | `GET /periods/{id}/tracking` · `POST /periods/{id}/reminders` · `GET /periods/{id}/reminders/preview` |
| **Tablas DB** | `reminder_log` · `security_events` (reminder_sent) · `modules` · `module_staff` |
| **Pantallas UI** | Dashboard del líder → tabla de seguimiento con checkboxes · modal de redacción y previsualización del correo |
| **Sprint** | S4 |
| **Criterios clave** | Throttle: 15 destinatarios / 60 s por usuario (429 si excede) · Solo acepta `recipient_ids` internos del período (no emails externos) · Variables del template: `{nombre_docente}`, `{modulo}`, `{avance_pct}`, `{dias_restantes}` · Previsualización con variables resueltas antes de enviar |
| **Riesgos** | La resolución de variables del template en el backend requiere lógica de renderizado de templates de texto — puede usarse `str.format_map()` con un diccionario seguro (no `eval()`) |

---

### F14 — Informe del Líder (PDF Editable y Regenerable)

| Campo | Detalle |
|---|---|
| **Origen Excel** | No existía — el líder escribía conclusiones en celdas fusionadas del Excel |
| **Endpoints API** | `GET /periods/{id}/leader-report` · `PUT /periods/{id}/leader-report` · `GET /periods/{id}/leader-report/pdf` · `GET /periods/{id}/leader-report/docx` |
| **Tablas DB** | `leader_report_drafts` · `security_events` (leader_report_generated) |
| **Pantallas UI** | Dashboard del líder → "Generar Informe" → editor de conclusiones por PI + botones de descarga |
| **Sprint** | S4 |
| **Criterios clave** | Autosave por campo (debounce 2 s) · Regenerable sin límite · Nombre de archivo con timestamp · PDF generado en < 3 s · DOCX sin macros ni fórmulas · `bleach.clean()` + `safe_cell_value()` en texto de usuarios |
| **Riesgos** | python-docx debe agregarse a `requirements.in` antes de S4; someterlo a `pip-audit` en el primer deploy que lo incluya |

---

### F15 — Carga Masiva por CSV/Excel y Creación Individual (Administrador)

| Campo | Detalle |
|---|---|
| **Origen Excel** | No existía — la configuración inicial requería intervención manual registro por registro |
| **Endpoints API** | `POST /admin/bulk/rubrics` · `/admin/bulk/users` · `/admin/bulk/modules` · `/admin/bulk/students` · CRUD individual: `GET/POST/PUT /admin/rubrics` · `/admin/users` · `/admin/modules` · `GET /admin/templates/{entity}` |
| **Tablas DB** | `rubrics` · `perf_indicators` · `pi_levels` · `users` · `modules` · `module_staff` · `students` · `module_students` · `security_events` (bulk_import_*) |
| **Pantallas UI** | Panel de administrador → sección "Importación masiva" por entidad · formularios de creación individual |
| **Sprint** | S5 (los parsers de F15 se refactorizan como `file_adapter.py` de F16 en S5) |
| **Criterios clave** | `207 Multi-Status` con errores por fila (sin abortar el lote) · Upsert por clave natural (evita duplicados en reimportaciones) · `consent_acknowledged: true` obligatorio para estudiantes · Parser defensivo: 2 MB, UTF-8, regex, anti-formula · Suma de pesos = 100% por SO en importación de rúbricas · Importación de 100 estudiantes < 3 s |
| **Riesgos** | El upsert de estudiantes por `document_number + module_id` requiere manejo cuidadoso de concurrencia si dos admins importan al mismo tiempo; usar transacciones de DB con `ON CONFLICT` en PostgreSQL |

---

### F16 — Capa de Integración de Datos (Ports & Adapters)

| Campo | Detalle |
|---|---|
| **Origen Excel** | N/A — feature nueva; formaliza como patrón de arquitectura la ingesta de datos de matrícula desde fuentes externas (SIS Academusoft, CSV manual, SIS REST futuro) |
| **Endpoints API** | `POST /admin/sync/preview` · `POST /admin/sync/apply` · `GET /admin/sync/log` |
| **Tablas DB** | `oracle_sync_log` · `users` (columna `pege_id`) |
| **Pantallas UI** | Panel de administrador → "Sincronización de datos" → previsualización + aplicar + historial |
| **Sprint** | S2 (`contracts.py` + `sync_service.py`) · S5 (`file_adapter.py` — refactor de parsers de F15) · S7 (`oracle_adapter.py` — condicional, 3 prerequisitos) |
| **Criterios clave** | El mismo `SyncPayload` producido por `file_adapter.py` y por `oracle_adapter.py` produce el mismo resultado en PostgreSQL · `consent_acknowledged: true` requerido para estudiantes sin importar la fuente · `oracle_adapter.py` deshabilitado si `ORACLE_DSN` no está configurado · `POST /admin/sync/preview` no modifica la DB |
| **Riesgos** | `oracle_adapter.py` requiere 3 prerequisitos externos (PREREQ-01 a PREREQ-03 en `memory/NEXT_STEPS.md`): schema Oracle confirmado por DBA, entorno Oracle de prueba para CI, y concepto jurídico Ley 1581 del área jurídica de la IUB — estos pueden tardar semanas o meses según la disponibilidad de las partes |

---

## 3. Trazabilidad por Sprint

| Sprint | Features implementadas | Gate de seguridad | Tests E2E requeridos |
|---|---|---|---|
| S1 | F10 · F09 · F01 | `require_role()` · JWT blocklist · rate limiting · `pip-compile --generate-hashes` | — |
| S2 | F02 · F03 (calificaciones) · F03 Pantalla 3b (revisión rúbrica) · **F16** (`contracts.py` + `sync_service.py`) | `verify_module_ownership` · `bleach` · Pydantic validators · Auditoría DG-TSI-09-V4 · agnosticismo de `SyncService` verificado (U-S2-11) | **E2E-01 a E2E-04** (flujos API encadenados — `tests/test_flow_submit.py`) |
| S3 | F04 · F04b · F05 · F06 | Security audit log (`security_events`) · fail2ban · UFW | **PW-01 a PW-05** (Playwright — login, logout, dashboard, DG-TSI-09-V4) — requiere `tests/e2e/` implementado |
| S4 | F07 · F11 · F08 · F13 · F14 | `safe_cell_value()` · `report_exported` · habeas data endpoint · throttle F13 · `leader_report_generated` · python-docx en pip-audit | PW ampliados: flujo líder (descarga reporte, envío recordatorio) |
| S5 | F03 (import CSV) · F15 · **F16** (`file_adapter.py` — refactor de parser) · exportación Excel · historial planes de acción | Parser defensivo F03 · parsers F15 bajo Bandit · `consent_acknowledged` en `SyncPayload` · PG-01 a PG-05 contra PostgreSQL real · backups GPG · pip-audit en deploy.sh | — |
| S6 | F12 | Validación criptográfica `id_token` · client_secret en .env · authlib en pip-audit · logging OIDC events | — |
| S7 | **F16** (`oracle_adapter.py` — condicional, 3 prerequisitos externos) | Schema Oracle confirmado · entorno Oracle en CI · concepto jurídico Ley 1581 · modo degradado verificado (S-S7-01) | — |
| **Pre-deploy** | — | Penetración básica (§9 TEST_PLAN) · staging HTTP/Caddy/TLS · backup restore proof | **PG-01 a PG-05** (PostgreSQL real local/staging — `TEST_PG_URL` activo y base descartable/test-owned) · **PW-01 a PW-05** (Playwright completo) |

> Ver `docs/TEST_PLAN.md §11` para la especificación completa de cada ID E2E (E2E-01–04, PG-01–05, PW-01–05).
