# DECISIONS.md — Registro de Decisiones de Arquitectura

**Última actualización**: 2026-05-15  
**Formato**: ADR simplificado — cada decisión es independiente y autocontenida.

> Este archivo puede copiarse directamente al contexto de una nueva sesión de Claude o Codex para proporcionar el historial de decisiones de arquitectura sin necesidad de leer todo el PRD.

---

## ADR-01 — Stack Técnico Principal

| Campo | Detalle |
|---|---|
| **Decisión** | FastAPI + SQLAlchemy 2.x async + PostgreSQL 16 + HTML/JS estático (sin framework de frontend) |
| **Fecha** | 2026-05-15 |
| **Contexto** | El proyecto reemplaza un Excel/VBA. Se necesita una aplicación web que funcione con presupuesto mínimo (~$5 USD/mes), sea mantenible por un equipo pequeño, y tenga buena documentación automática (para exponer la API al frontend). |
| **Alternativas evaluadas** | Django (más complejo para API pura, ORM más difícil de asyncificar); Flask (menos soporte async nativo); React/Vue en frontend (requiere build step, node_modules, CDN no soporta apps JS bundleadas sin servidor); Next.js (demasiado para una app de gestión interna). |
| **Razón de la elección** | FastAPI: async nativo, documentación OpenAPI automática, Pydantic para validación en un solo lugar. SQLAlchemy async: sin SQL crudo = sin SQL injection estructural; migraciones con Alembic. HTML/JS estático: sin build step, sin superficie de ataque de frameworks; servido por Caddy desde el mismo VPS (ver ADR-12 — la opción original de GitHub Pages fue descartada al confirmar disponibilidad del VPS). |
| **Consecuencias** | El frontend requiere más código vanilla JS que un framework; la documentación de la API (Swagger UI) está disponible en `/docs` automáticamente; las migraciones de DB deben ser cuidadosas con SQLAlchemy async (no soporta operaciones síncronas en contexto async). |

---

## ADR-02 — Infraestructura: Hetzner CAX11

| Campo | Detalle |
|---|---|
| **Decisión** | Hetzner CAX11 (ARM64, 2 vCPU, 4 GB RAM, 40 GB NVMe) como servidor único |
| **Fecha** | 2026-05-15 |
| **Contexto** | El presupuesto máximo es $5 USD/mes. El sistema tiene ~30 docentes simultáneos en pico. No hay requerimiento de SLA formal. |
| **Alternativas evaluadas** | AWS EC2 t3.small ($15–20/mes — fuera de presupuesto); DigitalOcean Droplet $12/mes (más caro que Hetzner); Railway/Render (más caro y menos control); VPS compartido (bajo rendimiento, sin control de firewall). |
| **Razón de la elección** | €3.79/mes (ARM64 eficiente). 4 GB RAM es más que suficiente para FastAPI (~60 MB) + PostgreSQL + Caddy. ARM64 es más eficiente en energía (costo menor) sin impacto funcional para Python. |
| **Consecuencias** | ARM64 requiere que las dependencias tengan wheels para esa arquitectura (verificar en pip antes de agregar dependencias exóticas); el servidor único es un SPOF pero está dentro del riesgo aceptado para este presupuesto; Cloudflare R2 mitiga el riesgo de pérdida de datos (backups externos). |

---

## ADR-03 — Generación de PDF: WeasyPrint vs LibreOffice

| Campo | Detalle |
|---|---|
| **Decisión** | WeasyPrint para generación de PDF desde HTML/CSS |
| **Fecha** | 2026-05-15 |
| **Contexto** | El reporte ABET final y el informe del líder deben exportarse como PDF. El sistema no tiene instalación de Office disponible. |
| **Alternativas evaluadas** | LibreOffice headless (conversión docx→pdf): ~200 MB de instalación, complejo de mantener como proceso daemon, latencia alta de arranque (~3 s solo para iniciar LibreOffice); ReportLab (requiere construir PDF desde primitivas — complejo para layouts de tabla); xhtml2pdf (menos activo y menos soporte de CSS moderno). |
| **Razón de la elección** | WeasyPrint genera PDF desde HTML/CSS: el mismo template que se muestra en el navegador se usa para el PDF, sin duplicar código de layout. ~50 ms para un informe típico de 5 PIs. Sin dependencia de sistema operativo más allá de librerías de rendering (Pango, Cairo). Ya en el stack. |
| **Consecuencias** | El CSS para el PDF debe diseñarse con `@page` y `@media print` en mente (no todo el CSS de pantalla se traduce correctamente a PDF); WeasyPrint puede tener diferencias de rendering entre versiones — fijar la versión en `requirements.in`; el template HTML del reporte debe revisarse con el líder del programa antes de S4. |

