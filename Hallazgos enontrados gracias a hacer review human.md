rg "verify_module_ownership|ownership|module_ownership|S2" memory docs
docs/llm_council_ra_assessment_resultado.md
63:- **S2 — Dominio académico**

docs/ROLE_PERMISSION_MATRIX.md
22:- **Líder que también es docente de otro SO**: el sistema soporta este caso. Un usuario con rol `leader` puede ser asignado como docente (`module_staff`) en un módulo de otro período simultáneamente. En los endpoints de módulo, el check de `verify_module_ownership` aplica igual independientemente del rol.
23:- **Un docente con múltiples módulos**: accede a todos sus módulos asignados en el período activo, pero solo a los suyos. `verify_module_ownership` verifica por cada módulo individualmente.
33:| ✅ (propio) | Acceso permitido solo a recursos propios (via `verify_module_ownership`) |
77:| `PUT /modules/{id}/submit` | ❌ | ❌ | ✅ (propio) | `verify_module_ownership` — error 404 si no pertenece al docente; todos los estudiantes activos deben estar calificados |
87:| `GET /modules/{id}/assessments` | ✅ | ✅ | ✅ (propio) | Docente: `verify_module_ownership`; Admin/Líder: acceso a todos |
88:| `PUT /modules/{id}/assessments` | ❌ | ❌ | ✅ (propio) | `verify_module_ownership`; upsert por `module_student_id + perf_indicator_id` |
98:| `POST /modules/{id}/students/import` | ❌ | ❌ | ✅ (propio) | `verify_module_ownership`; parser defensivo: 2 MB, UTF-8, regex, anti-formula |
109:| `PUT /modules/{id}/qualitative` | ❌ | ❌ | ✅ (propio) | `verify_module_ownership`; `bleach.clean()` antes de persistir |
209:## 5. Verificación de `verify_module_ownership`
211:La dependencia `verify_module_ownership` **debe estar presente** en los siguientes endpoints para prevenir IDOR:
213:| Endpoint | ¿Tiene verify_module_ownership? | Comportamiento si falla |
224:**Test obligatorio (gate de S2)**: prueba de IDOR manual donde un docente intenta acceder al módulo de otro docente modificando el `module_id` en la URL — debe retornar 404 en todos los casos.

memory/DECISIONS.md
84:| **Consecuencias** | El texto sanitizado puede verse diferente al ingresado si el usuario colocó caracteres especiales HTML (`<`, `>`, `&`) — se muestran como texto literal; `bleach` debe estar en `requirements.in` desde S1 aunque se use formalmente en S2; actualizar `bleach` con `pip-audit` antes de cada deploy. |
175:| **Consecuencias** | `contracts.py` y `sync_service.py` se implementan en S2 (sin Oracle). `file_adapter.py` refactoriza el parser de F15 en S5 (reutilización de código existente). `oracle_adapter.py` queda como archivo vacío hasta S7. El campo `pege_id VARCHAR(50) UNIQUE NULLABLE` se agrega a `users` para mapear docentes entre el sistema y el SIS. La tabla `oracle_sync_log` registra todas las sincronizaciones con su fuente (`source`), proveyendo trazabilidad para Ley 1581. |

