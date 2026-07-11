#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

IMAGE="${CODEX_WEB_IMAGE}"

docker build \
  -t "${IMAGE}" \
  "${ROOT_DIR}"

echo "built image: ${IMAGE}"
