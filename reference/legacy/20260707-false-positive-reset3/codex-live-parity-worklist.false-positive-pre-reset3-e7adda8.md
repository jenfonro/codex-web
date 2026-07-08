# Codex Live Parity Active Worklist

Created: 2026-07-07 +08:00
Reset: 2
Reason: previous active work mixed single-anchor passes, stale audit output, and false-positive conclusions. This file is the only active work file from now on.

## Non-Negotiable Rule

Nothing is complete until the live target matches the live code-server Codex extension at the same visible text anchors across the long conversation.

Single-anchor success, static screenshots, local-only checks, generated fixtures, or audit output with missing visible anchors are progress notes only. They are never acceptance.

## Source Of Truth

- Source: `https://code-tx.zelt.cn/?folder=/root`
- Target: `https://codex.zelt.cn/`
- Viewport: `1920x1080` or larger.
- Source must open Codex from the left Activity Bar icon.
- Source right chat/auxiliary sidebar must be closed.
- Source panel width must be recorded. If possible, keep it near the user's real width, about `611px` on the user's 2K display.
- The target must be the deployed online build the user can refresh and test.

## Acceptance Evidence Required For Every Closed Item

Every closed task must include all of these:

- Same visible text anchor in source and target.
- Proof both views are at the same conversation location.
- Source and target screenshots for the anchor.
- DOM structure, class names, and relevant attributes for matched elements.
- Computed styles for rows, text, disclosure buttons, file rows, spacing, dimensions, overflow, and clickable controls.
- Real browser click evidence for every expandable row, using browser input or CDP mouse events, not synthetic DOM events.
- Before-click and after-click states for collapsible rows.
- Expanded body structure and text when the official source expands.
- Scroll evidence for long conversation windows.
- Hit-test evidence that `elementFromPoint` lands on the real clickable row/control, not an overlay, drag surface, invisible mask, or stale node.
- Console/error evidence.
- Local build/test evidence when code changed.
- Commit, push, deploy, service status, and agent online evidence when deployed code changed.

## Hard Boundaries

- Do not invent a similar UI.
- Do not keep Codex Web-only display enhancements during first-pass parity.
- Do not show `exec_command xN`, `write_stdin`, raw `Chunk ID`, shell transcripts, or command enhancement rows unless the official source shows the same thing at the same anchor.
- Do not add overlays, drag surfaces, invisible masks, or pointer blockers over the conversation.
- Do not treat API text matches as visual matches. If the anchor is in API data but not visibly located, the check fails.
- Do not solve long conversation problems by truncating content.
- Do not hide scroll problems with clipping or reduced history.
- Do not mark a task complete from memory.
- If an audit creates a false positive, fix the audit first and mark the affected result invalid.
- If code conflicts with official behavior, rewrite or remove it. Do not patch around it.

## Current Repository State

- Local branch: `main`
- Observed head during this reset: `e7adda8 fix: harden live anchor parity audit`
- Active work file: `reference/codex-live-parity-worklist.md`
- Archived previous active work file:
  - `reference/legacy/20260707-live-parity-reset2/codex-live-parity-worklist.false-positive-pre-reset2-e7adda8.md`
- Existing older false-positive work files:
  - `reference/legacy/20260707-false-positive-workfiles/`
  - `reference/legacy/codex-collapse-alignment-worklist.false-positive-archive-20260707.md`
- Current dirty generated files observed before this reset:
  - `reference/codex-reference/virtual-scroll-audit.json`
  - `reference/codex-reference/virtual-scroll-audit.md`

## Invalid Or Limited Evidence

These materials may be used as clues only. They do not close parity:

- `reference/live-anchor-alignment/20260706-190822/summary.json`
- `reference/live-anchor-alignment/20260706-191920/summary.json`
- `reference/live-anchor-alignment/20260706-192020/summary.json`
- Any other single-anchor pass.
- `reference/live-anchor-alignment/20260706-192158/summary.json`
- `reference/live-anchor-alignment/20260706-192805/summary.json`
- `reference/live-anchor-alignment/20260706-193715/summary.json`
- `reference/live-anchor-alignment/20260706-193919/summary.json`
- `reference/live-anchor-alignment/20260706-194126/summary.json`
- Old `reference/codex-reference/*audit*` outputs unless a fresh task explicitly validates them.

