#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const CDP = process.env.CDP_URL || "http://127.0.0.1:9222";
const APP_URL = process.env.PANEL_URL || "http://127.0.0.1:58888/";
const SIDEBAR_WIDTH = Number(process.env.SIDEBAR_WIDTH || 611);
const VIEWPORT_WIDTH = Number(process.env.VIEWPORT_WIDTH || 1904);
const VIEWPORT_HEIGHT = Number(process.env.VIEWPORT_HEIGHT || 985);

const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, "reference", "codex-reference");
const outJSON = path.join(outDir, "dynamic-state-audit.json");
const outMD = path.join(outDir, "dynamic-state-audit.md");
const officialAssetDir = path.join(repoRoot, "reference", "extension-source", "openai.chatgpt-26.5623.31443", "webview", "assets");

const sourceFiles = [
  "thinking-shimmer-B8u0gTMT.js",
  "thinking-shimmer-BhOGlSiR.css",
  "tool-activity-disclosure-BLOD7VGb.js",
  "timeline-item-kfxn1jgJ.js",
  "local-conversation-turn-BZInUTC2.js",
];

const sourceSnippets = [
  "loading-shimmer-pure-text",
  "_cadencedShimmer_18j3y_1",
  "_cadencedShimmerSweep_18j3y_12",
  "_cadencedShimmerHighlight_18j3y_37",
  "group/activity-header inline-flex min-w-0 max-w-full self-start items-center gap-1.5 p-0 text-left",
  "text-size-chat min-w-0 truncate text-token-conversation-summary-leading group-hover/activity-header:text-token-foreground",
  "min-w-0 text-size-chat",
  "relative overflow-visible py-0",
  "flex flex-col gap-2 pt-2 pb-1",
];

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const sourceEvidence = readSourceEvidence();
  const target = await getActivePageTarget();
  const page = await connect(target.webSocketDebuggerUrl);
  let dom = null;
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
    await page.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
    }).catch(() => {});

    await navigate(page, fixtureURL(APP_URL));
    await evalPage(page, `(() => {
      localStorage.setItem("codex-web:sidebar-width", ${JSON.stringify(String(SIDEBAR_WIDTH))});
      document.documentElement.style.setProperty("--cw-sidebar-width", ${JSON.stringify(`${SIDEBAR_WIDTH}px`)});
    })()`);
    await waitForShadow(page, "[data-codex-view='thread']");
    await waitForShadow(page, "._cadencedShimmer_18j3y_1");
    await waitForShadow(page, "._cadencedShimmerActive_18j3y_46", 3000);
    dom = await evalPage(page, dynamicDOMExpression());
    dom.composer = await evalPage(page, composerDOMExpression());
  } finally {
    page.close();
  }

  const checks = [
    ...sourceEvidence.checks,
    { name: "thinking shimmer node present", ok: dom.thinking.found, details: dom.thinking.signature },
    { name: "thinking shimmer sweep/highlight present", ok: dom.thinking.hasSweep && dom.thinking.hasHighlight, details: dom.thinking.signature },
    { name: "cadenced active class observed", ok: dom.activeShimmerCount > 0, details: `${dom.activeShimmerCount} active shimmer node(s)` },
    { name: "running activity header present", ok: dom.activityHeader.found, details: dom.activityHeader.signature },
    { name: "running activity is expanded", ok: dom.activityHeader.ariaExpanded === "true", details: `aria-expanded=${dom.activityHeader.ariaExpanded}` },
    { name: "running activity shimmer source classes present", ok: dom.activityShimmer.found, details: dom.activityShimmer.signature },
    { name: "running activity body present", ok: dom.activityBody.found, details: dom.activityBody.signature },
    { name: "composer placeholder is not editable text", ok: dom.composer.initial.text === "" && dom.composer.initial.empty === "true", details: JSON.stringify(dom.composer.initial) },
    { name: "empty composer delete keeps placeholder state", ok: dom.composer.afterDelete.defaultPrevented && dom.composer.afterDelete.text === "" && dom.composer.afterDelete.empty === "true", details: JSON.stringify(dom.composer.afterDelete) },
    { name: "composer typed text is visible text", ok: dom.composer.afterType.text === "hello codex" && dom.composer.afterType.empty === "false", details: JSON.stringify(dom.composer.afterType) },
    { name: "send button becomes ready with text", ok: dom.composer.afterType.sendReady && dom.composer.afterType.sendOpacity === "1", details: JSON.stringify(dom.composer.afterType) },
    { name: "send button resets when composer is cleared", ok: !dom.composer.afterClear.sendReady && dom.composer.afterClear.empty === "true", details: JSON.stringify(dom.composer.afterClear) },
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    basis: "Dynamic state audit for thinking shimmer and running tool activity. Source snippets come from official extension JS/CSS; DOM comes from the local panel fixture.",
    fixtureURL: fixtureURL(APP_URL),
    sourceFiles,
    sourceSnippets,
    sourceEvidence,
    dom,
    summary: {
      checks: checks.length,
      failed: checks.filter((check) => !check.ok).length,
    },
    checks,
  };

  fs.writeFileSync(outJSON, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(outMD, renderMarkdown(report));
  console.log(outJSON);
  console.log(outMD);
  if (report.summary.failed > 0) process.exitCode = 1;
}

