#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f "./backend/go.mod" || ! -d "./frontend" ]]; then
  echo "please run this script from the codex-web repository root" >&2
  exit 1
fi

FRONTEND_DIR="${FRONTEND_DIR:-./frontend}"
DST_DIST="./backend/public/dist"

if [[ ! -d "${FRONTEND_DIR}" ]]; then
  echo "missing frontend dir: ${FRONTEND_DIR}" >&2
  exit 1
fi

if [[ -x "${FRONTEND_DIR}/build.sh" ]]; then
  echo "[build-all] running frontend build script: ${FRONTEND_DIR}/build.sh"
  (cd "${FRONTEND_DIR}" && ./build.sh)
else
  echo "missing frontend build script: ${FRONTEND_DIR}/build.sh" >&2
  exit 1
fi

SRC_DIST="${FRONTEND_DIR}/dist"
if [[ ! -f "${SRC_DIST}/index.html" ]]; then
  echo "missing frontend index.html: ${SRC_DIST}/index.html" >&2
  exit 1
fi

echo "[build-all] syncing frontend files from ${SRC_DIST} -> ${DST_DIST}"
rm -rf "${DST_DIST}"
mkdir -p "${DST_DIST}"
cp -a "${SRC_DIST}/." "${DST_DIST}/"

exec ./build.sh
