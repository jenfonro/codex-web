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
    await loadSessions();
    subscribeSessionList();
    renderer.render();
  }

  async function loadSessions(preserveEvents = false) {
    try {
      const payload = await api.fetchJSON("/api/sessions");
      const sessions = api.normalizeSessions(payload.sessions);
    state.sessions = sessions;
      if (!preserveEvents) {
        state.statesBySession = new Map();
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
    state.statesBySession = new Map();
    state.eventsBySession = new Map(runtime.samples.eventsBySession);
    state.eventPagesBySession = new Map();
    state.apiAvailable = apiAvailable;
  }

  async function openSession(sessionID) {
    state.activeSessionId = sessionID;
    state.view = "thread";
    state.popover = "";
    renderer.render();
    await loadState(sessionID);
    subscribeSession(sessionID);
    renderer.render();
  }

  async function loadState(sessionID) {
    if (!state.apiAvailable) return;
    try {
      const payload = await api.fetchJSON(`/api/sessions/${encodeURIComponent(sessionID)}/state`);
      applySessionState(api.normalizeSessionState(payload));
    } catch {
      // Keep the existing view; a later SSE reconnect or session reload may recover.
    }
  }

  function subscribeSessionList() {
    if (state.sessionEventSource) {
      state.sessionEventSource.close();
      state.sessionEventSource = null;
    }
    if (!state.apiAvailable) return;
    const source = new EventSource("/api/sessions/state-events");
    source.onmessage = (event) => {
      try {
        applyStateUpdate(api.normalizeStateUpdate(JSON.parse(event.data)));
      } catch {
        // Keep the stream alive if one row is malformed.
      }
    };
    state.sessionEventSource = source;
  }

  function subscribeSession(sessionID) {
    if (state.eventSource) {
      state.eventSource.close();
      state.eventSource = null;
    }
    if (!state.apiAvailable) return;
    const qs = new URLSearchParams({ sessionId: sessionID });
    const lastSeq = latestStateSeqForSession(sessionID);
    if (lastSeq > 0) qs.set("lastSeq", String(lastSeq));
    const source = new EventSource(`/api/sessions/state-events?${qs.toString()}`);
    source.onmessage = (event) => {
      try {
        applyStateUpdate(api.normalizeStateUpdate(JSON.parse(event.data)));
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

function applyStateUpdate(update) {
  if (!update?.sessionId) return;
  if (update.state) {
    applySessionState(update.state);
  } else {
    if (update.session) upsertSession(update.session);
    if (update.turn) applyTurnUpdate(update.sessionId, update.turn, update.seq);
    if (update.item) applyItemUpdate(update.sessionId, update.turn, update.item, update.seq);
    if (update.error) applyErrorUpdate(update.sessionId, update.error, update.seq);
  }
  if (state.view === "list" || state.activeSessionId === update.sessionId) requestRender();
}

function applySessionState(sessionState) {
  if (!sessionState?.session?.id) return;
  state.statesBySession.set(sessionState.session.id, sessionState);
  upsertSession(sessionState.session);
}

function applyTurnUpdate(sessionID, turn, seq) {
  if (!turn?.id) return;
  const sessionState = ensureSessionState(sessionID, seq);
  const index = sessionState.turns.findIndex((item) => item.id === turn.id);
  if (index >= 0) {
    sessionState.turns[index] = mergeTurn(sessionState.turns[index], turn);
  } else {
    sessionState.turns.push(turn);
  }
  sessionState.lastSeq = Math.max(sessionState.lastSeq || 0, Number(seq || 0));
  state.statesBySession.set(sessionID, sessionState);
}

function applyItemUpdate(sessionID, turn, item, seq) {
  if (!item?.id) return;
  const sessionState = ensureSessionState(sessionID, seq);
  const turnID = turn?.id || sessionState.turns[sessionState.turns.length - 1]?.id || `turn-${seq || Date.now()}`;
  let turnIndex = sessionState.turns.findIndex((entry) => entry.id === turnID);
  if (turnIndex < 0) {
    sessionState.turns.push(turn || { id: turnID, status: "running", items: [] });
    turnIndex = sessionState.turns.length - 1;
  } else if (turn) {
    sessionState.turns[turnIndex] = mergeTurn(sessionState.turns[turnIndex], turn);
  }
  const items = sessionState.turns[turnIndex].items || [];
  const itemIndex = items.findIndex((entry) => entry.id === item.id);
  if (itemIndex >= 0) {
    items[itemIndex] = mergeStateItem(items[itemIndex], item);
  } else {
    items.push(item);
  }
  sessionState.turns[turnIndex].items = items;
  sessionState.lastSeq = Math.max(sessionState.lastSeq || 0, Number(seq || 0));
  state.statesBySession.set(sessionID, sessionState);
}

function applyErrorUpdate(sessionID, message, seq) {
  const sessionState = ensureSessionState(sessionID, seq);
  sessionState.session.status = "error";
  sessionState.session.updatedAt = new Date().toISOString();
  state.statesBySession.set(sessionID, sessionState);
  upsertSession(sessionState.session);
}

function ensureSessionState(sessionID, seq) {
  const existing = state.statesBySession.get(sessionID);
  if (existing) return existing;
  const session = state.sessions.find((item) => item.id === sessionID) || {
    id: sessionID,
    title: "New session",
    status: "idle",
    updatedAt: new Date().toISOString(),
    timeLabel: "刚刚",
  };
  const sessionState = { session, turns: [], lastSeq: Number(seq || 0) };
  state.statesBySession.set(sessionID, sessionState);
  return sessionState;
}

function mergeTurn(existing, incoming) {
  const merged = { ...existing, ...incoming };
  const existingItems = Array.isArray(existing?.items) ? existing.items : [];
  const incomingItems = Array.isArray(incoming?.items) ? incoming.items : [];
  if (!incomingItems.length) {
    merged.items = existingItems;
    return merged;
  }
  const items = existingItems.slice();
  for (const item of incomingItems) {
    const index = items.findIndex((entry) => entry.id === item.id);
    if (index >= 0) items[index] = mergeStateItem(items[index], item);
    else items.push(item);
  }
  merged.items = items;
  return merged;
}

function mergeStateItem(existing, incoming) {
  return {
    ...existing,
    ...incoming,
    text: incoming.text !== "" ? incoming.text : existing.text,
    output: incoming.output !== "" ? incoming.output : existing.output,
    raw: { ...(existing.raw || {}), ...(incoming.raw || {}) },
    items: incoming.items || existing.items || null,
  };
}

function latestStateSeqForSession(sessionID) {
  return Number(state.statesBySession.get(sessionID)?.lastSeq || 0);
}

function requestRender() {
  if (renderFrame) return;
  renderFrame = global.requestAnimationFrame(() => {
    renderFrame = 0;
    renderer.render();
  });
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

  if (action === "cancel") {
    void cancelActiveSession();
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
  if (isActiveSessionRunning()) return;
  const input = mount.root.querySelector("[data-codex-composer]");
  const prompt = renderer.composerText(input);
  if (!prompt) return;
  renderer.clearComposer(input);
  renderer.syncComposerState();

  if (state.view === "thread" && state.activeSessionId) {
    if (state.apiAvailable) {
      try {
        const payload = await api.fetchJSON(`/api/sessions/${encodeURIComponent(state.activeSessionId)}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        upsertSession(api.normalizeSession(payload.session));
        await loadState(state.activeSessionId);
      } catch (error) {
        applyErrorUpdate(state.activeSessionId, error.message);
        renderer.render();
      }
    } else {
      appendLocalEvent(state.activeSessionId, { kind: "user_message", text: prompt });
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
        body: JSON.stringify({ prompt }),
      });
      const session = api.normalizeSession(payload.session);
      if (session?.id) {
        upsertSession(session);
        state.statesBySession.set(session.id, { session, turns: [], lastSeq: 0 });
        await openSession(session.id);
      }
    } catch (error) {
      createLocalSession(prompt, error.message);
    }
  } else {
    createLocalSession(prompt);
  }
}

async function cancelActiveSession() {
  const sessionID = state.activeSessionId;
  if (!sessionID || !state.apiAvailable) return;
  try {
    await api.fetchJSON(`/api/sessions/${encodeURIComponent(sessionID)}/cancel`, {
      method: "POST",
    });
    await loadState(sessionID);
    await loadSessions(true);
  } catch (error) {
    applyErrorUpdate(sessionID, error.message);
  }
  renderer.render();
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
  const index = state.sessions.findIndex((session) => session.id === sessionID);
  if (index >= 0) {
    const updatedAt = event.time || new Date().toISOString();
    state.sessions[index] = {
      ...state.sessions[index],
      status: event.kind === "error" ? "error" : state.sessions[index].status,
      updatedAt,
      timeLabel: utils.relativeTime(updatedAt),
    };
  }
}

function isActiveSessionRunning() {
  const session = state.sessions.find((item) => item.id === state.activeSessionId);
  return String(session?.status || "").toLowerCase() === "running";
}

})(window);
