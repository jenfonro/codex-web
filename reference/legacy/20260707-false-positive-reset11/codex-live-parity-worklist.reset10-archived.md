# Codex Live Parity Worklist

Created: 2026-07-07 +08:00
Reset: 10
Status: active

This is the only active work file for Codex Web conversation parity.

Reset 10 exists because prior work still produced false positives: a script could
report green while the deployed UI still failed the user's final acceptance
standard. From this reset onward, source inspection, screenshots, local checks,
or a passing script are only evidence. They are never acceptance by themselves.

## Reset 10 Cleanup

Moved out of the active path:

- `reference/legacy/20260707-false-positive-reset10/codex-live-parity-worklist.reset9-archived.md`
- `reference/legacy/20260707-false-positive-reset10/live-anchor-alignment-reset9/`
- `reference/legacy/20260707-false-positive-reset10/live-currentness-reset9/`

The archived Reset 9 live-anchor reports are clues only:

- `20260706-225430`: reported `0 failed`, now classified as a false positive.
- `20260706-225828`: hardened script found failures after the false positive.
- `20260706-230936`: deployed target still failed file-label parity and real click hit-tests.

All older reset directories under `reference/legacy/` are historical only. Any
report remaining under `reference/live-anchor-alignment/`,
`reference/live-currentness/`, `reference/codex-reference/`,
`reference/collapse-alignment/`, or `reference/windows-captures/` predates this
reset unless this file explicitly records new Reset 10 evidence.

## Source Of Truth

- Reference: `https://code-tx.zelt.cn/?folder=/root`
- Target: `https://codex.zelt.cn/`
- Required viewport: `1920x1080` or larger unless testing a specific responsive issue.
- Reference Codex extension must be opened from the left Activity Bar icon.
- Reference right chat/sidebar must be closed.
- Target must be the deployed page the user can refresh.
- Do not modify the reference code-server instance while collecting evidence.
- Use the long conversation containing `分析一下codex-web`.
- Validate newest-to-oldest because both products open near the latest turn.
- Use same visible text anchors. API/session text matches are not enough.

## Non-Negotiable Boundaries

Check these before every implementation and before every completion update:

- Do not invent a similar UI.
- Do not close work from memory.
- Do not close work from source inspection alone.
- Do not close work from screenshots alone.
- Do not close work from green local scripts alone.
- Do not keep Codex Web-only command enhancements during first-pass parity.
- Do not show `exec_command xN`, `write_stdin`, `Chunk ID`, shell transcript rows, or custom command rows during first-pass parity.
- Do not add overlays, drag surfaces, invisible masks, or pointer blockers over the conversation.
- Do not treat the long-session problem as a draggable-resizer problem.
- Do not solve long-conversation performance by truncating history, hiding rows, or losing old content.
- Do not accept repeated short anchors such as `./build-all.sh` unless surrounding context proves source and target are at the same conversation location.
- Do not leave bad previous code in place and hide it with compatibility patches. Remove or rewrite wrong code.
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

No UI parity item is accepted under Reset 10.

The only completed work in this reset is work-file hygiene:

- Reset 9 work file archived.
- Reset 9 misleading live reports moved to legacy.
- This Reset 10 worklist recreated as the only active source of truth.

## Open Failures

### R10-F1. Long conversation scroll and click stability

Status: open

User-visible symptoms:

- Long conversations can become hard or impossible to scroll.
- The page previously behaved like the whole conversation area could be dragged.
- Processed/file disclosures could not reliably be clicked and expanded.

Required fix:

- Remove or rewrite any overlay, drag surface, spacer, mask, pointer-events layer, or scroll handler that interferes with normal conversation scrolling/clicking.
- Verify with real browser scrolling and real mouse clicks at multiple same-anchor locations.

Acceptance:

- At least five newest-to-oldest anchors in the long conversation prove normal upward scrolling.
- Every visible disclosure in those anchors can be opened by real mouse click.
- `elementFromPoint` lands on the real disclosure control, not an overlay, editor, footer, or spacer.

