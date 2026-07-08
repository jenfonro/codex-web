# Codex Live Parity Worklist

Created: 2026-07-07 +08:00
Reset: 6
Status: active

## Reset 6 Purpose

Reset 6 exists because earlier work produced false positives. A script result, partial screenshot, or remembered fix is not enough. The deployed page still failed the real acceptance path:

- Long conversations can expose scroll/click failures.
- Some expandable rows such as `已处理` and file activity rows are not proven clickable in the deployed browser.
- At least one live audit showed a disclosure row center being hit by `.codex-composer-card`, which means footer/composer overlap or pointer blocking is still possible.
- Some official extension structures were previously approximated instead of copied or verified.
- Old work files contained pass/completed wording that did not satisfy the final acceptance standard.

This file is now the only active work file. Everything archived before Reset 6 is historical evidence only.

## Archived Files

Moved out of the active path:

- `reference/legacy/20260707-false-positive-reset6/codex-live-parity-worklist.false-positive-reset5.md`

Earlier legacy folders remain historical only:

- `reference/legacy/20260707-false-positive-reset5/`
- `reference/legacy/20260707-false-positive-reset4/`
- `reference/legacy/20260707-false-positive-reset3/`
- `reference/legacy/20260707-live-parity-reset2/`
- `reference/legacy/20260707-false-positive-workfiles/`

Rules for archived material:

- Do not inherit any archived completed status.
- Do not use archived green reports as acceptance.
- Use archived screenshots, DOM dumps, reports, and notes only as clues.
- If an archived report conflicts with the user's visible browser, the visible browser wins.

## Source Of Truth

- Source reference: `https://code-tx.zelt.cn/?folder=/root`
- Target: `https://codex.zelt.cn/`
- Viewport: 1920x1080 or larger unless a specific issue requires another size.
- Source Codex extension must be opened from the left Activity Bar icon.
- Source right chat/sidebar must be closed.
- Target must be the deployed online build the user can refresh.
- The compared conversation must be the same long conversation.
- Comparison must proceed newest-to-oldest with the same visible text anchors.

Do not modify the source code-server instance while collecting reference evidence.

## Non-Negotiable Boundaries

- Do not invent similar UI.
- Do not keep Codex Web-only enhancements during first-pass parity.
- Do not show `exec_command xN`, `write_stdin`, `Chunk ID`, shell transcript rows, or command enhancement rows during first-pass parity.
- Do not add overlays, drag surfaces, invisible masks, or pointer blockers over the conversation.
- Do not treat the user's scroll issue as a draggable-resizer issue.
- Do not solve long conversation issues by truncating history or hiding rows.
- Do not mark a task complete from memory, from source code inspection alone, from screenshots alone, or from a green script alone.
- If an audit creates a false positive, fix the audit before trusting it again.
- If previous product code conflicts with official behavior, remove or rewrite it instead of patching around it.

## 用户验收边界

- 必须以 `https://code-tx.zelt.cn/?folder=/root` 的真实 code-server Codex 扩展为准。
- 必须用相同文本锚点定位同一个长会话位置，不能只看接口里有没有同一段文字。
- 必须倒序从最新内容向上完整对比，不允许只看局部就判定通过。
- 必须用 Playwright/CDP 抓 source 和 target 的截图、DOM、computed styles、真实鼠标点击、`elementFromPoint`。
- `已处理`、文件变更、diff/activity rows 这些可展开元素必须在 source 和 target 都实际点击展开后核对。
- 第一阶段先完整对齐官方显示规则、分组规则、收缩规则；额外命令增强先移除或关闭。
- 如果线上页面、人眼截图或真实点击与脚本结论冲突，线上页面和人眼截图优先，脚本结论作废。
- 用户在过程中指出的新问题，必须先写进本文件，再修复和验收。

## Acceptance Gate For Any UI Parity Item

No UI parity task may be closed unless this file records all of the following:

- Same visible text anchor in source and target.
- Proof both views are at the same conversation location.
- Source and target screenshots before interaction.
- Source and target screenshots after every relevant expand/collapse click.
- DOM structure, classes, attributes, and hierarchy for matched rows.
- Computed styles for text, spacing, colors, fonts, border radius, overflow, dimensions, icons, and buttons.
- Real Playwright/CDP mouse click evidence.
- `elementFromPoint` evidence proving the click lands on the real control.
- Expanded body text and structure when the source expands.
- Scroll evidence across the long conversation.
- Browser console and page error evidence.
- Source extension code or live DOM evidence when grouping rules are unclear.
- Local build/check evidence for changed code.
- Commit, push, deploy, service status, asset version/currentness, and agent online evidence when deployed code changes.
- Human-visible review result. If the screenshot still visibly differs, the item stays open.

