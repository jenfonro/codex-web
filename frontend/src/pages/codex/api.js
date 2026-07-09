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
  const updatedAt = value.updatedAt || value.UpdatedAt || value.createdAt || value.CreatedAt || new Date().toISOString();
  return {
    id: String(value.id || value.ID || ""),
    title: String(value.title || value.Title || "New session"),
    status: String(value.status || value.Status || "idle"),
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
    sessionId: value.sessionId || value.SessionID || value.sessionID || "",
    seq: value.seq || value.Seq || 0,
    time: value.time || value.Time || new Date().toISOString(),
    kind: value.kind || value.Kind || "assistant_message",
    text: value.text || value.Text || "",
    items: value.items || value.Items || null,
    data: value.data || value.Data || null,
  };
}

function normalizeSessionState(value) {
  if (!value || typeof value !== "object") return null;
  const session = normalizeSession(value.session || value.Session || {});
  if (!session?.id) return null;
  return {
    session,
    turns: Array.isArray(value.turns || value.Turns)
      ? (value.turns || value.Turns).map(normalizeTurn).filter(Boolean)
      : [],
    lastSeq: Number(value.lastSeq || value.LastSeq || session.lastSeq || 0),
  };
}

function normalizeTurn(value) {
  if (!value || typeof value !== "object") return null;
  return {
    id: String(value.id || value.ID || ""),
    status: String(value.status || value.Status || ""),
    startedAt: value.startedAt || value.StartedAt || "",
    completedAt: value.completedAt || value.CompletedAt || "",
    durationMs: value.durationMs ?? value.DurationMs ?? null,
    error: value.error || value.Error || null,
    outcome: normalizeTurnOutcome(value.outcome || value.Outcome),
    items: Array.isArray(value.items || value.Items)
      ? (value.items || value.Items).map(normalizeStateItem).filter(Boolean)
      : [],
  };
}

function normalizeTurnOutcome(value) {
  if (!value || typeof value !== "object") return null;
  return {
    type: String(value.type || value.Type || ""),
    text: String(value.text || value.Text || ""),
    status: String(value.status || value.Status || ""),
    raw: value.raw || value.Raw || null,
  };
}

function normalizeStateItem(value) {
  if (!value || typeof value !== "object") return null;
  return {
    id: String(value.id || value.ID || ""),
    type: String(value.type || value.Type || ""),
    status: String(value.status || value.Status || ""),
    time: value.time || value.Time || "",
    text: value.text ?? value.Text ?? "",
    output: value.output ?? value.Output ?? "",
    command: value.command || value.Command || "",
    cwd: value.cwd || value.CWD || "",
    phase: value.phase || value.Phase || "",
    server: value.server || value.Server || "",
    tool: value.tool || value.Tool || "",
    name: value.name || value.Name || "",
    items: Array.isArray(value.items || value.Items) ? (value.items || value.Items) : null,
    raw: value.raw || value.Raw || null,
  };
}

function normalizeStateUpdate(value) {
  if (!value || typeof value !== "object") return null;
  return {
    sessionId: String(value.sessionId || value.SessionID || ""),
    seq: Number(value.seq || value.Seq || 0),
    time: value.time || value.Time || new Date().toISOString(),
    type: String(value.type || value.Type || ""),
    session: value.session || value.Session ? normalizeSession(value.session || value.Session) : null,
    state: value.state || value.State ? normalizeSessionState(value.state || value.State) : null,
    turn: value.turn || value.Turn ? normalizeTurn(value.turn || value.Turn) : null,
    item: value.item || value.Item ? normalizeStateItem(value.item || value.Item) : null,
    error: String(value.error || value.Error || ""),
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
