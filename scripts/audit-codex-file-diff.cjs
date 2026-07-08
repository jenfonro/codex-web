#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const CDP = process.env.CDP_URL || "http://127.0.0.1:9222";
const APP_URL = process.env.PANEL_URL || "http://127.0.0.1:58888/";
const SIDEBAR_WIDTH = Number(process.env.SIDEBAR_WIDTH || 611);
const VIEWPORT_WIDTH = Number(process.env.VIEWPORT_WIDTH || 1920);
const VIEWPORT_HEIGHT = Number(process.env.VIEWPORT_HEIGHT || 1080);
const RUN_ID = new Date().toISOString().replace(/\D/g, "");

const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, "reference", "codex-reference");
const outJSON = path.join(outDir, "file-diff-audit.json");
const outMD = path.join(outDir, "file-diff-audit.md");
const officialAsset = path.join(
  repoRoot,
  "reference",
  "extension-source",
  "openai.chatgpt-26.5623.31443",
  "webview",
  "assets",
  "local-conversation-turn-BZInUTC2.js",
);
const officialMarkdownCSS = path.join(
  repoRoot,
  "reference",
  "extension-source",
  "openai.chatgpt-26.5623.31443",
  "webview",
  "assets",
  "markdown-DmSBSKzD.css",
);
const officialAppCSS = path.join(
  repoRoot,
  "reference",
  "extension-source",
  "openai.chatgpt-26.5623.31443",
  "webview",
  "assets",
  "app-main-DH0Qggoi.css",
);

const officialSnippets = [
  "group/turn-diff-header relative focus-within:[&_.turn-diff-default-subtitle]:hidden hover:[&_.turn-diff-default-subtitle]:hidden focus-within:[&_.turn-diff-hover-subtitle]:inline-flex hover:[&_.turn-diff-hover-subtitle]:inline-flex",
  "absolute inset-0 cursor-interaction bg-transparent group-hover/turn-diff-header:bg-token-list-hover-background/30 focus-visible:ring-1 focus-visible:ring-token-focus-border focus-visible:outline-none focus-visible:ring-inset",
  "flex size-10 shrink-0 items-center justify-center rounded-lg bg-token-bg-secondary text-token-text-secondary",
  "turn-diff-default-subtitle inline-flex",
  "turn-diff-hover-subtitle hidden items-center gap-1",
  "flex flex-col border-t border-token-border [--codex-diffs-header-padding-x:var(--thread-resource-card-row-padding-x)] [--codex-diffs-header-padding-y:var(--turn-diff-row-padding-y)]",
  "thread-diff-virtualized",
  "text-size-chat flex h-9 w-full cursor-interaction items-center gap-2 bg-token-main-surface-primary/70 px-[var(--thread-resource-card-row-padding-x)] py-[var(--turn-diff-row-padding-y)] text-left hover:bg-token-list-hover-background/60 focus-visible:ring-1 focus-visible:ring-token-focus-border focus-visible:outline-none focus-visible:ring-inset extension:bg-token-input-background/70 extension:hover:bg-token-list-hover-background/60",
  "min-w-0 truncate text-token-description-foreground",
  "max-w-full shrink-0 truncate text-token-foreground",
  "Show # more file",
  "Collapse files",
];

