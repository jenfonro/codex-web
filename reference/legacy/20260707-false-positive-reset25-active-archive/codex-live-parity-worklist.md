# Codex Live Parity Worklist

Created: 2026-07-07 15:38:22 +08:00
Reset: 25
Status: active

This is the only active work file for Codex Web live conversation parity.

Reset 25 exists because previous work produced false positives. The archived
work may prove that a script ran, a target was deployed, assets were current, or
one anchor looked acceptable. It did not satisfy the user's final acceptance
standard. Reset 25 starts with no accepted visual parity, grouping parity,
expand/collapse parity, scrolling parity, clickability parity, or final browser
acceptance.

## Archive Boundary

Moved out of active work:

- `reference/legacy/20260707-false-positive-reset24-active-archive/`
- `reference/legacy/20260707-false-positive-reset24-active-archive/codex-live-parity-worklist.reset24.md`
- `reference/legacy/20260707-false-positive-reset24-active-archive/live-anchor-alignment/`
- `reference/legacy/20260707-false-positive-reset24-active-archive/live-currentness/`

Reset 24 evidence is archived as clue-only material. In particular, the
following are not accepted as UI proof:

- the Reset 24 currentness report;
- the one-anchor report that showed zero failures;
- short-anchor reports such as `./build-all.sh`;
- any report that did not compare the full same visible text anchor with enough
  surrounding context;
- any report that did not use real browser interaction for expandable rows;
- any report that did not prove scroll stability in the long conversation.

Earlier archive directories also remain clue-only:

- `reference/legacy/20260707-false-positive-reset20-active-archive/`
- `reference/legacy/20260707-false-positive-reset21-active-archive/`
- `reference/legacy/20260707-false-positive-reset22-active-archive/`
- `reference/legacy/20260707-false-positive-reset23-active-archive/`
- all older `reference/legacy/20260707-false-positive-*` records.

Active Reset 25 evidence may be written only to:

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
- User-reported live issues must be recorded in this file before or alongside
  fixes.
- A task cannot be accepted until the online site is deployed and verified
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
- When checking expandable rows, both reference and target must be clicked with
  real Playwright/CDP mouse input.

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
- commit, push, deploy, and online currentness proof after product changes;
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

No Reset 25 visual task may use `ready-for-user-review` until the full gate is
recorded in this file.

## Current Quarantine

The following uncommitted work must not be treated as accepted UI parity:

- `scripts/audit-codex-live-anchor-alignment.cjs`

The audit script may be kept only as infrastructure under review. Before any
report from it is trusted, it must pass syntax checks, positive controls, and
negative controls. It must reject ambiguous anchors instead of turning missing
or mismatched targets into passing checks.

Product code must not be changed merely to satisfy the audit script. Product
changes must be grounded in official extension source or live DOM evidence.

## Active Tasks

### R25-A0. Rebuild active work tracking after false positives

Status: done-admin

Scope:

- Move Reset 24 active work and evidence out of active paths.
- Recreate active evidence directories for Reset 25.
- Create this file as the only active worklist.

Acceptance:

- Administrative only. This accepts no UI parity.

### R25-A1. Re-prove online currentness before any visual claim

Status: currentness-only

Problem:

- The user validates the online site, so local behavior and stale assets are not
  enough.

Required work:

- Verify local HEAD, remote HEAD, server HEAD, service status, agent/container
  status, asset versions, cache headers, console warnings, and page errors.
- Store Reset 25 evidence under `reference/live-currentness/`.

Boundary:

- This may only be recorded as `currentness-only`. It accepts no UI parity.

Reset 25 evidence:

- 2026-07-07 15:42 +08:00: local HEAD and `origin/main` are
  `5b9159ab894cbb06b21b07a17d90b2ee79b8a0e9`
  (`5b9159a Preserve Codex user attachments`).
- 2026-07-07 15:42 +08:00: server `/root/code/codex-web` HEAD is
  `5b9159ab894cbb06b21b07a17d90b2ee79b8a0e9` on branch `main`.
- 2026-07-07 15:42 +08:00: `codex-web.service` is `active`.
- 2026-07-07 15:42 +08:00: `codex-web-agent` container is online.
- Browser currentness evidence:
  `reference/live-currentness/20260707-074214/summary.json`
- Browser screenshot:
  `reference/live-currentness/20260707-074214/target.png`
- Runtime/script/css asset version: `20260707064410`.
- Browser console warnings/errors recorded by the currentness script: `0`.
- 2026-07-07 16:10 +08:00: after deploying commit
  `20896cd07040642b97ba5eb8355bfa42bf6089f6`, browser currentness evidence was
  captured in `reference/live-currentness/20260707-081006/summary.json` with
  runtime/script/css asset version `20260707080951`, matching versions, zero
  console warnings/errors, and zero failed HTTP responses.

