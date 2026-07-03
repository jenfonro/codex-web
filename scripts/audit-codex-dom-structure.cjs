#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const CDP = process.env.CDP_URL || "http://127.0.0.1:9222";
const APP_URL = process.env.PANEL_URL || "http://127.0.0.1:58888/";
const SIDEBAR_WIDTH = Number(process.env.SIDEBAR_WIDTH || 611);
const VIEWPORT_WIDTH = Number(process.env.VIEWPORT_WIDTH || 1920);
const VIEWPORT_HEIGHT = Number(process.env.VIEWPORT_HEIGHT || 1080);
const MAX_DEPTH = Number(process.env.AUDIT_DOM_DEPTH || 7);
const MAX_NODES = Number(process.env.AUDIT_DOM_NODES || 180);
const SESSION_INDEX = Number(process.env.SESSION_INDEX || 1);

const repoRoot = path.resolve(__dirname, "..");
const referenceRoot = path.join(repoRoot, "reference", "windows-captures");
const outDir = path.join(repoRoot, "reference", "codex-reference");
const outJSON = path.join(outDir, "dom-structure-audit.json");
const outMD = path.join(outDir, "dom-structure-audit.md");

const CAPTURES = {
  list: "20260702-184840-codex-session-list-wide-611",
  thread: "20260702-185302-codex-thread-wide-611",
  plus: "20260702-185715-codex-thread-plus-menu-wide-611-stable",
  approval: "20260702-185942-codex-thread-approval-menu-wide-stable",
  model: "20260702-190248-codex-thread-model-menu-right-wide-stable",
};

const COMPONENTS = {
  list: {
    root: "#root > div",
    header: ".draggable.extension\\:px-panel",
    sessionRow: "[data-thread-title='true']",
    composer: ".composer-surface-chrome",
    composerFooter: "._footer_1u8sk_2",
    externalFooter: "._footer_z984f_2",
  },
  plus: {
    composer: ".composer-surface-chrome",
    composerFooter: "._footer_1u8sk_2",
    plusMenu: "[data-composer-overlay-floating-ui]",
  },
  approval: {
    composer: ".composer-surface-chrome",
    composerFooter: "._footer_1u8sk_2",
    approvalMenu: "[data-radix-menu-content]",
  },
  model: {
    composer: ".composer-surface-chrome",
    composerFooter: "._footer_1u8sk_2",
    modelMenu: "[data-radix-menu-content]",
  },
  thread: {
    root: "#root > div",
    header: ".draggable.extension\\:px-panel",
    conversation: "[data-thread-find-target='conversation']",
    userBubble: "[data-user-message-bubble]",
    markdown: "._markdownContent_lzkx4_60",
    assistantActions: "[data-assistant-message-sent-time='true']",
    composer: ".composer-surface-chrome",
    composerFooter: "._footer_1u8sk_2",
    externalFooter: "._footer_z984f_2",
  },
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const target = await getActivePageTarget();
  const page = await connect(target.webSocketDebuggerUrl);
  try {
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Input.setIgnoreInputEvents", { ignore: false }).catch(() => {});
    await page.send("Emulation.setDeviceMetricsOverride", {
      width: VIEWPORT_WIDTH,
      height: VIEWPORT_HEIGHT,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: VIEWPORT_WIDTH,
      screenHeight: VIEWPORT_HEIGHT,
    });

    await navigate(page, APP_URL);
    await evalPage(page, `(() => {
      localStorage.setItem("codex-web:sidebar-width", ${JSON.stringify(String(SIDEBAR_WIDTH))});
      document.documentElement.style.setProperty("--cw-sidebar-width", ${JSON.stringify(`${SIDEBAR_WIDTH}px`)});
    })()`);
    await waitForShadow(page, "[data-codex-view='list']");
    await wait(500);

    const audit = {
      generatedAt: new Date().toISOString(),
      basis: "DOM structure and class/attribute signature comparison. Screenshots are intentionally not used as evidence here.",
      maxDepth: MAX_DEPTH,
      maxNodes: MAX_NODES,
      captures: CAPTURES,
      components: {},
    };

    audit.components.list = await auditState(page, "list");

    await clickShadow(page, "[data-popover='plus']");
    await waitForShadow(page, "[data-composer-overlay-floating-ui]");
    await wait(200);
    audit.components.plus = await auditState(page, "plus");

    await clickShadow(page, "[data-popover='plus']");
    await wait(100);
    await clickShadow(page, "[data-popover='approval']");
    await waitForShadow(page, "[data-radix-menu-content]");
    await wait(200);
    audit.components.approval = await auditState(page, "approval");

    await clickShadow(page, "[data-popover='approval']");
    await wait(100);
    await clickShadow(page, "[data-popover='model']");
    await waitForShadow(page, "[data-radix-menu-content]");
    await wait(200);
    audit.components.model = await auditState(page, "model");

    await clickShadow(page, "[data-popover='model']");
    await wait(100);
    await clickShadow(page, "[data-codex-session-id]", SESSION_INDEX);
    await waitForShadow(page, "[data-codex-view='thread']");
    await wait(400);
    audit.components.thread = await auditState(page, "thread");

    fs.writeFileSync(outJSON, `${JSON.stringify(audit, null, 2)}\n`);
    fs.writeFileSync(outMD, renderMarkdown(audit));
    console.log(outJSON);
    console.log(outMD);
    const failures = collectFailures(audit);
    if (failures.length) {
      console.error(`DOM structure audit failed: ${failures.length} non-exact component(s)`);
      for (const failure of failures.slice(0, 20)) {
        console.error(`- ${failure.state}.${failure.component}: ${failure.status}`);
      }
      process.exitCode = 1;
    }
  } finally {
    page.close();
  }
}

