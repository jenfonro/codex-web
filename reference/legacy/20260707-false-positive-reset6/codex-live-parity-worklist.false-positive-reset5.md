# Codex Live Parity Worklist

Created: 2026-07-07 +08:00
Reset: 5
Status: active

## Why This Reset Exists

Previous work produced false positives. Some reports said the target passed, but the live page still failed the user's real acceptance path:

- Long conversations could not be scrolled and clicked reliably.
- `已处理` rows could not be expanded on the deployed page.
- Some content was rendered as plain text where the official extension renders structured rows.
- The audit accepted script-level matches without proving the same visible browser state.
- Some commits were made under wrong assumptions and must be re-audited instead of trusted.

Reset 5 makes this file the only active work file. Earlier files, green reports, and completed statuses are history only.

## Active File Policy

This is the single active checklist for Codex Web conversation parity.

Archived active files:

- `reference/legacy/20260707-false-positive-reset5/codex-live-parity-worklist.false-positive-pre-reset5.md`
- `reference/legacy/20260707-false-positive-reset4/`
- `reference/legacy/20260707-false-positive-reset3/`
- `reference/legacy/20260707-live-parity-reset2/`
- `reference/legacy/20260707-false-positive-workfiles/`
- `reference/legacy/codex-collapse-alignment-worklist.false-positive-archive-20260707.md`

Rules for archived material:

- Do not use archived checked items, pass labels, or completed statuses as acceptance.
- Do not copy old conclusions into this file unless they are revalidated in the live browser.
- Old screenshots, DOM dumps, and reports may be used only as clues.
- If an old report conflicts with the user's visible page, the visible page wins.

## Source Of Truth

- Source: `https://code-tx.zelt.cn/?folder=/root`
- Target: `https://codex.zelt.cn/`
- Viewport: 1920x1080 or larger.
- Source Codex extension must be opened from the left Activity Bar icon.
- Source right chat/sidebar must be closed.
- Target must be the deployed online build the user can refresh.
- The compared conversation must be the same long conversation.
- Comparison order is newest to oldest, using the same visible text anchors.

The current implementation is not accepted until it passes this live comparison. Local fixtures, API data, and script output are supporting evidence only.

## Non-Negotiable Boundaries

- Do not invent similar UI.
- Do not keep Codex Web-only enhancements during first-pass parity unless the official source shows the same element at the same anchor.
- Do not show `exec_command xN`, `write_stdin`, `Chunk ID`, shell transcript rows, or command enhancement rows during first-pass parity.
- Do not add overlays, drag surfaces, invisible masks, or pointer blockers over the conversation.
- Do not treat the user's scroll issue as a draggable-resizer issue.
- Do not solve long conversation issues by truncating history.
- Do not hide problems with clipping, reduced content, or reduced history.
- Do not mark work complete from memory, screenshots alone, or a green script result alone.
- If the audit creates a false positive, fix the audit before using it again.
- If previous product code conflicts with official behavior, remove or rewrite it. Do not patch around it.

## Acceptance Gate

No UI parity item may be closed unless all evidence below is recorded in this file:

- Same visible text anchor in source and target.
- Proof that both views are at the same conversation location.
- Source and target screenshots before interaction.
- Source and target screenshots after every relevant expand/collapse click.
- DOM structure, class names, attributes, and hierarchy for matched rows.
- Computed styles for text, spacing, colors, fonts, border radius, overflow, dimensions, icons, and buttons.
- Real Playwright/CDP mouse click evidence.
- `elementFromPoint` evidence proving the click lands on the real control.
- Expanded body text and structure when the source expands.
- Scroll evidence across the long conversation.
- Browser console and page error evidence.
- Source extension code or live DOM evidence when grouping rules are unclear.
- Local build/check evidence for changed code.
- Commit, push, deploy, service status, asset version/currentness, and agent online evidence when deployed code changes.
- Human-visible review result. If the screenshot still visibly differs, the item stays open.

## Required Workflow Per Anchor

