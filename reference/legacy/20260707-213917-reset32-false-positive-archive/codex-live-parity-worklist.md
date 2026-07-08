# Codex Web Live Parity Worklist

Created: 2026-07-07
Reset: 32
Status: active

Reset 32 exists because Reset 31 still produced false-positive confidence. The
active work now starts from a clean evidence state. Previous Reset 31 files were
moved to:

- `reference/legacy/20260707-reset31-false-positive-archive/`

The active evidence directories were reset at the start of Reset 32:

- `reference/live-currentness/`
- `reference/live-anchor-alignment/`

No visual parity task is complete right now.

Current Reset 32 evidence inventory:

- `reference/live-anchor-alignment/20260707-125806/`: R32 anchor-plan
  dry run only. It found usable CDP/reference/target setup and proved the new
  plan filter rejects file-line anchors, but it still failed on two
  source/target context mismatches. This is not visual parity proof.
- `reference/live-anchor-alignment/20260707-130116/`: target-only latest-window
  interaction probe. It passed its own checks, but it does not compare against
  the official reference and therefore cannot close any visual parity task.
- `reference/live-anchor-alignment/20260707-130334/`: target-only focused old
  window probe for seq `444`. It failed 4 checks and reproduced the old-window
  scroll/disclosure problem. This is failure evidence, not completion proof.
- `reference/live-currentness/20260707-132251/`: post-deploy currentness for
  commit `d646c23`. It proves live freshness only.
- `reference/live-anchor-alignment/20260707-132251/`: target-only focused old
  window regression for seq `444` on latest deployed commit `d646c23`. It
  passed 11 checks with 7 observed rendered windows. This proves the target-side
  scroll/disclosure regression is fixed, but it is still not official
  source/target visual parity proof.

## Non-Negotiable Acceptance Standard

The target must match the official code-server Codex extension in the same long
conversation at the same visible text positions.

Required live setup:

- Reference: `https://code-tx.zelt.cn/?folder=/root`
- Target: `https://codex.zelt.cn/?nodeId=host-docker-agent`
- Session: `019f0a04-7f0b-7483-8bc4-18f214a5c8f1`
- Viewport: `1920x1080` or larger.
- Reference Codex must be opened from the left Activity Bar icon.
- Reference right chat/sidebar must be closed.
- Target must be running the latest committed and deployed code.

Required comparison method:

- Compare newest-to-oldest across the whole long conversation.
- Use the same visible text anchor in both browsers.
- Use surrounding visible text to prove both sides are at the same occurrence.
- Reject repeated, unstable, source-missing, target-missing, or overly long
  anchors.
- Use real Playwright/CDP input for scrolling, clicking, expanding, and
  collapsing.
- Expand every official expandable row that appears in the compared viewport.
- Record failures as failures. Do not convert failed probes into partial
  success.

## False Positive Rules

- Old Reset 30 and Reset 31 evidence is never completion proof.
- Currentness only proves deployment freshness, not UI parity.
- A single anchor never proves whole-conversation parity.
- Static screenshots never prove clickable behavior.
- Source-only or target-only checks never prove parity.
- Approximate visual similarity is not enough.
- If the user can reproduce a mismatch on the live site, the related task is
  open again.
- Do not keep target-only enhancements while matching the official extension.
- Do not mark a task complete until the evidence package below exists.

## Evidence Package Required For Any Visual Completion

For every visual task that claims completion, record fresh Reset 32 evidence
with:

- local HEAD, origin HEAD, server HEAD, and browser asset version;
- `codex-web.service` state and agent/container state;
- selected target node and session;
- viewport size for reference and target;
- browser console error count, page error count, and failed HTTP count;
- source and target screenshots at the same visible text anchor;
- surrounding text proving the same occurrence;
- DOM hierarchy, classes, attributes, row order, and grouping;
- computed styles for font, color, spacing, dimensions, overflow, borders,
  radius, icons, disclosure rows, file rows, and buttons;
- real input evidence for every expandable/clickable control;
- hit-test proof that the intended row receives the click;
- expanded body proof when the official reference expands;
- upward scroll proof across multiple windows;
- proof that no overlay, drag layer, virtualizer spacer, composer, or hidden
  element intercepts message clicks;
- code checks, build, commit, push, deploy, and post-deploy currentness after
  product changes.

## Known Failure Clues From Archived Reset 31

These are clues only, not accepted evidence:

- The full sweep `20260707-122911` reported `540 checks, 20 failed`.
- Some anchors were invalid or unstable: source/target missing, search budget
  exceeded, overly long anchors, or file-reference-like anchors.