## Required Workflow Per Anchor

1. Pick a visible source anchor from the long conversation, newest to oldest.
2. Capture source screenshot, DOM, computed styles, panel width, scroll state, and console errors.
3. Locate the same anchor visibly in the target page. API/session text match is not enough.
4. Capture target screenshot, DOM, computed styles, panel width, scroll state, and console errors.
5. Compare grouping, row order, duration placement, collapsed text, expanded body, file rows, icons, wrapping, spacing, and running/finished state.
6. For every expandable row visible in source, click source and target with real mouse input and capture before/after state.
7. If target differs, add or update a task in this file before implementing.
8. Implement the smallest product change that matches official behavior.
9. Run local checks.
10. Commit and push when code changes.
11. Deploy to `https://codex.zelt.cn/`.
12. Verify the deployed target is serving the new asset version.
13. Rerun the same anchor validation online.
14. Close the task only after screenshots, DOM/style evidence, click evidence, and human-visible review all match.

## Current Confirmed Failure Evidence

### 2026-07-07 Same-Anchor Live Audit

Report:

- `reference/live-anchor-alignment/20260706-211630/summary.json`
- `reference/live-anchor-alignment/20260706-211630/source-anchor-1.png`
- `reference/live-anchor-alignment/20260706-211630/target-anchor-1.png`
- `reference/live-anchor-alignment/20260706-211630/target-anchor-1-before-click.png`
- `reference/live-anchor-alignment/20260706-211630/target-anchor-1-after-click.png`

Anchor:

- `你为什么自作主张给我加了密码的相关样式 我现在完全不需要认证!`

Result:

- Failed.
- The source and target both found the anchor.
- The target API contained the anchor.
- The failure was real mouse hit-test behavior, not missing text.
- Failed control label: `已编辑 1 个文件`
- Failed control key: `turn-activity:codex-turn-62:detail:11`
- Failed row center: `x=133`, `y=914`
- `elementFromPoint` hit `.codex-composer-card` with text `请求批准 5.5 超高 IDE 上下文`.

Interpretation:

- This is active product failure evidence.
- The next fix must address footer/composer overlap or pointer blocking in the conversation scroll area.
- This report must not be counted as a parity pass.

### 2026-07-07 Same-Anchor Reproduction

Report:

- `reference/live-anchor-alignment/20260706-212459/summary.json`
- `reference/live-anchor-alignment/20260706-212459/source-anchor-1.png`
- `reference/live-anchor-alignment/20260706-212459/target-anchor-1.png`
- `reference/live-anchor-alignment/20260706-212459/target-anchor-1-before-click.png`
- `reference/live-anchor-alignment/20260706-212459/target-anchor-1-after-click.png`

Anchor:

- `你为什么自作主张给我加了密码的相关样式 我现在完全不需要认证!`

Command:

```powershell
$env:ANCHOR_TEXTS='你为什么自作主张给我加了密码的相关样式 我现在完全不需要认证!'
$env:ANCHOR_AUDIT_VERBOSE='1'
$env:TARGET_FRESH='1'
$env:REAL_CLICK_ALL_DISCLOSURES='1'
$env:VIEWPORT_WIDTH='1920'
$env:VIEWPORT_HEIGHT='1080'
node scripts\audit-codex-live-anchor-alignment.cjs
```

Result:

- Failed again.
- Failed check: `anchor 1 target disclosure real mouse hit-test`.
- Failed control label: `已编辑 1 个文件`
- Failed control key: `turn-activity:codex-turn-62:detail:11`
- `elementFromPoint` hit `.codex-composer-card`.

Interpretation:

- The failure is reproducible on the current deployed target.
- Continue with product layout diagnostics and fix before any parity item can close.

### 2026-07-07 Targeted Hit-Test Fix Verification

Fix:

- Commit `33292ac` changed `frontend/src/pages/codex/renderer.js`.
- After a disclosure click, the renderer now preserves the clicked disclosure anchor and nudges scroll just enough to keep any disclosure control intersecting the bottom of the scroll viewport fully clickable above the composer.

Deployment:

- Server `/root/code/codex-web` fast-forwarded to `33292ac`.
- Server `./build-all.sh` passed.
- `codex-web.service` restarted and reported `active`.
- `/api/nodes` later reported `host-docker-agent` online.

Currentness evidence:

