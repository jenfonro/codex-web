#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const CDP = process.env.CDP_URL || "http://127.0.0.1:9222";
const SOURCE_URL = process.env.SOURCE_URL || "https://code-tx.zelt.cn/?folder=/root";
const TARGET_URL = process.env.TARGET_URL || "https://codex.zelt.cn/?nodeId=host-docker-agent";
const SOURCE_PATTERN = new RegExp(process.env.SOURCE_URL_PATTERN || "code-tx\\.zelt\\.cn", "i");
const TARGET_PATTERN = new RegExp(process.env.TARGET_URL_PATTERN || "(codex\\.zelt\\.cn|127\\.0\\.0\\.1:58888|localhost:58888)", "i");
const SOURCE_NAVIGATE = process.env.SOURCE_NAVIGATE === "1";
const TARGET_FRESH = process.env.TARGET_FRESH !== "0";
const TARGET_NAVIGATE = process.env.TARGET_NAVIGATE !== "0";
const TARGET_OPEN_SESSION = process.env.TARGET_OPEN_SESSION !== "0";
const TARGET_NODE_ID = process.env.TARGET_NODE_ID || "host-docker-agent";
const TARGET_SESSION_ID = process.env.TARGET_SESSION_ID || "019f0a04-7f0b-7483-8bc4-18f214a5c8f1";
const TARGET_FOCUS_SEQ = Number(process.env.TARGET_FOCUS_SEQ || process.env.TARGET_API_SEQ || 0);
const TARGET_API_KIND = process.env.TARGET_API_KIND || "";
const SOURCE_CONTEXT_TERMS = envTerms(process.env.SOURCE_CONTEXT_TERMS || "");
const VIEWPORT_WIDTH = Number(process.env.VIEWPORT_WIDTH || 1920);
const VIEWPORT_HEIGHT = Number(process.env.VIEWPORT_HEIGHT || 1080);
const TARGET_SIDEBAR_WIDTH = Number(process.env.TARGET_SIDEBAR_WIDTH || 611);
const MAX_SCROLL_STEPS = Number(process.env.ANCHOR_MAX_SCROLL_STEPS || 140);
const CDP_COMMAND_TIMEOUT_MS = Number(process.env.CDP_COMMAND_TIMEOUT_MS || 90000);
const ANCHOR_TIMEOUT_MS = Number(process.env.ANCHOR_TIMEOUT_MS || 150000);
const CAPTURE_SCREENSHOT = process.env.CAPTURE_SCREENSHOT !== "0";
const RESTORE_DISCLOSURE_AFTER_CAPTURE = process.env.RESTORE_DISCLOSURE_AFTER_CAPTURE !== "0";

const DEFAULT_ANCHORS = [
  "./build-all.sh",
  "已提交并推送到 origin/main",
  "我现在上传了/root/code/codex-web.tar",
  "判断基本明确了：你的方向是对的",
  "对，你这个判断是对的",
];

const STOP_CONTEXT_TERMS = new Set([
  "head",
  "active",
  "push",
  "clone",
  "main",
  "origin/main",
  "feat:",
  "remove",
  "auth",
  "http/api",
  "codex-web",
  "codex",
  "agent",
]);

const STYLE_PROPS = [
  "display",
  "position",
  "boxSizing",
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "gap",
  "rowGap",
  "columnGap",
  "color",
  "backgroundColor",
  "border",
  "borderTop",
  "borderBottom",
  "borderRadius",
  "boxShadow",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "opacity",
  "overflow",
  "overflowX",
  "overflowY",
  "whiteSpace",
  "textOverflow",
  "alignItems",
  "justifyContent",
  "flexDirection",
  "transform",
  "transition",
  "animation",
  "cursor",
  "pointerEvents",
];

const SOURCE_SELECTORS = {
  conversation: "[data-thread-find-target='conversation']",
  turn: "[data-virtualized-turn-content], [data-turn-key], [data-content-search-unit-key]",
  summaryButton: "button[aria-expanded].text-size-chat, button[aria-expanded]",
  activityHeader: ".group\\/activity-header, [class*='group/activity-header']",
  fileReference: "[class*='FileLink'], [class*='fileLink'], [class*='tableCellFileLink'], .codex-file-reference, .thread-diff-virtualized, [class*='turn-diff']",
  userBubble: "[data-user-message-bubble]",
  assistantMarkdown: "._markdownContent_lzkx4_60",
};

const TARGET_SELECTORS = {
  conversation: "[data-thread-find-target='conversation']",
  turn: "[data-codex-virtual-turn], [data-turn-key], [data-content-search-unit-key]",
  summaryButton: "[data-disclosure-toggle], button[aria-expanded].text-size-chat, button[aria-expanded]",
  activityHeader: ".group\\/activity-header, [class*='group/activity-header']",
  fileReference: "._tableCellFileLink_lzkx4_413, [data-file-reference], .thread-diff-virtualized",
  userBubble: "[data-user-message-bubble]",
  assistantMarkdown: "._markdownContent_lzkx4_60",
};

const repoRoot = path.resolve(__dirname, "..");
const outRoot = path.resolve(process.env.ANCHOR_EVIDENCE_DIR || path.join(repoRoot, "reference", "same-anchor-evidence"));
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
const outDir = path.join(outRoot, stamp);
const startedAt = Date.now();

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const anchors = anchorTexts();
  const report = {
    generatedAt: new Date().toISOString(),
    cdp: CDP,
    viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
    sourceURL: SOURCE_URL,
    targetURL: targetURLForRun(),
    targetNodeId: TARGET_NODE_ID,
    targetSessionId: TARGET_SESSION_ID,
    note: "This script captures same-anchor evidence only. It is not a UI parity pass/fail oracle.",
    checks: [],
    setup: {},
    targetAPI: null,
    anchors: [],
  };

  const sourceTarget = await getOrCreateTarget(SOURCE_PATTERN, SOURCE_URL, "source code-server", "", { fresh: false });
  const targetTarget = await getOrCreateTarget(TARGET_PATTERN, report.targetURL, "target Codex Web", sourceTarget.id, { fresh: TARGET_FRESH });
  const sourcePage = await connect(sourceTarget.webSocketDebuggerUrl);
  const targetPage = await connect(targetTarget.webSocketDebuggerUrl);

  try {
    stage("prepare pages");
    await preparePage(sourcePage, SOURCE_URL, { navigate: SOURCE_NAVIGATE });
    await preparePage(targetPage, report.targetURL, { target: true, navigate: TARGET_NAVIGATE });
    if (TARGET_OPEN_SESSION) await openTargetSession(targetPage);

    stage("find conversation contexts");
    const sourceContext = await findCodexContext(sourcePage, "source", SOURCE_SELECTORS);
    const targetContext = await findCodexContext(targetPage, "target", TARGET_SELECTORS);
    report.setup.source = await setupEvidence(sourcePage, sourceContext, SOURCE_SELECTORS, "source");
    report.setup.target = await setupEvidence(targetPage, targetContext, TARGET_SELECTORS, "target");

    addCheck(report, "source conversation context found", isConversationContext(sourceContext), contextDetails(sourceContext));
    addCheck(report, "target conversation context found", isConversationContext(targetContext), contextDetails(targetContext));
    addCheck(report, "source viewport is at least requested size", viewportOK(report.setup.source.top?.viewport), viewportDetails(report.setup.source.top?.viewport));
    addCheck(report, "target viewport is at least requested size", viewportOK(report.setup.target.top?.viewport), viewportDetails(report.setup.target.top?.viewport));
    addCheck(report, "source left Activity Bar detected", Boolean(report.setup.source.top?.layout?.leftActivityBarPresent), JSON.stringify(report.setup.source.top?.layout?.visibleActivityBars || []));
    addCheck(report, "source right auxiliary/chat sidebar closed", Boolean(report.setup.source.top?.layout?.rightSidebarClosed), JSON.stringify(report.setup.source.top?.layout?.visibleAuxiliaryBars || []));
    addCheck(report, "target node and thread loaded", report.setup.target.top?.target?.nodeId === TARGET_NODE_ID && Boolean(report.setup.target.frame?.hasConversation), `node=${report.setup.target.top?.target?.nodeId || ""}; conversation=${Boolean(report.setup.target.frame?.hasConversation)}`);

    report.targetAPI = await fetchTargetSessionRecords(report.targetURL).catch((error) => ({
      ok: false,
      reason: error.message,
      records: [],
      ranges: [],
      eventCount: 0,
    }));
    addCheck(report, "target API records fetched for anchor focus", Boolean(report.targetAPI?.ok), report.targetAPI?.ok ? `events=${report.targetAPI.eventCount}; ranges=${JSON.stringify(report.targetAPI.ranges)}` : report.targetAPI?.reason || "failed");

    if (!isConversationContext(sourceContext) || !isConversationContext(targetContext)) {
      writeReport(report);
      process.exitCode = 1;
      return;
    }

    for (let index = 0; index < anchors.length; index += 1) {
      const anchor = anchors[index];
      stage(`anchor ${index + 1}/${anchors.length}: ${anchor}`);
      const record = {
        index: index + 1,
        anchor,
        contextTerms: [],
        targetAPI: null,
        source: null,
        target: null,
      };

      record.source = await captureAnchorSide({
        page: sourcePage,
        context: sourceContext,
        selectors: SOURCE_SELECTORS,
        side: "source",
        anchor,
        index,
        requiredContextTerms: SOURCE_CONTEXT_TERMS,
      });
      record.contextTerms = contextTermsForAnchor(record.source?.collapsed?.window, anchor);
      record.sourceContextTerms = SOURCE_CONTEXT_TERMS;
      record.targetAPI = matchTargetAPIAnchor(report.targetAPI, anchor, record.contextTerms);

      if (record.targetAPI?.seq && !record.targetAPI.ambiguous) {
        record.targetFocus = await focusTargetSession(targetPage, record.targetAPI.seq, anchorTopForFocus(record.source?.collapsed?.window, sourceContext)).catch((error) => {
          return { ok: false, reason: error.message, seq: record.targetAPI.seq };
        });
      } else if (record.targetAPI?.ambiguous) {
        record.targetFocus = { ok: false, skipped: true, reason: "target API anchor match is ambiguous", candidates: record.targetAPI.candidateSeqs || [] };
      }

      record.target = await captureAnchorSide({
        page: targetPage,
        context: targetContext,
        selectors: TARGET_SELECTORS,
        side: "target",
        anchor,
        index,
        requiredContextTerms: targetDOMContextTerms(record),
        focusSeq: targetDOMFocusSeq(record),
        apiKind: record.targetAPI?.kind || "",
        refocus: record.targetAPI?.seq && !record.targetAPI.ambiguous
          ? () => focusTargetSession(targetPage, record.targetAPI.seq, anchorTopForFocus(record.source?.collapsed?.window, sourceContext))
          : null,
      });

      report.anchors.push(record);
      writeReport(report);
    }

    writeReport(report);
    const missing = report.anchors.filter((item) => !item.source?.initial?.window?.found || !item.target?.initial?.window?.found);
    if (missing.length) process.exitCode = 2;
    else if (report.anchors.some((anchor) => !anchorEvidenceUsability(anchor).ok)) process.exitCode = 3;
  } finally {
    sourcePage.close();
    targetPage.close();
  }
}

function targetDOMContextTerms(record) {
  if (record?.targetAPI?.found && !record.targetAPI.ambiguous && Number(record.targetAPI.eligibleCandidateCount || 0) === 1) return [];
  if (record?.targetAPI?.candidateCount === 1) return [];
  return record?.contextTerms || [];
}

