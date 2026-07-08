# Codex Live Parity Worklist

Created: 2026-07-07 15:06:16 +08:00
Reset: 24
Status: active

This is the only active work file for Codex Web live conversation parity.

Reset 24 exists because earlier work produced false positives. Some work proved
that code was deployed, that assets were current, that target-only behavior
looked plausible, or that one local script passed, but it did not satisfy the
user's final acceptance standard. No visual parity, grouping parity,
expand/collapse parity, scrolling parity, or click behavior is accepted at Reset
24 start.

## Archive Boundary

Moved out of active work:

- `reference/legacy/20260707-false-positive-reset23-active-archive/`
- `reference/legacy/20260707-false-positive-reset23-active-archive/codex-live-parity-worklist.md`
- `reference/legacy/20260707-false-positive-reset23-active-archive/live-anchor-alignment/`
- `reference/legacy/20260707-false-positive-reset23-active-archive/live-currentness/`
- `reference/legacy/20260707-false-positive-reset23-active-archive/invalid-or-ambiguous-reports/`

Earlier archive directories remain clues only. They must not be cited as
acceptance proof:

- `reference/legacy/20260707-false-positive-reset20-active-archive/`
- `reference/legacy/20260707-false-positive-reset21-active-archive/`
- `reference/legacy/20260707-false-positive-reset22-active-archive/`
- all older or invalid Reset 23 reports.

Active Reset 24 evidence may be written only to:

- `reference/live-anchor-alignment/`
- `reference/live-currentness/`

Anything outside those active directories can explain a suspected bug, but it
cannot mark a task complete.

## Non-Negotiable Rules

- Do not invent a similar UI.
- Do not accept approximate visual matches.
- Do not mark work complete from memory.
- Do not mark work complete from source inspection alone.
- Do not mark work complete from target-only checks.
- Do not mark work complete from currentness checks.
- Do not mark work complete from local scripts alone.
- Do not mark work complete from a single anchor or a single screenshot.
- Do not hide, truncate, crop away, or drop long conversation content to avoid
  failures.
- Do not add overlays, drag surfaces, invisible masks, or pointer blockers over
  the conversation area.
- Do not treat a scrolling failure as a resize/drag issue unless browser
  hit-test evidence proves that.
- Do not keep target-only command transcript enhancements during the official
  parity pass.
- Do not keep wrong code behind compatibility patches.
- Do not weaken audit scripts to make reports pass.
- Do not call any task accepted until the online site is deployed and verified
  against the live code-server reference at matching text anchors.

## Required Verification Setup

- Target: `https://codex.zelt.cn/?nodeId=host-docker-agent`
- Reference: `https://code-tx.zelt.cn/?folder=/root`
- Viewport: `1920x1080` or larger.
- Reference UI: Codex extension opened from the left Activity Bar icon.
- Reference UI: right chat/sidebar closed.
- Test conversation: the long conversation beginning with the user's original
  `分析一下codex-web` request.
- Sweep direction: newest-to-oldest, because both products open near the latest
  turns.
- Anchor rule: reference and target must be compared at the same visible text
  anchor with enough surrounding context to prove both browsers are at the same
  conversation location.
- Short anchors such as `./build-all.sh` are insufficient unless nearby context
  proves the exact same location.

## Acceptance Gate

Every visual or interaction task remains open until the evidence package has:

- target deployed from the expected git commit;
- service status and agent/container status;
- browser asset version/currentness proof;
- browser console and page-error proof;
- same visible text anchor in reference and target;
- proof both browsers are at the same long-conversation location;
- reference and target screenshots before interaction;
- reference and target screenshots after each relevant expand/collapse click;
- real Playwright/CDP mouse or keyboard input, not synthetic state mutation;
- `elementFromPoint` or equivalent hit-test evidence proving the click lands on
  the intended control;
- DOM structure, classes, attributes, hierarchy, and row grouping for matched
  elements;
- computed styles for text, spacing, color, font, border radius, overflow,
  dimensions, icons, and buttons when visual parity is involved;
- expanded body text and DOM structure when the official reference expands;
- long-session upward-scroll evidence from latest turns;
- no overlay, drag surface, virtualizer spacer, or hidden element intercepting
  message clicks;
- local build/check evidence for changed code;
- commit, push, deploy, and online currentness proof after code changes;
- human-visible review showing no obvious mismatch.

If screenshots still visibly differ, the task remains open.

## Status Values

- `open`: known issue, no accepted proof.
- `in-progress`: being investigated or changed now.
- `needs-evidence`: code changed, but live same-anchor proof is missing.
- `blocked`: external state prevents proof or implementation.
- `currentness-only`: online freshness checked; no UI parity accepted.
- `done-admin`: housekeeping only; no UI parity accepted.
- `ready-for-user-review`: full evidence gate passed and the user can review
  the live site.

No Reset 24 visual task may use `ready-for-user-review` until the full gate is
recorded in this file.

## Quarantined Local Changes

The following local edits existed at Reset 24 start and are not accepted as
working fixes:

- `frontend/src/pages/codex/index.js`
- `frontend/src/pages/codex/renderer.js`
- `frontend/src/pages/codex/virtualizer.js`
- `scripts/audit-codex-live-anchor-alignment.cjs`
- `reference/codex-reference/grouping-rules-audit.json`
- `reference/codex-reference/grouping-rules-audit.md`

Before any of these changes are committed or deployed, they must be reviewed as
new work under Reset 24. If they were only attempts to make a false-positive
report pass, they must be rewritten or removed instead of preserved as patches.

## Active Tasks

### R24-A0. Rebuild active work tracking after false positives

