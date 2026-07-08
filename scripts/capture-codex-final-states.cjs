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
const outDir = path.join(repoRoot, "reference", "codex-reference", "final-state-screenshots");
const outJSON = path.join(outDir, "report.json");
const outMD = path.join(outDir, "report.md");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const captures = [];
  const checks = [
    { name: "viewport is 1920x1080 or larger", ok: VIEWPORT_WIDTH >= 1920 && VIEWPORT_HEIGHT >= 1080, details: `${VIEWPORT_WIDTH}x${VIEWPORT_HEIGHT}` },
    { name: "sidebar width is visual-reference width", ok: SIDEBAR_WIDTH >= 580, details: `${SIDEBAR_WIDTH}px` },
  ];

  const virtualPage = await openFixture("virtual-scroll");
  try {
    captures.push(await captureState(virtualPage, "completed-summary", "Completed turn with processed-time summary", async (page) => {
      return await scrollToMatch(page, {
        selector: "button[aria-expanded].text-size-chat",
        text: /已处理|Processed/i,
      });
    }));

    captures.push(await captureState(virtualPage, "file-reference", "File/diff reference styling", async (page) => {
      return await scrollToMatch(page, {
        selector: "._tableCellFileLink_lzkx4_413, [data-file-reference], .thread-diff-virtualized",
        text: /frontend\/src|virtual-\d+\.js/i,
      });
    }));
  } finally {
    await virtualPage.close();
  }

  const dynamicPage = await openFixture("dynamic");
  try {
    captures.push(await captureState(dynamicPage, "running-thinking", "Running/thinking shimmer and running shell state", async (page) => {
      return await scrollToMatch(page, {
        selector: "._cadencedShimmer_18j3y_1, .loading-shimmer-pure-text, .group\\/activity-header, [class*='group/activity-header']",
        text: /正在思考|thinking|npm run build|running/i,
      });
    }));
  } finally {
    await dynamicPage.close();
  }

  for (const capture of captures) {
    checks.push({
      name: `${capture.id} state found`,
      ok: Boolean(capture.state?.found),
      details: capture.state?.text || capture.state?.reason || "",
    });
    checks.push({
      name: `${capture.id} screenshot written`,
      ok: Boolean(capture.file && fs.existsSync(path.join(outDir, capture.file))),
      details: capture.file || "",
    });
    checks.push({
      name: `${capture.id} target has visible bounds`,
      ok: Number(capture.state?.rect?.width || 0) > 0 && Number(capture.state?.rect?.height || 0) > 0,
      details: capture.state?.rect ? `${capture.state.rect.width}x${capture.state.rect.height} at ${capture.state.rect.x},${capture.state.rect.y}` : "",
    });
    checks.push({
      name: `${capture.id} target is in scroll viewport`,
      ok: Boolean(capture.state?.inViewport),
      details: capture.state?.rect ? `${capture.state.rect.width}x${capture.state.rect.height} at ${capture.state.rect.x},${capture.state.rect.y}` : "",
    });
  }
  const running = captures.find((capture) => capture.id === "running-thinking")?.state;
  checks.push({
    name: "running state includes shimmer or running text",
    ok: /正在思考|thinking|npm run build|running/i.test(running?.text || ""),
    details: running?.text || "",
  });

  const report = {
    generatedAt: new Date().toISOString(),
    appURL: APP_URL,
    cdp: CDP,
    viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
    sidebarWidth: SIDEBAR_WIDTH,
    captures,
    summary: {
      checks: checks.length,
      failed: checks.filter((check) => !check.ok).length,
    },
    checks,
  };

  fs.writeFileSync(outJSON, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(outMD, renderMarkdown(report));
  console.log(`${outJSON} (${report.summary.failed} failed)`);
  if (report.summary.failed > 0) process.exit(1);
}

