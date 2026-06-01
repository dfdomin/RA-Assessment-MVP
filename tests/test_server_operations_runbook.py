from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RUNBOOK = ROOT / "docs" / "SERVER_OPERATIONS_RUNBOOK.md"
SECURITY_PRIVACY = ROOT / "docs" / "SECURITY_PRIVACY.md"
INFRA01_EVIDENCE = ROOT / "docs" / "ops" / "INFRA_01_EVIDENCE_TEMPLATE.md"
INFRA02_CADDYFILE = ROOT / "docs" / "ops" / "Caddyfile.ra-assessment"
INFRA02_EVIDENCE = ROOT / "docs" / "ops" / "INFRA_02_EVIDENCE_TEMPLATE.md"
INFRA03_FAIL2BAN_FILTER = ROOT / "docs" / "ops" / "fail2ban-ra-assessment-filter.conf"
INFRA03_FAIL2BAN_JAIL = ROOT / "docs" / "ops" / "fail2ban-ra-assessment-jail.conf"
INFRA03_EVIDENCE = ROOT / "docs" / "ops" / "INFRA_03_EVIDENCE_TEMPLATE.md"
INFRA04_EVIDENCE = ROOT / "docs" / "ops" / "INFRA_04_EVIDENCE_TEMPLATE.md"


def test_server_runbook_documents_infra01_hardening_steps():
    text = RUNBOOK.read_text(encoding="utf-8")

    required_fragments = [
        "INFRA-01",
        "PasswordAuthentication no",
        "ufw default deny incoming",
        "ufw allow 22/tcp",
        "ufw allow 80/tcp",
        "ufw allow 443/tcp",
        "ss -ltnp",
        "127.0.0.1:5432",
        "unattended-upgrades",
        "sudo systemctl reload ssh",
        "rollback",
    ]

    for fragment in required_fragments:
        assert fragment in text


def test_server_runbook_requires_evidence_before_marking_infra_complete():
    text = RUNBOOK.read_text(encoding="utf-8")

    required_fragments = [
        "No marcar INFRA-01 como completa",
        "evidencia",
        "ufw status verbose",
        "systemctl status fail2ban",
        "No pegar secretos",
    ]

    for fragment in required_fragments:
        assert fragment in text


def test_infra01_has_copyable_evidence_template_for_server_execution():
    runbook_text = RUNBOOK.read_text(encoding="utf-8")
    security_text = SECURITY_PRIVACY.read_text(encoding="utf-8")
    template_text = INFRA01_EVIDENCE.read_text(encoding="utf-8")

    assert "docs/ops/INFRA_01_EVIDENCE_TEMPLATE.md" in runbook_text
    assert "docs/ops/INFRA_01_EVIDENCE_TEMPLATE.md" in security_text

    required_fragments = [
        "INFRA-01 Evidence Template",
        "Do not paste secrets",
        "Server identity",
        "SSH hardening evidence",
        "UFW evidence",
        "PostgreSQL loopback evidence",
        "unattended-upgrades evidence",
        "Rollback evidence",
        "Operator sign-off",
        "Final status: pending",
    ]

    for fragment in required_fragments:
        assert fragment in template_text


def test_infra02_caddy_artifacts_proxy_api_and_health_from_same_origin():
    runbook_text = RUNBOOK.read_text(encoding="utf-8")
    security_text = SECURITY_PRIVACY.read_text(encoding="utf-8")
    caddy_text = INFRA02_CADDYFILE.read_text(encoding="utf-8")
    evidence_text = INFRA02_EVIDENCE.read_text(encoding="utf-8")

    assert "docs/ops/Caddyfile.ra-assessment" in runbook_text
    assert "docs/ops/INFRA_02_EVIDENCE_TEMPLATE.md" in runbook_text
    assert "docs/ops/Caddyfile.ra-assessment" in security_text

    caddy_fragments = [
        "ra-assessment.iub.edu.co",
        "handle /health",
        "handle /api/*",
        "reverse_proxy 127.0.0.1:8000",
        "root * /var/www/ra-assessment/frontend",
        "try_files {path} /index.html",
        "file_server",
    ]

    for fragment in caddy_fragments:
        assert fragment in caddy_text

    evidence_fragments = [
        "INFRA-02 Evidence Template",
        "Do not paste secrets",
        "Caddyfile validation evidence",
        "TLS evidence",
        "Health endpoint evidence",
        "Static frontend evidence",
        "Rollback evidence",
        "Final status: pending",
    ]

    for fragment in evidence_fragments:
        assert fragment in evidence_text


