#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const outDir = path.resolve(process.env.CODEX_WORKSPACE_REFERENCE_DIR || path.join(repoRoot, "reference", "workspace-reference"));
const assetsDir = path.join(outDir, "assets");
const domDir = path.join(outDir, "dom");
const networkDir = path.join(outDir, "network");
const screenshotsDir = path.join(outDir, "screenshots");
const stylesDir = path.join(outDir, "styles");
const baseURL = process.env.CODE_SERVER_URL || "https://code-tx.zelt.cn/?folder=/root";
const password = process.env.CODE_SERVER_PASSWORD || readPassword();
const playwright = requirePlaywright();

const VIEWPORT = { width: 1920, height: 1080 };
const RESOURCE_TYPES = new Set([
  "document",
  "stylesheet",
  "script",
  "font",
  "image",
  "media",
  "websocket",
  "manifest",
  "other",
]);

(async () => {
  resetDir(outDir);
  for (const dir of [assetsDir, domDir, networkDir, screenshotsDir, stylesDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const savedResources = [];
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
    recordHar: {
      path: path.join(networkDir, "workspace.har"),
      content: "embed",
      mode: "full",
    },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(90000);

  page.on("response", async (response) => {
    const request = response.request();
    const resourceType = request.resourceType();
    if (!RESOURCE_TYPES.has(resourceType)) return;
    const url = response.url();
    if (!/^https?:/i.test(url)) return;
    try {
      const body = await response.body();
      if (!body || body.length === 0) return;
      const contentType = response.headers()["content-type"] || "";
      const fileName = resourceFileName(url, contentType, resourceType);
      const filePath = path.join(assetsDir, fileName);
      fs.writeFileSync(filePath, body);
      savedResources.push({
        url,
        status: response.status(),
        resourceType,
        contentType,
        file: path.relative(outDir, filePath),
        size: body.length,
      });
    } catch {
      // Some streaming responses cannot be buffered. HAR still records them.
    }
  });

  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await loginIfNeeded(page);
  await page.waitForLoadState("networkidle", { timeout: 90000 }).catch(() => {});
  await page.waitForSelector(".monaco-workbench, .part.activitybar, body", { timeout: 90000 });
  await page.waitForTimeout(8000);
  await page.keyboard.press("Escape").catch(() => {});
  await closeAuxiliaryBar(page);
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: path.join(screenshotsDir, "workspace-1920x1080.png"),
    fullPage: false,
  });

  const capture = await page.evaluate(() => {
    const selectors = [
      "html",
      "body",
      ".monaco-workbench",
      ".part.titlebar",
      ".part.activitybar",
      ".part.sidebar",
      ".part.editor",
      ".part.auxiliarybar",
      ".part.panel",
      ".part.statusbar",
      ".menubar-menu-button",
      ".activitybar .action-item",
      ".activitybar .action-label",
      ".sidebar .composite.title",
      ".sidebar .content",
      ".editor .content",
      ".editor .tabs-container",
      ".editor .editor-group-container",
      ".statusbar .items-container",
    ];
    const props = [
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
      "gap",
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
      "whiteSpace",
      "textOverflow",
      "alignItems",
      "justifyContent",
      "flexDirection",
      "zIndex",
    ];

    function visible(el) {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    }

    function styleOf(el) {
      const style = getComputedStyle(el);
      const out = {};
      for (const prop of props) out[prop] = style[prop];
      out.rect = el.getBoundingClientRect().toJSON();
      out.tagName = el.tagName;
      out.id = el.id;
      out.className = String(el.className || "");
      out.role = el.getAttribute("role");
      out.ariaLabel = el.getAttribute("aria-label");
      out.title = el.getAttribute("title");
      out.text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 1000);
      return out;
    }

    const selectorStyles = {};
    for (const selector of selectors) {
      selectorStyles[selector] = Array.from(document.querySelectorAll(selector))
        .filter(visible)
        .slice(0, 80)
        .map(styleOf);
    }

    const variables = {};
    const rootStyle = getComputedStyle(document.documentElement);
    for (const name of Array.from(rootStyle)) {
      if (name.startsWith("--vscode-") || name.startsWith("--monaco-")) {
        variables[name] = rootStyle.getPropertyValue(name).trim();
      }
    }

    const linkedStylesheets = Array.from(document.querySelectorAll("link[rel~='stylesheet']")).map((el) => ({
      href: el.href,
      media: el.media,
      disabled: el.disabled,
    }));
    const scripts = Array.from(document.scripts).map((el) => ({
      src: el.src,
      type: el.type,
      async: el.async,
      defer: el.defer,
    }));
    const inlineStyles = Array.from(document.querySelectorAll("style")).map((el, index) => ({
      index,
      text: el.textContent || "",
    }));

    return {
      url: location.href,
      title: document.title,
      viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
      bodyText: (document.body.innerText || "").slice(0, 20000),
      selectorStyles,
      variables,
      linkedStylesheets,
      scripts,
      inlineStyles,
      frames: Array.from(document.querySelectorAll("iframe, webview")).map(styleOf),
      html: document.documentElement.outerHTML,
    };
  });

  fs.writeFileSync(path.join(domDir, "document.html"), capture.html);
  delete capture.html;
  fs.writeFileSync(path.join(domDir, "document.json"), `${JSON.stringify(capture, null, 2)}\n`);
  fs.writeFileSync(path.join(stylesDir, "computed-styles.json"), `${JSON.stringify(capture.selectorStyles, null, 2)}\n`);
  fs.writeFileSync(path.join(stylesDir, "css-variables.json"), `${JSON.stringify(capture.variables, null, 2)}\n`);
  fs.writeFileSync(path.join(networkDir, "resources.json"), `${JSON.stringify(savedResources, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, "capture-summary.json"), `${JSON.stringify({
    url: capture.url,
    title: capture.title,
    viewport: capture.viewport,
    auxiliarybarVisible: Array.isArray(capture.selectorStyles[".part.auxiliarybar"]) && capture.selectorStyles[".part.auxiliarybar"].length > 0,
    assetCount: savedResources.length,
    capturedAt: new Date().toISOString(),
  }, null, 2)}\n`);

  await context.close();
  await browser.close();
  console.log(`wrote workspace reference to ${outDir}`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

function readPassword() {
  const config = fs.readFileSync("/root/.config/code-server/config.yaml", "utf8");
  const match = config.match(/^password:\s*(.+)$/m);
  if (!match) throw new Error("missing code-server password");
  return match[1].trim();
}

async function loginIfNeeded(page) {
  const passwordInput = page.locator("input[type='password'], input[name='password']").first();
  if (await passwordInput.count()) {
    await passwordInput.fill(password);
    await Promise.all([
      page.waitForURL((url) => !/login/i.test(url.pathname), { timeout: 90000 }).catch(() => {}),
      page.locator("button[type='submit'], input[type='submit']").first().click(),
    ]);
  }
}

async function closeAuxiliaryBar(page) {
  if (!(await auxiliaryBarVisible(page))) return;

  const closeSelectors = [
    ".part.auxiliarybar .title-actions .action-label.codicon-close",
    ".part.auxiliarybar [aria-label*='关闭']",
    ".part.auxiliarybar [aria-label*='隐藏']",
    ".part.auxiliarybar [aria-label*='Close']",
    ".part.auxiliarybar [aria-label*='Hide']",
    ".part.auxiliarybar [title*='关闭']",
    ".part.auxiliarybar [title*='隐藏']",
    ".part.auxiliarybar [title*='Close']",
    ".part.auxiliarybar [title*='Hide']",
  ];

  for (const selector of closeSelectors) {
    const candidate = page.locator(selector).first();
    if (!(await candidate.count())) continue;
    try {
      await candidate.click({ timeout: 1500 });
      await page.waitForTimeout(600);
      if (!(await auxiliaryBarVisible(page))) return;
    } catch {
      // Keep trying other visible close affordances.
    }
  }

  await page.keyboard.press("Control+Alt+B").catch(() => {});
  await page.waitForTimeout(800);
  if (await auxiliaryBarVisible(page)) {
    throw new Error("right auxiliary/chat sidebar is still visible after close attempts");
  }
}

async function auxiliaryBarVisible(page) {
  return page.evaluate(() => {
    const auxiliary = document.querySelector(".part.auxiliarybar");
    if (!auxiliary) return false;
    const rect = auxiliary.getBoundingClientRect();
    const style = getComputedStyle(auxiliary);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  });
}

function resetDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function resourceFileName(url, contentType, resourceType) {
  const parsed = new URL(url);
  const baseName = path.basename(parsed.pathname) || resourceType || "resource";
  const cleanBase = baseName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 90) || "resource";
  const hash = crypto.createHash("sha1").update(url).digest("hex").slice(0, 12);
  const ext = path.extname(cleanBase) || extensionFor(contentType, resourceType);
  const stem = ext ? cleanBase.slice(0, -ext.length) || "resource" : cleanBase;
  return `${stem}.${hash}${ext}`;
}

function extensionFor(contentType, resourceType) {
  if (/text\/css/i.test(contentType)) return ".css";
  if (/javascript|ecmascript/i.test(contentType)) return ".js";
  if (/font\/woff2/i.test(contentType)) return ".woff2";
  if (/font\/woff/i.test(contentType)) return ".woff";
  if (/font\/ttf|application\/x-font-ttf/i.test(contentType)) return ".ttf";
  if (/image\/svg/i.test(contentType)) return ".svg";
  if (/image\/png/i.test(contentType)) return ".png";
  if (/image\/jpe?g/i.test(contentType)) return ".jpg";
  if (/application\/json/i.test(contentType)) return ".json";
  if (resourceType === "stylesheet") return ".css";
  if (resourceType === "script") return ".js";
  return ".bin";
}

function requirePlaywright() {
  try {
    return require("playwright");
  } catch {
    return require("/root/.npm/_npx/e41f203b7505f1fb/node_modules/playwright");
  }
}
