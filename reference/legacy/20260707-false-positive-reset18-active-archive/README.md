# Reset 18 False-Positive Archive

Archived: 2026-07-07 +08:00

This directory contains the former active Reset 18 workfile and live evidence.
They are no longer active proof for Codex Web conversation parity.

## Why This Was Moved Out

Reset 18 still allowed false-positive conclusions:

- Target-only checks were treated as progress even though the final reference
  comparison standard was not met.
- Script checks and currentness reports were useful diagnostics, but they did
  not prove visual, grouping, collapse, or interaction parity.
- Some source-side click failures were explained as audit limitations without a
  complete human-visible same-anchor parity pass.
- User-reported live issues still showed the page was not acceptable by the
  required standard.

## Archived Contents

- `codex-live-parity-worklist.md`: previous Reset 18 active workfile.
- `live-anchor-alignment/`: previous Reset 18 live anchor reports.
- `live-currentness/`: previous Reset 18 deployment/currentness reports.

These files may be used only as investigation clues. They cannot close any
current task.

## Unaccepted Audit Script Delta

Before this archive was created, `scripts/audit-codex-live-anchor-alignment.cjs`
had an uncommitted Reset 18 audit-script change that:

- changed file activity labels to derive from disclosure body text;
- reduced the visible bottom hit-test area by `160px`;
- added file-stat fallback extraction from nearby turn text.

That delta was not accepted as proof and should not be used to weaken the gate.
Any future audit-script change must be validated against real browser behavior,
same visible text anchors, screenshots, DOM/computed evidence, and real hit-test
results.
