# Codex Live Parity Worklist

Created: 2026-07-07 +08:00
Reset: 11
Status: active

This is the only active work file for Codex Web conversation parity.

Reset 11 exists because earlier work produced false positives: scripts and
partial screenshots made the result look acceptable while the live page still
failed the user's final acceptance standard. Under this reset, an item is not
complete until the deployed UI is verified in a real browser against the
official code-server Codex extension at the same visible conversation location.

## Archive Boundary

Moved out of the active path:

- `reference/legacy/20260707-false-positive-reset11/codex-live-parity-worklist.reset10-archived.md`
- `reference/legacy/20260707-false-positive-reset11/live-anchor-alignment-reset10-and-older/`
- `reference/legacy/20260707-false-positive-reset11/live-currentness-reset10-and-older/`

All reports in that archive are clues only. They are not acceptance evidence.
Any report generated before this Reset 11 file was created must be treated as
historical context, even if it says `0 failed`.

## Source Of Truth

- Reference: `https://code-tx.zelt.cn/?folder=/root`
- Target: `https://codex.zelt.cn/`
- Reference viewport: `1920x1080` or larger unless testing a specific responsive issue.
- Target viewport: same as reference for parity checks.
- Reference Codex extension must be opened from the left Activity Bar icon.
- Reference right chat/sidebar must be closed.
- Target must be the deployed page the user can refresh.
- Do not modify the reference code-server instance while collecting evidence.
- Use the long conversation containing `分析一下codex-web`.
- Validate newest-to-oldest because both products open near the latest turn.
- Use same visible text anchors. API/session text matches are not enough.
- When text appears mojibake in terminal output, the browser-visible text is the source of truth.

## Hard Boundaries

Check these before every implementation and before every completion update:

- Do not invent a similar UI.
- Do not close work from memory.
- Do not close work from source inspection alone.
- Do not close work from screenshots alone.
- Do not close work from green scripts alone.
- Do not mark an item complete unless it was verified after the fix on the deployed target.
- Do not keep Codex Web-only command enhancements during first-pass parity.
- Do not show `exec_command xN`, `write_stdin`, `Chunk ID`, shell transcript rows, or custom command rows during first-pass parity.
- Do not add overlays, drag surfaces, invisible masks, or pointer blockers over the conversation.
- Do not treat the long-session problem as a draggable-resizer problem.
- Do not solve long-conversation performance by truncating history, hiding rows, or losing old content.
- Do not accept repeated short anchors such as `./build-all.sh` unless surrounding context proves source and target are at the same conversation location.
- Do not leave bad previous code in place and hide it with compatibility patches. Remove or rewrite wrong code.
- Do not keep reading around an already reported issue without adding it here and testing the real fix.
- If the user reports a live issue while work is running, add it here immediately before or alongside the fix.

## Acceptance Gate

No UI parity item can be marked complete until this file records all of the
following for the relevant behavior:

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
8. Audit whether existing code causing the mismatch is wrong. Remove or rewrite wrong code instead of layering a patch around it.
9. Implement the smallest product change that matches official behavior.
10. Run local checks.
11. Commit and push code changes.
12. Deploy to `https://codex.zelt.cn/`.
13. Verify the deployed target is serving the new asset version.
14. Rerun the same-anchor validation online.
15. Close the task only after screenshots, DOM/style evidence, click evidence, and human-visible review all match.

## Current Accepted Work

No UI parity item is accepted under Reset 11.

The only completed work in this reset is work-file hygiene:

- Reset 10 work file archived.
- Active live anchor/currentness report directories moved to legacy.
- Active live evidence directories recreated empty.
- This Reset 11 worklist recreated as the only active source of truth.

## Open Failures

### R11-F1. Long conversation scroll and click stability

Status: open

Reset 11 evidence:

- Report: `reference/live-anchor-alignment/20260706-234438/summary.json`
- Anchor: `启动一个带远程调试或 noVNC 的浏览器实例`
- Result: target real mouse hit-test passed for this one anchor only: `clicked=6`, `blocked=0`.
- This is not enough to close R11-F1 because the acceptance gate requires at least five newest-to-oldest anchors and human-visible review.

