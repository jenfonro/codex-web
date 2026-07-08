# Codex Live Parity Worklist

Created: 2026-07-07 16:27:56 +08:00
Reset: 26
Status: active

This is the only active work file for Codex Web live conversation parity.

Reset 26 exists because earlier work produced false positives. Previous reports
may still be useful as clues, but they do not prove that the live UI matches the
official code-server Codex extension. Reset 26 starts with no accepted UI
parity, no accepted grouping parity, no accepted expand/collapse parity, no
accepted scroll/click parity, and no final browser acceptance.

## Archive Boundary

Moved out of active work:

- `reference/legacy/20260707-false-positive-reset25-active-archive/`
- `reference/legacy/20260707-false-positive-reset25-active-archive/codex-live-parity-worklist.md`
- `reference/legacy/20260707-false-positive-reset25-active-archive/live-anchor-alignment/`
- `reference/legacy/20260707-false-positive-reset25-active-archive/live-currentness/`

All Reset 25 evidence is clue-only. In particular, the following are not
accepted as UI proof:

- currentness reports;
- audit script positive controls;
- audit script negative controls;
- target-only click or scroll checks;
- one-anchor reports;
- short-anchor reports such as `./build-all.sh`;
- reports where the target API found a sequence but the rendered anchor was not
  proven visible;
- screenshots that were not aligned to the same visible text anchor;
- checks that did not use real browser mouse or keyboard input for collapsible
  rows.

Older archive directories also remain clue-only:

- `reference/legacy/20260707-false-positive-reset24-active-archive/`
- `reference/legacy/20260707-false-positive-reset23-active-archive/`
- `reference/legacy/20260707-false-positive-reset22-active-archive/`
- `reference/legacy/20260707-false-positive-reset21-active-archive/`
- `reference/legacy/20260707-false-positive-reset20-active-archive/`
- all older `reference/legacy/20260707-false-positive-*` records.

Active Reset 26 evidence may be written only to:

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
- Do not treat a scrolling failure as a resize or drag issue unless browser
  hit-test evidence proves that.
- Do not keep target-only command transcript enhancements during the official
  parity pass.
- Do not keep wrong code behind compatibility patches.
- Do not weaken audit scripts to make reports pass.
- Do not mark a task done until the online site is deployed and verified
  against the live code-server reference at matching text anchors.
- User-reported live issues must be added to this file before or alongside the
  fix.
- Every completed item must name the evidence directory that proves it.

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
- Expandable rows must be clicked in both reference and target with real
  Playwright/CDP mouse input.
- If the reference source code is needed, inspect the code-server Codex
  extension source on the server in read-only mode.
- The reference code-server site must not be modified except for temporary UI
  placement needed to expose the Codex extension in the left Activity Bar.

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

No Reset 26 visual task may use `ready-for-user-review` until the full gate is
recorded in this file.

## Active Tasks

### R26-A0. Rebuild active work tracking after false positives

Status: done-admin

Scope:

- Move Reset 25 active work and evidence out of active paths.
- Recreate active evidence directories for Reset 26.
- Create this file as the only active worklist.

Acceptance:

- Administrative only. This accepts no UI parity.

Evidence:

- Reset 25 active files were moved to
  `reference/legacy/20260707-false-positive-reset25-active-archive/`.
- Fresh active directories were recreated:
  `reference/live-anchor-alignment/` and `reference/live-currentness/`.

### R26-A1. Re-prove online currentness from the live target

Status: currentness-only

Problem:

- The user validates the online site. Local behavior and stale assets are not
  enough.

Required work:

- Verify local HEAD, remote HEAD, server HEAD, service status, agent/container
  status, asset versions, cache headers, console warnings, page errors, and
  failed HTTP responses.
- Store Reset 26 evidence under `reference/live-currentness/`.

Boundary:

- This can only become `currentness-only`. It accepts no UI parity.

Reset 26 evidence:

- 2026-07-07 16:30 +08:00: local HEAD is
  `7cc72b79a1372682dcb08b605de243c29ef2122f` on branch `main`.
- 2026-07-07 16:30 +08:00: `origin/main` is
  `7cc72b79a1372682dcb08b605de243c29ef2122f`.