function collectFailures(audit) {
  const failures = [];
  for (const [state, components] of Object.entries(audit.components)) {
    for (const [component, result] of Object.entries(components)) {
      if (result.status !== "exact") failures.push({ state, component, status: result.status });
    }
  }
  return failures;
}

async function auditState(page, stateName) {
  const referenceHTML = readReferenceHTML(CAPTURES[stateName]);
  const selectors = COMPONENTS[stateName];
  const out = {};
  for (const [componentName, selector] of Object.entries(selectors)) {
    const reference = await signatureFromHTML(page, referenceHTML, selector);
    const current = await signatureFromCurrent(page, selector);
    out[componentName] = {
      selector,
      status: componentStatus(reference, current),
      reference,
      current,
      diff: diffSignatures(reference.signature, current.signature),
    };
  }
  return out;
}

function readReferenceHTML(captureName) {
  const runtimePath = path.join(referenceRoot, captureName, "frames", "03-active-frame", "runtime.json");
  const runtime = JSON.parse(fs.readFileSync(runtimePath, "utf8"));
  if (!runtime.html) throw new Error(`${runtimePath} does not contain html`);
  return runtime.html;
}

function componentStatus(reference, current) {
  if (!reference.found && !current.found) return "missing-reference-and-current";
  if (!reference.found) return "missing-reference";
  if (!current.found) return "missing-current";
  if (reference.signature.join("\n") === current.signature.join("\n")) return "exact";
  return "different";
}

function diffSignatures(reference, current) {
  const max = Math.max(reference.length, current.length);
  const mismatches = [];
  for (let i = 0; i < max; i += 1) {
    const left = reference[i] || "";
    const right = current[i] || "";
    if (left !== right) mismatches.push({ index: i, reference: left, current: right });
    if (mismatches.length >= 30) break;
  }
  return {
    referenceCount: reference.length,
    currentCount: current.length,
    equalPrefixCount: commonPrefix(reference, current),
    mismatchCountSample: mismatches.length,
    firstMismatches: mismatches,
  };
}

function commonPrefix(left, right) {
  let count = 0;
  while (count < left.length && count < right.length && left[count] === right[count]) count += 1;
  return count;
}

async function signatureFromHTML(page, html, selector) {
  return evalPage(page, `(() => {
    const doc = new DOMParser().parseFromString(${JSON.stringify(html)}, "text/html");
    return (${signatureSource()})(doc, ${JSON.stringify(selector)}, ${JSON.stringify(MAX_DEPTH)}, ${JSON.stringify(MAX_NODES)});
  })()`);
}

async function signatureFromCurrent(page, selector) {
  return evalPage(page, `(() => {
    const shadow = document.querySelector("#codexPanel")?.shadowRoot;
    return (${signatureSource()})(shadow, ${JSON.stringify(selector)}, ${JSON.stringify(MAX_DEPTH)}, ${JSON.stringify(MAX_NODES)});
  })()`);
}

