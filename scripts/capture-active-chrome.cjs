#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const CDP = process.env.CDP_URL || "http://127.0.0.1:9222";
const LABEL = process.env.CAPTURE_LABEL || "active";
const MIN_SIDEBAR_WIDTH = Number(process.env.MIN_SIDEBAR_WIDTH || 0);
const CAPTURE_EXTRA = process.env.CAPTURE_EXTRA === "1";
const repoRoot = path.resolve(__dirname, "..");
const outRoot = path.resolve(process.env.CAPTURE_DIR || path.join(repoRoot, "reference", "windows-captures"));
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
const outDir = path.join(outRoot, `${stamp}-${safeName(LABEL)}`);

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
  "background",
  "backgroundColor",
  "border",
  "borderTop",
  "borderRight",
  "borderBottom",
  "borderLeft",
  "borderRadius",
  "boxShadow",
  "outline",
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

const SELECTORS = [
  "html",
  "body",
  ".monaco-workbench",
  ".part.titlebar",
  ".part.activitybar",
  ".part.sidebar",
  ".part.editor",
  ".part.auxiliarybar",
  ".activitybar .action-item",
  ".activitybar .action-label",
  ".sidebar .composite.title",
  ".sidebar .content",
  "iframe",
  "webview",
  "#active-frame",
  "#root",
  "#root > *",
  "[data-testid]",
  "[data-test-id]",
  "[data-user-message-bubble]",
  "[data-thread-find-target]",
  "[data-slot]",
  "[aria-label]",
  "button",
  "input",
  "textarea",
  "[contenteditable='true']",
  ".ProseMirror",
  ".composer-surface-chrome",
  "._attachmentsDefault_1u8sk_2",
  "._footer_1u8sk_2",
  "._footer_z984f_2",
  "._markdownContent_lzkx4_60",
  "._markdownText_lzkx4_86",
  "._paragraph_lzkx4_82",
  "._list_lzkx4_133",
  "._listItem_lzkx4_168",
  "._inlineMarkdown_lzkx4_385",
  "[data-radix-menu-content]",
  "[data-composer-overlay-floating-ui]",
  "[class*='composer']",
  "[class*='Composer']",
  "[class*='thread']",
  "[class*='Thread']",
  "[class*='task']",
  "[class*='Task']",
  "[class*='markdown']",
  "[class*='Markdown']",
  "[class*='message']",
  "[class*='Message']",
  "[class*='shimmer']",
  "[class*='Shimmer']",
  "svg",
];

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.join(outDir, "frames"), { recursive: true });

  const target = await getActivePageTarget();
  const browserVersion = await readJSON(`${CDP}/json/version`);
  const page = await connect(target.webSocketDebuggerUrl);
  await page.send("Page.enable");
  await page.send("Runtime.enable");
  await page.send("DOM.enable").catch(() => {});

  const summary = {
    label: LABEL,
    capturedAt: new Date().toISOString(),
    cdp: CDP,
    browserVersion,
    target: pickTarget(target),
  };

  const preflight = await evalInContext(page, null, topMetricsExpression());
  summary.preflight = preflight;
  if (MIN_SIDEBAR_WIDTH > 0 && Number(preflight?.sidebar?.width || 0) < MIN_SIDEBAR_WIDTH) {
    page.close();
    throw new Error(`sidebar width ${preflight?.sidebar?.width || 0}px is below required ${MIN_SIDEBAR_WIDTH}px`);
  }

  await savePageArtifacts(page, summary);
  await saveFrameArtifacts(page, summary);

  summary.postflight = await evalInContext(page, null, topMetricsExpression()).catch((error) => ({ error: String(error?.message || error) }));
  fs.writeFileSync(path.join(outDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(path.join(outRoot, "latest.txt"), outDir);
  page.close();
  console.log(outDir);
}

async function getActivePageTarget() {
  const targets = await readJSON(`${CDP}/json/list`);
  const pages = targets.filter((target) => target.type === "page" && target.webSocketDebuggerUrl);
  if (pages.length === 0) throw new Error("no debuggable page targets found");
  const preferred =
    pages.find((target) => /127\.0\.0\.1:58888|localhost:58888/i.test(`${target.url} ${target.title}`)) ||
    pages.find((target) => /code-tx\.zelt\.cn|code-server/i.test(`${target.url} ${target.title}`));
  return preferred || pages[0];
}

async function savePageArtifacts(client, summary) {
  const screenshot = await client.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
    fromSurface: true,
  });
  fs.writeFileSync(path.join(outDir, "screenshot.png"), Buffer.from(screenshot.data, "base64"));

  if (CAPTURE_EXTRA) {
    const snapshot = await client.send("Page.captureSnapshot", { format: "mhtml" }).catch(() => null);
    if (snapshot?.data) fs.writeFileSync(path.join(outDir, "page.mhtml"), snapshot.data);
  }

  const frameTree = await client.send("Page.getFrameTree").catch(() => null);
  if (frameTree) {
    fs.writeFileSync(path.join(outDir, "frame-tree.json"), `${JSON.stringify(frameTree, null, 2)}\n`);
    summary.frameTree = frameTree;
  }

  const topRuntime = await evalInContext(client, null, captureExpression());
  fs.writeFileSync(path.join(outDir, "top-runtime.json"), `${JSON.stringify(topRuntime, null, 2)}\n`);
  if (topRuntime?.html) {
    fs.writeFileSync(path.join(outDir, "top-document.html"), topRuntime.html);
    delete topRuntime.html;
  }
  summary.topRuntime = topRuntime;
}

