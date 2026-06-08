# TEST_PLAN.md — RA Assessment App

**Versión del documento**: 1.0  
**Fecha**: 2026-05-15  
**Referencia PRD**: §14 (Priorización de Desarrollo / Sprints), §16 (Postura de Seguridad), §17 (Superficie F03)  
**Audiencia**: Desarrolladores, QA, revisores de seguridad

> Este plan cubre al menos 1 prueba de seguridad por gate de sprint. Ningún sprint puede cerrar sin que las pruebas marcadas con 🔒 pasen al 100%.

---

## 1. Convenciones

| Símbolo | Significado |
|---|---|
| 🔒 | Prueba de seguridad — **bloqueante** para pasar al siguiente sprint o hacer deploy |
| 🧪 | Prueba unitaria |
| 🔗 | Prueba de integración (endpoint real) |
| 👤 | Prueba de aceptación de usuario (UAT manual) |
| 🔄 | Prueba end-to-end — flujo completo encadenado de múltiples endpoints, staging, o browser |

**Framework (unit / integration)**: pytest + httpx `AsyncClient` con `ASGITransport` y SQLite `StaticPool`; pytest unitario puro para servicios.  
**Framework (E2E API)**: mismo pytest + httpx; sin nueva infraestructura; los tests E2E-API se incluyen en la suite estándar `pytest tests/`.  
**Framework (E2E staging)**: misma suite con fixture `pg_engine` activada por variable de entorno `TEST_PG_URL`; se salta automáticamente si la variable no está presente.  
**Framework (E2E browser)**: `pytest-playwright` contra servidor `uvicorn` levantado; ejecutar con `pytest tests/e2e/ --headed` (separado de la suite estándar).  
**Ubicación**: `tests/` (unit + integration + E2E API) · `tests/e2e/` (Playwright)  
**Ejecutar todos los tests**: `pytest tests/ -v --tb=short`  
**Ejecutar E2E browser**: `pytest tests/e2e/ -v --tb=short` (requiere servidor activo)

---

## 2. Sprint S1 — Auth + Períodos + Rúbricas

**Features cubiertas**: F10 (Auth), F09 (Períodos), F01 (Rúbricas)  
**Gate de seguridad**: `require_role()` + JWT blocklist + rate limiting + `pip-compile --generate-hashes` + variables de entorno en `.env`

### 2.1 Pruebas Unitarias

| ID | Módulo | Descripción | Criterio de éxito |
|---|---|---|---|
| U-S1-01 | `src/core/security.py` | `encode_jwt()` genera token con campos `sub`, `jti`, `exp` correctos | Token decodificable con `decode_jwt()` y campos verificados |
| U-S1-02 | `src/core/security.py` | `decode_jwt()` rechaza token expirado | Lanza `ExpiredSignatureError` |
| U-S1-03 | `src/core/security.py` | `hash_password()` produce hash bcrypt válido | `verify_password()` retorna `True` con la contraseña correcta |
| U-S1-04 | `src/api/schemas/rubrics.py` | Pydantic validator rechaza PIs con suma de pesos ≠ 100% | `ValidationError` con mensaje que incluye el porcentaje calculado |
| U-S1-05 | `src/api/schemas/rubrics.py` | Pydantic validator acepta PIs con suma exactamente = 100% (tolerancia ±0.01) | Sin `ValidationError` |
| U-S1-06 | `src/api/schemas/rubrics.py` | PIs desactivados (`is_active=False`) no se incluyen en la suma de pesos | Suma de pesos activos = 100% pasa aunque haya PIs con peso > 0 desactivados |

### 2.2 Pruebas de Integración

| ID | Endpoint | Descripción | Criterio de éxito |
|---|---|---|---|
| I-S1-01 | `POST /auth/login` | Login exitoso con credenciales correctas | `200` + cookie `ra_session` emitida |
| I-S1-02 | `POST /auth/login` | Login fallido con contraseña incorrecta | `401` + evento `login_failed` en `security_events` |
| I-S1-03 | `POST /auth/logout` | Logout invalida el token (JTI en `revoked_tokens`) | Request subsiguiente con el mismo cookie retorna `401` |
| I-S1-04 | `POST /periods` | Docente intenta crear período | `403 Forbidden` |
| I-S1-05 | `POST /periods` | Líder crea período con datos válidos | `201 Created` con `id` del período |
| I-S1-06 | `POST /rubrics` | Rúbrica con pesos que no suman 100% | `422 Unprocessable Entity` con mensaje de error |
| I-S1-07 | `POST /rubrics` | Rúbrica válida (pesos = 100%) | `201 Created` |

### 2.3 Pruebas de Seguridad 🔒

