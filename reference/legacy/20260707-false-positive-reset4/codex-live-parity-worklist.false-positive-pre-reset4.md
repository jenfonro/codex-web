# Codex Live Parity Worklist

Created: 2026-07-07 +08:00
Reset: 3
Reason: previous work files and audit reports produced false positives. In particular, reports with `0 failed` still missed visible file/diff grouping differences. This file replaces those records as the only active work file.

## Current Rule

No conversation-rendering task is complete until the deployed Codex Web page visually matches the live code-server Codex extension at the same visible text anchor.

Script output is supporting evidence only. If a report passes but source and target screenshots, DOM, computed styles, click behavior, or grouping rules differ, the report is a false positive and the task remains open.

## Source Of Truth

- Source: `https://code-tx.zelt.cn/?folder=/root`
- Target: `https://codex.zelt.cn/`
- Viewport: `1920x1080` or larger.
- Source Codex must be opened from the left Activity Bar icon.
- Source right chat/auxiliary sidebar must be closed.
- Source panel width must be recorded for every run. Prefer the user's real width, about `611px` on a 2K display.
- Target must be the online deployed build the user can refresh and test.
- The compared conversation must be the same long conversation, located by the same visible text anchors.

## Active File Policy

This is the only active work file.

Archived or invalidated work files are history only:

- `reference/legacy/20260707-false-positive-workfiles/`
- `reference/legacy/20260707-live-parity-reset2/`
- `reference/legacy/20260707-false-positive-reset3/`
- `reference/legacy/codex-collapse-alignment-worklist.false-positive-archive-20260707.md`

Do not use checked items, pass labels, or completed statuses from those files as acceptance. They can only be used as clues.

## Invalidated Evidence

These reports are not accepted as parity closure:

- `reference/live-anchor-alignment/20260706-194749/summary.json`
  - Invalid as product parity. It improved visible-anchor matching, but it did not prove file/diff grouping parity.
- `reference/live-anchor-alignment/20260706-195153/summary.json`
  - Invalid as product parity. It reported `0 failed`, but anchor screenshots exposed a false negative: source had file/diff activity rows and target did not render the same matched-turn structure.
- `reference/live-anchor-alignment/20260706-193715/summary.json`
  - Invalid. Browser expression failed with `ReferenceError: visualRect is not defined`.
- `reference/live-anchor-alignment/20260706-193919/summary.json`
  - Invalid. Browser expression failed with `ReferenceError: visualRect is not defined`.
- `reference/live-anchor-alignment/20260706-194126/summary.json`
  - Debugging evidence only. It was produced before the focus-visible and panel-width evidence was reliable.
- Any single-anchor pass.
- Any local-only screenshot, fixture, generated audit, or API text match without visible same-anchor browser evidence.

## Non-Negotiable Boundaries

- Do not invent a similar UI.
- Do not keep first-pass Codex Web-only enhancements when the official source does not show them at the same anchor.
- Do not show `exec_command xN`, `write_stdin`, raw `Chunk ID`, shell transcripts, or command enhancement rows during first-pass parity unless the source shows the same element in the same position.
- Do not add overlays, drag surfaces, invisible masks, or pointer blockers over the conversation.
- Do not solve long conversation problems by truncating history.
- Do not hide scroll problems with clipping, reduced content, or reduced history.
- Do not mark a task complete from memory.
- If an audit creates a false positive, fix the audit before using it again.
- If old code conflicts with official behavior, rewrite or remove it instead of patching around it.

## Required Closure Evidence

Every closed item must record all of this:

- Same visible text anchor in source and target.
- Proof both views are at the same conversation location.
- Source and target screenshots before interaction.
- Source and target screenshots after every relevant click/expand/collapse action.
- DOM structure, class names, attributes, and element hierarchy for matched rows.
- Computed styles for text, rows, disclosure controls, file rows, code/diff rows, spacing, overflow, dimensions, border radius, colors, and fonts.
- Real browser click evidence using Playwright/CDP mouse input, not synthetic DOM events.
- `elementFromPoint` evidence showing the click lands on the real control, not an overlay or stale element.
- Expanded-body text and structure when source expands.
- Scroll evidence across the long conversation.
- Browser console and page error evidence.
- Source extension code or live DOM evidence when grouping rules are unclear.
- Local check/build evidence for code changes.
- Commit, push, deployment, service status, and agent online evidence when deployed code changes.

## Required Workflow Per Anchor

1. Pick a visible source anchor from newest to oldest in the long conversation.
2. Capture source screenshot, DOM, computed styles, panel width, and scroll state.
3. Locate the same anchor visibly in target. API/session data match is not enough.
4. Capture target screenshot, DOM, computed styles, panel width, and scroll state.
5. Compare row grouping, row order, labels, duration placement, disclosure state, file/diff rows, text wrapping, spacing, and icons.
6. For every expandable row visible in source, click source and target with real mouse input and capture before/after states.
7. If the target differs, update the task list before implementing.
8. Implement the smallest product change that aligns with official behavior.
9. Run local validation.
10. Deploy to the online target when code changed.
11. Rerun the same anchor validation online.
12. Only then record closure evidence.

## Current Known Failures

All items below are open.

- Long conversation scrolling and click stability are not proven across the whole conversation.
- Some previous checks matched anchor text in data or stale nodes rather than proving visible browser parity.
- `已处理` grouping, duration placement, collapsed text, expanded body, and running/finished state transitions are not fully proven.
- File/diff activity rows are not aligned. Source shows block-style file rows such as `已编辑 1 个文件` and `app.go +5 -103`; target has rendered some of this context as processed text or the wrong grouping.
- Raw code/text blocks appear where the official source renders structured file/diff activity blocks.
- Codex Web command-enhancement output must stay removed until first-pass parity is complete.
- Previous overlay/drag-surface behavior over the conversation is invalid and must not reappear.
- Whole-conversation newest-to-oldest parity has not been completed.
- Previous commits may contain code added for wrong assumptions. That code must be audited and removed or rewritten when it conflicts with official behavior.

## Anchor Queue

Use these first, then continue newest-to-oldest through the same long conversation:

- `./build-all.sh`
- `你为什么自作主张给我加了密码的相关样式 我现在完全不需要认证!`
- `分析一下codex-web 现在我还有问题`
- `首先第一个问题,对话框被你做到了右侧内容区`
- `现在首先,你先对浏览器截图,并进行下载`
- `启动一个带远程调试或 noVNC 的浏览器实例`

For each anchor, compare both collapsed and expanded states if the official source exposes expandable rows near that anchor.

## Work Board

### P0. Fix Audit False Negatives

Status: in progress

Goal:
- The audit must fail when source and target screenshots or DOM expose different grouping, even if broad text/file references exist on both sides.

Current action:
- Strengthen `scripts/audit-codex-live-anchor-alignment.cjs` so matched-turn non-processed activity rows and file/diff rows are compared separately from processed-summary text.
- Known false-negative anchor: `你为什么自作主张给我加了密码的相关样式 我现在完全不需要认证!`.

Evidence:
- `node --check scripts\audit-codex-live-anchor-alignment.cjs` passed.
- Live report `reference/live-anchor-alignment/20260706-200810/summary.json` now fails the known false-positive anchor before product rendering changes:
  - `anchor 1 non-processed activity row structure parity`
  - `anchor 1 file/diff activity row parity`
  - Source matched turn: `7` non-processed file activity rows, including `已编辑 1 个文件`.
  - Target matched turn: `0` non-processed file activity rows.
  - Screenshots:
    - `reference/live-anchor-alignment/20260706-200810/source-anchor-1.png`
    - `reference/live-anchor-alignment/20260706-200810/target-anchor-1.png`
    - `reference/live-anchor-alignment/20260706-200810/target-anchor-1-before-click.png`
    - `reference/live-anchor-alignment/20260706-200810/target-anchor-1-after-click.png`

