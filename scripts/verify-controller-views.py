#!/usr/bin/env python3
"""Audit the controller-owned Nodes, Workspace, and Git sidebar views."""

from __future__ import annotations

from datetime import datetime, timezone
import json
import os
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import sync_playwright


APP_URL = os.environ.get("PANEL_URL", "http://127.0.0.1:58888/")
VIEWPORT_WIDTH = int(os.environ.get("VIEWPORT_WIDTH", "1920"))
VIEWPORT_HEIGHT = int(os.environ.get("VIEWPORT_HEIGHT", "1080"))
REPO_ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = REPO_ROOT / "reference" / "codex-reference"
REPORT_JSON = REPORT_DIR / "controller-views-audit.json"
REPORT_MD = REPORT_DIR / "controller-views-audit.md"


def main() -> int:
    state = MockState()
    checks: list[dict] = []
    evidence: dict = {
        "apiRequests": state.api_requests,
        "activeNodeRequests": state.active_node_requests,
        "deletedNodes": state.deleted_nodes,
        "workspaceRequests": state.workspace_requests,
        "gitRequests": state.git_requests,
    }
    completed = False
    browser = None

    try:
        with sync_playwright() as playwright:
            browser = launch_browser(playwright)
            context = browser.new_context(
                viewport={"width": VIEWPORT_WIDTH, "height": VIEWPORT_HEIGHT},
                device_scale_factor=1,
            )
            page = context.new_page()
            page.add_init_script("""
              window.localStorage.clear();
              window.confirm = () => true;
            """)
            page.route("**/api/**", lambda route: handle_api(route, state))

            page.goto(APP_URL, wait_until="load", timeout=15000)

            audit_nodes_view(page, evidence)
            audit_workspace_view(page, evidence)
            audit_git_view(page, evidence)
            completed = True

            context.close()
            browser.close()
            browser = None
    except Exception as exc:
        evidence["error"] = f"{type(exc).__name__}: {exc}"
    finally:
        if browser is not None:
            browser.close()

    add_check(checks, "controller views audit completed", completed, evidence.get("error", "ok"))
    add_check(checks, "viewport is 1920x1080 or larger", VIEWPORT_WIDTH >= 1920 and VIEWPORT_HEIGHT >= 1080, f"{VIEWPORT_WIDTH}x{VIEWPORT_HEIGHT}")
    add_check(checks, "Nodes view is reachable from Activity Bar", evidence.get("nodesTitle") == "NODES", f"title={evidence.get('nodesTitle')!r}")
    add_check(checks, "online and offline nodes render", evidence.get("onlineNodeCount") == 1 and evidence.get("offlineNodeCount") == 1, f"online={evidence.get('onlineNodeCount')}, offline={evidence.get('offlineNodeCount')}")
    add_check(checks, "selecting a node posts active node id", state.active_node_requests == [{"nodeId": "server-a"}], json.dumps(state.active_node_requests, ensure_ascii=False))
    add_check(checks, "selecting a node updates stored node id", evidence.get("storedNodeAfterSelect") == "server-a", f"stored={evidence.get('storedNodeAfterSelect')!r}")
    add_check(checks, "offline node deletion calls controller", state.deleted_nodes == ["server-b"], json.dumps(state.deleted_nodes, ensure_ascii=False))
    add_check(checks, "Workspace view is reachable from Activity Bar", evidence.get("workspaceTitle") == "WORKSPACE", f"title={evidence.get('workspaceTitle')!r}")
    add_check(checks, "workspace directory entries use selected node", has_workspace_request(state, "workspace-directory-entries", "server-a"), workspace_request_details(state.workspace_requests))
    add_check(checks, "workspace directory navigation sends path", has_workspace_param(state, "workspace-directory-entries", "directoryPath", "src"), workspace_request_details(state.workspace_requests))
    add_check(checks, "workspace search uses selected node", has_workspace_request(state, "workspace-directory-tree-search", "server-a"), workspace_request_details(state.workspace_requests))
    add_check(checks, "workspace search sends query", has_workspace_param(state, "workspace-directory-tree-search", "query", "main"), workspace_request_details(state.workspace_requests))
    add_check(checks, "Git view is reachable from Activity Bar", evidence.get("gitTitle") == "SOURCE CONTROL", f"title={evidence.get('gitTitle')!r}")
    add_check(checks, "git requests use selected node", all(req.get("nodeId") == "server-a" for req in state.git_requests) and len(state.git_requests) >= 3, git_request_details(state.git_requests))
    add_check(checks, "git requests cover metadata, status, and review summary", {"branch-metadata", "status-summary", "review-summary"}.issubset({req.get("method") for req in state.git_requests}), git_request_details(state.git_requests))
    add_check(checks, "git changed file renders", evidence.get("gitFileName") == "app.go", f"file={evidence.get('gitFileName')!r}")

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


