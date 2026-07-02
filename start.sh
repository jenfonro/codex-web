#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f "./backend/go.mod" || ! -d "./frontend" ]]; then
  echo "please run this script from the codex-web repository root" >&2
  exit 1
fi

mkdir -p "./build/data" "./build/tmp"

cd "./build"

if [[ ! -x "./codex-web" ]]; then
  echo "missing ./build/codex-web; run ./build-all.sh first" >&2
  exit 1
fi

exec ./codex-web
