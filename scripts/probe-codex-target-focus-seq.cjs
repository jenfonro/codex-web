#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const CDP = process.env.CDP_URL || "http://127.0.0.1:9222";
const TARGET_URL = process.env.TARGET_URL || "https://codex.zelt.cn/?nodeId=host-docker-agent";
const TARGET_NODE_ID = process.env.TARGET_NODE_ID || "host-docker-agent";
const TARGET_SESSION_ID = process.env.TARGET_SESSION_ID || "019f0a04-7f0b-7483-8bc4-18f214a5c8f1";
const TARGET_FOCUS_SEQ = Number(process.env.TARGET_FOCUS_SEQ || process.argv[2] || 0);
const VIEWPORT_WIDTH = Number(process.env.VIEWPORT_WIDTH || 1920);
const VIEWPORT_HEIGHT = Number(process.env.VIEWPORT_HEIGHT || 1080);
const WAIT_TIMEOUT_MS = Number(process.env.WAIT_TIMEOUT_MS || 120000);

const repoRoot = path.resolve(__dirname, "..");
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
const outDir = path.join(repoRoot, "reference", "target-focus-seq", stamp);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  if (!TARGET_FOCUS_SEQ) throw new Error("TARGET_FOCUS_SEQ is required");
  fs.mkdirSync(outDir, { recursive: true });

  const target = await getOrCreateTarget();
  const page = await connect(target.webSocketDebuggerUrl);
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

    const url = targetURL();
    await page.send("Page.navigate", { url });
    await waitForLoad(page);
    await sleep(1000);
    const summary = await evalPage(page, probeExpression());
    summary.generatedAt = new Date().toISOString();
    summary.targetURL = url;
    summary.focusSeq = TARGET_FOCUS_SEQ;
    summary.targetNodeId = TARGET_NODE_ID;
    summary.targetSessionId = TARGET_SESSION_ID;

    const screenshot = path.join(outDir, "target-focus.png");
    await page.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })
      .then((result) => fs.writeFileSync(screenshot, Buffer.from(result.data, "base64")))
      .catch((error) => {
        summary.screenshotError = error.message;
      });
    summary.screenshot = path.relative(repoRoot, screenshot).replace(/\\/g, "/");

    fs.writeFileSync(path.join(outDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
    fs.writeFileSync(path.join(repoRoot, "reference", "target-focus-seq", "latest.txt"), outDir);
    console.log(JSON.stringify({
      outputDir: path.relative(repoRoot, outDir).replace(/\\/g, "/"),
      focusSeq: TARGET_FOCUS_SEQ,
      view: summary.view,
      history: summary.history,
      renderedTurnCount: summary.renderedTurnCount,
      focusTurnFound: Boolean(summary.focusTurn),
      eventNodeCount: summary.eventNodes?.length || 0,
      focusTurnText: String(summary.focusTurn?.text || "").slice(0, 240),
    }, null, 2));
    if (!summary.focusTurn || !(summary.eventNodes || []).length) process.exitCode = 1;
  } finally {
    page.close();
  }
}

function targetURL() {
  const url = new URL(TARGET_URL);
  if (TARGET_NODE_ID && !url.searchParams.has("nodeId")) url.searchParams.set("nodeId", TARGET_NODE_ID);
  url.searchParams.set("focusProbe", String(Date.now()));
  return url.toString();
}

async function getOrCreateTarget() {
  const targets = await readJSON(`${CDP}/json/list`);
  const existing = targets.find((item) => /codex\.zelt\.cn|127\.0\.0\.1:58888|localhost:58888/i.test(item.url || "") && item.webSocketDebuggerUrl);
  if (existing) return existing;
  const response = await fetch(`${CDP}/json/new?${encodeURIComponent(targetURL())}`, { method: "PUT" });
  if (!response.ok) throw new Error(`create target failed: ${response.status} ${response.statusText}`);
  return response.json();
}

