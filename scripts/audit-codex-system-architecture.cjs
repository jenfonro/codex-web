#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const reportDir = path.join(repoRoot, "reference", "codex-reference");
const jsonPath = path.join(reportDir, "system-architecture-audit.json");
const mdPath = path.join(reportDir, "system-architecture-audit.md");

const checks = [];

function rel(file) {
  return path.relative(repoRoot, file).replace(/\\/g, "/");
}

function repoPath(...parts) {
  return path.join(repoRoot, ...parts);
}

function exists(...parts) {
  return fs.existsSync(repoPath(...parts));
}

function read(...parts) {
  return fs.readFileSync(repoPath(...parts), "utf8");
}

function readIfExists(...parts) {
  return exists(...parts) ? read(...parts) : "";
}

function firstExistingParts(candidates) {
  return candidates.find((parts) => exists(...parts)) || candidates[0];
}

function listDirs(...parts) {
  const dir = repoPath(...parts);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function walkFiles(rootParts, options = {}) {
  const root = repoPath(...rootParts);
  const ignoredDirNames = new Set(options.ignoredDirNames || []);
  const ignoredRelativePrefixes = (options.ignoredRelativePrefixes || []).map((item) => item.replace(/\\/g, "/"));
  const extensions = options.extensions ? new Set(options.extensions) : null;
  const out = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const relative = rel(full);
      if (entry.isDirectory()) {
        if (ignoredDirNames.has(entry.name)) continue;
        if (ignoredRelativePrefixes.some((prefix) => relative === prefix || relative.startsWith(`${prefix}/`))) continue;
        walk(full);
      } else if (!extensions || extensions.has(path.extname(entry.name))) {
        out.push(full);
      }
    }
  }

  if (fs.existsSync(root)) walk(root);
  return out.sort((a, b) => rel(a).localeCompare(rel(b)));
}

function lineMatches(files, pattern) {
  const matches = [];
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      if (pattern.test(lines[index])) {
        matches.push(`${rel(file)}:${index + 1}`);
      }
    }
  }
  return matches;
}

function containsAll(fileText, values) {
  return values.every((value) => fileText.includes(value));
}

function addCheck(name, ok, details, evidence = []) {
  checks.push({
    name,
    ok: Boolean(ok),
    details,
    evidence: Array.isArray(evidence) ? evidence : [String(evidence)],
  });
}

function addRequiredFile(name, filePath) {
  addCheck(name, exists(...filePath.split("/")), filePath, [filePath]);
}

function exactDirSet(actual, expected) {
  const missing = expected.filter((item) => !actual.includes(item));
  const unexpected = actual.filter((item) => !expected.includes(item));
  return { ok: missing.length === 0 && unexpected.length === 0, missing, unexpected };
}

const backendGoFiles = walkFiles(["backend"], {
  extensions: [".go"],
  ignoredRelativePrefixes: ["backend/public/dist"],
});
const agentGoFiles = walkFiles(["agent"], { extensions: [".go"] });
const frontendOwnedFiles = [
  ...walkFiles(["frontend", "src", "app"], { extensions: [".js", ".css", ".html"] }),
  ...walkFiles(["frontend", "src", "components"], { extensions: [".js", ".css", ".html"] }),
  ...walkFiles(["frontend", "src", "pages"], { extensions: [".js", ".css", ".html"] }),
  ...walkFiles(["frontend", "src", "store"], { extensions: [".js", ".css", ".html"] }),
].filter((file) => !rel(file).endsWith("frontend/src/pages/codex/fixtures.js"));

const backendInternalDirs = listDirs("backend", "internal");
const agentInternalDirs = listDirs("agent", "internal");

