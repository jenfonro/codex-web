#!/usr/bin/env node
"use strict";

const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, "reference", "codex-reference");
const outJSON = path.join(outDir, "completion-audit.json");
const outMD = path.join(outDir, "completion-audit.md");

const liveBaseURL = trimTrailingSlash(process.env.CODEX_COMPLETION_LIVE_URL || "https://codex.zelt.cn");
const preferredNodeID = process.env.CODEX_COMPLETION_NODE_ID || "";
const preferredLongSessionID = process.env.CODEX_COMPLETION_LONG_SESSION_ID || "019f0a04-7f0b-7483-8bc4-18f214a5c8f1";
const liveTimeoutMS = Number(process.env.CODEX_COMPLETION_TIMEOUT_MS || 20000);
const requireLiveAlignmentReports = process.env.CODEX_COMPLETION_REQUIRE_LIVE_ALIGNMENT === "1";

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const checks = [];
  const evidence = { reports: {}, live: {} };

  addStaticReportChecks(checks, evidence);
  await addLiveReadOnlyChecks(checks, evidence);

  const report = {
    generatedAt: new Date().toISOString(),
    basis: "Completion-oriented audit for Codex Web controller + root agent + code-server/Codex-panel alignment. Static reports prove source/runtime gates; live read-only checks prove the deployed controller-agent path without creating sessions.",
    liveBaseURL,
    summary: {
      checks: checks.length,
      failed: checks.filter((check) => !check.ok).length,
    },
    checks,
    evidence,
  };

  fs.writeFileSync(outJSON, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(outMD, renderMarkdown(report));
  console.log(`${rel(outJSON)} (${report.summary.failed} failed)`);
  console.log(`${rel(outMD)}`);
  if (report.summary.failed > 0) process.exit(1);
}

function addStaticReportChecks(checks, evidence) {
  const reports = [
    ["system architecture", "system-architecture-audit.json", ["backend/agent separation", "node registry", "controller routes", "Docker/systemd", "no browser auth"]],
    ["source alignment", "source-alignment-audit.json", ["official extension source snippets", "copied CSS/assets"]],
    ["workspace layout", "workspace-layout-audit.json", ["code-server shell layout", "workspace chrome"]],
    ["DOM structure", "dom-structure-audit.json", ["Codex panel DOM structure"]],
    ["markup alignment", "markup-alignment-audit.json", ["captured markup parity"]],
    ["computed style", "computed-style-audit.json", ["captured computed styles"]],
    ["dynamic state", "dynamic-state-audit.json", ["thinking shimmer", "running/completed/failed/cancelled states"]],
    ["event mapping", "event-mapping-audit.json", ["agent event parsing", "frontend turn grouping contract"]],
    ["session sequencing", "session-sequencing-audit.json", ["optimistic events", "authoritative SSE replacement"]],
    ["SSE reconnect", "sse-reconnect-audit.json", ["event stream reconnect semantics"]],
    ["virtual scroll", "virtual-scroll-audit.json", ["long-session virtualized rendering"]],
    ["disclosure collapse", "disclosure-collapse-audit.json", ["official-style collapse/expand behavior"]],
    ["disclosure anchor", "disclosure-anchor-probe.json", ["expansion scroll anchoring"]],
    ["file/diff", "file-diff-audit.json", ["file reference and diff card styling"]],
    ["runs view", "runs-view-audit.json", ["all-session subscription", "cancel routing", "open run"]],
    ["controller side views", "controller-views-audit.json", ["nodes", "workspace", "git views"]],
    ["final state screenshots", path.join("final-state-screenshots", "report.json"), ["processed summary", "file reference", "running/thinking screenshots"]],
  ];
  if (requireLiveAlignmentReports) {
    reports.push(
      ["collapse capture", "collapse-capture-audit.json", ["1920x1080 live source/target capture validity"]],
      ["collapse window rules", "collapse-window-rules-audit.json", ["per-window turn semantics"]],
    );
  }

  for (const [name, file, coverage] of reports) {
    const reportPath = path.join(outDir, file);
    const report = readJSON(reportPath);
    evidence.reports[name] = report
      ? {
          file: rel(reportPath),
          generatedAt: report.generatedAt || "",
          summary: report.summary || null,
          coverage,
        }
      : { file: rel(reportPath), missing: true, coverage };
    const failureCount = reportFailureCount(report);
    const checkCount = reportCheckCount(report);
    checks.push({
      name: `${name} report passes`,
      ok: Boolean(report && failureCount === 0 && checkCount > 0),
      details: report
        ? `${checkCount} checks, ${failureCount} failed; coverage=${coverage.join(", ")}`
        : `missing ${rel(reportPath)}`,
      evidence: [rel(reportPath)],
    });
  }
}

