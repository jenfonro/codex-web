#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const CDP = process.env.CDP_URL || "http://127.0.0.1:9222";
const APP_URL = process.env.PANEL_URL || "http://127.0.0.1:58888/";
const SIDEBAR_WIDTH = process.env.SIDEBAR_WIDTH ? Number(process.env.SIDEBAR_WIDTH) : null;
const VIEWPORT_WIDTH = Number(process.env.VIEWPORT_WIDTH || 1904);
const VIEWPORT_HEIGHT = Number(process.env.VIEWPORT_HEIGHT || 985);
const SESSION_INDEX = Number(process.env.SESSION_INDEX || 1);
const CAPTURE_SCREENSHOTS = process.env.CAPTURE_SCREENSHOTS !== "0";
const SCREENSHOT_TIMEOUT_MS = Number(process.env.SCREENSHOT_TIMEOUT_MS || 60000);

const repoRoot = path.resolve(__dirname, "..");
const referenceFile = path.join(repoRoot, "reference", "codex-reference", "codex-reference.json");
const outRoot = path.resolve(process.env.CAPTURE_DIR || path.join(repoRoot, "reference", "windows-captures"));
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
const outDir = path.join(outRoot, `${stamp}-local-codex-panel-cdp`);

const STYLE_PROPS = [
  "display",
  "position",
  "boxSizing",
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "padding",
  "margin",
  "gap",
  "color",
  "backgroundColor",
  "border",
  "borderRadius",
  "boxShadow",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "opacity",
  "overflow",
  "overflowX",
  "overflowY",
  "whiteSpace",
  "textAlign",
  "alignItems",
  "justifyContent",
  "flexDirection",
  "gridTemplateColumns",
  "transform",
  "zIndex",
  "cursor",
];

