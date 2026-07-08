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
const outJSON = path.join(outDir, "workspace-native-interactions-audit.json");
const outMD = path.join(outDir, "workspace-native-interactions-audit.md");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const scrollURL = fixtureURL(APP_URL, "virtual-scroll");
  const disclosureURL = fixtureURL(APP_URL, "dynamic");
  const url = scrollURL;
  const target = await createPageTarget(url);
  const page = await connect(target.webSocketDebuggerUrl);
  let audit = null;
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
    await page.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        localStorage.setItem("codex-web:workspace-view", "codex");
        localStorage.setItem("codex-web:sidebar-width", ${JSON.stringify(String(SIDEBAR_WIDTH))});
      `,
    });

    await navigate(page, url);
    await evalPage(page, `(() => {
      document.documentElement.style.setProperty("--cw-sidebar-width", ${JSON.stringify(`${SIDEBAR_WIDTH}px`)});
      window.dispatchEvent(new CustomEvent("codex-web:open-view", { detail: { view: "codex" } }));
      window.__codexNativeDragStarts = 0;
      document.addEventListener("dragstart", () => { window.__codexNativeDragStarts += 1; }, true);
    })()`);
    await waitFor(page, `!!document.querySelector(".monaco-workbench")`, 30000, "workspace shell");
    await waitForShadow(page, "[data-codex-view='thread']");
    await waitForShadow(page, "[data-thread-scroll]");
    await waitForShadow(page, "[data-codex-virtual-turn]");
    await wait(250);

    const shell = await evalPage(page, shellSnapshotExpression());
    await dragActiveActivityItem(page);
    const activityDrag = await evalPage(page, dragSnapshotExpression());
    await dragCodexPanelHeader(page);
    const headerDrag = await evalPage(page, dragSnapshotExpression());
    await dragCodexThreadContent(page);
    const contentDrag = await evalPage(page, dragSnapshotExpression());
    const scroll = await wheelThreadScroll(page);
    await navigate(page, disclosureURL);
    await evalPage(page, `(() => {
      document.documentElement.style.setProperty("--cw-sidebar-width", ${JSON.stringify(`${SIDEBAR_WIDTH}px`)});
      window.dispatchEvent(new CustomEvent("codex-web:open-view", { detail: { view: "codex" } }));
    })()`);
    await waitForShadow(page, "[data-codex-view='thread']");
    await waitForShadow(page, "[data-thread-scroll]");
    await waitForShadow(page, "[data-codex-virtual-turn]");
    await wait(250);
    const disclosure = await clickVisibleDisclosure(page);
    audit = { shell, activityDrag, headerDrag, contentDrag, scroll, disclosure };
  } finally {
    page.close();
    await closePageTarget(target.id).catch(() => {});
  }

  const checks = [
    { name: "workspace has no sidebar resize handle", ok: audit.shell.sidebarResizeHandleCount === 0, details: `${audit.shell.sidebarResizeHandleCount}` },
    { name: "workspace has no explicit draggable elements", ok: audit.shell.draggableAttributeCount === 0, details: `${audit.shell.draggableAttributeCount}` },
    { name: "workspace disables native user drag", ok: audit.shell.workbenchUserDrag === "none", details: audit.shell.workbenchUserDrag },
    { name: "codex shadow disables native user drag", ok: audit.shell.shadowRootUserDrag === "none", details: audit.shell.shadowRootUserDrag },
    { name: "codex panel has no app-region draggable header", ok: audit.shell.shadowDraggableClassCount === 0, details: `${audit.shell.shadowDraggableClassCount}` },
    { name: "activity drag gesture does not emit dragstart", ok: audit.activityDrag.dragStarts === 0, details: `${audit.activityDrag.dragStarts}` },
    { name: "panel header drag gesture does not emit dragstart", ok: audit.headerDrag.dragStarts === 0, details: `${audit.headerDrag.dragStarts}` },
    { name: "thread content drag gesture does not emit dragstart", ok: audit.contentDrag.dragStarts === 0, details: `${audit.contentDrag.dragStarts}` },
    { name: "long thread has scrollable content", ok: audit.scroll.maxScroll > VIEWPORT_HEIGHT, details: `max=${audit.scroll.maxScroll}` },
    { name: "mouse wheel changes long-thread scrollTop", ok: audit.scroll.changed, details: `before=${audit.scroll.before}, after=${audit.scroll.after}` },
    { name: "official-style disclosure toggle is visible", ok: audit.disclosure.found, details: audit.disclosure.text || audit.disclosure.reason || "" },
    { name: "real mouse click toggles disclosure", ok: Boolean(audit.disclosure.toggled), details: `before=${audit.disclosure.beforeExpanded}, after=${audit.disclosure.afterExpanded}` },
    { name: "disclosure click target is not blocked by overlay", ok: Boolean(audit.disclosure.clickedAtExpectedPoint), details: audit.disclosure.hitSummary || "" },
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    fixtureURL: scrollURL,
    disclosureFixtureURL: disclosureURL,
    viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
    sidebarWidth: SIDEBAR_WIDTH,
    basis: "Browser-level regression audit for app-owned workspace interactions: no native HTML drag preview, no sidebar resize sash, wheel scrolling works in long threads, and disclosure toggles receive real mouse clicks.",
    summary: {
      checks: checks.length,
      failed: checks.filter((check) => !check.ok).length,
    },
    checks,
    audit,
  };

  fs.writeFileSync(outJSON, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(outMD, renderMarkdown(report));
  console.log(`${outJSON} (${report.summary.failed} failed)`);
  if (report.summary.failed > 0) process.exit(1);
}

function fixtureURL(baseURL, mode) {
  const url = new URL(baseURL);
  url.searchParams.set("codexFixture", mode);
  url.searchParams.set("auditRun", RUN_ID);
  return url.toString();
}

function shellSnapshotExpression() {
  return `(() => ({
    sidebarResizeHandleCount: document.querySelectorAll(".sidebar-resize-handle").length,
    draggableAttributeCount: document.querySelectorAll("[draggable]").length + (document.querySelector("#codexPanel")?.shadowRoot?.querySelectorAll("[draggable]").length || 0),
    draggableAttributeLabels: [
      ...Array.from(document.querySelectorAll("[draggable]")),
      ...Array.from(document.querySelector("#codexPanel")?.shadowRoot?.querySelectorAll("[draggable]") || []),
    ].map((node) => node.getAttribute("aria-label") || node.className || node.tagName),
    workbenchUserDrag: getComputedStyle(document.querySelector(".monaco-workbench")).getPropertyValue("-webkit-user-drag") || getComputedStyle(document.querySelector(".monaco-workbench")).webkitUserDrag || "",
    shadowRootUserDrag: (() => {
      const root = document.querySelector("#codexPanel")?.shadowRoot?.querySelector("#root");
      if (!root) return "";
      const style = getComputedStyle(root);
      return style.getPropertyValue("-webkit-user-drag") || style.webkitUserDrag || "";
    })(),
    shadowDraggableClassCount: document.querySelector("#codexPanel")?.shadowRoot?.querySelectorAll(".draggable").length || 0,
    shadowHeaderCount: document.querySelector("#codexPanel")?.shadowRoot?.querySelectorAll(".codex-panel-header").length || 0,
  }))()`;
}

function dragSnapshotExpression() {
  return `(() => ({
    dragStarts: Number(window.__codexNativeDragStarts || 0),
    draggableAttributeCount: document.querySelectorAll("[draggable]").length + (document.querySelector("#codexPanel")?.shadowRoot?.querySelectorAll("[draggable]").length || 0),
    shadowDraggableClassCount: document.querySelector("#codexPanel")?.shadowRoot?.querySelectorAll(".draggable").length || 0,
  }))()`;
}

async function dragActiveActivityItem(page) {
  const rect = await evalPage(page, `(() => {
    const item = document.querySelector(".part.activitybar [data-workspace-view].checked") || document.querySelector(".part.activitybar [data-workspace-view]");
    const rect = item?.getBoundingClientRect?.();
    if (!rect) return null;
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  if (!rect) return;
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: rect.x, y: rect.y });
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
  for (let index = 1; index <= 6; index += 1) {
    await page.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: rect.x + index * 24,
      y: rect.y + index * 6,
      button: "left",
      buttons: 1,
    });
    await wait(30);
  }
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: rect.x + 160, y: rect.y + 42, button: "left", clickCount: 1 });
  await wait(150);
}

