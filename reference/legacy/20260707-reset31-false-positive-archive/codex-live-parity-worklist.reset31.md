# Codex Web Live Parity Worklist

Created: 2026-07-07
Reset: 31
Status: active

This file replaces the Reset 30 worklist. Reset 31 exists because Reset 30 still
mixed incomplete live probes, currentness checks, and in-progress implementation
notes in a way that could create false positives. No Reset 30 visual result is
accepted.

## Active Rule

Only this file is active for planning and status:

- `reference/codex-live-parity-worklist.md`

Only these evidence directories may support future Reset 31 claims:

- `reference/live-currentness/`
- `reference/live-anchor-alignment/`

Both active evidence directories were cleared back to `.gitkeep` at Reset 31.
All previous Reset 30 work was moved to:

- `reference/legacy/20260707-reset30-false-positive-archive/`

Reset 31 probes that were run before this stricter cleanup but did not satisfy
the final acceptance gate were moved to:

- `reference/legacy/20260707-reset31-unaccepted-live-probes/`

Legacy files are clues only. They cannot close tasks, prove parity, or justify a
status stronger than `open`.

Current active evidence inventory:

- `reference/live-currentness/20260707-114055/`: currentness-only.
- `reference/live-currentness/20260707-122511/`: post-deploy
  currentness-only for commit `73c4b16`.
- `reference/live-anchor-alignment/20260707-114716/`: setup-only.
- `reference/live-anchor-alignment/20260707-122617/`: focused
  one-anchor file/diff probe. Useful evidence, but not full parity proof.

There is currently no full visual parity proof.

## Final Acceptance Standard

The target must visually and behaviorally match the official code-server Codex
extension at the same locations in the same long conversation.

Required live setup:

- Reference: `https://code-tx.zelt.cn/?folder=/root`
- Target: `https://codex.zelt.cn/?nodeId=host-docker-agent`
- Session: `019f0a04-7f0b-7483-8bc4-18f214a5c8f1`
- Viewport: `1920x1080` or larger.
- Reference Codex must be opened from the left Activity Bar icon.
- Reference right chat/sidebar must be closed.
- Target must be deployed to the latest committed code before user review.

Required comparison method:

- Compare newest-to-oldest through the whole long conversation.
- Use the same visible text anchor in both browsers.
- Reject short or repeated anchors unless surrounding visible context proves the
  same occurrence in both browsers.
- Invalid default anchors include `./build-all.sh`, `GET /`, `GET /api/nodes`,
  and other repeated log fragments.
- Use real Playwright/CDP mouse and keyboard input for expansion, collapse,
  scrolling, and hit testing.
- Capture collapsed and expanded states whenever the official extension exposes
  an expandable row.
- Do not pass a task from target-only checks, source-only inspection, static
  screenshots, currentness evidence, API text only, or partial sampling.

## Evidence Package Required Before Any Visual Task Can Close

Every visual task remains `open` or `in-progress` until an evidence package
records all of the following:

- local HEAD, origin HEAD, server HEAD, deployed browser asset version;
- `codex-web.service` state and agent/container state;
- viewport size and selected node/session proof;
- browser console error count, page error count, and failed HTTP count;
- reference and target screenshots at the same visible anchor;
- visible surrounding text proving both views show the same occurrence;
- DOM hierarchy, classes, attributes, row order, and grouping;
- computed styles for font, color, spacing, dimensions, overflow, borders,
  radius, icons, disclosure rows, file rows, and buttons;
- real input evidence for clickable/expandable controls;
- hit-test proof that the intended control receives the click;
- expanded body proof when the reference expands;
- upward scroll proof across multiple windows;
- proof that no overlay, drag layer, virtualizer spacer, composer, or hidden
  element intercepts message clicks;
- code checks, build, commit, push, deploy, and post-deploy currentness after
  product changes.

## False Positive Guardrails

- Do not mark work complete from memory.
- Do not mark work complete from old Reset 30 evidence.
- Do not mark work complete from archived Reset 31 unaccepted live probes.
- Do not mark work complete from a single anchor.
- Do not mark work complete from approximate visual similarity.
- Do not hide, truncate, omit, or drop conversation content.
- Do not keep target-only command summaries while the goal is official parity.
- Do not keep compatibility patches that only mask wrong behavior.
- If the user can still reproduce a mismatch on the live site, the relevant task
  returns to `open`.

## Unaccepted Probe Ledger

The following Reset 31 probes are archived as failure clues only:

- `20260707-114246`: early setup probe; no visual parity accepted.
- `20260707-114627`: setup probe failed reference right-sidebar and target
  node/session checks.
- `20260707-114838`: partial 10-anchor sweep; failed 11 checks. It found
  file/diff row mismatch and also contained source hit-test noise that was later
  corrected in the audit script.
- `20260707-115703`: partial focused sweep; failed file/diff row parity,
  source hit-test, and visible file activity label checks.
- `20260707-120227`: focused single-anchor sweep; failed file/diff activity row
  parity.
