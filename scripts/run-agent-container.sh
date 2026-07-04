#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

IMAGE="${CODEX_AGENT_IMAGE:-codex-web-agent:local}"
CONTAINER="${CODEX_AGENT_CONTAINER:-codex-web-agent}"
DETACH=0

case "${1:-}" in
  --detach|-d)
    DETACH=1
    shift
    ;;
  "" )
    ;;
  * )
    echo "usage: $0 [--detach]" >&2
    exit 2
    ;;
esac

CONTROLLER="${CODEX_AGENT_CONTROLLER:-ws://127.0.0.1:58888/api/agent/connect}"
AGENT_ID="${CODEX_AGENT_ID:-host-docker-agent}"
AGENT_NAME="${CODEX_AGENT_NAME:-Host Docker Agent}"
DATA_DIR="${CODEX_AGENT_DATA:-${ROOT_DIR}/build/agent-data}"
HOST_ROOT="${CODEX_AGENT_ROOT_HOST:-/root}"
CONTAINER_ROOT="${CODEX_AGENT_ROOT:-/workspace}"
CONTAINER_CODEX_HOME="${CODEX_HOME:-/data/codex-home}"
CONTAINER_CODEX_BIN="${CODEX_AGENT_CODEX_BIN:-/usr/local/bin/codex}"
TOKEN_FILE="${CODEX_AGENT_TOKEN_FILE:-${ROOT_DIR}/build/data/agent-token.txt}"
HOST_CODEX_HOME="${CODEX_AGENT_IMPORT_CODEX_HOME:-/root/.codex}"

if [[ -z "${CODEX_AGENT_CODEX_BIN_HOST:-}" ]]; then
  if command -v codex >/dev/null 2>&1; then
    CODEX_AGENT_CODEX_BIN_HOST="$(readlink -f "$(command -v codex)")"
  else
    CODEX_AGENT_CODEX_BIN_HOST="/usr/local/bin/codex"
  fi
fi

if [[ -z "${CODEX_AGENT_TOKEN:-}" ]]; then
  for _ in $(seq 1 60); do
    if [[ -s "${TOKEN_FILE}" ]]; then
      CODEX_AGENT_TOKEN="$(tr -d '\r\n' < "${TOKEN_FILE}")"
      break
    fi
    sleep 1
  done
fi

if [[ -z "${CODEX_AGENT_TOKEN:-}" ]]; then
  echo "missing CODEX_AGENT_TOKEN and token file is not ready: ${TOKEN_FILE}" >&2
  exit 1
fi

if [[ ! -x "${CODEX_AGENT_CODEX_BIN_HOST}" ]]; then
  echo "missing executable Codex binary: ${CODEX_AGENT_CODEX_BIN_HOST}" >&2
  exit 1
fi

if [[ ! -d "${HOST_ROOT}" ]]; then
  echo "missing host root directory: ${HOST_ROOT}" >&2
  exit 1
fi

mkdir -p "${DATA_DIR}/codex-home" "${DATA_DIR}/tmp"
chmod 700 "${DATA_DIR}/codex-home"

for name in auth.json config.toml; do
  if [[ ! -e "${DATA_DIR}/codex-home/${name}" && -f "${HOST_CODEX_HOME}/${name}" ]]; then
    install -m 600 "${HOST_CODEX_HOME}/${name}" "${DATA_DIR}/codex-home/${name}"
  fi
done

if [[ -d "${HOST_CODEX_HOME}/sessions" ]]; then
  mkdir -p "${DATA_DIR}/codex-home/sessions"
  tar -C "${HOST_CODEX_HOME}" -cf - sessions | tar -C "${DATA_DIR}/codex-home" --skip-old-files -xf -
fi

docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true

RUN_ARGS=(
  --name "${CONTAINER}"
  --network host
  --init
  -e "CODEX_AGENT_CONTROLLER=${CONTROLLER}"
  -e "CODEX_AGENT_ID=${AGENT_ID}"
  -e "CODEX_AGENT_NAME=${AGENT_NAME}"
  -e "CODEX_AGENT_TOKEN=${CODEX_AGENT_TOKEN}"
  -e "CODEX_HOME=${CONTAINER_CODEX_HOME}"
  -e "CODEX_AGENT_ROOT=${CONTAINER_ROOT}"
  -e "CODEX_AGENT_CODEX_BIN=${CONTAINER_CODEX_BIN}"
  -v "${DATA_DIR}/codex-home:${CONTAINER_CODEX_HOME}"
  -v "${DATA_DIR}/tmp:/tmp"
  -v "${HOST_ROOT}:${CONTAINER_ROOT}"
  -v "${CODEX_AGENT_CODEX_BIN_HOST}:${CONTAINER_CODEX_BIN}:ro"
)

if [[ "${DETACH}" == "1" ]]; then
  docker run -d --restart unless-stopped "${RUN_ARGS[@]}" "${IMAGE}"
  exit 0
fi

exec docker run --rm \
  "${RUN_ARGS[@]}" \
  "${IMAGE}"
