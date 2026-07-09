"use strict";

(function defineCodexPanelAPI(global) {
  const utils = global.CodexPanelUtils;
  if (!utils?.relativeTime) {
    throw new Error("CodexPanelUtils is required");
  }

async function fetchJSON(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.json();
    if (typeof body?.error !== "string" || !body.error) {
      throw new Error("error response must include error");
    }
    throw new Error(body.error);
  }
  return response.json();
}

function parseSessions(value) {
  const sessions = readArray(value, "sessions");
  return sessions.map(parseSession).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function parseSession(value) {
  const source = readObject(value, "session");
  const updatedAt = readString(source, "updatedAt", "session.updatedAt");
  return {
    id: readString(source, "id", "session.id"),
    title: readString(source, "title", "session.title"),
    cwd: readString(source, "cwd", "session.cwd"),
    status: readString(source, "status", "session.status"),
    updatedAt,
    timeLabel: utils.relativeTime(updatedAt),
  };
}

function parseSessionState(value) {
  const source = readObject(value, "session state");
  return {
    session: parseSession(readRequired(source, "session", "state.session")),
    turns: readArray(readRequired(source, "turns", "state.turns"), "state.turns").map(parseTurn),
    lastSeq: readNumber(source, "lastSeq", "state.lastSeq"),
  };
}

function parseTurn(value) {
  const source = readObject(value, "turn");
  const turn = {
    id: readString(source, "id", "turn.id"),
    status: readString(source, "status", "turn.status"),
    items: readArray(readRequired(source, "items", "turn.items"), "turn.items").map(parseStateItem),
  };
  copyOptionalString(source, turn, "startedAt", "turn.startedAt");
  copyOptionalString(source, turn, "completedAt", "turn.completedAt");
  copyOptionalNumber(source, turn, "durationMs", "turn.durationMs");
  copyOptionalObject(source, turn, "error", "turn.error");
  return turn;
}

function parseStateItem(value) {
  const source = readObject(value, "item");
  const item = {
    id: readString(source, "id", "item.id"),
    type: readString(source, "type", "item.type"),
  };
  copyOptionalString(source, item, "status", "item.status");
  copyOptionalString(source, item, "time", "item.time");
  copyOptionalString(source, item, "text", "item.text");
  copyOptionalString(source, item, "output", "item.output");
  copyOptionalString(source, item, "command", "item.command");
  copyOptionalString(source, item, "cwd", "item.cwd");
  copyOptionalString(source, item, "phase", "item.phase");
  copyOptionalString(source, item, "server", "item.server");
  copyOptionalString(source, item, "tool", "item.tool");
  copyOptionalString(source, item, "name", "item.name");
  if (hasOwn(source, "items")) {
    item.items = readArray(source.items, "item.items").map(parseStateItemDetail);
  }
  return item;
}

function parseStateItemDetail(value) {
  const source = readObject(value, "item detail");
  const item = {};
  copyOptionalString(source, item, "text", "item detail.text");
  copyOptionalString(source, item, "path", "item detail.path");
  copyOptionalString(source, item, "kind", "item detail.kind");
  copyOptionalString(source, item, "additions", "item detail.additions");
  copyOptionalString(source, item, "deletions", "item detail.deletions");
  if (!hasOwn(item, "path") && !hasOwn(item, "text")) {
    throw new Error("item detail.path or item detail.text is required");
  }
  return item;
}

function parseStateUpdate(value) {
  const source = readObject(value, "state update");
  const update = {
    sessionId: readString(source, "sessionId", "update.sessionId"),
    seq: readNumber(source, "seq", "update.seq"),
    time: readString(source, "time", "update.time"),
    type: readString(source, "type", "update.type"),
  };
  if (hasOwn(source, "session")) update.session = parseSession(source.session);
  if (hasOwn(source, "state")) update.state = parseSessionState(source.state);
  if (hasOwn(source, "turn")) update.turn = parseTurn(source.turn);
  if (hasOwn(source, "item")) update.item = parseStateItem(source.item);
  if (hasOwn(source, "error")) update.error = readString(source, "error", "update.error");
  return update;
}

function readObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function readArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value;
}

function readRequired(source, field, label) {
  if (!hasOwn(source, field)) {
    throw new Error(`${label} is required`);
  }
  return source[field];
}

function readString(source, field, label) {
  const value = readRequired(source, field, label);
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  return value;
}

function readNumber(source, field, label) {
  const value = readRequired(source, field, label);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
}

function copyOptionalString(source, target, field, label) {
  if (hasOwn(source, field)) {
    target[field] = readString(source, field, label);
  }
}

function copyOptionalNumber(source, target, field, label) {
  if (hasOwn(source, field)) {
    target[field] = readNumber(source, field, label);
  }
}

function copyOptionalObject(source, target, field, label) {
  if (hasOwn(source, field)) {
    target[field] = readObject(source[field], label);
  }
}

function hasOwn(value, field) {
  return Boolean(value && Object.prototype.hasOwnProperty.call(value, field));
}

  global.CodexPanelAPI = {
    fetchJSON,
    parseSessions,
    parseSession,
    parseSessionState,
    parseTurn,
    parseStateItem,
    parseStateItemDetail,
    parseStateUpdate,
  };
})(window);
