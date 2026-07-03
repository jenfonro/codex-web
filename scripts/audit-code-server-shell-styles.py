#!/usr/bin/env python3
"""Compare the local code-server shell against captured code-server styles."""

from __future__ import annotations

import json
import math
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright


REPO_ROOT = Path(__file__).resolve().parents[1]
REFERENCE_CAPTURE = os.environ.get(
    "SHELL_REFERENCE_CAPTURE",
    "20260702-184840-codex-session-list-wide-611",
)
REFERENCE_FILE = REPO_ROOT / "reference" / "windows-captures" / REFERENCE_CAPTURE / "top-runtime.json"
APP_URL = os.environ.get("PANEL_URL", "http://127.0.0.1:58888/?codexFixture=reference")
OUT_DIR = REPO_ROOT / "reference" / "codex-reference"
OUT_JSON = OUT_DIR / "shell-style-audit.json"
OUT_MD = OUT_DIR / "shell-style-audit.md"

VIEWPORT = {"width": 1904, "height": 985}
SIDEBAR_WIDTH = 611

SELECTORS = {
    "workbench": ".monaco-workbench",
    "titlebar": ".part.titlebar",
    "activitybar": ".part.activitybar",
    "sidebar": ".part.sidebar",
    "editor": ".part.editor",
    "sidebarTitle": ".sidebar .composite.title",
    "sidebarContent": ".sidebar .content",
    "activityItem": ".activitybar .action-item",
    "activityLabel": ".activitybar .action-label",
}

SIDEBAR_RESIZE_HANDLE_SELECTOR = ".sidebar-resize-handle"

STYLE_PROPS = [
    "display",
    "position",
    "boxSizing",
    "width",
    "height",
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
    "overflow",
    "overflowX",
    "overflowY",
    "zIndex",
]

RECT_PROPS = ["x", "y", "width", "height", "top", "right", "bottom", "left"]
GEOMETRY_TOLERANCE = 1.0

# The local controller intentionally uses a static editor welcome placeholder.
# Shell fidelity is judged on the workbench chrome around it.
IGNORED_STYLE = {
    # Browser default body/html font can differ from the workbench font while the
    # actual shell elements remain matched.
}


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    reference = load_reference()
    current = collect_current()
    audit = build_audit(reference, current)
    OUT_JSON.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUT_MD.write_text(render_markdown(audit), encoding="utf-8")
    print(OUT_JSON)
    print(OUT_MD)
    return 1 if audit["summary"]["actionableDifferences"] else 0


def load_reference() -> dict:
    data = json.loads(REFERENCE_FILE.read_text(encoding="utf-8"))
    selector_styles = data["selectorStyles"]
    out = {}
    for name, selector in SELECTORS.items():
        rows = selector_styles.get(selector) or []
        out[name] = [normalize_row(row) for row in rows]
    return out


