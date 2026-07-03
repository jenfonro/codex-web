#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const CDP = process.env.CDP_URL || "http://127.0.0.1:9222";
const CODE_SERVER_URL = process.env.CODE_SERVER_URL || "https://code-tx.zelt.cn/?folder=/root";
const PASSWORD = process.env.CODE_SERVER_PASSWORD || readCodeServerPassword();
const EXTENSION_ID = "openai.chatgpt-26.5623.31443";
const EXTENSION_ROOT = `/root/.local/share/code-server/extensions/${EXTENSION_ID}/webview/assets`;
const repoRoot = path.resolve(__dirname, "..");
const outRoot = path.join(repoRoot, "reference", "extension-source", EXTENSION_ID);
const assetsDir = path.join(outRoot, "webview", "assets");
const domDir = path.join(outRoot, "dom");

const REQUIRED_ASSETS = new Set([
  "index-DQDKzzu5.js",
  "app-main-C2YLkfRu.js",
  "app-shell-CkQyH8xO.js",
  "composer-BSCaQqMy.js",
  "composer-top-menu-chrome-BdrIQn0v.js",
  "composer-mode-availability-CAsSkZ1c.js",
  "composer-mode-preference-Dumquf8i.js",
  "composer-scope-DVP9T2Qo.js",
  "composer-view-state-DLEq41Ez.js",
  "model-and-reasoning-dropdown-DRLXO85N.js",
  "dropdown-CpnvbJ-A.js",
  "button-B29-dPbF.js",
  "prompt-editor-IGyinovc.js",
  "local-conversation-thread-BZVb6eGu.js",
  "local-conversation-stream-role-product-event-BfzYvSA4.js",
  "thread-page-header-BsilHdOZ.js",
  "thread-layout-CNTItO3c.js",
  "thread-scroll-layout-UQxtY_Mt.js",
  "thread-virtualizer-D_jAynoO.js",
  "thread-overflow-menu-B73FZlWU.js",
  "thread-page-bottom-panel-state-CszM5mx1.js",
  "worktree-init-v2-page-C-p8q9AG.js",
  "thinking-shimmer-B8u0gTMT.js",
  "tool-activity-disclosure-BLOD7VGb.js",
  "timeline-item-kfxn1jgJ.js",
  "local-conversation-turn-BZInUTC2.js",
  "worktree-init-tool-activities-B1o2n3Qp.js",
  "worktree-init-tool-activities-CxuoHau6.css",
  "app-shell-DJDX7Pvr.css",
  "at-mention-list-BF8TOyej.css",
  "cmdk-pBm4kpmV.css",
  "local-conversation-turn-CGBrbw6f.css",
  "local-task-row-Bj9zvK4d.css",
  "composer-CXInBfIq.css",
  "composer-footer-D2K4qkyA.css",
  "composer-top-menu-chrome-EBEHrbNH.css",
  "dialog-layout-sS9Dm_y9.css",
  "diff-unified-updTK7TW.css",
  "markdown-DmSBSKzD.css",
  "progression-donut-BI3OQbB8.css",
  "prompt-editor-BuS6Xjko.css",
  "prosemirror-ptHiDCW_.css",
  "rate-limit-reset-modal-D3jrmUOb.css",
  "referral-invite-modal-DeNnfVpo.css",
  "scroll-to-bottom-buton-H4NGgmRi.css",
  "thinking-shimmer-BhOGlSiR.css",
  "thread-page-bottom-panel-state-BrqwKW_G.css",
  "thread-side-panel-tabs-CYswclfQ.css",
  "dropdown-9F1MU8ql.css",
  "app-main-DH0Qggoi.css",
]);

const ASSET_NAME_PATTERNS = [
  /index-|app-main-|app-shell-/,
  /composer|prompt-editor|attachment|mention|at-mention/i,
  /thread|conversation|message|markdown|task|worktree|thinking|shimmer/i,
  /model|reasoning|permission|approval|dropdown|menu|button|checkbox/i,
  /icon|chevron|plus|check|copy|regenerate|three-dots|blossom|codex/i,
];

const STYLE_PROPS = [
  "display",
  "position",
  "boxSizing",
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
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
  "zIndex",
  "cursor",
];

