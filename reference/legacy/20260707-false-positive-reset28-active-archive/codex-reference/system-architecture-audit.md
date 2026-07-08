# Codex System Architecture Audit

Generated: 2026-07-06T17:06:22.424Z

Static architecture audit for Codex Web controller + root agent separation. This is a source-boundary gate, not a replacement for Go tests or browser visual audits.

## Summary

- Checks: 44
- Passed: 44
- Failed: 0

## Checks

| Status | Check | Details |
| --- | --- | --- |
| PASS | controller entry lives under backend/cmd/codex-web | backend/cmd/codex-web/main.go |
| PASS | agent is a root-level Go module, not nested under backend | agent/go.mod and agent/main.go exist; backend/cmd/codex-agent must not exist |
| PASS | backend internal packages stay controller-only | actual=config,model,node,server; missing=none; unexpected=none |
| PASS | agent internal packages own transport, host, and session responsibilities | actual=agent,config,host,model,session; missing=none; unexpected=none |
| PASS | removed backend local Codex/appserver/bridge/host packages | backend/internal must not contain local execution packages |
| PASS | backend does not execute Codex or import agent internals | no forbidden execution references found |
| PASS | agent session manager runs Codex CLI turns | agent/internal/session/manager.go contains the CLI execution path for new and resumed sessions |
| PASS | agent turns are independent of browser request lifetime | session turns detach from the controller HTTP request context before running the CLI, with a fake Codex regression test |
| PASS | agent owns git execution, backend only forwards git requests | git command execution is under agent/internal/host; backend exposes POST /api/git as a remote op |
| PASS | controller exposes required API routes | backend/internal/server/app.go routes nodes, sessions, workspace, git, and agent websocket endpoints |
| PASS | controller session API forwards to agent operations | session/workspace/git HTTP handlers use node.Client.Request operations |
| PASS | session SSE supports both backlog and live updates | GET /api/sessions/events replays backlog for one session and streams agent session.event messages |
| PASS | session SSE disables reverse-proxy buffering | SSE responses set X-Accel-Buffering: no so nginx can flush stream headers/backlog promptly |
| PASS | remote disconnect closes live SSE subscribers | Remote.Close resolves pending requests and closes subscribed event streams so browsers can reconnect instead of hanging on a stale node stream |
| PASS | remote request write failure tears down the stale node connection | controller write failures close the remote, mark the node offline, and close event streams instead of leaving a stale online client |
| PASS | session list page can subscribe to all session events | omitting sessionId keeps the SSE stream open for every session on the selected node |
| PASS | frontend exposes explicit node switching for multi-agent control | the Codex panel stores normalized nodes, shows a multi-node selector only when needed, switches active node through the controller, and rebuilds session/SSE state |
| PASS | frontend has a controller-owned node management view | the workspace can switch from the Codex view to a controller-owned Nodes view, list nodes, select the active node, delete offline nodes, and keep Codex panel node state synchronized |
| PASS | frontend has controller-owned workspace and git views | the workspace Activity Bar can switch to file browsing and source-control views that call the controller workspace/git APIs for the active agent node |
| PASS | frontend has a controller-owned runs view | the workspace Activity Bar can switch to a controller-owned Runs view that aggregates online-node sessions, subscribes to live session events, opens a run in the Codex panel, and cancels active turns through the controller |
| PASS | node routing never silently falls back to local execution | missing, offline, and unknown nodes are explicit errors |
| PASS | node id priority includes body, header, and query | requestNodeID checks explicit body nodeId, X-Codex-Web-Node-ID, then query nodeId |
| PASS | agent websocket protocol has typed envelopes and request correlation | backend and agent model envelopes carry type, requestId, nodeId, result, error, and event |
| PASS | agent hello, heartbeat, request, response, and event flow is implemented | agent connects outbound, registers with hello, heartbeats, handles controller.request, forwards session events, and disconnects unblock pending controller requests |
| PASS | agent responses are bound to the websocket connection that received the request | request responses and forwarded events use the connection for the current serve loop instead of a mutable global agent connection, and event write failures break the serve loop for reconnect |
| PASS | controller persists node records and generated agent token | nodes.json and agent-token.txt are data-dir owned; registry keeps offline records and blocks online deletion |
| PASS | stale agent disconnect cannot mark a reconnected node offline | registry only removes the matching client on MarkOffline and has a regression test for same-node reconnect races |
| PASS | agent config requires controller, identity, token, root, Codex home, and Codex binary | agent/internal/config/config.go defines the runtime boundary through environment variables |
| PASS | build scripts produce both controller and agent binaries | build-all builds frontend and delegates to build.sh; build.sh emits codex-web and codex-agent |
| PASS | root Go test wrapper covers both separated modules | test-go.sh is the root verification entry for the separate backend and agent Go modules, and it prepares embedded frontend dist for fresh clones |
| PASS | Docker agent image stays lightweight and proxy-aware | agent/Dockerfile uses the proxy Alpine base and starts codex-agent directly |
| PASS | Docker agent helper persists data and imports existing Codex auth/session state | run-agent-container mounts persistent codex-home/tmp/root, copies auth/config, imports sessions, and keeps detached containers running |
| PASS | systemd keeps only the controller on the host | systemd services=codex-web.service |
| PASS | frontend assets are bundled and cache-busted | frontend build emits app/codex-web.css and app/codex-web.js with timestamped URLs, plus a separate fixture bundle for explicit audits |
| PASS | fixture assets are not publicly served unless audit mode is enabled | app/codex-fixtures.js remains buildable for local audits but the controller hides it by default in production static serving, including normalized path variants |
| PASS | static asset misses return 404 while client routes fall back to index | missing JS/CSS/assets are explicit 404s; extensionless client routes still receive index.html without a FileServer redirect |
| PASS | static directories are never listed | static directories return 404/no-store explicitly while the root path still serves index.html |
| PASS | app-owned frontend code does not load remote code-server/webview/auth runtime | no remote code-server/webview/auth runtime references in app-owned frontend code |
| PASS | current web UI has no browser login/auth surface | agent token auth is retained for agent websocket only; browser UI has no login/password route |
| PASS | production frontend does not fall back to fixture or local fake sessions | fixtures remain available only through explicit codexFixture modes; production API failures surface errors instead of sample/local conversations; fixture session creation is delegated to the fixture bundle |
| PASS | production frontend bundle excludes fixture sample data | main app bundle contains only the explicit fixture loader; fixture definitions, sample data, and fixture session creation live in app/codex-fixtures.js |
| PASS | unified panel audit runner covers virtual scrolling | long-session virtual scroll coverage is part of the standard panel audit runner, not a manual-only script |
| PASS | unified panel audit runner executes the Runs view smoke | the controller-owned Runs sidebar is browser-tested for node/session loading, all-session SSE subscription, cancel routing, and opening a run |
| PASS | unified panel audit runner executes controller side-view smoke | Nodes, Workspace, and Git side views are browser-tested for active-node selection, offline-node deletion, workspace routing, and git routing |

