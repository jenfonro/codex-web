#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const MIN_UNIQUE_WINDOWS = Number(process.env.MIN_UNIQUE_WINDOWS || 2);

const repoRoot = path.resolve(__dirname, "..");
const captureRoot = path.join(repoRoot, "reference", "collapse-alignment");
const latestFile = path.join(captureRoot, "latest.txt");
const outDir = path.join(repoRoot, "reference", "codex-reference");
const outJSON = path.join(outDir, "collapse-window-rules-audit.json");
const outMD = path.join(outDir, "collapse-window-rules-audit.md");

main();

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const summaryPath = resolveSummaryPath();
  const captureDir = path.dirname(summaryPath);
  const source = readJSON(path.join(captureDir, "source-code-server", "scroll-chunks.json"));
  const target = readJSON(path.join(captureDir, "target-codex-web", "scroll-chunks.json"));
  const sourceAnalysis = analyzeSide("source", source);
  const targetAnalysis = analyzeSide("target", target);
  const checks = [
    ...sideChecks(sourceAnalysis),
    ...sideChecks(targetAnalysis),
    ...targetToolChecks(targetAnalysis, sourceAnalysis),
    ...crossSideChecks(sourceAnalysis, targetAnalysis),
  ];
  const failed = checks.filter((check) => !check.ok);
  const report = {
    generatedAt: new Date().toISOString(),
    basis: "Audits per-window turn grouping, semantic counts, and turn-level DOM/computed-style evidence from the latest collapse-alignment capture.",
    summaryPath: displayPath(summaryPath),
    captureDir: displayPath(captureDir),
    summary: {
      checks: checks.length,
      failed: failed.length,
    },
    checks,
    sides: {
      source: sourceAnalysis,
      target: targetAnalysis,
    },
  };
  fs.writeFileSync(outJSON, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(outMD, renderMarkdown(report));
  console.log(outJSON);
  console.log(outMD);
  if (failed.length) process.exitCode = 1;
}

function resolveSummaryPath() {
  const explicit = process.env.CAPTURE_SUMMARY;
  if (explicit) return path.resolve(explicit);
  if (!fs.existsSync(latestFile)) {
    throw new Error(`missing ${latestFile}; run scripts/capture-collapse-alignment.cjs first or set CAPTURE_SUMMARY`);
  }
  const latestDir = fs.readFileSync(latestFile, "utf8").trim();
  if (!latestDir) throw new Error(`${latestFile} is empty`);
  return path.join(path.resolve(latestDir), "summary.json");
}

