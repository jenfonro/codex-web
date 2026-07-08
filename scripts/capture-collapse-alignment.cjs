#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const CDP = process.env.CDP_URL || "http://127.0.0.1:9222";
const SOURCE_PATTERN = new RegExp(process.env.SOURCE_URL_PATTERN || "code-tx\\.zelt\\.cn", "i");
const TARGET_PATTERN = new RegExp(process.env.TARGET_URL_PATTERN || "(codex\\.zelt\\.cn|127\\.0\\.0\\.1:58888|localhost:58888)", "i");
const TARGET_SESSION_ID = process.env.TARGET_SESSION_ID || "thread-reference";
const TARGET_NODE_ID = process.env.TARGET_NODE_ID || "";
const MIN_VIEWPORT_WIDTH = Number(process.env.MIN_VIEWPORT_WIDTH || 1920);
const MIN_VIEWPORT_HEIGHT = Number(process.env.MIN_VIEWPORT_HEIGHT || 1080);
const TARGET_SIDEBAR_WIDTH = Number(process.env.TARGET_SIDEBAR_WIDTH || 611);
const MIN_SOURCE_SIDEBAR_WIDTH = Number(process.env.MIN_SOURCE_SIDEBAR_WIDTH || 580);
const LOAD_OLDER_EDGE_PX_FOR_CAPTURE = Number(process.env.LOAD_OLDER_EDGE_PX_FOR_CAPTURE || 480);
const MAX_TURN_NODES = Number(process.env.MAX_TURN_NODES || 80);
const MAX_SCROLL_CHUNKS = Number(process.env.MAX_SCROLL_CHUNKS || 14);
const DEFAULT_CDP_COMMAND_TIMEOUT_MS = Math.max(30000, MAX_SCROLL_CHUNKS * 9000);
const CDP_COMMAND_TIMEOUT_MS = Number(process.env.CDP_COMMAND_TIMEOUT_MS || DEFAULT_CDP_COMMAND_TIMEOUT_MS);
const CAPTURE_SCREENSHOT = process.env.CAPTURE_SCREENSHOT !== "0";
const EXPAND_SUMMARIES_FOR_CAPTURE = process.env.EXPAND_SUMMARIES_FOR_CAPTURE === "1";

const repoRoot = path.resolve(__dirname, "..");
const outRoot = path.resolve(process.env.CAPTURE_DIR || path.join(repoRoot, "reference", "collapse-alignment"));
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
const outDir = path.join(outRoot, stamp);

const STYLE_PROPS = [
  "display",
  "position",
  "boxSizing",
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "gap",
  "rowGap",
  "columnGap",
  "color",
  "backgroundColor",
  "border",
  "borderTop",
  "borderBottom",
  "borderRadius",
  "boxShadow",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "opacity",
  "overflow",
  "overflowX",
  "overflowY",
  "whiteSpace",
  "textOverflow",
  "alignItems",
  "justifyContent",
  "flexDirection",
  "transform",
  "transition",
  "animation",
  "cursor",
];

const SOURCE_SELECTORS = {
  conversation: "[data-thread-find-target='conversation']",
  turn: "[data-virtualized-turn-content], [data-turn-key], [data-content-search-unit-key]",
  summaryButton: "button[aria-expanded].text-size-chat",
  activityHeader: ".group\\/activity-header, [class*='group/activity-header']",
  toolDisclosure: "[data-testid*='tool'], [class*='activity-header']",
  toolGroupItem: "[data-codex-tool-group-item], [data-testid*='command']",
  userBubble: "[data-user-message-bubble]",
  assistantMarkdown: "._markdownContent_lzkx4_60",
  composer: ".composer-surface-chrome",
  fileReference: "[class*='FileLink'], [class*='fileLink'], [class*='tableCellFileLink'], .codex-file-reference",
  shimmer: ".loading-shimmer-pure-text, [class*='cadencedShimmer']",
};

