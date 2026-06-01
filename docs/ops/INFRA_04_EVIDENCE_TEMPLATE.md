# INFRA-04 Evidence Template

Use this template after configuring encrypted PostgreSQL backups on the real server and completing a restore drill in an isolated environment. Do not paste secrets, private keys, passwords, tokens, credentialed URLs, database dumps, decrypted SQL, personal data, or full bucket listings. Replace sensitive values with safe aliases.

## Server identity

- Server alias:
- Hostname:
- OS/version:
- Operator:
- Date/time:
- App commit:
- Backup script source:

## Pre-check evidence

- `scripts/backup-ra.sh` present and executable:
- `bash -n scripts/backup-ra.sh` result:
- `pg_dump`, `gzip`, `gpg`, and `rclone` installed:
- `.env` permissions checked without printing contents:

## GPG public key evidence

- `gpg --list-keys` shows backup recipient:
- `BACKUP_GPG_RECIPIENT` points to the expected public key fingerprint or alias:
- Private key confirmed offline, not stored on the server:
- Key owner/recovery contact:

## rclone remote evidence

- `rclone lsd <backup-remote-alias>` result:
- `BACKUP_RCLONE_REMOTE` destination confirmed without credentialed URL:
- Bucket/container retention expectation:
- Access limited to backup upload path:

## Cron evidence

- `crontab -l` includes the daily backup entry:
- Expected schedule `0 2 * * *` confirmed:
- Working directory is `/srv/ra-assessment`:
- Cron environment loads required backup variables:

## Backup execution evidence

- Manual `scripts/backup-ra.sh` run result:
- Encrypted artifact name:
- `rclone` upload result:
- Remote encrypted artifact observed:
- No plaintext `.sql.gz` left in `BACKUP_DIR`:

## Plaintext cleanup evidence

- `find <backup-dir-alias> -name "*.sql.gz" ! -name "*.gpg"` result:
- Decrypted SQL not stored on production server:
- Temporary restore files removed after drill:

## Restore drill evidence

- Restore environment alias:
- Restore database is isolated and contains no production writes:
- `gpg --decrypt` succeeded with offline private key material:
- `gunzip` succeeded:
- `psql` restore into isolated database succeeded:
- Basic data integrity smoke query:
- Restore artifacts removed:

## Rollback evidence

- Previous cron backup path:
- rclone config backup path or rollback note:
- Backup job disabled/reverted if validation failed:
- Restore drill cleanup completed:

## Final review

- Evidence checked against `docs/SECURITY_PRIVACY.md` section 11:
- Secrets excluded from this record:
- Remaining blockers:
- Operator sign-off:
- Reviewer sign-off:
- Final status: pending