### R10-F2. Processed/disclosure grouping and duration placement

Status: open

Required parity:

- `已处理 XXs` row placement and duration placement must match the reference.
- Collapsed labels must remain visible.
- Expanded body must match the reference structure and order.
- Running-to-finished state must clear stale `正在思考`.
- Mid-run guidance/user messages must group exactly as the reference does.
- No custom command summary rows during first-pass parity.

Acceptance:

- Same-anchor before/after screenshots show matching collapsed and expanded processed rows.
- DOM hierarchy and computed styles match the official extension for each checked processed row.

### R10-F3. File and diff activity rows

Status: open

Reset 10 evidence:

- Report: `reference/live-anchor-alignment/20260706-231653/summary.json`
- Anchor: `启动一个带远程调试或 noVNC 的浏览器实例`
- Result: `18` checks, `3` failed.
- Source labels after click: `已编辑 2 个文件 | 已创建 2 个文件 | 已编辑 1 个文件 | 已创建 1 个文件 | 已创建 1 个文件 | 收起文件`
- Target labels after click: `已编辑 2 个文件 | 已创建 2 个文件 | 已编辑 1 个文件 | 再显示 2 个文件`
- Source and target real mouse hit-tests still failed for two visible disclosure controls.
- Screenshots:
  - `reference/live-anchor-alignment/20260706-231653/source-anchor-1-before-click.png`
  - `reference/live-anchor-alignment/20260706-231653/source-anchor-1-after-click.png`
  - `reference/live-anchor-alignment/20260706-231653/target-anchor-1-before-click.png`
  - `reference/live-anchor-alignment/20260706-231653/target-anchor-1-after-click.png`

Known Reset 9 failure clue:

- Archived report: `reference/legacy/20260707-false-positive-reset10/live-anchor-alignment-reset9/20260706-230936/summary.json`
- Anchor: `启动一个带远程调试或 noVNC 的浏览器实例`
- Source labels after click: `已编辑 2 个文件 | 已创建 2 个文件 | 已编辑 1 个文件 | 已创建 1 个文件 | 已创建 1 个文件 | 收起文件`
- Target labels after click: `已编辑 2 个文件 | 已创建 2 个文件 | 已编辑 1 个文件 | 再显示 2 个文件`
- Source and target hit-tests still failed for some visible disclosure controls.

Required parity:

- File changes must render as official structured file rows, not raw assistant text.
- File name, icon, add/delete counts, spacing, wrapping, and disclosure shell must match the reference.
- File resource show-more/collapse behavior must match official rules.
- The right-side diff viewer can be deferred, but the visible row and expandable shell must match first.
- Remove first-pass command display enhancements before judging parity.

Acceptance:

- Same-anchor before/after screenshots show matching file/resource rows.
- Expanded file groups match the official visible order and show-more/collapse state.
- Real mouse click expands/collapses the same controls in both products.

### R10-F4. Raw code/file text rendered as normal text

Status: open

Problem:

- Some target locations render code or file-change information as normal message text.
- Official extension groups those records into structured file/resource blocks in at least some locations.

Required fix:

- Use same-anchor comparison to identify each raw-text mismatch.
- Map each mismatch to the official rendered element type.
- Rewrite target rendering to use the official visible structure.

### R10-F5. Audit script false-positive risk

Status: open

Problem:

- Previous audits passed while source and target were not truly accepted by the final visual/click standard.
- The audit can still be useful, but it cannot be the sole acceptance mechanism.

Required fix:

- Harden live anchor scripts so every comparison is tied to the same visible source turn and target turn.
- Reject ambiguous anchors unless surrounding context uniquely identifies the location.
- Record click, DOM, computed style, screenshot, and console evidence in a way a human can review.
- Any `0 failed` output must still be followed by human-visible screenshot review before closure.

### R10-F6. Previous wrong-assumption code cleanup audit

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

### R10-F7. Deploy/currentness after every product change

Status: open

Required evidence after each product change:

