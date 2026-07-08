# Codex Live Parity Worklist

Created: 2026-07-07 +08:00
Reset: 17
Status: active

This is the only active work file for Codex Web conversation parity.

Reset 17 exists because Reset 16 still produced false positives. A script or
single-anchor report can be useful as a clue, but it did not satisfy the final
acceptance standard: the live target must match the official code-server Codex
extension in a real browser, at the same visible text locations, across the long
conversation.

## Active Principle

No UI parity item is accepted at Reset 17 start.

Currentness, green scripts, source inspection, screenshots, or one matching
anchor are not completion. They are only inputs for investigation.

## Archive Boundary

Moved out of active work:

- `reference/legacy/20260707-false-positive-reset16-active-archive/codex-live-parity-worklist.md`
- `reference/legacy/20260707-false-positive-reset16-active-archive/live-anchor-alignment/`
- `reference/legacy/20260707-false-positive-reset16-active-archive/live-currentness/`

Older archives are historical clues only:

- `reference/legacy/20260707-false-positive-reset15-active-archive/`
- `reference/legacy/20260707-false-positive-reset14-active-archive/`
- `reference/legacy/20260707-false-positive-reset13-active-archive/`
- `reference/legacy/20260707-false-positive-reset12-active-archive/`
- `reference/legacy/20260707-false-positive-reset3/` through `reference/legacy/20260707-false-positive-reset12/`
- `reference/legacy/20260707-false-positive-workfiles/`
- `reference/legacy/20260707-live-parity-reset2/`

Active evidence directories have been recreated and must contain only Reset 17
evidence:

- `reference/live-anchor-alignment/`
- `reference/live-currentness/`

Archived evidence may identify a suspected bug, but it cannot close any Reset 17
task.

## Fixed Comparison Setup

- Target: `https://codex.zelt.cn/?nodeId=host-docker-agent`
- Reference: `https://code-tx.zelt.cn/?folder=/root`
- Reference setup: Codex extension is opened from the left Activity Bar icon.
- Reference setup: right chat/sidebar is closed.
- Viewport: `1920x1080` or larger unless testing responsive behavior.
- Test conversation: the long conversation containing `分析一下codex-web`.
- Sweep direction: newest-to-oldest, because the latest turn is initially visible.
- Location rule: compare the same browser-visible text anchor in both products.
- Short/file-like anchors such as `./build-all.sh` are not enough unless nearby
  context proves both browsers are at the same conversation location.

## Status Values

- `open`: known work with no accepted live proof.
- `in-progress`: being investigated or changed now.
- `needs-live-proof`: code or audit tooling changed, but live browser proof is missing.
- `blocked`: external state is preventing proof or implementation.
- `closed-admin`: housekeeping only; no UI parity accepted.

Do not use `accepted` until the final evidence gate is fully satisfied for the
whole relevant UI behavior. Do not use soft words such as `probably`,
`candidate`, `looks fixed`, or `script passed` as a completion status.

## Non-Negotiable Rules

- Do not invent a similar UI.
- Do not mark work complete from memory.
- Do not mark work complete from screenshots alone.
- Do not mark work complete from source inspection alone.
- Do not mark work complete from green scripts alone.
- Do not mark work complete from one anchor when the bug class can repeat.
- Do not reuse archived Reset 16 evidence as acceptance evidence.
- Do not add overlays, drag surfaces, invisible masks, or pointer blockers over the conversation.
- Do not treat long-session scroll failure as a draggable/resizer problem.
- Do not fix long-session performance by truncating history, hiding old rows, or losing content.
- Do not keep custom command transcript rows during the official parity pass.
- Do not show custom rows such as `exec_command xN`, `write_stdin`, `Chunk ID`,
  shell transcript summaries, or handmade command-output groupings.
- Do not hide wrong earlier code with compatibility patches. Remove wrong code paths.
- If the user reports a live issue while work is running, add it here before or
  alongside the fix, then verify it with the same live evidence gate.

## Final Evidence Gate

