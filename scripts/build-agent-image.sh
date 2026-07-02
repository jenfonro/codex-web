#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

IMAGE="${CODEX_AGENT_IMAGE:-codex-web-agent:local}"
BASE_IMAGE="${CODEX_AGENT_BASE_IMAGE:-proxy.zelt.cn/library/alpine:3.20}"
BUILD_CONTEXT="${ROOT_DIR}/build/docker-agent"

if [[ ! -f "${ROOT_DIR}/agent/go.mod" ]]; then
  echo "missing agent module: ${ROOT_DIR}/agent/go.mod" >&2
  exit 1
fi

mkdir -p "${BUILD_CONTEXT}"

(
  cd "${ROOT_DIR}/agent"
  CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o "${BUILD_CONTEXT}/codex-agent" .
)

docker build \
  --pull \
  --build-arg "BASE_IMAGE=${BASE_IMAGE}" \
  -f "${ROOT_DIR}/agent/Dockerfile" \
  -t "${IMAGE}" \
  "${BUILD_CONTEXT}"

echo "built docker image: ${IMAGE}"
