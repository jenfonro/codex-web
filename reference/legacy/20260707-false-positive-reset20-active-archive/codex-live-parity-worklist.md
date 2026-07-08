# Codex Live Parity Worklist

Created: 2026-07-07 12:56:09 +08:00
Reset: 20
Status: active

This is the only active work file for Codex Web conversation-rendering parity.

Reset 20 exists because Reset 19 still produced false positives. Target-only
interaction checks, script-only checks, currentness checks, and partial
same-anchor checks did not satisfy the user's final acceptance standard. All
Reset 19 records are now archived as investigation clues only.

## Reset Boundary

No conversation-rendering parity behavior is accepted at Reset 20 start.

Archived out of active work:

- `reference/legacy/20260707-false-positive-reset19-active-archive/`
- all older `reference/legacy/20260707-false-positive-*` records.

Active Reset 20 evidence must be written only to:

- `reference/live-anchor-alignment/`
- `reference/live-currentness/`

Both active evidence directories were recreated empty for Reset 20.

## Hard Rules

- Do not invent a similar UI.
- Do not accept approximate visual matches.
- Do not mark work complete from memory.
- Do not mark work complete from source inspection alone.
- Do not mark work complete from local scripts alone.
- Do not mark work complete from target-only checks.
- Do not mark work complete from currentness checks.
- Do not mark work complete from one screenshot or one anchor.
- Do not hide, truncate, or drop long conversation content to avoid failures.
- Do not add overlays, drag surfaces, invisible masks, or pointer blockers over
  the conversation.
- Do not treat long-session scroll failure as a resize or drag problem unless
  browser evidence proves it.
- Do not keep custom command transcript rows during the official parity pass.
- Do not preserve wrong code with compatibility patches.
- Do not weaken audit rules to make reports pass.
- Do not call a task accepted until the online site is updated and checked in a
  real browser against the reference.
- User-reported live issues must be added to this file before or alongside the
  fix.

## Fixed Test Setup

- Target: `https://codex.zelt.cn/?nodeId=host-docker-agent`
- Reference: `https://code-tx.zelt.cn/?folder=/root`
- Viewport: `1920x1080` or larger.
- Reference setup: Codex extension opened from the left Activity Bar icon.
- Reference setup: right chat/sidebar closed.
- Test conversation: the long conversation containing `分析一下codex-web`.
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
- `needs-live-proof`: code changed, but live same-anchor proof is missing.
- `blocked`: external state prevents proof or implementation.
- `closed-admin`: housekeeping only; no UI parity accepted.
- `accepted`: full evidence gate passed.

## Active Tasks

### R20-A0. Rebuild active work tracking

Status: closed-admin

Scope:

- Move Reset 19 active workfile and active evidence out of active paths.
- Recreate empty Reset 20 evidence directories.
- Rebuild this workfile with stricter false-positive controls.

Acceptance:

- Administrative only. This accepts no UI parity.

### R20-A1. Restore trustworthy online currentness proof

Status: accepted

Problem:

- The user must be able to open the online site and see the same code being
  tested.

Required work:

- Verify server HEAD, service status, container/agent status, browser asset
  versions, cache headers, console warnings, and page errors.
- Store Reset 20 evidence under `reference/live-currentness/`.

Completion rule:

- Currentness only proves the tested online page is current. It does not prove
  visual parity, grouping parity, collapse behavior, file activity parity, or
  full long-session acceptance.

Reset 20 evidence:

- Local HEAD: `83c48cb`
- Server HEAD after fetch/reset to `origin/main`: `83c48cb`
- `codex-web.service`: `active`
- `codex-web-agent`: `Up 4 hours`
- Browser currentness report:
  `reference/live-currentness/20260707-050101/summary.json`
  - target URL: `https://codex.zelt.cn/?nodeId=host-docker-agent`
  - script/css/runtime version: `20260707044854`
  - HTML cache-control: `no-cache`
  - console warnings/errors: `0`

Boundary:

- This accepts only online currentness. It accepts no UI parity.

### R20-A2. Verify long-conversation scroll without overlay or drag artifacts

Status: open

Problem:

- The user reported long-conversation scrolling problems.
- A page-wide drag-like surface previously appeared and must not exist.
- The issue is scroll behavior, not a sidebar resize feature.

Required work:

- Use the long `分析一下codex-web` conversation in the online target.
- Verify upward scrolling newest-to-oldest without jump, flicker, or pointer
  capture.
