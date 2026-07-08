# Codex Live Parity Worklist

Created: 2026-07-07 +08:00
Reset: 14
Status: active

This is the only active work file for Codex Web conversation parity.

Reset 14 exists because previous work produced false positives: code was
implemented and scripts were run, but the deployed target had not passed the
user's final browser-visible acceptance standard. From this reset, no UI parity
item is accepted unless it is proven on the live site with the same text anchor
against the official code-server Codex extension.

## Active Scope

- Target: `https://codex.zelt.cn/`
- Reference: `https://code-tx.zelt.cn/?folder=/root`
- Reference setup: Codex extension opened from the left Activity Bar icon.
- Reference setup: right chat/sidebar closed.
- Viewport: `1920x1080` or larger unless testing a responsive issue.
- Test conversation: the long conversation containing `分析一下codex-web`.
- Comparison direction: newest-to-oldest.
- Location rule: compare the same browser-visible text anchor in both products.
- Deployment rule: local success is not enough; the target must serve the new
  assets and the agent must expose the new data.

## Archive Boundary

Moved out of active work:

- `reference/legacy/20260707-false-positive-reset13-active-archive/codex-live-parity-worklist.md`
- `reference/legacy/20260707-false-positive-reset13-active-archive/live-anchor-alignment/`
- `reference/legacy/20260707-false-positive-reset13-active-archive/live-currentness/`

Older archived resets remain historical clues only:

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
- `reference/legacy/20260707-false-positive-reset12-active-archive/`
- `reference/legacy/20260707-false-positive-workfiles/`
- `reference/legacy/20260707-live-parity-reset2/`

Archived reports cannot close Reset 14 work, even if they contain screenshots,
green checks, or `0 failed`.

## Status Meaning

- `open`: known problem, no verified fix.
- `investigating`: evidence collection or source audit is active.
- `implemented`: code was changed locally, but live parity is not accepted.
- `deployed`: target was updated, but visual parity is not accepted.
- `candidate`: deployed target has new evidence and is ready for human-visible
  review.
- `accepted`: deployed target passed the full evidence gate. No UI item starts
  as accepted in Reset 14.

## Hard Rules

- Do not invent a similar UI.
- Do not mark anything complete from memory.
- Do not mark anything complete from source inspection alone.
- Do not mark anything complete from screenshots alone.
- Do not mark anything complete from green scripts alone.
- Do not reuse archived evidence as acceptance evidence.
- Do not keep first-pass custom command enhancements in the parity view.
- Do not show `exec_command xN`, `write_stdin`, `Chunk ID`, shell transcript
  rows, or custom command rows while matching the official extension.
- Do not add overlays, drag surfaces, invisible masks, or pointer blockers over
  the conversation.
- Do not treat long-session scroll failure as a drag/resizer problem.
- Do not fix long-session performance by truncating history, hiding rows, or
  losing old content.
- Do not accept repeated short anchors such as `./build-all.sh` unless nearby
  context proves reference and target are at the same conversation location.
- Do not hide wrong earlier code with compatibility patches. Remove or rewrite
  wrong code.
- If the user reports a live issue while work is running, add it to this file
  before or alongside the fix.

## Per-Item Boundary Checklist

Every work item must answer these before it can move beyond `implemented`:

- What exact official source, live DOM, or reference screenshot proves the
  desired behavior?
- Which same visible text anchor was used in reference and target?
- Did a real mouse click hit the actual control according to `elementFromPoint`?
- Did screenshots show the before and after state for every expandable row?
- Did DOM/classes/computed styles match at the meaningful element level?
- Did the long conversation scroll normally upward from latest turns?
- Was the deployed target current, not a cached old bundle?
- Was the agent/container data current when session history data changed?
- Was the result reviewed visually instead of accepted by script output?

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

## Current Baseline

- Local HEAD observed at reset: `fcd88c7 Harden live parity anchors and preserve file diffs`
- Server currentness: pending recheck under Reset 14.
- Agent online/current data: pending recheck under Reset 14.
- Active evidence directories were recreated empty:
  - `reference/live-anchor-alignment/`
  - `reference/live-currentness/`

This baseline is not parity acceptance. It only records where Reset 14 starts.

## Open Work

### R14-F0. Rebuild trustworthy work tracking

Status: implemented

Problem:

- Reset 13 mixed useful notes with stale deployment statements and non-accepted
  implemented work.
- Active evidence could be mistaken for acceptance evidence.

Implemented:

- Moved Reset 13 active work and evidence to
  `reference/legacy/20260707-false-positive-reset13-active-archive/`.
- Recreated active evidence directories as empty Reset 14 targets.
- Rebuilt this file as the only active work source.

Not accepted:

- This is an administrative reset only. It accepts no UI parity item.

### R14-F1. Live currentness and agent freshness

Status: candidate

Problem:

- The target must be proven to serve the current bundle before any visual issue
  is judged.
- Agent/session data changes require agent rebuild/restart and API freshness
  proof.

Required work:

- Verify `https://codex.zelt.cn/` is serving the latest frontend asset version.
- Verify server HEAD and service status.
- Verify `host-docker-agent` is online.
- Verify session event API exposes any newly required fields before judging
  renderer behavior.

Acceptance:

- Reset 14 currentness report exists in `reference/live-currentness/`.
- Work log records server commit, service state, agent state, and asset version.

### R14-F2. Long conversation scroll and click stability

Status: implemented

Problem:

- The long conversation can fail to scroll normally.
- The page previously behaved like the conversation area could be dragged.
- Processed/file disclosures could not reliably be clicked and expanded.
- The user clarified this is a scroll/click problem, not a drag problem.

Required work:

- Audit overlays, drag handlers, pointer-events, virtualizer spacers, masks, and
  scroll containers.
- Remove or rewrite code that blocks native scroll/click behavior.
- Verify real upward scrolling newest-to-oldest.
- Verify expandable controls using real mouse input and `elementFromPoint`.

Acceptance:

- At least five newest-to-oldest anchors prove normal upward scroll.
- Every visible disclosure in those anchor windows opens by real click.
- Hit testing lands on the real disclosure control, not an overlay or spacer.

### R14-F3. Processed disclosure grouping and duration placement

Status: open

Problem:

- `已处理 XXs` placement, collapsed text, expanded text, and row grouping are
  not accepted.
- Some finished turns can keep stale `正在思考` state until navigation.
- First-pass parity must remove custom command summaries.

Required work:

- Compare official processed rows at identical visible anchors.
- Match collapsed label, duration placement, icon, indentation, expanded body,
  and row ordering.
- Remove command transcript enhancements from parity rendering.
- Ensure finished turns clear transient thinking/running UI without navigation.

Acceptance:

- Same-anchor before/after screenshots match the official extension.
- Real clicks expand/collapse the same rows in both products.
- Finished turns do not show stale transient state.

### R14-F4. File and diff activity rows

Status: implemented

Problem:

- Official extension groups file and diff activity into structured file rows and
  diff blocks.
- Target previously rendered some file/code activity as normal assistant text or
  incomplete file headers.
- Right-side diff viewer can wait; the visible conversation row must match first.

Required work:

- Inspect official extension DOM/source for file-change grouping rules.
- Inspect target session events for file-change records and preserved diff data.
- Render file names, icons, add/delete counts, row spacing, wrapping, collapsed
  shell, and expanded content like the reference.
- Remove command transcript rows during first-pass parity.

Acceptance:

- Same-anchor file-change blocks match before and after expansion.
- Code/file text is not dumped as plain assistant text when reference uses file
  rows.
- Show-more/collapse behavior matches the official visible order.

### R14-F5. Running and finished state parity

Status: open

Problem:

- Session list and detail state can diverge.
- Running/finished visual state can remain stale.
- Official extension shows a spinner/running state and removes transient
  thinking rows when complete.

Required work:

- Keep list and detail views subscribed to live session state.
- Match official running spinner behavior.
- Remove stale thinking rows when a turn finishes.

Acceptance:

- One running turn and one finished turn match reference behavior.
- List and detail converge without manual refresh.

### R14-F6. Wrong earlier code cleanup audit

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

### R14-F7. Anchor audit exact visible target selection

Status: implemented

Problem:

- Reset 14 report `reference/live-anchor-alignment/20260707-011840/summary.json`
  still selected the whole turn container as the anchor target because the turn
  contained the anchor text and was in the viewport.
- The exact anchor elements were present but `inViewport:false`, so screenshots
  compared different visible positions inside the same long turn.
- This made `启动脚本已放好` appear comparable while the reference viewport showed
  `已编辑 1 个文件` and the target viewport showed `已创建 2 个文件`.

Implemented locally:

- `scripts/audit-codex-live-anchor-alignment.cjs` now sorts anchor candidates by
  exact match, then shorter text, then smaller area, then viewport state.
