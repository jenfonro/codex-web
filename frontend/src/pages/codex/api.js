"use strict";

(function defineCodexPanelAPI(global) {
  const utils = global.CodexPanelUtils;

async function fetchJSON(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      message = body.error || message;
    } catch {
      // Keep response status message.
    }
    throw new Error(message);
  }
  return response.json();
}

function normalizeSessions(value) {
  return Array.isArray(value)
    ? value.map(normalizeSession).filter(Boolean).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    : [];
}

function normalizeSession(value) {
  if (!value || typeof value !== "object") return null;
  const updatedAt = value.updatedAt || value.createdAt || new Date().toISOString();
  return {
    id: String(value.id || ""),
    title: String(value.title || "New session"),
    status: String(value.status || "idle"),
    updatedAt,
    timeLabel: utils.relativeTime(updatedAt),
  };
}

function normalizeEvents(value) {
  return Array.isArray(value) ? value.map(normalizeEvent).filter(Boolean) : [];
}

function normalizeEvent(value) {
  if (!value || typeof value !== "object") return null;
  return {
    sessionId: value.sessionId || "",
    seq: value.seq || 0,
    time: value.time || new Date().toISOString(),
    kind: value.kind || "assistant_message",
    text: value.text || "",
    items: value.items || null,
    data: value.data || null,
  };
}

function normalizeSessionState(value) {
  if (!value || typeof value !== "object") return null;
  const session = normalizeSession(value.session || {});
  if (!session?.id) return null;
  return {
    session,
    turns: Array.isArray(value.turns)
      ? value.turns.map(normalizeTurn).filter(Boolean)
      : [],
    lastSeq: Number(value.lastSeq || session.lastSeq || 0),
  };
}

function normalizeTurn(value) {
  if (!value || typeof value !== "object") return null;
  return {
    id: String(value.id || ""),
    status: String(value.status || ""),
    startedAt: value.startedAt || "",
    completedAt: value.completedAt || "",
    durationMs: value.durationMs ?? null,
    error: value.error || null,
    items: Array.isArray(value.items)
      ? value.items.map(normalizeStateItem).filter(Boolean)
      : [],
  };
}

function normalizeStateItem(value) {
  if (!value || typeof value !== "object") return null;
  return {
    id: String(value.id || ""),
    type: String(value.type || ""),
    status: String(value.status || ""),
    time: value.time || "",
    text: value.text ?? "",
    output: value.output ?? "",
    command: value.command || "",
    cwd: value.cwd || "",
    phase: value.phase || "",
    server: value.server || "",
    tool: value.tool || "",
    name: value.name || "",
    items: Array.isArray(value.items) ? value.items : null,
  };
}

function normalizeStateUpdate(value) {
  if (!value || typeof value !== "object") return null;
  return {
    sessionId: String(value.sessionId || ""),
    seq: Number(value.seq || 0),
    time: value.time || new Date().toISOString(),
    type: String(value.type || ""),
    session: value.session ? normalizeSession(value.session) : null,
    state: value.state ? normalizeSessionState(value.state) : null,
    turn: value.turn ? normalizeTurn(value.turn) : null,
    item: value.item ? normalizeStateItem(value.item) : null,
    error: String(value.error || ""),
  };
}



  global.CodexPanelAPI = {
    fetchJSON,
    normalizeSessions,
    normalizeSession,
    normalizeEvents,
    normalizeEvent,
    normalizeSessionState,
    normalizeTurn,
    normalizeStateItem,
    normalizeStateUpdate,
  };
})(window);
