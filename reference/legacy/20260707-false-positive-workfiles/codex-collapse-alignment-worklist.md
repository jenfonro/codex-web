# Codex Conversation Alignment Worklist

## Status
- Active worklist rebuilt on 2026-07-07 after the previous file produced false-positive acceptance records.
- The old mixed-history worklist is archived at `reference/legacy/codex-collapse-alignment-worklist.false-positive-archive-20260707.md`.
- The archived file is for traceability only. It is not an acceptance source for current work.
- Current target: make Codex Web conversation rendering match the official code-server Codex extension for the same real long conversation.

## Non-Negotiable Acceptance Standard
- Source page: `https://code-tx.zelt.cn/?folder=/root`.
- Target page: `https://codex.zelt.cn/`.
- Browser environment: Windows Chrome/CDP or Playwright, viewport `1920x1080` or larger.
- The source Codex extension must be opened from the left Activity Bar icon.
- The right chat/auxiliary sidebar must be closed before every source capture.
- The source Codex panel must not be captured at the default narrow width. Use about `611px` sidebar width or another width close to the user's real view.
- Validation must use the same real long conversation on both sides.
- Validation must locate the same content by identical visible text anchors, not by unrelated scroll positions or generic screenshots.
- Validate newest-to-oldest by reverse scrolling from the latest visible content upward.
- Final acceptance must cover the whole long conversation through anchor-matched windows. A few matching windows are not enough.
- For every matched window, compare actual rendered output: grouping, collapse state, expanded state, text, icons, spacing, file/diff rows, thinking/running rows, processed-time rows, and scrolling behavior.
- For every `已处理` / `Processed` / collapsible activity row in a matched source window:
  - Click it in source using real browser interaction.
  - Click the corresponding row in target using real browser interaction.
  - Compare expanded text, visible structure, DOM/classes, key computed styles, height, overflow, and collapse/expand behavior.
  - A target row that looks clickable but does not expand is a failure.
  - A target body that shows Codex Web-only command enhancements is a failure unless source shows the same content at the same anchor.
- First-pass parity must not visibly render Codex Web-only enhancements:
  - no `exec_command xN` grouped command enhancement;
  - no `write_stdin` enhancement row;
  - no raw `Chunk ID`, command output, or shell transcript inside processed summaries unless official source shows it there.
- Static audits, source checks, fixture checks, or count-only checks cannot mark this complete.
- Screenshots are supporting evidence only. They do not replace DOM, style, behavior, and anchor matching.
- Do not mark an item complete from memory. Every completion must include fresh command or browser evidence.

## Workflow Rules
- When the user reports a new issue during implementation, add it to `Open Issues` first, then fix it after the current active point is stable.
- Do not keep layering compatibility patches over wrong behavior. If a previous implementation conflicts with official parity, rewrite or remove it.
- When a test or audit gives a false positive, update the test standard before using it again.
- If official extension source and live rendered DOM disagree, live DOM for the same runtime state wins. Record the disagreement.
- Online deployment must be kept current after verified local changes so the user can test `https://codex.zelt.cn/`.

## Required Evidence Before Completion
- `git status --short --branch` showing the intended changes.
- `node --check` for every changed frontend and audit script.
- Relevant local browser audits with fixture mode only as a fast regression guard.
- Real live anchor audit against `https://code-tx.zelt.cn/?folder=/root` and `https://codex.zelt.cn/`.
- Real source and target expansion checks for every collapsible row found in the sampled anchor windows.
- `./build-all.sh`.
- `go test ./...` in `backend` if backend changed.
- `go test ./...` in `agent` if agent changed.
- Commit pushed to `origin/main`.
- Server `/root/code/codex-web` reset or pulled to the pushed commit, rebuilt on server, and `codex-web.service` restarted.
- Live checks:
  - `GET https://codex.zelt.cn/` returns `200`;
  - `GET https://codex.zelt.cn/api/nodes` shows the expected agent online;
  - stale fixture route is not exposed in normal mode unless explicitly enabled.

## Current Open Issues
- [done] Rebuild the active worklist and move the previous false-positive-heavy file out of the current acceptance path.
- [in-progress] Upgrade the live anchor audit so it matches visible text anchors, prefers top-level rendered turns, rejects zero-size/nested matches, and reports per-anchor stages/timeouts.
- [in-progress] Fix target `已处理` / `Processed` rows so process-only assistant text is a real expandable disclosure body instead of static text.
- [open] Re-run the long conversation validation newest-to-oldest until the whole thread is covered by anchor-matched windows.
- [open] Remove or rewrite any previous Codex Web-only command display code that still affects official-parity rendering.
- [open] Verify long conversation scrolling does not jump, flicker, block wheel scroll, or block disclosure clicks.

