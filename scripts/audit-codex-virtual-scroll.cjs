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
const MAX_STEPS = Number(process.env.VIRTUAL_SCROLL_STEPS || 18);
const FOCUS_SEQ = Number(process.env.VIRTUAL_FOCUS_SEQ || 133);
const FOCUS_TEXT = process.env.VIRTUAL_FOCUS_TEXT || "Virtual scroll turn 45";

const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, "reference", "codex-reference");
const outJSON = path.join(outDir, "virtual-scroll-audit.json");
const outMD = path.join(outDir, "virtual-scroll-audit.md");

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const url = fixtureURL(APP_URL);
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

    await navigate(page, url);
    await evalPage(page, `(() => {
      localStorage.setItem("codex-web:sidebar-width", ${JSON.stringify(String(SIDEBAR_WIDTH))});
      document.documentElement.style.setProperty("--cw-sidebar-width", ${JSON.stringify(`${SIDEBAR_WIDTH}px`)});
    })()`);
    await waitForShadow(page, "[data-codex-view='thread']");
    await waitForShadow(page, "[data-codex-virtual-turn]");
    audit = await evalPage(page, virtualScrollAuditExpression());
  } finally {
    page.close();
    await closePageTarget(target.id).catch(() => {});
  }

  const checks = buildChecks(audit);
  const report = {
    generatedAt: new Date().toISOString(),
    fixtureURL: url,
    viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
    sidebarWidth: SIDEBAR_WIDTH,
    summary: {
      checks: checks.length,
      failed: checks.filter((check) => !check.ok).length,
      stepCount: audit?.steps?.length || 0,
      uniqueWindowCount: audit?.uniqueWindowCount || 0,
    },
    checks,
    audit,
  };

  fs.writeFileSync(outJSON, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(outMD, renderMarkdown(report));
  console.log(`${outJSON} (${report.summary.failed} failed)`);
  if (report.summary.failed > 0) process.exit(1);
}

function fixtureURL(baseURL) {
  const url = new URL(baseURL);
  url.searchParams.set("codexFixture", "virtual-scroll");
  url.searchParams.set("auditRun", RUN_ID);
  return url.toString();
}

