# Codex Live Parity Worklist

Created: 2026-07-07 +08:00
Reset: 9
Status: active

This is the only active work file for Codex Web conversation parity.

Reset 9 exists because Reset 8 still allowed false positives: single-anchor
passes, green local scripts, or partial source inspection were recorded in a way
that could be mistaken for final user acceptance. From this reset onward, no UI
parity task is complete until the same live conversation location has been
validated in both browsers and the visible result matches the official
code-server Codex extension.

## Archived Work

Moved out of the active path:

- `reference/legacy/20260707-false-positive-reset9/codex-live-parity-worklist.reset8-archived.md`
- `reference/legacy/20260707-false-positive-reset9/superseded-reports/`

Older archive directories are historical only:

- `reference/legacy/20260707-false-positive-reset8/`
- `reference/legacy/20260707-false-positive-reset7/`
- `reference/legacy/20260707-false-positive-reset6/`
- `reference/legacy/20260707-false-positive-reset5/`
- `reference/legacy/20260707-false-positive-reset4/`
- `reference/legacy/20260707-false-positive-reset3/`
- `reference/legacy/20260707-live-parity-reset2/`
- `reference/legacy/20260707-false-positive-workfiles/`

Historical generated reports under `reference/codex-reference/`,
`reference/live-anchor-alignment/`, `reference/live-currentness/`,
`reference/collapse-alignment/`, and `reference/windows-captures/` are clues
only. They do not close Reset 9 work unless this file explicitly records the
new Reset 9 evidence and the evidence satisfies the gates below.

## Source Of Truth

- Reference: `https://code-tx.zelt.cn/?folder=/root`
- Target: `https://codex.zelt.cn/`
- Required viewport: `1920x1080` or larger unless testing a specific responsive issue.
- Reference Codex extension must be opened from the left Activity Bar icon.
- Reference right chat/sidebar must be closed.
- Target must be the deployed page the user can refresh.
- Do not modify the reference code-server instance while collecting evidence.
- Use the long conversation containing the user text `分析一下codex-web`.
- Validate newest-to-oldest because both products open near the latest turn.
- Use same visible text anchors. Do not rely on API text matches alone.

## Non-Negotiable Boundaries

Check these before and after every task:

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
- Do not accept a repeated short anchor such as `./build-all.sh` unless surrounding context proves source and target are at the same location.
- If product code conflicts with official behavior, remove or rewrite it instead of adding a compatibility patch around it.
- If the user reports a live issue while work is running, add it here immediately before or alongside the fix.

## Acceptance Gate

No parity item can be marked complete until this file records all of the
following for the relevant anchor or behavior:

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

## Current Status

No final UI parity item is accepted under Reset 9.

The earlier product work may contain useful fixes, but it must be revalidated
under Reset 9 before being considered accepted. Known useful-but-not-final
evidence includes:

- Product commit `b9b106e fix: render codex file activity as sibling rows`
- Documentation commit `24b3ebf docs: record reset 8 anchor verification`
- Reset 8 report `reference/live-anchor-alignment/20260706-223916/summary.json`
- Reset 8 report `reference/live-anchor-alignment/20260706-224220/summary.json`
- Reset 9 report `reference/live-anchor-alignment/20260706-225430/summary.json`
  reported `0 failed`, but is now classified as a false positive because the
  script scoped file activity parity to the matched turn while visible viewport
  file controls still differed.

These are clues only. They are not Reset 9 acceptance evidence.

## Open Failures

### F1. Long conversation scroll and click stability is not proven

Status: open

User-visible symptoms:

- Long conversations can become hard or impossible to scroll.
- The page previously behaved like the whole conversation area could be dragged.
- Processed disclosures could not reliably be clicked and expanded.

Required fix:

- Remove or rewrite any overlay, drag surface, spacer, mask, pointer-events layer, or scroll handler that interferes with normal conversation scrolling/clicking.
- Verify with real browser scrolling and real mouse clicks at multiple same-anchor locations.

Reset 9 acceptance:

- At least five newest-to-oldest anchors in the long conversation prove normal upward scrolling.
- Every visible disclosure in those anchors can be opened by real mouse click.
- `elementFromPoint` lands on the real disclosure control, not an overlay.

### F2. Processed/disclosure grouping and duration placement do not yet match official behavior

Status: open

Required parity:

- `已处理` row placement and duration placement must match the reference.
- Collapsed labels must remain visible.
- Expanded body must match the reference structure and order.
- Running-to-finished state must clear stale `正在思考`.
- Mid-run guidance/user messages must group exactly as the reference does.
- No custom command summary rows during first-pass parity.

Reset 9 acceptance:

- Same-anchor before/after screenshots show matching collapsed and expanded processed rows.
- DOM hierarchy and computed styles match the official extension for each checked processed row.

### F3. File and diff activity rows do not yet match official behavior

Status: open

Required parity:

- File changes must render as official structured file rows, not raw assistant text.
- File name, icon, add/delete counts, spacing, wrapping, and disclosure shell must match the reference.
- File resource show-more/collapse behavior must match official rules.
- The right-side diff viewer can be deferred, but the visible row and expandable shell must match first.

Known Reset 8 clue:

- Anchor `启动一个带远程调试或 noVNC...` showed a likely product mismatch.
- Source included `再显示 1 个文件` before click and `收起文件` after click.
- Target showed only separate file rows and lacked the show-more/collapse control.