| ID | Tipo | Descripción | Criterio de éxito |
|---|---|---|---|
| 🔒 S-S1-01 | Rate limiting | 6 requests a `POST /auth/login` desde la misma IP en 1 minuto | El 6to request retorna `429 Too Many Requests` |
| 🔒 S-S1-02 | JWT blocklist | Token revocado al hacer logout no puede usarse en requests subsiguientes | `401 Unauthorized` con el token revocado |
| 🔒 S-S1-03 | Rol enforcement | Request a endpoint de Líder con token de Docente | `403 Forbidden` |
| 🔒 S-S1-04 | Lockfile SHA-256 | Instalar con `pip install --require-hashes -r requirements.txt` | Sin errores; fallaría si `requirements.txt` no tiene hashes |
| 🔒 S-S1-05 | Pydantic bypass | Enviar rúbrica con pesos ≠ 100% directamente a la API (sin pasar por frontend) | `422 Unprocessable Entity` — la validación no es bypasseable |

---

## 3. Sprint S2 — Módulos, Calificaciones y Pantalla de Rúbrica

**Features cubiertas**: F02 (Info General), F03 (Calificaciones + lista de estudiantes + exclusiones), F03-Pantalla3b (revisión rúbrica)  
**Gate de seguridad**: `verify_module_ownership` + `bleach` + Pydantic en API + Auditoría DG-TSI-09-V4

### 3.1 Pruebas Unitarias

| ID | Módulo | Descripción | Criterio de éxito |
|---|---|---|---|
| U-S2-01 | `src/services/assessment.py` | Cálculo de Total Score con 4 PIs activos y pesos conocidos | Resultado exacto (tolerancia ±0.001) |
| U-S2-02 | `src/services/assessment.py` | Cálculo de Standard: Total Score 2.5 → `'Medium'` según `level_thresholds` default | Retorna `'Medium'` |
| U-S2-03 | `src/services/assessment.py` | Cálculo de distribución de niveles: 2 Poor, 5 Inadequate, 18 Adequate, 6 Exemplary → porcentajes | Retorna `{Poor: 6.45, Inadequate: 16.13, Adequate: 58.06, Exemplary: 19.35}` (con 31 activos) |
| U-S2-04 | `src/services/sanitize.py` | `sanitize_qualitative_text()` elimina `<script>alert(1)</script>` | Retorna `'alert(1)'` sin tags HTML |
| U-S2-05 | `src/services/sanitize.py` | `sanitize_qualitative_text()` rechaza texto > 2000 caracteres | Lanza `ValueError` |
| U-S2-06 | `src/api/deps.py` | `verify_module_ownership()` permite a un `leader` asignado en `module_staff` evaluar un módulo de su propio RA/SO | Retorna el `Module` solicitado |
| U-S2-07 | `src/api/deps.py` | `verify_module_ownership()` permite a un `leader` asignado evaluar un módulo de otro RA/SO | Retorna el `Module` solicitado |
| U-S2-08 | `src/api/deps.py` | `verify_module_ownership()` rechaza a un `leader` no asignado al módulo | Lanza `HTTPException(404)` |

### 3.2 Pruebas de Integración

| ID | Endpoint | Descripción | Criterio de éxito |
|---|---|---|---|
| I-S2-01 | `GET /modules/{id}/assessments` | Docente ve calificaciones de su propio módulo | `200` con datos correctos |
| I-S2-02 | `GET /modules/{id}/assessments` | Docente intenta ver calificaciones de módulo ajeno | `404 Not Found` (no 403) |
| I-S2-03 | `PUT /modules/{id}/assessments` | Calificación válida con level ∈ {1, 2, 4, 5} | `200` con total_score y standard calculados |
| I-S2-04 | `PUT /modules/{id}/assessments` | Calificación con level = 3 (valor prohibido en escala ABET) | `422 Unprocessable Entity` |
| I-S2-05 | `GET /rubrics` | Docente puede leer la rúbrica del período activo | `200` con PIs y descriptores |
| I-S2-06 | `PUT /modules/{id}/submit` | Submit con estudiantes sin calificar | `409 Conflict` con lista de estudiantes pendientes |
| I-S2-07 | `PUT /modules/{id}/assessments` | Líder asignado como evaluador califica un módulo propio o de otro RA/SO | `200`; evento de auditoría conserva `user_id` y `module_id` |
| I-S2-08 | `PUT /modules/{id}/assessments` | Líder no asignado intenta calificar un módulo | `404 Not Found` |

### 3.3 Pruebas de Seguridad 🔒