function signatureSource() {
  return String(function signature(root, selector, maxDepth, maxNodes) {
    const element = root?.querySelector(selector);
    if (!element) {
      return { found: false, selector, rootTag: root?.nodeName || "", signature: [], text: "" };
    }
    const lines = [];
    const includeAttrs = [
      "role",
      "type",
      "aria-label",
      "aria-expanded",
      "data-state",
      "data-codex-composer",
      "data-thread-find-target",
      "data-thread-scroll-footer",
      "data-thread-find-composer",
      "data-composer-overlay-floating-ui",
      "data-radix-menu-content",
      "data-codex-intelligence-trigger",
      "data-selected-reasoning-effort",
      "data-user-message-bubble",
      "data-assistant-message-sent-time",
    ];
    const ignoredClasses = new Set([
      "codex-send-ready",
      "ProseMirror-focused",
    ]);
    function cleanClassName(value) {
      return String(value || "")
        .split(/\s+/)
        .filter(Boolean)
        .filter((item) => !ignoredClasses.has(item))
        .join(" ");
    }
    function visit(node, depth, siblingIndex) {
      if (!node || node.nodeType !== Node.ELEMENT_NODE || lines.length >= maxNodes) return;
      const attrs = [];
      for (const name of includeAttrs) {
        if (node.hasAttribute(name)) attrs.push(`${name}=${JSON.stringify(node.getAttribute(name))}`);
      }
      const className = cleanClassName(node.className);
      const style = node.getAttribute("style");
      const isVirtualHeight = className === "relative shrink-0" && /^height:\s*[\d.]+px;?$/.test(String(style || ""));
      if (style && !isVirtualHeight && /min-height|height|right|bottom|max-width|max-height|transform-origin|available-width|available-height/.test(style)) {
        attrs.push(`style=${JSON.stringify(style.replace(/\s+/g, " ").trim())}`);
      }
      lines.push(`${"  ".repeat(depth)}${node.tagName.toLowerCase()}#${siblingIndex}.${className}${attrs.length ? " [" + attrs.join(" ") + "]" : ""}`);
      if (depth >= maxDepth) return;
      let childIndex = 0;
      for (const child of Array.from(node.children)) {
        visit(child, depth + 1, childIndex);
        childIndex += 1;
        if (lines.length >= maxNodes) break;
      }
    }
    visit(element, 0, 0);
    return {
      found: true,
      selector,
      tagName: element.tagName.toLowerCase(),
      className: cleanClassName(element.className),
      text: (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 220),
      signature: lines,
    };
  });
}

function renderMarkdown(audit) {
  const lines = [
    "# Codex DOM Structure Audit",
    "",
    `Generated: ${audit.generatedAt}`,
    "",
    "This audit compares captured extension DOM against the current local Shadow DOM by tag/class/selected attributes. Screenshots are not used as evidence.",
    "",
  ];
  for (const [stateName, components] of Object.entries(audit.components)) {
    lines.push(`## ${stateName}`);
    lines.push("");
    lines.push("| Component | Status | Reference Nodes | Current Nodes | Equal Prefix | First Mismatch |");
    lines.push("| --- | --- | ---: | ---: | ---: | --- |");
    for (const [componentName, item] of Object.entries(components)) {
      const first = item.diff.firstMismatches[0];
      lines.push([
        componentName,
        item.status,
        item.diff.referenceCount,
        item.diff.currentCount,
        item.diff.equalPrefixCount,
        first ? code(`${first.index}: ref ${first.reference || "(none)"} / cur ${first.current || "(none)"}`) : "",
      ].join(" | ").replace(/^/, "| ").replace(/$/, " |"));
    }
    lines.push("");
  }
  lines.push("## Required Follow-Up");
  lines.push("");
  lines.push("- Treat any `different` status as unfinished unless the difference is a deliberate data-binding hook or host adaptation documented in `reference/codex-panel-worklist.md`.");
  lines.push("- Fix structure/class mismatches before using screenshots for visual verification.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function code(value) {
  return `\`${String(value).replaceAll("`", "\\`")}\``;
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