const backendApp = read("backend", "internal", "server", "app.go");
const backendAppTests = read("backend", "internal", "server", "app_test.go");
const backendSessions = read("backend", "internal", "server", "sessions.go");
const backendAgent = read("backend", "internal", "server", "agent.go");
const backendRegistry = read("backend", "internal", "node", "registry.go");
const backendRegistryTests = read("backend", "internal", "node", "registry_test.go");
const backendRemote = read("backend", "internal", "node", "remote.go");
const backendRemoteTests = read("backend", "internal", "node", "remote_test.go");
const backendConfig = read("backend", "internal", "config", "config.go");
const backendModel = read("backend", "internal", "model", "node.go");
const agentMain = read("agent", "main.go");
const agentAgent = read("agent", "internal", "agent", "agent.go");
const agentAgentTests = read("agent", "internal", "agent", "agent_test.go");
const agentConfig = read("agent", "internal", "config", "config.go");
const agentSession = read("agent", "internal", "session", "manager.go");
const agentSessionTests = read("agent", "internal", "session", "history_test.go");
const agentHostGit = read("agent", "internal", "host", "git.go");
const agentModel = read("agent", "internal", "model", "node.go");
const buildScript = read("build.sh");
const buildAllScript = read("build-all.sh");
const testGoScript = read("test-go.sh");
const frontendBuild = read("frontend", "build.sh");
const frontendIndex = read("frontend", "src", "index.html");
const frontendRuntimeBundleParts = firstExistingParts([
  ["backend", "public", "dist", "app", "codex-web.js"],
  ["frontend", "dist", "app", "codex-web.js"],
]);
const frontendFixtureBundleParts = firstExistingParts([
  ["backend", "public", "dist", "app", "codex-fixtures.js"],
  ["frontend", "dist", "app", "codex-fixtures.js"],
]);
const frontendRuntimeBundle = readIfExists(...frontendRuntimeBundleParts);
const frontendFixtureBundle = readIfExists(...frontendFixtureBundleParts);
const frontendBootstrap = read("frontend", "src", "app", "bootstrap.js");
const frontendWorkspaceLayout = read("frontend", "src", "components", "workspace", "layout.js");
const frontendCodexAPI = read("frontend", "src", "pages", "codex", "api.js");
const frontendCodexIndex = read("frontend", "src", "pages", "codex", "index.js");
const frontendCodexRenderer = read("frontend", "src", "pages", "codex", "renderer.js");
const frontendCodexPanelShadow = read("frontend", "src", "pages", "codex", "panel-shadow.css");
const frontendCodexStore = read("frontend", "src", "store", "codex.js");
const frontendWorkspaceIndex = read("frontend", "src", "pages", "workspace", "index.js");
const frontendWorkspaceCSS = read("frontend", "src", "pages", "workspace", "workspace.css");
const frontendNodesIndex = read("frontend", "src", "pages", "nodes", "index.js");
const frontendNodesCSS = read("frontend", "src", "pages", "nodes", "nodes.css");
const frontendGitIndex = read("frontend", "src", "pages", "git", "index.js");
const frontendGitCSS = read("frontend", "src", "pages", "git", "git.css");
const frontendRunsIndex = read("frontend", "src", "pages", "runs", "index.js");
const frontendRunsCSS = read("frontend", "src", "pages", "runs", "runs.css");
const dockerfile = read("agent", "Dockerfile");
const runAgentContainer = read("scripts", "run-agent-container.sh");
const panelAuditRunner = read("scripts", "run-codex-panel-audits.ps1");
const runsViewVerifier = read("scripts", "verify-runs-view.py");
const controllerViewsVerifier = read("scripts", "verify-controller-views.py");
const systemdFiles = fs.existsSync(repoPath("systemd"))
  ? fs.readdirSync(repoPath("systemd")).filter((name) => name.endsWith(".service")).sort()
  : [];

addRequiredFile("controller entry lives under backend/cmd/codex-web", "backend/cmd/codex-web/main.go");
addCheck(
  "agent is a root-level Go module, not nested under backend",
  exists("agent", "go.mod") && exists("agent", "main.go") && !exists("backend", "cmd", "codex-agent"),
  "agent/go.mod and agent/main.go exist; backend/cmd/codex-agent must not exist",
  ["agent/go.mod", "agent/main.go"]
);

{
  const result = exactDirSet(backendInternalDirs, ["config", "model", "node", "server"]);
  addCheck(
    "backend internal packages stay controller-only",
    result.ok,
    `actual=${backendInternalDirs.join(",")}; missing=${result.missing.join(",") || "none"}; unexpected=${result.unexpected.join(",") || "none"}`,
    backendInternalDirs.map((name) => `backend/internal/${name}`)
  );
}

{
  const result = exactDirSet(agentInternalDirs, ["agent", "config", "host", "model", "session"]);
  addCheck(
    "agent internal packages own transport, host, and session responsibilities",
    result.ok,
    `actual=${agentInternalDirs.join(",")}; missing=${result.missing.join(",") || "none"}; unexpected=${result.unexpected.join(",") || "none"}`,
    agentInternalDirs.map((name) => `agent/internal/${name}`)
  );
}

addCheck(
  "removed backend local Codex/appserver/bridge/host packages",
  !["agent", "appserver", "bridge", "host", "session", "worker"].some((name) => exists("backend", "internal", name)),
  "backend/internal must not contain local execution packages",
  ["backend/internal"]
);

{
  const bad = lineMatches(backendGoFiles, /("os\/exec"|exec\.Command|codex exec|CODEX_AGENT_CODEX_BIN|CODEX_AGENT_ROOT|CODEX_HOME=|codex-web\/agent)/);
  addCheck(
    "backend does not execute Codex or import agent internals",
    bad.length === 0,
    bad.length ? `forbidden execution references: ${bad.join(", ")}` : "no forbidden execution references found",
    backendGoFiles.map(rel)
  );
}

addCheck(
  "agent session manager runs Codex CLI turns",
  containsAll(agentSession, ["os/exec", "exec.CommandContext", "\"exec\"", "\"--json\"", "\"resume\"", "CODEX_HOME="]),
  "agent/internal/session/manager.go contains the CLI execution path for new and resumed sessions",
  ["agent/internal/session/manager.go"]
);

