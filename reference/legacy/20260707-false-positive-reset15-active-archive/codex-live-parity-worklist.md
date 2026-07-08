# Codex Live Parity Worklist

Created: 2026-07-07 +08:00
Reset: 15
Status: active

This is the only active work file for Codex Web conversation parity.

Reset 15 exists because previous work produced false positives: code changes,
script output, screenshots, and partial DOM checks were treated as progress even
though the deployed page had not passed the user's final browser-visible
standard. From this reset, product UI parity has no accepted items until the
live target proves the behavior against the official code-server Codex extension
at the same visible text anchors.

## Active Scope

- Target: `https://codex.zelt.cn/`
- Reference: `https://code-tx.zelt.cn/?folder=/root`
- Reference setup: Codex extension opened from the left Activity Bar icon.
- Reference setup: right chat/sidebar closed.
- Viewport: `1920x1080` or larger unless testing a responsive issue.
- Test conversation: the long conversation containing `分析一下codex-web`.
- Comparison direction: newest-to-oldest.
- Location rule: compare the same browser-visible text anchor in both products.
- Deployment rule: local success is not enough; target assets and agent data must
  be current.

## Archive Boundary

Moved out of active work:

- `reference/legacy/20260707-false-positive-reset14-active-archive/codex-live-parity-worklist.md`
- `reference/legacy/20260707-false-positive-reset14-active-archive/live-anchor-alignment/`
- `reference/legacy/20260707-false-positive-reset14-active-archive/live-currentness/`

Older archives remain historical clues only:

- `reference/legacy/20260707-false-positive-reset13-active-archive/`
- `reference/legacy/20260707-false-positive-reset12-active-archive/`
- `reference/legacy/20260707-false-positive-reset3/` through
  `reference/legacy/20260707-false-positive-reset12/`
- `reference/legacy/20260707-false-positive-workfiles/`
- `reference/legacy/20260707-live-parity-reset2/`

Archived evidence cannot close Reset 15 work, even if it contains screenshots,
green checks, or `0 failed`.

## Status Meaning

- `open`: known work, no accepted live proof.
- `in-progress`: being investigated or changed now.
- `needs-live-proof`: code or tooling changed, but live parity is not proven.
- `blocked`: cannot proceed without an external state change.
- `accepted`: live target passed the full evidence gate below.
- `closed-admin`: administrative cleanup only; no product UI parity accepted.

Do not use `implemented`, `candidate`, or similar soft-success labels for UI
parity. They were a source of false positives.

## Hard Rules

- Do not invent a similar UI.
- Do not mark anything complete from memory.
- Do not mark anything complete from source inspection alone.
- Do not mark anything complete from screenshots alone.
- Do not mark anything complete from green scripts alone.
- Do not reuse archived evidence as acceptance evidence.
- Do not hide wrong earlier code with compatibility patches.
- Do not keep first-pass command enhancements while matching the official view.
- Do not show `exec_command xN`, `write_stdin`, `Chunk ID`, shell transcript rows,
  or custom command rows in the parity pass.
- Do not add overlays, drag surfaces, invisible masks, or pointer blockers over
  the conversation.
- Do not treat long-session scroll failure as a drag/resizer problem.
- Do not fix long-session performance by truncating history, hiding rows, or
  losing old content.
- Do not accept repeated short anchors such as `./build-all.sh` unless nearby
  context proves reference and target are at the same conversation location.
- If the user reports a live issue while work is running, add it here before or
  alongside the fix, then verify it by the live gate.

## Acceptance Gate

Every UI parity item requires all evidence below before it can become
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
- Human-visible review. If screenshots still visibly differ, the item stays
  `open`.

## Current Baseline

- Latest deployed product commit known from previous reset: `c2101a8`.
- `c2101a8` is not UI acceptance. It may contain useful fixes, but every parity
  claim must be proven again under Reset 15.
- Local uncommitted tooling change exists in
  `scripts/audit-codex-live-anchor-alignment.cjs`; it is not product acceptance.
- Active evidence directories were recreated for Reset 15:
  - `reference/live-anchor-alignment/`
  - `reference/live-currentness/`

## Active Work

### R15-F0. Workfile reset and false-positive quarantine

Status: closed-admin

Scope:

- Administrative only. This accepts no product UI parity.

Done:

- Archived Reset 14 active work file and evidence directories.
- Recreated active Reset 15 evidence directories.
- Rebuilt this work file with stricter status rules and acceptance gates.

### R15-F1. Live currentness and agent freshness

Status: open

Problem:

- The target must be proven to serve the current bundle before judging any UI.
- Agent/session data must be current when renderer behavior depends on session
  events.

Required work:

- Verify server HEAD, service status, target asset version, and console errors.
- Verify `host-docker-agent` is online.
- Verify session API exposes the required event fields.

Acceptance:

- New Reset 15 currentness report exists in `reference/live-currentness/`.
- Report records server commit, service state, agent state, asset versions, and
  browser console/page errors.

