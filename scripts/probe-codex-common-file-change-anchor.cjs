#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const CDP = process.env.CDP_URL || "http://127.0.0.1:9222";
const SOURCE_URL = process.env.SOURCE_URL || "https://code-tx.zelt.cn/?folder=/root";
const SOURCE_PATTERN = new RegExp(process.env.SOURCE_URL_PATTERN || "code-tx\\.zelt\\.cn", "i");
const TARGET_URL = process.env.TARGET_URL || "https://codex.zelt.cn/?nodeId=host-docker-agent";
const TARGET_SESSION_ID = process.env.TARGET_SESSION_ID || "019f0a04-7f0b-7483-8bc4-18f214a5c8f1";
const TARGET_NODE_ID = process.env.TARGET_NODE_ID || "host-docker-agent";
const VIEWPORT_WIDTH = Number(process.env.VIEWPORT_WIDTH || 1920);
const VIEWPORT_HEIGHT = Number(process.env.VIEWPORT_HEIGHT || 1080);
const MAX_TARGET_PAGES = Number(process.env.MAX_TARGET_PAGES || 12);
const MAX_SOURCE_WINDOWS = Number(process.env.MAX_SOURCE_WINDOWS || 80);
const WAIT_TIMEOUT_MS = Number(process.env.WAIT_TIMEOUT_MS || 120000);

const repoRoot = path.resolve(__dirname, "..");
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
const outDir = path.join(repoRoot, "reference", "common-file-change-anchor", stamp);

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
  const targetRecords = await fetchTargetFileChanges();
  const targetStats = targetRecords.flatMap((record) => record.files.map((file) => ({
    seq: record.seq,
    label: record.label,
    action: record.action,
    count: record.count,
    path: file.path,
    basename: file.basename,
    additions: file.additions,
    deletions: file.deletions,
    statKey: statKey(file.basename, file.additions, file.deletions),
  })));

  const target = await getOrCreateSourceTarget();
  const page = await connect(target.webSocketDebuggerUrl);
  try {
    await page.send("Page.enable");
    await page.send("Runtime.enable");
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
    const sourceScan = await evalInContext(page, context.contextId, sourceScanExpression(targetStats));
    const summary = {
      generatedAt: new Date().toISOString(),
      sourceURL: context.url || SOURCE_URL,
      targetURL: TARGET_URL,
      targetSessionId: TARGET_SESSION_ID,
      targetNodeId: TARGET_NODE_ID,
      context: {
        frameId: context.frameId,
        url: context.url,
        score: context.score,
        probe: context.probe,
      },
      targetFileChangeCount: targetRecords.length,
      targetStatCount: targetStats.length,
      sourceScan,
      commonMatches: sourceScan.commonMatches || [],
    };
    fs.writeFileSync(path.join(outDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
    fs.mkdirSync(path.join(repoRoot, "reference", "common-file-change-anchor"), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, "reference", "common-file-change-anchor", "latest.txt"), outDir);
    console.log(JSON.stringify({
      outputDir: path.relative(repoRoot, outDir).replace(/\\/g, "/"),
      targetFileChangeCount: targetRecords.length,
      targetStatCount: targetStats.length,
      windows: sourceScan.windows?.length || 0,
      sourceActivityCount: sourceScan.sourceActivityCount || 0,
      commonMatchCount: sourceScan.commonMatches?.length || 0,
      commonMatches: (sourceScan.commonMatches || []).slice(0, 12),
    }, null, 2));
    if (!(sourceScan.commonMatches || []).length) process.exitCode = 1;
  } finally {
    page.close();
  }
}

async function fetchTargetFileChanges() {
  const base = new URL(TARGET_URL);
  const out = [];
  let beforeSeq = 0;
  for (let page = 0; page < MAX_TARGET_PAGES; page += 1) {
    const url = new URL(`/api/sessions/${encodeURIComponent(TARGET_SESSION_ID)}/events`, base.origin);
    url.searchParams.set("nodeId", TARGET_NODE_ID);
    url.searchParams.set("limit", "2000");
    url.searchParams.set("compact", "true");
    if (beforeSeq > 0) url.searchParams.set("beforeSeq", String(beforeSeq));
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
    const payload = await response.json();
    const events = Array.isArray(payload.events) ? payload.events : [];
    if (!events.length) break;
    for (const event of events) {
      const data = event?.data && typeof event.data === "object" ? event.data : {};
      const files = normalizeFileChangeFiles(data.files);
      if (event.kind !== "file_change" && !files.length) continue;
      const labelInfo = parseActivityLabel(event.text || data.text || data.message || "");
      if (!labelInfo || !files.length) continue;
      out.push({
        seq: Number(event.seq || 0),
        label: labelInfo.label,
        action: labelInfo.action,
        count: labelInfo.count || files.length,
        files,
      });
    }
    const firstSeq = Number(events[0]?.seq || 0);
    if (!firstSeq || firstSeq <= 1) break;
    beforeSeq = firstSeq;
  }
  return out;
}

