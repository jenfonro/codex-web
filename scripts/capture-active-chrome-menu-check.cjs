#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const CDP = process.env.CDP_URL || "http://127.0.0.1:9222";
const outDir = path.resolve(process.env.MENU_CHECK_DIR || path.join(__dirname, "..", "reference", "windows-captures", "menu-check"));

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const target = await getActivePageTarget();
  const page = await connect(target.webSocketDebuggerUrl);
  await page.send("Page.enable");
  await page.send("Runtime.enable");

  const topBefore = await evalPage(page, metricsExpression());
  const screenshot = await page.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
    fromSurface: true,
  });
  fs.writeFileSync(path.join(outDir, "screenshot.png"), Buffer.from(screenshot.data, "base64"));
  const topAfter = await evalPage(page, metricsExpression());

  const frameTree = await page.send("Page.getFrameTree");
  const frames = flattenFrames(frameTree.frameTree);
  const frameCaptures = [];
  for (const frame of frames) {
    try {
      const world = await page.send("Page.createIsolatedWorld", {
        frameId: frame.id,
        worldName: `menuCheck${frameCaptures.length}`,
        grantUniveralAccess: true,
      });
      const capture = await evalPage(page, frameExpression(), world.executionContextId);
      frameCaptures.push({ frame, capture });
    } catch (error) {
      frameCaptures.push({ frame, error: String(error.message || error) });
    }
  }
  fs.writeFileSync(path.join(outDir, "check.json"), `${JSON.stringify({ topBefore, topAfter, frameCaptures }, null, 2)}\n`);
  page.close();
  console.log(outDir);
}

function metricsExpression() {
  return `(() => {
    function rect(selector) {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x:r.x, y:r.y, width:r.width, height:r.height, top:r.top, right:r.right, bottom:r.bottom, left:r.left };
    }
    return {
      viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
      sidebar: rect(".part.sidebar"),
      iframe: rect("iframe.webview.ready"),
      editor: rect(".part.editor"),
      title: document.title,
    };
  })()`;
}

function frameExpression() {
  return `(() => {
    function rectOf(el) {
      const r = el.getBoundingClientRect();
      return { x:r.x, y:r.y, width:r.width, height:r.height, top:r.top, right:r.right, bottom:r.bottom, left:r.left };
    }
    function item(el) {
      const s = getComputedStyle(el);
      return {
        tag: el.tagName,
        id: el.id,
        cls: String(el.className || ""),
        text: (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 500),
        aria: el.getAttribute("aria-label"),
        rect: rectOf(el),
        display: s.display,
        position: s.position,
        width: s.width,
        height: s.height,
        padding: s.padding,
        margin: s.margin,
        color: s.color,
        backgroundColor: s.backgroundColor,
        border: s.border,
        borderRadius: s.borderRadius,
        boxShadow: s.boxShadow,
        fontFamily: s.fontFamily,
        fontSize: s.fontSize,
        lineHeight: s.lineHeight,
        zIndex: s.zIndex,
      };
    }
    const nodes = Array.from(document.querySelectorAll("body, #root, button, [role='menu'], [role='dialog'], [data-radix-popper-content-wrapper], [data-side], [data-align], [class*='popover'], [class*='Popover'], [class*='menu'], [class*='Menu'], [class*='dropdown'], [class*='Dropdown']"));
    return {
      url: location.href,
      title: document.title,
      viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
      bodyText: (document.body?.innerText || "").slice(0, 3000),
      items: nodes.filter(el => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
      }).map(item),
    };
  })()`;
}

async function evalPage(client, expression, contextId) {
  const params = { expression, awaitPromise: true, returnByValue: true };
  if (contextId) params.contextId = contextId;
  const result = await client.send("Runtime.evaluate", params);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}

function flattenFrames(node, out = []) {
  if (!node) return out;
  if (node.frame) out.push(node.frame);
  for (const child of node.childFrames || []) flattenFrames(child, out);
  return out;
}

async function getActivePageTarget() {
  const targets = await readJSON(`${CDP}/json/list`);
  const pages = targets.filter((target) => target.type === "page" && target.webSocketDebuggerUrl);
  if (!pages.length) throw new Error("no page targets");
  return (
    pages.find((target) => /127\.0\.0\.1:58888|localhost:58888/i.test(`${target.url} ${target.title}`)) ||
    pages.find((target) => /code-tx\.zelt\.cn|code-server/i.test(`${target.url} ${target.title}`)) ||
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
