# Reset 12 False-Positive Archive

Created: 2026-07-07 +08:00

This directory holds Reset 11 work that is no longer active.

Reason:

- Previous live audits produced green or partially green results without
  satisfying the user's final browser-visible acceptance standard.
- Some anchors only proved the parent turn was present, not that the exact
  nested content was visible and aligned.
- Some reports had no visible file/diff rows in the viewport, so they could not
  close file-row parity.

Contents:

- `codex-live-parity-worklist.reset11-archived.md`: previous active work file.
- `live-anchor-alignment-reset11-archived/`: old generated live anchor evidence.
- `live-currentness-reset11-archived/`: old generated currentness evidence.
- `other-active-artifacts-reset11-archived/`: old generated screenshots,
  captures, and comparison artifacts that should no longer live in the active
  reference area.

Rules:

- Treat everything here as historical context only.
- Do not use a report from this directory as acceptance evidence.
- New acceptance evidence must be produced under Reset 12 and recorded in
  `reference/codex-live-parity-worklist.md`.