function normalizeFileChangeFiles(files) {
  if (!Array.isArray(files)) return [];
  return files.map((file) => {
    const rawPath = String(file?.path || file?.name || "").replace(/\\/g, "/").trim();
    if (!rawPath) return null;
    const basename = rawPath.split("/").filter(Boolean).at(-1) || rawPath;
    return {
      path: rawPath,
      basename: normalizeFileToken(basename) || basename.toLowerCase(),
      additions: Number(file?.additions || 0),
      deletions: Number(file?.deletions || 0),
    };
  }).filter(Boolean);
}

function sourceScanExpression(targetStats) {
  return `(async () => {
    const maxWindows = ${JSON.stringify(MAX_SOURCE_WINDOWS)};
    const targetStats = ${JSON.stringify(targetStats)};
    const targetByStat = new Map();
    for (const item of targetStats) {
      const list = targetByStat.get(item.statKey) || [];
      list.push(item);
      targetByStat.set(item.statKey, list);
    }
    const textOf = (node, limit = 6000) => String(node?.innerText || node?.textContent || "").replace(/\\s+/g, " ").trim().slice(0, limit);
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const roots = [document, document.querySelector("#codexPanel")?.shadowRoot].filter(Boolean);
    const root = roots.find((candidate) => candidate.querySelector("[data-thread-find-target='conversation'], [data-virtualized-turn-content], [data-turn-key]")) || document;
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
    if (!scrollParent) return { ok: false, reason: "scroll parent missing", windows: [], commonMatches: [] };
    const style = getComputedStyle(scrollParent);
    const reverse = style.flexDirection === "column-reverse" || /flex-col-reverse/.test(String(scrollParent.className || ""));
    const maxScroll = Math.max(0, scrollParent.scrollHeight - scrollParent.clientHeight);
    const addPosition = (positions, value) => {
      const rounded = Math.round(value);
      if (!positions.includes(rounded)) positions.push(rounded);
    };
    const positions = [];
    const step = maxWindows > 1 ? Math.max(240, Math.ceil(maxScroll / Math.max(1, maxWindows - 1))) : maxScroll;
    if (reverse) {
      addPosition(positions, 0);
      for (let value = -step; Math.abs(value) < maxScroll && positions.length < maxWindows - 1; value -= step) addPosition(positions, value);
      if (maxScroll > 0) addPosition(positions, -maxScroll);
    } else {
      addPosition(positions, maxScroll);
      for (let value = maxScroll - step; value > 0 && positions.length < maxWindows - 1; value -= step) addPosition(positions, value);
      addPosition(positions, 0);
    }
    const normalizeFileToken = (value) => {
      let token = String(value || "").replace(/^[\\\`"'([{<]+|[\\\`"',.;:)\\]}>，。；、]+$/g, "").replace(/\\\\/g, "/").trim();
      if (!token) return "";
      token = token.replace(/^(?:\\/root\\/code\\/codex-web\\/|\\/workspace\\/|\\/root\\/)/, "");
      token = token.replace(/^\\.\\//, "");
      if (!/[A-Za-z0-9_.@/-]+\\.[A-Za-z0-9][A-Za-z0-9._-]*/.test(token)) return "";
      if (/^(?:li|div|span|button|svg|path|a)\\.[a-z0-9_.-]+$/i.test(token)) return "";
      if (/^\\d+(?:\\.\\d+)?(?:px|rem|em|vh|vw|%)$/i.test(token)) return "";
      return token.toLowerCase();
    };
    const parseActivityLabel = (value) => {
      const text = String(value || "").replace(/\\s+/g, " ").trim();
      const zh = text.match(/已(编辑|创建|删除)\\s+(\\d+)\\s+个文件/);
      if (zh) return { label: zh[0], action: ({ "编辑": "update", "创建": "add", "删除": "delete" })[zh[1]] || "", count: Number(zh[2] || 0) };
      const en = text.match(/\\b(edited|created|deleted)\\s+(\\d+)\\s+files?\\b/i);
      if (en) return { label: en[0], action: ({ edited: "update", created: "add", deleted: "delete" })[en[1].toLowerCase()] || "", count: Number(en[2] || 0) };
      return null;
    };
    const fileStatsFromText = (value) => {
      const text = String(value || "").replace(/\\s+/g, " ").trim();
      const out = [];
      const pattern = /(?:^|\\s)([^\\s\\\`"'<>]+?\\.[a-zA-Z0-9][a-zA-Z0-9._-]*)\\s*\\+\\s*(\\d+)\\s*-\\s*(\\d+)/g;
      let match;
      while ((match = pattern.exec(text)) && out.length < 40) {
        const token = normalizeFileToken(match[1]);
        if (!token || token.startsWith("-")) continue;
        out.push({ token, stat: token.split("/").filter(Boolean).at(-1) + " +" + match[2] + " -" + match[3], additions: Number(match[2]), deletions: Number(match[3]) });
      }
      const seen = new Set();
      return out.filter((item) => {
        const key = item.stat;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };
    const expandProcessedSummaries = async (turns) => {
      const processedSummaryPattern = /(?:已处理|Processed)\\s+\\d/i;
      let clicked = 0;
      for (const turn of turns) {
        const controls = Array.from(turn.querySelectorAll("button[aria-expanded], [role='button'][aria-expanded], [data-disclosure-toggle]")).filter(visible);
        for (const control of controls) {
          if (clicked >= 12) return clicked;
          const label = textOf(control, 160) || control.getAttribute?.("aria-label") || "";
          if (!processedSummaryPattern.test(label)) continue;
          if (String(control.getAttribute?.("aria-expanded") || "") === "true") continue;
          control.scrollIntoView?.({ block: "nearest", inline: "nearest" });
          await sleep(30);
          control.click();
          clicked += 1;
          await sleep(80);
        }
      }
      return clicked;
    };
    const collectActivities = (windowIndex, position, expandedProcessed) => {
      const turns = Array.from(root.querySelectorAll(turnSelector())).filter(visible).slice(0, 80);
      const out = [];
      for (const turn of turns) {
        const headers = Array.from(turn.querySelectorAll(".group\\\\/activity-header, [class*='group/activity-header']")).filter(visible);
        for (const header of headers) {
          const labelInfo = parseActivityLabel(textOf(header, 160));
          if (!labelInfo) continue;
          let container = header.closest("[data-codex-tool-group-item], .thread-diff-virtualized") || header.parentElement || turn;
          for (let depth = 0; container && container !== turn && depth < 5 && textOf(container, 240) === textOf(header, 240); depth += 1) {
            container = container.parentElement;
          }
          if (!container || !turn.contains(container)) container = turn;
          const body = textOf(container, 5000);
          const stats = fileStatsFromText(body);
          for (const stat of stats) {
            const key = stat.token.split("/").filter(Boolean).at(-1) + " +" + stat.additions + " -" + stat.deletions;
            const targetMatches = targetByStat.get(key) || [];
            for (const target of targetMatches) {
              if (target.action && labelInfo.action && target.action !== labelInfo.action) continue;
              if (target.count && labelInfo.count && target.count !== labelInfo.count) continue;
              const rect = header.getBoundingClientRect();
              out.push({
                sourceWindow: windowIndex,
                sourceScrollTop: Math.round(scrollParent.scrollTop || 0),
                requestedScrollTop: position,
                expandedProcessed,
                label: labelInfo.label,
                action: labelInfo.action,
                count: labelInfo.count,
                stat: key,
                sourceToken: stat.token,
                targetSeq: target.seq,
                targetPath: target.path,
                rect: { top: Math.round(rect.top), bottom: Math.round(rect.bottom), left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width), height: Math.round(rect.height) },
                text: body.slice(0, 600),
              });
            }
          }
          out.push({
            sourceWindow: windowIndex,
            sourceScrollTop: Math.round(scrollParent.scrollTop || 0),
            requestedScrollTop: position,
            expandedProcessed,
            label: labelInfo.label,
            action: labelInfo.action,
            count: labelInfo.count,
            stats: stats.map((item) => item.stat).slice(0, 8),
            matchOnly: false,
          });
        }
      }
      return out;
    };
    const windows = [];
    const commonMatches = [];
    let sourceActivityCount = 0;
    const seenMatches = new Set();
    for (let index = 0; index < positions.length; index += 1) {
      const position = positions[index];
      scrollParent.scrollTop = position;
      scrollParent.dispatchEvent(new Event("scroll", { bubbles: true }));
      await sleep(260);
      let turns = Array.from(root.querySelectorAll(turnSelector())).filter(visible).slice(0, 80);
      const expandedProcessed = await expandProcessedSummaries(turns);
      if (expandedProcessed) {
        await sleep(240);
        turns = Array.from(root.querySelectorAll(turnSelector())).filter(visible).slice(0, 80);
      }
      const activities = collectActivities(index + 1, position, expandedProcessed);
      const actualScrollTop = Math.round(scrollParent.scrollTop || 0);
      const matches = activities.filter((item) => item.targetSeq);
      sourceActivityCount += activities.filter((item) => item.label).length;
      for (const match of matches) {
        const key = match.targetSeq + ":" + match.stat;
        if (seenMatches.has(key)) continue;
        seenMatches.add(key);
        commonMatches.push(match);
      }
      windows.push({
        index: index + 1,
        requestedScrollTop: position,
        actualScrollTop,
        expandedProcessed,
        activityCount: activities.filter((item) => item.label).length,
        matchCount: matches.length,
        sampleActivities: activities.filter((item) => item.label).slice(0, 8).map((item) => ({ label: item.label, count: item.count, stats: item.stats || (item.stat ? [item.stat] : []) })),
      });
      if (commonMatches.length >= 12) break;
    }
    return { ok: true, reverse, maxScroll, positions: positions.length, windows, sourceActivityCount, commonMatches };
  })()`;
}