function virtualScrollAuditExpression() {
  return `(async () => {
    const maxSteps = ${JSON.stringify(MAX_STEPS)};
    const focusSeq = ${JSON.stringify(FOCUS_SEQ)};
    const focusText = ${JSON.stringify(FOCUS_TEXT)};
    const root = document.querySelector("#codexPanel")?.shadowRoot;
    const scrollNode = () => root?.querySelector("[data-thread-scroll]");
    const conversationNode = () => root?.querySelector("[data-thread-find-target='conversation']");
    const settle = async () => {
      for (let index = 0; index < 5; index += 1) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      await new Promise((resolve) => setTimeout(resolve, 80));
    };
    const visible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const textOf = (element, limit = 220) => (element?.innerText || element?.textContent || "").replace(/\\s+/g, " ").trim().slice(0, limit);
    const turnSeqs = (element) => String(element?.getAttribute("data-codex-turn-seqs") || "")
      .split(",")
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);
    const visibleTurnBySeq = (seq) => Array.from(root?.querySelectorAll("[data-codex-virtual-turn]") || [])
      .filter(visible)
      .find((element) => turnSeqs(element).includes(seq)) || null;
    const waitUntil = async (predicate, timeout = 8000) => {
      const started = Date.now();
      while (Date.now() - started < timeout) {
        const result = predicate();
        if (result) return result;
        await settle();
      }
      return null;
    };
    const collectFocus = () => {
      const scroll = scrollNode();
      const viewport = scroll?.getBoundingClientRect?.() || { top: 0, bottom: window.innerHeight };
      const turn = visibleTurnBySeq(focusSeq);
      const rect = turn?.getBoundingClientRect?.();
      return {
        seq: focusSeq,
        expectedText: focusText,
        found: Boolean(turn),
        text: textOf(turn, 500),
        seqs: turnSeqs(turn),
        centered: Boolean(rect && viewport && rect.top >= viewport.top && rect.top <= viewport.bottom && rect.bottom >= viewport.top && rect.bottom <= viewport.bottom),
        rect: rect ? { top: Math.round(rect.top), bottom: Math.round(rect.bottom), height: Math.round(rect.height) } : null,
        viewport: viewport ? { top: Math.round(viewport.top), bottom: Math.round(viewport.bottom), height: Math.round(viewport.height || 0) } : null,
        scrollTop: Math.round(scroll?.scrollTop || 0),
      };
    };
    const collect = (label) => {
      const scroll = scrollNode();
      const viewport = scroll?.getBoundingClientRect?.() || { top: 0, bottom: window.innerHeight };
      const turns = Array.from(root?.querySelectorAll("[data-codex-virtual-turn]") || []).filter(visible).map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          key: element.getAttribute("data-codex-virtual-turn") || "",
          y: Math.round(rect.y),
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          height: Math.round(rect.height),
          text: textOf(element),
          inViewport: rect.bottom >= viewport.top && rect.top <= viewport.bottom,
        };
      });
      const viewportTurns = turns.filter((turn) => turn.inViewport);
      const overlaps = [];
      for (let index = 1; index < viewportTurns.length; index += 1) {
        const previous = viewportTurns[index - 1];
        const current = viewportTurns[index];
        if (current.top < previous.bottom - 1) {
          overlaps.push({ previous: previous.key, current: current.key, previousBottom: previous.bottom, currentTop: current.top });
        }
      }
      return {
        label,
        scrollTop: Math.round(scroll?.scrollTop || 0),
        scrollHeight: Math.round(scroll?.scrollHeight || 0),
        clientHeight: Math.round(scroll?.clientHeight || 0),
        turnCount: turns.length,
        viewportTurnCount: viewportTurns.length,
        firstTurnKey: viewportTurns[0]?.key || turns[0]?.key || "",
        lastTurnKey: viewportTurns.at(-1)?.key || turns.at(-1)?.key || "",
        firstTurnText: viewportTurns[0]?.text || "",
        lastTurnText: viewportTurns.at(-1)?.text || "",
        summaryCount: turns.filter((turn) => /(?:\\u5df2\\u5904\\u7406|Processed)\\s+\\d/i.test(turn.text || "")).length,
        activityHeaderCount: Array.from(root?.querySelectorAll(".group\\\\/activity-header, [class*='group/activity-header']") || []).filter(visible).length,
        toolGroupItemCount: Array.from(root?.querySelectorAll("[data-codex-tool-group-item]") || []).filter(visible).length,
        fileReferenceCount: Array.from(root?.querySelectorAll("[class*='tableCellFileLink']") || []).filter(visible).length,
        commandEnhancementTextCount: turns.filter((turn) => /\\bexec_command\\s*(?:x|×|脳)?\\s*\\d+\\b|\\bwrite_stdin\\b/i.test(turn.text || "")).length,
        spacerTopHeight: Number(root?.querySelector("[data-codex-virtual-spacer='top']")?.style?.height?.replace("px", "") || 0),
        spacerBottomHeight: Number(root?.querySelector("[data-codex-virtual-spacer='bottom']")?.style?.height?.replace("px", "") || 0),
        overlaps,
      };
    };
    if (!root || !scrollNode() || !conversationNode()) {
      return { ok: false, reason: "missing root, scroll container, or conversation", steps: [] };
    }
    await settle();
    window.dispatchEvent(new CustomEvent("codex-web:open-session", {
      detail: { sessionId: "virtual-scroll", focusSeq },
    }));
    await waitUntil(() => visibleTurnBySeq(focusSeq));
    const focus = collectFocus();
    const initialScroll = scrollNode();
    const maxScroll = Math.max(0, initialScroll.scrollHeight - initialScroll.clientHeight);
    const step = Math.max(1, Math.floor(initialScroll.clientHeight * 0.85));
    const steps = [];
    steps.push(collect("initial-bottom"));
    for (let index = 1; index <= maxSteps; index += 1) {
      const scroll = scrollNode();
      if (!scroll) break;
      scroll.scrollTop = Math.max(0, scroll.scrollTop - step);
      scroll.dispatchEvent(new Event("scroll", { bubbles: true }));
      await settle();
      steps.push(collect("up-" + index));
      if (scroll.scrollTop <= 0) break;
    }
    const topScroll = scrollNode();
    if (topScroll) {
      topScroll.scrollTop = 0;
      topScroll.dispatchEvent(new Event("scroll", { bubbles: true }));
    }
    await settle();
    steps.push(collect("top"));
    const bottomScroll = scrollNode();
    if (bottomScroll) {
      bottomScroll.scrollTop = bottomScroll.scrollHeight;
      bottomScroll.dispatchEvent(new Event("scroll", { bubbles: true }));
    }
    await settle();
    steps.push(collect("bottom-return"));
    const windows = steps.map((step) => step.firstTurnKey + "::" + step.lastTurnKey).filter((key) => key !== "::");
    return {
      ok: true,
      focus,
      maxScroll,
      step,
      steps,
      uniqueWindowCount: Array.from(new Set(windows)).length,
      maxCounts: steps.reduce((acc, step) => {
        acc.summaryCount = Math.max(acc.summaryCount, step.summaryCount);
        acc.activityHeaderCount = Math.max(acc.activityHeaderCount, step.activityHeaderCount);
        acc.toolGroupItemCount = Math.max(acc.toolGroupItemCount, step.toolGroupItemCount);
        acc.fileReferenceCount = Math.max(acc.fileReferenceCount, step.fileReferenceCount);
        acc.commandEnhancementTextCount = Math.max(acc.commandEnhancementTextCount, step.commandEnhancementTextCount);
        return acc;
      }, { summaryCount: 0, activityHeaderCount: 0, toolGroupItemCount: 0, fileReferenceCount: 0, commandEnhancementTextCount: 0 }),
    };
  })()`;
}