async function addLiveReadOnlyChecks(checks, evidence) {
  const root = await fetchText(`${liveBaseURL}/`);
  evidence.live.root = summarizeResponse(root);
  checks.push({
    name: "live controller root responds",
    ok: root.statusCode === 200 && /text\/html/i.test(root.headers["content-type"] || ""),
    details: `${root.statusCode}; content-type=${root.headers["content-type"] || ""}`,
    evidence: [`${liveBaseURL}/`],
  });

  const fixture = await fetchText(`${liveBaseURL}/app/codex-fixtures.js`, { acceptStatus: [200, 404] });
  evidence.live.fixtureAsset = summarizeResponse(fixture);
  checks.push({
    name: "live fixture bundle is hidden in production mode",
    ok: fixture.statusCode === 404,
    details: `status=${fixture.statusCode}`,
    evidence: [`${liveBaseURL}/app/codex-fixtures.js`],
  });

  const nodesResponse = await fetchJSON(`${liveBaseURL}/api/nodes`);
  const nodes = Array.isArray(nodesResponse.body?.nodes) ? nodesResponse.body.nodes : [];
  const onlineNodes = nodes.filter((node) => node && node.online);
  const selectedNode = selectNode(nodes, preferredNodeID);
  evidence.live.nodes = {
    statusCode: nodesResponse.statusCode,
    count: nodes.length,
    online: onlineNodes.map((node) => node.id),
    selected: selectedNode ? selectedNode.id : "",
  };
  checks.push({
    name: "live controller has an online agent node",
    ok: nodesResponse.statusCode === 200 && Boolean(selectedNode),
    details: `nodes=${nodes.length}, online=${onlineNodes.map((node) => node.id).join(",") || "none"}, selected=${selectedNode?.id || "none"}`,
    evidence: [`${liveBaseURL}/api/nodes`],
  });

  if (!selectedNode) {
    checks.push({
      name: "live session list is reachable through selected agent",
      ok: false,
      details: "no online node selected",
      evidence: [`${liveBaseURL}/api/sessions?nodeId=<node>`],
    });
    return;
  }

  const sessionsURL = `${liveBaseURL}/api/sessions?nodeId=${encodeURIComponent(selectedNode.id)}`;
  const sessionsResponse = await fetchJSON(sessionsURL);
  const sessions = Array.isArray(sessionsResponse.body?.sessions) ? sessionsResponse.body.sessions : [];
  const selectedSession = selectSession(sessions, preferredLongSessionID);
  evidence.live.sessions = {
    statusCode: sessionsResponse.statusCode,
    count: sessions.length,
    selected: selectedSession ? { id: selectedSession.id, lastSeq: selectedSession.lastSeq, title: selectedSession.title } : null,
  };
  checks.push({
    name: "live session list is reachable through selected agent",
    ok: sessionsResponse.statusCode === 200 && sessions.length > 0 && Boolean(selectedSession),
    details: `sessions=${sessions.length}, selected=${selectedSession?.id || "none"}, lastSeq=${selectedSession?.lastSeq || 0}`,
    evidence: [sessionsURL],
  });

  if (!selectedSession) {
    checks.push({
      name: "live long-session events page includes process events for mapping",
      ok: false,
      details: "no session selected",
      evidence: [`${liveBaseURL}/api/sessions/<session>/events?nodeId=${encodeURIComponent(selectedNode.id)}&limit=80`],
    });
    return;
  }

  const eventsURL = `${liveBaseURL}/api/sessions/${encodeURIComponent(selectedSession.id)}/events?nodeId=${encodeURIComponent(selectedNode.id)}&limit=80`;
  const eventsResponse = await fetchJSON(eventsURL);
  const events = Array.isArray(eventsResponse.body?.events) ? eventsResponse.body.events : [];
  const kindCounts = countBy(events, (event) => event.kind || "");
  evidence.live.eventsPage = {
    statusCode: eventsResponse.statusCode,
    count: events.length,
    firstSeq: eventsResponse.body?.firstSeq || 0,
    lastSeq: eventsResponse.body?.lastSeq || 0,
    hasMoreBefore: Boolean(eventsResponse.body?.hasMoreBefore),
    kindCounts,
  };
  checks.push({
      name: "live long-session events page includes process events for mapping",
    ok: eventsResponse.statusCode === 200 && events.length > 0 && Number(eventsResponse.body?.lastSeq || 0) > 0 && kindCounts.tool_call > 0 && kindCounts.tool_output > 0,
    details: `events=${events.length}, seq=${eventsResponse.body?.firstSeq || 0}-${eventsResponse.body?.lastSeq || 0}, kinds=${formatCounts(kindCounts)}`,
    evidence: [eventsURL],
  });

  const sseURL = `${liveBaseURL}/api/sessions/events?nodeId=${encodeURIComponent(selectedNode.id)}&sessionId=${encodeURIComponent(selectedSession.id)}&lastSeq=0&limit=1`;
  const sse = await fetchSSEHeaders(sseURL);
  evidence.live.sse = summarizeResponse(sse);
  checks.push({
    name: "live session SSE endpoint opens as event stream",
    ok: sse.statusCode === 200 && /text\/event-stream/i.test(sse.headers["content-type"] || ""),
    details: `${sse.statusCode}; content-type=${sse.headers["content-type"] || ""}`,
    evidence: [sseURL],
  });
}