- `reference/live-currentness/20260706-213639/summary.json`
- `reference/live-currentness/20260706-213639/target.png`
- Loaded JS: `https://codex.zelt.cn/app/codex-web.js?v=20260706213546`
- Loaded CSS: `https://codex.zelt.cn/app/codex-web.css?v=20260706213546`
- Runtime asset version: `20260706213546`
- Console warnings/errors: `0`

Same-anchor audit:

- `reference/live-anchor-alignment/20260706-213712/summary.json`
- `reference/live-anchor-alignment/20260706-213712/source-anchor-1.png`
- `reference/live-anchor-alignment/20260706-213712/target-anchor-1.png`
- `reference/live-anchor-alignment/20260706-213712/target-anchor-1-before-click.png`
- `reference/live-anchor-alignment/20260706-213712/target-anchor-1-after-click.png`

Result:

- Passed for this one previously failing anchor: `0 failed`.
- Real click evidence: `clicked=12`, `blocked=0`, `controls=12`.
- Former failed control `turn-activity:codex-turn-62:detail:11` moved from y=904-924 with center y=914 to y=883-903 with center y=893.
- `elementFromPoint` for that control now hits the disclosure text/control instead of `.codex-composer-card`.

Scope:

- This resolves the reproduced `detail:11` composer hit-test failure for this anchor only.
- It does not close whole-conversation parity, processed-row parity, file/diff parity, or newest-to-oldest sweep.

### 2026-07-07 Ambiguous Anchor Finding

Report:

- `reference/live-anchor-alignment/20260706-213928/summary.json`
- `reference/live-anchor-alignment/20260706-213928/source-anchor-1.png`
- `reference/live-anchor-alignment/20260706-213928/target-anchor-1.png`
- `reference/live-anchor-alignment/20260706-213928/target-anchor-1-before-click.png`

Anchor:

- `./build-all.sh`

Result:

- Failed with `2 failed`.
- Source and target both contained the text, but context comparison failed: `score=0.000, matched=0/80, bothContainAnchor=true`.
- Source screenshot was in the later no-auth cleanup section.
- Target screenshot was in the early multi-server implementation plan section.

Interpretation:

- Bare `./build-all.sh` is too ambiguous and must not be used alone as a closure anchor.
- Future validation must use a longer visible anchor or anchor metadata with surrounding context.
- The secondary processed disclosure failure in this report is not actionable product evidence until the source/target context mismatch is fixed.

Follow-up audit script fix:

- `scripts/audit-codex-live-anchor-alignment.cjs` now skips product-specific disclosure checks when the source and target contexts are not comparable.
- Verification report: `reference/live-anchor-alignment/20260706-214427/summary.json`.
- Result: `1 failed`, and the only failed check is `anchor 1 source/target matched context is comparable`.
- Product-specific checks in that report state `skipped because contexts differ`.

### 2026-07-07 Source Locate Budget Finding

Reports:

- `reference/live-anchor-alignment/20260706-214727/summary.json`
- `reference/live-anchor-alignment/20260706-214934/summary.json`
- `reference/live-anchor-alignment/20260706-214934/source-anchor-1.png`
- `reference/live-anchor-alignment/20260706-214934/target-anchor-1.png`

Anchor:

- `分析一下codex-web  现在我还有问题`

Result:

- Failed because source locate did not find the anchor: `anchor search exceeded evaluate budget`.
- Retrying with `ANCHOR_MAX_SCROLL_STEPS=420` and `ANCHOR_LOCATE_TIMEOUT_MS=180000` still failed source locate.
- Target found the earliest session record at `seq=1` and target real click passed with `controls=1`, `clicked=1`, `blocked=0`.

Interpretation:

- This is not actionable product UI evidence yet because source and target are not both located at a comparable browser state.
- The audit needs a better strategy for oldest/early anchors in the source code-server webview, or this anchor must be replaced with a nearby visible source anchor that the script can actually locate.

Follow-up source locate fix:

- `scripts/audit-codex-live-anchor-alignment.cjs` now prioritizes scroll endpoints and endpoint-adjacent positions before linear scanning.
- This is required because the source code-server webview uses negative scroll positions for the long conversation, and the oldest anchor can sit near the far end of a ~103k px scroll range.
- Verification report: `reference/live-anchor-alignment/20260706-215526/summary.json`.
- Result: `0 failed`.
- Source scroll reached `top=-102236`, `height=103195`, `clientHeight=958`.
- Context comparison passed: `score=0.438`, `matched=35/80`, `bothContainAnchor=true`.
- Target real click passed: `controls=1`, `clicked=1`, `blocked=0`.

