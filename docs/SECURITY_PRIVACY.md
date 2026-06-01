# SECURITY_PRIVACY.md — RA Assessment App

**Versión del documento**: 1.0  
**Fecha**: 2026-05-15  
**Referencia PRD**: §16 (Postura de Seguridad), §17 (Superficie F03), §11 (No-Funcionales)  
**Audiencia**: Desarrolladores, auditores de seguridad, responsable de privacidad

> Un auditor de seguridad que lea este documento puede evaluar la postura del sistema sin necesidad de leer el PRD.

---

## 1. Resumen Ejecutivo

La RA Assessment App es una aplicación web de uso interno institucional que procesa **datos personales de estudiantes colombianos** (cédulas y nombres completos) y **datos académicos sensibles** (calificaciones y análisis cualitativos de desempeño). La postura de seguridad sigue el marco WAF (Well-Architected Framework de Google Cloud) con cinco principios: Security by Design (A), Zero Trust (B), Shift-Left (C), Preemptive Cyber Defense (D) y Ley 1581/2012 (E).

| Principio | Estado en v2.2 |
|---|---|
| A — Security by Design | ✅ Cubierto (parser masivo F15, throttle F13, DOCX injection F14) |
| B — Zero Trust | ✅ Cubierto (validación criptográfica OIDC F12, JWT independiente de sesión Microsoft) |
| C — Shift-Left Security | ✅ Cubierto (`authlib` y `python-docx` en pip-audit; parsers F15 en Bandit) |
| D — Preemptive Cyber Defense | ✅ Cubierto (audit log completo para F12, F13, F14, F15) |
| E — Ley 1581/2012 | ✅ Cubierto (`consent_acknowledged` en carga masiva F15) |

---

## 2. Modelo de Amenazas

### 2.1 Actores de Amenaza

| Actor | Motivación | Vector más probable | Mitigación principal |
|---|---|---|---|
| Docente con acceso legítimo | Curiosidad, ver módulos de colegas | IDOR — modificar `{module_id}` en URL | `verify_module_ownership` → 404 ambiguo |
| Líder que también evalúa | Sobreacceso accidental por rol global | Usar privilegios de líder para escribir en módulos no asignados | `verify_module_ownership` aplica igual a `leader` y `teacher`; escritura solo con `module_staff` |
| Atacante externo (credential stuffing) | Acceso a datos de estudiantes | Fuerza bruta en `/auth/login` | Rate limit 5/min + fail2ban |
| Docente/estudiante técnico | Manipular calificaciones | Bypass de validaciones del frontend vía API directa | Pydantic validators en API (no solo frontend) |
| Atacante de supply chain | Comprometer el servidor | Paquete PyPI con malware | `pip-audit` con hashes SHA-256 en cada deploy |
| Auditor ABET (víctima indirecta) | N/A | CSV/Excel injection en reportes exportados | `safe_cell_value()` en exportaciones |
| Líder malintencionado | Spam / open relay | Usar F13 para enviar correos a destinatarios externos | Solo acepta `recipient_ids` internos; throttle 15/60s |

### 2.2 Amenazas Fuera del Alcance de v1

Las siguientes amenazas están documentadas pero **no mitigadas** en v1 (requieren presupuesto adicional o son de baja probabilidad dado el contexto):

- Compromiso físico del servidor Hetzner (requeriría cifrado de disco completo — €40+/mes de overhead)
- DDoS sostenido (requeriría CDN/WAF externo — Cloudflare Pro)
- Insider threat a nivel de administrador de sistema (requeriría auditoría de acceso SSH)
- Suplantación del IdP de Microsoft en el flujo OIDC (mitigada parcialmente por validación del `id_token`; certificate pinning fuera de alcance en v1)

---

## 3. A — Security by Design

### 3.1 Protección IDOR en Módulos

La dependencia `verify_module_ownership` se aplica en **todos** los endpoints que exponen datos de un módulo específico bajo contexto de evaluador. La regla es contextual: docentes y líderes pueden escribir sobre un módulo solo si existe una fila en `module_staff` para su `user_id`. El rol global `leader` no bypassa este control.

```python
async def verify_module_ownership(
    module_id: int,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Module:
    result = await db.execute(
        select(Module)
        .join(ModuleStaff, Module.id == ModuleStaff.module_id)
        .where(
            Module.id == module_id,
            ModuleStaff.user_id == current_user.id,
        )
    )
    module = result.scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    return module
```

