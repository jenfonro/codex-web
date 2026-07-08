# Reset 10 False-Positive Archive

This directory contains Reset 9 work and generated evidence that must not be
used as active acceptance evidence for Codex Web conversation parity.

Why it was archived:

- Reset 9 still included reports that could be mistaken for acceptance even
  though the live deployed UI failed the user's final standard.
- `20260706-225430` reported `0 failed` and is now explicitly treated as a
  false positive.
- `20260706-225828` and `20260706-230936` are useful failure clues, but they
  are not Reset 10 acceptance evidence.

Use these files only as historical clues. New work must be recorded in
`reference/codex-live-parity-worklist.md`.
