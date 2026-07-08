#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const CDP = process.env.CDP_URL || "http://127.0.0.1:9222";
const SOURCE_URL = process.env.SOURCE_URL || "https://code-tx.zelt.cn/?folder=/root";
const SOURCE_PATTERN = new RegExp(process.env.SOURCE_URL_PATTERN || "code-tx\\.zelt\\.cn", "i");
const VIEWPORT_WIDTH = Number(process.env.VIEWPORT_WIDTH || 1920);
const VIEWPORT_HEIGHT = Number(process.env.VIEWPORT_HEIGHT || 1080);
const SOURCE_SCROLL_TOP = Number(process.env.SOURCE_SCROLL_TOP || -37144);
const SOURCE_CONTEXT = process.env.SOURCE_CONTEXT || "顶部 command center";
const WAIT_TIMEOUT_MS = Number(process.env.WAIT_TIMEOUT_MS || 120000);

const repoRoot = path.resolve(__dirname, "..");
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
const outDir = path.join(repoRoot, "reference", "source-activity-context", stamp);

const SOURCE_SELECTORS = {
  conversation: "[data-thread-find-target='conversation']",
  turn: "[data-virtualized-turn-content], [data-turn-key], [data-content-search-unit-key]",
  userBubble: "[data-user-message-bubble]",
  assistantMarkdown: "._markdownContent_lzkx4_60",
};

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});

async function main() {
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

    if (!SOURCE_PATTERN.test(target.url || "")) {
      await page.send("Page.navigate", { url: SOURCE_URL });
      await waitForLoad(page);
    }
    const context = await waitForCodexContext(page);
    const summary = await waitForProbe(page, context?.contextId);
    summary.generatedAt = new Date().toISOString();
    summary.sourceURL = context?.url || target.url || SOURCE_URL;
    summary.context = context ? {
      frameId: context.frameId,
      contextId: context.contextId,
      url: context.url,
      score: context.score,
      probe: context.probe,
      details: contextDetails(context),
    } : null;
    summary.sourceScrollTop = SOURCE_SCROLL_TOP;
    summary.sourceContext = SOURCE_CONTEXT;

    const screenshot = path.join(outDir, "source-activity-context.png");
    await page.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })
      .then((result) => fs.writeFileSync(screenshot, Buffer.from(result.data, "base64")))
      .catch((error) => {
        summary.screenshotError = error.message;
      });
    summary.screenshot = path.relative(repoRoot, screenshot).replace(/\\/g, "/");

    fs.writeFileSync(path.join(outDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
    fs.mkdirSync(path.join(repoRoot, "reference", "source-activity-context"), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "reference", "source-activity-context", "latest.txt"), outDir);
    console.log(JSON.stringify({
      outputDir: path.relative(repoRoot, outDir).replace(/\\/g, "/"),
      contextFound: Boolean(summary.contextTurn),
      scroll: summary.scroll,
      activityCards: (summary.activityCards || []).map((card) => ({
        label: card.label,
        stats: card.stats,
        text: String(card.text || "").slice(0, 180),
      })),
    }, null, 2));
    if (!summary.contextTurn || !(summary.activityCards || []).length) process.exitCode = 1;
  } finally {
    page.close();
  }
}

async function getOrCreateTarget() {
  const targets = await readJSON(`${CDP}/json/list`);
  const existing = targets.find((item) => item.type === "page" && SOURCE_PATTERN.test(`${item.url || ""} ${item.title || ""}`) && item.webSocketDebuggerUrl);
  if (existing) return existing;
  const response = await fetch(`${CDP}/json/new?${encodeURIComponent(SOURCE_URL)}`, { method: "PUT" });
  if (!response.ok) throw new Error(`create source target failed: ${response.status} ${response.statusText}`);
  return response.json();
}

async function waitForCodexContext(page) {
  const started = Date.now();
  let best = null;
  while (Date.now() - started < WAIT_TIMEOUT_MS) {
    best = await findCodexContext(page, SOURCE_SELECTORS).catch((error) => ({ error: error.message }));
    if (best?.contextId && isCodeServerCodexWebview(best)) return best;
    await sleep(500);
  }
  if (best?.contextId) return best;
  throw new Error(`source Codex webview context not found: ${best?.error || "missing context"}`);
}