const officialCSSSnippets = [
  "_tableCellFileLink_lzkx4_413",
  "inline-mention-brand-aware",
  "text-\\[color\\:var\\(--inline-mention-color\\)\\]",
  "group-hover\\/inline-mention\\:decoration-dashed",
];

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const sourceEvidence = readSourceEvidence();
  const url = fixtureURL(APP_URL);
  const target = await createPageTarget(url);
  const page = await connect(target.webSocketDebuggerUrl);
  let dom = null;
  try {
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Network.enable").catch(() => {});
    await page.send("Network.setCacheDisabled", { cacheDisabled: true }).catch(() => {});
    await page.send("Emulation.setDeviceMetricsOverride", {
      width: VIEWPORT_WIDTH,
      height: VIEWPORT_HEIGHT,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: VIEWPORT_WIDTH,
      screenHeight: VIEWPORT_HEIGHT,
    });

    await navigate(page, url);
    await evalPage(page, `(() => {
      localStorage.setItem("codex-web:sidebar-width", ${JSON.stringify(String(SIDEBAR_WIDTH))});
      document.documentElement.style.setProperty("--cw-sidebar-width", ${JSON.stringify(`${SIDEBAR_WIDTH}px`)});
    })()`);
    if (!(await hasShadow(page, "[data-codex-view='thread']", 5000))) {
      await waitForShadow(page, "[data-codex-view='list']");
      await clickShadow(page, "[data-codex-session-id='thread-reference']");
      await waitForShadow(page, "[data-codex-view='thread']");
    }
    await waitForShadow(page, "[data-thread-scroll]");
    await wait(300);
    dom = await evalPage(page, auditExpression());
  } finally {
    await page.close();
    await closePageTarget(target.id).catch(() => {});
  }

  const checks = [
    ...sourceEvidence.checks,
    { name: "viewport is 1920x1080 or larger", ok: VIEWPORT_WIDTH >= 1920 && VIEWPORT_HEIGHT >= 1080, details: `${VIEWPORT_WIDTH}x${VIEWPORT_HEIGHT}` },
    { name: "sidebar target is wide enough", ok: SIDEBAR_WIDTH >= 580, details: `${SIDEBAR_WIDTH}px` },
    { name: "diff card found in fixture", ok: Boolean(dom?.diffCard?.found), details: dom?.diffCard?.text || dom?.reason || "" },
    { name: "diff card root uses official resource classes", ok: classHas(dom?.diffCard?.className, ["flex", "max-w-full", "overflow-hidden", "rounded-lg", "bg-token-dropdown-background/50", "text-token-foreground", "[--thread-resource-card-row-padding-x:0.75rem]", "[--turn-diff-row-padding-y:0.25rem]"]), details: dom?.diffCard?.className || "" },
    { name: "diff header uses official group class", ok: classHas(dom?.header?.className, ["group/turn-diff-header", "relative", "turn-diff-default-subtitle", "turn-diff-hover-subtitle"]), details: dom?.header?.className || "" },
    { name: "diff header overlay button exists", ok: Boolean(dom?.headerOverlay?.found), details: dom?.headerOverlay?.className || "" },
    { name: "diff icon block uses official size/background", ok: classHas(dom?.iconBlock?.className, ["flex", "size-10", "rounded-lg", "bg-token-bg-secondary", "text-token-text-secondary"]), details: dom?.iconBlock?.className || "" },
    { name: "diff default subtitle exists", ok: classHas(dom?.defaultSubtitle?.className, ["turn-diff-default-subtitle", "inline-flex"]), details: dom?.defaultSubtitle?.text || "" },
    { name: "diff hover subtitle exists", ok: classHas(dom?.hoverSubtitle?.className, ["turn-diff-hover-subtitle", "hidden", "items-center", "gap-1"]), details: dom?.hoverSubtitle?.text || "" },
    { name: "diff file list surface uses official border/classes", ok: classHas(dom?.fileList?.className, ["flex", "flex-col", "border-t", "border-token-border", "[--codex-diffs-header-padding-x:var(--thread-resource-card-row-padding-x)]"]), details: dom?.fileList?.className || "" },
    { name: "diff virtualized file rows exist", ok: Number(dom?.fileRows?.length || 0) >= 3, details: `${dom?.fileRows?.length || 0}` },
    { name: "first file row button uses official classes", ok: classHas(dom?.firstFileRow?.buttonClassName, ["text-size-chat", "flex", "h-9", "w-full", "cursor-interaction", "gap-2", "bg-token-main-surface-primary/70", "extension:bg-token-input-background/70"]), details: dom?.firstFileRow?.buttonClassName || "" },
    { name: "first file row has sr-only full path", ok: Boolean(dom?.firstFileRow?.srOnlyText), details: dom?.firstFileRow?.srOnlyText || "" },
    { name: "first file row splits directory and filename", ok: Boolean(dom?.firstFileRow?.dirText && dom?.firstFileRow?.nameText), details: `${dom?.firstFileRow?.dirText || ""}${dom?.firstFileRow?.nameText || ""}` },
    { name: "first file row has additions/deletions counters", ok: Boolean(dom?.firstFileRow?.additionsText && dom?.firstFileRow?.deletionsText), details: `${dom?.firstFileRow?.additionsText || ""} ${dom?.firstFileRow?.deletionsText || ""}` },
    { name: "show-more/collapse row exists", ok: Boolean(dom?.showMore?.found), details: dom?.showMore?.text || "" },
    { name: "show-more row uses official disclosure button classes", ok: classHas(dom?.showMore?.className, ["text-size-chat", "flex", "h-9", "w-full", "cursor-interaction", "text-token-text-primary"]), details: dom?.showMore?.className || "" },
    { name: "inline file mention exists", ok: Boolean(dom?.inlineMention?.found), details: dom?.inlineMention?.text || "" },
    { name: "inline file mention uses captured table cell link class", ok: classHas(dom?.inlineMention?.linkClassName, ["_tableCellFileLink_lzkx4_413", "inline-mention-brand-aware", "font-medium", "text-[color:var(--inline-mention-color)]"]), details: dom?.inlineMention?.linkClassName || "" },
    { name: "inline file mention uses button wrapper", ok: dom?.inlineMention?.role === "button" && classHas(dom?.inlineMention?.wrapperClassName, ["group/inline-mention", "cursor-pointer"]), details: `${dom?.inlineMention?.role || ""} ${dom?.inlineMention?.wrapperClassName || ""}` },
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    fixtureURL: url,
    basis: "File/diff audit. Source snippets are read from the official extension JS/CSS bundles; DOM evidence is collected from the local Codex Web reference fixture.",
    sourceEvidence,
    viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
    sidebarWidth: SIDEBAR_WIDTH,
    summary: {
      checks: checks.length,
      failed: checks.filter((check) => !check.ok).length,
    },
    checks,
    dom,
  };

  fs.writeFileSync(outJSON, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(outMD, renderMarkdown(report));
  console.log(`${outJSON} (${report.summary.failed} failed)`);
  if (report.summary.failed > 0) process.exitCode = 1;
}

