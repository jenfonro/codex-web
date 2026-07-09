"use strict";

(function bootstrapCodexPanel(global) {
  const icons = global.CodexIcons;
  const config = global.CodexPanelConfig;
  const api = global.CodexPanelAPI;
  const lifecycle = global.CodexPanelLifecycle;
  const store = global.CodexPanelStore;
  const rendererFactory = global.CodexPanelRenderer;
  const panel = document.getElementById("codexPanel");
  if (!panel || !icons || !config || !api || !lifecycle || !store || !rendererFactory) return;

  const mount = config.createPanelMount(panel);

  const state = store.createCodexPanelState();

  const runtime = {
    icons,
    config,
    state,
    mount,
  };
  const renderer = rendererFactory.create(runtime);
  let initialized = false;
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
    await loadSessions();
    subscribeSessionList();
    renderer.render();
  }

  async function loadSessions(preserveEvents = false) {
    const payload = await api.fetchJSON("/api/sessions");
    const sessions = api.parseSessions(payload.sessions);
    state.sessions = sessions;
    if (!preserveEvents) {
      state.statesBySession = new Map();
      state.appliedSeqBySession = new Map();
    }
    state.apiAvailable = true;
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
    const payload = await api.fetchJSON(`/api/sessions/${encodeURIComponent(sessionID)}/state`);
    applySessionState(api.parseSessionState(payload));
  }

  function subscribeSessionList() {
    if (state.sessionEventSource) {
      state.sessionEventSource.close();
      state.sessionEventSource = null;
    }
    if (!state.apiAvailable) return;
    const source = new EventSource("/api/sessions/state-events");
    source.onmessage = (event) => {
      applyStateUpdate(api.parseStateUpdate(JSON.parse(event.data)));
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
      applyStateUpdate(api.parseStateUpdate(JSON.parse(event.data)));
    };
    source.onerror = () => {
      source.close();
      if (state.eventSource === source) state.eventSource = null;
    };
    state.eventSource = source;
  }

function applyStateUpdate(update) {
  if (!update?.sessionId) throw new Error("update.sessionId is required");
  if (isDuplicateStateUpdate(update)) return;
  if (update.state) {
    applySessionState(update.state);
  } else {
    if (update.session) upsertSession(update.session);
    if (update.item) {
      applyItemUpdate(update.sessionId, update.turn, update.item, update.seq);
    } else if (update.turn) {
      applyTurnUpdate(update.sessionId, update.turn, update.seq);
    }
    if (update.error) {
      applyErrorUpdate(update.sessionId, update.error, update.seq);
    }
  }
  markStateUpdateApplied(update.sessionId, update.seq);
  renderStateUpdate(update);
}

function applySessionState(sessionState) {
  if (!sessionState?.session?.id) throw new Error("state.session.id is required");
  const incomingSeq = Number(sessionState.lastSeq);
  const appliedSeq = Number(state.appliedSeqBySession.get(sessionState.session.id) || 0);
  if (incomingSeq > 0 && incomingSeq < appliedSeq) return;
  state.statesBySession.set(sessionState.session.id, sessionState);
  markStateUpdateApplied(sessionState.session.id, incomingSeq);
  upsertSession(sessionState.session);
}

function applyTurnUpdate(sessionID, turn, seq) {
  if (!turn?.id) throw new Error("turn.id is required");
  const sessionState = ensureSessionState(sessionID, seq);
  const index = sessionState.turns.findIndex((item) => item.id === turn.id);
  if (index >= 0) {
    sessionState.turns[index] = mergeTurn(sessionState.turns[index], turn);
  } else {
    sessionState.turns.push(turn);
  }
  sessionState.lastSeq = Math.max(Number(sessionState.lastSeq), Number(seq));
  state.statesBySession.set(sessionID, sessionState);
}

function applyItemUpdate(sessionID, turn, item, seq) {
  if (!item?.id) throw new Error("item.id is required");
  if (!turn?.id) throw new Error("turn.id is required");
  const sessionState = ensureSessionState(sessionID, seq);
  const turnId = turn.id;
  let turnIndex = sessionState.turns.findIndex((entry) => entry.id === turnId);
  if (turnIndex < 0) {
    sessionState.turns.push(turn);
    turnIndex = sessionState.turns.length - 1;
  } else {
    sessionState.turns[turnIndex] = mergeTurnMetadata(sessionState.turns[turnIndex], turn);
  }
  const items = sessionState.turns[turnIndex].items;
  const itemIndex = items.findIndex((entry) => entry.id === item.id);
  if (itemIndex >= 0) {
    items[itemIndex] = mergeStateItem(items[itemIndex], item);
  } else {
    items.push(item);
  }
  sessionState.turns[turnIndex].items = items;
  sessionState.lastSeq = Math.max(Number(sessionState.lastSeq), Number(seq));
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
  const session = state.sessions.find((item) => item.id === sessionID);
  if (!session) throw new Error("session state is required before applying updates");
  const sessionState = { session, turns: [], lastSeq: Number(seq) };
  state.statesBySession.set(sessionID, sessionState);
  return sessionState;
}

function mergeTurn(existing, incoming) {
  const merged = { ...existing, ...incoming };
  const existingItems = existing.items;
  const incomingItems = incoming.items;
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

function mergeTurnMetadata(existing, incoming) {
  return { ...existing, ...incoming, items: existing.items };
}

function mergeStateItem(existing, incoming) {
  return {
    ...existing,
    ...incoming,
    text: mergePresentField(existing?.text, incoming, "text"),
    output: mergePresentField(existing?.output, incoming, "output"),
    items: hasOwn(incoming, "items") ? incoming.items : existing.items,
  };
}

function mergePresentField(existingValue, incoming, field) {
  if (!hasOwn(incoming, field)) return existingValue;
  return incoming[field];
}

function hasOwn(value, field) {
  return Boolean(value && Object.prototype.hasOwnProperty.call(value, field));
}

function latestStateSeqForSession(sessionID) {
  return Number(state.statesBySession.get(sessionID)?.lastSeq || 0);
}

function isDuplicateStateUpdate(update) {
  const seq = Number(update?.seq);
  if (!update?.sessionId || seq <= 0) throw new Error("update.seq must be positive");
  return seq <= Number(state.appliedSeqBySession.get(update.sessionId) || 0);
}

function markStateUpdateApplied(sessionID, seq) {
  const nextSeq = Number(seq);
  if (!sessionID || nextSeq <= 0) throw new Error("state update sequence is required");
  state.appliedSeqBySession.set(sessionID, Math.max(Number(state.appliedSeqBySession.get(sessionID) || 0), nextSeq));
}

function renderStateUpdate(update) {
  if (state.view !== "list" && state.activeSessionId !== update.sessionId) return;
  requestRender();
}

function requestRender() {
  if (renderFrame) return;
  renderFrame = global.requestAnimationFrame(() => {
    renderFrame = 0;
    renderer.render();
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
  if (!input || !String(event.inputType).startsWith("delete")) return;
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
    try {
      const payload = await api.fetchJSON(`/api/sessions/${encodeURIComponent(state.activeSessionId)}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      upsertSession(api.parseSession(payload.session));
      await loadState(state.activeSessionId);
    } catch (error) {
      applyErrorUpdate(state.activeSessionId, error.message);
      renderer.render();
    }
    return;
  }

  try {
    const payload = await api.fetchJSON("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const session = api.parseSession(payload.session);
    if (session?.id) {
      upsertSession(session);
      state.statesBySession.set(session.id, { session, turns: [], lastSeq: 0 });
      await openSession(session.id);
    }
  } catch (error) {
    throw error;
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

function upsertSession(session) {
  if (!session?.id) throw new Error("session.id is required");
  const index = state.sessions.findIndex((item) => item.id === session.id);
  if (index >= 0) {
    state.sessions[index] = { ...state.sessions[index], ...session };
  } else {
    state.sessions.unshift(session);
  }
  state.sessions.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function isActiveSessionRunning() {
  const session = state.sessions.find((item) => item.id === state.activeSessionId);
  if (!session) return false;
  return String(session.status).toLowerCase() === "running";
}

})(window);
