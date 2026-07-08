#!/usr/bin/env python3
"""Smoke-test the controller-owned Runs sidebar view with mocked agent APIs."""

from __future__ import annotations

from datetime import datetime, timezone
import json
import os
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright


APP_URL = os.environ.get("PANEL_URL", "http://127.0.0.1:58888/")
VIEWPORT_WIDTH = int(os.environ.get("VIEWPORT_WIDTH", "1920"))
VIEWPORT_HEIGHT = int(os.environ.get("VIEWPORT_HEIGHT", "1080"))
REPO_ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = REPO_ROOT / "reference" / "codex-reference"
REPORT_JSON = REPORT_DIR / "runs-view-audit.json"
REPORT_MD = REPORT_DIR / "runs-view-audit.md"


def main() -> int:
    cancel_requests: list[dict] = []
    api_requests: list[dict] = []
    checks: list[dict] = []
    completed = False
    evidence: dict = {
        "cancelRequests": cancel_requests,
        "apiRequests": api_requests,
    }

    browser = None
    try:
        with sync_playwright() as playwright:
            browser = launch_browser(playwright)
            context = browser.new_context(
                viewport={"width": VIEWPORT_WIDTH, "height": VIEWPORT_HEIGHT},
                device_scale_factor=1,
            )
            page = context.new_page()
            page.add_init_script("window.localStorage.clear();")
            page.route("**/api/**", lambda route: handle_api(route, cancel_requests, api_requests))

            page.goto(APP_URL, wait_until="load", timeout=15000)
            page.locator('[data-workspace-view="runs"]').click()
            page.wait_for_selector("#runsPanel:not([hidden]) .runs-row[data-run-status='running']", timeout=8000)

            title = page.locator("#codexSidebarTitle").inner_text(timeout=3000)
            running_title = page.locator("#runsPanel .runs-row[data-run-status='running'] .runs-row-title").first.inner_text()
            subtitle = page.locator("#runsPanel .runs-subtitle").inner_text(timeout=3000)
            running_count = page.locator("#runsPanel .runs-row[data-run-status='running']").count()
            idle_count = page.locator("#runsPanel .runs-row[data-run-status='idle']").count()
            evidence.update({
                "title": title,
                "runningTitle": running_title,
                "subtitle": subtitle,
                "runningCount": running_count,
                "idleCount": idle_count,
            })

            page.locator("#runsPanel [data-run-action='cancel']").first.click()
            page.wait_for_timeout(500)

            page.locator("#runsPanel [data-run-action='open']").first.click()
            page.wait_for_function("document.querySelector('.monaco-workbench')?.dataset.workspaceView === 'codex'")
            page.wait_for_selector("#codexPanel:not([hidden])", timeout=3000)
            active_view = page.locator(".monaco-workbench").evaluate("node => node.dataset.workspaceView")
            stored_node = page.evaluate("localStorage.getItem('codex-web:node-id')")
            evidence.update({
                "activeViewAfterOpen": active_view,
                "storedNodeAfterOpen": stored_node,
            })
            completed = True

            context.close()
            browser.close()
            browser = None
    except Exception as exc:
        add_check(checks, "runs view audit completed", False, f"{type(exc).__name__}: {exc}")
    finally:
        if browser is not None:
            browser.close()

    add_check(checks, "runs view audit completed", completed, "ok" if completed else "not completed")
    add_check(checks, "viewport is 1920x1080 or larger", VIEWPORT_WIDTH >= 1920 and VIEWPORT_HEIGHT >= 1080, f"{VIEWPORT_WIDTH}x{VIEWPORT_HEIGHT}")
    add_check(checks, "runs view is reachable from Activity Bar", evidence.get("title") == "RUNS", f"title={evidence.get('title')!r}")
    add_check(checks, "running session row renders", evidence.get("runningTitle") == "Running smoke session", f"title={evidence.get('runningTitle')!r}")
    add_check(checks, "running and recent sessions are grouped", evidence.get("runningCount") == 1 and evidence.get("idleCount") == 1, f"running={evidence.get('runningCount')}, idle={evidence.get('idleCount')}")
    add_check(checks, "runs subtitle summarizes active and total sessions", evidence.get("subtitle") == "1 running / 2 total", f"subtitle={evidence.get('subtitle')!r}")
    add_check(checks, "nodes API is requested", any(req["path"] == "/api/nodes" for req in api_requests), request_details(api_requests))
    add_check(checks, "sessions are loaded with nodeId", any(req["path"] == "/api/sessions" and "nodeId=server-a" in req["query"] for req in api_requests), request_details(api_requests))
    add_check(checks, "all-session SSE is opened with nodeId", any(req["path"] == "/api/sessions/events" and "nodeId=server-a" in req["query"] for req in api_requests), request_details(api_requests))
    add_check(checks, "cancel posts selected node id", cancel_requests == [{"nodeId": "server-a"}], json.dumps(cancel_requests, ensure_ascii=False))
    add_check(checks, "open run switches back to Codex view", evidence.get("activeViewAfterOpen") == "codex", f"view={evidence.get('activeViewAfterOpen')!r}")
    add_check(checks, "open run stores selected node id", evidence.get("storedNodeAfterOpen") == "server-a", f"stored={evidence.get('storedNodeAfterOpen')!r}")

    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "appURL": APP_URL,
        "viewport": {"width": VIEWPORT_WIDTH, "height": VIEWPORT_HEIGHT},
        "summary": {
            "checks": len(checks),
            "failed": sum(1 for check in checks if not check["ok"]),
        },
        "checks": checks,
        "evidence": evidence,
    }
    write_report(report)
    print(f"{REPORT_JSON} ({report['summary']['failed']} failed)")
    return 1 if report["summary"]["failed"] else 0