Every UI parity behavior must have all applicable evidence before it can be
closed:

- Same visible text anchor in reference and target.
- Proof both browsers are at the same long-conversation location.
- Reference and target screenshots before interaction.
- Reference and target screenshots after every relevant expand/collapse click.
- Real Playwright/CDP mouse click evidence, not synthetic state mutation.
- `elementFromPoint` evidence proving the click lands on the actual control.
- DOM structure, classes, attributes, and hierarchy for matched rows.
- Computed styles for text, spacing, color, font, border radius, overflow,
  dimensions, icons, and buttons when visual parity is involved.
- Expanded body text and structure when the reference expands.
- Long-session scroll evidence, especially upward scrolling from latest turns.
- Browser console and page-error evidence.
- Reference extension source or live DOM evidence when grouping rules are unclear.
- Local build/check evidence for changed code.
- Commit, push, deploy, service status, asset currentness, and agent-online proof
  after deployed code changes.
- Human-visible review: if the screenshots still visibly differ, the item remains open.

## Known False-Positive Sources To Eliminate

- A single strong anchor was previously treated as stronger than it was.
- Currentness was marked as accepted even though it does not prove UI parity.
- Real-click/hit-test failures were not always promoted to active product tasks.
- Some disclosure checks counted opened state without proving the visible body
  matched official output.
- File/diff rows could pass near one anchor while failing at another anchor.
- Product code may still contain compatibility or copied code-server-shaped
  structures that are no longer appropriate for our own frontend architecture.

## Archived Clues From Reset 16

These reports are not acceptance evidence. They only seed Reset 17 investigation:

- `reference/legacy/20260707-false-positive-reset16-active-archive/live-anchor-alignment/20260707-024702/summary.json`
  - broad audit found `124` checks with `4` failures across `8` anchors.
  - one anchor around `现在首先,你先对浏览器截图...` indicated file/diff activity
    structure mismatch.
  - one anchor around the noVNC explanation indicated processed disclosure count
    mismatch.
  - two failures were source-side hit-test/probing issues and must be inspected
    before changing product code.
- `reference/legacy/20260707-false-positive-reset16-active-archive/live-anchor-alignment/20260707-024156/summary.json`
  - single-anchor pass for `启动脚本已放好`.
  - useful clue only; not full parity.

## Active Tasks

### R17-A0. Reset active work and quarantine false positives

Status: closed-admin

Scope:

- Move Reset 16 active work and evidence into legacy.
- Recreate empty Reset 17 active evidence directories.
- Rebuild this workfile with stricter acceptance language.

Acceptance:

- Administrative only. This accepts no UI parity.

### R17-A1. Prove live currentness before each visible audit

Status: in-progress

Problem:

- Target must be serving the same code being tested, but currentness alone is
  not UI acceptance.

Required work:

- Verify server HEAD, service status, asset version, browser console/page errors,
  and agent online state.
- Store Reset 17 reports under `reference/live-currentness/`.

Completion rule:

- This task can only support later UI evidence. It does not close visual parity.

Latest Reset 17 pre-audit evidence:

- Server sync before report:
  - repo HEAD: `91ee795`
  - `codex-web.service`: `active`
  - `codex-web-agent`: `Up 2 hours`
- Browser currentness report:
  `reference/live-currentness/20260707-025855/summary.json`
  - target URL: `https://codex.zelt.cn/?nodeId=host-docker-agent`
  - script version: `20260707024103`
  - css version: `20260707024103`
  - runtime version: `20260707024103`
  - HTML cache control: `no-cache`
  - console warnings/errors: `0`

Boundary:

- This only proves the browser can load the current live target without obvious
  console errors.
- It does not prove scroll behavior, disclosure click behavior, grouping,
  file/diff row parity, or full conversation parity.

### R17-A2. Restore long-session scroll and click stability

Status: open

Problem:

- The long conversation can show abnormal upward scrolling behavior.
- Expandable processed rows can be unclickable or fail to open.
- A page-wide drag-like surface appeared earlier and must not exist.