const TARGET_SELECTORS = {
  conversation: "[data-thread-find-target='conversation']",
  turn: "[data-codex-virtual-turn], [data-turn-key], [data-content-search-unit-key]",
  summaryButton: "button[aria-expanded].text-size-chat",
  activityHeader: ".group\\/activity-header, [class*='group/activity-header']",
  toolDisclosure: "[class*='activity-header']",
  toolGroupItem: "[data-codex-tool-group-item]",
  userBubble: "[data-user-message-bubble]",
  assistantMarkdown: "._markdownContent_lzkx4_60",
  composer: ".composer-surface-chrome",
  fileReference: "._tableCellFileLink_lzkx4_413, [data-file-reference]",
  shimmer: ".loading-shimmer-pure-text, [class*='cadencedShimmer']",
};

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const targets = await readJSON(`${CDP}/json/list`);
  const sourceTarget = findTarget(targets, SOURCE_PATTERN, "source code-server");
  const targetTarget = findTarget(targets, TARGET_PATTERN, "target Codex Web", sourceTarget.id);

  const summary = {
    generatedAt: new Date().toISOString(),
    cdp: CDP,
    minViewport: { width: MIN_VIEWPORT_WIDTH, height: MIN_VIEWPORT_HEIGHT },
    source: pickTarget(sourceTarget),
    target: pickTarget(targetTarget),
    status: "pending",
    failures: [],
  };

  const source = await capturePage(sourceTarget, "source-code-server", SOURCE_SELECTORS, { source: true });
  const target = await capturePage(targetTarget, "target-codex-web", TARGET_SELECTORS, { target: true });
  summary.source = source.summary.target;
  summary.target = target.summary.target;
  summary.sourceCapture = source.summary;
  summary.targetCapture = target.summary;
  summary.failures.push(...source.failures, ...target.failures);
  summary.comparison = compareCaptures(source.summary, target.summary);
  summary.status = summary.failures.length ? "invalid-reference" : "captured";

  fs.writeFileSync(path.join(outDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(path.join(outRoot, "latest.txt"), outDir);

  console.log(outDir);
  if (summary.failures.length) {
    console.error(`capture preflight failed with ${summary.failures.length} issue(s):`);
    for (const failure of summary.failures) console.error(`- ${failure.scope}: ${failure.message}`);
    process.exitCode = 1;
  }
}

function findTarget(targets, pattern, label, excludedID = "") {
  const pages = targets.filter((target) => target.type === "page" && target.webSocketDebuggerUrl);
  const candidates = pages
    .filter((page) => page.id !== excludedID && pattern.test(`${page.url} ${page.title}`))
    .filter((page) => !isRejectedTargetPage(page, label))
    .sort((left, right) => targetPriority(right, label) - targetPriority(left, label));
  const target = candidates[0];
  if (!target) {
    throw new Error(`unable to find ${label} page matching ${pattern}`);
  }
  return target;
}

function isRejectedTargetPage(page, label) {
  if (label !== "target Codex Web") return false;
  return /[?&](codexFixture=(dynamic|virtual|virtual-scroll)|auditRun=|probe=)/i.test(page.url || "");
}

function targetPriority(page, label) {
  if (label !== "target Codex Web") return 0;
  const text = `${page.url || ""} ${page.title || ""}`;
  let score = 0;
  if (/[?&]codexFixture=reference\b/i.test(text)) score += 80;
  if (/codex\.zelt\.cn/i.test(text)) score += 60;
  if (/127\.0\.0\.1:58888\/?$|localhost:58888\/?$/i.test(page.url || "")) score += 40;
  if (/Codex Web/i.test(page.title || "")) score += 10;
  return score;
}

async function capturePage(target, label, selectors, options) {
  logStage(label, `connecting ${target.url || target.title || target.id}`);
  const pageDir = path.join(outDir, label);
  fs.mkdirSync(pageDir, { recursive: true });
  fs.mkdirSync(path.join(pageDir, "frames"), { recursive: true });

  const page = await connect(target.webSocketDebuggerUrl);
  const failures = [];
  const summary = {
    label,
    target: pickTarget(target),
    top: null,
    frames: [],
    selectedFrameIndex: -1,
    selectedFrameReason: "",
  };

  try {
    logStage(label, "enable domains");
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Network.enable").catch(() => {});
    await page.send("Network.setCacheDisabled", { cacheDisabled: true }).catch(() => {});
    await page.send("DOM.enable").catch(() => {});
    if (options.source) {
      logStage(label, "prepare source page");
      await prepareSourcePage(page);
    }
    if (options.target) {
      logStage(label, "prepare target page");
      await prepareTargetPage(page, target);
    }

    logStage(label, "top preflight");
    summary.top = await evalInContext(page, null, topPreflightExpression());
    syncTargetRecord(summary.target, summary.top);
    failures.push(...validateTopPreflight(summary.top, label, options));

    if (CAPTURE_SCREENSHOT) {
      logStage(label, "screenshot");
      const screenshot = await page.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
        fromSurface: true,
      }).catch((error) => ({ error: String(error?.message || error) }));
      if (screenshot?.data) {
        fs.writeFileSync(path.join(pageDir, "screenshot.png"), Buffer.from(screenshot.data, "base64"));
      } else if (screenshot?.error) {
        summary.screenshotError = screenshot.error;
      }
    }

    logStage(label, "frame tree");
    const frameTree = await page.send("Page.getFrameTree");
    fs.writeFileSync(path.join(pageDir, "frame-tree.json"), `${JSON.stringify(frameTree, null, 2)}\n`);
    const frames = flattenFrames(frameTree.frameTree);

    for (let index = 0; index < frames.length; index += 1) {
      const frame = frames[index];
      logStage(label, `frame ${index + 1}/${frames.length}`);
      const frameDir = path.join(pageDir, "frames", `${String(index).padStart(2, "0")}-${safeName(frame.name || frame.url || frame.id).slice(0, 80)}`);
      fs.mkdirSync(frameDir, { recursive: true });
      const frameSummary = {
        index,
        id: frame.id,
        parentId: frame.parentId,
        name: frame.name,
        url: frame.url,
        securityOrigin: frame.securityOrigin,
        mimeType: frame.mimeType,
      };
      try {
        const world = await page.send("Page.createIsolatedWorld", {
          frameId: frame.id,
          worldName: `codexCollapseCapture${index}`,
          grantUniveralAccess: true,
        });
        const capture = await evalInContext(page, world.executionContextId, captureFrameExpression(selectors, options));
        frameSummary.runtime = summarizeFrameRuntime(capture);
        fs.writeFileSync(path.join(frameDir, "runtime.json"), `${JSON.stringify(capture, null, 2)}\n`);
        if (capture.html) {
          fs.writeFileSync(path.join(frameDir, "document.html"), capture.html);
          delete capture.html;
        }
      } catch (error) {
        frameSummary.runtime = { ok: false, error: String(error?.message || error) };
      }
      fs.writeFileSync(path.join(frameDir, "summary.json"), `${JSON.stringify(frameSummary, null, 2)}\n`);
      summary.frames.push(frameSummary);
    }

    const selected = selectCodexFrame(summary.frames, options);
    summary.selectedFrameIndex = selected.index;
    summary.selectedFrameReason = selected.reason;
    failures.push(...validateSelectedFrame(selected, label, options));
    if (selected.frame) {
      logStage(label, "scroll chunks");
      try {
        const world = await page.send("Page.createIsolatedWorld", {
          frameId: selected.frame.id,
          worldName: "codexCollapseScrollCapture",
          grantUniveralAccess: true,
        });
        const scrollChunks = await evalInContext(page, world.executionContextId, scrollChunksExpression(selectors, options));
        summary.scrollChunks = summarizeScrollChunks(scrollChunks);
        fs.writeFileSync(path.join(pageDir, "scroll-chunks.json"), `${JSON.stringify(scrollChunks, null, 2)}\n`);
        failures.push(...validateScrollChunks(summary.scrollChunks, label, selected.frame.runtime));
      } catch (error) {
        summary.scrollChunks = { ok: false, reason: String(error?.message || error), chunkCount: 0, uniqueWindowCount: 0 };
        fs.writeFileSync(path.join(pageDir, "scroll-chunks.json"), `${JSON.stringify(summary.scrollChunks, null, 2)}\n`);
        failures.push({ scope: label, message: `scroll chunk capture failed: ${summary.scrollChunks.reason}` });
      }
    }
  } finally {
    page.close();
  }

  logStage(label, "write summary");
  fs.writeFileSync(path.join(pageDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  return { summary, failures };
}

async function prepareSourcePage(page) {
  await page.send("Emulation.setDeviceMetricsOverride", {
    width: MIN_VIEWPORT_WIDTH,
    height: MIN_VIEWPORT_HEIGHT,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: MIN_VIEWPORT_WIDTH,
    screenHeight: MIN_VIEWPORT_HEIGHT,
  });
  await waitFor(page, `document.readyState === "complete" || document.readyState === "interactive"`, 30000, "source page load");
  const before = await evalInContext(page, null, sidebarMetricsExpression());
  if (!before?.sidebar || Number(before.sidebar.width || 0) >= MIN_SOURCE_SIDEBAR_WIDTH) return;

  const startX = Math.round(before.sidebar.right);
  const endX = Math.round(before.sidebar.left + TARGET_SIDEBAR_WIDTH);
  const y = Math.round(before.sidebar.top + before.sidebar.height / 2);
  await dragMouse(page, startX, y, endX, y);
  await wait(800);

  const after = await evalInContext(page, null, sidebarMetricsExpression());
  if (Number(after?.sidebar?.width || 0) < MIN_SOURCE_SIDEBAR_WIDTH) {
    throw new Error(
      `source sidebar width ${Math.round(after?.sidebar?.width || 0)}px is below required ${MIN_SOURCE_SIDEBAR_WIDTH}px after resize`
    );
  }
}

async function prepareTargetPage(page, target) {
  await page.send("Emulation.setDeviceMetricsOverride", {
    width: MIN_VIEWPORT_WIDTH,
    height: MIN_VIEWPORT_HEIGHT,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: MIN_VIEWPORT_WIDTH,
    screenHeight: MIN_VIEWPORT_HEIGHT,
  });
  if (TARGET_NODE_ID) {
    await evalInContext(page, null, `(() => {
      try { localStorage.setItem("codex-web:node-id", ${JSON.stringify(TARGET_NODE_ID)}); } catch {}
    })()`).catch(() => {});
  }
  const freshURL = freshTargetURL(target);
  if (freshURL) {
    await page.send("Page.navigate", { url: freshURL });
  }
  await waitFor(page, `document.readyState === "complete" || document.readyState === "interactive"`, 30000, "target page load");
  await evalInContext(page, null, `(() => {
    localStorage.setItem("codex-web:sidebar-width", ${JSON.stringify(String(TARGET_SIDEBAR_WIDTH))});
    ${TARGET_NODE_ID ? `localStorage.setItem("codex-web:node-id", ${JSON.stringify(TARGET_NODE_ID)});` : ""}
    document.documentElement.style.setProperty("--cw-sidebar-width", ${JSON.stringify(`${TARGET_SIDEBAR_WIDTH}px`)});
  })()`);
  await waitFor(
    page,
    `!!document.querySelector("#codexPanel")?.shadowRoot?.querySelector("[data-codex-view]")`,
    30000,
    "target Codex panel"
  );
  if (TARGET_SESSION_ID) {
    await waitFor(
      page,
      `(() => {
        const root = document.querySelector("#codexPanel")?.shadowRoot;
        return Boolean(root?.querySelector(${JSON.stringify(`[data-codex-session-id="${TARGET_SESSION_ID}"]`)}));
      })()`,
      30000,
      `target session ${TARGET_SESSION_ID}`
    );
  }
  await evalInContext(page, null, `(() => {
    const root = document.querySelector("#codexPanel")?.shadowRoot;
    if (!root || root.querySelector("[data-thread-find-target='conversation']")) return true;
    const row = root.querySelector(${JSON.stringify(`[data-codex-session-id="${TARGET_SESSION_ID}"]`)}) || root.querySelector("[data-codex-session-id]");
    if (!row) return false;
    row.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, view: window }));
    return true;
  })()`);
  await waitFor(
    page,
    `(() => {
      const root = document.querySelector("#codexPanel")?.shadowRoot;
      return Boolean(root?.querySelector("[data-thread-find-target='conversation']") && root?.querySelector("[data-codex-composer]"));
    })()`,
    30000,
    "target conversation"
  );
  await waitFor(
    page,
    `(() => {
      const root = document.querySelector("#codexPanel")?.shadowRoot;
      return Boolean(root?.querySelector("[data-codex-virtual-turn], [data-turn-key], [data-content-search-unit-key]"));
    })()`,
    60000,
    "target conversation turns"
  );
}

function sidebarMetricsExpression() {
  return `(() => {
    const rectOf = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
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
    };
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio },
      sidebar: rectOf(".part.sidebar, .sidebar"),
      sash: rectOf(".monaco-sash.vertical"),
      webview: rectOf("iframe.webview.ready, iframe.webview"),
    };
  })()`;
}

async function dragMouse(page, startX, startY, endX, endY) {
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: startX, y: startY, button: "none" });
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
  for (let index = 1; index <= steps; index += 1) {
    const ratio = index / steps;
    await page.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: startX + (endX - startX) * ratio,
      y: startY + (endY - startY) * ratio,
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

function freshTargetURL(target) {
  if (process.env.TARGET_REFERENCE_URL) {
    const url = new URL(process.env.TARGET_REFERENCE_URL);
    url.searchParams.set("captureRun", stamp);
    if (TARGET_NODE_ID && !url.searchParams.has("nodeId")) url.searchParams.set("nodeId", TARGET_NODE_ID);
    return url.toString();
  }
  const raw = target?.url || "";
  if (TARGET_NODE_ID && /codex\.zelt\.cn/i.test(raw)) {
    const url = new URL(raw);
    url.searchParams.set("captureRun", stamp);
    if (!url.searchParams.has("nodeId")) url.searchParams.set("nodeId", TARGET_NODE_ID);
    return url.toString();
  }
  if (!/127\.0\.0\.1:58888|localhost:58888/i.test(raw)) return "";
  const url = new URL(raw);
  url.searchParams.set("codexFixture", "reference");
  url.searchParams.set("captureRun", stamp);
  if (TARGET_NODE_ID && !url.searchParams.has("nodeId")) url.searchParams.set("nodeId", TARGET_NODE_ID);
  return url.toString();
}

function topPreflightExpression() {
  return `(() => {
    const rectOf = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        selector,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        width: rect.width,
        height: rect.height,
        x: rect.x,
        y: rect.y,
        text: (element.innerText || element.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 500),
        className: String(element.className || ""),
        ariaLabel: element.getAttribute("aria-label") || "",
      };
    };
    const activityItems = Array.from(document.querySelectorAll(".part.activitybar .action-item, .activitybar .action-item, .part.activitybar [role='tab'], .activitybar [role='tab']"))
      .slice(0, 80)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const text = (element.innerText || element.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 200);
        const ariaLabel = element.getAttribute("aria-label") || element.querySelector("[aria-label]")?.getAttribute("aria-label") || "";
        const title = element.getAttribute("title") || element.querySelector("[title]")?.getAttribute("title") || "";
        return {
          className: String(element.className || ""),
          ariaLabel,
          title,
          text,
          checked: element.getAttribute("aria-checked") || element.getAttribute("aria-selected") || "",
          active: element.classList.contains("checked") || element.classList.contains("active") || element.getAttribute("aria-selected") === "true",
          width: rect.width,
          height: rect.height,
          looksCodex: /(codex|chatgpt|openai|chat|瀵硅瘽|鑱婂ぉ|浠诲姟)/i.test(ariaLabel + " " + title + " " + text + " " + String(element.className || "")),
        };
      });
    return {
      url: location.href,
      title: document.title,
      viewport: { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio },
      bodyText: (document.body?.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 2000),
      workbench: rectOf(".monaco-workbench"),
      activitybar: rectOf(".part.activitybar, .activitybar"),
      sidebar: rectOf(".part.sidebar, .sidebar"),
      auxiliarybar: rectOf(".part.auxiliarybar, .auxiliarybar"),
      editor: rectOf(".part.editor, .editor"),
      activeActivityItems: activityItems.filter((item) => item.active || item.checked === "true"),
      activityItems,
    };
  })()`;
}

function captureFrameExpression(selectors, options) {
  return `(() => {
    const selectors = ${JSON.stringify(selectors)};
    const props = ${JSON.stringify(STYLE_PROPS)};
    const maxTurnNodes = ${JSON.stringify(MAX_TURN_NODES)};
    const roots = [document, document.querySelector("#codexPanel")?.shadowRoot].filter(Boolean);
    const pickRoot = () => {
      for (const root of roots) {
        if (root.querySelector(selectors.conversation) || root.querySelector(selectors.composer) || root.querySelector(selectors.turn)) return root;
      }
      return document;
    };
    const root = pickRoot();
    const hiddenByAncestor = (element) => {
      let node = element;
      while (node && node.nodeType === Node.ELEMENT_NODE) {
        const style = getComputedStyle(node);
        if (
          node.hidden ||
          node.inert ||
          node.getAttribute("aria-hidden") === "true" ||
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.opacity === "0"
        ) {
          return true;
        }
        const rect = node.getBoundingClientRect();
        if (style.overflow === "hidden" && rect.width <= 0 && rect.height <= 0) return true;
        node = node.parentElement;
      }
      return false;
    };
    const visible = (element) => {
      if (!element || hiddenByAncestor(element)) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const visibleTextOf = (element, limit = 1000) => {
      if (!element) return "";
      const chunks = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const text = (node.nodeValue || "").replace(/\\s+/g, " ").trim();
        if (!text || !visible(node.parentElement)) continue;
        chunks.push(text);
        if (chunks.join(" ").length >= limit) break;
      }
      return chunks.join(" ").replace(/\\s+/g, " ").trim().slice(0, limit);
    };
    const styleOf = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const out = {
        tagName: element.tagName,
        id: element.id || "",
        className: String(element.className || ""),
        attributes: Array.from(element.attributes || []).reduce((acc, attr) => {
          if (/^(data-|aria-|role$|type$|title$)/.test(attr.name)) acc[attr.name] = attr.value;
          return acc;
        }, {}),
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        text: visibleTextOf(element, 1000),
        styles: {},
        html: element.outerHTML.slice(0, 20000),
      };
      for (const prop of props) out.styles[prop] = style[prop];
      return out;
    };
    const first = (selector) => styleOf(root.querySelector(selector));
    const many = (selector, limit) => Array.from(root.querySelectorAll(selector)).filter(visible).slice(0, limit).map(styleOf);
    const conversation = root.querySelector(selectors.conversation);
    const scrollParent = (() => {
      let node = conversation;
      while (node && node !== root && node !== document.documentElement) {
        const style = getComputedStyle(node);
        if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) return node;
        node = node.parentElement;
      }
      return document.scrollingElement;
    })();
    const text = (root.body || root.host || document.body)?.innerText || "";
    return {
      url: location.href,
      title: document.title,
      rootKind: root === document ? "document" : "shadow",
      viewport: { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio },
      bodyTextSample: text.replace(/\\s+/g, " ").trim().slice(0, 4000),
      hasCodexRoot: Boolean(root.querySelector("#root") || root.querySelector("[data-codex-panel-root]")),
      hasConversation: Boolean(conversation),
      hasComposer: Boolean(root.querySelector(selectors.composer)),
      hasUserBubble: Boolean(root.querySelector(selectors.userBubble)),
      hasAssistantMarkdown: Boolean(root.querySelector(selectors.assistantMarkdown)),
      selectors: {
        conversation: first(selectors.conversation),
        composer: first(selectors.composer),
        userBubble: first(selectors.userBubble),
        assistantMarkdown: first(selectors.assistantMarkdown),
        summaryButton: many(selectors.summaryButton, 20),
        activityHeader: many(selectors.activityHeader, 30),
        toolDisclosure: many(selectors.toolDisclosure, 30),
        toolGroupItem: many(selectors.toolGroupItem, 30),
        fileReference: many(selectors.fileReference, 30),
        shimmer: many(selectors.shimmer, 20),
        turns: many(selectors.turn, maxTurnNodes),
      },
      scroll: scrollParent ? {
        tagName: scrollParent.tagName,
        className: String(scrollParent.className || ""),
        scrollTop: scrollParent.scrollTop,
        scrollHeight: scrollParent.scrollHeight,
        clientHeight: scrollParent.clientHeight,
      } : null,
      html: document.documentElement.outerHTML,
    };
  })()`;
}

function scrollChunksExpression(selectors, options = {}) {
  return `(async () => {
    const selectors = ${JSON.stringify(selectors)};
    const props = ${JSON.stringify(STYLE_PROPS)};
    const maxChunks = ${JSON.stringify(MAX_SCROLL_CHUNKS)};
    const waitForHistoryLoad = ${JSON.stringify(Boolean(options.target))};
    const expandSummariesForCapture = ${JSON.stringify(EXPAND_SUMMARIES_FOR_CAPTURE)};
    const roots = [document, document.querySelector("#codexPanel")?.shadowRoot].filter(Boolean);
    const pickRoot = () => {
      for (const root of roots) {
        if (root.querySelector(selectors.conversation) || root.querySelector(selectors.composer) || root.querySelector(selectors.turn)) return root;
      }
      return document;
    };
    const root = pickRoot();
    const hiddenByAncestor = (element) => {
      let node = element;
      while (node && node.nodeType === Node.ELEMENT_NODE) {
        const style = getComputedStyle(node);
        if (
          node.hidden ||
          node.inert ||
          node.getAttribute("aria-hidden") === "true" ||
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.opacity === "0"
        ) {
          return true;
        }
        const rect = node.getBoundingClientRect();
        if (style.overflow === "hidden" && rect.width <= 0 && rect.height <= 0) return true;
        node = node.parentElement;
      }
      return false;
    };
    const visible = (element) => {
      if (!element || hiddenByAncestor(element)) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const findScrollParent = () => {
      const explicit = root.querySelector("[data-thread-scroll]");
      if (explicit) return explicit;
      const conversation = root.querySelector(selectors.conversation);
      let node = conversation;
      while (node && node !== root && node !== document.documentElement) {
        const style = getComputedStyle(node);
        if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) return node;
        node = node.parentElement;
      }
      return document.scrollingElement;
    };
    const initialScrollParent = findScrollParent();
    const textOf = (element, limit = 500) => {
      if (!element) return "";
      const chunks = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const text = (node.nodeValue || "").replace(/\\s+/g, " ").trim();
        if (!text || !visible(node.parentElement)) continue;
        chunks.push(text);
        if (chunks.join(" ").length >= limit) break;
      }
      return chunks.join(" ").replace(/\\s+/g, " ").trim().slice(0, limit);
    };
    const attrOf = (element) => {
      const attrs = {};
      for (const attr of Array.from(element?.attributes || [])) {
        if (/^(data-|aria-|role$)/.test(attr.name)) attrs[attr.name] = attr.value;
      }
      return attrs;
    };
    const styleOf = (element) => {
      if (!element) return null;
      const style = getComputedStyle(element);
      const out = {};
      for (const prop of props) out[prop] = style[prop];
      return out;
    };
    const nodeLine = (element) => {
      const attrs = attrOf(element);
      const attrText = Object.keys(attrs)
        .sort()
        .map((key) => \`[\${key}="\${attrs[key]}"]\`)
        .join("");
      return [
        element.tagName.toLowerCase(),
        String(element.className || "").replace(/\\s+/g, " ").trim(),
        attrText,
      ].filter(Boolean).join(" ");
    };
    const signatureOf = (element, maxDepth = 3, maxNodes = 80) => {
      const rows = [];
      const visit = (node, depth) => {
        if (!node || rows.length >= maxNodes || depth > maxDepth) return;
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        rows.push(\`\${"  ".repeat(depth)}\${nodeLine(node)}\`);
        for (const child of Array.from(node.children || [])) visit(child, depth + 1);
      };
      visit(element, 0);
      return rows;
    };
    const scopedCount = (element, selector) => Array.from(element.querySelectorAll(selector)).filter(visible).length;
    const scopedFirst = (element, selector) => {
      const node = Array.from(element.querySelectorAll(selector)).find(visible);
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return {
        tagName: node.tagName,
        className: String(node.className || ""),
        attrs: attrOf(node),
        text: textOf(node, 220),
        rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
        styles: styleOf(node),
        signature: signatureOf(node, 2, 40),
      };
    };
    const semanticOf = (element) => {
      const entries = {
        userBubble: selectors.userBubble,
        assistantMarkdown: selectors.assistantMarkdown,
        summaryButton: selectors.summaryButton,
        activityHeader: selectors.activityHeader,
        toolDisclosure: selectors.toolDisclosure,
        toolGroupItem: selectors.toolGroupItem,
        fileReference: selectors.fileReference,
        shimmer: selectors.shimmer,
      };
      const counts = {};
      const samples = {};
      for (const [name, selector] of Object.entries(entries)) {
        counts[name] = scopedCount(element, selector);
        samples[name] = scopedFirst(element, selector);
      }
      return { counts, samples };
    };
    const turnKey = (element, index) => (
      element.getAttribute("data-turn-key") ||
      element.getAttribute("data-content-search-unit-key") ||
      element.getAttribute("data-codex-virtual-turn") ||
      element.getAttribute("data-testid") ||
      element.id ||
      \`turn:\${index}:\${textOf(element, 80)}\`
    );
    const countVisible = (selector) => Array.from(root.querySelectorAll(selector)).filter(visible).length;
    const countWithinTurns = (turns, selector) => {
      const nodes = new Set();
      for (const turn of turns) {
        for (const node of Array.from(turn.element.querySelectorAll(selector)).filter(visible)) {
          nodes.add(node);
        }
      }
      return nodes.size;
    };
    const collect = (label, requestedScrollTop) => {
      const scrollParent = findScrollParent();
      const viewport = scrollParent?.getBoundingClientRect?.() || { top: 0, bottom: window.innerHeight };
      const turnCandidates = Array.from(root.querySelectorAll(selectors.turn)).filter(visible).map((element, index) => {
        const rect = element.getBoundingClientRect();
        return {
          element,
          index,
          key: turnKey(element, index),
          y: Math.round(rect.y),
          height: Math.round(rect.height),
          inViewport: rect.bottom >= viewport.top && rect.top <= viewport.bottom,
        };
      });
      const viewportCandidates = turnCandidates.filter((turn) => turn.inViewport);
      const turns = viewportCandidates.slice(0, 30).map((turn) => {
        const element = turn.element;
        return {
          index: turn.index,
          key: turn.key,
          tagName: element.tagName,
          className: String(element.className || ""),
          y: turn.y,
          height: turn.height,
          attrs: attrOf(element),
          styles: styleOf(element),
          signature: signatureOf(element),
          semantic: semanticOf(element),
          text: textOf(element, 220),
          inViewport: turn.inViewport,
        };
      });
      return {
        label,
        requestedScrollTop,
        actualScrollTop: scrollParent?.scrollTop || 0,
        scrollHeight: scrollParent?.scrollHeight || 0,
        clientHeight: scrollParent?.clientHeight || 0,
        className: String(scrollParent?.className || ""),
        attrs: attrOf(scrollParent),
        flexDirection: scrollParent ? getComputedStyle(scrollParent).flexDirection : "",
        turnCount: turnCandidates.length,
        viewportTurnCount: viewportCandidates.length,
        firstTurnKey: viewportCandidates[0]?.key || turnCandidates[0]?.key || "",
        lastTurnKey: viewportCandidates.at(-1)?.key || turnCandidates.at(-1)?.key || "",
        firstTurnText: turns[0]?.text || "",
        lastTurnText: turns.at(-1)?.text || "",
        counts: {
          summaries: countWithinTurns(viewportCandidates, selectors.summaryButton),
          activityHeaders: countWithinTurns(viewportCandidates, selectors.activityHeader),
          toolDisclosures: countWithinTurns(viewportCandidates, selectors.toolDisclosure),
          toolGroupItems: countWithinTurns(viewportCandidates, selectors.toolGroupItem),
          fileReferences: countWithinTurns(viewportCandidates, selectors.fileReference),
          shimmers: countWithinTurns(viewportCandidates, selectors.shimmer),
        },
        documentCounts: {
          summaries: countVisible(selectors.summaryButton),
          activityHeaders: countVisible(selectors.activityHeader),
          toolDisclosures: countVisible(selectors.toolDisclosure),
          toolGroupItems: countVisible(selectors.toolGroupItem),
          fileReferences: countVisible(selectors.fileReference),
          shimmers: countVisible(selectors.shimmer),
        },
        turns,
      };
    };
    const settle = async () => {
      await new Promise((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        requestAnimationFrame(finish);
        setTimeout(finish, 40);
      });
      await new Promise((resolve) => setTimeout(resolve, 60));
    };
    const setScrollTop = async (position) => {
      const scrollParent = findScrollParent();
      if (!scrollParent) return null;
      scrollParent.scrollTop = position;
      scrollParent.dispatchEvent(new Event("scroll", { bubbles: true }));
      await settle();
      if (waitForHistoryLoad && position <= ${JSON.stringify(LOAD_OLDER_EDGE_PX_FOR_CAPTURE)}) {
        await waitForStableHistory();
      }
      return findScrollParent();
    };
    const visibleProcessedSummaryButtons = () => Array.from(root.querySelectorAll(selectors.summaryButton))
      .filter(visible)
      .filter((button) => button.getAttribute("aria-expanded") === "false")
      .filter((button) => /(?:\\u5df2\\u5904\\u7406|processed)/i.test(textOf(button, 160)));
    const disclosureButtonByKey = (key) => {
      if (!key) return null;
      return Array.from(root.querySelectorAll("[data-disclosure-toggle]"))
        .find((button) => button.getAttribute("data-disclosure-toggle") === key);
    };
    const currentDisclosureButton = (button) => disclosureButtonByKey(button.getAttribute("data-disclosure-toggle") || "") || button;
    const expandVisibleProcessedSummaries = async () => {
      const buttons = visibleProcessedSummaryButtons().slice(0, 8);
      let expanded = 0;
      for (const button of buttons) {
        button.scrollIntoView?.({ block: "center", inline: "nearest" });
        await settle();
        button.click();
        await settle();
        const current = currentDisclosureButton(button);
        if (current?.getAttribute("aria-expanded") === "true") expanded += 1;
      }
      return expanded;
    };
    const historyStats = () => {
      const scrollParent = findScrollParent();
      return {
        scrollHeight: scrollParent?.scrollHeight || 0,
        turnCount: Array.from(root.querySelectorAll(selectors.turn)).filter(visible).length,
        loading: Boolean(root.querySelector(".codex-history-page-loader, [role='status']")),
      };
    };
    const waitForStableHistory = async () => {
      let previous = historyStats();
      let stableCount = 0;
      let observedHistoryWork = false;
      const started = Date.now();
      while (Date.now() - started < 5000) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        await settle();
        const next = historyStats();
        if (next.loading || next.scrollHeight !== previous.scrollHeight || next.turnCount !== previous.turnCount) {
          observedHistoryWork = true;
        }
        const stable = next.scrollHeight === previous.scrollHeight && next.turnCount === previous.turnCount && !next.loading;
        stableCount = stable ? stableCount + 1 : 0;
        previous = next;
        if (stableCount >= 3 && (observedHistoryWork || Date.now() - started >= 900)) return;
      }
    };
    if (!initialScrollParent) return { ok: false, reason: "no scroll parent", chunks: [] };
    const maxScroll = Math.max(0, initialScrollParent.scrollHeight - initialScrollParent.clientHeight);
    const style = getComputedStyle(initialScrollParent);
    const reverse = style.flexDirection === "column-reverse" || /flex-col-reverse/.test(String(initialScrollParent.className || ""));
    const step = Math.max(1, Math.floor(initialScrollParent.clientHeight * 0.85));
    const currentTop = initialScrollParent.scrollTop || 0;
    const positions = [];
    const addPosition = (value) => {
      const rounded = Math.round(value);
      if (!positions.includes(rounded)) positions.push(rounded);
    };
    if (reverse) {
      addPosition(currentTop);
      for (let value = currentTop + step; value < 0 && positions.length < maxChunks - 1; value += step) {
        addPosition(value);
      }
      if (currentTop < 0) addPosition(0);
      for (let value = currentTop - step; Math.abs(value) < maxScroll && positions.length < maxChunks - 1; value -= step) {
        addPosition(value);
      }
      if (maxScroll > 0) addPosition(-maxScroll);
    } else {
      addPosition(currentTop);
      for (let value = currentTop - step; value > 0 && positions.length < maxChunks - 1; value -= step) {
        addPosition(value);
      }
      if (currentTop > 0) addPosition(0);
      for (let value = currentTop + step; value < maxScroll && positions.length < maxChunks - 1; value += step) {
        addPosition(value);
      }
      if (maxScroll > 0) addPosition(maxScroll);
    }
    const uniquePositions = positions.slice(0, maxChunks);
    const chunks = [];
    for (let index = 0; index < uniquePositions.length; index += 1) {
      const position = uniquePositions[index];
      await setScrollTop(position);
      chunks.push(collect(\`chunk-\${index}\`, position));
      if (expandSummariesForCapture) {
        const expandedSummaries = await expandVisibleProcessedSummaries();
        if (expandedSummaries > 0) {
          const expandedChunk = collect(\`chunk-\${index}-expanded\`, position);
          expandedChunk.expandedSummaries = expandedSummaries;
          chunks.push(expandedChunk);
        }
      }
    }
    return {
      ok: true,
      reverse,
      maxScroll,
      step,
      positions: uniquePositions,
      chunks,
    };
  })()`;
}

function validateTopPreflight(preflight, label, options) {
  const failures = [];
  const viewport = preflight?.viewport || {};
  if (Number(viewport.width || 0) < MIN_VIEWPORT_WIDTH || Number(viewport.height || 0) < MIN_VIEWPORT_HEIGHT) {
    failures.push({
      scope: label,
      message: `viewport ${viewport.width || 0}x${viewport.height || 0} is below required ${MIN_VIEWPORT_WIDTH}x${MIN_VIEWPORT_HEIGHT}`,
    });
  }
  if (options.source && Number(preflight?.sidebar?.width || 0) < MIN_SOURCE_SIDEBAR_WIDTH) {
    failures.push({
      scope: label,
      message: `source Codex sidebar width ${Math.round(preflight?.sidebar?.width || 0)}px is below required ${MIN_SOURCE_SIDEBAR_WIDTH}px`,
    });
  }
  if (!options.source) return failures;

  const auxiliary = preflight.auxiliarybar;
  const auxiliaryVisible = auxiliary && auxiliary.display !== "none" && auxiliary.visibility !== "hidden" && Number(auxiliary.width || 0) > 1 && Number(auxiliary.height || 0) > 1;
  if (auxiliaryVisible) {
    failures.push({
      scope: label,
      message: `right auxiliary/chat sidebar is visible (${Math.round(auxiliary.width)}x${Math.round(auxiliary.height)})`,
    });
  }

  const sidebarText = `${preflight.sidebar?.ariaLabel || ""} ${preflight.sidebar?.text || ""}`;
  const activeActivityItems = preflight.activeActivityItems || [];
  const activeLeftCodexItem = activeActivityItems.find((item) =>
    item.looksCodex || /(codex|chatgpt|openai|chat|瀵硅瘽|鑱婂ぉ|浠诲姟)/i.test(`${item.ariaLabel || ""} ${item.title || ""} ${item.text || ""} ${item.className || ""}`),
  );
  if (activeLeftCodexItem) {
    preflight = { ...preflight, title: "" };
  }
  if (/资源管理器|Explorer|欢迎|Welcome/i.test(`${preflight.title || ""} ${sidebarText}`)) {
    failures.push({
      scope: label,
      message: "current code-server view looks like Explorer/welcome, not the left Activity Bar Codex conversation view",
    });
  }

  const activeText = activeActivityItems
    .map((item) => `${item.ariaLabel || ""} ${item.title || ""} ${item.text || ""} ${item.className || ""}`)
    .join(" ");
  if (!activeLeftCodexItem) {
    failures.push({
      scope: label,
      message: `active left Activity Bar item does not look like Codex/ChatGPT/OpenAI (${activeText.trim() || "no active item"})`,
    });
    return failures;
  }
  if (!/(codex|chatgpt|openai|chat|对话|聊天|任务)/i.test(`${activeText} ${sidebarText}`)) {
    failures.push({
      scope: label,
      message: "active left Activity Bar item does not look like Codex/ChatGPT/OpenAI",
    });
  }
  return failures;
}

function selectCodexFrame(frames, options) {
  const candidates = frames
    .filter((frame) => frame.runtime?.ok)
    .map((frame) => {
      const runtime = frame.runtime;
      let score = 0;
      if (runtime.hasConversation) score += 8;
      if (runtime.hasComposer) score += 4;
      if (runtime.hasUserBubble) score += 3;
      if (runtime.hasAssistantMarkdown) score += 3;
      if (runtime.summaryButtonCount) score += 2;
      if (runtime.activityHeaderCount) score += 2;
      if (runtime.turnCount) score += 2;
      if (runtime.hasCodexRoot) score += 1;
      return { frame, score };
    })
    .sort((left, right) => right.score - left.score);

  const best = candidates[0];
  if (!best) return { index: -1, score: 0, frame: null, reason: "no readable frames" };
  const reason = `score ${best.score}: conversation=${best.frame.runtime.hasConversation}, composer=${best.frame.runtime.hasComposer}, turns=${best.frame.runtime.turnCount}`;
  return { index: best.frame.index, score: best.score, frame: best.frame, reason };
}

function validateSelectedFrame(selected, label, options) {
  const failures = [];
  if (!selected.frame || selected.score < (options.source ? 8 : 6)) {
    failures.push({
      scope: label,
      message: `unable to identify Codex conversation frame (${selected.reason})`,
    });
    return failures;
  }
  if (options.source && !selected.frame.runtime.hasConversation && !selected.frame.runtime.hasUserBubble) {
    failures.push({
      scope: label,
      message: "source frame does not expose the live Codex conversation surface",
    });
  }
  if (options.target && !selected.frame.runtime.hasConversation) {
    failures.push({
      scope: label,
      message: "target Codex Web frame does not expose the conversation surface",
    });
  }
  return failures;
}

function validateScrollChunks(scrollSummary, label, runtime) {
  const failures = [];
  const scroll = runtime?.scroll;
  const scrollable = Number(scroll?.scrollHeight || 0) > Number(scroll?.clientHeight || 0) * 1.5;
  if (!scrollable) return failures;
  if (!scrollSummary?.ok) {
    failures.push({ scope: label, message: `unable to capture virtual scroll chunks: ${scrollSummary?.reason || "unknown"}` });
    return failures;
  }
  if (Number(scrollSummary.chunkCount || 0) < 2 || Number(scrollSummary.uniqueWindowCount || 0) < 2) {
    failures.push({
      scope: label,
      message: `virtual scroll capture did not reach multiple windows (chunks=${scrollSummary.chunkCount || 0}, unique=${scrollSummary.uniqueWindowCount || 0})`,
    });
  }
  const emptyWindows = (scrollSummary.windows || []).filter((window) => Number(window.viewportTurnCount || 0) <= 0);
  if (emptyWindows.length) {
    failures.push({
      scope: label,
      message: `virtual scroll capture included blank windows: ${emptyWindows.map((window) => window.label).join(", ")}`,
    });
  }
  return failures;
}

function summarizeFrameRuntime(capture) {
  return {
    ok: true,
    url: capture.url,
    title: capture.title,
    rootKind: capture.rootKind,
    viewport: capture.viewport,
    hasCodexRoot: capture.hasCodexRoot,
    hasConversation: capture.hasConversation,
    hasComposer: capture.hasComposer,
    hasUserBubble: capture.hasUserBubble,
    hasAssistantMarkdown: capture.hasAssistantMarkdown,
    turnCount: capture.selectors?.turns?.length || 0,
    summaryButtonCount: capture.selectors?.summaryButton?.length || 0,
    activityHeaderCount: capture.selectors?.activityHeader?.length || 0,
    toolDisclosureCount: capture.selectors?.toolDisclosure?.length || 0,
    toolGroupItemCount: capture.selectors?.toolGroupItem?.length || 0,
    fileReferenceCount: capture.selectors?.fileReference?.length || 0,
    shimmerCount: capture.selectors?.shimmer?.length || 0,
    scroll: capture.scroll,
    bodyTextSample: capture.bodyTextSample,
  };
}

function summarizeScrollChunks(capture) {
  if (!capture?.ok) return { ok: false, reason: capture?.reason || "unknown", chunkCount: 0, uniqueWindowCount: 0 };
  const chunks = Array.isArray(capture.chunks) ? capture.chunks : [];
  const windows = chunks.map((chunk) => `${chunk.firstTurnKey || ""}::${chunk.lastTurnKey || ""}`);
  const uniqueWindows = Array.from(new Set(windows.filter((key) => key !== "::")));
  const aggregateCounts = chunks.reduce(
    (acc, chunk) => {
      const counts = chunk.counts || {};
      for (const key of Object.keys(acc.maxCounts)) {
        acc.maxCounts[key] = Math.max(acc.maxCounts[key], Number(counts[key] || 0));
      }
      return acc;
    },
    {
      maxCounts: {
        summaries: 0,
        activityHeaders: 0,
        toolDisclosures: 0,
        toolGroupItems: 0,
        fileReferences: 0,
        shimmers: 0,
      },
    },
  );
  return {
    ok: true,
    reverse: Boolean(capture.reverse),
    maxScroll: Number(capture.maxScroll || 0),
    step: Number(capture.step || 0),
    chunkCount: chunks.length,
    uniqueWindowCount: uniqueWindows.length,
    windows: chunks.map((chunk) => ({
      label: chunk.label,
      requestedScrollTop: chunk.requestedScrollTop,
      actualScrollTop: chunk.actualScrollTop,
      turnCount: chunk.turnCount,
      viewportTurnCount: chunk.viewportTurnCount,
      firstTurnKey: chunk.firstTurnKey,
      lastTurnKey: chunk.lastTurnKey,
      counts: chunk.counts,
      documentCounts: chunk.documentCounts,
    })),
    maxCounts: aggregateCounts.maxCounts,
  };
}

function compareCaptures(source, target) {
  const sourceFrame = source.frames[source.selectedFrameIndex]?.runtime || {};
  const targetFrame = target.frames[target.selectedFrameIndex]?.runtime || {};
  return {
    sourceFrame: source.selectedFrameIndex,
    targetFrame: target.selectedFrameIndex,
    counts: {
      source: pickCounts(sourceFrame),
      target: pickCounts(targetFrame),
    },
    scrollChunks: {
      source: source.scrollChunks || null,
      target: target.scrollChunks || null,
    },
    notes: [
      "This report only proves that valid reference/target surfaces were captured.",
      "Use the saved frame runtime.json and scroll-chunks.json files for DOM/class/computed-style rule alignment.",
    ],
  };
}

function pickCounts(runtime) {
  return {
    turns: runtime.turnCount || 0,
    summaries: runtime.summaryButtonCount || 0,
    activityHeaders: runtime.activityHeaderCount || 0,
    toolDisclosures: runtime.toolDisclosureCount || 0,
    toolGroupItems: runtime.toolGroupItemCount || 0,
    fileReferences: runtime.fileReferenceCount || 0,
    shimmers: runtime.shimmerCount || 0,
  };
}

function flattenFrames(node, out = []) {
  if (!node) return out;
  out.push(node.frame);
  for (const child of node.childFrames || []) flattenFrames(child, out);
  return out;
}

function safeName(value) {
  return String(value || "frame")
    .replace(/^[a-z]+:\/\//i, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "frame";
}

function pickTarget(target) {
  return {
    id: target.id,
    type: target.type,
    title: target.title,
    url: target.url,
  };
}

function syncTargetRecord(target, top) {
  if (!target || !top) return;
  if (top.url) target.url = top.url;
  if (top.title) target.title = top.title;
}

function logStage(label, message) {
  process.stderr.write(`[capture:${label}] ${message}\n`);
}

async function readJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
  return response.json();
}

async function evalInContext(client, contextId, expression) {
  const params = {
    expression,
    awaitPromise: true,
    returnByValue: true,
  };
  if (contextId != null) params.contextId = contextId;
  const result = await client.send("Runtime.evaluate", params);
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || JSON.stringify(result.exceptionDetails));
  }
  return result.result?.value;
}

async function waitFor(client, expression, timeoutMs, label) {
  const started = Date.now();
  let lastError = "";
  while (Date.now() - started < timeoutMs) {
    try {
      if (await evalInContext(client, null, expression)) return;
    } catch (error) {
      lastError = String(error?.message || error);
    }
    await wait(100);
  }
  throw new Error(`timeout waiting for ${label}${lastError ? `: ${lastError}` : ""}`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(messageId);
          reject(new Error(`${method}: timed out after ${CDP_COMMAND_TIMEOUT_MS}ms`));
        }, CDP_COMMAND_TIMEOUT_MS);
        pending.set(messageId, {
          method,
          resolve(value) {
            clearTimeout(timeout);
            resolve(value);
          },
          reject(error) {
            clearTimeout(timeout);
            reject(error);
          },
        });
      });
    },
    close() {
      socket.close();
    },
  };
}