async function openFixture(mode) {
  const url = fixtureURL(mode);
  const target = await createPageTarget(url);
  const page = await connect(target.webSocketDebuggerUrl, target.id);
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
    window.dispatchEvent(new Event("resize"));
  })()`);
  if (mode === "reference") {
    await waitForShadow(page, "[data-codex-view='list']");
    await evalPage(page, `(() => {
      const root = document.querySelector("#codexPanel")?.shadowRoot;
      root?.querySelector("[data-codex-session-id='thread-reference']")?.click();
    })()`);
  }
  await waitForShadow(page, "[data-codex-view='thread']");
  await waitForShadow(page, "[data-thread-scroll]");
  await wait(500);
  return page;
}

function fixtureURL(mode) {
  const url = new URL(APP_URL);
  url.searchParams.set("codexFixture", mode);
  url.searchParams.set("finalShot", RUN_ID);
  return url.toString();
}

async function captureState(page, id, label, prepare) {
  const state = await prepare(page).catch((error) => ({ found: false, reason: String(error?.message || error) }));
  await wait(300);
  const file = `${id}.png`;
  await screenshotPanel(page, path.join(outDir, file));
  return { id, label, file, state };
}

async function scrollToMatch(page, { selector, text }) {
  const expression = `(${scrollToMatchExpression})(${JSON.stringify(selector)}, ${text.toString()})`;
  return await evalPage(page, expression);
}

function scrollToMatchExpression(selector, regexSource) {
  const root = document.querySelector("#codexPanel")?.shadowRoot;
  const scroll = root?.querySelector("[data-thread-scroll]");
  const match = String(regexSource || "/./").match(/^\/(.+)\/([a-z]*)$/i);
  const regex = match ? new RegExp(match[1], match[2]) : new RegExp(String(regexSource || "."), "i");
  const visible = (element) => {
    if (!element) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  };
  const boxFor = (element) => {
    const candidates = [element, ...Array.from(element?.querySelectorAll?.("*") || [])];
    for (const candidate of candidates) {
      if (!visible(candidate)) continue;
      const rect = candidate.getBoundingClientRect();
      return { element: candidate, rect };
    }
    const rect = element?.getBoundingClientRect?.();
    return rect ? { element, rect } : null;
  };
  const inScrollViewport = (rect) => {
    const scrollRect = scroll.getBoundingClientRect();
    return rect.bottom >= scrollRect.top && rect.top <= scrollRect.bottom;
  };
  const textOf = (element) => (element?.innerText || element?.textContent || "").replace(/\s+/g, " ").trim();
  const find = (requireViewport = false) => {
    const scrollRect = scroll.getBoundingClientRect();
    const center = scrollRect.top + (scrollRect.height / 2);
    return Array.from(root?.querySelectorAll(selector) || [])
      .map((element) => ({ element, box: boxFor(element), text: textOf(element) }))
      .filter((entry) => visible(entry.element) && regex.test(entry.text) && (!requireViewport || (entry.box?.rect && inScrollViewport(entry.box.rect))))
      .sort((a, b) => {
        const aCenter = a.box?.rect ? a.box.rect.top + (a.box.rect.height / 2) : 0;
        const bCenter = b.box?.rect ? b.box.rect.top + (b.box.rect.height / 2) : 0;
        return Math.abs(aCenter - center) - Math.abs(bCenter - center);
      })[0]?.element || null;
  };
  if (!root || !scroll) return { found: false, reason: "missing panel root or scroll container" };
  const maxScroll = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
  const positions = [];
  const step = Math.max(1, Math.floor(scroll.clientHeight * 0.75));
  for (let pos = scroll.scrollTop; pos >= 0; pos -= step) positions.push(pos);
  positions.push(0);
  for (let pos = 0; pos <= maxScroll; pos += step) positions.push(pos);
  positions.push(maxScroll);
  const unique = Array.from(new Set(positions.map((value) => Math.max(0, Math.min(maxScroll, Math.round(value))))));
  const settle = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  return unique.reduce((promise, position) => promise.then(async (result) => {
    if (result?.found) return result;
    scroll.scrollTop = position;
    scroll.dispatchEvent(new Event("scroll", { bubbles: true }));
    await settle();
    let element = find(true);
    if (element) {
      let box = boxFor(element);
      if (box?.rect) {
        const scrollRect = scroll.getBoundingClientRect();
        const delta = box.rect.top - (scrollRect.top + (scrollRect.height / 2) - (box.rect.height / 2));
        scroll.scrollTop = Math.max(0, Math.min(maxScroll, scroll.scrollTop + delta));
        scroll.dispatchEvent(new Event("scroll", { bubbles: true }));
        await settle();
        element = find(true) || element;
        box = boxFor(element);
      }
      const rect = box?.rect || element.getBoundingClientRect();
      return {
        found: true,
        selector,
        text: textOf(element).slice(0, 500),
        expanded: element.getAttribute("aria-expanded") === "true",
        inViewport: true,
        rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
      };
    }
    element = find(false);
    if (!element) return null;
    element.scrollIntoView({ block: "center", inline: "nearest" });
    await settle();
    let current = find(true) || find(false) || element;
    let box = boxFor(current);
    for (let centerAttempt = 0; centerAttempt < 5 && box?.rect && !inScrollViewport(box.rect); centerAttempt += 1) {
      const scrollRect = scroll.getBoundingClientRect();
      const delta = box.rect.top - (scrollRect.top + (scrollRect.height / 2) - (box.rect.height / 2));
      scroll.scrollTop = Math.max(0, Math.min(maxScroll, scroll.scrollTop + delta));
      scroll.dispatchEvent(new Event("scroll", { bubbles: true }));
      await settle();
      current = find(true) || find(false) || current;
      box = boxFor(current);
    }
    const rect = box?.rect || current.getBoundingClientRect();
    if (!inScrollViewport(rect)) return null;
    return {
      found: true,
      selector,
      text: textOf(current).slice(0, 500),
      expanded: current.getAttribute("aria-expanded") === "true",
      inViewport: inScrollViewport(rect),
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
    };
  }), Promise.resolve(null)).then((result) => result || { found: false, reason: `no visible match for ${selector}` });
}

async function screenshotPanel(page, file) {
  const rect = await evalPage(page, `(() => {
    const root = document.querySelector("#codexPanel");
    const panel = root?.shadowRoot?.querySelector("[data-codex-panel-root]") || root;
    const rect = panel?.getBoundingClientRect?.();
    return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
  })()`);
  const clip = rect || { x: 0, y: 0, width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT };
  const result = await page.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
    fromSurface: true,
    clip: {
      x: Math.max(0, Math.round(clip.x)),
      y: Math.max(0, Math.round(clip.y)),
      width: Math.max(1, Math.min(VIEWPORT_WIDTH, Math.round(clip.width))),
      height: Math.max(1, Math.min(VIEWPORT_HEIGHT, Math.round(clip.height))),
      scale: 1,
    },
  });
  fs.writeFileSync(file, Buffer.from(result.data, "base64"));
}

function renderMarkdown(report) {
  const lines = [
    "# Codex Final State Screenshots",
    "",
    `Generated: ${report.generatedAt}`,
    `Viewport: ${report.viewport.width}x${report.viewport.height}`,
    `Sidebar: ${report.sidebarWidth}px`,
    "",
    "## Summary",
    "",
    `- Checks: ${report.summary.checks}`,
    `- Failed: ${report.summary.failed}`,
    "",
    "## Captures",
    "",
  ];
  for (const capture of report.captures) {
    lines.push(`- ${capture.label}: \`${capture.file}\` (${capture.state?.found ? "found" : "missing"})`);
  }
  lines.push("", "## Checks", "", "| Check | Status | Details |", "| --- | --- | --- |");
  for (const check of report.checks) {
    lines.push(`| ${escapeMD(check.name)} | ${check.ok ? "ok" : "fail"} | ${escapeMD(String(check.details || ""))} |`);
  }
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
  await fetch(`${CDP}/json/close/${encodeURIComponent(id)}`).catch(() => {});
}