## Evidence

### PASS: controller entry lives under backend/cmd/codex-web

- `backend/cmd/codex-web/main.go`

### PASS: agent is a root-level Go module, not nested under backend

- `agent/go.mod`
- `agent/main.go`

### PASS: backend internal packages stay controller-only

- `backend/internal/config`
- `backend/internal/model`
- `backend/internal/node`
- `backend/internal/server`

### PASS: agent internal packages own transport, host, and session responsibilities

- `agent/internal/agent`
- `agent/internal/config`
- `agent/internal/host`
- `agent/internal/model`
- `agent/internal/session`

### PASS: removed backend local Codex/appserver/bridge/host packages

- `backend/internal`

### PASS: backend does not execute Codex or import agent internals

- `backend/cmd/codex-web/main.go`
- `backend/internal/config/config.go`
- `backend/internal/model/node.go`
- `backend/internal/node/registry_test.go`
- `backend/internal/node/registry.go`
- `backend/internal/node/remote_test.go`
- `backend/internal/node/remote.go`
- `backend/internal/node/types.go`
- `backend/internal/server/agent_test.go`
- `backend/internal/server/agent.go`
- `backend/internal/server/app_test.go`
- `backend/internal/server/app.go`
- ... 5 more

### PASS: agent session manager runs Codex CLI turns

- `agent/internal/session/manager.go`

### PASS: agent turns are independent of browser request lifetime

- `agent/internal/session/manager.go`
- `agent/internal/session/history_test.go`

### PASS: agent owns git execution, backend only forwards git requests

- `agent/internal/host/git.go`
- `backend/internal/server/sessions.go`

### PASS: controller exposes required API routes

- `backend/internal/server/app.go`

### PASS: controller session API forwards to agent operations

- `backend/internal/server/sessions.go`

### PASS: session SSE supports both backlog and live updates

- `backend/internal/server/sessions.go`
- `backend/internal/node/remote.go`

### PASS: session SSE disables reverse-proxy buffering

- `backend/internal/server/sessions.go`
- `backend/internal/server/sessions_test.go`

### PASS: remote disconnect closes live SSE subscribers

- `backend/internal/node/remote.go`
- `backend/internal/node/remote_test.go`

### PASS: remote request write failure tears down the stale node connection

- `backend/internal/node/remote.go`
- `backend/internal/node/remote_test.go`

### PASS: session list page can subscribe to all session events

- `backend/internal/server/sessions.go`

### PASS: frontend exposes explicit node switching for multi-agent control

- `frontend/src/pages/codex/api.js`
- `frontend/src/store/codex.js`
- `frontend/src/pages/codex/index.js`
- `frontend/src/pages/codex/renderer.js`
- `frontend/src/pages/codex/panel-shadow.css`

