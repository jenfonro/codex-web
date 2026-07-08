#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f "./backend/go.mod" || ! -f "./agent/go.mod" ]]; then
  echo "please run this script from the codex-web repository root" >&2
  exit 1
fi

if [[ ! -f "./backend/public/dist/index.html" ]]; then
  echo "[test-go] preparing embedded frontend dist for backend go:embed"
  (cd frontend && ./build.sh)
  rm -rf ./backend/public/dist
  mkdir -p ./backend/public/dist
  cp -a ./frontend/dist/. ./backend/public/dist/
fi

echo "[test-go] backend"
(cd backend && go test ./...)

echo "[test-go] agent"
(cd agent && go test ./...)