function readSourceEvidence() {
  const officialExists = fs.existsSync(officialAsset);
  const officialText = officialExists ? fs.readFileSync(officialAsset, "utf8") : "";
  const markdownCSSExists = fs.existsSync(officialMarkdownCSS);
  const markdownCSSText = markdownCSSExists ? fs.readFileSync(officialMarkdownCSS, "utf8") : "";
  const appCSSExists = fs.existsSync(officialAppCSS);
  const appCSSText = appCSSExists ? fs.readFileSync(officialAppCSS, "utf8") : "";
  const officialCSSText = `${markdownCSSText}\n${appCSSText}`;
  return {
    files: {
      official: { path: officialAsset, exists: officialExists, bytes: officialExists ? fs.statSync(officialAsset).size : 0 },
      markdownCSS: { path: officialMarkdownCSS, exists: markdownCSSExists, bytes: markdownCSSExists ? fs.statSync(officialMarkdownCSS).size : 0 },
      appCSS: { path: officialAppCSS, exists: appCSSExists, bytes: appCSSExists ? fs.statSync(officialAppCSS).size : 0 },
    },
    checks: [
      {
        name: "official local conversation turn asset present",
        ok: officialExists && officialText.length > 0,
        details: officialExists ? `${officialText.length} bytes` : "missing",
      },
      ...officialSnippets.map((snippet) => ({
        name: `official source contains: ${snippet}`,
        ok: officialText.includes(snippet),
        details: snippet,
      })),
      {
        name: "official markdown CSS asset present",
        ok: markdownCSSExists && markdownCSSText.length > 0,
        details: markdownCSSExists ? `${markdownCSSText.length} bytes` : "missing",
      },
      {
        name: "official app CSS asset present",
        ok: appCSSExists && appCSSText.length > 0,
        details: appCSSExists ? `${appCSSText.length} bytes` : "missing",
      },
      ...officialCSSSnippets.map((snippet) => ({
        name: `official CSS contains: ${snippet}`,
        ok: officialCSSText.includes(snippet),
        details: snippet,
      })),
    ],
  };
}

function classHas(className, tokens) {
  const text = String(className || "");
  return tokens.every((token) => text.includes(token));
}

function fixtureURL(baseURL) {
  const url = new URL(baseURL);
  url.searchParams.set("codexFixture", "reference");
  url.searchParams.set("auditRun", RUN_ID);
  return url.toString();
}

