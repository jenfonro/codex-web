#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function loadPlaywright() {
  try {
    return require("playwright");
  } catch (_) {
    return require("/tmp/pw-code-tx/node_modules/playwright");
  }
}

const { chromium } = loadPlaywright();

const repoRoot = path.resolve(__dirname, "..");
const baseURL = process.env.CODEX_WEB_BASE_URL || "http://127.0.0.1:58888";
const outDir = path.join(repoRoot, "build");
const logPath = path.join(outDir, "codex-web.log");

function readPassword() {
  const configured = String(process.env.CODEX_WEB_PASSWORD || "").trim();
  if (configured) return configured;
  const passwordFile = path.join(outDir, "data", "password.txt");
  if (!fs.existsSync(passwordFile)) {
    throw new Error(`CODEX_WEB_PASSWORD is not set and password file is missing: ${passwordFile}`);
  }
  const password = fs.readFileSync(passwordFile, "utf8").trim();
  if (!password) throw new Error(`password file is empty: ${passwordFile}`);
  return password;
}

function logSize() {
  try {
    return fs.statSync(logPath).size;
  } catch (_) {
    return 0;
  }
}

function logTailFrom(offset) {
  if (!fs.existsSync(logPath)) return "";
  const fd = fs.openSync(logPath, "r");
  try {
    const size = fs.fstatSync(fd).size;
    const start = Math.min(offset, size);
    const buffer = Buffer.alloc(size - start);
    fs.readSync(fd, buffer, 0, buffer.length, start);
    return buffer.toString("utf8");
  } finally {
    fs.closeSync(fd);
  }
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const beforeLogSize = logSize();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  try {
    await page.goto(baseURL, { waitUntil: "domcontentloaded" });
    if (page.url().includes("/login.html")) {
      await page.locator("input[type='password']").fill(readPassword());
      await page.locator("button[type='submit']").click();
      await page.waitForURL((url) => !url.pathname.endsWith("/login.html"), { timeout: 15000 });
    }

    await page.waitForFunction(() => document.body && document.body.innerText.trim().length > 0, { timeout: 30000 });
    await page.waitForTimeout(4000);

    const report = await page.evaluate(() => {
      const text = document.body.innerText;
      const html = document.documentElement;
      const body = document.body;
      const officialWindowType =
        body?.dataset?.codexWindowType ||
        html?.dataset?.codexWindowType ||
        document.querySelector("[data-codex-window-type]")?.getAttribute("data-codex-window-type") ||
        null;
      return {
        url: location.href,
        title: document.title,
        officialWindowType,
        hasVsCodeDarkClass: html.classList.contains("vscode-dark") || body.classList.contains("vscode-dark"),
        hasOfficialRoot: officialWindowType === "extension" || Boolean(document.querySelector("[data-codex-window-type='extension']")),
        hasOfficialAssets: [...document.scripts].some((script) => /assets\/index-|assets\/app-main-|assets\/app-preloader-/.test(script.src)),
        hasChineseText: /新建|会话|设置|权限|模型|登录|打开/.test(text),
        hasIdeContextText: /IDE 上下文|包含 IDE 背景信息/.test(text),
        hasOldFixtureRoute: location.search.includes("fixture=thread-states"),
        hasOldCustomSessionDom: Boolean(document.querySelector(".session-list, .session-row-shell, [data-session-runtime-state]")),
        bodyTextSample: text.replace(/\s+/g, " ").slice(0, 500),
      };
    });

    const screenshotPath = path.join(outDir, "codex-web-official-webview.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    report.screenshot = screenshotPath;

    const addContextButton = page
      .locator(
        [
          "button[aria-label='添加文件等']",
          "button[aria-label='添加照片等内容']",
          "button[aria-label='添加照片、远程文件等']",
          "button[aria-label='Add files and more']",
          "button[aria-label='Add photos and more']",
          "button[aria-label='Add photos, remote files, and more']",
          "button[aria-label*='添加'][aria-label*='等']",
          "button[aria-label*='Add'][aria-label*='more']",
        ].join(", "),
      )
      .last();
    await addContextButton.waitFor({ state: "visible", timeout: 15000 });
    report.addContextButtonAriaLabel = await addContextButton.getAttribute("aria-label");
    await addContextButton.click();
    await page.waitForTimeout(500);

    const plusMenuReport = await page.evaluate(() => {
      const text = document.body.innerText.replace(/\s+/g, " ");
      return {
        hasAddPhotosAndFiles: /添加照片和文件|Add photos & files/.test(text),
        hasPlanMode: /计划模式|Plan mode/.test(text),
        hasGoalMode: /追求目标|Pursue goal/.test(text),
        hasIdeContextText: /IDE 上下文|包含 IDE 背景信息|Include IDE context/.test(text),
        textSample: text.slice(0, 700),
      };
    });
    report.plusMenu = plusMenuReport;

    const plusMenuScreenshotPath = path.join(outDir, "codex-web-official-plus-menu.png");
    await page.screenshot({ path: plusMenuScreenshotPath, fullPage: true });
    report.plusMenu.screenshot = plusMenuScreenshotPath;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);

    const historyRows = page.locator("div[role='button']").filter({
      hasText: /天|周|小时|分钟|昨天|今天/,
    });
    report.threadPage = {
      historyRowCount: await historyRows.count(),
    };

    if (report.threadPage.historyRowCount > 0) {
      const firstHistoryRow = historyRows.first();
      report.threadPage.firstRowText = (await firstHistoryRow.innerText()).replace(/\s+/g, " ").trim();
      await firstHistoryRow.click();
      await page.waitForTimeout(4000);

      const threadPageReport = await page.evaluate(() => {
        const text = document.body.innerText.replace(/\s+/g, " ");
        const controlText = [...document.querySelectorAll("button,[role='button'],a")]
          .map((element) => `${element.getAttribute("aria-label") || ""} ${element.innerText || element.textContent || ""}`)
          .join(" ")
          .replace(/\s+/g, " ");
        const placeholderText = [...document.querySelectorAll("[data-placeholder],[aria-placeholder],textarea,input")]
          .map((element) => element.getAttribute("data-placeholder") || element.getAttribute("aria-placeholder") || element.getAttribute("placeholder") || "")
          .join(" ");
        return {
          url: location.href,
          hasOfficialThreadComposer: /默认权限|完全访问权限/.test(text) && /本地模式|Local mode/.test(text),
          hasFollowUpPlaceholder: /要求后续变更|Ask for follow-up|Message Codex|Send a message/.test(placeholderText),
          hasOldAppendControl: /追加到当前会话|Append to current/.test(controlText),
          hasOldCustomSessionDom: Boolean(document.querySelector(".session-list, .session-row-shell, [data-session-runtime-state]")),
          textSample: text.slice(0, 700),
        };
      });
      Object.assign(report.threadPage, threadPageReport);

      const threadScreenshotPath = path.join(outDir, "codex-web-official-thread.png");
      await page.screenshot({ path: threadScreenshotPath, fullPage: true });
      report.threadPage.screenshot = threadScreenshotPath;
    }

    report.consoleErrors = consoleErrors.slice(0, 20);
    report.newUnhandledBridgeMessages = logTailFrom(beforeLogSize)
      .split("\n")
      .filter((line) => /unhandled Codex webview bridge/.test(line));

    const failures = [];
    if (!report.hasOfficialAssets) failures.push("official Codex webview assets were not loaded");
    if (!report.hasOfficialRoot) failures.push("official extension window type was not detected");
    if (!report.hasVsCodeDarkClass) failures.push("VS Code dark theme class was not applied");
    if (!report.hasChineseText) failures.push("Chinese UI text was not detected");
    if (report.hasIdeContextText) failures.push("standalone mode is still showing IDE context controls");
    if (!report.plusMenu.hasAddPhotosAndFiles) failures.push("add-context menu did not show the official photos/files item");
    if (!report.plusMenu.hasPlanMode) failures.push("add-context menu did not show the official plan-mode item");
    if (!report.plusMenu.hasGoalMode) failures.push("add-context menu did not show the official goal item");
    if (report.plusMenu.hasIdeContextText) failures.push("add-context menu still shows IDE context controls");
    if (report.threadPage.historyRowCount === 0) failures.push("no local history rows were available to verify thread rendering");
    if (report.threadPage.historyRowCount > 0 && !report.threadPage.hasOfficialThreadComposer) {
      failures.push("opened history thread did not show the official thread composer controls");
    }
    if (report.threadPage.historyRowCount > 0 && !report.threadPage.hasFollowUpPlaceholder) {
      failures.push("opened history thread did not show the official follow-up placeholder");
    }
    if (report.threadPage.hasOldAppendControl) failures.push("opened history thread still shows an old append control");
    if (report.threadPage.hasOldCustomSessionDom) failures.push("opened history thread still has old custom session-list DOM");
    if (report.hasOldFixtureRoute) failures.push("old fixture route is still active");
    if (report.hasOldCustomSessionDom) failures.push("old custom session-list DOM is still present");
    if (report.newUnhandledBridgeMessages.length > 0) {
      failures.push(`new unhandled bridge messages: ${report.newUnhandledBridgeMessages.join(" | ")}`);
    }

    report.ok = failures.length === 0;
    report.failures = failures;
    fs.writeFileSync(path.join(outDir, "codex-web-official-report.json"), JSON.stringify(report, null, 2));

    if (!report.ok) {
      throw new Error(`official webview verification failed: ${failures.join("; ")}`);
    }

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
