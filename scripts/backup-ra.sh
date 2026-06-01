#!/usr/bin/env bash
# backup-ra.sh — PostgreSQL dump encrypted with GPG and uploaded with rclone.
#
# Intended cron:
#   0 2 * * * /srv/ra-assessment/scripts/backup-ra.sh
#
# Required env:
#   DATABASE_URL or BACKUP_DATABASE_URL
#   BACKUP_GPG_RECIPIENT
#   BACKUP_RCLONE_REMOTE
set -Eeuo pipefail

log() {
    printf '%s\n' "$*" >&2
}

require_env() {
    local -r name="$1"
    if [[ -z "${!name:-}" ]]; then
        log "ERROR: ${name} is required"
        exit 1
    fi
}

require_command() {
    local -r command_name="$1"
    if ! command -v "$command_name" >/dev/null 2>&1; then
        log "ERROR: required command not found: ${command_name}"
        exit 1
    fi
}

backup_database_url() {
    local url="${BACKUP_DATABASE_URL:-${DATABASE_URL:-}}"
    if [[ -z "$url" ]]; then
        log "ERROR: DATABASE_URL or BACKUP_DATABASE_URL is required"
        exit 1
    fi
    if [[ "$url" == postgresql+asyncpg://* ]]; then
        printf 'postgresql://%s\n' "${url#postgresql+asyncpg://}"
        return 0
    fi
    printf '%s\n' "$url"
}

require_env "BACKUP_GPG_RECIPIENT"
require_env "BACKUP_RCLONE_REMOTE"

PG_DUMP_BIN="${PG_DUMP_BIN:-pg_dump}"
GPG_BIN="${GPG_BIN:-gpg}"
RCLONE_BIN="${RCLONE_BIN:-rclone}"
GZIP_BIN="${GZIP_BIN:-gzip}"

require_command "$PG_DUMP_BIN"
require_command "$GPG_BIN"
require_command "$RCLONE_BIN"
require_command "$GZIP_BIN"

BACKUP_DIR="${BACKUP_DIR:-/tmp}"
BACKUP_DATE="${BACKUP_DATE:-$(date +%Y%m%d)}"
mkdir -p "$BACKUP_DIR"

plain_backup="${BACKUP_DIR}/ra-${BACKUP_DATE}.sql.gz"
encrypted_backup="${plain_backup}.gpg"

cleanup_plaintext() {
    rm -f -- "$plain_backup"
}
trap cleanup_plaintext EXIT

dump_url="$(backup_database_url)"

log "==> Creating compressed PostgreSQL dump"
"$PG_DUMP_BIN" "$dump_url" | "$GZIP_BIN" -c > "$plain_backup"

log "==> Encrypting backup with GPG recipient ${BACKUP_GPG_RECIPIENT}"
"$GPG_BIN" \
    --batch \
    --yes \
    --trust-model always \
    --recipient "$BACKUP_GPG_RECIPIENT" \
    --encrypt \
    --output "$encrypted_backup" \
    "$plain_backup"

log "==> Uploading encrypted backup to ${BACKUP_RCLONE_REMOTE}"
"$RCLONE_BIN" copy "$encrypted_backup" "$BACKUP_RCLONE_REMOTE"

log "Backup complete: ${encrypted_backup}"
