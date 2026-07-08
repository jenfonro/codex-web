# Reset 31 False Positive Archive

Archived: 2026-07-07

This directory contains the former active Reset 31 work file and live probe
evidence. It was moved out of the active evidence path because it did not meet
the user's final acceptance standard.

## Why This Is Archived

- The full same-anchor sweep still failed.
- Some checks reported `ok` while the user could still reproduce live problems.
- Focused probes and currentness checks were useful clues, but they were not a
  whole-conversation visual parity proof.
- The active work file mixed accepted setup/currentness notes with unresolved UI
  parity failures, which can create false positives.

## Archive Contents

- `codex-live-parity-worklist.reset31.md`: former active Reset 31 work file.
- `live-anchor-alignment/`: former active Playwright/CDP anchor evidence.
- `live-currentness/`: former active deployment/currentness evidence.

## Use Rule

These files are clues only. They cannot close tasks, prove parity, or justify
`ready-for-user-review`. Reset 32 must generate fresh evidence in the active
directories after each relevant code change.
