"use strict";

(function bootstrapCodexRunsPage(global) {
  const api = global.CodexPanelAPI;
  const lifecycle = global.CodexPanelLifecycle;
  const store = global.CodexPanelStore;
  const utils = global.CodexPanelUtils;
  const panel = document.getElementById("runsPanel");
  if (!panel || !api || !lifecycle || !store || !utils) return;

  const REFRESH_MS = 15000;
  const SSE_RECONNECT_INITIAL_MS = 1000;
  const SSE_RECONNECT_MAX_MS = 15000;
  const runningStatuses = new Set(["pending", "running", "active", "starting"]);
  const state = {
    nodes: [],
    runs: [],
    loading: false,
    error: "",
    cancelling: "",
    loaded: false,
  };
  const eventSources = new Map();
  const eventSourceReconnectTimers = new Map();
  const eventSourceReconnectDelays = new Map();
  let pollTimer = 0;
  let scheduledRefreshTimer = 0;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  function init() {
    panel.addEventListener("click", handleClick);
    global.addEventListener("codex-web:view-changed", handleViewChanged);
    global.addEventListener("codex-web:node-selected", () => {
      if (isActive()) void refreshRuns();
    });
    global.addEventListener("beforeunload", closeAllEventSources);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    render();
    if (isActive()) void refreshRuns();
    syncPolling();
    syncEventSources();
  }

  function handleViewChanged(event) {
    if (event.detail?.view === "runs") {
      void refreshRuns();
    }
    syncPolling();
    syncEventSources();
  }

  function handleVisibilityChange() {
    if (isActive() && !document.hidden && !state.loaded) void refreshRuns();
    syncPolling();
    syncEventSources();
  }

  function handleClick(event) {
    const action = event.target.closest("[data-run-action]");
    if (!action) return;
    const nodeId = action.dataset.nodeId || "";
    const sessionId = action.dataset.sessionId || "";
    switch (action.dataset.runAction) {
      case "refresh":
        void refreshRuns();
        break;
      case "cancel":
        void cancelRun(nodeId, sessionId);
        break;
      case "open":
        openRun(nodeId, sessionId);
        break;
    }
  }

  async function refreshRuns() {
    window.clearTimeout(pollTimer);
    window.clearTimeout(scheduledRefreshTimer);
    pollTimer = 0;
    scheduledRefreshTimer = 0;
    state.loading = true;
    state.error = "";
    render();
    try {
      const payload = await api.fetchJSON("/api/nodes");
      state.nodes = api.normalizeNodes(payload.nodes);
      const online = state.nodes.filter((node) => node.online);
      const results = await Promise.all(online.map(loadNodeSessions));
      state.runs = results.flat().sort(compareRuns);
      state.loaded = true;
    } catch (error) {
      state.error = `Unable to load runs: ${error.message}`;
    } finally {
      state.loading = false;
      render();
      syncPolling();
      syncEventSources();
    }
  }

  async function loadNodeSessions(node) {
    try {
      const payload = await api.fetchJSON(`/api/sessions?nodeId=${encodeURIComponent(node.id)}`);
      return api.normalizeSessions(payload.sessions).map((session) => ({ node, session }));
    } catch (error) {
      return [{
        node,
        session: {
          id: `node-error:${node.id}`,
          title: `Unable to load sessions: ${error.message}`,
          status: "error",
          updatedAt: new Date().toISOString(),
          lastSeq: 0,
          timeLabel: utils.relativeTime(new Date().toISOString()),
          synthetic: true,
        },
      }];
    }
  }

  async function cancelRun(nodeId, sessionId) {
    if (!nodeId || !sessionId) return;
    const key = runKey(nodeId, sessionId);
    state.cancelling = key;
    state.error = "";
    render();
    try {
      await api.fetchJSON(`/api/sessions/${encodeURIComponent(sessionId)}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId }),
      });
      await refreshRuns();
    } catch (error) {
      state.error = `Unable to cancel run: ${error.message}`;
    } finally {
      state.cancelling = "";
      render();
    }
  }

  function openRun(nodeId, sessionId) {
    if (!nodeId || !sessionId || sessionId.startsWith("node-error:")) return;
    store.setStoredNodeId(nodeId);
    global.dispatchEvent(new CustomEvent("codex-web:open-view", { detail: { view: "codex" } }));
    global.dispatchEvent(new CustomEvent("codex-web:open-session", { detail: { nodeId, sessionId } }));
  }

  function render() {
    const running = state.runs.filter((run) => isSessionRunning(run.session));
    const recent = state.runs.filter((run) => !isSessionRunning(run.session)).slice(0, 12);
    panel.innerHTML = `
      <div class="runs-view" data-runs-loaded="${state.loaded ? "true" : "false"}">
        <div class="runs-toolbar">
          <div class="runs-title-block">
            <span class="runs-title">Runs</span>
            <span class="runs-subtitle">${running.length} running / ${state.runs.length} total</span>
          </div>
          <button type="button" class="runs-icon-button codicon codicon-refresh" data-run-action="refresh" aria-label="Refresh runs" title="Refresh runs"${state.loading ? " disabled" : ""}></button>
        </div>
        ${state.error ? `<div class="runs-error" role="alert">${utils.escapeHTML(state.error)}</div>` : ""}
        <div class="runs-list" role="list" aria-label="Runs">
          ${renderBody(running, recent)}
        </div>
      </div>`;
  }

  function renderBody(running, recent) {
    if (state.loading && !state.loaded) {
      return Array.from({ length: 5 }, (_, index) => `<div class="runs-row runs-row-skeleton" role="listitem" aria-hidden="true" style="--runs-delay:${index};"></div>`).join("");
    }
    if (!state.runs.length) {
      return `<div class="runs-empty" role="status"><span class="codicon codicon-run" aria-hidden="true"></span><span>No sessions are available on online nodes.</span></div>`;
    }
    return `
      ${renderSection("Running", running)}
      ${renderSection("Recent", recent)}`;
  }

  function renderSection(label, runs) {
    if (!runs.length) return "";
    return `
      <div class="runs-section">
        <div class="runs-section-title">${utils.escapeHTML(label)}</div>
        ${runs.map(renderRun).join("")}
      </div>`;
  }

  function renderRun(run) {
    const { node, session } = run;
    const running = isSessionRunning(session);
    const busy = state.cancelling === runKey(node.id, session.id);
    const synthetic = Boolean(session.synthetic);
    return `
      <div class="runs-row" role="listitem" data-run-status="${utils.escapeAttr(statusGroup(session.status))}">
        <span class="runs-status-dot" aria-hidden="true"></span>
        <span class="runs-main">
          <span class="runs-row-title">${utils.escapeHTML(session.title || session.id)}</span>
          <span class="runs-row-meta">${utils.escapeHTML(nodeLabel(node))} / ${utils.escapeHTML(session.cwd || node.rootDir || "")}</span>
          <span class="runs-row-submeta">${utils.escapeHTML(session.status || "idle")} / ${utils.escapeHTML(session.timeLabel || utils.relativeTime(session.updatedAt))}</span>
        </span>
        <span class="runs-actions">
          <button type="button" class="runs-action-button" data-run-action="open" data-node-id="${utils.escapeAttr(node.id)}" data-session-id="${utils.escapeAttr(session.id)}"${synthetic ? " disabled" : ""}>Open</button>
          <button type="button" class="runs-icon-button codicon codicon-debug-stop" data-run-action="cancel" data-node-id="${utils.escapeAttr(node.id)}" data-session-id="${utils.escapeAttr(session.id)}" aria-label="Cancel run" title="Cancel run"${running && !busy ? "" : " disabled"}></button>
        </span>
      </div>`;
  }

  function syncPolling() {
    window.clearTimeout(pollTimer);
    pollTimer = 0;
    if (!isActive() || document.hidden) return;
    pollTimer = window.setTimeout(() => {
      void refreshRuns();
    }, REFRESH_MS);
  }

  function syncEventSources() {
    if (!isActive() || document.hidden) {
      closeAllEventSources();
      return;
    }
    const onlineNodes = state.nodes.filter((node) => node.online);
    const onlineIDs = new Set(onlineNodes.map((node) => node.id));
    for (const nodeId of eventSources.keys()) {
      if (!onlineIDs.has(nodeId)) closeEventSource(nodeId);
    }
    for (const node of onlineNodes) {
      if (!eventSources.has(node.id) && !eventSourceReconnectTimers.has(node.id)) {
        openEventSource(node);
      }
    }
  }

  function openEventSource(node) {
    const source = new EventSource(`/api/sessions/events?nodeId=${encodeURIComponent(node.id)}`);
    eventSources.set(node.id, source);
    source.onopen = () => {
      eventSourceReconnectDelays.set(node.id, SSE_RECONNECT_INITIAL_MS);
    };
    source.onmessage = (event) => {
      try {
        applyNodeEvent(node, api.normalizeEvent(JSON.parse(event.data)));
      } catch {
        // A malformed event should not break live run updates.
      }
    };
    source.onerror = () => {
      if (eventSources.get(node.id) !== source) return;
      closeEventSource(node.id);
      scheduleEventSourceReconnect(node.id);
    };
  }

  function closeEventSource(nodeId) {
    const source = eventSources.get(nodeId);
    if (source) source.close();
    eventSources.delete(nodeId);
  }

  function closeAllEventSources() {
    for (const source of eventSources.values()) source.close();
    eventSources.clear();
    for (const timer of eventSourceReconnectTimers.values()) global.clearTimeout(timer);
    eventSourceReconnectTimers.clear();
  }

  function scheduleEventSourceReconnect(nodeId) {
    if (!isActive() || document.hidden || eventSourceReconnectTimers.has(nodeId)) return;
    const delay = eventSourceReconnectDelays.get(nodeId) || SSE_RECONNECT_INITIAL_MS;
    eventSourceReconnectDelays.set(nodeId, Math.min(SSE_RECONNECT_MAX_MS, delay * 2));
    const timer = global.setTimeout(() => {
      eventSourceReconnectTimers.delete(nodeId);
      const node = state.nodes.find((item) => item.id === nodeId && item.online);
      if (node && isActive() && !document.hidden) openEventSource(node);
    }, delay);
    eventSourceReconnectTimers.set(nodeId, timer);
  }

  function applyNodeEvent(node, event) {
    if (!event?.sessionId) return;
    const index = state.runs.findIndex((run) => run.node.id === node.id && run.session.id === event.sessionId);
    if (index < 0) {
      state.runs.unshift({ node, session: sessionFromEvent(event) });
      scheduleRefreshSoon();
    } else {
      const session = state.runs[index].session;
      const updatedAt = event.time || session.updatedAt || new Date().toISOString();
      state.runs[index] = {
        node,
        session: {
          ...session,
          status: lifecycle.sessionStatusFromEvent(event, session.status),
          updatedAt,
          lastSeq: Math.max(Number(session.lastSeq || 0), Number(event.seq || 0)),
          timeLabel: utils.relativeTime(updatedAt),
        },
      };
    }
    state.runs.sort(compareRuns);
    render();
  }

  function sessionFromEvent(event) {
    const updatedAt = event.time || new Date().toISOString();
    return {
      id: event.sessionId,
      codexThreadId: "",
      title: event.kind === "user_message" ? utils.trimTitle(event.text || "") : `Session ${String(event.sessionId).slice(0, 8)}`,
      cwd: "",
      status: lifecycle.sessionStatusFromEvent(event, "idle"),
      updatedAt,
      lastSeq: Number(event.seq || 0),
      timeLabel: utils.relativeTime(updatedAt),
    };
  }

  function scheduleRefreshSoon() {
    if (scheduledRefreshTimer) return;
    scheduledRefreshTimer = global.setTimeout(() => {
      scheduledRefreshTimer = 0;
      if (isActive() && !document.hidden) void refreshRuns();
    }, 600);
  }

  function isActive() {
    return !panel.hidden;
  }

  function compareRuns(left, right) {
    if (isSessionRunning(left.session) && !isSessionRunning(right.session)) return -1;
    if (!isSessionRunning(left.session) && isSessionRunning(right.session)) return 1;
    return String(right.session.updatedAt || "").localeCompare(String(left.session.updatedAt || ""));
  }

  function isSessionRunning(session) {
    return runningStatuses.has(String(session?.status || "").toLowerCase());
  }

  function statusGroup(status) {
    const value = String(status || "idle").toLowerCase();
    if (runningStatuses.has(value)) return "running";
    if (value === "error" || value === "failed") return "error";
    return "idle";
  }

  function runKey(nodeId, sessionId) {
    return `${nodeId}:${sessionId}`;
  }

  function nodeLabel(node) {
    return String(node?.name || node?.id || "Node");
  }

  global.CodexRunsPage = { refresh: refreshRuns };
})(window);