Reset 9 evidence:

- Report: `reference/live-anchor-alignment/20260706-225828/summary.json`
- Anchor: `启动一个带远程调试或 noVNC 的浏览器实例`
- Result: `18` checks, `3` failed.
- Visible file activity labels mismatch:
  - Source: `已编辑 2 个文件 | 已创建 2 个文件 | 已编辑 1 个文件 | 已创建 1 个文件 | 已创建 1 个文件 | 收起文件`
  - Target: `已编辑 1 个文件 | 已编辑 1 个文件 | 已创建 2 个文件 | 已编辑 1 个文件 | 已创建 1 个文件 | 已创建 1 个文件`
- Source has official show-more/collapse state `收起文件`; target has none.
- Screenshots:
  - `reference/live-anchor-alignment/20260706-225828/source-anchor-1-before-click.png`
  - `reference/live-anchor-alignment/20260706-225828/source-anchor-1-after-click.png`
  - `reference/live-anchor-alignment/20260706-225828/target-anchor-1-before-click.png`
  - `reference/live-anchor-alignment/20260706-225828/target-anchor-1-after-click.png`

Required investigation before code:

- Inspect official extension live DOM and source assets for the resource-card show-more rule.
- Confirm whether the rule is per processed turn, per file group, or per viewport section.
- Implement only the confirmed official behavior.

### F4. First-pass parity must remove Codex Web-only command enhancements

Status: open

Problem:

- Previous UI included command-oriented enhancements such as `exec_command xN`.
- The current target is official extension parity first.

Required fix:

- Remove custom command transcript/count display from first-pass conversation rendering.
- Reintroduce command enhancements only later behind a separate product decision and visual spec.

### F5. Raw code/file text still needs official resource rendering audit

Status: open

Problem:

- Some target locations rendered code or file-change information as normal text.
- Official extension groups these as resource/file blocks in at least some locations.

Required fix:

- Use same-anchor comparison to identify each raw-text mismatch.
- Map each mismatch to the official rendered element type.
- Rewrite target rendering to use the official visible structure.

### F6. Audit scripts can still produce false positives

Status: open

Problem:

- Previous audits could pass while source and target were not truly aligned at the same visible conversation location.
- A Reset 8 multi-anchor run showed a likely audit-scope issue where source rows came from a different visible turn than the matched anchor.

Required fix:

- Harden live anchor scripts so every comparison is tied to the same visible source turn and target turn.
- Reject ambiguous anchors unless surrounding context uniquely identifies the location.
- Record click and style evidence in a way that can be reviewed by a human.

Reset 9 evidence:

- Script changed: `scripts/audit-codex-live-anchor-alignment.cjs`
- Source now gets before/after screenshots and real mouse click probing.
- `REAL_CLICK_ALL_DISCLOSURES=1` now clicks all visible disclosure controls
  instead of silently narrowing to the matched turn.
- Added strict visible file activity label parity so visible `收起文件` /
  `再显示 N 个文件` controls cannot be ignored.
- Re-run report: `reference/live-anchor-alignment/20260706-225828/summary.json`
  now fails instead of giving a false `0 failed`.

### F7. Previous wrong-assumption UI code needs cleanup audit

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

### F8. Deploy/currentness must be proven after every product change

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
- The nearest visible file-change block in the reference
- A turn with an expandable processed body
- A turn that previously showed raw code/file text in the target

Each anchor needs its own Reset 9 evidence note before it can be considered
covered.

## Progress Log

### 2026-07-07 Reset 9 rebuild

Status: complete for work-file cleanup only

Done:

- Archived Reset 8 active work file to `reference/legacy/20260707-false-positive-reset9/`.
- Archived dirty Reset 8 generated report snapshots to `reference/legacy/20260707-false-positive-reset9/superseded-reports/`.
- Restored active generated report files under `reference/codex-reference/` to avoid treating stale reruns as active work.
- Recreated this active work file from zero.
- Downgraded all pre-Reset 9 reports, screenshots, scripts, and single-anchor passes to historical clues.

Not done:

- No UI parity item is closed.
- No deployed behavior has been accepted under Reset 9.
- The next real work must start with same-anchor live browser evidence.

### 2026-07-07 Reset 9 live audit hardening

Status: script fix local, product parity still open

Done:

- Ran the first Reset 9 anchor `启动一个带远程调试或 noVNC 的浏览器实例`.
- Initial report `reference/live-anchor-alignment/20260706-225430/summary.json`
  returned `0 failed`, but manual report review showed it was still a false
  positive: the script ignored visible viewport file controls and only probed
  target clicks.
- Updated `scripts/audit-codex-live-anchor-alignment.cjs` so source and target
  both get real click evidence, before/after screenshots, and strict visible
  file activity label comparison.
- Re-ran the same anchor. New report:
  `reference/live-anchor-alignment/20260706-225828/summary.json`.
- New result: `18` checks, `3` failed.

Open from this run:

- Target splits source `已编辑 2 个文件` into two `已编辑 1 个文件` rows.
- Target lacks source `收起文件` / official file show-more-collapse control.
- Source and target bottom visible disclosure controls can be covered by the
  composer, causing real hit-test failures.

Not accepted:

- No UI parity item is closed.
- Product code has not been fixed yet.
