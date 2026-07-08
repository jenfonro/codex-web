# Codex Live Parity Worklist

Created: 2026-07-07 +08:00
Reset: 16
Status: active

This is the only active work file for Codex Web conversation parity.

Reset 16 exists because previous active work produced false positives. Some
scripts and screenshots reported progress, but the live browser-visible result
still did not meet the user's final standard. All Reset 15 active work and
evidence has been moved out of the active area.

## Archive Boundary

Moved out of active work:

- `reference/legacy/20260707-false-positive-reset15-active-archive/codex-live-parity-worklist.md`
- `reference/legacy/20260707-false-positive-reset15-active-archive/live-anchor-alignment/`
- `reference/legacy/20260707-false-positive-reset15-active-archive/live-currentness/`

Historical archives are clues only. They cannot close Reset 16 work:

- `reference/legacy/20260707-false-positive-reset14-active-archive/`
- `reference/legacy/20260707-false-positive-reset13-active-archive/`
- `reference/legacy/20260707-false-positive-reset12-active-archive/`
- `reference/legacy/20260707-false-positive-reset3/` through `reference/legacy/20260707-false-positive-reset12/`
- `reference/legacy/20260707-false-positive-workfiles/`
- `reference/legacy/20260707-live-parity-reset2/`

Active evidence directories have been recreated and must contain only Reset 16
evidence:

- `reference/live-anchor-alignment/`
- `reference/live-currentness/`

## Scope

- Target: `https://codex.zelt.cn/`
- Reference: `https://code-tx.zelt.cn/?folder=/root`
- Reference setup: Codex extension opened from the left Activity Bar icon.
- Reference setup: right chat/sidebar closed.
- Viewport: `1920x1080` or larger unless testing a responsive issue.
- Test conversation: the long conversation containing `分析一下codex-web`.
- Comparison direction: newest-to-oldest.
- Location rule: compare the same browser-visible text anchor in both products.
- Deployment rule: local success is not enough; target assets and agent data must be current.

## Status Meaning

- `open`: known work, no accepted live proof.
- `in-progress`: being investigated or changed now.
- `needs-live-proof`: code or tooling changed, but live parity is not proven.
- `blocked`: cannot proceed without an external state change.
- `accepted`: live target passed the full evidence gate below.
- `closed-admin`: administrative cleanup only; no product UI parity accepted.

Do not use `implemented`, `candidate`, `probably fixed`, or similar soft-success
labels for UI parity.

## Hard Rules

- Do not invent a similar UI.
- Do not mark anything complete from memory.
- Do not mark anything complete from source inspection alone.
- Do not mark anything complete from screenshots alone.
- Do not mark anything complete from green scripts alone.
- Do not reuse archived evidence as acceptance evidence.
- Do not hide wrong earlier code with compatibility patches.
- Do not keep first-pass command enhancements while matching the official view.
- Do not show `exec_command xN`, `write_stdin`, `Chunk ID`, shell transcript rows, or custom command rows in the parity pass.
- Do not add overlays, drag surfaces, invisible masks, or pointer blockers over the conversation.
- Do not treat long-session scroll failure as a drag or resizer problem.
- Do not fix long-session performance by truncating history, hiding rows, or losing old content.
- Do not accept repeated short anchors such as `./build-all.sh` unless nearby context proves reference and target are at the same conversation location.
- If the user reports a live issue while work is running, add it here before or alongside the fix, then verify it by the live gate.

## Acceptance Gate

Every UI parity item requires all evidence below before it can become
`accepted`:

- Same visible text anchor in reference and target.
- Proof both browsers are at the same conversation location.
- Reference and target screenshots before interaction.
- Reference and target screenshots after every relevant expand/collapse click.
- DOM structure, classes, attributes, and hierarchy for matched rows.
- Computed styles for text, spacing, color, font, border radius, overflow, dimensions, icons, and buttons.
- Real Playwright/CDP mouse click evidence, not synthetic state mutation.
- `elementFromPoint` evidence proving the click lands on the real control.
- Expanded body text and structure when the reference expands.
- Scroll evidence across the long conversation, especially upward scroll from the latest turns.
- Browser console and page-error evidence.
- Reference extension source or live DOM evidence when grouping rules are unclear.
- Local build/check evidence for changed code.
- Commit, push, deploy, service status, asset currentness, and agent-online evidence after deployed code changes.
- Human-visible review. If screenshots still visibly differ, the item stays `open`.

## Current Baseline

- Latest known deployed commit before this reset: `79ba003`.
- `79ba003` is not UI acceptance.
- Reset 15 evidence showed useful failures, but all of it is archived and cannot close Reset 16 work.
- No Reset 16 product UI item is accepted yet.

## Current User Reports

- The long conversation can still show abnormal scrolling behavior.
- `已处理 XXs` disclosure rows can be unclickable or fail to expand in the live page.
- A page-wide drag-like surface appeared earlier; that behavior must not exist.
- Processed-time grouping and placement must match the official Codex extension.
- File and diff activity must render as official block/list rows, not plain text.
- Extra command transcript summaries should be removed for the parity pass.

## Active Work

### R16-F0. Workfile reset and false-positive quarantine

Status: closed-admin

Scope:

- Administrative only. This accepts no product UI parity.

Done:

- Archived Reset 15 active work file and evidence directories.
- Recreated active Reset 16 evidence directories.
- Rebuilt this work file with stricter acceptance rules.

### R16-F1. Live currentness and agent freshness

Status: accepted

Problem:

- Target must be proven to serve the current bundle before any UI comparison.
- Agent/session data must be current when renderer behavior depends on session events.

Required work:

- Verify server HEAD, service status, asset version, browser console/page errors, and agent online state.
- Store the Reset 16 report in `reference/live-currentness/`.

Acceptance:

- Report proves current deployed code, fresh assets, live agent, and zero blocking browser errors.

Evidence:

- Browser currentness report:
  `reference/live-currentness/20260707-020356/summary.json`
- Target URL: `https://codex.zelt.cn/?nodeId=host-docker-agent`
- Asset versions:
  - script: `20260707015454`
  - css: `20260707015454`
  - runtime: `20260707015454`
- HTML cache control: `no-cache`
- Browser console warnings/errors: `0`
- Page errors: `0`
- Failed HTTP responses: `0`
- Server SSH check:
  - repo HEAD: `79ba003`
  - `codex-web.service`: `active`
  - `codex-web-agent`: `Up About an hour`
  - remote git status: clean

Boundary:

- This accepts only currentness and agent freshness.
- It does not accept any UI parity, scroll behavior, click behavior, grouping,
  file/diff row rendering, or visual match.

### R16-F2. Browser-visible audit method rebuild

Status: accepted

Problem:

- Previous audits selected wrong or stale anchors and produced false positives.

Required work:

- Use exact visible text ranges, not parent turn containers.
- Reject ambiguous anchors unless surrounding text proves same conversation location.
- Record screenshots, DOM target debug, computed styles, `elementFromPoint`, and real mouse clicks.
- Start with a small set of strong anchors, then expand newest-to-oldest.

Acceptance:

- Reset 16 audit can prove exact-anchor alignment without accepting any mismatched viewport.

Evidence:

- Reset 16 anchor report:
  `reference/live-anchor-alignment/20260707-020512/summary.json`
- Result: failed, `33 checks`, `2 failed`.
- Anchor `启动脚本已放好`:
  - source context found
  - target context found
  - same visible text anchor appears in both screenshots
  - target API mapped anchor to `seq 6979`
  - real mouse disclosure probes ran on both sides
  - not accepted because visible file activity order/labels still differ
- Anchor `start.sh +5 -5`:
  - rejected as ambiguous context
  - context comparison failed with `score=0.000`