def collect_current() -> dict:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            channel="chrome",
            headless=True,
            args=["--disable-gpu", "--force-device-scale-factor=1"],
        )
        context = browser.new_context(viewport=VIEWPORT, device_scale_factor=1)
        context.add_init_script(
            f"""(() => {{
                localStorage.setItem("codex-web:sidebar-width", "{SIDEBAR_WIDTH}");
                document.documentElement.style.setProperty("--cw-sidebar-width", "{SIDEBAR_WIDTH}px");
            }})()"""
        )
        page = context.new_page()
        page.goto(APP_URL, wait_until="load", timeout=15000)
        page.wait_for_timeout(800)
        rows = page.evaluate(
            """([selectors, props]) => {
                const out = {};
                for (const [name, selector] of Object.entries(selectors)) {
                    out[name] = Array.from(document.querySelectorAll(selector)).map((el) => {
                        const rect = el.getBoundingClientRect();
                        const style = getComputedStyle(el);
                        const styles = {};
                        for (const prop of props) styles[prop] = style[prop];
                        return {
                            tagName: el.tagName,
                            id: el.id || "",
                            className: String(el.className || ""),
                            text: (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 160),
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
                    });
                }
                return out;
            }""",
            [SELECTORS, STYLE_PROPS],
        )
        local_rules = page.evaluate(
            """(selector) => {
                const element = document.querySelector(selector);
                if (!element) return { present: false };
                const base = getComputedStyle(element);
                const baseBefore = getComputedStyle(element, "::before");
                return {
                    present: true,
                    baseBackgroundColor: base.backgroundColor,
                    baseBeforeBackgroundColor: baseBefore.backgroundColor,
                };
            }""",
            SIDEBAR_RESIZE_HANDLE_SELECTOR,
        )
        if local_rules.get("present"):
            page.evaluate(
                """(selector) => {
                    document.querySelector(selector)?.classList.add("resizing");
                }""",
                SIDEBAR_RESIZE_HANDLE_SELECTOR,
            )
            page.wait_for_timeout(150)
            resizing_before_background = page.evaluate(
                """(selector) => {
                    const element = document.querySelector(selector);
                    return element ? getComputedStyle(element, "::before").backgroundColor : "";
                }""",
                SIDEBAR_RESIZE_HANDLE_SELECTOR,
            )
            page.evaluate(
                """(selector) => {
                    document.querySelector(selector)?.classList.remove("resizing");
                }""",
                SIDEBAR_RESIZE_HANDLE_SELECTOR,
            )
            local_rules["resizingBeforeBackgroundColor"] = resizing_before_background
        else:
            local_rules["resizingBeforeBackgroundColor"] = ""
        browser.close()
    return {
        "rows": {name: [normalize_row(row) for row in values] for name, values in rows.items()},
        "localRules": {
            "sidebarResizeHandle": local_rules,
        },
    }


def normalize_row(row: dict) -> dict:
    return {
        "tagName": row.get("tagName", ""),
        "id": row.get("id", ""),
        "className": row.get("className", ""),
        "text": row.get("text", ""),
        "rect": row.get("rect") or {},
        "styles": row.get("styles") or {},
    }


def build_audit(reference: dict, current_payload: dict) -> dict:
    current = current_payload.get("rows", {})
    local_rules = build_local_rule_rows(current_payload.get("localRules", {}))
    rows = []
    actionable = 0
    missing = 0
    for name, selector in SELECTORS.items():
        ref_rows = reference.get(name, [])
        cur_rows = current.get(name, [])
        max_count = max(len(ref_rows), len(cur_rows))
        for index in range(max_count):
            ref = ref_rows[index] if index < len(ref_rows) else None
            cur = cur_rows[index] if index < len(cur_rows) else None
            result = compare_row(name, selector, index, ref, cur)
            rows.append(result)
            actionable += len(result["differences"])
            if result["status"].startswith("missing"):
                missing += 1
    actionable += sum(len(row["differences"]) for row in local_rules)
    return {
        "generatedAt": iso_now(),
        "appUrl": APP_URL,
        "referenceCapture": REFERENCE_CAPTURE,
        "viewport": VIEWPORT,
        "sidebarWidth": SIDEBAR_WIDTH,
        "summary": {
            "trackedRows": len(rows),
            "actionableDifferences": actionable,
            "missingRows": missing,
        },
        "rows": rows,
        "localRules": local_rules,
    }


def build_local_rule_rows(local_rules: dict) -> list[dict]:
    sash = local_rules.get("sidebarResizeHandle") or {}
    differences = []
    if not sash.get("present"):
        differences.append({"property": "presence", "expected": "present", "actual": "missing"})
    else:
        transparent = "rgba(0, 0, 0, 0)"
        blue = "rgb(0, 105, 204)"
        checks = [
            ("baseBackgroundColor", transparent, sash.get("baseBackgroundColor")),
            ("baseBeforeBackgroundColor", transparent, sash.get("baseBeforeBackgroundColor")),
            ("resizingBeforeBackgroundColor", blue, sash.get("resizingBeforeBackgroundColor")),
        ]
        for prop, expected, actual in checks:
            if normalize_style_value(actual) != expected:
                differences.append({"property": prop, "expected": expected, "actual": normalize_style_value(actual)})
    return [
        {
            "name": "sidebarResizeHandle",
            "selector": SIDEBAR_RESIZE_HANDLE_SELECTOR,
            "status": "exact" if not differences else "different",
            "differences": differences,
            "current": sash,
        }
    ]


