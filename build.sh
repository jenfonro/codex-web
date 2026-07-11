#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f "./backend/go.mod" || ! -d "./frontend" ]]; then
  echo "please run this script from the codex-web repository root" >&2
  exit 1
fi

BACKEND_DIR="./backend"
FRONTEND_EMBED_DIST="./backend/public/dist"
BUILD_DIR="./build"
ROOT_ABS="$(pwd -P)"

if [[ ! -f "${FRONTEND_EMBED_DIST}/index.html" ]]; then
  echo "missing embedded frontend dist: ${FRONTEND_EMBED_DIST}/index.html" >&2
  echo "run: ./build-all.sh" >&2
  exit 1
fi

GOCACHE_DIR="${ROOT_ABS}/build/tmp/go-cache"
mkdir -p "${GOCACHE_DIR}" "${BUILD_DIR}"
export GOCACHE="${GOCACHE_DIR}"
GOEXE="$(go env GOEXE)"

(
  cd "${BACKEND_DIR}"
  go build -buildvcs=false -o "../build/codex-web${GOEXE}" ./cmd/codex-web
)

echo "built: ${BUILD_DIR}/codex-web${GOEXE}"