- Several anchors had viewport position mismatches larger than tolerance.
- File/activity row mismatches remained at some anchors.
- The user reproduced that collapsed `已处理 XXs` rows could not be clicked or
  expanded on the live site.
- The user reproduced an unwanted page-wide drag/selection-like surface.
- The user clarified the issue is scrolling/click interception, not a sidebar
  resize feature.
- Long conversation scrolling is still not accepted.

## Current User Issues To Fix First

- Long conversation scrolling can fail, jump, flicker, or trap the page.
- `已处理 XXs` rows must click, expand, collapse, and show the official body.
- No overlay, drag surface, virtualizer spacer, composer, or hidden element may
  intercept conversation clicks.
- Official grouping and collapse rules must be matched before style polishing.
- File/diff activity blocks must render as official structured rows, not as raw
  text, markdown dumps, or target-only summaries.
- Extra command execution summaries inside official collapsed rows must stay
  removed during parity work.
- Focused old-range loading can currently merge an old event range with the
  latest event range into one rendered turn. This can create wrong grouping,
  scroll jumps, and unclickable disclosure rows.

## Tasks

### R32-A0. Archive Reset 31 false-positive work

Status: done-admin

Scope:

- Move Reset 31 active work file and active evidence out of the active paths.
- Leave active evidence directories clean with only `.gitkeep`.
- Create this Reset 32 work file.

Acceptance:

- Administrative only. This accepts no UI parity.

### R32-A1. Rebuild the audit baseline

Status: in-progress

Scope:

- Update the anchor audit so invalid anchors are rejected before they enter the
  parity count.
- Keep the comparison strict, but do not let bad anchors create misleading
  product conclusions.
- Add explicit failure output for source missing, target missing, ambiguity,
  search timeout, and insufficient surrounding context.

Acceptance:

- A dry run produces a valid newest-to-oldest anchor plan.
- The plan contains only anchors that can be located in both browsers with
  surrounding-context proof.

Reset 32 evidence:

- Evidence directory:
  `reference/live-anchor-alignment/20260707-125806/`
- Command:
  `DISCOVER_SOURCE_ANCHORS=1 DISCOVER_MAX_ANCHORS=8 DISCOVER_MAX_WINDOWS=20 ANCHOR_PLAN_ONLY=1 REAL_CLICK_ALL_DISCLOSURES=1 node scripts/audit-codex-live-anchor-alignment.cjs`
- Result: `14 checks, 1 failed`.
- Anchor plan: `8 candidates, 4 accepted, 2 rejected, 2 plan failures`.
- Correctly rejected invalid file-line anchors:
  `app.go (line 45)`, `README.md (line 3)`.
- Remaining failures are not accepted:
  - `你需要注意 agent应该是在项目根目录/agent 而不是还在backend里面`
    failed source/target context comparison.
  - `那你按这个进行完全实现...参照openlist项目严格按照模块进行分类`
    failed source/target context comparison.
- R32-A1 remains in progress because the plan still has target
  visual/context failures.

### R32-A2. Prove live currentness from clean evidence

Status: currentness-only

Scope:

- Verify local HEAD, origin HEAD, server HEAD, service state, agent/container
  state, and browser asset version.
- Store fresh evidence under `reference/live-currentness/`.

Acceptance:

- This can only become currentness proof. It cannot close visual parity.

Reset 32 evidence:

- Evidence directory:
  `reference/live-currentness/20260707-132251/`
- Local HEAD: `d646c2397ece3593787c3db2c5dea045ea49c336`.
- Server HEAD: `d646c2397ece3593787c3db2c5dea045ea49c336`.
- Browser asset versions: script/CSS/runtime `20260707132234`.
- `codex-web.service`: `active`.
- Agent container: `codex-web-agent codex-web-agent:local Up`.
- Browser console warnings/errors: `0`.
- Result: accepted as currentness-only. No visual parity accepted.

### R32-A3. Reproduce and fix scroll/click interception

Status: in-progress

Scope:

- Reproduce the live target problem on the long session with `1920x1080` or
  larger viewport.
- Prove what element receives clicks on `已处理 XXs`.
- Prove whether any overlay, drag surface, virtualizer spacer, composer, or
  hidden element intercepts messages.
- Fix the product code only after the failing element is identified.

Acceptance:

- Same-anchor evidence shows normal upward scrolling across multiple windows.
- Real click evidence shows `已处理 XXs` rows receive input and expand.
- The evidence explicitly rules out the unwanted page-wide drag surface.

