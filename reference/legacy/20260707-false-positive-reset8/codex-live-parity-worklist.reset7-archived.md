# Codex Live Parity Worklist

Created: 2026-07-07 +08:00
Reset: 7
Status: active

This is the only active work file for Codex Web conversation parity.

Reset 7 exists because earlier work produced false positives. Any older "passed",
"fixed", or "completed" note is downgraded to historical context unless it is
revalidated under this file's acceptance gate.

## Archived Work

Moved out of the active path:

- `reference/legacy/20260707-false-positive-reset7/codex-live-parity-worklist.reset6-archived.md`

Older archive directories are historical only:

- `reference/legacy/20260707-false-positive-reset6/`
- `reference/legacy/20260707-false-positive-reset5/`
- `reference/legacy/20260707-false-positive-reset4/`
- `reference/legacy/20260707-false-positive-reset3/`
- `reference/legacy/20260707-live-parity-reset2/`
- `reference/legacy/20260707-false-positive-workfiles/`

Archive rules:

- Do not inherit any completed status from archived files.
- Do not use archived green reports as acceptance.
- Use old screenshots, DOM dumps, reports, and notes only as clues.
- If live browser behavior conflicts with a script report, live browser behavior wins.

## Inactive Generated Audit Outputs

Some generated audit files remain in their original paths because existing scripts
and historical indexes reference those locations. They are not active acceptance
evidence under Reset 7.

Known inactive examples:

- `reference/codex-reference/virtual-scroll-audit.json`
- `reference/codex-reference/virtual-scroll-audit.md`
- `reference/codex-reference/completion-audit.json`

Use these only to understand older test coverage. Re-run live same-anchor
validation before relying on any claim they contain.

## Source Of Truth

- Reference: `https://code-tx.zelt.cn/?folder=/root`
- Target: `https://codex.zelt.cn/`
- Viewport: `1920x1080` or larger unless testing a specific responsive issue.
- Reference Codex extension must be opened from the left Activity Bar icon.
- Reference right chat/sidebar must be closed.
- Target must be the deployed page that the user can refresh.
- Do not modify the reference code-server instance while collecting evidence.

## Non-Negotiable Boundaries

- Do not invent similar UI.
- Do not close work from memory, source inspection alone, screenshots alone, or a green script alone.
- Do not keep Codex Web-only command enhancements during first-pass parity.
- Do not show `exec_command xN`, `write_stdin`, `Chunk ID`, shell transcript rows, or command enhancement rows during first-pass parity.
- Do not add overlays, drag surfaces, invisible masks, or pointer blockers over the conversation.
- Do not treat the user's scroll problem as a draggable-resizer problem.
- Do not solve long-conversation problems by truncating history or hiding rows.
- Do not accept a repeated short anchor such as `./build-all.sh` unless surrounding context proves source and target are at the same location.
- If previous product code conflicts with official behavior, remove or rewrite it instead of patching around it.

## Acceptance Gate

No UI parity item can be marked done unless this file records all of the following:

- Same visible text anchor in reference and target.
- Proof both browsers are at the same conversation location.
- Reference and target screenshots before interaction.
- Reference and target screenshots after each relevant expand/collapse click.
- DOM structure, classes, attributes, and hierarchy for matched rows.
- Computed styles for text, spacing, colors, fonts, border radius, overflow, dimensions, icons, and buttons.
- Real Playwright/CDP mouse click evidence.
- `elementFromPoint` evidence proving the click lands on the real control.
- Expanded body text and structure when the reference expands.
- Scroll evidence across the long conversation.
- Browser console and page error evidence.
- Reference extension source or live DOM evidence when grouping rules are unclear.
- Local build/check evidence for changed code.
- Commit, push, deploy, service status, asset currentness, and agent-online evidence after deployed code changes.
- Human-visible review result. If the screenshot still visibly differs, the item stays open.

## Required Workflow Per Anchor

1. Pick a visible anchor from the long conversation, newest to oldest.
2. Capture reference screenshot, DOM, computed styles, panel width, scroll state, and console errors.
3. Locate the same anchor visibly in the target page. API/session text match is not enough.
4. Capture target screenshot, DOM, computed styles, panel width, scroll state, and console errors.
5. Compare grouping, row order, duration placement, collapsed text, expanded body, file rows, icons, wrapping, spacing, and running/finished state.
6. For every expandable row visible in the reference, click reference and target with real mouse input and capture before/after state.
7. If target differs, add or update an item in this worklist before implementing.
8. Implement the smallest product change that matches official behavior.
9. Run local checks.
10. Commit and push code changes.
11. Deploy to `https://codex.zelt.cn/`.
12. Verify the deployed target is serving the new asset version.
13. Rerun the same anchor validation online.
14. Close the task only after screenshots, DOM/style evidence, click evidence, and human-visible review all match.

## Current Confirmed Failures

### F1. File/activity row missing at same anchor

Status: open

Evidence:

- Report: `reference/live-anchor-alignment/20260706-220004/summary.json`
- Reference screenshot: `reference/live-anchor-alignment/20260706-220004/source-anchor-1.png`
- Target screenshot: `reference/live-anchor-alignment/20260706-220004/target-anchor-1.png`
- Anchor: `现在首先,你先对浏览器截图,并进行下载`

Observed mismatch:

- Reference shows structured activity row `已创建 1 个文件`.
- Target matched turn has no equivalent activity row.
- Real disclosure click for that window is not blocked, so this is not a pointer-only issue.
- Raw event evidence shows a later `file_change` with the same official `turn_id` as the earlier user/assistant exchange.
- Target currently splits the later user interjection into a separate virtual turn, so file activity is attached to a different visible group.

Required fix:

- Recheck official grouping rules from live DOM and/or extension source.
- Group events by the official turn boundary before splitting on later user messages.
- Render file activity as the official structured row, not plain text and not a custom command enhancement.

2026-07-07 local implementation notes:

- `frontend/src/pages/codex/grouping.js` now keeps a mid-run user message inside the active official turn only when process/tool activity has already started and no final/terminal event has ended the turn.
- The visible turn key now adopts `data.turn_id` from terminal/file activity events when the user event itself has no turn key.
- `frontend/src/pages/codex/activity-summary.js` now emits ordered processed-body items so assistant text, guided-input marker, and file activity rows can render in source order.
- `frontend/src/pages/codex/renderer.js` now renders guided input as the official `已引导对话` row and places `file_change` activity rows inside the processed disclosure body order.
- Added F1-shaped regression coverage to `scripts/audit-codex-grouping-rules.cjs`.
- Added guidance/file activity ordering coverage to `scripts/audit-codex-activity-summary-rules.cjs`.

Local checks:

- `node --check frontend/src/pages/codex/grouping.js`
- `node --check frontend/src/pages/codex/activity-summary.js`
- `node --check frontend/src/pages/codex/renderer.js`
- `node scripts/audit-codex-grouping-rules.cjs` -> `0 failed`
- `node scripts/audit-codex-activity-summary-rules.cjs` -> ok
- `./build-all.sh` -> passed
- `./test-go.sh` -> passed

Remaining before closure:

- Commit, push, deploy, and rerun the same-anchor online audit for `现在首先,你先对浏览器截图,并进行下载`.
- Confirm the target matched turn exposes `已创建 1 个文件` in the same location and that source/target screenshots remain visibly aligned.

### F2. Whole-conversation scroll/click stability is not proven

Status: open

Known history:

- A previous report showed a disclosure center hit by `.codex-composer-card`.
- A later targeted fix improved one anchor, but that does not prove the whole conversation.

Required proof:

- Same-anchor scroll/click evidence across multiple locations in the long conversation.
- No phantom drag surface.
- No flicker loop.
- No white screen.
- No disclosure blocked by composer, spacer, overlay, or mask.

### F3. Processed row parity is not proven

Status: open

Required parity:

- `已处理` grouping.
- Duration placement.
- Disclosure icon and collapsed label.
- Expanded body structure.
- Running-to-finished transition.
- No stale `正在思考` after completion.
- No command-enhancement text in first-pass parity.

### F4. File/diff activity row parity is not proven

Status: open

Required parity:

- Structured file rows must match the reference extension.
- File names, add/delete counts, spacing, icons, wrapping, and disclosure behavior must match.
- Code or file-change content must not appear as raw assistant text where the reference shows structured activity.
- The right-side diff viewer can be deferred, but the visible row and expanded shell must match first.

### F5. Previous wrong-assumption UI code needs audit

Status: open

Files to audit before closing:

- `frontend/src/pages/codex/renderer.js`
- `frontend/src/pages/codex/grouping.js`
- `frontend/src/pages/codex/activity-summary.js`
- `frontend/src/pages/codex/lifecycle.js`
- Codex page CSS for overlays, scroll containers, footer spacers, masks, drag surfaces, and pointer events.
- Audit scripts for false-positive paths.

Required output:

- File-by-file notes in this worklist.
- Wrong code removed or rewritten.
- Retained code justified by live reference behavior.

## Anchor Queue

Use longer contextual anchors and continue newest-to-oldest through the same long conversation:

- `现在首先,你先对浏览器截图,并进行下载`
- `启动一个带远程调试或 noVNC 的浏览器实例`
- `首先第一个问题,对话框被你做到了右侧内容区`
- `你为什么自作主张给我加了密码的相关样式 我现在完全不需要认证!`
- `分析一下codex-web  现在我还有问题`

Do not use bare `./build-all.sh` by itself. If a visible window includes it, pair it with surrounding text that proves the same source/target location.

## Work Board

### P0. Rebuild audit trust

Status: open

- Verify visible anchor matching, not hidden API text or stale DOM nodes.
- Compare source and target context before running product-specific checks.
- Preserve screenshots, DOM/style, real-click, and hit-test evidence separately.
- Fail on known mismatches such as missing file/activity rows.
- Reject ambiguous repeated anchors or require disambiguating surrounding text.

### P0. Fix official turn grouping

Status: open

- Investigate official `turn_id` grouping in live DOM/source.
- Keep same-turn file activity with the official turn even if a later user message appears inside the same model turn.
- Update target grouping without adding a custom framework or command enhancement.
- Validate against `F1` anchor.

### P0. Match processed/disclosure rows

Status: open

- Compare at least three processed rows from different long-conversation locations.
- Match collapsed and expanded reference states.
- Ensure real mouse clicks work on every compared disclosure.

### P0. Match file/diff rows

Status: open

- Match official structured activity rows.
- Remove raw text/code fallbacks when the official source shows file activity structure.
- Defer only the diff viewer, not the row structure.

### P0. Prove scroll and click stability

Status: open

- Validate long conversation newest-to-oldest without flicker, stuck scroll, white screen, or pointer blockers.
- Record browser evidence for multiple same-context anchors.

### P0. Audit wrong previous code

Status: open

- Review files listed in `F5`.
- Remove code added from incorrect assumptions.
- Keep only behavior validated against the reference extension.

### P1. Whole-conversation sweep

Status: open

- Start at newest visible source content.
- Move upward by same visible anchors.
- Expand every source-expandable row and compare target.
- Add every mismatch to this worklist before implementing.

## Issue Intake Rule

When the user reports a new issue during implementation:

- Add it to `Current Confirmed Failures` or `Work Board` before moving on.
- Finish the current small fix only if stopping would leave the workspace inconsistent.
- Handle the new issue next unless it is blocked by another P0 item.