def test_infra03_fail2ban_artifacts_define_login_failure_jail_and_evidence():
    runbook_text = RUNBOOK.read_text(encoding="utf-8")
    security_text = SECURITY_PRIVACY.read_text(encoding="utf-8")
    filter_text = INFRA03_FAIL2BAN_FILTER.read_text(encoding="utf-8")
    jail_text = INFRA03_FAIL2BAN_JAIL.read_text(encoding="utf-8")
    evidence_text = INFRA03_EVIDENCE.read_text(encoding="utf-8")

    assert "docs/ops/fail2ban-ra-assessment-filter.conf" in runbook_text
    assert "docs/ops/fail2ban-ra-assessment-jail.conf" in runbook_text
    assert "docs/ops/INFRA_03_EVIDENCE_TEMPLATE.md" in runbook_text
    assert "docs/ops/fail2ban-ra-assessment-filter.conf" in security_text
    assert "docs/ops/fail2ban-ra-assessment-jail.conf" in security_text

    filter_fragments = [
        "[Definition]",
        "login_failed",
        "<HOST>",
        "/var/log/ra-assessment/security.jsonl",
    ]

    for fragment in filter_fragments:
        assert fragment in filter_text

    jail_fragments = [
        "[ra-assessment]",
        "enabled = true",
        "filter = ra-assessment",
        "logpath = /var/log/ra-assessment/security.jsonl",
        "maxretry = 5",
        "findtime = 60",
        "bantime = 3600",
        "action = ufw",
    ]

    for fragment in jail_fragments:
        assert fragment in jail_text

    evidence_fragments = [
        "INFRA-03 Evidence Template",
        "Do not paste secrets",
        "Filter validation evidence",
        "Jail status evidence",
        "Ban test evidence",
        "fail2ban-client status ra-assessment",
        "5 failed logins",
        "Rollback evidence",
        "Final status: pending",
    ]

    for fragment in evidence_fragments:
        assert fragment in evidence_text


def test_infra04_backup_artifacts_require_encrypted_backup_and_restore_evidence():
    runbook_text = RUNBOOK.read_text(encoding="utf-8")
    security_text = SECURITY_PRIVACY.read_text(encoding="utf-8")
    evidence_text = INFRA04_EVIDENCE.read_text(encoding="utf-8")

    assert "INFRA-04" in runbook_text
    assert "scripts/backup-ra.sh" in runbook_text
    assert "docs/ops/INFRA_04_EVIDENCE_TEMPLATE.md" in runbook_text
    assert "docs/ops/INFRA_04_EVIDENCE_TEMPLATE.md" in security_text

    runbook_fragments = [
        "BACKUP_GPG_RECIPIENT",
        "BACKUP_RCLONE_REMOTE",
        "gpg --list-keys",
        "rclone lsd",
        "crontab -l",
        "0 2 * * *",
        "gpg --decrypt",
        "gunzip",
        "psql",
        "restore drill",
    ]

    for fragment in runbook_fragments:
        assert fragment in runbook_text

    evidence_fragments = [
        "INFRA-04 Evidence Template",
        "Do not paste secrets",
        "GPG public key evidence",
        "rclone remote evidence",
        "Cron evidence",
        "Backup execution evidence",
        "Restore drill evidence",
        "Plaintext cleanup evidence",
        "Final status: pending",
    ]

    for fragment in evidence_fragments:
        assert fragment in evidence_text
