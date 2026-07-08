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
    case "turn_cancelled":
      return event.text || "Stopped";
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

function websiteResourcesFromEvents(events) {
  const resources = [];
  const seen = new Set();
  for (const event of Array.isArray(events) ? events : []) {
    if (!isAssistantResourceSource(event)) continue;
    for (const url of extractWebsiteResourceURLs(eventText(event))) {
      if (seen.has(url)) continue;
      seen.add(url);
      resources.push({ type: "website", title: "网页预览", subtitle: "网站", url });
    }
  }
  return resources;
}

function isAssistantResourceSource(event) {
  return String(event?.kind || "").trim() === "assistant_message";
}

function eventText(event) {
  return String(
    event?.text ||
    event?.html ||
    event?.data?.message ||
    event?.data?.html ||
    assistantTextFromData(event?.data),
  );
}

function extractWebsiteResourceURLs(text) {
  const value = String(text || "");
  if (!value) return [];
  const urls = [];
  const pattern = /https?:\/\/[^\s<>"'`，。；、）)】\]}]+/g;
  let match;
  while ((match = pattern.exec(value))) {
    const url = normalizeWebsiteResourceURL(match[0]);
    if (url && isWebsitePreviewURL(url)) urls.push(url);
  }
  return urls;
}

function normalizeWebsiteResourceURL(value) {
  const cleaned = String(value || "").replace(/[.,;:!?，。；：！？）)\]}]+$/u, "");
  try {
    return new URL(cleaned).href;
  } catch {
    return "";
  }
}

function isWebsitePreviewURL(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host.endsWith(".localhost");
  } catch {
    return false;
  }
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
  if (!options.highlightCommands) return renderPlainFileReferences(text);
  return renderCommandHighlights(text);
}

function renderPlainFileReferences(text) {
  const value = String(text || "");
  if (!value) return "";
  const pattern = /(^|[\s(（:：])((?:[a-zA-Z]:[\\/]|~?\/|\.{1,2}\/)[^\s`"'<>，。；;、)）]+?\.[a-zA-Z0-9][a-zA-Z0-9._-]*(?::\d+|#L?\d+)?)/g;
  let cursor = 0;
  const pieces = [];
  let match;
  while ((match = pattern.exec(value))) {
    const prefix = match[1] || "";
    const path = match[2] || "";
    const pathStart = match.index + prefix.length;
    if (pathStart > cursor) pieces.push(escapeHTML(value.slice(cursor, pathStart)));
    if (isFileReference(path)) {
      const reference = parseFileReference(path);
      pieces.push(renderFileReference(fileReferenceLabel(path, reference), path));
    } else {
      pieces.push(escapeHTML(path));
    }
    cursor = pathStart + path.length;
  }
  if (cursor < value.length) pieces.push(escapeHTML(value.slice(cursor)));
  return pieces.join("");
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
  const value = String(text || "");
  const fileReference = parseInlineCodeFileReference(value);
  if (fileReference) return renderFileReference(fileReferenceLabel(value, fileReference), value);
  return `<span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">${escapeHTML(value)}</span>`;
}

function renderMarkdownLink(label, target) {
  const href = String(target || "").trim();
  const fileReference = parseFileReference(href);
  const cleanLabel = String(label || "").trim() || fileNameFromPath(href);
  if (fileReference) return renderFileReference(fileReferenceLabel(fileReferenceDisplayLabel(cleanLabel, fileReference), fileReference), href);
  return `<a class="codex-markdown-link" href="${escapeAttr(href)}" target="_blank" rel="noreferrer">${escapeHTML(cleanLabel)}</a>`;
}

function renderFileReference(label, path) {
  const text = label || fileNameFromPath(path);
  const icon = global.CodexIcons?.svg
    ? global.CodexIcons.svg("editFile", "icon-xs")
    : '<span class="codicon codicon-file-code icon-xs" aria-hidden="true"></span>';
  return `<span class="inline-flex max-w-full" data-file-reference="${escapeAttr(path)}" title="${escapeAttr(path)}"><span class="group/inline-mention cursor-pointer" role="button" tabindex="0" data-state="closed"><span class="break-words whitespace-normal" data-state="closed"><span class="px-0.5 inline-mention-brand-aware font-medium text-[color:var(--inline-mention-color)] [--inline-mention-color:var(--inline-mention-resolved-base-color,var(--inline-mention-base-color))] [--inline-mention-base-color:color-mix(in_srgb,var(--color-token-text-link-foreground)_80%,var(--color-token-foreground)_20%)] group-hover/inline-mention:underline group-hover/inline-mention:decoration-current group-hover/inline-mention:decoration-dashed group-hover/inline-mention:decoration-[0.5px] group-hover/inline-mention:underline-offset-2 _tableCellFileLink_lzkx4_413"><span class="relative mr-[3px] inline-block h-[1lh] w-4 align-bottom">${icon}</span><span class="min-w-0 break-words">${escapeHTML(text)}</span></span></span></span></span>`;
}

function isFileReference(target) {
  return Boolean(parseFileReference(target));
}

function parseInlineCodeFileReference(target) {
  const value = String(target || "").trim();
  if (/^\.\.?[/\\][^/\\]+$/i.test(value)) return null;
  if (!/^([a-zA-Z]:[\\/]|~?[/\\]|\.\.?[/\\].+[/\\]|[\w.-]+[/\\])/.test(value)) return null;
  return parseFileReference(value);
}

function parseFileReference(target) {
  const value = String(target || "");
  if (!/^([a-zA-Z]:[\\/]|[./~]?[/\\]|[\w.-]+[/\\]).+\.[\w-]+(?:[:#]\d+|#L\d+)?$/i.test(value)) return null;
  const hashLine = value.match(/#L?(\d+)$/i);
  const colonLine = hashLine ? null : value.match(/:(\d+)$/);
  return {
    path: hashLine ? value.slice(0, -hashLine[0].length) : colonLine ? value.slice(0, -colonLine[0].length) : value,
    line: hashLine?.[1] || colonLine?.[1] || "",
  };
}

function fileReferenceLabel(label, reference) {
  const base = String(label || "").trim() || fileNameFromPath(reference?.path || "");
  if (!reference?.line || /\(line\s+\d+\)$/i.test(base)) return base;
  return `${base} (line ${reference.line})`;
}

function fileReferenceDisplayLabel(label, reference) {
  const cleanLabel = String(label || "").trim();
  if (cleanLabel && reference?.line && !/[\\/]/.test(cleanLabel)) {
    const relative = workspaceRelativePath(reference.path);
    if (relative && relative.endsWith(`/${cleanLabel}`)) return relative;
  }
  return cleanLabel || fileNameFromPath(reference?.path || "");
}

function workspaceRelativePath(path) {
  const value = String(path || "").replace(/\\/g, "/");
  const match = value.match(/(?:^|\/)codex-web\/(.+)$/i);
  return match?.[1] || "";
}

function fileNameFromPath(path) {
  const reference = parseFileReference(path);
  const value = String(reference?.path || path || "").split(/[?#]/)[0].replace(/\\/g, "/");
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
    websiteResourcesFromEvents,
    timeFromEvent,
    relativeTime,
    trimTitle,
    escapeHTML,
    escapeAttr,
  };
})(window);
