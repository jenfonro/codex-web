#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.resolve(__dirname, "..");
const reportDir = path.join(repoRoot, "reference", "codex-reference");
const jsonPath = path.join(reportDir, "session-sequencing-audit.json");
const mdPath = path.join(reportDir, "session-sequencing-audit.md");

const checks = [];

function rel(file) {
  return path.relative(repoRoot, file).replace(/\\/g, "/");
}

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function addCheck(name, ok, details, evidence = []) {
  checks.push({
    name,
    ok: Boolean(ok),
    details,
    evidence: Array.isArray(evidence) ? evidence : [String(evidence)],
  });
}

function createRuntime() {
  const storage = new Map();
  const window = {
    localStorage: {
      getItem(key) {
        return storage.get(key) || "";
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
    },
    CodexPanelUtils: {
      relativeTime() {
        return "now";
      },
    },
  };
  const context = vm.createContext({ window, console });
  vm.runInContext(read("frontend/src/store/codex.js"), context, { filename: "frontend/src/store/codex.js" });
  vm.runInContext(read("frontend/src/pages/codex/api.js"), context, { filename: "frontend/src/pages/codex/api.js" });
  return window;
}

const runtime = createRuntime();
const store = runtime.CodexPanelStore;
const api = runtime.CodexPanelAPI;

const normalized = api.normalizeSession({
  id: "session-a",
  title: "Long session",
  status: "idle",
  updatedAt: "2026-07-05T20:00:00Z",
  lastSeq: 7207,
  cwd: "/workspace",
  codexThreadId: "019f",
});

addCheck(
  "normalizeSession preserves session lastSeq",
  normalized?.lastSeq === 7207,
  `lastSeq=${normalized?.lastSeq}`,
  ["frontend/src/pages/codex/api.js"]
);

addCheck(
  "normalizeSession preserves useful agent metadata",
  normalized?.cwd === "/workspace" && normalized?.codexThreadId === "019f",
  `cwd=${normalized?.cwd}; codexThreadId=${normalized?.codexThreadId}`,
  ["frontend/src/pages/codex/api.js"]
);

const state = store.createCodexPanelState();
state.sessions = [normalized];
state.eventsBySession.set("session-a", [
  { sessionId: "session-a", seq: 7108, kind: "assistant_message", text: "tail start" },
  { sessionId: "session-a", seq: 7207, kind: "assistant_message", text: "tail end" },
]);

addCheck(
  "knownLastSeq uses sparse loaded event tails",
  store.knownLastSeq(state, "session-a") === 7207,
  `knownLastSeq=${store.knownLastSeq(state, "session-a")}`,
  ["frontend/src/store/codex.js"]
);

addCheck(
  "next local event seq follows the real session tail",
  store.nextLocalEventSeq(state, "session-a") === 7208,
  `nextLocalEventSeq=${store.nextLocalEventSeq(state, "session-a")}`,
  ["frontend/src/store/codex.js", "frontend/src/pages/codex/index.js"]
);

state.eventPagesBySession.set("session-a", { firstSeq: 7901, lastSeq: 8000, hasMoreBefore: true });

addCheck(
  "knownLastSeq also respects event page metadata",
  store.knownLastSeq(state, "session-a") === 8000,
  `knownLastSeq=${store.knownLastSeq(state, "session-a")}`,
  ["frontend/src/store/codex.js"]
);

const indexSource = read("frontend/src/pages/codex/index.js");

addCheck(
  "appendLocalEvent uses the shared nextLocalEventSeq helper",
  /seq:\s*store\.nextLocalEventSeq\(state,\s*sessionID\)/.test(indexSource),
  "appendLocalEvent must not derive seq from events.length",
  ["frontend/src/pages/codex/index.js"]
);

addCheck(
  "appendLocalEvent no longer uses loaded event count as sequence",
  !/seq:\s*events\.length\s*\+\s*1/.test(indexSource),
  "events.length is only the currently loaded window and is wrong for long sessions",
  ["frontend/src/pages/codex/index.js"]
);

addCheck(
  "optimistic events are explicitly marked local",
  /function appendLocalEvent[\s\S]*local:\s*true/.test(indexSource) &&
    /state\.eventsBySession\.set\(session\.id,\s*\[\{[\s\S]*local:\s*true/.test(indexSource) &&
    /const errorEvent = \{[\s\S]*local:\s*true/.test(indexSource),
  "local user/error placeholders must be identifiable when authoritative agent events arrive",
  ["frontend/src/pages/codex/index.js"]
);

addCheck(
  "authoritative SSE events can replace local placeholders",
  /function hasSessionEvent[\s\S]*Number\(event\.seq \|\| 0\) === seq && !event\.local/.test(indexSource) &&
    /function shouldReplaceSessionEvent[\s\S]*existing\?\.local && !candidate\?\.local[\s\S]*return true/.test(indexSource),
  "incoming agent events with the same seq must replace local optimistic placeholders instead of being dropped",
  ["frontend/src/pages/codex/index.js"]
);

const failed = checks.filter((check) => !check.ok);
const report = {
  generatedAt: new Date().toISOString(),
  basis: "Frontend session sequencing audit. It verifies sparse long-session event windows keep optimistic events ordered after the real agent sequence tail.",
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
  console.error(`session sequencing audit failed: ${failed.length}/${checks.length} checks failed`);
  for (const check of failed) console.error(`- ${check.name}: ${check.details}`);
  process.exit(1);
}

console.log(`session sequencing audit passed: ${checks.length}/${checks.length} checks`);
console.log(rel(jsonPath));
console.log(rel(mdPath));

function renderMarkdown(report) {
  const lines = [
    "# Codex Session Sequencing Audit",
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