---

## ADR-04 — Generación de DOCX: python-docx

| Campo | Detalle |
|---|---|
| **Decisión** | python-docx para generación de DOCX del informe del líder (F14) |
| **Fecha** | 2026-05-15 |
| **Contexto** | F14 requiere exportar el informe del líder en formato DOCX (además de PDF) para que pueda ser editado por el líder antes de compartirlo. |
| **Alternativas evaluadas** | LibreOffice headless (ya descartado en ADR-03); docxtpl (template-based, más simple pero menos control); generar HTML y convertir con LibreOffice (descartado). |
| **Razón de la elección** | python-docx es la librería estándar de Python para DOCX, con buena documentación y mantenimiento activo. La comparación de CPU (~50 ms para un informe típico) es similar a WeasyPrint. PDF es el formato predeterminado por ser inmutable; DOCX es una opción adicional. |
| **Consecuencias** | python-docx debe agregarse a `requirements.in` antes de S4 y someterse a `pip-audit`; el DOCX generado no debe contener macros — verificar en las pruebas `I-S4-08` y `S-S4-02`; `safe_cell_value()` debe aplicarse en todo campo de texto de usuarios escrito en el DOCX. |

---

## ADR-05 — Autenticación: JWT en Cookie httpOnly vs localStorage

| Campo | Detalle |
|---|---|
| **Decisión** | JWT almacenado en cookie httpOnly, Secure, SameSite=Strict; expiración 8 horas; JTI blocklist en `revoked_tokens` |
| **Fecha** | 2026-05-15 |
| **Contexto** | La aplicación necesita autenticación stateless (JWT) que sea segura contra XSS y que permita logout inmediato (invaliding el token sin esperar a que expire). |
| **Alternativas evaluadas** | localStorage: vulnerable a XSS — cualquier JS en la página puede leer el token; sessionStorage: igual que localStorage para XSS; JWT sin blocklist: el logout no puede invalidar el token antes de su expiración natural. |
| **Razón de la elección** | Cookie httpOnly es inaccesible desde JavaScript → protección contra XSS. `SameSite=Strict` previene CSRF. La JTI blocklist permite logout inmediato insertando el JTI del token en `revoked_tokens`. Expiración de 8 horas = una sesión laboral típica. |
| **Consecuencias** | El frontend usa `fetch` con `credentials: 'include'` en todas las llamadas a la API; el servidor debe limpiar periódicamente `revoked_tokens` de entradas expiradas (job diario o al arrancar); el cookie debe configurarse como `Secure` en producción (HTTPS obligatorio). |

---

## ADR-06 — Sanitización HTML: bleach

| Campo | Detalle |
|---|---|
| **Decisión** | `bleach.clean(text, tags=[], attributes={}, strip=True)` en todos los campos de texto libre antes de persistir en DB |
| **Fecha** | 2026-05-15 |
| **Contexto** | Los campos de análisis cualitativo del docente, síntesis del líder, plan de acción y conclusiones del informe del líder son texto libre ingresado por el usuario. Si no se sanitizan, un usuario podría insertar HTML/JS que se ejecutaría en el navegador de otro usuario. |
| **Alternativas evaluadas** | DOMPurify (solo funciona en el navegador, no en el backend); sanitizar solo al mostrar (riesgo de olvidar en algún render); permitir un subset de HTML con Markdown (añade complejidad — el PRD especifica texto plano). |
| **Razón de la elección** | `bleach` es una librería Python específicamente diseñada para sanitización HTML. Con `tags=[]` elimina absolutamente todo HTML/JS. El texto se almacena como texto plano puro; el renderer PDF/HTML escapa el contenido al generar el reporte. |
| **Consecuencias** | El texto sanitizado puede verse diferente al ingresado si el usuario colocó caracteres especiales HTML (`<`, `>`, `&`) — se muestran como texto literal; `bleach` debe estar en `requirements.in` desde S1 aunque se use formalmente en S2; actualizar `bleach` con `pip-audit` antes de cada deploy. |