async function connect(webSocketDebuggerUrl, targetID) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const callbacks = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const callback = callbacks.get(message.id);
    if (!callback) return;
    callbacks.delete(message.id);
    if (message.error) callback.reject(new Error(`${message.error.message || "CDP error"} ${JSON.stringify(message.error.data || "")}`));
    else callback.resolve(message.result || {});
  });
  return {
    send(method, params = {}) {
      const messageID = ++id;
      socket.send(JSON.stringify({ id: messageID, method, params }));
      return new Promise((resolve, reject) => callbacks.set(messageID, { resolve, reject }));
    },
    async close() {
      socket.close();
      await closePageTarget(targetID);
    },
  };
}

async function navigate(page, url) {
  await page.send("Page.navigate", { url });
  await waitForLoad(page);
}

async function waitForLoad(page) {
  for (let index = 0; index < 120; index += 1) {
    const ready = await evalPage(page, "document.readyState").catch(() => "");
    if (ready === "complete" || ready === "interactive") return;
    await wait(250);
  }
  throw new Error("page did not load");
}

async function waitForShadow(page, selector, timeoutMS = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMS) {
    const found = await evalPage(page, `Boolean(document.querySelector("#codexPanel")?.shadowRoot?.querySelector(${JSON.stringify(selector)}))`).catch(() => false);
    if (found) return;
    await wait(150);
  }
  throw new Error(`missing shadow selector ${selector}`);
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
  return result.result?.value;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