This evidence proves only that the online target is current enough to inspect.
It accepts no visual parity.

### R25-A2. Audit live-alignment tooling before trusting it

Status: done-admin

Problem:

- Earlier reports produced false positives or ambiguous acceptance.

Required work:

- Run syntax checks on the audit script.
- Run a negative control with an intentionally ambiguous short anchor and prove
  it fails as ambiguous.
- Run a positive control with a long unique anchor and prove the source and
  target are visually positioned at the same anchor.
- Do not use any audit result as UI acceptance until the script proves both
  controls.

Reset 25 notes:

- 2026-07-07 15:40 +08:00: `node --check
  scripts\audit-codex-live-anchor-alignment.cjs` passed. This is only a syntax
  check for quarantined tooling and accepts no UI parity.
- 2026-07-07 15:45 +08:00: negative control
  `reference/live-anchor-alignment/20260707-074350/summary.json` failed as
  expected for short anchor `./build-all.sh`; failure reason was
  `ambiguous short anchor: contextMatches=0/80`.
- 2026-07-07 15:47 +08:00: first positive-control attempt
  `reference/live-anchor-alignment/20260707-074602/summary.json` failed because
  a long Chinese sentence containing `/root/code/codex-web.tar` was classified
  as weak/file-like. This was a tool bug, not product evidence.
- 2026-07-07 15:49 +08:00: fixed `strongProseAnchor` so pure file/command
  anchors remain weak while long prose that happens to contain a path remains a
  prose anchor.
- 2026-07-07 15:50 +08:00: negative control
  `reference/live-anchor-alignment/20260707-075000/summary.json` still failed as
  expected for `./build-all.sh`; failure reason remained
  `ambiguous short anchor: contextMatches=0/80`.
- 2026-07-07 15:53 +08:00: positive control
  `reference/live-anchor-alignment/20260707-075134/summary.json` passed with
  `0 failed` for the long anchor beginning `我现在上传了/root/code/codex-web.tar`.
  Target API matched seq `7430`; context comparison was `score=0.400,
  matched=32/80`; anchor visual position was `sourceTop=492, targetTop=492,
  delta=0`.
- 2026-07-07 16:01 +08:00: after changing the script to avoid destroying a
  visible focused target, positive-control rerun
  `reference/live-anchor-alignment/20260707-080111/summary.json` failed on
  viewport position only: `sourceTop=491, targetTop=304, delta=187`. This means
  the script change did not create a false pass, but the tool needs new
  positive/negative controls after the `focusTop` product support is deployed.
- 2026-07-07 16:16 +08:00: fixed the audit script's own post-focus recentering
  to use the same desired `focusTop` instead of a hard-coded `clientHeight *
  0.24` offset.
- 2026-07-07 16:16 +08:00: current-script positive control
  `reference/live-anchor-alignment/20260707-081627/summary.json` passed with
  `0 failed`; target API matched seq `7430`, context comparison was
  `score=0.400, matched=32/80`, and anchor visual position was
  `sourceTop=491, targetTop=500, delta=9`.
- 2026-07-07 16:21 +08:00: current-script negative control
  `reference/live-anchor-alignment/20260707-082117/summary.json` failed as
  expected for `./build-all.sh` with `ambiguous short anchor:
  contextMatches=0/80`.

This validates the current audit tool for controlled same-anchor work. It
accepts no visual parity and does not complete any product-rendering task.

### R25-A3. Fix and prove long-conversation scrolling and clickability

Status: needs-evidence

User-reported problems:

- The long conversation cannot reliably scroll upward.
- Some views flicker or jump while scrolling.
- `已处理` rows cannot be clicked to expand on the live target.
- A previous page-wide drag-like surface appeared; that behavior must not
  exist.

Required work:

- Use the online target long conversation.
- Scroll newest-to-oldest with real browser input.
- Click `已处理` controls in both reference and target with real mouse input.
- Capture screenshots, scroll offsets, visible ranges, DOM hit-test data,
  `elementFromPoint`, console output, and page errors.
- Prove no overlay, drag layer, resize handle, virtualizer spacer, or hidden
  element intercepts message clicks.

Reset 25 notes:

- 2026-07-07 15:55 +08:00: target-only live interaction probe
  `reference/live-anchor-alignment/20260707-075508/summary.json` passed with
  `0 failed`, 18 real wheel steps, 14 rendered windows, real processed-row
  click toggles before and after scrolling, and no browser console/page errors.
  This is target-only clue evidence and accepts no same-anchor UI parity.