Required work:
- Add same-turn disclosure structure comparison.
- Detect non-processed source activity rows such as file-change rows.
- Fail if source has file/diff activity rows and target lacks equivalent matched-turn rows.
- Store readable labels and row hierarchy for every matched disclosure/activity row.
- Keep screenshot paths and click evidence tied to each compared row.

Acceptance:
- Rerun the false-negative anchor `你为什么自作主张给我加了密码的相关样式 我现在完全不需要认证!`.
- The current mismatch must fail before product code is changed.
- After product code is changed, the same anchor must pass with visual evidence.

### P0. Long Conversation Scroll And Click Stability

Status: open

Goal:
- The long conversation must scroll newest-to-oldest without flicker loops, stuck scroll, white screen, phantom drag behavior, or click blockers.

Required work:
- Reproduce on the deployed target.
- Wheel-scroll through multiple anchor windows.
- Verify `已处理` rows can be clicked open and closed.
- Verify `elementFromPoint` at click coordinates returns the real control or row.
- Confirm no overlay, drag surface, or invisible element captures pointer events.

Acceptance:
- Same-anchor source/target screenshots before and after expansion.
- CDP/Playwright click evidence.
- Console/page-error evidence.

### P0. Processed Row Parity

Status: open

Goal:
- Match official `已处理` rows: grouping, row order, label, duration placement, disclosure icon, collapsed state, expanded body, spacing, and running/finished updates.

Required work:
- Compare at least three processed rows from different locations in the long conversation.
- Remove command-enhancement text from processed rows for first-pass parity.
- Ensure completed sessions do not keep stale `正在思考` or running indicators after returning from the list.

Acceptance:
- Same-anchor screenshots and DOM/style evidence for collapsed and expanded states.
- Real click before/after evidence for every compared expandable row.

### P0. File And Diff Activity Row Parity

Status: open

Goal:
- When source shows file/diff activity blocks, target must show equivalent structured rows, not raw plain text/code dumps or swallowed processed-summary text.

Required work:
- Read source extension code or inspect live DOM for grouping rules.
- Map target `file_change` events to the same visible row structure.
- Match labels such as `已编辑 1 个文件`, file rows such as `app.go +5 -103`, spacing, icons, overflow, and disclosure behavior.
- Defer the right-side diff viewer if needed, but row display must match first.

Acceptance:
- Same-anchor source/target screenshots where source has file/diff rows.
- DOM/class/style comparison for file rows.
- Expanded/collapsed evidence if the source row expands.

### P0. Remove Or Rewrite Wrong Previous UI Code

Status: open

Goal:
- Audit prior changes made under incorrect assumptions and remove code that conflicts with official behavior.

Required work:
- Scan frontend rendering, grouping, virtualization, click/overlay, and command-enhancement code.
- Identify code that exists only to approximate rather than reproduce source behavior.
- Remove or rewrite it as part of the relevant parity fix.

Acceptance:
- File-by-file notes in this worklist.
- Local checks pass.
- No user-visible regression against already validated anchors.

### P1. Whole Conversation Newest-To-Oldest Sweep

Status: open

Goal:
- Complete the user's final acceptance path: start at the newest messages and work upward through the long conversation with same-text anchors.

Required work:
- Use the live source and deployed target.
- Record a sequence of accepted anchor windows.
- Expand every source-expandable row and compare the target.
- Add new failures to this board immediately.

Acceptance:
- No open P0 parity failures remain.
- Evidence set includes screenshots, DOM/style extracts, click logs, console logs, and deployment state.

## Issue Intake Rule

When the user reports a problem during implementation:

- Add it to `Current Known Failures` or `Work Board` before moving on.
- Fix the current small change if already in progress.
- Then handle the newly reported issue next unless it blocks the current fix.
- Do not leave the issue only in chat history.

## Evidence Log

No task is closed in this reset yet.
