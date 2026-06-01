# INFRA-01 Evidence Template

Use this template after executing hardening on the real Hetzner server. Do not paste secrets, private keys, passwords, tokens, credentialed URLs, full IP allowlists, or personal data. Replace sensitive values with safe aliases.

## Server identity

- Server alias:
- Hostname:
- OS/version:
- Operator:
- Date/time:
- App commit:
- Runbook version:

## Pre-check evidence

- `whoami`:
- `hostnamectl`:
- `sudo ss -ltnp` summary:
- `sudo ufw status verbose` summary:
- `sudo systemctl status ssh --no-pager` summary:

## SSH hardening evidence

- `sudo sshd -t` result:
- `PasswordAuthentication no` confirmed:
- `PubkeyAuthentication yes` confirmed:
- `PermitRootLogin prohibit-password` confirmed:
- Fresh key-based login tested:
- Password login rejected or disabled:
- `sudo systemctl status ssh --no-pager` result:

## UFW evidence

- `sudo ufw status verbose` result:
- Default incoming policy:
- Default outgoing policy:
- Open ports confirmed:
- Unexpected open ports:
- Fresh SSH session after UFW change:

## PostgreSQL loopback evidence

- `sudo ss -ltnp | grep 5432` result:
- `sudo -u postgres psql -c "SHOW listen_addresses;"` result:
- Public bind found:
- Corrective action if public bind was found:

## unattended-upgrades evidence

- Package installed:
- Service/timer status:
- Security updates only confirmed:

## fail2ban observation

- `systemctl status fail2ban --no-pager` result:
- Note: formal `ra-assessment` jail validation belongs to INFRA-03.

## Rollback evidence

- `sshd_config` backup path:
- Emergency SSH rule or recovery path:
- Second SSH session kept open:
- Rollback tested or ready:

## Final review

- Evidence checked against `docs/SECURITY_PRIVACY.md` section 9.5:
- Secrets excluded from this record:
- Remaining blockers:
- Operator sign-off:
- Reviewer sign-off:
- Final status: pending
