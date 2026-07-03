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

function isActivityPending(event) {
  const status = String(event.status || event.data?.status || "").toLowerCase();
  if (["pending", "running", "active", "starting"].includes(status)) return true;
  return event.kind === "turn_started" || event.kind === "reasoning";
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

function formatText(text) {
  const value = String(text || "");
  if (!value) return "";
  const chunks = [];
  const pattern = /```(?:[a-zA-Z0-9_-]+)?\n?([\s\S]*?)```/g;
  let cursor = 0;
  let match;
  while ((match = pattern.exec(value))) {
    if (match.index > cursor) chunks.push(formatTextBlock(value.slice(cursor, match.index)));
    chunks.push(`<pre class="_markdownText_lzkx4_86">${escapeHTML(match[1].trim())}</pre>`);
    cursor = match.index + match[0].length;
  }
  if (cursor < value.length) chunks.push(formatTextBlock(value.slice(cursor)));
  return chunks.join("");
}

function formatTextBlock(text) {
  return String(text || "")
    .split(/\n{2,}/)
    .map((group) => group.trim())
    .filter(Boolean)
    .map((group) => {
      const lines = group.split("\n").map((line) => line.trim()).filter(Boolean);
      if (lines.length && lines.every((line) => /^[-*]\s+/.test(line))) {
        return `<ul class="_markdownText_lzkx4_86 _list_lzkx4_133 _unorderedList_lzkx4_147">${lines.map((line) => `<li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">${formatInlineText(line.replace(/^[-*]\s+/, ""))}</li>`).join("")}</ul>`;
      }
      return `<p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">${lines.map(formatInlineText).join("<br>")}</p>`;
    })
    .join("");
}

function formatInlineText(text) {
  return String(text || "").split(/(`[^`]+`)/g).map((part) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      return `<span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">${escapeHTML(part.slice(1, -1))}</span>`;
    }
    return escapeHTML(part);
  }).join("");
}

function formatUserText(text) {
  return `<span>${escapeHTML(String(text || ""))}</span>`;
}

function formatInlineCodeText(text) {
  const value = String(text || "");
  if (!value) return "";
  const commandPattern = /((?:node|go|git|systemctl|\.\/build-all\.sh|GET)\s[^,\n。]*)/g;
  let cursor = 0;
  const pieces = [];
  let match;
  while ((match = commandPattern.exec(value))) {
    if (match.index > cursor) pieces.push(escapeHTML(value.slice(cursor, match.index)));
    pieces.push(`<span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">${escapeHTML(match[1].trim())}</span>`);
    cursor = match.index + match[1].length;
  }
  if (cursor < value.length) pieces.push(escapeHTML(value.slice(cursor)));
  return pieces.join("");
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
    isActivityPending,
    summarizeToolActivity,
    assistantTextFromData,
    formatText,
    formatTextBlock,
    formatInlineText,
    formatUserText,
    formatInlineCodeText,
    timeFromEvent,
    relativeTime,
    trimTitle,
    escapeHTML,
    escapeAttr,
  };
})(window);