async function findCodexContext(page, selectors) {
  const frameTree = await page.send("Page.getFrameTree").catch(() => null);
  const frames = flattenFrames(frameTree?.frameTree).filter((frame) => frame.id);
  const candidates = [];
  for (const frame of frames) {
    const contextId = await createIsolatedWorld(page, frame.id);
    if (!contextId) continue;
    const probe = await evalInContext(page, contextId, contextProbeExpression(selectors)).catch((error) => ({ error: error.message }));
    candidates.push({
      frameId: frame.id,
      contextId,
      url: frame.url || "",
      probe,
      score: Number(probe?.score || 0),
    });
  }
  candidates.sort((left, right) => right.score - left.score);
  return candidates.find((item) => isCodeServerCodexWebview(item)) || candidates.find((item) => item.score > 0) || candidates[0] || null;
}

function contextProbeExpression(selectors) {
  return `(() => {
    const selectors = ${JSON.stringify(selectors)};
    const roots = [document, document.querySelector("#codexPanel")?.shadowRoot].filter(Boolean);
    let best = { score: 0, rootKind: "document" };
    for (const root of roots) {
      const hasConversation = Boolean(root.querySelector(selectors.conversation));
      const hasTurn = Boolean(root.querySelector(selectors.turn));
      const hasComposer = Boolean(root.querySelector(".composer-surface-chrome"));
      const hasUserBubble = Boolean(root.querySelector(selectors.userBubble));
      const hasAssistant = Boolean(root.querySelector(selectors.assistantMarkdown));
      const score = [hasConversation, hasTurn, hasComposer, hasUserBubble, hasAssistant].filter(Boolean).length * 10;
      if (score > best.score) {
        const conversation = root.querySelector(selectors.conversation);
        const conversationRect = conversation?.getBoundingClientRect?.();
        best = {
          score,
          rootKind: root === document ? "document" : "shadow",
          hasConversation,
          hasTurn,
          hasComposer,
          hasUserBubble,
          hasAssistant,
          title: document.title,
          url: location.href,
          turnCount: root.querySelectorAll(selectors.turn).length,
          conversationRect: conversationRect ? {
            left: Math.round(conversationRect.left),
            top: Math.round(conversationRect.top),
            right: Math.round(conversationRect.right),
            bottom: Math.round(conversationRect.bottom),
            width: Math.round(conversationRect.width),
            height: Math.round(conversationRect.height),
          } : null,
          textSample: hasConversation || hasTurn ? ((root.body || root.host || document.body)?.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 500) : "",
        };
      }
    }
    return best;
  })()`;
}

function flattenFrames(node, out = []) {
  if (!node?.frame) return out;
  out.push(node.frame);
  for (const child of node.childFrames || []) flattenFrames(child, out);
  return out;
}

async function createIsolatedWorld(page, frameId) {
  const result = await page.send("Page.createIsolatedWorld", {
    frameId,
    worldName: `codex-source-activity-${Date.now()}`,
    grantUniveralAccess: true,
  }).catch(() => null);
  return result?.executionContextId || null;
}

function isCodeServerCodexWebview(context) {
  const probe = context?.probe || {};
  const url = `${context?.url || ""} ${probe.url || ""}`;
  return /code-tx\.zelt\.cn/i.test(url)
    && /extensionId=openai\.chatgpt/i.test(url)
    && /purpose=webviewView/i.test(url)
    && Boolean(probe.hasConversation)
    && Number(probe.turnCount || 0) > 0;
}

function contextDetails(context) {
  const probe = context?.probe || {};
  return `frame=${context?.frameId || ""}, score=${context?.score || 0}, conversation=${Boolean(probe.hasConversation)}, turn=${Boolean(probe.hasTurn)}, root=${probe.rootKind || ""}, url=${context?.url || probe.url || ""}`;
}

async function waitForProbe(page, contextId) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < WAIT_TIMEOUT_MS) {
    last = await evalInContext(page, contextId, probeExpression()).catch((error) => ({ ok: false, reason: error.message }));
    if (last?.ok && last.contextTurn && Array.isArray(last.activityCards) && last.activityCards.length) return last;
    await sleep(500);
  }
  return last || { ok: false, reason: "probe timed out" };
}