## Active Change Notes
- Current local changes under verification:
  - `frontend/src/pages/codex/activity-summary.js`: marks non-explicit final assistant text as summary body when a processed summary exists.
  - `frontend/src/pages/codex/activity-summary.js`: also keeps explicit final answers outside while moving pre-final commentary into the processed disclosure body.
  - `frontend/src/pages/codex/renderer.js`: renders that summary body inside the processed disclosure and keeps explicit final answers outside.
  - `scripts/audit-codex-live-anchor-alignment.cjs`: adds per-stage logging, per-anchor locate timeout, and fixes processed-disclosure classification so file/edit rows are not counted as processed rows just because they share a turn.

## Evidence Log
- 2026-07-07: active worklist rebuilt. Previous worklist archived because it mixed outdated direction, false-positive reports, and superseded acceptance claims.
- 2026-07-07: verified the rebuilt file with UTF-8 `Get-Content`; Chinese labels such as `已处理` are readable and the archived file is outside the active worklist path.
- 2026-07-07: local script syntax checks passed for `scripts/audit-codex-live-anchor-alignment.cjs`, `frontend/src/pages/codex/index.js`, and `frontend/src/pages/codex/renderer.js`. The live anchor audit is being upgraded to collect per-window disclosure probes with expansion state, body text, DOM class/style samples, and command-enhancement leakage checks. This is tool hardening only; it is not final acceptance evidence yet.
- 2026-07-07: live one-anchor smoke against `./build-all.sh` produced `reference/live-anchor-alignment/20260706-173316/summary.json` with `1` expected failure: the source and target matched different duplicate-anchor contexts. This is now reported as `source/target matched context is comparable` instead of allowing disclosure checks to compare unrelated windows.
- 2026-07-07: local regression checks after rebuild passed: `node --check` for the changed JS files, `./build-all.sh`, `audit-codex-virtual-scroll.cjs` (`0 failed`), `audit-codex-disclosure-collapse.cjs` (`0 failed`), `audit-workspace-native-interactions.cjs` (`0 failed`), `audit-codex-activity-summary-rules.cjs`, `audit-codex-event-mapping.cjs` (`0 failed`), and `audit-codex-markdown-reference-rules.cjs`. Local normal mode restored afterward: `/` returned `200`, `/app/codex-fixtures.js` returned `404`.
- 2026-07-07: 3-anchor live audit `reference/live-anchor-alignment/20260706-174533/summary.json` found real parity failures: comparable anchors 1 and 3 had official source processed rows expandable with bodies, while target processed rows were static (`target processed expandable=0`). Anchor 2 target was not visible after centering and remains a focus/visibility investigation item.
- 2026-07-07: local fix added for process-only assistant text placement. Fresh local checks passed before deploy: `node --check frontend/src/pages/codex/activity-summary.js`, `node --check frontend/src/pages/codex/renderer.js`, `node --check scripts/audit-codex-live-anchor-alignment.cjs`, `./build-all.sh`, `audit-codex-disclosure-collapse.cjs` (`0 failed`), `audit-codex-virtual-scroll.cjs` (`0 failed`), `audit-workspace-native-interactions.cjs` (`0 failed`), `audit-codex-activity-summary-rules.cjs`, `audit-codex-event-mapping.cjs` (`0 failed`), and `audit-codex-markdown-reference-rules.cjs`.
- 2026-07-07: post-deploy 3-anchor live audit `reference/live-anchor-alignment/20260706-175225/summary.json` showed that explicit-final turns still produced static target processed rows because pre-final commentary was dropped from summary body. Added a second local fix to put pre-final commentary into processed disclosure body while keeping final answers outside. Fresh local checks passed again: `node --check` for changed JS files, `./build-all.sh`, `audit-codex-disclosure-collapse.cjs` (`0 failed`), `audit-codex-virtual-scroll.cjs` (`0 failed`), `audit-workspace-native-interactions.cjs` (`0 failed`), `audit-codex-activity-summary-rules.cjs`, `audit-codex-event-mapping.cjs` (`0 failed`), and `audit-codex-markdown-reference-rules.cjs`.
