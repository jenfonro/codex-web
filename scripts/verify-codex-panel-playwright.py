#!/usr/bin/env python3
"""Capture Codex panel verification screenshots through Playwright/CDP."""

from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


CDP_URL = os.environ.get("CDP_URL", "http://127.0.0.1:9222")
APP_URL = os.environ.get("PANEL_URL", "http://127.0.0.1:58888/")
PLAYWRIGHT_LAUNCH = os.environ.get("PLAYWRIGHT_LAUNCH", "0") == "1"
SIDEBAR_WIDTH = int(os.environ["SIDEBAR_WIDTH"]) if os.environ.get("SIDEBAR_WIDTH") else None
VIEWPORT_WIDTH = int(os.environ.get("VIEWPORT_WIDTH", "1904"))
VIEWPORT_HEIGHT = int(os.environ.get("VIEWPORT_HEIGHT", "985"))
SESSION_INDEX = int(os.environ.get("SESSION_INDEX", "1"))
CAPTURE_SCREENSHOTS = os.environ.get("CAPTURE_SCREENSHOTS", "1") != "0"
SCREENSHOT_TIMEOUT_MS = int(os.environ.get("SCREENSHOT_TIMEOUT_MS", "60000"))

REPO_ROOT = Path(__file__).resolve().parents[1]
REFERENCE_FILE = REPO_ROOT / "reference" / "codex-reference" / "codex-reference.json"
OUT_ROOT = Path(os.environ.get("CAPTURE_DIR", REPO_ROOT / "reference" / "windows-captures")).resolve()
STAMP = datetime.now().strftime("%Y%m%d-%H%M%S")
OUT_DIR = OUT_ROOT / f"{STAMP}-local-codex-panel-playwright"

STYLE_PROPS = [
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
    "margin",
    "gap",
    "color",
    "backgroundColor",
    "border",
    "borderRadius",
    "boxShadow",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "lineHeight",
    "opacity",
    "overflow",
    "overflowX",
    "overflowY",
    "whiteSpace",
    "textAlign",
    "alignItems",
    "justifyContent",
    "flexDirection",
    "gridTemplateColumns",
    "transform",
    "zIndex",
    "cursor",
]

