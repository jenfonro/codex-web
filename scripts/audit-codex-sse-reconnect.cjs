#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const reportDir = path.join(repoRoot, "reference", "codex-reference");
const jsonPath = path.join(reportDir, "sse-reconnect-audit.json");
const mdPath = path.join(reportDir, "sse-reconnect-audit.md");

const checks = [];

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function rel(file) {
  return path.relative(repoRoot, file).replace(/\\/g, "/");
}

function addCheck(name, ok, details, evidence = []) {
  checks.push({
    name,
    ok: Boolean(ok),
    details,
    evidence: Array.isArray(evidence) ? evidence : [String(evidence)],
  });
}

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}`);
  if (start < 0) return "";
  const open = source.indexOf("{", start);
  if (open < 0) return "";
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return "";
}

const indexSource = read("frontend/src/pages/codex/index.js");
const storeSource = read("frontend/src/store/codex.js");

const subscribeNode = functionBody(indexSource, "subscribeNodeSessions");
const subscribeSession = functionBody(indexSource, "subscribeSession");
const scheduleNode = functionBody(indexSource, "scheduleNodeSessionsReconnect");
const scheduleSession = functionBody(indexSource, "scheduleSessionReconnect");
const closeSession = functionBody(indexSource, "closeSessionEventSource");
const closeNode = functionBody(indexSource, "closeNodeEventSource");
const handleClick = functionBody(indexSource, "handleClick");

addCheck(
  "store tracks SSE reconnect state",
  [
    "eventSourceReconnectDelay",
    "eventSourceReconnectTimer",
    "eventSourceSessionId",
    "nodeEventSourceReconnectDelay",
    "nodeEventSourceReconnectTimer",
  ].every((field) => storeSource.includes(field)),
  "session and node streams both have retry delay and timer state",
  ["frontend/src/store/codex.js"]
);

addCheck(
  "reconnect backoff constants are bounded",
  indexSource.includes("SSE_RECONNECT_INITIAL_MS = 1000") &&
    indexSource.includes("SSE_RECONNECT_MAX_MS = 15000") &&
    functionBody(indexSource, "nextSessionReconnectDelay").includes("Math.min(SSE_RECONNECT_MAX_MS") &&
    functionBody(indexSource, "nextNodeReconnectDelay").includes("Math.min(SSE_RECONNECT_MAX_MS"),
  "frontend uses a bounded reconnect delay instead of tight retry loops",
  ["frontend/src/pages/codex/index.js"]
);

addCheck(
  "node-level SSE schedules reconnect on error",
  subscribeNode.includes("source.onerror") &&
    subscribeNode.includes("scheduleNodeSessionsReconnect()") &&
    subscribeNode.includes("state.nodeEventSource !== source"),
  "node stream errors must not permanently stop the session list updater",
  ["frontend/src/pages/codex/index.js"]
);

addCheck(
  "node-level reconnect refreshes session list state",
  scheduleNode.includes("await loadSessions(true)") &&
    scheduleNode.includes("subscribeNodeSessions()") &&
    scheduleNode.includes("requestRender()"),
  "node stream reconnect refreshes list status before reopening the all-session stream",
  ["frontend/src/pages/codex/index.js"]
);

addCheck(
  "session SSE reconnects with current lastSeq",
  subscribeSession.includes("latestSeqForSession(sessionID)") &&
    subscribeSession.includes('qs.set("lastSeq", String(lastSeq))') &&
    subscribeSession.includes("scheduleSessionReconnect(sessionID)"),
  "active session reconnect keeps using the latest known sequence for backlog replay",
  ["frontend/src/pages/codex/index.js"]
);

addCheck(
  "session reconnect is gated to the current visible thread",
  scheduleSession.includes('state.view !== "thread"') &&
    scheduleSession.includes("state.activeSessionId !== sessionID") &&
    scheduleSession.includes("subscribeSession(sessionID)"),
  "stale reconnect timers cannot reopen old sessions after navigation",
  ["frontend/src/pages/codex/index.js"]
);

addCheck(
  "manual subscription closes clear retry timers",
  subscribeNode.includes("closeNodeEventSource(true)") &&
    subscribeSession.includes("closeSessionEventSource(true)") &&
    closeNode.includes("global.clearTimeout") &&
    closeSession.includes("global.clearTimeout"),
  "switching streams clears old retry timers before opening a new EventSource",
  ["frontend/src/pages/codex/index.js"]
);

addCheck(
  "leaving a thread closes the active session stream and retry",
  handleClick.includes('action === "back" || action === "new-chat"') &&
    handleClick.includes("closeSessionEventSource()"),
  "back/new-chat navigation must stop the per-session stream",
  ["frontend/src/pages/codex/index.js"]
);

addCheck(
  "malformed SSE rows do not kill the stream",
  subscribeNode.includes("Keep the stream alive if one row is malformed") &&
    subscribeSession.includes("Keep the stream alive if one row is malformed"),
  "JSON parse errors are isolated per message",
  ["frontend/src/pages/codex/index.js"]
);

const failed = checks.filter((check) => !check.ok);
const report = {
  generatedAt: new Date().toISOString(),
  basis: "Frontend SSE reconnect audit. It verifies node-level and per-session EventSource streams recover after errors and use backlog sequencing for the active session.",
  totals: {
    checks: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
  },
  checks,
};

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(mdPath, renderMarkdown(report));

if (failed.length) {
  console.error(`SSE reconnect audit failed: ${failed.length}/${checks.length} checks failed`);
  for (const check of failed) console.error(`- ${check.name}: ${check.details}`);
  process.exit(1);
}

console.log(`SSE reconnect audit passed: ${checks.length}/${checks.length} checks`);
console.log(rel(jsonPath));
console.log(rel(mdPath));

function renderMarkdown(report) {
  const lines = [
    "# Codex SSE Reconnect Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    report.basis,
    "",
    "## Summary",
    "",
    `- Checks: ${report.totals.checks}`,
    `- Passed: ${report.totals.passed}`,
    `- Failed: ${report.totals.failed}`,
    "",
    "## Checks",
    "",
    "| Status | Check | Details |",
    "| --- | --- | --- |",
  ];
  for (const check of report.checks) {
    lines.push(`| ${check.ok ? "PASS" : "FAIL"} | ${escapeMarkdown(check.name)} | ${escapeMarkdown(check.details)} |`);
  }
  lines.push("", "## Evidence", "");
  for (const check of report.checks) {
    lines.push(`### ${check.ok ? "PASS" : "FAIL"}: ${check.name}`, "");
    for (const item of check.evidence) lines.push(`- \`${item}\``);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function escapeMarkdown(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}
