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
const TARGET_NAVIGATE = process.env.TARGET_NAVIGATE !== "0";
const TARGET_FRESH = process.env.TARGET_FRESH !== "0";
const TARGET_OPEN_SESSION = process.env.TARGET_OPEN_SESSION !== "0";
const TARGET_API_PREFLIGHT = process.env.TARGET_API_PREFLIGHT !== "0";
const TARGET_AWARE_ACTIVITY_SELECTION = process.env.TARGET_AWARE_ACTIVITY_SELECTION !== "0";
const TARGET_SESSION_ID = process.env.TARGET_SESSION_ID || "019f0a04-7f0b-7483-8bc4-18f214a5c8f1";
const TARGET_NODE_ID = process.env.TARGET_NODE_ID || "host-docker-agent";
const VIEWPORT_WIDTH = Number(process.env.VIEWPORT_WIDTH || 1920);
const VIEWPORT_HEIGHT = Number(process.env.VIEWPORT_HEIGHT || 1080);
const TARGET_SIDEBAR_WIDTH = Number(process.env.TARGET_SIDEBAR_WIDTH || 611);
const DISCLOSURE_CLICK_TOP_MARGIN = Number(process.env.DISCLOSURE_CLICK_TOP_MARGIN || 48);
const DISCLOSURE_CLICK_BOTTOM_MARGIN = Number(process.env.DISCLOSURE_CLICK_BOTTOM_MARGIN || 150);
const ANCHOR_TOP_TOLERANCE_PX = Number(process.env.ANCHOR_TOP_TOLERANCE_PX || 32);
const MAX_SCROLL_STEPS = Number(process.env.ANCHOR_MAX_SCROLL_STEPS || 120);
const CDP_COMMAND_TIMEOUT_MS = Number(process.env.CDP_COMMAND_TIMEOUT_MS || 60000);
const ANCHOR_LOCATE_TIMEOUT_MS = Number(process.env.ANCHOR_LOCATE_TIMEOUT_MS || 120000);
const VERBOSE = process.env.ANCHOR_AUDIT_VERBOSE !== "0";
const CAPTURE_SCREENSHOT = process.env.CAPTURE_SCREENSHOT !== "0";
const DISCOVER_SOURCE_ANCHORS = process.env.DISCOVER_SOURCE_ANCHORS === "1";
const DISCOVERY_ONLY = process.env.DISCOVERY_ONLY === "1";
const DISCOVER_MAX_ANCHORS = Number(process.env.DISCOVER_MAX_ANCHORS || 40);
const DISCOVER_MAX_WINDOWS = Number(process.env.DISCOVER_MAX_WINDOWS || 60);
const SOURCE_DISCOVERY_START = String(process.env.SOURCE_DISCOVERY_START || "latest").trim().toLowerCase();
const DISCOVER_ANCHOR_KINDS = (process.env.DISCOVER_ANCHOR_KINDS || "activity,file,user")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const REAL_CLICK_ALL_DISCLOSURES = process.env.REAL_CLICK_ALL_DISCLOSURES !== "0";
const ANCHOR_VALIDATE_PLAN = process.env.ANCHOR_VALIDATE_PLAN !== "0";
const ANCHOR_PLAN_ONLY = process.env.ANCHOR_PLAN_ONLY === "1";
const ANCHOR_MIN_TEXT_LENGTH = Number(process.env.ANCHOR_MIN_TEXT_LENGTH || 12);
const ANCHOR_MAX_TEXT_LENGTH = Number(process.env.ANCHOR_MAX_TEXT_LENGTH || 180);

const DEFAULT_ANCHORS = [
  "./build-all.sh",
  "systemctl restart codex-web.service",
  "GET /",
  "GET /api/nodes",
];

const repoRoot = path.resolve(__dirname, "..");
const outRoot = path.resolve(process.env.ANCHOR_CAPTURE_DIR || path.join(repoRoot, "reference", "live-anchor-alignment"));
const startTime = Date.now();
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
const outDir = path.join(outRoot, stamp);

const SOURCE_SELECTORS = {
  conversation: "[data-thread-find-target='conversation']",
  turn: "[data-virtualized-turn-content], [data-turn-key], [data-content-search-unit-key]",
  summaryButton: "button[aria-expanded].text-size-chat",
  activityHeader: ".group\\/activity-header, [class*='group/activity-header']",
  toolGroupItem: "[data-codex-tool-group-item], [data-testid*='command']",
  userBubble: "[data-user-message-bubble]",
  assistantMarkdown: "._markdownContent_lzkx4_60",
  fileReference: "[class*='FileLink'], [class*='fileLink'], [class*='tableCellFileLink'], .codex-file-reference",
  shimmer: ".loading-shimmer-pure-text, [class*='cadencedShimmer']",
};

const TARGET_SELECTORS = {
  conversation: "[data-thread-find-target='conversation']",
  turn: "[data-codex-virtual-turn], [data-turn-key], [data-content-search-unit-key]",
  summaryButton: "button[aria-expanded].text-size-chat",
  activityHeader: ".group\\/activity-header, [class*='group/activity-header']",
  toolGroupItem: "[data-codex-tool-group-item]",
  userBubble: "[data-user-message-bubble]",
  assistantMarkdown: "._markdownContent_lzkx4_60",
  fileReference: "._tableCellFileLink_lzkx4_413, [data-file-reference], .thread-diff-virtualized",
  shimmer: ".loading-shimmer-pure-text, [class*='cadencedShimmer']",
};

const COMMAND_ENHANCEMENT_PATTERN = /\b(?:exec_command\s*(?:x|×)\s*\d+|write_stdin|Chunk ID)\b/i;

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  let anchors = anchorTexts();
  const checks = [];
  const evidence = {
    cdp: CDP,
    viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
    sourceURL: SOURCE_URL,
    targetURL: TARGET_URL,
    targetSessionId: TARGET_SESSION_ID,
    targetNodeId: TARGET_NODE_ID,
    anchors: [],
  };

  const sourceTarget = await getOrCreateTarget(SOURCE_PATTERN, SOURCE_URL, "source code-server");
  const targetURL = targetURLForRun();
  evidence.targetURL = targetURL;
  const targetTarget = await getOrCreateTarget(TARGET_PATTERN, targetURL, "target Codex Web", sourceTarget.id, { fresh: TARGET_FRESH });

  const sourcePage = await connect(sourceTarget.webSocketDebuggerUrl);
  const targetPage = await connect(targetTarget.webSocketDebuggerUrl);
  try {
    stage("preparing source and target pages");
    await preparePage(sourcePage, SOURCE_URL, { navigate: SOURCE_NAVIGATE, source: true });
    await preparePage(targetPage, targetURL, { navigate: TARGET_NAVIGATE, target: true });
    if (TARGET_OPEN_SESSION) await openTargetSession(targetPage);

    stage("finding Codex conversation contexts");
    const sourceContext = await findCodexContext(sourcePage, "source", SOURCE_SELECTORS);
    const targetContext = await findCodexContext(targetPage, "target", TARGET_SELECTORS);

    checks.push({
      name: "source code-server Codex conversation context found",
      ok: isConversationContext(sourceContext),
      details: sourceContext ? contextDetails(sourceContext) : "missing",
    });
    checks.push({
      name: "target Codex Web conversation context found",
      ok: isConversationContext(targetContext),
      details: targetContext ? contextDetails(targetContext) : "missing",
    });
    evidence.contexts = {
      source: sourceContext?.probe || null,
      target: targetContext?.probe || null,
    };
    const sourceContextOK = isConversationContext(sourceContext);
    const targetContextOK = isConversationContext(targetContext);

    stage("collecting setup evidence");
    await Promise.all([settlePageForEvidence(sourcePage), settlePageForEvidence(targetPage)]);
    evidence.setup = await collectSetupEvidence(sourcePage, targetPage, sourceContext, targetContext);
    const sourceSetup = evidence.setup.source || {};
    const targetSetup = evidence.setup.target || {};
    checks.push({
      name: "source setup screenshot captured",
      ok: Boolean(sourceSetup.screenshot),
      details: sourceSetup.screenshot || "missing",
      evidence: sourceSetup.screenshot ? [sourceSetup.screenshot] : [],
    });
    checks.push({
      name: "target setup screenshot captured",
      ok: Boolean(targetSetup.screenshot),
      details: targetSetup.screenshot || "missing",
      evidence: targetSetup.screenshot ? [targetSetup.screenshot] : [],
    });
    checks.push({
      name: "source browser viewport is at least 1920x1080",
      ok: viewportAtLeast(sourceSetup.top?.viewport, VIEWPORT_WIDTH, VIEWPORT_HEIGHT),
      details: viewportDetails(sourceSetup.top?.viewport),
    });
    checks.push({
      name: "target browser viewport is at least 1920x1080",
      ok: viewportAtLeast(targetSetup.top?.viewport, VIEWPORT_WIDTH, VIEWPORT_HEIGHT),
      details: viewportDetails(targetSetup.top?.viewport),
    });
    checks.push({
      name: "source reference is code-server Codex webview",
      ok: isCodeServerCodexWebview(sourceContext, sourceSetup.frame),
      details: sourceSetup.frame?.url || sourceContext?.url || sourceContext?.probe?.url || "missing",
    });
    checks.push({
      name: "source left Activity Bar is present",
      ok: Boolean(sourceSetup.top?.layout?.leftActivityBarPresent),
      details: JSON.stringify(sourceSetup.top?.layout?.activityBars || []),
    });
    checks.push({
      name: "source right chat/sidebar is closed",
      ok: Boolean(sourceSetup.top?.layout?.rightSidebarClosed),
      details: JSON.stringify(sourceSetup.top?.layout?.auxiliaryBars || []),
    });
    checks.push({
      name: "target node and session are selected",
      ok: targetSetup.top?.target?.nodeId === TARGET_NODE_ID && Boolean(targetSetup.frame?.hasThreadScroll),
      details: `node=${targetSetup.top?.target?.nodeId || ""}, session=${TARGET_SESSION_ID}, threadScroll=${Boolean(targetSetup.frame?.hasThreadScroll)}`,
    });

    if (!sourceContextOK || !targetContextOK) {
      writeReport(checks, evidence, anchors);
      process.exitCode = 1;
      return;
    }

    let sourceDiscovery = null;
    if (DISCOVER_SOURCE_ANCHORS) {
      stage("discovering source anchors");
      const discovery = await discoverSourceAnchors(sourcePage, sourceContext.contextId, SOURCE_SELECTORS).catch((error) => ({ ok: false, reason: error.message, anchors: [] }));
      sourceDiscovery = discovery;
      evidence.sourceAnchorDiscovery = compactSourceAnchorDiscoveryEvidence(discovery);
      checks.push({
        name: "source reverse-scroll anchors discovered",
        ok: Boolean(discovery.ok) && Array.isArray(discovery.anchors) && discovery.anchors.length > 0,
        details: discovery.ok ? `anchors=${discovery.anchors.length}, windows=${discovery.windows?.length || 0}, reverse=${Boolean(discovery.reverse)}` : discovery.reason || "failed",
      });
      if (discovery.ok && discovery.anchors.length) anchors = discovery.anchors;
    }

    if (DISCOVERY_ONLY) {
      writeReport(checks, evidence, anchors);
      return;
    }

    stage("fetching target API session text");
    const targetAPI = TARGET_API_PREFLIGHT
      ? await fetchTargetSessionText(targetURL).catch((error) => ({ ok: false, reason: error.message, text: "", eventCount: 0, ranges: [] }))
      : { ok: false, skipped: true, text: "", eventCount: 0, ranges: [] };
    evidence.targetAPI = {
      ok: Boolean(targetAPI.ok),
      skipped: Boolean(targetAPI.skipped),
      compact: Boolean(targetAPI.compact),
      reason: targetAPI.reason || "",
      eventCount: targetAPI.eventCount || 0,
      ranges: targetAPI.ranges || [],
    };
    checks.push({
      name: "target API session text preflight",
      ok: !TARGET_API_PREFLIGHT || Boolean(targetAPI.ok),
      details: targetAPI.ok ? `events=${targetAPI.eventCount}, ranges=${JSON.stringify(targetAPI.ranges || [])}` : targetAPI.reason || "skipped",
    });

    if (TARGET_AWARE_ACTIVITY_SELECTION && sourceDiscovery?.ok && targetAPI.ok) {
      const selected = targetAwareActivityAnchors(sourceDiscovery, targetAPI);
      evidence.targetAwareActivitySelection = {
        enabled: true,
        selectedCount: selected.length,
        selected: selected.slice(0, 12).map((anchor) => ({
          anchor: anchorText(anchor),
          kind: anchor.kind || "",
          targetSeq: anchor.targetAPIAnchor?.seq || 0,
          activity: anchor.activity ? {
            label: anchor.activity.label || "",
            count: Number(anchor.activity.count || 0),
            fileTokens: (anchor.activity.fileTokens || []).slice(0, 8),
            stats: (anchor.activity.stats || []).slice(0, 8),
          } : null,
        })),
      };
      if (selected.length) {
        const seen = new Set();
        anchors = [...selected, ...anchors].filter((anchor) => {
          const key = discoveredAnchorKey(anchor, anchorText(anchor));
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).slice(0, Math.max(DISCOVER_MAX_ANCHORS, selected.length));
      }
    }

    if (ANCHOR_VALIDATE_PLAN) {
      stage("validating anchor plan");
      const anchorPlan = await buildAnchorPlan({
        anchors,
        sourcePage,
        targetPage,
        sourceContext,
        targetContext,
        targetAPI,
      });
      evidence.anchorPlan = anchorPlan;
      checks.push({
        name: "anchor plan has usable source and target anchors",
        ok: anchorPlan.accepted.length > 0,
        details: anchorPlanSummary(anchorPlan),
      });
      checks.push({
        name: "anchor plan has no target visual/context failures",
        ok: anchorPlan.failures.length === 0,
        details: anchorPlan.failures.length ? anchorPlan.failures.map((item) => `${item.index}:${item.reason}`).join(" | ") : "none",
      });
      anchors = anchorPlan.accepted.map((item) => item.anchorMeta);
      if (ANCHOR_PLAN_ONLY) {
        writeReport(checks, evidence, anchors);
        process.exitCode = checks.some((check) => !check.ok) ? 1 : 0;
        return;
      }
    }

    for (let index = 0; index < anchors.length; index += 1) {
      const anchor = anchorText(anchors[index]);
      stage(`anchor ${index + 1}/${anchors.length}: locating source: ${anchor.slice(0, 120)}`);
      const sourceWindow = withContextFrameOffset(sourceContext?.contextId
        ? await withTimeout(`anchor ${index + 1} source locate`, locateAnchorWindow(sourcePage, sourceContext.contextId, SOURCE_SELECTORS, anchor, "source", index), ANCHOR_LOCATE_TIMEOUT_MS).catch((error) => ({ found: false, reason: error.message }))
        : { found: false, reason: "source context missing" }, sourceContext);
      const targetAPIAnchor = targetAPI.ok
        ? targetAPIAnchorMatch(targetAPI.text, anchor, targetAPI.records, windowComparableText(sourceWindow), anchors[index])
        : { checked: false, found: false, reason: targetAPI.reason || "target API preflight unavailable" };
      const sourceAnchorTop = anchorVisualTop(sourceWindow);
      stage(`anchor ${index + 1}/${anchors.length}: locating target: ${anchor.slice(0, 120)}${targetAPIAnchor.seq ? ` (seq ${targetAPIAnchor.seq})` : ""}`);
      const targetWindow = withContextFrameOffset(targetContext?.contextId
        ? targetAPIAnchor.checked && !targetAPIAnchor.found
          ? { found: false, reason: targetAPIAnchor.reason || "target API session text does not contain anchor", targetAPIAnchor }
          : await withTimeout(`anchor ${index + 1} target locate`, locateTargetAnchorWindow(targetPage, targetContext.contextId, TARGET_SELECTORS, anchor, index, targetAPIAnchor, sourceAnchorTop), ANCHOR_LOCATE_TIMEOUT_MS).catch((error) => ({ found: false, reason: error.message }))
        : { found: false, reason: "target context missing" }, targetContext);
      stage(`anchor ${index + 1}/${anchors.length}: collecting evidence`);

      await Promise.all([settlePageForEvidence(sourcePage), settlePageForEvidence(targetPage)]);
      const sourceBeforeClickShot = await captureScreenshot(sourcePage, `source-anchor-${index + 1}-before-click.png`);
      const targetBeforeClickShot = await captureScreenshot(targetPage, `target-anchor-${index + 1}-before-click.png`);
      if (sourceWindow.found && sourceContext?.contextId) {
        stage(`anchor ${index + 1}/${anchors.length}: probing source disclosures with real mouse clicks`);
        const syntheticDisclosures = sourceWindow.disclosures || [];
        const realClick = await probeDisclosuresWithRealClick(sourcePage, sourceContext.contextId, SOURCE_SELECTORS, "source", index, sourceWindow.matchedTurnKey || "")
          .catch((error) => ({ ok: false, reason: error.message, disclosures: [] }));
        sourceWindow.syntheticDisclosures = syntheticDisclosures;
        sourceWindow.realClick = realClick;
        if (Array.isArray(realClick?.disclosures) && realClick.disclosures.length) {
          sourceWindow.disclosures = mergeDisclosureEvidence(syntheticDisclosures, realClick.disclosures);
          sourceWindow.matchedDisclosures = sourceWindow.matchedTurnKey
            ? sourceWindow.disclosures.filter((item) => item.turnKey === sourceWindow.matchedTurnKey)
            : sourceWindow.disclosures;
        }
      }
      if (targetWindow.found && targetContext?.contextId) {
        stage(`anchor ${index + 1}/${anchors.length}: probing target disclosures with real mouse clicks`);
        const syntheticDisclosures = targetWindow.disclosures || [];
        const realClick = await probeDisclosuresWithRealClick(targetPage, targetContext.contextId, TARGET_SELECTORS, "target", index, targetWindow.matchedTurnKey || "")
          .catch((error) => ({ ok: false, reason: error.message, disclosures: [] }));
        targetWindow.syntheticDisclosures = syntheticDisclosures;
        targetWindow.realClick = realClick;
        if (Array.isArray(realClick?.disclosures) && realClick.disclosures.length) {
          targetWindow.disclosures = mergeDisclosureEvidence(syntheticDisclosures, realClick.disclosures);
          targetWindow.matchedDisclosures = targetWindow.matchedTurnKey
            ? targetWindow.disclosures.filter((item) => item.turnKey === targetWindow.matchedTurnKey)
            : targetWindow.disclosures;
        }
      }
      const sourceAfterClickShot = sourceWindow.realClick?.disclosures?.length
        ? (await settlePageForEvidence(sourcePage), await captureScreenshot(sourcePage, `source-anchor-${index + 1}-after-click.png`))
        : "";
      const targetAfterClickShot = targetWindow.realClick?.disclosures?.length
        ? (await settlePageForEvidence(targetPage), await captureScreenshot(targetPage, `target-anchor-${index + 1}-after-click.png`))
        : "";
      await Promise.all([settlePageForEvidence(sourcePage), settlePageForEvidence(targetPage)]);
      const sourceShot = await captureScreenshot(sourcePage, `source-anchor-${index + 1}.png`);
      const targetShot = await captureScreenshot(targetPage, `target-anchor-${index + 1}.png`);
      const sourceCounts = comparableCounts(sourceWindow);
      const targetCounts = comparableCounts(targetWindow);
      let contextComparison = matchedWindowContextComparison(sourceWindow, targetWindow, anchor);
      const structuredActivityContext = Boolean(targetAPIAnchor.structuredActivityMatch && anchorKind(anchors[index]) === "activity");
      if (!contextComparison.ok && structuredActivityContext) {
        contextComparison = {
          ...contextComparison,
          ok: true,
          structuredActivityOverride: true,
          details: `structured activity/file_change match accepted; ${targetAPIAnchor.structuredActivityDetails}; ${contextComparison.details || ""}`,
        };
      }
      const visualPositionParity = anchorVisualPositionParity(sourceWindow, targetWindow);
      const comparableWindow = Boolean(sourceWindow.found && targetWindow.found && contextComparison.ok);
      const disclosureParity = processedDisclosureParity(scopedDisclosureWindow(sourceWindow), scopedDisclosureWindow(targetWindow));
      const activityParityRequired = requiresActivityParityAnchor(anchor, anchors[index]);
      const strictActivityParity = { strict: activityParityRequired };
      const activityStructureParity = activityDisclosureStructureParity(scopedDisclosureWindow(sourceWindow), scopedDisclosureWindow(targetWindow), strictActivityParity);
      const fileActivityParity = fileActivityDisclosureParity(scopedDisclosureWindow(sourceWindow), scopedDisclosureWindow(targetWindow), strictActivityParity);
      const visibleFileActivityParity = visibleFileActivityLabelParity(sourceWindow, targetWindow, strictActivityParity);
      const targetBrokenDisclosures = brokenTargetDisclosures(targetWindow);
      const targetCommandDisclosure = disclosureHasCommandEnhancement(targetWindow);
      const row = {
        anchor,
        anchorMeta: typeof anchors[index] === "object" ? anchors[index] : null,
        targetAPIAnchor,
        source: sourceWindow,
        target: targetWindow,
        contextComparison,
        visualPositionParity,
        activityStructureParity,
        fileActivityParity,
        visibleFileActivityParity,
        screenshots: {
          source: sourceShot,
          sourceBeforeClick: sourceBeforeClickShot,
          sourceAfterClick: sourceAfterClickShot,
          target: targetShot,
          targetBeforeClick: targetBeforeClickShot,
          targetAfterClick: targetAfterClickShot,
        },
      };
      evidence.anchors.push(row);

      checks.push({
        name: `anchor ${index + 1} source found: ${anchor}`,
        ok: Boolean(sourceWindow.found),
        details: sourceWindow.reason || sourceWindow.matchedText || "",
        evidence: sourceShot ? [sourceShot] : [],
      });
      checks.push({
        name: `anchor ${index + 1} target API contains anchor: ${anchor}`,
        ok: !targetAPIAnchor.checked || (targetAPIAnchor.apiContainsAnchor && targetAPIAnchor.found),
        details: targetAPIAnchor.checked
          ? `found=${targetAPIAnchor.found}, apiContainsAnchor=${targetAPIAnchor.apiContainsAnchor}, seq=${targetAPIAnchor.seq || 0}, reason=${targetAPIAnchor.reason || ""}`
          : targetAPIAnchor.reason || "not checked",
      });
      checks.push({
        name: `anchor ${index + 1} target found: ${anchor}`,
        ok: Boolean(targetWindow.found),
        details: targetWindow.reason || targetWindow.matchedText || "",
        evidence: targetShot ? [targetShot] : [],
      });
      checks.push({
        name: `anchor ${index + 1} source/target matched context is comparable`,
        ok: !sourceWindow.found || !targetWindow.found || contextComparison.ok,
        details: contextComparison.details,
      });
      checks.push({
        name: `anchor ${index + 1} source/target anchor viewport position is comparable`,
        ok: !sourceWindow.found || !targetWindow.found || visualPositionParity.ok,
        details: visualPositionParity.details,
      });
      checks.push({
        name: `anchor ${index + 1} target has no command enhancement rows`,
        ok: !targetWindow.found || (Number(targetCounts.toolGroupItems || 0) === 0 && !targetWindow.hasCommandEnhancementText),
        details: `toolGroupItems=${targetWindow.counts?.toolGroupItems || 0}, commandText=${Boolean(targetWindow.hasCommandEnhancementText)}`,
      });
      checks.push({
        name: `anchor ${index + 1} source/target both expose processed summaries when source does`,
        ok: !comparableWindow || !sourceCounts.summaries || Number(targetCounts.summaries || 0) > 0,
        details: comparableWindow ? `source=${sourceCounts.summaries || 0}, target=${targetCounts.summaries || 0}` : `skipped because contexts differ: ${contextComparison.details}`,
      });
      checks.push({
        name: `anchor ${index + 1} processed disclosure expansion parity`,
        ok: !comparableWindow || disclosureParity.ok,
        details: comparableWindow ? disclosureParity.details : `skipped because contexts differ: ${contextComparison.details}`,
      });
      checks.push({
        name: `anchor ${index + 1} non-processed activity row structure parity`,
        ok: !comparableWindow || !activityParityRequired || activityStructureParity.ok,
        details: !comparableWindow
          ? `skipped because contexts differ: ${contextComparison.details}`
          : activityParityRequired
            ? activityStructureParity.details
            : `skipped for non-activity anchor kind=${anchorKind(anchors[index])}`,
      });
      checks.push({
        name: `anchor ${index + 1} file/diff activity row parity`,
        ok: !comparableWindow || !activityParityRequired || fileActivityParity.ok,
        details: !comparableWindow
          ? `skipped because contexts differ: ${contextComparison.details}`
          : activityParityRequired
            ? fileActivityParity.details
            : `skipped for non-activity anchor kind=${anchorKind(anchors[index])}`,
      });
      checks.push({
        name: `anchor ${index + 1} visible file activity labels parity`,
        ok: !comparableWindow || !activityParityRequired || visibleFileActivityParity.ok,
        details: !comparableWindow
          ? `skipped because contexts differ: ${contextComparison.details}`
          : activityParityRequired
            ? visibleFileActivityParity.details
            : `skipped for non-activity anchor kind=${anchorKind(anchors[index])}`,
      });
      checks.push({
        name: `anchor ${index + 1} source disclosure real mouse hit-test`,
        ok: !sourceWindow.found || !comparableWindow || Boolean(sourceWindow.realClick?.ok),
        details: !comparableWindow
          ? `skipped because contexts differ: ${contextComparison.details}`
          : sourceWindow.realClick?.ok
            ? `clicked=${sourceWindow.realClick.clicked || 0}, blocked=${sourceWindow.realClick.blocked || 0}, controls=${sourceWindow.realClick.controls || 0}`
            : sourceWindow.realClick?.reason || "not run",
      });
      checks.push({
        name: `anchor ${index + 1} target processed disclosure buttons expand when clickable`,
        ok: !targetWindow.found || !comparableWindow || targetBrokenDisclosures.length === 0,
        details: !comparableWindow
          ? `skipped because contexts differ: ${contextComparison.details}`
          : targetBrokenDisclosures.length ? targetBrokenDisclosures.map((item) => item.label || item.text || item.kind).join(" | ") : "none",
      });
      checks.push({
        name: `anchor ${index + 1} target disclosure real mouse hit-test`,
        ok: !targetWindow.found || !comparableWindow || Boolean(targetWindow.realClick?.ok),
        details: !comparableWindow
          ? `skipped because contexts differ: ${contextComparison.details}`
          : targetWindow.realClick?.ok
            ? `clicked=${targetWindow.realClick.clicked || 0}, blocked=${targetWindow.realClick.blocked || 0}, controls=${targetWindow.realClick.controls || 0}`
            : targetWindow.realClick?.reason || "not run",
      });
      checks.push({
        name: `anchor ${index + 1} expanded disclosure bodies contain no command enhancements`,
        ok: !targetWindow.found || !comparableWindow || !targetCommandDisclosure,
        details: !comparableWindow
          ? `skipped because contexts differ: ${contextComparison.details}`
          : targetCommandDisclosure ? "command enhancement text found in expanded disclosure evidence" : "none",
      });
      checks.push({
        name: `anchor ${index + 1} source/target both expose file references when source does`,
        ok: !comparableWindow || !sourceRequiresFileReferences(sourceWindow, targetWindow, sourceCounts) || Number(targetCounts.fileReferences || 0) > 0,
        details: comparableWindow ? `source=${sourceCounts.fileReferences || 0}, target=${targetCounts.fileReferences || 0}` : `skipped because contexts differ: ${contextComparison.details}`,
      });
    }
  } finally {
    sourcePage.close();
    if (TARGET_FRESH) await targetPage.send("Page.close").catch(() => {});
    targetPage.close();
  }

  const report = writeReport(checks, evidence, anchors);
  if (report.summary.failed > 0) process.exit(1);
}