- Commit hash pushed to `origin/main`.
- Server `/root/code/codex-web` fast-forwarded to that hash.
- `./build-all.sh` passed on the server.
- `codex-web.service` active.
- Agent container rebuilt and restarted if agent code changed.
- `GET /api/nodes` shows `host-docker-agent` online.
- `scripts/audit-live-currentness.cjs` shows the target serving the new asset version.

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

Each anchor needs its own Reset 10 evidence note before it can be considered
covered.

## Progress Log

### 2026-07-07 Reset 10 rebuild

Status: complete for work-file cleanup only

Done:

- Archived the Reset 9 active work file.
- Moved the Reset 9 live-anchor reports that were involved in false-positive or failed-verification analysis.
- Moved the paired Reset 9 live-currentness report so it is not mistaken for current Reset 10 deployment evidence.
- Recreated this active file as the only Reset 10 worklist.

Not done:

- No UI parity item is closed.
- No deployed behavior has been accepted under Reset 10.
- The next product work must begin with same-anchor live browser evidence and update this file before closing anything.

### 2026-07-07 Reset 10 first live anchor audit

Status: evidence captured, product parity still open

Done:

- Ran Reset 10 live anchor audit for `启动一个带远程调试或 noVNC 的浏览器实例`.
- Report written to `reference/live-anchor-alignment/20260706-231653/summary.json`.
- Source and target both found the same visible anchor and comparable context.
- The report failed on visible file activity labels and real mouse hit-tests.

Open from this run:

- Target remains collapsed at `再显示 2 个文件` where the reference after-click state is expanded and shows `收起文件`.
- Two visible disclosure controls still fail real hit-testing in source and target evidence, so clickability/scroll placement must be audited before any UI item can close.

Not accepted:

- No UI parity item is closed.

### 2026-07-07 Disclosure click safe-area product fix

Status: fourth local checks passed, deployed verification pending

Done:

- Audited the Reset 10 report and confirmed target failures occurred after an earlier file disclosure expanded and pushed lower controls under the composer.
- Updated `frontend/src/pages/codex/renderer.js` so focused-turn restoration and disclosure-anchor restoration schedule an additional safe-area pass after layout settles.
- The fix keeps visible disclosure controls above the composer/footer instead of changing file grouping or show-more rules.
- First deployment still failed: `reference/live-anchor-alignment/20260706-232359/summary.json` again reported target controls at y=926/y=945 under the composer.
- Added an outer disclosure-anchor render safe-area pass so the correction runs even if the internal disclosure-anchor selector restoration does not fire.
- Second deployment still failed: `reference/live-anchor-alignment/20260706-232812/summary.json` showed the same target controls under the composer.
- Root cause found in `keepVisibleDisclosureControlsClickable`: controls below `scrollRect.bottom` were skipped even when still visible in the browser viewport and covered by the composer. The filter now uses the viewport bottom for "too far below" while still using the composer/footer safe bottom for overlap correction.
- Third deployment improved target clickability: `reference/live-anchor-alignment/20260706-233204/summary.json` showed `target disclosure real mouse hit-test` passed with `clicked=5, blocked=0`.
- Remaining product mismatch found after target clicks became reliable: hidden later file-create rows were grouped as `已创建 2 个文件`, while the reference shows two separate `已创建 1 个文件` rows. Product grouping now merges same-action file rows only when their event sequence numbers are consecutive.
- Remaining audit issue found: visible file label parity used stale pre-click disclosure labels, and source official controls without `data-disclosure-toggle` could not be found for real-click probing. The audit now recollects visible disclosures after real clicks and falls back to label/rect matching when a source control has no key.

Local checks:

- `node --check frontend/src/pages/codex/renderer.js`: passed.
- `node --check scripts/audit-codex-live-anchor-alignment.cjs`: passed.
- `node scripts/audit-codex-activity-summary-rules.cjs`: passed.
- `./test-go.sh`: passed via Git Bash.
- `./build-all.sh`: passed via Git Bash.

Not accepted:

- The fourth fix has not been deployed.
- Reset 10 online same-anchor audit has not passed against the changed product.
