#!/usr/bin/env bash
set -euo pipefail

IMAGE="${CODEX_WEB_IMAGE}"
CONTAINER="${CODEX_WEB_CONTAINER}"
PORT="${CODEX_WEB_PORT}"
HOST_BINARY="${CODEX_WEB_BINARY}"
HOST_CODEX_HOME="${CODEX_WEB_CODEX_HOME}"
HOST_WORKSPACE="${CODEX_WEB_WORKSPACE}"
CONTAINER_WORKSPACE="${CODEX_WEB_CONTAINER_WORKSPACE}"

mkdir -p "${HOST_CODEX_HOME}" "${HOST_WORKSPACE}"

exec docker run \
  --name "${CONTAINER}" \
  --restart unless-stopped \
  -p "${PORT}:58888" \
  -e CODEX_WEB_ADDR=0.0.0.0:58888 \
  -e CODEX_HOME=/codex-home \
  -e CODEX_WEB_ROOT="${CONTAINER_WORKSPACE}" \
  -e CODEX_WEB_CODEX_BIN=/usr/local/bin/codex \
  -v "${HOST_BINARY}:/app/codex-web:ro" \
  -v "${HOST_CODEX_HOME}:/codex-home" \
  -v "${HOST_WORKSPACE}:${CONTAINER_WORKSPACE}" \
  "${IMAGE}"