const METRIC_SELECTORS = {
  panelRoot: "[data-codex-panel-root]",
  header: ".codex-panel-header.extension\\:px-panel",
  sessionRow: "[data-codex-session-id]",
  sessionTitle: "[data-thread-title='true']",
  threadConversation: "[data-thread-find-target='conversation']",
  userBubble: "[data-user-message-bubble]",
  markdown: "._markdownContent_lzkx4_60",
  assistantActions: "[data-assistant-message-sent-time='true']",
  activity: "[class~='group/activity-header']",
  summary: ".text-size-chat.text-token-text-secondary button[aria-expanded='false']",
  composer: ".composer-surface-chrome",
  composerFooter: "._footer_1u8sk_2",
  externalFooter: "._footer_z984f_2",
  plusMenu: "[data-composer-overlay-floating-ui]",
  radixMenu: "[data-radix-menu-content]",
  sendButton: "[data-action='send']",
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const reference = JSON.parse(fs.readFileSync(referenceFile, "utf8"));

  const target = await getActivePageTarget();
  const page = await connect(target.webSocketDebuggerUrl);
  try {
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("DOM.enable").catch(() => {});
    await page.send("Emulation.setDeviceMetricsOverride", {
      width: VIEWPORT_WIDTH,
      height: VIEWPORT_HEIGHT,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: VIEWPORT_WIDTH,
      screenHeight: VIEWPORT_HEIGHT,
    });

    await navigate(page, APP_URL);
    const listSidebarWidth = sidebarWidthForView(reference, "list");
    const menuSidebarWidth = sidebarWidthForView(reference, "plusMenu");
    const threadSidebarWidth = sidebarWidthForView(reference, "thread");
    await setSidebarWidth(page, listSidebarWidth);
    await waitForShadow(page, "[data-codex-view='list']");
    await wait(600);

    const summary = {
      appUrl: APP_URL,
      cdp: CDP,
      viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT, deviceScaleFactor: 1 },
      sidebarWidth: SIDEBAR_WIDTH || "derived-per-reference-view",
      sidebarWidths: {},
      captures: {},
      metrics: {},
    };

    await captureState(page, summary, "list", listSidebarWidth);

    await setSidebarWidth(page, menuSidebarWidth);
    await wait(200);
    await clickShadow(page, "[data-popover='plus']");
    await waitForShadow(page, "[data-composer-overlay-floating-ui]");
    await wait(300);
    await finishShadowAnimations(page);
    await captureState(page, summary, "plus", menuSidebarWidth);

    await clickShadow(page, "[data-popover='plus']");
    await wait(150);
    await clickShadow(page, "[data-popover='approval']");
    await waitForShadow(page, "[data-radix-menu-content]");
    await wait(300);
    await finishShadowAnimations(page);
    await captureState(page, summary, "approval", menuSidebarWidth);

    await clickShadow(page, "[data-popover='approval']");
    await wait(150);
    await clickShadow(page, "[data-popover='model']");
    await waitForShadow(page, "[data-radix-menu-content]");
    await wait(300);
    await finishShadowAnimations(page);
    await captureState(page, summary, "model", menuSidebarWidth);

    await clickShadow(page, "[data-popover='model']");
    await wait(150);
    await setSidebarWidth(page, threadSidebarWidth);
    await wait(200);
    await clickShadow(page, "[data-codex-session-id]", SESSION_INDEX);
    await waitForShadow(page, "[data-codex-view='thread']");
    await wait(500);
    await hoverShadow(page, "._markdownContent_lzkx4_60");
    await wait(200);
    await captureState(page, summary, "thread", threadSidebarWidth);

    fs.writeFileSync(path.join(outDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
    fs.writeFileSync(path.join(outRoot, "latest.txt"), outDir);
    console.log(outDir);
    if (Object.values(summary.captures).some((capture) => capture.panelError || capture.fullError || !capture.panel || !capture.full)) {
      process.exitCode = 1;
    }
  } finally {
    page.close();
  }
}

async function captureState(page, summary, name, sidebarWidth) {
  const fullName = `${name}-full.png`;
  const panelName = `${name}-panel.png`;
  const capture = { full: null, panel: null };
  if (CAPTURE_SCREENSHOTS) {
    capture.panel = panelName;
    capture.full = fullName;
    try {
      await screenshotPanel(page, path.join(outDir, panelName));
    } catch (error) {
      capture.panel = null;
      capture.panelError = String(error?.message || error);
    }
    try {
      await screenshot(page, path.join(outDir, fullName));
    } catch (error) {
      capture.full = null;
      capture.fullError = String(error?.message || error);
    }
  }
  summary.sidebarWidths[name] = sidebarWidth;
  summary.captures[name] = capture;
  summary.metrics[name] = await collectMetrics(page);
}

function sidebarWidthForView(reference, view) {
  if (SIDEBAR_WIDTH) return SIDEBAR_WIDTH;
  const rootWidth = Number(reference.selectorStyles?.[view]?.["#root"]?.["0"]?.rect?.width);
  if (!Number.isFinite(rootWidth)) return 611;
  return rootWidth + 1;
}

async function setSidebarWidth(page, width) {
  await evalPage(page, `(() => {
    localStorage.setItem("codex-web:sidebar-width", ${JSON.stringify(String(width))});
    document.documentElement.style.setProperty("--cw-sidebar-width", ${JSON.stringify(`${width}px`)});
    window.dispatchEvent(new Event("resize"));
  })()`);
}

async function screenshot(page, file) {
  const result = await sendWithTimeout(page, "Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
    fromSurface: true,
    optimizeForSpeed: true,
    clip: { x: 0, y: 0, width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT, scale: 1 },
  }, SCREENSHOT_TIMEOUT_MS);
  fs.writeFileSync(file, Buffer.from(result.data, "base64"));
}

async function screenshotPanel(page, file) {
  const rect = await evalPage(page, `(() => {
    const el = document.querySelector("#codexPanel");
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: 1 };
  })()`);
  if (!rect || rect.width <= 0 || rect.height <= 0) throw new Error("codexPanel has no visible rect");
  const result = await sendWithTimeout(page, "Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
    fromSurface: true,
    optimizeForSpeed: true,
    clip: rect,
  }, SCREENSHOT_TIMEOUT_MS);
  fs.writeFileSync(file, Buffer.from(result.data, "base64"));
}