function targetDOMFocusSeq(record) {
  if (!record?.targetAPI?.found || record.targetAPI.ambiguous) return 0;
  if (Number(record.targetAPI.eligibleCandidateCount || 0) !== 1) return 0;
  return Number(record.targetAPI.seq || 0);
}

async function captureAnchorSide({ page, context, selectors, side, anchor, index, requiredContextTerms = [], focusSeq = 0, apiKind = "", refocus = null }) {
  const initial = {
    window: null,
    candidate: null,
    expanded: null,
    disclosureIntent: null,
  };
  const collapsed = {
    window: null,
    screenshot: "",
    enforced: false,
    click: null,
    expanded: null,
    reason: "",
  };
  const expanded = {
    attempted: false,
    clicked: false,
    restored: false,
    screenshot: "",
    window: null,
    after: null,
    expanded: null,
    reason: "",
  };

  initial.window = await withTimeout(`${side} locate ${anchor}`, locateAnchor(page, context.contextId, selectors, anchor, side, requiredContextTerms, focusSeq), ANCHOR_TIMEOUT_MS)
    .catch((error) => ({ found: false, reason: error.message, anchor, side }));
  const disclosureIntent = disclosureIntentForAnchor(anchor, initial.window, apiKind);
  initial.disclosureIntent = disclosureIntent;
  initial.candidate = firstDisclosureCandidate(initial.window);
  initial.expanded = disclosureExpanded(initial.candidate);
  initial.hasDisclosure = Boolean(initial.candidate);
  collapsed.requiresDisclosure = disclosureIntent.requiresDisclosure;
  expanded.requiresDisclosure = disclosureIntent.requiresDisclosure;

  if (!initial.window?.found && disclosureIntent.requiresDisclosure && focusSeq) {
    if (typeof refocus === "function") {
      initial.refocusBeforeParentDisclosure = await refocus()
        .catch((error) => ({ ok: false, reason: error.message, seq: focusSeq }));
      await wait(300);
    }
    const parentCandidate = await findDisclosureControl(page, context.contextId, "已处理", focusSeq)
      .catch(() => null);
    initial.parentCandidate = parentCandidate;
    if (parentCandidate) {
      const parentExpanded = disclosureExpanded(parentCandidate);
      initial.parentExpanded = parentExpanded;
      if (parentExpanded === false || parentExpanded === null) {
        initial.parentExpandClick = await clickControl(page, context, parentCandidate)
          .catch((error) => ({ ok: false, reason: error.message }));
        await wait(350);
      }
      const retriedWindow = await withTimeout(`${side} locate ${anchor} after parent disclosure`, locateAnchor(page, context.contextId, selectors, anchor, side, requiredContextTerms, focusSeq), ANCHOR_TIMEOUT_MS)
        .catch((error) => ({ found: false, reason: error.message, anchor, side }));
      if (retriedWindow?.found) {
        initial.window = retriedWindow;
        initial.recoveredByParentDisclosure = true;
        initial.candidate = firstDisclosureCandidate(initial.window) || parentCandidate;
        initial.expanded = disclosureExpanded(initial.candidate);
        initial.hasDisclosure = Boolean(initial.candidate);
      }
    }
  }

  if (!initial.window?.found) {
    collapsed.window = initial.window;
    collapsed.reason = initial.window?.reason || "anchor not found";
    expanded.reason = collapsed.reason;
    return { initial, collapsed, expanded, disclosureIntent };
  }

  if (!disclosureIntent.requiresDisclosure) {
    collapsed.window = await visibleAnchorSnapshot(page, context.contextId, selectors, anchor, side, requiredContextTerms, focusSeq)
      .catch((error) => ({ found: false, reason: error.message, anchor, side }));
    collapsed.anchorVisible = Boolean(collapsed.window?.found);
    collapsed.candidate = firstDisclosureCandidate(collapsed.window);
    collapsed.expanded = disclosureExpanded(collapsed.candidate);
    collapsed.currentVerified = Boolean(collapsed.window?.found);
    collapsed.reason = collapsed.currentVerified ? disclosureIntent.reason : collapsed.window?.reason || "current anchor snapshot not found";
    collapsed.screenshotWindow = await refreshAnchorBeforeScreenshot(page, context.contextId, selectors, anchor, side, requiredContextTerms, focusSeq);
    collapsed.screenshot = await captureScreenshot(page, `${side}-anchor-${index + 1}-current.png`, { preserveInteractionState: true });
    expanded.reason = `disclosure capture not required: ${disclosureIntent.reason}`;
    return { initial, collapsed, expanded, disclosureIntent };
  }

  if (initial.candidate && initial.expanded === true) {
    const collapseClick = await clickControl(page, context, initial.candidate);
    collapsed.click = collapseClick;
    collapsed.enforced = Boolean(collapseClick.ok);
    await wait(350);
  } else if (initial.candidate && initial.expanded === null) {
    collapsed.reason = "disclosure state is unknown; collapsed state cannot be enforced safely";
  }

  collapsed.window = await visibleAnchorSnapshot(page, context.contextId, selectors, anchor, side, requiredContextTerms, focusSeq)
    .catch((error) => ({ found: false, reason: error.message, anchor, side }));
  collapsed.anchorVisible = Boolean(collapsed.window?.found);
  const collapsedSnapshotCandidate = firstDisclosureCandidate(collapsed.window);
  let collapsedHasDisclosure = Boolean(initial.candidate || collapsedSnapshotCandidate);
  collapsed.expanded = disclosureExpanded(collapsedSnapshotCandidate);
  collapsed.stateVerified = !collapsedHasDisclosure || collapsed.expanded === false;
  if (collapsedHasDisclosure && collapsed.expanded !== false) {
    collapsed.reason = collapsed.reason || `expected collapsed state, got ${stateText(collapsed.expanded)}`;
  }

  const currentCollapsedCandidate = await findDisclosureControl(page, context.contextId, disclosureLookupText(initial.candidate || collapsedSnapshotCandidate))
    .catch(() => null);
  collapsed.candidate = collapsedSnapshotCandidate || currentCollapsedCandidate || null;
  if (collapsed.candidate) {
    collapsedHasDisclosure = true;
    collapsed.expanded = disclosureExpanded(collapsed.candidate) ?? collapsed.expanded;
    collapsed.stateVerified = !collapsedHasDisclosure || collapsed.expanded === false;
    if (collapsedHasDisclosure && collapsed.expanded !== false) {
      collapsed.reason = `expected collapsed state, got ${stateText(collapsed.expanded)}`;
    }
  }
  collapsed.screenshotWindow = await refreshAnchorBeforeScreenshot(page, context.contextId, selectors, anchor, side, requiredContextTerms, focusSeq);
  collapsed.screenshot = await captureScreenshot(page, `${side}-anchor-${index + 1}-${stateScreenshotLabel("collapsed", collapsed.expanded, collapsedHasDisclosure)}.png`, { preserveInteractionState: true });

  const candidate = firstDisclosureCandidate(collapsed.window) || currentCollapsedCandidate || initial.candidate;
  if (!candidate) {
    expanded.reason = "no visible disclosure control near matched anchor";
    return { initial, collapsed, expanded };
  }

  expanded.attempted = true;
  if (collapsed.expanded === true) {
    expanded.clicked = false;
    expanded.reason = "already expanded after collapsed capture; no expand click needed";
  } else {
    const click = await clickControl(page, context, candidate);
    expanded.clicked = Boolean(click.ok);
    expanded.click = click;
    await wait(350);
  }
  expanded.window = await visibleAnchorSnapshot(page, context.contextId, selectors, anchor, side, requiredContextTerms, focusSeq)
    .catch((error) => ({ found: false, reason: error.message, anchor, side }));
  expanded.after = expanded.window;
  const expandedSnapshotCandidate = firstDisclosureCandidate(expanded.window);
  const expandedLookupCandidate = await findDisclosureControl(page, context.contextId, disclosureLookupText(initial.candidate || candidate || expandedSnapshotCandidate))
    .catch(() => null);
  expanded.candidate = expandedSnapshotCandidate || expandedLookupCandidate || null;
  expanded.expanded = disclosureExpanded(expanded.candidate);
  expanded.stateVerified = expanded.expanded === true;
  if (expanded.expanded !== true) expanded.reason = expanded.reason || `expected expanded state, got ${stateText(expanded.expanded)}`;
  expanded.screenshotWindow = await refreshAnchorBeforeScreenshot(page, context.contextId, selectors, anchor, side, requiredContextTerms, focusSeq);
  expanded.screenshot = await captureScreenshot(page, `${side}-anchor-${index + 1}-${stateScreenshotLabel("expanded", expanded.expanded, true)}.png`, { preserveInteractionState: true });

  if (RESTORE_DISCLOSURE_AFTER_CAPTURE && initial.expanded === false && expanded.expanded === true) {
    const restoreCandidate = firstDisclosureCandidate(expanded.window);
    if (restoreCandidate) {
      const restore = await clickControl(page, context, restoreCandidate).catch((error) => ({ ok: false, reason: error.message }));
      expanded.restored = Boolean(restore.ok);
      expanded.restore = restore;
      await wait(160);
    }
  }
  return { initial, collapsed, expanded, disclosureIntent };
}

function firstDisclosureCandidate(windowRecord) {
  const controls = Array.isArray(windowRecord?.disclosures) ? windowRecord.disclosures : [];
  const visible = controls.filter((control) => control?.rect && isDisclosureControl(control));
  const status = visible.find((control) => disclosureTextMatchesStatus(`${control.text || ""} ${control.ariaLabel || ""}`));
  return status || null;
}

function isDisclosureControl(control) {
  if (!control) return false;
  if (controlLooksLikeAttachment(control)) return false;
  const text = `${control.text || ""} ${control.ariaLabel || ""}`;
  const hasState = Boolean(
    String(control.ariaExpanded || "").trim()
    || String(control.detailsOpen || "").trim()
    || String(control.dataDisclosureToggle || "").trim()
    || String(control.tagName || "").toUpperCase() === "SUMMARY",
  );
  return hasState && disclosureTextMatchesStatus(text);
}

function disclosureExpanded(control) {
  const raw = String(control?.ariaExpanded || "").trim().toLowerCase();
  if (raw === "true") return true;
  if (raw === "false") return false;
  const detailsOpen = String(control?.detailsOpen || "").trim().toLowerCase();
  if (detailsOpen === "true") return true;
  if (detailsOpen === "false") return false;
  return null;
}

function disclosureTextMatchesStatus(text) {
  return disclosureAnchorText(text);
}

function controlLooksLikeAttachment(control) {
  const haystack = [
    control?.text || "",
    control?.ariaLabel || "",
    control?.className || "",
    control?.dataDisclosureToggle || "",
  ].join(" ");
  return /(?:\u7528\u6237\u9644\u4ef6|attachment|file upload|image preview|size-20\s+cursor-interaction)/i.test(haystack);
}

function disclosureIntentForAnchor(anchor, windowRecord, apiKind = "") {
  const anchorText = String(anchor || "");
  if (apiKind === "file_change") {
    return {
      requiresDisclosure: false,
      requiresStructuredActivity: true,
      category: "target-api-file-change-anchor",
      reason: "target API identifies this anchor as a file_change event; validate the visible structured file activity card, not the parent processed disclosure",
    };
  }
  if (disclosureAnchorText(anchorText)) {
    return {
      requiresDisclosure: true,
      category: "status-anchor",
      reason: "anchor text targets an official status/disclosure row",
    };
  }
  if (structuredActivityAnchorText(anchorText) && windowRecordHasStructuredActivity(windowRecord)) {
    return {
      requiresDisclosure: false,
      requiresStructuredActivity: true,
      category: "structured-activity-anchor",
      reason: "anchor text targets a file/diff/activity block; validate the visible structured activity, not plain text only",
    };
  }
  if (nodeSignatureIsDisclosure(windowRecord?.matchedAnchorTarget)) {
    return {
      requiresDisclosure: true,
      category: "matched-disclosure-control",
      reason: "matched anchor target is itself a disclosure control",
    };
  }
  return {
    requiresDisclosure: false,
    requiresStructuredActivity: false,
    category: "plain-text-anchor",
    reason: "plain text anchor; validate location, scrolling, DOM ambiguity, and screenshot only",
  };
}

