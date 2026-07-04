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
  return renderInlineText(text, { highlightCommands: false });
}

function formatInlineCodeText(text) {
  return renderInlineText(text, { highlightCommands: true });
}

function renderInlineText(text, options = {}) {
  const value = String(text || "");
  const parts = [];
  const pattern = /(`[^`]+`|\[([^\]\n]+)\]\(([^)\n]+)\))/g;
  let cursor = 0;
  let match;
  while ((match = pattern.exec(value))) {
    if (match.index > cursor) parts.push(renderPlainInlineText(value.slice(cursor, match.index), options));
    const token = match[0];
    if (token.startsWith("`") && token.endsWith("`") && token.length > 1) {
      parts.push(renderInlineCode(token.slice(1, -1)));
    } else if (match[2]) {
      parts.push(renderMarkdownLink(match[2], match[3]));
    }
    cursor = match.index + token.length;
  }
  if (cursor < value.length) parts.push(renderPlainInlineText(value.slice(cursor), options));
  return parts.join("");
}

function renderPlainInlineText(text, options = {}) {
  if (!options.highlightCommands) return escapeHTML(text);
  return renderCommandHighlights(text);
}

function renderCommandHighlights(text) {
  const value = String(text || "");
  if (!value) return "";
  const commandPattern = /((?:node|go|git|systemctl|ssh|docker|curl|chmod|find|grep|rg|sed|awk|npm|pnpm|yarn|\.\/build-all\.sh|GET|POST|PUT|PATCH|DELETE)\s[^,\n。]*)/g;
  let cursor = 0;
  const pieces = [];
  let match;
  while ((match = commandPattern.exec(value))) {
    if (match.index > cursor) pieces.push(escapeHTML(value.slice(cursor, match.index)));
    pieces.push(renderInlineCode(match[1].trim()));
    cursor = match.index + match[1].length;
  }
  if (cursor < value.length) pieces.push(escapeHTML(value.slice(cursor)));
  return pieces.join("");
}

function renderInlineCode(text) {
  return `<span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">${escapeHTML(text)}</span>`;
}

function renderMarkdownLink(label, target) {
  const href = String(target || "").trim();
  const cleanLabel = String(label || "").trim() || fileNameFromPath(href);
  if (isFileReference(href)) return renderFileReference(cleanLabel, href);
  return `<a class="codex-markdown-link" href="${escapeAttr(href)}" target="_blank" rel="noreferrer">${escapeHTML(cleanLabel)}</a>`;
}

function renderFileReference(label, path) {
  return `<span class="codex-file-reference" role="link" tabindex="0" title="${escapeAttr(path)}" data-file-reference="${escapeAttr(path)}"><span class="codicon codicon-file-code codex-file-reference-icon" aria-hidden="true"></span><span class="codex-file-reference-label">${escapeHTML(label || fileNameFromPath(path))}</span></span>`;
}

function isFileReference(target) {
  const value = String(target || "");
  return /^([a-zA-Z]:[\\/]|[./~]?[/\\]|[\w.-]+[/\\]).+\.[\w-]+(?:[:#]\d+)?$/.test(value);
}

function fileNameFromPath(path) {
  const value = String(path || "").split(/[?#]/)[0].replace(/\\/g, "/");
  return value.split("/").filter(Boolean).pop() || value || "file";
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
