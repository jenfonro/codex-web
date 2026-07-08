# Codex Live Parity Worklist

Created: 2026-07-07 +08:00
Reset: 12
Status: active

This is the only active work file for Codex Web conversation parity.

Reset 12 exists because previous work produced false positives. Some scripts
reported `0 failed`, and some local screenshots looked close, but the deployed
page still failed the user's real acceptance standard. Under Reset 12, nothing
in the conversation UI is accepted until the deployed target is verified in a
real browser against the official code-server Codex extension at the same
visible conversation location.

## Archive Boundary

Moved out of the active path:

- `reference/legacy/20260707-false-positive-reset11/`
- `reference/legacy/20260707-false-positive-reset12/codex-live-parity-worklist.reset11-archived.md`
- `reference/legacy/20260707-false-positive-reset12/live-anchor-alignment-reset11-archived/`
- `reference/legacy/20260707-false-positive-reset12/live-currentness-reset11-archived/`
- `reference/legacy/20260707-false-positive-reset12/other-active-artifacts-reset11-archived/`

Everything in those paths is historical context only. Do not use archived
reports as acceptance evidence. Any old report that says `0 failed` is still a
clue, not proof.

Known archived false-positive or non-acceptance examples:

- `20260706-235528`: script-corrected `18 checks, 0 failed`, but file rows were
  not visible in the viewport, so file/diff parity was not tested.
- `20260707-000144`: `18 checks, 0 failed`, but source and target did not both
  expose the needed file rows, so this cannot close file parity.
- `20260707-000329`: target API contained the anchor, but the rendered target
  did not visibly locate the same nested content.
- `20260707-000643`: same nested-content problem for `start.sh +5 -5`; the
  target focused the huge turn, not the exact event/content inside the turn.

## Source Of Truth

- Reference: `https://code-tx.zelt.cn/?folder=/root`
- Target: `https://codex.zelt.cn/`
- Viewport: `1920x1080` or larger unless testing a specific responsive issue.
- Reference setup: Codex extension opened from the left Activity Bar icon.
- Reference setup: right chat/sidebar closed.
- Target setup: deployed page the user can refresh, not a local-only build.
- Reference instance must not be modified while collecting evidence.
- Test conversation: the long session containing `分析一下codex-web`.
- Validation direction: newest-to-oldest, because both products open near the
  latest turn.
- Location rule: use the same browser-visible text anchor in both products.
  API/session text matches are not enough.

## Hard Boundaries

Check these before every implementation and before every completion update:

- Do not invent a similar UI.
- Do not close work from memory.
- Do not close work from source inspection alone.
- Do not close work from screenshots alone.
- Do not close work from green scripts alone.
- Do not mark an item complete unless it was verified after the fix on the
  deployed target.
- Do not keep Codex Web-only command enhancements during first-pass parity.
- Do not show `exec_command xN`, `write_stdin`, `Chunk ID`, shell transcript
  rows, or custom command rows during first-pass parity.
- Do not add overlays, drag surfaces, invisible masks, or pointer blockers over
  the conversation.
- Do not treat the long-session issue as a draggable-resizer issue.
- Do not solve long-conversation performance by truncating history, hiding
  rows, or losing old content.
- Do not accept repeated short anchors such as `./build-all.sh` unless
  surrounding context proves source and target are at the same conversation
  location.
- Do not leave wrong previous code in place and hide it with compatibility
  patches. Remove or rewrite wrong code.
- Do not keep reading around an already reported issue without adding it here
  and testing the real fix.
- If the user reports a live issue while work is running, add it here before or
  alongside the fix.

## Acceptance Gate

No UI parity item can be marked complete until this file records all of the
following for the relevant behavior:

- Same visible text anchor in reference and target.
- Proof both browsers are at the same conversation location.
- Reference and target screenshots before interaction.
- Reference and target screenshots after each relevant expand/collapse click.
- DOM structure, classes, attributes, and hierarchy for matched rows.
- Computed styles for text, spacing, colors, fonts, border radius, overflow,
  dimensions, icons, and buttons.
- Real Playwright/CDP mouse click evidence, not synthetic state mutation.
- `elementFromPoint` evidence proving the click lands on the real control.
- Expanded body text and structure when the reference expands.
- Scroll evidence across the long conversation, including upward scroll from
  the latest turns.
- Browser console and page error evidence.
- Reference extension source or live DOM evidence when grouping rules are
  unclear.
- Local build/check evidence for changed code.
- Commit, push, deploy, service status, asset currentness, and agent-online
  evidence after deployed code changes.
- Human-visible review result. If the screenshot still visibly differs, the
  item stays open.

## Required Workflow Per Anchor

1. Pick a visible text anchor from the long conversation, newest to oldest.
2. Capture reference screenshot, DOM, computed styles, panel width, scroll
   state, and console errors.
3. Locate the same anchor visibly in the target page. API/session text match is
   not enough.
4. Capture target screenshot, DOM, computed styles, panel width, scroll state,
   and console errors.
5. Compare grouping, row order, duration placement, collapsed text, expanded
   body, file rows, icons, wrapping, spacing, and running/finished state.