function buildChecks(audit) {
  const steps = audit?.steps || [];
  const maxCounts = audit?.maxCounts || {};
  const focus = audit?.focus || {};
  return [
    { name: "audit completed", ok: Boolean(audit?.ok), details: audit?.reason || "ok" },
    { name: "viewport is 1920x1080 or larger", ok: VIEWPORT_WIDTH >= 1920 && VIEWPORT_HEIGHT >= 1080, details: `${VIEWPORT_WIDTH}x${VIEWPORT_HEIGHT}` },
    { name: "focused historical seq renders in viewport", ok: Boolean(focus.found) && String(focus.text || "").includes(FOCUS_TEXT), details: focusDetails(focus) },
    { name: "long session is scrollable", ok: Number(audit?.maxScroll || 0) > VIEWPORT_HEIGHT, details: `maxScroll=${audit?.maxScroll || 0}` },
    { name: "multiple virtual windows observed", ok: Number(audit?.uniqueWindowCount || 0) >= 4, details: `unique=${audit?.uniqueWindowCount || 0}` },
    { name: "every captured step has visible turns", ok: steps.length > 0 && steps.every((step) => step.viewportTurnCount > 0), details: emptyStepDetails(steps) },
    { name: "no visible turn overlap", ok: steps.every((step) => !step.overlaps?.length), details: overlapDetails(steps) },
    { name: "top renders real turns, not blank spacer", ok: topStepOK(steps), details: stepDetails(steps.find((step) => step.label === "top")) },
    { name: "bottom return renders latest turns", ok: bottomStepOK(steps), details: stepDetails(steps.find((step) => step.label === "bottom-return")) },
    { name: "summary rows appear while scrolling", ok: Number(maxCounts.summaryCount || 0) > 0, details: `max=${maxCounts.summaryCount || 0}` },
    { name: "no grouped command detail rows appear while scrolling", ok: Number(maxCounts.toolGroupItemCount || 0) === 0, details: `max=${maxCounts.toolGroupItemCount || 0}` },
    { name: "no Codex Web-only command enhancement text appears while scrolling", ok: Number(maxCounts.commandEnhancementTextCount || 0) === 0, details: `max=${maxCounts.commandEnhancementTextCount || 0}` },
    { name: "file references appear while scrolling", ok: Number(maxCounts.fileReferenceCount || 0) > 0, details: `max=${maxCounts.fileReferenceCount || 0}` },
  ];
}