---

## ADR-07 — Parser Excel: openpyxl con data_only=True

| Campo | Detalle |
|---|---|
| **Decisión** | `openpyxl.load_workbook(read_only=True, data_only=True)` para parsing de archivos XLSX subidos por los usuarios |
| **Fecha** | 2026-05-15 |
| **Contexto** | Los docentes pueden importar la lista de estudiantes desde un archivo XLSX. Un archivo XLSX malicioso podría contener macros VBA o fórmulas que se ejecuten al parsear (p.ej. `=HYPERLINK` puede hacer requests externos en algunas implementaciones). |
| **Alternativas evaluadas** | csv solo (sin soporte XLSX); pandas (dependencia muy pesada ~100 MB para este caso de uso); xlrd (no soporta XLSX en versiones recientes); openpyxl sin flags de seguridad (ejecuta fórmulas por defecto). |
| **Razón de la elección** | `data_only=True` lee los valores calculados en caché, no las fórmulas ejecutables. `read_only=True` no carga todas las hojas en memoria (previene DoS con archivos grandes). `openpyxl` es la librería estándar para XLSX en Python, sin dependencias de LibreOffice. |
| **Consecuencias** | `data_only=True` significa que si el archivo XLSX tiene fórmulas sin valor calculado en caché (ej. archivo recién creado en Excel sin haberlo guardado con fórmulas calculadas), los valores serán `None`; el parser debe manejar este caso y retornar un error descriptivo; el límite de 2 MB previene Zip bombs antes de que openpyxl abra el archivo. |

---

## ADR-08 — Supresión de Datos: Anonimización vs Eliminación Física

| Campo | Detalle |
|---|---|
| **Decisión** | Supresión de datos personales implementada como **anonimización** (`full_name = '[SUPRIMIDO]'`), no como eliminación física del registro |
| **Fecha** | 2026-05-15 |
| **Contexto** | La Ley 1581/2012 de Colombia otorga a los titulares el derecho de supresión de sus datos personales. Sin embargo, los datos de students están referenciados en `assessments`, `module_students` y `student_exclusions` — eliminar físicamente el registro de `students` rompe la integridad referencial de los reportes ABET cerrados. ABET requiere trazabilidad de los ciclos de acreditación. |
| **Alternativas evaluadas** | Eliminación física en cascada (DELETE ON CASCADE): destruye los reportes históricos de calificaciones — inaceptable para ABET; eliminar solo el nombre/cédula y dejar el ID (misma solución que la elegida, pero sin marca `is_suppressed`); exportar los datos antes de eliminar y guardar el export en otro sistema. |
| **Razón de la elección** | La anonimización preserva la integridad referencial de los reportes cerrados (ABET puede verificar que el período tenía N estudiantes), mientras elimina la información identificable que es el objeto de la Ley 1581. Esta práctica es compatible con el RGPD europeo (pseudonimización) y con la Ley 1581 (la supresión puede implementarse de modo que no afecte al derecho de defensa del responsable). |
| **Consecuencias** | El campo `is_suppressed` debe usarse en el frontend para no mostrar los datos del estudiante anonimizado; la política de retención (conservar datos de ABET indefinidamente) debe comunicarse a los titulares al momento de la recolección de datos; el aviso de privacidad institucional de la IUB debe documentar esta práctica. |

---

## ADR-09 — Estructura de Dos Niveles de Análisis (Docente + Líder)

