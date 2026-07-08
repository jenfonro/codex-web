#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f "./backend/go.mod" || ! -d "./frontend" ]]; then
  echo "please run this script from the codex-web repository root" >&2
  exit 1
fi

BACKEND_DIR="./backend"
AGENT_DIR="./agent"
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

if [[ "${CODEX_WEB_GO_LOCAL_CACHE:-}" == "1" ]]; then
  GOMODCACHE_DIR="${ROOT_ABS}/build/tmp/go-mod-cache"
  GOPATH_DIR="${ROOT_ABS}/build/tmp/go-path"
  mkdir -p "${GOMODCACHE_DIR}" "${GOPATH_DIR}"
  export GOMODCACHE="${GOMODCACHE_DIR}"
  export GOPATH="${GOPATH_DIR}"
fi

(
  cd "${BACKEND_DIR}"
  go build -buildvcs=false -o "../build/codex-web${GOEXE}" ./cmd/codex-web
)

(
  cd "${AGENT_DIR}"
  go build -buildvcs=false -o "../build/codex-agent${GOEXE}" .
)

mkdir -p "${BUILD_DIR}/docker-agent"
(
  cd "${AGENT_DIR}"
  CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -buildvcs=false -o "../build/docker-agent/codex-agent" .
)

echo "built: ${BUILD_DIR}/codex-web${GOEXE}"
echo "built: ${BUILD_DIR}/codex-agent${GOEXE}"
echo "built: ${BUILD_DIR}/docker-agent/codex-agent"
