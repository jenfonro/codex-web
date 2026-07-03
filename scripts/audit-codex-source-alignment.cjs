#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, "reference", "codex-reference");
const outJSON = path.join(outDir, "source-alignment-audit.json");
const outMD = path.join(outDir, "source-alignment-audit.md");

const localFiles = [
  "frontend/src/pages/codex/index.js",
  "frontend/src/pages/codex/api.js",
  "frontend/src/pages/codex/config.js",
  "frontend/src/pages/codex/fixtures.js",
  "frontend/src/pages/codex/renderer.js",
  "frontend/src/pages/codex/utils.js",
  "frontend/src/pages/codex/panel-shadow.css",
  "frontend/src/pages/codex/panel.css",
];

const localAssetDir = "frontend/src/assets/chatgpt";
const officialAssetDir = "reference/extension-source/openai.chatgpt-26.5623.31443/webview/assets";
const referenceJSON = "reference/codex-reference/codex-reference.json";

const captures = [
  "20260702-184840-codex-session-list-wide-611",
  "20260702-185302-codex-thread-wide-611",
  "20260702-185715-codex-thread-plus-menu-wide-611-stable",
  "20260702-185942-codex-thread-approval-menu-wide-stable",
  "20260702-190248-codex-thread-model-menu-right-wide-stable",
];

const allowedLocalClasses = new Set([
  "codex-error-message",
  "codex-floating-menu",
  "codex-floating-menu-approval",
  "codex-floating-menu-model",
  "codex-home-watermark",
  "codex-panel-frame",
  "codex-send-ready",
  "codex-sidebar-content",
  "light",
  "vscode-light",
]);

const allowedLocalDataAttrs = new Set([
  "data-action",
  "data-codex-archive-button",
  "data-codex-composer",
  "data-codex-empty",
  "data-codex-intelligence-trigger",
  "data-codex-os",
  "data-codex-panel-root",
  "data-codex-session-id",
  "data-codex-view",
  "data-codex-window-chrome",
  "data-codex-window-type",
  "data-popover",
  "data-thread-content-shell",
  "data-thread-scroll",
]);

const allowedLocalSelectors = [
  ":host",
  "#root",
  ".codicon",
  ".codicon::before",
  ".codex-home-watermark",
  ".thread-scroll-container",
  "[data-thread-find-target=\"conversation\"]",
  "[data-thread-scroll-footer=\"true\"]",
  ".ProseMirror p",
  ".ProseMirror p.placeholder::before",
  ".ProseMirror p.placeholder br",
  ".codex-send-ready",
  ".codex-error-message",
  ".codex-chevron-right",
  "[data-composer-overlay-floating-ui]",
  ".codex-floating-menu",
  ".codex-floating-menu-approval",
  ".codex-floating-menu-model",
  "._content_1hiti_1",
  ".codex-sidebar-content",
  "#codexPanel",
];

main();

