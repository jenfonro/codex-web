# Codex Live Parity Worklist

Created: 2026-07-07 02:55:36 +08:00
Reset reason: previous worklists and audits produced false positives. This file is rebuilt as the only active acceptance work file.

## Current Rule

Nothing is complete unless source and target are verified on the live pages with the same visible text anchor.

Source of truth:
- Source: `https://code-tx.zelt.cn/?folder=/root`
- Target: `https://codex.zelt.cn/`
- Viewport: `1920x1080` or larger.
- Source Codex must be opened from the left Activity Bar icon.
- The right chat/auxiliary sidebar must be closed.
- Source panel width should be about `611px`, or the exact width must be recorded.

Required evidence for every closed item:
- Same visible text anchor on source and target.
- Proof the compared windows are the same conversation location.
- Source and target screenshots for that anchor.
- DOM/classes for the matched elements.
- Computed styles for rows, text, disclosure buttons, file rows, spacing, dimensions, overflow, and clickable controls.
- Real browser click evidence for every expandable row.
- Before-click and after-click expanded state.
- Expanded body text and structure when the official source expands.
- Scroll behavior evidence for long conversation windows.
- Local command/build evidence.
- Commit, push, deployment, service, and agent-container evidence when code changed.

Do not close anything from memory, static fixtures, screenshots only, local unit checks only, or audit scripts that do not prove same-anchor comparability and real click behavior.

## Active File Policy

This is the only active work file.

Legacy/false-positive files are archived under:
- `reference/legacy/20260707-false-positive-workfiles/`
- `reference/legacy/codex-collapse-alignment-worklist.false-positive-archive-20260707.md`

The archived files are historical notes only. Their checked items, pass labels, and previous conclusions are not accepted.

Raw capture directories such as `reference/collapse-alignment/`, `reference/windows-captures/`, `reference/codex-reference/`, and `reference/live-anchor-alignment/` may be used as raw material, but they are not acceptance records unless this file links a fresh passing report and records the required evidence.

## Current Known State

Repository:
- Branch: `main`
- Current local head observed during this reset: `4757e72 fix: stabilize live anchor focus audits`
- Dirty generated files observed:
  - `reference/codex-reference/virtual-scroll-audit.json`
  - `reference/codex-reference/virtual-scroll-audit.md`

Latest live audit evidence available:
- Report: `reference/live-anchor-alignment/20260706-185043/summary.json`
- Result: 34 checks, 7 failed, 3 anchors.
- This report is useful failure evidence only. It does not close parity.

Latest audit failures that must remain open:
- Anchor 1 processed disclosure parity failed: source processed `2`, target processed `1`; source expandable/opened/body `2`, target `1`.
- Anchor 2 target anchor not found: `anchor search exceeded evaluate budget`.
- Anchor 2 processed summaries failed: source `3`, target `0`.
- Anchor 2 processed expansion failed: source processed/expandable/opened/body `2`, target `0`.
- Anchor 3 target anchor not found: `anchor not found in rendered scroll pass`.
- Anchor 3 processed summaries failed: source `4`, target `0`.
- Anchor 3 processed expansion failed: source processed/expandable/opened/body `3`, target `0`.
- Anchor 3 file references mismatch observed in report: source `3`, target `0`.

Deployment/currentness evidence from earlier work is not UI parity evidence. Before any live acceptance run, re-check:
- `origin/main` commit.
- Server repo head at `/root/code/codex-web`.
- `./build-all.sh` success on server.
- `codex-web.service` active after restart.
- Agent container rebuilt/recreated if agent code changed.
- `/api/nodes` shows expected agent online.
- `https://codex.zelt.cn/` returns `200`.

## Hard Boundaries

- Do not invent similar UI.
- Do not keep Codex Web-only enhancements during first-pass parity.
- Do not show `exec_command xN`, `write_stdin`, raw `Chunk ID`, shell transcript blocks, or command-enhancement rows unless the official source shows them at the same anchor.
- Do not add overlays, drag surfaces, invisible masks, or pointer blockers over the conversation.
- Do not solve long conversation problems by truncating content.
- Do not hide scroll problems with clipping or reduced history.
- If old code conflicts with official behavior, rewrite or remove it.
- If an audit creates a false positive, fix the audit before using it again.
- After verified code changes, push and deploy so the online page is the same build the user tests.

## Work Board

### P0. Audit Harness Must Stop False Positives

Status: in progress

Problem:
- Previous scripts reported acceptable results while target anchors were missing or expandable rows were not comparable.

Required fix/evidence:
- Audit fails when target anchor cannot be visibly located.
- Audit fails when source has processed/file/diff rows and target has none.
- Audit records rejected anchors and why they were rejected.
- Audit records exact clickable element, `elementFromPoint`, before/after state, DOM/classes, computed styles, screenshot paths, and timeout stage.
- Audit output keeps Chinese anchors readable or stores a readable normalized copy next to raw data.