Reset 32 evidence and implementation notes:

- Evidence directory:
  `reference/live-anchor-alignment/20260707-130116/`
- Result: `10 checks, 0 failed`, target-only latest-window interaction probe.
  This is not accepted because it did not compare against the official
  reference and did not cover the old focused range.
- Evidence directory:
  `reference/live-anchor-alignment/20260707-130334/`
- Command: `LIVE_FOCUS_SEQ=444 node scripts/audit-codex-live-target-interactions.cjs`
- Result: `11 checks, 4 failed`.
- Failure details:
  - focus seq `444` was rendered;
  - processed disclosure did not toggle twice in the initial focused view;
  - processed disclosure did not toggle twice after scroll;
  - wheel scroll did not move the viewport;
  - only one rendered window was observed.
- Critical clue: the focused rendered window mixed old seqs around `444..693`
  with latest seqs around `7555..7572` inside one turn. This is likely a
  grouping/range boundary bug, not just a click overlay bug.
- Product code change started in `frontend/src/pages/codex/grouping.js`: split
  conversation groups when adjacent loaded events have a large sequence gap.
  Local data validation showed seq `444` no longer merges with latest events,
  but this is not live acceptance until committed, deployed, and verified with
  same-anchor source/target evidence.
- First post-deploy evidence:
  `reference/live-anchor-alignment/20260707-131547/`.
  Result: `11 checks, 3 failed`. The range-gap fix improved the earlier total
  scroll lock, but expanding `已处理 32m 23s` still pushed the disclosure button
  out of view, so the second toggle could not be clicked.
- Follow-up product fix in `frontend/src/pages/codex/index.js`: preserve the
  same disclosure-button scroll anchor through file-detail hydration renders.
  Removed the old one-off wrapper so the click path has a single scroll intent.
- Post-fix target-only evidence:
  `reference/live-anchor-alignment/20260707-132033/`.
  Result: `11 checks, 0 failed`, `18` scroll steps, `7` observed rendered
  windows.
  - requested focus seq `444` rendered in range `1-7654`;
  - initial `已处理 32m 23s` real click expanded and collapsed;
  - after-scroll `已处理 32m 23s` real click expanded and collapsed;
  - wheel scroll changed viewport from `5663` to `0`;
  - no Codex Web-only command transcript rows were visible;
  - browser console/page errors were `0`.
- Latest deployed target-only evidence:
  `reference/live-anchor-alignment/20260707-132251/`.
  Result: `11 checks, 0 failed`, `18` scroll steps, `7` observed rendered
  windows on deployed commit `d646c23`.
- R32-A3 remains in progress because this proof is target-only. Same-anchor
  source/target evidence is still required before this task can close.

### R32-A4. Match official processed disclosure grouping

Status: open

Scope:

- Match official placement, row order, label, duration, icon, spacing,
  collapsed body, expanded body, and nested content for `已处理 XXs`.
- Remove any remaining target-only command summaries from the official parity
  path.

Acceptance:

- Fresh same-anchor evidence shows collapsed and expanded states match the
  reference at every discovered processed-disclosure viewport.

### R32-A5. Match official file/diff activity rows

Status: open

Scope:

- Compare official structured file/diff rows at the same anchors.
- Render file changes as official row groups.
- Keep right-side diff preview out of scope unless it affects the left
  conversation row.

Acceptance:

- Fresh same-anchor evidence shows file/diff activity blocks match official
  grouping and visible style.

### R32-A6. Audit and remove wrong earlier code

Status: open

Scope:

- Scan conversation renderer, virtualizer, scroll restoration, disclosure
  handling, session loading, and target-only enhancement code.
- Remove dead paths, compatibility patches, approximate UI behavior, and
  code-server leftovers that conflict with the current product structure.

Acceptance:

- The code path for conversation rendering is explainable by current product
  requirements, not by earlier failed experiments.
- Required tests and browser checks still pass.

### R32-A7. Final whole-conversation parity sweep

Status: open

Scope:

- Run the final newest-to-oldest sweep over the whole long conversation.
- Compare reference and target at the same visible anchors.
- Expand/collapse every official expandable row encountered.
- Record all failures, fix them, then rerun from clean evidence.

Acceptance:

- Full Reset 32 evidence package passes.
- No anchor, scroll, disclosure, file row, click, console, page, or HTTP failure
  remains.
- Only then may the live site be handed to the user for review.