function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const reference = readReference();
  const officialAssets = readOfficialAssets();
  const local = readLocal();
  const assetIntegrity = compareLocalAssets();

  const officialClassTokens = new Set([
    ...classTokensFromMarkup(reference.html),
    ...classTokensFromCSS(officialAssets.cssText),
  ]);
  const referenceDataAttrs = new Set([
    ...dataAttrsFromMarkup(reference.html),
    ...dataAttrsFromRaw(officialAssets.jsText),
  ]);
  const localClassTokens = new Set(classTokensFromMarkup(local.text));
  const localDataAttrs = new Set(dataAttrsFromMarkup(local.text));
  const localSelectors = selectorsFromCSS(local.cssText);

  const classItems = [...localClassTokens].sort().map((name) => ({
    name,
    source: officialClassTokens.has(name) ? "reference-or-official-css" : allowedLocalClasses.has(name) ? "local-adapter-allowlist" : "unexplained-local",
  }));
  const dataItems = [...localDataAttrs].sort().map((name) => ({
    name,
    source: referenceDataAttrs.has(name) ? "reference" : allowedLocalDataAttrs.has(name) ? "local-behavior-allowlist" : "unexplained-local",
  }));
  const selectorItems = localSelectors.map((item) => ({
    ...item,
    source: classifySelector(item.selector, officialClassTokens),
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    basis: "Static source alignment audit. Compares local component/CSS source against captured extension HTML and official extension CSS assets. Screenshots are not used.",
    files: {
      local: localFiles,
      localAssetDir,
      officialAssetDir,
      referenceJSON,
      captures,
    },
    counts: {
      referenceClassTokens: officialClassTokens.size,
      localClassTokens: localClassTokens.size,
      referenceDataAttrs: referenceDataAttrs.size,
      localDataAttrs: localDataAttrs.size,
      localSelectors: localSelectors.length,
      assetIntegrity: assetIntegrity.length,
    },
    assetIntegrity,
    classTokens: classItems,
    dataAttrs: dataItems,
    selectors: selectorItems,
    unexplained: {
      classTokens: classItems.filter((item) => item.source === "unexplained-local"),
      dataAttrs: dataItems.filter((item) => item.source === "unexplained-local"),
      selectors: selectorItems.filter((item) => item.source === "unexplained-local"),
      assets: assetIntegrity.filter((item) => item.status !== "exact"),
    },
    allowlist: {
      classes: [...allowedLocalClasses].sort(),
      dataAttrs: [...allowedLocalDataAttrs].sort(),
      selectors: allowedLocalSelectors.slice().sort(),
    },
  };

  fs.writeFileSync(outJSON, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(outMD, renderMarkdown(report));
  console.log(outJSON);
  console.log(outMD);
  if (
    report.unexplained.classTokens.length ||
    report.unexplained.dataAttrs.length ||
    report.unexplained.selectors.length ||
    report.unexplained.assets.length
  ) {
    process.exitCode = 1;
  }
}

function readReference() {
  const file = path.join(repoRoot, referenceJSON);
  const payload = JSON.parse(fs.readFileSync(file, "utf8"));
  const parts = [];
  for (const value of Object.values(payload.snippets || {})) {
    if (!value || typeof value !== "object") continue;
    for (const html of Object.values(value)) parts.push(String(html || ""));
  }
  for (const capture of captures) {
    const frameDir = path.join(repoRoot, "reference", "windows-captures", capture, "frames", "03-active-frame");
    const documentPath = path.join(frameDir, "document.html");
    const runtimePath = path.join(frameDir, "runtime.json");
    if (fs.existsSync(documentPath)) parts.push(fs.readFileSync(documentPath, "utf8"));
    if (fs.existsSync(runtimePath)) {
      const runtime = JSON.parse(fs.readFileSync(runtimePath, "utf8"));
      if (runtime.html) parts.push(runtime.html);
    }
  }
  return { file, html: parts.join("\n") };
}

function readOfficialAssets() {
  const dir = path.join(repoRoot, officialAssetDir);
  const files = fs.readdirSync(dir)
    .filter((name) => /\.(css|js)$/.test(name))
    .map((name) => path.join(dir, name));
  const cssFiles = files.filter((file) => file.endsWith(".css"));
  const jsFiles = files.filter((file) => file.endsWith(".js"));
  return {
    files,
    cssFiles,
    jsFiles,
    cssText: cssFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n"),
    jsText: jsFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n"),
  };
}

function compareLocalAssets() {
  const localDir = path.join(repoRoot, localAssetDir);
  const officialDir = path.join(repoRoot, officialAssetDir);
  if (!fs.existsSync(localDir) || !fs.existsSync(officialDir)) return [];
  return fs.readdirSync(localDir)
    .filter((name) => name.endsWith(".css"))
    .filter((name) => name !== "codex-panel-vars.css" && name !== "codex-panel-bundle.css")
    .sort()
    .map((name) => {
      const localPath = path.join(localDir, name);
      const officialPath = path.join(officialDir, name);
      if (!fs.existsSync(officialPath)) {
        return { name, status: "missing-official", localBytes: fs.statSync(localPath).size, officialBytes: 0 };
      }
      const localText = fs.readFileSync(localPath, "utf8");
      const officialText = fs.readFileSync(officialPath, "utf8");
      return {
        name,
        status: localText === officialText ? "exact" : "different",
        localBytes: Buffer.byteLength(localText),
        officialBytes: Buffer.byteLength(officialText),
      };
    });
}

function readLocal() {
  const parts = [];
  const cssParts = [];
  for (const file of localFiles) {
    const absolute = path.join(repoRoot, file);
    if (!fs.existsSync(absolute)) continue;
    const text = fs.readFileSync(absolute, "utf8");
    parts.push(text);
    if (file.endsWith(".css")) cssParts.push({ file, text });
  }
  return {
    text: parts.join("\n"),
    cssText: cssParts.map((item) => `/* ${item.file} */\n${item.text}`).join("\n"),
  };
}

function classTokensFromMarkup(text) {
  const out = new Set();
  const masked = stripTemplateExpressions(text);
  const regex = /\bclass(?:Name)?\s*=\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g;
  let match;
  while ((match = regex.exec(masked))) {
    addClassTokens(out, match[1] || match[2] || match[3] || "");
  }
  return out;
}

function addClassTokens(out, value) {
  const withoutTemplates = htmlDecode(String(value)).replace(/\$\{[\s\S]*?\}/g, " ");
  for (const token of withoutTemplates.split(/\s+/)) {
    const clean = token.trim();
    if (!clean || clean.includes("${") || clean.includes("}")) continue;
    out.add(clean);
  }
}

function classTokensFromCSS(text) {
  const out = new Set();
  const regex = /\.(-?(?:[_a-zA-Z]|\\[0-9a-fA-F]{1,6}\s?|\\[^\s0-9a-fA-F])(?:[\w-]|\\[0-9a-fA-F]{1,6}\s?|\\[^\s0-9a-fA-F])*)/g;
  let match;
  while ((match = regex.exec(text))) {
    out.add(unescapeCSSIdent(match[1]));
  }
  return out;
}

function dataAttrsFromMarkup(text) {
  const out = new Set();
  const masked = stripTemplateExpressions(text);
  const regex = /\b(data-[a-zA-Z0-9_-]+)(?:\s*=|\s|>)/g;
  let match;
  while ((match = regex.exec(masked))) out.add(match[1]);
  return out;
}

function dataAttrsFromRaw(text) {
  const out = new Set();
  const regex = /\b(data-[a-zA-Z0-9_-]+)\b/g;
  let match;
  while ((match = regex.exec(text))) out.add(match[1]);
  return out;
}

function stripTemplateExpressions(value) {
  const text = String(value);
  let out = "";
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== "$" || text[i + 1] !== "{") {
      out += text[i];
      continue;
    }
    i += 2;
    let depth = 1;
    let quote = "";
    while (i < text.length && depth > 0) {
      const char = text[i];
      if (quote) {
        if (char === "\\") {
          i += 2;
          continue;
        }
        if (char === quote) quote = "";
        i += 1;
        continue;
      }
      if (char === "\"" || char === "'" || char === "`") {
        quote = char;
      } else if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;
      }
      i += 1;
    }
    out += " ";
    i -= 1;
  }
  return out;
}

