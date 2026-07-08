# Codex Live Parity Worklist

Created: 2026-07-07 17:07:24 +08:00
Reset: 27
Status: active

This is the only active work file for Codex Web live conversation parity.

Reset 27 exists because earlier work produced false positives. No prior visual,
grouping, collapse, scroll, or interaction result is accepted as complete. Older
evidence can be used only as a clue for where to look.

## Archive Boundary

Moved out of active work:

- `reference/legacy/20260707-false-positive-reset26-active-archive/`
- `reference/legacy/20260707-false-positive-reset26-active-archive/codex-live-parity-worklist.md`
- `reference/legacy/20260707-false-positive-reset26-active-archive/live-anchor-alignment/`
- `reference/legacy/20260707-false-positive-reset26-active-archive/live-currentness/`

All earlier reset archives are clue-only, including Reset 25 and Reset 26. They
must not be cited as UI acceptance.

Active Reset 27 evidence may be written only to:

- `reference/live-anchor-alignment/`
- `reference/live-currentness/`

These directories were recreated empty for Reset 27. Evidence placed elsewhere
cannot close a task.

## Non-Negotiable Rules

- Do not invent a similar UI.
- Do not accept approximate visual matches.
- Do not mark work complete from memory.
- Do not mark work complete from source inspection alone.
- Do not mark work complete from target-only checks.
- Do not mark work complete from currentness checks.
- Do not mark work complete from local scripts alone.
- Do not mark work complete from one anchor, one viewport, or one screenshot.
- Do not hide, truncate, crop away, virtual-drop, or omit long conversation
  content to avoid failures.
- Do not add overlays, drag surfaces, invisible masks, pointer blockers, or
  resize handles over the conversation scroll area.
- Do not treat a scrolling failure as a resize or drag problem unless browser
  hit-test evidence proves it.
- Do not keep target-only command transcript enhancements during the official
  parity pass.
- Do not keep wrong code behind compatibility patches.
- Do not weaken audit scripts to make reports pass.
- Do not mark a task done until the online site is deployed and verified
  against the live code-server reference at matching text anchors.
- User-reported live issues must be added here before or alongside the fix.
- Every completed item must name the exact evidence directory that proves it.

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
- Short anchors such as `./build-all.sh` are invalid unless nearby context
  disambiguates the exact same occurrence.
- Expandable rows must be clicked in both reference and target with real
  Playwright/CDP mouse input.
- Expand/collapse proof must include before-click and after-click screenshots
  for both reference and target.
- Use `elementFromPoint` or equivalent hit-test proof before accepting that a
  click lands on the intended control.
- If the reference source code is needed, inspect the code-server Codex
  extension source on the server in read-only mode.
- The reference code-server site must not be modified except for temporary UI
  placement needed to expose the Codex extension in the left Activity Bar.

## Acceptance Gate

Every visual or interaction task remains open until its evidence package has:

- target deployed from the expected git commit;
- service status and agent/container status;
- browser asset version/currentness proof;
- browser console and page-error proof;
- same visible text anchor in reference and target;
- proof both browsers are at the same long-conversation location;
- reference and target screenshots before each relevant interaction;
- reference and target screenshots after each relevant interaction;
- real Playwright/CDP mouse or keyboard input, not synthetic state mutation;
- hit-test proof for clickable rows and controls;
- DOM structure, classes, attributes, hierarchy, and row grouping for matched
  elements;
- computed styles for text, spacing, color, font, border radius, overflow,
  dimensions, icons, buttons, and disclosure rows;
- expanded body text and DOM structure when the official reference expands;
- long-session upward-scroll evidence from latest turns;
- no overlay, drag surface, virtualizer spacer, or hidden element intercepting
  message clicks;
- local build/check evidence for changed code;
- commit, push, deploy, and online currentness proof after product changes;
- human-visible screenshot review showing no obvious mismatch.

If screenshots or interaction behavior still visibly differ, the task remains
open.

## Status Values

- `open`: known issue, no accepted proof.
- `in-progress`: being investigated or changed now.
- `needs-evidence`: code changed, but live same-anchor proof is missing.
- `blocked`: external state prevents proof or implementation.
- `currentness-only`: online freshness checked; no UI parity accepted.
- `done-admin`: housekeeping only; no UI parity accepted.
- `ready-for-user-review`: full evidence gate passed and the user can review
  the live site.

No Reset 27 visual task may use `ready-for-user-review` until the full gate is
recorded here.

## Known User-Reported Issues To Carry Forward

- False-positive evidence was previously accepted. Reset 27 must not reuse those
  conclusions.
- Long conversations can become hard or impossible to scroll reliably.
- Some `已处理` rows cannot be clicked/expanded on the live target.
- A previous implementation created a page-wide drag/selection-like surface.
  That behavior must not exist.
- Official grouping/collapse rules are not fully matched.
- Official file/diff activity blocks are not fully matched; target currently
  risks rendering code/file changes as plain text.