METRIC_SELECTORS = {
    "panelRoot": "[data-codex-panel-root]",
    "header": ".draggable.extension\\:px-panel",
    "sessionRow": "[data-codex-session-id]",
    "sessionTitle": "[data-thread-title='true']",
    "threadConversation": "[data-thread-find-target='conversation']",
    "userBubble": "[data-user-message-bubble]",
    "markdown": "._markdownContent_lzkx4_60",
    "assistantActions": "[data-assistant-message-sent-time='true']",
    "activity": "[class~='group/activity-header']",
    "summary": ".text-size-chat.text-token-text-secondary button[aria-expanded='false']",
    "composer": ".composer-surface-chrome",
    "composerFooter": "._footer_1u8sk_2",
    "externalFooter": "._footer_z984f_2",
    "plusMenu": "[data-composer-overlay-floating-ui]",
    "radixMenu": "[data-radix-menu-content]",
    "sendButton": "[data-action='send']",
}


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    reference = json.loads(REFERENCE_FILE.read_text(encoding="utf-8"))

    with sync_playwright() as playwright:
        browser, page = open_browser_page(playwright)
        page.set_viewport_size({"width": VIEWPORT_WIDTH, "height": VIEWPORT_HEIGHT})
        page.goto(APP_URL, wait_until="load", timeout=15000)
        wait_for_document_ready(page)

        list_sidebar_width = sidebar_width_for_view(reference, "list")
        menu_sidebar_width = sidebar_width_for_view(reference, "plusMenu")
        thread_sidebar_width = sidebar_width_for_view(reference, "thread")

        set_sidebar_width(page, list_sidebar_width)
        wait_for_shadow(page, "[data-codex-view='list']")
        page.wait_for_timeout(600)

        summary = {
            "appUrl": APP_URL,
            "cdp": None if PLAYWRIGHT_LAUNCH else CDP_URL,
            "tool": "playwright",
            "browserMode": "launch" if PLAYWRIGHT_LAUNCH else "connect-over-cdp",
            "viewport": {
                "width": VIEWPORT_WIDTH,
                "height": VIEWPORT_HEIGHT,
                "deviceScaleFactor": 1,
            },
            "sidebarWidth": SIDEBAR_WIDTH or "derived-per-reference-view",
            "sidebarWidths": {},
            "captures": {},
            "metrics": {},
        }

        capture_state(page, summary, "list", list_sidebar_width)

        set_sidebar_width(page, menu_sidebar_width)
        page.wait_for_timeout(200)
        click_shadow(page, "[data-popover='plus']")
        wait_for_shadow(page, "[data-composer-overlay-floating-ui]")
        page.wait_for_timeout(300)
        finish_shadow_animations(page)
        capture_state(page, summary, "plus", menu_sidebar_width)

        click_shadow(page, "[data-popover='plus']")
        page.wait_for_timeout(150)
        click_shadow(page, "[data-popover='approval']")
        wait_for_shadow(page, "[data-radix-menu-content]")
        page.wait_for_timeout(300)
        finish_shadow_animations(page)
        capture_state(page, summary, "approval", menu_sidebar_width)

        click_shadow(page, "[data-popover='approval']")
        page.wait_for_timeout(150)
        click_shadow(page, "[data-popover='model']")
        wait_for_shadow(page, "[data-radix-menu-content]")
        page.wait_for_timeout(300)
        finish_shadow_animations(page)
        capture_state(page, summary, "model", menu_sidebar_width)

        click_shadow(page, "[data-popover='model']")
        page.wait_for_timeout(150)
        set_sidebar_width(page, thread_sidebar_width)
        page.wait_for_timeout(200)
        click_shadow(page, "[data-codex-session-id]", SESSION_INDEX)
        wait_for_shadow(page, "[data-codex-view='thread']")
        page.wait_for_timeout(500)
        hover_shadow(page, "._markdownContent_lzkx4_60")
        page.wait_for_timeout(200)
        capture_state(page, summary, "thread", thread_sidebar_width)

        (OUT_DIR / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        (OUT_ROOT / "latest.txt").write_text(str(OUT_DIR), encoding="utf-8")
        print(OUT_DIR)

        missing = [
            name
            for name, capture in summary["captures"].items()
            if capture.get("panelError") or capture.get("fullError") or not capture.get("panel") or not capture.get("full")
        ]
        exit_code = 1 if missing else 0
        if PLAYWRIGHT_LAUNCH:
            browser.close()
        return exit_code


def open_browser_page(playwright):
    if PLAYWRIGHT_LAUNCH:
        browser = playwright.chromium.launch(
            channel="chrome",
            headless=True,
            args=[
                "--disable-gpu",
                "--disable-dev-shm-usage",
                "--force-device-scale-factor=1",
            ],
        )
        context = browser.new_context(
            viewport={"width": VIEWPORT_WIDTH, "height": VIEWPORT_HEIGHT},
            device_scale_factor=1,
        )
        return browser, context.new_page()

    browser = playwright.chromium.connect_over_cdp(CDP_URL)
    return browser, get_active_page(browser)


def get_active_page(browser):
    pages = [page for context in browser.contexts for page in context.pages]
    if not pages:
        context = browser.contexts[0] if browser.contexts else browser.new_context()
        return context.new_page()

    for page in pages:
        haystack = f"{page.url} {safe_title(page)}"
        if re.search(r"127\.0\.0\.1:58888|localhost:58888", haystack, re.IGNORECASE):
            return page
    return pages[0]


def safe_title(page) -> str:
    try:
        return page.title()
    except Exception:
        return ""


def sidebar_width_for_view(reference: dict, view: str) -> int:
    if SIDEBAR_WIDTH:
        return SIDEBAR_WIDTH
    try:
        root_entry = reference["selectorStyles"][view]["#root"]
        if isinstance(root_entry, list):
            root_entry = root_entry[0]
        root_width = float(root_entry["rect"]["width"])
    except (KeyError, TypeError, ValueError):
        return 611
    return int(root_width + 1)


def set_sidebar_width(page, width: int) -> None:
    page.evaluate(
        """width => {
            localStorage.setItem("codex-web:sidebar-width", String(width));
            document.documentElement.style.setProperty("--cw-sidebar-width", `${width}px`);
            window.dispatchEvent(new Event("resize"));
        }""",
        width,
    )


def capture_state(page, summary: dict, name: str, sidebar_width: int) -> None:
    full_name = f"{name}-full.png"
    panel_name = f"{name}-panel.png"
    capture = {"full": None, "panel": None}

    if CAPTURE_SCREENSHOTS:
        capture["panel"] = panel_name
        capture["full"] = full_name
        try:
            page.locator("#codexPanel").screenshot(
                path=str(OUT_DIR / panel_name),
                animations="disabled",
                timeout=SCREENSHOT_TIMEOUT_MS,
            )
        except PlaywrightTimeoutError as error:
            capture["panel"] = None
            capture["panelError"] = str(error)
        except Exception as error:
            capture["panel"] = None
            capture["panelError"] = str(error)

        try:
            page.screenshot(
                path=str(OUT_DIR / full_name),
                full_page=False,
                animations="disabled",
                timeout=SCREENSHOT_TIMEOUT_MS,
            )
        except PlaywrightTimeoutError as error:
            capture["full"] = None
            capture["fullError"] = str(error)
        except Exception as error:
            capture["full"] = None
            capture["fullError"] = str(error)

    summary["sidebarWidths"][name] = sidebar_width
    summary["captures"][name] = capture
    summary["metrics"][name] = collect_metrics(page)


def collect_metrics(page) -> dict:
    return page.evaluate(
        """([selectors, props]) => {
            const shadow = document.querySelector("#codexPanel")?.shadowRoot;
            const pick = (selector) => {
                const element = shadow?.querySelector(selector);
                if (!element) return null;
                const rect = element.getBoundingClientRect();
                const style = getComputedStyle(element);
                const styles = {};
                for (const prop of props) styles[prop] = style[prop];
                return {
                    selector,
                    tagName: element.tagName,
                    id: element.id || "",
                    className: String(element.className || ""),
                    ariaLabel: element.getAttribute("aria-label"),
                    text: (element.innerText || element.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 240),
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
                    styles,
                };
            };
            const panel = document.querySelector("#codexPanel")?.getBoundingClientRect();
            const out = {
                view: shadow?.querySelector("[data-codex-panel-root]")?.getAttribute("data-codex-view") || "",
                shadowLinks: shadow?.querySelectorAll("link[rel='stylesheet']").length || 0,
                panel: panel ? {
                    x: panel.x,
                    y: panel.y,
                    width: panel.width,
                    height: panel.height,
                    top: panel.top,
                    right: panel.right,
                    bottom: panel.bottom,
                    left: panel.left,
                } : null,
                nodes: {},
            };
            for (const [key, selector] of Object.entries(selectors)) out.nodes[key] = pick(selector);
            return out;
        }""",
        [METRIC_SELECTORS, STYLE_PROPS],
    )


def click_shadow(page, selector: str, index: int = 0) -> None:
    wait_for_shadow(page, selector)
    clicked = page.evaluate(
        """([selector, index]) => {
            const root = document.querySelector("#codexPanel")?.shadowRoot;
            const nodes = Array.from(root?.querySelectorAll(selector) || []);
            const el = nodes[index] || nodes[0];
            if (!el) return false;
            el.click();
            return true;
        }""",
        [selector, index],
    )
    if not clicked:
        raise RuntimeError(f"failed to click {selector}")


def hover_shadow(page, selector: str, index: int = 0) -> None:
    wait_for_shadow(page, selector)
    point = page.evaluate(
        """([selector, index]) => {
            const root = document.querySelector("#codexPanel")?.shadowRoot;
            const nodes = Array.from(root?.querySelectorAll(selector) || []);
            const el = nodes[index] || nodes[0];
            if (!el) return null;
            const rect = el.getBoundingClientRect();
            return {
                x: rect.left + Math.min(Math.max(rect.width / 2, 1), Math.max(rect.width - 1, 1)),
                y: rect.top + Math.min(Math.max(rect.height - 8, 1), Math.max(rect.height - 1, 1)),
            };
        }""",
        [selector, index],
    )
    if not point:
        raise RuntimeError(f"failed to hover {selector}")
    page.mouse.move(point["x"], point["y"])


def wait_for_shadow(page, selector: str, timeout: int = 10000) -> None:
    page.wait_for_function(
        """selector => {
            const root = document.querySelector("#codexPanel")?.shadowRoot;
            const el = root?.querySelector(selector);
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
        }""",
        arg=selector,
        timeout=timeout,
    )


def finish_shadow_animations(page) -> None:
    page.evaluate(
        """() => {
            const shadow = document.querySelector("#codexPanel")?.shadowRoot;
            const animations = [
                ...document.getAnimations({ subtree: true }),
                ...(shadow?.getAnimations({ subtree: true }) || []),
            ];
            for (const animation of animations) {
                try {
                    animation.finish();
                } catch {}
            }
        }"""
    )


def wait_for_document_ready(page) -> None:
    page.evaluate(
        """() => new Promise((resolve) => {
            if (document.readyState === "complete") {
                resolve(true);
                return;
            }
            addEventListener("load", () => resolve(true), { once: true });
            setTimeout(() => resolve(false), 8000);
        })"""
    )


if __name__ == "__main__":
    sys.exit(main())
