# Codex Live Parity Worklist

Created: 2026-07-07 +08:00
Reset: 19
Status: active

This is the only active work file for Codex Web conversation parity.

Reset 19 exists because previous work produced false positives. The UI still
did not meet the final acceptance standard in real use, so all previous
conclusions are demoted to investigation clues.

## Reset Boundary

No conversation-rendering parity behavior is accepted at Reset 19 start.

Archived out of active work:

- `reference/legacy/20260707-false-positive-reset18-active-archive/`
- `reference/legacy/20260707-false-positive-reset17-active-archive/`
- older `reference/legacy/20260707-false-positive-*` workfiles and reports.

Active Reset 19 evidence must be written only to:

- `reference/live-anchor-alignment/`
- `reference/live-currentness/`

The active evidence directories were recreated empty for Reset 19.

## Hard Rules

- Do not invent a similar UI.
- Do not mark work complete from memory, source inspection, local scripts,
  single screenshots, target-only checks, currentness reports, or one anchor.
- Do not hide, truncate, or drop long conversation content to avoid failures.
- Do not add overlays, drag surfaces, invisible masks, or pointer blockers over
  the conversation.
- Do not treat long-session scroll failure as a resize or drag problem.
- Do not keep custom command transcript rows during the official parity pass.
- Do not preserve wrong code with compatibility patches.
- Do not weaken audit rules to make reports pass.
- User-reported live issues must be added here before or alongside the fix.
- A task is not complete until the online site is updated and checked in a real
  browser against the reference.

## Fixed Test Setup

- Target: `https://codex.zelt.cn/?nodeId=host-docker-agent`
- Reference: `https://code-tx.zelt.cn/?folder=/root`
- Viewport: `1920x1080` or larger.
- Reference setup: Codex extension opened from the left Activity Bar icon.
- Reference setup: right chat/sidebar closed.
- Test conversation: the long conversation containing `分析一下codex-web`.
- Sweep direction: newest-to-oldest.
- Location rule: reference and target must be compared at the same visible text
  anchor, with enough surrounding context to prove the location is the same.
- Short anchors such as `./build-all.sh` are not enough unless nearby context
  proves both browsers are at the same conversation location.

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

### R19-A0. Rebuild active work tracking

Status: closed-admin

Scope:

- Move Reset 18 active workfile and evidence out of active paths.
- Recreate empty Reset 19 evidence directories.
- Rebuild this workfile with stricter false-positive controls.
- Treat the uncommitted Reset 18 audit-script delta as unaccepted work.

Acceptance:

- Administrative only. This accepts no UI parity.

### R19-A1. Restore trustworthy currentness proof

Status: open

Problem:

- The user must be able to open the online site and see the same code being
  tested.

Required work:

- Verify server HEAD, service status, container/agent status, browser asset
  versions, cache headers, console warnings, and page errors.
- Store Reset 19 evidence under `reference/live-currentness/`.

Completion rule:

- Currentness only proves the tested online page is current. It does not prove
  visual parity.

Reset 19 evidence:

- Server source synced to `origin/main` before browser proof:
  - repo HEAD: `a67e4ed`
  - `codex-web.service`: `active`
  - `codex-web-agent`: `Up 4 hours`
- Browser currentness report:
  `reference/live-currentness/20260707-043251/summary.json`
  - target URL: `https://codex.zelt.cn/?nodeId=host-docker-agent`
  - script/css/runtime version: `20260707040200`
  - HTML cache-control: `no-cache`
  - console warnings/errors: `0`

Boundary:

- This is a baseline only. It does not prove visual parity, grouping parity,
  collapse behavior, file activity parity, or full long-session acceptance.

### R19-A2. Reproduce live scroll and expand/collapse behavior

Status: open

Problem:

- The user reported long-conversation scrolling problems.
- The user reported `已处理` rows could not be clicked/expanded.
- A page-wide drag-like surface previously appeared and must not exist.

Required work:

- Use the long `分析一下codex-web` conversation in the online target.
- Verify upward scrolling newest-to-oldest without jump, flicker, or pointer
  capture.
- Verify no overlay or invisible element intercepts conversation clicks.
- Verify `已处理` rows expand/collapse by real mouse click.
- Compare the same controls against the reference when they exist there.

Reset 19 target-only evidence:

- Target interaction report:
  `reference/live-anchor-alignment/20260707-043338/summary.json`
  - checks: `10`
  - failed: `0`
  - viewport: `1920x1080`
  - real processed click before scrolling: `true -> false -> true`
  - real processed click after scrolling: `true -> false -> true`
  - wheel scroll observed `15` unique rendered windows over `18` steps
  - console warnings/errors: `0`

Boundary:

- Target-only evidence is not acceptance. It only says this scripted path did
  not reproduce the click/scroll blocker. Same-anchor reference comparison is
  still required.

### R19-A3. Match official processed summary grouping and placement

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

### R19-A4. Match official file and diff activity rendering

Status: in-progress

Problem:

- Official extension renders file edits as structured file/resource rows.
- Target has previously rendered file/code details as plain text or custom rows.

Required work:

- Capture official file/diff DOM and computed styles.
- Match labels, icons, row hierarchy, spacing, collapse behavior, and visible
  text.
- Do not implement the right-side diff viewer unless it is required for visible
  row parity.

Reset 19 same-anchor evidence:

- Broad live anchor report:
  `reference/live-anchor-alignment/20260707-043454/summary.json`
  - anchors: `8`
  - checks: `124`
  - failed: `8`
  - evidence includes reference and target screenshots for every anchor.