async function saveFrameArtifacts(client, summary) {
  const frames = flattenFrames(summary.frameTree?.frameTree).filter(Boolean);
  summary.frames = [];

  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    const frameDir = path.join(outDir, "frames", `${String(index).padStart(2, "0")}-${safeName(frame.name || frame.url || frame.id).slice(0, 80)}`);
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
      const world = await client.send("Page.createIsolatedWorld", {
        frameId: frame.id,
        worldName: `codexCapture${index}`,
        grantUniveralAccess: true,
      });
      const capture = await evalInContext(client, world.executionContextId, captureExpression());
      fs.writeFileSync(path.join(frameDir, "runtime.json"), `${JSON.stringify(capture, null, 2)}\n`);
      if (capture?.html) {
        fs.writeFileSync(path.join(frameDir, "document.html"), capture.html);
        delete capture.html;
      }
      frameSummary.runtime = {
        ok: true,
        url: capture.url,
        title: capture.title,
        viewport: capture.viewport,
        bodyTextLength: capture.bodyText?.length || 0,
        selectorCount: Object.values(capture.selectorStyles || {}).reduce((sum, items) => sum + items.length, 0),
      };
    } catch (error) {
      frameSummary.runtime = { ok: false, error: String(error?.message || error) };
    }

    fs.writeFileSync(path.join(frameDir, "summary.json"), `${JSON.stringify(frameSummary, null, 2)}\n`);
    summary.frames.push(frameSummary);
  }
}

