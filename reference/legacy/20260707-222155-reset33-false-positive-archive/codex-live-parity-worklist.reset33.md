# Codex Web Official Conversation Parity Worklist

Created: 2026-07-07
Reset: 33
Status: active

Reset 33 replaces Reset 32 because earlier work produced false-positive
confidence. Target-only checks, currentness checks, and partial screenshots were
mixed into the active notes too easily. Those files have been moved out of the
active evidence paths.

Archived false-positive work:

- `reference/legacy/20260707-213917-reset32-false-positive-archive/`

Active evidence starts empty again:

- `reference/live-currentness/`
- `reference/live-anchor-alignment/`

No visual parity task is complete at the start of Reset 33.

## Non-Negotiable Target

Codex Web must match the official code-server Codex/ChatGPT conversation view
for the same long saved conversation. Matching means behavior and rendering, not
approximate visual similarity.

Reference:

- URL: `https://code-tx.zelt.cn/?folder=/root`
- The Codex extension must be opened from the left Activity Bar icon.
- The right chat/sidebar must be closed.

Target:

- URL: `https://codex.zelt.cn/?nodeId=host-docker-agent`
- Session: `019f0a04-7f0b-7483-8bc4-18f214a5c8f1`
- Target must run the latest committed, pushed, built, and deployed code.

Browser setup:

- Viewport must be `1920x1080` or larger.
- Compare newest-to-oldest because both views open near the latest messages.
- Use the same visible text anchors in both browsers.
- Use surrounding text to prove both sides are at the same occurrence.

## False Positive Rules

These never prove completion:

- target-only checks;
- source-only checks;
- deployment/currentness checks;
- one screenshot;
- one anchor;
- approximate style matching;
- static DOM inspection without real browser behavior;
- screenshots polluted by hover popovers, overlays, or wrong sidebars;
- checks performed at a smaller viewport;
- anchors that are repeated, unstable, source-missing, target-missing, too long,
  or file-line-like;
- a successful check that does not include the official reference page.

If the user can reproduce a mismatch on the live site, the related task becomes
open again even if an earlier script passed.

## Required Evidence For Completion

Every completed UI item must include fresh Reset 33 evidence with:

- local HEAD, origin HEAD, server HEAD, browser runtime asset version;
- `codex-web.service` state and agent/container state;
- selected node and session id;
- reference and target viewport sizes;
- console error count, page error count, failed HTTP count;
- reference and target screenshots at the same visible anchor;
- surrounding text proving the same occurrence;
- DOM hierarchy, classes, attributes, row order, grouping, and disclosure state;
- computed styles for text, spacing, colors, borders, radius, icons, file rows,
  buttons, overflow, and hit targets;
- real Playwright/CDP input for scroll, click, expand, and collapse;
- hit-test proof that the intended row receives the click;
- expanded-body proof whenever official reference expands;
- upward scroll proof across multiple windows in the long conversation;
- proof that no overlay, drag layer, spacer, composer, or hidden element
  intercepts message clicks;
- code checks, build, commit, push, deploy, and post-deploy currentness after
  product changes.

## Current Open Problems

- Long conversation scrolling is still not accepted as correct.
- Some `已处理 XXs` rows may not be clickable or may not expand/collapse like
  the official extension.
- Processed-summary placement, default expansion, duration row, nested content,
  and row order still need same-anchor official comparison.
- File and diff activity must render as official structured rows, not raw text
  or markdown-like dumps.
- Target-only command execution summaries must stay removed while matching the
  official parity path.
- Earlier renderer, virtualizer, scroll-restoration, and disclosure changes must
  be audited for wrong patches or code-server leftovers.
- User-reported issues during this work must be appended here before or while
  fixing, then verified against the same acceptance standard.

## Active Tasks

### R33-A0. Archive Reset 32 false-positive work

Status: done-admin

Scope:

- Move Reset 32 worklist and active evidence directories to `reference/legacy/`.
- Recreate active evidence directories as clean Reset 33 paths.
- Create this Reset 33 worklist.