User-visible symptoms:

- Long conversations can become hard or impossible to scroll.
- The page previously behaved like the whole conversation area could be dragged.
- Processed/file disclosures could not reliably be clicked and expanded.
- The latest user correction says this is a scroll/click problem, not a drag-resizer problem.

Required fix:

- Remove or rewrite any overlay, drag surface, spacer, mask, pointer-events layer, or scroll handler that interferes with normal conversation scrolling/clicking.
- Verify with real browser scrolling and real mouse clicks at multiple same-anchor locations.
- Ensure expanded/collapsed controls remain clickable without adding hidden surfaces above content.

Acceptance:

- At least five newest-to-oldest anchors in the long conversation prove normal upward scrolling.
- Every visible disclosure in those anchors can be opened by real mouse click.
- `elementFromPoint` lands on the real disclosure control, not an overlay, editor, footer, spacer, or browser-level selection/drag layer.

### R11-F2. Processed disclosure grouping and duration placement

Status: open

Required parity:

- `已处理 XXs` row placement and duration placement must match the reference.
- Collapsed labels must remain visible.
- Expanded body must match the reference structure and order.
- Finished turns must not keep stale `正在思考`.
- Mid-run guidance/user messages must group exactly as the reference does.
- No custom command summary rows during first-pass parity.

Acceptance:

- Same-anchor before/after screenshots show matching collapsed and expanded processed rows.
- DOM hierarchy and computed styles match the official extension for each checked processed row.

### R11-F3. File and diff activity rows

Status: open

Reset 11 evidence:

- Report: `reference/live-anchor-alignment/20260706-234438/summary.json`
- Anchor: `启动一个带远程调试或 noVNC 的浏览器实例`
- Result: `18` checks, `1` failed.
- Failed check: visible file activity labels parity.
- Source visible file labels after real clicks: `已编辑 2 个文件 | 已创建 2 个文件 | 已编辑 1 个文件 | 已创建 1 个文件 | 已创建 1 个文件 | 收起文件`.
- Target visible file labels after real clicks: `已编辑 2 个文件 | 已创建 2 个文件 | 已编辑 1 个文件 | 已创建 1 个文件 | 再显示 1 个文件 | 已创建 1 个文件`.
- Screenshots:
  - `reference/live-anchor-alignment/20260706-234438/source-anchor-1-before-click.png`
  - `reference/live-anchor-alignment/20260706-234438/source-anchor-1-after-click.png`
  - `reference/live-anchor-alignment/20260706-234438/target-anchor-1-before-click.png`
  - `reference/live-anchor-alignment/20260706-234438/target-anchor-1-after-click.png`

Problem:

- Some target locations still render code/file-change information as normal assistant text.
- Official extension groups those records into structured file/resource rows.
- The right-side diff viewer can be deferred, but visible row style and expandable shell must match first.

Required parity:

- File changes render as official structured file rows, not raw text.
- File name, icon, add/delete counts, spacing, wrapping, and disclosure shell match the reference.
- File resource show-more/collapse behavior matches official rules.
- Remove first-pass command display enhancements before judging parity.

Acceptance:

- Same-anchor before/after screenshots show matching file/resource rows.
- Expanded file groups match the official visible order and show-more/collapse state.
- Real mouse click expands/collapses the same controls in both products.

### R11-F4. Audit script false-positive risk

Status: open

Reset 11 evidence:

- Reports before script correction:
  - `reference/live-anchor-alignment/20260706-234438/summary.json`
  - `reference/live-anchor-alignment/20260706-234813/summary.json`
  - `reference/live-anchor-alignment/20260706-235034/summary.json`
  - `reference/live-anchor-alignment/20260706-235256/summary.json`
- These reports failed on visible file activity labels, but inspection showed the script mixed pre-click and after-click disclosure labels and counted screen-off rows as visible.
- Script correction:
  - `mergeDisclosureEvidence` now merges by stable `data-disclosure-toggle` when available.
  - For official source rows without stable keys, fallback merge no longer uses unstable rect fields.
  - `activityDisclosureSummary` now excludes rows outside the real `VIEWPORT_HEIGHT`.
