#!/usr/bin/env node
"use strict";

const CDP = process.env.CDP_URL || "http://127.0.0.1:9222";
const ACTION = process.env.PANEL_ACTION || "list";
const APP_URL = process.env.PANEL_URL || "http://127.0.0.1:58888/";
const SESSION_INDEX = Number(process.env.SESSION_INDEX || 0);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const target = await getActivePageTarget();
  const page = await connect(target.webSocketDebuggerUrl);
  try {
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Page.navigate", { url: APP_URL });
    await waitForLoad(page);
    await wait(700);

    if (ACTION !== "list") {
      await click(page, "[data-codex-session-id]", SESSION_INDEX);
      await waitFor(page, "[data-codex-view='thread']");
      await wait(300);
    }

    if (ACTION === "plus") {
      await click(page, "[data-popover='plus']");
      await waitFor(page, "[data-composer-overlay-floating-ui]");
    } else if (ACTION === "approval") {
      await click(page, "[data-popover='approval']");
      await waitFor(page, "[data-radix-menu-content]");
    } else if (ACTION === "model") {
      await click(page, "[data-popover='model']");
      await waitFor(page, "[data-radix-menu-content]");
    }

    await wait(400);
    console.log(`${ACTION} ready`);
  } finally {
    page.close();
  }
}

async function click(page, selector, index = 0) {
  await waitFor(page, selector);
  await evalPage(page, `(() => {
    const nodes = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
    const el = nodes[${JSON.stringify(index)}] || nodes[0];
    if (!el) return false;
    el.click();
    return true;
  })()`);
}

async function waitFor(page, selector) {
  const expression = `(() => new Promise((resolve, reject) => {
    const selector = ${JSON.stringify(selector)};
    const deadline = Date.now() + 5000;
    function check() {
      const el = document.querySelector(selector);
      if (el) {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden") {
          resolve(true);
          return;
        }
      }
      if (Date.now() > deadline) {
        reject(new Error("Timed out waiting for " + selector));
        return;
      }
      requestAnimationFrame(check);
    }
    check();
  }))`;
  await evalPage(page, expression);
}

async function waitForLoad(page) {
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 2500);
    page.once("Page.loadEventFired", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function evalPage(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || JSON.stringify(result.exceptionDetails));
  }
  return result.result?.value;
}

async function getActivePageTarget() {
  const targets = await readJSON(`${CDP}/json/list`);
  const pages = targets.filter((target) => target.type === "page" && target.webSocketDebuggerUrl);
  if (!pages.length) throw new Error("no page targets");
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