docs/SECURITY_PRIVACY.md
32:| Docente con acceso legítimo | Curiosidad, ver módulos de colegas | IDOR — modificar `{module_id}` en URL | `verify_module_ownership` → 404 ambiguo |
54:La dependencia `verify_module_ownership` se aplica en **todos** los endpoints que exponen datos de un módulo específico con acceso de docente:
57:async def verify_module_ownership(

memory/HUMAN_REVIEW.md
16:- [pendiente] `verify_module_ownership` está planificado para S2.

memory/PROJECT_STATE.md
147:| **S2** | ⬜ Pendiente | F02 Info Módulo + F03 Calificaciones + Pantalla 3b | verify_module_ownership + bleach + DG-TSI-09-V4 |
186:3. **Cada endpoint del docente que toca un módulo necesita `verify_module_ownership`** — ver `docs/ROLE_PERMISSION_MATRIX.md §5`.

docs/API_CONTRACT.md
320:**Seguridad**: `verify_module_ownership` — devuelve `404` si el módulo no pertenece al docente
337:**Roles permitidos**: Admin, Líder; Docente (solo su módulo — `verify_module_ownership`)
368:**Seguridad**: `verify_module_ownership`
381:**Errores**: `422` si `level` no es 1–4 | `404` ownership check falla
392:**Seguridad**: `verify_module_ownership`  
424:**Roles permitidos**: Admin, Líder; Docente (solo su módulo — `verify_module_ownership`)
447:**Seguridad**: `verify_module_ownership`; sanitización HTML obligatoria
461:**Errores**: `422` si `analysis_text` supera 2000 caracteres | `404` ownership check
897:### Protección IDOR (`verify_module_ownership`)

memory/NEXT_STEPS.md
115:- **Descripción**: Revisar manualmente: (1) que `verify_module_ownership` esté en el plan para S2; (2) que las cookies emitidas sean httpOnly y Secure; (3) que el audit log escribe correctamente para `login_success` y `login_failed`; (4) que `deploy.sh` falla correctamente ante CVEs.

docs/TRACEABILITY_MATRIX.md
51:| **Sprint** | S2 |
65:| **Sprint** | S2 (calificaciones), S5 (importación CSV/Excel) |
66:| **Criterios clave** | Selector de 4 niveles discretos (no numérico) · `verify_module_ownership` en todos los endpoints · Exclusión de estudiantes con motivo documentado (4 categorías) · Regla de completitud: Activos = Calificados para poder hacer submit · Total Score y Standard calculados por API en runtime (no en DB) |
261:| **Sprint** | S2 (`contracts.py` + `sync_service.py`) · S5 (`file_adapter.py` — refactor de parsers de F15) · S7 (`oracle_adapter.py` — condicional, 3 prerequisitos) |
272:| S2 | F02 · F03 (calificaciones) · F03 Pantalla 3b (revisión rúbrica) · **F16** (`contracts.py` + `sync_service.py`) | `verify_module_ownership` · `bleach` · Pydantic validators · Auditoría DG-TSI-09-V4 · agnosticismo de `SyncService` verificado (U-S2-11) |

memory/SESSION_LOG.md
294:4. **Una sesión = un bloque coherente**: Intentar hacer todo S0+S1+S2 en una sesión desborda el contexto y genera errores acumulados. Bloques de 2-4 horas con un entregable claro y gates de calidad al final son más eficientes.

docs/TEST_PLAN.md
67:## 3. Sprint S2 — Módulos, Calificaciones y Pantalla de Rúbrica
70:**Gate de seguridad**: `verify_module_ownership` + `bleach` + Pydantic en API + Auditoría DG-TSI-09-V4
76:| U-S2-01 | `src/services/assessment.py` | Cálculo de Total Score con 4 PIs activos y pesos conocidos | Resultado exacto (tolerancia ±0.001) |
77:| U-S2-02 | `src/services/assessment.py` | Cálculo de Standard: Total Score 2.5 → `'Medium'` según `level_thresholds` default | Retorna `'Medium'` |
78:| U-S2-03 | `src/services/assessment.py` | Cálculo de distribución de niveles: 2 Poor, 5 Inadequate, 18 Adequate, 6 Exemplary → porcentajes | Retorna `{Poor: 6.45, Inadequate: 16.13, Adequate: 58.06, Exemplary: 19.35}` (con 31 activos) |
79:| U-S2-04 | `src/services/sanitize.py` | `sanitize_qualitative_text()` elimina `<script>alert(1)</script>` | Retorna `'alert(1)'` sin tags HTML |
80:| U-S2-05 | `src/services/sanitize.py` | `sanitize_qualitative_text()` rechaza texto > 2000 caracteres | Lanza `ValueError` |
86:| I-S2-01 | `GET /modules/{id}/assessments` | Docente ve calificaciones de su propio módulo | `200` con datos correctos |
87:| I-S2-02 | `GET /modules/{id}/assessments` | Docente intenta ver calificaciones de módulo ajeno | `404 Not Found` (no 403) |
88:| I-S2-03 | `PUT /modules/{id}/assessments` | Calificación válida con level 1–4 | `200` con total_score y standard calculados |
89:| I-S2-04 | `PUT /modules/{id}/assessments` | Calificación con level = 5 (fuera de rango) | `422 Unprocessable Entity` |
90:| I-S2-05 | `GET /rubrics` | Docente puede leer la rúbrica del período activo | `200` con PIs y descriptores |
91:| I-S2-06 | `PUT /modules/{id}/submit` | Submit con estudiantes sin calificar | `409 Conflict` con lista de estudiantes pendientes |
97:| 🔒 S-S2-01 | **IDOR** | Docente A modifica `module_id` en URL para acceder al módulo de Docente B | `404 Not Found` en todos los endpoints de módulo (GET assessments, PUT assessments, POST students/import, GET qualitative, PUT qualitative, PUT submit) |
98:| 🔒 S-S2-02 | XSS | `PUT /modules/{id}/qualitative` con `analysis_text` que contiene `<script>alert(1)</script>` | Texto sanitizado retornado por `GET` no contiene el tag `<script>` |
99:| 🔒 S-S2-03 | Pesos API bypass | Enviar PUT de calificación con `level = 0` o `level = 5` directamente | `422` — validación Pydantic bloquea |
100:| 🔒 S-S2-04 | DG-TSI-09-V4 | Auditoría visual del frontend del flujo docente | ✅ Paleta `#1E2843`/`#FFDF2D` · tipografía Arial/Open Sans · header+contenido+footer · sin scroll horizontal a 1024×768 · sin popups de nueva ventana · campos obligatorios con `*` |
108:| U-S2-10 | `src/integration/contracts.py` | `SyncPayload` es importable y validable sin dependencias externas | `from src.integration.contracts import SyncPayload` sin error; instanciación con datos mínimos válidos |
109:| U-S2-11 | `src/integration/sync_service.py` | Mismo `SyncPayload` con `source='csv'` y luego con `source='academusoft'` → mismo resultado en DB | Los registros en PostgreSQL son idénticos; el campo `source` solo cambia en `oracle_sync_log`, no en las tablas de datos |
110:| U-S2-12 | `src/integration/sync_service.py` | `SyncPayload` con `consent_acknowledged: false` y lista de estudiantes no vacía | `ValueError` con mensaje que referencia Ley 1581/2012; ningún registro escrito en DB |
302:Antes del deploy a producción (gate de S2), verificar manualmente:

docs/PRD.md
725:> **Sprint**: S2 (contracts.py + sync_service.py); S5 (file_adapter.py — refactor de parsers de F15); S7 condicional (oracle_adapter.py — ver prerequisitos).
768:**Prerequisitos para `oracle_adapter.py`** (bloquean S7 — no bloquean S2 ni S5):
936:  PUT  /modules/{id}/submit           -- roles: Docente; verifica module_ownership
939:  GET  /modules/{id}/assessments      -- roles: Admin, Lider; Docente (verifica module_ownership)
940:  PUT  /modules/{id}/assessments      -- roles: Docente; verifica module_ownership
943:  POST /modules/{id}/students/import  -- roles: Docente; verifica module_ownership
948:  GET  /modules/{id}/qualitative      -- roles: Admin, Lider; Docente (verifica module_ownership)
949:  PUT  /modules/{id}/qualitative      -- roles: Docente; verifica module_ownership
995:**Dependencia `verify_module_ownership`** — aplicada en todos los endpoints de modulo con acceso del docente:
1000:async def verify_module_ownership(
1034:| Autorizacion | FastAPI Depends | `require_role()` + `verify_module_ownership()` en cada endpoint |
1170:  - Proteccion IDOR mediante `verify_module_ownership` en todos los endpoints de modulo
1443:| S2 | F02 Info Modulo + F03 Calificaciones + Pantalla 3b Revision Rubrica + exclusion de estudiantes + **F16** (`contracts.py` + `sync_service.py`) | 🔒 `verify_module_ownership` en todos los endpoints de modulo + `bleach` en campos de analisis + validacion Pydantic de pesos en API. 🔒 **Auditoría de conformidad DG-TSI-09-V4:** verificar paleta de colores institucional (`#1E2843`, `#FFDF2D`), tipografía permitida (Arial / Open Sans / Helvetica / Verdana), estructura header/contenido/footer, vínculos visitados con color diferenciado, ausencia de scroll horizontal a 1024×768 px, y ausencia de popups de nueva ventana en todo el flujo docente. 🔒 Agnosticismo de `SyncService`: mismo `SyncPayload` con `source='csv'` y `source='academusoft'` produce resultado identico en DB (U-S2-11). | Docente solo ve sus modulos; calificacion con selector de 4 niveles; validacion de pesos replicada en API; frontend pasa auditoría DG-TSI-09-V4; `SyncService` rechaza `consent_acknowledged: false` con estudiantes |
1504:Todo endpoint que exponga datos de un modulo especifico requiere la dependencia `verify_module_ownership`. Esta dependencia verifica que el usuario autenticado esta en `module_staff` para ese modulo. El error devuelto es siempre `404 Not Found` — nunca `403 Forbidden` — para no confirmar la existencia del recurso a un atacante.
1507:async def verify_module_ownership(
1806:  - module_id pertenece al docente autenticado (verify_module_ownership)

docs/ARCHITECTURE.md
40:│   │   ├── deps.py           # get_db, get_current_user, require_role, verify_module_ownership
127:            Deps["Dependencies\nrequire_role()\nverify_module_ownership()"]
174:El frontend no contiene lógica de negocio. Toda regla de negocio (suma de pesos = 100%, completitud del módulo, ownership) está enforced en el backend.
182:| Autorización | `require_role()` por endpoint + `verify_module_ownership()` para endpoints de módulo |
194:  ↓ verify_module_ownership(): ¿módulo pertenece al docente? →