| ID | Tipo | Descripción | Criterio de éxito |
|---|---|---|---|
| 🔒 S-S2-01 | **IDOR** | Docente A modifica `module_id` en URL para acceder al módulo de Docente B | `404 Not Found` en todos los endpoints de módulo (GET assessments, PUT assessments, POST students/import, GET qualitative, PUT qualitative, PUT submit) |
| 🔒 S-S2-01b | **IDOR líder-evaluador** | Líder asignado a un módulo intenta escribir en otro módulo donde no está en `module_staff` | `404 Not Found`; el rol `leader` no bypassa `verify_module_ownership` |
| 🔒 S-S2-02 | XSS | `PUT /modules/{id}/qualitative` con `analysis_text` que contiene `<script>alert(1)</script>` | Texto sanitizado retornado por `GET` no contiene el tag `<script>` |
| 🔒 S-S2-03 | Pesos API bypass | Enviar PUT de calificación con `level = 0` o `level = 3` directamente | `422` — validación Pydantic bloquea |
| 🔒 S-S2-04 | DG-TSI-09-V4 | Auditoría visual del frontend del flujo docente | ✅ Paleta `#1E2843`/`#FFDF2D` · tipografía Arial/Open Sans · header+contenido+footer · sin scroll horizontal a 1024×768 · sin popups de nueva ventana · campos obligatorios con `*` |

### 3.4 Pruebas de SyncService (F16 — Ports & Adapters)

Estas pruebas verifican el contrato y el puerto de entrada de F16. No requieren Oracle ni ningún sistema externo — solo `SyncPayload` con `source` variable.

| ID | Módulo | Descripción | Criterio de éxito |
|---|---|---|---|
| U-S2-10 | `src/integration/contracts.py` | `SyncPayload` es importable y validable sin dependencias externas | `from src.integration.contracts import SyncPayload` sin error; instanciación con datos mínimos válidos |
| U-S2-11 | `src/integration/sync_service.py` | Mismo `SyncPayload` con `source='csv'` y luego con `source='academusoft'` → mismo resultado en DB | Los registros en PostgreSQL son idénticos; el campo `source` solo cambia en `oracle_sync_log`, no en las tablas de datos |
| U-S2-12 | `src/integration/sync_service.py` | `SyncPayload` con `consent_acknowledged: false` y lista de estudiantes no vacía | `ValueError` con mensaje que referencia Ley 1581/2012; ningún registro escrito en DB |

---

## 4. Sprint S3 — Análisis, Distribución, Wizard y Cierre

**Features cubiertas**: F04 (Análisis cualitativo), F04b (Distribución %), F05 (Wizard), F06 (Cierre del período)  
**Gate de seguridad**: Security audit log (`security_events`) + fail2ban configurado + UFW habilitado

### 4.1 Pruebas Unitarias

| ID | Módulo | Descripción | Criterio de éxito |
|---|---|---|---|
| U-S3-01 | `src/core/logging.py` | `log_security_event()` escribe JSON válido en `security.jsonl` | El JSON es parseable; contiene `ts`, `event`, `user_id`, `ip`, `severity` |
| U-S3-02 | `src/services/assessment.py` | Distribución excluye estudiantes con `status='excluded'` del denominador | Con 31 activos y 2 excluidos, denominador = 31 (no 33) |

### 4.2 Pruebas de Integración

| ID | Endpoint | Descripción | Criterio de éxito |
|---|---|---|---|
| I-S3-01 | `PUT /modules/{id}/qualitative` | Guardar análisis cualitativo por PI | `200` + análisis persistido |
| I-S3-02 | `GET /modules/{id}/qualitative` | Líder lee análisis de docente (módulo ajeno al líder) | `200` con datos |
| I-S3-03 | `PUT /periods/{id}/close` | Líder cierra período con todos los módulos completados | `200` + período en estado `'closed'` |
| I-S3-04 | `PUT /periods/{id}/close` | Líder cierra período con módulos sin completar (`force: false`) | `409 Conflict` con lista de módulos pendientes |
| I-S3-05 | `PUT /modules/{id}/assessments` | Docente modifica calificación después del cierre del período | `403 Forbidden` |

### 4.3 Pruebas de Seguridad 🔒

| ID | Tipo | Descripción | Criterio de éxito |
|---|---|---|---|
| 🔒 S-S3-01 | Audit log | Después de `PUT /periods/{id}/close`, existe evento `period_closed` en `security_events` | Fila con `event='period_closed'` y `period_id` correcto |
| 🔒 S-S3-02 | Audit log | Login fallido escribe `login_failed` en `security.jsonl` | Archivo JSON válido con `event: "login_failed"` e IP del cliente |
| 🔒 S-S3-03 | fail2ban | Configuración de fail2ban lee `security.jsonl` y detecta 5+ `login_failed` | Verificar con `fail2ban-client status ra-assessment` que el jail está activo |
| 🔒 S-S3-04 | UFW | Verificar firewall en servidor | `ufw status` muestra solo 22/80/443 abiertos; `ss -tlnp | grep 5432` muestra solo 127.0.0.1 |

