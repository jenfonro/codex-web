#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const CDP = process.env.CDP_URL || "http://127.0.0.1:9222";
const APP_URL = process.env.PANEL_URL || "http://127.0.0.1:58888/";
const SIDEBAR_WIDTH = process.env.SIDEBAR_WIDTH ? Number(process.env.SIDEBAR_WIDTH) : null;
const VIEWPORT_WIDTH = Number(process.env.VIEWPORT_WIDTH || 1904);
const VIEWPORT_HEIGHT = Number(process.env.VIEWPORT_HEIGHT || 985);
const SESSION_INDEX = Number(process.env.SESSION_INDEX || 1);

const repoRoot = path.resolve(__dirname, "..");
const referenceFile = path.join(repoRoot, "reference", "codex-reference", "codex-reference.json");
const outDir = path.join(repoRoot, "reference", "codex-reference");
const outJSON = path.join(outDir, "computed-style-audit.json");
const outMD = path.join(outDir, "computed-style-audit.md");

const TRACKED_SELECTORS = [
  ".composer-surface-chrome",
  ".ProseMirror",
  "[data-user-message-bubble]",
  "._footer_1u8sk_2",
  "._footer_z984f_2",
  "._markdownContent_lzkx4_60",
  "[data-composer-overlay-floating-ui]",
  "[data-radix-menu-content]",
  "[class*='task']",
  "[class*='shimmer']",
];

const STYLE_PROPS = [
  "display",
  "position",
  "boxSizing",
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
  "borderRight",
  "borderBottom",
  "borderLeft",
  "borderRadius",
  "boxShadow",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "textDecoration",
  "opacity",
  "overflow",
  "overflowX",
  "overflowY",
  "whiteSpace",
  "textOverflow",
  "alignItems",
  "justifyContent",
  "flexDirection",
  "gridTemplateColumns",
  "transform",
  "transition",
  "animation",
  "zIndex",
  "cursor",
];

const RECT_PROPS = [];