function selectNode(nodes, preferredID) {
  if (preferredID) {
    return nodes.find((node) => node.id === preferredID && node.online) || null;
  }
  return nodes.find((node) => node.online && node.kind === "remote") || nodes.find((node) => node.online) || null;
}

function selectSession(sessions, preferredID) {
  if (preferredID) {
    const preferred = sessions.find((session) => session.id === preferredID || session.codexThreadId === preferredID);
    if (preferred) return preferred;
  }
  return sessions
    .slice()
    .sort((a, b) => Number(b.lastSeq || 0) - Number(a.lastSeq || 0))[0] || null;
}

function fetchJSON(url) {
  return fetchText(url).then((response) => {
    let body = null;
    try {
      body = JSON.parse(response.body || "{}");
    } catch (error) {
      response.parseError = error.message;
    }
    return { ...response, body };
  });
}

function fetchText(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === "http:" ? http : https;
    const timeoutMS = options.timeoutMS || liveTimeoutMS;
    const request = client.request(
      parsed,
      {
        method: "GET",
        headers: {
          Accept: options.accept || "application/json,text/html;q=0.9,*/*;q=0.8",
          "User-Agent": "codex-completion-audit/1.0",
        },
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
          if (body.length > 2 * 1024 * 1024) {
            request.destroy(new Error(`response too large for audit: ${url}`));
          }
        });
        response.on("end", () => {
          resolve({ statusCode: response.statusCode || 0, headers: response.headers, body });
        });
      }
    );
    request.setTimeout(timeoutMS, () => {
      request.destroy(new Error(`timeout after ${timeoutMS}ms: ${url}`));
    });
    request.on("error", reject);
    request.end();
  });
}

function fetchSSEHeaders(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === "http:" ? http : https;
    const timeoutMS = liveTimeoutMS;
    const request = client.request(
      parsed,
      {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
          "User-Agent": "codex-completion-audit/1.0",
        },
      },
      (response) => {
        const result = { statusCode: response.statusCode || 0, headers: response.headers, body: "" };
        response.on("data", () => {
          response.destroy();
        });
        response.on("close", () => resolve(result));
        setTimeout(() => {
          response.destroy();
          resolve(result);
        }, 250);
      }
    );
    request.setTimeout(timeoutMS, () => {
      request.destroy(new Error(`timeout after ${timeoutMS}ms: ${url}`));
    });
    request.on("error", reject);
    request.end();
  });
}