---

## 5. Sprint S4 — Reporte ABET, Plan de Acción, Dashboard, Recordatorios e Informe del Líder

**Features cubiertas**: F07 (Reporte final), F11 (Plan de acción), F08 (Dashboard del líder), F13 (Recordatorios), F14 (Informe del líder)  
**Gate de seguridad**: `safe_cell_value()` + `report_exported` en audit log + endpoint habeas data + throttle F13 + `leader_report_generated` + python-docx en pip-audit

### 5.1 Pruebas Unitarias

| ID | Módulo | Descripción | Criterio de éxito |
|---|---|---|---|
| U-S4-01 | `src/services/sanitize.py` | `safe_cell_value()` prefija `=SUM(A1:A10)` con apóstrofe | Retorna `'=SUM(A1:A10)` |
| U-S4-02 | `src/services/sanitize.py` | `safe_cell_value()` no modifica texto normal `'García Pérez, María'` | Retorna el mismo string |
| U-S4-03 | `src/services/sanitize.py` | `safe_cell_value()` prefija todos los prefijos peligrosos: `=`, `+`, `-`, `@`, `|`, `%` | 6 casos, todos prefijados con `'` |
| U-S4-04 | `src/services/report.py` | Cálculo de porcentaje consolidado ponderado por módulo (múltiples módulos con distinto N de estudiantes) | Porcentaje consolidado ponderado correcto (no promedio simple) |

### 5.2 Pruebas de Integración

| ID | Endpoint | Descripción | Criterio de éxito |
|---|---|---|---|
| I-S4-01 | `GET /periods/{id}/report/pdf` | Líder descarga PDF del reporte | `200` + `Content-Type: application/pdf` + archivo no vacío |
| I-S4-02 | `GET /periods/{id}/report/pdf` | Docente intenta descargar PDF | `403 Forbidden` |
| I-S4-03 | `GET /periods/{id}/report/xlsx` | Líder descarga xlsx | `200` + `Content-Type: application/vnd.openxmlformats-...` |
| I-S4-04 | `GET /admin/habeas-data/{doc}` | Admin consulta datos del titular | `200` + datos del estudiante + evento `habeas_data_accessed` en audit log |
| I-S4-05 | `GET /admin/habeas-data/{doc}` | Líder intenta consulta habeas data | `403 Forbidden` |
| I-S4-06 | `POST /periods/{id}/reminders` | Líder envía recordatorio a 3 docentes | `200` con `sent: 3` |
| I-S4-07 | `POST /periods/{id}/reminders` | Intento de enviar recordatorio con `recipient_id` externo al período | `400 Bad Request` |
| I-S4-08 | `GET /periods/{id}/leader-report/pdf` | Líder descarga informe en PDF | `200` + Content-Type PDF |

### 5.3 Pruebas de Seguridad 🔒

| ID | Tipo | Descripción | Criterio de éxito |
|---|---|---|---|
| 🔒 S-S4-01 | **CSV/Excel Injection** | Exportar reporte XLSX con un nombre de estudiante que empieza con `=SUM(A1)` | La celda en el XLSX contiene `'=SUM(A1)` (con apóstrofe) — no es evaluable como fórmula |
| 🔒 S-S4-02 | **DOCX Injection** | Exportar informe del líder con conclusión que empieza con `=CMD("calc")` | El DOCX contiene `'=CMD("calc")` — no ejecutable en Word |
| 🔒 S-S4-03 | Throttle anti-spam F13 | 17 requests a `POST /periods/{id}/reminders` en 60 s (superando el límite de 15 destinatarios) | El request que supera el límite retorna `429 Too Many Requests` |
| 🔒 S-S4-04 | Audit log | Después de descargar PDF, existe evento `report_exported` en `security_events` | Evento con `period_id`, `format: 'pdf'` y `user_id` correcto |
| 🔒 S-S4-05 | python-docx pip-audit | python-docx presente en `requirements.txt` sin CVEs conocidos | `pip-audit -r requirements.txt` sin alertas para python-docx |

---

## 6. Sprint S5 — Importación CSV/Excel y Carga Masiva Admin

**Features cubiertas**: F03 (importación CSV), F15 (carga masiva admin), exportación Excel completa, historial de planes de acción  
**Gate de seguridad**: Parser defensivo F03 + parsers F15 bajo Bandit + `consent_acknowledged` + backups GPG + pip-audit en deploy.sh

### 6.1 Pruebas Unitarias

