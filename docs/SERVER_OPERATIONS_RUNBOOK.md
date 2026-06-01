# SERVER_OPERATIONS_RUNBOOK.md — RA Assessment App

Este runbook convierte las tareas de infraestructura externa en pasos reproducibles para agentes IA y operadores humanos. No reemplaza la ejecucion en el servidor real. Una tarea INFRA solo se marca completa cuando existe evidencia capturada en `memory/SESSION_LOG.md`, `memory/PROJECT_STATE.md` y, si aplica, en el checklist humano.

## Principios de Operacion

- No pegar secretos, llaves privadas, tokens, passwords ni URLs con credenciales en documentos, chats o logs.
- Ejecutar cambios peligrosos en ventanas cortas, con una segunda terminal SSH abierta antes de tocar SSH o UFW.
- Pedir aprobacion humana explicita antes de cambiar firewall, SSH, cron, servicios systemd, DNS/TLS o restaurar backups con datos reales.
- Capturar evidencia verificable: comando ejecutado, salida relevante, fecha/hora, servidor y resultado.
- No marcar INFRA-01 como completa hasta tener evidencia real del servidor Hetzner.

## INFRA-01 — Hardening del Servidor Hetzner

Objetivo: dejar el servidor base listo para desplegar la aplicacion sin exponer SSH por password, PostgreSQL publico ni puertos innecesarios.

### 0. Pre-chequeo y rollback

Antes de modificar SSH o UFW:

```bash
whoami
hostnamectl
ip addr show
sudo ss -ltnp
sudo ufw status verbose
sudo systemctl status ssh --no-pager
```

Rollback minimo:

```bash
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak.$(date +%Y%m%d%H%M%S)
sudo ufw allow 22/tcp comment "Emergency SSH"
```

Mantener abierta una segunda sesion SSH antes de ejecutar `sudo systemctl reload ssh` o `sudo ufw enable`.

### 1. SSH solo con llaves

Editar `/etc/ssh/sshd_config` y verificar:

```text
PasswordAuthentication no
PubkeyAuthentication yes
PermitRootLogin prohibit-password
```

Validar sintaxis y recargar:

```bash
sudo sshd -t
sudo systemctl reload ssh
sudo systemctl status ssh --no-pager
```

Evidencia requerida:

- `sudo sshd -t` sin salida de error.
- `sudo systemctl status ssh --no-pager` muestra servicio activo.
- Login por llave probado en una sesion nueva.
- Login por password rechazado o deshabilitado.

### 2. UFW con puertos minimos

