#!/usr/bin/env bash
# Sirve el frontend local contra el mismo Supabase de producción.
# Uso: ./scripts/serve_frontend.sh
# Abre: http://127.0.0.1:8766/frontend/dashboard.html
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8766}"
echo "Frontend local: http://127.0.0.1:${PORT}/frontend/dashboard.html"
echo "Ctrl+C para detener."
cd "$ROOT"
python3 -m http.server "$PORT" --bind 127.0.0.1