| ID | Módulo | Descripción | Criterio de éxito |
|---|---|---|---|
| U-S5-01 | `src/services/parser.py` | `_parse_csv()` con nombre que empieza con `=` | Lanza `ValueError` con mensaje sobre fórmula detectada |
| U-S5-02 | `src/services/parser.py` | `_parse_csv()` con nombre válido con caracteres especiales colombianos: `García Pérez, María` | Parsea correctamente sin error |
| U-S5-03 | `src/services/parser.py` | `_parse_xlsx()` con `openpyxl(data_only=True)` no evalúa fórmulas | Valor leído es el último valor calculado, no la fórmula |
| U-S5-04 | `src/services/parser.py` | `_parse_csv()` con cédula fuera de regex (`SAFE_DOC_RE`) | Lanza `ValueError` |
| U-S5-05 | `src/services/parser.py` | `_parse_csv()` con ID interno fuera de regex (`SAFE_ID_RE`) | Lanza `ValueError` |

### 6.2 Pruebas de Integración

| ID | Endpoint | Descripción | Criterio de éxito |
|---|---|---|---|
| I-S5-01 | `POST /modules/{id}/students/import` | CSV con 31 estudiantes válidos | `200` con `imported: 31` |
| I-S5-02 | `POST /modules/{id}/students/import` | Archivo de 2.1 MB | `413 Payload Too Large` |
| I-S5-03 | `POST /modules/{id}/students/import` | Archivo `.pdf` disfrazado como `.csv` | `415 Unsupported Media Type` |
| I-S5-04 | `POST /admin/bulk/students` | Importación sin `consent_acknowledged: true` | `400 Bad Request` |
| I-S5-05 | `POST /admin/bulk/students` | Importación con `consent_acknowledged: true` | `207 Multi-Status` con conteo de importados |
| I-S5-06 | `POST /admin/bulk/rubrics` | Rúbrica donde suma de pesos del SO = 95% | `207` con error en las filas del SO afectado |

### 6.3 Pruebas de Seguridad 🔒

| ID | Tipo | Descripción | Criterio de éxito |
|---|---|---|---|
| 🔒 S-S5-01 | **CSV Injection en import** | CSV con nombre de estudiante `=HYPERLINK("http://malicious.com","Click")` | `422 Unprocessable Entity` — parser rechaza el valor |
| 🔒 S-S5-02 | **Zip bomb** | Archivo XLSX artificialmente expandido (> 2 MB sin comprimir) | `413` — rechazado antes de descomprimir |
| 🔒 S-S5-03 | **Encoding attack** | CSV en UTF-16 | `422` — parser fuerza UTF-8 estricto |
| 🔒 S-S5-04 | Bandit en parsers | `bandit -r src/services/parser.py -ll -ii` | Sin issues de severidad HIGH o MEDIUM |
| 🔒 S-S5-05 | Backups GPG | Verificar que el backup diario es cifrado y restaurable | Restaurar un backup de prueba en un entorno aislado exitosamente |
| 🔒 S-S5-06 | pip-audit en deploy | Ejecutar `deploy.sh` en staging | Script completa sin errores de pip-audit; deploy exitoso |

---

## 7. Sprint S6 — Microsoft OIDC (Nice-to-Have)

**Features cubiertas**: F12 (Microsoft OIDC)  
**Gate de seguridad**: Validación criptográfica del `id_token` + `client_secret` en `.env` + authlib en pip-audit + logging de eventos OIDC

### 7.1 Pruebas de Integración

| ID | Endpoint | Descripción | Criterio de éxito |
|---|---|---|---|
| I-S6-01 | `GET /auth/oidc/microsoft` | Sin variables de entorno Azure AD configuradas | `503 Service Unavailable` |
| I-S6-02 | `GET /auth/oidc/microsoft` | Con variables configuradas | `302 Redirect` a `login.microsoftonline.com` |
| I-S6-03 | `GET /auth/oidc/microsoft/callback` | `id_token` válido de Microsoft, usuario registrado en el sistema | `200` + cookie de sesión emitido |
| I-S6-04 | `GET /auth/oidc/microsoft/callback` | `id_token` expirado | `401` + evento `oidc_login_failed` en audit log |
| I-S6-05 | `GET /auth/oidc/microsoft/callback` | Usuario de Microsoft no registrado en el sistema | `403` con mensaje claro + evento `oidc_account_not_registered` |

### 7.2 Pruebas de Seguridad 🔒

| ID | Tipo | Descripción | Criterio de éxito |
|---|---|---|---|
| 🔒 S-S6-01 | Validación criptográfica | Manipular el campo `exp` del JWT de Microsoft para extender la sesión | authlib rechaza el token manipulado |
| 🔒 S-S6-02 | `client_secret` no expuesto | Verificar que `MICROSOFT_CLIENT_SECRET` no aparece en logs | Búsqueda en `security.jsonl` no retorna el secret |
| 🔒 S-S6-03 | JWT interno independiente | Verificar que el JWT de la app expira a las 8 h independientemente de la sesión Microsoft | Después de 8 h, el cookie de sesión de la app es inválido aunque la sesión Microsoft siga activa |
| 🔒 S-S6-04 | authlib pip-audit | authlib en `requirements.txt` sin CVEs | `pip-audit` sin alertas para authlib |

