#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const outRoot = path.join(repoRoot, "reference", "live-anchor-alignment");
const targetURL = process.env.TARGET_URL || "https://codex.zelt.cn/?nodeId=host-docker-agent";
const targetNodeID = process.env.TARGET_NODE_ID || "host-docker-agent";
const targetSessionID = process.env.TARGET_SESSION_ID || "019f0a04-7f0b-7483-8bc4-18f214a5c8f1";
const viewportWidth = Number(process.env.VIEWPORT_WIDTH || 1920);
const viewportHeight = Number(process.env.VIEWPORT_HEIGHT || 1080);
const maxScrollSteps = Number(process.env.SCROLL_STEPS || 14);
const wheelDelta = Number(process.env.WHEEL_DELTA || -900);

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
      found.push({ packageDir, mtimeMs: fs.statSync(packageDir).mtimeMs });
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
  const runDir = path.join(outRoot, `${timestamp()}-target-scroll-click-diagnostic`);
  fs.mkdirSync(runDir, { recursive: true });

  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: viewportWidth, height: viewportHeight },
    extraHTTPHeaders: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });
  const page = await context.newPage();
  const consoleEntries = [];
  const pageErrors = [];
  const failedHTTPResponses = [];

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleEntries.push({ type: message.type(), text: message.text(), location: message.location() });
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push({ message: error.message, stack: error.stack || "" });
  });

  const session = await context.newCDPSession(page);
  await session.send("Network.enable");
  await session.send("Network.setCacheDisabled", { cacheDisabled: true });
  session.on("Network.responseReceived", (event) => {
    const status = event.response?.status || 0;
    if (status >= 400) {
      failedHTTPResponses.push({
        url: event.response.url,
        status,
        mimeType: event.response.mimeType || "",
        type: event.type,
      });
    }
  });

  const evidence = {
    kind: "target-scroll-click-diagnostic",
    acceptance: "diagnostic-only; not UI parity evidence",
    targetURL,
    targetNodeID,
    targetSessionID,
    viewport: { width: viewportWidth, height: viewportHeight },
    consoleEntries,
    pageErrors,
    failedHTTPResponses,
    screenshots: {},
    scrollSnapshots: [],
    clickAttempts: [],
  };

  try {
    await page.goto(targetURL, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await page.waitForFunction(() => {
      const panel = document.querySelector("#codexPanel");
      const root = panel?.shadowRoot || panel;
      return Boolean(root?.querySelector("[data-codex-panel-root]"));
    }, null, { timeout: 30000 });
    await page.evaluate(({ nodeID, sessionID }) => {
      window.dispatchEvent(new CustomEvent("codex-web:open-session", {
        detail: { nodeId: nodeID, sessionId: sessionID },
      }));
    }, { nodeID: targetNodeID, sessionID: targetSessionID });
    await page.waitForFunction(() => {
      const panel = document.querySelector("#codexPanel");
      const root = panel?.shadowRoot || panel;
      return Boolean(root?.querySelector("[data-codex-view='thread'] [data-thread-scroll]"));
    }, null, { timeout: 60000 });
    await page.waitForFunction(() => {
      const panel = document.querySelector("#codexPanel");
      const root = panel?.shadowRoot || panel;
      return (root?.querySelectorAll("[data-codex-virtual-turn]") || []).length > 0;
    }, null, { timeout: 60000 });
    await installClientHelpers(page);
    await page.waitForTimeout(1200);
    evidence.screenshots.initial = await screenshot(page, runDir, "target-initial.png");

    let clicked = false;
    for (let step = 0; step <= maxScrollSteps; step += 1) {
      const snapshot = await collectSnapshot(page, `step-${step}`);
      evidence.scrollSnapshots.push(snapshot);
      if (!clicked) {
        const candidate = chooseDisclosureCandidate(snapshot);
        if (candidate) {
          const beforeShot = await screenshot(page, runDir, `target-click-${step}-before.png`);
          const attempt = await clickDisclosure(page, candidate);
          await page.waitForTimeout(700);
          const after = await collectDisclosureState(page, candidate.key);
          const afterShot = await screenshot(page, runDir, `target-click-${step}-after.png`);
          evidence.clickAttempts.push({
            step,
            candidate,
            beforeShot,
            attempt,
            after,
            afterShot,
          });
          clicked = true;
        }
      }
      if (step === maxScrollSteps) break;
      await moveWheelInsideScroll(page, wheelDelta);
      await page.waitForTimeout(650);
    }
    evidence.screenshots.final = await screenshot(page, runDir, "target-final.png");
  } catch (error) {
    evidence.error = {
      message: error.message || String(error),
      stack: error.stack || "",
    };
    try {
      evidence.screenshots.failure = await screenshot(page, runDir, "target-failure.png");
      evidence.failureDOM = await page.evaluate(() => {
        const panel = document.querySelector("#codexPanel");
        const root = panel?.shadowRoot || panel;
        return {
          url: location.href,
          title: document.title,
          hasPanel: Boolean(panel),
          hasShadowRoot: Boolean(panel?.shadowRoot),
          rootText: String(root?.innerText || root?.textContent || "").slice(0, 2000),
          rootHTML: String(root?.innerHTML || "").slice(0, 2000),
        };
      }).catch((domError) => ({ error: domError.message || String(domError) }));
    } catch (screenshotError) {
      evidence.failureScreenshotError = screenshotError.message || String(screenshotError);
    }
  } finally {
    await browser.close();
  }

  const summaryPath = path.join(runDir, "summary.json");
  fs.writeFileSync(summaryPath, `${JSON.stringify(evidence, null, 2)}\n`);
  fs.writeFileSync(path.join(outRoot, "latest-target-scroll-click-diagnostic.txt"), path.basename(runDir));
  console.log(JSON.stringify({
    summaryPath,
    runDir,
    snapshotCount: evidence.scrollSnapshots.length,
    clickAttempts: evidence.clickAttempts.length,
    consoleWarningsOrErrors: consoleEntries.length,
    pageErrors: pageErrors.length,
    failedHTTPResponses: failedHTTPResponses.length,
    error: evidence.error?.message || "",
  }, null, 2));
  if (evidence.error) process.exitCode = 1;
}