Current evidence:
- `reference/live-anchor-alignment/20260706-190822/summary.json`: one matched anchor passed with real CDP mouse click evidence.
- The passed anchor was `在抓取一次,现在是在会话内的界面`.
- Processed parity details: `scope=matched-turn/matched-turn; source processed=1, expandable=1, opened=1, bodies=1; target processed=1, expandable=1, opened=1, bodies=1`.
- Real hit-test details: `clicked=1, blocked=0, controls=1`.
- Screenshots recorded:
  - `reference/live-anchor-alignment/20260706-190822/source-anchor-1.png`
  - `reference/live-anchor-alignment/20260706-190822/target-anchor-1-before-click.png`
  - `reference/live-anchor-alignment/20260706-190822/target-anchor-1-after-click.png`
  - `reference/live-anchor-alignment/20260706-190822/target-anchor-1.png`

Remaining blocker:
- Multi-anchor sweeps still fail, so this task is not complete.
- Latest multi-anchor report: `reference/live-anchor-alignment/20260706-192158/summary.json`, result `37 checks`, `7 failed`, `3 anchors`.
- Remaining failures are target visibility/centering for older anchors after sequential focus changes, not a completed parity pass.

### P0. Long Conversation Scroll And Click Baseline

Status: in progress

Problem:
- User reported long conversation scroll instability and inability to click `已处理` rows.
- User clarified this is a scroll/click issue, not a draggable-resizer requirement.

Required fix/evidence:
- Open the same long conversation on live target.
- Wheel scroll newest-to-oldest across multiple anchor windows without flicker, jump loops, stuck scroll, or white screen.
- `elementFromPoint` at processed-row click coordinates returns the disclosure row/control, not an overlay or drag surface.
- Real click toggles processed disclosure open/closed.
- Console has no fatal render errors.

Current evidence:
- Single-anchor real click passed in `reference/live-anchor-alignment/20260706-190822/summary.json`.
- `elementFromPoint` hit the disclosure span/control for `已处理 1m 34s`, and CDP mouse click changed `aria-expanded` from `false` to `true`.
- Local frontend change reduces the focus lock from `10000ms` to `700ms` and clears it after the focused turn is restored. This is not accepted until deployed and rechecked live.

Remaining blocker:
- Full newest-to-oldest multi-anchor scroll/click behavior is still failing in `reference/live-anchor-alignment/20260706-192158/summary.json`.
- Do not close this task until a multi-anchor sweep passes on the deployed target.

### P0. Anchor 2 And Anchor 3 Target Locator Failures

Status: in progress

Problem:
- Latest audit proves the target API contains the anchors, but visible target location still fails for older windows.

Required fix/evidence:
- Locate and center Anchor 2 visibly on target:
  - `现在首先,你先对浏览器截图,并进行下载,也就是下载网站html与css之类的`
- Locate and center Anchor 3 visibly on target:
  - `启动一个带远程调试或 noVNC 的浏览器实例 挂到现在的codex-web那个端口 codex-web先临时停掉`
- Record focus window, rendered range, target row rect, scrollTop, and screenshot before comparing styles.

Current evidence:
- Fixed API anchor seq scoring so exact user-message anchors outrank later assistant messages.
- Single-anchor `启动一个带远程调试或 noVNC...` passed in `reference/live-anchor-alignment/20260706-192020/summary.json`.
- Single-anchor `好,那么首先左侧侧边你要进行添加一个openai的扩展图标` passed in `reference/live-anchor-alignment/20260706-191920/summary.json`.
- Multi-anchor sweep still fails after sequential focus changes:
  - `reference/live-anchor-alignment/20260706-192158/summary.json`
  - Anchor `启动一个带远程调试或 noVNC...`: `matched anchor was not visible after centering`.
  - Anchor `好,那么首先左侧侧边你要进行添加一个openai的扩展图标`: `matched anchor was not visible after centering`.

Remaining blocker:
- Sequential multi-anchor focus still pollutes or destabilizes target centering.
- This is not closed until the same anchors pass in one multi-anchor run.

### P0. Processed Row Grouping And Expansion

Status: open

Problem:
- Official extension shows processed-time rows as collapsible rows with details.
- Latest audit shows source/target count and expansion mismatches.

Required fix/evidence:
- Validate at least three matched processed rows from the same long conversation.
- Real-click source and target rows open.
- Compare label placement, duration position, disclosure icon, expanded body, spacing, overflow, DOM/classes, computed styles, and collapsed/expanded behavior.
- No `exec_command xN` or command enhancement text appears in first-pass parity output.

### P0. File / Diff Activity Row Rendering

Status: open

Problem:
- Official extension groups file/code changes into file or diff-style activity rows.
- Target previously rendered code/file changes as plain text or missed source file references.