- Target-only command transcript rows must be removed during the parity pass.
- Verification must compare the whole long conversation by same text anchors,
  newest-to-oldest, not a small sampled section.

## Active Tasks

### R27-A0. Rebuild active work tracking after false positives

Status: done-admin

Scope:

- Move Reset 26 active work and evidence out of active paths.
- Recreate active evidence directories for Reset 27.
- Create this file as the only active worklist.

Acceptance:

- Administrative only. This accepts no UI parity.

Evidence:

- Reset 26 active files were moved to
  `reference/legacy/20260707-false-positive-reset26-active-archive/`.
- Fresh active directories were recreated:
  `reference/live-anchor-alignment/` and `reference/live-currentness/`.

### R27-A1. Re-prove online currentness from the live target

Status: currentness-only

Problem:

- The user validates the online site. Local behavior and stale assets are not
  enough.

Required work:

- Verify local HEAD, remote HEAD, server HEAD, service status, agent/container
  status, asset versions, cache headers, console warnings, page errors, and
  failed HTTP responses.
- Store Reset 27 evidence under `reference/live-currentness/`.

Boundary:

- This can only become `currentness-only`. It accepts no UI parity.

Reset 27 evidence:

- Browser currentness evidence:
  `reference/live-currentness/20260707-091147/summary.json`
- Browser screenshot:
  `reference/live-currentness/20260707-091147/target.png`
- Supplemental git/service/container evidence:
  `reference/live-currentness/20260707-091147/currentness-extra.json`
- Local HEAD, `origin/main`, and server HEAD are all
  `7cc72b79a1372682dcb08b605de243c29ef2122f`.
- Server branch is `main`.
- `codex-web.service` is `active`.
- `codex-web-agent` container is online.
- Runtime/script/css asset version is `20260707080951`.
- Script/CSS/runtime versions match.
- Browser console warnings/errors recorded by the currentness script: `0`.
- Browser page errors: `0`.
- Failed HTTP responses recorded by CDP: `0`.

This evidence proves only that the online target is current enough to inspect.
It accepts no visual parity.

### R27-A2. Re-audit alignment tooling before using it for acceptance

Status: done-admin

Problem:

- Earlier tooling allowed false positives.
- `scripts/audit-codex-live-anchor-alignment.cjs` currently has uncommitted
  guard changes from the previous pass. Those changes may be useful, but they
  are not accepted until Reset 27 re-audits them from fresh evidence.

Required work:

- Prove short ambiguous anchors fail.
- Prove long unique anchors can align only when visible context matches.
- Prove a target API sequence does not count unless the rendered target anchor
  is visible in the browser.
- Prove expandable-row checks use real mouse input and hit-test evidence.

Acceptance:

- Administrative/tooling only. This accepts no UI parity.

Reset 27 evidence:

- Script syntax checks passed:
  `node --check scripts\audit-live-currentness.cjs` and
  `node --check scripts\audit-codex-live-anchor-alignment.cjs`.
- Short ambiguous anchor negative control:
  `reference/live-anchor-alignment/20260707-091511/summary.json`
  failed with `2` failed checks for `./build-all.sh`.
- Long unique prose anchor positive control:
  `reference/live-anchor-alignment/20260707-091719/summary.json`
  reported `0` failed checks for
  `我现在上传了/root/code/codex-web.tar  你可以将它解包,然后看一下我们现在的差异,如果差异较大,那么可以直接reset再实现可能更省事`.
- API-hit but context-mismatch negative control:
  `reference/live-anchor-alignment/20260707-091857/summary.json`
  failed with `2` failed checks for
  `活动栏顺序已修。接着修 CSS 的 spinner 定位和水印定位。`.
- The context-mismatch control confirms a target API sequence does not count as
  acceptance when source/target visible context is not comparable.

This evidence proves only that the audit tooling is less likely to repeat the
known false positives. It accepts no visual parity.

### R27-A3. Fix long-conversation scroll and click interception

Status: open

Problem:

- The live target has had scrolling trouble in the long conversation.
- Some `已处理` rows are not clickable/expandable.
- A previous page-wide drag/selection-like behavior must not exist.

Required work:

- Inspect browser hit-testing around the conversation area.
- Remove any overlay, drag surface, pointer blocker, or incorrect virtualizer
  hit area.
- Verify newest-to-oldest scrolling through multiple long-session windows.
- Verify `已处理` rows can be clicked with real mouse input.

Acceptance:

- Must pass the full acceptance gate at same text anchors.

Reset 27 clue evidence:

- Target-only interaction probe
  `reference/live-anchor-alignment/20260707-092208/summary.json` reported `0`
  failed checks over `24` real wheel steps and `17` unique rendered windows.
- Extended target-only interaction probe
  `reference/live-anchor-alignment/20260707-092426/summary.json` reported `0`
  failed checks over `80` real wheel steps and `70` unique rendered windows.
- These are useful clues only. They do not close this task because they are not
  same-anchor reference/target acceptance evidence.

### R27-A4. Align official grouping and collapse rules

Status: needs-evidence

