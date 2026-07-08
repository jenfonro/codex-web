# Codex Live Parity Worklist

Created: 2026-07-07 +08:00
Reset: 18
Status: active

This is the only active work file for Codex Web conversation parity.

Reset 18 exists because Reset 17 still allowed false-positive progress: code
was changed, scripts passed, and the live site was updated, but the final
acceptance standard was not met. From this reset onward, prior work is only a
clue until it passes the full live-browser evidence gate.

## Current Rule

No UI parity behavior is accepted at Reset 18 start.

Do not mark a task complete from memory, local scripts, source inspection,
single screenshots, deployment currentness, or one matching anchor. Those are
investigation inputs only.

## Archive Boundary

Moved out of active work:

- `reference/legacy/20260707-false-positive-reset17-active-archive/codex-live-parity-worklist.md`
- `reference/legacy/20260707-false-positive-reset17-active-archive/live-anchor-alignment/`
- `reference/legacy/20260707-false-positive-reset17-active-archive/live-currentness/`

Older archives are historical clues only:

- `reference/legacy/20260707-false-positive-reset16-active-archive/`
- `reference/legacy/20260707-false-positive-reset15-active-archive/`
- `reference/legacy/20260707-false-positive-reset14-active-archive/`
- `reference/legacy/20260707-false-positive-reset13-active-archive/`
- `reference/legacy/20260707-false-positive-reset12-active-archive/`
- `reference/legacy/20260707-false-positive-workfiles/`
- `reference/legacy/20260707-live-parity-reset2/`

Active Reset 18 evidence must be written only to:

- `reference/live-anchor-alignment/`
- `reference/live-currentness/`

Archived reports may explain what to inspect next. They cannot close a Reset 18
task.

## Fixed Test Setup

- Target: `https://codex.zelt.cn/?nodeId=host-docker-agent`
- Reference: `https://code-tx.zelt.cn/?folder=/root`
- Viewport: `1920x1080` or larger unless explicitly testing responsive layout.
- Reference setup: Codex extension opened from the left Activity Bar icon.
- Reference setup: right chat/sidebar closed.
- Test conversation: the long conversation containing `分析一下codex-web`.
- Sweep direction: newest-to-oldest, because the latest turn is initially visible.
- Location rule: reference and target must be compared at the same visible text
  anchor, with enough surrounding context to prove the location is the same.
- Short anchors such as `./build-all.sh` are not enough unless nearby context
  proves both browsers are at the same conversation location.

## Non-Negotiable Boundaries

- Do not invent a similar UI.
- Do not preserve wrong code through compatibility patches.
- Do not hide old messages, truncate history, or drop content to avoid long
  conversation failures.
- Do not add overlays, drag surfaces, invisible masks, or pointer blockers over
  the conversation.
- Do not treat long-session scroll failure as a resize or drag problem.
- Do not keep custom command transcript rows during the official parity pass.
- Remove custom rows such as `exec_command xN`, `write_stdin`, `Chunk ID`,
  shell transcript summaries, or handmade command-output groupings unless a
  later user-approved enhancement phase explicitly restores them.
- File/diff activity must follow official extension grouping and visible row
  style before any custom enhancement is added.
- If the user reports a live issue while work is running, add it here first or
  alongside the fix, then verify it with live evidence.

## Evidence Gate

Every visual or interaction task remains open until the evidence package has:

- Same visible text anchor in reference and target.
- Proof both browsers are at the same long-conversation location.
- Reference and target screenshots before interaction.
- Reference and target screenshots after each relevant expand/collapse click.
- Real Playwright/CDP mouse-click evidence, not synthetic state mutation.
- `elementFromPoint` evidence proving the click lands on the actual control.
- DOM structure, classes, attributes, and hierarchy for matched rows.
- Computed styles for text, spacing, color, font, border radius, overflow,
  dimensions, icons, and buttons when visual parity is involved.
- Expanded body text and structure when the official reference expands.
- Long-session upward-scroll evidence from latest turns.
- Browser console and page-error evidence.
- Reference extension source or live DOM evidence when grouping rules are unclear.
- Local build/check evidence for changed code.
- Commit, push, deploy, service status, asset currentness, and agent-online proof
  after deployed code changes.
- Human-visible review: if screenshots still visibly differ, the task remains open.

## Status Values

- `open`: known issue, no accepted proof.
- `in-progress`: being investigated or changed now.
- `needs-live-proof`: code changed, but live same-anchor proof is missing.
- `blocked`: external state prevents proof or implementation.
- `closed-admin`: housekeeping only; no UI parity accepted.
- `accepted`: allowed only after the full evidence gate passes.

## Active Tasks