- 2026-07-07 16:30 +08:00: server `/root/code/codex-web` HEAD is
  `7cc72b79a1372682dcb08b605de243c29ef2122f` on branch `main`.
- 2026-07-07 16:30 +08:00: `codex-web.service` is `active`.
- 2026-07-07 16:31 +08:00: `codex-web-agent` container is online.
- Browser currentness evidence:
  `reference/live-currentness/20260707-083224/summary.json`
- Browser screenshot:
  `reference/live-currentness/20260707-083224/target.png`
- Runtime/script/css asset version: `20260707080951`.
- Script/CSS/runtime versions match.
- Browser console warnings/errors recorded by the currentness script: `0`.
- Browser page errors: `0`.
- Failed HTTP responses recorded by CDP: `0`.

This evidence proves only that the online target is current enough to inspect.
It accepts no visual parity.

### R26-A2. Re-audit live alignment tooling without accepting UI parity

Status: done-admin

Problem:

- Earlier tooling created false confidence.

Required work:

- Verify the audit script rejects ambiguous anchors.
- Verify a long unique prose anchor can align source and target without losing
  the rendered target anchor.
- Record when a target API sequence is found but the rendered anchor is not
  visible.
- Do not use tool controls as product acceptance.

Reset 26 evidence:

- 2026-07-07 16:32 +08:00: `node --check
  scripts\audit-live-currentness.cjs` passed.
- 2026-07-07 16:33 +08:00: `node --check
  scripts\audit-codex-live-anchor-alignment.cjs` passed.
- 2026-07-07 16:35 +08:00: negative control
  `reference/live-anchor-alignment/20260707-083333/summary.json` failed as
  expected for short anchor `./build-all.sh`; failure count was `2`; target API
  was readable with `7654` events, but the anchor was rejected as
  `ambiguous short anchor: contextMatches=0/80`.
- 2026-07-07 16:37 +08:00: positive control
  `reference/live-anchor-alignment/20260707-083541/summary.json` passed with
  `0 failed` for the long anchor beginning
  `我现在上传了/root/code/codex-web.tar`; target API matched seq `7430`, and
  both source and target rendered the anchor.
- 2026-07-07 16:41 +08:00: problem-anchor run
  `reference/live-anchor-alignment/20260707-083953/summary.json` failed with
  `anchor not found in rendered scroll pass` for
  `活动栏顺序已修。接着修 CSS 的 spinner 定位和水印定位。`; target API matched
  seq `7265`, and the captured screenshot visibly showed the anchor. This was
  identified as an audit-script false negative caused by searching only the
  front part of an extremely large virtual turn.
- 2026-07-07 16:44 +08:00: updated
  `scripts\audit-codex-live-anchor-alignment.cjs` so target checks with a
  known seq search exact `[data-codex-event-seq]` and
  `[data-codex-event-seqs~]` nodes before falling back to the containing
  virtual turn.
- 2026-07-07 16:45 +08:00: after the audit-script fix, negative control
  `reference/live-anchor-alignment/20260707-084513/summary.json` still failed
  as expected for `./build-all.sh` with `2 failed` and
  `ambiguous short anchor: contextMatches=0/80`.
- 2026-07-07 16:48 +08:00: after the audit-script fix, positive control
  `reference/live-anchor-alignment/20260707-084655/summary.json` passed with
  `0 failed`; target API matched seq `7430`, and both source and target
  rendered the anchor.
- 2026-07-07 16:52 +08:00: human review of
  `reference/live-anchor-alignment/20260707-084840/` found another audit
  false-positive risk: the report had `0 failed`, but the matched context check
  showed `score=0.000, matched=0/80`. The screenshots had the same anchor
  visible but not enough surrounding context agreement for user acceptance.
- 2026-07-07 16:53 +08:00: updated
  `scripts\audit-codex-live-anchor-alignment.cjs` so a target API-backed prose
  anchor no longer bypasses context matching. A check now requires both sides
  to contain the anchor and also satisfy `score >= 0.18` or at least 8 matched
  stable n-grams.
- 2026-07-07 16:54 +08:00: after the stricter context rule, positive control
  `reference/live-anchor-alignment/20260707-085316/summary.json` still passed
  with `0 failed`.