function probeExpression() {
  return `(() => {
    const requestedScrollTop = ${JSON.stringify(SOURCE_SCROLL_TOP)};
    const contextNeedle = ${JSON.stringify(SOURCE_CONTEXT)};
    const textOf = (node, limit = 6000) => String(node?.innerText || node?.textContent || "").replace(/\\s+/g, " ").trim().slice(0, limit);
    const roots = [document, document.querySelector("#codexPanel")?.shadowRoot].filter(Boolean);
    const pickRoot = () => roots.find((root) => root.querySelector("[data-thread-find-target='conversation'], [data-virtualized-turn-content], [data-turn-key]")) || document;
    const root = pickRoot();
    const visible = (node) => {
      if (!node || !node.isConnected) return false;
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const turnSelector = () => {
      if (root.querySelector("[data-virtualized-turn-content]")) return "[data-virtualized-turn-content]";
      if (root.querySelector("[data-turn-key]")) return "[data-turn-key]";
      return "[data-content-search-unit-key]";
    };
    const conversation = root.querySelector("[data-thread-find-target='conversation']");
    let scrollParent = root.querySelector("[data-thread-scroll]");
    if (!scrollParent && conversation) {
      let node = conversation;
      while (node && node !== root && node !== document.documentElement) {
        if (node.scrollHeight > node.clientHeight) {
          scrollParent = node;
          break;
        }
        node = node.parentElement;
      }
    }
    scrollParent = scrollParent || document.scrollingElement;
    if (!scrollParent) return { ok: false, reason: "scroll parent missing" };
    scrollParent.scrollTop = requestedScrollTop;
    scrollParent.dispatchEvent(new Event("scroll", { bubbles: true }));
    const turns = Array.from(root.querySelectorAll(turnSelector())).filter(visible);
    const contextTurn = turns.find((turn) => textOf(turn).includes(contextNeedle)) || turns.find((turn) => textOf(turn).includes("styles.css"));
    const fileStatsFromText = (value) => {
      const text = textOf({ innerText: value }, 8000);
      const out = [];
      const pattern = /([^\\s\`"'<>]+?\\.[a-zA-Z0-9][a-zA-Z0-9._-]*)\\s*\\+\\s*(\\d+)\\s*-\\s*(\\d+)/g;
      let match;
      while ((match = pattern.exec(text)) && out.length < 40) out.push(match[1] + " +" + match[2] + " -" + match[3]);
      return Array.from(new Set(out));
    };
    const activityCardsForTurn = (turn) => {
      const headers = Array.from(turn.querySelectorAll(".group\\\\/activity-header, [class*='group/activity-header']")).filter(visible);
      return headers.map((header, index) => {
        let container = header.closest("[data-codex-tool-group-item], .thread-diff-virtualized") || header.parentElement || turn;
        for (let depth = 0; container && container !== turn && depth < 5 && textOf(container, 200) === textOf(header, 200); depth += 1) {
          container = container.parentElement;
        }
        if (!container || !turn.contains(container)) container = turn;
        const rect = header.getBoundingClientRect();
        const text = textOf(container, 3000);
        return {
          index,
          label: textOf(header, 200),
          stats: fileStatsFromText(text),
          text,
          rect: { top: Math.round(rect.top), bottom: Math.round(rect.bottom), left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width), height: Math.round(rect.height) },
          className: String(header.className || ""),
          html: String(container.outerHTML || "").slice(0, 3000),
        };
      });
    };
    return {
      ok: true,
      rootKind: root === document ? "document" : "shadow",
      scroll: {
        top: Math.round(scrollParent.scrollTop || 0),
        height: Math.round(scrollParent.scrollHeight || 0),
        clientHeight: Math.round(scrollParent.clientHeight || 0),
      },
      turnCount: turns.length,
      contextTurn: contextTurn ? {
        key: contextTurn.getAttribute("data-turn-key") || contextTurn.getAttribute("data-content-search-unit-key") || "",
        text: textOf(contextTurn, 3000),
        rect: (() => {
          const rect = contextTurn.getBoundingClientRect();
          return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width), height: Math.round(rect.height) };
        })(),
      } : null,
      activityCards: contextTurn ? activityCardsForTurn(contextTurn) : [],
      visibleSamples: turns.slice(0, 8).map((turn) => textOf(turn, 400)),
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
    const ok = await evalPage(page, `Boolean(${expression})`).catch(() => false);
    if (ok) return;
    await sleep(250);
  }
  throw new Error(`${label} timed out`);
}

async function evalPage(page, expression) {
  return evalInContext(page, undefined, expression);
}

async function evalInContext(page, contextId, expression) {
  const params = {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout: WAIT_TIMEOUT_MS,
  };
  if (contextId) params.contextId = contextId;
  const result = await page.send("Runtime.evaluate", {
    ...params,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Runtime.evaluate failed");
  }
  return result.result.value;
}

async function connect(wsURL) {
  const ws = new WebSocket(wsURL);
  let nextID = 1;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const callbacks = pending.get(message.id);
    if (!callbacks) return;
    pending.delete(message.id);
    if (message.error) callbacks.reject(new Error(message.error.message || JSON.stringify(message.error)));
    else callbacks.resolve(message.result || {});
  });
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  return {
    send(method, params = {}) {
      const id = nextID++;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    close() {
      ws.close();
    },
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
