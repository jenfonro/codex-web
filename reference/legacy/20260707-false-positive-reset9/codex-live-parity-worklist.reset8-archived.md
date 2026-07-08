# Codex Live Parity Worklist

Created: 2026-07-07 +08:00
Reset: 8
Status: active

This is the only active work file for Codex Web conversation parity.

Reset 8 exists because previous work produced false positives: scripts and local
checks passed while the deployed browser still failed the user's acceptance
standard. From this reset forward, a task is not complete until the live
reference and live target match at the same visible conversation location.

## Archived Work

Moved out of the active path:

- `reference/legacy/20260707-false-positive-reset8/codex-live-parity-worklist.reset7-archived.md`

Older archive directories are historical only:

- `reference/legacy/20260707-false-positive-reset7/`
- `reference/legacy/20260707-false-positive-reset6/`
- `reference/legacy/20260707-false-positive-reset5/`
- `reference/legacy/20260707-false-positive-reset4/`
- `reference/legacy/20260707-false-positive-reset3/`
- `reference/legacy/20260707-live-parity-reset2/`
- `reference/legacy/20260707-false-positive-workfiles/`

Historical generated reports that remain in their original directories are clues,
not acceptance evidence. They must be rerun or replaced with Reset 8 live browser
evidence before being used to close any item.

Known inactive examples:

- `reference/codex-reference/virtual-scroll-audit.json`
- `reference/codex-reference/virtual-scroll-audit.md`
- `reference/codex-reference/grouping-rules-audit.json`
- `reference/codex-reference/grouping-rules-audit.md`
- Any `reference/live-anchor-alignment/*` run created before Reset 8.
- Any `reference/live-currentness/*` run created before Reset 8.

## Source Of Truth

- Reference: `https://code-tx.zelt.cn/?folder=/root`
- Target: `https://codex.zelt.cn/`
- Required viewport: `1920x1080` or larger unless testing a specific responsive issue.
- Reference Codex extension must be opened from the left Activity Bar icon.
- Reference right chat/sidebar must be closed.
- Target must be the deployed page the user can refresh.
- Do not modify the reference code-server instance while collecting evidence.
- Use the long conversation containing the user text `分析一下codex-web`.
- Prefer newest-to-oldest validation because both products open near the latest turn.

## Hard Boundaries

Check these before and after every task:

- Do not invent a similar UI.
- Do not close work from memory, source inspection alone, screenshot alone, or green script output alone.
- Do not keep Codex Web-only command enhancements during first-pass parity.
- Do not show `exec_command xN`, `write_stdin`, `Chunk ID`, shell transcript rows, or custom command rows during first-pass parity.
- Do not add overlays, drag surfaces, invisible masks, or pointer blockers over the conversation.
- Do not treat the user's long-session problem as a draggable-resizer problem.
- Do not solve long-conversation performance by truncating history or hiding rows.
- Do not accept a repeated short anchor such as `./build-all.sh` unless surrounding context proves source and target are at the same location.
- If product code conflicts with official behavior, remove or rewrite it instead of adding a compatibility patch around it.
- If a user reports a live issue while work is running, add it here immediately, then fix it after the current small verification loop.

## Acceptance Gate

No parity item can be marked complete until this file records all of the following:

- Same visible text anchor in reference and target.
- Proof both browsers are at the same conversation location.
- Reference and target screenshots before interaction.
- Reference and target screenshots after each relevant expand/collapse click.
- DOM structure, classes, attributes, and hierarchy for matched rows.
- Computed styles for text, spacing, colors, fonts, border radius, overflow, dimensions, icons, and buttons.
- Real Playwright/CDP mouse click evidence, not synthetic state mutation.
- `elementFromPoint` evidence proving the click lands on the real control.
- Expanded body text and structure when the reference expands.
- Scroll evidence across the long conversation, including upward scroll from the latest turns.
- Browser console and page error evidence.
- Reference extension source or live DOM evidence when grouping rules are unclear.
- Local build/check evidence for changed code.
- Commit, push, deploy, service status, asset currentness, and agent-online evidence after deployed code changes.
- Human-visible review result. If the screenshot still visibly differs, the item stays open.

## Required Workflow Per Anchor

1. Pick a visible text anchor from the long conversation, newest to oldest.
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
13. Rerun the same-anchor validation online.
14. Close the task only after screenshots, DOM/style evidence, click evidence, and human-visible review all match.

## Current Known Failures

### F0. Reset 8 evidence baseline is missing

Status: closed

Problem:

- Reset 7 evidence produced false positives.
- The active baseline must be recreated with live browsers and stored under a Reset 8 report path.

Required fix:

- Create a fresh Reset 8 live-currentness report.
- Create a fresh Reset 8 same-anchor report for the long conversation.
- Record report paths here before closing any UI item.

Acceptance evidence:

- Currentness report: `reference/live-currentness/20260706-223209/summary.json`
- Currentness screenshot: `reference/live-currentness/20260706-223209/target.png`
- Deployed asset versions in that report: JS/CSS/runtime `20260706221906`.
- Console warnings/errors in that report: `0`.
- Same-anchor report: `reference/live-anchor-alignment/20260706-223247/summary.json`
- Same-anchor screenshots:
  - `reference/live-anchor-alignment/20260706-223247/source-anchor-1.png`
  - `reference/live-anchor-alignment/20260706-223247/target-anchor-1.png`
  - `reference/live-anchor-alignment/20260706-223247/target-anchor-1-before-click.png`
  - `reference/live-anchor-alignment/20260706-223247/target-anchor-1-after-click.png`

Result:

- Reset 8 baseline exists.
- The baseline has `2 failed` checks, so no UI parity item is accepted.
- Later post-fix report `reference/live-anchor-alignment/20260706-223916/summary.json`
  is also a Reset 8 same-anchor report and passed for that one anchor.

### F1. Long conversation scroll and click stability is not proven

Status: open

User-visible symptoms:

- Long conversation can become hard or impossible to scroll.
- The page previously behaved like the whole conversation area could be dragged.
- Processed disclosures could not reliably be clicked and expanded.

Required fix:

- Remove or rewrite any overlay, drag surface, spacer, mask, pointer-events layer, or scroll handler that interferes with normal conversation scrolling/clicking.
- Verify with real browser scrolling and real mouse clicks at multiple same-anchor locations.

Acceptance evidence:

- Same-anchor report: `reference/live-anchor-alignment/20260706-223247/summary.json`
- Anchor: `现在首先,你先对浏览器截图,并进行下载`
- Source/target context comparable: `score=0.450`, `matched=36/80`, both contain the anchor.
- Target processed disclosure real mouse hit-test passed for this anchor:
  - `clicked=1`
  - `blocked=0`
  - `controls=1`
  - `elementFromPoint` found the real processed disclosure button.

Result:

- This anchor does not prove the earlier whole-conversation scroll issue is fixed.
- F1 remains open until multiple long-conversation locations prove normal scrolling
  and real disclosure clicks without overlay or drag behavior.

### F2. Processed/disclosure grouping does not yet match official behavior

Status: open

Required parity:

- `已处理` row placement and duration placement must match the reference.
- Collapsed labels must remain visible.
- Expanded body must match the reference structure and order.
- Running-to-finished state must clear stale `正在思考`.
- Mid-run guidance/user messages must group exactly as the reference does.
- No custom command summary rows during first-pass parity.

Acceptance evidence:

- Same-anchor report: `reference/live-anchor-alignment/20260706-223247/summary.json`
- Anchor: `现在首先,你先对浏览器截图,并进行下载`
- Processed disclosure parity for this anchor: passed.
- Target command enhancement rows for this anchor: `0`.
- Post-fix same-anchor report: `reference/live-anchor-alignment/20260706-223916/summary.json`
- Post-fix processed disclosure parity for this anchor: passed.
- Post-fix target disclosure real mouse hit-test:
  - `clicked=2`
  - `blocked=0`
  - controls clicked: `已创建 1 个文件`, `已处理 4m 23s`

Result:

- This is only one anchor.
- The earlier nesting bug is fixed for this anchor.
- F2 remains open.

### F3. File and diff activity rows do not yet match official behavior

Status: open

Required parity:

- File changes must render as official structured file rows, not raw assistant text.
- File name, icon, add/delete counts, spacing, wrapping, and disclosure shell must match the reference.
- The right-side diff viewer can be deferred, but the visible row and expandable shell must match first.
- Added-file history payloads that contain `content` without `unified_diff` must produce correct stats.

Current in-progress code:

- `agent/internal/session/history.go` has an uncommitted fallback for added/deleted file content stats.
- `agent/internal/session/history_test.go` has an uncommitted regression test.
- This is not accepted until deployed agent history is re-parsed and same-anchor UI evidence shows matching file stats.

Acceptance evidence:

- Same-anchor report: `reference/live-anchor-alignment/20260706-223247/summary.json`
- Anchor: `现在首先,你先对浏览器截图,并进行下载`
- Failed checks:
  - `anchor 1 non-processed activity row structure parity`
  - `anchor 1 file/diff activity row parity`
- Reference non-processed activity row count: `1`.
- Target non-processed activity row count: `0`.
- Reference label: `已创建 1 个文件`.
- Target equivalent text is currently rendered inside the processed disclosure body,
  not as a matching independent activity row.
- Reference file stats: `cdp-full-capture.mjs +242 -0`.
- Target deployed stats: `cdp-full-capture.mjs +0 -0`.

Result:

- Post-fix same-anchor report: `reference/live-anchor-alignment/20260706-223916/summary.json`
- Post-fix result for this anchor: `0 failed`.
- Post-fix non-processed activity row parity:
  - source rows: `1`
  - target rows: `1`
  - source structured rows: `1`
  - target structured rows: `1`
  - source label: `已创建 1 个文件`
  - target label: `已创建 1 个文件`
- Post-fix file/diff activity row parity:
  - source file stats: `cdp-full-capture.mjs +242 -0`
  - target file stats: `cdp-full-capture.mjs +242 -0`
- Post-fix real click evidence:
  - target `已创建 1 个文件` disclosure opened by real mouse click
  - `elementFromPoint`/closest control hit the real `data-disclosure-toggle`
    button
- Screenshots:
  - `reference/live-anchor-alignment/20260706-223916/source-anchor-1.png`
  - `reference/live-anchor-alignment/20260706-223916/target-anchor-1-before-click.png`
  - `reference/live-anchor-alignment/20260706-223916/target-anchor-1-after-click.png`

Result:

- The first Reset 8 file-activity anchor is fixed and deployed.
- F3 remains open for whole-conversation parity until more same-anchor locations
  with file/diff activity rows pass.

Additional Reset 8 multi-anchor evidence:

- Report: `reference/live-anchor-alignment/20260706-224220/summary.json`
- Discovery mode: source reverse-scroll anchors, max anchors `5`.
- Summary: `69` checks, `4` failed, `5` anchors.
- Passed file/activity anchors:
  - Anchor 2 `好 那么现在可以关闭掉这个了...` passed with `6` source
    file activity rows and `6` target rows.
  - Anchor 4 `现在首先,你先对浏览器截图...` passed with `1` source
    file activity row and `1` target row.
- Investigate before treating as product bug:
  - Anchor 1 failed with scope `source=viewport/matched-turn`; the source file
    rows came from a different visible turn key `019f23a9...`, while the matched
    source anchor key was `019f23c1...`. This is likely a script scope issue or
    an ambiguous source viewport comparison, not yet a proven product bug.
- Real remaining product-looking mismatch:
  - Anchor 5 `启动一个带远程调试或 noVNC...` failed.
  - Source labels after interaction included `已创建 2 个文件`, `已编辑 1 个文件`,
    `已创建 1 个文件`, `已创建 1 个文件`, and a show-more/collapse control
    observed as `再显示 1 个文件` before click / `收起文件` after click.
  - Target labels included only the four file activity rows:
    `已创建 2 个文件`, `已编辑 1 个文件`, `已创建 1 个文件`,
    `已创建 1 个文件`.
  - Target real mouse hit-test still passed with `clicked=5`, `blocked=0`, so
    this is not a pointer blocker issue.

Required next fix:

- Find the official extension/source rule for file resource show-more/collapse
  controls before implementing.
- Add the official `再显示 N 个文件` / `收起文件` behavior only if source
  evidence confirms it belongs in this target context.
- Do not treat anchor 1 as a product bug until the audit scope mismatch is
  resolved or reproduced with a tighter same-turn anchor.

### F4. First-pass parity must remove Codex Web-only command enhancements

Status: open

Problem:

- Previous UI included command-oriented enhancements such as `exec_command xN`.
- The current acceptance target is official extension parity first.

Required fix:

- Remove custom command transcript/count display from first-pass conversation rendering.
- Reintroduce command enhancements only later behind a separate product decision and visual spec.

Acceptance evidence:

- Pending.

### F5. Previous wrong-assumption UI code needs audit

Status: open

Files to audit:

- `frontend/src/pages/codex/renderer.js`
- `frontend/src/pages/codex/grouping.js`
- `frontend/src/pages/codex/activity-summary.js`
- `frontend/src/pages/codex/lifecycle.js`
- Codex page CSS for overlays, scroll containers, footer spacers, masks, drag surfaces, and pointer events.
- Audit scripts that previously reported false positives.

Required output:

- File-by-file notes in this worklist.
- Wrong code removed or rewritten.
- Retained code justified by live reference behavior.

Acceptance evidence:

- Pending.

## Anchor Queue

Use these anchors first, then add more while moving upward through the same long conversation:

- `现在首先,你先对浏览器截图,并进行下载`
- `./build-all.sh` with surrounding context proving the same location
- The latest finished assistant turn that shows `已处理`
- The nearest visible file-change block in the reference
- A turn with an expandable processed body
- A turn that previously showed raw code/file text in the target

Each anchor needs its own evidence note before it can be considered covered.

## Progress Log

### 2026-07-07 Reset 8 rebuild

Status: complete for work-file cleanup only

Done:

- Archived Reset 7 active work file to `reference/legacy/20260707-false-positive-reset8/`.
- Recreated this active work file from zero.
- Downgraded all pre-Reset 8 reports and green scripts to historical clues.

Not done:

- No UI parity item is closed.
- No deployed behavior has been reaccepted under Reset 8.
- Existing uncommitted product changes still need normal verification before commit/deploy.

### 2026-07-07 Agent file-stat fallback local verification

Status: local product checks passed, not UI accepted

Scope:

- `agent/internal/session/history.go`
- `agent/internal/session/history_test.go`

Reason:

- Official Codex history can report an added file in `patch_apply_end` with
  `content` but without `unified_diff`.
- Without a fallback, the target renders added-file stats as `+0 -0`, while the
  reference can show the real added line count.

Local evidence:

- `go test ./internal/session` from `agent` passed.
- `C:\Program Files\Git\bin\bash.exe ./test-go.sh` passed.
- `C:\Program Files\Git\bin\bash.exe ./build-all.sh` passed and produced
  `build/codex-web.exe` and `build/codex-agent.exe`.

Not accepted:

- F3 remains open.
- The agent container has not been rebuilt from this local change.
- The deployed target has not been reloaded with re-parsed history.
- No Reset 8 same-anchor screenshots, DOM/style evidence, real click evidence,
  or human-visible review exists for the corrected file stats yet.

### 2026-07-07 File activity sibling-row implementation

Status: local product checks passed, not UI accepted

Scope:

- `frontend/src/pages/codex/activity-summary.js`
- `frontend/src/pages/codex/renderer.js`
- `scripts/audit-codex-activity-summary-rules.cjs`

Reason:

- Reset 8 same-anchor report `reference/live-anchor-alignment/20260706-223247/summary.json`
  showed the reference rendering `已创建 1 个文件` as a separate non-processed
  activity disclosure.
- The target rendered the same file activity inside the `已处理` disclosure body,
  so text existed but DOM hierarchy and official interaction structure did not
  match.

Implementation:

- `orderedProcessSummaryItems()` no longer inserts `file_change` into
  processed-body `summaryItems`.
- `renderTurnActivitySummary()` always renders `detailEvents` as sibling
  activity rows after the processed summary.
- The activity-summary rule audit now rejects nested file activity inside
  `summaryItems`.

Local evidence:

- `node --check frontend/src/pages/codex/activity-summary.js` passed.
- `node --check frontend/src/pages/codex/renderer.js` passed.
- `node --check scripts/audit-codex-activity-summary-rules.cjs` passed.
- `node scripts/audit-codex-activity-summary-rules.cjs` passed.
- `node scripts/audit-codex-grouping-rules.cjs` passed with `0 failed`.
- `C:\Program Files\Git\bin\bash.exe ./test-go.sh` passed.
- `C:\Program Files\Git\bin\bash.exe ./build-all.sh` passed.

Not accepted:

- F3 remains open until the fix is committed, pushed, deployed, and the same
  online anchor shows a target non-processed activity row count matching the
  reference.

### 2026-07-07 Deploy and first Reset 8 anchor pass

Status: one same-anchor parity window passed, whole conversation still open

Commit:

- `b9b106e fix: render codex file activity as sibling rows`

Deployment:

- Pushed `b9b106e` to `origin/main`.
- Server `/root/code/codex-web` fast-forwarded to `b9b106e`.
- Server `./build-all.sh` passed and produced Linux `build/codex-web` and
  `build/codex-agent`.
- `codex-web.service` status after deploy: `active`.
- Rebuilt Docker image `codex-web-agent:local`.
- Recreated container `codex-web-agent`; Docker showed it `Up`.
- `GET http://127.0.0.1:58888/api/nodes` showed `host-docker-agent` online.

Currentness evidence:

- Report: `reference/live-currentness/20260706-223834/summary.json`
- Screenshot: `reference/live-currentness/20260706-223834/target.png`
- Deployed JS/CSS/runtime asset version: `20260706223813`
- Console warnings/errors: `0`

Same-anchor evidence:

- Report: `reference/live-anchor-alignment/20260706-223916/summary.json`
- Summary: `16` checks, `0` failed, `1` anchor.
- Anchor: `现在首先,你先对浏览器截图,并进行下载`
- Context comparable: `score=0.450`, `matched=36/80`, both contain anchor.
- Non-processed activity row parity: passed.
- File/diff activity row parity: passed.
- Target command enhancement rows: `0`.
- Real mouse click hit-test: `clicked=2`, `blocked=0`, controls `2`.

Human-visible review:

- Target before-click screenshot visibly shows a separate `已创建 1 个文件`
  row under `已处理`.
- Target after-click screenshot shows the row expanded at the lower edge of the
  panel; DOM and computed-style evidence in the report prove the file body and
  `+242 -0` stats are present.

Not done:

- Whole long-conversation newest-to-oldest audit is still incomplete.
- F1 scroll/click stability still requires multiple locations.
- F2/F3/F4/F5 remain open outside this one passed anchor.