- `20260707-120511`: latest focused single-anchor sweep before cleanup; failed
  file/diff activity row parity. It showed matching file stats and action row
  labels but target structured body evidence was still not equivalent to the
  official extension.

These probes cannot be used to close R31-A4 through R31-A9. Future visual proof
must be freshly generated after the relevant code and audit fixes.

## Status Values

- `open`: known work, no accepted Reset 31 proof.
- `in-progress`: currently being investigated or changed.
- `needs-live-proof`: code changed, but Reset 31 live same-anchor proof is
  missing.
- `blocked`: external state prevents implementation or proof.
- `currentness-only`: online freshness was checked; no UI parity accepted.
- `setup-only`: reference/target browser setup was checked; no UI parity
  accepted.
- `done-admin`: housekeeping only; no UI parity accepted.
- `ready-for-user-review`: full Reset 31 evidence gate passed and the live site
  is ready for the user to inspect.

No visual task may use `ready-for-user-review` until the whole evidence package
is recorded.

## User Issues Carried Into Reset 31

- Previous work produced false positives and must not be used as completion
  proof.
- The work file needed to be rebuilt from a clean standard.
- Long-session scrolling can fail, jump, flicker, or become hard to navigate.
- Collapsed `已处理 XXs` rows may not click or expand.
- A page-wide drag/selection-like surface appeared; that must not exist.
- The issue is scrolling/click interception, not a sidebar resize feature.
- Official grouping and collapse rules are not proven.
- `已处理 XXs` placement, collapsed text, expanded body, timing, icon, and row
  order must match the official extension.
- Official file/diff activity blocks must render as structured rows, not plain
  text or code dumps.
- Extra command execution summaries inside official collapsed rows must be
  removed during parity work.
- The online site must be updated before user checks.
- Final validation must sweep the whole long conversation newest-to-oldest by
  same visible anchors.

## Tasks

### R31-A0. Archive Reset 30 false-positive work

Status: done-admin

Scope:

- Move Reset 30 active evidence and old worklist into legacy.
- Clear active evidence directories back to `.gitkeep`.
- Recreate this Reset 31 worklist.
- Revert uncommitted, unverified product-code changes created during Reset 30
  cleanup.

Acceptance:

- Administrative only. This accepts no UI parity.

### R31-A1. Prove online currentness

Status: currentness-only

Scope:

- Verify local, origin, and server HEAD.
- Verify service and agent/container state.
- Verify deployed browser asset version and browser runtime errors.
- Store new evidence under `reference/live-currentness/`.

Boundary:

- This can only become `currentness-only`; it never proves visual parity.

Reset 31 evidence:

- Evidence directory:
  `reference/live-currentness/20260707-114055/`
- Browser currentness summary:
  `reference/live-currentness/20260707-114055/summary.json`
- Browser screenshot:
  `reference/live-currentness/20260707-114055/target.png`
- Local HEAD, `origin/main`, and server HEAD are all
  `370cd0699097c014a6839d7f81a93c76f9e89e6e`.
- `codex-web.service` is `active`.
- `codex-web-agent` container is running from `codex-web-agent:local`.
- Runtime, script, and CSS asset version are all `20260707111246`.
- Browser console warnings/errors: `0`.
- Browser page errors: `0`.
- Failed HTTP responses: `0`.
- This is currentness evidence only. It accepts no visual parity.

Latest post-deploy currentness:

- Evidence directory:
  `reference/live-currentness/20260707-122511/`
- Browser currentness summary:
  `reference/live-currentness/20260707-122511/summary.json`
- Browser screenshot:
  `reference/live-currentness/20260707-122511/target.png`
- Local HEAD, `origin/main`, and server HEAD are all
  `73c4b16dbb39fe5fbba3bad5999a8be162a6380a`.
- `codex-web.service` is `active`.
- `codex-web-agent` container is running from `codex-web-agent:local`.
- Runtime, script, and CSS asset version are all `20260707122450`.
- Browser console warnings/errors: `0`.
- Browser page errors: `0`.
- This is currentness evidence only. It accepts no visual parity.

### R31-A2. Prove reference setup

Status: setup-only

Scope:

- Open the official reference at `1920x1080` or larger.
- Ensure Codex is from the left Activity Bar.
- Ensure the right chat/sidebar is closed.
- Record screenshot, viewport, DOM, and setup proof.

Reset 31 evidence:

- Evidence directory:
  `reference/live-anchor-alignment/20260707-114716/`
- Summary:
  `reference/live-anchor-alignment/20260707-114716/summary.json`
- Screenshot:
  `reference/live-anchor-alignment/20260707-114716/source-setup.png`
- Browser viewport is `1920x1080`, DPR `1`.
- Source context is the code-server Codex webview:
  `extensionId=openai.chatgpt`, `purpose=webviewView`.
- Source left Activity Bar is present at `left=0`, `width=48`.
- Source auxiliary/right chat sidebar is closed:
  `#workbench.parts.auxiliarybar` is `display:none`, `visibility:hidden`,
  `width=0`, `height=0`.