1. Pick a visible source anchor from the long conversation, newest to oldest.
2. Capture the source screenshot, DOM, computed styles, panel width, scroll state, and console errors.
3. Locate the same anchor visibly in the target page. API/session text match is not enough.
4. Capture the target screenshot, DOM, computed styles, panel width, scroll state, and console errors.
5. Compare grouping, row order, duration placement, collapsed text, expanded body, file rows, icons, text wrapping, spacing, and running/finished state.
6. For every expandable row visible in source, click source and target with real mouse input and capture before/after state.
7. If target differs, add or update a task here before implementing.
8. Implement the smallest product change that matches official behavior.
9. Run local checks.
10. Commit and push when code changes.
11. Deploy to `https://codex.zelt.cn/`.
12. Verify the deployed target is actually serving the new asset version.
13. Rerun the same anchor validation online.
14. Close the item only after screenshots, DOM/style evidence, click evidence, and human-visible review all match.

## Current Known Failures

All items are open until revalidated.

- Long conversation scroll stability is not proven.
- `已处理` rows have been reported as unclickable on the deployed page.
- There may be an overlay, stale drag surface, footer overlap, or pointer blocker over conversation controls.
- The target can still diverge from official grouping for processed rows, file rows, and diff rows.
- Code/file changes may still render as raw markdown/text where the official extension shows structured file activity blocks.
- Duration placement for processed rows may be wrong.
- Completed turns may leave stale running text such as `正在思考`.
- Previous command-enhancement output must stay removed until parity is complete.
- Previous commits may contain code created from wrong assumptions and must be audited.
- Whole-conversation newest-to-oldest parity has not been completed.

## First Anchor Queue

Use these visible anchors first, then continue newest to oldest through the same long conversation:

- `./build-all.sh`
- `你为什么自作主张给我加了密码的相关样式 我现在完全不需要认证!`
- `分析一下codex-web 现在我还有问题`
- `首先第一个问题 对话框被你做到了右侧内容区`
- `现在首先,你先对浏览器截图,并进行下载`
- `启动一个带远程调试或 noVNC 的浏览器实例`

For each anchor, compare collapsed and expanded states for every source-expandable row near that anchor.

## Work Board

### P0. Rebuild Audit Trust

Status: open

Goal:

- The audit must fail when source and target differ in visible browser behavior, even if both pages contain similar text.

Required work:

- Verify the audit uses visible anchors, not hidden API text or stale DOM nodes.
- Preserve structure evidence and real-click evidence separately.
- Compare expanded body structure, not only labels or file counts.
- Detect source file/diff action rows and require equivalent target structure.
- Store readable labels, selectors, bounding boxes, screenshot paths, and hit-test results for every matched row.

Acceptance:

- A known mismatch must fail.
- A passing result must include screenshots, DOM/style evidence, real click evidence, and human-visible review.

### P0. Deployed Asset Currentness

Status: closed 2026-07-07

Goal:

- The user's online page must always load the latest deployed frontend after a build/restart.

Required work:

- Inspect frontend build/version injection and server static asset serving.
- Verify `https://codex.zelt.cn/` references a fresh asset version after deploy.
- Verify target DOM contains the expected current code markers after deploy.
- Check service, reverse proxy, and browser cache behavior if stale assets remain.

Acceptance:

- Report exact loaded JS/CSS URLs.
- Report current git commit deployed on server.
- Prove a current DOM marker exists in the live page.
- Record service status and `/api/nodes` agent online state.

Evidence log:

- `reference/live-currentness/20260706-210354/summary.json` and `target.png`
  - Target loaded `https://codex.zelt.cn/app/codex-web.js?v=20260706204817`.
  - Target loaded `https://codex.zelt.cn/app/codex-web.css?v=20260706204817`.
  - Runtime `window.CODEX_WEB_ASSET_VERSION` was `20260706204817`.
  - HTML cache header was `no-cache`; JS/CSS cache headers were `public, max-age=3600`.
  - Browser DOM mounted `#codexWorkspaceRoot` and `#codexPanel`.
  - Failure still open: console recorded 404 for `/media/code-icon.svg`.
  - DOM scan identified `.window-appicon` computed `background-image` as the source of that 404.
