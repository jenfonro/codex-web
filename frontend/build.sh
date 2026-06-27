#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${SCRIPT_DIR}"
DIST_DIR="${ROOT_DIR}/dist"

find_codex_webview() {
  if [[ -n "${CODEX_WEB_EXTENSION_WEBVIEW_DIR:-}" ]]; then
    if [[ -f "${CODEX_WEB_EXTENSION_WEBVIEW_DIR}/index.html" ]]; then
      printf '%s\n' "${CODEX_WEB_EXTENSION_WEBVIEW_DIR}"
      return 0
    fi
    echo "[frontend] CODEX_WEB_EXTENSION_WEBVIEW_DIR does not contain index.html: ${CODEX_WEB_EXTENSION_WEBVIEW_DIR}" >&2
    return 1
  fi

  local candidate
  for candidate in "${HOME}/.local/share/code-server/extensions"/openai.chatgpt-*/webview; do
    if [[ -f "${candidate}/index.html" ]]; then
      printf '%s\n' "${candidate}"
      return 0
    fi
  done

  echo "[frontend] could not find installed Codex extension webview" >&2
  echo "[frontend] set CODEX_WEB_EXTENSION_WEBVIEW_DIR=/path/to/openai.chatgpt-*/webview" >&2
  return 1
}

EXT_WEBVIEW_DIR="$(find_codex_webview)"

echo "[frontend] copying official Codex webview: ${EXT_WEBVIEW_DIR}"
rm -rf "${DIST_DIR}"
mkdir -p "${DIST_DIR}"
cp -a "${EXT_WEBVIEW_DIR}/." "${DIST_DIR}/"

for js_file in "${DIST_DIR}/assets"/*.js; do
  if grep -q 'enable_i18n`,!1' "${js_file}"; then
    perl -0pi -e 's/enable_i18n`,!1/enable_i18n`,!0/g' "${js_file}"
  fi
done

patched_ide_context=0
for js_file in "${DIST_DIR}/assets"/*.js; do
  if grep -q 'Aa=!Pi&&ka===`connected`&&vi,ja=Pi?`no-connection`:ka' "${js_file}"; then
    perl -0pi -e 's/Aa=!Pi&&ka===`connected`&&vi,ja=Pi\?`no-connection`:ka/Aa=!1,ja=`no-connection`/g' "${js_file}"
    patched_ide_context=1
  fi
done

if [[ "${patched_ide_context}" != "1" ]]; then
  echo "[frontend] could not apply standalone IDE context patch; official webview shape changed" >&2
  exit 1
fi

if [[ ! -f "${ROOT_DIR}/codex-web-shim.js" ]]; then
  echo "[frontend] missing codex-web-shim.js" >&2
  exit 1
fi
cp -a "${ROOT_DIR}/codex-web-shim.js" "${DIST_DIR}/codex-web-shim.js"
cp -a "${ROOT_DIR}/login.html" "${DIST_DIR}/login.html"

INDEX_IN="${DIST_DIR}/index.html"
INDEX_OUT="${DIST_DIR}/index.html.tmp"
awk '
  BEGIN { inserted = 0 }
  inserted == 0 && $0 ~ /<script type="module"/ {
    print "    <script src=\"./codex-web-shim.js\"></script>"
    inserted = 1
  }
  { print }
  END {
    if (inserted == 0) {
      exit 2
    }
  }
' "${INDEX_IN}" > "${INDEX_OUT}"
mv "${INDEX_OUT}" "${INDEX_IN}"

echo "[frontend] build output: ${DIST_DIR}"