async function dragCodexPanelHeader(page) {
  await evalPage(page, `(() => { window.__codexNativeDragStarts = 0; })()`);
  const rect = await evalPage(page, `(() => {
    const root = document.querySelector("#codexPanel")?.shadowRoot;
    const item = root?.querySelector(".codex-panel-header");
    const rect = item?.getBoundingClientRect?.();
    if (!rect) return null;
    return { x: rect.left + Math.min(60, rect.width / 2), y: rect.top + rect.height / 2 };
  })()`);
  if (!rect) return;
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: rect.x, y: rect.y });
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
  for (let index = 1; index <= 6; index += 1) {
    await page.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: rect.x + index * 32,
      y: rect.y + index * 4,
      button: "left",
      buttons: 1,
    });
    await wait(30);
  }
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: rect.x + 210, y: rect.y + 24, button: "left", clickCount: 1 });
  await wait(150);
}

async function dragCodexThreadContent(page) {
  await evalPage(page, `(() => { window.__codexNativeDragStarts = 0; })()`);
  const rect = await evalPage(page, `(() => {
    const root = document.querySelector("#codexPanel")?.shadowRoot;
    const item =
      root?.querySelector("[data-user-message-bubble]") ||
      root?.querySelector("._markdownContent_lzkx4_60") ||
      root?.querySelector("[data-codex-virtual-turn]");
    const rect = item?.getBoundingClientRect?.();
    if (!rect) return null;
    return {
      x: rect.left + Math.min(Math.max(rect.width / 2, 4), Math.max(rect.width - 4, 4)),
      y: rect.top + Math.min(Math.max(rect.height / 2, 4), Math.max(rect.height - 4, 4)),
    };
  })()`);
  if (!rect) return;
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: rect.x, y: rect.y });
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
  for (let index = 1; index <= 6; index += 1) {
    await page.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: rect.x + index * 28,
      y: rect.y + index * 3,
      button: "left",
      buttons: 1,
    });
    await wait(30);
  }
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: rect.x + 180, y: rect.y + 20, button: "left", clickCount: 1 });
  await wait(150);
}