- Audit script refinement after deploy:
  - context comparison now distinguishes strong prose anchors from file-like
    short anchors
  - strong prose anchors require exact visible text on both sides and target API
    anchor match
  - file-like anchors still require surrounding context and cannot pass only by
    text presence
  - visible file label parity now compares an anchor-near band instead of the
    whole viewport, avoiding false failures when the same anchor is at a
    different vertical offset
- Reset 16 strong-anchor report:
  `reference/live-anchor-alignment/20260707-023745/summary.json`
  - `17 checks`, `0 failed`, `1 anchor`
  - anchor: `启动脚本已放好`
- Final strong-anchor report after deploying latest `370706c`:
  `reference/live-anchor-alignment/20260707-024156/summary.json`
  - `17 checks`, `0 failed`, `1 anchor`
  - anchor: `启动脚本已放好`
  - target API mapped anchor to `seq 6979`

Boundary:

- This accepts the current strong-prose-anchor audit method only.
- It does not accept the full UI parity sweep.
- File-like or short anchors such as `start.sh +5 -5` remain non-acceptance
  anchors unless stronger surrounding context proves the same location.

### R16-F3. Long conversation scroll and click stability

Status: open

Problem:

- Long sessions must scroll normally and keep expandable controls clickable.

Required work:

- Reproduce on the live target using the long `分析一下codex-web` conversation.
- Verify upward scrolling from latest turns.
- Verify no overlay, drag surface, or pointer blocker intercepts conversation clicks.
- Verify `已处理 XXs` expands by real click.

Acceptance:

- Live Reset 16 evidence shows stable scroll and successful click expansion at multiple anchors.

### R16-F4. `已处理 XXs` grouping, placement, and expanded body

Status: open

Problem:

- Processed-time rows must match official grouping and placement.
- Expanded content must match official structure, not custom command transcript output.

Required work:

- Compare official reference and target at the same text anchors.
- Inspect official DOM/source for grouping rules when screenshots are insufficient.
- Remove command transcript enhancements during parity pass.

Acceptance:

- Collapsed and expanded states match official display at the same anchors.

### R16-F5. File and diff activity row rendering

Status: needs-live-proof

Problem:

- Official extension renders file/diff changes as structured block/list rows.
- Target currently can render code or file information as plain text in some locations.

Required work:

- Capture official file/diff DOM and computed styles.
- Match grouping labels such as edited/created file counts only when the same conversation location is proven.
- Do not add right-side diff viewer work in this pass unless required for the visible row parity.

Acceptance:

- File/diff activity rows visibly match official rows at the same anchors.

Current evidence:

- Report `reference/live-anchor-alignment/20260707-020512/summary.json`
  showed a same-anchor mismatch around `启动脚本已放好`.
- Source screenshot shows official file activity preserving source event order:
  created file block before `启动脚本已放好`, then edited file block later.
- Target screenshot showed file activity appended out of order, with visible
  `已创建 2 个文件` where the reference visible label was `已编辑 1 个文件`.
- Target API event order around the anchor:
  - `6978 file_change 已创建 2 个文件`
  - `6979 assistant_message 启动脚本已放好`
  - `6998 file_change 已编辑 1 个文件`
- Root cause found in `frontend/src/pages/codex/activity-summary.js`:
  `file_change` events were split into `detailEvents` and rendered after the
  processed summary body, instead of staying in the processed summary item flow.

Local change:

- `file_change` events now become `summaryItems` with type `activity`.
- File activity is removed from appended `detailEvents` when already included
  in the processed summary.
- Settled commentary without explicit final answer stays in the processed body
  in original order instead of being merged into a pseudo final answer.

Local checks:

- `node --check frontend/src/pages/codex/activity-summary.js`: passed.
- `node --check scripts/audit-codex-activity-summary-rules.cjs`: passed.
- `node scripts/audit-codex-activity-summary-rules.cjs`: passed.
- `node scripts/audit-codex-grouping-rules.cjs`: passed.
- `node scripts/audit-codex-event-mapping.cjs`: passed.
- `C:\Program Files\Git\bin\bash.exe ./frontend/build.sh`: passed.
- `C:\Program Files\Git\bin\bash.exe ./build-all.sh`: passed.
- `C:\Program Files\Git\bin\bash.exe ./test-go.sh`: passed.

Not accepted:

- Full file/diff parity is not accepted globally.
- The strong anchor `启动脚本已放好` passed after deploy, but the whole long
  conversation still needs a newest-to-oldest sweep with more strong anchors.

Post-deploy evidence:

- Commit deployed for product change: `efdb688`
- Latest server HEAD after workfile/audit-script sync: `370706c`
- Live currentness:
  `reference/live-currentness/20260707-022154/summary.json`
  - asset/runtime version: `20260707022131`
  - console warnings/errors: `0`
- Final live currentness after latest deploy:
  `reference/live-currentness/20260707-024119/summary.json`
  - asset/runtime version: `20260707024103`
  - console warnings/errors: `0`
- Strong-anchor audit:
  `reference/live-anchor-alignment/20260707-023745/summary.json`
  - `17 checks`, `0 failed`
  - anchor: `启动脚本已放好`
  - target API mapped anchor to `seq 6979`
  - processed disclosure expansion parity passed
  - file/diff activity row parity passed
  - anchor-near visible file label parity passed
- Final strong-anchor audit after latest deploy:
  `reference/live-anchor-alignment/20260707-024156/summary.json`
  - `17 checks`, `0 failed`
  - anchor: `启动脚本已放好`
  - target API mapped anchor to `seq 6979`
  - processed disclosure expansion parity passed
  - file/diff activity row parity passed
  - anchor-near visible file label parity passed
- Mixed-anchor audit:
  `reference/live-anchor-alignment/20260707-023458/summary.json`
  - `33 checks`, `1 failed`
  - only failure: `start.sh +5 -5` context mismatch
  - this short file-like anchor is not accepted as a parity anchor

Known non-blocking local audit issues:

- `node scripts/audit-codex-virtual-scroll.cjs` failed because the local
  browser state did not expose `[data-codex-view='thread']`.
- `node scripts/audit-codex-dom-structure.cjs` failed because the historical
  `reference/windows-captures/.../runtime.json` file is absent locally.

### R16-F6. Remove wrong legacy renderer assumptions

Status: open

Problem:

- Earlier work may still contain wrong UI assumptions, copied compatibility code, or custom structures from failed attempts.

Required work:

- Audit renderer, styles, scripts, and generated references for code that creates false-positive UI or test behavior.
- Remove or simplify code that exists only to support the wrong display model.
- Keep the current global code-server-like shell only where it is actually part of the accepted direction.

Acceptance:

- Code review confirms no custom command transcript rows, overlays, fake expand behavior, or stale code-server naming assumptions affect conversation parity.

### R16-F7. End-to-end newest-to-oldest parity sweep

Status: open

Problem:

- Passing one anchor is not enough. The full long conversation must be compared through representative anchors.

Required work:

- Use the same visible text anchors in reference and target.
- Compare newest-to-oldest.
- For every expandable row in view, compare collapsed and expanded states.
- Record mismatches as new R16 items before fixing them.

Acceptance:

- Multiple Reset 16 anchor reports pass without visible mismatches, and human-visible review agrees.

## Operating Procedure

For every fix:

1. Add or update the relevant R16 item before or alongside the change.
2. Change product code or audit code only after the failure is concrete.
3. Run local checks for changed code.
4. Commit and push when the local change is ready.
5. Deploy to the server.
6. Prove live currentness.
7. Run browser-visible same-anchor comparison.
8. Mark an item `accepted` only after the full acceptance gate passes.
