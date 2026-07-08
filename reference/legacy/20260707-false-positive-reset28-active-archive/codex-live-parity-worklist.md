# Codex Live Parity Worklist

Created: 2026-07-07
Reset: 28
Status: active

This is the only active work file for Codex Web live conversation parity.

Reset 28 exists because previous work produced false positives and did not meet
the user's final acceptance standard. No previous screenshot, script report,
source inspection, target-only probe, or local fixture result can close any
Reset 28 visual task.

## Archive Boundary

Moved out of active work:

- `reference/legacy/20260707-false-positive-reset27-active-archive/`
- `reference/legacy/20260707-false-positive-reset27-active-archive/codex-live-parity-worklist.md`
- `reference/legacy/20260707-false-positive-reset27-active-archive/live-anchor-alignment/`
- `reference/legacy/20260707-false-positive-reset27-active-archive/live-currentness/`

All earlier reset archives are clue-only:

- `reference/legacy/20260707-false-positive-reset26-active-archive/`
- `reference/legacy/20260707-false-positive-reset25-active-archive/`
- every older `reference/legacy/20260707-false-positive-*` directory

Active Reset 28 evidence may be written only to:

- `reference/live-anchor-alignment/`
- `reference/live-currentness/`

These active directories were recreated for Reset 28. Evidence outside these
directories cannot close a task.

## User Acceptance Standard

The final standard is not "similar" and not "the target looks reasonable".
The target must match the official code-server Codex extension behavior at the
same long-conversation positions.

Required comparison setup:

- Target: `https://codex.zelt.cn/?nodeId=host-docker-agent`
- Reference: `https://code-tx.zelt.cn/?folder=/root`
- Viewport: `1920x1080` or larger.
- Reference UI must open Codex from the left Activity Bar icon.
- Reference right chat/sidebar must be closed.
- Test conversation is the long conversation beginning with `分析一下codex-web`.
- Sweep direction is newest-to-oldest.
- Every comparison must use the same visible text anchor in both reference and
  target, with enough surrounding context to prove both browsers are at the
  same conversation location.
- Short repeated anchors such as `./build-all.sh` are invalid unless nearby
  context disambiguates the exact occurrence.
- Expandable rows such as `已处理 XXs` must be clicked by real Playwright/CDP
  mouse input in both reference and target.
- Expanded and collapsed states both require screenshots, DOM, and computed
  style evidence.
- The whole long conversation must be swept by anchors. A small sampled area
  cannot pass final acceptance.

## Non-Negotiable Rules

- Do not invent a similar UI.
- Do not accept approximate visual matches.
- Do not mark work complete from memory.
- Do not mark work complete from source inspection alone.
- Do not mark work complete from target-only checks.
- Do not mark work complete from currentness checks.
- Do not mark work complete from local fixture scripts.
- Do not mark work complete from one screenshot or one anchor.
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
- Do not deploy stale assets or rely on browser cache.
- Do not modify the reference code-server except temporary UI placement needed
  to expose the Codex extension from the left Activity Bar.

## Evidence Gate

Every visual or interaction task remains open until one evidence package proves:

- local HEAD, origin HEAD, server HEAD, and deployed browser asset version;
- `codex-web.service` status and agent/container status;
- browser console, page-error, and failed HTTP response counts;
- same visible text anchor in reference and target;
- surrounding text/context match at that anchor;
- reference and target screenshots before interaction;
- reference and target screenshots after interaction;
- real mouse or keyboard input, not synthetic state mutation;
- hit-test proof that the intended row/control receives the click;
- DOM structure, classes, attributes, hierarchy, grouping, and row order;
- computed styles for font, color, spacing, border, radius, overflow, dimensions,
  icons, buttons, disclosure rows, and activity/file rows;
- expanded body text and DOM when the official reference expands;
- long-session upward-scroll proof through multiple windows;
- no overlay, drag surface, virtualizer spacer, or hidden element intercepting
  message clicks;
- local code checks/build/tests for changed files;
- commit, push, deploy, and post-deploy currentness proof after product changes;
- human-visible screenshot review with no obvious mismatch.

If any screenshot or interaction still visibly differs, the task remains open.

## Status Values

- `open`: known issue, no accepted proof.
- `in-progress`: being investigated or changed now.
- `needs-evidence`: code changed, but live same-anchor proof is missing.
- `blocked`: external state prevents proof or implementation.
- `currentness-only`: online freshness checked; no UI parity accepted.
- `done-admin`: housekeeping only; no UI parity accepted.
- `ready-for-user-review`: full evidence gate passed and the user can review the
  live site.