const SELECTORS = [
  "html",
  "body",
  "#root",
  "#root > *",
  "[data-user-message-bubble]",
  "[data-thread-find-target='conversation']",
  ".composer-surface-chrome",
  "._attachmentsDefault_1u8sk_2",
  "._footer_1u8sk_2",
  "._footer_z984f_2",
  ".ProseMirror",
  "[data-composer-overlay-floating-ui]",
  "[data-radix-menu-content]",
  "._markdownContent_lzkx4_60",
  "._markdownText_lzkx4_86",
  "[class*='composer']",
  "[class*='thread']",
  "[class*='conversation']",
  "[class*='message']",
  "[class*='task']",
  "[class*='shimmer']",
  "button",
  "svg",
];

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  resetDir(outRoot);
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.mkdirSync(domDir, { recursive: true });

  const target = await openOrFindCodeServerTarget();
  const page = await connect(target.webSocketDebuggerUrl);
  try {
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("DOM.enable").catch(() => {});
    await waitForLoad(page, 120000);
    await loginIfNeeded(page);
    await waitForWorkbench(page);

    const frameTree = await page.send("Page.getFrameTree");
    fs.writeFileSync(path.join(outRoot, "frame-tree.json"), `${JSON.stringify(frameTree, null, 2)}\n`);

    const topCapture = await evalTop(page, topCaptureExpression());
    fs.writeFileSync(path.join(domDir, "top-document.html"), topCapture.html);
    delete topCapture.html;
    fs.writeFileSync(path.join(domDir, "top-runtime.json"), `${JSON.stringify(topCapture, null, 2)}\n`);

    let webviewCapture = null;
    try {
      await ensureCodexViewVisible(page);
      await waitForCodexWebview(page, 45000);
      const freshFrameTree = await page.send("Page.getFrameTree");
      fs.writeFileSync(path.join(outRoot, "frame-tree-after-codex.json"), `${JSON.stringify(freshFrameTree, null, 2)}\n`);
      const activeFrame = findActiveWebviewFrame(freshFrameTree.frameTree);
      if (!activeFrame) throw new Error("could not find active OpenAI ChatGPT webview frame");
      const world = await page.send("Page.createIsolatedWorld", {
        frameId: activeFrame.id,
        worldName: "codexExtensionSourceCapture",
        grantUniveralAccess: true,
      });
      webviewCapture = await evalInContext(page, world.executionContextId, webviewCaptureExpression());
      fs.writeFileSync(path.join(domDir, "webview-document.html"), webviewCapture.html);
      delete webviewCapture.html;
      fs.writeFileSync(path.join(domDir, "webview-runtime.json"), `${JSON.stringify(webviewCapture, null, 2)}\n`);
    } catch (error) {
      fs.writeFileSync(path.join(domDir, "webview-runtime.json"), `${JSON.stringify({ ok: false, error: String(error?.message || error) }, null, 2)}\n`);
    }

    const assetNames = collectAssetNames(topCapture, webviewCapture);
    const downloaded = await downloadAssets(page, assetNames);
    fs.writeFileSync(path.join(outRoot, "assets.json"), `${JSON.stringify(downloaded, null, 2)}\n`);
    fs.writeFileSync(path.join(outRoot, "summary.md"), renderSummary(topCapture, webviewCapture, downloaded));
    console.log(outRoot);
  } finally {
    page.close();
  }
}

async function openOrFindCodeServerTarget() {
  const targets = await readJSON(`${CDP}/json/list`);
  const existing = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl && /code-tx\.zelt\.cn/.test(target.url));
  if (existing) return existing;
  const url = `${CDP}/json/new?${encodeURIComponent(CODE_SERVER_URL)}`;
  const response = await fetch(url, { method: "PUT" });
  if (!response.ok) throw new Error(`create target: ${response.status} ${response.statusText}`);
  return response.json();
}

async function loginIfNeeded(page) {
  await wait(800);
  const loggedIn = await evalTop(page, `(() => !document.querySelector("input[type='password'], input[name='password']"))()`);
  if (loggedIn) return;
  await evalTop(
    page,
    `(() => {
      const password = ${JSON.stringify(PASSWORD)};
      const input = document.querySelector("input[type='password'], input[name='password']");
      if (!input) return false;
      input.focus();
      input.value = password;
      input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: password }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      const form = input.closest("form");
      const submit = form?.querySelector("button[type='submit'], input[type='submit']") || document.querySelector("button[type='submit'], input[type='submit'], button");
      if (submit) submit.click();
      else form?.requestSubmit?.();
      return true;
    })()`,
  );
  await waitForLoad(page, 120000);
}