- 2026-07-07 16:56 +08:00: after the stricter context rule, the seq `7265`
  probe `reference/live-anchor-alignment/20260707-085457/summary.json` failed
  as expected on `source/target matched context is comparable` with
  `score=0.000, matched=0/80`. This is not product UI evidence; it is evidence
  that this anchor is not acceptable for parity comparison until stronger
  surrounding context is collected or a better anchor is chosen.
- 2026-07-07 16:59 +08:00: final negative control
  `reference/live-anchor-alignment/20260707-085810/summary.json` still failed
  as expected for `./build-all.sh` with `2 failed`.

This validates the current audit tool for controlled same-anchor work. It
accepts no UI parity and does not complete any product-rendering task.

### R26-A3. Prove long-conversation scroll and clickability

Status: in-progress

User-reported problems:

- The long conversation cannot reliably scroll upward.
- Some views flicker or jump while scrolling.
- `已处理` rows cannot reliably be clicked to expand on the live target.
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

Reset 26 notes:

- 2026-07-07 16:39 +08:00: target-only live interaction probe
  `reference/live-anchor-alignment/20260707-083924/summary.json` passed with
  `0 failed`, 18 real wheel steps, 13 rendered windows, real processed-row
  click checks before and after scrolling, no visible Codex Web-only command
  transcript rows, and no browser console/page errors. This is target-only clue
  evidence and accepts no same-anchor UI parity.
- 2026-07-07 16:49 +08:00: same-anchor probe
  `reference/live-anchor-alignment/20260707-084840/summary.json` initially
  reported `0 failed` for
  `活动栏顺序已修。接着修 CSS 的 spinner 定位和水印定位。`, but it was later
  rejected because the context comparison had `score=0.000, matched=0/80`.
  This report is clue-only and cannot prove R26-A3.
- 2026-07-07 16:56 +08:00: stricter rerun
  `reference/live-anchor-alignment/20260707-085457/summary.json` correctly
  failed the same seq `7265` anchor on context comparability. This prevents the
  earlier false-positive acceptance, but does not yet prove the desired
  scroll/click parity.

This remains `in-progress`. One same-anchor pass plus one target-only scroll
probe does not prove the full newest-to-oldest long-conversation sweep.

### R26-A4. Discover official grouping and collapse rules

Status: in-progress

Problem:

- The target renderer must follow the official Codex extension's grouping,
  placement, and collapse rules instead of guessed rules.

Required work:

- Inspect the official extension source when available.
- Capture live reference DOM for processed rows, file rows, diff rows,
  attachments, and action/resource rows.
- Write down the actual grouping rules before changing product code.
- Tie each implemented renderer rule to source or live DOM evidence.

Reset 26 notes:

- 2026-07-07 17:05 +08:00: local captured official extension assets exist
  under `reference/extension-source/openai.chatgpt-26.5623.31443/`.
- Official source assets inspected:
  - `webview/assets/local-conversation-turn-BZInUTC2.js`
  - `webview/assets/tool-activity-disclosure-BLOD7VGb.js`
  - `webview/assets/worktree-init-tool-activities-B1o2n3Qp.js`
- Official turn rendering in `local-conversation-turn-BZInUTC2.js` uses a
  turn-level renderer function whose flow splits turn items into user,
  assistant, tool output, system event, agent/activity, diff, todo, plan,
  approval, permission, and post-assistant groups before rendering.
- Official collapse handling calls a collapsible-entry builder for renderable
  agent items, then renders the body through the function that takes
  `collapsedMessageCount`, `workedDurationMs`, `workedForItem`, `isCollapsed`,
  `content`, `preToggleContent`, and `persistentContent`.
- Official collapse body uses an animated wrapper with opacity and height
  transitions and `overflow: hidden`; the toggle row is separated from the
  expanded body by a token border line.
- Official `tool-activity-disclosure-BLOD7VGb.js` defines the activity header
  as `group/activity-header inline-flex min-w-0 max-w-full self-start
  items-center gap-1.5 p-0 text-left`, uses a shimmer for running status, and
  animates body `height`/`opacity` while setting `aria-hidden`, `inert`, and
  `pointer-events` according to expansion state.
- Official command execution handling extracts `commandExecution` items into
  process targets for assistant rendering. It does not justify a Codex Web-only
  visible command transcript row during the parity pass.