No Reset 28 visual task may use `ready-for-user-review` until the full evidence
gate is recorded here.

## Work Discipline

- Add every user-reported live issue here before or alongside the fix.
- Fix the current reported issue first unless a prerequisite blocks it.
- After a code fix, set the task to `needs-evidence`, not done.
- Only live same-anchor evidence can move a visual task out of `needs-evidence`.
- Record exact evidence directory names for every claim.
- Old Reset 27 findings may guide investigation, but they are not accepted
  results.
- Re-scan recently changed code for wrong compatibility patches before final
  handoff.

## Known Issues To Carry Forward

- Previous work accepted false positives.
- Long conversations can become hard or impossible to scroll reliably.
- Some `已处理` rows have been unclickable or failed to expand on the live target.
- A previous implementation created a page-wide drag/selection-like surface.
- Official grouping/collapse rules are not fully proven.
- Official file/diff activity blocks are not matched; target may render code or
  file changes as plain text.
- `已处理 XXs` placement and collapsed/expanded body behavior must match the
  official extension.
- Target-only command transcript rows must be removed during parity.
- The whole long conversation must be compared by same text anchors,
  newest-to-oldest.
- Large `/api/sessions/{id}/events` pages are slow on the long session; a
  2000-event online request took longer than 30 seconds before returning.

## Active Tasks

### R28-A0. Rebuild active work tracking after false positives

Status: done-admin

Scope:

- Move Reset 27 active work and evidence out of active paths.
- Recreate active evidence directories for Reset 28.
- Create this file as the only active worklist.

Acceptance:

- Administrative only. This accepts no UI parity.

Evidence:

- Reset 27 active files were moved to
  `reference/legacy/20260707-false-positive-reset27-active-archive/`.
- Fresh active directories were recreated:
  `reference/live-anchor-alignment/` and `reference/live-currentness/`.

### R28-A1. Prove online currentness

Status: currentness-only

Problem:

- The user validates the online site. Stale server code or cached assets can
  make every visual result invalid.

Required work:

- Verify local HEAD, origin HEAD, server HEAD, branch, service status,
  agent/container status, browser asset versions, cache headers, console errors,
  page errors, and failed HTTP responses.
- Store evidence under `reference/live-currentness/`.

Boundary:

- This can only become `currentness-only`. It accepts no UI parity.

Reset 28 evidence:

- Browser currentness evidence:
  `reference/live-currentness/20260707-095502/summary.json`
- Browser screenshot:
  `reference/live-currentness/20260707-095502/target.png`
- Supplemental git/service/container evidence:
  `reference/live-currentness/20260707-095502/currentness-extra.json`
- Local HEAD, `origin/main`, and server HEAD are all
  `0e131240c2c067fa21f5b573e529b02a6fcb306f`.
- Local and server branch are `main`.
- `codex-web.service` is `active`.
- `codex-web-agent` container is online.
- Runtime/script/css asset version is `20260707094751`.
- Script/CSS/runtime versions match.
- Browser console warnings/errors recorded by the currentness script: `0`.
- Browser page errors recorded by the currentness script: `0`.
- Failed HTTP responses recorded by CDP: `0`.

This evidence proves only that the online target is current enough to inspect.
It accepts no visual parity.

### R28-A2. Re-audit same-anchor tooling

Status: done-admin

Problem:

- Earlier tooling produced false positives.

Required work:

- Prove ambiguous short anchors fail.
- Prove long unique anchors pass only with matching visible context.
- Prove a target API hit cannot count when the rendered target anchor is not
  visibly aligned.
- Prove expandable-row checks use real mouse input and hit-test evidence.

Acceptance:

- Administrative/tooling only. This accepts no UI parity.

Reset 28 evidence:

- Script syntax check passed:
  `node --check scripts\audit-codex-live-anchor-alignment.cjs`.
- Tooling was corrected to compare multiple exact-anchor occurrences inside the
  same visible window and choose the strongest surrounding-context overlap.
  This prevents a false negative caused by duplicated virtual-window text while
  still requiring exact anchors and context overlap.
- Tooling was also corrected so target API preflight cannot count
  context-only matches as exact anchor matches. A record must contain the anchor
  itself; context overlap may only rank otherwise exact matches.
- Ambiguous short-anchor negative control:
  `reference/live-anchor-alignment/20260707-101613/summary.json` failed with
  `2` failed checks for `./build-all.sh`.
- Long unique prose-anchor positive control:
  `reference/live-anchor-alignment/20260707-101739/summary.json` reported `0`
  failed checks for
  `我现在上传了/root/code/codex-web.tar  你可以将它解包,然后看一下我们现在的差异,如果差异较大,那么可以直接reset再实现可能更省事`.