async function waitForWorkbench(page) {
  await waitFor(page, `document.querySelector(".monaco-workbench") && !document.querySelector("input[type='password']")`, 120000, "code-server workbench");
}

async function ensureCodexViewVisible(page) {
  await wait(2500);
  await evalTop(
    page,
    `(() => {
      const labels = Array.from(document.querySelectorAll(".activitybar [aria-label], .activitybar .action-label"));
      const codex = labels.find((el) => /Codex/i.test(el.getAttribute("aria-label") || ""));
      if (codex) {
        const item = codex.closest("[role='tab'], .action-item") || codex;
        item.click();
      }
      return Boolean(codex);
    })()`,
  ).catch(() => {});
}

async function waitForCodexWebview(page, timeoutMs = 120000) {
  await waitFor(
    page,
    `Array.from(document.querySelectorAll("iframe.webview.ready, iframe.webview")).some((frame) => /extensionId=openai\\.chatgpt/.test(frame.src))`,
    timeoutMs,
    "OpenAI ChatGPT webview",
  );
  await wait(12000);
}

function findActiveWebviewFrame(frameTreeNode) {
  const frames = [];
  flattenFrames(frameTreeNode, frames);
  return frames.find((frame) => /extensionId=openai\.chatgpt/.test(frame.url)) || frames.find((frame) => /openai\.chatgpt/.test(frame.url));
}

function collectAssetNames(topCapture, webviewCapture) {
  const names = new Set(REQUIRED_ASSETS);
  const entries = [
    ...(topCapture.resourceEntries || []),
    ...(webviewCapture?.resourceEntries || []),
    ...(webviewCapture?.linkedStylesheets || []).map((item) => ({ name: item.href })),
    ...(webviewCapture?.scripts || []).map((item) => ({ name: item.src })),
  ];
  for (const entry of entries) {
    const name = assetNameFromURL(entry.name || entry.href || entry.src || "");
    if (!name) continue;
    if (ASSET_NAME_PATTERNS.some((pattern) => pattern.test(name))) names.add(name);
  }
  return Array.from(names).sort();
}

async function downloadAssets(page, assetNames) {
  const downloaded = [];
  for (const name of assetNames) {
    const result = await evalTop(
      page,
      `(() => {
        const settings = JSON.parse(document.getElementById("vscode-workbench-web-configuration").dataset.settings);
        const stableRoot = settings.webviewEndpoint.split("/static/")[0];
        const assetPath = ${JSON.stringify(`${EXTENSION_ROOT}/${name}`)};
        const url = location.origin + "/" + stableRoot + "/vscode-remote-resource?path=" + encodeURIComponent(assetPath) + "&tkn=";
        return fetch(url).then(async (response) => ({
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get("content-type") || "",
          text: await response.text(),
        })).catch((error) => ({ ok: false, status: 0, statusText: String(error && error.message || error), contentType: "", text: "" }));
      })()`,
    );
    const record = {
      name,
      status: result.status,
      statusText: result.statusText,
      contentType: result.contentType,
      size: result.text ? result.text.length : 0,
      file: null,
    };
    if (result.ok && result.text) {
      fs.writeFileSync(path.join(assetsDir, name), result.text);
      record.file = path.relative(outRoot, path.join(assetsDir, name));
    }
    downloaded.push(record);
  }
  return downloaded;
}

function topCaptureExpression() {
  return `(() => {
    const config = document.getElementById("vscode-workbench-web-configuration")?.dataset.settings || "";
    const resourceEntries = performance.getEntriesByType("resource").map((entry) => ({
      name: entry.name,
      initiatorType: entry.initiatorType,
      transferSize: entry.transferSize,
      encodedBodySize: entry.encodedBodySize,
      decodedBodySize: entry.decodedBodySize,
    }));
    return {
      url: location.href,
      title: document.title,
      readyState: document.readyState,
      config,
      resourceEntries,
      frames: Array.from(document.querySelectorAll("iframe, webview")).map((el) => ({
        src: el.src,
        className: String(el.className || ""),
        rect: el.getBoundingClientRect().toJSON(),
      })),
      html: document.documentElement.outerHTML,
    };
  })()`;
}