function composerDOMExpression() {
  return `(async () => {
    const root = document.querySelector("#codexPanel")?.shadowRoot;
    const input = root?.querySelector("[data-codex-composer]");
    const send = root?.querySelector("[data-action='send']");
    function state() {
      return {
        found: !!input,
        text: (input?.innerText || input?.textContent || "").replace(/\\s+/g, " ").trim(),
        empty: input?.getAttribute("data-codex-empty") || "",
        html: input?.innerHTML || "",
        placeholder: input ? getComputedStyle(input, "::before").content : "",
        sendReady: !!send?.classList.contains("codex-send-ready"),
        sendOpacity: send ? getComputedStyle(send).opacity : "",
        sendAriaDisabled: send?.getAttribute("aria-disabled") || "",
      };
    }
    const initial = state();
    input?.focus();
    const deleteEvent = new InputEvent("beforeinput", {
      inputType: "deleteContentBackward",
      bubbles: true,
      cancelable: true,
    });
    const deleteDispatchResult = input?.dispatchEvent(deleteEvent);
    input?.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" }));
    const afterDelete = {
      ...state(),
      defaultPrevented: deleteEvent.defaultPrevented,
      dispatchResult: deleteDispatchResult,
    };
    if (input) {
      input.textContent = "hello codex";
      input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: "hello codex" }));
    }
    await new Promise((resolve) => setTimeout(resolve, 220));
    const afterType = state();
    if (input) {
      input.textContent = "";
      input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" }));
    }
    await new Promise((resolve) => setTimeout(resolve, 220));
    const afterClear = state();
    return { initial, afterDelete, afterType, afterClear };
  })()`;
}

function readSourceEvidence() {
  const parts = [];
  const files = [];
  for (const name of sourceFiles) {
    const file = path.join(officialAssetDir, name);
    const exists = fs.existsSync(file);
    files.push({ name, exists, bytes: exists ? fs.statSync(file).size : 0 });
    if (exists) parts.push(fs.readFileSync(file, "utf8"));
  }
  const text = parts.join("\n");
  return {
    files,
    checks: [
      ...files.map((file) => ({
        name: `official asset present: ${file.name}`,
        ok: file.exists && file.bytes > 0,
        details: `${file.bytes} bytes`,
      })),
      ...sourceSnippets.map((snippet) => ({
        name: `official source contains: ${snippet}`,
        ok: text.includes(snippet),
        details: snippet,
      })),
    ],
  };
}

function fixtureURL(baseURL) {
  const url = new URL(baseURL);
  url.searchParams.set("codexFixture", "dynamic");
  return url.toString();
}