- Context-only API-match negative control:
  `reference/live-anchor-alignment/20260707-101445/summary.json` failed with
  `2` failed checks for `已按会话列表样式实现并上线到 codex-web.service`.
  The target API record had context overlap but did not contain that exact
  anchor, so it was rejected with `apiContainsAnchor=false`.
- The negative controls confirm that weak anchors and API-only matches cannot
  close visual parity.

This evidence proves only that the audit tooling is usable for Reset 28. It
accepts no visual parity.

### R28-A3. Fix scroll and click interception

Status: open

Problem:

- Long conversation scrolling has failed or flashed.
- `已处理` rows have not reliably expanded.
- A page-wide drag/selection-like surface appeared previously.

Required work:

- Inspect hit-testing around the conversation area.
- Remove any overlay, drag surface, pointer blocker, or incorrect virtualizer
  hit area.
- Verify newest-to-oldest scrolling through multiple long-session windows.
- Verify `已处理` rows can be clicked with real mouse input in both reference and
  target at same anchors.

Acceptance:

- Must pass the full evidence gate at same text anchors.

### R28-A4. Align official grouping and collapse rules

Status: open

Problem:

- Target grouping/collapse output is not proven to match the official
  code-server Codex extension.

Required work:

- Inspect official extension renderer/source in read-only mode.
- Map target events to official user, assistant, tool output, system event,
  activity, diff, todo, plan, approval, permission, and final assistant groups.
- Remove target-only command transcript display during parity.
- Match `已处理 XXs` placement, disclosure row content, chevron state, collapsed
  body absence, expanded body structure, animation/overflow, spacing, and
  typography.
- Validate with same-anchor screenshots and DOM/computed styles.

Acceptance:

- Must pass the full evidence gate at same text anchors, including expanded and
  collapsed states.

### R28-A5. Align official file/diff activity blocks

Status: open

Problem:

- Official extension shows file/diff activity as block/list elements, while the
  target has shown code/file changes as plain text.

Required work:

- Identify official DOM/classes/styles for file and diff activity rows.
- Render target file/diff activities with the same grouping and visual rules.
- Do not implement the right-side diff viewer unless required for visible row
  parity.
- Validate at anchors where the official UI shows file/diff blocks.

Acceptance:

- Must pass the full evidence gate at same text anchors.

### R28-A6. Whole-conversation same-anchor sweep

Status: open

Problem:

- Small sampled checks missed large mismatches.

Required work:

- Sweep the long conversation newest-to-oldest.
- Use same visible text anchors with enough surrounding context.
- For each anchor window, compare reference and target screenshots, DOM,
  computed styles, row grouping, and expand/collapse behavior.
- Add newly found mismatches as tasks before fixing them.

Acceptance:

- Must pass the full evidence gate across the full long-conversation sweep.

### R28-A7. Reduce long-history event pagination cost

Status: needs-evidence

Problem:

- Long-session event page requests are slow enough to affect scrolling and
  same-anchor verification.
- Reset 28 probing observed a 2000-event online request taking longer than 30
  seconds before returning.

Required work:

- Avoid full `CODEX_HOME/sessions` directory scanning on every session events
  page request.
- Keep immediate history discovery for session list and send/resume paths.
- Keep current-session history file size/modtime changes visible to events
  requests without a full directory scan.
- Deploy online and re-measure the long-session events endpoint.

Current implementation:

- `agent/internal/session/manager.go` now forces disk refresh for `New`,
  `List`, `Send`, and post-Codex turn completion.
- `Events` uses a short non-forced refresh window to avoid repeated full
  directory scans during pagination.
- `Events` still stats and reindexes the current session history file when
  that file changes, preserving same-session freshness.

Local verification:

- `go test ./...` passed in `agent`.

Remaining requirement:

- Run `./build-all.sh`, push, deploy online, and re-measure the same long
  `/api/sessions/{id}/events` request.

Acceptance:

- Must show post-deploy currentness and improved long-session endpoint timing.
- This is a performance/support task only; it accepts no UI parity.

### R28-A8. Final deploy and user review handoff

Status: open

Required work:

- Commit and push product changes.
- Pull/build/restart the online service.
- Re-run Reset 28 currentness.
- Re-run Reset 28 same-anchor parity checks.
- Provide the exact evidence directories and online URL.

Acceptance:

- This can become `ready-for-user-review` only after all Reset 28 visual tasks
  pass their evidence gates.
