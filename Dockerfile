# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates git \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g "@openai/codex@0.144.1" \
  && npm cache clean --force

RUN mkdir -p /app /codex-home

EXPOSE 58888

ENTRYPOINT ["/app/codex-web"]