function disclosureAnchorText(text) {
  const value = String(text || "");
  return /(?:\u5df2\u5904\u7406|processed|\u6b63\u5728\u601d\u8003|\u601d\u8003\u4e2d|thinking|\u6b63\u5728\u8fd0\u884c|running|\u8fd0\u884c\u4e2d)/i.test(value);
}

function structuredActivityAnchorText(text) {
  const value = String(text || "").trim();
  if (!value) return false;
  if (/(?:^|\s)(?:diff|patch|modified|edited|created|deleted|renamed|updated)(?:\s|$)/i.test(value)) return true;
  if (/(?:已编辑|已创建|已删除|已修改|再显示)\s*\d+\s*个文件/.test(value)) return true;
  if (/(?:\+\+\+|---|@@\s+-\d+)/.test(value)) return true;
  if (/(?:^|[\s"'(])(?:\.{0,2}\/|~\/|\/root\/|\/home\/|[A-Za-z]:\\)[^\s"'()]+\.[A-Za-z0-9]{1,8}(?:$|[\s"')])/.test(value)) return true;
  if (/(?:^|[\s"'(])[\w.-]+\.(?:go|js|jsx|ts|tsx|css|scss|html|json|md|yaml|yml|toml|sh|ps1|service|cjs|mjs)(?:$|[\s"')])/.test(value)) return true;
  return false;
}

function nodeSignatureIsDisclosure(signature) {
  if (!signature) return false;
  const attrs = signature.attrs || {};
  if (String(attrs["aria-expanded"] || "").trim()) return true;
  if (String(attrs["data-disclosure-toggle"] || "").trim()) return true;
  if (String(signature.tagName || "").toUpperCase() === "SUMMARY") return true;
  return disclosureAnchorText(`${signature.text || ""} ${signature.className || ""} ${attrs["aria-label"] || ""}`);
}

function nodeSignatureIsStructuredActivity(signature) {
  if (!signature) return false;
  const attrs = signature.attrs || {};
  const haystack = [
    signature.tagName || "",
    signature.className || "",
    attrs.class || "",
    attrs.role || "",
    attrs["aria-label"] || "",
    attrs["data-disclosure-toggle"] || "",
    attrs["data-file-reference"] || "",
    attrs["data-codex-event-seq"] || "",
    attrs["data-codex-event-seqs"] || "",
  ].join(" ");
  return /(?:activity-header|group\/activity|turn-diff|thread-diff|tableCellFileLink|FileLink|fileLink|codex-file-reference|conversation-patch|diff-virtualized|resource-card)/i.test(haystack);
}

function disclosureLookupText(control) {
  return [control?.text || "", control?.ariaLabel || "", control?.dataDisclosureToggle || ""]
    .map((value) => String(value || "").trim())
    .find(Boolean) || "";
}

function stateText(expanded) {
  if (expanded === true) return "expanded";
  if (expanded === false) return "collapsed";
  return "unknown";
}

function stateScreenshotLabel(expected, expanded, hasDisclosure) {
  if (!hasDisclosure) return "current";
  if (expected === "collapsed") {
    if (expanded === false) return "collapsed";
    if (expanded === true) return "still-expanded";
    return "collapse-unverified";
  }
  if (expanded === true) return "expanded";
  if (expanded === false) return "still-collapsed";
  return "expand-unverified";
}

async function findDisclosureControl(page, contextId, text, focusSeq = 0) {
  if (!String(text || "").trim()) return null;
  return evalInContext(page, contextId, disclosureControlExpression(text, focusSeq));
}

async function locateAnchor(page, contextId, selectors, anchor, side, requiredContextTerms = [], focusSeq = 0) {
  return evalInContext(page, contextId, locateAnchorExpression(selectors, anchor, side, requiredContextTerms, focusSeq));
}

async function visibleAnchorSnapshot(page, contextId, selectors, anchor, side, requiredContextTerms = [], focusSeq = 0) {
  return evalInContext(page, contextId, visibleAnchorSnapshotExpression(selectors, anchor, side, requiredContextTerms, focusSeq));
}

async function settleContextPaint(page, contextId) {
  if (!contextId) {
    await wait(120);
    return;
  }
  await evalInContext(page, contextId, `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))`)
    .catch(async () => wait(120));
}

async function refreshAnchorBeforeScreenshot(page, contextId, selectors, anchor, side, requiredContextTerms = [], focusSeq = 0) {
  await settleContextPaint(page, contextId);
  const refreshed = await visibleAnchorSnapshot(page, contextId, selectors, anchor, side, requiredContextTerms, focusSeq)
    .catch((error) => ({ found: false, reason: error.message, anchor, side }));
  await settleContextPaint(page, contextId);
  return refreshed;
}

async function clickDisclosureControlByKey(page, context, control) {
  const key = String(control?.dataDisclosureToggle || "").trim();
  if (!key || !context?.contextId) return null;
  return evalInContext(page, context.contextId, clickDisclosureControlByKeyExpression(key));
}

async function clickControl(page, context, control) {
  if (!control?.rect) return { ok: false, reason: "missing control rect" };
  const x = Math.round(Number(control.rect.centerX || 0) + Number(context.frameOffset?.left || 0));
  const y = Math.round(Number(control.rect.centerY || 0) + Number(context.frameOffset?.top || 0));
  if (!x || !y) return { ok: false, reason: "invalid click point", x, y };
  const hitTest = control.hitTest || null;
  if (hitTest && hitTest.selfHit === false && hitTest.containsHit === false) {
    return { ok: false, reason: "hit-test misses disclosure control", x, y, frameOffset: context.frameOffset || null, hitTest };
  }
  const semanticClick = await clickDisclosureControlByKey(page, context, control).catch((error) => ({ ok: false, reason: error.message, method: "dom-click" }));
  if (semanticClick) {
    return { ...semanticClick, x, y, frameOffset: context.frameOffset || null, originalHitTest: hitTest };
  }
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none" });
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  return { ok: true, method: "mouse", x, y, frameOffset: context.frameOffset || null, hitTest };
}

async function setupEvidence(page, context, selectors, side) {
  const [top, frame, screenshot] = await Promise.all([
    evalPage(page, setupTopExpression(side)).catch((error) => ({ error: error.message })),
    context?.contextId ? evalInContext(page, context.contextId, setupFrameExpression(selectors)).catch((error) => ({ error: error.message })) : Promise.resolve(null),
    captureScreenshot(page, `${side}-setup.png`),
  ]);
  return {
    context: context ? contextDetails(context) : "missing",
    top,
    frame,
    screenshot,
  };
}

async function preparePage(page, url, options = {}) {
  await page.send("Page.enable");
  await page.send("Runtime.enable");
  await page.send("DOM.enable").catch(() => {});
  await page.send("Network.enable").catch(() => {});
  await page.send("Network.setCacheDisabled", { cacheDisabled: true }).catch(() => {});
  await page.send("Emulation.setDeviceMetricsOverride", {
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: VIEWPORT_WIDTH,
    screenHeight: VIEWPORT_HEIGHT,
  });
  if (options.target) {
    await evalPage(page, `(() => {
      try {
        localStorage.setItem("codex-web:node-id", ${JSON.stringify(TARGET_NODE_ID)});
        localStorage.setItem("codex-web:sidebar-width", ${JSON.stringify(String(TARGET_SIDEBAR_WIDTH))});
      } catch {}
    })()`).catch(() => {});
  }
  if (options.navigate) {
    await page.send("Page.navigate", { url });
    await waitForLoad(page);
  }
}

async function openTargetSession(page) {
  if (!TARGET_SESSION_ID) return;
  await waitFor(page, `document.querySelector("#codexPanel")?.shadowRoot || document.readyState === "complete"`, 90000, "target app shell");
  await evalPage(page, `(() => {
    try { localStorage.setItem("codex-web:node-id", ${JSON.stringify(TARGET_NODE_ID)}); } catch {}
    window.dispatchEvent(new CustomEvent("codex-web:open-session", {
      detail: { nodeId: ${JSON.stringify(TARGET_NODE_ID)}, sessionId: ${JSON.stringify(TARGET_SESSION_ID)} }
    }));
  })()`);
  await waitFor(page, `Boolean(document.querySelector("#codexPanel")?.shadowRoot?.querySelector("[data-thread-scroll]"))`, 120000, "target thread scroll");
  await wait(800);
}

async function focusTargetSession(page, focusSeq, focusTop) {
  if (!focusSeq) return { ok: false, reason: "missing focus seq" };
  await evalPage(page, `(() => {
    window.dispatchEvent(new CustomEvent("codex-web:open-session", {
      detail: {
        nodeId: ${JSON.stringify(TARGET_NODE_ID)},
        sessionId: ${JSON.stringify(TARGET_SESSION_ID)},
        focusSeq: ${JSON.stringify(Number(focusSeq))},
        focusTop: ${Number.isFinite(Number(focusTop)) ? JSON.stringify(Number(focusTop)) : "null"},
      }
    }));
  })()`);
  await waitFor(page, `(() => {
    const root = document.querySelector("#codexPanel")?.shadowRoot;
    const scroll = root?.querySelector("[data-thread-scroll]");
    if (!root || !scroll) return false;
    const first = Number(scroll.getAttribute("data-history-first-seq") || 0);
    const last = Number(scroll.getAttribute("data-history-last-seq") || 0);
    const focus = ${JSON.stringify(Number(focusSeq))};
    const loading = scroll.getAttribute("data-history-loading-before") === "true";
    const rendered = Array.from(root.querySelectorAll("[data-codex-virtual-turn]")).some((turn) => String(turn.getAttribute("data-codex-turn-seqs") || "")
      .split(",")
      .map((value) => Number(value))
      .includes(focus));
    return !loading && first > 0 && last > 0 && focus >= first && focus <= last && rendered;
  })()`, 120000, `target focus seq ${focusSeq}`);
  await wait(350);
  return { ok: true, seq: focusSeq };
}

async function findCodexContext(page, label, selectors) {
  await wait(500);
  const frameTree = await page.send("Page.getFrameTree").catch(() => null);
  const frames = flattenFrames(frameTree?.frameTree).filter((frame) => frame.id);
  const candidates = [];
  for (const frame of frames) {
    const contextId = await createIsolatedWorld(page, frame.id);
    if (!contextId) continue;
    const probe = await evalInContext(page, contextId, contextProbeExpression(selectors)).catch((error) => ({ error: error.message, score: 0 }));
    const frameOffset = await frameViewportOffset(page, frame.id);
    candidates.push({
      label,
      frameId: frame.id,
      url: frame.url || "",
      contextId,
      frameOffset,
      probe,
      score: Number(probe?.score || 0),
    });
  }
  candidates.sort((left, right) => right.score - left.score);
  return candidates.find((candidate) => candidate.score > 0) || candidates[0] || null;
}

function contextProbeExpression(selectors) {
  return `(() => {
    const selectors = ${JSON.stringify(selectors)};
    const roots = [document, document.querySelector("#codexPanel")?.shadowRoot].filter(Boolean);
    let best = { score: 0, rootKind: "document" };
    for (const root of roots) {
      const hasConversation = Boolean(root.querySelector(selectors.conversation));
      const hasTurn = Boolean(root.querySelector(selectors.turn));
      const hasComposer = Boolean(root.querySelector(".composer-surface-chrome, [data-codex-composer]"));
      const hasUserBubble = Boolean(root.querySelector(selectors.userBubble));
      const hasAssistant = Boolean(root.querySelector(selectors.assistantMarkdown));
      const score = [hasConversation, hasTurn, hasComposer, hasUserBubble, hasAssistant].filter(Boolean).length * 10;
      if (score > best.score) {
        const conversation = root.querySelector(selectors.conversation);
        best = {
          score,
          rootKind: root === document ? "document" : "shadow",
          hasConversation,
          hasTurn,
          hasComposer,
          hasUserBubble,
          hasAssistant,
          url: location.href,
          title: document.title,
          conversationRect: rectOf(conversation),
          textSample: String((conversation || document.body)?.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 600),
        };
      }
    }
    function rectOf(node) {
      if (!node?.getBoundingClientRect) return null;
      const rect = node.getBoundingClientRect();
      return { left: Math.round(rect.left), top: Math.round(rect.top), right: Math.round(rect.right), bottom: Math.round(rect.bottom), width: Math.round(rect.width), height: Math.round(rect.height) };
    }
    return best;
  })()`;
}

function locateAnchorExpression(selectors, anchor, side, requiredContextTerms = [], focusSeq = 0) {
  return `(async () => {
    const selectors = ${JSON.stringify(selectors)};
    const anchor = ${JSON.stringify(anchor)};
    const side = ${JSON.stringify(side)};
    const requiredContextTerms = ${JSON.stringify(requiredContextTerms)};
    const focusSeq = ${JSON.stringify(Number(focusSeq || 0))};
    const maxSteps = ${JSON.stringify(MAX_SCROLL_STEPS)};
    const props = ${JSON.stringify(STYLE_PROPS)};
    const env = makeEnv(selectors, props);
    if (!env.root || !env.scroll) return { found: false, reason: "missing root or scroll", anchor, side, probe: env.probe };
    const initial = env.metrics();
    const positions = scrollPositions(env.scroll, maxSteps);
    for (const position of positions) {
      env.scroll.scrollTop = position;
      env.scroll.dispatchEvent(new Event("scroll", { bubbles: true }));
      await sleep(180);
      const found = collectVisibleAnchor(env, anchor, side, requiredContextTerms, focusSeq);
      if (found.found) return { ...found, initialScroll: initial, searchedPositions: positions.length };
    }
    return {
      found: false,
      reason: "anchor not found in searched virtual windows",
      anchor,
      side,
      initialScroll: initial,
      finalScroll: env.metrics(),
      searchedPositions: positions.length,
      visibleTextSample: String(env.root.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 1200),
    };

    ${browserEvidenceHelpers()}
  })()`;
}

function visibleAnchorSnapshotExpression(selectors, anchor, side, requiredContextTerms = [], focusSeq = 0) {
  return `(() => {
    const selectors = ${JSON.stringify(selectors)};
    const anchor = ${JSON.stringify(anchor)};
    const side = ${JSON.stringify(side)};
    const requiredContextTerms = ${JSON.stringify(requiredContextTerms)};
    const focusSeq = ${JSON.stringify(Number(focusSeq || 0))};
    const props = ${JSON.stringify(STYLE_PROPS)};
    const env = makeEnv(selectors, props);
    if (!env.root || !env.scroll) return { found: false, reason: "missing root or scroll", anchor, side, probe: env.probe };
    return collectVisibleAnchor(env, anchor, side, requiredContextTerms, focusSeq);

    ${browserEvidenceHelpers()}
  })()`;
}

function disclosureControlExpression(text, focusSeq = 0) {
  return `(() => {
    const needle = normalize(${JSON.stringify(text)});
    const focusSeq = ${JSON.stringify(Number(focusSeq || 0))};
    const props = ${JSON.stringify(STYLE_PROPS)};
    const roots = [document, document.querySelector("#codexPanel")?.shadowRoot].filter(Boolean);
    const controls = roots.flatMap((root) => collectDisclosures(root, props));
    const focusedControls = focusSeq ? controls.filter((control) => controlContainsFocusSeq(control, focusSeq)) : controls;
    const searchControls = focusedControls.length ? focusedControls : controls;
    const exact = searchControls.find((control) => {
      const haystack = normalize([control.text || "", control.ariaLabel || ""].join(" "));
      return Boolean(haystack) && (haystack === needle || haystack.includes(needle) || needle.includes(haystack));
    });
    if (exact) return refreshDisclosureControl(exact) || exact;
    const processed = searchControls.find((control) => /(?:\\u5df2\\u5904\\u7406|processed)/i.test(String(control.text || "") + " " + String(control.ariaLabel || "")));
    return processed ? (refreshDisclosureControl(processed) || processed) : null;

    ${browserEvidenceHelpers()}
    function refreshDisclosureControl(control) {
      const node = findDisclosureNode(control);
      if (!node) return null;
      node.scrollIntoView?.({ block: "center", inline: "nearest" });
      const sig = nodeSig(node, props);
      return {
        index: control.index ?? 0,
        tagName: sig?.tagName || "",
        className: sig?.className || "",
        text: rawText(node, 300),
        ariaExpanded: node.getAttribute("aria-expanded") || "",
        ariaLabel: node.getAttribute("aria-label") || "",
        dataDisclosureToggle: node.getAttribute("data-disclosure-toggle") || "",
        detailsOpen: node.tagName === "SUMMARY" && node.parentElement?.tagName === "DETAILS" ? String(Boolean(node.parentElement.open)) : "",
        rect: sig?.rect || null,
        styles: sig?.styles || null,
        hitTest: hitOf(node),
      };
    }
    function findDisclosureNode(control) {
      const roots = [document, document.querySelector("#codexPanel")?.shadowRoot].filter(Boolean);
      for (const root of roots) {
        const matching = Array.from(root.querySelectorAll("[data-disclosure-toggle], button[aria-expanded], summary, [role='button']"))
          .find((node) => disclosureNodeMatchesControl(node, control));
        if (matching) return matching;
      }
      return null;
    }
    function disclosureNodeMatchesControl(node, control) {
      const text = rawText(node, 300);
      if (text !== String(control.text || "")) return false;
      const key = node.getAttribute("data-disclosure-toggle") || "";
      if (key && key === String(control.dataDisclosureToggle || "")) return true;
      const rect = rectOf(node);
      return rect
        && Math.round(rect.left) === Math.round(control.rect?.left || 0)
        && Math.round(rect.top) === Math.round(control.rect?.top || 0);
    }
    function controlContainsFocusSeq(control, seq) {
      if (!control?.nodePath && !seq) return false;
      const roots = [document, document.querySelector("#codexPanel")?.shadowRoot].filter(Boolean);
      for (const root of roots) {
        const matching = Array.from(root.querySelectorAll("[data-disclosure-toggle], button[aria-expanded], summary, [role='button']"))
          .find((node) => disclosureNodeMatchesControl(node, control));
        if (matching && turnContainsSeq(matching.closest("[data-codex-virtual-turn], [data-turn-key], [data-virtualized-turn-content]"), seq)) return true;
      }
      return false;
    }
    function turnContainsSeq(turn, seq) {
      if (!turn || !seq) return false;
      const seqText = [
        turn.getAttribute?.("data-codex-turn-seqs") || "",
        turn.getAttribute?.("data-codex-event-seqs") || "",
        ...Array.from(turn.querySelectorAll("[data-codex-event-seq], [data-codex-event-seqs]")).flatMap((node) => [
          node.getAttribute("data-codex-event-seq") || "",
          node.getAttribute("data-codex-event-seqs") || "",
        ]),
      ].join(" ");
      return seqText
        .split(/[\\s,]+/g)
        .map((value) => Number(value))
        .some((value) => value === Number(seq));
    }
  })()`;
}

function clickDisclosureControlByKeyExpression(key) {
  return `(async () => {
    const key = ${JSON.stringify(String(key || ""))};
    const roots = [document, document.querySelector("#codexPanel")?.shadowRoot].filter(Boolean);
    const findNode = () => {
      for (const root of roots) {
        const node = Array.from(root.querySelectorAll("[data-disclosure-toggle]"))
          .find((item) => item.getAttribute("data-disclosure-toggle") === key);
        if (node) return node;
      }
      return null;
    };
    const node = findNode();
    if (node) {
      node.scrollIntoView?.({ block: "center", inline: "nearest" });
      const before = node.getAttribute("aria-expanded") || "";
      const hitTest = hitOf(node);
      if (hitTest && hitTest.selfHit === false && hitTest.containsHit === false) {
        return {
          ok: false,
          method: "dom-click",
          reason: "hit-test misses disclosure control",
          dataDisclosureToggle: key,
          before,
          hitTest,
        };
      }
      node.click();
      const immediateAfter = node.getAttribute("aria-expanded") || "";
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const settledNode = findNode() || node;
      const after = settledNode.getAttribute("aria-expanded") || "";
      return {
        ok: true,
        method: "dom-click",
        dataDisclosureToggle: key,
        before,
        immediateAfter,
        after,
        tagName: settledNode.tagName,
        className: String(settledNode.className || ""),
        text: rawText(settledNode, 300),
        hitTest,
        afterHitTest: hitOf(settledNode),
      };
    }
    return {
      ok: false,
      method: "dom-click",
      reason: "disclosure control not found by data-disclosure-toggle",
      dataDisclosureToggle: key,
    };

    ${browserEvidenceHelpers()}
  })()`;
}

function browserEvidenceHelpers() {
  return `
    function sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
    function normalize(value) {
      return String(value || "").replace(new RegExp(String.fromCharCode(96) + "+", "g"), "").replace(/\\s+/g, " ").trim().toLowerCase();
    }
    function rawText(node, limit = 2000) {
      return String(node?.textContent || node?.innerText || "").replace(/\\s+/g, " ").trim().slice(0, limit);
    }
    function rectOf(node) {
      if (!node?.getBoundingClientRect) return null;
      const rect = node.getBoundingClientRect();
      const payload = {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
      payload.centerX = Math.round(payload.left + payload.width / 2);
      payload.centerY = Math.round(payload.top + payload.height / 2);
      return payload;
    }
    function stylesOf(node, props) {
      if (!node) return null;
      const style = getComputedStyle(node);
      return Object.fromEntries(props.map((prop) => [prop, style[prop] || ""]));
    }
    function attrsOf(node) {
      if (!node?.attributes) return {};
      const attrs = {};
      for (const attr of Array.from(node.attributes)) attrs[attr.name] = attr.value;
      return attrs;
    }
    function nodeSig(node, props) {
      if (!node) return null;
      return {
        tagName: node.tagName || "",
        id: node.id || "",
        className: typeof node.className === "string" ? node.className : "",
        attrs: attrsOf(node),
        rect: rectOf(node),
        styles: stylesOf(node, props),
        text: rawText(node, 1000),
      };
    }
    function hitOf(node) {
      const rect = rectOf(node);
      if (!rect) return null;
      const root = node.getRootNode?.() || document;
      const hitSource = typeof root.elementFromPoint === "function" ? root : document;
      const hit = hitSource.elementFromPoint(rect.centerX, rect.centerY);
      return {
        x: rect.centerX,
        y: rect.centerY,
        rootKind: root === document ? "document" : "shadow",
        selfHit: hit === node,
        containsHit: Boolean(node.contains?.(hit)),
        hitTagName: hit?.tagName || "",
        hitClassName: typeof hit?.className === "string" ? hit.className : "",
        hitText: rawText(hit, 160),
      };
    }
    function makeEnv(selectors, props) {
      const roots = [document, document.querySelector("#codexPanel")?.shadowRoot].filter(Boolean);
      const root = roots.find((candidate) => candidate.querySelector(selectors.conversation)) || roots.find((candidate) => candidate.querySelector(selectors.turn)) || document;
      const conversation = root.querySelector(selectors.conversation);
      const scroll = root.querySelector("[data-thread-scroll]") || scrollParentOf(conversation || root.querySelector(selectors.turn)) || document.scrollingElement;
      return {
        root,
        conversation,
        scroll,
        props,
        probe: {
          rootKind: root === document ? "document" : "shadow",
          hasConversation: Boolean(conversation),
          hasTurn: Boolean(root.querySelector(selectors.turn)),
          turnCount: root.querySelectorAll(selectors.turn).length,
        },
        metrics() {
          return scroll ? {
            scrollTop: scroll.scrollTop,
            scrollHeight: scroll.scrollHeight,
            clientHeight: scroll.clientHeight,
            flexDirection: getComputedStyle(scroll).flexDirection,
            overflowY: getComputedStyle(scroll).overflowY,
            rect: rectOf(scroll),
          } : null;
        },
      };
    }
    function scrollParentOf(node) {
      for (let current = node; current; current = current.parentElement || current.parentNode?.host || null) {
        if (!current?.getBoundingClientRect) continue;
        const style = getComputedStyle(current);
        if (/(auto|scroll)/.test(style.overflowY) && current.scrollHeight > current.clientHeight + 16) return current;
      }
      return null;
    }
    function scrollPositions(scroll, maxSteps) {
      const max = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
      const step = Math.max(240, Math.floor(scroll.clientHeight * 0.72));
      const current = Math.round(scroll.scrollTop || 0);
      const flex = getComputedStyle(scroll).flexDirection;
      const positions = [];
      const add = (value) => {
        const rounded = Math.round(value);
        if (!positions.includes(rounded)) positions.push(rounded);
      };
      add(current);
      add(0);
      add(max);
      if (flex === "column-reverse" || current < 0) {
        for (let position = -step; position >= -max && positions.length < maxSteps; position -= step) add(position);
        add(-max);
      }
      for (let position = max - step; position >= 0 && positions.length < maxSteps; position -= step) add(position);
      for (let position = step; position <= max && positions.length < maxSteps; position += step) add(position);
      return positions.slice(0, maxSteps);
    }
    function collectVisibleAnchor(env, anchor, side, requiredContextTerms = [], focusSeq = 0) {
      const needle = normalize(anchor);
      const turns = Array.from(env.root.querySelectorAll(selectors.turn));
      const focus = Number(focusSeq || 0);
      const focusedTurns = focus > 0 ? turns.filter((turn) => turnContainsSeq(turn, focus)) : [];
      const candidates = focusedTurns.length
        ? focusedTurns
        : turns.length
        ? turns
        : Array.from(env.root.querySelectorAll("article, section, div, li, p")).slice(0, 500);
      const required = Array.isArray(requiredContextTerms)
        ? requiredContextTerms.map((term) => normalize(term)).filter(Boolean)
        : [];
      const minContextHits = contextThreshold(required.length);
      const leadTerms = required.slice(0, Math.min(8, required.length));
      const minLeadHits = leadContextThreshold(leadTerms.length);
      const matches = candidates
        .map((node) => {
          const text = normalize(rawText(node, 12000));
          const contextHits = required.filter((term) => text.includes(term));
          const leadContextHits = leadTerms.filter((term) => text.includes(term));
          return { node, text, contextHits, leadContextHits };
        })
        .filter((entry) => entry.text.includes(needle));
      const semanticMatches = compactEquivalentMatches(matches);
      const eligibleMatches = semanticMatches.filter((entry) => entry.contextHits.length >= minContextHits && entry.leadContextHits.length >= minLeadHits);
      const matchEntry = eligibleMatches[0] || null;
      const match = matchEntry?.node || null;
      if (!match) {
        return {
          found: false,
          reason: matches.length && required.length
            ? "anchor visible but official context terms did not match"
            : "anchor not visible in current virtual window",
          anchor,
          side,
          requiredContextTerms,
          candidateCount: matches.length,
          semanticCandidateCount: semanticMatches.length,
          eligibleCandidateCount: eligibleMatches.length,
          ambiguous: false,
          requiredContextHits: semanticMatches.map((entry) => entry.contextHits),
          requiredLeadContextHits: semanticMatches.map((entry) => entry.leadContextHits),
          candidateSummaries: semanticMatches.slice(0, 12).map((entry) => matchSummary(entry)),
          minContextHits,
          minLeadHits,
          focusSeq: focus,
          focusedTurnCount: focusedTurns.length,
          scroll: env.metrics(),
          visibleTurnCount: turns.length,
          visibleTextSample: rawText(env.conversation || env.root, 1200),
        };
      }
      const anchorTarget = deepestAnchorTarget(match, needle) || match;
      anchorTarget.scrollIntoView?.({ block: "center", inline: "nearest" });
      const scroll = env.metrics();
      return {
        found: true,
        anchor,
        side,
        requiredContextTerms,
        candidateCount: matches.length,
        semanticCandidateCount: semanticMatches.length,
        eligibleCandidateCount: eligibleMatches.length,
        ambiguous: eligibleMatches.length > 1,
        candidateSummaries: eligibleMatches.slice(0, 12).map((entry) => matchSummary(entry)),
        contextHits: matchEntry?.contextHits || [],
        leadContextHits: matchEntry?.leadContextHits || [],
        minContextHits,
        minLeadHits,
        focusSeq: focus,
        focusedTurnCount: focusedTurns.length,
        scroll,
        matchedTurn: nodeSig(match, env.props),
        matchedAnchorTarget: nodeSig(anchorTarget, env.props),
        matchedAnchorSnippet: snippet(rawText(match, 8000), anchor),
        turnKey: match.getAttribute?.("data-turn-key") || match.querySelector?.("[data-turn-key]")?.getAttribute("data-turn-key") || "",
        turnSeqs: match.getAttribute?.("data-codex-turn-seqs") || match.getAttribute?.("data-codex-event-seqs") || "",
        disclosures: collectDisclosures(match, env.props),
        activityHeaders: Array.from(match.querySelectorAll(selectors.activityHeader)).slice(0, 8).map((node) => nodeSig(node, env.props)),
        fileReferences: Array.from(match.querySelectorAll(selectors.fileReference)).slice(0, 12).map((node) => nodeSig(node, env.props)),
        assistantBlocks: Array.from(match.querySelectorAll(selectors.assistantMarkdown)).slice(0, 6).map((node) => nodeSig(node, env.props)),
        counts: {
          turns: turns.length,
          disclosures: match.querySelectorAll("[data-disclosure-toggle], button[aria-expanded], summary").length,
          activityHeaders: match.querySelectorAll(selectors.activityHeader).length,
          fileReferences: match.querySelectorAll(selectors.fileReference).length,
        },
      };
    }
    function turnContainsSeq(turn, seq) {
      if (!turn || !seq) return false;
      const seqText = [
        turn.getAttribute?.("data-codex-turn-seqs") || "",
        turn.getAttribute?.("data-codex-event-seqs") || "",
        ...Array.from(turn.querySelectorAll("[data-codex-event-seq], [data-codex-event-seqs]")).flatMap((node) => [
          node.getAttribute("data-codex-event-seq") || "",
          node.getAttribute("data-codex-event-seqs") || "",
        ]),
      ].join(" ");
      return seqText
        .split(/[\\s,]+/g)
        .map((value) => Number(value))
        .some((value) => value === Number(seq));
    }
    function matchSummary(entry) {
      const node = entry.node;
      return {
        equivalentCandidateCount: entry.equivalentCandidateCount || 1,
        semanticKey: semanticKeyOf(node),
        contextHits: entry.contextHits,
        leadContextHits: entry.leadContextHits,
        rect: rectOf(node),
        turnKey: node.getAttribute?.("data-turn-key") || "",
        turnSeqs: node.getAttribute?.("data-codex-turn-seqs") || node.getAttribute?.("data-codex-event-seqs") || "",
        text: String(entry.text || "").slice(0, 320),
      };
    }
    function compactEquivalentMatches(entries) {
      const groups = [];
      for (const entry of entries) {
        const group = groups.find((candidate) => candidate.some((other) => equivalentMatch(entry, other)));
        if (group) group.push(entry);
        else groups.push([entry]);
      }
      return groups.map((group) => {
        const representative = group.slice().sort((left, right) => {
          const context = right.contextHits.length - left.contextHits.length;
          if (context) return context;
          const lead = right.leadContextHits.length - left.leadContextHits.length;
          if (lead) return lead;
          return right.text.length - left.text.length;
        })[0];
        return { ...representative, equivalentCandidateCount: group.length };
      });
    }
    function equivalentMatch(left, right) {
      const leftKey = semanticKeyOf(left.node);
      const rightKey = semanticKeyOf(right.node);
      if (leftKey && rightKey && leftKey === rightKey) return true;
      return Boolean(left.node?.contains?.(right.node) || right.node?.contains?.(left.node));
    }
    function semanticKeyOf(node) {
      if (!node?.getAttribute) return "";
      return node.getAttribute("data-turn-key")
        || node.closest?.("[data-turn-key]")?.getAttribute("data-turn-key")
        || node.getAttribute("data-content-search-unit-key")
        || node.closest?.("[data-content-search-unit-key]")?.getAttribute("data-content-search-unit-key")
        || node.getAttribute("data-codex-turn-seqs")
        || node.closest?.("[data-codex-turn-seqs]")?.getAttribute("data-codex-turn-seqs")
        || "";
    }
    function contextThreshold(count) {
      if (count <= 0) return 0;
      if (count <= 2) return count;
      if (count <= 5) return 2;
      return Math.min(10, Math.max(4, Math.ceil(count * 0.35)));
    }
    function leadContextThreshold(count) {
      if (count <= 0) return 0;
      if (count <= 2) return count;
      return Math.min(4, Math.max(2, Math.ceil(count * 0.4)));
    }
    function deepestAnchorTarget(root, needle) {
      let best = null;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      for (let node = walker.currentNode; node; node = walker.nextNode()) {
        if (!normalize(rawText(node, 4000)).includes(needle)) continue;
        if (!best || (node.textContent || "").length < (best.textContent || "").length) best = node;
      }
      return best;
    }
    function collectDisclosures(root, props) {
      return Array.from(root.querySelectorAll("[data-disclosure-toggle], button[aria-expanded], summary, [role='button']"))
        .map((node, index) => {
          const sig = nodeSig(node, props);
          return {
            index,
            tagName: sig?.tagName || "",
            className: sig?.className || "",
            text: rawText(node, 300),
            ariaExpanded: node.getAttribute("aria-expanded") || "",
            ariaLabel: node.getAttribute("aria-label") || "",
            dataDisclosureToggle: node.getAttribute("data-disclosure-toggle") || "",
            detailsOpen: node.tagName === "SUMMARY" && node.parentElement?.tagName === "DETAILS" ? String(Boolean(node.parentElement.open)) : "",
            rect: sig?.rect || null,
            styles: sig?.styles || null,
            hitTest: hitOf(node),
          };
        })
        .filter((item) => item.rect && item.rect.width > 0 && item.rect.height > 0)
        .slice(0, 24);
    }
    function snippet(text, anchor) {
      const normalized = normalize(text);
      const needle = normalize(anchor);
      const index = normalized.indexOf(needle);
      if (index < 0) return text.slice(0, 1000);
      return text.slice(Math.max(0, index - 400), Math.min(text.length, index + anchor.length + 800));
    }
  `;
}

function setupTopExpression(side) {
  return `(() => {
    const side = ${JSON.stringify(side)};
    const rectOf = (node) => {
      if (!node?.getBoundingClientRect) return null;
      const rect = node.getBoundingClientRect();
      return { left: Math.round(rect.left), top: Math.round(rect.top), right: Math.round(rect.right), bottom: Math.round(rect.bottom), width: Math.round(rect.width), height: Math.round(rect.height) };
    };
    const styleOf = (node) => {
      if (!node) return null;
      const style = getComputedStyle(node);
      return { display: style.display, visibility: style.visibility, opacity: style.opacity, position: style.position, pointerEvents: style.pointerEvents };
    };
    const infoOf = (node) => node ? {
      tagName: node.tagName,
      id: node.id || "",
      className: typeof node.className === "string" ? node.className : "",
      ariaLabel: node.getAttribute("aria-label") || "",
      title: node.getAttribute("title") || "",
      role: node.getAttribute("role") || "",
      rect: rectOf(node),
      style: styleOf(node),
      text: String(node.textContent || node.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 240),
    } : null;
    const all = (selector) => Array.from(document.querySelectorAll(selector));
    const visible = (entry) => {
      const rect = entry?.rect;
      const style = entry?.style;
      return Boolean(rect && rect.width > 0 && rect.height > 0 && style?.display !== "none" && style?.visibility !== "hidden" && Number(style?.opacity || 1) !== 0);
    };
    const activityBars = all(".monaco-workbench .part.activitybar, .part.activitybar, [class*='activitybar']").map(infoOf).filter(Boolean);
    const visibleActivityBars = activityBars.filter(visible);
    const auxiliaryBars = all("#workbench\\\\.parts\\\\.auxiliarybar, .monaco-workbench .part.auxiliarybar, .part.auxiliarybar, .auxiliarybar.basepanel").map(infoOf).filter(Boolean);
    const visibleAuxiliaryBars = auxiliaryBars.filter(visible);
    const panel = document.querySelector("#codexPanel");
    const shadow = panel?.shadowRoot || null;
    const threadScroll = shadow?.querySelector("[data-thread-scroll]");
    return {
      side,
      url: location.href,
      title: document.title,
      readyState: document.readyState,
      viewport: { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio },
      layout: {
        activityBars,
        visibleActivityBars,
        leftActivityBarPresent: visibleActivityBars.some((entry) => entry.rect.left <= 8 && entry.rect.width >= 30),
        auxiliaryBars,
        visibleAuxiliaryBars,
        rightSidebarClosed: visibleAuxiliaryBars.every((entry) => entry.rect.width <= 5 || entry.rect.left >= window.innerWidth - 5),
      },
      target: side === "target" ? {
        nodeId: (() => { try { return localStorage.getItem("codex-web:node-id") || ""; } catch { return ""; } })(),
        sidebarWidth: (() => { try { return localStorage.getItem("codex-web:sidebar-width") || ""; } catch { return ""; } })(),
        hasCodexPanel: Boolean(panel),
        hasShadowRoot: Boolean(shadow),
        hasThreadScroll: Boolean(threadScroll),
        threadScrollRect: rectOf(threadScroll),
      } : null,
    };
  })()`;
}

function setupFrameExpression(selectors) {
  return `(() => {
    const selectors = ${JSON.stringify(selectors)};
    const roots = [document, document.querySelector("#codexPanel")?.shadowRoot].filter(Boolean);
    const root = roots.find((candidate) => candidate.querySelector(selectors.conversation)) || document;
    const conversation = root.querySelector(selectors.conversation);
    const turns = Array.from(root.querySelectorAll(selectors.turn));
    return {
      url: location.href,
      title: document.title,
      readyState: document.readyState,
      rootKind: root === document ? "document" : "shadow",
      hasConversation: Boolean(conversation),
      hasTurn: turns.length > 0,
      turnCount: turns.length,
      hasThreadScroll: Boolean(root.querySelector("[data-thread-scroll]")),
      hasComposer: Boolean(root.querySelector(".composer-surface-chrome, [data-codex-composer]")),
      textSample: String((conversation || document.body)?.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 1200),
    };
  })()`;
}

async function fetchTargetSessionRecords(targetURL) {
  if (!TARGET_NODE_ID || !TARGET_SESSION_ID) return { ok: false, reason: "missing target node/session", records: [], ranges: [], eventCount: 0 };
  const base = new URL(targetURL);
  let beforeSeq = 0;
  const records = [];
  const ranges = [];
  for (let page = 0; page < 10; page += 1) {
    const url = new URL(`/api/sessions/${encodeURIComponent(TARGET_SESSION_ID)}/events`, base.origin);
    url.searchParams.set("nodeId", TARGET_NODE_ID);
    url.searchParams.set("limit", "2000");
    url.searchParams.set("compact", "true");
    url.searchParams.set("fileDetails", "true");
    if (beforeSeq > 0) url.searchParams.set("beforeSeq", String(beforeSeq));
    const response = await fetch(url);
    if (!response.ok) return { ok: false, reason: `${url}: ${response.status} ${response.statusText}`, records, ranges, eventCount: records.length };
    const payload = await response.json();
    const events = Array.isArray(payload.events) ? payload.events : [];
    if (!events.length) break;
    ranges.push([events[0]?.seq || 0, events.at(-1)?.seq || 0]);
    for (const event of events) records.push(apiRecord(event));
    const firstSeq = Number(events[0]?.seq || 0);
    if (!firstSeq || firstSeq <= 1) break;
    beforeSeq = firstSeq;
  }
  return { ok: true, records, ranges, eventCount: records.length };
}

function apiRecord(event) {
  const data = event?.data && typeof event.data === "object" ? event.data : {};
  const searchableData = event?.kind === "summary" ? omitSummaryDuplicateFields(data) : data;
  return {
    seq: Number(event?.seq || 0),
    kind: event?.kind || "",
    text: [
      event?.text || "",
      data.text || "",
      data.message || "",
      data.html || "",
      data.name || "",
      data.arguments || "",
      JSON.stringify(data.args || {}),
      deepText(event?.items),
      deepText(data.items),
      deepText(searchableData),
      fileText(data.files),
    ].join("\n"),
  };
}

function omitSummaryDuplicateFields(data) {
  if (!data || typeof data !== "object") return {};
  const copy = { ...data };
  delete copy.last_agent_message;
  delete copy.lastAgentMessage;
  return copy;
}

function deepText(value, depth = 0, budget = { chars: 0 }) {
  if (value == null || budget.chars > 12000 || depth > 6) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const text = String(value);
    budget.chars += text.length;
    return text;
  }
  if (Array.isArray(value)) return value.map((item) => deepText(item, depth + 1, budget)).filter(Boolean).join("\n");
  if (typeof value === "object") {
    return Object.entries(value)
      .filter(([key]) => !/^(base64|blob|image|audio|bytes)$/i.test(key))
      .map(([, item]) => deepText(item, depth + 1, budget))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function fileText(files) {
  if (!Array.isArray(files)) return "";
  return files.map((file) => [
    file.path,
    file.name,
    file.status,
    file.patch,
    file.diff,
    Array.isArray(file.lines) ? file.lines.map((line) => line.text || line.content || "").join("\n") : "",
  ].filter(Boolean).join("\n")).join("\n");
}

function matchTargetAPIAnchor(api, anchor, contextTerms = []) {
  if (!api?.ok) return { checked: false, found: false, reason: api?.reason || "target API unavailable" };
  const needle = normalize(anchor);
  const required = Array.isArray(contextTerms) ? contextTerms.map(normalize).filter(Boolean) : [];
  const minContextHits = contextThreshold(required.length);
  const leadTerms = required.slice(0, Math.min(8, required.length));
  const minLeadHits = leadContextThreshold(leadTerms.length);
  const entries = api.records
    .map((record) => {
      const text = normalize(record.text);
      const contextText = normalize(apiNeighborhoodText(api.records, record));
      const contextHits = required.filter((term) => contextText.includes(term));
      const leadContextHits = leadTerms.filter((term) => contextText.includes(term));
      return { record, text, contextText, contextHits, leadContextHits };
    })
    .filter((entry) => Number(entry.record.seq || 0) > 0);
  const textCandidates = entries.filter((entry) => entry.text.includes(needle));
  const candidates = TARGET_API_KIND
    ? textCandidates.filter((entry) => entry.record.kind === TARGET_API_KIND)
    : textCandidates;

  if (TARGET_FOCUS_SEQ > 0) {
    const override = entries.find((entry) => Number(entry.record.seq || 0) === TARGET_FOCUS_SEQ) || null;
    if (!override) {
      return {
        checked: true,
        found: false,
        reason: `TARGET_FOCUS_SEQ ${TARGET_FOCUS_SEQ} was not found in fetched target API records`,
        candidateCount: textCandidates.length,
        eligibleCandidateCount: 0,
        ambiguous: false,
        override: { seq: TARGET_FOCUS_SEQ, kind: TARGET_API_KIND || "" },
        candidateSeqs: textCandidates.slice(0, 20).map((entry) => ({ seq: entry.record.seq, kind: entry.record.kind })),
      };
    }
    const kindMatches = !TARGET_API_KIND || override.record.kind === TARGET_API_KIND;
    const textMatches = override.text.includes(needle);
    if (!kindMatches || !textMatches) {
      return {
        checked: true,
        found: false,
        reason: `TARGET_FOCUS_SEQ ${TARGET_FOCUS_SEQ} did not match ${!kindMatches ? `kind ${TARGET_API_KIND}` : "anchor text"}`,
        candidateCount: textCandidates.length,
        eligibleCandidateCount: 0,
        ambiguous: false,
        override: { seq: TARGET_FOCUS_SEQ, expectedKind: TARGET_API_KIND || "", actualKind: override.record.kind, textMatches },
        candidateSeqs: textCandidates.slice(0, 20).map((entry) => ({ seq: entry.record.seq, kind: entry.record.kind })),
      };
    }
    return {
      checked: true,
      found: true,
      seq: override.record.seq,
      kind: override.record.kind,
      ambiguous: false,
      candidateCount: textCandidates.length,
      eligibleCandidateCount: 1,
      candidateSeqs: [{ seq: override.record.seq, kind: override.record.kind }],
      contextHits: override.contextHits,
      leadContextHits: override.leadContextHits,
      contextMatched: override.contextHits.length >= minContextHits && override.leadContextHits.length >= minLeadHits,
      manualOverride: true,
      override: { seq: TARGET_FOCUS_SEQ, kind: TARGET_API_KIND || "" },
      minContextHits,
      minLeadHits,
    };
  }

  const uniqueCandidateMatch = candidates.length === 1 ? candidates : [];
  const contextEligibleMatches = candidates.filter((entry) => entry.contextHits.length >= minContextHits && entry.leadContextHits.length >= minLeadHits);
  const eligibleMatches = uniqueCandidateMatch.length ? uniqueCandidateMatch : contextEligibleMatches;
  const match = eligibleMatches[0] || null;
  return match
    ? {
      checked: true,
      found: true,
      seq: match.record.seq,
      kind: match.record.kind,
      ambiguous: eligibleMatches.length > 1,
      candidateCount: candidates.length,
      eligibleCandidateCount: eligibleMatches.length,
      candidateSeqs: eligibleMatches.slice(0, 20).map((entry) => ({ seq: entry.record.seq, kind: entry.record.kind })),
      contextHits: match.contextHits,
      leadContextHits: match.leadContextHits,
      contextMatched: match.contextHits.length >= minContextHits && match.leadContextHits.length >= minLeadHits,
      uniqueCandidateFallback: Boolean(uniqueCandidateMatch.length && !contextEligibleMatches.length),
      minContextHits,
      minLeadHits,
    }
    : {
      checked: true,
      found: false,
      reason: candidates.length && required.length
        ? "anchor found in target API but official context terms did not match"
        : "anchor not found in fetched target API records",
      candidateCount: candidates.length,
      eligibleCandidateCount: eligibleMatches.length,
      ambiguous: false,
      minContextHits,
      minLeadHits,
      requiredContextTerms: contextTerms,
      candidateSeqs: candidates.slice(0, 20).map((entry) => ({ seq: entry.record.seq, kind: entry.record.kind })),
      candidateContextHits: candidates.slice(0, 12).map((entry) => entry.contextHits),
      candidateLeadContextHits: candidates.slice(0, 12).map((entry) => entry.leadContextHits),
    };
}

function apiNeighborhoodText(records, record, radius = 8) {
  const ordered = [...(Array.isArray(records) ? records : [])]
    .filter((item) => Number.isFinite(Number(item?.seq)))
    .sort((left, right) => Number(left.seq) - Number(right.seq));
  const index = ordered.findIndex((item) => Number(item.seq) === Number(record?.seq));
  if (index < 0) return record?.text || "";
  return ordered
    .slice(Math.max(0, index - radius), Math.min(ordered.length, index + radius + 1))
    .map((item) => item?.text || "")
    .join("\n");
}

function contextTermsForAnchor(windowRecord, anchor) {
  const source = [
    windowRecord?.matchedAnchorSnippet || "",
    windowRecord?.matchedTurn?.text || "",
  ].join(" ");
  if (!source.trim()) return [];
  const anchorTerms = new Set(stableTerms(anchor).map(normalize));
  const terms = [];
  for (const term of stableTerms(source)) {
    const normalized = normalize(term);
    if (!normalized || anchorTerms.has(normalized)) continue;
    if (STOP_CONTEXT_TERMS.has(normalized)) continue;
    if (terms.some((existing) => existing === normalized || existing.includes(normalized) || normalized.includes(existing))) continue;
    terms.push(normalized);
    if (terms.length >= 24) break;
  }
  return terms;
}

function stableTerms(text) {
  return Array.from(String(text || "").matchAll(/[A-Za-z0-9_./:@#-]{4,}|[\u4e00-\u9fff]{4,}/g))
    .map((match) => match[0])
    .filter((term) => term.length >= 4 && term.length <= 80);
}

function contextThreshold(count) {
  if (count <= 0) return 0;
  if (count <= 2) return count;
  if (count <= 5) return 2;
  return Math.min(10, Math.max(4, Math.ceil(count * 0.35)));
}

function leadContextThreshold(count) {
  if (count <= 0) return 0;
  if (count <= 2) return count;
  return Math.min(4, Math.max(2, Math.ceil(count * 0.4)));
}

function anchorTopForFocus(sourceWindow, sourceContext) {
  const top = Number(sourceWindow?.matchedAnchorTarget?.rect?.top || sourceWindow?.matchedTurn?.rect?.top || NaN);
  if (!Number.isFinite(top)) return NaN;
  return top + Number(sourceContext?.frameOffset?.top || 0);
}

function targetURLForRun() {
  try {
    const url = new URL(TARGET_URL);
    if (TARGET_NODE_ID && !url.searchParams.has("nodeId")) url.searchParams.set("nodeId", TARGET_NODE_ID);
    url.searchParams.set("sameAnchorRun", stamp);
    return url.toString();
  } catch {
    return TARGET_URL;
  }
}

function anchorTexts() {
  const raw = process.env.ANCHORS || "";
  return (raw ? splitEnvList(raw) : DEFAULT_ANCHORS)
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function envTerms(raw) {
  return splitEnvList(raw)
    .map(normalize)
    .filter(Boolean);
}

function splitEnvList(raw) {
  return String(raw || "").split(/\|\||\r?\n/g);
}

async function getOrCreateTarget(pattern, url, label, excludedID = "", options = {}) {
  const targets = await readJSON(`${CDP}/json/list`);
  const pages = targets.filter((target) => target.type === "page" && target.webSocketDebuggerUrl && target.id !== excludedID);
  if (!options.fresh) {
    const existing = pages.find((target) => pattern.test(`${target.url || ""} ${target.title || ""}`));
    if (existing) return existing;
  }
  stage(`open ${label}: ${url}`);
  const response = await fetch(`${CDP}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  if (!response.ok) throw new Error(`create ${label} target: ${response.status} ${response.statusText}`);
  return response.json();
}

async function createIsolatedWorld(page, frameId) {
  const result = await page.send("Page.createIsolatedWorld", {
    frameId,
    worldName: `codex-same-anchor-${Date.now()}`,
    grantUniveralAccess: true,
  }).catch(() => null);
  return result?.executionContextId || null;
}

async function frameViewportOffset(page, frameId) {
  const zero = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  const owner = await page.send("DOM.getFrameOwner", { frameId }).catch(() => null);
  if (!owner?.backendNodeId) return zero;
  const model = await page.send("DOM.getBoxModel", { backendNodeId: owner.backendNodeId }).catch(() => null);
  const quad = model?.model?.border || model?.model?.content || [];
  if (!Array.isArray(quad) || quad.length < 8) return zero;
  const xs = [quad[0], quad[2], quad[4], quad[6]].map(Number).filter(Number.isFinite);
  const ys = [quad[1], quad[3], quad[5], quad[7]].map(Number).filter(Number.isFinite);
  if (!xs.length || !ys.length) return zero;
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  return { left: Math.round(left), top: Math.round(top), right: Math.round(right), bottom: Math.round(bottom), width: Math.round(right - left), height: Math.round(bottom - top) };
}

function flattenFrames(node, out = []) {
  if (!node?.frame) return out;
  out.push(node.frame);
  for (const child of node.childFrames || []) flattenFrames(child, out);
  return out;
}

function isConversationContext(context) {
  return Boolean(context?.contextId && context.probe?.hasConversation && context.probe?.hasTurn);
}

function contextDetails(context) {
  if (!context) return "missing";
  const probe = context.probe || {};
  return `frame=${context.frameId}; score=${context.score}; root=${probe.rootKind || ""}; conversation=${Boolean(probe.hasConversation)}; turns=${Boolean(probe.hasTurn)}; url=${context.url || probe.url || ""}; error=${probe.error || ""}`;
}

function viewportOK(viewport) {
  return Number(viewport?.width || 0) >= VIEWPORT_WIDTH && Number(viewport?.height || 0) >= VIEWPORT_HEIGHT;
}

function viewportDetails(viewport) {
  return viewport ? `${viewport.width}x${viewport.height} dpr=${viewport.devicePixelRatio}` : "missing";
}

function addCheck(report, name, ok, details) {
  report.checks.push({ name, ok: Boolean(ok), details: String(details || "") });
}

function normalize(value) {
  return String(value || "").replace(/`+/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

async function captureScreenshot(page, fileName, options = {}) {
  if (!CAPTURE_SCREENSHOT) return "";
  if (options.preserveInteractionState) await movePointerAway(page);
  else await neutralizePage(page);
  const file = path.join(outDir, fileName);
  const result = await page.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false, fromSurface: true }).catch(() => null);
  if (!result?.data) return "";
  fs.writeFileSync(file, Buffer.from(result.data, "base64"));
  return path.relative(repoRoot, file).replace(/\\/g, "/");
}

async function neutralizePage(page) {
  await movePointerAway(page);
  for (let index = 0; index < 2; index += 1) {
    await page.send("Input.dispatchKeyEvent", {
      type: "rawKeyDown",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
      nativeVirtualKeyCode: 27,
    }).catch(() => {});
    await page.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
      nativeVirtualKeyCode: 27,
    }).catch(() => {});
  }
  await wait(120);
}

async function movePointerAway(page) {
  const x = Math.max(720, VIEWPORT_WIDTH - 120);
  const y = 84;
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none" }).catch(() => {});
  await wait(40);
}

function anchorEvidenceUsability(anchor) {
  const problems = [];
  const warnings = [];
  collectSideEvidenceProblems("source", anchor.source, problems, warnings);
  collectSideEvidenceProblems("target", anchor.target, problems, warnings);
  collectTargetAPIAnchorProblems(anchor.targetAPI, problems);
  return { ok: problems.length === 0, problems, warnings };
}

function collectTargetAPIAnchorProblems(targetAPI, problems) {
  if (!targetAPI?.checked) {
    problems.push(`target API anchor match was not checked: ${targetAPI?.reason || "missing target API result"}`);
    return;
  }
  if (!targetAPI.found) {
    problems.push(`target API anchor match was not uniquely found: ${targetAPI.reason || "not found"}; candidates=${targetAPI.candidateCount ?? "unknown"}; eligible=${targetAPI.eligibleCandidateCount ?? "unknown"}`);
    return;
  }
  if (targetAPI.ambiguous || Number(targetAPI.eligibleCandidateCount || 0) !== 1) {
    problems.push(`target API anchor match is ambiguous: candidates=${targetAPI.candidateCount ?? "unknown"}; eligible=${targetAPI.eligibleCandidateCount ?? "unknown"}; seqs=${JSON.stringify(targetAPI.candidateSeqs || [])}`);
  }
}

function collectSideEvidenceProblems(side, record, problems, warnings) {
  if (!record?.initial?.window?.found) {
    problems.push(`${side} anchor not found: ${record?.initial?.window?.reason || "missing initial window"}`);
    return;
  }
  for (const phase of ["initial", "collapsed", "expanded"]) {
    const windowRecord = phase === "initial" ? record.initial?.window : record[phase]?.window;
    if (windowRecord?.ambiguous) {
      problems.push(`${side} ${phase} DOM anchor match is ambiguous: ${windowRecord.eligibleCandidateCount || windowRecord.candidateCount || "unknown"} candidates`);
    }
  }
  const intent = record.disclosureIntent || record.initial?.disclosureIntent || {
    requiresDisclosure: false,
    reason: "missing disclosure intent; treating as plain text to avoid inferred disclosure state",
  };
  if (intent.requiresStructuredActivity && !sideHasStructuredActivity(record)) {
    problems.push(`${side} structured activity anchor is not verified: ${intent.reason}`);
    return;
  }
  const hasDisclosure = Boolean(record.initial?.candidate || record.collapsed?.candidate || record.expanded?.candidate);
  if (!intent.requiresDisclosure) {
    if (record.collapsed?.currentVerified !== true) {
      problems.push(`${side} current anchor snapshot is not verified: ${record.collapsed?.reason || "missing current snapshot"}`);
      return;
    }
    if (hasDisclosure) warnings.push(`${side} disclosure present but not required: ${intent.reason}`);
    return;
  }
  if (!hasDisclosure) {
    problems.push(`${side} disclosure required but no disclosure control was found: ${intent.reason}`);
    return;
  }
  if (record.collapsed?.stateVerified !== true) {
    problems.push(`${side} collapsed state is not verified: ${record.collapsed?.reason || stateText(record.collapsed?.expanded)}`);
  }
  if (record.expanded?.attempted !== true) {
    problems.push(`${side} expanded capture was not attempted for a disclosure`);
  } else if (record.expanded?.stateVerified !== true) {
    problems.push(`${side} expanded state is not verified: ${record.expanded?.reason || stateText(record.expanded?.expanded)}`);
  }
}

function sideHasStructuredActivity(record) {
  return windowRecordHasStructuredActivity(record?.collapsed?.window)
    || windowRecordHasStructuredActivity(record?.initial?.window)
    || windowRecordHasStructuredActivity(record?.expanded?.window);
}

function windowRecordHasStructuredActivity(windowRecord) {
  if (!windowRecord) return false;
  if (nodeSignatureIsStructuredActivity(windowRecord.matchedAnchorTarget)) return true;
  if (nodeSignatureIsStructuredActivity(windowRecord.matchedTurn)) return true;
  if (Array.isArray(windowRecord.fileReferences) && windowRecord.fileReferences.length > 0) return true;
  if (Array.isArray(windowRecord.activityHeaders) && windowRecord.activityHeaders.length > 0) return true;
  return false;
}

function sideAmbiguous(record) {
  return Boolean(record?.initial?.window?.ambiguous || record?.collapsed?.window?.ambiguous || record?.expanded?.window?.ambiguous);
}

function sideCandidateCounts(record) {
  const windowRecord = record?.initial?.window || {};
  return {
    candidateCount: windowRecord.candidateCount ?? null,
    semanticCandidateCount: windowRecord.semanticCandidateCount ?? null,
    eligibleCandidateCount: windowRecord.eligibleCandidateCount ?? null,
  };
}

function sideDisclosureIntent(record) {
  return record?.disclosureIntent || record?.initial?.disclosureIntent || null;
}

function writeReport(report) {
  const anchorSummaries = report.anchors.map((anchor) => {
    const usability = anchorEvidenceUsability(anchor);
    const sourceIntent = sideDisclosureIntent(anchor.source);
    const targetIntent = sideDisclosureIntent(anchor.target);
    return {
      index: anchor.index,
      anchor: anchor.anchor,
      contextTerms: anchor.contextTerms || [],
      targetAPI: anchor.targetAPI,
      targetFocus: anchor.targetFocus || null,
      evidenceUsable: usability.ok,
      evidenceProblems: usability.problems,
      evidenceWarnings: [
        ...usability.warnings,
        ...(anchor.targetAPI?.uniqueCandidateFallback ? ["target API used unique-candidate fallback because source context terms did not fully match the single API record"] : []),
      ],
      requiresDisclosure: Boolean(sourceIntent?.requiresDisclosure || targetIntent?.requiresDisclosure),
      requiresStructuredActivity: Boolean(sourceIntent?.requiresStructuredActivity || targetIntent?.requiresStructuredActivity),
      sourceDisclosureIntent: sourceIntent,
      targetDisclosureIntent: targetIntent,
      sourceFound: Boolean(anchor.source?.initial?.window?.found),
      targetFound: Boolean(anchor.target?.initial?.window?.found),
      sourceReason: anchor.source?.initial?.window?.reason || "",
      targetReason: anchor.target?.initial?.window?.reason || "",
      sourceAmbiguous: sideAmbiguous(anchor.source),
      targetAmbiguous: sideAmbiguous(anchor.target),
      sourceCandidateCounts: sideCandidateCounts(anchor.source),
      targetCandidateCounts: sideCandidateCounts(anchor.target),
      sourceInitialExpanded: anchor.source?.initial?.expanded,
      targetInitialExpanded: anchor.target?.initial?.expanded,
      sourceCollapsedExpanded: anchor.source?.collapsed?.expanded,
      targetCollapsedExpanded: anchor.target?.collapsed?.expanded,
      sourceCollapsedVerified: Boolean(anchor.source?.collapsed?.stateVerified),
      targetCollapsedVerified: Boolean(anchor.target?.collapsed?.stateVerified),
      sourceCurrentVerified: Boolean(anchor.source?.collapsed?.currentVerified),
      targetCurrentVerified: Boolean(anchor.target?.collapsed?.currentVerified),
      sourceExpandedExpanded: anchor.source?.expanded?.expanded,
      targetExpandedExpanded: anchor.target?.expanded?.expanded,
      sourceExpandedVerified: Boolean(anchor.source?.expanded?.stateVerified),
      targetExpandedVerified: Boolean(anchor.target?.expanded?.stateVerified),
      sourceExpandedAttempted: Boolean(anchor.source?.expanded?.attempted),
      targetExpandedAttempted: Boolean(anchor.target?.expanded?.attempted),
      sourceCollapseClickOK: Boolean(anchor.source?.collapsed?.click?.ok),
      targetCollapseClickOK: Boolean(anchor.target?.collapsed?.click?.ok),
      sourceExpandClickOK: Boolean(anchor.source?.expanded?.click?.ok),
      targetExpandClickOK: Boolean(anchor.target?.expanded?.click?.ok),
      sourceCollapsedScreenshot: anchor.source?.collapsed?.screenshot || "",
      targetCollapsedScreenshot: anchor.target?.collapsed?.screenshot || "",
      sourceExpandedScreenshot: anchor.source?.expanded?.screenshot || "",
      targetExpandedScreenshot: anchor.target?.expanded?.screenshot || "",
    };
  });
  const summary = {
    generatedAt: report.generatedAt,
    note: report.note,
    outputDir: path.relative(repoRoot, outDir).replace(/\\/g, "/"),
    checks: {
      total: report.checks.length,
      failed: report.checks.filter((check) => !check.ok).length,
      failedNames: report.checks.filter((check) => !check.ok).map((check) => check.name),
    },
    evidence: {
      usable: anchorSummaries.filter((anchor) => anchor.evidenceUsable).length,
      unusable: anchorSummaries.filter((anchor) => !anchor.evidenceUsable).length,
    },
    anchors: anchorSummaries,
  };
  fs.writeFileSync(path.join(outDir, "summary.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, "summary.md"), markdownSummary(summary, report));
  fs.mkdirSync(outRoot, { recursive: true });
  fs.writeFileSync(path.join(outRoot, "latest.txt"), `${outDir}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

function markdownSummary(summary, report) {
  const lines = [
    "# Same Anchor Evidence",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "> This capture is evidence only. It does not prove UI parity by itself.",
    "",
    "## Checks",
    "",
    ...report.checks.map((check) => `- ${check.ok ? "OK" : "FAIL"}: ${check.name} - ${check.details}`),
    "",
    "## Anchors",
    "",
  ];
  for (const anchor of summary.anchors) {
    lines.push(`### ${anchor.index}. ${anchor.anchor}`);
    lines.push("");
    lines.push(`- evidence usable: ${anchor.evidenceUsable}`);
    if (anchor.evidenceProblems?.length) {
      for (const problem of anchor.evidenceProblems) lines.push(`- evidence problem: ${problem}`);
    }
    if (anchor.evidenceWarnings?.length) {
      for (const warning of anchor.evidenceWarnings) lines.push(`- evidence warning: ${warning}`);
    }
    lines.push(`- requires disclosure: ${anchor.requiresDisclosure}`);
    lines.push(`- requires structured activity: ${anchor.requiresStructuredActivity}`);
    lines.push(`- source disclosure intent: ${anchor.sourceDisclosureIntent ? `${anchor.sourceDisclosureIntent.category} - ${anchor.sourceDisclosureIntent.reason}` : "none"}`);
    lines.push(`- target disclosure intent: ${anchor.targetDisclosureIntent ? `${anchor.targetDisclosureIntent.category} - ${anchor.targetDisclosureIntent.reason}` : "none"}`);
    lines.push(`- source found: ${anchor.sourceFound}`);
    lines.push(`- target found: ${anchor.targetFound}`);
    if (anchor.sourceReason) lines.push(`- source reason: ${anchor.sourceReason}`);
    if (anchor.targetReason) lines.push(`- target reason: ${anchor.targetReason}`);
    lines.push(`- source ambiguous: ${anchor.sourceAmbiguous}; candidates=${JSON.stringify(anchor.sourceCandidateCounts)}`);
    lines.push(`- target ambiguous: ${anchor.targetAmbiguous}; candidates=${JSON.stringify(anchor.targetCandidateCounts)}`);
    lines.push(`- context terms: ${(anchor.contextTerms || []).slice(0, 12).join(", ") || "none"}`);
    lines.push(`- target API: ${anchor.targetAPI?.found ? `seq ${anchor.targetAPI.seq}; ambiguous=${Boolean(anchor.targetAPI.ambiguous)}; eligible=${anchor.targetAPI.eligibleCandidateCount ?? "unknown"}` : anchor.targetAPI?.reason || "not checked"}`);
    if (anchor.targetFocus) lines.push(`- target focus: ${JSON.stringify(anchor.targetFocus)}`);
    lines.push(`- source states: initial=${anchor.sourceInitialExpanded}, collapsed=${anchor.sourceCollapsedExpanded}, expanded=${anchor.sourceExpandedExpanded}`);
    lines.push(`- target states: initial=${anchor.targetInitialExpanded}, collapsed=${anchor.targetCollapsedExpanded}, expanded=${anchor.targetExpandedExpanded}`);
    lines.push(`- current verified: source=${anchor.sourceCurrentVerified}, target=${anchor.targetCurrentVerified}`);
    lines.push(`- source state verified: collapsed=${anchor.sourceCollapsedVerified}, expanded=${anchor.sourceExpandedVerified}`);
    lines.push(`- target state verified: collapsed=${anchor.targetCollapsedVerified}, expanded=${anchor.targetExpandedVerified}`);
    lines.push(`- source clicks: collapse=${anchor.sourceCollapseClickOK}, expand=${anchor.sourceExpandClickOK}`);
    lines.push(`- target clicks: collapse=${anchor.targetCollapseClickOK}, expand=${anchor.targetExpandClickOK}`);
    lines.push(`- source collapsed: ${anchor.sourceCollapsedScreenshot}`);
    lines.push(`- target collapsed: ${anchor.targetCollapsedScreenshot}`);
    lines.push(`- source expanded: ${anchor.sourceExpandedScreenshot || "not captured"}`);
    lines.push(`- target expanded: ${anchor.targetExpandedScreenshot || "not captured"}`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

async function waitForLoad(page) {
  await waitFor(page, `document.readyState === "complete" || document.readyState === "interactive"`, 60000, "page load");
}

async function waitFor(page, expression, timeoutMS, label) {
  const started = Date.now();
  let last = "";
  while (Date.now() - started < timeoutMS) {
    try {
      const ok = await evalPage(page, `(() => { try { return Boolean(${expression}); } catch { return false; } })()`);
      if (ok) return;
    } catch (error) {
      last = error.message;
    }
    await wait(250);
  }
  throw new Error(`Timed out waiting for ${label}${last ? `: ${last}` : ""}`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout(label, promise, timeoutMS) {
  let timer = null;
  promise.catch(() => {});
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}: timed out after ${timeoutMS}ms`)), timeoutMS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function evalPage(page, expression) {
  return evalInContext(page, undefined, expression);
}

async function evalInContext(page, contextId, expression) {
  const params = { expression, awaitPromise: true, returnByValue: true };
  if (contextId) params.contextId = contextId;
  const result = await page.send("Runtime.evaluate", params);
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Runtime.evaluate failed");
  }
  return result.result?.value;
}

async function readJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
  return response.json();
}

async function connect(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(`${entry.method}: ${message.error.message} ${JSON.stringify(message.error.data || "")}`));
    else entry.resolve(message.result || {});
  });
  return {
    send(method, params = {}) {
      const messageId = ++id;
      socket.send(JSON.stringify({ id: messageId, method, params }));
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(messageId);
          reject(new Error(`${method}: timed out after ${CDP_COMMAND_TIMEOUT_MS}ms`));
        }, CDP_COMMAND_TIMEOUT_MS);
        pending.set(messageId, {
          method,
          resolve(value) {
            clearTimeout(timeout);
            resolve(value);
          },
          reject(error) {
            clearTimeout(timeout);
            reject(error);
          },
        });
      });
    },
    close() {
      socket.close();
    },
  };
}

function stage(message) {
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.error(`[same-anchor ${elapsed}s] ${message}`);
}