def audit_nodes_view(page, evidence: dict) -> None:
    page.locator('[data-workspace-view="nodes"]').click()
    page.wait_for_selector("#nodesPanel:not([hidden]) .nodes-row", timeout=8000)
    evidence["nodesTitle"] = page.locator("#codexSidebarTitle").inner_text(timeout=3000)
    evidence["onlineNodeCount"] = page.locator('#nodesPanel .nodes-row[data-node-online="true"]').count()
    evidence["offlineNodeCount"] = page.locator('#nodesPanel .nodes-row[data-node-online="false"]').count()

    page.locator('#nodesPanel .nodes-row[data-node-online="true"] [data-node-action="select"]').first.click()
    page.wait_for_function("localStorage.getItem('codex-web:node-id') === 'server-a'")
    evidence["storedNodeAfterSelect"] = page.evaluate("localStorage.getItem('codex-web:node-id')")

    page.locator('#nodesPanel .nodes-row[data-node-online="false"] [data-node-action="delete"]').first.click()
    page.wait_for_selector('#nodesPanel .nodes-row[data-node-online="false"]', state="detached", timeout=5000)
    evidence["nodeRowsAfterDelete"] = page.locator("#nodesPanel .nodes-row").count()


def audit_workspace_view(page, evidence: dict) -> None:
    page.locator('[data-workspace-view="workspace"]').click()
    page.wait_for_selector("#workspacePanel:not([hidden]) .workspace-row", timeout=8000)
    evidence["workspaceTitle"] = page.locator("#codexSidebarTitle").inner_text(timeout=3000)
    evidence["workspaceFirstEntry"] = page.locator("#workspacePanel .workspace-entry-name").first.inner_text(timeout=3000)

    page.locator('#workspacePanel [data-workspace-entry="src"][data-workspace-type="directory"]').click()
    page.wait_for_selector('#workspacePanel [data-workspace-entry="src/main.go"]', timeout=5000)
    evidence["workspaceNestedEntry"] = page.locator('#workspacePanel [data-workspace-entry="src/main.go"] .workspace-entry-name').inner_text(timeout=3000)

    search = page.locator("#workspacePanel [data-workspace-search]")
    search.fill("main")
    search.press("Enter")
    page.wait_for_selector('#workspacePanel [data-workspace-entry="src/main.go"]', timeout=5000)


def audit_git_view(page, evidence: dict) -> None:
    page.locator('[data-workspace-view="git"]').click()
    page.wait_for_selector("#gitPanel:not([hidden]) .git-file-row", timeout=8000)
    evidence["gitTitle"] = page.locator("#codexSidebarTitle").inner_text(timeout=3000)
    evidence["gitBranch"] = page.locator("#gitPanel .git-title").inner_text(timeout=3000)
    evidence["gitFileName"] = page.locator("#gitPanel .git-file-name").first.inner_text(timeout=3000)


class MockState:
    def __init__(self) -> None:
        self.node_deleted = False
        self.api_requests: list[dict] = []
        self.active_node_requests: list[dict] = []
        self.deleted_nodes: list[str] = []
        self.workspace_requests: list[dict] = []
        self.git_requests: list[dict] = []


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


def handle_api(route, state: MockState) -> None:
    request = route.request
    parsed = urlparse(request.url)
    path = parsed.path
    query = parse_qs(parsed.query)
    body = parse_json(request.post_data or "{}")
    state.api_requests.append({"method": request.method, "path": path, "query": parsed.query, "body": body})

    if path == "/api/nodes" and request.method == "GET":
        nodes = [{
            "id": "server-a",
            "name": "Server A",
            "kind": "remote",
            "online": True,
            "rootDir": "/workspace",
            "codexHome": "/data/codex-home",
            "hostname": "server-a-host",
            "version": "0.1.0",
            "lastSeen": "2026-07-06T00:00:00Z",
        }]
        if not state.node_deleted:
            nodes.append({
                "id": "server-b",
                "name": "Server B",
                "kind": "remote",
                "online": False,
                "rootDir": "/offline",
                "codexHome": "/offline/codex",
                "hostname": "server-b-host",
                "version": "0.1.0",
                "lastSeen": "2026-07-05T00:00:00Z",
            })
        fulfill_json(route, {"nodes": nodes})
        return

    if path == "/api/nodes/active" and request.method == "POST":
        state.active_node_requests.append(body)
        fulfill_json(route, {"ok": True})
        return

    if path == "/api/nodes/server-b" and request.method == "DELETE":
        state.node_deleted = True
        state.deleted_nodes.append("server-b")
        fulfill_json(route, {"ok": True})
        return

    if path == "/api/sessions" and request.method == "GET":
        fulfill_json(route, {"sessions": []})
        return

    if path == "/api/sessions/events":
        fulfill_sse(route, {"sessionId": "noop", "seq": 1, "kind": "heartbeat", "time": "2026-07-06T00:00:00Z"})
        return

    if path == "/api/workspace" and request.method == "POST":
        state.workspace_requests.append(body)
        handle_workspace(route, body)
        return

    if path == "/api/git" and request.method == "POST":
        state.git_requests.append(body)
        handle_git(route, body)
        return

    if path.startswith("/api/sessions/") and path.endswith("/events"):
        fulfill_json(route, {"events": [], "firstSeq": 0, "lastSeq": 0, "hasMoreBefore": False})
        return

    fulfill_json(route, {"error": f"unhandled mock route: {path}", "query": query}, status=404)