### PASS: frontend has a controller-owned node management view

- `frontend/src/components/workspace/layout.js`
- `frontend/src/app/bootstrap.js`
- `frontend/src/pages/nodes/index.js`
- `frontend/src/pages/nodes/nodes.css`
- `frontend/src/pages/codex/index.js`
- `frontend/build.sh`

### PASS: frontend has controller-owned workspace and git views

- `frontend/src/components/workspace/layout.js`
- `frontend/src/app/bootstrap.js`
- `frontend/src/pages/workspace/index.js`
- `frontend/src/pages/workspace/workspace.css`
- `frontend/src/pages/git/index.js`
- `frontend/src/pages/git/git.css`
- `frontend/build.sh`

### PASS: frontend has a controller-owned runs view

- `frontend/src/components/workspace/layout.js`
- `frontend/src/app/bootstrap.js`
- `frontend/src/pages/runs/index.js`
- `frontend/src/pages/runs/runs.css`
- `frontend/src/pages/codex/index.js`
- `frontend/build.sh`

### PASS: node routing never silently falls back to local execution

- `backend/internal/server/sessions.go`

### PASS: node id priority includes body, header, and query

- `backend/internal/server/sessions.go`

### PASS: agent websocket protocol has typed envelopes and request correlation

- `backend/internal/model/node.go`
- `agent/internal/model/node.go`

### PASS: agent hello, heartbeat, request, response, and event flow is implemented

- `agent/internal/agent/agent.go`
- `backend/internal/server/agent.go`
- `backend/internal/node/remote.go`
- `backend/internal/node/remote_test.go`

### PASS: agent responses are bound to the websocket connection that received the request

- `agent/internal/agent/agent.go`
- `agent/internal/agent/agent_test.go`

### PASS: controller persists node records and generated agent token

- `backend/internal/server/app.go`
- `backend/internal/config/config.go`
- `backend/internal/node/registry.go`

### PASS: stale agent disconnect cannot mark a reconnected node offline

- `backend/internal/node/registry.go`
- `backend/internal/node/registry_test.go`

### PASS: agent config requires controller, identity, token, root, Codex home, and Codex binary

- `agent/internal/config/config.go`

### PASS: build scripts produce both controller and agent binaries

- `build-all.sh`
- `build.sh`

### PASS: root Go test wrapper covers both separated modules

- `test-go.sh`
- `README.md`

### PASS: Docker agent image stays lightweight and proxy-aware

- `agent/Dockerfile`

### PASS: Docker agent helper persists data and imports existing Codex auth/session state

- `scripts/run-agent-container.sh`

### PASS: systemd keeps only the controller on the host

- `systemd/codex-web.service`

### PASS: frontend assets are bundled and cache-busted

- `frontend/src/index.html`
- `frontend/build.sh`

### PASS: fixture assets are not publicly served unless audit mode is enabled

- `backend/internal/config/config.go`
- `backend/internal/server/app.go`
- `backend/internal/server/app_test.go`

### PASS: static asset misses return 404 while client routes fall back to index

- `backend/internal/server/app.go`
- `backend/internal/server/app_test.go`

### PASS: static directories are never listed

- `backend/internal/server/app.go`
- `backend/internal/server/app_test.go`

### PASS: app-owned frontend code does not load remote code-server/webview/auth runtime

- `frontend/src/app/bootstrap.js`
- `frontend/src/app/layout.css`
- `frontend/src/components/icons/codex-icons.js`
- `frontend/src/components/workspace/layout.js`
- `frontend/src/pages/codex/activity-summary.js`
- `frontend/src/pages/codex/api.js`
- `frontend/src/pages/codex/config.js`
- `frontend/src/pages/codex/grouping.js`
- `frontend/src/pages/codex/index.js`
- `frontend/src/pages/codex/lifecycle.js`
- `frontend/src/pages/codex/panel-shadow.css`
- `frontend/src/pages/codex/panel.css`
- ... 12 more

### PASS: current web UI has no browser login/auth surface

- `backend/internal/server/app.go`
- `frontend/src/index.html`

### PASS: production frontend does not fall back to fixture or local fake sessions

- `frontend/src/pages/codex/index.js`
- `frontend/src/pages/codex/renderer.js`

### PASS: production frontend bundle excludes fixture sample data

- `backend/public/dist/app/codex-web.js`
- `backend/public/dist/app/codex-fixtures.js`

### PASS: unified panel audit runner covers virtual scrolling

- `scripts/run-codex-panel-audits.ps1`
- `scripts/audit-codex-virtual-scroll.cjs`

### PASS: unified panel audit runner executes the Runs view smoke

- `scripts/run-codex-panel-audits.ps1`
- `scripts/verify-runs-view.py`

### PASS: unified panel audit runner executes controller side-view smoke

- `scripts/run-codex-panel-audits.ps1`
- `scripts/verify-controller-views.py`