---

## 8. Sprint S7 — Oracle Adapter (Condicional, F16)

**Features cubiertas**: F16 (`oracle_adapter.py` — integración con Academusoft Oracle)  
**Gate de seguridad**: Schema Oracle confirmado por DBA · entorno Oracle en CI · concepto jurídico Ley 1581/2012 del área jurídica · modo degradado verificado

> **Prerequisito de sprint**: S7 solo puede comenzar cuando los 3 prerequisitos externos documentados en `memory/NEXT_STEPS.md` (PREREQ-01 a PREREQ-03) estén cumplidos. Mientras tanto, `oracle_adapter.py` permanece como archivo vacío con docstring de estado. Los tests de S1–S6 no dependen de este sprint.

### 8.1 Pruebas de Integración

| ID | Endpoint | Descripción | Criterio de éxito |
|---|---|---|---|
| I-S7-01 | `POST /admin/sync/preview` | `SyncPayload` con `source='academusoft'` y datos válidos | `200` con conteos correctos y `errors: []` |
| I-S7-02 | `POST /admin/sync/apply` | Aplicar payload de Oracle equivalente a un CSV ya probado en S5 | Registros resultantes en DB idénticos a los del CSV equivalente |
| I-S7-03 | `GET /admin/sync/log` | Historial después de `apply` con source Oracle | Fila con `source: 'academusoft'` y conteos correctos |

### 8.2 Pruebas de Seguridad 🔒

| ID | Tipo | Descripción | Criterio de éxito |
|---|---|---|---|
| 🔒 S-S7-01 | **Modo degradado Oracle** | Simular Oracle no disponible (`ORACLE_DSN` apuntando a host inaccesible) | `oracle_adapter.py` retorna error descriptivo sin lanzar excepción no capturada; `POST /admin/sync/preview` con `source='csv'` sigue respondiendo `200` |
| 🔒 S-S7-02 | Consentimiento en sync Oracle | `SyncPayload` con `source='academusoft'`, estudiantes incluidos, `consent_acknowledged: false` | `400 Bad Request` — `SyncService` rechaza antes de escribir en DB |

---

## 9. Prueba de Penetración Básica (Pre-Deploy Producción)

**Requerida antes del primer deploy a producción** — criterio de éxito del PRD §15.

### Checklist de Penetración Básica

```
[ ] IDOR — Docente A no puede acceder a módulos de Docente B (6 endpoints verificados)
[ ] Rate limit — 6to intento de login desde misma IP retorna 429
[ ] Role enforcement — Docente no puede acceder a endpoints de Líder/Admin
[ ] XSS — Script en campo de análisis no se ejecuta en el frontend
[ ] CSV/XLSX Injection — Fórmula en nombre de estudiante rechazada en import
[ ] Export Injection — Reporte XLSX con nombre peligroso: fórmula prefijada con apóstrofe
[ ] JWT manipulation — Token con exp modificado rechazado
[ ] Direct SQL — Nombre con '; DROP TABLE students; --' procesado sin error (ORM previene)
[ ] File upload — Archivo de 2.1 MB rechazado con 413
[ ] File type — Archivo .php disfrazado como .csv rechazado con 415
[ ] Bypass auth — Request sin cookie a endpoint protegido retorna 401
[ ] Bypass role — Request con cookie de docente a endpoint de admin retorna 403
```

Documentar el resultado en `memory/KNOWN_ISSUES.md` si se detecta algún hallazgo.

---

## 10. Pruebas de Conformidad IUB DG-TSI-09-V4

Antes del deploy a producción (gate de S2), verificar manualmente:

```
[ ] Paleta de colores: header usa #1E2843; botones primarios usan #FFDF2D con texto #1E2843
[ ] Tipografía: body usa font-family: 'Open Sans', Arial, Helvetica, Verdana
[ ] Logo IUB: presente en esquina superior izquierda; es enlace a /
[ ] Estructura: <header> + <main> + <footer> en todas las páginas post-login
[ ] Breadcrumb: visible en todas las pantallas interiores
[ ] URLs limpios: sin query strings para identificar recursos
[ ] Sin scroll horizontal: verificar a 1024×768 en Chrome DevTools
[ ] Sin popups de nueva ventana: modales usando <dialog> HTML nativo
[ ] Campos obligatorios: marcados con * y atributo required
[ ] Labels: todo input tiene <label for="..."> asociado
[ ] Texto alineado a la izquierda: text-align: left en body y contenido narrativo
[ ] Vínculos visitados: color diferente con :visited pseudo-selector
[ ] Sin vínculos rotos: verificar con Check My Links o linkchecker
[ ] Mensajes de confirmación: para todas las acciones significativas
```

