#!/usr/bin/env node
"use strict";

const CDP = process.env.CDP_URL || "http://127.0.0.1:9222";
const TARGET_WIDTH = Number(process.env.SIDEBAR_WIDTH || 611);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const target = await getActivePageTarget();
  const page = await connect(target.webSocketDebuggerUrl);
  await page.send("Page.enable");
  await page.send("Runtime.enable");
  await page.send("DOM.enable").catch(() => {});

  const before = await evalPage(page, sidebarMetricsExpression());
  if (!before.sidebar) throw new Error("sidebar not found");
  const startX = Math.round(before.sidebar.right);
  const endX = Math.round(before.sidebar.left + TARGET_WIDTH);
  const y = Math.round(before.sidebar.top + before.sidebar.height / 2);

  await drag(page, startX, y, endX, y);
  await wait(600);

  const after = await evalPage(page, sidebarMetricsExpression());
  page.close();
  console.log(JSON.stringify({ targetWidth: TARGET_WIDTH, before, after }, null, 2));
}

async function drag(page, startX, startY, endX, endY) {
  await page.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: startX,
    y: startY,
    button: "none",
  });
  await wait(80);
  await page.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: startX,
    y: startY,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
  const steps = 24;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    await page.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: startX + (endX - startX) * t,
      y: startY + (endY - startY) * t,
      button: "left",
      buttons: 1,
    });
    await wait(12);
  }
  await page.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: endX,
    y: endY,
    button: "left",
    buttons: 0,
    clickCount: 1,
  });
}

function sidebarMetricsExpression() {
  return `(() => {
    function rectOf(selector) {
      const el = document.querySelector(selector);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
      };
    }
    return {
      viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
      sidebar: rectOf(".part.sidebar"),
      sash: rectOf(".monaco-sash.vertical"),
      webview: rectOf("iframe.webview.ready"),
    };
  })()`;
}

async function evalPage(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}

async function getActivePageTarget() {
  const targets = await readJSON(`${CDP}/json/list`);
  const pages = targets.filter((target) => target.type === "page" && target.webSocketDebuggerUrl);
  if (!pages.length) throw new Error("no debuggable page targets found");
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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