6. For every expandable row visible in the reference, click reference and
   target with real mouse input and capture before/after state.
7. If target differs, add or update an item in this worklist before
   implementing.
8. Audit whether existing code causing the mismatch is wrong. Remove or rewrite
   wrong code instead of layering a patch around it.
9. Implement the smallest product change that matches official behavior.
10. Run local checks.
11. Commit and push code changes.
12. Deploy to `https://codex.zelt.cn/`.
13. Verify the deployed target is serving the new asset version.
14. Rerun the same-anchor validation online.
15. Close the task only after screenshots, DOM/style evidence, click evidence,
   and human-visible review all match.

## Current Accepted Work

No conversation UI parity item is accepted under Reset 12.

The only completed work in this reset is work-file hygiene:

- Reset 11 active work file archived.
- Reset 11 active live-anchor reports moved to legacy.
- Reset 11 active live-currentness reports moved to legacy.
- Reset 11 generated screenshots/capture artifacts moved to legacy.
- Active live evidence directories emptied.
- This Reset 12 worklist recreated as the only active source of truth.

## Open Failures

### R12-F1. Long conversation scroll and click stability

Status: open

User-visible symptoms:

- Long conversations can become hard or impossible to scroll.
- The page previously behaved like the whole conversation area could be dragged.
- Processed/file disclosures could not reliably be clicked and expanded.
- The user clarified this is a scroll/click problem, not a drag-resizer problem.

Required fix:

- Remove or rewrite any overlay, drag surface, spacer, mask, pointer-events
  layer, or scroll handler that interferes with normal conversation scrolling
  and clicking.
- Verify with real browser scrolling and real mouse clicks at multiple
  same-anchor locations.
- Ensure expanded/collapsed controls remain clickable without hidden surfaces
  above content.

Acceptance:

- At least five newest-to-oldest anchors prove normal upward scrolling.
- Every visible disclosure in those anchors can be opened by real mouse click.
- `elementFromPoint` lands on the real disclosure control, not an overlay,
  editor, footer, spacer, or browser-level selection/drag layer.

### R12-F2. Exact nested-anchor focus inside huge turns

Status: open

Reset 12 evidence:

- Report: `reference/live-anchor-alignment/20260707-001737/summary.json`
- Anchors: `启动脚本已放好`, `start.sh +5 -5`
- Result: `33` checks, `12` failed.
- Source found both anchors and exposed processed/file activity rows.
- Target API contained both anchors at seq `6979` and `6954`.
- Target browser focused the parent turn but did not visibly locate the same
  nested content, so processed/file rows in the target evidence were `0`.
- Follow-up report after first fix:
  `reference/live-anchor-alignment/20260707-003147/summary.json`.
- Follow-up result: `33` checks, `9` failed.
- Improvement: target found `启动脚本已放好` and ran target real-click probing.
- Remaining issue: focus restoration selected the parent processed-summary
  aggregate element before the exact seq element, so target still aligned too
  high in the same large turn; `start.sh +5 -5` still was not visibly found.

Problem:

- The target can load the correct large turn by seq, but it can fail to scroll
  to the exact nested event/content inside that huge turn.
- Archived examples: `启动脚本已放好`, `start.sh +5 -5`.
- This makes same-anchor verification unreliable and can hide real UI
  mismatches.

Required fix:

- Render addressable markers for sub-events or content blocks that carry the
  relevant seq.
- When focusing an anchor, prefer the exact sub-event element over the whole
  turn container.
- Keep the target anchor visibly aligned with the reference anchor before
  judging style parity.

Acceptance:

- Same-anchor validation can visibly locate nested file/activity text inside a
  huge turn.
- Screenshots prove source and target are aligned to the same nested content,
  not just the same parent turn.

### R12-F3. Processed disclosure grouping and duration placement

Status: open

Required parity:

- `已处理 XXs` row placement and duration placement must match the reference.
- Collapsed labels must remain visible.
- Expanded body must match the reference structure and order.
- Finished turns must not keep stale `正在思考`.
- Mid-run guidance/user messages must group exactly as the reference does.
- No custom command summary rows during first-pass parity.

Acceptance:

- Same-anchor before/after screenshots show matching collapsed and expanded
  processed rows.
- DOM hierarchy and computed styles match the official extension for each
  checked processed row.

### R12-F4. File and diff activity rows

Status: open

Problem:

- Some target locations still render code/file-change information as normal
  assistant text.
- Official extension groups those records into structured file/resource rows.
- The right-side diff viewer can be deferred, but visible row style and
  expandable shell must match first.

Required parity:

- File changes render as official structured file rows, not raw text.
- File name, icon, add/delete counts, spacing, wrapping, and disclosure shell
  match the reference.
- File resource show-more/collapse behavior matches official rules.
- Remove first-pass command display enhancements before judging parity.

Acceptance:

- Same-anchor before/after screenshots show matching file/resource rows.
- Expanded file groups match the official visible order and show-more/collapse
  state.
- Real mouse click expands/collapses the same controls in both products.

### R12-F5. Running and finished state parity

Status: open

Problem:

- Conversation detail can keep stale running text after a turn has finished.
- Session list and detail state can diverge after navigating away and back.
- Official extension uses clear running/finished visual state, including spinner
  behavior and removing thinking rows when complete.

Required parity:

- Finished turns remove transient `正在思考` state.
- Running turns show the official spinner/processing treatment.
- Session list receives live status updates without requiring manual page
  refresh.

Acceptance:

- Reference and target screenshots match for one running turn and one finished
  turn.
- SSE or equivalent live update evidence proves the list and detail views
  converge without stale state.

### R12-F6. Previous wrong-assumption code cleanup audit

Status: open

Files to audit first:

- `frontend/src/pages/codex/renderer.js`
- `frontend/src/pages/codex/grouping.js`
- `frontend/src/pages/codex/activity-summary.js`
- `frontend/src/pages/codex/lifecycle.js`
- `frontend/src/pages/codex/virtualizer.js`
- Codex page CSS for overlays, scroll containers, footer spacers, masks, drag
  surfaces, and pointer events.
- Audit scripts that previously reported false positives.

Required output:

- File-by-file notes in this worklist.
- Wrong code removed or rewritten.
- Retained code justified by live reference behavior.

### R12-F7. Audit script reliability

Status: open

Problem:

- Previous scripts mixed pre-click and post-click disclosure labels.
- Previous scripts could count off-screen rows as visible.
- Previous scripts could pass without proving human-visible parity.

Required fix:

- Tie every comparison to the same visible source turn and target turn.
- Reject ambiguous anchors unless surrounding context uniquely identifies the
  location.
- Record screenshot, DOM, computed style, click, hit-test, console, and current
  asset evidence in a reviewable report.
- Treat `0 failed` as a signal to inspect, not as acceptance.

Acceptance:

- The script produces reviewable evidence for at least five same-location
  anchors.
- Human-visible review confirms the script result for those anchors.

### R12-F8. Online currentness after every product change

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

Use these anchors first, then add more while moving upward through the same long
conversation:

- `启动一个带远程调试或 noVNC 的浏览器实例`
- `挂到现在的codex-web那个端口`
- `现在首先,你先对浏览器截图,并进行下载`
- `在抓取一次,现在是在会话内的界面`
- `好 那么现在可以关闭掉这个了`
- `也就是开始做我们codex的界面出来`
- `启动脚本已放好`
- `start.sh +5 -5`
- `./build-all.sh` with surrounding context proving the same location
- The latest finished assistant turn that shows `已处理`
- The nearest visible official file-change block in the reference
- A turn with an expandable processed body
- A turn that previously showed raw code/file text in the target

Each anchor needs its own Reset 12 evidence note before it can be considered
covered.

## Progress Log

### 2026-07-07 Reset 12 rebuild

Status: complete for work-file cleanup only

Done:

- Archived the Reset 11 active work file.
- Moved old active live-anchor reports out of `reference/live-anchor-alignment/`.
- Moved old active live-currentness reports out of `reference/live-currentness/`.
- Moved old active generated screenshots/capture artifacts out of the top-level
  `reference/` area.
- Recreated active live report directories empty.
- Rebuilt this file with the user's final acceptance rules and current live
  issues.

Not done:

- No conversation UI parity item is closed.
- No deployed behavior has been accepted under Reset 12.
- The next product work must begin with same-anchor live browser evidence and
  update this file before closing anything.

### 2026-07-07 Reset 12 nested-anchor evidence and local fix

Status: local fix implemented, deployed verification pending

Evidence:

- Ran Reset 12 live anchor audit for `启动脚本已放好` and `start.sh +5 -5`.
- Report written to `reference/live-anchor-alignment/20260707-001737/summary.json`.
- The target API contained both anchors, but the deployed browser could not
  visibly locate either nested anchor inside the huge turn.

Local product changes:

- Added per-event seq attributes to rendered messages, processed summary rows,
  file activity rows, standalone activity rows, and grouped file-change rows.
- Changed focused-turn restoration to prefer the exact seq-marked element over
  the parent virtual turn.
- Auto-expands processed summary and file-change disclosures when the active
  focus seq is inside their hidden body.
- Auto-expands file show-more groups when the active focus seq is in a hidden
  file detail.
- After deployed report `20260707-003147`, changed focus element lookup to query
  exact `data-codex-event-seq` before aggregate `data-codex-event-seqs`, instead
  of using a merged selector that could return the aggregate row first.

Local checks:

- `node --check frontend/src/pages/codex/renderer.js`: passed.
- `node --check scripts/audit-codex-live-anchor-alignment.cjs`: passed.
- `node scripts/audit-codex-activity-summary-rules.cjs`: passed.
- `frontend/build.sh` via Git Bash: passed.
- `./build-all.sh` via Git Bash: passed.
- `./test-go.sh` via Git Bash: passed.
- Re-ran `./build-all.sh` and `./test-go.sh` after the exact-first focus
  selector fix: passed.

Not accepted:

- This fix has not been committed, pushed, deployed, or verified online.
- R12-F2 remains open until the same anchors visibly align on
  `https://codex.zelt.cn/`.