---

## 11. Estrategia de Pruebas End-to-End

Esta sección formaliza tres capas de pruebas E2E ordenadas por costo de implementación y cobertura de riesgo. Las tres son complementarias y no mutuamente excluyentes. El orden de implementación recomendado es el que aparece numerado.

---

### 11.1 🔄 Flujos API Encadenados (capa 1 — sin nueva infraestructura)

**Cuándo**: a partir de S2 (una vez que `submit` y `import` existen). Ejecutar en cada PR como parte de `pytest tests/`.  
**Ubicación**: `tests/test_flow_submit.py`, `tests/test_flow_full_period.py`  
**Infraestructura**: ninguna adicional — mismo pytest + httpx + SQLite `StaticPool`.

Estos tests validan que los endpoints funcionan correctamente **en secuencia**, detectando regresiones de integración que los tests aislados no detectan (por ejemplo: `submit` asume que `import` crea `ModuleStudent` con `status="active"`; un test aislado de `submit` puede crear el registro manualmente y pasar aunque `import` esté roto).

| ID | Flujo | Pasos encadenados | Criterio de éxito |
|---|---|---|---|
| 🔄 E2E-01 | Flujo completo docente (happy path) | login → `POST /students/import` (CSV) → `PUT /assessments` (todos los PIs) → `PUT /qualitative` (todos los PIs) → `PUT /submit` | Respuesta final `{"status": "completed"}` · `module.status = "completed"` en DB |
| 🔄 E2E-02 | Líder lee módulo completado | (continúa de E2E-01) → login como líder → `GET /assessments` → `GET /qualitative` | Ambas respuestas `200` con los datos guardados por el docente |
| 🔄 E2E-03 | Gates de submit en secuencia | login → `PUT /submit` (sin calificaciones) → expect `409 reason=students_without_grades` → `PUT /assessments` (completo) → `PUT /submit` (sin análisis) → expect `409 reason=missing_qualitative_analysis` → `PUT /qualitative` (completo) → `PUT /submit` → expect `200` | Los tres estados de submit se comportan correctamente en secuencia |
| 🔄 E2E-04 | Importación idempotente seguida de calificación | login → import CSV (N estudiantes) → import mismo CSV de nuevo → verificar `skipped=N` → `PUT /assessments` con IDs obtenidos de `GET /assessments` → `PUT /submit` | Import idempotente no duplica estudiantes; calificación funciona con los IDs reales de la importación |

---

### 11.2 🔄 Tests contra PostgreSQL Real (capa 2 — staging E2E)

**Cuándo**: antes del primer deploy a producción y en cada PR que toque modelos ORM o migraciones Alembic.  
**Ubicación**: fixture `pg_engine` en `tests/conftest.py`; marcador `@pytest.mark.pg` en los tests.  
**Infraestructura**: `docker-compose.yml` en la raíz del proyecto (servicio `db`, imagen `postgres:16-alpine`). Requiere Docker Desktop o Docker Engine disponible. Levantar con `docker compose up -d db` y luego exportar `TEST_PG_URL=postgresql+asyncpg://ra:local_only@localhost:5432/ra_test`.

**Inicio rápido**:
```bash
docker compose up -d db
TEST_PG_URL=postgresql+asyncpg://ra:local_only@localhost:5432/ra_test pytest tests/ -m pg -v
docker compose down
```

SQLite (en los tests actuales) no reproduce comportamientos específicos de PostgreSQL: `ON CONFLICT DO UPDATE`, campos `JSONB`, tipo `NUMERIC(5,2)`, y la semántica de transacciones `SERIALIZABLE`. Estos tests son los mismos tests de integración existentes ejecutados con un engine real.

**Configuración en `tests/conftest.py`**:
```python
import os, pytest
from sqlalchemy.ext.asyncio import create_async_engine

PG_URL = os.getenv("TEST_PG_URL")

@pytest.fixture(scope="session")
def pg_engine():
    if not PG_URL:
        pytest.skip("TEST_PG_URL not set — staging tests skipped")
    return create_async_engine(PG_URL, echo=False)
```

**Ejecutar staging tests**:
```bash
TEST_PG_URL=postgresql+asyncpg://ra:local_only@localhost:5432/ra_test pytest tests/ -m pg -v
```

**Criterio de done de E2E-PG-02**:
- `docker compose up -d db` inicia un PostgreSQL 16 healthy.
- `alembic upgrade head` corre contra una base vacía o el fixture PG recrea el schema completo sin errores.
- `tests/test_postgres_staging.py -m pg -v` termina con PG-01 a PG-05 passing, sin skips.
- La base usada por `TEST_PG_URL` es descartable/test-owned; nunca contiene datos reales ni datos staging valiosos sin política de reset.