function selectorsFromCSS(text) {
  const out = [];
  let line = 1;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === "\n") line += 1;
    if (char === "{") {
      const selector = text.slice(start, i).replace(/\/\*[\s\S]*?\*\//g, "").trim();
      if (selector && !selector.startsWith("@")) {
        for (const part of selector.split(",")) {
          const value = part.trim().replace(/\s+/g, " ");
          if (value) out.push({ selector: value, line });
        }
      }
    } else if (char === "}") {
      start = i + 1;
    }
  }
  return out;
}

function classifySelector(selector, officialClassTokens) {
  if (allowedLocalSelectors.some((allowed) => selector === allowed || selector.startsWith(`${allowed} `) || selector.startsWith(`${allowed}>`) || selector.startsWith(`${allowed}:`))) {
    return "local-adapter-allowlist";
  }
  const classes = [...selector.matchAll(/\.([_a-zA-Z][\w-]*)/g)].map((match) => match[1]);
  if (classes.length && classes.every((name) => officialClassTokens.has(name) || allowedLocalClasses.has(name))) {
    return "official-class-target";
  }
  if (/\[data-[^\]]+\]/.test(selector)) {
    const attrs = [...selector.matchAll(/\[(data-[a-zA-Z0-9_-]+)/g)].map((match) => match[1]);
    if (attrs.every((name) => allowedLocalDataAttrs.has(name))) return "local-behavior-allowlist";
  }
  return "unexplained-local";
}