**Regla crítica**: el error es siempre `404 Not Found`, nunca `403 Forbidden`. Esto previene que un atacante confirme la existencia de módulos de otros evaluadores. El caso de líderes-evaluadores queda soportado por asignación explícita, no por privilegio global.

### 3.2 Validaciones de Negocio en la API

Las validaciones críticas se replican en Pydantic además del frontend:

```python
class RubricInput(BaseModel):
    pis: List[PIInput]

    @field_validator("pis")
    @classmethod
    def weights_must_sum_100(cls, pis):
        total = sum(pi.weight for pi in pis if pi.is_active)
        if abs(total - 100.0) > 0.01:
            raise ValueError(f"PI weights must sum to 100%, got {total:.2f}%")
        return pis
```

Un cliente que bypasee el JavaScript de validación recibe igualmente `422 Unprocessable Entity`.

### 3.3 Sanitización de Campos de Texto Libre (XSS / HTML Injection)

Los campos de análisis cualitativo (docente), síntesis del líder, plan de acción y conclusiones del informe del líder (F14) se sanitizan antes de persistir:

```python
import bleach

def sanitize_qualitative_text(text: str, max_chars: int = 2000) -> str:
    cleaned = bleach.clean(text, tags=[], attributes={}, strip=True)
    if len(cleaned) > max_chars:
        raise ValueError(f"Text exceeds {max_chars} characters")
    return cleaned.strip()
```

Esta función elimina **todo** HTML y JavaScript. El texto se almacena y muestra siempre como texto plano.

### 3.4 Sanitización en Exportaciones (Excel/DOCX Injection)

Cualquier campo con datos de usuarios escrito en celdas Excel o en documentos DOCX pasa por `safe_cell_value()`:

```python
FORMULA_PREFIXES = ("=", "+", "-", "@", "|", "%")

def safe_cell_value(value: str) -> str:
    """Previene Excel/DOCX injection prefijando valores con apóstrofe."""
    if value and str(value)[0] in FORMULA_PREFIXES:
        return "'" + value
    return value
```

Esta función protege al auditor ABET que abre el reporte exportado en Excel o Word — previene que fórmulas maliciosas en nombres de estudiantes se ejecuten.

### 3.5 Throttle Anti-Spam en F13 (Recordatorios)

```python
@router.post("/periods/{period_id}/reminders")
@limiter.limit("15/minute", key_func=lambda request: get_current_user(request).id)
async def send_reminders(request: Request, period_id: int, body: ReminderInput):
    # Solo acepta recipient_ids que existan en users con asignación activa en el período
    ...
```

Si se supera el límite, devuelve `429 Too Many Requests` y registra el intento en `security_events` con severidad WARN.

### 3.6 Consentimiento Informado en Carga Masiva (F15, Ley 1581/2012)

La importación masiva de estudiantes (datos personales: cédula, nombre) requiere confirmación explícita:

```python
class StudentBulkImportRequest(BaseModel):
    consent_acknowledged: bool

    @field_validator("consent_acknowledged")
    @classmethod
    def must_be_true(cls, v):
        if not v:
            raise ValueError(
                "Debe confirmar que los datos fueron recopilados con consentimiento informado (Ley 1581/2012)"
            )
        return v
```

Si `consent_acknowledged` es `false` o está ausente, la API devuelve `400 Bad Request`.

---

## 4. B — Zero Trust

### 4.1 Autorización por Rol en Cada Endpoint

```python
class Role(str, Enum):
    ADMIN = "admin"
    LEADER = "leader"
    TEACHER = "teacher"

def require_role(*roles: Role):
    async def checker(current_user = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return checker

# Uso en un router:
@router.get("/periods/{period_id}/tracking")
async def get_tracking(
    period_id: int,
    _: User = Depends(require_role(Role.ADMIN, Role.LEADER)),
):
    ...
```

### 4.1.1 Autorización Contextual de Módulos

`require_role()` decide si el usuario puede entrar a una familia de endpoints; `verify_module_ownership()` decide si puede actuar como evaluador sobre un módulo concreto. Esta separación soporta el caso institucional aprobado donde un líder puede evaluar un módulo de su propio RA/SO o de otro RA/SO.

Reglas:

- `leader` puede leer datos agregados y supervisar por rol.
- `leader` solo puede escribir calificaciones, importar estudiantes, guardar análisis cualitativo de módulo o hacer submit si está asignado en `module_staff`.
- `teacher` sigue la misma regla de ownership para escritura.
- `admin` no hace submit ni escribe evaluación de módulo; administra configuración y supervisión.