Reason:
- Single-anchor reports can pass while older anchors still fail.
- Latest multi-anchor reports still fail.
- Some summary files are not reliable parseable JSON in PowerShell and contain mojibake anchors.
- API text preflight does not prove visible browser parity.
- `20260706-193715` and `20260706-193919` failed because the audit script had a browser-expression scope error: `ReferenceError: visualRect is not defined`.
- `20260706-194126` was useful debugging evidence, but it did not record source panel width and still had one target-visible failure before focus visibility waiting was added.

## Current Known Failures

Status: all open.

1. Long conversation target scrolling is not proven stable.
2. Target can contain anchor text in API data while visible centering fails.
3. Some processed rows cannot be trusted as clickable until real hit-test and before/after state are recorded.
4. Processed-row grouping, duration placement, collapse text, and expanded body are not fully aligned.
5. File/diff activity rows are not fully aligned; raw code/text rendering must be replaced where the source shows file/diff rows.
6. Codex Web command-enhancement output must remain removed from first-pass parity.
7. Any overlay/drag-surface behavior over the conversation is invalid.
8. Whole-conversation newest-to-oldest parity is not complete.

## Work Board

### P0. Rebuild The Audit Baseline

Status: completed

Goal:
- Make the audit fail loudly when a target anchor is not visibly found, when the selected node has a zero-size rect, or when the source has expandable/file/diff rows and the target viewport does not.

Required work:
- Fix target locator selection to prefer visible nonzero rect candidates.
- If a text node or stale child has zero rect, climb to the visible turn/card/control and record that fallback.
- Record selected candidate selector/class/text/rect/scroll container state.
- Store readable anchor text next to raw data.
- Reject a run when any accepted anchor has missing visible target evidence.

Verification:
- Run a multi-anchor live audit with at least three anchors in one run.
- The run must either pass all accepted anchors or clearly list failures without false pass labels.

Closure:

```text
Task: P0. Rebuild The Audit Baseline
Status: completed
Source URL: https://code-tx.zelt.cn/?folder=/root
Target URL: https://codex.zelt.cn/?nodeId=host-docker-agent&anchorRun=20260706-194749
Viewport: 1920x1080
Source panel width: source context viewportWidth=610, conversationRect.width=563
Source anchor: 3 anchors in one newest-to-oldest live run:
  1. 首先第一,你现在应该能看到我们前端左侧那个文件列表的吧
  2. 首先第一个问题,对话框被你做到了右侧内容区,按照code-server 他不应该是在左侧可以拖动宽度里面吗,然后第二,你现在压根不是复刻,首先你需要直接reset 你先进行清理 我来告诉你下一步
  3. 你为什么自作主张给我加了密码的相关样式 我现在完全不需要认证!
Target anchor: same 3 visible anchors on target
Context comparability: report checks all passed; 37 checks, 0 failed, 3 anchors
Before-click state: target-anchor-1/2/3-before-click.png captured
After-click state: target-anchor-1/2/3-after-click.png captured
Expanded body comparison: processed disclosure parity passed for all 3 matched turns
DOM/class evidence: summary.json records matchedAnchorTarget selector/class/text/rect and focusTurn data
Computed-style evidence: disclosure probes record control/body style samples
Hit-test evidence: real CDP mouse clicks passed for all 3 target processed rows; each had controls=1, clicked=1, blocked=0
Scroll evidence: focusVisibleWait=true for target seq 6880, 6839, 6700; focusTurn rects in viewport
Console evidence: no failed audit checks; no fatal browser-side expression errors in final run
Screenshot paths:
  reference/live-anchor-alignment/20260706-194749/source-anchor-1.png
  reference/live-anchor-alignment/20260706-194749/source-anchor-2.png
  reference/live-anchor-alignment/20260706-194749/source-anchor-3.png
  reference/live-anchor-alignment/20260706-194749/target-anchor-1.png
  reference/live-anchor-alignment/20260706-194749/target-anchor-2.png
  reference/live-anchor-alignment/20260706-194749/target-anchor-3.png
  reference/live-anchor-alignment/20260706-194749/target-anchor-1-before-click.png
  reference/live-anchor-alignment/20260706-194749/target-anchor-1-after-click.png
  reference/live-anchor-alignment/20260706-194749/target-anchor-2-before-click.png
  reference/live-anchor-alignment/20260706-194749/target-anchor-2-after-click.png
  reference/live-anchor-alignment/20260706-194749/target-anchor-3-before-click.png
  reference/live-anchor-alignment/20260706-194749/target-anchor-3-after-click.png
Command/build evidence: node --check scripts\audit-codex-live-anchor-alignment.cjs
Report path: reference/live-anchor-alignment/20260706-194749/summary.json
Commit: not committed yet
Deployment: not required for audit script-only change
Result: audit baseline no longer accepts API-only or zero-rect target matches; it records visible candidate rects, focus visibility, and real click evidence.
Remaining risk: this closes only the audit baseline. It does not close full long-conversation parity, file/diff row parity, or whole-conversation newest-to-oldest sweep.
```