| Campo | Detalle |
|---|---|
| **Decisión** | Dos tablas separadas (`module_analysis` y `leader_analysis`) para los dos niveles de análisis requeridos por ABET; dos flujos de escritura distintos en la API |
| **Fecha** | 2026-05-15 |
| **Contexto** | ABET requiere dos niveles de análisis: (1) el análisis del docente sobre el desempeño de sus propios estudiantes en cada PI (Nivel 1 — F04); (2) la síntesis del líder del programa sobre los resultados consolidados de todos los módulos para cada PI (Nivel 2 — F07 Sección 3). En el Excel original, ambos análisis se escribían en celdas separadas pero del mismo archivo. |
| **Alternativas evaluadas** | Una sola tabla `analysis` con campo `type` ('teacher'/'leader'): más simple pero confunde los contextos de acceso; tener el análisis del líder como campo en `leader_report_drafts` (confunde F07 con F14). |
| **Razón de la elección** | Tablas separadas hacen explícita la separación de responsabilidades: el docente escribe en `module_analysis`, el líder escribe en `leader_analysis`. Las reglas de acceso (solo el docente puede escribir el suyo, el líder puede leer ambos) son más claras y fáciles de testear. El reporte final (F07) consolida ambos en una sola vista para el auditor ABET. |
| **Consecuencias** | El endpoint `PUT /modules/{id}/qualitative` (docente) escribe en `module_analysis`; el endpoint de líder (parte del flujo del reporte) escribe en `leader_analysis`; el reporte final debe hacer JOIN de ambas tablas para construir la Sección 3; `leader_report_drafts` es separado aún — es para el informe informal del líder (F14), no para el reporte formal ABET (F07). |

---

## ADR-10 — Rate Limiting: slowapi (Capa App) + fail2ban (Capa OS)

| Campo | Detalle |
|---|---|
| **Decisión** | Dos capas de rate limiting: `slowapi` en la capa de aplicación (429 HTTP) + `fail2ban` en la capa de OS (ban de IP a nivel firewall) |
| **Fecha** | 2026-05-15 |
| **Contexto** | El endpoint `/auth/login` es el más expuesto a ataques de fuerza bruta y credential stuffing. Se necesita rate limiting que sea efectivo sin penalizar usuarios legítimos que puedan fallar el login una vez. |
| **Alternativas evaluadas** | Solo slowapi (sin fail2ban): un atacante que recibe 429s puede simplemente reintentar más lento y seguir atacando; solo fail2ban (sin slowapi): el servidor procesa todos los requests antes de que fail2ban pueda actuar; Redis para rate limiting distribuido (innecesario — servidor único). |
| **Razón de la elección** | `slowapi` en 5/min da respuesta inmediata (429) a ataques rápidos. `fail2ban` lee el `security.jsonl` y bloquea la IP a nivel de iptables/UFW después de 5 `login_failed` en 60 segundos — previene los ataques lentos que evitan el rate limit por segundo. Las dos capas se complementan: slowapi para velocidad, fail2ban para persistencia. |
| **Consecuencias** | fail2ban debe configurarse para leer el formato JSON del security log (ver `SECURITY_PRIVACY.md §6.2`); el ban de fail2ban es de 1 hora por defecto — suficiente para desincentivar ataques sin bloquear indefinidamente usuarios legítimos con contraseña olvidada; en producción, la IP del admin de sistemas debe estar en la whitelist de fail2ban. |

---

## ADR-14 — Líderes como Evaluadores con Autorización Contextual por Módulo

| Campo | Detalle |
|---|---|
| **Decisión** | Permitir que un usuario con rol global `leader` actúe como evaluador/docente de un módulo solo cuando esté asignado explícitamente en `module_staff` |
| **Fecha** | 2026-05-16 |
| **Contexto** | En la operación real de la IUB, un docente líder puede evaluar módulos de su propio RA/SO o de otro RA/SO. ABET exige procesos de assessment documentados, sistemáticos y transparentes, pero no impone una prohibición general de que un líder interno también recolecte o evalúe evidencia. |
| **Alternativas evaluadas** | Prohibir líderes-evaluadores (irrealista; fuerza trabajo fuera del sistema); manejarlo solo por política administrativa (débil ante IDOR y auditoría); crear roles globales adicionales (`leader_teacher`) (crece mal y no modela contexto). |
| **Razón de la elección** | El permiso real depende del recurso: una persona puede ser líder en un RA/SO y evaluador en uno o varios módulos. `module_staff` modela esa asignación y `verify_module_ownership` la hace exigible. Esto evita que el rol `leader` sea un bypass para escribir evaluaciones de módulos no asignados. |
| **Consecuencias** | Los endpoints de escritura de módulo deben aceptar `teacher` y `leader` asignados, pero siempre pasando por `verify_module_ownership`; los tests de S2 deben cubrir líder asignado a módulo propio, líder asignado a módulo de otro RA/SO y líder no asignado; la política administrativa define si una asignación requiere revisión por pares o aprobación adicional. |