These are source-code findings only. They do not prove current UI parity.

### R26-A5. Match official processed-row rendering

Status: open

User-reported problems:

- `已处理 XXs` timing should appear in the same position as the official
  code-server Codex extension.
- Expand/collapse body, animation, icon, indentation, text, and row spacing must
  follow the official behavior.
- Target-only command transcript rows must be removed during the official
  parity pass.

Required work:

- Locate matching processed rows by same nearby visible text anchors.
- Capture before/after screenshots and expanded body DOM in both products.
- Implement only the official display rule unless a later enhancement is
  explicitly reopened after parity is achieved.

### R26-A6. Match official file, diff, attachment, and action rows

Status: open

User-reported problems:

- Official renders file/code activity as structured rows or blocks, not plain
  conversation text.
- Official can show attachment rows such as user attachments.
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

### R26-A7. Preserve long-session performance without content loss

Status: open

Problem:

- Opening the long conversation previously caused slow load or browser failure.
- The fix must not be truncation, hiding content, or dropping historical turns.

Required work:

- Use incremental/chunked loading and virtualization only where they preserve
  the full conversation.
- Prove scroll, anchor location, expand/collapse, and rendered content still
  work after optimization.

### R26-A8. Audit and remove wrong previous product code

Status: open

Problem:

- Earlier commits may contain approximate UI, target-only rows, code-server
  leftovers, compatibility patches, or temporary experiment code.

Required work:

- Review current frontend conversation renderer, virtualizer, styles, API
  adapters, naming, and scripts.
- Identify code whose only purpose was to pass weak checks.
- Remove or rewrite it as clean product logic.
- Keep display behavior only when same-anchor reference evidence proves it or
  when it is necessary product plumbing outside the official parity surface.

### R26-A9. Final same-anchor newest-to-oldest sweep

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

### R26-A10. Deploy and live-review every product change

Status: open

Problem:

- Local fixes are not enough. The user validates the online site.

Required work:

- Commit and push product changes.
- Pull/reset/build/restart on the server.
- Verify service and agent status.
- Re-run Reset 26 currentness proof.
- Re-run same-anchor browser proof against the live target.

## Evidence Log

Reset 26 starts with no accepted UI evidence.

2026-07-07 16:38 +08:00:

- R26-A1 has fresh currentness-only evidence in
  `reference/live-currentness/20260707-083224/`.
- R26-A2 has fresh audit-control evidence in
  `reference/live-anchor-alignment/20260707-083333/` and
  `reference/live-anchor-alignment/20260707-083541/`.
- No UI parity, grouping parity, expand/collapse parity, scroll parity, or
  clickability parity is accepted by these records.

2026-07-07 16:50 +08:00:

- The audit script was fixed after a false negative on seq `7265`.
- Latest audit-control evidence after the fix:
  `reference/live-anchor-alignment/20260707-084513/` and
  `reference/live-anchor-alignment/20260707-084655/`.
- R26-A3 has target-only clue evidence in
  `reference/live-anchor-alignment/20260707-083924/`.
- `reference/live-anchor-alignment/20260707-084840/` is explicitly rejected as
  a false-positive risk because context was `score=0.000, matched=0/80`.
- `reference/live-anchor-alignment/20260707-085457/` is the corrected rerun for
  that anchor and correctly fails context comparability.
- R26-A3 remains incomplete because the full newest-to-oldest sweep and
  repeated expandable-row parity checks are still missing.

Active evidence directories:

- `reference/live-anchor-alignment/`
- `reference/live-currentness/`

Archived clue-only evidence:

- `reference/legacy/20260707-false-positive-reset25-active-archive/`
- `reference/legacy/20260707-false-positive-reset24-active-archive/`
- `reference/legacy/20260707-false-positive-reset23-active-archive/`
- `reference/legacy/20260707-false-positive-reset22-active-archive/`
- `reference/legacy/20260707-false-positive-reset21-active-archive/`
- `reference/legacy/20260707-false-positive-reset20-active-archive/`
- all older `reference/legacy/20260707-false-positive-*` records.

New evidence must be appended here only after it is produced from the Reset 26
verification setup and saved under the active Reset 26 evidence directories.