- Local product fix pending deploy:
  - `frontend/src/app/layout.css` now overrides the captured workbench titlebar selector for `.window-appicon:not(.codicon)` so our bundled workspace icon wins over `/media/code-icon.svg`.
  - Follow-up evidence showed CSS override changed computed style but the browser still requested the old image while parsing earlier rules.
  - `frontend/build.sh` now rewrites captured `workbench.css` `url("../../../../media/code-icon.svg")` references to `url("../assets/workbench/workspace-icon.svg")` during bundle generation.
  - Local bundled CSS verification passed: no `code-icon.svg` URL remains in `frontend/dist/app/codex-web.css` or `backend/public/dist/app/codex-web.css`.
  - `node --check scripts/audit-live-currentness.cjs` passed.
  - `./frontend/build.sh` passed.
  - `./build-all.sh` passed.
  - `go test ./internal/server` passed.

Closure:

```text
Task: P0. Deployed Asset Currentness
Status: closed
Source URL: n/a
Target URL: https://codex.zelt.cn/
Viewport: 1920x1080
Source panel width: n/a
Source anchor: n/a
Target anchor: root workspace/list view
Context comparability: This task validates target deployment freshness only; conversation parity remains open.
Before-click state: no interaction required
After-click state: no interaction required
Expanded body comparison: n/a
DOM/class evidence: reference/live-currentness/20260706-211343/summary.json records #codexWorkspaceRoot and #codexPanel mounted, .window-appicon computed background-image = https://codex.zelt.cn/assets/workbench/workspace-icon.svg, and zero media/code-icon references.
Computed-style evidence: reference/live-currentness/20260706-211343/summary.json records .window-appicon computed width 35px, height 100%, and bundled workspace icon background.
Scroll/click evidence: n/a for currentness gate
Console/page-error evidence: reference/live-currentness/20260706-211343/summary.json records consoleEntries = 0, pageErrors = 0, failedHTTPResponses = 0.
Screenshot paths: reference/live-currentness/20260706-211343/target.png
Command/build evidence: node --check scripts/audit-live-currentness.cjs; ./build-all.sh; go test ./internal/server; server ./build-all.sh
Report path: reference/live-currentness/20260706-211343/summary.json
Commit: 94d4e7f
Deployment: server /root/code/codex-web pulled 94d4e7f, ./build-all.sh passed, codex-web.service active
Asset currentness: loaded JS/CSS URLs were https://codex.zelt.cn/app/codex-web.js?v=20260706211331 and https://codex.zelt.cn/app/codex-web.css?v=20260706211331; runtime window.CODEX_WEB_ASSET_VERSION was 20260706211331; versionsMatch = true; /api/nodes reported host-docker-agent online.
Human-visible review: screenshot target.png shows the deployed Codex Web workspace/list view, not an error page or stale login shell.
Result: accepted for deployment currentness only
Remaining risk: future deploys must rerun this audit before same-anchor conversation parity evidence is trusted.
```

### P0. Long Conversation Scroll And Click Stability

Status: open

Goal:

- The long conversation must scroll newest-to-oldest without flicker loops, stuck scroll, white screen, phantom drag behavior, or click blockers.

Required work:

- Reproduce on the deployed target.
- Wheel-scroll through multiple anchor windows.
- Verify `已处理` rows can be clicked open and closed.
- Verify `elementFromPoint` at click coordinates returns the real control or row.
- Confirm no overlay, drag surface, footer overlap, or invisible element captures pointer events.

Acceptance:

- Same-anchor screenshots before and after expansion.
- Real click logs.
- `elementFromPoint` logs.
- Console/page-error logs.
- Human-visible review shows no phantom drag surface and no blocked controls.

### P0. Processed Row Parity

Status: open

