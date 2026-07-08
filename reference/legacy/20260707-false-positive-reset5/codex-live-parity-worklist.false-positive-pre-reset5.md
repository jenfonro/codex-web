# Codex Live Parity Worklist

Created: 2026-07-07 +08:00
Reset: 4
Reason: previous work and audit runs produced false positives. This file is rebuilt as the only active acceptance work file. Reset 3 is archived and must not be used as completion evidence.

## Current Rule

Nothing in conversation rendering is complete until the deployed Codex Web page matches the live code-server Codex extension at the same visible text anchor.

Script output is only supporting evidence. A green script result is not acceptance if screenshots, DOM structure, computed styles, grouping, scroll, or real click behavior still differ. When a false positive is found, the audit must be treated as broken and fixed before it is trusted again.

## Source Of Truth

- Source: `https://code-tx.zelt.cn/?folder=/root`
- Target: `https://codex.zelt.cn/`
- Viewport: `1920x1080` or larger.
- Source Codex must be opened from the left Activity Bar icon.
- Source right chat/auxiliary sidebar must be closed.
- Source panel width must be recorded on every run. Prefer the user's real panel width, about `611px` on a 2K display.
- Target must be the online deployed build that the user can refresh and test.
- The compared conversation must be the same long conversation.
- Comparison must use the same visible text anchors, newest to oldest.

## Active File Policy

This is the only active work file.

Archived work files and false-positive records are history only:

- `reference/legacy/20260707-false-positive-workfiles/`
- `reference/legacy/20260707-live-parity-reset2/`
- `reference/legacy/20260707-false-positive-reset3/`
- `reference/legacy/20260707-false-positive-reset4/`
- `reference/legacy/codex-collapse-alignment-worklist.false-positive-archive-20260707.md`

Do not use checked items, pass labels, or completed statuses from those files as acceptance. They can only be used as clues.

Raw capture and report directories may remain in place, but they are not acceptance records unless this file links a fresh passing run and records visual/DOM/click evidence:

- `reference/live-anchor-alignment/`
- `reference/codex-reference/`
- `reference/collapse-alignment/`
- `reference/windows-captures/`
- `reference/extension-source/`
- `reference/extension-assets/`

## Invalidated Evidence

These reports are not accepted as parity closure:

- `reference/live-anchor-alignment/20260706-201902/summary.json`
  - Invalid as product parity. It reported `0 failed`, but later evidence showed it missed source expanded file/diff action structure.
- `reference/live-anchor-alignment/20260706-202720/summary.json`
  - Invalid as product parity. It reported `0 failed`, but it still did not require target expanded file rows to expose the official action/button structure.
- `reference/live-anchor-alignment/20260706-194749/summary.json`
  - Invalid as product parity. It improved visible-anchor matching but did not prove file/diff grouping parity.
- `reference/live-anchor-alignment/20260706-195153/summary.json`
  - Invalid as product parity. It reported `0 failed`, but screenshots and later audit logic exposed a false negative around file/diff rows.
- `reference/live-anchor-alignment/20260706-193715/summary.json`
  - Invalid. Browser expression failed with `ReferenceError: visualRect is not defined`.
- `reference/live-anchor-alignment/20260706-193919/summary.json`
  - Invalid. Browser expression failed with `ReferenceError: visualRect is not defined`.
- `reference/live-anchor-alignment/20260706-194126/summary.json`
  - Debugging evidence only. It was produced before focus-visible and panel-width evidence was reliable.
- Any single-anchor pass that has not been visually inspected against the same source anchor.
- Any local-only screenshot, fixture, generated audit, or API text match without visible same-anchor browser evidence.

Useful failure evidence:

- `reference/live-anchor-alignment/20260706-202927/summary.json`
  - Current known valid failure, not acceptance.
  - Failure: `anchor 1 file/diff activity row parity`.
  - Source expanded file bodies expose official diff-card/action structure with buttons.
  - Target expanded file bodies have simplified `.thread-diff-virtualized` rows and `targetActionRows=0`.
  - This proves the audit must compare expanded body structure, not just row labels or file counts.

## Non-Negotiable Boundaries

- Do not invent a similar UI.
- Do not keep first-pass Codex Web-only enhancements when the official source does not show them at the same anchor.
- Do not show `exec_command xN`, `write_stdin`, raw `Chunk ID`, shell transcripts, or command enhancement rows during first-pass parity unless the source shows the same element in the same position.
- Do not add overlays, drag surfaces, invisible masks, or pointer blockers over the conversation.
- Do not treat the user's scroll problem as a draggable-resizer problem.
- Do not solve long conversation problems by truncating history.
- Do not hide scroll problems with clipping, reduced content, or reduced history.
- Do not mark a task complete from memory or from a green script alone.
- If an audit creates a false positive, fix the audit before using it again.
- If old code conflicts with official behavior, rewrite or remove it instead of patching around it.

