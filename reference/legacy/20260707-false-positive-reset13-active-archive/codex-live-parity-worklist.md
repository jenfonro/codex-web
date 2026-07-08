# Codex Live Parity Worklist

Created: 2026-07-07 +08:00
Reset: 13
Status: active

This is the only active work file for Codex Web conversation parity.

Reset 13 exists because Reset 12 still allowed false-positive progress: local
fixes, script pass/fail counts, and partial screenshots were treated as useful
progress before they met the user's final acceptance standard. From this reset,
no conversation UI item is complete until the deployed site is visibly verified
against the official code-server Codex extension at the same long-session text
anchor.

## Active Scope

- Target: `https://codex.zelt.cn/`
- Reference: `https://code-tx.zelt.cn/?folder=/root`
- Reference setup: Codex extension opened from the left Activity Bar icon.
- Reference setup: right chat/sidebar closed.
- Viewport: `1920x1080` or larger unless testing a responsive issue.
- Test conversation: the long conversation containing `分析一下codex-web`.
- Comparison direction: newest-to-oldest, because both products open near the
  latest turns.
- Location rule: compare by the same browser-visible text anchor in both
  products. API matches are not enough.

## Archive Boundary

Moved out of active work:

- `reference/legacy/20260707-false-positive-reset12-active-archive/codex-live-parity-worklist.md`
- `reference/legacy/20260707-false-positive-reset12-active-archive/live-anchor-alignment/`
- `reference/legacy/20260707-false-positive-reset12-active-archive/live-currentness/`

Already archived before this reset:

- `reference/legacy/20260707-false-positive-reset3/`
- `reference/legacy/20260707-false-positive-reset4/`
- `reference/legacy/20260707-false-positive-reset5/`
- `reference/legacy/20260707-false-positive-reset6/`
- `reference/legacy/20260707-false-positive-reset7/`
- `reference/legacy/20260707-false-positive-reset8/`
- `reference/legacy/20260707-false-positive-reset9/`
- `reference/legacy/20260707-false-positive-reset10/`
- `reference/legacy/20260707-false-positive-reset11/`
- `reference/legacy/20260707-false-positive-reset12/`
- `reference/legacy/20260707-false-positive-workfiles/`
- `reference/legacy/20260707-live-parity-reset2/`

Archived reports are historical clues only. They cannot close work under Reset
13, even if they say `0 failed`.

## Hard Rules

- Do not invent a similar UI.
- Do not mark anything complete from memory.
- Do not mark anything complete from source inspection alone.
- Do not mark anything complete from screenshots alone.
- Do not mark anything complete from green scripts alone.
- Do not use archived Reset 12 evidence as acceptance evidence.
- Do not keep Codex Web-only command enhancements during first-pass parity.
- Do not show `exec_command xN`, `write_stdin`, `Chunk ID`, shell transcript
  rows, or custom command rows during first-pass parity.
- Do not add overlays, drag surfaces, invisible masks, or pointer blockers over
  the conversation.
- Do not treat long-session scroll failure as a draggable-resizer problem.
- Do not fix long-session performance by truncating history, hiding rows, or
  losing old content.
- Do not accept repeated short anchors such as `./build-all.sh` unless nearby
  context proves reference and target are at the same conversation location.
- Do not leave wrong earlier code in place and hide it with compatibility
  patches. Remove or rewrite wrong code.
- If the user reports a live issue while work is running, add it here before or
  alongside the fix.

## Status Meaning

- `open`: known problem, not proven fixed.
- `investigating`: evidence collection or source audit is active.
- `implemented`: code was changed locally, but not accepted.
- `deployed`: target was updated, but visual parity is not accepted yet.
- `accepted`: deployed target passed the full evidence gate and human-visible
  review. No item currently has this status.

## Acceptance Gate

Each UI parity item requires all evidence below before it can become
`accepted`:

- Same visible text anchor in reference and target.
- Proof both browsers are at the same conversation location.
- Reference and target screenshots before interaction.
- Reference and target screenshots after every relevant expand/collapse click.
- DOM structure, classes, attributes, and hierarchy for matched rows.
- Computed styles for text, spacing, color, font, border radius, overflow,
  dimensions, icons, and buttons.
- Real Playwright/CDP mouse click evidence, not synthetic state mutation.
- `elementFromPoint` evidence proving the click lands on the real control.
- Expanded body text and structure when the reference expands.
- Scroll evidence across the long conversation, especially upward scroll from
  the latest turns.
- Browser console and page-error evidence.
- Reference extension source or live DOM evidence when grouping rules are
  unclear.
- Local build/check evidence for changed code.
- Commit, push, deploy, service status, asset currentness, and agent-online
  evidence after deployed code changes.
- Human-visible review. If the screenshot still visibly differs, the item stays
  open.

## Required Workflow Per Anchor

1. Pick a visible text anchor from the long conversation, newest-to-oldest.
2. Capture reference screenshot, DOM, computed styles, panel width, scroll
   state, and console errors.
3. Locate the same anchor visibly in the target. API/session text match is not
   enough.
4. Capture target screenshot, DOM, computed styles, panel width, scroll state,
   and console errors.