### 4.2 Rate Limiting en `/auth/login`

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/auth/login")
@limiter.limit("5/minute")
async def login(request: Request, credentials: LoginInput):
    ...
```

### 4.3 Token JWT con Blocklist de Revocación

El logout inserta el JTI del token en `revoked_tokens`. En cada request autenticado se verifica que el JTI no esté revocado:

```python
async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    token = request.cookies.get("ra_session")
    payload = decode_jwt(token)  # Verifica firma y expiración
    jti = payload["jti"]
    
    # Verificar que el token no fue revocado (logout)
    result = await db.execute(
        select(RevokedToken).where(RevokedToken.jti == jti)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=401, detail="Token has been revoked")
    
    return await get_user_by_id(db, payload["sub"])
```

### 4.4 Validación Criptográfica del id_token Microsoft (F12)

```python
from authlib.integrations.starlette_client import OAuth

oauth = OAuth()
oauth.register(
    name="microsoft",
    client_id=settings.MICROSOFT_CLIENT_ID,
    client_secret=settings.MICROSOFT_CLIENT_SECRET,
    server_metadata_url=(
        f"https://login.microsoftonline.com/{settings.MICROSOFT_TENANT_ID}"
        "/v2.0/.well-known/openid-configuration"
    ),
    client_kwargs={"scope": "openid email profile"},
)

# En el callback OIDC:
token = await oauth.microsoft.authorize_access_token(request)
# authlib valida automáticamente: firma criptográfica, iss, aud, exp
user_info = token.get("userinfo")
```

El JWT interno de la app se emite siempre con expiración de 8 horas y JTI blocklist, **independientemente** de si el usuario se autenticó por Microsoft o por login nativo.

---

## 5. C — Shift-Left Security

### 5.1 Lockfile con Hashes SHA-256

```bash
# Generar el lockfile (en desarrollo, cuando se agregan dependencias):
pip-compile --generate-hashes requirements.in

# Instalar en producción (verifica hashes — falla si algún hash no coincide):
pip install --require-hashes -r requirements.txt
```

### 5.2 Pipeline de Seguridad en `deploy.sh`

```bash
#!/bin/bash
set -e

# 1. Auditoría de CVEs en dependencias
pip-audit --require-hashes -r requirements.txt --output json \
  --output-file /var/log/ra-assessment/pip-audit-$(date +%Y%m%d).json
if [ $? -ne 0 ]; then
    echo "ERROR: CVEs found in dependencies. Deploy aborted."
    exit 1
fi

# 2. Análisis estático de seguridad (SAST)
bandit -r src/ -ll -ii
if [ $? -ne 0 ]; then
    echo "ERROR: Bandit found HIGH/MEDIUM severity issues. Deploy aborted."
    exit 1
fi
```

**Scope de Bandit**: todos los módulos bajo `src/`, incluyendo explícitamente los parsers de importación masiva de F15 (`src/services/parser.py`) que son la superficie de ataque más amplia del sistema.

### 5.3 Dependencias de Seguridad en `requirements.in`

```
slowapi            # Rate limiting
bleach             # Sanitización HTML
pip-audit          # Auditoría de CVEs en deploy
bandit[toml]       # SAST en deploy
authlib            # Cliente OIDC para F12
python-docx        # Generación DOCX para F14
```

---

## 6. D — Preemptive Cyber Defense

### 6.1 Security Audit Log (JSON estructurado)

Todos los eventos de seguridad se escriben en `/var/log/ra-assessment/security.jsonl` como JSON por línea (JSON Lines format):

```python
def log_security_event(
    event: str,
    user_id: int | None,
    ip: str,
    detail: dict | None = None,
    severity: str = "INFO"
):
    record = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "event": event,
        "user_id": user_id,
        "ip": ip,
        "severity": severity,
        **(detail or {}),
    }
    security_logger.info(json.dumps(record))
```

### 6.2 Integración con fail2ban

Plantillas versionadas para ejecucion operativa: `docs/ops/fail2ban-ra-assessment-filter.conf` y `docs/ops/fail2ban-ra-assessment-jail.conf`.

```ini
# /etc/fail2ban/filter.d/ra-assessment.conf
[Definition]
failregex = .*"event": "login_failed".*"ip": "<HOST>".*