| ID | Área | Descripción | Por qué SQLite no lo cubre |
|---|---|---|---|
| 🔄 PG-01 | `security_events.detail` | INSERT + SELECT de un `SecurityEvent` con campo `detail` (JSONB en PG, TEXT en SQLite) | SQLite almacena JSONB como TEXT sin validación de JSON; PostgreSQL rechaza JSON inválido |
| 🔄 PG-02 | Upsert `Assessment` | Dos escrituras con el mismo `(module_student_id, perf_indicator_id)` → verificar que solo existe un registro en DB | SQLite con StaticPool puede comportarse diferente al `ON CONFLICT` de PostgreSQL si se cambia a `insert().on_conflict_do_update()` en el futuro |
| 🔄 PG-03 | Upsert `ModuleAnalysis` | Análisis cualitativo para el mismo `(module_id, perf_indicator_id)` escrito dos veces | Misma razón que PG-02 |
| 🔄 PG-04 | Flujo completo (E2E-01 en PG) | Ejecutar el flujo de E2E-01 contra PostgreSQL real con migración `alembic upgrade head` aplicada | Verifica que la migración Alembic es correcta y los tipos de columna son compatibles con todos los endpoints |
| 🔄 PG-05 | `NUMERIC(5,2)` en `pi_weight` | Crear un PI con `pi_weight=60.00` y leerlo; verificar que la serialización a JSON no introduce error de flotante | SQLite puede retornar `60.0` donde PG retorna `Decimal('60.00')` |

---

### 11.3 🔄 Playwright — Browser E2E (capa 3 — frontend)

**Cuándo**: antes del primer deploy a producción (gate S2 — `S-S2-04` DG-TSI-09-V4). Ejecutar manualmente o en CI contra staging.  
**Ubicación**: `tests/e2e/` (directorio separado para no mezclar con la suite estándar).  
**Infraestructura**: `playwright` + `pytest-playwright` en `requirements.in`; servidor `uvicorn` con BD de staging; ejecutar con `pytest tests/e2e/ --headed` para ver el browser.

**Dependencia**: añadir `playwright` y `pytest-playwright` a `requirements.in` antes de S3. Instalar browsers: `playwright install chromium`.

**Configurar `tests/e2e/conftest.py`**:
```python
import pytest
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:8000"

@pytest.fixture(scope="session")
async def browser_context():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(base_url=BASE_URL)
        yield ctx
        await browser.close()
```

| ID | Pantalla | Descripción | Criterio de éxito |
|---|---|---|---|
| 🔄 PW-01 | Login | Rellenar `#email` + `#password` + submit → redirige a dashboard | URL final contiene `/dashboard.html`; título de la página es correcto |
| 🔄 PW-02 | Login — error inline | Contraseña incorrecta → mensaje de error visible en la misma página (sin popup) | Elemento `#error-msg` visible · no se abre nueva pestaña · no hay popup |
| 🔄 PW-03 | Logout | Clic en botón logout → redirige a `/` → request a endpoint protegido retorna 401 | Cookie `ra_session` ya no se envía en requests subsiguientes |
| 🔄 PW-04 | Conformidad DG-TSI-09-V4 | Header `#1E2843` · footer visible · logo enlaza a `/` · sin scroll horizontal a 1024×768 | Verificado con `page.evaluate()` para color CSS + `viewport_size` fijo |
| 🔄 PW-05 | Dashboard docente | Docente ve lista de módulos asignados tras login | Al menos 1 fila en la tabla de módulos; columna Estado visible |

> **Nota**: los tests PW-04 y PW-05 reemplazan la verificación manual del checklist §10 (Pruebas de Conformidad IUB DG-TSI-09-V4) para los ítems automatizables. Los ítems de UX que requieren juicio humano (redacción, coherencia visual) permanecen como checklists manuales en §10.

---

### 11.4 Orden de Implementación y Gates

| Capa | Sprint de implementación | Gate | Bloqueante para deploy |
|---|---|---|---|
| **11.1 API E2E** (E2E-01 a E2E-04) | S2 (ahora — sin nueva infraestructura) | Parte de `pytest tests/` en CI | Sí — bloquea merge a `main` si falla |
| **11.2 PostgreSQL staging** (PG-01 a PG-05) | Antes del primer deploy (S2–S3) | `pytest tests/ -m pg` con `TEST_PG_URL` activo | Sí — bloquea el primer deploy a producción |
| **11.3 Playwright** (PW-01 a PW-05) | S3 (cuando el frontend del dashboard esté implementado) | `pytest tests/e2e/` en staging | Sí — bloquea el primer deploy a producción |