5. Compare grouping, row order, duration placement, collapsed text, expanded
   body, file rows, icons, wrapping, spacing, running state, and finished state.
6. For every expandable row visible in the reference, click reference and target
   with real mouse input and capture before/after evidence.
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

## Current Baseline

Latest known deployed commit before Reset 13:

- `2929546 Prefer exact Codex event focus targets`

Known service state before Reset 13:

- `codex-web.service`: previously active after deploy.
- Agent node: `host-docker-agent` was previously online.

Important: this baseline is not accepted parity. It is only the starting point
for Reset 13 validation.

## Open Work

### R13-F1. Rebuild trustworthy evidence flow

Status: implemented

Problem:

- Previous audit reports produced false positives or partial confidence.
- Some evidence selected parent turns or serialized API context instead of the
  exact visible nested row.
- Script output was allowed to influence completion before human-visible parity.

Required work:

- Audit `scripts/audit-codex-live-anchor-alignment.cjs`.
- Ensure API anchor matching prefers the record's own display text/data text.
- Reject matches that only appear inside serialized neighbor/context text.
- Require visible browser anchor proof before style comparison.
- Make reports useful for review, but never self-accepting.

Implemented locally:

- `scripts/audit-codex-live-anchor-alignment.cjs` no longer uses
  `JSON.stringify(record)` as searchable record text.
- API record matching now uses explicit event-owned text fields, tool args, and
  structured `file_change.data.files` search text.
- File anchors such as `start.sh +5 -5` now prefer `file_change` records.
- Reset 13 report `reference/live-anchor-alignment/20260707-004950/summary.json`
  selected `start.sh +5 -5` as target API `seq=6998 kind=file_change`.

Not accepted:

- The audit still found 3 failures.
- This item is not accepted until at least five same-location anchors produce
  reviewable evidence and human-visible review confirms no false-positive
  location matches.

Acceptance:

- At least five same-location anchors produce reviewable evidence.
- Each report contains screenshots, DOM/style, hit-test, click, console, and
  asset-currentness evidence.
- Human-visible review confirms the script did not pass a mismatched location.

### R13-F2. Long conversation scroll and click stability

Status: open

Problem:

- Long conversations can become hard or impossible to scroll.
- The page previously behaved like the whole conversation area could be dragged.
- Processed/file disclosures could not reliably be clicked and expanded.
- The user clarified this is a scroll/click problem, not a drag problem.

Required work:

- Remove or rewrite any overlay, drag surface, spacer, mask, pointer-events
  layer, scroll handler, or virtualizer behavior that blocks normal scrolling
  and clicking.
- Verify real upward scrolling through the long conversation.
- Verify disclosure clicks with `elementFromPoint` and real mouse input.

Acceptance:

- At least five newest-to-oldest anchors prove normal upward scroll.
- Every visible disclosure in those anchor windows opens by real click.
- Hit testing lands on the real disclosure control, not an overlay or spacer.

### R13-F3. Processed disclosure grouping and duration placement

Status: open

Problem:

- `已处理 XXs` placement and expanded body rules are not accepted.
- Some finished turns can keep stale running/thinking text until navigation.
- Custom command summaries must not appear in first-pass parity.

Required work:

- Compare official processed rows at same visible anchors.
- Match collapsed label, duration placement, icon, indentation, expanded body,
  and row ordering.
- Remove first-pass command display enhancements from processed summaries.

Acceptance:

- Same-anchor before/after screenshots match the official extension.
- Real clicks expand/collapse the same rows in both products.
- Finished turns do not show stale transient state.

### R13-F4. File and diff activity rows

Status: implemented

Problem:

- Some target file/change content is still rendered as normal assistant text.
- Official extension groups those records into structured file rows and diff
  blocks.
- The right-side diff viewer can wait, but the visible row and expandable shell
  must match first.

Required work:

- Inspect official extension DOM/source for file-change grouping rules.
- Inspect target session events to identify actual file-change records.
- Render file names, icons, add/delete counts, row spacing, wrapping, and
  disclosure behavior like the reference.
- Remove command transcript rows from first-pass parity.

Reset 13 evidence:

- Report: `reference/live-anchor-alignment/20260707-004950/summary.json`
- Anchor: `start.sh +5 -5`
- Source screenshot:
  `reference/live-anchor-alignment/20260707-004950/source-anchor-2.png`
- Target screenshot before local fix:
  `reference/live-anchor-alignment/20260707-004950/target-anchor-2.png`
- The source official extension shows an expanded diff block with file content
  lines.
- The deployed target only showed file header rows because
  `agent/internal/session/history.go` dropped `unified_diff/content` from
  `patch_apply_end` changes.

Implemented locally:

- `agent/internal/session/history.go` now preserves per-file `unifiedDiff` or
  `content` in `file_change.data.files`.
- `agent/internal/session/history_test.go` now verifies those fields survive
  history parsing.
- `frontend/src/pages/codex/renderer.js` now normalizes those fields and renders
  inline diff rows inside file-change cards.
