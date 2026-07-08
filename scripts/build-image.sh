#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

IMAGE="${CODEX_WEB_IMAGE:-codex-web:local}"
CODEX_NPM_VERSION="${CODEX_NPM_VERSION:-latest}"
DOCKER_REGISTRY="${CODEX_WEB_DOCKER_REGISTRY:-}"

docker build \
  --build-arg "DOCKER_REGISTRY=${DOCKER_REGISTRY}" \
  --build-arg "CODEX_NPM_VERSION=${CODEX_NPM_VERSION}" \
  -t "${IMAGE}" \
  "${ROOT_DIR}"

echo "built image: ${IMAGE}"
