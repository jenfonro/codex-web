# Codex Web

Codex Web is a controller website for managing Codex sessions across multiple
servers. The controller owns the node registry, browser streaming, and static
workspace UI. Each server runs a `codex-agent` that owns the Codex CLI process
and keeps sessions alive even when the browser is closed.

The current frontend is a framework-free static workspace under `frontend/src`.
Its visual baseline is captured from the Windows Chrome reference data in
`reference/windows-captures`, while app-owned code and paths use Codex Web names.

## Architecture

```text
browser UI
  -> backend controller HTTP/SSE
    -> codex-agent WebSocket
      -> codex exec --json / codex exec resume --json
        -> CODEX_HOME sessions and config
```

The browser can disconnect at any time. The agent keeps the running CLI turn and
the in-memory event log. When the browser reconnects, it asks for events after
the last sequence number and continues streaming new events over SSE.

## Capabilities

- Static Codex Web workspace UI served by the controller.
- Persistent node registry in `build/data/nodes.json`.
- Agent token in `build/data/agent-token.txt`.
- Outbound agent WebSocket connection to the controller.
- CLI-backed sessions using `codex exec --json`.
- Session resume using the Codex thread id.
- SSE event stream with sequence numbers for reconnect/backlog.
- Workspace directory listing and git status helpers executed on the agent.

## Build

```bash
./build-all.sh
```

Outputs:

```text
build/codex-web
build/codex-agent
```

On Windows, the same targets are emitted with the platform `.exe` suffix.

## Run Controller

```bash
./start.sh
```

Default URL:

```text
http://127.0.0.1:58888
```

Controller environment:

```bash
CODEX_WEB_ADDR=127.0.0.1:58888
CODEX_WEB_DATA=/path/to/data
CODEX_WEB_AGENT_TOKEN=change-me
```

## Run Agent

Each agent needs an installed Codex CLI and a persistent `CODEX_HOME`.

```bash
./scripts/ensure-codex-cli.sh --check
```

Agent environment:

```bash
CODEX_AGENT_CONTROLLER=ws://controller.example.com:58888/api/agent/connect
CODEX_AGENT_ID=server-a
CODEX_AGENT_NAME="Server A"
CODEX_AGENT_TOKEN=change-me
CODEX_AGENT_ROOT=/root
CODEX_HOME=/root/.codex
CODEX_AGENT_CODEX_BIN=codex
```

Local example:

```bash
export CODEX_AGENT_CONTROLLER=ws://127.0.0.1:58888/api/agent/connect
export CODEX_AGENT_ID=server-a
export CODEX_AGENT_NAME="Server A"
export CODEX_AGENT_TOKEN="$(cat build/data/agent-token.txt)"
export CODEX_AGENT_ROOT=/root
export CODEX_HOME=/root/.codex
export CODEX_AGENT_CODEX_BIN=codex
./agent-start.sh
```

Docker helper:

```bash
./scripts/build-agent-image.sh
./scripts/start-agent-container.sh
```

The Docker helper mounts a persistent Codex home at `build/agent-data/codex-home`
and imports `auth.json` / `config.toml` from the host Codex home when missing.

## Public API

Controller:

```text
GET    /api/nodes
POST   /api/nodes/active
DELETE /api/nodes/{id}
GET    /api/agent/connect

GET    /api/sessions?nodeId=...
POST   /api/sessions
POST   /api/sessions/{id}/send
POST   /api/sessions/{id}/cancel
GET    /api/sessions/{id}/events?nodeId=...&lastSeq=...
GET    /api/sessions/events?nodeId=...&sessionId=...&lastSeq=...

POST   /api/workspace
POST   /api/git
```

Agent protocol operations:

```text
session.list
session.create
session.send
session.cancel
session.events
workspace.fetch
git.request
```

Agent events:

```text
agent.hello
agent.heartbeat
agent.response
agent.event -> session.event
```

## Verification

Go code is intentionally split into separate `backend` and `agent` modules. Use the root wrapper to test both. It prepares `backend/public/dist` automatically when a fresh clone has no embedded frontend output yet:

```bash
./test-go.sh
./build-all.sh
```

Run the completion-oriented audit after deploying when you need read-only proof
that the live controller, agent node, long-session event paging, and SSE entry
point still work:

```bash
node scripts/audit-codex-completion.cjs
```

Refresh the captured workspace reference when needed:

```bash
node --check scripts/capture-workspace-reference.cjs
node scripts/capture-workspace-reference.cjs
```

## Project Layout

```text
backend/   Controller HTTP server, node registry, session routing, SSE
agent/     Agent process, Codex CLI session manager, workspace and git services
frontend/  Static Codex Web workspace UI, panel runtime, local assets, and state
reference/ Captured workspace/Codex panel DOM, CSS, assets, HAR, and screenshots
scripts/   CLI checker, Docker helpers, and workspace reference capture
systemd/   codex-web.service
build/     Binaries, controller state, generated secrets, logs, temp caches
```