### P0. Long Conversation Scroll And Click Baseline

Status: open

Goal:
- The long conversation must scroll newest-to-oldest without flicker loops, stuck scroll, white screen, or phantom drag behavior.

Required work:
- Reproduce on the deployed target, not only local.
- Verify mouse wheel scrolling across multiple anchor windows.
- Verify processed-row click coordinates with `elementFromPoint`.
- Verify clicking `已处理` opens/closes the real row.
- Confirm no invisible overlay or drag surface captures pointer events.

Verification:
- Source and target screenshots before and after row expansion.
- CDP or Playwright click evidence.
- Console has no fatal render errors.

### P0. Processed Row Grouping And Expansion

Status: open

Goal:
- Match official processed summary rows: grouping, label, duration placement, disclosure icon, collapsed text, expanded body, spacing, and interaction.

Required work:
- Use at least three same-anchor processed rows in the long conversation.
- Compare collapsed and expanded states.
- Remove any command-enhancement text from these rows unless source shows it.
- Ensure running/finished states update correctly after returning from list to conversation.

Verification:
- Same anchor source/target screenshots.
- DOM/classes/computed styles.
- Real click before/after evidence.

### P0. File And Diff Activity Rows

Status: open

Goal:
- When the official source shows file/diff activity rows, target must show equivalent block-style rows, not raw plain text/code dumps.

Required work:
- Identify source event/grouping rules from extension code or live DOM.
- Map target session events to the same row types.
- Match file path text, icon/indicator, row shape, spacing, collapse behavior, and overflow behavior.
- Opening a right-side diff viewer can stay future work, but the row display must match first.

Verification:
- Same text anchor where source has file/diff rows.
- Source/target screenshots and DOM/style evidence.

### P0. Remove First-Pass Parity Enhancements

Status: open

Goal:
- First-pass parity must not include Codex Web-only command summaries or shell transcript rows.

Required work:
- Scan renderer paths for command-enhancement output.
- Remove or disable from the parity render path.
- Keep data internally only if needed, without rendering it.

Verification:
- Code scan evidence.
- Live same-anchor evidence showing no extra command block where source has none.

### P1. Whole Conversation Same-Anchor Sweep

Status: open

Goal:
- Validate the whole long conversation, newest to oldest, using accepted visible text anchors.

Required work:
- Build an anchor inventory containing user messages, processed rows, file/diff rows, final answers, and running/thinking states when available.
- Reject duplicate or non-comparable anchors with reasons.
- Compare each accepted window with source/target screenshots, DOM/style, interaction, and scroll evidence.
- Stop on the first real mismatch, fix it, then rerun the same anchor and neighboring anchors.

Verification:
- A full report with no accepted-anchor failures.

### P1. Legacy And Wrong Code Cleanup

Status: open

