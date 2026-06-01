import os
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "backup-ra.sh"


def _write_executable(path: Path, body: str) -> None:
    path.write_text(body, encoding="utf-8")
    path.chmod(0o755)


def test_backup_script_requires_encrypted_backup_configuration(tmp_path):
    result = subprocess.run(
        ["bash", str(SCRIPT)],
        cwd=ROOT,
        env={"PATH": os.environ["PATH"]},
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode != 0
    assert "BACKUP_GPG_RECIPIENT is required" in result.stderr


def test_backup_script_dumps_encrypts_uploads_and_removes_plaintext(tmp_path):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    calls_dir = tmp_path / "calls"
    calls_dir.mkdir()

    _write_executable(
        bin_dir / "pg_dump",
        """#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "dump:$1" > "$CALLS_DIR/pg_dump"
printf '%s\\n' "CREATE TABLE secure_backup(id int);"
""",
    )
    _write_executable(
        bin_dir / "gpg",
        """#!/usr/bin/env bash
set -euo pipefail
out=""
recipient=""
input=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --output) out="$2"; shift 2 ;;
    --recipient) recipient="$2"; shift 2 ;;
    --encrypt|--batch|--yes|--trust-model|always) shift ;;
    *) input="$1"; shift ;;
  esac
done
printf '%s\\n' "$recipient" > "$CALLS_DIR/gpg_recipient"
printf '%s\\n' "$input" > "$CALLS_DIR/gpg_input"
cp "$input" "$out"
""",
    )
    _write_executable(
        bin_dir / "rclone",
        """#!/usr/bin/env bash
set -euo pipefail
[[ "$1" == "copy" ]]
[[ -f "$2" ]]
printf '%s\\n' "$2" > "$CALLS_DIR/rclone_file"
printf '%s\\n' "$3" > "$CALLS_DIR/rclone_remote"
""",
    )

    backup_dir = tmp_path / "backups"
    env = {
        **os.environ,
        "PATH": f"{bin_dir}:{os.environ['PATH']}",
        "CALLS_DIR": str(calls_dir),
        "DATABASE_URL": "postgresql+asyncpg://ra_user:ra_pass@localhost/ra_assessment",
        "BACKUP_GPG_RECIPIENT": "backup@ra-app",
        "BACKUP_RCLONE_REMOTE": "r2:ra-assessment-backups/",
        "BACKUP_DIR": str(backup_dir),
        "BACKUP_DATE": "20260520",
    }

    result = subprocess.run(
        ["bash", str(SCRIPT)],
        cwd=ROOT,
        env=env,
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert (calls_dir / "pg_dump").read_text(encoding="utf-8").strip() == (
        "dump:postgresql://ra_user:ra_pass@localhost/ra_assessment"
    )
    assert (calls_dir / "gpg_recipient").read_text(encoding="utf-8").strip() == "backup@ra-app"
    assert (calls_dir / "rclone_remote").read_text(encoding="utf-8").strip() == "r2:ra-assessment-backups/"
    assert not (backup_dir / "ra-20260520.sql.gz").exists()
    assert (backup_dir / "ra-20260520.sql.gz.gpg").exists()
