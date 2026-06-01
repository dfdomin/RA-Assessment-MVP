# INFRA-02 Evidence Template

Use this template after configuring Caddy 2 with automatic TLS on the real server. Do not paste secrets, private keys, API tokens, DNS provider credentials, or credentialed URLs. Replace sensitive values with safe aliases.

## Server identity

- Server alias:
- Hostname:
- OS/version:
- Operator:
- Date/time:
- App commit:
- Caddyfile source:

## DNS and pre-check evidence

- Public DNS points to server:
- UFW allows 80/tcp and 443/tcp:
- FastAPI service listens on loopback `127.0.0.1:8000`:
- Frontend directory exists at `/var/www/ra-assessment/frontend`:

## Caddyfile validation evidence

- `sudo caddy fmt --overwrite /etc/caddy/Caddyfile` result:
- `sudo caddy validate --config /etc/caddy/Caddyfile` result:
- `sudo systemctl reload caddy` result:
- `systemctl status caddy --no-pager` summary:

## TLS evidence

- `curl -I https://ra-assessment.iub.edu.co/` status:
- Certificate issuer:
- Certificate subject/SAN:
- Renewal/log observation:

## Health endpoint evidence

- `curl -fsS https://ra-assessment.iub.edu.co/health` result:
- Expected JSON `{"status":"ok"}` confirmed:
- `/health` routes to FastAPI, not the static frontend:

## API evidence

- `curl -I https://ra-assessment.iub.edu.co/api/v1/me` status:
- Expected unauthenticated status:
- Same-origin cookie boundary checked:

## Static frontend evidence

- `curl -I https://ra-assessment.iub.edu.co/` status:
- `curl -I https://ra-assessment.iub.edu.co/dashboard.html` status:
- Frontend assets served from `/var/www/ra-assessment/frontend`:

## Rollback evidence

- Previous `/etc/caddy/Caddyfile` backup path:
- Rollback command prepared:
- DNS/TLS stop sign reviewed:

## Final review

- Evidence checked against `docs/SECURITY_PRIVACY.md` section 9.5:
- Secrets excluded from this record:
- Remaining blockers:
- Operator sign-off:
- Reviewer sign-off:
- Final status: pending
