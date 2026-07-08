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



  global.CodexPanelAPI = {
    fetchJSON,
    normalizeSessions,
    normalizeSession,
    normalizeEvents,
    normalizeEvent,
  };
})(window);