Status: done-admin

Scope:

- Move Reset 23 active work and evidence out of active paths.
- Recreate active evidence directories for Reset 24.
- Create this file as the only active worklist.

Acceptance:

- Administrative only. This accepts no UI parity.

### R24-A1. Re-prove online currentness before any visual claim

Status: currentness-only

Problem:

- The user validates the online site, so local behavior and stale assets are not
  enough.

Required work:

- Verify local HEAD, remote HEAD, server HEAD, service status, agent/container
  status, asset versions, cache headers, console warnings, and page errors.
- Store Reset 24 evidence under `reference/live-currentness/`.

Boundary:

- This may only be recorded as `currentness-only`. It accepts no UI parity.

Reset 24 evidence:

- 2026-07-07 15:11 +08:00: local HEAD and `origin/main` are
  `5b9159ab894cbb06b21b07a17d90b2ee79b8a0e9`
  (`5b9159a Preserve Codex user attachments`).
- 2026-07-07 15:11 +08:00: server `/root/code/codex-web` HEAD is
  `5b9159ab894cbb06b21b07a17d90b2ee79b8a0e9` on branch `main`.
- 2026-07-07 15:11 +08:00: `codex-web.service` is `active`.
- 2026-07-07 15:11 +08:00: `codex-web-agent` container is online.
- Browser currentness evidence:
  `reference/live-currentness/20260707-071153/summary.json`
- Browser screenshot:
  `reference/live-currentness/20260707-071153/target.png`
- Runtime/script/css asset version: `20260707064410`.
- Browser console warnings/errors recorded by the currentness script: `0`.

This evidence proves only that the online target is current enough to inspect.
It accepts no visual parity.

### R24-A2. Fix and prove long-conversation scrolling and clickability

Status: open

User-reported problems:

- The long conversation cannot reliably scroll upward.
- Some views flicker or jump while scrolling.
- `已处理` rows cannot be clicked to expand on the live target.
- A previous page-wide drag-like surface appeared; that behavior must not exist.

Required work:

- Use the online target long conversation.
- Scroll newest-to-oldest with real browser input.
- Click `已处理` controls in both reference and target with real mouse input.
- Capture screenshots, scroll offsets, visible ranges, DOM hit-test data,
  `elementFromPoint`, console output, and page errors.
- Prove no overlay, drag layer, resize handle, virtualizer spacer, or hidden
  element intercepts message clicks.

### R24-A3. Match official processed-row grouping, placement, and collapse

Status: open

User-reported problems:

- `已处理 XXs` timing must appear in the same position as the official
  code-server Codex extension.
- Expand/collapse content and animation must follow the official behavior.
- Earlier checks did not prove real click behavior at the same text anchor.

Required work:

- Locate matching processed rows in reference and target by same nearby visible
  text anchors.
- Capture before/after screenshots and expanded body DOM.
- Inspect official extension DOM/source when the grouping rule is unclear.
- Remove target-only command transcript rows during the official parity pass.

### R24-A4. Match official file, diff, attachment, and action rows

Status: open

User-reported problems:

- Official renders file/code activity as structured rows or blocks, not plain
  conversation text.
- Official can show attachment rows such as `用户附件`.
- Official can show resource/action rows such as webpage preview, website, and
  open-method rows.

Required work:

- Capture official DOM, computed styles, icons, spacing, row hierarchy, labels,
  and collapse behavior for matching anchors.
- Identify whether each missing row is a renderer bug, data-capture/backend
  gap, or unsupported official derived UI.
- Do not fabricate attachment/resource rows when the target API lacks truthful
  backing data.
- Any derived row must be grounded in official source or live DOM evidence and
  documented here before implementation.

### R24-A5. Audit and remove wrong previous code

Status: in-progress

Problem:

- Earlier commits and local edits may contain false-positive fixes, target-only
  UI, or code copied from temporary experiments.

Required work:

- Review current frontend conversation renderer, virtualizer, audit scripts, and
  reference data.
- Identify code whose only purpose was to pass weak checks.
- Remove or rewrite it as clean product logic.
- Keep display behavior only when same-anchor reference evidence proves it.

Reset 24 notes:

- Removed quarantined Reset 23 local content changes from:
  `frontend/src/pages/codex/index.js`,
  `frontend/src/pages/codex/renderer.js`,
  `frontend/src/pages/codex/virtualizer.js`,
  `scripts/audit-codex-live-anchor-alignment.cjs`,
  `reference/codex-reference/grouping-rules-audit.json`, and
  `reference/codex-reference/grouping-rules-audit.md`.
- Those changes were not accepted because they adjusted a single-anchor focus
  offset, changed an audit helper to match that offset, changed generated
  report timestamps, or guessed attachment height without Reset 24 same-anchor
  evidence.
- After cleanup, product source content diffs are removed from the working
  tree. R24-A5 remains open because earlier committed code still needs a broader
  audit while fixing live parity.

### R24-A6. Final same-anchor sweep

Status: open

Required work:

- Use multiple anchors through the long conversation, newest-to-oldest.
- At each anchor compare reference and target screenshots, DOM, computed styles,
  grouping, collapse state, and interaction behavior.
- Expand official collapsible rows and verify target expanded rendering against
  the same anchor.
- Record failures as new tasks before fixing them.

Acceptance:

- Only after all major visible mismatches and interaction mismatches are gone
  can the status move to `ready-for-user-review`.

## Evidence Log

- 2026-07-07 15:11 +08:00: Reset 24 currentness baseline captured in
  `reference/live-currentness/20260707-071153/`. This accepts no UI parity.
- No Reset 24 visual parity evidence has been accepted yet.