const LOCAL_ADAPTER_CLASSES = new Set([
  "codex-composer-card",
  "codex-composer-external-footer",
  "codex-composer-footer",
  "codex-send-disabled",
  "codex-send-ready",
  "codex-session-status-spinner",
  "codex-turn-activity-status",
  "codicon-file-code",
  "placeholder",
  "ProseMirror-focused",
]);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const reference = JSON.parse(fs.readFileSync(referenceFile, "utf8"));

  const target = await getActivePageTarget();
  const page = await connect(target.webSocketDebuggerUrl);
  try {
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("DOM.enable").catch(() => {});
    await page.send("Emulation.setDeviceMetricsOverride", {
      width: VIEWPORT_WIDTH,
      height: VIEWPORT_HEIGHT,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: VIEWPORT_WIDTH,
      screenHeight: VIEWPORT_HEIGHT,
    });

    await navigate(page, APP_URL);
    await setSidebarWidth(page, sidebarWidthForView(reference, "list"));
    await waitForShadow(page, "[data-codex-view='list']");
    await wait(600);

    const local = {};
    local.list = await collectStyles(page);

    await setSidebarWidth(page, sidebarWidthForView(reference, "plusMenu"));
    await wait(200);
    await clickShadow(page, "[data-popover='plus']");
    await waitForShadow(page, ".composer-surface-chrome");
    await wait(1000);
    await finishShadowAnimations(page);
    local.plusMenu = await collectStyles(page);

    await clickShadow(page, "[data-popover='plus']");
    await wait(150);
    await clickShadow(page, "[data-popover='approval']");
    await waitForShadow(page, "[data-radix-menu-content]");
    await wait(1000);
    await finishShadowAnimations(page);
    local.approvalMenu = await collectStyles(page);

    await clickShadow(page, "[data-popover='approval']");
    await wait(150);
    await clickShadow(page, "[data-popover='model']");
    await waitForShadow(page, "[data-radix-menu-content]");
    await wait(1000);
    await finishShadowAnimations(page);
    local.modelMenu = await collectStyles(page);

    await clickShadow(page, "[data-popover='model']");
    await wait(150);
    await setSidebarWidth(page, sidebarWidthForView(reference, "thread"));
    await wait(200);
    await clickShadow(page, "[data-codex-session-id]", SESSION_INDEX);
    await waitForShadow(page, "[data-codex-view='thread']");
    await wait(500);
    local.thread = await collectStyles(page);

    const report = compare(reference, local);
    fs.writeFileSync(outJSON, `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync(outMD, renderMarkdown(report));
    console.log(outJSON);
    console.log(outMD);
    if (report.summary.actionableDifferences > 0 || report.summary.missing > 0) process.exitCode = 1;
  } finally {
    page.close();
  }
}

function compare(reference, local) {
  const views = ["list", "plusMenu", "approvalMenu", "modelMenu", "thread"];
  const rows = [];
  const viewContexts = {};

  for (const view of views) {
    viewContexts[view] = buildViewContext(reference, local, view);
  }

  for (const view of views) {
    for (const selector of TRACKED_SELECTORS) {
      if (shouldSkipSelector(view, selector)) continue;
      const expectedGroup = reference.selectorStyles?.[view]?.[selector];
      if (!expectedGroup) continue;
      if (selector === "[data-user-message-bubble]") {
        rows.push(...compareUserBubbleVariants(view, selector, expectedGroup, local[view]?.[selector] || {}));
        continue;
      }
      for (const key of Object.keys(expectedGroup)) {
        const expected = expectedGroup[key];
        if (!expected || !expected.styles) continue;
        const actual = local[view]?.[selector]?.[key];
        rows.push(...compareStyleNode(view, selector, key, expected, actual));
      }
    }
  }

  const classifiedRows = rows.map((row) => ({
    ...row,
    category: isEnvironmentSizeDifference(row, viewContexts[row.view]) ? "environment-size" : "actionable",
  }));
  const actionableRows = classifiedRows.filter((row) => row.category === "actionable");
  const environmentRows = classifiedRows.filter((row) => row.category === "environment-size");

  return {
    generatedAt: new Date().toISOString(),
    basis: "Compares local runtime computed styles against captured Codex extension computed styles. Screenshots are not used.",
    appUrl: APP_URL,
    viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
    sidebarWidth: SIDEBAR_WIDTH || "derived-per-reference-view",
    trackedSelectors: TRACKED_SELECTORS,
    styleProps: STYLE_PROPS,
    rectProps: RECT_PROPS,
    summary: {
      actionableDifferences: actionableRows.filter((row) => row.kind !== "missing-element").length,
      environmentSizeDifferences: environmentRows.length,
      differences: classifiedRows.filter((row) => row.kind !== "missing-element").length,
      missing: classifiedRows.filter((row) => row.kind === "missing-element").length,
      rows: classifiedRows.length,
    },
    differences: classifiedRows,
    actionableDifferences: actionableRows,
    environmentSizeDifferences: environmentRows,
    viewContexts,
  };
}

function compareUserBubbleVariants(view, selector, expectedGroup, actualGroup) {
  const expectedVariants = firstByVariant(expectedGroup, userBubbleVariantKey);
  const actualVariants = firstByVariant(actualGroup, userBubbleVariantKey);
  const rows = [];
  for (const [variant, expected] of expectedVariants.entries()) {
    const actual = actualVariants.get(variant);
    rows.push(...compareStyleNode(view, selector, variant, expected, actual));
  }
  return rows;
}

function firstByVariant(group, variantKey) {
  const variants = new Map();
  for (const key of Object.keys(group || {})) {
    const node = group[key];
    if (!node || !node.styles) continue;
    const variant = variantKey(node);
    if (!variants.has(variant)) variants.set(variant, node);
  }
  return variants;
}

function userBubbleVariantKey(node) {
  return node.role === "button" || node.ariaLabel === "编辑用户消息" ? "editable" : "plain";
}

function compareStyleNode(view, selector, key, expected, actual) {
  const rows = [];
  if (!actual) {
    rows.push({ view, selector, index: key, kind: "missing-element", expectedNode: summarizeNode(expected), actualNode: null });
    return rows;
  }
  if (expected.tagName !== actual.tagName) {
    rows.push(differenceRow(view, selector, key, "tagName", expected.tagName, actual.tagName, expected, actual));
  }
  const expectedClassName = normalizeClassName(expected.className);
  const actualClassName = normalizeClassName(actual.className);
  if (expectedClassName !== actualClassName) {
    const row = differenceRow(view, selector, key, "className", expectedClassName, actualClassName, expected, actual);
    if (!isAllowedAdapterDifference(row)) rows.push(row);
  }
  for (const prop of RECT_PROPS) {
    if (String(expected.rect?.[prop]) !== String(actual.rect?.[prop])) {
      const row = differenceRow(view, selector, key, `rect.${prop}`, expected.rect?.[prop], actual.rect?.[prop], expected, actual);
      if (!isAllowedAdapterDifference(row)) rows.push(row);
    }
  }
  for (const prop of STYLE_PROPS) {
    const expectedValue = normalizeCSSValue(expected.styles?.[prop]);
    const actualValue = normalizeCSSValue(actual.styles?.[prop]);
    if (expectedValue !== actualValue) {
      const row = differenceRow(view, selector, key, `style.${prop}`, expected.styles?.[prop], actual.styles?.[prop], expected, actual);
      if (!isAllowedAdapterDifference(row)) rows.push(row);
    }
  }
  return rows;
}

function shouldSkipSelector(view, selector) {
  return selector === "._footer_z984f_2" && view !== "thread";
}

function normalizeClassName(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !LOCAL_ADAPTER_CLASSES.has(token))
    .join(" ");
}

function isAllowedAdapterDifference(row) {
  if (row.selector === ".composer-surface-chrome" && ["style.overflow", "style.overflowX", "style.overflowY"].includes(row.kind)) {
    return true;
  }
  return false;
}

function differenceRow(view, selector, index, kind, expected, actual, expectedNode, actualNode) {
  return {
    view,
    selector,
    index,
    kind,
    expected,
    actual,
    expectedNode: summarizeNode(expectedNode),
    actualNode: summarizeNode(actualNode),
  };
}

function summarizeNode(node) {
  if (!node) return null;
  return {
    tagName: node.tagName,
    className: node.className,
    text: node.text,
    rect: node.rect,
    transformedAncestors: node.transformedAncestors || [],
    styles: {
      display: node.styles?.display,
      width: node.styles?.width,
      height: node.styles?.height,
      padding: node.styles?.padding,
      fontFamily: node.styles?.fontFamily,
      fontSize: node.styles?.fontSize,
      fontWeight: node.styles?.fontWeight,
      lineHeight: node.styles?.lineHeight,
      whiteSpace: node.styles?.whiteSpace,
    },
  };
}

function buildViewContext(reference, local, view) {
  const expectedRoot = reference.selectorStyles?.[view]?.["#root"]?.["0"];
  const actualRoot = local[view]?.["#root"]?.["0"];
  const expectedWidth = Number(expectedRoot?.rect?.width);
  const actualWidth = Number(actualRoot?.rect?.width);
  const expectedHeight = Number(expectedRoot?.rect?.height);
  const actualHeight = Number(actualRoot?.rect?.height);
  return {
    expectedRoot: {
      width: Number.isFinite(expectedWidth) ? expectedWidth : null,
      height: Number.isFinite(expectedHeight) ? expectedHeight : null,
    },
    actualRoot: {
      width: Number.isFinite(actualWidth) ? actualWidth : null,
      height: Number.isFinite(actualHeight) ? actualHeight : null,
    },
    widthDelta: Number.isFinite(expectedWidth) && Number.isFinite(actualWidth) ? actualWidth - expectedWidth : null,
    heightDelta: Number.isFinite(expectedHeight) && Number.isFinite(actualHeight) ? actualHeight - expectedHeight : null,
  };
}

function isEnvironmentSizeDifference(row, context) {
  if (!context || row.kind === "missing-element") return false;
  if (row.kind === "rect.width" || row.kind === "style.width") {
    return matchesRootDelta(row, context.widthDelta);
  }
  if (row.kind === "rect.height" || row.kind === "style.height") {
    return matchesRootDelta(row, context.heightDelta);
  }
  if (row.selector === "#root > *" && row.index === "1" && row.kind.startsWith("style.margin")) {
    return true;
  }
  return false;
}

function matchesRootDelta(row, delta) {
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.01) return false;
  const expected = numericCSSValue(row.expected);
  const actual = numericCSSValue(row.actual);
  if (!Number.isFinite(expected) || !Number.isFinite(actual)) return false;
  return Math.abs(actual - expected - delta) < 0.1;
}

function numericCSSValue(value) {
  if (typeof value === "number") return value;
  const match = String(value ?? "").trim().match(/^-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function sidebarWidthForView(reference, view) {
  if (SIDEBAR_WIDTH) return SIDEBAR_WIDTH;
  const rootWidth = Number(reference.selectorStyles?.[view]?.["#root"]?.["0"]?.rect?.width);
  if (!Number.isFinite(rootWidth)) return 611;
  return rootWidth + 1;
}

async function setSidebarWidth(page, width) {
  await evalPage(page, `(() => {
    localStorage.setItem("codex-web:sidebar-width", ${JSON.stringify(String(width))});
    document.documentElement.style.setProperty("--cw-sidebar-width", ${JSON.stringify(`${width}px`)});
    window.dispatchEvent(new Event("resize"));
  })()`);
}

async function finishShadowAnimations(page) {
  await evalPage(page, `(() => {
    const shadow = document.querySelector("#codexPanel")?.shadowRoot;
    const animations = [
      ...document.getAnimations({ subtree: true }),
      ...(shadow?.getAnimations({ subtree: true }) || []),
    ];
    for (const animation of animations) {
      try {
        animation.finish();
      } catch {}
    }
  })()`);
}

function normalizeCSSValue(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/,\s+/g, ", ")
    .trim();
}

async function collectStyles(page) {
  return evalPage(page, `(() => {
    const selectors = ${JSON.stringify(TRACKED_SELECTORS)};
    const props = ${JSON.stringify(STYLE_PROPS)};
    const shadow = document.querySelector("#codexPanel")?.shadowRoot;
    const out = {};
    for (const selector of selectors) {
      const nodes = Array.from(shadow?.querySelectorAll(selector) || []);
      out[selector] = {};
      nodes.forEach((element, index) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const styles = {};
        for (const prop of props) styles[prop] = style[prop];
        out[selector][String(index)] = {
          tagName: element.tagName,
          id: element.id || "",
          className: String(element.className || ""),
          role: element.getAttribute("role"),
          ariaLabel: element.getAttribute("aria-label"),
          text: (element.innerText || element.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 240),
          rect: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            left: rect.left,
          },
          transformedAncestors: transformedAncestors(element),
          styles,
        };
      });
    }
    function transformedAncestors(element) {
      const rows = [];
      let node = element.parentElement;
      while (node && rows.length < 12) {
        const style = getComputedStyle(node);
        if (style.transform !== "none" || style.scale !== "none") {
          const rect = node.getBoundingClientRect();
          rows.push({
            tagName: node.tagName,
            className: String(node.className || ""),
            transform: style.transform,
            scale: style.scale,
            animationName: style.animationName,
            animationDuration: style.animationDuration,
            animationFillMode: style.animationFillMode,
            transitionDuration: style.transitionDuration,
            vars: {
              transitionDurationBasic: style.getPropertyValue("--transition-duration-basic").trim(),
              cubicEnter: style.getPropertyValue("--cubic-enter").trim(),
              dropdownStartTransform: style.getPropertyValue("--dropdown-content-start-transform").trim(),
            },
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          });
        }
        node = node.parentElement;
      }
      return rows;
    }
    return out;
  })()`);
}

function renderMarkdown(report) {
  const lines = [
    "# Codex Computed Style Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    report.basis,
    "",
    "## Summary",
    "",
    `- Actionable differences: ${report.summary.actionableDifferences}`,
    `- Environment-size differences: ${report.summary.environmentSizeDifferences}`,
    `- Differences: ${report.summary.differences}`,
    `- Missing elements: ${report.summary.missing}`,
    `- Tracked rows: ${report.summary.rows}`,
    "",
  ];
  if (!report.actionableDifferences.length && !report.environmentSizeDifferences.length) {
    lines.push("No computed-style differences found for tracked selectors.", "");
    return `${lines.join("\n")}\n`;
  }
  if (report.actionableDifferences.length) {
    lines.push("## Actionable Differences", "");
    lines.push("| View | Selector | Index | Field | Expected | Actual |");
    lines.push("| --- | --- | ---: | --- | --- | --- |");
    for (const row of report.actionableDifferences.slice(0, 300)) {
      lines.push(`| ${code(row.view)} | ${code(row.selector)} | ${code(row.index)} | ${code(row.kind)} | ${code(row.expected ?? "")} | ${code(row.actual ?? "")} |`);
    }
    if (report.actionableDifferences.length > 300) lines.push(`| ... | ... | ... | ... | ${report.actionableDifferences.length - 300} more | ... |`);
    lines.push("");
  } else {
    lines.push("## Actionable Differences", "");
    lines.push("None.", "");
  }
  if (report.environmentSizeDifferences.length) {
    lines.push("## Environment-Size Differences", "");
    lines.push("These rows are retained for audit visibility, but they are caused by captured viewport/sidebar dimensions differing from the current verification viewport. They do not hide class, color, font, border, radius, shadow, gap, or fixed button-size mismatches.", "");
    lines.push("| View | Selector | Index | Field | Expected | Actual |");
    lines.push("| --- | --- | ---: | --- | --- | --- |");
    for (const row of report.environmentSizeDifferences.slice(0, 300)) {
      lines.push(`| ${code(row.view)} | ${code(row.selector)} | ${code(row.index)} | ${code(row.kind)} | ${code(row.expected ?? "")} | ${code(row.actual ?? "")} |`);
    }
    if (report.environmentSizeDifferences.length > 300) lines.push(`| ... | ... | ... | ... | ${report.environmentSizeDifferences.length - 300} more | ... |`);
    lines.push("");
  }
  lines.push("## All Differences", "");
  lines.push("| View | Selector | Index | Field | Expected | Actual |");
  lines.push("| --- | --- | ---: | --- | --- | --- |");
  for (const row of report.differences.slice(0, 300)) {
    lines.push(`| ${code(row.view)} | ${code(row.selector)} | ${code(row.index)} | ${code(`${row.kind} / ${row.category}`)} | ${code(row.expected ?? "")} | ${code(row.actual ?? "")} |`);
  }
  if (report.differences.length > 300) lines.push(`| ... | ... | ... | ... | ${report.differences.length - 300} more | ... |`);
  lines.push("");
  lines.push("## Rule", "");
  lines.push("- Any actionable difference is unfinished unless it is replaced with captured extension structure/style or documented as a required host adapter.");
  lines.push("- Environment-size differences are not accepted visual proof; screenshots still need to be checked at the target viewport/sidebar size.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function code(value) {
  return `\`${String(value).replaceAll("`", "\\`").replace(/\r?\n/g, " ")}\``;
}