### R18-A0. Rebuild active work tracking

Status: closed-admin

Scope:

- Archive Reset 17 active work and evidence.
- Recreate empty Reset 18 evidence directories.
- Rebuild this workfile with stricter false-positive controls.

Acceptance:

- Administrative only. This accepts no UI parity.

### R18-A1. Prove live currentness before any comparison

Status: in-progress

Problem:

- The user needs to inspect the real online site, so every fix must be deployed
  and proved current before visual acceptance.

Required work:

- Verify server HEAD, service status, asset versions, browser console/page
  errors, and agent online state.
- Store evidence under `reference/live-currentness/`.

Completion rule:

- This task supports UI proof only. It does not prove any visual parity.

Latest Reset 18 evidence:

- Server state before live interaction:
  - repo HEAD: `3f9d15c`
  - `codex-web.service`: `active`
  - `codex-web-agent`: `Up 3 hours`
  - server worktree status: clean
- Browser currentness report:
  `reference/live-currentness/20260707-034436/summary.json`
  - target URL: `https://codex.zelt.cn/?nodeId=host-docker-agent`
  - script version: `20260707033712`
  - css version: `20260707033712`
  - runtime version: `20260707033712`
  - HTML cache control: `no-cache`
  - console warnings/errors: `0`

Boundary:

- This proves only that the online page loaded a known asset version without
  obvious console errors. It does not prove UI parity, click behavior, scroll
  behavior, grouping, or collapse behavior.

Latest post-fix currentness:

- Server state after deploy:
  - product deploy repo HEAD: `d256c62`
  - current repo HEAD after workfile-only sync: `2e1491e`
  - `codex-web.service`: `active`
  - `codex-web-agent`: `Up 3 hours`
- Browser currentness report:
  `reference/live-currentness/20260707-040210/summary.json`
  - script version: `20260707040200`
  - css version: `20260707040200`
  - runtime version: `20260707040200`
  - console warnings/errors: `0`

### R18-A2. Restore long-conversation scroll and click behavior

Status: in-progress

Problem:

- Long conversations can become difficult or impossible to scroll.
- `已处理` rows have been reported as unclickable in live use.
- A prior page-wide drag-like surface appeared and must not exist.

Required work:

- Reproduce in the live target using the long `分析一下codex-web` conversation.
- Verify upward scrolling from the latest turns without jump, flicker, or
  pointer capture.
- Verify no overlay or invisible element intercepts clicks.
- Verify processed rows expand/collapse by real mouse click.

Reset 18 evidence:

- Target-only interaction audit:
  `reference/live-anchor-alignment/20260707-035402/summary.json`
  - viewport: `1920x1080`
  - real processed click before scroll: `已处理 42s`, `true -> false -> true`
  - real processed click after scroll: `已处理 1m 18s`, `true -> false -> true`
  - console warnings/errors: `0`
  - visible custom command transcript rows: `0`
  - scroll evidence showed a likely product issue: after reaching top and
    triggering older-history load, the history range expanded from `7555-7654`
    to `7455-7654`, but the visible content jumped back to newer turns instead
    of continuing smoothly upward.

Current interpretation:

- `已处理` is not yet proven broken as a click target after re-querying its
  current coordinates before each click.
- Long-session upward scroll continuity is still open and needs a product fix.

### R18-A2.1. Fix scroll continuity after older-history prepend

Status: in-progress

Problem:

- When older history is loaded while the user is scrolling upward, the rendered
  window can jump back to newer content.
- Evidence: `reference/live-anchor-alignment/20260707-035402/summary.json`,
  scroll steps `wheel-up-4` through `wheel-up-7`.

Required work:

- Preserve the user's visible anchor when prepending older events.
- Avoid resetting the viewport to latest turns after history range expands.
- Verify with real wheel scrolling that visible content moves continuously
  newest-to-oldest across at least two history prepend boundaries.

Implemented change:

- `frontend/src/pages/codex/index.js`
  - final render after older-history merge now preserves thread scroll.
  - captured scroll intent now includes a visible turn anchor: first visible
    turn seq/key plus offset from the scroll container top.
- `frontend/src/pages/codex/renderer.js`
  - thread-scroll restoration now first tries to restore the captured visible
    turn anchor.
  - height-delta restoration remains only as a fallback when the anchor cannot
    be found.
- `scripts/audit-codex-live-target-interactions.cjs`
  - added target-only Reset 18 interaction audit for real processed-row clicks
    and real wheel scrolling across history loading.

Local checks:

- `node --check frontend/src/pages/codex/index.js`: passed.
- `node --check frontend/src/pages/codex/renderer.js`: passed.
- `node --check scripts/audit-codex-live-target-interactions.cjs`: passed.
- `node scripts/audit-codex-activity-summary-rules.cjs`: passed.
- `node scripts/audit-codex-grouping-rules.cjs`: passed.
- `node scripts/audit-codex-event-mapping.cjs`: passed.
- `C:\Program Files\Git\bin\bash.exe ./frontend/build.sh`: passed.
- `C:\Program Files\Git\bin\bash.exe ./build-all.sh`: passed.
- `C:\Program Files\Git\bin\bash.exe ./test-go.sh`: passed.

Post-deploy live evidence:

- Commit deployed: `d256c62`
- Currentness:
  `reference/live-currentness/20260707-040210/summary.json`
  - runtime version: `20260707040200`
  - console warnings/errors: `0`
- Target-only interaction audit:
  `reference/live-anchor-alignment/20260707-040243/summary.json`
  - checks: `10`
  - failed: `0`
  - real processed click before scroll: `已处理 42s`, `true -> false -> true`
  - real processed click after scroll: `已处理 1m 18s`, `true -> false -> true`
  - wheel scrolling crossed multiple prepend boundaries:
    `7555-7654 -> 7455-7654 -> 7355-7654 -> 7255-7654 -> 7155-7654`
  - browser console warnings/errors: `0`

Boundary:

- This is live evidence for target scroll/click stability only.
- It does not close full code-server/Codex extension parity, file/diff
  grouping, or full newest-to-oldest visual sweep.

### R18-A3. Match official processed summary grouping and placement

Status: open

Problem:

- Processed-time rows such as `已处理 XXs` must appear in the same position as
  the official extension.
- Collapsed and expanded states must match official structure and style.

Required work:

- Compare the same text anchors in reference and target.
- Expand matching rows in both browsers with real mouse clicks.
- Inspect official DOM/source if grouping rules are ambiguous.

### R18-A4. Match official file and diff activity rendering

Status: open

Problem:

- Official extension renders file edits as structured file/resource rows.
- Target has previously rendered file/code details as plain text or wrong
  custom structures.

Required work:

- Capture official file/diff DOM and computed styles.
- Match labels, icons, row hierarchy, spacing, and collapse behavior.
- Do not implement the right-side diff viewer unless it is required for visible
  row parity.

### R18-A5. Remove custom command transcript UI from parity pass

Status: open

Problem:

- Custom command transcript rows were useful as an enhancement idea, but they
  break official parity and confuse screenshot comparison.

Required work:

- Remove visible custom command transcript rows from the official-parity path.
- Keep raw data only if needed internally and it does not affect visible output.
- Reconsider command display only after official parity is accepted.

### R18-A6. Audit renderer, style, and virtualizer assumptions

Status: open

Problem:

- Earlier commits may contain code that only supports failed approaches.
- Some structures may still be copied from code-server or built around a
  mistaken understanding of the UI.

Required work:

- Review `frontend/src/pages/codex/renderer.js`.
- Review `frontend/src/pages/codex/activity-summary.js`.
- Review `frontend/src/pages/codex/virtualizer.js`.
- Review `frontend/src/pages/codex/panel-shadow.css`.
- Review live-audit scripts for false-positive logic.
- Remove wrong code paths instead of masking them with patches.

### R18-A7. Full newest-to-oldest anchor sweep

Status: open

Problem:

- Passing one or two anchors is not enough.

Required work:

- Discover representative anchors across the whole long conversation.
- Compare newest-to-oldest at the same browser-visible locations.
- For every expandable row in view, compare collapsed and expanded states.
- Add every mismatch as a concrete R18 task before fixing it.

Completion rule:

- This is not complete until multiple Reset 18 live reports and human-visible
  screenshots show no mismatches for the full sweep.

### R18-A8. Deploy and user-visible verification loop

Status: open

Problem:

- The user must be able to open the online site and see the same current code
  that was tested.

Required work:

- Commit and push product fixes.
- Pull/build/restart on the server.
- Verify live asset currentness and service/agent state.
- Keep the work item open if the user reports a live mismatch.

## Operating Procedure

For each future fix:

1. Add or update the relevant R18 task before or alongside the fix.
2. Reproduce the failure in a real browser when possible.
3. Change product code or audit code only after the failure is concrete.
4. Run local checks for changed code.
5. Commit and push when the local change is ready.
6. Deploy to the server.
7. Prove live currentness.
8. Run same-anchor live browser comparison.
9. Keep the task open if there is any visible mismatch, click failure, scroll
   failure, console/page error, stale deployment, or unreviewed affected code.

## Immediate Next Action

Run Reset 18 currentness, then reproduce the user's live `已处理` click failure
and long-conversation scroll behavior before changing more UI code.