Problem:

- The target grouping/collapse output is not yet proven to match the official
  code-server Codex extension.

Required work:

- Inspect official extension renderer/source in read-only mode.
- Map target event shapes to official user, assistant, tool output, system
  event, activity, diff, todo, plan, approval, permission, and post-assistant
  groups.
- Remove target-only command transcript display during parity.
- Match collapsed summary placement, disclosure row content, expanded body,
  body animation/overflow, and spacing.

Current Reset 27 findings:

- Official extension source
  `reference/extension-source/openai.chatgpt-26.5623.31443/webview/assets/local-conversation-turn-BZInUTC2.js`
  defines completed agent-body collapse through `ex(...)`, where normal
  completed turns default to collapsed when no persisted state overrides it.
- Official extension source
  `reference/extension-source/openai.chatgpt-26.5623.31443/webview/assets/tool-activity-disclosure-BLOD7VGb.js`
  defines ordinary tool disclosure `defaultExpanded` as `false`, with running
  rows treated specially.
- Target-only clue evidence
  `reference/live-anchor-alignment/20260707-092208/summary.json` and
  `reference/live-anchor-alignment/20260707-092426/summary.json` shows live
  target disclosure clicks can toggle in sampled windows, but this is not
  same-anchor acceptance.
- Product code currently forces completed turn activity summary bodies open via
  `renderTurnActivitySummary(... defaultExpanded: true)`. This conflicts with
  the official default-collapse rule and can expose command/activity rows in
  places where parity screenshots should show only the collapsed summary row.
- Local fixture probing after the collapse fix found a grouping defect: a
  fixture turn containing an HTML final assistant message was not treated as
  settled, so later user messages were grouped into the same completed
  `Processed 40s` body as repeated guidance rows. The cause is that
  `assistantEventHasContent` only considers text/data message content and does
  not treat `event.html` or `event.data.html` as assistant content.
- Product code was changed so:
  - completed turn activity summaries default to collapsed;
  - completed summary bodies are not rendered while collapsed;
  - disclosure bodies have stable `data-disclosure-body` attributes for
    browser verification;
  - assistant HTML content is treated as assistant content in lifecycle and
    activity-summary logic;
  - grouping treats `placement: "final"` as a turn-ending assistant event.

Local verification:

- `node --check` passed for `renderer.js`, `lifecycle.js`,
  `activity-summary.js`, and `grouping.js`.
- `node scripts\audit-codex-activity-summary-rules.cjs` passed.
- `node scripts\audit-codex-grouping-rules.cjs` passed with `0` failed checks.
- `./build-all.sh` passed and generated `build/codex-web.exe` and
  `build/codex-agent.exe`.
- `go test ./...` passed in `backend`.
- `go test ./...` passed in `agent`.
- Local fixture disclosure evidence:
  `reference/live-anchor-alignment/20260707-094433-local-fixture-disclosure/summary.json`
  passed `5` checks. It proves only local fixture behavior: `已处理 22s`
  defaults collapsed, real mouse click expands the body, command transcript rows
  are absent from the expanded body, and a second click collapses it.
- Local fixture grouping evidence:
  `reference/live-anchor-alignment/20260707-094507-local-fixture-virtual-grouping/summary.json`
  passed `3` checks. It proves only local fixture behavior: sampled virtual
  windows no longer contain giant grouped turns; max sampled turn height was
  `208`.

Remaining requirement:

- Deploy these product changes online, re-prove currentness, then run live
  same-anchor reference/target checks before this can become accepted parity.

Acceptance:

- Must pass the full acceptance gate at same text anchors, including expanded
  and collapsed states.

### R27-A5. Align official file/diff activity blocks

Status: open

Problem:

- File and diff activity can currently appear as plain text instead of the
  official block/list presentation.

Required work:

- Identify official DOM/classes/styles for file and diff activity rows.
- Render target file/diff activities using the same grouping and visual rules.
- Do not implement the right-side diff viewer in this task unless required for
  the visible row parity.

Acceptance:

- Must pass the full acceptance gate at same text anchors where the official UI
  shows file/diff blocks.

### R27-A6. Whole-conversation same-anchor sweep

Status: open

Problem:

- Sampling one or two areas missed large mismatches.

Required work:

- Sweep the long conversation newest-to-oldest.
- Use same visible text anchors with enough surrounding context.
- For each anchor window, compare reference and target screenshots, DOM,
  computed styles, row grouping, and expand/collapse behavior.
- Add any newly found mismatch as a new task before fixing it.

Acceptance:

- Must pass the full acceptance gate across the full long-conversation sweep.

### R27-A7. Final deploy and user review handoff

Status: open

Required work:

- Commit and push product changes.
- Pull/build/restart online service.
- Re-run Reset 27 currentness.
- Re-run Reset 27 same-anchor parity checks.
- Provide the user with exact evidence directories and the online URL.

Acceptance:

- This can become `ready-for-user-review` only after all Reset 27 visual tasks
  pass their evidence gates.
