#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const CDP = process.env.CDP_URL || "http://127.0.0.1:9222";
const PANEL_URL = process.env.PANEL_URL || "http://127.0.0.1:58888/";
const TARGET_SESSION_ID = process.env.TARGET_SESSION_ID || "";
const TARGET_NODE_ID = process.env.TARGET_NODE_ID || "";
const VIEWPORT_WIDTH = Number(process.env.VIEWPORT_WIDTH || 1920);
const VIEWPORT_HEIGHT = Number(process.env.VIEWPORT_HEIGHT || 1080);
const SIDEBAR_WIDTH = Number(process.env.SIDEBAR_WIDTH || 611);
const DISCLOSURE_TEXT_PATTERN = new RegExp(process.env.DISCLOSURE_TEXT_PATTERN || "已处理|Processed|已编辑|Edited|正在|Running|Thinking", "i");
const MAX_SCROLL_STEPS = Number(process.env.MAX_DISCLOSURE_SCROLL_STEPS || 80);

const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, "reference", "codex-reference");
const outJSON = path.join(outDir, "disclosure-anchor-probe.json");
const outMD = path.join(outDir, "disclosure-anchor-probe.md");
const runID = new Date().toISOString().replace(/\D/g, "");

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const target = await createPageTarget("about:blank");
  const page = await connect(target.webSocketDebuggerUrl);
  let probe = null;
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

    const url = probeURL(PANEL_URL);
    await navigate(page, url);
    await configurePage(page);
    await navigate(page, url);
    await waitForShadow(page, "[data-codex-view]", 30000);
    await openTargetSession(page);
    await waitForShadow(page, "[data-thread-scroll]", 30000);
    await waitForShadow(page, "[data-codex-virtual-turn], [data-turn-key], [data-content-search-unit-key]", 60000);
    await wait(300);
    probe = await evalPage(page, probeExpression(DISCLOSURE_TEXT_PATTERN));
  } finally {
    await page.close();
    await closePageTarget(target.id).catch(() => {});
  }

  const checks = [
    { name: "viewport is 1920x1080 or larger", ok: VIEWPORT_WIDTH >= 1920 && VIEWPORT_HEIGHT >= 1080, details: `${VIEWPORT_WIDTH}x${VIEWPORT_HEIGHT}` },
    { name: "thread scroll container found", ok: Boolean(probe?.scrollFound), details: probe?.reason || "" },
    { name: "matching disclosure toggle found", ok: Boolean(probe?.toggle?.found), details: probe?.toggle?.text || probe?.reason || "" },
    { name: "toggle is visible before expand", ok: Boolean(probe?.before?.visible), details: rectDetails(probe?.before?.rect) },
    { name: "body expands", ok: probe?.after?.expanded === "true" && Number(probe?.after?.body?.height || 0) > 1, details: JSON.stringify(probe?.after?.body || {}) },
    { name: "expanded toggle remains visible", ok: Boolean(probe?.after?.visible), details: rectDetails(probe?.after?.rect) },
    { name: "expanded toggle remains anchored", ok: Math.abs(Number(probe?.deltaTop || 0)) <= 8, details: `${probe?.deltaTop ?? ""}px` },
  ];
  const report = {
    generatedAt: new Date().toISOString(),
    panelURL: probeURL(PANEL_URL),
    viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
    sidebarWidth: SIDEBAR_WIDTH,
    targetSessionId: TARGET_SESSION_ID,
    targetNodeId: TARGET_NODE_ID,
    summary: {
      checks: checks.length,
      failed: checks.filter((check) => !check.ok).length,
    },
    checks,
    probe,
  };

  fs.writeFileSync(outJSON, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(outMD, renderMarkdown(report));
  console.log(`${outJSON} (${report.summary.failed} failed)`);
  if (report.summary.failed > 0) process.exitCode = 1;
}