async function navigate(page, url) {
  const loadPromise = waitForLoad(page, 8000);
  await page.send("Page.navigate", { url });
  await loadPromise;
  await waitForDocumentReady(page);
}

async function clickShadow(page, selector, index = 0) {
  await waitForShadow(page, selector);
  const clicked = await evalPage(page, `(() => {
    const root = document.querySelector("#codexPanel")?.shadowRoot;
    const nodes = Array.from(root?.querySelectorAll(${JSON.stringify(selector)}) || []);
    const el = nodes[${JSON.stringify(index)}] || nodes[0];
    if (!el) return false;
    el.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`failed to click ${selector}`);
}

async function waitForShadow(page, selector, timeout = 10000) {
  await evalPage(page, `(() => new Promise((resolve, reject) => {
    const selector = ${JSON.stringify(selector)};
    const deadline = Date.now() + ${JSON.stringify(timeout)};
    function check() {
      const root = document.querySelector("#codexPanel")?.shadowRoot;
      const el = root?.querySelector(selector);
      if (el) {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden") {
          resolve(true);
          return;
        }
      }
      if (Date.now() > deadline) {
        reject(new Error("Timed out waiting for shadow selector " + selector));
        return;
      }
      requestAnimationFrame(check);
    }
    check();
  }))`);
}

async function waitForDocumentReady(page) {
  await evalPage(page, `(() => new Promise((resolve) => {
    if (document.readyState === "complete") {
      resolve(true);
      return;
    }
    addEventListener("load", () => resolve(true), { once: true });
    setTimeout(() => resolve(false), 8000);
  }))`);
}

async function waitForLoad(page, timeout) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeout);
    page.once("Page.loadEventFired", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function evalPage(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    serializationOptions: { serialization: "json" },
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || JSON.stringify(result.exceptionDetails));
  }
  return result.result?.value;
}

async function getActivePageTarget() {
  const targets = await readJSON(`${CDP}/json/list`);
  const pages = targets.filter((target) => target.type === "page" && target.webSocketDebuggerUrl);
  if (!pages.length) throw new Error("no debuggable page targets found");
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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
