#!/usr/bin/env bash
# deploy.sh — RA Assessment production deploy pipeline
#
# Security gate order (fail-fast with set -e):
#   1. CVE audit          — reject known-vulnerable deps before touching the env
#   2. SAST scan          — reject medium/high severity code findings
#   3. Hash-verified install — supply-chain verification (pip --require-hashes)
#   4. Test suite         — regression gate
#   5. DB migrations      — alembic upgrade head
#   6. Service restart    — systemctl
#
# Prerequisites:
#   - requirements.txt generated with: pip-compile --generate-hashes requirements.in
#   - DATABASE_URL and SECRET_KEY set in environment
#   - VENV_DIR points to active venv (default: .venv)
set -euo pipefail

VENV_DIR="${VENV_DIR:-.venv}"
PIP="${VENV_DIR}/bin/pip"
PYTHON="${VENV_DIR}/bin/python"

echo "==> [1/6] CVE audit (pip-audit)"
"${VENV_DIR}/bin/pip-audit" --requirement requirements.txt --strict

echo "==> [2/6] SAST scan (bandit)"
# -ll = medium-and-above severity  -ii = medium-and-above confidence
# No --exit-zero: any finding at this level aborts the deploy.
"${VENV_DIR}/bin/bandit" -r src/ -ll -ii

echo "==> [3/6] Hash-verified install (pip --require-hashes)"
# requirements.txt must contain --hash entries (pip-compile --generate-hashes).
# pip will refuse to install if any hash mismatches or is absent.
"${PIP}" install --require-hashes -r requirements.txt --quiet

echo "==> [4/6] Test suite"
"${VENV_DIR}/bin/pytest" --tb=short -q

echo "==> [5/6] Database migrations (alembic upgrade head)"
"${VENV_DIR}/bin/alembic" upgrade head

echo "==> [6/6] Restarting service"
if command -v systemctl &>/dev/null; then
    systemctl restart ra-assessment.service
    echo "Service restarted via systemctl."
else
    echo "systemctl not available — restart the application manually."
fi

echo "Deploy complete."