function sendWithTimeout(page, method, params, timeoutMs) {
  return Promise.race([
    page.send(method, params),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${method} timed out after ${timeoutMs}ms`)), timeoutMs)),
  ]);
}

async function collectMetrics(page) {
  return evalPage(page, `(() => {
    const selectors = ${JSON.stringify(METRIC_SELECTORS)};
    const props = ${JSON.stringify(STYLE_PROPS)};
    const shadow = document.querySelector("#codexPanel")?.shadowRoot;
    const pick = (selector) => {
      const element = shadow?.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const styles = {};
      for (const prop of props) styles[prop] = style[prop];
      return {
        selector,
        tagName: element.tagName,
        id: element.id || "",
        className: String(element.className || ""),
        ariaLabel: element.getAttribute("aria-label"),
        text: (element.innerText || element.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 240),
        rect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          left: rect.left,
        },
        styles,
      };
    };
    const panel = document.querySelector("#codexPanel")?.getBoundingClientRect();
    const out = {
      view: shadow?.querySelector("[data-codex-panel-root]")?.getAttribute("data-codex-view") || "",
      shadowLinks: shadow?.querySelectorAll("link[rel='stylesheet']").length || 0,
      panel: panel ? { x: panel.x, y: panel.y, width: panel.width, height: panel.height, top: panel.top, right: panel.right, bottom: panel.bottom, left: panel.left } : null,
      nodes: {},
    };
    for (const [name, selector] of Object.entries(selectors)) out.nodes[name] = pick(selector);
    return out;
  })()`);
}

async function navigate(page, url) {
  const loadPromise = waitForLoad(page, 8000);
  await page.send("Page.navigate", { url });
  await loadPromise;
  await waitForDocumentReady(page);
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

async function hoverShadow(page, selector, index = 0) {
  await waitForShadow(page, selector);
  const point = await evalPage(page, `(() => {
    const root = document.querySelector("#codexPanel")?.shadowRoot;
    const nodes = Array.from(root?.querySelectorAll(${JSON.stringify(selector)}) || []);
    const el = nodes[${JSON.stringify(index)}] || nodes[0];
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left + Math.min(Math.max(rect.width / 2, 1), Math.max(rect.width - 1, 1)),
      y: rect.top + Math.min(Math.max(rect.height - 8, 1), Math.max(rect.height - 1, 1)),
    };
  })()`);
  if (!point) throw new Error(`failed to hover ${selector}`);
  await page.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: point.x,
    y: point.y,
    button: "none",
    pointerType: "mouse",
  });
}

async function waitForShadow(page, selector, timeout = 10000) {
  await evalPage(page, `(() => new Promise((resolve, reject) => {
    const selector = ${JSON.stringify(selector)};
    const deadline = Date.now() + ${JSON.stringify(timeout)};
    function check() {
      const root = document.querySelector("#codexPanel")?.shadowRoot;
      const el = root?.querySelector(selector);
      if (el) {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden") {
          resolve(true);
          return;
        }
      }
      if (Date.now() > deadline) {
        reject(new Error("Timed out waiting for shadow selector " + selector));
        return;
      }
      requestAnimationFrame(check);
    }
    check();
  }))`);
}

async function finishShadowAnimations(page) {
  await evalPage(page, `(() => {
    const shadow = document.querySelector("#codexPanel")?.shadowRoot;
    const animations = [
      ...document.getAnimations({ subtree: true }),
      ...(shadow?.getAnimations({ subtree: true }) || []),
    ];
    for (const animation of animations) {
      try {
        animation.finish();
      } catch {}
    }
  })()`);
}

async function waitForDocumentReady(page) {
  await evalPage(page, `(() => new Promise((resolve) => {
    if (document.readyState === "complete") {
      resolve(true);
      return;
    }
    addEventListener("load", () => resolve(true), { once: true });
    setTimeout(() => resolve(false), 8000);
  }))`);
}

async function waitForLoad(page, timeout) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeout);
    page.once("Page.loadEventFired", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function evalPage(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    serializationOptions: { serialization: "json" },
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || JSON.stringify(result.exceptionDetails));
  }
  return result.result?.value;
}

async function getActivePageTarget() {
  const targets = await readJSON(`${CDP}/json/list`);
  const pages = targets.filter((target) => target.type === "page" && target.webSocketDebuggerUrl);
  if (!pages.length) throw new Error("no debuggable page targets found");
  return (
    pages.find((target) => /127\.0\.0\.1:58888|localhost:58888/i.test(`${target.url} ${target.title}`)) ||
    pages[0]
  );
}

async function readJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
  return response.json();
}

async function connect(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method) {
      for (const listener of listeners.get(message.method) || []) listener(message.params || {});
      return;
    }
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
    once(method, fn) {
      const wrapped = (params) => {
        this.off(method, wrapped);
        fn(params);
      };
      this.on(method, wrapped);
    },
    on(method, fn) {
      const list = listeners.get(method) || [];
      list.push(fn);
      listeners.set(method, list);
    },
    off(method, fn) {
      listeners.set(method, (listeners.get(method) || []).filter((item) => item !== fn));
    },
    close() {
      socket.close();
    },
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