function webviewCaptureExpression() {
  return `(() => {
    const selectors = ${JSON.stringify(SELECTORS)};
    const props = ${JSON.stringify(STYLE_PROPS)};
    function visible(el) {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    }
    function styleOf(el) {
      const style = getComputedStyle(el);
      const styles = {};
      for (const prop of props) styles[prop] = style[prop];
      return {
        tagName: el.tagName,
        id: el.id,
        className: String(el.className || ""),
        role: el.getAttribute("role"),
        ariaLabel: el.getAttribute("aria-label"),
        title: el.getAttribute("title"),
        text: (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 1000),
        rect: el.getBoundingClientRect().toJSON(),
        styles,
      };
    }
    const selectorStyles = {};
    for (const selector of selectors) {
      let nodes = [];
      try { nodes = Array.from(document.querySelectorAll(selector)); } catch {}
      selectorStyles[selector] = nodes.filter(visible).slice(0, 120).map(styleOf);
    }
    const variables = {};
    const rootStyle = getComputedStyle(document.documentElement);
    for (const name of Array.from(rootStyle)) {
      if (
        name.startsWith("--vscode-") ||
        name.startsWith("--color-") ||
        name.startsWith("--height-") ||
        name.startsWith("--spacing-") ||
        name.startsWith("--font-") ||
        name.startsWith("--text-") ||
        name.startsWith("--radius-")
      ) variables[name] = rootStyle.getPropertyValue(name).trim();
    }
    return {
      url: location.href,
      title: document.title,
      readyState: document.readyState,
      viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
      bodyText: (document.body?.innerText || "").slice(0, 50000),
      linkedStylesheets: Array.from(document.querySelectorAll("link[rel~='stylesheet']")).map((el) => ({ href: el.href, media: el.media, disabled: el.disabled })),
      scripts: Array.from(document.scripts).map((el) => ({ src: el.src, type: el.type, async: el.async, defer: el.defer })),
      resourceEntries: performance.getEntriesByType("resource").map((entry) => ({
        name: entry.name,
        initiatorType: entry.initiatorType,
        transferSize: entry.transferSize,
        encodedBodySize: entry.encodedBodySize,
        decodedBodySize: entry.decodedBodySize,
      })),
      selectorStyles,
      variables,
      html: document.documentElement.outerHTML,
    };
  })()`;
}

function renderSummary(topCapture, webviewCapture, downloaded) {
  const lines = [
    "# ChatGPT/Codex Extension Source Capture",
    "",
    `Captured: ${new Date().toISOString()}`,
    `Top URL: ${topCapture.url}`,
    `Webview URL: ${webviewCapture?.url || "not captured"}`,
    "",
    "## Assets",
    "",
  ];
  for (const item of downloaded) {
    lines.push(`- ${item.status} ${item.name} (${item.size} bytes)`);
  }
  lines.push("");
  return `${lines.join("\n")}`;
}

async function waitFor(page, condition, timeoutMs, label) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ok = await evalTop(page, `(() => Boolean(${condition}))()`).catch(() => false);
    if (ok) return;
    await wait(500);
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function waitForLoad(page, timeoutMs) {
  const ready = await evalTop(page, `(() => document.readyState === "complete" || document.readyState === "interactive")()`).catch(() => false);
  if (ready) return;
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, timeoutMs);
    page.once("Page.loadEventFired", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function evalTop(page, expression) {
  return evalInContext(page, null, expression);
}

async function evalInContext(client, contextId, expression) {
  const params = {
    expression,
    awaitPromise: true,
    returnByValue: true,
    serializationOptions: { serialization: "json" },
  };
  if (contextId) params.contextId = contextId;
  const result = await client.send("Runtime.evaluate", params);
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || JSON.stringify(result.exceptionDetails));
  }
  return result.result?.value;
}

function flattenFrames(node, out = []) {
  if (!node) return out;
  if (node.frame) out.push(node.frame);
  for (const child of node.childFrames || []) flattenFrames(child, out);
  return out;
}

function assetNameFromURL(value) {
  const match = String(value).match(/\/assets\/([^/?#]+\.(?:js|css|svg|woff2?|png))(?:[?#]|$)/i);
  return match ? match[1] : "";
}

function readCodeServerPassword() {
  const candidates = [
    process.env.CODE_SERVER_CONFIG,
    "C:\\Users\\79917\\Desktop\\jp-bak\\code-server\\config.yaml",
    "/root/.config/code-server/config.yaml",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const text = fs.readFileSync(candidate, "utf8");
    const match = text.match(/^password:\s*(.+)$/m);
    if (match) return match[1].trim();
  }
  throw new Error("missing CODE_SERVER_PASSWORD or code-server config.yaml");
}

function resetDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      return new Promise((resolve, reject) => {
        pending.set(messageId, { method, resolve, reject });
      });
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
