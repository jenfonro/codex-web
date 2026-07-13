#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ ! -d "${SCRIPT_DIR}/node_modules" || "${SCRIPT_DIR}/package-lock.json" -nt "${SCRIPT_DIR}/node_modules/.package-lock.json" ]]; then
  (cd "${SCRIPT_DIR}" && npm ci)
fi

(cd "${SCRIPT_DIR}" && npm run build)

echo "[frontend] build output: ${SCRIPT_DIR}/dist"