# /etc/fail2ban/jail.d/ra-assessment.conf
[ra-assessment]
enabled  = true
filter   = ra-assessment
logpath  = /var/log/ra-assessment/security.jsonl
maxretry = 5
bantime  = 3600
findtime = 60
```

Con esta configuración, una IP que acumule 5 `login_failed` en 60 segundos queda bloqueada 1 hora a nivel de firewall (UFW + iptables).

### 6.3 Listado Completo de Eventos del Audit Log

Ver `DATA_MODEL.md §3.19` para la tabla completa de eventos con sus campos `detail`.

---

## 7. E — Ley 1581/2012 (Habeas Data Colombia)

### 7.1 Datos Personales en Scope

Los siguientes datos personales de estudiantes colombianos están en scope de la Ley 1581/2012:

| Dato | Clasificación | Tabla | Uso |
|---|---|---|---|
| Número de cédula / TI | Semiprivado | `students.document_number` | Identificación del estudiante |
| Nombre completo | Semiprivado | `students.full_name` | Identificación y reportes ABET |
| ID interno del sistema académico | Semiprivado | `students.internal_id` | Vinculación con sistema de la institución |

Las calificaciones y análisis cualitativos son datos **académicos institucionales**, no datos personales en el sentido de la Ley 1581 (son datos del programa, no del individuo). No obstante, se tratan con las mismas medidas de restricción de acceso.

### 7.2 Medidas Técnicas Implementadas

| Medida | Implementación |
|---|---|
| Cifrado en tránsito | HTTPS obligatorio (Caddy TLS automático vía Let's Encrypt) |
| Cifrado en reposo (backups) | `pg_dump` → GPG encrypt → Cloudflare R2 (llave privada offline) |
| Acceso restringido | Datos de estudiantes solo visibles para el docente asignado al módulo y admin/líder |
| Trazabilidad de accesos | Audit log `security_events` registra todos los accesos a datos personales |
| Consentimiento informado | F15: `consent_acknowledged: true` obligatorio en carga masiva de estudiantes |

### 7.3 Derechos del Titular — Procedimiento de Habeas Data

**Artículo 8 de la Ley 1581/2012** otorga a los titulares derechos de acceso, corrección y supresión.

**Derecho de acceso** — endpoint `GET /admin/habeas-data/{doc_number}`:
- Solo accesible por el rol Admin
- Retorna todos los datos del titular en el sistema
- Registra `habeas_data_accessed` en `security_events` con hash parcial del número de documento (no el número completo en el log)

**Derecho de supresión** — endpoint `PUT /admin/suppress/{student_id}`:
- Implementado como **anonimización, no eliminación física**
- El registro del estudiante permanece en la DB para preservar la integridad de reportes ABET cerrados (requerimiento de trazabilidad de ABET)
- La acción actualiza `full_name` → `'[SUPRIMIDO]'` y `document_number` → `'[SUPRIMIDO-{id}]'`
- Registra el evento en `security_events` con `admin_id` y hash parcial del documento

```sql
UPDATE students
SET full_name = '[SUPRIMIDO]',
    document_number = '[SUPRIMIDO-' || id || ']',
    is_suppressed = TRUE