function auditExpression() {
  return `(async () => {
    const root = document.querySelector("#codexPanel")?.shadowRoot;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const settle = async () => {
      for (let index = 0; index < 5; index += 1) await new Promise((resolve) => requestAnimationFrame(resolve));
      await sleep(120);
    };
    const visible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const textOf = (element, limit = 320) => (element?.innerText || element?.textContent || "").replace(/\\s+/g, " ").trim().slice(0, limit);
    const all = (selector, base = root) => Array.from(base?.querySelectorAll(selector) || []);
    const scroll = root?.querySelector("[data-thread-scroll]");
    const cardForHeader = (header) => header?.closest("[class*='--thread-resource-card-row-padding-x']") || header?.closest(".flex.max-w-full") || header?.parentElement || null;
    const showMoreForCard = (card) => card
      ? all("button[aria-expanded]", card).find((button) => visible(button) && button.className.includes("text-token-text-primary")) || null
      : null;
    let header = null;
    let fallbackHeader = null;
    for (let index = 0; scroll && index < 32; index += 1) {
      const headers = all("[class*='group/turn-diff-header']").filter(visible);
      fallbackHeader ||= headers[0] || null;
      header = headers.find((node) => showMoreForCard(cardForHeader(node))) || null;
      if (header) break;
      const step = Math.max(240, scroll.clientHeight * 0.75);
      const maxScroll = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
      const nextTop = Math.min(maxScroll, scroll.scrollTop + step);
      if (nextTop === scroll.scrollTop && index > 0) break;
      scroll.scrollTop = nextTop;
      scroll.dispatchEvent(new Event("scroll", { bubbles: true }));
      await settle();
    }
    header ||= fallbackHeader;
    if (!header) return { ok: false, reason: "diff header not found" };

    const card = cardForHeader(header);
    const fileList = card ? all("[class*='--codex-diffs-header-padding-x']", card).find(visible) || null : null;
    const fileRows = all(".thread-diff-virtualized", card).filter(visible);
    const firstFileRow = fileRows[0] || null;
    const firstFileButton = firstFileRow?.querySelector("button") || null;
    const additionsDeletion = firstFileButton
      ? all("[data-thread-find-skip='true'] span", firstFileButton).map((node) => textOf(node, 40)).filter(Boolean)
      : [];
    const showMore = showMoreForCard(card);
    const inlineLink = all("._tableCellFileLink_lzkx4_413").find(visible) || null;
    const inlineWrapper = inlineLink?.closest("[role='button']") || null;
    const headerOverlay = header.querySelector("button.absolute.inset-0") || all("button", header).find((button) => button.className.includes("absolute") && button.className.includes("inset-0")) || null;
    const iconBlock = all("span", header).find((node) => String(node.className || "").includes("size-10") && String(node.className || "").includes("bg-token-bg-secondary")) || null;
    const defaultSubtitle = header.querySelector(".turn-diff-default-subtitle") || null;
    const hoverSubtitle = header.querySelector(".turn-diff-hover-subtitle") || null;
    const dirNode = firstFileButton?.querySelector(".text-token-description-foreground") || null;
    const nameNode = firstFileButton?.querySelector(".text-token-foreground") || null;
    return {
      ok: true,
      scrollTop: Math.round(scroll?.scrollTop || 0),
      diffCard: {
        found: !!card,
        className: String(card?.className || ""),
        text: textOf(card),
        rect: rectOf(card),
      },
      header: {
        found: !!header,
        className: String(header?.className || ""),
        text: textOf(header),
        rect: rectOf(header),
      },
      headerOverlay: {
        found: !!headerOverlay,
        className: String(headerOverlay?.className || ""),
        ariaLabel: headerOverlay?.getAttribute("aria-label") || "",
      },
      iconBlock: {
        found: !!iconBlock,
        className: String(iconBlock?.className || ""),
      },
      defaultSubtitle: {
        found: !!defaultSubtitle,
        className: String(defaultSubtitle?.className || ""),
        text: textOf(defaultSubtitle),
      },
      hoverSubtitle: {
        found: !!hoverSubtitle,
        className: String(hoverSubtitle?.className || ""),
        text: textOf(hoverSubtitle),
      },
      fileList: {
        found: !!fileList,
        className: String(fileList?.className || ""),
      },
      fileRows: fileRows.map((row, index) => ({
        index,
        className: String(row.className || ""),
        text: textOf(row),
        rect: rectOf(row),
      })),
      firstFileRow: {
        found: !!firstFileRow,
        buttonClassName: String(firstFileButton?.className || ""),
        srOnlyText: textOf(firstFileButton?.querySelector(".sr-only"), 160),
        dirText: textOf(dirNode, 160),
        nameText: textOf(nameNode, 160),
        additionsText: additionsDeletion[0] || "",
        deletionsText: additionsDeletion[1] || "",
      },
      showMore: {
        found: !!showMore,
        className: String(showMore?.className || ""),
        text: textOf(showMore),
        ariaExpanded: showMore?.getAttribute("aria-expanded") || "",
      },
      inlineMention: {
        found: !!inlineLink,
        text: textOf(inlineLink),
        linkClassName: String(inlineLink?.className || ""),
        wrapperClassName: String(inlineWrapper?.className || ""),
        role: inlineWrapper?.getAttribute("role") || "",
      },
    };

    function rectOf(element) {
      const rect = element?.getBoundingClientRect?.() || { x: 0, y: 0, width: 0, height: 0 };
      return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
    }
  })()`;
}

