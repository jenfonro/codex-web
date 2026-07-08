# Codex Live Parity Worklist

Created: 2026-07-07 14:34:22 +08:00
Reset: 23
Status: active

This is the only active work file for Codex Web conversation-rendering parity.

Reset 23 starts because earlier work produced false positives: some reports
proved server currentness, target-only behavior, source-only observations, or
partial local behavior, but they did not meet the user's final acceptance
standard. No UI parity, grouping parity, collapse behavior, scrolling behavior,
or interaction behavior is accepted at Reset 23 start.

## Archive Boundary

Moved out of active work:

- `reference/legacy/20260707-false-positive-reset22-active-archive/`
- `reference/legacy/20260707-false-positive-reset22-active-archive/codex-live-parity-worklist.md`
- `reference/legacy/20260707-false-positive-reset22-active-archive/live-anchor-alignment/`
- `reference/legacy/20260707-false-positive-reset22-active-archive/live-currentness/`

Earlier archives remain clues only:

- `reference/legacy/20260707-false-positive-reset20-active-archive/`
- `reference/legacy/20260707-false-positive-reset21-active-archive/`
- all older `reference/legacy/20260707-false-positive-*` records.

Active Reset 23 evidence may be written only to:

- `reference/live-anchor-alignment/`
- `reference/live-currentness/`

Anything in an archive may explain a suspected bug, but it cannot be cited as
acceptance evidence.

## Hard Boundaries

- Do not invent a similar UI.
- Do not accept approximate visual matches.
- Do not mark work complete from memory.
- Do not mark work complete from source inspection alone.
- Do not mark work complete from local scripts alone.
- Do not mark work complete from target-only checks.
- Do not mark work complete from currentness checks.
- Do not mark work complete from a single screenshot or a single anchor.
- Do not hide, truncate, or drop long conversation content to avoid failures.
- Do not add overlays, drag surfaces, invisible masks, or pointer blockers over
  the conversation.
- Do not treat a scrolling failure as a resize or drag issue unless browser
  evidence proves it.
- Do not keep target-only command transcript rows during the official parity
  pass.
- Do not preserve wrong code with compatibility patches.
- Do not weaken audit rules to make reports pass.
- User-reported live issues must be added here before or alongside the fix.
- A task can move to accepted review only after the online site is deployed,
  current, and checked in a real browser against the reference.

## Fixed Verification Setup

- Target: `https://codex.zelt.cn/?nodeId=host-docker-agent`
- Reference: `https://code-tx.zelt.cn/?folder=/root`
- Viewport: `1920x1080` or larger.
- Reference UI: Codex extension opened from the left Activity Bar icon.
- Reference UI: right chat/sidebar closed.
- Test conversation: the long conversation containing the user's original
  `分析一下codex-web` request.
- Sweep direction: newest-to-oldest.
- Location rule: reference and target must be compared at the same visible text
  anchor, with enough surrounding context to prove both browsers are at the same
  conversation location.
- Short anchors such as `./build-all.sh` are not enough unless nearby context
  proves the location is identical in both browsers.

## Acceptance Gate

Every visual or interaction task remains open until the evidence package has:

- same visible text anchor in reference and target;
- proof both browsers are at the same long-conversation location;
- reference and target screenshots before interaction;
- reference and target screenshots after each relevant expand/collapse click;
- real Playwright/CDP mouse-click evidence, not synthetic state mutation;
- `elementFromPoint` evidence proving the click lands on the actual control;
- DOM structure, classes, attributes, and hierarchy for matched rows;
- computed styles for text, spacing, color, font, border radius, overflow,
  dimensions, icons, and buttons when visual parity is involved;
- expanded body text and structure when the official reference expands;
- long-session upward-scroll evidence from latest turns;
- browser console and page-error evidence;
- reference extension source or live DOM evidence when grouping rules are
  unclear;
- local build/check evidence for changed code;
- commit, push, deploy, service status, asset currentness, and agent-online
  proof after deployed code changes;
- human-visible review showing no obvious mismatch.

If screenshots still visibly differ, the task remains open.

## Status Values

- `open`: known issue, no accepted proof.
- `in-progress`: being investigated or changed now.
- `needs-evidence`: code or scripts changed, but live same-anchor proof is
  missing.
- `blocked`: external state prevents proof or implementation.
- `currentness-only`: online freshness has been checked; no UI parity accepted.
- `done-admin`: housekeeping only; no UI parity accepted.
- `ready-for-user-review`: full evidence gate has passed and the user can
  review the live site.