Acceptance:

- Administrative only. This accepts no UI parity.

### R33-A1. Restore a trustworthy audit baseline

Status: done-baseline

Scope:

- Re-run the official reference and target audit with strict anchor filtering.
- Reject bad anchors before they enter the parity count.
- Record source missing, target missing, ambiguity, timeout, context mismatch,
  and insufficient context as explicit failures.

Acceptance:

- The anchor plan contains only usable same-occurrence anchors.
- No target-only result is counted as visual parity.

Reset 33 evidence:

- `reference/live-anchor-alignment/20260707-134211/`: plan-only run. It proved
  the reference and target contexts were reachable, but this was not visual
  completion evidence.
- `reference/live-anchor-alignment/20260707-135008/`: full run exposed a false
  viewport-position failure because source coordinates were iframe-local while
  target coordinates were top-page coordinates.
- `reference/live-anchor-alignment/20260707-135609/`: after frame-offset
  normalization, only one repeated-text context mismatch remained.
- `reference/live-anchor-alignment/20260707-140006/`: accepted audit baseline.
  Result: `46 checks, 0 failed`; `6` candidate anchors, `2` accepted, `4`
  rejected (`source-missing=1`, `invalid-text=2`, `ambiguous-context=1`), `0`
  plan failures.

Implementation notes:

- `scripts/audit-codex-live-anchor-alignment.cjs` now attaches CDP frame owner
  offsets to source/target context records before comparing anchor viewport
  positions.
- Repeated anchors with mismatched surrounding context are rejected as
  `ambiguous-context` instead of being counted as target visual failures.
- This accepts the audit baseline only. It does not close whole-conversation UI
  parity.

### R33-A2. Prove live deployment currentness

Status: open

Scope:

- Verify local HEAD, origin HEAD, server HEAD, browser asset version, service
  state, and agent state after product changes.

Acceptance:

- Currentness proof exists, but it is marked currentness-only and does not close
  any visual task.

### R33-A3. Fix long-conversation scroll and click behavior

Status: in-progress

Scope:

- Reproduce the live long-conversation scroll behavior at `1920x1080` or larger.
- Identify the exact element receiving clicks on disclosure rows.
- Remove any overlay, drag surface, virtualizer spacer, or hidden layer that
  intercepts conversation input.

Acceptance:

- Same-anchor reference/target evidence shows normal upward scrolling across
  multiple old-message windows.
- Real clicks expand and collapse `已处理 XXs` rows in the target where the
  official reference does the same.

Reset 33 evidence:

- `reference/live-anchor-alignment/20260707-140349/`: target-only focused old
  range check with `LIVE_FOCUS_SEQ=444`. Result: `11 checks, 1 failed`.
  Failure: initial viewport did not expose a visible processed disclosure
  control, so the first real click could not happen. Scroll and after-scroll
  disclosure click worked.
- `reference/live-currentness/20260707-140800/`: post-deploy currentness for
  commit `605f14a`; browser runtime/script/CSS version `20260707140745`;
  console warnings/errors `0`.
- `reference/live-anchor-alignment/20260707-140834/`: post-deploy target-only
  focused old range check still failed the initial processed-disclosure click.
  DOM probe showed `seq=444` mapped to the user message at the top of a very
  tall expanded turn, while the owning `已处理 32m 23s` toggle sat just above
  the viewport.
- `reference/live-currentness/20260707-141214/`: post-deploy currentness for
  commit `38406f6`; browser runtime/script/CSS version `20260707141200`;
  console warnings/errors `0`.
- `reference/live-anchor-alignment/20260707-141247/`: post-deploy target-only
  focused old range check still failed initial processed-disclosure click.
  Follow-up DOM probe showed the correct processed toggle was selected by the
  product code but later layout/scroll settlement still left it above the
  visible scroll viewport.
- `reference/live-currentness/20260707-141608/`: post-deploy currentness for
  commit `24c1843`; browser runtime/script/CSS version `20260707141555`;
  console warnings/errors `0`.