function probeURL(rawURL) {
  const url = new URL(rawURL);
  url.searchParams.set("disclosureProbe", runID);
  if (/^(127\.0\.0\.1|localhost)$/i.test(url.hostname)) {
    url.searchParams.set("codexFixture", process.env.DISCLOSURE_FIXTURE || "dynamic");
  }
  if (TARGET_NODE_ID && !url.searchParams.has("nodeId")) url.searchParams.set("nodeId", TARGET_NODE_ID);
  return url.toString();
}

async function configurePage(page) {
  await evalPage(page, `(() => {
    try {
      localStorage.setItem("codex-web:sidebar-width", ${JSON.stringify(String(SIDEBAR_WIDTH))});
      ${TARGET_NODE_ID ? `localStorage.setItem("codex-web:node-id", ${JSON.stringify(TARGET_NODE_ID)});` : ""}
      document.documentElement.style.setProperty("--cw-sidebar-width", ${JSON.stringify(`${SIDEBAR_WIDTH}px`)});
    } catch {}
  })()`);
}

async function openTargetSession(page) {
  if (!TARGET_SESSION_ID) return;
  await waitFor(
    page,
    `(() => {
      const root = document.querySelector("#codexPanel")?.shadowRoot;
      return Boolean(root?.querySelector("[data-thread-scroll]") || root?.querySelector(${JSON.stringify(`[data-codex-session-id="${TARGET_SESSION_ID}"]`)}));
    })()`,
    60000,
    `target session ${TARGET_SESSION_ID}`,
  );
  await evalPage(page, `(() => {
    const root = document.querySelector("#codexPanel")?.shadowRoot;
    if (!root || root.querySelector("[data-thread-scroll]")) return true;
    const row = root.querySelector(${JSON.stringify(`[data-codex-session-id="${TARGET_SESSION_ID}"]`)});
    if (!row) return false;
    row.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, view: window }));
    return true;
  })()`);
}

