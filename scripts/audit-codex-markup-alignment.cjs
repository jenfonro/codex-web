#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const CDP = process.env.CDP_URL || "http://127.0.0.1:9222";
const APP_URL = process.env.PANEL_URL || "http://127.0.0.1:58888/";
const SIDEBAR_WIDTH = Number(process.env.SIDEBAR_WIDTH || 611);
const VIEWPORT_WIDTH = Number(process.env.VIEWPORT_WIDTH || 1920);
const VIEWPORT_HEIGHT = Number(process.env.VIEWPORT_HEIGHT || 1080);
const SESSION_INDEX = Number(process.env.SESSION_INDEX || 1);
const MAX_NODES = Number(process.env.AUDIT_MARKUP_NODES || 260);
const MAX_DEPTH = Number(process.env.AUDIT_MARKUP_DEPTH || 12);

const repoRoot = path.resolve(__dirname, "..");
const referenceRoot = path.join(repoRoot, "reference", "windows-captures");
const outDir = path.join(repoRoot, "reference", "codex-reference");
const outJSON = path.join(outDir, "markup-alignment-audit.json");
const outMD = path.join(outDir, "markup-alignment-audit.md");

const CAPTURES = {
  list: "20260702-184840-codex-session-list-wide-611",
  thread: "20260702-185302-codex-thread-wide-611",
  plus: "20260702-185715-codex-thread-plus-menu-wide-611-stable",
  approval: "20260702-185942-codex-thread-approval-menu-wide-stable",
  model: "20260702-190248-codex-thread-model-menu-right-wide-stable",
};