- `reference/live-anchor-alignment/20260707-141645/`: post-deploy target-only
  focused old range check still failed initial processed-disclosure click.
  Manual scrollTop probes showed the selected processed toggle can be brought
  into view by decreasing scrollTop, but the short delayed re-anchor window was
  not long enough for later layout/virtualizer settlement.

Implementation notes:

- Local product fix started in
  `frontend/src/pages/codex/renderer.js`: when focused sequence restoration
  lands inside an expanded disclosure body, scroll anchoring now targets the
  owning disclosure toggle instead of the body content.
- Follow-up local fix: when focused sequence restoration lands on a user anchor
  whose turn has a processed-summary toggle, scroll anchoring now targets that
  processed toggle. This keeps the official expandable row reachable on initial
  old-range load.
- Third local fix: when focused restoration anchors to a disclosure toggle,
  schedule a short delayed re-anchor loop so post-render height settlement keeps
  the toggle at the intended viewport offset.
- Fourth local fix: extend the delayed disclosure re-anchor loop through
  `1800ms`, matching the audit's `1500ms` initial settle window and later
  virtualizer movement.
- This still requires commit, deploy, currentness proof, and post-deploy
  target/source validation before R33-A3 can close.

### R33-A4. Match official processed-summary grouping

Status: open

Scope:

- Match official grouping, placement, default state, icon, label, duration,
  row order, collapsed state, expanded state, and nested content for processed
  summaries.

Acceptance:

- Fresh same-anchor evidence shows processed-summary rows match official
  behavior and style in both collapsed and expanded states.

### R33-A5. Match official file and diff activity rows

Status: open

Scope:

- Compare official file/diff rows at the same text anchors.
- Render file changes as official structured activity rows.
- Keep right-side diff preview out of scope unless it affects the left
  conversation row.

Acceptance:

- Fresh same-anchor evidence shows file/diff activity blocks match official
  grouping and visible style.

### R33-A6. Audit and remove wrong earlier code

Status: open

Scope:

- Review conversation rendering, grouping, virtualized loading, disclosure
  handling, scroll restoration, session loading, and target-only enhancements.
- Remove dead paths, approximate UI patches, compatibility shims, and leftover
  code-server structures that conflict with the product.

Acceptance:

- The conversation rendering path is explainable by current product
  requirements.
- Browser evidence and code checks still pass after cleanup.

### R33-A7. Final whole-conversation parity sweep

Status: open

Scope:

- Compare the whole long conversation newest-to-oldest with the official
  reference.
- Use same text anchors and surrounding-context proof.
- Expand/collapse every official expandable row encountered.
- Record every mismatch, fix it, deploy it, and rerun from clean evidence.

Acceptance:

- Full Reset 33 evidence package passes.
- No anchor, scroll, disclosure, file-row, click, console, page, HTTP, or
  currentness failure remains.
- Only then can the live site be treated as ready for user review.

## Work Log

- 2026-07-07: Reset 32 evidence and worklist archived because it still allowed
  false-positive confidence. Reset 33 started with no completed parity claims.
- 2026-07-07: R33-A1 accepted as audit-baseline only after frame-offset
  normalization and ambiguous repeated-anchor rejection. R33-A3 old-range
  focused interaction failure reproduced and a local focus-restoration fix was
  added pending deployment validation.
- 2026-07-07: First post-deploy R33-A3 check still failed because `seq=444`
  focused the user anchor above the processed summary. Added a second local
  focus-restoration fix to prefer the processed toggle in that case.
- 2026-07-07: Second post-deploy R33-A3 check still failed because later layout
  settlement left the selected processed toggle above the viewport. Added a
  delayed disclosure re-anchor pass.
- 2026-07-07: Third post-deploy R33-A3 check still failed; manual scrollTop
  probes confirmed direction and showed the delayed re-anchor ended too early.
  Extended the scheduled re-anchor timings.