function probeExpression(pattern) {
  return `(async () => {
    const root = document.querySelector("#codexPanel")?.shadowRoot;
    const scroll = root?.querySelector("[data-thread-scroll]");
    const pattern = new RegExp(${JSON.stringify(pattern.source)}, ${JSON.stringify(pattern.flags)});
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const settle = async () => {
      for (let index = 0; index < 8; index += 1) await new Promise((resolve) => requestAnimationFrame(resolve));
      await sleep(160);
    };
    const rectOf = (element) => {
      const rect = element?.getBoundingClientRect?.();
      if (!rect) return null;
      return {
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };
    const bodyForToggle = (toggle) => {
      if (!toggle) return null;
      const sibling = toggle.nextElementSibling;
      if (sibling?.hasAttribute("aria-hidden")) return sibling;
      return Array.from(toggle.parentElement?.children || []).find((child) => child !== toggle && child.hasAttribute("aria-hidden")) || null;
    };
    const textOf = (element) => (element?.innerText || element?.textContent || "").replace(/\\s+/g, " ").trim();
    const viewportRect = () => {
      const rect = scroll?.getBoundingClientRect?.();
      if (rect && rect.height > 1 && rect.width > 1) return rect;
      return { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth };
    };
    const scrollMetrics = () => ({
      top: Math.round(scroll?.scrollTop || window.scrollY || 0),
      height: Math.round(scroll?.scrollHeight || document.documentElement.scrollHeight || 0),
      clientHeight: Math.round(scroll?.clientHeight || window.innerHeight || 0),
    });
    const setScrollTop = (value) => {
      if (scroll && scroll.clientHeight > 1 && scroll.scrollHeight > scroll.clientHeight) {
        scroll.scrollTop = value;
        scroll.dispatchEvent(new Event("scroll", { bubbles: true }));
        return;
      }
      window.scrollTo(0, value);
      window.dispatchEvent(new Event("scroll", { bubbles: true }));
    };
    const inScrollViewport = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const viewport = viewportRect();
      return rect.bottom > viewport.top && rect.top < viewport.bottom;
    };
    const visible = (element) => {
      if (!element || !inScrollViewport(element)) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
    };
    const allToggles = () => Array.from(root?.querySelectorAll("[data-disclosure-toggle][aria-expanded]") || [])
      .filter((toggle) => bodyForToggle(toggle));
    const matchingVisibleToggle = () => allToggles().find((toggle) => visible(toggle) && pattern.test(textOf(toggle))) || null;
    const anyVisibleToggle = () => allToggles().find((toggle) => visible(toggle)) || null;
    if (!root || !scroll) return { ok: false, scrollFound: false, reason: "missing codex shadow root or thread scroll" };

    setScrollTop(scroll.scrollHeight || document.documentElement.scrollHeight || 0);
    await settle();

    let toggle = matchingVisibleToggle();
    for (let step = 0; !toggle && step < ${MAX_SCROLL_STEPS}; step += 1) {
      const metrics = scrollMetrics();
      setScrollTop(Math.max(0, metrics.top - Math.max(180, metrics.clientHeight * 0.55)));
      await settle();
      toggle = matchingVisibleToggle();
    }
    toggle ||= anyVisibleToggle();
    if (!toggle) {
      return {
        ok: false,
        scrollFound: true,
        reason: "no visible disclosure toggle found",
        toggleCount: allToggles().length,
        scroll: scrollMetrics(),
      };
    }

    const key = toggle.getAttribute("data-disclosure-toggle") || "";
    const findToggle = () => Array.from(root.querySelectorAll("[data-disclosure-toggle]")).find((node) => node.getAttribute("data-disclosure-toggle") === key) || null;
    const collapse = async () => {
      const node = findToggle();
      if (node?.getAttribute("aria-expanded") === "true") {
        node.click();
        await settle();
      }
    };
    const expand = async () => {
      const node = findToggle();
      if (node?.getAttribute("aria-expanded") !== "true") {
        node.click();
        await settle();
      }
    };
    const snapshot = (label) => {
      const node = findToggle();
      const body = bodyForToggle(node);
      return {
        label,
        found: Boolean(node),
        visible: visible(node),
        expanded: node?.getAttribute("aria-expanded") || "",
        text: textOf(node).slice(0, 220),
        rect: rectOf(node),
        scroll: scrollMetrics(),
        body: {
          found: Boolean(body),
          ariaHidden: body?.getAttribute("aria-hidden") || "",
          height: Math.round(body?.getBoundingClientRect?.().height || 0),
        },
      };
    };

    await collapse();
    const centered = findToggle();
    centered?.scrollIntoView({ block: "center", inline: "nearest" });
    scroll?.dispatchEvent(new Event("scroll", { bubbles: true }));
    window.dispatchEvent(new Event("scroll", { bubbles: true }));
    await settle();
    const before = snapshot("before-expand");
    await expand();
    const after = snapshot("after-expand");
    return {
      ok: true,
      scrollFound: true,
      toggle: { found: true, key, text: before.text },
      before,
      after,
      deltaTop: Math.round((after.rect?.top || 0) - (before.rect?.top || 0)),
    };
  })()`;
}

function rectDetails(rect) {
  if (!rect) return "";
  return `top=${rect.top}, bottom=${rect.bottom}, height=${rect.height}`;
}

function renderMarkdown(report) {
  const lines = [
    "# Codex Disclosure Anchor Probe",
    "",
    `Generated: ${report.generatedAt}`,
    `Panel: ${report.panelURL}`,
    `Viewport: ${report.viewport.width}x${report.viewport.height}`,
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
  lines.push("", "## Probe", "", "```json", JSON.stringify(report.probe, null, 2), "```", "");
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
      if (socket.readyState === WebSocket.CLOSED) return Promise.resolve();
      return new Promise((resolve) => {
        const timer = setTimeout(resolve, 250);
        socket.addEventListener("close", () => {
          clearTimeout(timer);
          resolve();
        }, { once: true });
        socket.close();
      });
    },
  };
}
