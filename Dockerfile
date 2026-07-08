# syntax=docker/dockerfile:1

ARG DOCKER_REGISTRY=

FROM ${DOCKER_REGISTRY}golang:1.22-bookworm AS builder

WORKDIR /src
COPY . .
RUN ./build-all.sh

FROM ${DOCKER_REGISTRY}node:22-bookworm-slim

ARG CODEX_NPM_VERSION=latest

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates git \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g "@openai/codex@${CODEX_NPM_VERSION}" \
  && npm cache clean --force

ENV CODEX_WEB_ADDR=0.0.0.0:58888 \
  CODEX_WEB_DATA=/data \
  CODEX_HOME=/codex-home \
  CODEX_WEB_ROOT=/workspace \
  CODEX_WEB_CODEX_BIN=/usr/local/bin/codex

COPY --from=builder /src/build/codex-web /usr/local/bin/codex-web

RUN mkdir -p /data /codex-home /workspace

EXPOSE 58888

ENTRYPOINT ["/usr/local/bin/codex-web"]
