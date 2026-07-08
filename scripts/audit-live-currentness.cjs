const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const targetURL = process.env.TARGET_URL || "https://codex.zelt.cn/";
const outRoot = path.join(repoRoot, "reference", "live-currentness");

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

function parseAssetVersion(value) {
  const match = String(value || "").match(/[?&]v=([^&#]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function headerValue(headers, name) {
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers || {})) {
    if (key.toLowerCase() === lower) return value;
  }
  return "";
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
      const stat = fs.statSync(packageDir);
      found.push({ packageDir, mtimeMs: stat.mtimeMs });
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
  const runDir = path.join(outRoot, timestamp());
  fs.mkdirSync(runDir, { recursive: true });
  const screenshotPath = path.join(runDir, "target.png");
  const summaryPath = path.join(runDir, "summary.json");
  const latestPath = path.join(outRoot, "latest.txt");

  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    extraHTTPHeaders: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });
  const page = await context.newPage();
  const consoleEntries = [];
  const pageErrors = [];
  const responses = [];
  const failedHTTPResponses = [];

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleEntries.push({
        type: message.type(),
        text: message.text(),
        location: message.location(),
      });
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push({
      message: error.message,
      stack: error.stack || "",
    });
  });
  page.on("response", (response) => {
    const url = response.url();
    if (url === targetURL || /\/app\/codex-web\.(js|css)(?:\?|$)/.test(url)) {
      responses.push({
        url,
        status: response.status(),
        headers: response.headers(),
      });
    }
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
        initiator: event.initiator || null,
      });
    }
  });

  await page.goto(targetURL, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: screenshotPath, fullPage: false });

  const domEvidence = await page.evaluate(() => {
    const scripts = Array.from(document.scripts).map((node) => node.src).filter(Boolean);
    const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map((node) => node.href)
      .filter(Boolean);
    const root = document.querySelector("#codexWorkspaceRoot");
    const appIcon = document.querySelector(".window-appicon");
    const appIconStyle = appIcon ? getComputedStyle(appIcon) : null;
    const appIconRules = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let rules = [];
      try {
        rules = Array.from(sheet.cssRules || []);
      } catch (_) {
        continue;
      }
      for (const rule of rules) {
        if (!rule.selectorText || !rule.selectorText.includes("window-appicon")) continue;
        appIconRules.push({
          href: sheet.href || "",
          selectorText: rule.selectorText,
          cssText: rule.cssText,
        });
      }
    }
    const mediaCodeIconReferences = Array.from(document.querySelectorAll("*"))
      .map((node) => {
        const style = getComputedStyle(node);
        const values = {
          src: node.getAttribute("src") || "",
          href: node.getAttribute("href") || "",
          backgroundImage: style.backgroundImage || "",
          maskImage: style.maskImage || "",
          webkitMaskImage: style.webkitMaskImage || "",
        };
        const text = Object.values(values).join("\n");
        if (!text.includes("media/code-icon.svg")) return null;
        return {
          tagName: node.tagName,
          id: node.id || "",
          className: typeof node.className === "string" ? node.className : "",
          ariaLabel: node.getAttribute("aria-label") || "",
          values,
        };
      })
      .filter(Boolean);
    return {
      url: location.href,
      title: document.title,
      readyState: document.readyState,
      assetVersion: String(window.CODEX_WEB_ASSET_VERSION || ""),
      scripts,
      stylesheets,
      hasWorkspaceRoot: Boolean(root),
      workspaceTextSample: (root?.innerText || "").slice(0, 500),
      hasCodexPanel: Boolean(document.querySelector("#codexPanel")),
      hasThreadFooterSpacer: Boolean(document.querySelector("[data-thread-footer-spacer]")),
      bodyClass: document.body.className,
      windowAppIcon: appIconStyle && {
        className: appIcon.className,
        backgroundImage: appIconStyle.backgroundImage,
        width: appIconStyle.width,
        height: appIconStyle.height,
      },
      windowAppIconRules: appIconRules,
      mediaCodeIconReferences,
    };
  });

  const scriptURL = domEvidence.scripts.find((url) => /\/app\/codex-web\.js(?:\?|$)/.test(url)) || "";
  const cssURL = domEvidence.stylesheets.find((url) => /\/app\/codex-web\.css(?:\?|$)/.test(url)) || "";
  const scriptVersion = parseAssetVersion(scriptURL);
  const cssVersion = parseAssetVersion(cssURL);
  const htmlResponse = responses.find((item) => item.url === targetURL) || null;
  const jsResponse = responses.find((item) => /\/app\/codex-web\.js(?:\?|$)/.test(item.url)) || null;
  const cssResponse = responses.find((item) => /\/app\/codex-web\.css(?:\?|$)/.test(item.url)) || null;

  const summary = {
    targetURL,
    runDir,
    screenshotPath,
    dom: domEvidence,
    assets: {
      scriptURL,
      cssURL,
      scriptVersion,
      cssVersion,
      runtimeVersion: domEvidence.assetVersion,
      versionsMatch: Boolean(scriptVersion && cssVersion && scriptVersion === cssVersion && scriptVersion === domEvidence.assetVersion),
    },
    responses: {
      html: htmlResponse && {
        url: htmlResponse.url,
        status: htmlResponse.status,
        cacheControl: headerValue(htmlResponse.headers, "cache-control"),
        contentType: headerValue(htmlResponse.headers, "content-type"),
      },
      js: jsResponse && {
        url: jsResponse.url,
        status: jsResponse.status,
        cacheControl: headerValue(jsResponse.headers, "cache-control"),
        contentType: headerValue(jsResponse.headers, "content-type"),
      },
      css: cssResponse && {
        url: cssResponse.url,
        status: cssResponse.status,
        cacheControl: headerValue(cssResponse.headers, "cache-control"),
        contentType: headerValue(cssResponse.headers, "content-type"),
      },
    },
    consoleEntries,
    pageErrors,
    failedHTTPResponses,
  };

  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(latestPath, `${path.relative(outRoot, runDir).replace(/\\/g, "/")}\n`);
  await browser.close();

  const failures = [];
  if (!summary.assets.versionsMatch) failures.push("script/css/runtime asset versions do not match");
  if (!domEvidence.hasWorkspaceRoot) failures.push("workspace root is not mounted");
  if (pageErrors.length > 0) failures.push("page errors were emitted");
  if (failures.length > 0) {
    console.error(JSON.stringify({ summaryPath, failures }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({
    summaryPath,
    screenshotPath,
    scriptVersion,
    cssVersion,
    runtimeVersion: domEvidence.assetVersion,
    htmlCacheControl: summary.responses.html?.cacheControl || "",
    jsCacheControl: summary.responses.js?.cacheControl || "",
    cssCacheControl: summary.responses.css?.cacheControl || "",
    consoleWarningsOrErrors: consoleEntries.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