async function screenshot(page, runDir, name) {
  const file = path.join(runDir, name);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function moveWheelInsideScroll(page, deltaY) {
  const point = await page.evaluate(() => {
    const root = window.__codexProbe?.root?.() || document;
    const scroll = root.querySelector("[data-thread-scroll]");
    const rect = scroll?.getBoundingClientRect?.();
    if (!rect) return { x: Math.floor(window.innerWidth / 2), y: Math.floor(window.innerHeight / 2) };
    return {
      x: Math.floor(rect.left + Math.min(rect.width - 20, Math.max(20, rect.width / 2))),
      y: Math.floor(rect.top + Math.min(rect.height - 20, Math.max(20, rect.height / 2))),
    };
  });
  await page.mouse.move(point.x, point.y);
  await page.mouse.wheel(0, deltaY);
}

function chooseDisclosureCandidate(snapshot) {
  const buttons = Array.isArray(snapshot.disclosures) ? snapshot.disclosures : [];
  return buttons.find((button) =>
    button.visible &&
    button.inViewport &&
    button.interactive &&
    button.ariaExpanded === "false" &&
    /已处理|Processed|宸插|edited|编辑|已编辑/i.test(button.text)
  ) || buttons.find((button) =>
    button.visible &&
    button.inViewport &&
    button.interactive &&
    button.ariaExpanded === "false"
  ) || null;
}

async function clickDisclosure(page, candidate) {
  const x = Math.floor(candidate.center.x);
  const y = Math.floor(candidate.center.y);
  const beforeHit = await hitTest(page, x, y);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
  const afterHit = await hitTest(page, x, y);
  return { x, y, beforeHit, afterHit };
}

async function hitTest(page, x, y) {
  return page.evaluate(({ x, y }) => {
    const node = window.__codexProbe.deepElementFromPoint(x, y);
    return window.__codexProbe.describeNodePath(node);
  }, { x, y });
}

async function collectDisclosureState(page, key) {
  return page.evaluate((key) => {
    const { root, deepElementFromPoint, describeElement, describeNodePath } = window.__codexProbe;
    const selectorValue = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(key) : String(key).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const scope = root();
    const button = scope.querySelector(`[data-disclosure-toggle="${selectorValue}"]`);
    const body = scope.querySelector(`[data-disclosure-body="${selectorValue}"]`);
    return {
      key,
      button: button ? describeElement(button) : null,
      body: body ? describeElement(body) : null,
      hitAtButtonCenter: button ? describeNodePath(deepElementFromPoint(
        button.getBoundingClientRect().left + button.getBoundingClientRect().width / 2,
        button.getBoundingClientRect().top + button.getBoundingClientRect().height / 2,
      )) : null,
    };
  }, key);
}

async function collectSnapshot(page, label) {
  return page.evaluate((label) => {
    const { root, rectJSON, spacerInfo, describeTurn, describeDisclosure, describeNodePath } = window.__codexProbe;
    const scope = root();
    const scroll = scope.querySelector("[data-thread-scroll]");
    const scrollRect = scroll?.getBoundingClientRect?.() || null;
    const topSpacer = scope.querySelector("[data-codex-virtual-spacer='top']");
    const bottomSpacer = scope.querySelector("[data-codex-virtual-spacer='bottom']");
    const turns = Array.from(scope.querySelectorAll("[data-codex-virtual-turn]"));
    const disclosures = Array.from(scope.querySelectorAll("[data-disclosure-toggle]"))
      .map((button, index) => describeDisclosure(button, index, scrollRect))
      .filter(Boolean);
    return {
      label,
      url: location.href,
      title: document.title,
      scroll: scroll ? {
        scrollTop: scroll.scrollTop,
        scrollHeight: scroll.scrollHeight,
        clientHeight: scroll.clientHeight,
        dataset: { ...scroll.dataset },
        rect: rectJSON(scrollRect),
      } : null,
      virtualSpacers: {
        top: spacerInfo(topSpacer),
        bottom: spacerInfo(bottomSpacer),
      },
      turnCount: turns.length,
      firstTurn: describeTurn(turns[0], scrollRect),
      lastTurn: describeTurn(turns[turns.length - 1], scrollRect),
      visibleTurnSamples: turns
        .map((turn) => describeTurn(turn, scrollRect))
        .filter((turn) => turn && turn.inViewport)
        .slice(0, 8),
      disclosures,
      visibleDisclosureCount: disclosures.filter((button) => button.visible && button.inViewport).length,
      activeElement: describeNodePath(scope.activeElement || document.activeElement),
    };
  }, label);
}

async function installClientHelpers(page) {
  await page.evaluate(() => {
    window.__codexProbe = {
      root,
      deepElementFromPoint,
      rectJSON,
      spacerInfo,
      describeTurn,
      describeDisclosure,
      describeElement,
      describeNodePath,
    };

    function root() {
      const panel = document.querySelector("#codexPanel");
      return panel?.shadowRoot || panel || document;
    }

    function deepElementFromPoint(x, y) {
      const scope = root();
      const scoped = scope.elementFromPoint?.(x, y);
      if (scoped) return scoped;
      const node = document.elementFromPoint(x, y);
      return node?.shadowRoot?.elementFromPoint?.(x, y) || node;
    }

    function rectJSON(rect) {
    if (!rect) return null;
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  }

    function visibleInRect(rect, containerRect) {
    if (!rect || rect.width <= 0 || rect.height <= 0) return false;
    if (!containerRect) return rect.bottom >= 0 && rect.top <= window.innerHeight;
    return rect.bottom >= containerRect.top && rect.top <= containerRect.bottom;
  }

    function spacerInfo(node) {
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return {
      heightStyle: node.style.height || "",
      rect: rectJSON(rect),
      text: (node.innerText || node.textContent || "").slice(0, 200),
    };
  }

    function describeTurn(turn, scrollRect) {
    if (!turn) return null;
    const rect = turn.getBoundingClientRect();
    const text = String(turn.innerText || turn.textContent || "").replace(/\s+/g, " ").trim();
    return {
      virtualIndex: turn.getAttribute("data-codex-virtual-turn") || "",
      seqs: turn.getAttribute("data-codex-turn-seqs") || "",
      inViewport: visibleInRect(rect, scrollRect),
      rect: rectJSON(rect),
      textLength: text.length,
      textSample: text.slice(0, 600),
    };
  }

    function describeDisclosure(button, index, scrollRect) {
    if (!button) return null;
    const rect = button.getBoundingClientRect();
    const style = getComputedStyle(button);
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const hit = deepElementFromPoint(center.x, center.y);
    const visible = rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    return {
      index,
      key: button.getAttribute("data-disclosure-toggle") || "",
      ariaExpanded: button.getAttribute("aria-expanded") || "",
      text: String(button.innerText || button.textContent || "").replace(/\s+/g, " ").trim().slice(0, 300),
      className: typeof button.className === "string" ? button.className : "",
      tagName: button.tagName,
      type: button.getAttribute("type") || "",
      visible,
      inViewport: visibleInRect(rect, scrollRect),
      interactive: style.pointerEvents !== "none" && !button.disabled,
      pointerEvents: style.pointerEvents,
      cursor: style.cursor,
      zIndex: style.zIndex,
      rect: rectJSON(rect),
      center,
      hitAtCenter: describeNodePath(hit),
    };
  }

    function describeElement(element) {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      tagName: element.tagName,
      className: typeof element.className === "string" ? element.className : "",
      text: String(element.innerText || element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 800),
      ariaExpanded: element.getAttribute("aria-expanded") || "",
      ariaHidden: element.getAttribute("aria-hidden") || "",
      inert: Boolean(element.inert),
      rect: rectJSON(rect),
      display: style.display,
      visibility: style.visibility,
      pointerEvents: style.pointerEvents,
      opacity: style.opacity,
      overflow: style.overflow,
      height: style.height,
    };
  }

    function describeNodePath(node) {
    const path = [];
    let current = node;
    for (let depth = 0; current && depth < 8; depth += 1) {
      if (current.nodeType !== Node.ELEMENT_NODE) {
        current = current.parentElement;
        continue;
      }
      path.push({
        tagName: current.tagName,
        id: current.id || "",
        className: typeof current.className === "string" ? current.className.slice(0, 300) : "",
        text: String(current.innerText || current.textContent || "").replace(/\s+/g, " ").trim().slice(0, 160),
        disclosureToggle: current.getAttribute("data-disclosure-toggle") || "",
        codexVirtualTurn: current.getAttribute("data-codex-virtual-turn") || "",
        threadScroll: current.hasAttribute("data-thread-scroll"),
        ariaExpanded: current.getAttribute("aria-expanded") || "",
      });
      current = current.parentElement;
    }
    return path;
  }

  });
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