Goal:

- Match official `已处理` rows: grouping, row order, label, duration placement, disclosure icon, collapsed state, expanded body, spacing, and running/finished state transitions.

Required work:

- Compare at least three processed rows from different locations in the long conversation.
- Remove or suppress command-enhancement text from processed rows during first-pass parity.
- Ensure completed sessions do not keep stale `正在思考` indicators.

Acceptance:

- Same-anchor collapsed and expanded screenshots.
- DOM/style comparison for row, label, duration, icon, body, and spacing.
- Real click evidence for every compared expandable row.

### P0. File And Diff Activity Row Parity

Status: open

Goal:

- When the source shows file/diff activity blocks, the target must show equivalent structured rows, not plain text/code dumps or swallowed processed-summary text.

Required work:

- Inspect source extension code or live DOM for grouping rules.
- Map target file-change events to the same visible row structure.
- Match labels such as `已编辑的文件`, file rows such as `app.go +5 -103`, spacing, icons, overflow, and disclosure behavior.
- Match the expanded file/diff body shell enough that source action/button/card hierarchy is not missing.
- Defer the right-side diff viewer if needed, but row display and expanded body shell must match first.

Acceptance:

- Same-anchor source/target screenshots where source has file/diff rows.
- DOM/class/style comparison for file rows and expanded body.
- Real click evidence for expanded/collapsed rows.
- No raw code/text blocks where the official source shows structured file activity.

### P0. Remove Or Rewrite Wrong Previous UI Code

Status: open

Goal:

- Audit prior code created under wrong assumptions and remove anything that conflicts with official behavior.

Required work:

- Review `frontend/src/pages/codex/renderer.js`.
- Review `frontend/src/pages/codex/grouping.js`.
- Review `frontend/src/pages/codex/activity-summary.js`.
- Review `frontend/src/pages/codex/lifecycle.js`.
- Review Codex page styles for overlays, scroll containers, footer spacers, masks, and drag surfaces.
- Review audit scripts for false-positive paths.
- Add file-by-file notes to this worklist before closing this item.

Acceptance:

- Notes list wrong code found, action taken, or why it is retained.
- Local checks pass.
- No validated anchor regresses.

### P1. Whole Conversation Newest-To-Oldest Sweep

Status: open

Goal:

- Complete the user's final acceptance path across the long conversation.

Required work:

- Start from the newest visible source messages.
- Work upward by same visible text anchor.
- Expand every source-expandable row and compare target.
- Add every new mismatch to this board immediately.

Acceptance:

- No open P0 parity failures remain.
- Evidence set includes screenshots, DOM/style extracts, click logs, console logs, deploy state, and human-visible review for each accepted anchor window.

## Issue Intake Rule

When the user reports a problem during implementation:

- Add it to `Current Known Failures` or `Work Board` before moving on.
- Fix the current small change if already in progress.
- Then handle the newly reported issue next unless it blocks the current fix.
- Do not leave the issue only in chat history.

## Closure Template

Use this exact block when closing any item:

```text
Task:
Status:
Source URL:
Target URL:
Viewport:
Source panel width:
Source anchor:
Target anchor:
Context comparability:
Before-click state:
After-click state:
Expanded body comparison:
DOM/class evidence:
Computed-style evidence:
Scroll/click evidence:
Console/page-error evidence:
Screenshot paths:
Command/build evidence:
Report path:
Commit:
Deployment:
Asset currentness:
Human-visible review:
Result:
Remaining risk:
```

## Reset Log

### 2026-07-07 Reset 5

Actions:

- Archived Reset 4 active work file to `reference/legacy/20260707-false-positive-reset5/codex-live-parity-worklist.false-positive-pre-reset5.md`.
- Rebuilt this file as the only active checklist.
- Reopened every parity task.
- Removed old progress wording and previous pass language from active status.
- Preserved old reports as clues only.

Result:

- No UI parity task is complete.
- Next work must start by proving deployed asset currentness and real same-anchor browser parity.