const COMPONENTS = {
  list: {
    sessionRow: "[data-thread-title='true']",
    composer: ".composer-surface-chrome",
    composerFooter: "._footer_1u8sk_2",
    externalFooter: "._footer_z984f_2",
  },
  plus: {
    plusMenu: "[data-composer-overlay-floating-ui]",
  },
  approval: {
    approvalMenu: "[data-radix-menu-content]",
  },
  model: {
    modelMenu: "[data-radix-menu-content]",
  },
  thread: {
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
      basis: "Canonical markup comparison against captured ChatGPT/Codex extension DOM. Screenshots are not used.",
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
      console.error(`Markup alignment audit failed: ${failures.length} non-exact component(s)`);
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
  const out = {};
  for (const [name, selector] of Object.entries(COMPONENTS[stateName])) {
    const reference = await canonicalFromHTML(page, referenceHTML, selector);
    const current = await canonicalFromCurrent(page, selector);
    out[name] = compareCanonical(selector, reference, current);
  }
  return out;
}

function readReferenceHTML(captureName) {
  const runtimePath = path.join(referenceRoot, captureName, "frames", "03-active-frame", "runtime.json");
  const runtime = JSON.parse(fs.readFileSync(runtimePath, "utf8"));
  if (!runtime.html) throw new Error(`${runtimePath} does not contain html`);
  return runtime.html;
}

async function canonicalFromHTML(page, html, selector) {
  return evalPage(page, `(() => {
    const doc = new DOMParser().parseFromString(${JSON.stringify(html)}, "text/html");
    return (${canonicalSource()})(doc, ${JSON.stringify(selector)}, ${JSON.stringify(MAX_DEPTH)}, ${JSON.stringify(MAX_NODES)});
  })()`);
}

async function canonicalFromCurrent(page, selector) {
  return evalPage(page, `(() => {
    const shadow = document.querySelector("#codexPanel")?.shadowRoot;
    return (${canonicalSource()})(shadow, ${JSON.stringify(selector)}, ${JSON.stringify(MAX_DEPTH)}, ${JSON.stringify(MAX_NODES)});
  })()`);
}

function compareCanonical(selector, reference, current) {
  const referenceLines = reference.lines || [];
  const currentLines = current.lines || [];
  const max = Math.max(referenceLines.length, currentLines.length);
  const mismatches = [];
  for (let index = 0; index < max; index += 1) {
    const left = referenceLines[index] || "";
    const right = currentLines[index] || "";
    if (left !== right) mismatches.push({ index, reference: left, current: right });
    if (mismatches.length >= 40) break;
  }
  return {
    selector,
    status: !reference.found && !current.found ? "missing-reference-and-current" : reference.found && current.found && mismatches.length === 0 ? "exact" : reference.found && !current.found ? "missing-current" : !reference.found && current.found ? "missing-reference" : "different",
    reference: { found: reference.found, text: reference.text, lineCount: referenceLines.length, truncated: reference.truncated },
    current: { found: current.found, text: current.text, lineCount: currentLines.length, truncated: current.truncated },
    diff: {
      equalPrefixCount: commonPrefix(referenceLines, currentLines),
      mismatchCountSample: mismatches.length,
      firstMismatches: mismatches,
    },
  };
}

function canonicalSource() {
  return String(function canonical(root, selector, maxDepth, maxNodes) {
    const element = root?.querySelector(selector);
    if (!element) return { found: false, selector, text: "", lines: [], truncated: false };

    const dynamicAttrPatterns = [
      /^id$/,
      /^aria-controls$/,
      /^aria-labelledby$/,
      /^data-selected-text-overlay-target$/,
      /^data-radix-collection-item$/,
      /^data-radix-focus-guard$/,
    ];
    const focusOnlyClasses = new Set(["ProseMirror-focused", "codex-send-ready"]);
    const adapterAttrs = new Set(["data-popover", "data-action"]);
    const volatileStyleProps = new Set(["--radix-dropdown-menu-content-transform-origin", "--radix-dropdown-menu-content-available-width", "--radix-dropdown-menu-content-available-height", "--radix-dropdown-menu-trigger-width", "--radix-dropdown-menu-trigger-height"]);
    const lines = [];
    let truncated = false;

    function normalizeClass(value) {
      return String(value || "")
        .split(/\s+/)
        .filter(Boolean)
        .filter((token) => !focusOnlyClasses.has(token))
        .join(" ");
    }

    function normalizeStyle(value) {
      if (!value) return "";
      const kept = [];
      for (const part of String(value).split(";")) {
        const item = part.trim();
        if (!item) continue;
        const name = item.split(":")[0]?.trim();
        if (volatileStyleProps.has(name)) continue;
        kept.push(item.replace(/\s+/g, " "));
      }
      return kept.join("; ");
    }

    function shouldSkipAttr(name) {
      if (adapterAttrs.has(name)) return true;
      return dynamicAttrPatterns.some((pattern) => pattern.test(name));
    }

    function attrPairs(node) {
      const attrs = [];
      for (const attr of Array.from(node.attributes || [])) {
        const name = attr.name;
        if (shouldSkipAttr(name)) continue;
        let value = attr.value;
        if (name === "class") value = normalizeClass(value);
        if (name === "style") value = normalizeStyle(value);
        if (name === "style" && !value) continue;
        attrs.push([name, value]);
      }
      attrs.sort(([left], [right]) => {
        if (left === "class") return -1;
        if (right === "class") return 1;
        return left.localeCompare(right);
      });
      return attrs;
    }

    function visit(node, depth, siblingIndex) {
      if (lines.length >= maxNodes) {
        truncated = true;
        return;
      }
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.replace(/\s+/g, " ").trim();
        if (text) lines.push(`${"  ".repeat(depth)}#text ${JSON.stringify(text)}`);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const attrs = attrPairs(node).map(([name, value]) => `${name}=${JSON.stringify(value)}`).join(" ");
      lines.push(`${"  ".repeat(depth)}${node.tagName.toLowerCase()}#${siblingIndex}${attrs ? " " + attrs : ""}`);
      if (depth >= maxDepth) return;
      let childIndex = 0;
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE && !child.textContent.replace(/\s+/g, " ").trim()) continue;
        visit(child, depth + 1, childIndex);
        childIndex += 1;
        if (lines.length >= maxNodes) break;
      }
    }

    visit(element, 0, 0);
    return {
      found: true,
      selector,
      text: (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 260),
      lines,
      truncated,
    };
  });
}

function commonPrefix(left, right) {
  let count = 0;
  while (count < left.length && count < right.length && left[count] === right[count]) count += 1;
  return count;
}

function renderMarkdown(audit) {
  const lines = [
    "# Codex Markup Alignment Audit",
    "",
    `Generated: ${audit.generatedAt}`,
    "",
    "This audit compares canonical markup from captured extension DOM to the current Codex Web Shadow DOM. Screenshots are not used.",
    "",
  ];
  for (const [state, components] of Object.entries(audit.components)) {
    lines.push(`## ${state}`, "");
    lines.push("| Component | Status | Reference Lines | Current Lines | Equal Prefix | First Mismatch |");
    lines.push("| --- | --- | ---: | ---: | ---: | --- |");
    for (const [name, result] of Object.entries(components)) {
      const first = result.diff.firstMismatches[0];
      lines.push([
        name,
        result.status,
        result.reference.lineCount,
        result.current.lineCount,
        result.diff.equalPrefixCount,
        first ? code(`${first.index}: ref ${first.reference || "(none)"} / cur ${first.current || "(none)"}`) : "",
      ].join(" | ").replace(/^/, "| ").replace(/$/, " |"));
    }
    lines.push("");
  }
  lines.push("## Rule", "");
  lines.push("- Any `different` status is unfinished unless the mismatch is documented as a required runtime adapter and kept out of visible styling/structure.");
  lines.push("- Fix markup/code differences before accepting screenshot similarity.");
  lines.push("");
  return `${lines.join("\n")}`;
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