- 2026-07-07 15:57 +08:00: same-anchor probe
  `reference/live-anchor-alignment/20260707-075543/summary.json` failed because
  target API contained anchor seq `7265`, but the rendered target anchor was
  lost while the audit attempted to align viewport position. Focus evidence
  showed seq `7265` inside a very large virtual turn covering seqs `7105-7352`.
- 2026-07-07 16:04 +08:00: local product change added optional `focusTop` to
  `codex-web:open-session`, stores it in the focused thread window, and uses it
  to place an exact focused event at the requested viewport top when available.
  This is intended to make long-session focus deterministic for both audits and
  user-visible deep linking.
- 2026-07-07 16:07 +08:00: local checks passed:
  `node --check frontend\src\pages\codex\index.js`,
  `node --check frontend\src\pages\codex\renderer.js`,
  `node --check scripts\audit-codex-live-anchor-alignment.cjs`, and
  `C:\Program Files\Git\bin\bash.exe ./build-all.sh`.
- 2026-07-07 16:09 +08:00: committed and pushed
  `20896cd07040642b97ba5eb8355bfa42bf6089f6`
  (`Improve Codex live parity anchoring`), reset server
  `/root/code/codex-web` to `origin/main`, rebuilt with `./build-all.sh`, and
  restarted `codex-web.service`; service was active and `codex-web-agent`
  remained online.
- 2026-07-07 16:18 +08:00: same-anchor probe
  `reference/live-anchor-alignment/20260707-081820/summary.json` for
  `活动栏顺序已修。接着修 CSS 的 spinner 定位和水印定位。` still failed because the
  target rendered anchor was not found even though target API matched seq
  `7265`. This remains a locator/focus issue for a very large virtual turn, not
  accepted evidence about file activity visual parity.

This remains `needs-evidence` because deployment is complete but same-anchor
checks have not yet proven the long-conversation focus, scroll, and processed
row behavior across the required conversation span.

### R25-A4. Match official processed-row grouping, placement, and collapse

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

### R25-A5. Match official file, diff, attachment, and action rows

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

### R25-A6. Preserve long-session performance without content loss

Status: open

Problem:

- Opening the long conversation previously caused slow load or browser failure.
- The fix must not be truncation, hiding content, or dropping historical turns.

Required work:

- Use incremental/chunked loading and virtualization only where they preserve
  the full conversation.
- Prove scroll, anchor location, expand/collapse, and rendered content still
  work after optimization.

### R25-A7. Audit and remove wrong previous product code

Status: open

Problem:

- Earlier commits may contain approximate UI, target-only rows, code-server
  leftovers, compatibility patches, or temporary experiment code.

Required work:

- Review current frontend conversation renderer, virtualizer, styles, API
  adapters, and naming.
- Identify code whose only purpose was to pass weak checks.
- Remove or rewrite it as clean product logic.
- Keep display behavior only when same-anchor reference evidence proves it or
  when it is necessary product plumbing outside the official parity surface.

### R25-A8. Final same-anchor newest-to-oldest sweep

Status: open

Required work:

- Use multiple anchors through the long conversation, newest-to-oldest.
- At each anchor compare reference and target screenshots, DOM, computed
  styles, grouping, collapse state, and interaction behavior.
- Expand official collapsible rows and verify target expanded rendering against
  the same anchor.
- Record failures as new tasks before fixing them.

Acceptance:

- Only after all major visible mismatches and interaction mismatches are gone
  can the status move to `ready-for-user-review`.

### R25-A9. Deploy and live-review every product change

Status: open

Problem:

- Local fixes are not enough. The user validates the online site.

Required work:

- Commit and push product changes.
- Pull/reset/build/restart on the server.
- Verify service and agent status.
- Re-run Reset 25 currentness proof.
- Re-run same-anchor browser proof against the live target.

## Evidence Log

Reset 25 starts with no accepted UI evidence.

Active evidence directories:

- `reference/live-anchor-alignment/`
- `reference/live-currentness/`

Archived clue-only evidence:

- `reference/legacy/20260707-false-positive-reset24-active-archive/`
- `reference/legacy/20260707-false-positive-reset23-active-archive/`
- `reference/legacy/20260707-false-positive-reset22-active-archive/`
- `reference/legacy/20260707-false-positive-reset21-active-archive/`
- `reference/legacy/20260707-false-positive-reset20-active-archive/`
- all older `reference/legacy/20260707-false-positive-*` records.

New evidence must be appended here only after it is produced from the fixed
verification setup and saved under the active Reset 25 evidence directories.