## Required Closure Evidence

Every closed item must record all of this:

- Same visible text anchor in source and target.
- Proof both views are at the same conversation location.
- Source and target screenshots before interaction.
- Source and target screenshots after every relevant click, expand, or collapse action.
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
- Human-visible screenshot review result. If the screenshot still visibly differs, the item remains open.

## Required Workflow Per Anchor

1. Pick a visible source anchor from newest to oldest in the long conversation.
2. Capture source screenshot, DOM, computed styles, panel width, and scroll state.
3. Locate the same anchor visibly in target. API/session data match is not enough.
4. Capture target screenshot, DOM, computed styles, panel width, and scroll state.
5. Compare row grouping, row order, labels, duration placement, disclosure state, file/diff rows, text wrapping, spacing, icons, and expanded bodies.
6. For every expandable row visible in source, click source and target with real mouse input and capture before/after states.
7. If target differs, add or update a task in this file before implementing.
8. Implement the smallest product change that aligns with official behavior.
9. Run local validation.
10. Deploy to the online target when code changed.
11. Rerun the same anchor validation online.
12. Only then record closure evidence.

## Current Known Failures

All items below are open.

- Long conversation scrolling and click stability are not proven across the whole conversation.
- Some previous checks matched anchor text in API data or stale DOM nodes rather than proving visible browser parity.
- `已处理` grouping, duration placement, collapsed text, expanded body, and running/finished state transitions are not fully proven.
- `已处理` rows have been reported as unclickable on the deployed page; this must be verified with real mouse click and `elementFromPoint`.
- File/diff activity rows are not aligned. Source shows structured rows such as `已编辑 1 个文件` and `app.go +5 -103`; target has rendered some of this as processed text, simplified rows, or the wrong grouping.
- Source expanded file/diff rows expose official action/button structure; target currently lacks equivalent action rows.
- Raw code/text blocks appear where the official source renders structured file/diff activity blocks.
- Codex Web command-enhancement output must stay removed until first-pass parity is complete.
- Previous overlay/drag-surface behavior over the conversation is invalid and must not reappear.
- Whole-conversation newest-to-oldest parity has not been completed.
- Previous commits may contain code added for wrong assumptions. That code must be audited and removed or rewritten when it conflicts with official behavior.
- Current product change in `frontend/src/pages/codex/renderer.js` is a local file/diff body alignment attempt. It is syntax/build checked locally but not deployed or visually accepted yet.
- Live report `reference/live-anchor-alignment/20260706-204229/summary.json` shows the file/diff action-row mismatch is improved, but it exposed a footer overlap failure: the last file disclosure center is at the scroll viewport bottom and `elementFromPoint` hits `.codex-composer-card`.

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

### P0. Audit Harness Must Stop False Positives

Status: open

Goal:
- The audit must fail when source and target screenshots or DOM expose different grouping, expanded body structure, click behavior, or scroll behavior, even if broad text/file references exist on both sides.

Required work:
- Keep same-turn disclosure structure comparison.
- Compare expanded body structure, not just labels/counts.
- Detect official file/diff action rows and buttons in source expanded bodies.
- Fail if target lacks equivalent expanded body structure.
- Preserve both synthetic structure evidence and real-click evidence without overwriting one with the other.
- Store readable labels, row hierarchy, selectors, bounding boxes, and screenshot paths for every matched disclosure/activity row.

Acceptance:
- The known false-positive anchor must fail before product changes when target lacks official file/diff action structure.
- After product changes, the same anchor must pass with screenshots and DOM/style/click evidence.
- A pass is not accepted until the screenshots have been visually reviewed.

### P0. Long Conversation Scroll And Click Stability

Status: open

Goal:
- The long conversation must scroll newest-to-oldest without flicker loops, stuck scroll, white screen, phantom drag behavior, or click blockers.

Required work:
- Reproduce on deployed target.
- Wheel-scroll through multiple anchor windows.
- Verify `已处理` rows can be clicked open and closed.
- Verify `elementFromPoint` at click coordinates returns the real control or row.
- Confirm no overlay, drag surface, or invisible element captures pointer events.

Acceptance:
- Same-anchor source/target screenshots before and after expansion.
- CDP/Playwright click evidence.
- Console/page-error evidence.
- No visible phantom drag surface in the conversation area.

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

