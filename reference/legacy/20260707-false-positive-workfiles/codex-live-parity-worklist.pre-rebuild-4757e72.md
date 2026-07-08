# Codex Live Parity Worklist

Created: 2026-07-07
Reset reason: previous work files and audits produced false positives. This file is the only active acceptance source now.

## Scope

Build Codex Web conversation rendering until it matches the live official code-server Codex extension on the same real long conversation.

The first pass is strict parity only. Codex Web-only enhancements are disabled or hidden until the official layout, grouping, collapse, expansion, scrolling, and click behavior are proven correct.

## Source Of Truth

Source page:
- `https://code-tx.zelt.cn/?folder=/root`
- Open Codex from the left Activity Bar icon.
- Do not use the default right chat sidebar capture.
- Close the right chat/auxiliary sidebar.
- Use a source panel width close to the user's real view, about `611px`, or record the exact width.

Target page:
- `https://codex.zelt.cn/`
- Use the same real session content through the current controller/agent path.
- The target must be deployed to the latest tested commit before live browser evidence is accepted.

Browser requirements:
- Windows Chrome through CDP or Playwright.
- Viewport `1920x1080` or larger unless the report records a specific reason.
- Do not accept evidence from a narrow/collapsed layout unless the task is specifically about that layout.

## Non-Negotiable Acceptance Rules

No task is complete unless this file records fresh evidence with:
- identical visible text anchor on source and target;
- proof the compared windows are the same conversation location, not a duplicate text match;
- source and target screenshot for the same anchor window;
- DOM/class structure for the matched rows;
- computed styles for major rows, buttons, disclosure controls, text, spacing, dimensions, and overflow;
- real browser click on every expandable row being verified;
- before-click and after-click expanded state;
- expanded body text/structure when a row can expand;
- scroll behavior evidence for the long conversation window;
- command/build/test evidence;
- commit and deployment evidence when code changed.

Do not mark complete from:
- memory;
- static fixtures only;
- local unit checks only;
- screenshots only;
- a single anchor when the issue can repeat elsewhere;
- a script that does not prove context comparability and real click/expansion behavior.

## Hard Boundaries

- Do not invent a similar UI.
- Do not keep Codex Web-only command enhancements during first-pass parity.
- Do not show `exec_command xN`, `write_stdin`, raw `Chunk ID`, raw shell transcript blocks, or command-enhancement rows unless the official source shows the same content at the same anchor.
- Do not add overlays, drag surfaces, invisible masks, or pointer blockers over the conversation.
- Do not hide scroll problems with clipping, truncation, or reduced history.
- Long conversations must remain readable and navigable.
- If old code conflicts with official behavior, rewrite or remove it. Do not compatibility-patch around wrong grouping.
- If an audit gives a false positive, fix the audit before using it as evidence again.
- Keep the online deployment current after verified changes so the user can test the same build.

## Legacy Work Moved Out

These files are historical only. Their checked items are not accepted:

- `reference/legacy/20260707-false-positive-workfiles/codex-collapse-alignment-worklist.md`
- `reference/legacy/20260707-false-positive-workfiles/codex-panel-worklist.md`
- `reference/legacy/20260707-false-positive-workfiles/codex-panel-implementation-checklist.md`
- `reference/legacy/codex-collapse-alignment-worklist.false-positive-archive-20260707.md`

Any evidence copied from those files must be revalidated under the rules above before it can close a current task.

## Current Verified State

Repository:
- Local branch: `main`
- Local head observed while resetting this file: `4451d06 fix: render patch file changes as activity rows`
- Remote observed: `origin/main`

Administrative reset:
- `c194494 docs: reset codex live parity worklist` created the first reset file.
- This file supersedes that version because it still mixed stale state and open work in a way that could mislead acceptance.

Recent implementation evidence that exists but does not close parity:
- `4451d06 fix: render patch file changes as activity rows`
- Local syntax/unit/build checks were reported for this commit.
- This does not prove live official parity until the source/target anchor audit passes after deployment and agent rebuild.

Deployment caveat:
- Controller may be current, but the Docker agent binary can remain stale if the image/container was not rebuilt.
- Before live parity evidence is accepted, verify the running agent container uses the same commit's agent binary or rebuild/recreate it without deleting persisted data.

## Open Work Board

### P0: Verify Online Target Is Current

Status: verified 2026-07-07 02:26 CST

Problem:
- The user tests `https://codex.zelt.cn/`; it must reflect the latest pushed code.
- Controller and agent can drift because the agent binary is baked into the Docker image.

Required evidence:
- `origin/main` commit hash.
- Server repo commit hash.
- `./build-all.sh` success on server.
- `codex-web.service` restart and active status.
- Agent container rebuilt/recreated when agent code changed.
- `/api/nodes` shows the expected agent online.
- `https://codex.zelt.cn/` returns `200`.

### P0: Remove Overlay / Pointer / Drag Regression

Status: open

Problem:
- User reported the whole conversation surface could be dragged, and processed rows could not be clicked.
- This must be tested as a click/scroll problem, not treated as a visual-only issue.

Required evidence:
- Live target long conversation opened.
- `elementFromPoint` at processed-row click coordinates returns the row/control, not an overlay.
- Real click toggles the disclosure state.
- Wheel scroll works newest-to-oldest across multiple anchor windows without flicker, jump loops, or stuck scroll.
- Screenshot and DOM state before/after click.

### P0: Processed Row Grouping And Expansion

Status: open

Problem:
- Official extension shows processed-time rows with collapsible details.
- Target previously showed static processed rows, misplaced body text, or non-expandable rows.

