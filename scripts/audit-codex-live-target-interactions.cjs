#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const TARGET_URL = process.env.TARGET_URL || "https://codex.zelt.cn/?nodeId=host-docker-agent";
const TARGET_NODE_ID = process.env.TARGET_NODE_ID || "host-docker-agent";
const TARGET_SESSION_ID = process.env.TARGET_SESSION_ID || "019f0a04-7f0b-7483-8bc4-18f214a5c8f1";
const VIEWPORT_WIDTH = Number(process.env.VIEWPORT_WIDTH || 1920);
const VIEWPORT_HEIGHT = Number(process.env.VIEWPORT_HEIGHT || 1080);
const SCROLL_STEPS = Number(process.env.LIVE_SCROLL_STEPS || 18);
const WHEEL_DELTA = Number(process.env.LIVE_WHEEL_DELTA || 820);
const LIVE_FOCUS_SEQ = Number(process.env.LIVE_FOCUS_SEQ || process.env.TARGET_FOCUS_SEQ || 0);
const LIVE_FOCUS_TOP = Number(process.env.LIVE_FOCUS_TOP || process.env.TARGET_FOCUS_TOP || NaN);

const repoRoot = path.resolve(__dirname, "..");
const outRoot = path.join(repoRoot, "reference", "live-anchor-alignment");

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return [
    now.getUTCFullYear(),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
    "-",
    pad(now.getUTCHours()),
    pad(now.getUTCMinutes()),
    pad(now.getUTCSeconds()),
  ].join("");
}

function existingDirs(paths) {
  return paths.filter((candidate) => candidate && fs.existsSync(candidate));
}

function findPlaywrightPackages(root) {
  const found = [];
  if (!root || !fs.existsSync(root)) return found;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const packageDir = path.join(root, entry.name, "node_modules", "playwright");
    if (fs.existsSync(path.join(packageDir, "package.json"))) {
      const stat = fs.statSync(packageDir);
      found.push({ packageDir, mtimeMs: stat.mtimeMs });
    }
  }
  return found;
}

function requirePlaywright() {
  try {
    return require("playwright");
  } catch (_) {
    // Fall through to cache discovery.
  }
  const roots = existingDirs([
    process.env.PLAYWRIGHT_NODE_MODULE_DIR,
    path.join(process.env.LOCALAPPDATA || "", "npm-cache", "_npx"),
    path.join(process.env.APPDATA || "", "npm-cache", "_npx"),
    path.join(process.env.HOME || "", ".npm", "_npx"),
    "/root/.npm/_npx",
  ]);
  const candidates = roots.flatMap(findPlaywrightPackages).sort((a, b) => b.mtimeMs - a.mtimeMs);
  for (const candidate of candidates) {
    try {
      return require(candidate.packageDir);
    } catch (_) {
      // Try the next cached package.
    }
  }
  throw new Error("Cannot find playwright. Run `npx -y playwright --version` once, then retry.");
}

