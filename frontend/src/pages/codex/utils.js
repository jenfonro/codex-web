"use strict";

(function defineCodexPanelUtils(global) {
function activityLabel(event) {
  switch (event.kind) {
    case "turn_started":
    case "reasoning":
      return event.text || "正在思考";
    case "tool_call":
      return summarizeToolActivity(event.text || "正在编辑文件");
    case "stdout":
      return event.text || "已运行命令";
    case "stderr":
      return event.text || "命令输出";
    default:
      return event.text || "正在思考";
  }
}

function activityIcon(event) {
  if (event.kind === "tool_call") return "editFile";
  return "";
}

function summarizeToolActivity(text) {
  const value = String(text || "");
  if (/创建/.test(value)) return "已创建 1 个文件";
  if (/编辑|修改|写入/.test(value)) return "已编辑 1 个文件";
  return value || "已编辑 1 个文件";
}

function assistantTextFromData(data) {
  if (!data || typeof data !== "object") return "";
  const item = data.item;
  if (item && typeof item === "object") return String(item.text || item.message || "");
  return String(data.text || data.message || "");
}

function formatPlainMessageText(text) {
  return escapeHTML(String(text || ""));
}

function formatUserText(text) {
  return `<span>${escapeHTML(String(text || ""))}</span>`;
}

function timeFromEvent(event) {
  const date = event.time ? new Date(event.time) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function relativeTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "刚刚";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时`;
  return `${Math.floor(hours / 24)} 天`;
}

function trimTitle(text) {
  const value = text.replace(/\s+/g, " ").trim();
  return value.length > 70 ? `${value.slice(0, 68)}…` : value || "New session";
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
    summarizeToolActivity,
    assistantTextFromData,
    formatPlainMessageText,
    formatUserText,
    timeFromEvent,
    relativeTime,
    trimTitle,
    escapeHTML,
    escapeAttr,
  };
})(window);