Required work:

- Reproduce on the live target using the long `分析一下codex-web` conversation.
- Verify upward scrolling from latest turns without jump, flicker, or pointer capture.
- Verify no overlay, drag surface, or invisible mask intercepts clicks.
- Verify processed disclosure rows expand by real mouse click.

### R17-A3. Match official processed disclosure grouping and placement

Status: open

Problem:

- Processed-time rows such as `已处理 XXs` must appear in the same position as
  the official extension.
- Collapsed and expanded bodies must match official structure.
- Custom command transcript details must be removed for the parity pass.

Required work:

- Compare official reference and target at the same text anchors.
- Expand matching rows in both browsers with real mouse clicks.
- Inspect official DOM/source for grouping rules where screenshots are unclear.

### R17-A4. Match official file and diff activity rows

Status: in-progress

Problem:

- Official extension renders file/diff changes as structured rows/blocks.
- Target can still render code/file details as plain text or wrong structures.

Required work:

- Capture official file/diff DOM and computed styles.
- Match labels, icons, row hierarchy, spacing, and collapse behavior at the same anchors.
- Ignore right-side diff viewer work unless it is required for the visible row parity.

Reset 17 live failures:

- Broad browser audit:
  `reference/live-anchor-alignment/20260707-025952/summary.json`
  - checks: `124`
  - failed: `5`
  - anchors: `8`
- Confirmed target-side file/diff structure failures:
  - anchor 3: `现在首先,你先对浏览器截图,并进行下载,也就是下载网站html与css之类的`
    - source: `1` activity row, file stats present, structured row present,
      action row present, label `已创建 1 个文件`
    - target: `1` activity row, file stats missing, structured row missing,
      action row missing, same label
  - anchor 8: `好,那么首先左侧侧边你要进行添加一个openai的扩展图标`
    - source: `1` structured row, file stats `2`, action row present, label
      `已编辑 2 个文件`
    - target: `2` unstructured rows, file stats missing, action rows missing,
      labels `已编辑 1 个文件 | 已编辑 1 个文件`
- Source-side hit-test probe failures in the same report:
  - anchor 3 source disclosure real mouse hit-test
  - anchor 4 source disclosure real mouse hit-test
  - anchor 8 source disclosure real mouse hit-test
  - These are not product fixes until inspected; they may be audit probing
    issues on the reference side.

Local change under test:

- `frontend/src/pages/codex/renderer.js`
  - file-change activity now renders through the official resource/diff card
    structure instead of the custom inline diff disclosure.
  - adjacent file-change summary items are grouped before rendering so two
    same-turn edited-file events can display as one `已编辑 2 个文件` card.
  - custom inline diff renderer functions were removed from this path.
  - file-change resource card header is now a real disclosure control, default
    expanded, so browser hit-testing can click the same kind of collapsible file
    activity surface as the official extension.
  - processed summary bodies now default to expanded, matching the reference
    anchors where file activity is browser-visible before extra user clicks.
- `frontend/src/pages/codex/panel-shadow.css`
  - removed stale `.codex-inline-diff*` styles from the parity renderer.
- `frontend/src/pages/codex/virtualizer.js`
  - file-change height estimation now follows card header + file rows, not full
    inline diff line count.

Local checks so far:

- `node --check frontend/src/pages/codex/renderer.js`: passed.
- `node --check frontend/src/pages/codex/virtualizer.js`: passed.
- `node --check frontend/src/pages/codex/activity-summary.js`: passed.
- `node scripts/audit-codex-activity-summary-rules.cjs`: passed.
- `node scripts/audit-codex-grouping-rules.cjs`: passed.
- `node scripts/audit-codex-event-mapping.cjs`: passed.
- `node scripts/audit-codex-file-diff.cjs`: failed before product evidence
  because the local fixture page did not expose
  `[data-codex-session-id='thread-reference']`. This does not prove or disprove
  live parity; Reset 17 live browser anchor evidence is still required.
