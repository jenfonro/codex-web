# syntax=docker/dockerfile:1

FROM golang:1.22-bookworm AS builder

WORKDIR /src
COPY . .
RUN ./build-all.sh

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

COPY --from=builder /src/build/codex-web /usr/local/bin/codex-web

RUN mkdir -p /codex-home /workspace

EXPOSE 58888

ENTRYPOINT ["/usr/local/bin/codex-web"]
