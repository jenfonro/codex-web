#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, "reference", "codex-reference");
const outJSON = path.join(outDir, "event-mapping-audit.json");
const outMD = path.join(outDir, "event-mapping-audit.md");

const files = {
  history: "agent/internal/session/history.go",
  manager: "agent/internal/session/manager.go",
  lifecycle: "frontend/src/pages/codex/lifecycle.js",
  activity: "frontend/src/pages/codex/activity-summary.js",
  renderer: "frontend/src/pages/codex/renderer.js",
  dynamicAudit: "scripts/audit-codex-dynamic-states.cjs",
  finalScreenshots: "scripts/capture-codex-final-states.cjs",
};

main();

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const source = Object.fromEntries(Object.entries(files).map(([key, rel]) => [key, read(rel)]));
  const checks = [
    check(source.history, "agent maps user_message", /case "user_message":[\s\S]*newParsedEvent\("user_message"/),
    check(source.history, "agent maps agent_message to assistant_message", /case "agent_message":[\s\S]*newParsedEvent\("assistant_message"/),
    check(source.history, "agent maps task_started to transient turn_started", /case "task_started":[\s\S]*includeTransient[\s\S]*newParsedEvent\("turn_started"[\s\S]*"running"/),
    check(source.history, "agent maps task_complete to transient turn_completed", /case "task_complete":[\s\S]*includeTransient[\s\S]*newParsedEvent\("turn_completed"[\s\S]*"completed"/),
    check(source.history, "agent maps reasoning summary to summary event", /case "reasoning":[\s\S]*summaryText\(payload\["summary"\]\)[\s\S]*newParsedEvent\("summary"/),
    check(source.history, "agent maps live function/tool_call as running tool_call", /case "function_call"(?:,\s*"tool_call")?:[\s\S]*if includeTransient[\s\S]*data\["status"\] = "running"[\s\S]*else[\s\S]*data\["status"\] = "completed"[\s\S]*newParsedEvent\("tool_call"/),
    check(source.history, "agent maps function/tool_call_output to completed tool_output", /case "function_call_output"(?:,\s*"tool_call_output")?:[\s\S]*data\["status"\] = "completed"[\s\S]*newParsedEvent\("tool_output"/),
    check(source.history, "agent preserves call/output/status/exit metadata", /"call_id"[\s\S]*"arguments"[\s\S]*"output"[\s\S]*"status"[\s\S]*"exit_code"/),
    check(source.history, "agent parses JSON arguments into args", /json\.Unmarshal\(\[\]byte\(arguments\), &args\)[\s\S]*data\["args"\] = args/),
    check(source.manager, "manager emits user prompts", /appendEvent\(.*"user_message"/),
    check(source.manager, "manager emits turn_cancelled status", /appendEvent\(.*"turn_cancelled"[\s\S]*"status": "cancelled"/),
    check(source.manager, "manager streams stdout for the active turn", /appendEventForTurn\(sessionID,\s*turnID,\s*"stdout"/),
    check(source.manager, "manager streams stderr for the active turn", /appendEventForTurn\(sessionID,\s*turnID,\s*"stderr"/),
    check(source.manager, "manager emits turn_started from CLI events for the active turn", /case "turn\.started":[\s\S]*appendEventForTurn\(sessionID,\s*turnID,\s*"turn_started"/),
    check(source.manager, "manager emits turn_completed from CLI events atomically", /case "turn\.completed":[\s\S]*setStatusAndAppendEventsForTurn\(sessionID,\s*turnID,\s*statusIdle,[\s\S]*Kind:\s*"turn_completed"/),
    check(source.lifecycle, "frontend activity kinds include running/control surface", /activityKinds = \["turn_started", "reasoning", "tool_call", "stdout", "stderr", "turn_cancelled"\]/),
    check(source.lifecycle, "frontend terminal statuses include success failure cancel states", /terminalStatuses = \[[^\]]*"completed"[\s\S]*"failed"[\s\S]*"error"[\s\S]*"cancelled"[\s\S]*"stopped"/),
    check(source.lifecycle, "frontend settling hides stale pending activity", /isTurnSettlingEvent[\s\S]*turn_completed[\s\S]*turn_cancelled[\s\S]*shouldHideSettledPendingActivity/),
    check(source.lifecycle, "frontend keeps resolved tool_call visible after output", /resolvedToolCallIDs[\s\S]*eventKind\(event\) !== "tool_output"[\s\S]*resolvedCalls\.has\(callID\)/),
    check(source.lifecycle, "frontend starts new visual turn on user_message", /eventKind\(event, "assistant_message"\) === "user_message"[\s\S]*flushTurnEvents\(\)[\s\S]*visible\.push\(event\)/),
    check(source.activity, "processed summary label is separated from reasoning detail text", /const explicit = split\.summaryEvents\.find\(isProcessedSummaryLabel\)[\s\S]*summaryDetailEvents[\s\S]*!isProcessedSummaryLabel\(event\)/),
    check(source.activity, "process summary can be generated from process events", /const hasProcessSummary = summaryEvents\.length > 0 \|\| processEvents\.length > 0/),
    check(source.activity, "assistant commentary merges into final answer after process summary", /mergeAssistantEvents[\s\S]*join\("\\n\\n"\)[\s\S]*phase: fallback\?\.data\?\.phase \|\| "final_answer"/),
    check(source.activity, "completed turn stream only keeps non-collapsible events after final answer", /const afterFinal = contentEntries[\s\S]*entry\.index > finalEntry\.index && !isCollapsibleProcessSignal\(entry\.event\)[\s\S]*const streamFollowups = buildStreamFollowups\(afterFinal\)/),
    check(source.activity, "cancelled terminal activity stays out of process summaries", /isCollapsibleProcessSignal[\s\S]*!isStandaloneTerminalActivity\(event\)[\s\S]*eventKind\(event\) === "turn_cancelled"/),
    check(source.activity, "tool outputs bind to tool calls by call id", /callsByID\.set\(callID, item\)[\s\S]*const target = callID \? callsByID\.get\(callID\)/),
    check(source.activity, "orphan stdout stderr output hidden from stream rows", /kind === "tool_output" \|\| kind === "stdout" \|\| kind === "stderr"/),
    not(source.activity, "exec_command grouping is disabled for official alignment", /return name === "exec_command"|kind: "tool_group"|groupedToolStatus/),
    check(source.renderer, "renderer uses official-style tool disclosure", /renderToolActivityDisclosure[\s\S]*group\/activity-header[\s\S]*renderDisclosureBody/),
    check(source.renderer, "renderer renders running shell tool calls", /isActivityPending\(event\)[\s\S]*event\.kind[\s\S]*tool_call[\s\S]*hasShellArgs\(event\)/),
    all("renderer exposes exit code footer", [
      [source.renderer, /exit_code/],
      [source.renderer, /Exit code/],
    ]),
    check(source.dynamicAudit, "dynamic audit covers running completed failed cancelled composer states", /running shell command block present[\s\S]*completed transition command is hidden for official alignment[\s\S]*failed shell command remains visible[\s\S]*cancelled turn status row present[\s\S]*composer typed text is visible text/),
    all("final screenshot capture covers required visual states", [
      [source.finalScreenshots, /completed-summary/],
      [source.finalScreenshots, /file-reference/],
      [source.finalScreenshots, /running-thinking/],
    ]),
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    basis: "Static audit for agent event parsing and frontend conversation state mapping. Runtime visual/state behavior remains covered by dynamic, disclosure, file-diff, virtual-scroll, collapse, live-anchor, and final-screenshot audits.",
    files,
    summary: {
      checks: checks.length,
      failed: checks.filter((check) => !check.ok).length,
    },
    checks,
  };
  fs.writeFileSync(outJSON, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(outMD, renderMarkdown(report));
  console.log(`${outJSON} (${report.summary.failed} failed)`);
  if (report.summary.failed > 0) process.exit(1);
}

function read(rel) {
  const abs = path.join(repoRoot, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : "";
}

function check(text, name, pattern) {
  return {
    name,
    ok: pattern.test(text),
    details: pattern.source.replace(/\[\\s\\S\]\*/g, " ... ").slice(0, 240),
  };
}

function all(name, requirements) {
  const missing = requirements
    .map(([text, pattern]) => ({ text, pattern }))
    .filter((item) => !item.pattern.test(item.text))
    .map((item) => item.pattern.source);
  return {
    name,
    ok: missing.length === 0,
    details: missing.length ? `missing: ${missing.join("; ")}` : requirements.map(([, pattern]) => pattern.source).join(" + ").slice(0, 240),
  };
}

function not(text, name, pattern) {
  return {
    name,
    ok: !pattern.test(text),
    details: pattern.source.slice(0, 240),
  };
}

function renderMarkdown(report) {
  const lines = [
    "# Codex Event Mapping Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Summary",
    "",
    `- Checks: ${report.summary.checks}`,
    `- Failed: ${report.summary.failed}`,
    "",
    "## Checks",
    "",
    "| Check | Status | Details |",
    "| --- | --- | --- |",
  ];
  for (const check of report.checks) {
    lines.push(`| ${escapeMD(check.name)} | ${check.ok ? "ok" : "fail"} | ${escapeMD(check.details)} |`);
  }
  return `${lines.join("\n")}\n`;
}

function escapeMD(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}
