#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f "./agent/go.mod" ]]; then
  echo "please run this script from the codex-web repository root" >&2
  exit 1
fi

./scripts/ensure-codex-cli.sh --check

if [[ ! -x "./build/codex-agent" ]]; then
  echo "missing ./build/codex-agent; run ./build-all.sh first" >&2
  exit 1
fi

exec ./build/codex-agent
