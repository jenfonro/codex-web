#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const CDP = process.env.CDP_URL || "http://127.0.0.1:9222";
const APP_URL = process.env.PANEL_URL || "http://127.0.0.1:58888/";
const SIDEBAR_WIDTH = Number(process.env.SIDEBAR_WIDTH || 611);
const VIEWPORT_WIDTH = Number(process.env.VIEWPORT_WIDTH || 1920);
const VIEWPORT_HEIGHT = Number(process.env.VIEWPORT_HEIGHT || 1080);
const FIXTURE_MODE = process.env.DISCLOSURE_FIXTURE || "dynamic";
const DISCLOSURE_TEXT_PATTERN = new RegExp(process.env.DISCLOSURE_TEXT_PATTERN || "已处理|Processed|已编辑|Edited|正在|Running|Thinking", "i");
const REQUIRE_DISCLOSURE_MATCH = process.env.REQUIRE_DISCLOSURE_MATCH !== "0";
const RUN_ID = new Date().toISOString().replace(/\D/g, "");

const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, "reference", "codex-reference");
const outJSON = path.join(outDir, "disclosure-collapse-audit.json");
const outMD = path.join(outDir, "disclosure-collapse-audit.md");
const officialAsset = path.join(
  repoRoot,
  "reference",
  "extension-source",
  "openai.chatgpt-26.5623.31443",
  "webview",
  "assets",
  "tool-activity-disclosure-BLOD7VGb.js",
);

const officialSnippets = [
  "group/activity-header inline-flex min-w-0 max-w-full self-start items-center gap-1.5 p-0 text-left",
  "animate:{height:O?w:0,opacity:O?1:0}",
  '"aria-hidden":!O,inert:!O',
  "className:O?`overflow-visible`:`overflow-hidden`",
  "style:{pointerEvents:O?`auto`:`none`}",
  "flex flex-col gap-2 pt-2 pb-1",
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
    await waitForShadow(page, "[data-codex-view='thread']");
    await waitForShadow(page, "[data-codex-virtual-turn]");
    await wait(300);
    dom = await evalPage(page, auditExpression(DISCLOSURE_TEXT_PATTERN));
  } finally {
    page.close();
    await closePageTarget(target.id).catch(() => {});
  }

  const collapsed = dom?.collapsed || {};
  const expanded = dom?.expanded || {};
  const recollapsed = dom?.recollapsed || {};
  const anchor = dom?.anchor || {};
  const checks = [
    ...sourceEvidence.checks,
    { name: "viewport is 1920x1080 or larger", ok: VIEWPORT_WIDTH >= 1920 && VIEWPORT_HEIGHT >= 1080, details: `${VIEWPORT_WIDTH}x${VIEWPORT_HEIGHT}` },
    { name: "sidebar target is wide enough", ok: SIDEBAR_WIDTH >= 580, details: `${SIDEBAR_WIDTH}px` },
    { name: "official-style disclosure toggle found", ok: Boolean(dom?.toggle?.found), details: dom?.toggle?.text || dom?.reason || "" },
    { name: "audited disclosure body found", ok: Boolean(dom?.collapsed?.bodyFound), details: dom?.collapsed?.className || "" },
    { name: "collapsed body retains DOM text", ok: Number(collapsed.domTextLength || 0) > 0, details: `${collapsed.domTextLength || 0}` },
    { name: "collapsed body is aria-hidden", ok: collapsed.ariaHidden === "true", details: collapsed.ariaHidden || "" },
    { name: "collapsed body is inert", ok: Boolean(collapsed.inert), details: String(Boolean(collapsed.inert)) },
    { name: "collapsed body uses overflow-hidden", ok: /overflow-hidden/.test(collapsed.className || "") || collapsed.overflow === "hidden", details: `${collapsed.className || ""} ${collapsed.overflow || ""}` },
    { name: "collapsed body has zero visual height", ok: Number(collapsed.rectHeight || 0) <= 1, details: `${collapsed.rectHeight || 0}px` },
    { name: "collapsed body opacity is zero", ok: collapsed.opacity === "0", details: collapsed.opacity || "" },
    { name: "collapsed body ignores pointer events", ok: collapsed.pointerEvents === "none", details: collapsed.pointerEvents || "" },
    { name: "collapsed body has no visible text", ok: !collapsed.visibleText, details: collapsed.visibleText || "" },
    { name: "collapsed body has no visible descendants", ok: Number(collapsed.visibleDescendantCount || 0) === 0, details: `${collapsed.visibleDescendantCount || 0}` },
    { name: "expanded body is not aria-hidden", ok: expanded.ariaHidden === "false", details: expanded.ariaHidden || "" },
    { name: "expanded body is not inert", ok: !expanded.inert, details: String(Boolean(expanded.inert)) },
    { name: "expanded body uses overflow-visible", ok: /overflow-visible/.test(expanded.className || "") || expanded.overflow === "visible", details: `${expanded.className || ""} ${expanded.overflow || ""}` },
    { name: "expanded body has visual height", ok: Number(expanded.rectHeight || 0) > 20, details: `${expanded.rectHeight || 0}px` },
    { name: "expanded body exposes visible text", ok: Boolean(expanded.visibleText), details: expanded.visibleText || "" },
    { name: "expanded disclosure keeps toggle anchored", ok: Math.abs(Number(anchor.expandDeltaTop || 0)) <= 4, details: `${anchor.expandDeltaTop || 0}px` },
    { name: "re-collapsed body hides again", ok: recollapsed.ariaHidden === "true" && Number(recollapsed.rectHeight || 0) <= 1 && !recollapsed.visibleText, details: `aria=${recollapsed.ariaHidden || ""}, height=${recollapsed.rectHeight || 0}, text=${recollapsed.visibleText || ""}` },
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    fixtureURL: url,
    basis: "Disclosure collapse audit. The source snippets are read from the official extension asset; DOM evidence is collected by expanding and collapsing an official-style local disclosure. This intentionally does not target Codex Web-only exec_command grouping.",
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
  if (report.summary.failed > 0) process.exit(1);
}

