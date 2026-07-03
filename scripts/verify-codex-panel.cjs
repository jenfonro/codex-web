#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const playwright = require("playwright");

const APP_URL = process.env.PANEL_URL || "http://127.0.0.1:58888/";
const SIDEBAR_WIDTH = Number(process.env.SIDEBAR_WIDTH || 611);
const VIEWPORT = {
  width: Number(process.env.VIEWPORT_WIDTH || 1920),
  height: Number(process.env.VIEWPORT_HEIGHT || 1080),
};

const repoRoot = path.resolve(__dirname, "..");
const outRoot = path.resolve(process.env.CAPTURE_DIR || path.join(repoRoot, "reference", "windows-captures"));
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
const outDir = path.join(outRoot, `${stamp}-local-codex-panel-shadow`);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  await page.addInitScript((width) => {
    window.localStorage.setItem("codex-web:sidebar-width", String(width));
  }, SIDEBAR_WIDTH);

  try {
    await page.goto(APP_URL, { waitUntil: "networkidle" });
    await waitForPanel(page, "list");
    await page.screenshot({ path: path.join(outDir, "list-full.png"), fullPage: true });
    await screenshotPanel(page, "list-panel.png");
    const listMetrics = await collectMetrics(page);

    await page.evaluate(() => {
      document.querySelector("#codexPanel")?.shadowRoot?.querySelector("[data-codex-session-id]")?.click();
    });
    await waitForPanel(page, "thread");
    await page.screenshot({ path: path.join(outDir, "thread-full.png"), fullPage: true });
    await screenshotPanel(page, "thread-panel.png");
    const threadMetrics = await collectMetrics(page);

    await page.evaluate(() => {
      document.querySelector("#codexPanel")?.shadowRoot?.querySelector("[data-popover='plus']")?.click();
    });
    await waitForShadowSelector(page, "[data-composer-overlay-floating-ui]");
    await screenshotPanel(page, "thread-plus-panel.png");
    const plusMetrics = await collectMetrics(page);

    await page.evaluate(() => {
      const root = document.querySelector("#codexPanel")?.shadowRoot;
      root?.querySelector("[data-popover='plus']")?.click();
      root?.querySelector("[data-popover='approval']")?.click();
    });
    await waitForShadowSelector(page, "[data-radix-menu-content]");
    await screenshotPanel(page, "thread-approval-panel.png");
    const approvalMetrics = await collectMetrics(page);

    await page.evaluate(() => {
      const root = document.querySelector("#codexPanel")?.shadowRoot;
      root?.querySelector("[data-popover='approval']")?.click();
      root?.querySelector("[data-popover='model']")?.click();
    });
    await waitForShadowSelector(page, "[data-radix-menu-content]");
    await screenshotPanel(page, "thread-model-panel.png");
    const modelMetrics = await collectMetrics(page);

    const summary = {
      appUrl: APP_URL,
      viewport: VIEWPORT,
      sidebarWidth: SIDEBAR_WIDTH,
      captures: {
        list: "list-panel.png",
        thread: "thread-panel.png",
        plus: "thread-plus-panel.png",
        approval: "thread-approval-panel.png",
        model: "thread-model-panel.png",
      },
      metrics: {
        list: listMetrics,
        thread: threadMetrics,
        plus: plusMetrics,
        approval: approvalMetrics,
        model: modelMetrics,
      },
    };
    fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
    console.log(outDir);
  } finally {
    await browser.close();
  }
}

async function launchBrowser() {
  try {
    return await playwright.chromium.launch({ channel: "chrome", headless: true });
  } catch {
    return playwright.chromium.launch({
      executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      headless: true,
    });
  }
}

async function waitForPanel(page, view) {
  await waitForShadowSelector(page, `[data-codex-view='${view}']`);
}

async function waitForShadowSelector(page, selector) {
  await page.waitForFunction((shadowSelector) => {
    const root = document.querySelector("#codexPanel")?.shadowRoot;
    const element = root?.querySelector(shadowSelector);
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  }, selector, { timeout: 10000 });
}

async function screenshotPanel(page, fileName) {
  const panel = page.locator("#codexPanel");
  await panel.screenshot({ path: path.join(outDir, fileName) });
}

async function collectMetrics(page) {
  return page.evaluate(() => {
    const shadow = document.querySelector("#codexPanel")?.shadowRoot;
    if (!shadow) return { error: "missing shadow root" };
    const pick = (selector) => {
      const element = shadow.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        selector,
        className: element.className,
        text: (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 160),
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
        styles: {
          display: style.display,
          position: style.position,
          padding: style.padding,
          margin: style.margin,
          gap: style.gap,
          color: style.color,
          backgroundColor: style.backgroundColor,
          border: style.border,
          borderRadius: style.borderRadius,
          boxShadow: style.boxShadow,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
          opacity: style.opacity,
          overflow: style.overflow,
        },
      };
    };
    return {
      shadowLinks: shadow.querySelectorAll("link[rel='stylesheet']").length,
      view: shadow.querySelector("[data-codex-panel-root]")?.getAttribute("data-codex-view") || "",
      root: pick("[data-codex-panel-root]"),
      sessionRow: pick("[data-codex-session-id]"),
      userBubble: pick("[data-user-message-bubble]"),
      markdown: pick("._markdownContent_lzkx4_60"),
      activity: pick(".group\\/activity-header"),
      composer: pick(".composer-surface-chrome"),
      composerFooter: pick("._footer_1u8sk_2"),
      externalFooter: pick("._footer_z984f_2"),
      menu: pick("[data-radix-menu-content]"),
      plus: pick("[data-composer-overlay-floating-ui]"),
    };
  });
}