- `C:\Program Files\Git\bin\bash.exe ./frontend/build.sh`: passed.
- `C:\Program Files\Git\bin\bash.exe ./build-all.sh`: passed.
- `C:\Program Files\Git\bin\bash.exe ./test-go.sh`: passed.

Post-deploy evidence before disclosure-control fix:

- Commit deployed: `5222d30`
- Browser currentness report:
  `reference/live-currentness/20260707-031556/summary.json`
  - runtime version: `20260707031544`
  - console warnings/errors: `0`
- Broad browser audit:
  `reference/live-anchor-alignment/20260707-031631/summary.json`
  - checks: `124`
  - failed: `12`
  - visible screenshot showed target file activity no longer rendered as inline
    code/diff, but audit still reported target file activity as missing because
    the target card did not expose a disclosure control equivalent.
  - follow-up fix: card header now carries `aria-expanded` and
    `data-disclosure-toggle`, while preserving the official resource-card visual
    structure.

Additional local checks after disclosure-control fix:

- `node --check frontend/src/pages/codex/renderer.js`: passed.
- `node --check frontend/src/pages/codex/virtualizer.js`: passed.
- `node scripts/audit-codex-activity-summary-rules.cjs`: passed.
- `C:\Program Files\Git\bin\bash.exe ./frontend/build.sh`: passed.
- `C:\Program Files\Git\bin\bash.exe ./build-all.sh`: passed.
- `C:\Program Files\Git\bin\bash.exe ./test-go.sh`: passed.

Post-deploy evidence after disclosure-control fix:

- Commit deployed: `16b8adb`
- Browser currentness report:
  `reference/live-currentness/20260707-032704/summary.json`
  - runtime version: `20260707032653`
  - console warnings/errors: `0`
- Targeted two-anchor audit:
  `reference/live-anchor-alignment/20260707-032935/summary.json`
  - checks: `33`
  - failed: `5`
  - screenshots showed target file cards were visually present after processed
    summary expansion, but target still failed file/diff parity because
    processed summary default state hid the file card before interaction while
    the reference anchors exposed file activity directly.
  - follow-up fix: processed summary bodies now default expanded.

Additional local checks after processed-default expansion:

- `node --check frontend/src/pages/codex/renderer.js`: passed.
- `node scripts/audit-codex-activity-summary-rules.cjs`: passed.
- `C:\Program Files\Git\bin\bash.exe ./frontend/build.sh`: passed.
- `C:\Program Files\Git\bin\bash.exe ./build-all.sh`: passed.
- `C:\Program Files\Git\bin\bash.exe ./test-go.sh`: passed.

### R17-A5. Audit and remove wrong renderer assumptions

Status: open

Problem:

- Earlier iterations may have left custom rows, fake grouping, code-server-shaped
  structures, or audit helpers that produce false confidence.

Required work:

- Review conversation renderer, styles, scripts, and audit tooling.
- Remove code that exists only to support failed approaches.
- Keep only structures needed for our frontend and official Codex visual behavior.

### R17-A6. Full newest-to-oldest parity sweep

Status: open

Problem:

- Passing isolated anchors is not enough.

Required work:

- Discover representative strong anchors across the full long conversation.
- Compare newest-to-oldest.
- For every expandable row in view, compare collapsed and expanded states.
- Add any mismatch as a concrete R17 task before fixing it.

Completion rule:

- This is not complete until multiple Reset 17 live reports and human-visible
  screenshots show no mismatches for the full sweep.

## Operating Procedure

For every future fix:

1. Add or update the relevant R17 task first.
2. Reproduce the failure in a real browser when possible.
3. Change product code or audit code only after the failure is concrete.
4. Run local checks for changed code.
5. Commit and push when the local change is ready.
6. Deploy to the server.
7. Prove live currentness.
8. Run same-anchor live browser comparison.
9. Keep the task open if there is any visible mismatch, click failure, scroll
   failure, console/page error, stale deployment, or unreviewed affected code.