No Reset 23 visual task may use `ready-for-user-review` until the full gate is
present in this file.

## Unverified Local Code

The following local product edits existed when Reset 23 started:

- `agent/internal/session/history.go`
- `agent/internal/session/history_test.go`

Current intent of those edits: preserve user image attachments from Codex
history events. They are not accepted. Before they can be committed, they must
pass focused tests, full relevant tests, deployment, currentness proof, and a
same-anchor browser comparison against the official reference.

Reset 23 local evidence:

- `go test ./internal/session` passed from `agent/` on 2026-07-07 14:41 +08:00.
- `go test ./...` passed from `agent/` on 2026-07-07 14:48 +08:00.
- `./build-all.sh` passed from the repository root through Git Bash on
  2026-07-07 14:49 +08:00.
- `./test-go.sh` passed from the repository root through Git Bash on
  2026-07-07 14:50 +08:00.
- Remote read-only inspection of the long-session JSONL found `data:image`
  entries in the target Codex history. The oversized raw base64 line was not
  saved as evidence and is not acceptance proof.
- This proves only that the parser change has a plausible data source and a
  focused unit test. It does not prove browser rendering, official visual
  parity, deployment, or same-anchor acceptance.

## Active Tasks

### R23-A0. Archive Reset 22 false-positive work

Status: done-admin

Scope:

- Move Reset 22 active workfile and evidence out of active evidence paths.
- Recreate active evidence directories for Reset 23.
- Rebuild this file as the only active worklist.

Acceptance:

- Administrative only. This accepts no UI parity.

### R23-A1. Re-prove online currentness after any product change

Status: open

Problem:

- The user validates the online site, so local state is not enough.

Required work:

- Verify local HEAD, remote HEAD, server HEAD, service status, agent/container
  status, browser asset versions, cache headers, console warnings, and page
  errors.
- Store Reset 23 evidence under `reference/live-currentness/`.

Boundary:

- This may only be recorded as `currentness-only`. It accepts no UI parity.

### R23-A2. Fix and prove long-conversation scrolling and clickability

Status: open

Problem:

- The long conversation can fail or flicker while scrolling upward.
- The user reported that `已处理` rows cannot be clicked to expand.
- The user reported a previous page-wide drag-like surface; if any overlay or
  hit-test blocker remains, it must be removed.

Required work:

- Use the online target long conversation.
- Scroll newest-to-oldest with real browser input.
- Use real clicks on processed rows in both browsers.
- Capture screenshots, `elementFromPoint`, scroll offsets, visible range, DOM
  hit-test data, console output, and page errors.
- Prove no overlay, drag layer, resize handle, virtualizer spacer, or hidden
  element intercepts message clicks.

### R23-A3. Match official processed-row grouping, placement, and collapse

Status: open

Problem:

- `已处理 XXs` timing must appear at the same position as the official
  code-server Codex extension.
- Expand/collapse content and animation must follow the official behavior.
- Earlier checks did not prove real click behavior at the same visible anchor.

Required work:

- Locate matching processed rows in reference and target by same nearby text
  anchors.
- Capture before/after screenshots and expanded body DOM.
- Inspect official DOM/source when the grouping rule is unclear.
- Remove target-only command transcript rows during this official parity pass.

### R23-A4. Match official file, diff, attachment, and action rows

Status: needs-evidence

Problem:

- Official renders file/code activity as structured rows or blocks, not plain
  conversation text.
- Official can show attachment rows such as `用户附件`.
- Official can show action/resource rows such as `网页预览`, `网站`, and
  `打开方式`.

Required work:

- Capture official DOM, computed styles, icons, spacing, row hierarchy, labels,
  and collapse behavior for matching anchors.
- Identify whether each missing row is a renderer bug, data-capture/backend
  gap, or unsupported official derived UI.
- Do not fabricate attachment/resource rows when the target API lacks truthful
  backing data.
- Any derived row must be explicitly grounded in official source or live DOM
  evidence and documented here before implementation.

Archived clues to re-check:

- A user image attachment existed in raw Codex history for an earlier user turn,
  but target rendering did not show the official attachment row.
- `网页预览 / 网站 / 打开方式` appeared in the official reference while the target
  had no matching structured row.
- Some code/file changes appeared as structured activity in the official
  reference while target rendered plain text.

Reset 23 local evidence:

- A local parser change now preserves `event_msg.user_message.images` and
  `local_images` as `event.data.attachments`.