Status: in progress

Goal:
- When source shows file/diff activity blocks, target must show equivalent structured rows, not raw plain text/code dumps or swallowed processed-summary text.

Required work:
- Read source extension code or inspect live DOM for grouping rules.
- Map target `file_change` events to the same visible row structure.
- Match labels such as `已编辑 1 个文件`, file rows such as `app.go +5 -103`, spacing, icons, overflow, and disclosure behavior.
- Match expanded file/diff body structure enough that the source action/button/card hierarchy is not missing.
- Defer the right-side diff viewer if needed, but row display and expanded body shell must match first.

Current action:
- Used live report `reference/live-anchor-alignment/20260706-202927/summary.json` as source evidence.
- Source expanded file body sample shows:
  - `flex flex-col` with `--conversation-patch-file-gap: 4px`.
  - header text `已编辑的文件`.
  - `border-token-border flex flex-col overflow-hidden rounded-lg border mt-1.5`.
  - file-name button plus copy button.
  - `sourceActionRows=7`.
- Target report showed old simplified body:
  - left-indented generic `flex flex-col gap-2 pt-2 pb-1 pl-6`.
  - plain `.thread-diff-virtualized` row with no buttons.
  - `targetActionRows=0`.
- Local change rewrites `renderFileChangeActivityDetail`, `renderFileChangeActivityBody`, and `renderFileChangeRow` to follow the captured official body/card/button hierarchy without fabricating diff contents.
- Local checks passed:
  - `node --check frontend\src\pages\codex\renderer.js`
  - `node --check scripts\audit-codex-live-anchor-alignment.cjs`
  - `git diff --check -- frontend/src/pages/codex/renderer.js scripts/audit-codex-live-anchor-alignment.cjs reference/codex-live-parity-worklist.md`
  - `C:\Program Files\Git\bin\bash.exe ./build-all.sh`
- Deployed commit `c76bf6f` to `https://codex.zelt.cn/`; server build passed and `codex-web.service` restarted active.
- Live audit `reference/live-anchor-alignment/20260706-204229/summary.json` still failed:
  - file/diff activity row parity now passed (`sourceActionRows=7`, `targetActionRows=12`).
  - remaining failure is `anchor 1 target disclosure real mouse hit-test`.
  - hit-test failure is caused by a file disclosure at y=914, exactly at the scroll viewport bottom, where `elementFromPoint` hits `.codex-composer-card`.
- Follow-up product fix adds a footer spacer inside the thread scroll content so the last conversation rows can scroll above the composer instead of stopping underneath it.

Next validation:
- Deploy this change to `https://codex.zelt.cn/`.
- Rerun anchor `你为什么自作主张给我加了密码的相关样式 我现在完全不需要认证!`.
- Inspect source/target screenshots and expanded body DOM. A green audit result is not enough by itself.

Acceptance:
- Same-anchor source/target screenshots where source has file/diff rows.
- DOM/class/style comparison for file rows.
- Expanded/collapsed evidence if the source row expands.
- Target no longer has `targetActionRows=0` when source exposes file/diff action rows.

### P0. Remove Or Rewrite Wrong Previous UI Code

Status: open

Goal:
- Audit prior changes made under incorrect assumptions and remove code that conflicts with official behavior.

Required work:
- Scan frontend rendering, grouping, virtualization, click/overlay, and command-enhancement code.
- Identify code that exists only to approximate rather than reproduce source behavior.
- Review current dirty edits before treating them as product fixes.
- Remove or rewrite wrong code as part of the relevant parity fix.

Acceptance:
- File-by-file notes are added to this worklist.
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

## Closure Template

Use this block when closing any item:

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
Scroll/click evidence:
Screenshot paths:
Command/build evidence:
Report path:
Commit:
Deployment:
Human-visible review:
Result:
Remaining risk:
```

## Reset Log

### 2026-07-07 Reset 4

Actions:
- Archived Reset 3 active worklist to `reference/legacy/20260707-false-positive-reset4/codex-live-parity-worklist.false-positive-pre-reset4.md`.
- Moved stray zero-byte root file `{` to `reference/legacy/20260707-false-positive-reset4/stray-root-left-brace.zero-byte`.
- Rebuilt this file as the single active worklist.
- Reopened all UI parity tasks.
- Marked `201902` and `202720` green reports invalid for acceptance because they missed expanded file/diff action structure.

Result:
- No UI parity task is closed by this reset.
- The next work must start by validating or correcting the audit and dirty product code against the same live anchor.
