#!/usr/bin/env python3
"""Compare the local Codex Web workspace layout against the captured reference."""

from __future__ import annotations

import json
import math
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright


REPO_ROOT = Path(__file__).resolve().parents[1]
REFERENCE_CAPTURE = os.environ.get(
    "WORKSPACE_REFERENCE_CAPTURE",
    "20260702-184840-codex-session-list-wide-611",
)
REFERENCE_FILE = REPO_ROOT / "reference" / "windows-captures" / REFERENCE_CAPTURE / "top-runtime.json"
APP_URL = os.environ.get("PANEL_URL", "http://127.0.0.1:58888/?codexFixture=reference")
OUT_DIR = REPO_ROOT / "reference" / "codex-reference"
OUT_JSON = OUT_DIR / "workspace-layout-audit.json"
OUT_MD = OUT_DIR / "workspace-layout-audit.md"

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
# Layout fidelity is judged on the workspace chrome around it.
IGNORED_STYLE = {
    # Browser default body/html font can differ from the workbench font while the
    # actual workspace elements remain matched.
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
                const elements = Array.from(document.querySelectorAll(selector));
                return {
                    present: elements.length > 0,
                    count: elements.length,
                    classNames: elements.map((element) => String(element.className || "")),
                };
            }""",
            SIDEBAR_RESIZE_HANDLE_SELECTOR,
        )
        platform_rule = page.evaluate(
            """() => {
                const workbench = document.querySelector(".monaco-workbench");
                if (!workbench) return { present: false };
                const style = getComputedStyle(workbench);
                return {
                    present: true,
                    className: String(workbench.className || ""),
                    fontFamily: style.fontFamily,
                };
            }"""
        )
        browser.close()
    return {
        "rows": {name: [normalize_row(row) for row in values] for name, values in rows.items()},
        "localRules": {
            "sidebarResizeHandle": local_rules,
            "fixedWorkbenchPlatform": platform_rule,
            "platformSourceGuards": collect_platform_source_guards(),
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
    return [
        build_sidebar_resize_rule(local_rules.get("sidebarResizeHandle") or {}),
        build_fixed_workbench_platform_rule(local_rules.get("fixedWorkbenchPlatform") or {}),
        build_platform_source_guard_rule(local_rules.get("platformSourceGuards") or {}),
    ]


def build_sidebar_resize_rule(sash: dict) -> dict:
    differences = []
    if sash.get("present"):
        differences.append({"property": "presence", "expected": "absent", "actual": f"present x{sash.get('count', 1)}"})
    return {
        "name": "noSidebarResizeHandle",
        "selector": SIDEBAR_RESIZE_HANDLE_SELECTOR,
        "status": "exact" if not differences else "different",
        "differences": differences,
        "current": sash,
    }


def build_fixed_workbench_platform_rule(platform: dict) -> dict:
    differences = []
    class_name = normalize_style_value(platform.get("className", ""))
    font_family = normalize_style_value(platform.get("fontFamily", ""))
    if not platform.get("present"):
        differences.append({"property": "presence", "expected": "present", "actual": "missing"})
    else:
        class_tokens = set(class_name.split())
        for token in ("web", "windows"):
            if token not in class_tokens:
                differences.append({"property": "className", "expected": f"contains {token}", "actual": class_name})
        for token in ("linux", "mac"):
            if token in class_tokens:
                differences.append({"property": "className", "expected": f"does not contain {token}", "actual": class_name})
        expected_font = '"Segoe WPC", "Segoe UI", sans-serif'
        if font_family != expected_font:
            differences.append({"property": "fontFamily", "expected": expected_font, "actual": font_family})
    return {
        "name": "fixedWorkbenchPlatform",
        "selector": ".monaco-workbench",
        "status": "exact" if not differences else "different",
        "differences": differences,
        "current": platform,
    }


def build_platform_source_guard_rule(source_guards: dict) -> dict:
    differences = [
        {"property": item["file"], "expected": f"no {item['token']}", "actual": f"line {item['line']}: {item['text']}"}
        for item in source_guards.get("forbiddenHits", [])
    ]
    return {
        "name": "platformSourceGuards",
        "selector": "frontend source",
        "status": "exact" if not differences else "different",
        "differences": differences,
        "current": source_guards,
    }


def collect_platform_source_guards() -> dict:
    forbidden = {
        Path("frontend/src/app/bootstrap.js"): [
            "navigator.platform",
            "userAgentData?.platform",
            "isWindows",
            "isMac",
            "isLinux",
        ],
        Path("frontend/src/app/layout.css"): [
            ".monaco-workbench.mac.web",
            ".monaco-workbench.linux.web",
            "Ubuntu",
            "Droid Sans",
            "PingFang SC",
            "Source Han Sans",
        ],
    }
    hits = []
    for relative_path, tokens in forbidden.items():
        path = REPO_ROOT / relative_path
        if not path.exists():
            hits.append({"file": str(relative_path), "line": 0, "token": "file", "text": "missing"})
            continue
        for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            for token in tokens:
                if token in line:
                    hits.append({
                        "file": str(relative_path).replace("\\", "/"),
                        "line": line_number,
                        "token": token,
                        "text": line.strip(),
                    })
    return {"forbiddenHits": hits}


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
        "# Codex Web Workspace Layout Audit",
        "",
        f"Generated: {audit['generatedAt']}",
        "",
        "Compares current Codex Web workspace geometry/computed styles against the captured workspace reference.",
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
    lines.append("- Any actionable difference here means the Codex Web workspace layout is not fully aligned unless explicitly documented as a required local adapter.")
    return "\n".join(lines) + "\n"


def iso_now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


if __name__ == "__main__":
    sys.exit(main())