function readJSON(file) {
  if (!fs.existsSync(file)) throw new Error(`missing ${file}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function analyzeSide(side, capture) {
  const chunks = Array.isArray(capture?.chunks) ? capture.chunks : [];
  const windows = chunks.map((chunk) => analyzeChunk(side, chunk));
  const allTurns = windows.flatMap((window) => window.turns);
  const allIssues = windows.flatMap((window) => window.issues.map((issue) => ({ ...issue, chunk: window.label })));
  const uniqueWindows = new Set(windows.map((window) => `${window.firstTurnKey}::${window.lastTurnKey}`).filter((key) => key !== "::"));
  const maxCounts = aggregateMaxCounts(windows);
  return {
    side,
    ok: Boolean(capture?.ok),
    reverse: Boolean(capture?.reverse),
    chunkCount: chunks.length,
    uniqueWindowCount: uniqueWindows.size,
    maxScroll: Number(capture?.maxScroll || 0),
    windows: windows.map((window) => ({
      label: window.label,
      requestedScrollTop: window.requestedScrollTop,
      actualScrollTop: window.actualScrollTop,
      turnCount: window.turnCount,
      viewportTurnCount: window.viewportTurnCount,
      groupCount: window.groupCount,
      contentUnitCount: window.contentUnitCount,
      userAnchorCount: window.userAnchorCount,
      assistantUnitCount: window.assistantUnitCount,
      firstTurnKey: window.firstTurnKey,
      lastTurnKey: window.lastTurnKey,
      counts: window.counts,
      semanticMaxCounts: window.semanticMaxCounts,
      issues: window.issues,
    })),
    maxCounts,
    total: {
      turns: allTurns.length,
      groups: allTurns.filter((turn) => turn.kind === "group").length,
      contentUnits: allTurns.filter((turn) => turn.kind === "content").length,
      userAnchors: allTurns.filter((turn) => turn.role === "user").length,
      assistantUnits: allTurns.filter((turn) => turn.role === "assistant").length,
      turnsWithStyleEvidence: allTurns.filter((turn) => turn.hasStyleEvidence).length,
      turnsWithSignatureEvidence: allTurns.filter((turn) => turn.hasSignatureEvidence).length,
      turnsWithSemanticEvidence: allTurns.filter((turn) => turn.hasSemanticEvidence).length,
      windowsWithProcessedSummaryText: windows.filter((window) => window.hasProcessedSummaryText).length,
      windowsWithFileReferences: windows.filter((window) => Number(window.counts.fileReferences || 0) > 0).length,
      windowsWithToolDisclosures: windows.filter((window) => Number(window.counts.toolDisclosures || 0) > 0).length,
      windowsWithShimmer: windows.filter((window) => Number(window.counts.shimmers || 0) > 0).length,
      windowsWithCommandEnhancementText: windows.filter((window) => window.hasCommandEnhancementText).length,
      windowsWithToolGroupItems: windows.filter((window) => Number(window.counts.toolGroupItems || 0) > 0).length,
    },
    issues: allIssues,
  };
}

function analyzeChunk(side, chunk) {
  const turns = (chunk.turns || []).map((turn) => analyzeTurn(side, turn));
  const viewportTurns = turns.filter((turn) => turn.inViewport);
  const groups = new Map();
  const issues = [];
  for (const turn of turns) {
    if (!turn.key) issues.push(issue("missing-turn-key", turn));
    if (!(Number(turn.height) > 0)) issues.push(issue("non-positive-turn-height", turn));
    if (!turn.hasStyleEvidence) issues.push(issue("missing-turn-style-evidence", turn));
    if (!turn.hasSignatureEvidence) issues.push(issue("missing-turn-signature-evidence", turn));
    if (!turn.hasSemanticEvidence) issues.push(issue("missing-turn-semantic-evidence", turn));
    if (!groups.has(turn.groupID)) groups.set(turn.groupID, { roots: 0, contents: [], users: 0, assistants: 0 });
    const group = groups.get(turn.groupID);
    if (turn.kind === "group") group.roots += 1;
    if (turn.kind === "content") group.contents.push(turn);
    if (turn.role === "user") group.users += 1;
    if (turn.role === "assistant") group.assistants += 1;
    if (turn.role === "user" && turn.attrs["data-local-conversation-user-anchor"] !== "true") {
      issues.push(issue("user-content-unit-missing-anchor", turn));
    }
  }
  for (const [groupID, group] of groups.entries()) {
    if (group.contents.length && group.roots === 0) {
      issues.push({ code: "content-units-without-visible-group", key: groupID, details: `${group.contents.length} content unit(s)` });
    }
    if (group.users > 1) {
      issues.push({ code: "multiple-user-anchors-in-group", key: groupID, details: `${group.users} user anchors` });
    }
  }
  return {
    label: chunk.label,
    requestedScrollTop: chunk.requestedScrollTop,
    actualScrollTop: chunk.actualScrollTop,
    turnCount: Number(chunk.turnCount || 0),
    viewportTurnCount: Number(chunk.viewportTurnCount || 0),
    firstTurnKey: chunk.firstTurnKey || "",
    lastTurnKey: chunk.lastTurnKey || "",
    counts: chunk.counts || {},
    semanticMaxCounts: aggregateTurnSemanticCounts(turns),
    groupCount: turns.filter((turn) => turn.kind === "group").length,
    contentUnitCount: turns.filter((turn) => turn.kind === "content").length,
    userAnchorCount: turns.filter((turn) => turn.role === "user").length,
    assistantUnitCount: turns.filter((turn) => turn.role === "assistant").length,
    hasProcessedSummaryText: turns.some((turn) => /\u5df2\u5904\u7406|processed/i.test(turn.text)),
    hasCommandEnhancementText: turns.some((turn) => /\bexec_command\s*(?:x|×|脳)?\s*\d+\b|\bwrite_stdin\b/i.test(turn.text)),
    turns,
    issues,
  };
}

function analyzeTurn(side, turn) {
  const parsed = parseTurnKey(side, turn.key || "", turn.attrs || {});
  const semanticCounts = turn.semantic?.counts || {};
  return {
    key: turn.key || "",
    groupID: parsed.groupID,
    kind: parsed.kind,
    role: parsed.role,
    attrs: turn.attrs || {},
    y: Number(turn.y || 0),
    height: Number(turn.height || 0),
    inViewport: Boolean(turn.inViewport),
    text: String(turn.text || ""),
    hasStyleEvidence: Boolean(turn.styles?.display && turn.styles?.fontFamily && turn.styles?.fontSize && turn.styles?.lineHeight),
    hasSignatureEvidence: Array.isArray(turn.signature) && turn.signature.length > 0,
    hasSemanticEvidence: Boolean(turn.semantic && turn.semantic.counts && turn.semantic.samples),
    semanticCounts,
  };
}

function parseTurnKey(side, key, attrs) {
  if (attrs["data-content-search-unit-key"]) {
    const match = String(attrs["data-content-search-unit-key"]).match(/^(.+):(\d+):(user|assistant)$/);
    if (match) return { kind: "content", groupID: groupIDFromPrefix(side, match[1]), role: match[3] };
  }
  if (attrs["data-turn-key"]) return { kind: "group", groupID: groupIDFromPrefix(side, attrs["data-turn-key"]), role: "" };
  if (attrs["data-codex-virtual-turn"]) return { kind: "group", groupID: String(attrs["data-codex-virtual-turn"]), role: "" };
  return { kind: "unknown", groupID: String(key || ""), role: "" };
}

function groupIDFromPrefix(side, value) {
  const raw = String(value || "");
  if (side === "target") return raw.replace(/^codex-turn-/, "");
  return raw;
}

function aggregateTurnSemanticCounts(turns) {
  const out = {};
  for (const turn of turns) {
    for (const [key, value] of Object.entries(turn.semanticCounts || {})) {
      out[key] = Math.max(out[key] || 0, Number(value || 0));
    }
  }
  return out;
}

function aggregateMaxCounts(windows) {
  const out = {};
  for (const window of windows) {
    for (const [key, value] of Object.entries(window.counts || {})) {
      out[key] = Math.max(out[key] || 0, Number(value || 0));
    }
    for (const [key, value] of Object.entries(window.semanticMaxCounts || {})) {
      out[`semantic.${key}`] = Math.max(out[`semantic.${key}`] || 0, Number(value || 0));
    }
  }
  return out;
}

function sideChecks(analysis) {
  return [
    {
      name: `${analysis.side} scroll chunks are readable`,
      ok: analysis.ok && analysis.chunkCount > 0,
      details: `chunks=${analysis.chunkCount}`,
    },
    {
      name: `${analysis.side} has multiple unique virtual windows`,
      ok: analysis.uniqueWindowCount >= MIN_UNIQUE_WINDOWS,
      details: `unique=${analysis.uniqueWindowCount}`,
    },
    {
      name: `${analysis.side} every visible turn has style evidence`,
      ok: analysis.total.turns > 0 && analysis.total.turnsWithStyleEvidence === analysis.total.turns,
      details: `${analysis.total.turnsWithStyleEvidence}/${analysis.total.turns}`,
    },
    {
      name: `${analysis.side} every visible turn has DOM signature evidence`,
      ok: analysis.total.turns > 0 && analysis.total.turnsWithSignatureEvidence === analysis.total.turns,
      details: `${analysis.total.turnsWithSignatureEvidence}/${analysis.total.turns}`,
    },
    {
      name: `${analysis.side} every visible turn has semantic selector evidence`,
      ok: analysis.total.turns > 0 && analysis.total.turnsWithSemanticEvidence === analysis.total.turns,
      details: `${analysis.total.turnsWithSemanticEvidence}/${analysis.total.turns}`,
    },
    {
      name: `${analysis.side} grouped turns contain user anchors`,
      ok: analysis.total.userAnchors > 0,
      details: `userAnchors=${analysis.total.userAnchors}`,
    },
    {
      name: `${analysis.side} grouped turns contain assistant units`,
      ok: analysis.total.assistantUnits > 0,
      details: `assistantUnits=${analysis.total.assistantUnits}`,
    },
    {
      name: `${analysis.side} turn grouping has no rule violations`,
      ok: analysis.issues.length === 0,
      details: analysis.issues.slice(0, 8).map((entry) => `${entry.chunk || ""}:${entry.code}:${entry.key || ""}`).join(", "),
    },
    {
      name: `${analysis.side} processed summary text appears in captured windows`,
      ok: analysis.total.windowsWithProcessedSummaryText > 0,
      details: `windows=${analysis.total.windowsWithProcessedSummaryText}`,
    },
    {
      name: `${analysis.side} file reference windows are captured`,
      ok: analysis.total.windowsWithFileReferences > 0,
      details: `windows=${analysis.total.windowsWithFileReferences}`,
    },
  ];
}

function targetToolChecks(target, source) {
  const sourceActivityCaptured = Number(source.maxCounts.activityHeaders || 0) > 0 || Number(source.maxCounts["semantic.activityHeader"] || 0) > 0;
  const sourceToolCaptured = Number(source.maxCounts.toolDisclosures || 0) > 0 || Number(source.maxCounts["semantic.toolDisclosure"] || 0) > 0;
  const targetActivityCaptured = Number(target.maxCounts.activityHeaders || 0) > 0 || Number(target.maxCounts["semantic.activityHeader"] || 0) > 0;
  const targetToolCaptured = Number(target.maxCounts.toolDisclosures || 0) > 0 || Number(target.maxCounts["semantic.toolDisclosure"] || 0) > 0;
  return [
    {
      name: "target activity headers are captured",
      ok: !sourceActivityCaptured || targetActivityCaptured,
      details: `sourceMax=${source.maxCounts.activityHeaders || 0}, sourceSemanticMax=${source.maxCounts["semantic.activityHeader"] || 0}, targetMax=${target.maxCounts.activityHeaders || 0}, targetSemanticMax=${target.maxCounts["semantic.activityHeader"] || 0}`,
    },
    {
      name: "target tool disclosures are captured",
      ok: !sourceToolCaptured || targetToolCaptured,
      details: `sourceMax=${source.maxCounts.toolDisclosures || 0}, sourceSemanticMax=${source.maxCounts["semantic.toolDisclosure"] || 0}, targetMax=${target.maxCounts.toolDisclosures || 0}, targetSemanticMax=${target.maxCounts["semantic.toolDisclosure"] || 0}`,
    },
    {
      name: "target windows with activity keep matching tool disclosure coverage",
      ok: target.windows.every((window) => Number(window.counts.activityHeaders || 0) === 0 || Number(window.counts.toolDisclosures || 0) >= Number(window.counts.activityHeaders || 0)),
      details: target.windows
        .filter((window) => Number(window.counts.activityHeaders || 0) > Number(window.counts.toolDisclosures || 0))
        .map((window) => window.label)
        .join(", "),
    },
    {
      name: "target official-alignment windows do not expose Codex Web command enhancement rows",
      ok: target.total.windowsWithCommandEnhancementText === 0,
      details: `windows=${target.total.windowsWithCommandEnhancementText}`,
    },
    {
      name: "target official-alignment windows do not expose grouped command child rows",
      ok: target.total.windowsWithToolGroupItems === 0,
      details: `windows=${target.total.windowsWithToolGroupItems}`,
    },
  ];
}

function crossSideChecks(source, target) {
  return [
    {
      name: "source and target both expose processed summary rows",
      ok: Number(source.maxCounts.summaries || 0) > 0 && Number(target.maxCounts.summaries || 0) > 0,
      details: `source=${source.maxCounts.summaries || 0}, target=${target.maxCounts.summaries || 0}`,
    },
    {
      name: "source and target both expose file reference styling windows",
      ok: Number(source.maxCounts.fileReferences || 0) > 0 && Number(target.maxCounts.fileReferences || 0) > 0,
      details: `source=${source.maxCounts.fileReferences || 0}, target=${target.maxCounts.fileReferences || 0}`,
    },
  ];
}

function issue(code, turn) {
  return { code, key: turn.key, details: turn.text.slice(0, 120) };
}

function renderMarkdown(report) {
  const lines = [
    "# Codex Collapse Window Rules Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    report.basis,
    "",
    `Capture: \`${report.summaryPath}\``,
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
    lines.push(`| ${escapePipe(check.name)} | ${check.ok ? "ok" : "failed"} | ${escapePipe(check.details || "")} |`);
  }
  lines.push("");
  lines.push("## Window Coverage");
  lines.push("");
  lines.push("| Side | Chunks | Unique Windows | Turns | Groups | Content Units | User Anchors | Assistant Units | Style Evidence | Signature Evidence | Semantic Evidence | Issues |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const side of ["source", "target"]) {
    const entry = report.sides[side];
    lines.push([
      side,
      entry.chunkCount,
      entry.uniqueWindowCount,
      entry.total.turns,
      entry.total.groups,
      entry.total.contentUnits,
      entry.total.userAnchors,
      entry.total.assistantUnits,
      `${entry.total.turnsWithStyleEvidence}/${entry.total.turns}`,
      `${entry.total.turnsWithSignatureEvidence}/${entry.total.turns}`,
      `${entry.total.turnsWithSemanticEvidence}/${entry.total.turns}`,
      entry.issues.length,
    ].map(escapePipe).join(" | ").replace(/^/, "| ").replace(/$/, " |"));
  }
  lines.push("");
  lines.push("## Rule");
  lines.push("");
  lines.push("- This audit uses enhanced scroll chunk data. If it fails with missing style/signature/semantic evidence, rerun `scripts/capture-collapse-alignment.cjs` with the current script before judging UI alignment.");
  lines.push("- Running/thinking shimmer is only required when present in the captured long session; fixture-level running-state coverage remains in `dynamic-state-audit`.");
  return `${lines.join("\n")}\n`;
}

function escapePipe(value) {
  return String(value).replace(/\r?\n/g, " ").replace(/\|/g, "\\|");
}

function displayPath(file) {
  const relative = path.relative(repoRoot, file);
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) return relative;
  return file;
}
