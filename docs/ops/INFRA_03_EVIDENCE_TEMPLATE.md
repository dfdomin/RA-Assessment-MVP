# INFRA-03 Evidence Template

Use this template after configuring fail2ban on the real server. Do not paste secrets, private keys, passwords, tokens, credentialed URLs, full IP allowlists, or personal data. Replace sensitive values with safe aliases.

## Server identity

- Server alias:
- Hostname:
- OS/version:
- Operator:
- Date/time:
- App commit:
- Filter source:
- Jail source:

## Pre-check evidence

- `systemctl status fail2ban --no-pager` summary before change:
- `/var/log/ra-assessment/security.jsonl` exists and is readable by fail2ban:
- App emits `login_failed` audit events with safe IP field:
- UFW is enabled:

## Filter validation evidence

- Filter installed at `/etc/fail2ban/filter.d/ra-assessment.conf`:
- `fail2ban-regex /var/log/ra-assessment/security.jsonl /etc/fail2ban/filter.d/ra-assessment.conf` result:
- Matched `login_failed` lines:
- False positives observed:

## Jail status evidence

- Jail installed at `/etc/fail2ban/jail.d/ra-assessment.conf`:
- `sudo systemctl reload fail2ban` result:
- `fail2ban-client status ra-assessment` result:
- `maxretry = 5`, `findtime = 60`, and `bantime = 3600` confirmed:

## Ban test evidence

- Test source alias:
- 5 failed logins generated against `/api/v1/auth/login`:
- `fail2ban-client status ra-assessment` shows banned test source:
- Unban or expiry observed:
- Legitimate operator access preserved:

## Rollback evidence

- Previous filter backup path:
- Previous jail backup path:
- Rollback command prepared:
- Test ban removed after validation:

## Final review

- Evidence checked against `docs/SECURITY_PRIVACY.md` section 9.5:
- Secrets excluded from this record:
- Remaining blockers:
- Operator sign-off:
- Reviewer sign-off:
- Final status: pending
