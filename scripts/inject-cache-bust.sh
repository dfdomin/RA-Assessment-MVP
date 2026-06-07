#!/usr/bin/env bash
# Injects git commit SHA into frontend HTML cache-bust query params (H-01).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SHA="${1:-$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo "dev")}"

echo "Injecting cache-bust version: ${SHA}"

while IFS= read -r -d '' file; do
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s/BUILD_SHA/${SHA}/g" "$file"
    sed -i '' "s/?v=[a-f0-9]\{7,40\}/?v=${SHA}/g" "$file"
  else
    sed -i "s/BUILD_SHA/${SHA}/g" "$file"
    sed -i "s/?v=[a-f0-9]\{7,40\}/?v=${SHA}/g" "$file"
  fi
done < <(find "$ROOT/frontend" -name '*.html' -print0)

if [[ -f "$ROOT/index.html" ]]; then
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s/BUILD_SHA/${SHA}/g" "$ROOT/index.html"
  else
    sed -i "s/BUILD_SHA/${SHA}/g" "$ROOT/index.html"
  fi
fi

echo "Cache-bust complete."