addCheck(
  "agent turns are independent of browser request lifetime",
  containsAll(agentSession, ["func (m *Manager) startTurn", "_ = parent", "context.Background()", "go m.runCodex"]) &&
    agentSessionTests.includes("TestCreateContinuesAfterCallerContextCancelled"),
  "session turns detach from the controller HTTP request context before running the CLI, with a fake Codex regression test",
  ["agent/internal/session/manager.go", "agent/internal/session/history_test.go"]
);

addCheck(
  "agent owns git execution, backend only forwards git requests",
  agentHostGit.includes("os/exec") &&
    agentHostGit.includes("exec.CommandContext") &&
    backendSessions.includes('client.Request(r.Context(), "git.request"') &&
    !lineMatches(backendGoFiles, /exec\.CommandContext\(.*git|exec\.Command\(.*git/).length,
  "git command execution is under agent/internal/host; backend exposes POST /api/git as a remote op",
  ["agent/internal/host/git.go", "backend/internal/server/sessions.go"]
);

addCheck(
  "controller exposes required API routes",
  containsAll(backendApp, [
    '"/api/agent/connect"',
    'path == "/nodes"',
    'path == "/nodes/active"',
    'strings.HasPrefix(path, "/nodes/")',
    'path == "/sessions"',
    'path == "/sessions/events"',
    'strings.HasPrefix(path, "/sessions/")',
    'path == "/workspace"',
    'path == "/git"',
  ]),
  "backend/internal/server/app.go routes nodes, sessions, workspace, git, and agent websocket endpoints",
  ["backend/internal/server/app.go"]
);

addCheck(
  "controller session API forwards to agent operations",
  containsAll(backendSessions, [
    '"session.list"',
    '"session.create"',
    '"session.send"',
    '"session.cancel"',
    '"session.events"',
    '"workspace.fetch"',
    '"git.request"',
  ]),
  "session/workspace/git HTTP handlers use node.Client.Request operations",
  ["backend/internal/server/sessions.go"]
);

addCheck(
  "session SSE supports both backlog and live updates",
  containsAll(backendSessions, [
    '"text/event-stream; charset=utf-8"',
    "sessionEventsFromResult",
    "client.Subscribe()",
    'event.Method != "session.event"',
    "writeSSE(w, event.Params)",
  ]),
  "GET /api/sessions/events replays backlog for one session and streams agent session.event messages",
  ["backend/internal/server/sessions.go", "backend/internal/node/remote.go"]
);

addCheck(
  "session SSE disables reverse-proxy buffering",
  backendSessions.includes('"X-Accel-Buffering"') &&
    backendSessions.includes('"no"') &&
    read("backend", "internal", "server", "sessions_test.go").includes("X-Accel-Buffering"),
  "SSE responses set X-Accel-Buffering: no so nginx can flush stream headers/backlog promptly",
  ["backend/internal/server/sessions.go", "backend/internal/server/sessions_test.go"]
);

addCheck(
  "remote disconnect closes live SSE subscribers",
  backendRemote.includes("subscribers := r.subscribers") &&
    backendRemote.includes("r.subscribers = map[int]*subscriber{}") &&
    backendRemote.includes("func (r *Remote) closeSubscriberLocked(sub *subscriber)") &&
    backendRemote.includes("close(sub.ch)") &&
    backendRemoteTests.includes("event subscription remained open after remote disconnect") &&
    backendRemoteTests.includes("event subscription did not close after remote disconnect"),
  "Remote.Close resolves pending requests and closes subscribed event streams so browsers can reconnect instead of hanging on a stale node stream",
  ["backend/internal/node/remote.go", "backend/internal/node/remote_test.go"]
);

addCheck(
  "remote request write failure tears down the stale node connection",
  backendRemote.includes("if err := r.write(msg); err != nil") &&
    backendRemote.includes("_ = r.Close()") &&
    backendRemote.includes("r.registry.MarkOffline(r.info.ID, r)") &&
    backendRemoteTests.includes("TestRemoteWriteFailureMarksOfflineAndClosesSubscribers"),
  "controller write failures close the remote, mark the node offline, and close event streams instead of leaving a stale online client",
  ["backend/internal/node/remote.go", "backend/internal/node/remote_test.go"]
);

addCheck(
  "session list page can subscribe to all session events",
  backendSessions.includes('sessionID := strings.TrimSpace(r.URL.Query().Get("sessionId"))') &&
    backendSessions.includes('if sessionID != "" && sessionEvent != sessionID') &&
    backendSessions.includes('if sessionID != "" {') &&
    backendSessions.includes("client.Subscribe()"),
  "omitting sessionId keeps the SSE stream open for every session on the selected node",
  ["backend/internal/server/sessions.go"]
);

addCheck(
  "frontend exposes explicit node switching for multi-agent control",
  containsAll(frontendCodexAPI, ["function normalizeNodes", "function normalizeNode", "compareNodes"]) &&
    containsAll(frontendCodexStore, ["nodes: []", "codex-web:node-id"]) &&
    containsAll(frontendCodexIndex, [
      "state.nodes = nodes",
      "function switchNode(nodeID)",
      '"/api/nodes/active"',
      "closeNodeEventSource()",
      "closeSessionEventSource()",
      "await loadSessions()",
      "subscribeNodeSessions()",
    ]) &&
    containsAll(frontendCodexRenderer, [
      "renderNodeSelectorButton",
      "renderNodeMenu",
      "data-codex-node-id",
      "state.nodes.length < 2",
    ]) &&
    frontendCodexPanelShadow.includes(".codex-floating-menu-node"),
  "the Codex panel stores normalized nodes, shows a multi-node selector only when needed, switches active node through the controller, and rebuilds session/SSE state",
  [
    "frontend/src/pages/codex/api.js",
    "frontend/src/store/codex.js",
    "frontend/src/pages/codex/index.js",
    "frontend/src/pages/codex/renderer.js",
    "frontend/src/pages/codex/panel-shadow.css",
  ]
);

addCheck(
  "frontend has a controller-owned node management view",
  containsAll(frontendWorkspaceLayout, [
    'nodesPanel: "nodesPanel"',
    'view: "nodes"',
    'data-workspace-view="${item.view}"',
    'data-workspace-panel="nodes"',
  ]) &&
    containsAll(frontendBootstrap, [
      "function initWorkspaceViews",
      '"codex-web:workspace-view"',
      '"codex-web:view-changed"',
      '"nodes"',
    ]) &&
    containsAll(frontendNodesIndex, [
      'api.fetchJSON("/api/nodes")',
      'api.normalizeNodes(payload.nodes)',
      '"/api/nodes/active"',
      "store.setStoredNodeId(nodeId)",
      '"codex-web:node-selected"',
      '`/api/nodes/${encodeURIComponent(nodeId)}`',
    ]) &&
    containsAll(frontendCodexIndex, [
      '"codex-web:node-selected"',
      "function handleExternalNodeSelected",
      "await switchNode(nodeID)",
    ]) &&
    containsAll(frontendBuild, [
      '"pages/nodes/nodes.css"',
      '"pages/nodes/index.js"',
    ]) &&
    frontendNodesCSS.includes(".nodes-view"),
  "the workspace can switch from the Codex view to a controller-owned Nodes view, list nodes, select the active node, delete offline nodes, and keep Codex panel node state synchronized",
  [
    "frontend/src/components/workspace/layout.js",
    "frontend/src/app/bootstrap.js",
    "frontend/src/pages/nodes/index.js",
    "frontend/src/pages/nodes/nodes.css",
    "frontend/src/pages/codex/index.js",
    "frontend/build.sh",
  ]
);

addCheck(
  "frontend has controller-owned workspace and git views",
  containsAll(frontendWorkspaceLayout, [
    'workspacePanel: "workspacePanel"',
    'gitPanel: "gitPanel"',
    'view: "workspace"',
    'view: "git"',
    'data-workspace-panel="workspace"',
    'data-workspace-panel="git"',
  ]) &&
    containsAll(frontendBootstrap, [
      'new Set(["codex", "workspace", "nodes", "git", "runs"])',
      'workspace: "WORKSPACE"',
      'git: "SOURCE CONTROL"',
    ]) &&
    containsAll(frontendWorkspaceIndex, [
      'api.fetchJSON("/api/workspace"',
      'endpoint: "workspace-directory-entries"',
      'endpoint: "workspace-directory-tree-search"',
      "store.getStoredNodeId()",
      '"codex-web:node-selected"',
    ]) &&
    containsAll(frontendGitIndex, [
      'api.fetchJSON("/api/git"',
      'gitRequest("branch-metadata")',
      'gitRequest("status-summary")',
      'gitRequest("review-summary", { includeUntrackedFiles: true })',
      "store.getStoredNodeId()",
      '"codex-web:node-selected"',
    ]) &&
    containsAll(frontendBuild, [
      '"pages/workspace/workspace.css"',
      '"pages/workspace/index.js"',
      '"pages/git/git.css"',
      '"pages/git/index.js"',
    ]) &&
    frontendWorkspaceCSS.includes(".workspace-view") &&
    frontendGitCSS.includes(".git-view"),
  "the workspace Activity Bar can switch to file browsing and source-control views that call the controller workspace/git APIs for the active agent node",
  [
    "frontend/src/components/workspace/layout.js",
    "frontend/src/app/bootstrap.js",
    "frontend/src/pages/workspace/index.js",
    "frontend/src/pages/workspace/workspace.css",
    "frontend/src/pages/git/index.js",
    "frontend/src/pages/git/git.css",
    "frontend/build.sh",
  ]
);

addCheck(
  "frontend has a controller-owned runs view",
  containsAll(frontendWorkspaceLayout, [
    'runsPanel: "runsPanel"',
    'view: "runs"',
    'data-workspace-panel="runs"',
  ]) &&
    containsAll(frontendBootstrap, [
      'new Set(["codex", "workspace", "nodes", "git", "runs"])',
      'runs: "RUNS"',
      '"codex-web:open-view"',
    ]) &&
    containsAll(frontendRunsIndex, [
      'api.fetchJSON("/api/nodes")',
      '`/api/sessions?nodeId=${encodeURIComponent(node.id)}`',
      '`/api/sessions/events?nodeId=${encodeURIComponent(node.id)}`',
      '`/api/sessions/${encodeURIComponent(sessionId)}/cancel`',
      "lifecycle.sessionStatusFromEvent",
      '"codex-web:open-view"',
      '"codex-web:open-session"',
    ]) &&
    containsAll(frontendCodexIndex, [
      '"codex-web:open-session"',
      "function handleExternalOpenSession",
      "await openSession(sessionID",
    ]) &&
    containsAll(frontendBuild, [
      '"pages/runs/runs.css"',
      '"pages/runs/index.js"',
    ]) &&
    frontendRunsCSS.includes(".runs-view"),
  "the workspace Activity Bar can switch to a controller-owned Runs view that aggregates online-node sessions, subscribes to live session events, opens a run in the Codex panel, and cancels active turns through the controller",
  [
    "frontend/src/components/workspace/layout.js",
    "frontend/src/app/bootstrap.js",
    "frontend/src/pages/runs/index.js",
    "frontend/src/pages/runs/runs.css",
    "frontend/src/pages/codex/index.js",
    "frontend/build.sh",
  ]
);

addCheck(
  "node routing never silently falls back to local execution",
  containsAll(backendSessions, [
    'return nil, fmt.Errorf("nodeId is required")',
    'return nil, fmt.Errorf("node %q is offline", nodeID)',
    'return nil, fmt.Errorf("node %q does not exist", nodeID)',
  ]) &&
    !/\blocal\b/.test(backendSessions),
  "missing, offline, and unknown nodes are explicit errors",
  ["backend/internal/server/sessions.go"]
);

addCheck(
  "node id priority includes body, header, and query",
  containsAll(backendSessions, [
    'body["nodeId"]',
    'r.Header.Get("X-Codex-Web-Node-ID")',
    'r.URL.Query().Get("nodeId")',
  ]),
  "requestNodeID checks explicit body nodeId, X-Codex-Web-Node-ID, then query nodeId",
  ["backend/internal/server/sessions.go"]
);

addCheck(
  "agent websocket protocol has typed envelopes and request correlation",
  containsAll(backendModel, ["Type", "RequestID", "NodeID", "Result", "Error", "Event"]) &&
    containsAll(agentModel, ["Type", "RequestID", "NodeID", "Result", "Error", "Event"]),
  "backend and agent model envelopes carry type, requestId, nodeId, result, error, and event",
  ["backend/internal/model/node.go", "agent/internal/model/node.go"]
);

addCheck(
  "agent hello, heartbeat, request, response, and event flow is implemented",
  containsAll(agentAgent, ['Type:   "agent.hello"', '"agent.heartbeat"', '"controller.request"', '"agent.response"', '"agent.event"']) &&
    containsAll(backendAgent, ['first.Type != "agent.hello"', "node.NewRemote", "UpsertRemote"]) &&
    containsAll(backendRemote, ['case "agent.response"', 'case "agent.event"', 'case "agent.heartbeat"']) &&
    backendRemoteTests.includes("TestRemoteDisconnectResolvesPendingRequest"),
  "agent connects outbound, registers with hello, heartbeats, handles controller.request, forwards session events, and disconnects unblock pending controller requests",
  ["agent/internal/agent/agent.go", "backend/internal/server/agent.go", "backend/internal/node/remote.go", "backend/internal/node/remote_test.go"]
);

addCheck(
  "agent responses are bound to the websocket connection that received the request",
  !agentAgent.includes("conn     *websocket.Conn") &&
    agentAgent.includes("func (a *Agent) readLoop(ctx context.Context, conn *websocket.Conn)") &&
    agentAgent.includes("go a.handleRequest(ctx, conn, msg)") &&
    agentAgent.includes("func (a *Agent) handleRequest(ctx context.Context, conn *websocket.Conn, msg model.AgentEnvelope)") &&
    agentAgent.includes("func (a *Agent) forwardEvents(ctx context.Context, conn *websocket.Conn) error") &&
    agentAgent.includes("go func() { done <- a.forwardEvents(connCtx, conn) }()") &&
    agentAgent.includes("func (a *Agent) write(conn *websocket.Conn, msg model.AgentEnvelope) error") &&
    agentAgentTests.includes("TestHandleRequestWritesResponseToOwningConnection") &&
    agentAgentTests.includes("TestForwardEventsReturnsWriteError"),
  "request responses and forwarded events use the connection for the current serve loop instead of a mutable global agent connection, and event write failures break the serve loop for reconnect",
  ["agent/internal/agent/agent.go", "agent/internal/agent/agent_test.go"]
);

addCheck(
  "controller persists node records and generated agent token",
  backendApp.includes('filepath.Join(cfg.DataDir, "nodes.json")') &&
    backendConfig.includes('loadOrCreateSecret(filepath.Join(dataDir, "agent-token.txt")') &&
    containsAll(backendRegistry, ["func (r *Registry) Load", "func (r *Registry) Save", "func (r *Registry) UpsertRemote", "func (r *Registry) MarkOffline", "func (r *Registry) DeleteOffline"]) &&
    backendRegistry.includes("cannot delete an online node"),
  "nodes.json and agent-token.txt are data-dir owned; registry keeps offline records and blocks online deletion",
  ["backend/internal/server/app.go", "backend/internal/config/config.go", "backend/internal/node/registry.go"]
);

addCheck(
  "stale agent disconnect cannot mark a reconnected node offline",
  backendRegistryTests.includes("TestRegistryStaleDisconnectDoesNotMarkReconnectedNodeOffline") &&
    backendRegistry.includes("if current := r.clients[id]; current == client") &&
    backendRegistry.includes("delete(r.clients, id)"),
  "registry only removes the matching client on MarkOffline and has a regression test for same-node reconnect races",
  ["backend/internal/node/registry.go", "backend/internal/node/registry_test.go"]
);

addCheck(
  "agent config requires controller, identity, token, root, Codex home, and Codex binary",
  containsAll(agentConfig, [
    "CODEX_AGENT_CONTROLLER",
    "CODEX_AGENT_ID",
    "CODEX_AGENT_NAME",
    "CODEX_AGENT_TOKEN",
    "CODEX_HOME",
    "CODEX_AGENT_ROOT",
    "CODEX_AGENT_CODEX_BIN",
  ]),
  "agent/internal/config/config.go defines the runtime boundary through environment variables",
  ["agent/internal/config/config.go"]
);

addCheck(
  "build scripts produce both controller and agent binaries",
  containsAll(buildAllScript, ["./frontend", "./build.sh"]) &&
    containsAll(buildScript, ['go build -buildvcs=false -o "../build/codex-web${GOEXE}" ./cmd/codex-web', 'go build -buildvcs=false -o "../build/codex-agent${GOEXE}" .']),
  "build-all builds frontend and delegates to build.sh; build.sh emits codex-web and codex-agent",
  ["build-all.sh", "build.sh"]
);

addCheck(
  "root Go test wrapper covers both separated modules",
  containsAll(testGoScript, ["cd backend && go test ./...", "cd agent && go test ./..."]) &&
    containsAll(testGoScript, ["backend/public/dist/index.html", "frontend && ./build.sh", "cp -a ./frontend/dist/. ./backend/public/dist/"]) &&
    !read("README.md").includes("go test ./...\n(cd agent && go test ./...)") &&
    read("README.md").includes("./test-go.sh") &&
    read("README.md").includes("prepares `backend/public/dist` automatically"),
  "test-go.sh is the root verification entry for the separate backend and agent Go modules, and it prepares embedded frontend dist for fresh clones",
  ["test-go.sh", "README.md"]
);

addCheck(
  "Docker agent image stays lightweight and proxy-aware",
  dockerfile.includes("proxy.zelt.cn/library/alpine:3.20") &&
    dockerfile.includes("FROM ${BASE_IMAGE}") &&
    !/ubuntu|debian/i.test(dockerfile) &&
    dockerfile.includes('ENTRYPOINT ["/usr/local/bin/codex-agent"]'),
  "agent/Dockerfile uses the proxy Alpine base and starts codex-agent directly",
  ["agent/Dockerfile"]
);

addCheck(
  "Docker agent helper persists data and imports existing Codex auth/session state",
  containsAll(runAgentContainer, [
    'DATA_DIR="${CODEX_AGENT_DATA',
    '"${DATA_DIR}/codex-home:${CONTAINER_CODEX_HOME}"',
    "auth.json config.toml",
    "sessions",
    "--restart unless-stopped",
  ]),
  "run-agent-container mounts persistent codex-home/tmp/root, copies auth/config, imports sessions, and keeps detached containers running",
  ["scripts/run-agent-container.sh"]
);

addCheck(
  "systemd keeps only the controller on the host",
  systemdFiles.length === 1 &&
    systemdFiles[0] === "codex-web.service" &&
    read("systemd", "codex-web.service").includes("ExecStart=/root/code/codex-web/build/codex-web") &&
    !read("systemd", "codex-web.service").includes("codex-agent"),
  `systemd services=${systemdFiles.join(",") || "none"}`,
  systemdFiles.map((name) => `systemd/${name}`)
);

addCheck(
  "frontend assets are bundled and cache-busted",
  containsAll(frontendIndex, [
    'href="app/codex-web.css?v=__CODEX_WEB_ASSET_VERSION__"',
    'src="app/codex-web.js?v=__CODEX_WEB_ASSET_VERSION__"',
  ]) &&
    containsAll(frontendBuild, ["CODEX_WEB_ASSET_VERSION", "app/codex-web.css", "app/codex-web.js", "app/codex-fixtures.js", "sed -i.bak"]),
  "frontend build emits app/codex-web.css and app/codex-web.js with timestamped URLs, plus a separate fixture bundle for explicit audits",
  ["frontend/src/index.html", "frontend/build.sh"]
);

addCheck(
  "fixture assets are not publicly served unless audit mode is enabled",
    backendConfig.includes("CODEX_WEB_ENABLE_FIXTURES") &&
    backendApp.includes("EnableFixtures") &&
    backendApp.includes("isFixtureAsset") &&
    backendApp.includes("pathpkg.Clean") &&
    backendApp.includes('w.Header().Set("Cache-Control", "no-store")') &&
    backendApp.includes("http.NotFound") &&
    backendAppTests.includes("TestStaticHandlerBlocksFixtureAssetByDefault") &&
    backendAppTests.includes('"/app/./codex-fixtures.js"') &&
    backendAppTests.includes('"/app//codex-fixtures.js"') &&
    backendAppTests.includes('"/app/%63odex-fixtures.js"') &&
    backendAppTests.includes("TestStaticHandlerAllowsFixtureAssetWhenEnabled"),
  "app/codex-fixtures.js remains buildable for local audits but the controller hides it by default in production static serving, including normalized path variants",
  ["backend/internal/config/config.go", "backend/internal/server/app.go", "backend/internal/server/app_test.go"]
);

addCheck(
  "static asset misses return 404 while client routes fall back to index",
  backendApp.includes("canFallbackToIndex") &&
    backendApp.includes('strings.HasPrefix(path, "app/")') &&
    backendApp.includes('strings.HasPrefix(path, "assets/")') &&
    backendApp.includes("filepath.Ext(path) == \"\"") &&
    backendApp.includes('serveReq.URL.Path = "/"') &&
    backendAppTests.includes("TestStaticHandlerDoesNotFallbackForMissingStaticAssets") &&
    backendAppTests.includes("TestStaticHandlerFallsBackToIndexForClientRoutes") &&
    backendAppTests.includes("TestStaticHandlerServesCleanedExistingStaticAsset"),
  "missing JS/CSS/assets are explicit 404s; extensionless client routes still receive index.html without a FileServer redirect",
  ["backend/internal/server/app.go", "backend/internal/server/app_test.go"]
);

addCheck(
  "static directories are never listed",
  backendApp.includes("func isDirectory") &&
    backendApp.includes("info.IsDir()") &&
    backendApp.includes("isDirectory(file)") &&
    backendApp.includes("writeStaticNotFound(w, r)") &&
    backendAppTests.includes("TestStaticHandlerDoesNotListStaticDirectories") &&
    backendAppTests.includes('"/app/"') &&
    backendAppTests.includes('"/assets/"') &&
    backendAppTests.includes('"/assets/codex-panel/"') &&
    backendAppTests.includes("TestStaticHandlerServesIndexRoot"),
  "static directories return 404/no-store explicitly while the root path still serves index.html",
  ["backend/internal/server/app.go", "backend/internal/server/app_test.go"]
);

{
  const bad = lineMatches(frontendOwnedFiles, /(code-tx\.zelt\.cn|vscode-resource|extensionId=openai\.chatgpt|iframe\.webview|shell\.js|\/api\/login|type=["']password["'])/);
  addCheck(
    "app-owned frontend code does not load remote code-server/webview/auth runtime",
    bad.length === 0,
    bad.length ? `unexpected runtime references: ${bad.join(", ")}` : "no remote code-server/webview/auth runtime references in app-owned frontend code",
    frontendOwnedFiles.map(rel)
  );
}

addCheck(
  "current web UI has no browser login/auth surface",
  !backendApp.includes("/api/login") &&
    !lineMatches(frontendOwnedFiles, /(\/api\/login|type=["']password["']|CODEX_WEB_PASSWORD)/).length,
  "agent token auth is retained for agent websocket only; browser UI has no login/password route",
  ["backend/internal/server/app.go", "frontend/src/index.html"]
);

addCheck(
  "production frontend does not fall back to fixture or local fake sessions",
  frontendCodexIndex.includes("useFixtureMode") &&
    frontendCodexIndex.includes("loadFixtureModule") &&
    frontendCodexIndex.includes("createInteractiveSession") &&
    frontendCodexIndex.includes("function createFixtureSession") &&
    !frontendCodexIndex.includes("const fixtures = global.CodexPanelFixtures") &&
    !frontendCodexIndex.includes("function createLocalSession") &&
    !frontendCodexIndex.includes("`local-${Date.now()}") &&
    !frontendCodexIndex.includes("`fixture-${Date.now()}") &&
    !frontendCodexIndex.includes("本地样式预览会话已创建。") &&
    !/catch\s*\([^)]*\)\s*\{[^}]*useSampleSessions/s.test(frontendCodexIndex) &&
    !frontendCodexRenderer.includes("runtime.samples?.eventsBySession"),
  "fixtures remain available only through explicit codexFixture modes; production API failures surface errors instead of sample/local conversations; fixture session creation is delegated to the fixture bundle",
  ["frontend/src/pages/codex/index.js", "frontend/src/pages/codex/renderer.js"]
);

addCheck(
  "production frontend bundle excludes fixture sample data",
  frontendRuntimeBundle.length > 0 &&
    frontendFixtureBundle.length > 0 &&
    !frontendRuntimeBundle.includes("defineCodexPanelFixtures") &&
    !frontendRuntimeBundle.includes("summaryFollowupHTML") &&
    !frontendRuntimeBundle.includes("createVirtualScrollEvents") &&
    !frontendRuntimeBundle.includes("Virtual scroll turn") &&
    !frontendRuntimeBundle.includes("`fixture-${Date.now()}") &&
    !frontendRuntimeBundle.includes("本地样式预览会话已创建。") &&
    frontendFixtureBundle.includes("defineCodexPanelFixtures") &&
    frontendFixtureBundle.includes("createVirtualScrollEvents") &&
    frontendFixtureBundle.includes("createInteractiveSession"),
  frontendRuntimeBundle.length && frontendFixtureBundle.length
    ? "main app bundle contains only the explicit fixture loader; fixture definitions, sample data, and fixture session creation live in app/codex-fixtures.js"
    : "run ./build-all.sh before architecture audit so backend/public/dist app bundles exist",
  [frontendRuntimeBundleParts.join("/"), frontendFixtureBundleParts.join("/")]
);

addCheck(
  "unified panel audit runner covers virtual scrolling",
  panelAuditRunner.includes('node --check "scripts\\audit-codex-virtual-scroll.cjs"') &&
    panelAuditRunner.includes('node "scripts\\audit-codex-virtual-scroll.cjs"'),
  "long-session virtual scroll coverage is part of the standard panel audit runner, not a manual-only script",
  ["scripts/run-codex-panel-audits.ps1", "scripts/audit-codex-virtual-scroll.cjs"]
);

addCheck(
  "unified panel audit runner executes the Runs view smoke",
  panelAuditRunner.includes('python -m py_compile "scripts\\verify-runs-view.py"') &&
    panelAuditRunner.includes('python "scripts\\verify-runs-view.py"') &&
    runsViewVerifier.includes("runs-view-audit.json") &&
    runsViewVerifier.includes('"/api/sessions/events"') &&
    runsViewVerifier.includes('"cancelRequests"') &&
    runsViewVerifier.includes('"activeViewAfterOpen"'),
  "the controller-owned Runs sidebar is browser-tested for node/session loading, all-session SSE subscription, cancel routing, and opening a run",
  ["scripts/run-codex-panel-audits.ps1", "scripts/verify-runs-view.py"]
);

addCheck(
  "unified panel audit runner executes controller side-view smoke",
  panelAuditRunner.includes('python -m py_compile "scripts\\verify-controller-views.py"') &&
    panelAuditRunner.includes('python "scripts\\verify-controller-views.py"') &&
    controllerViewsVerifier.includes("controller-views-audit.json") &&
    controllerViewsVerifier.includes('"activeNodeRequests"') &&
    controllerViewsVerifier.includes('"workspaceRequests"') &&
    controllerViewsVerifier.includes('"gitRequests"') &&
    controllerViewsVerifier.includes('"/api/workspace"') &&
    controllerViewsVerifier.includes('"/api/git"'),
  "Nodes, Workspace, and Git side views are browser-tested for active-node selection, offline-node deletion, workspace routing, and git routing",
  ["scripts/run-codex-panel-audits.ps1", "scripts/verify-controller-views.py"]
);

const failed = checks.filter((check) => !check.ok);
const report = {
  generatedAt: new Date().toISOString(),
  basis: "Static architecture audit for Codex Web controller + root agent separation. This is a source-boundary gate, not a replacement for Go tests or browser visual audits.",
  totals: {
    checks: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
  },
  checks,
};

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(mdPath, renderMarkdown(report));

if (failed.length > 0) {
  console.error(`system architecture audit failed: ${failed.length}/${checks.length} checks failed`);
  for (const check of failed) {
    console.error(`- ${check.name}: ${check.details}`);
  }
  process.exit(1);
}

console.log(`system architecture audit passed: ${checks.length}/${checks.length} checks`);
console.log(rel(jsonPath));
console.log(rel(mdPath));

function renderMarkdown(report) {
  const lines = [
    "# Codex System Architecture Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    report.basis,
    "",
    "## Summary",
    "",
    `- Checks: ${report.totals.checks}`,
    `- Passed: ${report.totals.passed}`,
    `- Failed: ${report.totals.failed}`,
    "",
    "## Checks",
    "",
    "| Status | Check | Details |",
    "| --- | --- | --- |",
  ];
  for (const check of report.checks) {
    lines.push(`| ${check.ok ? "PASS" : "FAIL"} | ${escapeMarkdown(check.name)} | ${escapeMarkdown(check.details)} |`);
  }
  lines.push("", "## Evidence", "");
  for (const check of report.checks) {
    lines.push(`### ${check.ok ? "PASS" : "FAIL"}: ${check.name}`, "");
    for (const item of check.evidence.slice(0, 12)) {
      lines.push(`- \`${item}\``);
    }
    if (check.evidence.length > 12) {
      lines.push(`- ... ${check.evidence.length - 12} more`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function escapeMarkdown(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}
