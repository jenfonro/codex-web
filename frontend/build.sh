#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="${SCRIPT_DIR}/dist"
ASSET_VERSION="${CODEX_WEB_ASSET_VERSION:-$(date -u +%Y%m%d%H%M%S)}"

rm -rf "${DIST_DIR}"
mkdir -p "${DIST_DIR}"
cp -a "${SCRIPT_DIR}/src/." "${DIST_DIR}/"
sed -i.bak "s/__CODEX_WEB_ASSET_VERSION__/${ASSET_VERSION}/g" "${DIST_DIR}/index.html"
rm -f "${DIST_DIR}/index.html.bak"

style_bundle="${DIST_DIR}/app/codex-web.css"
style_sources=(
  "assets/workbench/workbench.css"
  "assets/workbench/theme.css"
  "assets/workbench/codicon.css"
  "assets/workbench/seti.css"
  "app/layout.css"
  "pages/workspace/workspace.css"
  "pages/nodes/nodes.css"
  "pages/git/git.css"
  "pages/runs/runs.css"
  "pages/codex/panel.css"
)

: > "${style_bundle}"
for source in "${style_sources[@]}"; do
  {
    printf '\n/* %s */\n' "${source}"
    case "${source}" in
      "assets/workbench/workbench.css")
        sed 's#url("../../../../media/code-icon.svg")#url("../assets/workbench/workspace-icon.svg")#g' "${SCRIPT_DIR}/src/${source}"
        ;;
      "assets/workbench/codicon.css")
        sed "s#url('./codicon.ttf')#url('../assets/workbench/codicon.ttf')#g" "${SCRIPT_DIR}/src/${source}"
        ;;
      "assets/workbench/seti.css")
        sed "s#url('./seti.woff')#url('../assets/workbench/seti.woff')#g" "${SCRIPT_DIR}/src/${source}"
        ;;
      *)
        cat "${SCRIPT_DIR}/src/${source}"
        ;;
    esac
    printf '\n'
  } >> "${style_bundle}"
done

script_bundle="${DIST_DIR}/app/codex-web.js"
script_sources=(
  "components/workspace/layout.js"
  "app/bootstrap.js"
  "components/icons/codex-icons.js"
  "pages/codex/config.js"
  "pages/codex/utils.js"
  "pages/codex/lifecycle.js"
  "pages/codex/grouping.js"
  "pages/codex/activity-summary.js"
  "pages/codex/virtualizer.js"
  "pages/codex/api.js"
  "pages/codex/renderer.js"
  "store/codex.js"
  "pages/workspace/index.js"
  "pages/nodes/index.js"
  "pages/git/index.js"
  "pages/runs/index.js"
  "pages/codex/index.js"
)

: > "${script_bundle}"
printf '"use strict";\nwindow.CODEX_WEB_ASSET_VERSION = "%s";\n' "${ASSET_VERSION}" >> "${script_bundle}"
for source in "${script_sources[@]}"; do
  {
    printf '\n;/* %s */\n' "${source}"
    cat "${SCRIPT_DIR}/src/${source}"
    printf '\n'
  } >> "${script_bundle}"
  rm -f "${DIST_DIR}/${source}"
done

fixture_bundle="${DIST_DIR}/app/codex-fixtures.js"
: > "${fixture_bundle}"
{
  printf '"use strict";\n'
  printf '\n;/* %s */\n' "pages/codex/fixtures.js"
  cat "${SCRIPT_DIR}/src/pages/codex/fixtures.js"
  printf '\n'
} >> "${fixture_bundle}"
rm -f "${DIST_DIR}/pages/codex/fixtures.js"

for source in "${style_sources[@]}"; do
  case "${source}" in
    "assets/workbench/codicon.css")
      ;;
    *)
      rm -f "${DIST_DIR}/${source}"
      ;;
  esac
done

find "${DIST_DIR}" -type d -empty -delete

echo "[frontend] build output: ${DIST_DIR}"