function readSourceEvidence() {
  const exists = fs.existsSync(officialAsset);
  const text = exists ? fs.readFileSync(officialAsset, "utf8") : "";
  return {
    file: {
      path: officialAsset,
      exists,
      bytes: exists ? fs.statSync(officialAsset).size : 0,
    },
    checks: [
      {
        name: "official disclosure asset present",
        ok: exists && text.length > 0,
        details: exists ? `${text.length} bytes` : "missing",
      },
      ...officialSnippets.map((snippet) => ({
        name: `official source contains: ${snippet}`,
        ok: text.includes(snippet),
        details: snippet,
      })),
    ],
  };
}

function fixtureURL(baseURL) {
  const url = new URL(baseURL);
  url.searchParams.set("codexFixture", FIXTURE_MODE);
  url.searchParams.set("auditRun", RUN_ID);
  return url.toString();
}

function auditExpression(pattern) {
  return `(async () => {
    const root = document.querySelector("#codexPanel")?.shadowRoot;
    const pattern = new RegExp(${JSON.stringify(pattern.source)}, ${JSON.stringify(pattern.flags)});
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const settle = async () => {
      for (let index = 0; index < 5; index += 1) await new Promise((resolve) => requestAnimationFrame(resolve));
      await sleep(120);
    };
    const hiddenByAncestor = (element) => {
      let node = element;
      while (node && node.nodeType === Node.ELEMENT_NODE) {
        const style = getComputedStyle(node);
        if (
          node.hidden ||
          node.inert ||
          node.getAttribute("aria-hidden") === "true" ||
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.opacity === "0"
        ) {
          return true;
        }
        const rect = node.getBoundingClientRect();
        if (style.overflow === "hidden" && rect.width <= 0 && rect.height <= 0) return true;
        node = node.parentElement;
      }
      return false;
    };
    const visible = (element) => {
      if (!element || hiddenByAncestor(element)) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const visibleTextOf = (element, limit = 220) => {
      if (!element) return "";
      const chunks = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const text = (node.nodeValue || "").replace(/\\s+/g, " ").trim();
        if (!text || !visible(node.parentElement)) continue;
        chunks.push(text);
        if (chunks.join(" ").length >= limit) break;
      }
      return chunks.join(" ").replace(/\\s+/g, " ").trim().slice(0, limit);
    };
    const rawTextOf = (element, limit = 220) => (element?.textContent || "").replace(/\\s+/g, " ").trim().slice(0, limit);
    const bodyForToggle = (toggle) => {
      if (!toggle) return null;
      const sibling = toggle.nextElementSibling;
      if (sibling?.hasAttribute("aria-hidden")) return sibling;
      const direct = Array.from(toggle.parentElement?.children || []).find((child) => child !== toggle && child.hasAttribute("aria-hidden"));
      if (direct) return direct;
      let container = toggle.parentElement;
      for (let depth = 0; container && depth < 4; depth += 1, container = container.parentElement) {
        const children = Array.from(container.children || []);
        const nested = children.find((child) => child !== toggle && child.hasAttribute("aria-hidden"));
        if (nested) return nested;
      }
      return null;
    };
    const scroll = root?.querySelector("[data-thread-scroll]");
    const inScrollViewport = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const viewport = scroll?.getBoundingClientRect?.() || { top: 0, bottom: window.innerHeight };
      return rect.bottom > viewport.top && rect.top < viewport.bottom;
    };
    const allToggles = () => Array.from(root?.querySelectorAll("[data-disclosure-toggle][aria-expanded]") || [])
      .filter((toggle) => visible(toggle) && inScrollViewport(toggle) && bodyForToggle(toggle));
    const matchingOfficialToggle = () => allToggles().find((toggle) => pattern.test(rawTextOf(toggle))) || null;
    const findAnyToggle = () => ${REQUIRE_DISCLOSURE_MATCH ? "matchingOfficialToggle()" : "matchingOfficialToggle() || allToggles()[0] || null"};
    let toggle = findAnyToggle();
    for (let index = 0; !toggle && scroll && index < 20; index += 1) {
      scroll.scrollTop = Math.max(0, scroll.scrollTop - Math.max(240, scroll.clientHeight * 0.75));
      scroll.dispatchEvent(new Event("scroll", { bubbles: true }));
      await settle();
      toggle = findAnyToggle();
    }
    if (!toggle) return { ok: false, reason: ${JSON.stringify(REQUIRE_DISCLOSURE_MATCH ? "no matching disclosure toggle with body found" : "no disclosure toggle with body found")} };
    const key = toggle.getAttribute("data-disclosure-toggle") || "";
    const findByKey = () => {
      if (key) {
        const keyed = Array.from(root.querySelectorAll("[data-disclosure-toggle]")).find((node) => node.getAttribute("data-disclosure-toggle") === key);
        if (keyed) return keyed;
      }
      return findAnyToggle();
    };
    const clickIf = async (expanded) => {
      const node = findByKey();
      if (node && node.getAttribute("aria-expanded") !== String(expanded)) {
        node.click();
        await settle();
      }
    };
    const scrollToggleIntoView = async () => {
      const node = findByKey();
      if (!node) return;
      node.scrollIntoView({ block: "center", inline: "nearest" });
      await settle();
    };
    const anchorSnapshot = () => {
      const node = findByKey();
      const rect = node?.getBoundingClientRect?.() || { top: 0, bottom: 0, height: 0 };
      return {
        found: !!node,
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        height: Math.round(rect.height),
        scrollTop: Math.round(scroll?.scrollTop || 0),
      };
    };
    const snapshot = (label) => {
      const node = findByKey();
      const body = bodyForToggle(node);
      const rect = body?.getBoundingClientRect?.() || { width: 0, height: 0 };
      const style = body ? getComputedStyle(body) : null;
      return {
        label,
        toggleFound: !!node,
        bodyFound: !!body,
        ariaExpanded: node?.getAttribute("aria-expanded") || "",
        ariaHidden: body?.getAttribute("aria-hidden") || "",
        inert: Boolean(body?.inert),
        className: String(body?.className || ""),
        rectWidth: Math.round(rect.width),
        rectHeight: Math.round(rect.height),
        overflow: style?.overflow || "",
        opacity: style?.opacity || "",
        pointerEvents: style?.pointerEvents || "",
        domTextLength: (body?.textContent || "").replace(/\\s+/g, " ").trim().length,
        visibleText: visibleTextOf(body),
        rawText: rawTextOf(body),
        visibleDescendantCount: Array.from(body?.querySelectorAll("*") || []).filter(visible).length,
      };
    };
    await clickIf(false);
    await scrollToggleIntoView();
    const collapsed = snapshot("collapsed");
    const anchorBeforeExpand = anchorSnapshot();
    await clickIf(true);
    const expanded = snapshot("expanded");
    const anchorAfterExpand = anchorSnapshot();
    await clickIf(false);
    const recollapsed = snapshot("recollapsed");
    return {
      ok: true,
      toggle: {
        found: true,
        key,
        text: rawTextOf(findByKey()),
        className: String(findByKey()?.className || ""),
      },
      collapsed,
      expanded,
      anchor: {
        beforeExpand: anchorBeforeExpand,
        afterExpand: anchorAfterExpand,
        expandDeltaTop: Math.round((anchorAfterExpand.top || 0) - (anchorBeforeExpand.top || 0)),
      },
      recollapsed,
    };
  })()`;
}

function renderMarkdown(report) {
  const lines = [
    "# Codex Disclosure Collapse Audit",
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
    "",
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

async function waitForShadow(page, selector, timeoutMs = 30000) {
  await waitFor(
    page,
    `!!document.querySelector("#codexPanel")?.shadowRoot?.querySelector(${JSON.stringify(selector)})`,
    timeoutMs,
    selector,
  );
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
      socket.close();
    },
  };
}