- The script should now scroll the smallest exact anchor element into view
  instead of accepting a parent turn container.

Acceptance:

- A new live anchor report must show the exact anchor target in viewport on both
  source and target screenshots before any UI parity item can use that anchor.

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

Each anchor needs a Reset 14 evidence note before it can be considered covered.

## Evidence Directories

Active Reset 14 evidence goes here only:

- `reference/live-anchor-alignment/`
- `reference/live-currentness/`

Each evidence run must have its own timestamped directory and a short note in
the progress log below.

## Progress Log

### 2026-07-07 Reset 14 rebuild

Status: active baseline

Done:

- Archived Reset 13 active work file and active evidence directories.
- Recreated active evidence directories.
- Rebuilt this work file with stricter status meanings and acceptance gates.

Not accepted:

- No UI parity item is accepted.
- Old screenshots, script reports, and partial DOM captures are clues only.

Next:

- Run live currentness verification.
- Audit scroll/click behavior before any more visual grouping changes.
- Add every user-reported live issue here before fixing or closing it.

### 2026-07-07 Reset 14 currentness and first anchor audit

Status: investigating

Currentness evidence:

- Server command reported HEAD `fcd88c7`, `codex-web.service` active, and
  `codex-web-agent codex-web-agent:local Up`.
- `GET https://codex.zelt.cn/api/nodes` showed `host-docker-agent` online.
- Browser currentness report:
  `reference/live-currentness/20260707-010734/summary.json`
- Browser-loaded asset version: `20260707010050` for JS, CSS, and runtime.
- Session API check for `seq=6998` confirmed `file_change.data.files[0]`
  contains `unifiedDiff`.

Anchor evidence:

- Live anchor report:
  `reference/live-anchor-alignment/20260707-010824/summary.json`
- Result: `33 checks, 5 failed`.
- Anchor 1 `启动脚本已放好` was found in both browsers at a comparable
  location.
- Anchor 2 `start.sh +5 -5` was not comparable; it remains evidence of a
  location mismatch, not proof of parity.

Observed failures:

- Official reference shows file activity details expanded in the anchor window;
  target keeps file activity collapsed unless focus seq hits the file event.
- Official reference has the file show-more group expanded as `收起文件`; target
  keeps it collapsed as `再显示 1 个文件`.
- Target expands large created-file content into the page without an internal
  vertical limit, which can inflate long conversations and destabilize scroll.
- Target virtualizer height estimates treat completed `file_change` rows like
  short activity rows, so spacer math is too weak for long file/diff turns.

Planned fix:

- Remove the wrong file-activity default-collapse assumption.
- Default file-change rows and file show-more groups to expanded, while still
  allowing user toggles to override through `state.disclosures`.
- Give inline file diff/content blocks an internal vertical scroll limit instead
  of letting long files stretch the full conversation.
- Include file-change height in virtualizer estimates.

Implemented locally:

- `frontend/src/pages/codex/renderer.js` removes the wrong default-collapse
  behavior for file-change activity rows and file show-more groups.
- `frontend/src/pages/codex/panel-shadow.css` gives inline diff/content blocks
  internal vertical scrolling with a live-reference-derived `267px` max height.
- `frontend/src/pages/codex/virtualizer.js` includes summary/detail
  `file_change` events in turn-height estimates and estimates file rows from
  their diff/content line counts.

Local checks:

- `node --check frontend/src/pages/codex/renderer.js`: passed.
- `node --check frontend/src/pages/codex/virtualizer.js`: passed.
- `node --check scripts/audit-codex-live-anchor-alignment.cjs`: passed.
- `C:\Program Files\Git\bin\bash.exe ./frontend/build.sh`: passed.
- `C:\Program Files\Git\bin\bash.exe ./build-all.sh`: passed.
- `C:\Program Files\Git\bin\bash.exe ./test-go.sh`: passed.
- Deployed to server commit `c2101a8`.
- Browser currentness report after deploy:
  `reference/live-currentness/20260707-011806/summary.json`
- Live anchor rerun after deploy:
  `reference/live-anchor-alignment/20260707-011840/summary.json`
- Result after deploy: `33 checks, 4 failed`.

Follow-up finding:

- The report still selected parent turn containers as anchor targets; the exact
  anchor elements were out of viewport. The remaining file-label failures from
  this run cannot be accepted as product evidence until R14-F7 is verified.

Not accepted:

- No UI item is accepted until the fix is committed, pushed, deployed, and
  rerun against the same live anchors with screenshots and real click evidence.
