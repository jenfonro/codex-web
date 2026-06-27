#!/usr/bin/env bash
set -euo pipefail

MODE="check"
MIN_VERSION="${CODEX_WEB_MIN_CODEX_VERSION:-0.138.0}"
PACKAGE="${CODEX_WEB_CODEX_NPM_PACKAGE:-@openai/codex}"
PACKAGE_VERSION="${CODEX_WEB_CODEX_NPM_VERSION:-latest}"

usage() {
  cat <<'EOF'
Usage: scripts/ensure-codex-cli.sh [--check|--install|--update]

Checks, installs, or updates the official Codex CLI used by codex-web.
codex-web talks to Codex through `codex app-server`; it does not implement
the agent runtime itself.

Environment:
  CODEX_HOME                  Shared Codex state directory. Default: /root/.codex
  CODEX_WEB_CODEX_BIN          Explicit codex executable path. Default: PATH lookup
  CODEX_WEB_MIN_CODEX_VERSION  Minimum accepted CLI version. Default: 0.138.0
  CODEX_WEB_CODEX_NPM_PACKAGE  npm package to install. Default: @openai/codex
  CODEX_WEB_CODEX_NPM_VERSION  npm version/range. Default: latest
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check)
      MODE="check"
      ;;
    --install)
      MODE="install"
      ;;
    --update)
      MODE="update"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

codex_home() {
  if [[ -n "${CODEX_HOME:-}" ]]; then
    printf '%s\n' "${CODEX_HOME}"
  else
    printf '%s\n' "/root/.codex"
  fi
}

find_codex() {
  if [[ -n "${CODEX_WEB_CODEX_BIN:-}" ]]; then
    if [[ "${CODEX_WEB_CODEX_BIN}" == */* && -x "${CODEX_WEB_CODEX_BIN}" ]]; then
      printf '%s\n' "${CODEX_WEB_CODEX_BIN}"
      return 0
    fi
    if [[ "${CODEX_WEB_CODEX_BIN}" != */* ]]; then
      command -v "${CODEX_WEB_CODEX_BIN}" 2>/dev/null
      return $?
    fi
    return 1
  fi
  command -v codex 2>/dev/null
}

require_npm() {
  if ! command -v npm >/dev/null 2>&1; then
    echo "npm is required to install ${PACKAGE}; install Node.js/npm first" >&2
    exit 1
  fi
}

install_codex() {
  require_npm
  echo "[codex-web] installing official Codex CLI: ${PACKAGE}@${PACKAGE_VERSION}"
  npm install -g "${PACKAGE}@${PACKAGE_VERSION}"
}

update_codex() {
  local bin
  bin="$(find_codex || true)"
  if [[ -n "${bin}" ]] && "${bin}" update >/tmp/codex-web-update.log 2>&1; then
    cat /tmp/codex-web-update.log
    return 0
  fi
  if [[ -s /tmp/codex-web-update.log ]]; then
    cat /tmp/codex-web-update.log >&2
  fi
  install_codex
}

version_number() {
  sed -E 's/.* ([0-9]+(\.[0-9]+){1,3}).*/\1/'
}

version_ge() {
  local actual="$1"
  local minimum="$2"
  [[ "$(printf '%s\n%s\n' "${minimum}" "${actual}" | sort -V | head -n1)" == "${minimum}" ]]
}

check_codex() {
  local home bin version_output version
  home="$(codex_home)"
  mkdir -p "${home}"

  bin="$(find_codex || true)"
  if [[ -z "${bin}" ]]; then
    echo "Codex CLI is not installed or CODEX_WEB_CODEX_BIN is invalid." >&2
    echo "Run: ./scripts/ensure-codex-cli.sh --install" >&2
    exit 1
  fi

  version_output="$("${bin}" --version)"
  version="$(printf '%s\n' "${version_output}" | version_number)"
  if [[ -z "${version}" || "${version}" == "${version_output}" ]]; then
    echo "Unable to parse Codex CLI version from: ${version_output}" >&2
    exit 1
  fi
  if ! version_ge "${version}" "${MIN_VERSION}"; then
    echo "Codex CLI ${version} is older than required ${MIN_VERSION}." >&2
    echo "Run: ./scripts/ensure-codex-cli.sh --update" >&2
    exit 1
  fi

  if ! "${bin}" app-server --help >/dev/null 2>&1; then
    echo "Codex CLI exists but does not expose 'codex app-server'." >&2
    echo "Run: ./scripts/ensure-codex-cli.sh --update" >&2
    exit 1
  fi

  echo "[codex-web] Codex CLI OK: ${version_output} (${bin})"
  echo "[codex-web] CODEX_HOME=${home}"
}

case "${MODE}" in
  check)
    check_codex
    ;;
  install)
    install_codex
    check_codex
    ;;
  update)
    update_codex
    check_codex
    ;;
esac
