# Codex Live Parity Worklist

Created: 2026-07-07 14:05:00 +08:00
Reset: 22
Status: active

This is the only active work file for Codex Web conversation-rendering parity.

Reset 22 exists because earlier work produced false positives: some checks
proved freshness, target-only behavior, or partial local behavior, but did not
meet the user's final same-anchor browser acceptance standard. Reset 21 is now
archived as investigation material only. No product UI parity is accepted at
Reset 22 start.

## Archive Boundary

Moved out of active work:

- `reference/legacy/20260707-false-positive-reset21-active-archive/`
- `reference/legacy/20260707-false-positive-reset21-active-archive/codex-live-parity-worklist.md`
- `reference/legacy/20260707-false-positive-reset21-active-archive/live-anchor-alignment/`
- `reference/legacy/20260707-false-positive-reset21-active-archive/live-currentness/`

Active Reset 22 evidence may be written only to:

- `reference/live-anchor-alignment/`
- `reference/live-currentness/`

The active evidence directories were recreated empty for Reset 22. Any older
report is a clue only and cannot be cited as acceptance.

## Non-Negotiable Boundaries

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
- Do not treat long-session scroll failure as a resize or drag issue unless
  browser evidence proves it.
- Do not keep target-only command transcript rows during the official parity
  pass.
- Do not preserve wrong code with compatibility patches.
- Do not weaken audit rules to make reports pass.
- Do not call a task accepted until the online site is deployed, current, and
  checked in a real browser against the reference.
- User-reported live issues must be added to this file before or alongside the
  fix.

## Fixed Test Setup

- Target: `https://codex.zelt.cn/?nodeId=host-docker-agent`
- Reference: `https://code-tx.zelt.cn/?folder=/root`
- Viewport: `1920x1080` or larger.
- Reference setup: Codex extension opened from the left Activity Bar icon.
- Reference setup: right chat/sidebar closed.
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

If screenshots still visibly differ, the task remains open. A currentness report
can only prove that the online page is fresh; it cannot prove UI parity.

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

No Reset 22 visual task may use `ready-for-user-review` until the full gate is
present in this file.

## Active Tasks

### R22-A0. Archive Reset 21 false-positive work

Status: done-admin

Scope:

- Move Reset 21 active evidence out of active evidence paths.
- Preserve the Reset 21 workfile under `reference/legacy/`.
- Rebuild this file as Reset 22.

Acceptance:

- Administrative only. This accepts no UI parity.

### R22-A1. Prove online currentness

Status: currentness-only

Problem:

- The user validates the online site, so local state is not enough.
- Reset 21 currentness evidence is archived and cannot be reused.

Required work:

- Verify local HEAD, remote HEAD, server HEAD, service status, agent/container
  status, browser asset versions, cache headers, console warnings, and page
  errors.
- Store Reset 22 evidence under `reference/live-currentness/`.

Boundary:

- This may only be recorded as currentness proof. It accepts no UI parity.

Reset 22 evidence:

- Local HEAD: `1d8a788`
- Origin HEAD: `1d8a788`
- Server HEAD: `1d8a788`
- `codex-web.service`: `active`
- `codex-web-agent`: `Up 5 hours`
- Browser currentness report:
  `reference/live-currentness/20260707-060950/summary.json`
  - target URL: `https://codex.zelt.cn/?nodeId=host-docker-agent`
  - script/css/runtime version: `20260707053121`
  - HTML cache-control: `no-cache`
  - console warnings/errors: `0`

Completion rule:

- This records currentness only. It proves no visual parity, grouping parity,
  collapse behavior, file activity parity, scroll behavior, or full
  long-session acceptance.

### R22-A2. Verify long-conversation scrolling and remove click blockers

Status: in-progress

Problem:

- The long conversation has shown upward scroll failure or flicker.
- A page-wide drag-like surface previously appeared.
- The user reports processed rows may not be clickable.

Required work:

- Use the online target long conversation.
- Scroll newest-to-oldest with real browser input.
- Verify no overlay, drag layer, resize handle, virtualizer spacer, or hidden
  element intercepts message clicks.
- Capture screenshots, `elementFromPoint`, scroll offsets, visible range, DOM
  hit-test data, console output, and page errors.

Reset 22 evidence:

- First same-anchor report:
  `reference/live-anchor-alignment/20260707-061113/summary.json`
  - anchors: `10`
  - failed checks: `7`
- Target rendered-scroll failure:
  - anchor 2 text exists in target API at seq `7424`, but the rendered scroll
    pass did not find it.
  - screenshot:
    `reference/live-anchor-alignment/20260707-061113/target-anchor-2.png`
- This remains open because a browser scroll/virtualizer locator issue can
  hide content even when the API contains it.

### R22-A3. Match official processed-row expand/collapse behavior

Status: open

Problem:

- Rows such as `已处理 XXs` must expand/collapse in the same way as the official
  code-server Codex extension.
- Earlier checks did not prove real click behavior at the same visible anchor.

Required work:

- Locate matching processed rows in reference and target by same nearby text
  anchors.
- Use real mouse clicks in both browsers.
- Capture before/after screenshots and expanded body DOM.
- Prove `elementFromPoint` lands on the disclosure control.
- If the official row expands, the target must expose the same kind of content
  in the same visual structure.

