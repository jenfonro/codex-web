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

function normalizeNodes(value) {
  return Array.isArray(value)
    ? value.map(normalizeNode).filter(Boolean).sort(compareNodes)
    : [];
}

function normalizeNode(value) {
  if (!value || typeof value !== "object") return null;
  const id = String(value.id || value.ID || "");
  if (!id) return null;
  return {
    id,
    name: String(value.name || value.Name || id),
    kind: String(value.kind || value.Kind || "remote"),
    online: Boolean(value.online ?? value.Online),
    rootDir: String(value.rootDir || value.RootDir || ""),
    codexHome: String(value.codexHome || value.CodexHome || ""),
    hostname: String(value.hostname || value.Hostname || ""),
    version: String(value.version || value.Version || ""),
    lastSeen: value.lastSeen || value.LastSeen || "",
  };
}

function compareNodes(a, b) {
  if (a.online !== b.online) return a.online ? -1 : 1;
  return String(a.name || a.id).localeCompare(String(b.name || b.id));
}

function normalizeSession(value) {
  if (!value || typeof value !== "object") return null;
  const updatedAt = value.updatedAt || value.UpdatedAt || value.createdAt || value.CreatedAt || new Date().toISOString();
  const lastSeq = Number(value.lastSeq || value.LastSeq || 0) || 0;
  return {
    id: String(value.id || value.ID || ""),
    codexThreadId: String(value.codexThreadId || value.CodexThreadID || ""),
    title: String(value.title || value.Title || "New session"),
    cwd: String(value.cwd || value.CWD || ""),
    status: String(value.status || value.Status || "idle"),
    updatedAt,
    lastSeq,
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
    inline: Boolean(value.inline ?? value.Inline ?? value.data?.inline ?? value.Data?.inline),
    items: value.items || value.Items || null,
    data: value.data || value.Data || null,
  };
}



  global.CodexPanelAPI = {
    fetchJSON,
    normalizeNodes,
    normalizeSessions,
    normalizeSession,
    normalizeEvents,
    normalizeEvent,
  };
})(window);