- Verify no overlay or invisible element intercepts conversation clicks.
- Record browser screenshots, DOM hit-test data, console output, and scroll
  window changes.

### R20-A3. Verify `已处理` expand/collapse by real mouse interaction

Status: open

Problem:

- The user reported `已处理` rows could not be clicked or expanded.
- Previous checks may have been false positives because they did not prove the
  same visible anchor and real browser hit target.

Required work:

- Locate matching `已处理` rows in reference and target by same nearby text
  anchors.
- Use real mouse clicks in both browsers.
- Capture before/after screenshots and expanded body DOM.
- Prove `elementFromPoint` lands on the disclosure control, not an overlay.

### R20-A4. Match official processed summary grouping and placement

Status: open

Problem:

- Processed-time rows such as `已处理 XXs` must appear in the same position as
  the official extension.
- Collapsed and expanded states must match official structure and style.

Required work:

- Compare the same visible text anchors in reference and target.
- Expand matching rows in both browsers with real mouse clicks.
- Inspect official DOM/source when grouping rules are ambiguous.
- Record mismatches as concrete tasks before fixing them.

### R20-A5. Match official file and diff activity rendering

Status: needs-live-proof

Problem:

- Official extension renders file edits as structured file/resource rows or
  block-style activity, not plain conversation text.
- Target has previously rendered file/code details as plain text or custom
  command transcript rows.

Required work:

- Capture official file/diff DOM and computed styles.
- Match labels, icons, row hierarchy, spacing, collapse behavior, and visible
  text.
- Do not implement the right-side diff viewer unless it is required for visible
  row parity.
- Remove custom command transcript output during official parity alignment.

Reset 20 evidence:

- Same-anchor report:
  `reference/live-anchor-alignment/20260707-050232/summary.json`
  - anchors: `10`
  - checks: `154`
  - failed: `7`
- Product mismatches from the report:
  - anchor 8, `现在首先,你先对浏览器截图...`:
    source and target both show `已创建 1 个文件`, but source has
    `sourceStructured=1` and target has `targetStructured=0`.
  - anchor 10, `好,那么首先左侧侧边你要进行添加一个openai的扩展图标`:
    source and target both show `已编辑 2 个文件`, but source has
    `sourceStructured=1` and target has `targetStructured=0`.
  - anchor 5, `也就是开始做我们codex的界面出来`:
    source has two structured `打开方式` file/action rows; target has none in
    the matched turn.
  - anchor 3, `我现在上传了/root/code/codex-web.tar...`:
    source has two `用户附件` activity rows; target has none in the matched
    turn.
- Visual review:
  - `source-anchor-8.png` shows official activity cards/rows with stronger
    file activity structure.
  - `target-anchor-8.png` shows flatter file activity rows.
  - `target-anchor-10.png` shows target file rows visibly positioned where the
    source screenshot does not visibly show the same rows, so scroll/anchor
    matching must also be reviewed before calling this accepted.

Next:

- Inspect renderer and official DOM evidence for file activity row structure.
- Fix product rendering only where the source structure and screenshots prove a
  real mismatch.

Implemented locally:

- `frontend/src/pages/codex/renderer.js`
  - summary file activity rows now preserve `type`, `unifiedDiff`, and
    `content`.
  - expanded summary file activity rows now render a `thread-diff-virtualized`
    diff/content body below the file header when event data contains content.
  - content is not truncated; the visible panel is capped with internal scroll.
- `frontend/src/pages/codex/virtualizer.js`
  - file change height estimates now account for visible diff/content panels.

Local checks:

- `node --check frontend/src/pages/codex/renderer.js`: passed.
- `node --check frontend/src/pages/codex/virtualizer.js`: passed.
- `node scripts/audit-codex-activity-summary-rules.cjs`: passed.
- `node scripts/audit-codex-grouping-rules.cjs`: passed.
- `./frontend/build.sh`: passed.
- `./build-all.sh`: passed.
- `./test-go.sh`: passed.

Live proof still required:

- Commit, push, deploy, prove currentness, then re-run same-anchor browser
  comparison at least for anchors 8 and 10 before this can move toward
  acceptance.

Post-deploy Reset 20 proof:

- Product commit deployed:
  - `e68f720 Render summary file diffs`
  - server repo HEAD: `e68f720`
  - `codex-web.service`: `active`
  - `codex-web-agent`: `Up 4 hours`