- This accepts setup only. It accepts no visual parity.

### R31-A3. Prove target setup

Status: setup-only

Scope:

- Open the live target at `1920x1080` or larger.
- Select node `host-docker-agent`.
- Open session `019f0a04-7f0b-7483-8bc4-18f214a5c8f1`.
- Record screenshot, viewport, node, session, DOM, and setup proof.

Reset 31 evidence:

- Evidence directory:
  `reference/live-anchor-alignment/20260707-114716/`
- Summary:
  `reference/live-anchor-alignment/20260707-114716/summary.json`
- Screenshot:
  `reference/live-anchor-alignment/20260707-114716/target-setup.png`
- Browser viewport is `1920x1080`, DPR `1`.
- Target node is `host-docker-agent`.
- Target session is `019f0a04-7f0b-7483-8bc4-18f214a5c8f1`.
- Target panel view is `thread`; thread scroll exists in the shadow root.
- This accepts setup only. It accepts no visual parity.

### R31-A4. Build valid same-anchor sweep

Status: in-progress

Scope:

- Build a newest-to-oldest anchor plan for the whole long conversation.
- Use visible user/content anchors with surrounding context.
- Reject repeated or ambiguous anchors.
- Record every mismatch as a task before fixing.

Boundary:

- A partial sweep cannot close final parity.

Reset 31 cleanup note:

- Earlier partial sweeps were moved to
  `reference/legacy/20260707-reset31-unaccepted-live-probes/`.
- The next sweep must be rebuilt from newest-to-oldest anchors and must record
  mismatch tasks instead of accepting partial success.
- Focused probe `reference/live-anchor-alignment/20260707-122617/` passed one
  known file/diff mismatch anchor, but it is not a full sweep.

### R31-A5. Fix long-session scrolling and click interception

Status: open

Scope:

- Reproduce scrolling on the live target and reference at the same anchors.
- Prove whether any overlay, drag surface, spacer, composer, or virtualizer layer
  intercepts clicks.
- Remove the wrong interaction layer if present.
- Prove collapsed rows receive real clicks and expand.

Required proof:

- A same-anchor target/reference run must show normal upward scrolling across
  multiple windows.
- Hit-test evidence must show the clicked disclosure row receives the input.
- The proof must explicitly rule out page-wide drag surfaces, overlay layers,
  virtualizer spacers, composer overlap, and hidden chrome intercepting clicks.

### R31-A6. Match official `已处理 XXs` grouping and disclosure

Status: open

Scope:

- Compare row placement, label, icon/spinner, duration text, spacing, collapsed
  body, expanded body, and nested order.
- Remove target-only command summaries from this official parity path.
- Use real click evidence for collapsed and expanded states.

### R31-A7. Match official file/diff activity rows

Status: in-progress

Scope:

- Compare official structured file/diff blocks against target rendering at the
  same anchors.
- Render file changes as structured rows when the official extension does.
- Do not render those blocks as plain markdown, raw code, or loose text.
- Keep right-side diff preview out of scope unless it affects the left
  conversation row.

Current known mismatch:

- Archived probe `20260707-120511` found a same-anchor file/diff row mismatch.
  Source and target both exposed one file activity row and the same visible
  label, but target structured body evidence was not accepted. This must be
  re-inspected with DOM and screenshot evidence before changing product code.

Implementation note:

- Added a targeted file-detail hydration path: normal session pages still load
  with `compact=true`, but expanded disclosure rows can request
  `fileDetails=true` so `file_change` events keep `unifiedDiff`/`content` while
  command output remains compacted.
- Deployed commit `73c4b16` and ran focused same-anchor live probe
  `reference/live-anchor-alignment/20260707-122617/`; it reported 27 checks and
  0 failures for the previously failing anchor:
  `现在首先,你先对浏览器截图,并进行下载,也就是下载网站html与css之类的`.
- This is not accepted as full parity yet. It must still pass the whole
  newest-to-oldest same-anchor sweep before this task can close.

### R31-A8. Audit and remove wrong earlier code

Status: open

Scope:

- Scan frontend conversation rendering, scroll, virtualizer, and session loading
  code touched during earlier parity work.
- Remove or rewrite code-server-specific leftovers, approximate patches,
  target-only enhancements, and dead paths that conflict with the official
  parity goal.
- Keep useful code only when it matches the current responsibility model.

Audit boundary:

- Do not keep renderer behavior solely because it makes the target look cleaner
  or adds extra command information. During this parity pass, official grouping,
  collapse, and file/diff display rules win.

### R31-A9. Deploy and final live handoff

Status: open

Scope:

- Run required checks and builds.
- Commit and push product changes.
- Pull/build/restart the server as needed.
- Rebuild/restart agent only when backend/agent changes require it.
- Run post-deploy currentness.
- Run final whole-conversation same-anchor sweep.
- Mark visual tasks `ready-for-user-review` only after the full Reset 31 gate
  passes.