async function main() {
  const playwright = requirePlaywright();
  const runDir = path.join(outRoot, timestamp());
  fs.mkdirSync(runDir, { recursive: true });

  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
    extraHTTPHeaders: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });
  const page = await context.newPage();
  const consoleEntries = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleEntries.push({ type: message.type(), text: message.text(), location: message.location() });
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push({ message: error.message, stack: error.stack || "" });
  });

  try {
    const session = await context.newCDPSession(page);
    await session.send("Network.enable").catch(() => {});
    await session.send("Network.setCacheDisabled", { cacheDisabled: true }).catch(() => {});

    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("#codexPanel")?.shadowRoot, null, { timeout: 60000 });
    await page.evaluate(({ nodeId, sessionId, focusSeq, focusTop }) => {
      localStorage.setItem("codex-web:node-id", nodeId);
      const detail = { nodeId, sessionId };
      if (focusSeq) detail.focusSeq = focusSeq;
      if (Number.isFinite(focusTop)) detail.focusTop = focusTop;
      window.dispatchEvent(new CustomEvent("codex-web:open-session", {
        detail,
      }));
    }, { nodeId: TARGET_NODE_ID, sessionId: TARGET_SESSION_ID, focusSeq: LIVE_FOCUS_SEQ, focusTop: LIVE_FOCUS_TOP });
    await page.waitForFunction(() => {
      const root = document.querySelector("#codexPanel")?.shadowRoot;
      return Boolean(root?.querySelector("[data-thread-scroll]"));
    }, null, { timeout: 120000 });
    if (LIVE_FOCUS_SEQ) {
      await page.waitForFunction((focusSeq) => {
        const root = document.querySelector("#codexPanel")?.shadowRoot;
        const scroll = root?.querySelector("[data-thread-scroll]");
        if (!root || !scroll) return false;
        const first = Number(scroll.getAttribute("data-history-first-seq") || 0);
        const last = Number(scroll.getAttribute("data-history-last-seq") || 0);
        const loading = scroll.getAttribute("data-history-loading-before") === "true";
        const inRange = first > 0 && last > 0 && focusSeq >= first && focusSeq <= last;
        const rendered = Array.from(root.querySelectorAll("[data-codex-virtual-turn]")).some((turn) => String(turn.getAttribute("data-codex-turn-seqs") || "")
          .split(",")
          .map((value) => Number(value))
          .includes(focusSeq));
        return !loading && inRange && rendered;
      }, LIVE_FOCUS_SEQ, { timeout: 120000 });
    }
    await page.waitForTimeout(1500);

    const initial = await collectState(page, "initial");
    await page.screenshot({ path: path.join(runDir, "initial.png"), fullPage: false });

    const clickProbe = await probeProcessedDisclosure(page);
    await page.screenshot({ path: path.join(runDir, "after-processed-click.png"), fullPage: false });

    const beforeScroll = await collectState(page, "before-wheel-scroll");
    const scrollRect = beforeScroll.scroll?.rect || { left: 64, top: 64, width: 580, height: 780 };
    const wheelX = Math.round(scrollRect.left + Math.min(Math.max(scrollRect.width / 2, 40), Math.max(scrollRect.width - 40, 40)));
    const wheelY = Math.round(scrollRect.top + Math.min(Math.max(scrollRect.height / 2, 80), Math.max(scrollRect.height - 160, 80)));
    await page.mouse.move(wheelX, wheelY);

    const scrollSteps = [];
    let afterScrollClickProbe = null;
    for (let index = 0; index < SCROLL_STEPS; index += 1) {
      await page.mouse.wheel(0, -WHEEL_DELTA);
      await page.waitForTimeout(260);
      const stepState = await collectState(page, `wheel-up-${index + 1}`);
      scrollSteps.push(stepState);
      if (!afterScrollClickProbe && stepState.processedControls?.length) {
        afterScrollClickProbe = await probeProcessedDisclosure(page, stepState.processedControls[0].key);
      }
    }
    await page.screenshot({ path: path.join(runDir, "after-wheel-scroll.png"), fullPage: false });

    if (!afterScrollClickProbe) afterScrollClickProbe = await probeProcessedDisclosure(page);
    await page.screenshot({ path: path.join(runDir, "after-scroll-processed-click.png"), fullPage: false });

    const report = buildReport({
      runDir,
      initial,
      clickProbe,
      beforeScroll,
      scrollSteps,
      afterScrollClickProbe,
      consoleEntries,
      pageErrors,
    });
    fs.writeFileSync(path.join(runDir, "summary.json"), `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync(path.join(outRoot, "latest-target-interactions.txt"), `${runDir}\n`);
    console.log(JSON.stringify({
      summaryPath: path.join(runDir, "summary.json"),
      summary: report.summary,
      failed: report.checks.filter((check) => !check.ok).map((check) => ({ name: check.name, details: check.details })),
    }, null, 2));
    if (report.summary.failed > 0) process.exitCode = 1;
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

function buildReport(data) {
  const scrollTops = data.scrollSteps.map((step) => Number(step.scroll?.top || 0));
  const uniqueWindows = new Set(data.scrollSteps.map((step) => `${step.visibleTurns?.[0]?.key || ""}::${step.visibleTurns?.at(-1)?.key || ""}`));
  const scrollChanged = scrollTops.some((top) => top !== Number(data.beforeScroll.scroll?.top || 0));
  const hasTurnEveryStep = data.scrollSteps.every((step) => Number(step.visibleTurnCount || 0) > 0);
  const hasLoadingStuck = data.scrollSteps.at(-1)?.scroll?.loadingBefore === true
    && data.scrollSteps.slice(-4).every((step) => step.scroll?.loadingBefore === true);
  const commandRows = Math.max(
    Number(data.initial.commandEnhancementTextCount || 0),
    ...data.scrollSteps.map((step) => Number(step.commandEnhancementTextCount || 0)),
  );
  const checks = [
    { name: "target conversation loaded", ok: Boolean(data.initial.ok), details: data.initial.reason || stateDetails(data.initial) },
    { name: "live viewport is at least 1920x1080", ok: VIEWPORT_WIDTH >= 1920 && VIEWPORT_HEIGHT >= 1080, details: `${VIEWPORT_WIDTH}x${VIEWPORT_HEIGHT}` },
    { name: "requested focus seq is rendered when provided", ok: !LIVE_FOCUS_SEQ || Boolean(data.initial.focus?.rendered), details: !LIVE_FOCUS_SEQ ? "not requested" : focusDetails(data.initial.focus) },
    { name: "initial processed disclosure real click works", ok: Boolean(data.clickProbe.ok), details: probeDetails(data.clickProbe) },
    { name: "processed disclosure real click works after scrolling", ok: Boolean(data.afterScrollClickProbe.ok), details: probeDetails(data.afterScrollClickProbe) },
    { name: "real wheel scroll changes long-session viewport", ok: scrollChanged, details: `before=${data.beforeScroll.scroll?.top || 0}; steps=${scrollTops.join(",")}` },
    { name: "multiple rendered windows observed while scrolling", ok: uniqueWindows.size >= 3, details: `unique=${uniqueWindows.size}` },
    { name: "every wheel-scroll step has visible turns", ok: hasTurnEveryStep, details: data.scrollSteps.map(stateDetails).join(" | ") },
    { name: "history loading is not stuck", ok: !hasLoadingStuck, details: data.scrollSteps.slice(-4).map((step) => `${step.label}:${step.scroll?.loadingBefore}`).join(", ") },
    { name: "no Codex Web-only command transcript rows visible", ok: commandRows === 0, details: `max=${commandRows}` },
    { name: "browser console has no warnings/errors", ok: data.consoleEntries.length === 0 && data.pageErrors.length === 0, details: `console=${data.consoleEntries.length}; pageErrors=${data.pageErrors.length}` },
  ];
  return {
    generatedAt: new Date().toISOString(),
    targetURL: TARGET_URL,
    targetNodeId: TARGET_NODE_ID,
    targetSessionId: TARGET_SESSION_ID,
    targetFocusSeq: LIVE_FOCUS_SEQ || 0,
    viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
    screenshots: {
      initial: "initial.png",
      afterProcessedClick: "after-processed-click.png",
      afterWheelScroll: "after-wheel-scroll.png",
      afterScrollProcessedClick: "after-scroll-processed-click.png",
    },
    summary: {
      checks: checks.length,
      failed: checks.filter((check) => !check.ok).length,
      scrollSteps: data.scrollSteps.length,
      uniqueWindows: uniqueWindows.size,
    },
    checks,
    evidence: data,
  };
}

function stateDetails(step) {
  return `${step.label}: top=${step.scroll?.top || 0}, range=${step.scroll?.historyFirstSeq || 0}-${step.scroll?.historyLastSeq || 0}, visible=${step.visibleTurnCount || 0}, first=${step.visibleTurns?.[0]?.key || ""}, last=${step.visibleTurns?.at(-1)?.key || ""}`;
}

function focusDetails(focus) {
  if (!focus) return "missing";
  return `seq=${focus.seq || 0}; rendered=${Boolean(focus.rendered)}; inRange=${Boolean(focus.inRange)}; turn=${focus.turn?.key || ""}; rect=${focus.turn ? `${focus.turn.top}-${focus.turn.bottom}` : ""}`;
}

function probeDetails(probe) {
  if (!probe) return "missing";
  return `ok=${Boolean(probe.ok)}; target=${probe.target?.label || ""}; before=${probe.before?.expanded || ""}; afterFirst=${probe.afterFirst?.expanded || ""}; afterSecond=${probe.afterSecond?.expanded || ""}; hit=${Boolean(probe.hitTest?.controlHit || probe.hitTest?.selfHit)}; reason=${probe.reason || ""}`;
}

async function collectState(page, label) {
  return page.evaluate(({ inputLabel, focusSeq }) => {
    const root = document.querySelector("#codexPanel")?.shadowRoot;
    const scroll = root?.querySelector("[data-thread-scroll]");
    if (!root || !scroll) return { ok: false, label: inputLabel, reason: "missing root or scroll" };
    const scrollRect = scroll.getBoundingClientRect();
    const visible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && rect.bottom >= scrollRect.top && rect.top <= scrollRect.bottom && style.display !== "none" && style.visibility !== "hidden";
    };
    const textOf = (element, limit = 240) => (element?.innerText || element?.textContent || "").replace(/\s+/g, " ").trim().slice(0, limit);
    const visibleTurns = Array.from(root.querySelectorAll("[data-codex-virtual-turn], [data-turn-key]"))
      .filter(visible)
      .map((turn) => {
        const rect = turn.getBoundingClientRect();
        return {
          key: turn.getAttribute("data-codex-virtual-turn") || turn.getAttribute("data-turn-key") || "",
          seqs: turn.getAttribute("data-codex-turn-seqs") || "",
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          height: Math.round(rect.height),
          text: textOf(turn),
        };
      });
    const processedControls = Array.from(root.querySelectorAll("[data-disclosure-toggle], button[aria-expanded], [role='button'][aria-expanded]"))
      .filter(visible)
      .filter((node) => /(?:\u5df2\u5904\u7406|Processed)\s*\d/i.test(textOf(node, 80)))
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          label: textOf(node, 120),
          expanded: node.getAttribute("aria-expanded") || "",
          key: node.getAttribute("data-disclosure-toggle") || "",
          rect: rectJSON(rect),
          tagName: node.tagName,
          className: String(node.className || ""),
        };
      });
    const centerX = Math.round(scrollRect.left + scrollRect.width / 2);
    const centerY = Math.round(scrollRect.top + scrollRect.height / 2);
    const centerHit = document.elementFromPoint(centerX, centerY);
    const focusTurn = focusSeq
      ? visibleTurns.find((turn) => String(turn.seqs || "")
        .split(",")
        .map((value) => Number(value))
        .includes(focusSeq)) || null
      : null;
    return {
      ok: true,
      label: inputLabel,
      scroll: {
        top: Math.round(scroll.scrollTop || 0),
        height: Math.round(scroll.scrollHeight || 0),
        clientHeight: Math.round(scroll.clientHeight || 0),
        loadingBefore: scroll.getAttribute("data-history-loading-before") === "true",
        historyFirstSeq: Number(scroll.getAttribute("data-history-first-seq") || 0),
        historyLastSeq: Number(scroll.getAttribute("data-history-last-seq") || 0),
        rect: rectJSON(scrollRect),
      },
      visibleTurnCount: visibleTurns.length,
      visibleTurns,
      processedControls,
      focus: focusSeq ? {
        seq: focusSeq,
        inRange: Number(scroll.getAttribute("data-history-first-seq") || 0) <= focusSeq
          && focusSeq <= Number(scroll.getAttribute("data-history-last-seq") || 0),
        rendered: Boolean(focusTurn),
        turn: focusTurn,
      } : null,
      commandEnhancementTextCount: visibleTurns.filter((turn) => /\b(?:exec_command\s*(?:x|\u00d7)\s*\d+|write_stdin|Chunk ID)\b/i.test(turn.text || "")).length,
      centerHit: describeNode(centerHit),
    };

    function rectJSON(rect) {
      return {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        centerX: Math.round(rect.left + rect.width / 2),
        centerY: Math.round(rect.top + rect.height / 2),
      };
    }

    function describeNode(node) {
      if (!node) return null;
      return {
        tagName: node.tagName || "",
        id: node.id || "",
        className: String(node.className || ""),
        text: textOf(node, 120),
        dataDisclosureToggle: node.getAttribute?.("data-disclosure-toggle") || "",
      };
    }
  }, { inputLabel: label, focusSeq: LIVE_FOCUS_SEQ || 0 });
}

async function probeProcessedDisclosure(page, preferredKey = "") {
  const target = await findProcessedDisclosureControl(page, preferredKey);
  if (!target.ok) return { ok: false, reason: target.reason || "target missing", target };
  const hitOK = Boolean(target.hitTest?.controlHit || target.hitTest?.selfHit);
  if (!hitOK) return { ok: false, reason: "elementFromPoint did not hit processed disclosure", target, hitTest: target.hitTest };

  const before = await disclosureSnapshot(page, target.key);
  await page.mouse.click(target.rect.centerX, target.rect.centerY);
  await page.waitForTimeout(240);
  const afterFirst = await disclosureSnapshot(page, target.key);
  const targetAfterFirst = await findProcessedDisclosureControl(page, target.key);
  const hitAfterFirstOK = Boolean(targetAfterFirst.hitTest?.controlHit || targetAfterFirst.hitTest?.selfHit);
  if (targetAfterFirst.ok && hitAfterFirstOK) {
    await page.mouse.click(targetAfterFirst.rect.centerX, targetAfterFirst.rect.centerY);
    await page.waitForTimeout(240);
  }
  const afterSecond = await disclosureSnapshot(page, target.key);
  const startedExpanded = before.expanded === "true";
  const toggledFirst = startedExpanded ? afterFirst.expanded === "false" : afterFirst.expanded === "true";
  const toggledSecond = startedExpanded ? afterSecond.expanded === "true" : afterSecond.expanded === "false";
  return {
    ok: toggledFirst && toggledSecond,
    reason: toggledFirst && toggledSecond ? "" : "processed disclosure did not toggle twice",
    target,
    targetAfterFirst,
    hitTest: target.hitTest,
    before,
    afterFirst,
    afterSecond,
  };
}

async function findProcessedDisclosureControl(page, preferredKey = "") {
  return page.evaluate((inputKey) => {
    const root = document.querySelector("#codexPanel")?.shadowRoot;
    const scroll = root?.querySelector("[data-thread-scroll]");
    if (!root || !scroll) return { ok: false, reason: "missing root or scroll" };
    const scrollRect = scroll.getBoundingClientRect();
    const textOf = (element, limit = 120) => (element?.innerText || element?.textContent || "").replace(/\s+/g, " ").trim().slice(0, limit);
    const visible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && rect.bottom >= scrollRect.top && rect.top <= scrollRect.bottom && style.display !== "none" && style.visibility !== "hidden";
    };
    const candidates = Array.from(root.querySelectorAll("[data-disclosure-toggle], button[aria-expanded], [role='button'][aria-expanded]"))
      .filter(visible)
      .filter((node) => /(?:\u5df2\u5904\u7406|Processed)\s*\d/i.test(textOf(node, 100)));
    const node = inputKey
      ? candidates.find((candidate) => candidate.getAttribute("data-disclosure-toggle") === inputKey) || null
      : candidates[0];
    if (!node) return { ok: false, reason: "no visible processed disclosure control", candidates: candidates.length };
    const rect = node.getBoundingClientRect();
    const x = Math.round(rect.left + rect.width / 2);
    const y = Math.round(rect.top + rect.height / 2);
    const rootHit = root.elementFromPoint?.(x, y) || null;
    const documentHit = document.elementFromPoint(x, y);
    const closest = rootHit?.closest?.("[data-disclosure-toggle], button[aria-expanded], [role='button'][aria-expanded]")
      || documentHit?.closest?.("[data-disclosure-toggle], button[aria-expanded], [role='button'][aria-expanded]")
      || null;
    return {
      ok: true,
      label: textOf(node, 120),
      expanded: node.getAttribute("aria-expanded") || "",
      key: node.getAttribute("data-disclosure-toggle") || "",
      rect: {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        centerX: x,
        centerY: y,
      },
      hitTest: {
        selfHit: rootHit === node || documentHit === node,
        controlHit: closest === node,
        rootHit: describeNode(rootHit),
        documentHit: describeNode(documentHit),
        closest: describeNode(closest),
      },
    };

    function describeNode(item) {
      if (!item) return null;
      return {
        tagName: item.tagName || "",
        className: String(item.className || ""),
        text: textOf(item, 80),
        key: item.getAttribute?.("data-disclosure-toggle") || "",
        expanded: item.getAttribute?.("aria-expanded") || "",
      };
    }
  }, preferredKey);
}

async function disclosureSnapshot(page, key) {
  return page.evaluate((disclosureKey) => {
    const root = document.querySelector("#codexPanel")?.shadowRoot;
    const node = disclosureKey
      ? root?.querySelector(`[data-disclosure-toggle="${CSS.escape(disclosureKey)}"]`)
      : null;
    const textOf = (element, limit = 600) => (element?.innerText || element?.textContent || "").replace(/\s+/g, " ").trim().slice(0, limit);
    if (!root || !node) return { found: false, expanded: "", text: "", bodyText: "" };
    const turn = node.closest("[data-codex-virtual-turn], [data-turn-key]");
    const expanded = node.getAttribute("aria-expanded") || "";
    const body = root.querySelector(`[data-disclosure-body="${CSS.escape(disclosureKey)}"]`);
    return {
      found: true,
      expanded,
      text: textOf(node, 160),
      bodyVisible: Boolean(body && getComputedStyle(body).display !== "none"),
      bodyText: textOf(body, 600),
      turnText: textOf(turn, 800),
    };
  }, key);
}