WHERE id = :student_id;
```

### 7.4 Política de Retención

Los datos de períodos cerrados se conservan **indefinidamente** por requerimiento de ABET (trazabilidad de ciclos de acreditación). Esta política debe:
1. Documentarse en el aviso de privacidad institucional de la IUB
2. Comunicarse a los titulares al momento de la recolección de datos
3. Estar disponible para revisión por la autoridad competente (SIC — Superintendencia de Industria y Comercio)

### 7.5 Punto de Control de Consentimiento — SyncPayload (F16)

El campo `consent_acknowledged: bool` del contrato `SyncPayload` es el **único punto de control de Ley 1581/2012** para la importación de datos personales de estudiantes, independientemente de la fuente del dato:

| Fuente del dato | Adaptador | `consent_acknowledged` requerido |
|---|---|---|
| CSV manual (Admin sube archivo) | `file_adapter.py` | Sí — Admin confirma en UI antes de enviar |
| Oracle Academusoft (sync directa) | `oracle_adapter.py` | Sí — la configuración inicial del adaptador requiere aval jurídico (PREREQ-03) |
| SIS REST futuro | `rest_adapter.py` | Sí — mismo contrato, mismo control |

`SyncService` rechaza con `400 Bad Request` cualquier `SyncPayload` con `consent_acknowledged: false` que contenga registros de estudiantes. Este control opera en la **capa de servicio** (no en el adaptador), garantizando que ningún adaptador puede bypassearlo. Un error en `oracle_adapter.py` o en `file_adapter.py` no exime del control.

---

## 8. Parser Defensivo — Importación CSV/XLSX

La importación de archivos (F03 y F15) es la **superficie de ataque más amplia del sistema**. Los siguientes controles aplican a todos los endpoints de importación.

### 8.1 Vectores de Ataque y Controles

| Vector | Severidad | Control implementado |
|---|---|---|
| CSV/Formula Injection | Crítico | Rechaza prefijos `=`, `+`, `-`, `@`, `|`, `%`; `safe_cell_value()` en exportaciones |
| Archivo sobredimensionado (DoS) | Alto | Límite de **2 MB** antes de parsear |
| Encoding attack | Alto | UTF-8 estricto con BOM; error si encoding inválido |
| Zip bomb / XML bomb en XLSX | Medio | `openpyxl(read_only=True)` + límite de 2 MB |
| Macros VBA en XLSX | Medio | `openpyxl(data_only=True)` — no ejecuta fórmulas ni macros |
| SQL Injection via datos | Bajo | SQLAlchemy ORM con parámetros preparados (sin SQL crudo) |

### 8.2 Límites del Parser

| Parámetro | Valor |
|---|---|
| Tamaño máximo del archivo | 2 MB |
| Máximo de registros por import (F03) | 100 estudiantes |
| Encoding aceptado | UTF-8 (con o sin BOM) |
| MIME types aceptados | `text/csv`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |

### 8.3 Regex de Validación de Campos

```python
SAFE_NAME_RE = re.compile(r"^[\w\s\-\.ÁÉÍÓÚáéíóúÑñÜü,]{1,120}$")
SAFE_ID_RE   = re.compile(r"^\d{5,12}$")      # ID interno: solo dígitos
SAFE_DOC_RE  = re.compile(r"^[\d\-]{6,15}$")  # Cédula/TI: dígitos y guión
```

### 8.4 Regla de Rechazo por Fórmula

```python
FORMULA_PREFIXES = ("=", "+", "-", "@", "|", "%")

def check_formula_injection(value: str, field_name: str):
    if value and str(value)[0] in FORMULA_PREFIXES:
        raise ValueError(f"Potentially malicious formula in field '{field_name}': {value!r}")
```

### 8.5 Opciones de openpyxl que Previenen Ejecución de Código

```python
import openpyxl
import io

wb = openpyxl.load_workbook(
    io.BytesIO(raw_bytes),
    read_only=True,   # No carga hojas en memoria completa
    data_only=True,   # Lee valores calculados, no fórmulas ejecutables
)
```

`data_only=True` significa que `=HYPERLINK(...)` se lee como el último valor calculado en caché, no como la fórmula ejecutable.

---

## 9. Hardening del Servidor

### 9.1 SSH

```
# /etc/ssh/sshd_config
PasswordAuthentication no
PubkeyAuthentication yes
# Usar llaves Ed25519 únicamente
```

### 9.2 Firewall UFW

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment "SSH admin"
ufw allow 80/tcp comment "Caddy HTTP→HTTPS redirect"
ufw allow 443/tcp comment "Caddy HTTPS"
ufw enable
```

### 9.3 PostgreSQL — Solo Loopback

```
# /etc/postgresql/16/main/postgresql.conf
listen_addresses = 'localhost'
# Verificar: ss -tlnp | grep 5432 → debe mostrar 127.0.0.1:5432
```

### 9.3.1 PostgreSQL de Pruebas Local (`TEST_PG_URL`)

`TEST_PG_URL` se usa únicamente para pruebas opt-in contra PostgreSQL real. Puede apuntar al servicio `db` de `docker-compose.yml`, pero debe cumplir estas reglas:

- La base es descartable/test-owned; no contiene datos personales reales ni datos staging valiosos.
- Las credenciales de `.env.example` (`ra/local_only`) son solo locales y no se reutilizan en staging/producción.
- Los tests pueden hacer `drop_all/create_all` o migraciones sobre esa base sin aprobación adicional.
- Si `TEST_PG_URL` apunta a un servidor compartido, debe existir una política explícita de reset/aislamiento antes de ejecutar tests destructivos.
- Un `docker-compose.yml` presente no equivale a evidencia de seguridad: `E2E-PG-02` solo queda completo cuando PG-01 a PG-05 pasan sin skips.

