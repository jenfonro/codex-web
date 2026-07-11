"use strict";

(function defineCodexPanelUtils(global) {
function activityLabel(ref) {
  switch (ref.item.type) {
    case "reasoning":
      return ref.item.summary.join("\n");
    case "commandExecution":
      return "exec_command";
    case "mcpToolCall":
    case "dynamicToolCall":
      return ref.item.tool;
    case "webSearch":
      return ref.item.query;
    case "imageView":
      return ref.item.path;
  }
  throw new Error(`Unhandled activity item type: ${ref.item.type}`);
}

function activityIcon(ref) {
  switch (ref.item.type) {
    case "reasoning":
      return "";
    case "commandExecution":
    case "mcpToolCall":
    case "dynamicToolCall":
    case "webSearch":
    case "imageView":
      return "editFile";
  }
  throw new Error(`Unhandled activity item type: ${ref.item.type}`);
}

function timeFromTurn(turn) {
  return new Date(turn.startedAt * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function relativeTime(value) {
  const date = new Date(value * 1000);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "刚刚";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时`;
  return `${Math.floor(hours / 24)} 天`;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[char]);
}

function escapeAttr(value) {
  return escapeHTML(value);
}

  global.CodexPanelUtils = {
    activityLabel,
    activityIcon,
    timeFromTurn,
    relativeTime,
    escapeHTML,
    escapeAttr,
  };
})(window);