function renderMarkdown(report) {
  const lines = [
    "# Codex Source Alignment Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    report.basis,
    "",
    "## Summary",
    "",
    `- Local class tokens: ${report.counts.localClassTokens}`,
    `- Reference/official class tokens: ${report.counts.referenceClassTokens}`,
    `- Unexplained local class tokens: ${report.unexplained.classTokens.length}`,
    `- Unexplained local data attrs: ${report.unexplained.dataAttrs.length}`,
    `- Unexplained local CSS selectors: ${report.unexplained.selectors.length}`,
    `- Non-exact copied extension CSS assets: ${report.unexplained.assets.length}`,
    "",
  ];
  addTable(
    lines,
    "Copied Extension CSS Assets",
    ["Asset", "Status", "Local Bytes", "Official Bytes"],
    report.assetIntegrity.map((item) => [item.name, item.status, String(item.localBytes), String(item.officialBytes)]),
  );
  addTable(
    lines,
    "Non-Exact Copied Assets",
    ["Asset", "Status", "Local Bytes", "Official Bytes"],
    report.unexplained.assets.map((item) => [item.name, item.status, String(item.localBytes), String(item.officialBytes)]),
  );
  addTable(lines, "Unexplained Class Tokens", ["Token"], report.unexplained.classTokens.map((item) => [item.name]));
  addTable(lines, "Unexplained Data Attributes", ["Attribute"], report.unexplained.dataAttrs.map((item) => [item.name]));
  addTable(lines, "Unexplained CSS Selectors", ["Selector", "Line"], report.unexplained.selectors.map((item) => [item.selector, String(item.line)]));
  addTable(lines, "Adapter Class Allowlist", ["Token"], report.allowlist.classes.map((name) => [name]));
  addTable(lines, "Adapter Data Attr Allowlist", ["Attribute"], report.allowlist.dataAttrs.map((name) => [name]));
  lines.push("## Rule");
  lines.push("");
  lines.push("- Any unexplained item is unfinished. Either replace it with captured extension structure/style, prove it exists in official assets, or document it as a necessary adapter hook.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function addTable(lines, title, headers, rows) {
  lines.push(`## ${title}`, "");
  if (!rows.length) {
    lines.push("None.", "");
    return;
  }
  lines.push(`| ${headers.join(" | ")} |`);
  lines.push(`| ${headers.map(() => "---").join(" | ")} |`);
  for (const row of rows) lines.push(`| ${row.map(code).join(" | ")} |`);
  lines.push("");
}

function code(value) {
  return `\`${String(value).replaceAll("`", "\\`")}\``;
}

function htmlDecode(value) {
  return String(value)
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function unescapeCSSIdent(value) {
  return String(value).replace(/\\([^\n\r\f0-9a-fA-F])/g, "$1").replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)));
}
