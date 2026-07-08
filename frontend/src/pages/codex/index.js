"use strict";

(function bootstrapCodexPanel(global) {
  const icons = global.CodexIcons;
  const config = global.CodexPanelConfig;
  const api = global.CodexPanelAPI;
  const fixtures = global.CodexPanelFixtures;
  const utils = global.CodexPanelUtils;
  const lifecycle = global.CodexPanelLifecycle;
  const store = global.CodexPanelStore;
  const rendererFactory = global.CodexPanelRenderer;
  const panel = document.getElementById("codexPanel");
  if (!panel || !icons || !config || !api || !fixtures || !utils || !lifecycle || !store || !rendererFactory) return;

  const EVENT_PAGE_SIZE = 100;
  const LOAD_OLDER_EDGE_PX = 480;

  const mount = config.createPanelMount(panel);
  const fixtureMode = new URLSearchParams(global.location.search).get("codexFixture") || "";
  const useDynamicFixture = fixtureMode === "dynamic";
  const useSampleFixture = fixtureMode === "sample";

  const state = store.createCodexPanelState();

  const runtime = {
    icons,
    config,
    state,
    mount,
    samples: fixtures.createSampleData({ icons, useDynamicFixture, sampleAttachmentSrc: config.SAMPLE_ATTACHMENT_PLACEHOLDER }),
    onThreadScroll: maybeLoadOlderEvents,
  };
  const renderer = rendererFactory.create(runtime);
  let initialized = false;
  let sessionReloadTimer = 0;
  let renderFrame = 0;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    void init();
  }

  async function init() {
    if (initialized) return;
    initialized = true;
    mount.root.addEventListener("click", handleClick);
    mount.root.addEventListener("beforeinput", handleBeforeInput);
    mount.root.addEventListener("input", handleInput);
    mount.root.addEventListener("keydown", handleKeyDown);
    const sampleAttachmentSrc = await config.loadSampleAttachmentDataURL();
    runtime.samples = fixtures.createSampleData({ icons, useDynamicFixture, sampleAttachmentSrc });
    if (useDynamicFixture) {
      useSampleSessions(false);
      state.activeSessionId = "dynamic-running";
      state.view = "thread";
      renderer.render();
      return;
    }
    if (useSampleFixture) {
      useSampleSessions(false);
      renderer.render();
      return;
    }
    await loadNodes();
    await loadSessions();
    subscribeNodeSessions();
    renderer.render();
  }

  async function loadNodes() {
    try {
      const payload = await api.fetchJSON("/api/nodes");
      const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
      const saved = nodes.find((node) => node.id === state.nodeId && node.online);
      const selected = saved || nodes.find((node) => node.online) || nodes[0];
      if (selected?.id) {
        state.nodeId = selected.id;
        store.setStoredNodeId(state.nodeId);
      }
    } catch {
      state.apiAvailable = false;
    }
  }

  async function loadSessions(preserveEvents = false) {
    if (!state.nodeId) {
      useSampleSessions(false);
      return;
    }
    try {
      const payload = await api.fetchJSON(`/api/sessions?nodeId=${encodeURIComponent(state.nodeId)}`);
      const sessions = api.normalizeSessions(payload.sessions);
      state.sessions = sessions;
      if (!preserveEvents) {
        state.eventsBySession = new Map();
        state.eventPagesBySession = new Map();
      }
      state.apiAvailable = true;
    } catch {
      useSampleSessions(false);
    }
  }

  function useSampleSessions(apiAvailable) {
    state.sessions = runtime.samples.sessions.slice();
    state.eventsBySession = new Map(runtime.samples.eventsBySession);
    state.eventPagesBySession = new Map();
    state.apiAvailable = apiAvailable;
  }

  async function openSession(sessionID) {
    state.activeSessionId = sessionID;
    state.view = "thread";
    state.popover = "";
    state.threadWindows.delete(sessionID);
    if (!state.eventsBySession.has(sessionID)) state.eventsBySession.set(sessionID, []);
    renderer.render();
    await loadEvents(sessionID);
    subscribeSession(sessionID);
    renderer.render();
  }

  async function loadEvents(sessionID) {
    if (!state.apiAvailable) return;
    try {
      const qs = new URLSearchParams({ nodeId: state.nodeId, limit: String(EVENT_PAGE_SIZE) });
      const payload = await api.fetchJSON(`/api/sessions/${encodeURIComponent(sessionID)}/events?${qs.toString()}`);
      const events = api.normalizeEvents(payload.events);
      state.eventsBySession.set(sessionID, events);
      updateEventPage(sessionID, payload, events);
    } catch {
      if (!state.eventsBySession.has(sessionID)) {
        state.eventsBySession.set(sessionID, runtime.samples.eventsBySession.get("sample-thread") || []);
      }
    }
  }

  async function maybeLoadOlderEvents(scroll) {
    if (!state.apiAvailable || state.view !== "thread" || !state.activeSessionId) return;
    if (!scroll || scroll.scrollTop > LOAD_OLDER_EDGE_PX) return;
    const page = state.eventPagesBySession.get(state.activeSessionId);
    if (!page?.hasMoreBefore || page.loadingBefore) return;
    await loadOlderEvents(state.activeSessionId);
  }

  async function loadOlderEvents(sessionID) {
    const page = state.eventPagesBySession.get(sessionID);
    if (!page?.hasMoreBefore || page.loadingBefore) return;
    page.loadingBefore = true;
    state.eventPagesBySession.set(sessionID, page);
    renderPreservingThreadScroll();
    try {
      const beforeSeq = firstLoadedSeq(sessionID);
      if (!beforeSeq || beforeSeq <= 1) {
        state.eventPagesBySession.set(sessionID, { ...page, hasMoreBefore: false, loadingBefore: false });
        renderPreservingThreadScroll();
        return;
      }
      const qs = new URLSearchParams({
        nodeId: state.nodeId,
        beforeSeq: String(beforeSeq),
        limit: String(EVENT_PAGE_SIZE),
      });
      const payload = await api.fetchJSON(`/api/sessions/${encodeURIComponent(sessionID)}/events?${qs.toString()}`);
      const olderEvents = api.normalizeEvents(payload.events);
      const events = mergeSessionEvents(olderEvents, state.eventsBySession.get(sessionID) || []);
      state.eventsBySession.set(sessionID, events);
      updateEventPage(sessionID, payload, events);
      renderPreservingThreadScroll();
    } catch {
      state.eventPagesBySession.set(sessionID, { ...page, loadingBefore: false });
      renderPreservingThreadScroll();
    }
  }

  function updateEventPage(sessionID, payload, events) {
    const eventFirstSeq = firstSeqOf(events);
    const eventLastSeq = lastSeqOf(events);
    const firstSeq = Number(payload.firstSeq || eventFirstSeq || firstLoadedSeq(sessionID) || 0);
    const lastSeq = Math.max(Number(payload.lastSeq || 0), eventLastSeq, latestSeqForSession(sessionID));
    state.eventPagesBySession.set(sessionID, {
      firstSeq,
      lastSeq,
      hasMoreBefore: Boolean(payload.hasMoreBefore),
      loadingBefore: false,
      loaded: true,
    });
  }

  function subscribeNodeSessions() {
    if (state.nodeEventSource) {
      state.nodeEventSource.close();
      state.nodeEventSource = null;
    }
    if (!state.apiAvailable || !state.nodeId) return;
    const qs = new URLSearchParams({ nodeId: state.nodeId });
    const source = new EventSource(`/api/sessions/events?${qs.toString()}`);
    source.onmessage = (event) => {
      try {
        applyIncomingSessionEvent(api.normalizeEvent(JSON.parse(event.data)));
      } catch {
        // Keep the stream alive if one row is malformed.
      }
    };
    state.nodeEventSource = source;
  }

  function subscribeSession(sessionID) {
    if (state.eventSource) {
      state.eventSource.close();
      state.eventSource = null;
    }
    if (!state.apiAvailable) return;
    const qs = new URLSearchParams({ sessionId: sessionID, nodeId: state.nodeId });
    const lastSeq = latestSeqForSession(sessionID);
    if (lastSeq > 0) qs.set("lastSeq", String(lastSeq));
    const source = new EventSource(`/api/sessions/events?${qs.toString()}`);
    source.onmessage = (event) => {
      try {
        applyIncomingSessionEvent(api.normalizeEvent(JSON.parse(event.data)));
      } catch {
        // Keep the stream alive if one row is malformed.
      }
    };
    source.onerror = () => {
      source.close();
      if (state.eventSource === source) state.eventSource = null;
    };
    state.eventSource = source;
  }

function applyIncomingSessionEvent(incoming) {
  if (!incoming?.sessionId) return;
  const events = state.eventsBySession.get(incoming.sessionId) || [];
  if (hasSessionEvent(events, incoming)) return;
  events.push(incoming);
  events.sort(compareEvents);
  state.eventsBySession.set(incoming.sessionId, events);
  touchEventPage(incoming.sessionId, incoming);
  if (!updateSessionFromEvent(incoming)) scheduleSessionReload();
  if (state.view === "list" || state.activeSessionId === incoming.sessionId) requestRender();
}

function hasSessionEvent(events, incoming) {
  const seq = Number(incoming.seq || 0);
  if (seq > 0) return events.some((event) => Number(event.seq || 0) === seq);
  return events.some((event) =>
    event.kind === incoming.kind &&
    event.time === incoming.time &&
    event.text === incoming.text
  );
}

function latestSeqForSession(sessionID) {
  const events = state.eventsBySession.get(sessionID) || [];
  return events.reduce((latest, event) => Math.max(latest, Number(event.seq || 0)), 0);
}

function firstLoadedSeq(sessionID) {
  return firstSeqOf(state.eventsBySession.get(sessionID) || []);
}

function firstSeqOf(events) {
  return events.reduce((first, event) => {
    const seq = Number(event.seq || 0);
    if (!seq) return first;
    return first ? Math.min(first, seq) : seq;
  }, 0);
}

function lastSeqOf(events) {
  return events.reduce((last, event) => Math.max(last, Number(event.seq || 0)), 0);
}

function mergeSessionEvents(...groups) {
  const byKey = new Map();
  for (const events of groups) {
    for (const event of events || []) {
      byKey.set(sessionEventKey(event), event);
    }
  }
  return Array.from(byKey.values()).sort(compareEvents);
}

function sessionEventKey(event) {
  const seq = Number(event?.seq || 0);
  if (seq > 0) return `seq:${seq}`;
  return `event:${event?.kind || ""}:${event?.time || ""}:${event?.text || ""}`;
}

function compareEvents(a, b) {
  const aSeq = Number(a?.seq || 0);
  const bSeq = Number(b?.seq || 0);
  if (aSeq && bSeq && aSeq !== bSeq) return aSeq - bSeq;
  return String(a?.time || "").localeCompare(String(b?.time || ""));
}

function touchEventPage(sessionID, event) {
  const page = state.eventPagesBySession.get(sessionID);
  if (!page) return;
  const seq = Number(event?.seq || 0);
  if (!seq) return;
  state.eventPagesBySession.set(sessionID, {
    ...page,
    firstSeq: page.firstSeq ? Math.min(page.firstSeq, seq) : seq,
    lastSeq: Math.max(page.lastSeq || 0, seq),
  });
}

function requestRender() {
  if (renderFrame) return;
  renderFrame = global.requestAnimationFrame(() => {
    renderFrame = 0;
    renderer.render();
  });
}

function updateSessionFromEvent(event) {
  const index = state.sessions.findIndex((session) => session.id === event.sessionId);
  if (index < 0) return false;
  const session = state.sessions[index];
  const status = lifecycle.sessionStatusFromEvent(event, session.status);
  const updatedAt = event.time || session.updatedAt || new Date().toISOString();
  state.sessions[index] = {
    ...session,
    status,
    updatedAt,
    timeLabel: utils.relativeTime(updatedAt),
  };
  state.sessions.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return true;
}

function scheduleSessionReload() {
  if (sessionReloadTimer) return;
  sessionReloadTimer = global.setTimeout(async () => {
    sessionReloadTimer = 0;
    await loadSessions(true);
    renderer.render();
  }, 500);
}

function renderPreservingThreadScroll() {
  const snapshot = snapshotThreadScroll();
  renderer.render();
  restoreThreadScroll(snapshot);
}

function snapshotThreadScroll() {
  const scroll = mount.root.querySelector("[data-thread-scroll]");
  if (!scroll) return null;
  return {
    scrollTop: scroll.scrollTop,
    scrollHeight: scroll.scrollHeight,
  };
}

function restoreThreadScroll(snapshot) {
  if (!snapshot) return;
  global.requestAnimationFrame(() => {
    const scroll = mount.root.querySelector("[data-thread-scroll]");
    if (!scroll) return;
    const heightDelta = scroll.scrollHeight - snapshot.scrollHeight;
    scroll.scrollTop = Math.max(0, snapshot.scrollTop + heightDelta);
  });
}

function handleClick(event) {
  const popoverButton = event.target.closest("[data-popover]");
  const action = event.target.closest("[data-action]")?.dataset.action;
  const sessionRow = event.target.closest("[data-codex-session-id]");

  if (popoverButton) {
    const name = popoverButton.dataset.popover;
    state.popover = state.popover === name ? "" : name;
    state.modelMenuExpanded = false;
    renderer.render();
    return;
  }

  if (action === "back" || action === "new-chat") {
    state.view = "list";
    state.activeSessionId = "";
    state.popover = "";
    state.modelMenuExpanded = false;
    if (state.eventSource) state.eventSource.close();
    state.eventSource = null;
    renderer.render();
    return;
  }

  if (action === "send") {
    void submitComposer();
    return;
  }

  if (action === "toggle-model-submenu") {
    state.modelMenuExpanded = !state.modelMenuExpanded;
    renderer.render();
    return;
  }

  if (sessionRow && !event.target.closest("[data-codex-archive-button]")) {
    void openSession(sessionRow.dataset.codexSessionId);
    return;
  }

  if (state.popover && !event.target.closest("[data-codex-menu-wrapper], [data-composer-overlay]")) {
    state.popover = "";
    state.modelMenuExpanded = false;
    renderer.render();
  }
}

function handleInput(event) {
  if (event.target.matches("[data-codex-composer]")) renderer.syncComposerState();
}

function handleKeyDown(event) {
  const input = event.target.closest?.("[data-codex-composer]");
  if (!input || event.key !== "Enter") return;
  if (event.shiftKey || event.isComposing || event.keyCode === 229) return;
  event.preventDefault();
  void submitComposer();
}

function handleBeforeInput(event) {
  const input = event.target.closest?.("[data-codex-composer]");
  if (!input || !String(event.inputType || "").startsWith("delete")) return;
  if (renderer.composerText(input)) return;
  event.preventDefault();
  renderer.clearComposer(input);
  renderer.syncComposerState();
}

async function submitComposer() {
  const input = mount.root.querySelector("[data-codex-composer]");
  const prompt = renderer.composerText(input);
  if (!prompt) return;
  renderer.clearComposer(input);
  renderer.syncComposerState();

  if (state.view === "thread" && state.activeSessionId) {
    appendLocalEvent(state.activeSessionId, { kind: "user_message", text: prompt });
    renderer.render();
    if (state.apiAvailable) {
      try {
        const payload = await api.fetchJSON(`/api/sessions/${encodeURIComponent(state.activeSessionId)}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodeId: state.nodeId, prompt }),
        });
        upsertSession(api.normalizeSession(payload.session));
      } catch (error) {
        appendLocalEvent(state.activeSessionId, { kind: "error", text: error.message });
        renderer.render();
      }
    } else {
      appendLocalEvent(state.activeSessionId, { kind: "turn_started", text: "正在思考" });
      appendLocalEvent(state.activeSessionId, { kind: "assistant_message", text: "本地预览模式已收到这个请求。", time: new Date().toISOString() });
      renderer.render();
    }
    return;
  }

  if (state.apiAvailable) {
    try {
      const payload = await api.fetchJSON("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: state.nodeId, prompt }),
      });
      const session = api.normalizeSession(payload.session);
      if (session?.id) {
        upsertSession(session);
        state.eventsBySession.set(session.id, [{ sessionId: session.id, kind: "user_message", text: prompt, time: new Date().toISOString() }]);
        await openSession(session.id);
      }
    } catch (error) {
      createLocalSession(prompt, error.message);
    }
  } else {
    createLocalSession(prompt);
  }
}

function createLocalSession(prompt, errorText = "") {
  const id = `local-${Date.now()}`;
  const session = {
    id,
    title: utils.trimTitle(prompt),
    status: "idle",
    updatedAt: new Date().toISOString(),
    timeLabel: "刚刚",
  };
  state.sessions.unshift(session);
  state.eventsBySession.set(id, [
    { kind: "user_message", text: prompt, time: new Date().toISOString(), seq: 1 },
    errorText ? { kind: "error", text: errorText, time: new Date().toISOString(), seq: 2 } : { kind: "assistant_message", text: "本地样式预览会话已创建。", time: new Date().toISOString(), seq: 2 },
  ]);
  void openSession(id);
}

function upsertSession(session) {
  if (!session?.id) return;
  const index = state.sessions.findIndex((item) => item.id === session.id);
  if (index >= 0) {
    state.sessions[index] = { ...state.sessions[index], ...session };
  } else {
    state.sessions.unshift(session);
  }
  state.sessions.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function appendLocalEvent(sessionID, partial) {
  const events = state.eventsBySession.get(sessionID) || [];
  const event = { ...partial, sessionId: sessionID, seq: events.length + 1, time: partial.time || new Date().toISOString() };
  events.push(event);
  state.eventsBySession.set(sessionID, events);
  updateSessionFromEvent(event);
}

})(window);