def launch_browser(playwright):
    launch_options = {
        "headless": True,
        "args": [
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--force-device-scale-factor=1",
        ],
    }
    try:
        return playwright.chromium.launch(channel="chrome", **launch_options)
    except Exception:
        return playwright.chromium.launch(**launch_options)


def handle_api(route, cancel_requests: list[dict], api_requests: list[dict]) -> None:
    request = route.request
    parsed = urlparse(request.url)
    path = parsed.path
    api_requests.append({"method": request.method, "path": path, "query": parsed.query})

    if path == "/api/nodes":
        fulfill_json(route, {
            "nodes": [{
                "id": "server-a",
                "name": "Server A",
                "kind": "remote",
                "online": True,
                "rootDir": "/root",
                "lastSeen": "2026-07-06T00:00:00Z",
            }],
        })
        return

    if path == "/api/sessions":
        fulfill_json(route, {
            "sessions": [
                {
                    "id": "run-1",
                    "title": "Running smoke session",
                    "cwd": "/root/project",
                    "status": "running",
                    "updatedAt": "2026-07-06T00:02:00Z",
                    "lastSeq": 3,
                },
                {
                    "id": "idle-1",
                    "title": "Recent smoke session",
                    "cwd": "/root/project",
                    "status": "idle",
                    "updatedAt": "2026-07-06T00:01:00Z",
                    "lastSeq": 2,
                },
            ],
        })
        return

    if path == "/api/sessions/events":
        fulfill_sse(route, {
            "sessionId": "run-1",
            "seq": 4,
            "time": "2026-07-06T00:02:05Z",
            "kind": "reasoning",
            "text": "Thinking",
        })
        return

    if path == "/api/sessions/run-1/events":
        fulfill_json(route, {
            "events": [
                {
                    "sessionId": "run-1",
                    "seq": 1,
                    "time": "2026-07-06T00:02:00Z",
                    "kind": "user_message",
                    "text": "smoke",
                },
                {
                    "sessionId": "run-1",
                    "seq": 2,
                    "time": "2026-07-06T00:02:02Z",
                    "kind": "reasoning",
                    "text": "Thinking",
                },
            ],
            "firstSeq": 1,
            "lastSeq": 2,
            "hasMoreBefore": False,
        })
        return

    if path == "/api/sessions/run-1/cancel":
        try:
            cancel_requests.append(json.loads(request.post_data or "{}"))
        except json.JSONDecodeError:
            cancel_requests.append({})
        fulfill_json(route, {"ok": True})
        return

    fulfill_json(route, {"error": f"unhandled mock route: {path}"}, status=404)


def add_check(checks: list[dict], name: str, ok: bool, details: str) -> None:
    checks.append({"name": name, "ok": bool(ok), "details": details})


def request_details(api_requests: list[dict]) -> str:
    return ", ".join(f"{req['method']} {req['path']}?{req['query']}" for req in api_requests) or "none"


def write_report(report: dict) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_JSON.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    REPORT_MD.write_text(render_markdown(report), encoding="utf-8")


def render_markdown(report: dict) -> str:
    lines = [
        "# Runs View Audit",
        "",
        f"Generated: {report['generatedAt']}",
        f"App URL: {report['appURL']}",
        f"Viewport: {report['viewport']['width']}x{report['viewport']['height']}",
        "",
        "## Summary",
        "",
        f"- Checks: {report['summary']['checks']}",
        f"- Failed: {report['summary']['failed']}",
        "",
        "## Checks",
        "",
        "| Check | Status | Details |",
        "| --- | --- | --- |",
    ]
    for check in report["checks"]:
        status = "ok" if check["ok"] else "failed"
        lines.append(f"| {check['name']} | {status} | {escape_markdown_table(str(check['details']))} |")
    lines.extend([
        "",
        "## Evidence",
        "",
        "```json",
        json.dumps(report["evidence"], indent=2, ensure_ascii=False),
        "```",
        "",
    ])
    return "\n".join(lines)


def escape_markdown_table(value: str) -> str:
    return value.replace("|", "\\|").replace("\n", " ")


def fulfill_json(route, payload: dict, status: int = 200) -> None:
    route.fulfill(
        status=status,
        content_type="application/json",
        body=json.dumps(payload),
    )


def fulfill_sse(route, payload: dict) -> None:
    route.fulfill(
        status=200,
        content_type="text/event-stream; charset=utf-8",
        body=f"data: {json.dumps(payload)}\n\n",
    )


if __name__ == "__main__":
    raise SystemExit(main())