## Current Known Failures

- Long conversation scroll stability is not proven.
- `已处理` and activity disclosure rows are not proven reliably clickable across the whole deployed conversation.
- The specific `turn-activity:codex-turn-62:detail:11` composer hit-test failure is fixed for anchor `你为什么自作主张给我加了密码的相关样式 我现在完全不需要认证!`, but other anchors still need proof.
- Bare repeated anchors such as `./build-all.sh` can match the wrong source/target context and must be replaced by longer contextual anchors.
- Very early anchors need endpoint-prioritized source location. The known failing anchor `分析一下codex-web  现在我还有问题` now passes in report `reference/live-anchor-alignment/20260706-215526/summary.json`, but the whole newest-to-oldest sweep still needs more anchors.
- File/diff activity grouping may still differ from the official extension.
- Some file or code-change content may render as plain text where the official extension renders structured activity rows.
- Duration placement for processed rows may still be wrong.
- Completed turns may leave stale running text such as `正在思考`.
- Previous command-enhancement output must stay removed until first-pass parity is complete.
- Previous commits may contain UI code created from wrong assumptions and must be audited.
- Whole-conversation newest-to-oldest parity has not been completed.

## First Anchor Queue

Use these anchors first, then continue newest-to-oldest through the same long conversation:

- Do not use bare `./build-all.sh` by itself; use a longer contextual anchor from the same visible window.
- `你为什么自作主张给我加了密码的相关样式 我现在完全不需要认证!`
- `分析一下codex-web  现在我还有问题`
- `首先第一个问题,对话框被你做到了右侧内容区`
- `现在首先,你先对浏览器截图,并进行下载`
- `启动一个带远程调试或 noVNC 的浏览器实例`

For each anchor, compare collapsed and expanded states for every source-expandable row near that anchor.

## Work Board

### P0. Fix Scroll And Click Stability

Status: open; one reproduced composer hit-test failure fixed, whole-conversation proof still incomplete

Goal:

- The long conversation must scroll newest-to-oldest without flicker loops, stuck scroll, white screen, phantom drag behavior, or click blockers.

Required work:

- Reproduce on deployed target with the same anchor report above.
- Measure `[data-thread-scroll]`, footer spacer, composer, and failed disclosure bounding boxes.
- Verify no overlay, drag surface, footer overlap, or invisible element captures pointer events.
- Ensure rows can scroll above the composer and be clicked.
- Do not truncate or hide history.

Acceptance:

- Same-anchor source/target screenshots before and after expansion.
- Real click logs.
- `elementFromPoint` logs.
- Console/page-error logs.
- Human-visible review shows no phantom drag surface and no blocked controls.

Evidence:

- Fixed and deployed commit: `33292ac`.
- Passing targeted report: `reference/live-anchor-alignment/20260706-213712/summary.json`.
- Passing currentness report: `reference/live-currentness/20260706-213639/summary.json`.
- Remaining requirement: repeat scroll/click proof across additional same-context anchors before closing this P0.

### P0. Match Processed Row Grouping And Disclosure

Status: open

Goal:

- Match official `已处理` rows: grouping, row order, label, duration placement, disclosure icon, collapsed state, expanded body, spacing, and running/finished state transitions.

Required work:

- Compare at least three processed rows from different locations in the long conversation.
- Remove or suppress command-enhancement text from processed rows during first-pass parity.
- Ensure completed sessions do not keep stale `正在思考` indicators.
- Use source DOM or extension source when grouping rules are unclear.

Acceptance:

- Same-anchor collapsed and expanded screenshots.
- DOM/style comparison for row, label, duration, icon, body, and spacing.
- Real click evidence for every compared expandable row.

### P0. Match File And Diff Activity Rows

Status: open

Goal:

- When the source shows file/diff activity blocks, the target must show equivalent structured rows, not plain text/code dumps or swallowed processed-summary text.

Required work:

- Inspect source extension code or live DOM for grouping rules.
- Map target file-change events to the same visible row structure.
- Match labels such as `已编辑的文件`, file rows such as `app.go +5 -103`, spacing, icons, overflow, and disclosure behavior.
- Match the expanded file/diff body shell enough that source action/button/card hierarchy is not missing.
- Defer the right-side diff viewer if necessary, but row display and expanded body shell must match first.

Acceptance:

- Same-anchor source/target screenshots where source has file/diff rows.
- DOM/class/style comparison for file rows and expanded body.
- Real click evidence for expanded/collapsed rows.
- No raw code/text blocks where the official source shows structured file activity.