Required fix/evidence:
- Use same-anchor windows where source shows file/diff blocks.
- Target shows equivalent file activity rows, not raw text.
- Compare file path text, icons/indicators, row shape, spacing, collapse behavior, DOM/classes, and computed styles.
- Opening the right-side diff can remain future work, but the row display must match the official source first.

### P0. Remove Command Enhancement Output From Parity Path

Status: open

Problem:
- The target previously showed extra command summaries. User requested removing them until official parity is reached.

Required fix/evidence:
- Code scan lists all command-enhancement render paths.
- Enhancements are disabled or removed from the parity render path.
- Live same-anchor evidence proves no extra command blocks appear when source does not show them.

### P1. Whole Conversation Same-Anchor Sweep

Status: open

Problem:
- A few windows cannot prove the whole long conversation.

Required fix/evidence:
- Build newest-to-oldest anchor inventory for the same long conversation.
- Include user-message anchors, processed-row anchors, file/diff anchors, final-answer anchors, and running/thinking state anchors when available.
- Reject duplicate or non-comparable anchors with reasons.
- For every accepted anchor, capture source/target screenshots and context fingerprints.

### P1. Legacy / Wrong Code Cleanup

Status: open

Problem:
- Earlier near-match work may have left fixture-only helpers, static rendering paths, stale code-server naming, wrong grouping branches, or compatibility patches.

Required fix/evidence:
- Scan frontend and scripts for stale or wrong render paths.
- Remove or refactor code that is not needed for current architecture or verified parity.
- Build passes.
- Live browser checks prove behavior did not regress.

## Required Live Audit Flow

1. Confirm local `git status --short --branch`.
2. Confirm server and agent deployment currentness.
3. Open source at `https://code-tx.zelt.cn/?folder=/root`.
4. Open Codex from the left Activity Bar icon and close the right chat/auxiliary sidebar.
5. Set viewport at least `1920x1080` and source panel near `611px`.
6. Open target at `https://codex.zelt.cn/`.
7. Select the same long conversation on both sides.
8. Work newest-to-oldest using identical visible text anchors.
9. For each anchor, capture:
   - visible anchor match;
   - context comparability;
   - source/target screenshots;
   - DOM/classes/computed styles;
   - collapsible row before/after click state;
   - expanded body structure;
   - scroll/click behavior.
10. Fix the first real blocker.
11. Re-run the same anchor plus neighboring windows.
12. Commit, push, deploy, and record evidence.

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
Screenshot paths:
Command/build evidence:
Report path:
Commit:
Deployment:
Result:
Remaining risk:
```

## Reset Log

### 2026-07-07 02:55 +08:00

Action:
- Archived the previous active file to `reference/legacy/20260707-false-positive-workfiles/codex-live-parity-worklist.pre-rebuild-4757e72.md`.
- Rebuilt this file as the single active worklist.

Result:
- No UI parity task is closed by this reset.
- Latest live audit remains failing and is recorded as failure evidence only.

### 2026-07-07 03:24 +08:00

Action:
- Hardened `scripts/audit-codex-live-anchor-alignment.cjs`:
  - target processed disclosure probing now uses real CDP mouse clicks;
  - hit-test evidence records `elementFromPoint` target and closest disclosure control;
  - matched-turn processed parity is compared separately from neighboring viewport rows;
  - target API anchor seq selection now prioritizes exact user-message anchors over contextual assistant-message matches;
  - target disclosure state is reset between sequential anchors to reduce cross-anchor contamination.
- Adjusted focus scroll handling in frontend:
  - reduced focus lock from `10000ms` to `700ms`;
  - clear `focusLockUntil` immediately after focused turn restoration.

Command evidence:
- `node --check scripts\audit-codex-live-anchor-alignment.cjs`
- `node --check frontend\src\pages\codex\index.js`
- `node --check frontend\src\pages\codex\renderer.js`
- `C:\Program Files\Git\bin\bash.exe ./build-all.sh`

Live evidence:
- Passing single-anchor report: `reference/live-anchor-alignment/20260706-190822/summary.json`, `14 checks`, `0 failed`.
- Passing single-anchor report: `reference/live-anchor-alignment/20260706-191920/summary.json`, `14 checks`, `0 failed`.
- Passing single-anchor report: `reference/live-anchor-alignment/20260706-192020/summary.json`, `14 checks`, `0 failed`.
- Failing multi-anchor report: `reference/live-anchor-alignment/20260706-192158/summary.json`, `37 checks`, `7 failed`.

Result:
- The previous synthetic-click false positive path is replaced for target processed rows.
- Individual historical anchors can be located and clicked correctly.
- Whole-run parity remains open because sequential multi-anchor audits still fail.
- Local build succeeded and produced `build/codex-web.exe` and `build/codex-agent.exe`.
