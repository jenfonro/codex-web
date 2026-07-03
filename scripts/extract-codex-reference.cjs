#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const captureRoot = path.join(repoRoot, "reference", "windows-captures");
const outRoot = path.join(repoRoot, "reference", "codex-reference");
const assetRoot = path.join(repoRoot, "reference", "extension-assets", "openai.chatgpt-26.5623.31443", "webview", "assets");

const captures = {
  list: "20260702-184840-codex-session-list-wide-611",
  thread: "20260702-185302-codex-thread-wide-611",
  plusMenu: "20260702-185715-codex-thread-plus-menu-wide-611-stable",
  approvalMenu: "20260702-185942-codex-thread-approval-menu-wide-stable",
  modelMenu: "20260702-190248-codex-thread-model-menu-right-wide-stable",
};

const styleSelectors = [
  "html",
  "body",
  "#root",
  "#root > *",
  "[data-user-message-bubble]",
  "[data-thread-find-target]",
  "[data-radix-menu-content]",
  "[data-composer-overlay-floating-ui]",
  ".ProseMirror",
  ".composer-surface-chrome",
  "._attachmentsDefault_1u8sk_2",
  "._footer_1u8sk_2",
  "._footer_z984f_2",
  "._markdownContent_lzkx4_60",
  "._markdownText_lzkx4_86",
  "._paragraph_lzkx4_82",
  "._list_lzkx4_133",
  "._listItem_lzkx4_168",
  "._inlineMarkdown_lzkx4_385",
  "[class*='thread']",
  "[class*='task']",
  "[class*='message']",
  "[class*='shimmer']",
  "button",
];