### 9.4 Actualizaciones Automáticas de Seguridad

```bash
apt install unattended-upgrades -y
dpkg-reconfigure unattended-upgrades   # Habilitar solo security updates
```

### 9.5 Checklist de Hardening (verificar antes del primer deploy a producción)

Runbook operativo: `docs/SERVER_OPERATIONS_RUNBOOK.md`. Plantillas de evidencia/configuracion: `docs/ops/INFRA_01_EVIDENCE_TEMPLATE.md`, `docs/ops/Caddyfile.ra-assessment`, `docs/ops/INFRA_02_EVIDENCE_TEMPLATE.md`, `docs/ops/fail2ban-ra-assessment-filter.conf`, `docs/ops/fail2ban-ra-assessment-jail.conf`, `docs/ops/INFRA_03_EVIDENCE_TEMPLATE.md`, `docs/ops/INFRA_04_EVIDENCE_TEMPLATE.md`. `INFRA-01`, `INFRA-02`, `INFRA-03` e `INFRA-04` no deben marcarse como completas solo por tener documentación; requieren evidencia real del servidor.

```
[ ] SSH: PasswordAuthentication=no, solo llaves Ed25519
[ ] UFW: solo puertos 22/80/443 abiertos, verificado con ufw status
[ ] PostgreSQL: listen_addresses='localhost', verificado con ss -tlnp | grep 5432
[ ] fail2ban: instalado y con jail ra-assessment activo
[ ] unattended-upgrades: habilitado para security updates
[ ] .env: permisos 600, propietario del proceso de la app
[ ] .gitignore: contiene .env y *.env
[ ] SECRET_KEY: ≥64 bytes aleatorios (openssl rand -hex 32)
[ ] Backups: pg_dump diario en cron, GPG encrypt, subida a R2
[ ] pip-audit: corrido sin CVEs antes del primer deploy
[ ] bandit: corrido sin issues HIGH/MEDIUM antes del primer deploy
[ ] Prueba de penetración básica de IDOR: completada con resultado exitoso
```

---

## 10. Variables de Entorno Sensibles

Almacenadas en `/srv/ra-assessment/.env` (permisos `600`, fuera de git):

```bash
# Obligatorias
DATABASE_URL=postgresql+asyncpg://ra_user:STRONG_PASS@localhost/ra_assessment
SECRET_KEY=<64 bytes aleatorios — openssl rand -hex 32>
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
BACKUP_GPG_RECIPIENT=backup@ra-app   # Fingerprint del receptor GPG
BACKUP_RCLONE_REMOTE=r2:ra-assessment-backups/

# Opcionales — habilitan F12 (Microsoft OIDC) si están presentes
MICROSOFT_CLIENT_ID=<desde Azure AD>
MICROSOFT_CLIENT_SECRET=<desde Azure AD>
MICROSOFT_TENANT_ID=<desde Azure AD>
```

**Reglas para secrets**:
1. Nunca en el repositorio de git
2. Nunca en logs ni en mensajes de error de la API
3. Rotar `SECRET_KEY` invalida todos los tokens activos (logout masivo)
4. La llave privada GPG para backups se almacena **offline** (no en el servidor)
5. `GMAIL_APP_PASSWORD` debe ser un App Password específico de la app, no la contraseña de la cuenta Gmail

---

## 11. Backups Cifrados

El script versionado `scripts/backup-ra.sh` ejecuta el flujo obligatorio:
`pg_dump` → `gzip` → `gpg --encrypt` → `rclone copy`.

Plantilla de evidencia operativa: `docs/ops/INFRA_04_EVIDENCE_TEMPLATE.md`.

Configuración mínima de cron:

```bash
0 2 * * * cd /srv/ra-assessment && /srv/ra-assessment/scripts/backup-ra.sh
```

El script falla si no existen `DATABASE_URL` o `BACKUP_DATABASE_URL`,
`BACKUP_GPG_RECIPIENT`, `BACKUP_RCLONE_REMOTE`, `pg_dump`, `gpg`, `gzip` o
`rclone`. También elimina el dump `.sql.gz` sin cifrar mediante trap de salida.

**Restauración**: requiere acceso físico al material de llave GPG del administrador (almacenado offline). El procedimiento de restauración debe probarse **antes del primer deploy a producción**.