Required evidence:
- At least three matched processed rows from the same long conversation.
- Source and target both clicked open by browser automation.
- Compare label placement, processed duration position, disclosure icon/state, expanded body, spacing, overflow, classes, and computed styles.

### P0: File / Diff Activity Rows

Status: evidence pending

Problem:
- Official extension groups file/code changes into file/diff-style blocks.
- Target previously rendered file changes as plain text.

Current implementation note:
- `4451d06` maps `patch_apply_end` into `file_change` and renders file activity rows.
- This is not accepted until verified live against official anchors.

Required evidence:
- Matched anchors where source shows file/diff blocks.
- Target shows equivalent file activity rows, not raw text.
- File path, icon/indicator, spacing, row shape, collapse behavior, and visible labels compared.
- Right-side diff opening can remain future work, but the row display must match.

### P0: Remove Command Enhancement Output From Parity Path

Status: open

Problem:
- Target previously displayed extra command summaries such as `exec_command xN`.
- User requested first-pass parity before enhancements.

Required evidence:
- Code scan lists all command-enhancement render paths and confirms they are disabled/removed for parity.
- Matched live anchors prove no extra command blocks appear where source does not show them.

### P0: Long Conversation Performance Without Content Truncation

Status: open

Problem:
- Long sessions caused white screen/crash or slow open.
- It is not acceptable to solve this by cutting content.

Required evidence:
- Long conversation opens on live target.
- No white screen.
- Browser console has no fatal render errors.
- Memory/render strategy keeps all content accessible through virtualization or chunked loading.
- Anchor search can navigate newest-to-oldest without losing content.

### P1: Whole-Conversation Anchor Inventory

Status: open

Problem:
- A few visible windows cannot prove parity for the whole long conversation.

Required evidence:
- Generate an anchor inventory from newest-to-oldest.
- Include user-message anchors, processed-row anchors, file/diff anchors, final-answer anchors, and running/thinking state anchors when available.
- Reject duplicate or non-comparable anchors and record why.
- Each accepted anchor has source and target context fingerprints.

### P1: Audit Script Hardening

Status: open

Problem:
- Previous scripts produced false positives.

Required evidence:
- Scripts record stage logs, timeouts, rejected anchors, and comparability checks.
- Scripts record before/after real-click expansion state.
- Scripts fail when source has expandable rows but target cannot expand them.
- Scripts fail when source has file/diff rows and target shows raw text.

### P1: Remove Wrong Legacy UI Code

Status: open

Problem:
- Earlier near-match work may have left fixture-only helpers, static rendering paths, stale code-server naming, or wrong grouping branches.

Required evidence:
- Code scan identifies these paths.
- Remove or refactor code that is not needed for current architecture or verified parity.
- Build passes.
- Live browser checks prove behavior did not regress.

## Required Live Audit Flow

1. Confirm local worktree status.
2. Confirm server and agent deployment are current.
3. Open source at `https://code-tx.zelt.cn/?folder=/root`.
4. Move/open Codex from the left Activity Bar icon and close the right chat sidebar.
5. Set source panel width near `611px` and viewport at least `1920x1080`.
6. Open target at `https://codex.zelt.cn/`.
7. Select the same long conversation on both.
8. Work newest-to-oldest.
9. For each anchor:
   - locate identical visible text;
   - verify context comparability;
   - capture screenshots;
   - capture DOM/classes/computed styles;
   - click any collapsible rows on both pages;
   - capture expanded state/body;
   - record pass/fail.
10. Fix the first real blocker.
11. Re-run the same anchor and at least the neighboring windows.
12. Commit, push, deploy, and record evidence.

## Evidence Log

### 2026-07-07: Work File Rebuilt

Administrative evidence:
- Active work file rebuilt at `reference/codex-live-parity-worklist.md`.
- Legacy false-positive files remain under `reference/legacy/`.
- No UI parity task is closed by this reset.

Command evidence:
- `git status --short --branch`
- `git log --oneline -5`
- `Get-ChildItem -Recurse -File reference | Where-Object { $_.Name -match 'worklist|checklist|todo|plan' }`

Result:
- Only this file is active.
- All previous checklist completion must be revalidated.

### 2026-07-07 02:26 CST: Online Target Synced To Current Main

Task:
P0: Verify Online Target Is Current

Status:
Verified for deployment/currentness only. No UI parity task is closed by this evidence.

Command evidence:
- Local pushed commit: `2e30974 docs: rebuild live parity acceptance worklist`
- Server command sequence:
  - `git fetch origin`
  - `git reset --hard origin/main`
  - `./build-all.sh`
  - `systemctl restart codex-web.service`
  - `./scripts/build-agent-image.sh`
  - `./scripts/run-agent-container.sh --detach`
- Server repo head after deploy: `2e30974`
- `codex-web.service`: `active`
- Agent image rebuilt: `sha256:f884024b2674835c8ec117f9461dd63b8389ddf71d89e2b2b2d3cfb1d7ee8277`
- Agent container state: `running`
- Agent container start time: `2026-07-06T18:26:09.393020455Z` UTC
- `curl -I https://codex.zelt.cn/`: `HTTP/1.1 200 OK`
- `curl https://codex.zelt.cn/api/nodes`: `host-docker-agent` online, `lastSeen` `2026-07-06T18:26:09.839878813Z` UTC

Result:
- The online controller and Docker agent were rebuilt/restarted from current `origin/main`.
- Live source/target visual parity remains unverified and open.

## Closure Template

Use this format when closing any task:

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
Command evidence:
Report path:
Commit:
Deployment:
Result:
Remaining risk:
```
