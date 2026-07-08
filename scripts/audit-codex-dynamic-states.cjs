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
  const url = fixtureURL(APP_URL);
  const target = await createPageTarget(url);
  const page = await connect(target.webSocketDebuggerUrl);
  let dom = null;
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
    await page.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
    }).catch(() => {});

    await navigate(page, url);
    await evalPage(page, `(() => {
      localStorage.setItem("codex-web:sidebar-width", ${JSON.stringify(String(SIDEBAR_WIDTH))});
      document.documentElement.style.setProperty("--cw-sidebar-width", ${JSON.stringify(`${SIDEBAR_WIDTH}px`)});
    })()`);
    await waitForShadow(page, "[data-codex-view='thread']");
    await waitForShadowStyles(page);
    await waitForShadow(page, "._cadencedShimmer_18j3y_1");
    await waitForShadow(page, "._cadencedShimmerActive_18j3y_46", 3000);
    await waitFor(
      page,
      `(() => {
        const root = document.querySelector("#codexPanel")?.shadowRoot;
        return Array.from(root?.querySelectorAll("code") || []).some((node) => /\\$\\s*npm run build/.test(node.innerText || node.textContent || ""));
      })()`,
      3000,
      "running shell command",
    ).catch(() => {});
    dom = await evalPage(page, dynamicDOMExpression());
    dom.composer = await evalPage(page, composerDOMExpression());
  } finally {
    page.close();
    await closePageTarget(target.id).catch(() => {});
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
    { name: "running shell command block present", ok: dom.runningShell.block.found, details: dom.runningShell.block.signature },
    { name: "running shell command text is visible", ok: /\$\s*npm run build/.test(dom.runningShell.command.text), details: dom.runningShell.command.text },
    { name: "running shell status is preserved", ok: /\brunning\b/i.test(dom.runningShell.status.text), details: dom.runningShell.status.text },
    { name: "running shell footer is in-progress", ok: dom.runningShell.footer.found && !/Success|Stopped|Exit code/i.test(dom.runningShell.footer.text), details: dom.runningShell.footer.signature },
    { name: "completed transition command is hidden for official alignment", ok: !dom.completedShell.command.found && !dom.completedShell.header.found, details: dom.completedShell.header.text || dom.completedShell.command.text || "" },
    { name: "completed transition command has no visible running status", ok: !/\brunning\b/i.test(dom.completedShell.header.text || ""), details: dom.completedShell.header.text || "" },
    { name: "completed transition command is not shimmer", ok: !dom.completedShell.hasShimmer, details: dom.completedShell.header.signature || "" },
    { name: "completed transition does not expose success footer", ok: !/Success/.test(dom.completedShell.footer.text || ""), details: dom.completedShell.footer.text || "" },
    { name: "failed shell command remains visible", ok: /\$\s*exit 1/.test(dom.failedShell.command.text), details: dom.failedShell.command.text },
    { name: "failed shell command carries failed status", ok: /\bfailed\b/i.test(dom.failedShell.header.text), details: dom.failedShell.header.text },
    { name: "failed shell footer shows exit code", ok: /Exit code 1/.test(dom.failedShell.footer.text), details: dom.failedShell.footer.text },
    { name: "error activity row present", ok: dom.error.header.found, details: dom.error.header.signature },
    { name: "error activity row uses error tone", ok: dom.error.usesErrorTone, details: dom.error.header.signature },
    { name: "error activity row is not shimmer", ok: dom.error.header.found && !dom.error.hasShimmer, details: dom.error.header.signature },
    { name: "error activity details are collapsed by default", ok: dom.error.bodyHidden && dom.error.detailRetained, details: JSON.stringify(dom.error.body) },
    { name: "cancelled turn status row present", ok: dom.cancelled.header.found, details: dom.cancelled.header.signature },
    { name: "cancelled turn status row is not shimmer", ok: dom.cancelled.header.found && !dom.cancelled.hasShimmer, details: dom.cancelled.header.signature },
    { name: "cancelled turn hides stale running command", ok: !dom.cancelled.staleRunningTextVisible, details: `sleep 600 visible=${dom.cancelled.staleRunningTextVisible}` },
    { name: "composer placeholder is not editable text", ok: dom.composer.initial.text === "" && dom.composer.initial.empty === "true", details: JSON.stringify(dom.composer.initial) },
    { name: "send button is dimmed when composer is empty", ok: !dom.composer.initial.sendReady && dom.composer.initial.sendOpacity === "0.5", details: JSON.stringify(dom.composer.initial) },
    { name: "empty composer delete keeps placeholder state", ok: dom.composer.afterDelete.defaultPrevented && dom.composer.afterDelete.text === "" && dom.composer.afterDelete.empty === "true", details: JSON.stringify(dom.composer.afterDelete) },
    { name: "send button stays dimmed after empty delete", ok: !dom.composer.afterDelete.sendReady && dom.composer.afterDelete.sendOpacity === "0.5", details: JSON.stringify(dom.composer.afterDelete) },
    { name: "composer typed text is visible text", ok: dom.composer.afterType.text === "hello codex" && dom.composer.afterType.empty === "false", details: JSON.stringify(dom.composer.afterType) },
    { name: "send button becomes ready with text", ok: dom.composer.afterType.sendReady && dom.composer.afterType.sendOpacity === "1", details: JSON.stringify(dom.composer.afterType) },
    { name: "send button resets when composer is cleared", ok: !dom.composer.afterClear.sendReady && dom.composer.afterClear.empty === "true" && dom.composer.afterClear.sendOpacity === "0.5", details: JSON.stringify(dom.composer.afterClear) },
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    basis: "Dynamic state audit for thinking shimmer and running tool activity. Source snippets come from official extension JS/CSS; DOM comes from the local panel fixture.",
    fixtureURL: url,
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
        sendClass: send?.className || "",
        sendStyle: send?.getAttribute("style") || "",
        sendDisabled: !!send?.classList.contains("codex-send-disabled"),
        sendReady: !!send?.classList.contains("codex-send-ready"),
        sendOpacity: send ? getComputedStyle(send).opacity : "",
        sendAriaDisabled: send?.getAttribute("aria-disabled") || "",
        sendOpacityRules: send ? matchingOpacityRules(send) : [],
      };
    }
    function matchingOpacityRules(element) {
      const root = document.querySelector("#codexPanel")?.shadowRoot;
      const matches = [];
      function visitRules(rules, href) {
        for (const rule of Array.from(rules || [])) {
          if (rule.cssRules) {
            visitRules(rule.cssRules, href);
            continue;
          }
          if (!rule.selectorText || !rule.style?.opacity) continue;
          try {
            if (element.matches(rule.selectorText)) {
              matches.push({
                href,
                selector: rule.selectorText,
                opacity: rule.style.opacity,
                important: rule.style.getPropertyPriority("opacity"),
              });
            }
          } catch {}
        }
      }
      for (const sheet of Array.from(root?.styleSheets || [])) {
        try {
          visitRules(sheet.cssRules, sheet.href || "inline");
        } catch {}
      }
      return matches.slice(-12);
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
    await new Promise((resolve) => setTimeout(resolve, 500));
    const afterType = state();
    if (input) {
      input.textContent = "";
      input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" }));
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
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
  url.searchParams.set("auditRun", RUN_ID);
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
    const commandNodes = Array.from(root?.querySelectorAll("code") || [])
      .filter((node) => String(node.className || "").includes("font-vscode-editor") && String(node.className || "").includes("line-clamp-2"));
    const runningCommand = commandNodes.find((node) => /\\$\\s*npm run build/.test(node.innerText || node.textContent || "")) || null;
    const runningShellBlock = runningCommand?.closest(".group.flex.flex-col") || null;
    const runningStatus = Array.from(root?.querySelectorAll(".codex-turn-activity-status") || [])
      .find((node) => /\\brunning\\b/i.test(node.innerText || node.textContent || "")) || null;
    const runningFooter = Array.from(runningShellBlock?.querySelectorAll(".text-size-chat") || [])
      .find((node) => String(node.className || "").includes("px-2.5") && String(node.className || "").includes("pb-1")) || null;
    const runningOutput = runningShellBlock?.querySelector(".vertical-scroll-fade-mask code") || null;
    const completedCommand = commandNodes.find((node) => /\\$\\s*echo done/.test(node.innerText || node.textContent || "")) || null;
    const completedShellBlock = completedCommand?.closest(".group.flex.flex-col") || null;
    const completedHeader = headers.find((node) => /echo done/.test(node.innerText || node.textContent || "")) || null;
    const completedFooter = Array.from(completedShellBlock?.querySelectorAll(".text-size-chat") || [])
      .find((node) => /Success|Stopped|Exit code/.test(node.innerText || node.textContent || "")) || null;
    const failedCommand = commandNodes.find((node) => /\\$\\s*exit 1/.test(node.innerText || node.textContent || "")) || null;
    const failedShellBlock = failedCommand?.closest(".group.flex.flex-col") || null;
    const failedHeader = headers.find((node) => /exit 1/.test(node.innerText || node.textContent || "")) || null;
    const failedFooter = Array.from(failedShellBlock?.querySelectorAll(".text-size-chat") || [])
      .find((node) => /Success|Stopped|Exit code/.test(node.innerText || node.textContent || "")) || null;
    const errorHeader = headers.find((node) => /\\bError\\b/.test(node.innerText || node.textContent || "")) || null;
    const errorBody = errorHeader?.parentElement?.querySelector("[aria-hidden]") || null;
    const errorBodyStyle = errorBody ? getComputedStyle(errorBody) : null;
    const cancelledHeader = headers.find((node) => /\\bStopped\\b/.test(node.innerText || node.textContent || "")) || null;
    const rootText = root?.innerText || root?.textContent || "";
    return {
      thinking: {
        ...describe(thinking),
        hasSweep: !!thinking?.querySelector("._cadencedShimmerSweep_18j3y_12"),
        hasHighlight: !!thinking?.querySelector("._cadencedShimmerHighlight_18j3y_37"),
      },
      activityHeader: describe(activityHeader),
      activityShimmer: describe(activityShimmer),
      activityBody: describe(activityBody),
      runningShell: {
        command: describe(runningCommand),
        block: describe(runningShellBlock),
        status: describe(runningStatus),
        footer: describe(runningFooter),
        output: describe(runningOutput),
        codeSamples: commandNodes.map(describe),
      },
      completedShell: {
        command: describe(completedCommand),
        block: describe(completedShellBlock),
        header: describe(completedHeader),
        footer: describe(completedFooter),
        hasShimmer: Boolean(completedHeader?.querySelector("._cadencedShimmer_18j3y_1")),
      },
      failedShell: {
        command: describe(failedCommand),
        block: describe(failedShellBlock),
        header: describe(failedHeader),
        footer: describe(failedFooter),
      },
      error: {
        header: describe(errorHeader),
        body: describe(errorBody),
        hasShimmer: Boolean(errorHeader?.querySelector("._cadencedShimmer_18j3y_1")),
        usesErrorTone: Boolean(errorHeader?.querySelector(".text-token-editor-error-foreground")),
        detailRetained: /Simulated CLI failure/.test(errorBody?.textContent || ""),
        bodyHidden: Boolean(errorBody)
          && errorBody.getAttribute("aria-hidden") === "true"
          && errorBody.hasAttribute("inert")
          && errorBodyStyle?.pointerEvents === "none"
          && errorBodyStyle?.opacity === "0"
          && errorBodyStyle?.height === "0px",
      },
      cancelled: {
        header: describe(cancelledHeader),
        hasShimmer: Boolean(cancelledHeader?.querySelector("._cadencedShimmer_18j3y_1")),
        staleRunningTextVisible: /sleep 600/.test(rootText),
      },
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
    "### Running Shell",
    "",
    "```text",
    report.dom.runningShell?.block?.signature || "",
    "```",
    "",
    "### Completed Transition Shell",
    "",
    "```text",
    report.dom.completedShell?.block?.signature || "",
    "```",
    "",
    "### Failed Shell",
    "",
    "```text",
    report.dom.failedShell?.block?.signature || "",
    "```",
    "",
    "### Error",
    "",
    "```text",
    report.dom.error?.header?.signature || "",
    "```",
    "",
    "### Cancelled",
    "",
    "```text",
    report.dom.cancelled?.header?.signature || "",
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

async function createPageTarget(url) {
  const response = await fetch(`${CDP}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  if (!response.ok) throw new Error(`create target: ${response.status} ${response.statusText}`);
  return response.json();
}

async function closePageTarget(id) {
  if (!id) return;
  await fetch(`${CDP}/json/close/${encodeURIComponent(id)}`);
}

async function navigate(page, url) {
  await page.send("Page.navigate", { url });
  await waitFor(page, `location.href === ${JSON.stringify(url)}`, 30000, "navigation target");
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

async function waitForShadowStyles(page, timeoutMs = 30000) {
  await waitFor(
    page,
    `(() => {
      const root = document.querySelector("#codexPanel")?.shadowRoot;
      if (!root) return false;
      const links = Array.from(root.querySelectorAll("link[rel='stylesheet']"));
      return links.length > 0 && links.every((link) => Boolean(link.sheet));
    })()`,
    timeoutMs,
    "shadow stylesheets"
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