### R22-A4. Match official grouping and processed-time placement

Status: open

Problem:

- Processed-time rows must appear above/below the same turn content as the
  official extension.
- Group boundaries, collapse labels, and summary placement must match the
  reference instead of using target-created grouping.
- Target-only command transcript rows must be removed during the official
  parity pass.

Required work:

- Compare same anchors newest-to-oldest.
- Inspect official DOM/source when the grouping rule is unclear.
- Record every mismatch here before changing code.

### R22-A5. Match official file, diff, attachment, and action rows

Status: in-progress

Problem:

- Official renders code/file activity as structured resource rows or block
  activity, not plain conversation text.
- Official may show attachment rows such as `用户附件` and action rows such as
  `打开方式`.
- The target currently has known mismatches in this area, but Reset 21 evidence
  is archived and must be re-proved before acceptance.

Required work:

- Capture official DOM, computed styles, icons, spacing, row hierarchy, labels,
  and collapse behavior for matching anchors.
- Match visible file/diff structure before considering syntax highlighting or
  optional detail panes.
- Identify whether missing rows are renderer bugs, data-capture/backend gaps,
  or unsupported official resources.
- Do not fabricate attachment/resource rows when the target API lacks truthful
  backing data. Any derived row must be explicitly grounded and documented.

Archived clues to re-check:

- Source showed `用户附件` rows where target had no rendered attachment rows.
- Source showed `网页预览 / 网站 / 打开方式` action rows where target had none.
- Source displayed some code/file changes as structured blocks while target
  rendered them as plain text.

Reset 22 evidence:

- First same-anchor report:
  `reference/live-anchor-alignment/20260707-061113/summary.json`
  - anchors: `10`
  - failed checks: `7`
- Product failures from this report:
  - anchor 1, `我现在上传了/root/code/codex-web.tar...`:
    source shows two non-processed activity rows labeled `用户附件`; target
    shows none.
  - anchor 3, `也就是开始做我们codex的界面出来`:
    source shows two structured action rows labeled `打开方式`; target shows
    none in the matched turn.
  - anchor 3 also failed file/diff activity parity for the same `打开方式`
    structured rows.
- Visual screenshots confirming the mismatch:
  - `reference/live-anchor-alignment/20260707-061113/source-anchor-1.png`
  - `reference/live-anchor-alignment/20260707-061113/target-anchor-1.png`
  - `reference/live-anchor-alignment/20260707-061113/source-anchor-3.png`
  - `reference/live-anchor-alignment/20260707-061113/target-anchor-3.png`
- Do not accept this task yet. The event source and renderer mapping still need
  to be inspected and fixed without fabricating unsupported data.

### R22-A6. Remove wrong previous parity code

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

### R22-A7. Keep long-session performance without content loss

Status: open

Problem:

- Opening the long conversation previously caused slow load or browser failure.
- The fix must not be truncation, hiding content, or dropping historical turns.

Required work:

- Use incremental/chunked loading and virtualization only where they preserve
  the full conversation.
- Prove scroll, anchor location, expand/collapse, and rendered content still
  work after optimization.

### R22-A8. Full same-anchor newest-to-oldest sweep

Status: in-progress

Problem:

- Partial anchor checks missed obvious mismatches.

Required work:

- Start at the newest visible turns in the long conversation.
- Move upward using same visible text anchors.
- At each anchor, compare reference and target screenshots, DOM, computed
  styles, real click behavior, and scroll stability.
- If a mismatch is found, add a concrete task to this file before fixing it.
- Continue until the whole reviewed long-conversation span has been compared,
  not just one successful area.

Reset 22 evidence:

- First newest-to-oldest batch:
  `reference/live-anchor-alignment/20260707-061113/summary.json`
  - source context found in official code-server Codex webview.
  - target context found in Codex Web shadow DOM.
  - discovered and checked `10` anchors.
  - result: `7` failed checks.
- Product mismatches are tracked in R22-A5.
- Target rendered-scroll anchor miss is tracked in R22-A2.
- Reference-side evidence weakness:
  - anchors 8, 9, and 10 had source disclosure real mouse hit-test failures.
  - Treat these as evidence weakness, not target product bugs, and do not use
    them as acceptance proof.

### R22-A9. Deploy and live-review every product change

Status: open

Problem:

- Local fixes are not enough. The user validates the online site.

Required work:

- Commit and push product changes.
- Pull/reset/build/restart on the server.
- Verify service and agent status.
- Re-run Reset 22 currentness proof.
- Re-run same-anchor browser proof against the live target.

## Evidence Log

Reset 22 starts with no active UI evidence.

Currentness-only evidence:

- `reference/live-currentness/20260707-060950/summary.json`

Unaccepted same-anchor evidence:

- `reference/live-anchor-alignment/20260707-061113/summary.json`
  - Useful failure evidence only.
  - It is not acceptance because it has seven failed checks and visible
    attachment/action-row mismatches.

Archived clues only:

- `reference/legacy/20260707-false-positive-reset21-active-archive/`
- `reference/legacy/20260707-false-positive-reset20-active-archive/`
- all older `reference/legacy/20260707-false-positive-*` records.

New evidence must be appended here only after it is produced from the fixed test
setup and saved under the active Reset 22 evidence directories.
