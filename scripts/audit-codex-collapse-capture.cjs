#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const MIN_VIEWPORT_WIDTH = Number(process.env.MIN_VIEWPORT_WIDTH || 1920);
const MIN_VIEWPORT_HEIGHT = Number(process.env.MIN_VIEWPORT_HEIGHT || 1080);
const MIN_SOURCE_SIDEBAR_WIDTH = Number(process.env.MIN_SOURCE_SIDEBAR_WIDTH || 580);
const MIN_UNIQUE_WINDOWS = Number(process.env.MIN_UNIQUE_WINDOWS || 2);

const repoRoot = path.resolve(__dirname, "..");
const captureRoot = path.join(repoRoot, "reference", "collapse-alignment");
const latestFile = path.join(captureRoot, "latest.txt");
const outDir = path.join(repoRoot, "reference", "codex-reference");
const outJSON = path.join(outDir, "collapse-capture-audit.json");
const outMD = path.join(outDir, "collapse-capture-audit.md");

main();

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const summaryPath = resolveSummaryPath();
  const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
  const captureDir = path.dirname(summaryPath);
  const sourceChunks = readOptionalJSON(path.join(captureDir, "source-code-server", "scroll-chunks.json"));
  const targetChunks = readOptionalJSON(path.join(captureDir, "target-codex-web", "scroll-chunks.json"));
  const checks = [
    ...captureChecks(summary, summaryPath),
    ...topSurfaceChecks(summary.sourceCapture?.top, "source", { source: true }),
    ...topSurfaceChecks(summary.targetCapture?.top, "target", { target: true }),
    ...frameChecks(summary.sourceCapture, "source"),
    ...frameChecks(summary.targetCapture, "target"),
    ...scrollChecks(summary.sourceCapture?.scrollChunks, sourceChunks, "source", { requireActivity: false }),
    ...scrollChecks(summary.targetCapture?.scrollChunks, targetChunks, "target", {
      requireActivity: true,
      requireHistoryPrepend: true,
      baseTurnCount: selectedFrameTurnCount(summary.targetCapture),
    }),
  ];
  const failed = checks.filter((check) => !check.ok);
  const report = {
    generatedAt: new Date().toISOString(),
    basis: "Audits the latest code-server/Codex Web collapse-alignment capture. This is a capture validity and semantic coverage gate; screenshots are supporting artifacts only.",
    summaryPath: displayPath(summaryPath),
    captureDir: displayPath(captureDir),
    minViewport: { width: MIN_VIEWPORT_WIDTH, height: MIN_VIEWPORT_HEIGHT },
    minSourceSidebarWidth: MIN_SOURCE_SIDEBAR_WIDTH,
    minUniqueWindows: MIN_UNIQUE_WINDOWS,
    capture: {
      source: pickCapture(summary.sourceCapture),
      target: pickCapture(summary.targetCapture),
      comparison: summary.comparison || null,
    },
    checks,
    summary: {
      checks: checks.length,
      failed: failed.length,
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

function readOptionalJSON(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function captureChecks(summary, summaryPath) {
  return [
    {
      name: "capture summary exists",
      ok: fs.existsSync(summaryPath),
      details: displayPath(summaryPath),
    },
    {
      name: "capture status is captured",
      ok: summary.status === "captured",
      details: String(summary.status || ""),
    },
    {
      name: "capture preflight has no failures",
      ok: Array.isArray(summary.failures) && summary.failures.length === 0,
      details: JSON.stringify(summary.failures || []),
    },
  ];
}

function topSurfaceChecks(top, label, options) {
  const viewport = top?.viewport || {};
  const sidebar = top?.sidebar || {};
  const auxiliary = top?.auxiliarybar || {};
  const activeItems = top?.activeActivityItems || [];
  const activeItemText = activeItems.map((item) => `${item.ariaLabel || ""} ${item.title || ""} ${item.text || ""} ${item.className || ""}`).join(" ");
  const activeCodexItem = activeItems.find((item) =>
    item.looksCodex || /(codex|chatgpt|openai|chat|瀵硅瘽|鑱婂ぉ|浠诲姟)/i.test(`${item.ariaLabel || ""} ${item.title || ""} ${item.text || ""} ${item.className || ""}`),
  );
  const auxiliaryHidden = !auxiliary || auxiliary.display === "none" || auxiliary.visibility === "hidden" || Number(auxiliary.width || 0) <= 1 || Number(auxiliary.height || 0) <= 1;
  const checks = [
    {
      name: `${label} viewport is at least ${MIN_VIEWPORT_WIDTH}x${MIN_VIEWPORT_HEIGHT}`,
      ok: Number(viewport.width || 0) >= MIN_VIEWPORT_WIDTH && Number(viewport.height || 0) >= MIN_VIEWPORT_HEIGHT,
      details: `${viewport.width || 0}x${viewport.height || 0}`,
    },
  ];
  if (options.source) {
    checks.push(
      {
        name: "source Codex is selected in left Activity Bar",
        ok: Boolean(activeCodexItem),
        details: activeItemText.trim(),
      },
      {
        name: `source sidebar width is at least ${MIN_SOURCE_SIDEBAR_WIDTH}px`,
        ok: Number(sidebar.width || 0) >= MIN_SOURCE_SIDEBAR_WIDTH,
        details: `${Math.round(Number(sidebar.width || 0))}px`,
      },
      {
        name: "source right auxiliary/chat sidebar is closed",
        ok: auxiliaryHidden,
        details: auxiliary ? `${auxiliary.display}/${auxiliary.visibility}/${Math.round(Number(auxiliary.width || 0))}x${Math.round(Number(auxiliary.height || 0))}` : "not present",
      },
    );
  }
  if (options.target) {
    checks.push({
      name: "target URL is Codex Web or local Codex Web",
      ok: /(codex\.zelt\.cn|127\.0\.0\.1:58888|localhost:58888)/i.test(String(top?.url || "")),
      details: String(top?.url || ""),
    });
    if (/codex\.zelt\.cn/i.test(String(top?.url || ""))) {
      checks.push({
        name: "target live capture includes node id",
        ok: /[?&]nodeId=[^&]+/i.test(String(top?.url || "")),
        details: String(top?.url || ""),
      });
    }
  }
  return checks;
}

function frameChecks(capture, label) {
  const frame = capture?.frames?.[capture?.selectedFrameIndex]?.runtime || {};
  return [
    {
      name: `${label} selected frame has conversation`,
      ok: Boolean(frame.hasConversation),
      details: capture?.selectedFrameReason || "",
    },
    {
      name: `${label} selected frame has composer`,
      ok: Boolean(frame.hasComposer),
      details: capture?.selectedFrameReason || "",
    },
    {
      name: `${label} selected frame has user bubble`,
      ok: Boolean(frame.hasUserBubble),
      details: `${frame.turnCount || 0} turn node(s)`,
    },
    {
      name: `${label} selected frame has assistant markdown`,
      ok: Boolean(frame.hasAssistantMarkdown),
      details: `${frame.turnCount || 0} turn node(s)`,
    },
  ];
}

function scrollChecks(scrollSummary, rawChunks, label, options) {
  const windows = scrollSummary?.windows || [];
  const maxCounts = scrollSummary?.maxCounts || {};
  const blankWindows = windows.filter((window) => Number(window.viewportTurnCount || 0) <= 0);
  const rawChunkMaxTurnCount = Math.max(0, ...((rawChunks?.chunks || []).map((chunk) => Number(chunk.turnCount || 0))));
  const rawChunkInitialScrollHeight = Number(rawChunks?.chunks?.[0]?.scrollHeight || 0);
  const rawChunkMaxScrollHeight = Math.max(0, ...((rawChunks?.chunks || []).map((chunk) => Number(chunk.scrollHeight || 0))));
  const selectedFrameTurnCount = Number(options.baseTurnCount || 0);
  const checks = [
    {
      name: `${label} virtual scroll capture succeeded`,
      ok: Boolean(scrollSummary?.ok),
      details: JSON.stringify({ chunkCount: scrollSummary?.chunkCount || 0, uniqueWindowCount: scrollSummary?.uniqueWindowCount || 0, reverse: Boolean(scrollSummary?.reverse) }),
    },
    {
      name: `${label} virtual scroll has multiple windows`,
      ok: Number(scrollSummary?.chunkCount || 0) >= 2 && Number(scrollSummary?.uniqueWindowCount || 0) >= MIN_UNIQUE_WINDOWS,
      details: `chunks=${scrollSummary?.chunkCount || 0}, unique=${scrollSummary?.uniqueWindowCount || 0}`,
    },
    {
      name: `${label} virtual scroll has no blank viewport windows`,
      ok: blankWindows.length === 0,
      details: blankWindows.map((window) => window.label).join(", "),
    },
    {
      name: `${label} capture includes processed-summary rows`,
      ok: Number(maxCounts.summaries || 0) > 0,
      details: `max summaries=${maxCounts.summaries || 0}`,
    },
    {
      name: `${label} capture includes file references`,
      ok: Number(maxCounts.fileReferences || 0) > 0,
      details: `max fileReferences=${maxCounts.fileReferences || 0}`,
    },
  ];
  if (options.requireActivity) {
    checks.push(
      {
        name: "target capture includes activity headers",
        ok: Number(maxCounts.activityHeaders || 0) > 0,
        details: `max activityHeaders=${maxCounts.activityHeaders || 0}`,
      },
      {
        name: "target capture includes tool disclosures",
        ok: Number(maxCounts.toolDisclosures || 0) > 0,
        details: `max toolDisclosures=${maxCounts.toolDisclosures || 0}`,
      },
    );
  }
  if (options.requireHistoryPrepend) {
    checks.push({
      name: "target history prepend path was exercised",
      ok: rawChunkMaxTurnCount > selectedFrameTurnCount || rawChunkMaxScrollHeight > rawChunkInitialScrollHeight,
      details: `max raw turnCount=${rawChunkMaxTurnCount}, initial window turnCount=${selectedFrameTurnCount}, initial scrollHeight=${rawChunkInitialScrollHeight}, max scrollHeight=${rawChunkMaxScrollHeight}`,
    });
  }
  return checks;
}

function pickCapture(capture) {
  if (!capture) return null;
  const frame = capture.frames?.[capture.selectedFrameIndex]?.runtime || {};
  return {
    target: capture.target,
    selectedFrameIndex: capture.selectedFrameIndex,
    selectedFrameReason: capture.selectedFrameReason,
    viewport: capture.top?.viewport,
    sidebar: capture.top?.sidebar ? {
      width: capture.top.sidebar.width,
      height: capture.top.sidebar.height,
      text: capture.top.sidebar.text,
    } : null,
    frame: {
      hasConversation: Boolean(frame.hasConversation),
      hasComposer: Boolean(frame.hasComposer),
      hasUserBubble: Boolean(frame.hasUserBubble),
      hasAssistantMarkdown: Boolean(frame.hasAssistantMarkdown),
      turnCount: frame.turnCount || 0,
      counts: {
        summaries: frame.summaryButtonCount || 0,
        activityHeaders: frame.activityHeaderCount || 0,
        toolDisclosures: frame.toolDisclosureCount || 0,
        fileReferences: frame.fileReferenceCount || 0,
        shimmers: frame.shimmerCount || 0,
      },
    },
    scrollChunks: capture.scrollChunks || null,
  };
}

function selectedFrameTurnCount(capture) {
  return Number(capture?.frames?.[capture?.selectedFrameIndex]?.runtime?.turnCount || 0);
}

function renderMarkdown(report) {
  const lines = [
    "# Codex Collapse Capture Audit",
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
  lines.push("## Capture Coverage");
  lines.push("");
  lines.push("| Side | Frame | Viewport | Chunks | Unique Windows | Max Summaries | Max Activity | Max Tool Disclosures | Max File References |");
  lines.push("| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const side of ["source", "target"]) {
    const capture = report.capture[side];
    const scroll = capture?.scrollChunks || {};
    const max = scroll.maxCounts || {};
    lines.push([
      side,
      String(capture?.selectedFrameIndex ?? ""),
      `${capture?.viewport?.width || 0}x${capture?.viewport?.height || 0}`,
      String(scroll.chunkCount || 0),
      String(scroll.uniqueWindowCount || 0),
      String(max.summaries || 0),
      String(max.activityHeaders || 0),
      String(max.toolDisclosures || 0),
      String(max.fileReferences || 0),
    ].map(escapePipe).join(" | ").replace(/^/, "| ").replace(/$/, " |"));
  }
  lines.push("");
  lines.push("## Rule");
  lines.push("");
  lines.push("- This audit proves capture validity and semantic coverage only; detailed class/computed-style matching remains covered by the source, DOM, markup, computed, dynamic, disclosure, file-diff, virtual-scroll, and live-anchor audits.");
  lines.push("- A failed source Activity Bar/sidebar check means the capture is invalid for UI alignment, even if screenshots exist.");
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
