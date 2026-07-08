# False Positive Reset 19 Archive

Archived: 2026-07-07 12:56:09 +08:00

This directory contains the active Reset 19 workfile and local evidence that
were moved out before rebuilding Reset 20.

Reason:

- Reset 19 still produced false positives.
- Target-only checks were recorded but did not satisfy final parity acceptance.
- Currentness checks were recorded but did not prove visual or interaction
  parity.
- Partial same-anchor checks still had unresolved mismatches and could not close
  the work.

Use this archive only as investigation context. Do not use it to mark any
Reset 20 task accepted.

Archived local evidence:

- `live-anchor-alignment/`
- `live-currentness/`

The evidence directories are local reference artifacts and are ignored by git.