function probeExpression() {
  return `(async () => {
    const targetSeq = ${JSON.stringify(TARGET_FOCUS_SEQ)};
    const sessionId = ${JSON.stringify(TARGET_SESSION_ID)};
    const nodeId = ${JSON.stringify(TARGET_NODE_ID)};
    const waitTimeout = ${JSON.stringify(WAIT_TIMEOUT_MS)};
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const rootOf = () => document.querySelector("#codexPanel")?.shadowRoot;
    const textOf = (node, limit = 2000) => String(node?.innerText || node?.textContent || "").replace(/\\s+/g, " ").trim().slice(0, limit);
    const seqsOf = (node) => String(node?.getAttribute?.("data-codex-turn-seqs") || "")
      .split(",")
      .map((value) => Number(value))
      .filter(Boolean);
    const rectOf = (node) => {
      const rect = node?.getBoundingClientRect?.();
      return rect ? {
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      } : null;
    };
    const selectorForSeq = (seq) => '[data-codex-event-seq="' + seq + '"], [data-codex-event-seqs~="' + seq + '"]';

    window.dispatchEvent(new CustomEvent("codex-web:open-session", {
      detail: { nodeId, sessionId, focusSeq: targetSeq, focusTop: 260 },
    }));

    const started = Date.now();
    let history = null;
    while (Date.now() - started < waitTimeout) {
      const root = rootOf();
      const scroll = root?.querySelector("[data-thread-scroll]");
      const first = Number(scroll?.getAttribute("data-history-first-seq") || 0);
      const last = Number(scroll?.getAttribute("data-history-last-seq") || 0);
      const loadingBefore = scroll?.getAttribute("data-history-loading-before") === "true";
      history = {
        first,
        last,
        loadingBefore,
        scrollTop: Math.round(scroll?.scrollTop || 0),
        scrollHeight: Math.round(scroll?.scrollHeight || 0),
        clientHeight: Math.round(scroll?.clientHeight || 0),
      };
      if (!loadingBefore && first > 0 && last > 0 && targetSeq >= first && targetSeq <= last) break;
      await sleep(250);
    }

    await sleep(400);
    const root = rootOf();
    const scroll = root?.querySelector("[data-thread-scroll]");
    const turns = Array.from(root?.querySelectorAll("[data-codex-virtual-turn]") || []);
    const focusTurn = turns.find((turn) => seqsOf(turn).includes(targetSeq));
    if (focusTurn) {
      focusTurn.scrollIntoView({ block: "center", inline: "nearest" });
      await sleep(500);
    }
    const eventNodes = Array.from(root?.querySelectorAll(selectorForSeq(targetSeq)) || []);
    const scrollRect = rectOf(scroll);

    return {
      url: location.href,
      title: document.title,
      view: root?.querySelector("[data-codex-view]")?.getAttribute("data-codex-view") || "",
      history,
      scrollAfter: {
        scrollTop: Math.round(scroll?.scrollTop || 0),
        scrollHeight: Math.round(scroll?.scrollHeight || 0),
        clientHeight: Math.round(scroll?.clientHeight || 0),
        rect: scrollRect,
      },
      renderedTurnCount: turns.length,
      focusTurn: focusTurn ? {
        key: focusTurn.getAttribute("data-codex-virtual-turn") || "",
        seqs: focusTurn.getAttribute("data-codex-turn-seqs") || "",
        focused: focusTurn.getAttribute("data-codex-focus-turn") || "",
        rect: rectOf(focusTurn),
        text: textOf(focusTurn, 6000),
        html: String(focusTurn.outerHTML || "").slice(0, 6000),
      } : null,
      eventNodes: eventNodes.map((node) => ({
        tag: node.tagName,
        seq: node.getAttribute("data-codex-event-seq") || node.getAttribute("data-codex-event-seqs") || "",
        rect: rectOf(node),
        className: String(node.className || ""),
        text: textOf(node, 1800),
        html: String(node.outerHTML || "").slice(0, 1800),
      })),
      renderedSamples: turns.slice(0, 14).map((turn) => ({
        key: turn.getAttribute("data-codex-virtual-turn") || "",
        seqs: turn.getAttribute("data-codex-turn-seqs") || "",
        rect: rectOf(turn),
        text: textOf(turn, 500),
      })),
    };
  })()`;
}

async function readJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
  return response.json();
}

async function waitForLoad(page) {
  await waitFor(page, `document.readyState === "complete"`, 60000, "page load");
}

async function waitFor(page, expression, timeoutMS, label) {
  const started = Date.now();
  while (Date.now() - started < timeoutMS) {
    const result = await evalPage(page, expression).catch(() => false);
    if (result) return result;
    await sleep(250);
  }
  throw new Error(`timeout waiting for ${label}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function evalPage(page, expression) {
  const result = await page.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed");
  }
  return result.result?.value;
}

async function connect(wsURL) {
  const ws = new WebSocket(wsURL);
  let nextID = 1;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result || {});
  });
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  return {
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = nextID++;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      ws.close();
    },
  };
}