function captureExpression() {
  return `(() => {
    const selectors = ${JSON.stringify(SELECTORS)};
    const props = ${JSON.stringify(STYLE_PROPS)};
    function textOf(el) {
      return (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 2000);
    }
    function rectOf(el) {
      const rect = el.getBoundingClientRect();
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
    }
    function styleOf(el) {
      const style = getComputedStyle(el);
      const out = {};
      for (const prop of props) out[prop] = style[prop];
      return {
        tagName: el.tagName,
        id: el.id || "",
        className: String(el.className || ""),
        role: el.getAttribute("role"),
        ariaLabel: el.getAttribute("aria-label"),
        title: el.getAttribute("title"),
        type: el.getAttribute("type"),
        placeholder: el.getAttribute("placeholder"),
        testId: el.getAttribute("data-testid") || el.getAttribute("data-test-id"),
        text: textOf(el),
        rect: rectOf(el),
        styles: out,
      };
    }
    function visibleEnough(el) {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    }
    const selectorStyles = {};
    for (const selector of selectors) {
      let nodes = [];
      try {
        nodes = Array.from(document.querySelectorAll(selector));
      } catch {}
      selectorStyles[selector] = nodes.filter(visibleEnough).slice(0, 120).map(styleOf);
    }
    const variables = {};
    const rootStyle = getComputedStyle(document.documentElement);
    for (const name of Array.from(rootStyle)) {
      if (
        name.startsWith("--vscode-") ||
        name.startsWith("--monaco-") ||
        name.startsWith("--color-") ||
        name.startsWith("--height-") ||
        name.startsWith("--spacing-") ||
        name.startsWith("--font-") ||
        name.startsWith("--text-") ||
        name.startsWith("--radius-")
      ) variables[name] = rootStyle.getPropertyValue(name).trim();
    }
    const resourceEntries = performance.getEntriesByType("resource").map((entry) => ({
      name: entry.name,
      initiatorType: entry.initiatorType,
      transferSize: entry.transferSize,
      encodedBodySize: entry.encodedBodySize,
      decodedBodySize: entry.decodedBodySize,
      duration: entry.duration,
    }));
    const textMatches = [];
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const value = node.nodeValue.replace(/\\s+/g, " ").trim();
      if (!value) continue;
      if (/任务|随心输入|完全访问|目标|超高|Codex|正在|思考|编辑|会话|线程|Ask|Message|agent/i.test(value)) {
        const parent = node.parentElement;
        if (parent) textMatches.push({ text: value.slice(0, 500), parent: styleOf(parent) });
      }
      if (textMatches.length >= 200) break;
    }
    return {
      url: location.href,
      title: document.title,
      readyState: document.readyState,
      viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      bodyText: (document.body?.innerText || "").slice(0, 50000),
      selectorStyles,
      variables,
      linkedStylesheets: Array.from(document.querySelectorAll("link[rel~='stylesheet']")).map((el) => ({
        href: el.href,
        media: el.media,
        disabled: el.disabled,
      })),
      scripts: Array.from(document.scripts).map((el) => ({
        src: el.src,
        type: el.type,
        async: el.async,
        defer: el.defer,
      })),
      inlineStyles: Array.from(document.querySelectorAll("style")).map((el, index) => ({
        index,
        text: (el.textContent || "").slice(0, 500000),
      })),
      frames: Array.from(document.querySelectorAll("iframe, webview")).map(styleOf),
      textMatches,
      resourceEntries,
      html: document.documentElement.outerHTML,
    };
  })()`;
}

function topMetricsExpression() {
  return `(() => {
    function rect(selector) {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        left: r.left,
      };
    }
    return {
      url: location.href,
      title: document.title,
      viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
      sidebar: rect(".part.sidebar"),
      webview: rect("iframe.webview.ready"),
      editor: rect(".part.editor"),
      auxiliarybar: rect(".part.auxiliarybar"),
    };
  })()`;
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
    throw new Error(result.exceptionDetails.text || JSON.stringify(result.exceptionDetails));
  }
  return result.result?.value;
}

function flattenFrames(node, out = []) {
  if (!node) return out;
  if (node.frame) out.push(node.frame);
  for (const child of node.childFrames || []) flattenFrames(child, out);
  return out;
}

function pickTarget(target) {
  return {
    id: target.id,
    type: target.type,
    title: target.title,
    url: target.url,
    webSocketDebuggerUrl: target.webSocketDebuggerUrl,
  };
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
        pending.set(messageId, { method, resolve, reject });
      });
    },
    close() {
      socket.close();
    },
  };
}

function safeName(value) {
  return String(value || "frame")
    .replace(/^[a-z]+:\/\//i, "")
    .replace(/[\\/:*?"<>|#%{}$!`&'= @]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "capture";
}
