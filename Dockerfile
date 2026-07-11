# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates git \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g "@openai/codex@0.144.1" \
  && npm cache clean --force

ENV CODEX_WEB_ADDR=0.0.0.0:58888 \
  CODEX_HOME=/codex-home \
  CODEX_WEB_ROOT=/workspace \
  CODEX_WEB_CODEX_BIN=/usr/local/bin/codex

RUN mkdir -p /app /codex-home /workspace

EXPOSE 58888

ENTRYPOINT ["/app/codex-web"]