const domNeedles = {
  root: { start: '<div id="root">' },
  sessionRow: { needle: "data-thread-title=" },
  threadConversation: { needle: 'data-thread-find-target="conversation"' },
  userBubble: { needle: "data-user-message-bubble" },
  composer: { needle: "composer-surface-chrome" },
  composerFooter: { needle: "_footer_1u8sk_2" },
  externalFooter: { needle: "_footer_z984f_2" },
  markdown: { needle: "_markdownContent_lzkx4_60" },
  menu: { needle: "data-radix-menu-content" },
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  fs.mkdirSync(outRoot, { recursive: true });
  fs.mkdirSync(assetRoot, { recursive: true });

  const report = {
    generatedAt: new Date().toISOString(),
    captures,
    assets: {},
    snippets: {},
    selectorStyles: {},
    variables: {},
  };

  for (const [name, captureName] of Object.entries(captures)) {
    const runtimePath = path.join(captureRoot, captureName, "frames", "03-active-frame", "runtime.json");
    const documentPath = path.join(captureRoot, captureName, "frames", "03-active-frame", "document.html");
    const runtime = readJSON(runtimePath);
    const html = fs.readFileSync(documentPath, "utf8");

    report.variables[name] = pickVariables(runtime.variables || {});
    report.selectorStyles[name] = pickSelectorStyles(runtime.selectorStyles || {});
    report.snippets[name] = extractSnippets(html);
    report.assets[name] = {
      linkedStylesheets: runtime.linkedStylesheets || [],
      scripts: runtime.scripts || [],
      resourceEntries: (runtime.resourceEntries || []).filter((entry) => /\.(css|js)(?:$|\?)/.test(entry.name)),
    };
  }

  fs.writeFileSync(path.join(outRoot, "codex-reference.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(outRoot, "variables.css"), renderVariablesCSS(report.variables.thread || {}));
  fs.writeFileSync(path.join(outRoot, "summary.md"), renderSummary(report));

  extractStylesheetsFromMHTML(path.join(captureRoot, captures.thread, "page.mhtml"));
  await downloadStylesheets(report.assets.thread.linkedStylesheets || []);
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function pickVariables(variables) {
  const prefixes = [
    "--color-token-",
    "--font-",
    "--height-",
    "--radius-",
    "--spacing-token-",
    "--text-",
    "--vscode-chat-",
    "--vscode-font-",
    "--vscode-body",
  ];
  return Object.fromEntries(
    Object.entries(variables)
      .filter(([key]) => prefixes.some((prefix) => key.startsWith(prefix)))
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

function pickSelectorStyles(selectorStyles) {
  const picked = {};
  for (const selector of styleSelectors) {
    const samples = selectorStyles[selector] || [];
    picked[selector] = samples.slice(0, 12).map((sample) => ({
      tagName: sample.tagName,
      id: sample.id,
      className: sample.className,
      role: sample.role,
      ariaLabel: sample.ariaLabel,
      text: sample.text,
      rect: sample.rect,
      styles: sample.styles,
    }));
  }
  return picked;
}

function extractSnippets(html) {
  const snippets = {};
  for (const [name, config] of Object.entries(domNeedles)) {
    const index = config.start ? html.indexOf(config.start) : html.indexOf(config.needle);
    if (index < 0) {
      snippets[name] = "";
      continue;
    }
    const start = config.start ? index : findElementStart(html, index);
    snippets[name] = start >= 0 ? extractElement(html, start) : "";
  }
  return snippets;
}

function findElementStart(html, index) {
  const tagPattern = /<([a-zA-Z][\w:-]*)(?:\s|>)/g;
  let best = -1;
  let match;
  while ((match = tagPattern.exec(html)) && match.index <= index) {
    if (!isVoidTag(match[1])) best = match.index;
  }
  return best;
}

function extractElement(html, start) {
  const open = /^<([a-zA-Z][\w:-]*)(?:\s[^>]*)?>/.exec(html.slice(start));
  if (!open) return "";
  const rootTag = open[1].toLowerCase();
  const tokenPattern = /<\/?([a-zA-Z][\w:-]*)(?:\s[^>]*)?>/g;
  tokenPattern.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = tokenPattern.exec(html))) {
    const raw = match[0];
    const tag = match[1].toLowerCase();
    if (isVoidTag(tag) || raw.endsWith("/>")) continue;
    if (raw.startsWith("</")) {
      if (tag === rootTag) depth -= 1;
      if (depth === 0) return html.slice(start, tokenPattern.lastIndex);
    } else if (tag === rootTag || depth > 0) {
      depth += 1;
    }
  }
  return html.slice(start, Math.min(html.length, start + 12000));
}

function isVoidTag(tag) {
  return ["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"].includes(String(tag).toLowerCase());
}

function renderVariablesCSS(variables) {
  const lines = [":root {"];
  for (const [key, value] of Object.entries(variables)) lines.push(`  ${key}: ${value};`);
  lines.push("}", "");
  return `${lines.join("\n")}`;
}

function renderSummary(report) {
  const lines = [
    "# Codex Extension Reference",
    "",
    "Generated from captured Windows Chrome code-server webview runtime files.",
    "",
    "## Captures",
    "",
  ];
  for (const [name, capture] of Object.entries(report.captures)) lines.push(`- ${name}: \`${capture}\``);
  lines.push("", "## Rules", "");
  lines.push("- Treat `codex-reference.json` selector styles and snippets as the implementation source of truth.");
  lines.push("- Screenshots are only verification after DOM/class/style alignment.");
  lines.push("- Do not replace captured structures with visually similar hand-made components.");
  lines.push("", "## Downloaded CSS Assets", "");
  for (const entry of report.assets.thread.linkedStylesheets || []) lines.push(`- \`${entry.href.split("/").pop()}\``);
  lines.push("");
  return `${lines.join("\n")}`;
}

async function downloadStylesheets(stylesheets) {
  for (const stylesheet of stylesheets) {
    const url = stylesheet.href;
    const filename = url.split("/").pop();
    const outPath = path.join(assetRoot, filename);
    if (fs.existsSync(outPath)) {
      console.log(`cached ${filename}`);
      continue;
    }
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`skip ${filename}: ${response.status} ${response.statusText}`);
        continue;
      }
      fs.writeFileSync(outPath, await response.text());
      console.log(`downloaded ${filename}`);
    } catch (error) {
      console.warn(`skip ${filename}: ${error.message}`);
    }
  }
}

function extractStylesheetsFromMHTML(file) {
  if (!fs.existsSync(file)) return;
  const mhtml = fs.readFileSync(file, "utf8");
  const boundary = /boundary="([^"]+)"/i.exec(mhtml)?.[1];
  if (!boundary) return;
  const parts = mhtml.split(new RegExp(`\\r?\\n--${escapeRegExp(boundary)}(?:--)?\\r?\\n`, "g"));
  for (const part of parts) {
    if (!/^Content-Type:\s*text\/css\b/im.test(part)) continue;
    const location = /^Content-Location:\s*(.+)$/im.exec(part)?.[1]?.trim();
    if (!location || !/openai\.chatgpt-26\.5623\.31443\/webview\/assets\//.test(location)) continue;
    const filename = location.split("/").pop();
    const bodyStart = part.search(/\r?\n\r?\n/);
    if (bodyStart < 0) continue;
    const rawBody = part.slice(bodyStart).replace(/^\r?\n\r?\n/, "");
    const decoded = quotedPrintableDecode(rawBody);
    fs.writeFileSync(path.join(assetRoot, filename), decoded);
    console.log(`extracted ${filename}`);
  }
}

function quotedPrintableDecode(value) {
  const compact = value.replace(/=\r?\n/g, "");
  return compact.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