- Corrected report: `reference/live-anchor-alignment/20260706-235528/summary.json`
- Corrected result: `18` checks, `0` failed for anchor `启动一个带远程调试或 noVNC 的浏览器实例`.
- This does not close UI parity because the corrected check also proves no file rows were actually visible in that viewport: `sourceFileLabels=none; targetFileLabels=none`.

Problem:

- Previous audits passed while source and target were not accepted by the final visual/click standard.
- The audit can still be useful, but it cannot be the sole acceptance mechanism.

Required fix:

- Harden live anchor scripts so every comparison is tied to the same visible source turn and target turn.
- Reject ambiguous anchors unless surrounding context uniquely identifies the location.
- Record click, DOM, computed style, screenshot, and console evidence in a way a human can review.
- Any `0 failed` output must still be followed by human-visible screenshot review before closure.

### R11-F5. Previous wrong-assumption code cleanup audit

Status: open

Files to audit first:

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

### R11-F6. Online currentness after every product change

Status: open

Required evidence after each product change:

- Commit hash pushed to `origin/main`.
- Server `/root/code/codex-web` fast-forwarded to that hash.
- `./build-all.sh` passed on the server.
- `codex-web.service` active.
- Agent container rebuilt and restarted if agent code changed.
- `GET /api/nodes` shows `host-docker-agent` online.
- The deployed target serves the new asset version.

## Anchor Queue

Use these anchors first, then add more while moving upward through the same long conversation:

- `启动一个带远程调试或 noVNC 的浏览器实例`
- `现在首先,你先对浏览器截图,并进行下载`
- `在抓取一次,现在是在会话内的界面`
- `好 那么现在可以关闭掉这个了`
- `也就是开始做我们codex的界面出来`
- `./build-all.sh` with surrounding context proving the same location
- The latest finished assistant turn that shows `已处理`
- The nearest visible official file-change block in the reference
- A turn with an expandable processed body
- A turn that previously showed raw code/file text in the target

Each anchor needs its own Reset 11 evidence note before it can be considered
covered.

## Progress Log

### 2026-07-07 Reset 11 rebuild

Status: complete for work-file cleanup only

Done:

- Archived the Reset 10 active work file.
- Moved old active live-anchor reports out of `reference/live-anchor-alignment/`.
- Moved old active live-currentness reports out of `reference/live-currentness/`.
- Recreated active live report directories empty.
- Rebuilt this file with the user's final acceptance rules and current live issues.

Not done:

- No UI parity item is closed.
- No deployed behavior has been accepted under Reset 11.
- The next product work must begin with same-anchor live browser evidence and update this file before closing anything.

### 2026-07-07 Reset 11 first same-anchor audit

Status: evidence captured, product parity still open

Done:

- Ran the first Reset 11 live anchor audit for `启动一个带远程调试或 noVNC 的浏览器实例`.
- Report written to `reference/live-anchor-alignment/20260706-234438/summary.json`.
- Source and target both found the same visible anchor and comparable context.
- Target real mouse hit-test passed for the visible disclosure controls in this anchor.

Open from this run:

- File activity disclosure visibility still differs from the official extension.
- The official reference reaches `收起文件` after real clicks, while the target still shows `再显示 1 个文件` before a later `已创建 1 个文件`.
- No UI parity item is closed from this run.

### 2026-07-07 Reset 11 audit-script correction for stale file labels

Status: script evidence corrected, UI parity still open

Done:

- Found that the first same-anchor failure was at least partly an audit false positive.
- The script was retaining pre-click `再显示 1 个文件` and after-click `收起文件` as separate rows for the same target disclosure.
- The script was also counting screen-off file rows as `visible file activity labels`.
- Updated `scripts/audit-codex-live-anchor-alignment.cjs` to merge disclosures by stable key and to filter activity rows to the actual viewport.
- Re-ran the same anchor and produced `reference/live-anchor-alignment/20260706-235528/summary.json` with `18` checks and `0` failed.

Not accepted:

- R11-F3 remains open because this anchor does not visibly show file rows after viewport filtering.
- A new anchor that actually exposes file activity rows must be captured and compared before any file/diff row parity item can close.