def handle_workspace(route, body: dict) -> None:
    endpoint = body.get("endpoint")
    params = body.get("params") or {}
    if endpoint == "workspace-directory-entries":
        directory = normalize_path(params.get("directoryPath", ""))
        if directory == "src":
            fulfill_json(route, {
                "directoryPath": "src",
                "entries": [{
                    "name": "main.go",
                    "path": "src/main.go",
                    "displayPath": "src/main.go",
                    "isDirectory": False,
                    "sizeBytes": 2048,
                    "modifiedAtMs": 1783286400000,
                }],
            })
            return
        fulfill_json(route, {
            "directoryPath": "",
            "entries": [
                {
                    "name": "src",
                    "path": "src",
                    "displayPath": "src",
                    "isDirectory": True,
                    "sizeBytes": 0,
                    "modifiedAtMs": 1783286400000,
                },
                {
                    "name": "README.md",
                    "path": "README.md",
                    "displayPath": "README.md",
                    "isDirectory": False,
                    "sizeBytes": 512,
                    "modifiedAtMs": 1783286400000,
                },
            ],
        })
        return
    if endpoint == "workspace-directory-tree-search":
        fulfill_json(route, {
            "files": [{
                "name": "main.go",
                "path": "src/main.go",
                "displayPath": "src/main.go",
                "isDirectory": False,
                "sizeBytes": 2048,
                "modifiedAtMs": 1783286400000,
            }],
        })
        return
    fulfill_json(route, {"error": f"unhandled workspace endpoint: {endpoint}"}, status=404)


def handle_git(route, body: dict) -> None:
    method = body.get("method")
    if method == "branch-metadata":
        fulfill_json(route, {
            "currentBranch": "main",
            "defaultBranch": "main",
            "baseBranch": "origin/main",
            "upstreamBranch": "origin/main",
            "gitRoot": "/workspace",
        })
        return
    if method == "status-summary":
        fulfill_json(route, {
            "type": "success",
            "hasChanges": True,
            "stageCounts": {"staged": 1, "unstaged": 2, "untracked": 1},
        })
        return
    if method == "review-summary":
        fulfill_json(route, {
            "type": "success",
            "files": [{
                "path": "backend/internal/server/app.go",
                "additions": 12,
                "deletions": 3,
                "changeType": "modified",
            }],
        })
        return
    fulfill_json(route, {"error": f"unhandled git method: {method}"}, status=404)


def has_workspace_request(state: MockState, endpoint: str, node_id: str) -> bool:
    return any(req.get("endpoint") == endpoint and req.get("nodeId") == node_id for req in state.workspace_requests)


def has_workspace_param(state: MockState, endpoint: str, key: str, value: str) -> bool:
    return any(req.get("endpoint") == endpoint and (req.get("params") or {}).get(key) == value for req in state.workspace_requests)


def workspace_request_details(requests: list[dict]) -> str:
    return ", ".join(f"{req.get('nodeId')}:{req.get('endpoint')}:{req.get('params')}" for req in requests) or "none"


def git_request_details(requests: list[dict]) -> str:
    return ", ".join(f"{req.get('nodeId')}:{req.get('method')}:{req.get('params')}" for req in requests) or "none"


def parse_json(value: str) -> dict:
    try:
        parsed = json.loads(value) if value else {}
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def normalize_path(path: object) -> str:
    return str(path or "").replace("\\", "/").strip("/")


def add_check(checks: list[dict], name: str, ok: bool, details: str) -> None:
    checks.append({"name": name, "ok": bool(ok), "details": details})


def write_report(report: dict) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_JSON.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    REPORT_MD.write_text(render_markdown(report), encoding="utf-8")


def render_markdown(report: dict) -> str:
    lines = [
        "# Controller Views Audit",
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