async function wheelThreadScroll(page) {
  const prepared = await evalPage(page, `(() => {
    const root = document.querySelector("#codexPanel")?.shadowRoot;
    const scroll = root?.querySelector("[data-thread-scroll]");
    if (!scroll) return { found: false, reason: "missing scroll node" };
    scroll.scrollTop = Math.max(0, scroll.scrollHeight - scroll.clientHeight - 8);
    scroll.dispatchEvent(new Event("scroll", { bubbles: true }));
    const rect = scroll.getBoundingClientRect();
    return {
      found: true,
      before: Math.round(scroll.scrollTop),
      maxScroll: Math.round(scroll.scrollHeight - scroll.clientHeight),
      x: Math.round(rect.left + rect.width / 2),
      y: Math.round(rect.top + Math.min(rect.height - 24, Math.max(24, rect.height / 2))),
    };
  })()`);
  if (!prepared?.found) return { ...prepared, changed: false, after: 0 };
  await wait(180);
  await page.send("Input.dispatchMouseEvent", {
    type: "mouseWheel",
    x: prepared.x,
    y: prepared.y,
    deltaX: 0,
    deltaY: -900,
  });
  await wait(450);
  const after = await evalPage(page, `(() => {
    const root = document.querySelector("#codexPanel")?.shadowRoot;
    const scroll = root?.querySelector("[data-thread-scroll]");
    return Math.round(scroll?.scrollTop || 0);
  })()`);
  return {
    ...prepared,
    after,
    changed: Number(after) < Number(prepared.before) - 20,
  };
}