function writeReport(checks, evidence, anchors) {
  const report = {
    generatedAt: new Date().toISOString(),
    basis: "Live anchor-matched audit. It compares source code-server and target Codex Web at identical text anchors, rejects ambiguous duplicate-anchor contexts, records screenshots plus DOM/semantic disclosure probes, and fails on visible Codex Web-only command enhancements.",
    summary: {
      checks: checks.length,
      failed: checks.filter((check) => !check.ok).length,
      anchorCount: anchors.length,
      candidateAnchorCount: evidence.anchorPlan?.candidateCount || anchors.length,
      acceptedAnchorCount: evidence.anchorPlan?.accepted?.length || anchors.length,
      rejectedAnchorCount: evidence.anchorPlan?.rejected?.length || 0,
      planFailureCount: evidence.anchorPlan?.failures?.length || 0,
    },
    checks,
    evidence,
  };
  const compactReport = compactAuditReport(report);

  fs.writeFileSync(path.join(outDir, "summary.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, "summary.compact.json"), `${JSON.stringify(compactReport, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, "summary.md"), renderMarkdown(report));
  fs.writeFileSync(path.join(outRoot, "latest.txt"), outDir);
  console.log(`${path.relative(repoRoot, path.join(outDir, "summary.json")).replace(/\\/g, "/")} (${report.summary.failed} failed)`);
  return report;
}

function compactAuditReport(report) {
  return {
    generatedAt: report.generatedAt,
    summary: report.summary,
    failedChecks: (report.checks || [])
      .filter((check) => !check.ok)
      .map((check) => ({
        name: check.name,
        details: compactText(check.details, 500),
      })),
    sourceAnchorDiscovery: compactSourceAnchorDiscovery(report.evidence?.sourceAnchorDiscovery),
    anchorPlan: compactAnchorPlan(report.evidence?.anchorPlan),
    target: {
      url: report.evidence?.targetURL || "",
      sessionId: report.evidence?.targetSessionId || "",
      nodeId: report.evidence?.targetNodeId || "",
    },
  };
}

function compactSourceAnchorDiscovery(discovery) {
  if (!discovery) return null;
  const anchors = Array.isArray(discovery.anchors) ? discovery.anchors : [];
  const positions = Array.isArray(discovery.positions) ? discovery.positions : [];
  return {
    ok: Boolean(discovery.ok),
    reason: discovery.reason || "",
    reverse: Boolean(discovery.reverse),
    startMode: discovery.startMode || "",
    initialScroll: discovery.initialScroll || null,
    normalizedScroll: discovery.normalizedScroll || null,
    maxScroll: Number(discovery.maxScroll || 0),
    step: Number(discovery.step || 0),
    positionCount: positions.length,
    firstPositions: positions.slice(0, 8),
    lastPositions: positions.slice(-8),
    anchorCount: anchors.length,
    firstAnchors: anchors.slice(0, 8).map((anchor) => ({
      index: anchor.index,
      kind: anchor.kind,
      scrollTop: anchor.actualScrollTop,
      text: compactText(anchorText(anchor), 160),
      activity: anchor.activity ? {
        label: anchor.activity.label || "",
        fileTokens: (anchor.activity.fileTokens || []).slice(0, 6),
      } : null,
    })),
  };
}

function compactSourceAnchorDiscoveryEvidence(discovery) {
  if (!discovery || typeof discovery !== "object") return discovery;
  const windows = Array.isArray(discovery.windows) ? discovery.windows : [];
  const anchors = Array.isArray(discovery.anchors) ? discovery.anchors : [];
  return {
    ...discovery,
    windows: windows.map((windowRecord) => ({
      label: windowRecord.label || "",
      requestedScrollTop: windowRecord.requestedScrollTop,
      actualScrollTop: windowRecord.actualScrollTop,
      firstTurnKey: windowRecord.firstTurnKey || "",
      lastTurnKey: windowRecord.lastTurnKey || "",
      turnCount: windowRecord.turnCount || 0,
      expandedProcessed: Number(windowRecord.expandedProcessed || 0),
      scroll: windowRecord.scroll || null,
      counts: windowRecord.counts || {},
      candidateCount: Array.isArray(windowRecord.candidates) ? windowRecord.candidates.length : 0,
      candidateSamples: (windowRecord.candidates || []).slice(0, 5).map((candidate) => ({
        kind: candidate.kind || "",
        text: compactText(candidate.text || "", 160),
        counts: candidate.counts || {},
        activity: candidate.activity ? {
          label: candidate.activity.label || "",
          fileTokens: (candidate.activity.fileTokens || []).slice(0, 6),
          stats: (candidate.activity.stats || []).slice(0, 6),
        } : null,
      })),
      activityCandidateSamples: (windowRecord.candidates || [])
        .filter((candidate) => candidate?.kind === "activity")
        .slice(0, 12)
        .map((candidate) => ({
          text: compactText(candidate.text || "", 160),
          usable: usableActivityCandidate(candidate),
          counts: candidate.counts || {},
          activity: candidate.activity ? {
            label: candidate.activity.label || "",
            count: Number(candidate.activity.count || 0),
            fileTokens: (candidate.activity.fileTokens || []).slice(0, 8),
            stats: (candidate.activity.stats || []).slice(0, 8),
          } : null,
        })),
    })),
    anchors: anchors.map((anchor) => ({
      ...anchor,
      anchor: anchorText(anchor),
      discoveredSourceWindow: anchor.discoveredSourceWindow ? {
        found: Boolean(anchor.discoveredSourceWindow.found),
        matchedText: compactText(anchor.discoveredSourceWindow.matchedText || "", 220),
        scroll: anchor.discoveredSourceWindow.scroll || null,
        counts: anchor.discoveredSourceWindow.counts || {},
        anchorCounts: anchor.discoveredSourceWindow.anchorCounts || {},
      } : null,
    })),
  };
}

function compactAnchorPlan(anchorPlan) {
  if (!anchorPlan) return null;
  return {
    candidates: anchorPlan.candidateCount || 0,
    accepted: anchorPlan.accepted?.length || 0,
    rejected: anchorPlan.rejected?.length || 0,
    failures: anchorPlan.failures?.length || 0,
    rejectedGroups: groupByCount(anchorPlan.rejected || [], "category"),
    failureGroups: groupByCount(anchorPlan.failures || [], "category"),
    acceptedSeqs: (anchorPlan.accepted || [])
      .map((item) => item?.targetAPIAnchor?.seq || item?.anchorMeta?.targetAPIAnchor?.seq || item?.targetSeq)
      .filter(Boolean)
      .slice(0, 30),
    failureSamples: (anchorPlan.failures || []).slice(0, 8).map((item) => ({
      index: item.index,
      category: item.category || "",
      reason: compactText(item.reason || "", 220),
      anchor: compactText(anchorText(item.anchorMeta || item.anchor || ""), 160),
    })),
  };
}

function targetAwareActivityAnchors(discovery, targetAPI) {
  if (!discovery?.ok || !targetAPI?.ok || !Array.isArray(discovery.windows)) return [];
  const out = [];
  const used = new Set();
  for (const windowRecord of discovery.windows) {
    for (const candidate of Array.isArray(windowRecord.candidates) ? windowRecord.candidates : []) {
      if (candidate?.kind !== "activity") continue;
      if (!usableActivityCandidate(candidate)) continue;
      const anchor = cleanDiscoveredAnchor(candidate.text, candidate.kind);
      if (!anchor) continue;
      const anchorMeta = {
        anchor,
        kind: candidate.kind,
        activity: candidate.activity || null,
        label: windowRecord.label,
        requestedScrollTop: windowRecord.requestedScrollTop,
        actualScrollTop: windowRecord.actualScrollTop,
        firstTurnKey: windowRecord.firstTurnKey,
        lastTurnKey: windowRecord.lastTurnKey,
        turnCount: windowRecord.turnCount,
        discoveredSourceWindow: {
          found: true,
          matchedText: anchor,
          matchedRect: null,
          scroll: windowRecord.scroll,
          counts: windowRecord.counts,
          anchorCounts: candidate.counts || {},
          activity: candidate.activity || null,
          turns: [],
        },
      };
      const targetAPIAnchor = targetAPIAnchorMatch(targetAPI.text, anchor, targetAPI.records, "", anchorMeta);
      if (!targetAPIAnchor.checked || !targetAPIAnchor.found) continue;
      const key = discoveredAnchorKey(candidate, anchor);
      if (used.has(key)) continue;
      used.add(key);
      out.push({
        ...anchorMeta,
        targetAPIAnchor,
      });
    }
  }
  out.sort((left, right) => {
    const leftSeq = Number(left.targetAPIAnchor?.seq || 0);
    const rightSeq = Number(right.targetAPIAnchor?.seq || 0);
    return rightSeq - leftSeq;
  });
  return out;
}

function compactText(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

function anchorTexts() {
  if (process.env.ANCHOR_TEXTS_JSON) return JSON.parse(process.env.ANCHOR_TEXTS_JSON);
  if (process.env.ANCHOR_TEXTS) return process.env.ANCHOR_TEXTS.split(/\r?\n|\|/).map((value) => value.trim()).filter(Boolean);
  return DEFAULT_ANCHORS;
}

async function buildAnchorPlan({ anchors, sourcePage, targetPage, sourceContext, targetContext, targetAPI }) {
  const accepted = [];
  const rejected = [];
  const failures = [];
  const sourceContextID = sourceContext?.contextId || "";
  const targetContextID = targetContext?.contextId || "";

  for (let index = 0; index < anchors.length; index += 1) {
    const anchorMeta = typeof anchors[index] === "object" && anchors[index] ? { ...anchors[index] } : { anchor: anchorText(anchors[index]) };
    const anchor = anchorText(anchorMeta);
    const textValidation = validateAnchorCandidateText(anchor, anchorMeta);
    if (!textValidation.ok) {
      rejected.push({ index: index + 1, anchor, category: "invalid-text", reason: textValidation.reason, anchorMeta });
      continue;
    }

    stage(`anchor plan ${index + 1}/${anchors.length}: source preflight: ${anchor.slice(0, 120)}`);
    const sourceWindow = withContextFrameOffset(sourceContextID
      ? await withTimeout(`anchor plan ${index + 1} source locate`, locateAnchorWindow(sourcePage, sourceContextID, SOURCE_SELECTORS, anchor, "source", index), ANCHOR_LOCATE_TIMEOUT_MS)
        .catch((error) => ({ found: false, reason: error.message }))
      : { found: false, reason: "source context missing" }, sourceContext);
    if (!sourceWindow?.found) {
      rejected.push({ index: index + 1, anchor, category: "source-missing", reason: sourceWindow?.reason || "source anchor missing", anchorMeta });
      continue;
    }

    const targetAPIAnchor = targetAPI?.ok
      ? targetAPIAnchorMatch(targetAPI.text, anchor, targetAPI.records, windowComparableText(sourceWindow), anchorMeta)
      : { checked: false, found: false, reason: targetAPI?.reason || "target API preflight unavailable" };
    if (targetAPIAnchor.checked && !targetAPIAnchor.found) {
      rejected.push({
        index: index + 1,
        anchor,
        category: targetAPIAnchor.apiContainsAnchor ? "target-api-ambiguous" : "target-api-missing",
        reason: targetAPIAnchor.reason || "target API anchor unavailable",
        targetAPIAnchor,
        anchorMeta,
      });
      continue;
    }

    stage(`anchor plan ${index + 1}/${anchors.length}: target preflight: ${anchor.slice(0, 120)}${targetAPIAnchor.seq ? ` (seq ${targetAPIAnchor.seq})` : ""}`);
    const sourceAnchorTop = anchorVisualTop(sourceWindow);
    const targetWindow = withContextFrameOffset(targetContextID
      ? await withTimeout(`anchor plan ${index + 1} target locate`, locateTargetAnchorWindow(targetPage, targetContextID, TARGET_SELECTORS, anchor, index, targetAPIAnchor, sourceAnchorTop), ANCHOR_LOCATE_TIMEOUT_MS)
        .catch((error) => ({ found: false, reason: error.message }))
      : { found: false, reason: "target context missing" }, targetContext);
    if (!targetWindow?.found) {
      failures.push({
        index: index + 1,
        anchor,
        category: "target-visual-missing",
        reason: targetWindow?.reason || "target anchor missing",
        targetAPIAnchor,
        anchorMeta,
        targetWindow: {
          reason: targetWindow?.reason || "",
          scroll: targetWindow?.scroll || null,
          renderedTurnCount: targetWindow?.renderedTurnCount || 0,
          expandedFocusDisclosure: targetWindow?.expandedFocusDisclosure || null,
          expandedFocusDisclosureAttempts: targetWindow?.expandedFocusDisclosureAttempts || [],
          visibleTextSample: targetWindow?.visibleTextSample || "",
          renderedSamples: Array.isArray(targetWindow?.renderedSamples) ? targetWindow.renderedSamples : [],
        },
      });
      continue;
    }

    let contextComparison = matchedWindowContextComparison(sourceWindow, targetWindow, anchor);
    const structuredActivityContext = Boolean(targetAPIAnchor.structuredActivityMatch && anchorKind(anchorMeta) === "activity");
    if (!contextComparison.ok && structuredActivityContext) {
      contextComparison = {
        ...contextComparison,
        ok: true,
        structuredActivityOverride: true,
        details: `structured activity/file_change match accepted; ${targetAPIAnchor.structuredActivityDetails}; ${contextComparison.details || ""}`,
      };
    }
    if (!contextComparison.ok) {
      const repeatedAnchorContext = Boolean(
        contextComparison.bothContainAnchor
          && (Number(contextComparison.sourceCandidates || 0) > 1 || Number(contextComparison.targetCandidates || 0) > 1),
      );
      const bucket = repeatedAnchorContext ? rejected : failures;
      bucket.push({
        index: index + 1,
        anchor,
        category: repeatedAnchorContext ? "ambiguous-context" : "context-mismatch",
        reason: contextComparison.details || "source/target context mismatch",
        contextComparison,
        targetAPIAnchor,
        anchorMeta,
      });
      continue;
    }

    accepted.push({
      index: index + 1,
      anchor,
      anchorMeta: {
        ...anchorMeta,
        anchor,
        reset32Plan: {
          accepted: true,
          sourceTop: anchorVisualTop(sourceWindow),
          targetTop: anchorVisualTop(targetWindow),
          targetSeq: targetAPIAnchor.seq || 0,
          context: contextComparison.details || "",
        },
      },
      targetAPIAnchor,
    });
  }

  return {
    candidateCount: anchors.length,
    accepted,
    rejected,
    failures,
  };
}

function validateAnchorCandidateText(anchor, anchorMeta = {}) {
  const value = normalizeSearchText(anchor);
  if (!value) return { ok: false, reason: "empty anchor" };
  if (anchorMeta?.kind === "activity") {
    return /(?:已(?:编辑|创建|删除)\s+\d+\s+个文件|edited\s+\d+\s+files?|created\s+\d+\s+files?|deleted\s+\d+\s+files?)/i.test(value)
      ? { ok: true, reason: "" }
      : { ok: false, reason: "activity anchor without file-change label" };
  }
  if (value.length < ANCHOR_MIN_TEXT_LENGTH) return { ok: false, reason: `anchor shorter than ${ANCHOR_MIN_TEXT_LENGTH}` };
  if (value.length > ANCHOR_MAX_TEXT_LENGTH) return { ok: false, reason: `anchor longer than ${ANCHOR_MAX_TEXT_LENGTH}` };
  if (DEFAULT_ANCHORS.some((item) => normalizeSearchText(item).toLowerCase() === value.toLowerCase())) {
    return { ok: false, reason: "default repeated log anchor" };
  }
  if (/^(?:GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+\//i.test(value)) return { ok: false, reason: "HTTP route/log anchor" };
  if (/^(?:systemctl|docker|git|node|npm|pnpm|yarn|go|ssh|scp|curl|GET|POST)\b/i.test(value) && !strongProseAnchor(value)) {
    return { ok: false, reason: "command/log fragment anchor" };
  }
  if (looksLikeFileAnchor(value) && !strongProseAnchor(value)) return { ok: false, reason: "file-reference-like anchor without surrounding prose" };
  if (/^\S+\s+\(line\s+\d+\)$/i.test(value)) return { ok: false, reason: "source file line-reference anchor" };
  if (anchorMeta?.kind === "file" && !strongProseAnchor(value)) return { ok: false, reason: "discovered file anchor without prose context" };
  if (!strongProseAnchor(value)) return { ok: false, reason: "not enough stable prose for same-occurrence matching" };
  return { ok: true, reason: "" };
}

function anchorPlanSummary(anchorPlan) {
  const rejectedGroups = groupByCount(anchorPlan.rejected || [], "category");
  const failureGroups = groupByCount(anchorPlan.failures || [], "category");
  return [
    `candidates=${anchorPlan.candidateCount || 0}`,
    `accepted=${anchorPlan.accepted?.length || 0}`,
    `rejected=${anchorPlan.rejected?.length || 0}${rejectedGroups ? ` (${rejectedGroups})` : ""}`,
    `failures=${anchorPlan.failures?.length || 0}${failureGroups ? ` (${failureGroups})` : ""}`,
  ].join(", ");
}

function groupByCount(items, key) {
  const counts = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const value = item?.[key] || "unknown";
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return Array.from(counts.entries()).map(([name, count]) => `${name}=${count}`).join(", ");
}

function targetURLForRun() {
  if (process.env.TARGET_URL) return TARGET_URL;
  try {
    const url = new URL(TARGET_URL);
    url.searchParams.set("anchorRun", stamp);
    if (TARGET_NODE_ID && !url.searchParams.has("nodeId")) url.searchParams.set("nodeId", TARGET_NODE_ID);
    return url.toString();
  } catch {
    return TARGET_URL;
  }
}

function stage(message) {
  if (!VERBOSE) return;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.error(`[live-anchor ${elapsed}s] ${message}`);
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

async function fetchTargetSessionText(targetURL) {
  if (!TARGET_SESSION_ID || !TARGET_NODE_ID) {
    return { ok: false, reason: "TARGET_SESSION_ID and TARGET_NODE_ID are required", text: "", eventCount: 0, ranges: [] };
  }
  const base = new URL(targetURL);
  let beforeSeq = 0;
  let eventCount = 0;
  const ranges = [];
  const chunks = [];
  const records = [];
  for (let page = 0; page < 12; page += 1) {
    const url = new URL(`/api/sessions/${encodeURIComponent(TARGET_SESSION_ID)}/events`, base.origin);
    url.searchParams.set("nodeId", TARGET_NODE_ID);
    url.searchParams.set("limit", "2000");
    url.searchParams.set("compact", "true");
    if (beforeSeq > 0) url.searchParams.set("beforeSeq", String(beforeSeq));
    const response = await fetch(url);
    if (!response.ok) {
      return { ok: false, reason: `${url}: ${response.status} ${response.statusText}`, text: "", eventCount, ranges };
    }
    const payload = await response.json();
    const events = Array.isArray(payload.events) ? payload.events : [];
    if (!events.length) break;
    eventCount += events.length;
    ranges.push([events[0]?.seq || 0, events.at(-1)?.seq || 0]);
    const pageRecords = events.map(apiEventSearchRecord);
    records.push(...pageRecords);
    chunks.push(normalizeSearchText(JSON.stringify(pageRecords)));
    const firstSeq = Number(events[0]?.seq || 0);
    if (!firstSeq || firstSeq <= 1) break;
    beforeSeq = firstSeq;
  }
  return { ok: true, compact: true, text: chunks.join("\n"), eventCount, ranges, records };
}

function apiEventSearchRecord(event) {
  const data = event?.data && typeof event.data === "object" ? event.data : {};
  const files = normalizeFileChangeFiles(data.files);
  return {
    seq: Number(event?.seq || 0),
    kind: event?.kind || "",
    text: event?.text || "",
    dataText: data.text || "",
    dataMessage: data.message || "",
    html: event?.html || data.html || "",
    toolName: data.name || "",
    toolArguments: data.arguments || "",
    toolArgsText: toolArgsSearchText(data.args),
    files,
    fileText: fileChangeSearchText(files),
  };
}

function normalizeFileChangeFiles(files) {
  if (!Array.isArray(files)) return [];
  return files
    .map((file) => {
      const pathValue = String(file?.path || file?.name || "").trim();
      if (!pathValue) return null;
      const basename = pathValue.split(/[\\/]/).filter(Boolean).at(-1) || pathValue;
      const additions = Number(file?.additions || 0);
      const deletions = Number(file?.deletions || 0);
      const type = String(file?.type || file?.changeType || file?.status || "").trim();
      return {
        path: pathValue,
        basename,
        additions,
        deletions,
        type,
        stat: `${additions ? `+${additions}` : ""} ${deletions ? `-${deletions}` : ""}`.trim(),
      };
    })
    .filter(Boolean);
}

function targetAPIAnchorMatch(text, anchor, records = [], contextText = "", anchorMeta = {}) {
  const candidates = apiAnchorCandidates(anchor);
  if (!candidates.length) return { checked: false, found: false, reason: "empty anchor" };
  const normalizedText = normalizeSearchText(text);
  const matched = candidates.find((candidate) => normalizedText.includes(candidate));
  const contextTerms = stableNgrams(contextText, anchor).slice(0, 80);
  const recordMatch = bestAPIAnchorRecord(records, anchor, candidates, contextTerms, anchorMeta);
  const contextMatches = Number(recordMatch?.contextMatches || 0);
  const structuredActivityMatch = Boolean(recordMatch?.structuredActivityMatch);
  const ambiguousShortAnchor = Boolean(recordMatch)
    && contextTerms.length >= 8
    && !strongProseAnchor(anchor)
    && contextMatches < 3
    && !structuredActivityMatch;
  const found = (Array.isArray(records) && records.length ? Boolean(recordMatch) : Boolean(matched)) && !ambiguousShortAnchor;
  const reason = ambiguousShortAnchor
    ? `ambiguous short anchor: contextMatches=${contextMatches}/${contextTerms.length}`
    : found
      ? ""
      : matched
        ? "anchor found in aggregate API text but no exact event record matched"
        : "target API session text does not contain anchor";
  return {
    checked: true,
    found,
    reason,
    apiContainsAnchor: Boolean(matched),
    matchedAnchor: matched || "",
    candidates,
    contextTerms: contextTerms.length,
    contextMatches,
    seq: found ? Number(recordMatch?.seq || 0) : 0,
    recordKind: recordMatch?.kind || "",
    structuredActivityMatch,
    structuredActivityDetails: recordMatch?.structuredActivityDetails || "",
    recordTextSample: normalizeSearchText(recordSearchText(recordMatch)).slice(0, 500),
  };
}

function apiAnchorCandidates(anchor) {
  const normalizedAnchor = normalizeSearchText(anchor);
  if (!normalizedAnchor) return [];
  const candidates = [normalizedAnchor];
  const withoutLineSuffix = normalizedAnchor.replace(/\s+\(line\s+\d+\)$/i, "").trim();
  if (withoutLineSuffix && withoutLineSuffix !== normalizedAnchor) candidates.push(withoutLineSuffix);
  return Array.from(new Set(candidates));
}

function bestAPIAnchorRecord(records, anchor, candidates, contextTerms = [], anchorMeta = {}) {
  if (!Array.isArray(records) || !records.length) return null;
  const lineAnchor = normalizeSearchText(anchor).match(/^(.+)\s+\(line\s+(\d+)\)$/i);
  const lineBase = lineAnchor?.[1] || "";
  const lineNumber = lineAnchor?.[2] || "";
  const fileLikeAnchor = looksLikeFileAnchor(anchor);
  const activityRequirement = activityAnchorRequirement(anchor, anchorMeta);
  return records
    .map((record) => {
      const recordText = normalizeSearchText(recordSearchText(record));
      let score = 0;
      const exactAnchorMatch = Boolean(candidates[0] && recordText.includes(candidates[0]));
      let anchorMatches = exactAnchorMatch ? 1 : 0;
      const structuredActivity = activityRequirement
        ? structuredActivityRecordMatch(record, activityRequirement, candidates)
        : { matched: false, score: 0, details: "" };
      if (activityRequirement) {
        if (structuredActivity.matched) {
          score = Math.max(score, 1200 + structuredActivity.score);
          anchorMatches += 1;
        } else {
          return { record: { ...record, contextMatches: 0, anchorMatches: 0, structuredActivityMatch: false, structuredActivityDetails: structuredActivity.details }, score: 0 };
        }
      }
      if (exactAnchorMatch) score = Math.max(score, 1000);
      if (lineBase && lineNumber) {
        if (recordText.includes(`${lineBase}:${lineNumber}`) || recordText.includes(`${lineBase}#L${lineNumber}`)) {
          score = Math.max(score, 90);
          anchorMatches += 1;
        }
      }
      for (const candidate of candidates.slice(1)) {
        if (candidate && recordText.includes(candidate)) {
          score = Math.max(score, 20);
          anchorMatches += 1;
        }
      }
      const contextMatches = contextTerms.filter((term) => recordText.includes(term)).length;
      if (contextMatches > 0) score += Math.min(160, contextMatches * 6);
      if (contextMatches >= 8) score += 80;
      if (exactAnchorMatch && record.kind === "user_message") score += 120;
      if (exactAnchorMatch && fileLikeAnchor && record.kind === "file_change") score += 180;
      if (record.kind === "assistant_message") score += 5;
      if (record.kind === "tool_output") score -= 3;
      return {
        record: {
          ...record,
          contextMatches,
          anchorMatches,
          structuredActivityMatch: Boolean(structuredActivity.matched),
          structuredActivityDetails: structuredActivity.details || "",
        },
        score,
      };
    })
    .filter((entry) => entry.score > 0 && Number(entry.record.anchorMatches || 0) > 0)
    .sort((left, right) => right.score - left.score || Number(right.record.seq || 0) - Number(left.record.seq || 0))[0]?.record || null;
}

function activityAnchorRequirement(anchor, anchorMeta = {}) {
  if (anchorKind(anchorMeta) !== "activity") return null;
  const labelInfo = parseActivityLabel(anchorText(anchorMeta) || anchor);
  if (!labelInfo) return null;
  const activity = anchorMeta.activity && typeof anchorMeta.activity === "object" ? anchorMeta.activity : {};
  const fileTokens = uniqueNormalizedTokens([
    ...(Array.isArray(activity.fileTokens) ? activity.fileTokens : []),
    ...(Array.isArray(activity.basenames) ? activity.basenames : []),
    ...extractFileTokensFromText(activity.body || ""),
    ...extractFileTokensFromText(anchorText(anchorMeta) || anchor),
  ]);
  const stats = Array.isArray(activity.stats) ? activity.stats.map((value) => normalizeSearchText(value)).filter(Boolean) : [];
  return {
    ...labelInfo,
    fileTokens,
    stats,
  };
}

function structuredActivityRecordMatch(record, requirement, candidates = []) {
  if (!record || record.kind !== "file_change") {
    return { matched: false, score: 0, details: `expected file_change record, got ${record?.kind || "missing"}` };
  }
  const recordLabel = parseActivityLabel(record.text || record.dataText || record.dataMessage || "");
  const recordFiles = Array.isArray(record.files) ? record.files : [];
  const recordTokens = uniqueNormalizedTokens(recordFiles.flatMap((file) => [file.path, file.basename]));
  const requiredTokens = uniqueNormalizedTokens(requirement.fileTokens || []);
  const requiredStats = Array.isArray(requirement.stats) ? requirement.stats.filter(Boolean) : [];
  const tokenMatches = requiredTokens.filter((token) => recordTokens.some((recordToken) => tokenMatchesFileToken(token, recordToken)));
  const tokenScopeTooBroad = Boolean(requirement.count && requiredTokens.length > requirement.count * 2);
  const countOK = !requirement.count || recordFiles.length === requirement.count;
  const actionOK = !requirement.action || !recordLabel?.action || recordLabel.action === requirement.action;
  const labelOK = Boolean(recordLabel)
    && (!requirement.count || recordLabel.count === requirement.count)
    && (!requirement.action || recordLabel.action === requirement.action);
  const tokenOK = requiredTokens.length > 0 && tokenMatches.length > 0;
  const sourceStatsOK = requiredStats.length > 0;
  const matched = countOK && actionOK && tokenOK && sourceStatsOK && !tokenScopeTooBroad;
  const score = [
    labelOK ? 160 : 0,
    countOK ? 120 : 0,
    actionOK ? 80 : 0,
    tokenMatches.length * 220,
    sourceStatsOK ? 60 : 0,
  ].reduce((sum, value) => sum + value, 0);
  return {
    matched,
    score,
    details: [
      `label=${requirement.label}`,
      `recordLabel=${recordLabel?.label || ""}`,
      `countOK=${countOK}`,
      `actionOK=${actionOK}`,
      `tokenMatches=${tokenMatches.length}/${requiredTokens.length}`,
      `sourceStats=${requiredStats.length}`,
      `tokenScopeTooBroad=${tokenScopeTooBroad}`,
      `tokens=${tokenMatches.slice(0, 8).join(",")}`,
    ].join("; "),
  };
}

function parseActivityLabel(value) {
  const text = normalizeSearchText(value);
  const zh = text.match(/已(编辑|创建|删除)\s+(\d+)\s+个文件/);
  if (zh) {
    return {
      label: zh[0],
      action: ({ "编辑": "update", "创建": "add", "删除": "delete" })[zh[1]] || "",
      count: Number(zh[2] || 0),
    };
  }
  const en = text.match(/\b(edited|created|deleted)\s+(\d+)\s+files?\b/i);
  if (en) {
    return {
      label: en[0],
      action: ({ edited: "update", created: "add", deleted: "delete" })[en[1].toLowerCase()] || "",
      count: Number(en[2] || 0),
    };
  }
  return null;
}

function uniqueNormalizedTokens(values) {
  const seen = new Set();
  const out = [];
  for (const value of Array.isArray(values) ? values : []) {
    const token = normalizeFileToken(value);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out;
}

function normalizeFileToken(value) {
  let token = String(value || "")
    .replace(/^[`"'([{<]+|[`"',.;:)\]}>，。；、]+$/g, "")
    .replace(/\\/g, "/")
    .trim();
  if (!token) return "";
  token = token.replace(/^(?:\/root\/code\/codex-web\/|\/workspace\/|\/root\/)/, "");
  token = token.replace(/^\.\//, "");
  if (!/[A-Za-z0-9_.@/-]+\.[A-Za-z0-9][A-Za-z0-9._-]*/.test(token)) return "";
  if (/^(?:li|div|span|button|svg|path|a)\.[a-z0-9_.-]+$/i.test(token)) return "";
  if (/^\d+(?:\.\d+)?(?:px|rem|em|vh|vw|%)$/i.test(token)) return "";
  return token.toLowerCase();
}

function extractFileTokensFromText(value) {
  const text = String(value || "");
  return uniqueNormalizedTokens(text.match(/(?:[A-Za-z]:)?[A-Za-z0-9_.@~/-]*[A-Za-z0-9_.@-]+\.[A-Za-z0-9][A-Za-z0-9._-]*/g) || []);
}

function tokenMatchesFileToken(requiredToken, recordToken) {
  if (!requiredToken || !recordToken) return false;
  if (requiredToken === recordToken) return true;
  return requiredToken.endsWith(`/${recordToken}`)
    || recordToken.endsWith(`/${requiredToken}`)
    || requiredToken.split("/").at(-1) === recordToken.split("/").at(-1);
}

function recordSearchText(record) {
  if (!record) return "";
  return [
    record.text,
    record.dataText,
    record.dataMessage,
    record.html,
    record.toolName,
    record.toolArguments,
    record.toolArgsText,
    record.fileText,
  ].filter(Boolean).join(" ");
}

function toolArgsSearchText(args) {
  if (!args || typeof args !== "object") return "";
  const parts = [];
  for (const key of ["cmd", "command", "workdir", "cwd"]) {
    if (args[key]) parts.push(String(args[key]));
  }
  return parts.join(" ");
}

function fileChangeSearchText(files) {
  if (!Array.isArray(files)) return "";
  return files
    .map((file) => {
      const pathValue = String(file?.path || file?.name || "").trim();
      if (!pathValue) return "";
      const basename = pathValue.split(/[\\/]/).filter(Boolean).at(-1) || pathValue;
      const additions = Number(file?.additions || 0);
      const deletions = Number(file?.deletions || 0);
      const countText = `${additions ? `+${additions}` : ""} ${deletions ? `-${deletions}` : ""}`.trim();
      return [pathValue, basename, countText ? `${basename} ${countText}` : "", countText ? `${pathValue} ${countText}` : ""]
        .filter(Boolean)
        .join(" ");
    })
    .filter(Boolean)
    .join(" ");
}

function looksLikeFileAnchor(anchor) {
  const value = String(anchor || "");
  return /[\\/][^\s]+|(?:^|\s)[\w.-]+\.[\w.-]+(?:\s+[+-]\d+|\s+\(line\s+\d+\))?/i.test(value);
}

function normalizeSearchText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function anchorText(anchor) {
  return typeof anchor === "object" && anchor ? String(anchor.anchor || anchor.text || "") : String(anchor || "");
}

function anchorKind(anchor) {
  return typeof anchor === "object" && anchor ? String(anchor.kind || anchor.anchorKind || "text") : "text";
}

function requiresActivityParityAnchor(anchor, anchorMeta) {
  const kind = anchorKind(anchorMeta);
  if (kind === "file" || kind === "activity" || kind === "diff") return true;
  const text = normalizeSearchText(anchorText(anchor));
  return /(?:已(?:编辑|创建|删除)\s+\d+\s+个文件|edited\s+\d+\s+files?|created\s+\d+\s+files?|deleted\s+\d+\s+files?)/i.test(text);
}

function comparableCounts(windowRecord) {
  return windowRecord?.counts || windowRecord?.matchedCounts || windowRecord?.anchorCounts || {};
}

function textHasFileReferenceCandidate(text) {
  return /(?:[a-zA-Z]:[\\/]|~?\/|\.{1,2}\/)[^\s`"'<>，。；;、)）]+?\.[a-zA-Z0-9][a-zA-Z0-9._-]*(?::\d+|#L?\d+)?/.test(String(text || ""));
}

function sourceRequiresFileReferences(sourceWindow, targetWindow, sourceCounts) {
  if (!Number(sourceCounts?.fileReferences || 0)) return false;
  const sourceScoped = sourceWindow?.anchorCounts || sourceWindow?.matchedCounts || {};
  if (Number(sourceScoped.fileReferences || 0) > 0) return true;
  return textHasFileReferenceCandidate(sourceWindow?.matchedText) || textHasFileReferenceCandidate(targetWindow?.matchedText);
}

function matchedWindowContextComparison(sourceWindow, targetWindow, anchor) {
  if (!sourceWindow?.found || !targetWindow?.found) return { ok: true, details: "not checked because one side is missing", score: 0 };
  const sourceText = windowComparableText(sourceWindow);
  const targetText = windowComparableText(targetWindow);
  const exactAnchor = normalizeSearchText(anchor);
  const sourceSnippets = contextSnippets(sourceText, anchor);
  const targetSnippets = contextSnippets(targetText, anchor);
  let best = null;
  for (const sourceSnippet of sourceSnippets) {
    const sourceSignal = contextSignalText(sourceSnippet, anchor);
    const sourceGrams = stableNgrams(sourceSignal, anchor);
    if (!sourceGrams.length) continue;
    for (const targetSnippet of targetSnippets) {
      const targetSignal = contextSignalText(targetSnippet, anchor);
      const matched = sourceGrams.filter((gram) => targetSignal.includes(gram));
      const score = matched.length / sourceGrams.length;
      const bothContainAnchor = !exactAnchor || (normalizeSearchText(sourceSnippet).includes(exactAnchor) && normalizeSearchText(targetSnippet).includes(exactAnchor));
      const candidate = {
        ok: bothContainAnchor && (score >= 0.18 || matched.length >= 8),
        score,
        matched,
        total: sourceGrams.length,
        bothContainAnchor,
        sourceSnippet,
        targetSnippet,
        sourceSignal,
        targetSignal,
      };
      if (!best || candidate.score > best.score || (candidate.score === best.score && candidate.matched.length > best.matched.length)) {
        best = candidate;
      }
    }
  }
  if (!best) return { ok: true, details: "not enough source context for disambiguation", score: 1 };
  const apiAnchoredProse = best.bothContainAnchor && strongProseAnchor(exactAnchor) && Boolean(targetWindow?.targetAPIAnchor?.found);
  return {
    ok: best.ok,
    score: Number(best.score.toFixed(3)),
    matched: best.matched.length,
    total: best.total,
    bothContainAnchor: best.bothContainAnchor,
    sourceCandidates: sourceSnippets.length,
    targetCandidates: targetSnippets.length,
    apiAnchoredProse,
    details: `score=${best.score.toFixed(3)}, matched=${best.matched.length}/${best.total}, bothContainAnchor=${best.bothContainAnchor}, apiAnchoredProse=${apiAnchoredProse}, sourceCandidates=${sourceSnippets.length}, targetCandidates=${targetSnippets.length}, signalSource=${best.sourceSignal.length}, signalTarget=${best.targetSignal.length}`,
    sourceSnippet: best.sourceSnippet.slice(0, 800),
    targetSnippet: best.targetSnippet.slice(0, 800),
    sourceSignal: best.sourceSignal.slice(0, 800),
    targetSignal: best.targetSignal.slice(0, 800),
  };
}

function anchorVisualTop(windowRecord) {
  const top = Number(windowRecord?.matchedAnchorTarget?.selected?.range?.rect?.top ?? windowRecord?.matchedRect?.top);
  if (!Number.isFinite(top)) return null;
  const offsetTop = Number(windowRecord?.frameOffset?.top || 0);
  return top + (Number.isFinite(offsetTop) ? offsetTop : 0);
}

function withContextFrameOffset(windowRecord, context) {
  if (!windowRecord || typeof windowRecord !== "object") return windowRecord;
  return {
    ...windowRecord,
    frameId: context?.frameId || "",
    frameOffset: context?.frameOffset || { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 },
  };
}

function anchorVisualPositionParity(sourceWindow, targetWindow) {
  if (!sourceWindow?.found || !targetWindow?.found) {
    return { ok: true, details: "not checked because one side is missing" };
  }
  const sourceTop = anchorVisualTop(sourceWindow);
  const targetTop = anchorVisualTop(targetWindow);
  if (!Number.isFinite(sourceTop) || !Number.isFinite(targetTop)) {
    return { ok: false, details: `missing anchor position: sourceTop=${sourceTop}, targetTop=${targetTop}` };
  }
  const delta = Math.abs(sourceTop - targetTop);
  return {
    ok: delta <= ANCHOR_TOP_TOLERANCE_PX,
    details: `sourceTop=${Math.round(sourceTop)}, targetTop=${Math.round(targetTop)}, delta=${Math.round(delta)}, tolerance=${ANCHOR_TOP_TOLERANCE_PX}`,
    sourceTop,
    targetTop,
    delta,
  };
}

function strongProseAnchor(anchor) {
  const value = normalizeSearchText(anchor);
  if (!value) return false;
  if (/^(?:GET|POST|PUT|PATCH|DELETE)\s+\//i.test(value)) return false;
  const hasEnoughProse = (text) => {
    const normalized = normalizeSearchText(text);
    const cjkCount = (normalized.match(/[\u4e00-\u9fff]/g) || []).length;
    if (cjkCount >= 6) return true;
    const wordCount = (normalized.match(/[A-Za-z][A-Za-z0-9_-]*/g) || []).length;
    return normalized.length >= 24 && wordCount >= 3;
  };
  if (looksLikeFileAnchor(value)) {
    const withoutFileTokens = value
      .replace(/[\\/][^\s]+/g, " ")
      .replace(/(?:^|\s)[\w.-]+\.[\w.-]+(?:\s+[+-]\d+|\s+\(line\s+\d+\))?/gi, " ");
    return hasEnoughProse(withoutFileTokens);
  }
  return hasEnoughProse(value);
}

function windowComparableText(windowRecord) {
  const parts = [windowRecord?.matchedAnchorSnippet || "", windowRecord?.matchedText || ""];
  for (const turn of Array.isArray(windowRecord?.turns) ? windowRecord.turns : []) {
    parts.push(turn?.text || "");
  }
  return normalizeSearchText(parts.join(" "));
}

function contextSnippet(text, anchor) {
  return contextSnippets(text, anchor)[0] || "";
}

function contextSnippets(text, anchor) {
  const normalized = normalizeSearchText(text);
  const normalizedAnchor = normalizeSearchText(anchor);
  const index = normalizedAnchor ? normalized.indexOf(normalizedAnchor) : -1;
  if (index < 0) return normalized.slice(0, 1600);
  const snippets = [];
  const seen = new Set();
  let cursor = 0;
  while (snippets.length < 12) {
    const occurrence = normalized.indexOf(normalizedAnchor, cursor);
    if (occurrence < 0) break;
    const start = Math.max(0, occurrence - 700);
    const end = Math.min(normalized.length, occurrence + normalizedAnchor.length + 700);
    const snippet = normalized.slice(start, end);
    if (!seen.has(snippet)) {
      snippets.push(snippet);
      seen.add(snippet);
    }
    cursor = occurrence + Math.max(1, normalizedAnchor.length);
  }
  return snippets.length ? snippets : [normalized.slice(0, 1600)];
}

function contextSignalText(text, anchor) {
  const normalizedAnchor = normalizeSearchText(anchor);
  return normalizeSearchText(text)
    .split(/(?<=[。！？.!?])\s+|\s{2,}|(?=(?:已创建|已编辑|已删除|文件已创建|文件已编辑|文件已删除|Processed|已处理))/)
    .map((part) => normalizeSearchText(part))
    .filter(Boolean)
    .filter((part) => part === normalizedAnchor || !looksLikeDiffNoise(part))
    .join(" ");
}

function looksLikeDiffNoise(part) {
  const value = String(part || "").trim();
  if (!value) return true;
  if (/^(?:\d+\s*)?[+-]\s/.test(value)) return true;
  if (/^(?:\d+\s+)+[+-]?\s*(?:#!|set\s+-|if\s+|fi\b|for\s+|done\b|echo\b|sleep\b|kill\b|nohup\b|DISPLAY=|Xvfb\b|websockify\b|x11vnc\b|openbox\b|[A-Z_]+=?)/.test(value)) return true;
  if (/^(?:[A-Za-z0-9_.-]+\.(?:sh|js|mjs|ts|tsx|go|css|html|json|md)\s*)?[+-]\d+\s+-\d+/.test(value)) return true;
  if (/^(?:\d+\s+)?(?:const|let|var|function|import|export|return|await|async|if|for|while|class)\b/.test(value)) return true;
  const letters = value.replace(/[^A-Za-z\u4e00-\u9fff]/g, "");
  if (letters.length < 4 && /[{}()[\];"'`$<>\\]/.test(value)) return true;
  return false;
}

function stableNgrams(text, anchor) {
  const normalized = normalizeSearchText(text).replace(normalizeSearchText(anchor), " ");
  const compact = normalized.replace(/\s+/g, "");
  const grams = new Set();
  const size = compact.length > 400 ? 10 : 8;
  for (let index = 0; index + size <= compact.length; index += Math.max(3, Math.floor(size / 2))) {
    const gram = compact.slice(index, index + size);
    if (/^[\d:：,，.。\-_\s]+$/.test(gram)) continue;
    grams.add(gram);
    if (grams.size >= 80) break;
  }
  return Array.from(grams);
}

function disclosureSummary(windowRecord) {
  const disclosures = Array.isArray(windowRecord?.disclosures) ? windowRecord.disclosures : [];
  const processed = disclosures.filter((item) => item.isProcessed);
  const expandable = processed.filter((item) => item.interactive);
  const opened = expandable.filter((item) => item.opened || item.afterExpanded === "true" || item.bodyVisible);
  const body = opened.filter((item) => String(item.bodyText || item.expandedText || "").trim());
  return {
    all: disclosures.length,
    processed: processed.length,
    processedExpandable: expandable.length,
    processedOpened: opened.length,
    processedBodies: body.length,
    labels: processed.map((item) => item.label || item.text || item.kind).filter(Boolean).slice(0, 6),
  };
}

function scopedDisclosureWindow(windowRecord) {
  const matched = Array.isArray(windowRecord?.matchedDisclosures) ? windowRecord.matchedDisclosures : [];
  if (matched.some((item) => item.isProcessed)) {
    return { ...windowRecord, disclosures: matched, disclosureScope: "matched-turn" };
  }
  return { ...windowRecord, disclosureScope: "viewport" };
}

function mergeDisclosureEvidence(syntheticDisclosures, realClickDisclosures) {
  const keyFor = (item) => {
    const stableKey = item?.key || item?.descriptor?.key || "";
    if (stableKey) return ["disclosure-key", stableKey].join("\u0000");

    return [
      "fallback",
      item?.turnKey || item?.descriptor?.turnKey || "",
      item?.order ?? item?.descriptor?.order ?? "",
      item?.label || item?.text || "",
      item?.kind || "",
    ].join("\u0000");
  };
  const merged = [];
  const indexByKey = new Map();
  const addOrReplace = (item, fromRealClick = false) => {
    const key = keyFor(item);
    const index = indexByKey.get(key);
    if (index == null) {
      indexByKey.set(key, merged.length);
      merged.push(item);
    } else {
      merged[index] = fromRealClick ? { ...merged[index], ...item, realClickMerged: true } : { ...merged[index], ...item };
    }
  };
  for (const item of Array.isArray(syntheticDisclosures) ? syntheticDisclosures : []) addOrReplace(item, false);
  for (const item of Array.isArray(realClickDisclosures) ? realClickDisclosures : []) addOrReplace(item, true);
  return merged;
}

function processedDisclosureParity(sourceWindow, targetWindow) {
  const source = disclosureSummary(sourceWindow);
  const target = disclosureSummary(targetWindow);
  const details = `scope=${sourceWindow?.disclosureScope || "viewport"}/${targetWindow?.disclosureScope || "viewport"}; source processed=${source.processed}, expandable=${source.processedExpandable}, opened=${source.processedOpened}, bodies=${source.processedBodies}; target processed=${target.processed}, expandable=${target.processedExpandable}, opened=${target.processedOpened}, bodies=${target.processedBodies}`;
  if (!source.processedExpandable) return { ok: true, details };
  const requiredBodies = Math.max(1, Math.min(source.processedBodies || source.processedOpened || 1, source.processedExpandable));
  const ok = target.processedExpandable >= 1 && target.processedOpened >= 1 && target.processedBodies >= requiredBodies;
  return { ok, details };
}

function activityDisclosureStructureParity(sourceWindow, targetWindow, options = {}) {
  const source = activityDisclosureSummary(anchoredActivityWindow(sourceWindow));
  const target = activityDisclosureSummary(anchoredActivityWindow(targetWindow));
  const details = activityDisclosureDetails("activity", source, target);
  if (options.strict) {
    const sourceShowMore = source.fileLabels.map(normalizeVisibleActivityLabel).filter(isFileShowMoreLabel);
    const targetShowMore = target.fileLabels.map(normalizeVisibleActivityLabel).filter(isFileShowMoreLabel);
    const ok = source.activityRows.length > 0
      && target.activityRows.length > 0
      && arraysEqual(source.fileStats, target.fileStats)
      && arraysEqual(sourceShowMore, targetShowMore);
    return { ok, details: `${details}; strict=true; statsEqual=${arraysEqual(source.fileStats, target.fileStats)}; showMoreEqual=${arraysEqual(sourceShowMore, targetShowMore)}`, source, target };
  }
  if (!source.activityRows.length) return { ok: true, details, source, target };
  const ok = target.activityRows.length >= source.activityRows.length;
  return { ok, details, source, target };
}

function fileActivityDisclosureParity(sourceWindow, targetWindow, options = {}) {
  const source = activityDisclosureSummary(anchoredActivityWindow(sourceWindow));
  const target = activityDisclosureSummary(anchoredActivityWindow(targetWindow));
  const details = activityDisclosureDetails("fileActivity", source, target);
  if (options.strict) {
    const sourceShowMore = source.fileLabels.map(normalizeVisibleActivityLabel).filter(isFileShowMoreLabel);
    const targetShowMore = target.fileLabels.map(normalizeVisibleActivityLabel).filter(isFileShowMoreLabel);
    const ok = source.fileActivityRows.length > 0
      && target.fileActivityRows.length > 0
      && arraysEqual(sourceShowMore, targetShowMore)
      && arraysEqual(source.fileStats, target.fileStats);
    return {
      ok,
      details: `${details}; strict=true; showMoreEqual=${arraysEqual(sourceShowMore, targetShowMore)}; statsEqual=${arraysEqual(source.fileStats, target.fileStats)}`,
      source,
      target,
    };
  }
  if (!source.fileActivityRows.length) return { ok: true, details, source, target };
  const ok = target.fileActivityRows.length >= source.fileActivityRows.length
    && target.fileStatRows.length >= Math.min(source.fileStatRows.length, source.fileActivityRows.length)
    && (!source.fileStructuredRows.length || target.fileStructuredRows.length >= Math.min(source.fileStructuredRows.length, source.fileActivityRows.length))
    && (!source.fileCodeRows.length || target.fileCodeRows.length >= Math.min(source.fileCodeRows.length, source.fileActivityRows.length))
    && (!source.fileActionRows.length || target.fileActionRows.length >= Math.min(source.fileActionRows.length, source.fileActivityRows.length));
  return { ok, details, source, target };
}

function anchoredActivityWindow(windowRecord) {
  if (!windowRecord) return windowRecord;
  return {
    ...windowRecord,
    activityBand: windowRecord.activityBand || anchorActivityBand(windowRecord),
    disclosureScope: windowRecord.disclosureScope === "matched-turn" ? "matched-turn" : "anchor-near",
  };
}

function visibleFileActivityLabelParity(sourceWindow, targetWindow, options = {}) {
  const sourceBand = anchorActivityBand(sourceWindow);
  const targetBand = anchorActivityBand(targetWindow);
  const source = activityDisclosureSummary({ ...sourceWindow, disclosureScope: "anchor-near", activityBand: sourceBand });
  const target = activityDisclosureSummary({ ...targetWindow, disclosureScope: "anchor-near", activityBand: targetBand });
  const sourceLabels = source.fileLabels.map(normalizeVisibleActivityLabel);
  const targetLabels = target.fileLabels.map(normalizeVisibleActivityLabel);
  const sourceShowMore = sourceLabels.filter(isFileShowMoreLabel);
  const targetShowMore = targetLabels.filter(isFileShowMoreLabel);
  const details = [
    `scope=anchor-near/anchor-near`,
    `sourceFileLabels=${sourceLabels.join(" | ") || "none"}`,
    `targetFileLabels=${targetLabels.join(" | ") || "none"}`,
    `sourceShowMore=${sourceShowMore.join(" | ") || "none"}`,
    `targetShowMore=${targetShowMore.join(" | ") || "none"}`,
    `sourceBand=${formatBand(sourceBand)}`,
    `targetBand=${formatBand(targetBand)}`,
  ].join("; ");
  if (options.strict) {
    const ok = sourceLabels.length > 0
      && targetLabels.length > 0
      && arraysEqual(sourceShowMore, targetShowMore)
      && arraysEqual(source.fileStats, target.fileStats);
    return { ok, details: `${details}; strict=true; statsEqual=${arraysEqual(source.fileStats, target.fileStats)}`, source, target };
  }
  if (!sourceLabels.length) return { ok: true, details, source, target };
  const ok = arraysEqual(sourceLabels, targetLabels)
    && arraysEqual(sourceShowMore, targetShowMore);
  return { ok, details, source, target };
}

function activityDisclosureSummary(windowRecord) {
  const disclosures = Array.isArray(windowRecord?.disclosures) ? windowRecord.disclosures : [];
  const activityRows = disclosures
    .filter((item) => disclosureIntersectsViewport(item))
    .filter((item) => disclosureIntersectsBand(item, windowRecord?.activityBand))
    .filter((item) => !item?.isProcessed)
    .filter((item) => String(item?.label || item?.text || item?.bodyText || item?.expandedText || "").trim());
  const fileActivityRows = activityRows.filter(isFileActivityDisclosure);
  const fileStatRows = uniqueStrings(fileActivityRows.flatMap((item) => fileStatsFromDisclosure(item)));
  return {
    scope: windowRecord?.disclosureScope || "viewport",
    totalDisclosures: disclosures.length,
    activityRows,
    fileActivityRows,
    fileStatRows,
    fileStructuredRows: fileActivityRows.filter((item) => disclosureBodyStructureScore(item) > 0),
    fileCodeRows: fileActivityRows.filter((item) => disclosureBodyCodeScore(item) > 0),
    fileActionRows: fileActivityRows.filter((item) => disclosureBodyActionScore(item) > 0),
    labels: uniqueStrings(activityRows.map(disclosureLabel)).slice(0, 12),
    fileLabels: uniqueStrings(fileActivityRows.map(disclosureLabel)).slice(0, 12),
    fileStats: fileStatRows.slice(0, 24),
  };
}

function anchorActivityBand(windowRecord) {
  const rect = windowRecord?.matchedRect || windowRecord?.matchedAnchorTarget?.selected?.rect || null;
  const top = Number(rect?.top);
  const bottom = Number(rect?.bottom);
  if (!Number.isFinite(top) || !Number.isFinite(bottom)) return null;
  return {
    top: Math.max(0, top - 32),
    bottom: Math.min(VIEWPORT_HEIGHT, bottom + 420),
  };
}

function disclosureIntersectsBand(item, band) {
  if (!band) return true;
  const rect = item?.rect || item?.descriptor?.rect || null;
  if (!rect) return true;
  const top = Number(rect.top);
  const bottom = Number(rect.bottom);
  if (!Number.isFinite(top) || !Number.isFinite(bottom)) return true;
  return bottom >= band.top && top <= band.bottom;
}

function formatBand(band) {
  if (!band) return "none";
  return `${Math.round(band.top)}-${Math.round(band.bottom)}`;
}

function disclosureIntersectsViewport(item) {
  const rect = item?.rect || item?.descriptor?.rect || null;
  if (!rect) return true;
  const top = Number(rect.top);
  const bottom = Number(rect.bottom);
  if (!Number.isFinite(top) || !Number.isFinite(bottom)) return true;
  return bottom > 0 && top < VIEWPORT_HEIGHT;
}

function disclosureClickIntersectsViewport(item) {
  const rect = item?.rect || item?.descriptor?.rect || null;
  if (!rect) return true;
  const top = Number(rect.top);
  const bottom = Number(rect.bottom);
  const centerY = Number(rect.centerY ?? ((top + bottom) / 2));
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || !Number.isFinite(centerY)) return true;
  return bottom > DISCLOSURE_CLICK_TOP_MARGIN
    && top < VIEWPORT_HEIGHT - DISCLOSURE_CLICK_BOTTOM_MARGIN
    && centerY >= DISCLOSURE_CLICK_TOP_MARGIN
    && centerY <= VIEWPORT_HEIGHT - DISCLOSURE_CLICK_BOTTOM_MARGIN;
}

function activityDisclosureDetails(kind, source, target) {
  const sourceRows = kind === "fileActivity" ? source.fileActivityRows : source.activityRows;
  const targetRows = kind === "fileActivity" ? target.fileActivityRows : target.activityRows;
  const sourceLabels = (kind === "fileActivity" ? source.fileLabels : source.labels).join(" | ") || "none";
  const targetLabels = (kind === "fileActivity" ? target.fileLabels : target.labels).join(" | ") || "none";
  return [
    `scope=${source.scope}/${target.scope}`,
    `source=${sourceRows.length}`,
    `target=${targetRows.length}`,
    `sourceFileStats=${source.fileStatRows.length}`,
    `targetFileStats=${target.fileStatRows.length}`,
    `sourceStructured=${source.fileStructuredRows.length}`,
    `targetStructured=${target.fileStructuredRows.length}`,
    `sourceCodeRows=${source.fileCodeRows.length}`,
    `targetCodeRows=${target.fileCodeRows.length}`,
    `sourceActionRows=${source.fileActionRows.length}`,
    `targetActionRows=${target.fileActionRows.length}`,
    `sourceLabels=${sourceLabels}`,
    `targetLabels=${targetLabels}`,
  ].join("; ");
}

function disclosureLabel(item) {
  return normalizeSearchText(item?.label || item?.text || item?.kind || "").slice(0, 160);
}

function normalizeVisibleActivityLabel(value) {
  return normalizeSearchText(value)
    .replace(/\s+/g, " ")
    .trim();
}

function isFileShowMoreLabel(value) {
  return /(?:再显示\s*\d+\s*个文件|收起文件|Show\s+\d+\s+more\s+file|Hide\s+files?)/i.test(value);
}

function arraysEqual(left, right) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((value) => normalizeSearchText(value)).filter(Boolean)));
}

function isFileActivityDisclosure(item) {
  const text = normalizeSearchText([
    item?.label,
    item?.text,
    item?.bodyText,
    item?.expandedText,
    item?.beforeTurnText,
    item?.afterTurnText,
    item?.turnText,
  ].filter(Boolean).join(" "));
  if (!text) return false;
  return /(?:\u5df2(?:\u7f16\u8f91|\u521b\u5efa|\u5220\u9664)\s*\d+\s*(?:\u4e2a)?\s*\u6587\u4ef6|(?:edited|created|deleted)\s+\d+\s+files?)/i.test(text)
    || fileStatsFromText(text).length > 0;
}

function fileStatsFromDisclosure(item) {
  return Array.from(new Set(fileStatsFromText([
    item?.bodyText,
    item?.expandedText,
    item?.label,
    item?.text,
    item?.beforeTurnText,
    item?.afterTurnText,
    item?.turnText,
  ].filter(Boolean).join(" "))));
}

function fileStatsFromText(text) {
  const normalized = normalizeSearchText(text);
  const matches = [];
  const pattern = /(?:^|\s)([^\s`"'<>]+?\.[a-zA-Z0-9][a-zA-Z0-9._-]*)\s*\+\s*(\d+)\s*-\s*(\d+)/g;
  let match;
  while ((match = pattern.exec(normalized)) && matches.length < 40) {
    const token = normalizeFileToken(match[1]);
    if (!token || token.startsWith("-")) continue;
    matches.push(`${token} +${match[2]} -${match[3]}`);
  }
  return matches;
}

function disclosureBodyStructure(item) {
  return item?.body?.structure
    || item?.afterBody?.structure
    || item?.beforeBody?.structure
    || {};
}

function disclosureBodyStructureScore(item) {
  const structure = disclosureBodyStructure(item);
  return Number(structure.fileReferences || 0)
    + Number(structure.diffBlocks || 0)
    + Number(structure.threadDiffBlocks || 0)
    + Number(structure.codeBlocks || 0);
}

function disclosureBodyCodeScore(item) {
  const structure = disclosureBodyStructure(item);
  return Number(structure.codeBlocks || 0)
    + Number(structure.preBlocks || 0)
    + Number(structure.diffLineBlocks || 0);
}

function disclosureBodyActionScore(item) {
  const structure = disclosureBodyStructure(item);
  return Number(structure.buttons || 0);
}

function brokenTargetDisclosures(windowRecord) {
  const disclosures = Array.isArray(windowRecord?.disclosures) ? windowRecord.disclosures : [];
  return disclosures.filter((item) => (
    item.isProcessed
    && item.interactive
    && item.beforeExpanded !== "true"
    && item.afterExpanded !== "true"
    && !item.opened
    && !String(item.bodyText || item.expandedText || "").trim()
  ));
}

function disclosureHasCommandEnhancement(windowRecord) {
  const disclosures = Array.isArray(windowRecord?.disclosures) ? windowRecord.disclosures : [];
  return disclosures.some((item) => COMMAND_ENHANCEMENT_PATTERN.test(`${item.bodyText || ""} ${item.expandedText || ""} ${item.afterTurnText || ""}`));
}

async function discoverSourceAnchors(page, contextId, selectors) {
  const setup = await evalInContext(page, contextId, sourceAnchorDiscoverySetupExpression(selectors));
  if (!setup?.ok) return { ok: false, reason: setup?.reason || "source anchor discovery setup failed", anchors: [], windows: [] };
  const anchors = [];
  const windows = [];
  const used = new Set();
  for (let index = 0; index < setup.positions.length; index += 1) {
    const position = setup.positions[index];
    stage(`discover source window ${index + 1}/${setup.positions.length} at scrollTop ${position}`);
    const windowRecord = await evalInContext(page, contextId, sourceAnchorWindowExpression(selectors, position, index));
    windows.push(windowRecord);
    const picked = anchors.length < DISCOVER_MAX_ANCHORS
      ? pickDiscoveredAnchor(windowRecord.candidates || [], used)
      : null;
    if (picked) {
      used.add(discoveredAnchorKey(picked, picked.text));
      anchors.push({
        anchor: picked.text,
        index: anchors.length + 1,
        kind: picked.kind,
        activity: picked.activity || null,
        label: windowRecord.label,
        requestedScrollTop: windowRecord.requestedScrollTop,
        actualScrollTop: windowRecord.actualScrollTop,
        firstTurnKey: windowRecord.firstTurnKey,
        lastTurnKey: windowRecord.lastTurnKey,
        turnCount: windowRecord.turnCount,
        discoveredSourceWindow: {
          found: true,
          matchedText: picked.text,
          matchedRect: null,
          scroll: windowRecord.scroll,
          counts: windowRecord.counts,
          anchorCounts: picked.counts || {},
          activity: picked.activity || null,
          turns: [],
        },
      });
    }
  }
  anchors.forEach((anchor, index) => {
    anchor.index = index + 1;
  });
  return {
    ...setup,
    windows,
    anchors,
    scroll: windows.at(-1)?.scroll || setup.scroll,
  };
}

function sourceAnchorDiscoverySetupExpression(selectors) {
  return `(() => {
    const selectors = ${JSON.stringify(selectors)};
    const maxWindows = ${JSON.stringify(DISCOVER_MAX_WINDOWS)};
    const startMode = ${JSON.stringify(SOURCE_DISCOVERY_START)};
    const roots = [document, document.querySelector("#codexPanel")?.shadowRoot].filter(Boolean);
    const pickRoot = () => {
      for (const root of roots) {
        if (root.querySelector(selectors.conversation) || root.querySelector(selectors.turn)) return root;
      }
      return document;
    };
    const root = pickRoot();
    const addCandidate = (items, node) => {
      if (node && !items.includes(node)) items.push(node);
    };
    const scrollParentScore = (node) => {
      if (!node) return -Infinity;
      const conversation = root.querySelector(selectors.conversation);
      const rect = node.getBoundingClientRect?.() || { width: window.innerWidth, height: window.innerHeight };
      const style = node === document.scrollingElement ? { overflowY: "auto", display: "block", visibility: "visible", opacity: "1" } : getComputedStyle(node);
      let score = 0;
      if (node === document.scrollingElement || node.isConnected) score += 20;
      else score -= 300;
      if (style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0") score += 20;
      else score -= 300;
      if (rect.width > 0 && rect.height > 0) score += 80;
      else score -= 80;
      if (node.clientHeight > 0 && node.scrollHeight > 0) score += 60;
      if (node.scrollHeight > node.clientHeight) score += 80;
      if (/(auto|scroll)/.test(style.overflowY || "")) score += 30;
      if (conversation && node.contains?.(conversation)) score += 50;
      if (node.querySelector?.(selectors.turn)) score += 40;
      if (node.hasAttribute?.("data-thread-scroll")) score += 50;
      return score;
    };
    const findScrollParent = () => {
      const candidates = [];
      for (const explicit of Array.from(root.querySelectorAll("[data-thread-scroll]"))) addCandidate(candidates, explicit);
      const conversation = root.querySelector(selectors.conversation);
      let node = conversation;
      while (node && node !== root && node !== document.documentElement) {
        const style = getComputedStyle(node);
        if (/(auto|scroll)/.test(style.overflowY) || node.scrollHeight > node.clientHeight) addCandidate(candidates, node);
        node = node.parentElement;
      }
      addCandidate(candidates, document.scrollingElement);
      candidates.sort((left, right) => scrollParentScore(right) - scrollParentScore(left));
      return candidates[0] || null;
    };
    const scrollParent = findScrollParent();
    if (!scrollParent) return { ok: false, reason: "scroll parent missing", anchors: [], windows: [] };
    const scrollMetrics = () => ({
      top: Math.round(scrollParent.scrollTop || 0),
      height: Math.round(scrollParent.scrollHeight || 0),
      clientHeight: Math.round(scrollParent.clientHeight || 0),
    });
    const initialScroll = scrollMetrics();
    const addPosition = (positions, value) => {
      const rounded = Math.round(value);
      if (!positions.includes(rounded)) positions.push(rounded);
    };
    const maxScroll = Math.max(0, scrollParent.scrollHeight - scrollParent.clientHeight);
    const style = getComputedStyle(scrollParent);
    const reverse = style.flexDirection === "column-reverse" || /flex-col-reverse/.test(String(scrollParent.className || ""));
    const viewportStep = Math.max(240, Math.floor(scrollParent.clientHeight * 0.85));
    const coverageStep = maxScroll > 0 && maxWindows > 1
      ? Math.ceil(maxScroll / Math.max(1, maxWindows - 1))
      : viewportStep;
    const step = Math.max(viewportStep, coverageStep);
    const currentTop = scrollParent.scrollTop || 0;
    const numericStart = Number(startMode);
    let normalizedTop = currentTop;
    if (Number.isFinite(numericStart)) {
      normalizedTop = numericStart;
    } else if (startMode === "latest") {
      normalizedTop = reverse ? 0 : maxScroll;
    } else if (startMode === "oldest") {
      normalizedTop = reverse ? -maxScroll : 0;
    }
    if (Number.isFinite(normalizedTop)) {
      if (reverse) normalizedTop = Math.max(-maxScroll, Math.min(0, normalizedTop));
      else normalizedTop = Math.max(0, Math.min(maxScroll, normalizedTop));
      scrollParent.scrollTop = normalizedTop;
      scrollParent.dispatchEvent(new Event("scroll", { bubbles: true }));
    }
    const positions = [];
    addPosition(positions, normalizedTop);
    if (reverse) {
      for (let value = normalizedTop + step; value < 0 && positions.length < maxWindows - 1; value += step) addPosition(positions, value);
      addPosition(positions, 0);
      for (let value = Math.min(normalizedTop, 0) - step; Math.abs(value) < maxScroll && positions.length < maxWindows - 1; value -= step) addPosition(positions, value);
      if (maxScroll > 0) addPosition(positions, -maxScroll);
    } else {
      for (let value = normalizedTop - step; value > 0 && positions.length < maxWindows - 1; value -= step) addPosition(positions, value);
      addPosition(positions, 0);
      for (let value = Math.max(normalizedTop, 0) + step; value < maxScroll && positions.length < maxWindows - 1; value += step) addPosition(positions, value);
      if (maxScroll > 0) addPosition(positions, maxScroll);
    }
    return {
      ok: true,
      reverse,
      startMode,
      initialScroll,
      normalizedTop: Math.round(normalizedTop || 0),
      normalizedScroll: scrollMetrics(),
      maxScroll,
      viewportStep,
      coverageStep,
      step,
      positions,
      scroll: scrollMetrics(),
    };
  })()`;
}

function sourceAnchorWindowExpression(selectors, position, index) {
  return `(async () => {
    const selectors = ${JSON.stringify(selectors)};
    const position = ${JSON.stringify(position)};
    const index = ${JSON.stringify(index)};
    const roots = [document, document.querySelector("#codexPanel")?.shadowRoot].filter(Boolean);
    const pickRoot = () => {
      for (const root of roots) {
        if (root.querySelector(selectors.conversation) || root.querySelector(selectors.turn)) return root;
      }
      return document;
    };
    const root = pickRoot();
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const hiddenByAncestor = (element) => {
      let node = element;
      while (node && node.nodeType === Node.ELEMENT_NODE) {
        const style = getComputedStyle(node);
        if (node.hidden || node.inert || node.getAttribute("aria-hidden") === "true" || style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return true;
        const rect = node.getBoundingClientRect();
        if (style.overflow === "hidden" && rect.width <= 0 && rect.height <= 0) return true;
        node = node.parentElement;
      }
      return false;
    };
    const finiteNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
    const nonzeroRect = (rect) => {
      if (!rect) return null;
      const left = finiteNumber(rect.left);
      const top = finiteNumber(rect.top);
      const right = finiteNumber(rect.right);
      const bottom = finiteNumber(rect.bottom);
      const width = Math.max(0, finiteNumber(rect.width) || right - left);
      const height = Math.max(0, finiteNumber(rect.height) || bottom - top);
      if (width <= 0 || height <= 0) return null;
      return { left, top, right: right || left + width, bottom: bottom || top + height, width, height };
    };
    const visualRects = (element) => {
      if (!element || !element.isConnected) return [];
      const rects = [];
      const bounding = nonzeroRect(element.getBoundingClientRect?.());
      if (bounding) rects.push(bounding);
      for (const rect of Array.from(element.getClientRects?.() || [])) {
        const normalized = nonzeroRect(rect);
        if (normalized) rects.push(normalized);
      }
      return rects;
    };
    const visualRect = (element) => {
      const rects = visualRects(element);
      if (!rects.length) return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
      const left = Math.min(...rects.map((rect) => rect.left));
      const top = Math.min(...rects.map((rect) => rect.top));
      const right = Math.max(...rects.map((rect) => rect.right));
      const bottom = Math.max(...rects.map((rect) => rect.bottom));
      return { left, top, right, bottom, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
    };
    const rectPayload = (element) => {
      const rect = visualRect(element);
      return {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        area: Math.round(rect.width * rect.height),
      };
    };
    const visible = (element) => {
      if (!element || !element.isConnected || hiddenByAncestor(element)) return false;
      const rect = visualRect(element);
      return rect.width > 0 && rect.height > 0;
    };
    const textOf = (element, limit = 260) => (element?.innerText || element?.textContent || "").replace(/\\s+/g, " ").trim().slice(0, limit);
    const turnSelector = () => {
      if (root.querySelector("[data-codex-virtual-turn]")) return "[data-codex-virtual-turn]";
      if (root.querySelector("[data-virtualized-turn-content]")) return "[data-virtualized-turn-content]";
      return selectors.turn;
    };
    const addCandidate = (items, node) => {
      if (node && !items.includes(node)) items.push(node);
    };
    const scrollParentScore = (node) => {
      if (!node) return -Infinity;
      const conversation = root.querySelector(selectors.conversation);
      const rect = node.getBoundingClientRect?.() || { width: window.innerWidth, height: window.innerHeight };
      const style = node === document.scrollingElement ? { overflowY: "auto", display: "block", visibility: "visible", opacity: "1" } : getComputedStyle(node);
      let score = 0;
      if (node === document.scrollingElement || node.isConnected) score += 20;
      else score -= 300;
      if (style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0") score += 20;
      else score -= 300;
      if (rect.width > 0 && rect.height > 0) score += 80;
      else score -= 80;
      if (node.clientHeight > 0 && node.scrollHeight > 0) score += 60;
      if (node.scrollHeight > node.clientHeight) score += 80;
      if (/(auto|scroll)/.test(style.overflowY || "")) score += 30;
      if (conversation && node.contains?.(conversation)) score += 50;
      if (node.querySelector?.(selectors.turn)) score += 40;
      if (node.hasAttribute?.("data-thread-scroll")) score += 50;
      return score;
    };
    const findScrollParent = () => {
      const candidates = [];
      for (const explicit of Array.from(root.querySelectorAll("[data-thread-scroll]"))) addCandidate(candidates, explicit);
      const conversation = root.querySelector(selectors.conversation);
      let node = conversation;
      while (node && node !== root && node !== document.documentElement) {
        const style = getComputedStyle(node);
        if (/(auto|scroll)/.test(style.overflowY) || node.scrollHeight > node.clientHeight) addCandidate(candidates, node);
        node = node.parentElement;
      }
      addCandidate(candidates, document.scrollingElement);
      candidates.sort((left, right) => scrollParentScore(right) - scrollParentScore(left));
      return candidates[0] || null;
    };
    const scrollParent = findScrollParent();
    if (!scrollParent) return { label: \`source-window-\${index + 1}\`, requestedScrollTop: position, actualScrollTop: 0, turnCount: 0, candidates: [], reason: "scroll parent missing" };
    scrollParent.scrollTop = position;
    scrollParent.dispatchEvent(new Event("scroll", { bubbles: true }));
    const waitForVisibleText = async () => {
      for (let attempt = 0; attempt < 7; attempt += 1) {
        await sleep(attempt === 0 ? 240 : 140);
        const nodes = [
          ...Array.from(root.querySelectorAll(turnSelector())),
          ...Array.from(root.querySelectorAll(selectors.activityHeader || "")),
          ...Array.from(root.querySelectorAll(selectors.userBubble || "")),
        ].filter(Boolean);
        if (nodes.some((node) => visible(node) && textOf(node, 120).length > 0)) return true;
      }
      return false;
    };
    await waitForVisibleText();
    const countIn = (element, selector) => Array.from(element.querySelectorAll(selector)).filter(visible).length;
    const processedSummaryPattern = /(?:\\u5df2\\u5904\\u7406|Processed)\\s+\\d/i;
    const loadedTurns = () => Array.from(root.querySelectorAll(turnSelector())).filter(visible).slice(0, 60);
    const expandProcessedSummaries = async (scopeTurns) => {
      let clicked = 0;
      for (const turn of scopeTurns) {
        const controls = Array.from(turn.querySelectorAll("button[aria-expanded], [role='button'][aria-expanded], [data-disclosure-toggle]")).filter(visible);
        for (const control of controls) {
          if (clicked >= 10) return clicked;
          const label = textOf(control, 160) || control.getAttribute?.("aria-label") || "";
          if (!processedSummaryPattern.test(label)) continue;
          if (String(control.getAttribute?.("aria-expanded") || "") === "true") continue;
          control.scrollIntoView?.({ block: "nearest", inline: "nearest" });
          await sleep(40);
          control.click();
          clicked += 1;
          await sleep(80);
        }
      }
      return clicked;
    };
    let turns = loadedTurns();
    const expandedProcessed = await expandProcessedSummaries(turns);
    if (expandedProcessed) {
      await sleep(240);
      turns = loadedTurns();
    }
    const summaryCountIn = (element) => Math.max(countIn(element, selectors.summaryButton), processedSummaryPattern.test(textOf(element, 1200)) ? 1 : 0);
    const countsForTurn = (turn) => ({
      summaries: summaryCountIn(turn),
      activityHeaders: countIn(turn, selectors.activityHeader),
      toolGroupItems: countIn(turn, selectors.toolGroupItem),
      userBubbles: countIn(turn, selectors.userBubble),
      assistantMarkdown: countIn(turn, selectors.assistantMarkdown),
      fileReferences: countIn(turn, selectors.fileReference),
      shimmers: countIn(turn, selectors.shimmer),
    });
    const scopedCount = (selector) => {
      const nodes = new Set();
      for (const turn of turns) {
        for (const node of Array.from(turn.querySelectorAll(selector)).filter(visible)) nodes.add(node);
      }
      return nodes.size;
    };
    const candidates = [];
    const addText = (kind, node, limit = 260, turn = null) => {
      const text = textOf(node, limit);
      if (text) candidates.push({ kind, text, counts: turn ? countsForTurn(turn) : {} });
    };
    const activityLabelInfo = (value) => {
      const text = String(value || "").replace(/\\s+/g, " ").trim();
      const zh = text.match(/已(编辑|创建|删除)\\s+(\\d+)\\s+个文件/);
      if (zh) return { label: zh[0], action: ({ "编辑": "update", "创建": "add", "删除": "delete" })[zh[1]] || "", count: Number(zh[2] || 0) };
      const en = text.match(/\\b(edited|created|deleted)\\s+(\\d+)\\s+files?\\b/i);
      if (en) return { label: en[0], action: ({ edited: "update", created: "add", deleted: "delete" })[en[1].toLowerCase()] || "", count: Number(en[2] || 0) };
      return null;
    };
    const normalizeFileToken = (value) => {
      let token = String(value || "")
        .replace(/^[\`"'([{<]+|[\`"',.;:)\\]}>，。；、]+$/g, "")
        .replace(/\\\\/g, "/")
        .trim();
      if (!token) return "";
      token = token.replace(/^(?:\\/root\\/code\\/codex-web\\/|\\/workspace\\/|\\/root\\/)/, "");
      token = token.replace(/^\\.\\//, "");
      if (!/[A-Za-z0-9_.@/-]+\\.[A-Za-z0-9][A-Za-z0-9._-]*/.test(token)) return "";
      if (/^(?:li|div|span|button|svg|path|a)\\.[a-z0-9_.-]+$/i.test(token)) return "";
      if (/^\\d+(?:\\.\\d+)?(?:px|rem|em|vh|vw|%)$/i.test(token)) return "";
      return token.toLowerCase();
    };
    const uniqueTokens = (values) => {
      const seen = new Set();
      const out = [];
      for (const value of values || []) {
        const token = normalizeFileToken(value);
        if (!token || seen.has(token)) continue;
        seen.add(token);
        out.push(token);
      }
      return out;
    };
    const extractFileTokens = (value) => uniqueTokens(String(value || "").match(/(?:[A-Za-z]:)?[A-Za-z0-9_.@~/-]*[A-Za-z0-9_.@-]+\\.[A-Za-z0-9][A-Za-z0-9._-]*/g) || []);
    const fileStatsFromText = (value) => {
      const text = textOf({ innerText: value }, 8000);
      const out = [];
      const pattern = /(?:^|\\s)([^\\s\`"'<>]+?\\.[a-zA-Z0-9][a-zA-Z0-9._-]*)\\s*\\+\\s*(\\d+)\\s*-\\s*(\\d+)/g;
      let match;
      while ((match = pattern.exec(text)) && out.length < 40) {
        const token = normalizeFileToken(match[1]);
        if (!token || token.startsWith("-")) continue;
        out.push(token + " +" + match[2] + " -" + match[3]);
      }
      return Array.from(new Set(out));
    };
    const activityContainerFor = (node, turn) => {
      const candidates = [];
      let current = node;
      while (current && current !== root && current !== document.documentElement) {
        candidates.push(current);
        if (turn && current === turn) break;
        current = current.parentElement;
      }
      if (turn && !candidates.includes(turn)) candidates.push(turn);
      const score = (candidate) => {
        const fileCount = Array.from(candidate.querySelectorAll?.(selectors.fileReference) || []).filter(visible).length;
        const activityCount = Array.from(candidate.querySelectorAll?.(selectors.activityHeader) || []).filter(visible).length;
        const body = textOf(candidate, 5000);
        const textLength = body.length;
        const stats = fileStatsFromText(body);
        const tokenCount = extractFileTokens(body).length;
        let value = 0;
        if (stats.length > 0) value += 3000 + Math.min(stats.length, 8) * 250;
        if (fileCount > 0) value += 1200 + Math.min(fileCount, 8) * 120;
        if (tokenCount > 0) value += 600 + Math.min(tokenCount, 8) * 80;
        if (activityCount === 1) value += 900;
        else if (activityCount > 1) value -= activityCount * 900;
        value -= Math.min(textLength, 5000) / 4;
        if (candidate === node) value -= 500;
        if (turn && candidate === turn) value -= 1200;
        return value;
      };
      candidates.sort((left, right) => score(right) - score(left));
      return candidates[0] || node.parentElement || node;
    };
    const activityMetadata = (node, container, labelInfo, body) => {
      const fileTexts = [];
      for (const fileNode of Array.from(container?.querySelectorAll?.(selectors.fileReference) || []).filter(visible)) {
        fileTexts.push(textOf(fileNode, 180));
        const title = fileNode.getAttribute?.("title") || fileNode.getAttribute?.("aria-label") || "";
        if (title) fileTexts.push(title);
      }
      const stats = fileStatsFromText(body).slice(0, 20);
      const statFileTokens = uniqueTokens(stats.map((stat) => String(stat).split(/\\s+/)[0]));
      const bodyFileTokens = uniqueTokens([
        ...extractFileTokens(body),
        ...fileTexts.flatMap((text) => extractFileTokens(text)),
      ]);
      const fileTokens = statFileTokens.length
        ? uniqueTokens([
            ...statFileTokens,
            ...fileTexts.flatMap((text) => extractFileTokens(text)),
          ])
        : bodyFileTokens;
      return {
        label: labelInfo.label,
        action: labelInfo.action,
        count: labelInfo.count,
        body,
        fileTokens,
        basenames: uniqueTokens(fileTokens.map((token) => token.split("/").filter(Boolean).at(-1) || token)),
        stats,
      };
    };
    const addActivityText = (node, turn = null) => {
      const label = textOf(node, 80);
      const nearest = node.closest?.("[data-codex-tool-group-item], .thread-diff-virtualized");
      const container = nearest || activityContainerFor(node, turn);
      const body = textOf(container, 3000);
      const labelInfo = activityLabelInfo(label);
      if (!labelInfo) return;
      candidates.push({
        kind: "activity",
        text: labelInfo.label,
        counts: turn ? countsForTurn(turn) : {},
        activity: activityMetadata(node, container, labelInfo, body),
      });
    };
    for (const turn of turns) {
      for (const node of Array.from(turn.querySelectorAll(selectors.activityHeader)).filter(visible)) addActivityText(node, turn);
      for (const node of Array.from(turn.querySelectorAll(selectors.userBubble)).filter(visible)) addText("user", node, 260, turn);
      for (const node of Array.from(turn.querySelectorAll(selectors.fileReference)).filter(visible)) addText("file", node, 180, turn);
      for (const node of Array.from(turn.querySelectorAll(selectors.assistantMarkdown)).filter(visible)) addText("assistant", node, 260, turn);
      addText("turn", turn, 300, turn);
    }
    const first = turns[0];
    const last = turns.at(-1);
    return {
      label: \`source-window-\${index + 1}\`,
      requestedScrollTop: position,
      actualScrollTop: Math.round(scrollParent.scrollTop || 0),
      scroll: {
        top: Math.round(scrollParent.scrollTop || 0),
        height: Math.round(scrollParent.scrollHeight || 0),
        clientHeight: Math.round(scrollParent.clientHeight || 0),
      },
      expandedProcessed,
      firstTurnKey: first?.getAttribute("data-turn-key") || first?.getAttribute("data-content-search-unit-key") || "",
      lastTurnKey: last?.getAttribute("data-turn-key") || last?.getAttribute("data-content-search-unit-key") || "",
      turnCount: turns.length,
      counts: {
        turns: turns.length,
        summaries: Math.max(scopedCount(selectors.summaryButton), turns.filter((turn) => processedSummaryPattern.test(textOf(turn, 1200))).length),
        activityHeaders: scopedCount(selectors.activityHeader),
        toolGroupItems: scopedCount(selectors.toolGroupItem),
        userBubbles: scopedCount(selectors.userBubble),
        assistantMarkdown: scopedCount(selectors.assistantMarkdown),
        fileReferences: scopedCount(selectors.fileReference),
        shimmers: scopedCount(selectors.shimmer),
      },
      candidates,
    };
  })()`;
}

function pickDiscoveredAnchor(candidates, used) {
  for (const kind of DISCOVER_ANCHOR_KINDS) {
    for (const entry of candidates) {
      if (entry?.kind !== kind) continue;
      const anchor = cleanDiscoveredAnchor(entry?.text, entry?.kind);
      if (entry.kind === "file" && !/\(line\s+\d+\)$/i.test(anchor)) continue;
      if (entry.kind === "activity" && !usableActivityCandidate(entry)) continue;
      const key = discoveredAnchorKey(entry, anchor);
      if (anchor && !used.has(key)) {
        return {
          text: anchor,
          kind: entry.kind,
          counts: entry.counts || {},
          activity: entry.activity || null,
        };
      }
    }
  }
  return null;
}

function usableActivityCandidate(entry) {
  const activity = entry?.activity && typeof entry.activity === "object" ? entry.activity : {};
  const count = Number(activity.count || parseActivityLabel(entry?.text || "")?.count || 0);
  const tokens = Array.isArray(activity.fileTokens) ? activity.fileTokens.filter(Boolean) : [];
  const stats = Array.isArray(activity.stats) ? activity.stats.filter(Boolean) : [];
  if (!tokens.length) return false;
  if (!stats.length) return false;
  if (count > 0 && tokens.length > count * 2) return false;
  return true;
}

function discoveredAnchorKey(entry, anchor) {
  const activity = entry?.activity && typeof entry.activity === "object" ? entry.activity : {};
  const tokens = Array.isArray(activity.fileTokens) ? activity.fileTokens.slice(0, 8).join("|") : "";
  return `${entry?.kind || "text"}:${anchor}:${tokens}`;
}

function cleanDiscoveredAnchor(value, kind = "") {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text || (kind === "activity" ? text.length < 4 : text.length < 12)) return "";
  if (/^(已处理|Processed)\b/i.test(text)) return "";
  if (/^(已处理|Processed|正在思考|Thinking|Success|Stopped|running|completed|failed)$/i.test(text)) return "";
  if (/^\d{1,2}:\d{2}$/.test(text)) return "";
  if (kind === "activity" && !/(?:已(?:编辑|创建|删除)\s+\d+\s+个文件|edited\s+\d+\s+files?|created\s+\d+\s+files?|deleted\s+\d+\s+files?)/i.test(text)) return "";
  if (text.length <= 180) return text;
  const slice = text.slice(0, 180);
  const lastBreak = Math.max(slice.lastIndexOf("。"), slice.lastIndexOf("."), slice.lastIndexOf(" "), slice.lastIndexOf("，"), slice.lastIndexOf(","));
  return slice.slice(0, lastBreak > 40 ? lastBreak : 180).trim();
}

async function getOrCreateTarget(pattern, url, label, excludedID = "", options = {}) {
  const targets = await readJSON(`${CDP}/json/list`);
  if (!options.fresh) {
    const existing = targets
      .filter((target) => target.type === "page" && target.id !== excludedID && target.webSocketDebuggerUrl)
      .find((target) => pattern.test(`${target.url || ""} ${target.title || ""}`));
    if (existing) return existing;
  }
  const response = await fetch(`${CDP}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  if (!response.ok) throw new Error(`create ${label} target: ${response.status} ${response.statusText}`);
  return response.json();
}

async function preparePage(page, url, options = {}) {
  await page.send("Page.enable");
  await page.send("Runtime.enable");
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
        localStorage.setItem("codex-web:sidebar-width", ${JSON.stringify(String(TARGET_SIDEBAR_WIDTH))});
        localStorage.setItem("codex-web:node-id", ${JSON.stringify(TARGET_NODE_ID)});
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
  await waitFor(page, `document.querySelector("#codexPanel")?.shadowRoot || document.readyState === "complete"`, 60000, "target app shell");
  await evalPage(page, `(() => {
    window.dispatchEvent(new CustomEvent("codex-web:open-session", {
      detail: { nodeId: ${JSON.stringify(TARGET_NODE_ID)}, sessionId: ${JSON.stringify(TARGET_SESSION_ID)} }
    }));
  })()`);
  await waitFor(page, `Boolean(document.querySelector("#codexPanel")?.shadowRoot?.querySelector("[data-thread-scroll]"))`, 90000, "target thread scroll");
}

async function findCodexContext(page, label, selectors) {
  await wait(500);
  const frameTree = await page.send("Page.getFrameTree").catch(() => null);
  const frames = flattenFrames(frameTree?.frameTree).filter((frame) => frame.id);
  const candidates = [];
  for (const frame of frames) {
    const contextId = await createIsolatedWorld(page, frame.id);
    if (!contextId) continue;
    const probe = await evalInContext(page, contextId, contextProbeExpression(selectors)).catch((error) => ({ error: error.message }));
    const frameOffset = await frameViewportOffset(page, frame.id);
    candidates.push({ label, frameId: frame.id, url: frame.url || "", contextId, probe, score: Number(probe?.score || 0), frameOffset });
  }
  candidates.sort((left, right) => right.score - left.score);
  return candidates.find((item) => item.score > 0) || candidates[0] || null;
}

async function frameViewportOffset(page, frameId) {
  const zero = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  if (!frameId) return zero;
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
  return {
    left: Math.round(left),
    top: Math.round(top),
    right: Math.round(right),
    bottom: Math.round(bottom),
    width: Math.round(right - left),
    height: Math.round(bottom - top),
  };
}

function contextProbeExpression(selectors) {
  return `(() => {
    const selectors = ${JSON.stringify(selectors)};
    const roots = [document, document.querySelector("#codexPanel")?.shadowRoot].filter(Boolean);
    let best = { score: 0, rootKind: "document" };
    for (const root of roots) {
      const hasConversation = Boolean(root.querySelector(selectors.conversation));
      const hasTurn = Boolean(root.querySelector(selectors.turn));
      const hasComposer = Boolean(root.querySelector(".composer-surface-chrome"));
      const hasUserBubble = Boolean(root.querySelector(selectors.userBubble));
      const hasAssistant = Boolean(root.querySelector(selectors.assistantMarkdown));
      const score = [hasConversation, hasTurn, hasComposer, hasUserBubble, hasAssistant].filter(Boolean).length * 10;
      if (score > best.score) {
        const conversation = root.querySelector(selectors.conversation);
        const conversationRect = conversation?.getBoundingClientRect?.();
        const viewportWidth = root === document
          ? document.documentElement.clientWidth || window.innerWidth
          : root.host?.getBoundingClientRect?.().width || window.innerWidth;
        best = {
          score,
          rootKind: root === document ? "document" : "shadow",
          hasConversation,
          hasTurn,
          hasComposer,
          hasUserBubble,
          hasAssistant,
          title: document.title,
          url: location.href,
          viewportWidth: Math.round(viewportWidth || 0),
          conversationRect: conversationRect ? {
            left: Math.round(conversationRect.left),
            top: Math.round(conversationRect.top),
            right: Math.round(conversationRect.right),
            bottom: Math.round(conversationRect.bottom),
            width: Math.round(conversationRect.width),
            height: Math.round(conversationRect.height),
          } : null,
          textSample: hasConversation || hasTurn ? ((root.body || root.host || document.body)?.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 500) : "",
        };
      }
    }
    return best;
  })()`;
}

async function locateAnchorWindow(page, contextId, selectors, anchor, side, index) {
  return evalInContext(page, contextId, anchorWindowExpression(selectors, anchor, side, index));
}

async function locateTargetAnchorWindow(page, contextId, selectors, anchor, index, targetAPIAnchor = {}, desiredAnchorTop = null) {
  let focusState = null;
  if (targetAPIAnchor?.seq) {
    await resetTargetDisclosures(page).catch(() => {});
    focusState = await focusTargetSession(page, targetAPIAnchor.seq, desiredAnchorTop);
  }
  const result = await evalInContext(
    page,
    contextId,
    anchorWindowExpression(selectors, anchor, "target", index, { focusSeq: Number(targetAPIAnchor?.seq || 0), syntheticDisclosureProbe: false, desiredAnchorTop }),
  );
  return { ...result, targetAPIAnchor, focusState };
}

async function resetTargetDisclosures(page) {
  await evalPage(page, `(() => {
    const root = document.querySelector("#codexPanel")?.shadowRoot;
    if (!root) return { closed: 0 };
    let closed = 0;
    for (const button of Array.from(root.querySelectorAll("[data-disclosure-toggle][aria-expanded='true']"))) {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, composed: true, view: window }));
      closed += 1;
    }
    return { closed };
  })()`);
  await wait(160);
}

async function probeDisclosuresWithRealClick(page, contextId, selectors, side, index, matchedTurnKey = "") {
  const candidates = await evalInContext(page, contextId, disclosureCandidatesExpression(selectors, side, index));
  if (!candidates?.ok) return { ok: false, reason: candidates?.reason || "disclosure candidates unavailable", controls: 0, clicked: 0, blocked: 0, disclosures: [] };

  let controls = (Array.isArray(candidates.controls) ? candidates.controls : [])
    .filter((control) => control.clickable !== false)
    .filter((control) => disclosureIntersectsViewport(control))
    .filter((control) => disclosureClickIntersectsViewport(control));
  if (!REAL_CLICK_ALL_DISCLOSURES && matchedTurnKey) {
    const matchedControls = controls.filter((control) => control.turnKey === matchedTurnKey);
    if (matchedControls.length) controls = matchedControls;
  }
  const processedControls = controls.filter((control) => control.isProcessed);
  const orderedControls = (REAL_CLICK_ALL_DISCLOSURES ? [
    ...controls.filter((control) => !control.isProcessed),
    ...processedControls,
  ] : processedControls).slice(0, 12);
  const disclosures = [];
  let clicked = 0;
  let blocked = 0;
  let probed = 0;
  const seenControls = new Set();

  const probeControl = async (control) => {
    const controlID = control?.id || control?.key || `${control?.turnKey || "turn"}:${control?.order || 0}`;
    if (seenControls.has(controlID)) return;
    seenControls.add(controlID);
    probed += 1;
    const before = await evalInContext(page, contextId, disclosureSnapshotExpression(selectors, side, index, control));
    if (!before?.found) {
      disclosures.push({ ...control, kind: "control", interactive: true, realClick: false, opened: false, reason: before?.reason || "control no longer found" });
      blocked += 1;
      return;
    }
    if (!disclosureIntersectsViewport(before) || !disclosureClickIntersectsViewport(before)) {
      disclosures.push({
        ...control,
        ...before,
        kind: "control",
        interactive: true,
        interaction: "cdp-real-mouse",
        realClick: null,
        skipped: true,
        reason: "control outside safe click viewport before click",
      });
      return;
    }

    const beforeBodyText = before?.bodyText || "";
    const alreadyOpen = before.beforeExpanded === "true" || Boolean(before.bodyVisible && beforeBodyText);
    const hitOK = Boolean(before.hitTest?.controlHit || before.hitTest?.selfHit);
    if (!hitOK && !alreadyOpen) blocked += 1;
    if (hitOK && before.rect?.centerX != null && before.rect?.centerY != null && before.beforeExpanded !== "true") {
      await dispatchMouseClick(page, before.rect.centerX, before.rect.centerY);
      await wait(220);
      clicked += 1;
    }

    const after = await evalInContext(page, contextId, disclosureSnapshotExpression(selectors, side, index, control));
    const bodyText = after?.bodyText || before.bodyText || "";
    const opened = before.beforeExpanded === "true" || after?.beforeExpanded === "true" || Boolean(after?.bodyVisible && bodyText);
    disclosures.push({
      ...control,
      ...before,
      kind: "control",
      interaction: "cdp-real-mouse",
      realClick: hitOK ? true : alreadyOpen ? null : false,
      afterExpanded: after?.beforeExpanded || "",
      opened,
      bodyVisible: Boolean(after?.bodyVisible || before.bodyVisible),
      bodyText,
      body: after?.body || before.body || null,
      expandedText: after?.turnText && before.turnText && after.turnText.length > before.turnText.length
        ? after.turnText.slice(before.turnText.length).trim()
        : bodyText,
      afterTurnText: after?.turnText || "",
      beforeTurnText: before.turnText || "",
      afterHitTest: after?.hitTest || null,
      afterBody: after?.body || null,
      reason: hitOK
        ? ""
        : alreadyOpen
          ? "already expanded before click; hit-test covered by surrounding chrome"
          : "elementFromPoint did not hit disclosure control",
    });
  };

  for (const control of orderedControls) {
    await probeControl(control);
  }

  const afterCandidates = await evalInContext(page, contextId, disclosureCandidatesExpression(selectors, side, index)).catch((error) => ({ ok: false, reason: error.message, controls: [] }));
  const followupControls = Array.isArray(afterCandidates?.controls)
    ? afterCandidates.controls
      .filter((control) => control.clickable !== false)
      .filter((control) => disclosureIntersectsViewport(control))
      .filter((control) => disclosureClickIntersectsViewport(control))
      .filter((control) => !seenControls.has(control.id || control.key || `${control.turnKey || "turn"}:${control.order || 0}`))
      .filter((control) => REAL_CLICK_ALL_DISCLOSURES || control.isProcessed)
      .slice(0, Math.max(0, 12 - probed))
    : [];
  for (const control of followupControls) {
    await probeControl(control);
  }

  const finalCandidates = await evalInContext(page, contextId, disclosureCandidatesExpression(selectors, side, index)).catch((error) => ({ ok: false, reason: error.message, controls: [] }));
  const afterDisclosures = Array.isArray(finalCandidates?.controls)
    ? finalCandidates.controls.map((control) => ({ ...control, kind: "control", interactive: true, interaction: "after-real-click-snapshot" }))
    : [];
  const mergedDisclosures = mergeDisclosureEvidence(disclosures, afterDisclosures);
  const reason = blocked
    ? `${blocked} disclosure controls failed lookup or hit-test`
    : probed
      ? ""
      : "no clickable disclosure controls found in visible target window";
  return {
    ok: disclosures.every((item) => item.realClick !== false),
    reason,
    controls: probed,
    clicked,
    blocked,
    disclosures: mergedDisclosures,
    candidateSummary: candidates,
    afterCandidateSummary: finalCandidates,
  };
}

async function dispatchMouseClick(page, x, y) {
  const params = { x: Math.round(Number(x)), y: Math.round(Number(y)), button: "left", clickCount: 1 };
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: params.x, y: params.y, button: "none" });
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", ...params });
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...params });
}

async function settlePageForEvidence(page) {
  const x = Math.max(760, Math.min(VIEWPORT_WIDTH - 120, Math.floor(VIEWPORT_WIDTH * 0.72)));
  const y = Math.max(80, Math.min(VIEWPORT_HEIGHT - 160, Math.floor(VIEWPORT_HEIGHT * 0.18)));
  await page.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x,
    y,
    button: "none",
  }).catch(() => {});
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
    await wait(80);
  }
  await wait(120);
}

async function focusTargetSession(page, focusSeq, focusTop = null) {
  if (!focusSeq || !TARGET_SESSION_ID) return null;
  const desiredFocusTop = Number.isFinite(Number(focusTop)) ? Number(focusTop) : null;
  await evalPage(page, `(() => {
    window.dispatchEvent(new CustomEvent("codex-web:open-session", {
      detail: {
        nodeId: ${JSON.stringify(TARGET_NODE_ID)},
        sessionId: ${JSON.stringify(TARGET_SESSION_ID)},
        focusSeq: ${JSON.stringify(Number(focusSeq))},
        focusTop: ${desiredFocusTop === null ? "null" : JSON.stringify(desiredFocusTop)},
      },
    }));
  })()`);
  await waitFor(page, `(() => {
    const root = document.querySelector("#codexPanel")?.shadowRoot;
    const scroll = root?.querySelector("[data-thread-scroll]");
    if (!scroll) return false;
    const first = Number(scroll.getAttribute("data-history-first-seq") || 0);
    const last = Number(scroll.getAttribute("data-history-last-seq") || 0);
    const loading = scroll.getAttribute("data-history-loading-before") === "true";
    const focus = ${JSON.stringify(Number(focusSeq))};
    return !loading && first > 0 && last > 0 && focus >= first && focus <= last;
  })()`, 120000, `target history range for seq ${focusSeq}`);
  await waitFor(page, `(() => {
    const root = document.querySelector("#codexPanel")?.shadowRoot;
    const scroll = root?.querySelector("[data-thread-scroll]");
    return Boolean(scroll) && scroll.getAttribute("data-history-loading-before") !== "true";
  })()`, 120000, `target history loading settled for seq ${focusSeq}`);
  const focusVisibleWait = await waitFor(page, `(() => {
    const root = document.querySelector("#codexPanel")?.shadowRoot;
    const scroll = root?.querySelector("[data-thread-scroll]");
    if (!root || !scroll) return false;
    const focus = ${JSON.stringify(Number(focusSeq))};
    const turns = Array.from(root.querySelectorAll("[data-codex-virtual-turn]"));
    const focusTurn = turns.find((turn) => String(turn.getAttribute("data-codex-turn-seqs") || "")
      .split(",")
      .map((value) => Number(value))
      .includes(focus));
    if (!focusTurn) return false;
    const rect = focusTurn.getBoundingClientRect();
    const scrollRect = scroll.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom >= scrollRect.top && rect.top <= scrollRect.bottom;
  })()`, 15000, `target focus turn visible for seq ${focusSeq}`).then(() => true).catch(() => false);
  await evalPage(page, `(() => {
    const root = document.querySelector("#codexPanel")?.shadowRoot;
    const scroll = root?.querySelector("[data-thread-scroll]");
    if (!root || !scroll) return { centered: false, reason: "missing root or scroll" };
    const focus = ${JSON.stringify(Number(focusSeq))};
    const desiredFocusTop = ${desiredFocusTop === null ? "null" : JSON.stringify(desiredFocusTop)};
    const scrollRect = scroll.getBoundingClientRect();
    const turns = Array.from(root.querySelectorAll("[data-codex-virtual-turn]"));
    const focusTurn = turns.find((turn) => String(turn.getAttribute("data-codex-turn-seqs") || "")
      .split(",")
      .map((value) => Number(value))
      .includes(focus));
    const rectInfo = (element) => {
      const rect = element?.getBoundingClientRect?.();
      return rect && rect.width > 0 && rect.height > 0 ? {
        element,
        rect,
        intersectsViewport: rect.bottom >= scrollRect.top && rect.top <= scrollRect.bottom,
        distance: Math.abs(((rect.top + rect.bottom) / 2) - ((scrollRect.top + scrollRect.bottom) / 2)),
      } : null;
    };
    const eventCandidates = focusTurn
      ? Array.from(focusTurn.querySelectorAll('[data-codex-event-seq="' + focus + '"], [data-codex-event-seqs~="' + focus + '"]'))
        .map(rectInfo)
        .filter(Boolean)
      : [];
    eventCandidates.sort((left, right) => {
      if (left.intersectsViewport !== right.intersectsViewport) return left.intersectsViewport ? -1 : 1;
      return left.distance - right.distance;
    });
    const target = eventCandidates[0]?.element || focusTurn || null;
    if (!target) return { centered: false, reason: "focus target missing" };
    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) return { centered: false, reason: "focus target empty" };
    const offset = Number.isFinite(desiredFocusTop)
      ? Math.max(16, Math.min(Math.max(16, scroll.clientHeight - 48), desiredFocusTop - scrollRect.top))
      : Math.max(96, Math.floor(scroll.clientHeight * 0.24));
    const nextTop = Math.max(0, (scroll.scrollTop || 0) + rect.top - scrollRect.top - offset);
    scroll.scrollTop = nextTop;
    scroll.dispatchEvent(new Event("scroll", { bubbles: true }));
    window.__codexAnchorFocusCenter = {
      centered: true,
      scrollTop: Math.round(scroll.scrollTop || 0),
      targetTop: Math.round(rect.top),
      scrollTopViewport: Math.round(scrollRect.top),
      offset,
      targetSelector: target.getAttribute("data-codex-event-seq")
        ? "data-codex-event-seq"
        : target.getAttribute("data-codex-event-seqs")
          ? "data-codex-event-seqs"
          : "focus-turn",
      candidateCount: eventCandidates.length,
    };
    return window.__codexAnchorFocusCenter;
  })()`).catch(() => null);
  await wait(180);
  return evalPage(page, `(() => {
    const root = document.querySelector("#codexPanel")?.shadowRoot;
    const scroll = root?.querySelector("[data-thread-scroll]");
    const turns = Array.from(root?.querySelectorAll("[data-codex-virtual-turn]") || []);
    const focusTurn = turns.find((turn) => String(turn.getAttribute("data-codex-turn-seqs") || "")
      .split(",")
      .map((value) => Number(value))
      .includes(${JSON.stringify(Number(focusSeq))}));
    const visible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    return {
      focusSeq: ${JSON.stringify(Number(focusSeq))},
      focusCenter: window.__codexAnchorFocusCenter || null,
      historyFirstSeq: Number(scroll?.getAttribute("data-history-first-seq") || 0),
      historyLastSeq: Number(scroll?.getAttribute("data-history-last-seq") || 0),
      loadingBefore: scroll?.getAttribute("data-history-loading-before") === "true",
      scrollTop: Math.round(scroll?.scrollTop || 0),
      scrollHeight: Math.round(scroll?.scrollHeight || 0),
      clientHeight: Math.round(scroll?.clientHeight || 0),
      renderedTurnCount: turns.length,
      firstVirtualTurn: turns[0]?.getAttribute("data-codex-virtual-turn") || "",
      lastVirtualTurn: turns.at(-1)?.getAttribute("data-codex-virtual-turn") || "",
      visibleTurnCount: turns.filter(visible).length,
      focusVisibleWait: ${JSON.stringify(Boolean(focusVisibleWait))},
      focusTurn: focusTurn ? {
        key: focusTurn.getAttribute("data-codex-virtual-turn") || "",
        seqs: focusTurn.getAttribute("data-codex-turn-seqs") || "",
        focusedAttr: focusTurn.getAttribute("data-codex-focus-turn") || "",
        rect: (() => {
          const rect = focusTurn.getBoundingClientRect();
          const scrollRect = scroll?.getBoundingClientRect?.() || { top: 0, bottom: window.innerHeight };
          return {
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            inViewport: rect.width > 0 && rect.height > 0 && rect.bottom >= scrollRect.top && rect.top <= scrollRect.bottom,
          };
        })(),
        text: (focusTurn.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 1200),
        html: (focusTurn.outerHTML || "").slice(0, 2400),
      } : null,
      midRenderedSamples: turns.slice(10, 18).map((turn) => ({
        key: turn.getAttribute("data-codex-virtual-turn") || "",
        seqs: turn.getAttribute("data-codex-turn-seqs") || "",
        text: (turn.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 360),
      })),
      renderedSamples: turns.slice(0, 5).map((turn) => ({
        key: turn.getAttribute("data-codex-virtual-turn") || "",
        text: (turn.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 260),
      })),
    };
  })()`).catch((error) => ({ focusSeq: Number(focusSeq), error: error.message }));
}

function disclosureCandidatesExpression(selectors, side, index) {
  return `(() => {
    const selectors = ${JSON.stringify(selectors)};
    const side = ${JSON.stringify(side)};
    const index = ${JSON.stringify(index)};
    const roots = [document, document.querySelector("#codexPanel")?.shadowRoot].filter(Boolean);
    const pickRoot = () => {
      for (const root of roots) {
        if (root.querySelector(selectors.conversation) || root.querySelector(selectors.turn)) return root;
      }
      return document;
    };
    const root = pickRoot();
    const normalizeText = (value) => String(value || "").replace(/\\s+/g, " ").trim();
    const hiddenByAncestor = (element) => {
      let node = element;
      while (node && node.nodeType === Node.ELEMENT_NODE) {
        const style = getComputedStyle(node);
        if (node.hidden || node.inert || node.getAttribute("aria-hidden") === "true" || style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return true;
        node = node.parentElement;
      }
      return false;
    };
    const finiteNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
    const nonzeroRect = (rect) => {
      if (!rect) return null;
      const left = finiteNumber(rect.left);
      const top = finiteNumber(rect.top);
      const right = finiteNumber(rect.right);
      const bottom = finiteNumber(rect.bottom);
      const width = Math.max(0, finiteNumber(rect.width) || right - left);
      const height = Math.max(0, finiteNumber(rect.height) || bottom - top);
      if (width <= 0 || height <= 0) return null;
      return { left, top, right: right || left + width, bottom: bottom || top + height, width, height };
    };
    const visualRects = (element) => {
      if (!element || !element.isConnected) return [];
      const rects = [];
      const bounding = nonzeroRect(element.getBoundingClientRect?.());
      if (bounding) rects.push(bounding);
      for (const rect of Array.from(element.getClientRects?.() || [])) {
        const normalized = nonzeroRect(rect);
        if (normalized) rects.push(normalized);
      }
      return rects;
    };
    const visualRect = (element) => {
      const rects = visualRects(element);
      if (!rects.length) return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
      const left = Math.min(...rects.map((rect) => rect.left));
      const top = Math.min(...rects.map((rect) => rect.top));
      const right = Math.max(...rects.map((rect) => rect.right));
      const bottom = Math.max(...rects.map((rect) => rect.bottom));
      return { left, top, right, bottom, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
    };
    const rectPayload = (element) => {
      const rect = visualRect(element);
      return {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        area: Math.round(rect.width * rect.height),
      };
    };
    const visible = (element) => {
      if (!element || !element.isConnected || hiddenByAncestor(element)) return false;
      const rect = visualRect(element);
      return rect.width > 0 && rect.height > 0;
    };
    const turnSelector = () => {
      if (root.querySelector("[data-codex-virtual-turn]")) return "[data-codex-virtual-turn]";
      if (root.querySelector("[data-virtualized-turn-content]")) return "[data-virtualized-turn-content]";
      return selectors.turn;
    };
    const scrollParent = root.querySelector("[data-thread-scroll]") || document.scrollingElement;
    const viewport = scrollParent?.getBoundingClientRect?.() || { top: 0, bottom: window.innerHeight };
    const inViewport = (element) => {
      if (!visible(element)) return false;
      const rect = element.getBoundingClientRect();
      return rect.bottom >= viewport.top && rect.top <= viewport.bottom;
    };
    const processedSummaryPattern = /(?:\\u5df2\\u5904\\u7406|Processed)\\s+\\d/i;
    const controls = [];
    const turns = Array.from(root.querySelectorAll(turnSelector())).filter(inViewport).slice(0, 24);
    for (let turnIndex = 0; turnIndex < turns.length; turnIndex += 1) {
      const turn = turns[turnIndex];
      const turnKey = turn.getAttribute("data-codex-virtual-turn") || turn.getAttribute("data-turn-key") || turn.getAttribute("data-content-search-unit-key") || "";
      const candidates = Array.from(turn.querySelectorAll("button[aria-expanded], [role='button'][aria-expanded], [data-disclosure-toggle]")).filter(visible);
      for (let order = 0; order < candidates.length; order += 1) {
        const control = candidates[order];
        const label = normalizeText(control.innerText || control.textContent || control.getAttribute("aria-label") || "");
        const key = control.getAttribute("data-disclosure-toggle") || "";
        const rect = control.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const clickable = centerX >= 0 && centerX <= window.innerWidth && centerY >= viewport.top && centerY <= viewport.bottom;
        controls.push({
          id: key ? \`key:\${key}\` : \`turn:\${turnIndex}:order:\${order}\`,
          key,
          label,
          isProcessed: processedSummaryPattern.test(label),
          turnIndex,
          order,
          turnKey,
          side,
          index,
          beforeExpanded: String(control.getAttribute("aria-expanded") || ""),
          className: String(control.className || ""),
          clickable,
          rect: {
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            centerX: Math.round(centerX),
            centerY: Math.round(centerY),
          },
        });
      }
    }
    return {
      ok: true,
      side,
      index,
      rootKind: root === document ? "document" : "shadow",
      turnCount: turns.length,
      controls: controls.slice(0, 40),
    };
  })()`;
}

function disclosureSnapshotExpression(selectors, side, index, controlDescriptor) {
  return `(() => {
    const selectors = ${JSON.stringify(selectors)};
    const descriptor = ${JSON.stringify(controlDescriptor || {})};
    const roots = [document, document.querySelector("#codexPanel")?.shadowRoot].filter(Boolean);
    const pickRoot = () => {
      for (const root of roots) {
        if (root.querySelector(selectors.conversation) || root.querySelector(selectors.turn)) return root;
      }
      return document;
    };
    const root = pickRoot();
    const normalizeText = (value) => String(value || "").replace(/\\s+/g, " ").trim();
    const hiddenByAncestor = (element) => {
      let node = element;
      while (node && node.nodeType === Node.ELEMENT_NODE) {
        const style = getComputedStyle(node);
        if (node.hidden || node.inert || node.getAttribute("aria-hidden") === "true" || style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return true;
        node = node.parentElement;
      }
      return false;
    };
    const visible = (element) => {
      if (!element || hiddenByAncestor(element)) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const turnSelector = () => {
      if (root.querySelector("[data-codex-virtual-turn]")) return "[data-codex-virtual-turn]";
      if (root.querySelector("[data-virtualized-turn-content]")) return "[data-virtualized-turn-content]";
      return selectors.turn;
    };
    const controlsForTurn = (turn) => Array.from(turn.querySelectorAll("button[aria-expanded], [role='button'][aria-expanded], [data-disclosure-toggle]")).filter(visible);
    const turns = Array.from(root.querySelectorAll(turnSelector())).filter(visible);
    const allControls = Array.from(root.querySelectorAll("button[aria-expanded], [role='button'][aria-expanded], [data-disclosure-toggle]")).filter(visible);
    let turn = turns[Number(descriptor.turnIndex || 0)] || null;
    let control = descriptor.key
      ? allControls.find((node) => node.getAttribute("data-disclosure-toggle") === descriptor.key)
      : (turn ? controlsForTurn(turn)[Number(descriptor.order || 0)] : allControls[Number(descriptor.order || 0)]);
    if (!control && descriptor.label) {
      const expectedLabel = normalizeText(descriptor.label);
      const expectedRect = descriptor.rect || {};
      const expectedTop = Number(expectedRect.top || 0);
      const expectedLeft = Number(expectedRect.left || 0);
      const sameLabel = allControls
        .filter((node) => normalizeText(node.innerText || node.textContent || node.getAttribute("aria-label") || "") === expectedLabel)
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return { node, distance: Math.abs(rect.top - expectedTop) + Math.abs(rect.left - expectedLeft) };
        })
        .sort((left, right) => left.distance - right.distance);
      control = sameLabel[0]?.node || null;
      if (control && (!turn || !turn.contains(control))) {
        turn = turns.find((candidate) => candidate.contains(control)) || control.closest(turnSelector()) || turn;
      }
    }
    if (!control) {
      return {
        found: false,
        reason: "control not found",
        descriptor,
      };
    }
    const ownerTurn = control.closest(turnSelector()) || turn || control.parentElement;
    turn = ownerTurn;
    const styleSample = (element) => {
      if (!element) return {};
      const style = getComputedStyle(element);
      return {
        display: style.display,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        color: style.color,
        backgroundColor: style.backgroundColor,
        gap: style.gap,
        padding: style.padding,
        margin: style.margin,
        borderRadius: style.borderRadius,
        boxShadow: style.boxShadow,
        opacity: style.opacity,
        overflow: style.overflow,
        pointerEvents: style.pointerEvents,
        cursor: style.cursor,
      };
    };
    const cssEscape = (value) => {
      if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
      return String(value || "").replace(/["\\\\]/g, "\\\\$&");
    };
    const uniqueElements = (items) => {
      const seen = new Set();
      const result = [];
      for (const item of items) {
        if (!item || seen.has(item)) continue;
        seen.add(item);
        result.push(item);
      }
      return result;
    };
    const textOf = (element, limit = 1000) => {
      if (!element) return "";
      const chunks = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const text = normalizeText(node.nodeValue || "");
        if (!text || !visible(node.parentElement)) continue;
        chunks.push(text);
        if (chunks.join(" ").length >= limit) break;
      }
      return normalizeText(chunks.join(" ")).slice(0, limit);
    };
    const countVisible = (element, selector) => Array.from(element?.querySelectorAll?.(selector) || []).filter(visible).length;
    const structureSample = (element) => ({
      fileReferences: countVisible(element, selectors.fileReference || "[data-file-reference]"),
      threadDiffBlocks: countVisible(element, ".thread-diff-virtualized"),
      diffBlocks: countVisible(element, "[class*='diff'], [class*='Diff'], [class*='turn-diff']"),
      diffLineBlocks: countVisible(element, "[class*='diff-line'], [class*='diffLine'], [class*='cm-line']"),
      preBlocks: countVisible(element, "pre"),
      codeBlocks: countVisible(element, "pre, code"),
      buttons: countVisible(element, "button"),
      htmlSample: String(element?.outerHTML || "").slice(0, 4000),
    });
    const candidateBodyNodes = () => {
      const nodes = [];
      const controlled = control.getAttribute("aria-controls");
      if (controlled) nodes.push(root.querySelector("#" + cssEscape(controlled)));
      let node = control;
      for (let depth = 0; node && depth < 6; depth += 1) {
        nodes.push(node.nextElementSibling);
        nodes.push(node.parentElement?.nextElementSibling || null);
        nodes.push(node.parentElement?.parentElement?.nextElementSibling || null);
        node = node.parentElement;
      }
      if (ownerTurn) {
        for (const candidate of Array.from(ownerTurn.querySelectorAll("[aria-hidden='false'], [style*='height: auto'], pre, ._markdownContent_lzkx4_60"))) {
          nodes.push(candidate);
        }
      }
      return uniqueElements(nodes).filter((node) => node && node !== control && !node.contains(control) && (!ownerTurn || ownerTurn.contains(node)));
    };
    const label = normalizeText(control.innerText || control.textContent || control.getAttribute("aria-label") || "");
    const bodySnapshot = () => {
      for (const node of candidateBodyNodes()) {
        if (!visible(node)) continue;
        const text = textOf(node, 5000);
        if (!text || text === label) continue;
        const rect = node.getBoundingClientRect();
        return {
          visible: true,
          text,
          className: String(node.className || ""),
          rect: { top: Math.round(rect.top), bottom: Math.round(rect.bottom), left: Math.round(rect.left), right: Math.round(rect.right), height: Math.round(rect.height), width: Math.round(rect.width) },
          style: styleSample(node),
          structure: structureSample(node),
        };
      }
      return { visible: false, text: "", className: "", rect: { top: 0, bottom: 0, left: 0, right: 0, height: 0, width: 0 }, style: {}, structure: {} };
    };
    const hitSummary = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const x = rect.left + Math.max(1, rect.width / 2);
      const y = rect.top + Math.max(1, rect.height / 2);
      const rootHit = root.elementFromPoint?.(x, y) || document.elementFromPoint(x, y);
      const documentHit = document.elementFromPoint(x, y);
      const closestControl = rootHit?.closest?.("button[aria-expanded], [role='button'][aria-expanded], [data-disclosure-toggle]");
      const describe = (node) => node ? {
        tag: node.tagName || "",
        className: String(node.className || ""),
        text: normalizeText(node.innerText || node.textContent || "").slice(0, 160),
        dataDisclosureToggle: node.getAttribute?.("data-disclosure-toggle") || "",
        ariaExpanded: node.getAttribute?.("aria-expanded") || "",
      } : null;
      return {
        x: Math.round(x),
        y: Math.round(y),
        selfHit: rootHit === element || element.contains(rootHit),
        controlHit: closestControl === element || element.contains(closestControl),
        rootHit: describe(rootHit),
        documentHit: describe(documentHit),
        closestControl: describe(closestControl),
      };
    };
    const rect = control.getBoundingClientRect();
    const body = bodySnapshot();
    const processedSummaryPattern = /(?:\\u5df2\\u5904\\u7406|Processed)\\s+\\d/i;
    return {
      found: true,
      side: ${JSON.stringify(side)},
      index: ${JSON.stringify(index)},
      key: control.getAttribute("data-disclosure-toggle") || "",
      label,
      isProcessed: processedSummaryPattern.test(label),
      interactive: true,
      beforeExpanded: String(control.getAttribute("aria-expanded") || ""),
      className: String(control.className || ""),
      rect: {
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        centerX: Math.round(rect.left + rect.width / 2),
        centerY: Math.round(rect.top + rect.height / 2),
      },
      style: styleSample(control),
      bodyVisible: Boolean(body.visible),
      bodyText: body.text || "",
      body,
      hitTest: hitSummary(control),
      turnText: textOf(ownerTurn, 8000),
      descriptor,
    };
  })()`;
}

function anchorWindowExpression(selectors, anchor, side, index, options = {}) {
  return `(async () => {
    const selectors = ${JSON.stringify(selectors)};
    const anchor = ${JSON.stringify(anchor)};
    const focusSeq = ${JSON.stringify(Number(options.focusSeq || 0))};
    const desiredAnchorTop = ${Number.isFinite(Number(options.desiredAnchorTop)) ? JSON.stringify(Number(options.desiredAnchorTop)) : "null"};
    const syntheticDisclosureProbe = ${JSON.stringify(options.syntheticDisclosureProbe !== false)};
    const maxSteps = ${JSON.stringify(MAX_SCROLL_STEPS)};
    const evaluateBudgetMS = ${JSON.stringify(Math.max(5000, CDP_COMMAND_TIMEOUT_MS - 5000))};
    const evaluateStarted = Date.now();
    const overBudget = () => Date.now() - evaluateStarted > evaluateBudgetMS;
    const roots = [document, document.querySelector("#codexPanel")?.shadowRoot].filter(Boolean);
    const pickRoot = () => {
      for (const root of roots) {
        if (root.querySelector(selectors.conversation) || root.querySelector(selectors.turn)) return root;
      }
      return document;
    };
    const root = pickRoot();
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const settle = async () => {
      await sleep(120);
    };
    const hiddenByAncestor = (element) => {
      let node = element;
      while (node && node.nodeType === Node.ELEMENT_NODE) {
        const style = getComputedStyle(node);
        if (node.hidden || node.inert || node.getAttribute("aria-hidden") === "true" || style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return true;
        const rect = node.getBoundingClientRect();
        if (style.overflow === "hidden" && rect.width <= 0 && rect.height <= 0) return true;
        node = node.parentElement;
      }
      return false;
    };
    const finiteNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
    const nonzeroRect = (rect) => {
      if (!rect) return null;
      const left = finiteNumber(rect.left);
      const top = finiteNumber(rect.top);
      const right = finiteNumber(rect.right);
      const bottom = finiteNumber(rect.bottom);
      const width = Math.max(0, finiteNumber(rect.width) || right - left);
      const height = Math.max(0, finiteNumber(rect.height) || bottom - top);
      if (width <= 0 || height <= 0) return null;
      return { left, top, right: right || left + width, bottom: bottom || top + height, width, height };
    };
    const visualRects = (element) => {
      if (!element || !element.isConnected) return [];
      const rects = [];
      const bounding = nonzeroRect(element.getBoundingClientRect?.());
      if (bounding) rects.push(bounding);
      for (const rect of Array.from(element.getClientRects?.() || [])) {
        const normalized = nonzeroRect(rect);
        if (normalized) rects.push(normalized);
      }
      return rects;
    };
    const visualRect = (element) => {
      const rects = visualRects(element);
      if (!rects.length) return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
      const left = Math.min(...rects.map((rect) => rect.left));
      const top = Math.min(...rects.map((rect) => rect.top));
      const right = Math.max(...rects.map((rect) => rect.right));
      const bottom = Math.max(...rects.map((rect) => rect.bottom));
      return { left, top, right, bottom, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
    };
    const rectPayload = (element) => {
      const rect = visualRect(element);
      return {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        area: Math.round(rect.width * rect.height),
      };
    };
    const visible = (element) => {
      if (!element || !element.isConnected || hiddenByAncestor(element)) return false;
      const rect = visualRect(element);
      return rect.width > 0 && rect.height > 0;
    };
    const normalizeText = (value) => String(value || "").replace(/\\s+/g, " ").trim();
    const normalizedAnchor = normalizeText(anchor);
    const anchorFragments = normalizedAnchor
      .split(/[\\s,，。.!！?？:：;；、()（）\\[\\]【】]+/g)
      .map((part) => part.trim())
      .filter((part) => part.length >= 4)
      .slice(0, 8);
    const textOf = (element, limit = 1000) => {
      if (!element) return "";
      const chunks = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const text = normalizeText(node.nodeValue || "");
        if (!text || !visible(node.parentElement)) continue;
        chunks.push(text);
        if (chunks.join(" ").length >= limit) break;
      }
      return normalizeText(chunks.join(" ")).slice(0, limit);
    };
    const rawTextOf = (element, limit = 1000) => normalizeText(element?.textContent || "").slice(0, limit);
    const rectPayloadFromRect = (rect) => ({
      left: Math.round(rect?.left || 0),
      top: Math.round(rect?.top || 0),
      right: Math.round(rect?.right || 0),
      bottom: Math.round(rect?.bottom || 0),
      width: Math.round(rect?.width || Math.max(0, (rect?.right || 0) - (rect?.left || 0))),
      height: Math.round(rect?.height || Math.max(0, (rect?.bottom || 0) - (rect?.top || 0))),
      area: Math.round((rect?.width || Math.max(0, (rect?.right || 0) - (rect?.left || 0))) * (rect?.height || Math.max(0, (rect?.bottom || 0) - (rect?.top || 0)))),
    });
    const unionClientRects = (rects) => {
      const normalized = Array.from(rects || []).map(nonzeroRect).filter(Boolean);
      if (!normalized.length) return null;
      const left = Math.min(...normalized.map((rect) => rect.left));
      const top = Math.min(...normalized.map((rect) => rect.top));
      const right = Math.max(...normalized.map((rect) => rect.right));
      const bottom = Math.max(...normalized.map((rect) => rect.bottom));
      return { left, top, right, bottom, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
    };
    const mappedVisibleText = (element, limit = 120000) => {
      const chars = [];
      const map = [];
      const appendMappedChar = (node, startOffset, endOffset, value) => {
        if (chars.length >= limit) return;
        chars.push(value);
        map.push({ node, startOffset, endOffset });
      };
      const appendNode = (node) => {
        const value = String(node.nodeValue || "");
        if (!value || !visible(node.parentElement)) return;
        let start = 0;
        let end = value.length;
        while (start < end && /\\s/.test(value[start])) start += 1;
        while (end > start && /\\s/.test(value[end - 1])) end -= 1;
        if (start >= end) return;
        if (chars.length && chars[chars.length - 1] !== " ") {
          appendMappedChar(node, start, start, " ");
        }
        for (let offset = start; offset < end && chars.length < limit;) {
          const char = value[offset];
          if (/\\s/.test(char)) {
            const whitespaceStart = offset;
            while (offset < end && /\\s/.test(value[offset])) offset += 1;
            if (chars.length && chars[chars.length - 1] !== " ") {
              appendMappedChar(node, whitespaceStart, Math.min(offset, whitespaceStart + 1), " ");
            }
            continue;
          }
          appendMappedChar(node, offset, offset + 1, char);
          offset += 1;
        }
      };
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      while (walker.nextNode() && chars.length < limit) appendNode(walker.currentNode);
      return { text: normalizeText(chars.join("")).slice(0, limit), map };
    };
    const rangeRectForMappedAnchor = (mapped, startIndex, anchorLength) => {
      const start = mapped?.map?.[startIndex];
      const end = mapped?.map?.[startIndex + anchorLength - 1];
      if (!start?.node || !end?.node) return null;
      const range = document.createRange();
      try {
        range.setStart(start.node, Math.max(0, Math.min(start.startOffset, start.node.nodeValue.length)));
        range.setEnd(end.node, Math.max(0, Math.min(end.endOffset, end.node.nodeValue.length)));
        const rect = unionClientRects(range.getClientRects()) || nonzeroRect(range.getBoundingClientRect());
        range.detach?.();
        return rect;
      } catch {
        range.detach?.();
        return null;
      }
    };
    const anchorRangeInfos = (element) => {
      if (!normalizedAnchor || !element) return [];
      const mapped = mappedVisibleText(element);
      const ranges = [];
      let searchFrom = 0;
      while (ranges.length < 12) {
        const foundAt = mapped.text.indexOf(normalizedAnchor, searchFrom);
        if (foundAt < 0) break;
        const rect = rangeRectForMappedAnchor(mapped, foundAt, normalizedAnchor.length);
        if (rect && rect.width > 0 && rect.height > 0) {
          const view = viewport();
          ranges.push({
            occurrenceIndex: foundAt,
            textSample: mapped.text.slice(Math.max(0, foundAt - 80), Math.min(mapped.text.length, foundAt + normalizedAnchor.length + 80)),
            rect,
            inViewport: rect.bottom >= view.top && rect.top <= view.bottom && rect.width > 0 && rect.height > 0,
          });
        }
        searchFrom = foundAt + Math.max(1, normalizedAnchor.length);
      }
      ranges.sort((left, right) => {
        if (left.inViewport !== right.inViewport) return left.inViewport ? -1 : 1;
        const view = viewport();
        const center = view.top + ((view.bottom - view.top) / 2);
        const leftDistance = Math.abs((left.rect.top + left.rect.bottom) / 2 - center);
        const rightDistance = Math.abs((right.rect.top + right.rect.bottom) / 2 - center);
        return leftDistance - rightDistance || left.occurrenceIndex - right.occurrenceIndex;
      });
      return ranges;
    };
    const turnSelector = () => {
      if (root.querySelector("[data-codex-virtual-turn]")) return "[data-codex-virtual-turn]";
      if (root.querySelector("[data-virtualized-turn-content]")) return "[data-virtualized-turn-content]";
      return selectors.turn;
    };
    const addCandidate = (items, node) => {
      if (node && !items.includes(node)) items.push(node);
    };
    const scrollParentScore = (node) => {
      if (!node) return -Infinity;
      const conversation = root.querySelector(selectors.conversation);
      const rect = node.getBoundingClientRect?.() || { width: window.innerWidth, height: window.innerHeight };
      const style = node === document.scrollingElement ? { overflowY: "auto", display: "block", visibility: "visible", opacity: "1" } : getComputedStyle(node);
      let score = 0;
      if (node === document.scrollingElement || node.isConnected) score += 20;
      else score -= 300;
      if (style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0") score += 20;
      else score -= 300;
      if (rect.width > 0 && rect.height > 0) score += 80;
      else score -= 80;
      if (node.clientHeight > 0 && node.scrollHeight > 0) score += 60;
      if (node.scrollHeight > node.clientHeight) score += 80;
      if (/(auto|scroll)/.test(style.overflowY || "")) score += 30;
      if (conversation && node.contains?.(conversation)) score += 50;
      if (node.querySelector?.(selectors.turn)) score += 40;
      if (node.hasAttribute?.("data-thread-scroll")) score += 50;
      return score;
    };
    const findScrollParent = () => {
      const candidates = [];
      for (const explicit of Array.from(root.querySelectorAll("[data-thread-scroll]"))) addCandidate(candidates, explicit);
      const conversation = root.querySelector(selectors.conversation);
      let node = conversation;
      while (node && node !== root && node !== document.documentElement) {
        const style = getComputedStyle(node);
        if (/(auto|scroll)/.test(style.overflowY) || node.scrollHeight > node.clientHeight) addCandidate(candidates, node);
        node = node.parentElement;
      }
      addCandidate(candidates, document.scrollingElement);
      candidates.sort((left, right) => scrollParentScore(right) - scrollParentScore(left));
      return candidates[0] || null;
    };
    let scrollParent = findScrollParent();
    if (!scrollParent) return { found: false, reason: "scroll parent missing" };
    const refreshScrollParent = () => {
      const fresh = findScrollParent();
      if (fresh && fresh !== scrollParent) scrollParent = fresh;
      return scrollParent;
    };
    const viewport = () => {
      const parent = refreshScrollParent();
      if (!parent || parent === document.scrollingElement || parent === document.documentElement || parent === document.body) {
        return { top: 0, bottom: window.innerHeight, height: window.innerHeight };
      }
      const rect = visualRect(parent);
      return rect.height > 0 ? rect : { top: 0, bottom: window.innerHeight, height: window.innerHeight };
    };
    const turnNodes = () => Array.from(root.querySelectorAll(turnSelector())).filter(visible);
    const inViewport = (element) => {
      if (!visible(element)) return false;
      const rect = visualRect(element);
      const view = viewport();
      return rect.bottom >= view.top && rect.top <= view.bottom;
    };
    const requiresExactAnchor = /\(line\s+\d+\)/i.test(normalizedAnchor);
    const elementHasExactAnchor = (element) => {
      const raw = rawTextOf(element, 60000);
      const visibleText = textOf(element, Math.min(30000, Math.max(12000, raw.length + 500)));
      return visibleText.includes(normalizedAnchor);
    };
    const turnContainsFocusSeq = (element) => {
      if (${JSON.stringify(side)} !== "target" || !focusSeq) return false;
      const turn = element?.matches?.("[data-codex-virtual-turn]") ? element : element?.closest?.("[data-codex-virtual-turn]");
      const seqs = String(turn?.getAttribute?.("data-codex-turn-seqs") || "")
        .split(",")
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));
      return seqs.includes(focusSeq);
    };
    const focusEventNodes = () => {
      if (${JSON.stringify(side)} !== "target" || !focusSeq) return [];
      const selector = '[data-codex-event-seq="' + focusSeq + '"], [data-codex-event-seqs~="' + focusSeq + '"]';
      return Array.from(root.querySelectorAll(selector))
        .filter(visible)
        .sort((left, right) => {
          const leftViewport = inViewport(left);
          const rightViewport = inViewport(right);
          if (leftViewport !== rightViewport) return leftViewport ? -1 : 1;
          const view = viewport();
          const center = view.top + ((view.bottom - view.top) / 2);
          const leftRect = visualRect(left);
          const rightRect = visualRect(right);
          const leftDistance = Math.abs(((leftRect.top + leftRect.bottom) / 2) - center);
          const rightDistance = Math.abs(((rightRect.top + rightRect.bottom) / 2) - center);
          return leftDistance - rightDistance;
        });
    };
    const expandFocusedProcessedSummary = async () => {
      if (${JSON.stringify(side)} !== "target" || !focusSeq) return { attempted: false, reason: "not target focus mode" };
      const processedSummaryPattern = /(?:\\u5df2\\u5904\\u7406|Processed)\\s+\\d/i;
      const focusTurns = Array.from(root.querySelectorAll("[data-codex-virtual-turn]")).filter(visible).filter(turnContainsFocusSeq);
      const controls = [];
      for (const turn of focusTurns) {
        for (const control of Array.from(turn.querySelectorAll("[data-disclosure-toggle][aria-expanded]")).filter(visible)) {
          const label = textOf(control, 200) || rawTextOf(control, 200);
          if (!processedSummaryPattern.test(label)) continue;
          const seqCarrier = control.matches('[data-codex-event-seq="' + focusSeq + '"], [data-codex-event-seqs~="' + focusSeq + '"]')
            || Boolean(control.querySelector('[data-codex-event-seq="' + focusSeq + '"], [data-codex-event-seqs~="' + focusSeq + '"]'));
          controls.push({
            control,
            label,
            expanded: control.getAttribute("aria-expanded") || "",
            seqCarrier,
            rect: rectPayload(control),
          });
        }
      }
      controls.sort((left, right) => Number(right.seqCarrier) - Number(left.seqCarrier));
      const target = controls[0];
      if (!target) return { attempted: true, expanded: false, clicked: false, reason: "no focused processed summary control" };
      if (target.expanded === "true") return { attempted: true, expanded: true, clicked: false, label: target.label, seqCarrier: target.seqCarrier, rect: target.rect };
      target.control.scrollIntoView?.({ block: "center", inline: "nearest" });
      await settle();
      const before = target.control.getAttribute("aria-expanded") || "";
      target.control.click();
      await settle();
      const after = target.control.getAttribute("aria-expanded") || "";
      return {
        attempted: true,
        expanded: after === "true",
        clicked: true,
        before,
        after,
        label: target.label,
        seqCarrier: target.seqCarrier,
        rect: target.rect,
      };
    };
    const elementContainsAnchor = (element) => {
      if (elementHasExactAnchor(element)) return true;
      if (requiresExactAnchor) return false;
      const raw = rawTextOf(element, 60000);
      if (!raw.includes(normalizedAnchor)) {
        if (!anchorFragments.length) return false;
        const matchedFragments = anchorFragments.filter((fragment) => raw.includes(fragment)).length;
        const requiredFragments = Math.min(anchorFragments.length, normalizedAnchor.length > 80 ? 3 : 2);
        if (matchedFragments < requiredFragments) return false;
      }
      const visibleText = textOf(element, Math.min(30000, Math.max(12000, raw.length + 500)));
      if (visibleText.includes(normalizedAnchor)) return true;
      const visibleFragments = anchorFragments.filter((fragment) => visibleText.includes(fragment)).length;
      return visibleFragments >= Math.min(anchorFragments.length, normalizedAnchor.length > 80 ? 3 : 2);
    };
    const selectorLabel = (element) => {
      if (!element) return "";
      if (element.id) return "#" + element.id;
      const attrs = ["data-codex-virtual-turn", "data-turn-key", "data-content-search-unit-key", "data-user-message-bubble", "data-file-reference", "data-disclosure-toggle"];
      for (const attr of attrs) {
        const value = element.getAttribute?.(attr);
        if (value != null) return "[" + attr + (value ? "=" + JSON.stringify(String(value).slice(0, 80)) : "") + "]";
      }
      const className = String(element.className || "").trim().split(/\\s+/).filter(Boolean).slice(0, 3).join(".");
      return element.tagName.toLowerCase() + (className ? "." + className : "");
    };
    const anchorCandidateInfo = (candidate) => {
      const raw = rawTextOf(candidate, 60000);
      const visibleText = textOf(candidate, Math.min(30000, Math.max(12000, raw.length + 500)));
      const elementRect = visualRect(candidate);
      const rangeInfos = visibleText.includes(normalizedAnchor) ? anchorRangeInfos(candidate) : [];
      const selectedRange = rangeInfos[0] || null;
      const rect = selectedRange?.rect || elementRect;
      const exact = visibleText.includes(normalizedAnchor);
      let contains = exact;
      if (!contains && !requiresExactAnchor && raw.includes(normalizedAnchor)) contains = true;
      if (!contains && !requiresExactAnchor && anchorFragments.length) {
        const matchedRawFragments = anchorFragments.filter((fragment) => raw.includes(fragment)).length;
        const matchedVisibleFragments = anchorFragments.filter((fragment) => visibleText.includes(fragment)).length;
        const requiredFragments = Math.min(anchorFragments.length, normalizedAnchor.length > 80 ? 3 : 2);
        contains = matchedRawFragments >= requiredFragments && matchedVisibleFragments >= requiredFragments;
      }
      const view = viewport();
      return {
        element: candidate,
        selector: selectorLabel(candidate),
        tagName: candidate.tagName?.toLowerCase?.() || "",
        className: String(candidate.className || "").slice(0, 260),
        role: candidate.getAttribute?.("role") || "",
        ariaExpanded: candidate.getAttribute?.("aria-expanded") || "",
        exact,
        contains,
        visible: visible(candidate),
        inViewport: rect.bottom >= view.top && rect.top <= view.bottom && rect.width > 0 && rect.height > 0,
        rectSource: selectedRange ? "text-range" : "element",
        range: selectedRange ? {
          occurrenceIndex: selectedRange.occurrenceIndex,
          textSample: selectedRange.textSample,
          inViewport: selectedRange.inViewport,
          rect: rectPayloadFromRect(selectedRange.rect),
        } : null,
        textLength: visibleText.length,
        rawTextLength: raw.length,
        textSample: visibleText.slice(0, 360),
        rect: {
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          area: Math.round(rect.width * rect.height),
        },
        elementRect: rectPayloadFromRect(elementRect),
      };
    };
    const anchorCandidatesIn = (element) => {
      if (!element) return null;
      const candidateSelectors = [
        "[data-codex-virtual-turn]",
        selectors.userBubble,
        selectors.assistantMarkdown,
        selectors.summaryButton,
        selectors.activityHeader,
        selectors.fileReference,
        "[data-content-search-unit-key]",
        "[data-local-conversation-user-anchor]",
        "[data-local-conversation-final-assistant]",
        "p",
        "li",
        "button",
      ].filter(Boolean).join(",");
      const candidates = [element, ...Array.from(element.querySelectorAll(candidateSelectors))]
        .filter((candidate, candidateIndex, items) => candidate && items.indexOf(candidate) === candidateIndex)
        .filter((candidate) => candidate?.isConnected);
      const infos = candidates
        .map(anchorCandidateInfo)
        .filter((info) => info.visible && info.contains && info.rect.area > 0);
      infos.sort((left, right) => {
        if (left.exact !== right.exact) return left.exact ? -1 : 1;
        if (left.textLength !== right.textLength) return left.textLength - right.textLength;
        if (left.rect.area !== right.rect.area) return left.rect.area - right.rect.area;
        if (left.inViewport !== right.inViewport) return left.inViewport ? -1 : 1;
        return 0;
      });
      return infos;
    };
    const anchorTargetIn = (element) => {
      const candidates = anchorCandidatesIn(element) || [];
      return candidates[0]?.element || null;
    };
    const anchorTargetInfoIn = (element) => (anchorCandidatesIn(element) || [])[0] || null;
    const anchorTargetRectIn = (element) => {
      const info = anchorTargetInfoIn(element);
      return info?.rect || (element ? rectPayload(element) : null);
    };
    const anchorTargetDebug = (element) => {
      const candidates = anchorCandidatesIn(element) || [];
      const withoutElement = (info) => {
        if (!info) return null;
        const { element: _element, ...rest } = info;
        return rest;
      };
      return {
        selected: withoutElement(candidates[0] || null),
        candidates: candidates.slice(0, 8).map(withoutElement),
        candidateCount: candidates.length,
        fallbackMatch: element ? {
          selector: selectorLabel(element),
          className: String(element.className || "").slice(0, 260),
          visible: visible(element),
          rect: rectPayload(element),
          textSample: textOf(element, 500),
        } : null,
      };
    };
    const anchorTargetVisible = (element) => {
      const info = anchorTargetInfoIn(element);
      if (info) return Boolean(info.inViewport);
      return inViewport(element);
    };
    const matchingTurn = (preferViewport = false) => {
      const nodes = turnNodes();
      const requiresFocusTurn = ${JSON.stringify(side)} === "target" && focusSeq;
      const focusNodes = requiresFocusTurn
        ? Array.from(root.querySelectorAll("[data-codex-virtual-turn]")).filter(visible).filter(turnContainsFocusSeq)
        : [];
      if (requiresFocusTurn && !focusNodes.length) return null;
      const focusedEvents = focusEventNodes();
      const searchNodes = focusedEvents.length ? focusedEvents : (focusNodes.length ? focusNodes : nodes);
      const exactMatches = searchNodes.filter(elementHasExactAnchor);
      let matches = exactMatches.length ? exactMatches : searchNodes.filter(elementContainsAnchor);
      if (!matches.length) return null;
      return preferViewport ? matches.find(inViewport) || null : matches[0];
    };
    const matchStillUsable = (element) => Boolean(element?.isConnected && visible(element) && elementContainsAnchor(element));
    const scrollMetrics = () => {
      const parent = refreshScrollParent();
      return {
        top: Math.round(parent?.scrollTop || 0),
        height: Math.round(parent?.scrollHeight || 0),
        clientHeight: Math.round(parent?.clientHeight || 0),
      };
    };
    const historyStats = () => ({
      height: refreshScrollParent()?.scrollHeight || 0,
      turns: turnNodes().length,
      loading: Boolean(root.querySelector(".codex-history-page-loader, [role='status']")),
    });
    const waitForStableHistory = async () => {
      let previous = historyStats();
      let stableCount = 0;
      const started = Date.now();
      while (Date.now() - started < 5000) {
        await sleep(180);
        const next = historyStats();
        const stable = next.height === previous.height && next.turns === previous.turns && !next.loading;
        stableCount = stable ? stableCount + 1 : 0;
        previous = next;
        if (stableCount >= 3) return;
      }
    };
    const setTop = async (value) => {
      const parent = refreshScrollParent();
      parent.scrollTop = value;
      parent.dispatchEvent(new Event("scroll", { bubbles: true }));
      await settle();
      refreshScrollParent();
    };
    const searchPositions = () => {
      const parent = refreshScrollParent();
      const maxScroll = Math.max(0, parent.scrollHeight - parent.clientHeight);
      const step = Math.max(240, Math.floor(parent.clientHeight * 0.72));
      const style = getComputedStyle(parent);
      const reverse = style.flexDirection === "column-reverse" || /flex-col-reverse/.test(String(parent.className || ""));
      const currentTop = parent.scrollTop || 0;
      const positions = [];
      const add = (value) => {
        const rounded = Math.round(value);
        if (!positions.includes(rounded)) positions.push(rounded);
      };
      add(currentTop);
      add(0);
      if (maxScroll > 0) {
        add(reverse ? -maxScroll : maxScroll);
        add(reverse ? -Math.max(0, maxScroll - step) : Math.max(0, maxScroll - step));
        add(reverse ? -Math.max(0, maxScroll - (step * 3)) : Math.max(0, maxScroll - (step * 3)));
      }
      if (focusSeq && parent.hasAttribute?.("data-history-first-seq")) {
        const firstSeq = Number(parent.getAttribute("data-history-first-seq") || 0);
        const lastSeq = Number(parent.getAttribute("data-history-last-seq") || 0);
        if (firstSeq && lastSeq && focusSeq >= firstSeq && focusSeq <= lastSeq && lastSeq > firstSeq) {
          const ratio = (focusSeq - firstSeq) / (lastSeq - firstSeq);
          const estimate = Math.max(0, Math.min(maxScroll, ratio * maxScroll));
          add(estimate);
          add(estimate - step * 2);
          add(estimate + step * 2);
          add(estimate - step * 6);
          add(estimate + step * 6);
          add(estimate - step * 12);
          add(estimate + step * 12);
        }
      }
      if (reverse) {
        for (let value = currentTop + step; value < 0 && positions.length < maxSteps; value += step) add(value);
        add(0);
        for (let value = Math.min(currentTop, 0) - step; Math.abs(value) < maxScroll && positions.length < maxSteps; value -= step) add(value);
        if (maxScroll > 0) add(-maxScroll);
      } else {
        for (let value = currentTop - step; value > 0 && positions.length < maxSteps; value -= step) add(value);
        add(0);
        for (let value = Math.max(currentTop, 0) + step; value < maxScroll && positions.length < maxSteps; value += step) add(value);
        if (maxScroll > 0) add(maxScroll);
      }
      return positions.slice(0, maxSteps);
    };
    const targetAlreadyFocusedOnSeq = () => {
      if (${JSON.stringify(side)} !== "target" || !focusSeq) return false;
      const parent = refreshScrollParent();
      const firstSeq = Number(parent?.getAttribute?.("data-history-first-seq") || 0);
      const lastSeq = Number(parent?.getAttribute?.("data-history-last-seq") || 0);
      const loading = parent?.getAttribute?.("data-history-loading-before") === "true";
      return !loading && firstSeq > 0 && lastSeq > 0 && focusSeq >= firstSeq && focusSeq <= lastSeq;
    };
    let expandedFocusDisclosure = { attempted: false, reason: "not run" };
    const expandedFocusDisclosureAttempts = [];
    const ensureFocusedProcessedSummaryExpanded = async () => {
      const result = await expandFocusedProcessedSummary();
      expandedFocusDisclosure = result;
      expandedFocusDisclosureAttempts.push(result);
      if (result?.expanded || result?.clicked) await settle();
      return result;
    };
    await ensureFocusedProcessedSummaryExpanded();
    let match = matchingTurn();
    const positions = searchPositions();
    for (let i = 0; !match && i < positions.length; i += 1) {
      if (overBudget()) break;
      await setTop(positions[i]);
      await ensureFocusedProcessedSummaryExpanded();
      match = matchingTurn();
    }
    if (!match && ${JSON.stringify(side)} === "target" && !targetAlreadyFocusedOnSeq()) {
      for (let historyAttempt = 0; !match && historyAttempt < 8; historyAttempt += 1) {
        if (overBudget()) break;
        await setTop(0);
        await waitForStableHistory();
        await ensureFocusedProcessedSummaryExpanded();
        match = matchingTurn();
        const refreshedPositions = searchPositions();
        for (let i = 0; !match && i < refreshedPositions.length; i += 1) {
          if (overBudget()) break;
          await setTop(refreshedPositions[i]);
          await ensureFocusedProcessedSummaryExpanded();
          match = matchingTurn();
        }
      }
    }
    if (!match) {
      const renderedSamples = turnNodes().slice(0, 8).map((turn) => ({
        key: turn.getAttribute("data-codex-virtual-turn") || turn.getAttribute("data-turn-key") || turn.getAttribute("data-content-search-unit-key") || "",
        text: rawTextOf(turn, 500),
      }));
      return {
        found: false,
        reason: overBudget() ? "anchor search exceeded evaluate budget" : "anchor not found in rendered scroll pass",
        anchor,
        side: ${JSON.stringify(side)},
        index: ${JSON.stringify(index)},
        scroll: scrollMetrics(),
        renderedTurnCount: turnNodes().length,
        expandedFocusDisclosure,
        expandedFocusDisclosureAttempts,
        visibleTextSample: rawTextOf(root.body || root.host || document.body, 1000),
        renderedSamples,
      };
    }
    const centerMatch = async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const fresh = matchingTurn(true) || matchingTurn() || match;
        if (fresh) match = fresh;
        const target = anchorTargetIn(match) || match;
        if (attempt === 0) {
          target.scrollIntoView?.({ block: "center", inline: "nearest" });
          await settle();
          const visibleFresh = matchingTurn(true);
          if (visibleFresh && anchorTargetVisible(visibleFresh)) {
            match = visibleFresh;
          }
        }
        const rect = anchorTargetRectIn(match) || rectPayload(target);
        const view = viewport();
        const targetTop = Number.isFinite(desiredAnchorTop)
          ? desiredAnchorTop
          : view.top + ((view.bottom - view.top) / 2) - (rect.height / 2);
        const delta = rect.top - targetTop;
        if (Math.abs(delta) <= 4 && anchorTargetVisible(match)) return;
        const parent = refreshScrollParent();
        parent.scrollTop = (parent.scrollTop || 0) + delta;
        parent.dispatchEvent(new Event("scroll", { bubbles: true }));
        await settle();
      }
    };
    const recoverCenteredMatch = async () => {
      if (anchorTargetVisible(match)) return;
      const parent = refreshScrollParent();
      const base = parent.scrollTop || 0;
      const step = Math.max(160, Math.floor(parent.clientHeight * 0.35));
      const candidates = [base, base - step, base + step, base - (step * 2), base + (step * 2)];
      for (const candidate of candidates) {
        await setTop(candidate);
        await ensureFocusedProcessedSummaryExpanded();
        const fresh = matchingTurn(true) || matchingTurn();
        if (!fresh) continue;
        match = fresh;
        if (anchorTargetVisible(match)) return;
        await centerMatch();
        if (anchorTargetVisible(match)) return;
      }
    };
    const recoverBySearchPositions = async () => {
      if (anchorTargetVisible(match)) return;
      const candidates = searchPositions();
      for (const candidate of candidates) {
        if (overBudget()) return;
        await setTop(candidate);
        await ensureFocusedProcessedSummaryExpanded();
        const fresh = matchingTurn(true) || matchingTurn();
        if (!fresh) continue;
        match = fresh;
        if (anchorTargetVisible(match)) return;
        await centerMatch();
        if (anchorTargetVisible(match)) return;
      }
    };
    const targetFocusMode = ${JSON.stringify(side)} === "target" && Boolean(focusSeq);
    const visibleFocusedMatch = targetFocusMode ? matchingTurn(true) : null;
    if (visibleFocusedMatch && anchorTargetVisible(visibleFocusedMatch)) {
      match = visibleFocusedMatch;
      await centerMatch();
    } else {
      await centerMatch();
      await recoverCenteredMatch();
      if (!anchorTargetVisible(match) || !targetFocusMode || !targetAlreadyFocusedOnSeq()) {
        await recoverBySearchPositions();
      }
    }
    await ensureFocusedProcessedSummaryExpanded();
    const refreshedMatch = matchingTurn(true) || matchingTurn();
    if (refreshedMatch) {
      match = refreshedMatch;
      await centerMatch();
      if (!anchorTargetVisible(match)) await recoverBySearchPositions();
      const postCenterMatch = matchingTurn(true) || matchingTurn();
      if (postCenterMatch) match = postCenterMatch;
    }
    if (!matchStillUsable(match)) {
      const renderedSamples = turnNodes().slice(0, 8).map((turn) => ({
        key: turn.getAttribute("data-codex-virtual-turn") || turn.getAttribute("data-turn-key") || turn.getAttribute("data-content-search-unit-key") || "",
        text: rawTextOf(turn, 500),
      }));
      return {
        found: false,
        reason: "matched anchor was lost after centering",
        anchor,
        side: ${JSON.stringify(side)},
        index: ${JSON.stringify(index)},
        matchedText: rawTextOf(match, 1200),
        matchedRect: match?.isConnected ? rectPayload(match) : { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, area: 0 },
        anchorTarget: anchorTargetDebug(match),
        scroll: scrollMetrics(),
        renderedTurnCount: turnNodes().length,
        expandedFocusDisclosure,
        expandedFocusDisclosureAttempts,
        renderedSamples,
      };
    }
    const finalAnchorTarget = anchorTargetIn(match) || match;
    const matchedRectBeforeSampling = anchorTargetRectIn(match) || rectPayload(finalAnchorTarget);
    if (!anchorTargetVisible(match)) {
      const renderedSamples = turnNodes().slice(0, 8).map((turn) => ({
        key: turn.getAttribute("data-codex-virtual-turn") || turn.getAttribute("data-turn-key") || turn.getAttribute("data-content-search-unit-key") || "",
        text: rawTextOf(turn, 500),
      }));
      return {
        found: false,
        reason: "matched anchor was not visible after centering",
        anchor,
        side: ${JSON.stringify(side)},
        index: ${JSON.stringify(index)},
        matchedText: rawTextOf(match, 1200),
        matchedRect: matchedRectBeforeSampling,
        anchorTarget: anchorTargetDebug(match),
        scroll: scrollMetrics(),
        renderedTurnCount: turnNodes().length,
        expandedFocusDisclosure,
        expandedFocusDisclosureAttempts,
        renderedSamples,
      };
    }
    const viewportTurns = turnNodes().filter(inViewport);
    const viewTurns = [match, ...viewportTurns]
      .filter((element, itemIndex, items) => element && items.indexOf(element) === itemIndex)
      .slice(0, 24);
    const countIn = (element, selector) => Array.from(element.querySelectorAll(selector)).filter(visible).length;
    const processedSummaryPattern = /(?:\\u5df2\\u5904\\u7406|Processed)\\s+\\d/i;
    const summaryCountIn = (element) => Math.max(countIn(element, selectors.summaryButton), processedSummaryPattern.test(textOf(element, 1200)) ? 1 : 0);
    const matchedCounts = {
      turns: 1,
      summaries: summaryCountIn(match),
      activityHeaders: countIn(match, selectors.activityHeader),
      toolGroupItems: countIn(match, selectors.toolGroupItem),
      userBubbles: countIn(match, selectors.userBubble),
      assistantMarkdown: countIn(match, selectors.assistantMarkdown),
      fileReferences: countIn(match, selectors.fileReference),
      shimmers: countIn(match, selectors.shimmer),
    };
    if (!viewTurns.length) {
      return {
        found: false,
        reason: "no visible turns after centering matched anchor",
        anchor,
        side: ${JSON.stringify(side)},
        index: ${JSON.stringify(index)},
        matchedText: rawTextOf(match, 1200),
        scroll: scrollMetrics(),
        renderedTurnCount: turnNodes().length,
      };
    }
    const scopedCount = (selector) => {
      const nodes = new Set();
      for (const turn of viewTurns) {
        for (const node of Array.from(turn.querySelectorAll(selector)).filter(visible)) nodes.add(node);
      }
      return nodes.size;
    };
    const commandPattern = /\\b(?:exec_command\\s*(?:x|×)\\s*\\d+|write_stdin|Chunk ID)\\b/i;
    const styleSample = (element) => {
      if (!element) return {};
      const style = getComputedStyle(element);
      return {
        display: style.display,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        color: style.color,
        backgroundColor: style.backgroundColor,
        gap: style.gap,
        padding: style.padding,
        margin: style.margin,
        borderRadius: style.borderRadius,
        boxShadow: style.boxShadow,
        opacity: style.opacity,
        overflow: style.overflow,
        pointerEvents: style.pointerEvents,
        cursor: style.cursor,
      };
    };
    const cssEscape = (value) => {
      if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
      return String(value || "").replace(/["\\\\]/g, "\\\\$&");
    };
    const uniqueElements = (items) => {
      const seen = new Set();
      const result = [];
      for (const item of items) {
        if (!item || seen.has(item)) continue;
        seen.add(item);
        result.push(item);
      }
      return result;
    };
    const countVisible = (element, selector) => Array.from(element?.querySelectorAll?.(selector) || []).filter(visible).length;
    const structureSample = (element) => ({
      fileReferences: countVisible(element, selectors.fileReference || "[data-file-reference]"),
      threadDiffBlocks: countVisible(element, ".thread-diff-virtualized"),
      diffBlocks: countVisible(element, "[class*='diff'], [class*='Diff'], [class*='turn-diff']"),
      diffLineBlocks: countVisible(element, "[class*='diff-line'], [class*='diffLine'], [class*='cm-line']"),
      preBlocks: countVisible(element, "pre"),
      codeBlocks: countVisible(element, "pre, code"),
      buttons: countVisible(element, "button"),
      htmlSample: String(element?.outerHTML || "").slice(0, 4000),
    });
    const candidateBodyNodes = (control, turn) => {
      const nodes = [];
      const controlled = control.getAttribute("aria-controls");
      if (controlled) nodes.push(root.querySelector("#" + cssEscape(controlled)));
      let node = control;
      for (let depth = 0; node && depth < 6; depth += 1) {
        nodes.push(node.nextElementSibling);
        nodes.push(node.parentElement?.nextElementSibling || null);
        nodes.push(node.parentElement?.parentElement?.nextElementSibling || null);
        node = node.parentElement;
      }
      for (const candidate of Array.from(turn.querySelectorAll("[aria-hidden='false'], [style*='height: auto'], pre, ._markdownContent_lzkx4_60"))) {
        nodes.push(candidate);
      }
      return uniqueElements(nodes).filter((node) => node && node !== control && !node.contains(control) && turn.contains(node));
    };
    const bodySnapshot = (control, turn, label) => {
      const normalizedLabel = normalizeText(label);
      for (const node of candidateBodyNodes(control, turn)) {
        if (!visible(node)) continue;
        const text = textOf(node, 5000);
        if (!text || text === normalizedLabel) continue;
        const rect = node.getBoundingClientRect();
        return {
          visible: true,
          text,
          className: String(node.className || ""),
          rect: { top: Math.round(rect.top), bottom: Math.round(rect.bottom), left: Math.round(rect.left), right: Math.round(rect.right), height: Math.round(rect.height), width: Math.round(rect.width) },
          style: styleSample(node),
          structure: structureSample(node),
        };
      }
      return { visible: false, text: "", className: "", rect: { top: 0, bottom: 0, left: 0, right: 0, height: 0, width: 0 }, style: {}, structure: {} };
    };
    const dispatchMouseSequence = (control) => {
      const rect = control.getBoundingClientRect();
      const clientX = rect.left + Math.max(1, rect.width / 2);
      const clientY = rect.top + Math.max(1, rect.height / 2);
      const base = { bubbles: true, cancelable: true, composed: true, view: window, clientX, clientY, button: 0, buttons: 1 };
      control.dispatchEvent(new MouseEvent("mouseover", base));
      control.dispatchEvent(new MouseEvent("mousemove", base));
      if (typeof PointerEvent === "function") {
        control.dispatchEvent(new PointerEvent("pointerdown", { ...base, pointerId: 1, pointerType: "mouse", isPrimary: true }));
      }
      control.dispatchEvent(new MouseEvent("mousedown", base));
      if (typeof PointerEvent === "function") {
        control.dispatchEvent(new PointerEvent("pointerup", { ...base, buttons: 0, pointerId: 1, pointerType: "mouse", isPrimary: true }));
      }
      control.dispatchEvent(new MouseEvent("mouseup", { ...base, buttons: 0 }));
      control.dispatchEvent(new MouseEvent("click", { ...base, buttons: 0 }));
    };
    const safeMatches = (element, selector) => {
      try {
        return Boolean(element?.matches?.(selector));
      } catch {
        return false;
      }
    };
    const disclosureControlsForTurn = (turn) => {
      const controls = Array.from(turn.querySelectorAll("button[aria-expanded], [role='button'][aria-expanded], [data-disclosure-toggle]")).filter(visible);
      return controls.filter((control) => {
        const label = normalizeText(control.innerText || control.textContent || control.getAttribute("aria-label") || "");
        const className = String(control.className || "");
        return processedSummaryPattern.test(label)
          || control.hasAttribute("data-disclosure-toggle")
          || safeMatches(control, selectors.summaryButton)
          || className.includes("group/activity-header");
      });
    };
    const probeDisclosure = async (control, turn, turnIndex, order) => {
      const label = normalizeText(control.innerText || control.textContent || control.getAttribute("aria-label") || "");
      const rect = control.getBoundingClientRect();
      const beforeExpanded = String(control.getAttribute("aria-expanded") || "");
      const beforeTurnText = textOf(turn, 8000);
      const beforeBody = bodySnapshot(control, turn, label);
      if (syntheticDisclosureProbe && beforeExpanded !== "true") {
        dispatchMouseSequence(control);
        await sleep(180);
      }
      const afterExpanded = String(control.getAttribute("aria-expanded") || "");
      const afterBody = bodySnapshot(control, turn, label);
      const afterTurnText = textOf(turn, 8000);
      const bodyText = afterBody.text || beforeBody.text || "";
      const opened = beforeExpanded === "true" || afterExpanded === "true" || Boolean(afterBody.visible && bodyText);
      return {
        kind: "control",
        order,
        turnIndex,
        turnKey: turnKeyOf(turn),
        key: control.getAttribute("data-disclosure-toggle") || "",
        label,
        isProcessed: processedSummaryPattern.test(label),
        interactive: true,
        interaction: syntheticDisclosureProbe ? "mouse-event-sequence" : "snapshot-only",
        beforeExpanded,
        afterExpanded,
        opened,
        bodyVisible: Boolean(afterBody.visible || beforeBody.visible),
        bodyText,
        expandedText: afterTurnText.length > beforeTurnText.length ? afterTurnText.slice(beforeTurnText.length).trim() : bodyText,
        beforeTurnText,
        afterTurnText,
        rect: { top: Math.round(rect.top), bottom: Math.round(rect.bottom), height: Math.round(rect.height), width: Math.round(rect.width) },
        className: String(control.className || ""),
        style: styleSample(control),
        body: afterBody.visible ? afterBody : beforeBody,
      };
    };
    const collectDisclosures = async (turnsToProbe = viewTurns) => {
      const result = [];
      for (let turnIndex = 0; turnIndex < turnsToProbe.length && result.length < 40; turnIndex += 1) {
        const turn = turnsToProbe[turnIndex];
        const controls = disclosureControlsForTurn(turn).slice(0, 8);
        const controlSet = new Set(controls);
        const processedControls = controls.filter((control) => processedSummaryPattern.test(normalizeText(control.innerText || control.textContent || control.getAttribute("aria-label") || "")));
        for (let order = 0; order < controls.length && result.length < 40; order += 1) {
          result.push(await probeDisclosure(controls[order], turn, turnIndex, order));
        }
        const activityHeaders = Array.from(turn.querySelectorAll(selectors.activityHeader || ".group\\/activity-header, [class*='group/activity-header']")).filter(visible);
        for (let order = 0; order < activityHeaders.length && result.length < 40; order += 1) {
          const header = activityHeaders[order];
          if (controlSet.has(header) || header.closest?.("button[aria-expanded], [role='button'][aria-expanded], [data-disclosure-toggle]")) continue;
          const label = normalizeText(header.innerText || header.textContent || header.getAttribute("aria-label") || "");
          if (!label || processedSummaryPattern.test(label)) continue;
          let container = header.closest?.("[data-codex-tool-group-item], .thread-diff-virtualized") || header.parentElement || turn;
          for (let depth = 0; container && container !== turn && depth < 4 && normalizeText(container.innerText || container.textContent || "") === label; depth += 1) {
            container = container.parentElement;
          }
          if (!container || !turn.contains(container)) container = turn;
          const rect = header.getBoundingClientRect();
          const bodyText = textOf(container, 5000);
          result.push({
            kind: "activity-header",
            order: controls.length + order,
            turnIndex,
            turnKey: turnKeyOf(turn),
            key: "",
            label,
            isProcessed: false,
            interactive: false,
            interaction: "static-activity-header",
            beforeExpanded: "",
            afterExpanded: "",
            opened: true,
            bodyVisible: visible(container),
            bodyText,
            expandedText: bodyText,
            beforeTurnText: textOf(turn, 4000),
            afterTurnText: textOf(turn, 4000),
            rect: { top: Math.round(rect.top), bottom: Math.round(rect.bottom), height: Math.round(rect.height), width: Math.round(rect.width) },
            className: String(header.className || ""),
            style: styleSample(header),
            body: {
              visible: visible(container),
              text: bodyText,
              className: String(container.className || ""),
              rect: (() => {
                const bodyRect = container.getBoundingClientRect();
                return { top: Math.round(bodyRect.top), bottom: Math.round(bodyRect.bottom), left: Math.round(bodyRect.left), right: Math.round(bodyRect.right), height: Math.round(bodyRect.height), width: Math.round(bodyRect.width) };
              })(),
              style: styleSample(container),
              structure: structureSample(container),
            },
          });
        }
        const turnText = textOf(turn, 1200);
        if (processedSummaryPattern.test(turnText) && !processedControls.length && result.length < 40) {
          const match = turnText.match(/(?:\\u5df2\\u5904\\u7406|Processed)\\s+[^\\n]{0,40}/i);
          result.push({
            kind: "static-processed",
            order: result.length,
            turnIndex,
            turnKey: turnKeyOf(turn),
            label: normalizeText(match?.[0] || "Processed"),
            isProcessed: true,
            interactive: false,
            interaction: "none",
            beforeExpanded: "",
            afterExpanded: "",
            opened: false,
            bodyVisible: false,
            bodyText: "",
            expandedText: "",
            beforeTurnText: textOf(turn, 4000),
            afterTurnText: textOf(turn, 4000),
            rect: (() => {
              const rect = turn.getBoundingClientRect();
              return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), height: Math.round(rect.height), width: Math.round(rect.width) };
            })(),
            className: String(turn.className || ""),
            style: styleSample(turn),
            body: null,
          });
        }
      }
      return result;
    };
    const turnKeyOf = (element) => element?.getAttribute("data-codex-virtual-turn") || element?.getAttribute("data-turn-key") || element?.getAttribute("data-content-search-unit-key") || "";
    const turns = viewTurns.map((element) => {
      const rect = visualRect(element);
      return {
        key: turnKeyOf(element),
        rect: { left: Math.round(rect.left), top: Math.round(rect.top), right: Math.round(rect.right), bottom: Math.round(rect.bottom), width: Math.round(rect.width), height: Math.round(rect.height) },
        className: String(element.className || ""),
        text: rawTextOf(element, 2400),
        html: element.outerHTML.slice(0, 20000),
      };
    });
    const counts = {
      turns: turns.length,
      summaries: Math.max(scopedCount(selectors.summaryButton), viewTurns.filter((turn) => processedSummaryPattern.test(textOf(turn, 1200))).length),
      activityHeaders: scopedCount(selectors.activityHeader),
      toolGroupItems: scopedCount(selectors.toolGroupItem),
      userBubbles: scopedCount(selectors.userBubble),
      assistantMarkdown: scopedCount(selectors.assistantMarkdown),
      fileReferences: scopedCount(selectors.fileReference),
      shimmers: scopedCount(selectors.shimmer),
    };
    const hasCommandEnhancementText = turns.some((turn) => commandPattern.test(turn.text || ""));
    const disclosures = await collectDisclosures(viewTurns);
    const matchedDisclosures = await collectDisclosures([match]);
    const snippetAroundAnchor = (element) => {
      const raw = rawTextOf(element, 60000);
      const index = normalizedAnchor ? raw.indexOf(normalizedAnchor) : -1;
      if (index < 0) return raw.slice(0, 1800);
      const start = Math.max(0, index - 800);
      const end = Math.min(raw.length, index + normalizedAnchor.length + 800);
      return raw.slice(start, end);
    };
    const matchedTarget = anchorTargetIn(match) || match;
    const matchedRect = anchorTargetRectIn(match) || rectPayload(matchedTarget);
    return {
      found: true,
      anchor,
      side: ${JSON.stringify(side)},
      index: ${JSON.stringify(index)},
      matchedTurnKey: turnKeyOf(match),
      matchedText: rawTextOf(match, 1200),
      matchedAnchorSnippet: snippetAroundAnchor(match),
      matchedRect,
      matchedAnchorTarget: anchorTargetDebug(match),
      scroll: scrollMetrics(),
      expandedFocusDisclosure,
      expandedFocusDisclosureAttempts,
      matchedCounts,
      counts,
      hasCommandEnhancementText,
      disclosures,
      matchedDisclosures,
      turns,
    };
  })()`;
}

async function captureScreenshot(page, fileName) {
  if (!CAPTURE_SCREENSHOT) return "";
  const file = path.join(outDir, fileName);
  const result = await page.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false, fromSurface: true }).catch(() => null);
  if (!result?.data) return "";
  fs.writeFileSync(file, Buffer.from(result.data, "base64"));
  return path.relative(repoRoot, file).replace(/\\/g, "/");
}

async function collectSetupEvidence(sourcePage, targetPage, sourceContext, targetContext) {
  const [sourceTop, targetTop, sourceFrame, targetFrame, sourceScreenshot, targetScreenshot] = await Promise.all([
    evalPage(sourcePage, setupTopExpression("source")).catch((error) => ({ error: error.message })),
    evalPage(targetPage, setupTopExpression("target")).catch((error) => ({ error: error.message })),
    sourceContext?.contextId
      ? evalInContext(sourcePage, sourceContext.contextId, setupFrameExpression(SOURCE_SELECTORS)).catch((error) => ({ error: error.message }))
      : Promise.resolve(null),
    targetContext?.contextId
      ? evalInContext(targetPage, targetContext.contextId, setupFrameExpression(TARGET_SELECTORS)).catch((error) => ({ error: error.message }))
      : Promise.resolve(null),
    captureScreenshot(sourcePage, "source-setup.png"),
    captureScreenshot(targetPage, "target-setup.png"),
  ]);
  return {
    source: {
      screenshot: sourceScreenshot,
      context: sourceContext ? contextDetails(sourceContext) : "missing",
      top: sourceTop,
      frame: sourceFrame,
    },
    target: {
      screenshot: targetScreenshot,
      context: targetContext ? contextDetails(targetContext) : "missing",
      top: targetTop,
      frame: targetFrame,
    },
  };
}

function setupTopExpression(side) {
  return `(() => {
    const side = ${JSON.stringify(side)};
    const rectOf = (node) => {
      if (!node?.getBoundingClientRect) return null;
      const rect = node.getBoundingClientRect();
      return {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };
    const styleOf = (node) => {
      if (!node) return null;
      const style = getComputedStyle(node);
      return {
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        position: style.position,
        pointerEvents: style.pointerEvents,
      };
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
      text: String(node.innerText || node.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 240),
    } : null;
    const all = (selector) => Array.from(document.querySelectorAll(selector));
    const visible = (entry) => {
      const rect = entry?.rect;
      const style = entry?.style;
      return Boolean(rect && rect.width > 0 && rect.height > 0 && style?.display !== "none" && style?.visibility !== "hidden" && Number(style?.opacity || 1) !== 0);
    };
    const activityBars = all(".monaco-workbench .part.activitybar, .part.activitybar, [class*='activitybar']")
      .map(infoOf)
      .filter(Boolean);
    const visibleActivityBars = activityBars.filter(visible);
    const auxiliaryBars = all("#workbench\\.parts\\.auxiliarybar, .monaco-workbench .part.auxiliarybar, .part.auxiliarybar, .auxiliarybar.basepanel")
      .map(infoOf)
      .filter(Boolean);
    const visibleAuxiliaryBars = auxiliaryBars.filter(visible);
    const sidebars = all(".monaco-workbench .part.sidebar, .part.sidebar, [class*='sidebar']")
      .map(infoOf)
      .filter(Boolean)
      .slice(0, 20);
    const codexLikeControls = all("[aria-label],[title]")
      .map(infoOf)
      .filter((entry) => /codex|chatgpt|openai/i.test([entry.ariaLabel, entry.title, entry.text].join(" ")))
      .slice(0, 30);
    const panel = document.querySelector("#codexPanel");
    const shadow = panel?.shadowRoot || null;
    const panelRoot = shadow?.querySelector("[data-codex-panel-root]");
    const threadScroll = shadow?.querySelector("[data-thread-scroll]");
    const workspaceRoot = document.querySelector("#codexWorkspaceRoot");
    const target = side === "target" ? {
      nodeId: (() => { try { return localStorage.getItem("codex-web:node-id") || ""; } catch { return ""; } })(),
      sidebarWidth: (() => { try { return localStorage.getItem("codex-web:sidebar-width") || ""; } catch { return ""; } })(),
      hasCodexPanel: Boolean(panel),
      hasShadowRoot: Boolean(shadow),
      panelView: panelRoot?.getAttribute("data-codex-view") || "",
      hasThreadScroll: Boolean(threadScroll),
      turnCount: shadow ? shadow.querySelectorAll("[data-codex-virtual-turn], [data-turn-key], [data-content-search-unit-key]").length : 0,
      composerCount: shadow ? shadow.querySelectorAll("[data-codex-composer], .composer-surface-chrome").length : 0,
      threadScrollRect: rectOf(threadScroll),
      workspaceRoot: infoOf(workspaceRoot),
    } : null;
    return {
      side,
      url: location.href,
      title: document.title,
      readyState: document.readyState,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
        screenWidth: screen.width,
        screenHeight: screen.height,
      },
      bodyClass: document.body.className,
      layout: {
        activityBars,
        visibleActivityBars,
        leftActivityBarPresent: visibleActivityBars.some((entry) => entry.rect.left <= 8 && entry.rect.width >= 30),
        auxiliaryBars,
        visibleAuxiliaryBars,
        rightSidebarClosed: visibleAuxiliaryBars.every((entry) => entry.rect.width <= 5 || entry.rect.left >= window.innerWidth - 5),
        sidebars,
        codexLikeControls,
      },
      target,
    };
  })()`;
}

function setupFrameExpression(selectors) {
  return `(() => {
    const selectors = ${JSON.stringify(selectors)};
    const rectOf = (node) => {
      if (!node?.getBoundingClientRect) return null;
      const rect = node.getBoundingClientRect();
      return {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };
    const textOf = (node, limit = 1000) => String(node?.innerText || node?.textContent || "").replace(/\\s+/g, " ").trim().slice(0, limit);
    const roots = [document, document.querySelector("#codexPanel")?.shadowRoot].filter(Boolean);
    const root = roots.find((candidate) => candidate.querySelector(selectors.conversation)) || document;
    const conversation = root.querySelector(selectors.conversation);
    const turns = Array.from(root.querySelectorAll(selectors.turn));
    const composer = root.querySelector(".composer-surface-chrome, [data-codex-composer]");
    return {
      url: location.href,
      title: document.title,
      readyState: document.readyState,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
      },
      hasConversation: Boolean(conversation),
      rootKind: root === document ? "document" : "shadow",
      hasThreadScroll: Boolean(root.querySelector("[data-thread-scroll], " + selectors.conversation)),
      turnCount: turns.length,
      hasComposer: Boolean(composer),
      hasUserBubble: Boolean(root.querySelector(selectors.userBubble)),
      hasAssistant: Boolean(root.querySelector(selectors.assistantMarkdown)),
      conversationRect: rectOf(conversation),
      composerRect: rectOf(composer),
      textSample: textOf(conversation || document.body, 1200),
    };
  })()`;
}

function viewportAtLeast(viewport, width, height) {
  return Number(viewport?.width || 0) >= width && Number(viewport?.height || 0) >= height;
}

function viewportDetails(viewport) {
  return viewport ? `${viewport.width}x${viewport.height}, dpr=${viewport.devicePixelRatio}` : "missing";
}

function isCodeServerCodexWebview(context, frameSetup) {
  const url = `${frameSetup?.url || ""} ${context?.url || ""} ${context?.probe?.url || ""}`;
  return /code-tx\.zelt\.cn/i.test(url)
    && /extensionId=openai\.chatgpt/i.test(url)
    && /purpose=webviewView/i.test(url)
    && Boolean(frameSetup?.hasConversation)
    && Number(frameSetup?.turnCount || 0) > 0;
}

function flattenFrames(node, out = []) {
  if (!node?.frame) return out;
  out.push(node.frame);
  for (const child of node.childFrames || []) flattenFrames(child, out);
  return out;
}

async function createIsolatedWorld(page, frameId) {
  const result = await page.send("Page.createIsolatedWorld", {
    frameId,
    worldName: `codex-live-anchor-${Date.now()}`,
    grantUniveralAccess: true,
  }).catch(() => null);
  return result?.executionContextId || null;
}

function contextDetails(context) {
  const probe = context.probe || {};
  return `frame=${context.frameId}, score=${context.score}, conversation=${Boolean(probe.hasConversation)}, turn=${Boolean(probe.hasTurn)}, root=${probe.rootKind || ""}, url=${context.url || probe.url || ""}`;
}

function isConversationContext(context) {
  return Boolean(context?.contextId && context.probe?.hasConversation && context.probe?.hasTurn);
}

async function waitForLoad(page) {
  await waitFor(page, `document.readyState === "complete" || document.readyState === "interactive"`, 60000, "page load");
}

async function waitFor(page, expression, timeoutMS, label) {
  const started = Date.now();
  while (Date.now() - started < timeoutMS) {
    const ok = await evalPage(page, `(() => { try { return Boolean(${expression}); } catch { return false; } })()`).catch(() => false);
    if (ok) return;
    await wait(200);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function evalPage(page, expression) {
  return evalInContext(page, undefined, expression);
}

async function evalInContext(page, contextId, expression) {
  const params = {
    expression,
    awaitPromise: true,
    returnByValue: true,
  };
  if (contextId) params.contextId = contextId;
  const result = await page.send("Runtime.evaluate", params);
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Runtime.evaluate failed");
  }
  return result.result.value;
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
    if (message.error) entry.reject(new Error(`${entry.method}: ${message.error.message}`));
    else entry.resolve(message.result || {});
  });
  return {
    send(method, params = {}) {
      const messageId = ++id;
      socket.send(JSON.stringify({ id: messageId, method, params }));
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(messageId);
          reject(new Error(`${method}: timed out after ${CDP_COMMAND_TIMEOUT_MS}ms`));
        }, CDP_COMMAND_TIMEOUT_MS);
        pending.set(messageId, {
          method,
          resolve(value) {
            clearTimeout(timer);
            resolve(value);
          },
          reject(error) {
            clearTimeout(timer);
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

function renderMarkdown(report) {
  const lines = [
    "# Codex Live Anchor Alignment Audit",
    "",
    `Generated: ${report.generatedAt}`,
    `Checks: ${report.summary.checks}`,
    `Failed: ${report.summary.failed}`,
    `Anchors: ${report.summary.anchorCount}`,
    `Candidate anchors: ${report.summary.candidateAnchorCount}`,
    `Rejected anchors: ${report.summary.rejectedAnchorCount}`,
    `Plan failures: ${report.summary.planFailureCount}`,
    "",
    "## Checks",
    "",
    "| Check | Status | Details |",
    "| --- | --- | --- |",
  ];
  for (const check of report.checks) {
    lines.push(`| ${escapeMD(check.name)} | ${check.ok ? "ok" : "fail"} | ${escapeMD(String(check.details || ""))} |`);
  }
  if (report.evidence.anchorPlan) {
    lines.push("", "## Anchor Plan", "");
    lines.push(`- ${escapeMD(anchorPlanSummary(report.evidence.anchorPlan))}`);
    for (const item of report.evidence.anchorPlan.rejected || []) {
      lines.push(`- rejected ${item.index}: ${escapeMD(item.category)}: ${escapeMD(item.anchor)} (${escapeMD(item.reason || "")})`);
    }
    for (const item of report.evidence.anchorPlan.failures || []) {
      lines.push(`- failure ${item.index}: ${escapeMD(item.category)}: ${escapeMD(item.anchor)} (${escapeMD(item.reason || "")})`);
    }
  }
  lines.push("", "## Anchor Windows", "");
  for (const row of report.evidence.anchors) {
    lines.push(`- ${escapeMD(row.anchor)}: source=${row.source?.found ? "found" : "missing"}, target=${row.target?.found ? "found" : "missing"}, context=${escapeMD(row.contextComparison?.details || "not checked")}, targetCommandEnhancement=${Boolean(row.target?.hasCommandEnhancementText)}`);
  }
  return `${lines.join("\n")}\n`;
}

function escapeMD(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}