---

## ADR-11 — Método de Desarrollo: Phased AI-Assisted

| Campo | Detalle |
|---|---|
| **Decisión** | Desarrollo por fases con sprints S0–S6, usando Claude/Codex como asistente pero con human review checkpoints en cada sprint |
| **Fecha** | 2026-05-15 |
| **Contexto** | El proyecto tiene complejidad alta (seguridad, privacidad, lógica de negocio ABET, múltiples roles) y un único desarrollador. Pedir a un LLM que genere toda la aplicación en un solo prompt produce código difícil de verificar y con errores de seguridad sutiles. |
| **Alternativas evaluadas** | Generar toda la app en un solo pass de LLM (riesgo alto de bugs de seguridad inencontrables); desarrollar manualmente sin asistencia de IA (más lento); usar Codex Agents autónomos sin supervisión (riesgo de alucinaciones en código de seguridad). |
| **Razón de la elección** | El phased approach permite: (1) revisar cada sprint antes de implementar el siguiente; (2) los tests de seguridad son gates bloqueantes; (3) los archivos de /memory/ permiten a un LLM retomar el contexto en la siguiente sesión sin perder decisiones tomadas. |
| **Consecuencias** | Cada sprint tiene un human review checkpoint documentado en `memory/HUMAN_REVIEW.md`; los archivos de `/memory/` deben actualizarse al final de cada sesión de trabajo; `memory/KNOWN_ISSUES.md` registra hallazgos de la prueba de penetración. |

---

## ADR-12 — Despliegue del Frontend: Caddy en Hetzner vs GitHub Pages

| Campo | Detalle |
|---|---|
| **Decisión** | Servir el frontend (HTML/CSS/JS estático) desde Caddy en el mismo VPS Hetzner CAX11, usando `file_server` con `root * /var/www/ra-assessment/frontend/`. GitHub Pages descartado. |
| **Fecha** | 2026-05-15 |
| **Contexto** | El proyecto se diseñó originalmente asumiendo que no habría VPS disponible, por lo que GitHub Pages era la opción gratuita más simple. Al confirmar que se dispone del Hetzner CAX11, la justificación original desaparece y emergen problemas técnicos de usar dos orígenes distintos. |
| **Alternativas evaluadas** | GitHub Pages (dominio `*.github.io` o custom domain separado): requiere `SameSite=None` en el cookie JWT (degrada la protección CSRF), configuración de CORS en FastAPI (`Access-Control-Allow-Credentials: true`), y dos dominios/certificados TLS a mantener. Requiere también que el repositorio sea público o contratar GitHub Pro (~$4/mes). |
| **Razón de la elección** | Mismo origen elimina todos los problemas de cross-origin: el cookie `ra_session` puede mantenerse `SameSite=Strict` (máxima protección CSRF), no se necesitan headers CORS, el browser envía el cookie automáticamente sin `credentials: 'include'`, un solo dominio y un solo certificado TLS gestionado por Caddy. Caddy ya está en el stack y su `file_server` tiene costo de configuración de 4 líneas en el Caddyfile. Los archivos HTML/CSS/JS pesan < 5 MB — trivial para el NVMe de 40 GB del CAX11. |
| **Consecuencias** | El frontend se despliega con `rsync -av --delete frontend/ /var/www/ra-assessment/frontend/` sin reiniciar servicios. La ruta de rutas del SPA (si se usa navegación del lado cliente) requiere `try_files {path} /index.html` en Caddy para que los refrescos de página no retornen 404. Eliminar la dependencia de GitHub Pages simplifica el pipeline de deploy a una sola operación desde el servidor. |

