#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

IMAGE="${CODEX_WEB_IMAGE:-codex-web:local}"
CONTAINER="${CODEX_WEB_CONTAINER:-codex-web}"
PORT="${CODEX_WEB_PORT:-58888}"
HOST_DATA="${CODEX_WEB_DOCKER_DATA:-${ROOT_DIR}/build/docker/data}"
HOST_CODEX_HOME="${CODEX_WEB_DOCKER_CODEX_HOME:-${ROOT_DIR}/build/docker/codex-home}"
HOST_WORKSPACE="${CODEX_WEB_DOCKER_WORKSPACE:-${ROOT_DIR}}"

mkdir -p "${HOST_DATA}" "${HOST_CODEX_HOME}" "${HOST_WORKSPACE}"

docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true

exec docker run \
  --name "${CONTAINER}" \
  --restart unless-stopped \
  -p "${PORT}:58888" \
  -e CODEX_WEB_ADDR=0.0.0.0:58888 \
  -e CODEX_WEB_DATA=/data \
  -e CODEX_HOME=/codex-home \
  -e CODEX_WEB_ROOT=/workspace \
  -e CODEX_WEB_CODEX_BIN=/usr/local/bin/codex \
  -v "${HOST_DATA}:/data" \
  -v "${HOST_CODEX_HOME}:/codex-home" \
  -v "${HOST_WORKSPACE}:/workspace" \
  "${IMAGE}"