function statKey(basename, additions, deletions) {
  const token = normalizeFileToken(basename) || String(basename || "").toLowerCase();
  return `${token.split("/").filter(Boolean).at(-1) || token} +${Number(additions || 0)} -${Number(deletions || 0)}`;
}

function parseActivityLabel(value) {
  const text = normalizeSearchText(value);
  const zh = text.match(/已(编辑|创建|删除)\s+(\d+)\s+个文件/);
  if (zh) return { label: zh[0], action: ({ "编辑": "update", "创建": "add", "删除": "delete" })[zh[1]] || "", count: Number(zh[2] || 0) };
  const en = text.match(/\b(edited|created|deleted)\s+(\d+)\s+files?\b/i);
  if (en) return { label: en[0], action: ({ edited: "update", created: "add", deleted: "delete" })[en[1].toLowerCase()] || "", count: Number(en[2] || 0) };
  return null;
}

function normalizeSearchText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeFileToken(value) {
  let token = String(value || "")
    .replace(/^[`"'([{<]+|[`"',.;:)\]}>，。；、]+$/g, "")
    .replace(/\\/g, "/")
    .trim();
  if (!token) return "";
  token = token.replace(/^(?:\/root\/code\/codex-web\/|\/workspace\/|\/root\/)/, "");
  token = token.replace(/^\.\//, "");
  if (!/[A-Za-z0-9_.@/-]+\.[A-Za-z0-9][A-Za-z0-9._-]*/.test(token)) return "";
  if (/^(?:li|div|span|button|svg|path|a)\.[a-z0-9_.-]+$/i.test(token)) return "";
  if (/^\d+(?:\.\d+)?(?:px|rem|em|vh|vw|%)$/i.test(token)) return "";
  return token.toLowerCase();
}

async function getOrCreateSourceTarget() {
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
    best = await findCodexContext(page).catch((error) => ({ error: error.message }));
    if (best?.contextId && isCodeServerCodexWebview(best)) return best;
    await sleep(500);
  }
  if (best?.contextId) return best;
  throw new Error(`source Codex webview context not found: ${best?.error || "missing context"}`);
}

async function findCodexContext(page) {
  const frameTree = await page.send("Page.getFrameTree").catch(() => null);
  const frames = flattenFrames(frameTree?.frameTree).filter((frame) => frame.id);
  const candidates = [];
  for (const frame of frames) {
    const contextId = await createIsolatedWorld(page, frame.id);
    if (!contextId) continue;
    const probe = await evalInContext(page, contextId, contextProbeExpression(SOURCE_SELECTORS)).catch((error) => ({ error: error.message }));
    candidates.push({ frameId: frame.id, contextId, url: frame.url || "", probe, score: Number(probe?.score || 0) });
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
        best = { score, rootKind: root === document ? "document" : "shadow", hasConversation, hasTurn, hasComposer, hasUserBubble, hasAssistant, title: document.title, url: location.href, turnCount: root.querySelectorAll(selectors.turn).length };
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
    worldName: `codex-common-file-change-${Date.now()}`,
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
    const ok = await evalInContext(page, undefined, `Boolean(${expression})`).catch(() => false);
    if (ok) return;
    await sleep(250);
  }
  throw new Error(`${label} timed out`);
}

async function evalInContext(page, contextId, expression) {
  const params = { expression, awaitPromise: true, returnByValue: true, timeout: WAIT_TIMEOUT_MS };
  if (contextId) params.contextId = contextId;
  const result = await page.send("Runtime.evaluate", params);
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
