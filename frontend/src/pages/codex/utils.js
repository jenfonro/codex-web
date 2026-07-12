"use strict";

(function defineCodexPanelUtils(global) {
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

function threadTitle(thread) {
  return thread.name === null ? thread.preview : thread.name;
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
    timeFromTurn,
    relativeTime,
    threadTitle,
    escapeHTML,
    escapeAttr,
  };
})(window);