### P0. Rebuild Audit Trust

Status: open

Goal:

- The audit must fail when source and target differ in visible browser behavior.

Required work:

- Verify the audit uses visible anchors, not hidden API text or stale DOM nodes.
- Preserve structure evidence and real-click evidence separately.
- Compare expanded body structure, not only labels or file counts.
- Detect source file/diff action rows and require equivalent target structure.
- Record selectors, bounding boxes, screenshot paths, and hit-test results for every matched row.
- Reject or require disambiguation for repeated short anchors such as `./build-all.sh` when context score is zero.
- Do not treat target-only processed disclosure failures as product evidence when the source and target contexts are not comparable.
- Improve source locate for oldest/early anchors, or provide a documented replacement-anchor flow when source locate exceeds budget.

Evidence:

- `reference/live-anchor-alignment/20260706-214427/summary.json` proves the ambiguous `./build-all.sh` anchor still fails on context mismatch, while product-specific checks are skipped instead of producing false product failures.
- `reference/live-anchor-alignment/20260706-214934/summary.json` proves the early Chinese anchor currently fails because source locate exceeds budget, while target is found and clickable.
- `reference/live-anchor-alignment/20260706-215526/summary.json` proves endpoint-prioritized source location fixes that early Chinese anchor and produces a 0-failure same-context audit.

Acceptance:

- A known mismatch fails.
- A passing result includes screenshots, DOM/style evidence, real click evidence, and human-visible review.

### P0. Audit And Remove Wrong Previous UI Code

Status: open

Goal:

- Remove product code created under wrong assumptions if it conflicts with official behavior.

Required work:

- Review `frontend/src/pages/codex/renderer.js`.
- Review `frontend/src/pages/codex/grouping.js`.
- Review `frontend/src/pages/codex/activity-summary.js`.
- Review `frontend/src/pages/codex/lifecycle.js`.
- Review Codex page styles for overlays, scroll containers, footer spacers, masks, and drag surfaces.
- Review audit scripts for false-positive paths.
- Add file-by-file notes to this worklist before closing this item.

Acceptance:

- Notes list wrong code found, action taken, or why retained.
- Local checks pass.
- No validated anchor regresses.

### P1. Whole Conversation Newest-To-Oldest Sweep

Status: open

Goal:

- Complete the user's final acceptance path across the long conversation.

Required work:

- Start from the newest visible source messages.
- Work upward by same visible text anchor.
- Expand every source-expandable row and compare target.
- Add every new mismatch to this board immediately.

Acceptance:

- No open P0 parity failures remain.
- Evidence set includes screenshots, DOM/style extracts, click logs, console logs, deploy state, and human-visible review for each accepted anchor window.

## Supporting Infrastructure Evidence

Asset/currentness evidence is useful only to prove the deployed page is fresh. It does not close any UI parity item.

Latest known currentness report:

- `reference/live-currentness/20260706-211343/summary.json`
- `reference/live-currentness/20260706-211343/target.png`

Known values from that report:

- Loaded JS: `https://codex.zelt.cn/app/codex-web.js?v=20260706211331`
- Loaded CSS: `https://codex.zelt.cn/app/codex-web.css?v=20260706211331`
- Runtime version: `20260706211331`
- Console entries: `0`
- Page errors: `0`
- Failed HTTP responses: `0`

This must be rerun after every deploy.

## Issue Intake Rule

When the user reports a problem during implementation:

- Add it to `Current Known Failures` or `Work Board` before moving on.
- Fix the current small change if already in progress.
- Then handle the newly reported issue next unless it blocks the current fix.
- Do not leave the issue only in chat history.

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
Scroll/click evidence:
Console/page-error evidence:
Screenshot paths:
Command/build evidence:
Report path:
Commit:
Deployment:
Asset currentness:
Human-visible review:
Result:
Remaining risk:
```

## Reset Log

### 2026-07-07 Reset 6

Actions:

- Archived Reset 5 active work file to `reference/legacy/20260707-false-positive-reset6/codex-live-parity-worklist.false-positive-reset5.md`.
- Rebuilt this file as the only active checklist.
- Removed old completed/pass wording from active UI parity status.
- Recorded the latest same-anchor hit-test failure as active failure evidence.
- Reopened every conversation UI parity task.

Result:

- No conversation UI parity task is complete.
- Next work must start with the deployed hit-test/scroll failure and only close it after real browser evidence matches the acceptance gate.