---

## ADR-13 — Integración de Datos: Ports & Adapters vs Integración Oracle Directa

| Campo | Detalle |
|---|---|
| **Decisión** | Implementar una capa de **Ports & Adapters** (`src/integration/`) con un contrato central `SyncPayload` y adaptadores por fuente (`file_adapter.py`, `oracle_adapter.py`, `rest_adapter.py`), en lugar de conectar directamente Oracle al backend de assessment. |
| **Fecha** | 2026-05-15 |
| **Contexto** | El SIS Academusoft de la IUB corre sobre Oracle. En el mediano plazo, la carga manual de CSV (F15) debería poder reemplazarse con sincronización directa desde Oracle, sin cambiar la lógica de assessment. El backend también debe poder usarse con otros SIS en el futuro (REST API, flat files). Sin un contrato formal, cada nueva fuente requeriría modificar el servicio central. |
| **Alternativas evaluadas** | Integración Oracle directa en `SyncService`: el servicio conoce el schema de Oracle y hace SELECT directamente → acoplamiento total entre el backend y el SIS; un cambio de tabla en Academusoft rompe el sistema; imposible probar sin Oracle. Integración vía ETL externo (Airbyte, dbt): introduce infraestructura adicional, overkill para un sistema de ~30 usuarios, costo fuera del presupuesto (~$0 adicional con el patrón elegido). |
| **Razón de la elección** | El patrón Ports & Adapters (Hexagonal Architecture) permite que `SyncService` solo conozca el contrato `SyncPayload`. Los adaptadores son intercambiables: el backend no cambia si el SIS cambia. `file_adapter.py` (CSV) es el adaptador de S5 y permite probar `SyncService` completamente sin Oracle. `oracle_adapter.py` puede implementarse cuando los 3 prerequisitos externos estén listos (ver `memory/NEXT_STEPS.md`), sin afectar ningún sprint anterior. |
| **Consecuencias** | `contracts.py` y `sync_service.py` se implementan en S2 (sin Oracle). `file_adapter.py` refactoriza el parser de F15 en S5 (reutilización de código existente). `oracle_adapter.py` queda como archivo vacío hasta S7. El campo `pege_id VARCHAR(50) UNIQUE NULLABLE` se agrega a `users` para mapear docentes entre el sistema y el SIS. La tabla `oracle_sync_log` registra todas las sincronizaciones con su fuente (`source`), proveyendo trazabilidad para Ley 1581. |

---

## ADR-15 — Estrategia de Pruebas End-to-End: Tres Capas

| Campo | Detalle |
|---|---|
| **Decisión** | Tres capas de pruebas E2E complementarias, implementadas en orden por coste/beneficio: (1) flujos API encadenados en pytest+httpx, (2) misma suite contra PostgreSQL real activada por `TEST_PG_URL`, (3) Playwright contra servidor levantado |
| **Fecha** | 2026-05-17 |
| **Contexto** | Los tests de integración actuales (85/85 passing) validan cada endpoint de forma aislada usando SQLite StaticPool. Este diseño detecta errores en endpoints individuales pero no detecta: (a) regresiones en flujos que encadenan múltiples endpoints (ej.: `import` crea ModuleStudent con `status="active"`, `submit` asume ese status), (b) diferencias de comportamiento entre SQLite y PostgreSQL (JSONB, ON CONFLICT, NUMERIC), (c) bugs de frontend (JS, CSS, navegación). Las tres brechas tienen soluciones distintas con costos distintos. |
| **Alternativas evaluadas** | Solo tests aislados (situación actual — no detecta brechas a+b+c); tests E2E Cypress (no compatible con pytest; requiere Node.js; añade complejidad innecesaria para HTML/JS estático); tests de contrato OpenAPI (detecta drift del contrato pero no flujos); tests de carga con Locust (diferente objetivo — concurrencia, no corrección). |
| **Razón de la elección** | **Capa 1 (flujos API)**: costo mínimo — reutiliza infraestructura existente (pytest+httpx+SQLite); implementable en S2; detecta la brecha más frecuente (dependencias entre endpoints). **Capa 2 (PostgreSQL staging)**: costo medio — misma suite, motor distinto; fixture `pg_engine` con skip automático si `TEST_PG_URL` no está; bloquea deploy solo cuando hay PG disponible. **Capa 3 (Playwright)**: costo mayor — requiere servidor levantado; se pospone a S3 cuando hay frontend implementado; cubre conformidad DG-TSI-09-V4 automatizable. Las tres son aditivas: agregar una no invalida las anteriores. |
| **Consecuencias** | Flujos API se implementan en S2 en `tests/test_flow_submit.py` (sin modificar conftest.py ni pyproject.toml). PostgreSQL staging requiere añadir `@pytest.mark.pg` y fixture `pg_engine` a `conftest.py` antes del primer deploy. Playwright requiere añadir `playwright` y `pytest-playwright` a `requirements.in` y crear `tests/e2e/conftest.py` en S3. Los IDs de cada test E2E (E2E-01–04, PG-01–05, PW-01–05) están documentados en `docs/TEST_PLAN.md §11` y enlazados en `docs/TRACEABILITY_MATRIX.md §3`. |