async function clickVisibleDisclosure(page) {
  const prepared = await evalPage(page, disclosurePreparationExpression());
  if (!prepared?.found) return prepared || { found: false, reason: "no disclosure prepared" };
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: prepared.x, y: prepared.y });
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: prepared.x, y: prepared.y, button: "left", clickCount: 1 });
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: prepared.x, y: prepared.y, button: "left", clickCount: 1 });
  await wait(350);
  const after = await evalPage(page, `(() => {
    const root = document.querySelector("#codexPanel")?.shadowRoot;
    const key = ${JSON.stringify(prepared.key)};
    const toggle = Array.from(root?.querySelectorAll("[data-disclosure-toggle]") || []).find((node) => node.getAttribute("data-disclosure-toggle") === key);
    return {
      found: Boolean(toggle),
      afterExpanded: toggle?.getAttribute("aria-expanded") || "",
    };
  })()`);
  return {
    ...prepared,
    ...after,
    toggled: after?.found && prepared.beforeExpanded !== after.afterExpanded,
  };
}

function disclosurePreparationExpression() {
  return `(async () => {
    const root = document.querySelector("#codexPanel")?.shadowRoot;
    const scroll = root?.querySelector("[data-thread-scroll]");
    if (!root || !scroll) return { found: false, reason: "missing root or scroll" };
    const settle = async () => {
      for (let index = 0; index < 4; index += 1) await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => setTimeout(resolve, 120));
    };
    const visible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const bodyFor = (button) => {
      const sibling = button?.nextElementSibling;
      if (sibling?.hasAttribute("aria-hidden")) return sibling;
      return Array.from(button?.parentElement?.children || []).find((child) => child !== button && child.hasAttribute("aria-hidden")) || null;
    };
    const candidates = () => Array.from(root.querySelectorAll("[data-disclosure-toggle][aria-expanded]"))
      .filter((button) => visible(button) && bodyFor(button));
    let button = candidates()[0] || null;
    const maxScroll = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
    const positions = [
      scroll.scrollTop,
      maxScroll,
      maxScroll * 0.85,
      maxScroll * 0.7,
      maxScroll * 0.55,
      maxScroll * 0.4,
      maxScroll * 0.25,
      maxScroll * 0.1,
      0,
    ];
    for (const position of positions) {
      if (button) break;
      scroll.scrollTop = Math.max(0, Math.min(maxScroll, position));
      scroll.dispatchEvent(new Event("scroll", { bubbles: true }));
      await settle();
      button = candidates()[0] || null;
    }
    if (!button) {
      const all = Array.from(root.querySelectorAll("[data-disclosure-toggle][aria-expanded]"));
      button = all[0] || null;
      button?.scrollIntoView({ block: "center", inline: "nearest" });
      await settle();
    }
    if (!button) return { found: false, reason: "no disclosure toggle" };
    button.scrollIntoView({ block: "center", inline: "nearest" });
    await settle();
    const rect = button.getBoundingClientRect();
    const x = Math.round(rect.left + Math.min(rect.width - 2, Math.max(2, rect.width / 2)));
    const y = Math.round(rect.top + Math.min(rect.height - 2, Math.max(2, rect.height / 2)));
    const shadowHit = root.elementFromPoint?.(x, y);
    const hitButton = shadowHit?.closest?.("[data-disclosure-toggle]");
    return {
      found: true,
      key: button.getAttribute("data-disclosure-toggle") || "",
      beforeExpanded: button.getAttribute("aria-expanded") || "",
      text: (button.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 160),
      x,
      y,
      rect: {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      clickedAtExpectedPoint: hitButton === button,
      hitSummary: shadowHit ? String(shadowHit.tagName || shadowHit.nodeName) + " " + String(shadowHit.className || "").slice(0, 120) : "none",
    };
  })()`;
}

function renderMarkdown(report) {
  const lines = [
    "# Workspace Native Interactions Audit",
    "",
    `Generated: ${report.generatedAt}`,
    `Fixture: ${report.fixtureURL}`,
    `Disclosure fixture: ${report.disclosureFixtureURL}`,
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
    "## Runtime Evidence",
    "",
    "```json",
    JSON.stringify(report.audit, null, 2),
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