- Browser currentness report after deploy:
  `reference/live-currentness/20260707-052145/summary.json`
  - script/css/runtime version: `20260707052105`
  - console warnings/errors: `0`
- Same-anchor targeted report:
  `reference/live-anchor-alignment/20260707-052225/summary.json`
  - anchors: `2`
  - checks: `33`
  - failed: `1`
  - remaining failed check is source-side hit-test:
    `anchor 2 source disclosure real mouse hit-test`.
  - target file/diff activity structure no longer fails for anchors 8 and 10.

Remaining visual mismatch:

- `source-anchor-1.png` shows official file content as a line-numbered green
  added-code block with a left change bar.
- `target-anchor-1.png` shows plain `+`-prefixed text lines.
- This is still a product visual mismatch even though the structure check no
  longer fails.

Implemented locally after visual review:

- `frontend/src/pages/codex/renderer.js`
  - diff/content panels now render line-number gutters.
  - added/deleted/context rows have separate visual tone.
  - added/deleted blocks show a left change bar.
  - raw created-file content is no longer rendered as `+`-prefixed plain text.

Local checks after visual fix:

- `node --check frontend/src/pages/codex/renderer.js`: passed.
- `node --check frontend/src/pages/codex/virtualizer.js`: passed.
- `node scripts/audit-codex-activity-summary-rules.cjs`: passed.
- `node scripts/audit-codex-grouping-rules.cjs`: passed.
- `./frontend/build.sh`: passed.
- `./build-all.sh`: passed.
- `./test-go.sh`: passed.

Live proof still required for this second visual fix.

Post-second-fix Reset 20 proof:

- Product commit deployed:
  - `bc196f8 Style summary diff code blocks`
  - server repo HEAD: `bc196f8`
  - `codex-web.service`: `active`
  - `codex-web-agent`: `Up 5 hours`
- Browser currentness report after deploy:
  `reference/live-currentness/20260707-053209/summary.json`
  - script/css/runtime version: `20260707053121`
  - console warnings/errors: `0`
- Same-anchor targeted report:
  `reference/live-anchor-alignment/20260707-053311/summary.json`
  - anchors: `2`
  - checks: `33`
  - failed: `1`
  - remaining failed check is source-side hit-test:
    `anchor 2 source disclosure real mouse hit-test`.
  - target file/diff activity structure remains non-failing for anchors 8 and
    10.
- Visual review:
  - target now shows line numbers, green added-code background, and left change
    bar for created-file content.
  - remaining visible difference: official source has richer syntax
    highlighting. Keep R20-A5 open for later visual refinement.

### R20-A6. Audit and remove wrong previous parity code

Status: open

Problem:

- Earlier commits may contain approximate UI, compatibility patches, or
  code-server-derived structures that are no longer justified.

Required work:

- Review conversation renderer, grouping, activity summary, virtualizer,
  panel styles, and audit scripts.
- Keep only code that is required by the current product architecture and proven
  by browser evidence.
- Replace patchy fixes with clear product behavior.

### R20-A7. Full same-anchor newest-to-oldest sweep

Status: in-progress

Problem:

- Partial anchor checks missed visible mismatches.

Required work:

- Start from the newest visible turns in the long conversation.
- Move upward by repeated same-anchor positioning.
- For each mismatched official activity shape, add a concrete task here before
  fixing it.
- Continue until the full long conversation section under review has been
  compared, not just one successful area.

Reset 20 evidence:

- First newest-to-oldest batch:
  `reference/live-anchor-alignment/20260707-050232/summary.json`
  - source context found in official code-server Codex webview.
  - target context found in Codex Web shadow DOM.
  - source reverse-scroll discovery produced `10` anchors across `19` windows.
  - target API preflight found `7654` events.
  - result: `7` failed checks.

Open issues from this batch:

- Anchor 4 target rendered-scroll search missed the source anchor even though
  target API preflight contained it.
- Anchor 10 source disclosure hit-test failed for one control; this is not a
  target product fix, but it prevents using that click result as acceptance.
- File/diff activity structure mismatches are tracked under R20-A5.

## Evidence Log

Accepted currentness evidence:

- `reference/live-currentness/20260707-050101/summary.json`

Unaccepted same-anchor evidence:

- `reference/live-anchor-alignment/20260707-050232/summary.json`
  - This is useful failure evidence only. It is not acceptance because it has
    seven failed checks and visible file activity mismatches.

New evidence must be appended here only after it is produced from the fixed test
setup and saved under the active Reset 20 evidence directories.
