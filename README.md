# Codex Web

Standalone web shell for the official Codex VS Code/code-server webview.

codex-web does not build a custom chat UI and does not implement its own Codex
agent runtime. The frontend build copies the installed official Codex extension
`webview/` bundle, injects a small browser shim for `acquireVsCodeApi`, and lets
the official React UI render conversations, approvals, queued follow-ups,
reasoning, review panels, model controls, and permission controls.

The Go backend provides:

- password login
- static serving for the copied official webview
- a VS Code Host bridge for the official webview messages
- shared host/global state such as pinned threads
- a bridge to `codex app-server --listen stdio://`
- lightweight local Host services used by the official webview, such as git
  metadata and file reads

Recommended architecture:

```text
frontend/ official Codex extension webview copy + shim
  -> backend/ Go HTTP auth + VS Code Host bridge
    -> official codex app-server JSON-RPC
      -> official Codex CLI/runtime
        -> CODEX_HOME sessions and config
```

Use the same `CODEX_HOME` as VS Code/code-server Codex and the CLI to keep
conversation history shared. The default is `/root/.codex`.

## Codex CLI / App Server

Check the current official Codex CLI and App Server support:

```bash
./scripts/ensure-codex-cli.sh --check
```

Install the official CLI when it is missing:

```bash
./scripts/ensure-codex-cli.sh --install
```

Update it when the installed version is too old:

```bash
./scripts/ensure-codex-cli.sh --update
```

The script installs `@openai/codex` with npm by default. You can override the
package or version with:

```bash
CODEX_WEB_CODEX_NPM_PACKAGE=@openai/codex
CODEX_WEB_CODEX_NPM_VERSION=latest
```

## Run

```bash
./build-all.sh
./start.sh
```

Default URL:

```text
http://127.0.0.1:58888
```

If `CODEX_WEB_PASSWORD` is not set, the server creates a local password at:

```text
build/data/password.txt
```

## Environment

```bash
CODEX_WEB_ADDR=127.0.0.1:58888
CODEX_WEB_PASSWORD=change-me
CODEX_WEB_ROOT=/root
CODEX_HOME=/root/.codex
CODEX_WEB_CODEX_BIN=codex
CODEX_WEB_APP_SERVER=stdio
CODEX_WEB_MIN_CODEX_VERSION=0.138.0
CODEX_WEB_EXTENSION_WEBVIEW_DIR=/path/to/openai.chatgpt-*/webview
```

`CODEX_WEB_APP_SERVER=stdio` starts `codex app-server --listen stdio://`. To
connect to an already running App Server instead, use a Unix socket or WebSocket
endpoint:

```bash
CODEX_WEB_APP_SERVER=unix:///run/codex-app-server.sock
CODEX_WEB_APP_SERVER=ws://127.0.0.1:3456
```

`start.sh` and the systemd service run `scripts/ensure-codex-cli.sh --check`
before launching codex-web. They do not install or update Codex automatically
during service startup; run `--install` or `--update` explicitly when needed.

## Systemd

```bash
install -m 0644 systemd/codex-web.service /etc/systemd/system/codex-web.service
systemctl daemon-reload
systemctl start codex-web
```

Logs are written to:

```text
build/codex-web.log
```

## Verification

```bash
node scripts/verify-thread-states.cjs
```

The verifier logs in, opens the official webview, checks extension window mode,
Chinese text, dark VS Code theme classes, official assets, absence of the old
custom session-list DOM, and new unhandled bridge messages. It writes:

```text
build/codex-web-official-report.json
build/codex-web-official-webview.png
```

## Project Layout

```text
backend/   Go HTTP server, auth, Codex App Server client, VS Code Host bridge
frontend/  official Codex webview copy step and browser shim
scripts/   CLI installer/checker and browser verification
systemd/   codex-web.service
build/     built binary, local state, generated password, logs, temporary caches
```