function focusDetails(focus) {
  if (!focus) return "missing";
  return `seq=${focus.seq || 0}, found=${Boolean(focus.found)}, scrollTop=${focus.scrollTop || 0}, text=${JSON.stringify(String(focus.text || "").slice(0, 160))}`;
}

function topStepOK(steps) {
  const top = steps.find((step) => step.label === "top");
  return Boolean(top && top.viewportTurnCount > 0 && Number(top.firstTurnKey || 0) <= 2);
}

function bottomStepOK(steps) {
  const bottom = steps.find((step) => step.label === "bottom-return");
  return Boolean(bottom && bottom.viewportTurnCount > 0 && Number(bottom.lastTurnKey || 0) >= 80);
}

function stepDetails(step) {
  if (!step) return "missing";
  return `${step.label}: ${step.firstTurnKey}..${step.lastTurnKey}, visible=${step.viewportTurnCount}, scrollTop=${step.scrollTop}`;
}

function emptyStepDetails(steps) {
  const empty = steps.filter((step) => step.viewportTurnCount <= 0).map((step) => step.label);
  return empty.length ? empty.join(", ") : `${steps.length} step(s)`;
}

function overlapDetails(steps) {
  const overlap = steps.find((step) => step.overlaps?.length);
  return overlap ? `${overlap.label}: ${JSON.stringify(overlap.overlaps[0])}` : "none";
}

function renderMarkdown(report) {
  const lines = [
    "# Codex Virtual Scroll Audit",
    "",
    `Generated: ${report.generatedAt}`,
    `Fixture: ${report.fixtureURL}`,
    `Viewport: ${report.viewport.width}x${report.viewport.height}`,
    "",
    "## Summary",
    "",
    `- Checks: ${report.summary.checks}`,
    `- Failed: ${report.summary.failed}`,
    `- Steps: ${report.summary.stepCount}`,
    `- Unique windows: ${report.summary.uniqueWindowCount}`,
    "",
    "## Checks",
    "",
    "| Check | Status | Details |",
    "| --- | --- | --- |",
  ];
  for (const check of report.checks) {
    lines.push(`| ${escapeMD(check.name)} | ${check.ok ? "ok" : "fail"} | ${escapeMD(String(check.details || ""))} |`);
  }
  lines.push("", "## Windows", "");
  for (const step of report.audit?.steps || []) {
    lines.push(`- ${step.label}: ${step.firstTurnKey}..${step.lastTurnKey}, visible=${step.viewportTurnCount}, scrollTop=${step.scrollTop}`);
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
  await fetch(`${CDP}/json/close/${encodeURIComponent(id)}`);
}

async function connect(webSocketDebuggerUrl) {
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
    else callback.resolve(message.result);
  });
  return {
    send(method, params = {}) {
      const messageID = ++id;
      socket.send(JSON.stringify({ id: messageID, method, params }));
      return new Promise((resolve, reject) => callbacks.set(messageID, { resolve, reject }));
    },
    close() {
      socket.close();
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
    throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed");
  }
  return result.result.value;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
