ARG BASE_IMAGE=proxy.zelt.cn/library/alpine:3.20
FROM ${BASE_IMAGE}

RUN apk add --no-cache \
    bash \
    ca-certificates \
    coreutils \
    curl \
    findutils \
    git \
    openssh-client \
    ripgrep \
    tar \
    tzdata

COPY codex-agent /usr/local/bin/codex-agent

ENV CODEX_AGENT_CODEX_BIN=/usr/local/bin/codex \
    CODEX_AGENT_ROOT=/workspace \
    CODEX_HOME=/data/codex-home \
    HOME=/root

WORKDIR /workspace
ENTRYPOINT ["/usr/local/bin/codex-agent"]