- `frontend/src/pages/codex/panel-shadow.css` now contains scoped
  `.codex-inline-diff*` styles for line numbers, code text, and added/deleted
  row backgrounds.

Acceptance:

- Same-anchor file-change blocks match before/after expansion.
- Code/file text is not dumped as plain assistant text when the reference uses
  file rows.
- Show-more/collapse behavior matches the official visible order.

Not accepted:

- The fix has not been committed, pushed, deployed, or verified on
  `https://codex.zelt.cn/`.
- The agent container must be rebuilt/restarted before the deployed API can
  expose `unifiedDiff/content`.
- Same-anchor visual parity must be rerun after deployment.

### R13-F5. Running and finished state parity

Status: open

Problem:

- Session list and detail state can diverge.
- Running/finished visual state can remain stale.
- Official extension shows clear spinner/running state and removes transient
  thinking rows when complete.

Required work:

- Keep list and detail views subscribed to live session state.
- Match official running spinner treatment.
- Remove stale thinking rows when the turn finishes.

Acceptance:

- One running turn and one finished turn match reference behavior.
- List and detail converge without manual refresh.

### R13-F6. Wrong earlier code cleanup audit

Status: open

Files to audit:

- `frontend/src/pages/codex/renderer.js`
- `frontend/src/pages/codex/grouping.js`
- `frontend/src/pages/codex/activity-summary.js`
- `frontend/src/pages/codex/lifecycle.js`
- `frontend/src/pages/codex/virtualizer.js`
- Codex page CSS for overlays, scroll containers, spacers, masks, drag surfaces,
  and pointer events.
- Audit scripts that previously produced false positives.

Required work:

- Add file-by-file notes below before major rewrites.
- Remove or rewrite code that exists only because of wrong assumptions.
- Keep only code backed by official source, live DOM, or verified target need.

Acceptance:

- This worklist records what was removed, what was kept, and why.
- No conversation parity issue is hidden by a compatibility patch.

## Anchor Queue

Use these anchors first, then add more while moving upward through the same long
conversation:

- `启动脚本已放好`
- `start.sh +5 -5`
- `./build-all.sh` with surrounding context proving the same location
- The latest visible `已处理 XXs` row
- The nearest official file-change block
- A turn with an expandable processed body
- A turn that previously showed raw code/file text in the target
- A running turn showing spinner/state
- A finished turn that previously kept stale thinking text

Each anchor needs a Reset 13 evidence note before it can be considered covered.

## Evidence Directories

Active evidence goes here only after Reset 13:

- `reference/live-anchor-alignment/`
- `reference/live-currentness/`

Each evidence run must have its own timestamped directory and a short note in
the progress log below. Do not reuse archived directories as active proof.

## Progress Log

### 2026-07-07 Reset 13 rebuild

Status: open baseline

Done:

- Moved Reset 12 active work file and active evidence directories to
  `reference/legacy/20260707-false-positive-reset12-active-archive/`.
- Recreated empty active evidence directories:
  `reference/live-anchor-alignment/` and `reference/live-currentness/`.
- Rebuilt this file as the only active Reset 13 source of truth.

Not accepted:

- No conversation UI parity item is accepted.
- Previous commits and reports remain historical context only.

Next:

- Start with R13-F1 and R13-F2 before changing visual grouping.
- Any user-reported live issue must be added here before being marked fixed.

### 2026-07-07 Reset 13 anchor audit and file-diff data fix

Status: implemented locally, not accepted

Evidence:

- Ran live anchor audit with viewport `1920x1080`, anchors
  `启动脚本已放好|start.sh +5 -5`, target fresh load, and real disclosure clicks.
- Report: `reference/live-anchor-alignment/20260707-004950/summary.json`
- Result: `33 checks, 3 failed`.
- New audit matching correctly selected `start.sh +5 -5` as
  `seq=6998 kind=file_change`, replacing the previous false-positive assistant
  record selection.

Failures still open:

- Anchor 1 visible file labels differ:
  source `已编辑 1 个文件 | 已创建 1 个文件`, target
  `已创建 2 个文件 | 已编辑 1 个文件 | 已创建 1 个文件 | 收起文件 | 已创建 1 个文件`.
- Anchor 1 target processed disclosure expansion check still reports
  `已处理 25s`.
- Anchor 2 context comparison still fails even though target API matched the
  correct file_change event; target rendered only file headers before the local
  diff-data fix.

Local code changes:

- Hardened API anchor matching in
  `scripts/audit-codex-live-anchor-alignment.cjs`.
- Preserved `unifiedDiff/content` in agent history file-change events.
- Added frontend inline diff row rendering and scoped styles.

Local checks:

- `node --check frontend/src/pages/codex/renderer.js`: passed.
- `node --check scripts/audit-codex-live-anchor-alignment.cjs`: passed.
- `go test ./...` in `agent`: passed.
- `go test ./...` in `backend`: passed.
- `C:\Program Files\Git\bin\bash.exe ./frontend/build.sh`: passed.

Not accepted:

- No UI parity item is accepted.
- Full build-all, commit, push, server deploy, agent rebuild, online currentness,
  and same-anchor rerun are still required.