---

## ADR-16 — PostgreSQL local con Docker Compose para tests E2E (capa 2)

| Campo | Detalle |
|---|---|
| **Decisión** | Levantar PostgreSQL 16 localmente con `docker-compose.yml` (servicio `db`, imagen `postgres:16-alpine`) en lugar de esperar disponibilidad de staging Hetzner para ejecutar los tests PG-01–PG-05 |
| **Fecha** | 2026-05-18 |
| **Contexto** | Los tests PG-01–PG-05 (capa 2, ADR-15) llevan múltiples sesiones bloqueados porque `TEST_PG_URL` no está definida. La dependencia original era INFRA-02 (PostgreSQL en Hetzner staging). El desarrollador prefiere paridad de motores localmente con tal de que los tests sean reales y las funcionalidades queden sin errores de compatibilidad SQLite/PG. El council consultado (2026-05-18) dio veredicto unánime a favor de iniciar infraestructura, pero como una rebanada mínima de pruebas: PostgreSQL real/test primero, no una campaña completa de ops. |
| **Alternativas evaluadas** | Seguir esperando staging Hetzner: mantiene el bloqueo indefinido, pospone detección de bugs `JSONB`/`ON CONFLICT`/`NUMERIC`. Usar SQLite para todo: viola paridad de entornos (12-factor §10); SQLite no valida JSON, no tiene `ON CONFLICT DO UPDATE` real, `NUMERIC(5,2)` se comporta diferente. Servicio PG en CI cloud (GitHub Actions): válido a futuro, pero requiere pipeline CI que aún no existe y no resuelve el problema local. |
| **Razón de la elección** | Docker Compose añade un único archivo de configuración, usa la imagen oficial `postgres:16-alpine` (misma versión que producción Hetzner), y desbloquea `E2E-PG-02` sin dependencias externas. El volumen `ra_pgdata` preserva datos entre sesiones para desarrollo, pero los fixtures de tests hacen `drop_all/create_all` por test para aislamiento garantizado. `asyncpg` ya estaba instalado; no requiere cambios en `requirements.txt`. |
| **Consecuencias** | `docker-compose.yml` creado en raíz del proyecto. `.env.example` documenta `TEST_PG_URL`. `docs/TEST_PLAN.md §11.2` actualizado con inicio rápido de 3 comandos. `README.md` añade sección "Desarrollo local con PostgreSQL". `E2E-PG-02` pasa de bloqueado por diseño a **desbloqueable localmente**, pero solo debe marcarse ✅ cuando PG-01–PG-05 corran 5/5 contra PostgreSQL real. Migración Alembic `alembic upgrade head` puede validarse por primera vez contra esta BD local. La BD de `TEST_PG_URL` debe ser descartable/test-owned; no debe apuntar a datos valiosos ni a staging productivo sin estrategia de reset. |