Configurar politica cerrada y abrir solo SSH, HTTP y HTTPS:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment "SSH"
sudo ufw allow 80/tcp comment "Caddy HTTP to HTTPS redirect"
sudo ufw allow 443/tcp comment "Caddy HTTPS"
sudo ufw enable
sudo ufw status verbose
```

Evidencia requerida:

- `ufw status verbose` muestra default deny incoming.
- Solo aparecen `22/tcp`, `80/tcp` y `443/tcp` como reglas abiertas.
- La sesion SSH nueva sigue entrando por llave.

### 3. PostgreSQL solo local

Verificar que PostgreSQL no escucha en interfaces publicas:

```bash
sudo ss -ltnp | grep 5432
sudo -u postgres psql -c "SHOW listen_addresses;"
```

Resultado esperado:

- `ss -ltnp` muestra `127.0.0.1:5432` o `localhost:5432`, no `0.0.0.0:5432`.
- `SHOW listen_addresses;` devuelve `localhost` o una configuracion equivalente local-only.

Si aparece `0.0.0.0:5432` o una IP publica, detener el despliegue y corregir PostgreSQL antes de continuar.

### 4. Actualizaciones de seguridad

Instalar y habilitar actualizaciones automaticas de seguridad:

```bash
sudo apt update
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure unattended-upgrades
systemctl status unattended-upgrades --no-pager
```

Evidencia requerida:

- Paquete `unattended-upgrades` instalado.
- Servicio activo o timer configurado.
- Configuracion limitada a security updates, sin upgrades amplios no revisados.

### 5. Relacion con fail2ban

`INFRA-01` verifica que la base del servidor quede lista. `fail2ban` se valida formalmente en `INFRA-03`, pero para el cierre de hardening debe quedar al menos documentado si esta instalado:

```bash
systemctl status fail2ban --no-pager
```

La evidencia fuerte de `fail2ban-client status ra-assessment` pertenece a `INFRA-03`.

### Checklist de cierre INFRA-01

Completar solo con evidencia real:

- [ ] SSH: `PasswordAuthentication no`, login por llave probado.
- [ ] UFW: `ufw status verbose` con deny incoming y solo 22/80/443 abiertos.
- [ ] PostgreSQL: `ss -ltnp` confirma `127.0.0.1:5432` o `localhost:5432`.
- [ ] unattended-upgrades: instalado y limitado a security updates.
- [ ] rollback documentado: backup de `sshd_config` y sesion SSH alterna probada.
- [ ] `memory/SESSION_LOG.md` incluye comandos, salidas relevantes y decision final.

## INFRA-02 — Caddy 2 con TLS Automatico

Objetivo: servir el frontend estatico y la API desde el mismo origen HTTPS, con Caddy gestionando certificados TLS automaticamente.

Plantillas versionadas:

- Caddyfile: `docs/ops/Caddyfile.ra-assessment`
- Evidencia: `docs/ops/INFRA_02_EVIDENCE_TEMPLATE.md`

### 0. Pre-chequeo y rollback

Antes de modificar Caddy o DNS/TLS:

```bash
hostnamectl
sudo ss -ltnp
sudo ufw status verbose
sudo systemctl status caddy --no-pager
sudo systemctl status ra-assessment --no-pager
```

Rollback minimo:

```bash
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak.$(date +%Y%m%d%H%M%S)
sudo caddy validate --config /etc/caddy/Caddyfile
```

Detener la ejecucion si DNS no apunta al servidor correcto, si UFW no permite `80/tcp` y `443/tcp`, o si el servicio FastAPI no escucha en `127.0.0.1:8000`.

### 1. Instalar y validar Caddyfile

Copiar la plantilla versionada a `/etc/caddy/Caddyfile` y validar:

```bash
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
systemctl status caddy --no-pager
```

La plantilla debe mantener estas rutas:

- `/health` -> `reverse_proxy 127.0.0.1:8000`
- `/api/*` -> `reverse_proxy 127.0.0.1:8000`
- resto de rutas -> `file_server` desde `/var/www/ra-assessment/frontend`

### 2. Smoke tests HTTPS

```bash
curl -fsS https://ra-assessment.iub.edu.co/health
curl -I https://ra-assessment.iub.edu.co/
curl -I https://ra-assessment.iub.edu.co/dashboard.html
curl -I https://ra-assessment.iub.edu.co/api/v1/me
```

Resultado esperado:

- `/health` devuelve `{"status":"ok"}` desde FastAPI.
- `/` y `/dashboard.html` devuelven HTML estatico por HTTPS.
- `/api/v1/me` responde como API protegida, no como archivo estatico.
- El certificado TLS corresponde al dominio esperado y no requiere secretos pegados en logs.

### Checklist de cierre INFRA-02

Completar solo con evidencia real:

- [ ] `sudo caddy validate --config /etc/caddy/Caddyfile` sin errores.
- [ ] `systemctl status caddy --no-pager` muestra servicio activo.
- [ ] `https://ra-assessment.iub.edu.co/health` devuelve `{"status":"ok"}`.
- [ ] `/api/*` se enruta a Uvicorn y el frontend se sirve desde `/var/www/ra-assessment/frontend`.
- [ ] TLS automatico activo para el dominio final.
- [ ] `memory/SESSION_LOG.md` incluye comandos, salidas relevantes y decision final.

## INFRA-03 — fail2ban para Login Fallido

Objetivo: bloquear temporalmente fuentes que acumulen intentos fallidos de login contra `/api/v1/auth/login`, usando los eventos `login_failed` del audit log de la aplicacion.

Plantillas versionadas:

- Filtro: `docs/ops/fail2ban-ra-assessment-filter.conf`
- Jail: `docs/ops/fail2ban-ra-assessment-jail.conf`
- Evidencia: `docs/ops/INFRA_03_EVIDENCE_TEMPLATE.md`

### 0. Pre-chequeo y rollback

Antes de modificar fail2ban:

```bash
systemctl status fail2ban --no-pager
sudo fail2ban-client status
sudo test -r /var/log/ra-assessment/security.jsonl
sudo ufw status verbose
```

Rollback minimo:

```bash
sudo cp /etc/fail2ban/filter.d/ra-assessment.conf /etc/fail2ban/filter.d/ra-assessment.conf.bak.$(date +%Y%m%d%H%M%S) 2>/dev/null || true
sudo cp /etc/fail2ban/jail.d/ra-assessment.conf /etc/fail2ban/jail.d/ra-assessment.conf.bak.$(date +%Y%m%d%H%M%S) 2>/dev/null || true
```

Detener la ejecucion si el audit log no existe, si no contiene eventos `login_failed` con campo `ip`, o si UFW no esta activo.

### 1. Instalar filtro y jail

Copiar las plantillas versionadas a:

- `/etc/fail2ban/filter.d/ra-assessment.conf`
- `/etc/fail2ban/jail.d/ra-assessment.conf`

Validar el filtro contra el log real y recargar:

```bash
sudo fail2ban-regex /var/log/ra-assessment/security.jsonl /etc/fail2ban/filter.d/ra-assessment.conf
sudo systemctl reload fail2ban
sudo fail2ban-client status ra-assessment
```

La configuracion esperada del jail:

- `logpath = /var/log/ra-assessment/security.jsonl`
- `maxretry = 5`
- `findtime = 60`
- `bantime = 3600`
- `action = ufw[name=ra-assessment]`

### 2. Prueba de ban controlada

Desde una fuente de prueba segura, generar 5 failed logins contra `/api/v1/auth/login` sin usar credenciales reales. Luego verificar:

```bash
sudo fail2ban-client status ra-assessment
sudo fail2ban-client set ra-assessment unbanip <test-ip>
```

Evidencia requerida:

- `fail2ban-client status ra-assessment` muestra el jail activo.
- El contador del jail detecta los eventos `login_failed`.
- La fuente de prueba queda baneada despues de 5 failed logins.
- La fuente de prueba se desbanea al final de la validacion.

### Checklist de cierre INFRA-03

Completar solo con evidencia real:

- [ ] Filtro instalado desde `docs/ops/fail2ban-ra-assessment-filter.conf`.
- [ ] Jail instalado desde `docs/ops/fail2ban-ra-assessment-jail.conf`.
- [ ] `fail2ban-regex` encuentra eventos `login_failed` reales sin falsos positivos relevantes.
- [ ] `fail2ban-client status ra-assessment` muestra el jail activo.
- [ ] 5 failed logins desde una IP de prueba activan el ban.
- [ ] IP de prueba desbaneada y rollback documentado.
- [ ] `memory/SESSION_LOG.md` incluye comandos, salidas relevantes y decision final.

## INFRA-04 — Backups GPG Diarios y Restore Drill

Objetivo: ejecutar `scripts/backup-ra.sh` diariamente para producir backups PostgreSQL cifrados con GPG, subirlos por `rclone` a R2 y probar restauracion en un entorno aislado antes de produccion.

Plantilla versionada:

- Evidencia: `docs/ops/INFRA_04_EVIDENCE_TEMPLATE.md`

### 0. Pre-chequeo y secretos

Antes de tocar cron, rclone o backups con datos reales:

```bash
cd /srv/ra-assessment
bash -n scripts/backup-ra.sh
command -v pg_dump gzip gpg rclone
stat -c "%a %U %G" /srv/ra-assessment/.env
gpg --list-keys
rclone lsd <backup-remote-alias>
```

No imprimir `.env`, URLs con credenciales, dumps SQL, llaves privadas ni listados completos con datos sensibles. La llave privada GPG debe permanecer offline; el servidor productivo solo necesita la llave publica del receptor `BACKUP_GPG_RECIPIENT`.

### 1. Configurar variables y remote

Validar que el entorno productivo tenga:

```bash
BACKUP_GPG_RECIPIENT=<fingerprint-o-alias-publico>
BACKUP_RCLONE_REMOTE=r2:ra-assessment-backups/
```

`DATABASE_URL` o `BACKUP_DATABASE_URL` ya debe existir para la aplicacion. Confirmar el destino sin pegar credenciales:

```bash
rclone lsd <backup-remote-alias>
```

### 2. Configurar cron diario

Instalar la tarea diaria:

```cron
0 2 * * * cd /srv/ra-assessment && /srv/ra-assessment/scripts/backup-ra.sh
```

Verificar:

```bash
crontab -l
```

### 3. Ejecutar backup manual controlado

Ejecutar una corrida manual y comprobar que solo queda artefacto cifrado:

```bash
cd /srv/ra-assessment
scripts/backup-ra.sh
find "${BACKUP_DIR:-/tmp}" -name "*.sql.gz" ! -name "*.gpg"
```

Resultado esperado:

- `pg_dump` genera el dump comprimido.
- `gpg --encrypt` produce `ra-YYYYMMDD.sql.gz.gpg`.
- `rclone copy` sube el archivo cifrado.
- No queda `.sql.gz` sin cifrar en el directorio temporal.

### 4. Restore drill en entorno aislado

La prueba de restore drill se hace fuera del servidor productivo o contra una base descartable sin trafico de usuarios:

```bash
gpg --decrypt ra-YYYYMMDD.sql.gz.gpg > ra-restore.sql.gz
gunzip -c ra-restore.sql.gz | psql "$RESTORE_DATABASE_URL"
psql "$RESTORE_DATABASE_URL" -c "select count(*) from users;"
```

No usar `DATABASE_URL` productivo como `RESTORE_DATABASE_URL`. Borrar los artefactos temporales al terminar el drill.

### Checklist de cierre INFRA-04

Completar solo con evidencia real:

- [ ] Llave publica GPG instalada y llave privada confirmada offline.
- [ ] `BACKUP_GPG_RECIPIENT` y `BACKUP_RCLONE_REMOTE` configurados sin exponer secretos.
- [ ] `rclone lsd` confirma acceso al destino de backups.
- [ ] `crontab -l` muestra `0 2 * * * cd /srv/ra-assessment && /srv/ra-assessment/scripts/backup-ra.sh`.
- [ ] Backup manual produce `.sql.gz.gpg` y lo sube a R2.
- [ ] No queda `.sql.gz` sin cifrar en el servidor productivo.
- [ ] restore drill completado en entorno aislado con `gpg --decrypt`, `gunzip` y `psql`.
- [ ] `memory/SESSION_LOG.md` incluye comandos, salidas relevantes y decision final.

## Registro de Evidencia

Plantillas versionadas: `docs/ops/INFRA_01_EVIDENCE_TEMPLATE.md`, `docs/ops/INFRA_02_EVIDENCE_TEMPLATE.md`, `docs/ops/INFRA_03_EVIDENCE_TEMPLATE.md`, `docs/ops/INFRA_04_EVIDENCE_TEMPLATE.md`.

Formato recomendado para pegar en `memory/SESSION_LOG.md` sin secretos:

```text
Servidor: <hostname o alias sin secreto>
Fecha/hora: <YYYY-MM-DD HH:MM TZ>
Tarea: INFRA-01 hardening
Comandos ejecutados:
- sudo sshd -t -> OK
- sudo ufw status verbose -> deny incoming; 22/80/443 abiertos
- sudo ss -ltnp | grep 5432 -> 127.0.0.1:5432
- systemctl status unattended-upgrades --no-pager -> active/configured
Resultado: pendiente/completo
Blockers: <si aplica>
```