function renderMarkdown(report) {
  const lines = [
    "# Codex File Diff Audit",
    "",
    `Generated: ${report.generatedAt}`,
    `Fixture: ${report.fixtureURL}`,
    `Viewport: ${report.viewport.width}x${report.viewport.height}`,
    `Sidebar: ${report.sidebarWidth}px`,
    "",
    "## Summary",
    "",
    `- Checks: ${report.summary.checks}`,
    `- Failed: ${report.summary.failed}`,
    "",
    "## Checks",
    "",
    "| Check | Status | Details |",
    "| --- | --- | --- |",
  ];
  for (const check of report.checks) {
    lines.push(`| ${escapeMD(check.name)} | ${check.ok ? "ok" : "fail"} | ${escapeMD(String(check.details || ""))} |`);
  }
  lines.push(
    "",
    "## DOM Evidence",
    "",
    "```json",
    JSON.stringify(report.dom, null, 2),
    "```",
  );
  return `${lines.join("\n")}\n`;
}

function escapeMD(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

async function createPageTarget(url) {
  const response = await fetch(`${CDP}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  if (!response.ok) throw new Error(`create target: ${response.status} ${response.statusText}`);
  return response.json();
}

async function closePageTarget(id) {
  if (!id) return;
  await fetch(`${CDP}/json/close/${encodeURIComponent(id)}`);
}

async function navigate(page, url) {
  await page.send("Page.navigate", { url });
  await waitFor(page, `location.href === ${JSON.stringify(url)}`, 30000, "navigation target");
  await waitFor(page, `document.readyState === "complete" || document.readyState === "interactive"`, 30000, "page load");
}

async function clickShadow(page, selector, index = 0) {
  await waitForShadow(page, selector);
  const clicked = await evalPage(page, `(() => {
    const root = document.querySelector("#codexPanel")?.shadowRoot;
    const nodes = Array.from(root?.querySelectorAll(${JSON.stringify(selector)}) || []);
    const el = nodes[${JSON.stringify(index)}] || nodes[0];
    if (!el) return false;
    el.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`failed to click ${selector}`);
}

async function waitForShadow(page, selector, timeoutMs = 30000) {
  await waitFor(
    page,
    `!!document.querySelector("#codexPanel")?.shadowRoot?.querySelector(${JSON.stringify(selector)})`,
    timeoutMs,
    selector,
  );
}

async function hasShadow(page, selector, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const found = await evalPage(page, `Boolean(document.querySelector("#codexPanel")?.shadowRoot?.querySelector(${JSON.stringify(selector)}))`).catch(() => false);
    if (found) return true;
    await wait(100);
  }
  return false;
}

async function waitFor(page, expression, timeoutMs, label) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evalPage(page, `(() => { try { return Boolean(${expression}); } catch { return false; } })()`)) return;
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function evalPage(page, expression) {
  const result = await page.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Runtime.evaluate failed");
  }
  return result.result.value;
}

async function connect(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(`${entry.method}: ${message.error.message}`));
    else entry.resolve(message.result || {});
  });
  return {
    send(method, params = {}) {
      const messageId = ++id;
      socket.send(JSON.stringify({ id: messageId, method, params }));
      return new Promise((resolve, reject) => pending.set(messageId, { method, resolve, reject }));
    },
    close() {
      if (socket.readyState === WebSocket.CLOSED) return Promise.resolve();
      return new Promise((resolve) => {
        const done = () => resolve();
        socket.addEventListener("close", done, { once: true });
        socket.close();
        setTimeout(done, 250);
      });
    },
  };
}