function readJSON(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return { parseError: error.message };
  }
}

function reportFailureCount(report) {
  if (!report || report.parseError) return Number.POSITIVE_INFINITY;
  if (report.totals && Number.isFinite(Number(report.totals.failed))) return Number(report.totals.failed);
  if (report.summary && Number.isFinite(Number(report.summary.failed))) return Number(report.summary.failed);
  if (report.summary && hasZeroDifferenceSummary(report.summary)) return 0;
  const statuses = collectComponentStatuses(report);
  if (statuses.length > 0) {
    return statuses.filter((status) => !["exact", "compatible", "ok", "pass"].includes(status)).length;
  }
  if (Array.isArray(report.assetIntegrity)) {
    return report.assetIntegrity.filter((item) => item.status !== "exact").length;
  }
  if (Array.isArray(report.checks)) return report.checks.filter((check) => check && check.ok === false).length;
  return Number.POSITIVE_INFINITY;
}

function reportCheckCount(report) {
  if (!report || report.parseError) return 0;
  if (report.totals && Number.isFinite(Number(report.totals.checks))) return Number(report.totals.checks);
  if (report.summary && Number.isFinite(Number(report.summary.checks))) return Number(report.summary.checks);
  if (Array.isArray(report.checks)) return report.checks.length;
  const statuses = collectComponentStatuses(report);
  if (statuses.length > 0) return statuses.length;
  if (Array.isArray(report.assetIntegrity)) return report.assetIntegrity.length;
  if (report.summary && Number.isFinite(Number(report.summary.trackedRows))) return Number(report.summary.trackedRows);
  if (Array.isArray(report.trackedSelectors)) return report.trackedSelectors.length;
  if (report.summary && hasZeroDifferenceSummary(report.summary)) return 1;
  return 0;
}

function hasZeroDifferenceSummary(summary) {
  const keys = ["actionableDifferences", "missingRows", "missing", "differences", "failed"];
  return keys.some((key) => Object.prototype.hasOwnProperty.call(summary, key)) &&
    keys.every((key) => !Object.prototype.hasOwnProperty.call(summary, key) || Number(summary[key]) === 0);
}

function collectComponentStatuses(report) {
  const statuses = [];
  function visit(value) {
    if (!value || typeof value !== "object") return;
    if (typeof value.status === "string") {
      statuses.push(value.status);
    }
    for (const child of Object.values(value)) {
      if (child && typeof child === "object") visit(child);
    }
  }
  visit(report.components);
  return statuses;
}

function countBy(items, fn) {
  const out = {};
  for (const item of items) {
    const key = fn(item);
    if (!key) continue;
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

function formatCounts(counts) {
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value}`)
    .join(",") || "none";
}

function summarizeResponse(response) {
  return {
    statusCode: response.statusCode,
    contentType: response.headers?.["content-type"] || "",
    bodyBytes: Buffer.byteLength(response.body || "", "utf8"),
  };
}

function renderMarkdown(report) {
  const lines = [
    "# Codex Completion Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    report.basis,
    "",
    "## Summary",
    "",
    `- Checks: ${report.summary.checks}`,
    `- Failed: ${report.summary.failed}`,
    `- Live URL: ${report.liveBaseURL}`,
    "",
    "## Checks",
    "",
    "| Status | Check | Details |",
    "| --- | --- | --- |",
  ];
  for (const check of report.checks) {
    lines.push(`| ${check.ok ? "PASS" : "FAIL"} | ${escapeMD(check.name)} | ${escapeMD(check.details)} |`);
  }
  return `${lines.join("\n")}\n`;
}

function rel(file) {
  return path.relative(repoRoot, file).replace(/\\/g, "/");
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function escapeMD(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}