def compare_row(name: str, selector: str, index: int, ref: dict | None, cur: dict | None) -> dict:
    if ref is None and cur is None:
        return {"name": name, "selector": selector, "index": index, "status": "missing-reference-and-current", "differences": []}
    if ref is None:
        return {"name": name, "selector": selector, "index": index, "status": "missing-reference", "differences": []}
    if cur is None:
        return {"name": name, "selector": selector, "index": index, "status": "missing-current", "differences": [{"kind": "presence", "property": "row", "reference": "present", "current": "missing"}]}

    differences = []
    for prop in RECT_PROPS:
        left = number(ref["rect"].get(prop))
        right = number(cur["rect"].get(prop))
        if left is None or right is None:
            continue
        if math.fabs(left - right) > GEOMETRY_TOLERANCE:
            differences.append({"kind": "rect", "property": prop, "reference": round(left, 3), "current": round(right, 3)})

    for prop in STYLE_PROPS:
        key = (name, prop)
        if key in IGNORED_STYLE:
            continue
        left = normalize_style_value(ref["styles"].get(prop, ""))
        right = normalize_style_value(cur["styles"].get(prop, ""))
        if left != right:
            differences.append({"kind": "style", "property": prop, "reference": left, "current": right})

    return {
        "name": name,
        "selector": selector,
        "index": index,
        "status": "exact" if not differences else "different",
        "reference": {"className": ref["className"], "text": ref["text"], "rect": ref["rect"]},
        "current": {"className": cur["className"], "text": cur["text"], "rect": cur["rect"]},
        "differences": differences,
    }


def number(value) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def normalize_style_value(value) -> str:
    return " ".join(str(value or "").split())


def render_markdown(audit: dict) -> str:
    lines = [
        "# Code-Server Shell Style Audit",
        "",
        f"Generated: {audit['generatedAt']}",
        "",
        "Compares current Codex Web shell geometry/computed styles against captured code-server top-level runtime styles.",
        "",
        "## Summary",
        "",
        f"- Tracked rows: {audit['summary']['trackedRows']}",
        f"- Actionable differences: {audit['summary']['actionableDifferences']}",
        f"- Missing rows: {audit['summary']['missingRows']}",
        "",
        "| Selector | Index | Status | Differences |",
        "| --- | ---: | --- | --- |",
    ]
    for row in audit["rows"]:
        first = row["differences"][:5]
        detail = "<br>".join(
            f"{item['kind']} `{item['property']}`: `{item['reference']}` -> `{item['current']}`"
            for item in first
        )
        if len(row["differences"]) > len(first):
            detail += f"<br>... +{len(row['differences']) - len(first)} more"
        lines.append(f"| `{row['selector']}` | {row['index']} | `{row['status']}` | {detail} |")
    lines.extend([
        "",
        "## Local Interaction Rules",
        "",
        "| Rule | Selector | Status | Differences |",
        "| --- | --- | --- | --- |",
    ])
    for row in audit.get("localRules", []):
        detail = "<br>".join(
            f"`{item['property']}`: expected `{item['expected']}`, got `{item['actual']}`"
            for item in row["differences"]
        )
        lines.append(f"| `{row['name']}` | `{row['selector']}` | `{row['status']}` | {detail} |")
    lines.append("")
    lines.append("## Rule")
    lines.append("")
    lines.append("- Any actionable difference here means the code-server shell is not fully aligned unless explicitly documented as a required local adapter.")
    return "\n".join(lines) + "\n"


def iso_now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


if __name__ == "__main__":
    sys.exit(main())