function dynamicDOMExpression() {
  return `(() => {
    const root = document.querySelector("#codexPanel")?.shadowRoot;
    function byClass(name) {
      return Array.from(root?.querySelectorAll("*") || []).filter((node) => node.classList?.contains(name));
    }
    function describe(node) {
      if (!node) return { found: false, signature: "" };
      return {
        found: true,
        tagName: node.tagName.toLowerCase(),
        className: String(node.className || ""),
        text: (node.innerText || node.textContent || "").replace(/\\s+/g, " ").trim(),
        ariaExpanded: node.getAttribute("aria-expanded"),
        signature: signature(node),
      };
    }
    function signature(node) {
      if (!node) return "";
      const lines = [];
      function visit(current, depth) {
        if (!current || lines.length >= 28 || depth > 5) return;
        if (current.nodeType === Node.TEXT_NODE) {
          const text = current.textContent.replace(/\\s+/g, " ").trim();
          if (text) lines.push("  ".repeat(depth) + "#text " + JSON.stringify(text));
          return;
        }
        if (current.nodeType !== Node.ELEMENT_NODE) return;
        const attrs = [];
        if (current.className) attrs.push(\`class=\${JSON.stringify(String(current.className))}\`);
        if (current.getAttribute("aria-expanded") != null) attrs.push(\`aria-expanded=\${JSON.stringify(current.getAttribute("aria-expanded"))}\`);
        if (current.getAttribute("aria-hidden") != null) attrs.push(\`aria-hidden=\${JSON.stringify(current.getAttribute("aria-hidden"))}\`);
        lines.push(("  ".repeat(depth) + current.tagName.toLowerCase() + " " + attrs.join(" ")).trimEnd());
        for (const child of Array.from(current.childNodes)) visit(child, depth + 1);
      }
      visit(node, 0);
      return lines.join("\\n");
    }
    const shimmers = byClass("_cadencedShimmer_18j3y_1");
    const thinking = shimmers.find((node) => node.classList.contains("select-none")) || null;
    const headers = byClass("group/activity-header");
    const activityHeader = headers.find((node) => /\u6b63\u5728\u7f16\u8f91|\u5df2\u7f16\u8f91|Editing|Edited/.test(node.innerText || node.textContent || "")) || null;
    const activityShimmer = activityHeader?.querySelector("._cadencedShimmer_18j3y_1") || null;
    const activityBody = activityHeader?.parentElement?.querySelector(".pl-6") || null;
    return {
      thinking: {
        ...describe(thinking),
        hasSweep: !!thinking?.querySelector("._cadencedShimmerSweep_18j3y_12"),
        hasHighlight: !!thinking?.querySelector("._cadencedShimmerHighlight_18j3y_37"),
      },
      activityHeader: describe(activityHeader),
      activityShimmer: describe(activityShimmer),
      activityBody: describe(activityBody),
      headers: headers.map(describe),
      activeShimmerCount: byClass("_cadencedShimmerActive_18j3y_46").length,
      shimmerCount: shimmers.length,
      headerCount: headers.length,
    };
  })()`;
}

function renderMarkdown(report) {
  const lines = [
    "# Codex Dynamic State Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Summary",
    "",
    `- Checks: ${report.summary.checks}`,
    `- Failed: ${report.summary.failed}`,
    "",
    "## Checks",
    "",
    "| Check | Status | Details |",
    "| --- | --- | --- |",
  ];
  for (const check of report.checks) {
    lines.push(`| ${escapeMD(check.name)} | ${check.ok ? "ok" : "fail"} | ${escapeMD(String(check.details || ""))} |`);
  }
  lines.push(
    "",
    "## DOM Signatures",
    "",
    "### Thinking",
    "",
    "```text",
    report.dom.thinking.signature || "",
    "```",
    "",
    "### Activity",
    "",
    "```text",
    report.dom.activityHeader.signature || "",
    "```",
    "",
    "### Composer",
    "",
    "```json",
    JSON.stringify(report.dom.composer || {}, null, 2),
    "```",
    "",
  );
  return `${lines.join("\n")}\n`;
}

function escapeMD(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

async function getActivePageTarget() {
  const targets = await readJSON(`${CDP}/json/list`);
  const app = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl && target.url.startsWith(APP_URL));
  if (app) return app;
  const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
  if (page) return page;
  const response = await fetch(`${CDP}/json/new?${encodeURIComponent(APP_URL)}`, { method: "PUT" });
  if (!response.ok) throw new Error(`create target: ${response.status} ${response.statusText}`);
  return response.json();
}

async function navigate(page, url) {
  await page.send("Page.navigate", { url });
  await waitFor(page, `document.readyState === "complete" || document.readyState === "interactive"`, 30000, "page load");
}

async function waitForShadow(page, selector, timeoutMs = 30000) {
  await waitFor(
    page,
    `!!document.querySelector("#codexPanel")?.shadowRoot?.querySelector(${JSON.stringify(selector)})`,
    timeoutMs,
    selector,
  );
}

async function waitFor(page, expression, timeoutMs, label) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evalPage(page, `(() => { try { return Boolean(${expression}); } catch { return false; } })()`)) return;
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function evalPage(page, expression) {
  const result = await page.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed");
  return result.result.value;
}

async function readJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
  return response.json();
}

async function connect(webSocketDebuggerUrl) {
  const ws = new WebSocket(webSocketDebuggerUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message || JSON.stringify(message.error)));
    else entry.resolve(message.result || {});
  });
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  return {
    send(method, params = {}) {
      const id = nextId++;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    close() {
      ws.close();
    },
  };
}
