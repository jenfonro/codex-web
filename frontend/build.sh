#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="${SCRIPT_DIR}/dist"

rm -rf "${DIST_DIR}"
mkdir -p "${DIST_DIR}"
cp -a "${SCRIPT_DIR}/src/." "${DIST_DIR}/"

echo "[frontend] build output: ${DIST_DIR}"