- Product issue confirmed at anchor 4:
  - anchor text: `现在首先,你先对浏览器截图,并进行下载,也就是下载网站html与css之类的`
  - source official expanded `已处理` body renders file changes as a patch
    activity disclosure: `文件已创建 cdp-full-capture.mjs +242 -0`.
  - target expanded `已处理` body rendered the same `file_change` with the large
    diff-card header, including `已创建 1 个文件 +242 -0 撤销 审核 ...`.
  - this is a product mismatch, not only an audit-label issue.
- Audit issue also observed:
  - target visible file cards can be mislabeled as `审查已更改的文件` because the
    audit reads the transparent overlay button aria-label instead of visible
    card title. This does not close the product issue above.

Implemented locally:

- `frontend/src/pages/codex/renderer.js`
  - summary expanded-body `file_change` events now use a patch activity row
    shape (`文件已创建/已编辑/已删除` plus file/stat row) instead of the large
    `renderDiffCard` surface with `撤销/审核`.
  - outer/non-summary file activity rendering is unchanged.

Local checks:

- `node --check frontend/src/pages/codex/renderer.js`: passed.
- `node scripts/audit-codex-activity-summary-rules.cjs`: passed.
- `node scripts/audit-codex-grouping-rules.cjs`: passed.
- `./frontend/build.sh`: passed.
- `./build-all.sh`: passed.
- `./test-go.sh`: passed.

Next proof required:

- Commit, push, server build/restart.
- Prove live currentness with a new asset version.
- Re-run same-anchor anchor 4 proof and then a broader newest-to-oldest sweep.

Post-deploy proof:

- Product commit deployed:
  - `c07bc03 Align processed file activity rows`
  - server repo HEAD: `c07bc03`
  - `codex-web.service`: `active`
  - `codex-web-agent`: `Up 4 hours`
- Browser currentness report after deploy:
  `reference/live-currentness/20260707-044902/summary.json`
  - script/css/runtime version: `20260707044854`
  - HTML cache-control: `no-cache`
  - console warnings/errors: `0`
- Same-anchor anchor 4 report after deploy:
  `reference/live-anchor-alignment/20260707-044939/summary.json`
  - checks: `18`
  - failed: `2`
  - target now renders the matched file change as:
    `已创建 1 个文件` -> `文件已创建 cdp-full-capture.mjs +242 -0`
  - target no longer renders the large diff-card header with `撤销/审核` inside
    the expanded `已处理` body for this anchor.

Remaining after this fix:

- `file/diff activity row parity` still fails for anchor 4 because the audit
  reports `sourceStructured=1` and `targetStructured=0`. This needs either a
  real markup/style follow-up if the screenshots still visibly differ, or an
  audit correction only after DOM and screenshot evidence prove parity.
- source reference hit-test still fails for one disclosure near the composer.
  This is not target product acceptance; keep it recorded as an audit/source
  interaction issue until handled explicitly.

### R19-A5. Remove custom command transcript UI from parity pass

Status: open

Problem:

- Custom command transcript rows break official parity and screenshot
  comparison.

Required work:

- Remove visible custom rows such as `exec_command xN`, `write_stdin`,
  `Chunk ID`, shell transcript summaries, or handmade command-output groupings.
- Keep raw data only if it is internal and does not affect visible output.
- Reconsider command display only after official parity is accepted.

### R19-A6. Audit renderer, styles, virtualizer, and scripts for wrong code

Status: open

Problem:

- Earlier commits may contain code that supported failed approaches.
- Some structures may still encode mistaken assumptions.

Required work:

- Review `frontend/src/pages/codex/renderer.js`.
- Review `frontend/src/pages/codex/activity-summary.js`.
- Review `frontend/src/pages/codex/virtualizer.js`.
- Review `frontend/src/pages/codex/panel-shadow.css`.
- Review live-audit scripts for false-positive logic.
- Remove wrong code paths instead of masking them with patches.

### R19-A7. Full newest-to-oldest same-anchor sweep

Status: open

Problem:

- One or two matching anchors are not enough.

Required work:

- Discover representative anchors across the whole long conversation.
- Compare newest-to-oldest at the same browser-visible locations.
- For every expandable row in view, compare collapsed and expanded states.
- Add every mismatch as a concrete R19 task before fixing it.

Completion rule:

- This is not complete until multiple Reset 19 live reports and human-visible
  screenshots show no obvious mismatches for the full sweep.

### R19-A8. Deploy and user-visible verification loop

Status: open

Problem:

- Local success is not enough. The user validates through the online site.

Required work:

- Commit and push product fixes.
- Pull/build/restart on the server.
- Verify live asset currentness and service/agent state.
- Keep the relevant task open if the user reports a live mismatch.

## Operating Procedure

For each future fix:

1. Add or update the relevant R19 task before or alongside the fix.
2. Reproduce the failure in a real browser when possible.
3. Change product code or audit code only after the failure is concrete.
4. Run local checks for changed code.
5. Commit and push when the local change is ready.
6. Deploy to the server.
7. Prove live currentness.
8. Run same-anchor live browser comparison.
9. Keep the task open if there is any visible mismatch, click failure, scroll
   failure, console/page error, stale deployment, or unreviewed affected code.

## Immediate Next Action

Restore a trustworthy Reset 19 baseline:

1. verify the worktree has no unaccepted audit-script delta;
2. run live currentness proof into the new empty Reset 19 evidence directory;
3. reproduce the reported scroll and `已处理` expand/collapse behavior in the
   online target before changing more UI code.