Goal:
- Remove wrong code left from earlier near-match attempts.

Required work:
- Scan frontend and scripts for stale fixture-only helpers, code-server-only naming that no longer matches our architecture, static render paths, wrong grouping branches, and compatibility patches.
- Remove or refactor only after confirming the live behavior stays aligned.

Verification:
- Build passes.
- Live browser checks prove no visual or interaction regression.

## Required Live Verification Flow

1. Check `git status --short --branch`.
2. Confirm deployed server is at the intended commit.
3. Confirm server build was run on the server.
4. Confirm `codex-web.service` is active.
5. Confirm `/api/nodes` shows the expected agent online.
6. Open source at `https://code-tx.zelt.cn/?folder=/root`.
7. Open Codex from the left Activity Bar icon.
8. Close the source right chat/auxiliary sidebar.
9. Set viewport to at least `1920x1080`.
10. Record source panel width.
11. Open target at `https://codex.zelt.cn/`.
12. Select the same long conversation on both sides.
13. Work newest-to-oldest using identical visible text anchors.
14. For every expandable row, click source and target with real browser input and record before/after state.
15. Compare screenshots, DOM/classes, computed styles, hit-test, console, and scroll behavior.
16. Fix the first real blocker.
17. Rerun the same anchor and nearby anchors.
18. Commit, push, deploy, and record evidence only after code changes are verified.

## Closure Template

Use this exact block when closing any item:

```text
Task:
Status:
Source URL:
Target URL:
Viewport:
Source panel width:
Source anchor:
Target anchor:
Context comparability:
Before-click state:
After-click state:
Expanded body comparison:
DOM/class evidence:
Computed-style evidence:
Hit-test evidence:
Scroll evidence:
Console evidence:
Screenshot paths:
Command/build evidence:
Report path:
Commit:
Deployment:
Result:
Remaining risk:
```

## Reset Log

### 2026-07-07 +08:00

Action:
- Archived the previous active work file to `reference/legacy/20260707-live-parity-reset2/codex-live-parity-worklist.false-positive-pre-reset2-e7adda8.md`.
- Rebuilt this file as the only active acceptance worklist.
- Marked all UI parity tasks open.
- Marked single-anchor passes and failing multi-anchor reports as clues only, not acceptance.

Result:
- No UI parity task is closed.
- Next implementation work must start from `P0. Rebuild The Audit Baseline` or a concrete user-reported live blocker.

### 2026-07-07 +08:00

Action:
- Hardened `scripts/audit-codex-live-anchor-alignment.cjs`:
  - browser-side visibility checks now use connected nonzero visual rectangles from `getBoundingClientRect` and `getClientRects`;
  - target anchor selection records selector, class, text sample, rect, candidate count, and fallback match;
  - target focus waits until the focused turn is actually visible inside `[data-thread-scroll]`;
  - focus evidence now records `focusVisibleWait`, focus turn seqs, rect, and viewport intersection;
  - context probe now records source/target viewport width and conversation rect.
- Ran live audits and invalidated the scope-error runs:
  - `reference/live-anchor-alignment/20260706-193715/summary.json`: invalid, `visualRect is not defined`;
  - `reference/live-anchor-alignment/20260706-193919/summary.json`: invalid, `visualRect is not defined`;
  - `reference/live-anchor-alignment/20260706-194126/summary.json`: debugging evidence only, 3 failed before focus visibility wait and panel-width recording.
- Final validation report:
  - `reference/live-anchor-alignment/20260706-194749/summary.json`;
  - `37 checks`, `0 failed`, `3 anchors`;
  - source context `viewportWidth=610`, `conversationRect.width=563`;
  - target context `viewportWidth=610`, `conversationRect.width=563`;
  - real target click evidence for all 3 processed rows: `controls=1`, `clicked=1`, `blocked=0`;
  - target focus visibility passed for seq `6880`, `6839`, and `6700`.

Result:
- `P0. Rebuild The Audit Baseline` is closed.
- All visual parity work remains open until whole-conversation same-anchor sweep and specific file/diff/grouping checks pass.