- `frontend/src/pages/codex/renderer.js` already reads
  `event.data.attachments` in `renderUserAttachments`.
- Focused test coverage exists in
  `agent/internal/session/history_test.go::TestParseHistoryFilePreservesUserImageAttachments`.
- `go test ./internal/session` passed from `agent/`.
- `go test ./...` passed from `agent/`.
- `./build-all.sh` passed from the repository root through Git Bash.
- `./test-go.sh` passed from the repository root through Git Bash.

Remaining evidence before acceptance:

- deployed target with current assets;
- target API proof that the affected same-anchor user event exposes
  `data.attachments`;
- same-anchor browser screenshots proving the target attachment row matches the
  official reference;
- no broad fabrication of `网页预览 / 网站 / 打开方式` rows without official source
  or live DOM grounding.

Reset 23 live evidence after deploy:

- Commit `5b9159a` was pushed and deployed to the server.
- `codex-web.service` was active after rebuild/restart.
- `codex-web-agent` Docker container was rebuilt and restarted from the updated
  agent image; before this, the container was still running the old parser.
- Currentness report:
  `reference/live-currentness/20260707-064419/summary.json`
  - script/css/runtime version: `20260707064410`
  - console warnings/errors: `0`
- Target API proof after agent restart:
  - long session `019f0a04-7f0b-7483-8bc4-18f214a5c8f1`
  - seq `7427`, kind `user_message`, text `哪里`
  - one `用户附件` attachment
  - `src` prefix `data:image/png;base64,`
  - `src` length `58522`
- Same-anchor report:
  `reference/live-anchor-alignment/20260707-065309/summary.json`
  - anchor: `我现在上传了/root/code/codex-web.tar...`
  - failed checks: `1`
  - source viewport shows two `用户附件` rows while target current viewport does
    not.
  - report JSON confirms `target.turns.1.html` contains the `用户附件` data URL,
    so the remaining mismatch is focus/scroll context, not missing backend data
    or missing attachment DOM.

New required fix:

- Adjust focused-session scroll restoration and target anchor audit focus offset
  so same-anchor target screenshots preserve the same preceding context as the
  official reference.
- Add attachment-aware virtual height estimation so long-session virtualization
  does not position focused turns using a too-small user-message estimate.

### R23-A5. Audit and remove wrong previous parity code

Status: open

Problem:

- Earlier implementation attempts may contain approximate UI, custom wrappers,
  compatibility patches, target-only command rows, audit shortcuts, or naming
  copied from code-server where it no longer fits this product.

Required work:

- Review conversation renderer, grouping rules, activity summary, virtualizer,
  panel styles, scripts, and live audit helpers.
- Keep only behavior supported by official DOM/source evidence or product
  architecture.
- Replace patchy fixes with clear product behavior.

### R23-A6. Preserve long-session performance without content loss

Status: open

Problem:

- Opening the long conversation previously caused slow load or browser failure.
- The fix must not be truncation, hiding content, or dropping historical turns.

Required work:

- Use incremental/chunked loading and virtualization only where they preserve
  the full conversation.
- Prove scroll, anchor location, expand/collapse, and rendered content still
  work after optimization.

### R23-A7. Full same-anchor newest-to-oldest sweep

Status: open

Problem:

- Partial anchor checks missed obvious mismatches.

Required work:

- Start at the newest visible turns in the long conversation.
- Move upward using same visible text anchors.
- At each anchor, compare reference and target screenshots, DOM, computed
  styles, real click behavior, and scroll stability.
- If a mismatch is found, add a concrete task to this file before fixing it.
- Continue until the reviewed long-conversation span has been compared, not
  just one successful area.

### R23-A8. Deploy and live-review every product change

Status: open

Problem:

- Local fixes are not enough. The user validates the online site.

Required work:

- Commit and push product changes.
- Pull/reset/build/restart on the server.
- Verify service and agent status.
- Re-run Reset 23 currentness proof.
- Re-run same-anchor browser proof against the live target.

## Evidence Log

Reset 23 starts with no active UI evidence.

Active evidence directories:

- `reference/live-anchor-alignment/`
- `reference/live-currentness/`

Archived clue-only evidence:

- `reference/legacy/20260707-false-positive-reset22-active-archive/`
- `reference/legacy/20260707-false-positive-reset21-active-archive/`
- `reference/legacy/20260707-false-positive-reset20-active-archive/`
- all older `reference/legacy/20260707-false-positive-*` records.

New evidence must be appended here only after it is produced from the fixed
verification setup and saved under the active Reset 23 evidence directories.