### R15-F2. Evidence tooling false-positive repair

Status: in-progress

Problem:

- The anchor audit previously selected parent turn containers instead of the
  exact visible anchor element.
- That allowed screenshots to compare different parts of the same long turn.

Required work:

- Repair exact anchor element selection and centering.
- Reject anchors when the exact matched element is not visible in both browsers.
- Handle internal scroll containers explicitly, or mark those anchors unsupported
  until the strategy is correct.

Acceptance:

- A new Reset 15 report shows exact anchor targets in viewport on both sides.
- The report includes screenshots, DOM target debug, and no parent-container
  substitution.

Current evidence:

- `reference/live-anchor-alignment/20260707-013146/summary.json`
  - Failed: `33 checks, 7 failed`.
  - Useful finding: text Range anchors were recorded with `rectSource:
    text-range`, proving parent turn containers are no longer enough.
  - Not accepted: anchor 1 target was still not visible; anchor 2 found
    different context.
- `reference/live-anchor-alignment/20260707-013443/summary.json`
  - Failed: `33 checks, 7 failed`.
  - Useful finding: target `focusSeq` flow could lose the matched turn after
    centering; the script must not keep stale DOM references.
  - Not accepted: target screenshot moved to unrelated `app.js` file activity.
- `reference/live-anchor-alignment/20260707-013955/summary.json`
  - Failed: `33 checks, 7 failed`.
  - Useful finding: recovery no longer wandered as far, but target still left
    the focus area and selected unrelated earlier turns.
  - Not accepted: exact target not visible in target.
- `reference/live-anchor-alignment/20260707-014337/summary.json`
  - Failed: `33 checks, 7 failed`.
  - Useful finding: global seq pre-centering can select the wrong virtualized
    element and force the focus turn outside the viewport.
  - Not accepted: anchor search exceeded budget.
- `reference/live-anchor-alignment/20260707-014724/summary.json`
  - Failed: `33 checks, 7 failed`.
  - Useful finding: seq pre-centering restricted to the current focus turn still
    produced unstable target geometry. `focusCenter` selected
    `data-codex-event-seq`, but `focusTurnRect` ended far outside the viewport.
  - Not accepted: anchor search exceeded budget.

Script changes currently local only:

- Anchor candidates now record text Range rectangles instead of only element
  rectangles.
- Candidate sorting prefers exact, shorter, smaller targets before viewport
  state, so parent turn containers cannot win solely because they intersect the
  viewport.
- Target focus mode no longer skips centering just because the parent turn is
  visible; the exact anchor must be visible.
- Stale/disconnected matches are rejected after scrolling.
- Target seq pre-centering is restricted to the current focus turn and records
  `focusCenter` evidence.

Current conclusion:

- R15-F2 is not accepted.
- The tooling is stricter and now rejects several old false positives.
- The latest failures also point at R15-F3/R15-F7 product work: long-session
  virtual scroll/focus restoration can move the target turn far outside the
  viewport.

### R15-F3. Long conversation scroll and click stability

Status: needs-live-proof

Problem:

- Long sessions can fail to scroll normally.
- Expandable rows such as `已处理 XXs` can be unclickable on the live page.
- The user observed a page-wide drag-like behavior that should not exist.

Required work:

- Audit overlays, pointer events, virtualizer spacers, masks, drag handlers, and
  scroll containers.
- Remove or rewrite wrong code instead of masking it.
- Verify newest-to-oldest upward scroll across multiple anchors.
- Verify real mouse clicks and `elementFromPoint` on disclosure controls.

Acceptance:

- At least five newest-to-oldest anchors scroll normally in both products.
- Every visible disclosure in those windows opens by real click.
- Hit testing lands on the actual disclosure control, not an overlay, spacer, or
  wrong parent element.

Local product change:

- `frontend/src/pages/codex/renderer.js`
  - `restoreFocusedTurn()` now keeps `focusLockUntil` active for 700ms after
    restoring a focused turn.
  - Reason: the previous code immediately cleared the focus lock, so the next
    scroll handler could treat the programmatic focus scroll as normal user
    scrolling and recalculate the virtual window away from the focused long
    turn.

Local checks:

- `node --check frontend/src/pages/codex/renderer.js`: passed.
- `node --check scripts/audit-codex-live-anchor-alignment.cjs`: passed.
- `C:\Program Files\Git\bin\bash.exe ./frontend/build.sh`: passed.
- `C:\Program Files\Git\bin\bash.exe ./build-all.sh`: passed.
- `C:\Program Files\Git\bin\bash.exe ./test-go.sh`: passed.

Not accepted:

- This fix is local only until committed, pushed, deployed, and verified on
  `https://codex.zelt.cn/` with Reset 15 same-anchor evidence.

### R15-F4. Processed disclosure grouping and duration placement

Status: open

Problem:

- `已处理 XXs` placement, collapsed text, expanded text, grouping, and row order
  are not accepted.
- Finished turns can show stale thinking/running UI until navigation.

Required work:

- Compare official processed rows at identical visible anchors.
- Match collapsed label, duration placement, icon, indentation, expanded body,
  and ordering.
- Remove custom command summaries from parity rendering.
- Clear transient thinking/running rows when a turn finishes.

Acceptance:

- Same-anchor before/after screenshots match the official extension.
- Real clicks expand/collapse the same rows in both products.
- Finished turns do not show stale transient state.

### R15-F5. File and diff activity rows

Status: open

Problem:

- Official extension renders file and diff activity as structured file rows and
  diff blocks.
- Target has rendered some file/code activity as normal assistant text or wrong
  collapse groups.
- Right-side diff viewer can wait; visible conversation rows must match first.

Required work:

- Inspect official extension DOM/source for grouping rules.
- Inspect target events for file-change records and preserved diff data.
- Match file names, icons, add/delete counts, row spacing, wrapping, collapsed
  shell, and expanded content.
- Remove command transcript rows during first-pass parity.

Acceptance:

- Same-anchor file-change blocks match before and after expansion.
- Code/file text is not dumped as plain assistant text when the reference uses
  file rows.
- Show-more/collapse behavior matches the official visible order.

### R15-F6. Running and finished state parity

Status: open

Problem:

- Session list and detail state can diverge.
- Running spinner/state and finished cleanup need to match the official
  extension.

Required work:

- Keep list and detail views subscribed to live session state.
- Match official spinner behavior.
- Remove stale thinking rows when a turn finishes.

Acceptance:

- One running turn and one finished turn match reference behavior.
- List and detail converge without manual refresh.

### R15-F7. Wrong earlier code cleanup audit

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

- Add file-by-file notes before major rewrites.
- Remove or rewrite code caused by wrong assumptions.
- Keep only code backed by official source, live DOM, or verified product need.

Acceptance:

- This worklist records what was removed, what was kept, and why.
- No conversation parity issue is hidden by a compatibility patch.

### R15-F8. Full same-anchor visual pass

Status: open

Problem:

- Looking at a small slice has missed obvious mismatches.

Required work:

- Use the long conversation and move newest-to-oldest.
- For each window, locate the same visible text anchor in both products.
- Expand reference disclosures when present, then perform the same action in the
  target.
- Record screenshot, DOM, computed style, and hit-test evidence.

Acceptance:

- The whole long-session pass has no visible large mismatches in grouping,
  collapse behavior, file/diff rows, scroll, or transient running state.

## Anchor Queue

Use these anchors first, then add more while moving upward through the same long
conversation:

- `分析一下codex-web`
- `启动脚本已放好`
- `start.sh +5 -5`
- `./build-all.sh` with surrounding context proving the same location
- The latest visible `已处理 XXs` row
- The nearest official file-change block
- A turn with an expandable processed body
- A turn that previously showed raw code/file text in the target
- A running turn showing spinner/state
- A finished turn that previously kept stale thinking text

Each anchor needs a Reset 15 evidence note before it can be considered covered.

## Evidence Directories

Active Reset 15 evidence goes here only:

- `reference/live-anchor-alignment/`
- `reference/live-currentness/`

Each evidence run must have its own timestamped directory and a short note in
the progress log below.

## Progress Log

### 2026-07-07 Reset 15 rebuild

Status: administrative only

Done:

- Archived Reset 14 active work and evidence.
- Recreated active evidence directories.
- Rebuilt this work file.
- Reset all UI parity items to `open`.

Not accepted:

- No UI parity item is accepted.
- Previous Reset 14 product changes, screenshots, and audit reports are clues
  only.

Next:

- Repair the evidence tooling so exact visible anchors are reliable.
- Recheck live currentness.
- Verify scroll/click stability before more visual grouping changes.
- Add each user-reported live issue to this file before or alongside the fix.

### 2026-07-07 Reset 15 anchor tooling and focus-scroll investigation

Status: in-progress

Done:

- Added text Range based anchor rectangles to the live anchor audit script.
- Rejected stale/disconnected matches after scrolling.
- Restricted target seq pre-centering to the current focus turn.
- Ran Reset 15 anchor reports:
  - `reference/live-anchor-alignment/20260707-013146/summary.json`
  - `reference/live-anchor-alignment/20260707-013443/summary.json`
  - `reference/live-anchor-alignment/20260707-013955/summary.json`
  - `reference/live-anchor-alignment/20260707-014337/summary.json`
  - `reference/live-anchor-alignment/20260707-014724/summary.json`
- Patched local product focus restoration to keep the virtualizer focus lock
  briefly after focused scroll restoration.

Findings:

- None of these reports are acceptance evidence.
- The script now rejects parent-container false positives more aggressively.
- The target long-session virtualizer can move a focused long turn outside the
  viewport after programmatic scroll restoration, matching the user's reported
  long-session scroll/click instability.

Next:

- Commit/push/deploy the local focus-lock fix if no further local issue appears.
- Re-run live currentness after deploy.
- Re-run the same anchors and only use a report if exact text Range targets are
  visible in both products.
