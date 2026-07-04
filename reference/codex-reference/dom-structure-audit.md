# Codex DOM Structure Audit

Generated: 2026-07-04T10:46:25.057Z

This audit compares captured extension DOM against the current local Shadow DOM by tag/class/selected attributes. Screenshots are not used as evidence.

## list

| Component | Status | Reference Nodes | Current Nodes | Equal Prefix | First Mismatch |
| --- | --- | ---: | ---: | ---: | --- |
| root | exact | 54 | 54 | 54 |  |
| header | exact | 43 | 43 | 43 |  |
| sessionRow | exact | 1 | 1 | 1 |  |
| composer | exact | 28 | 28 | 28 |  |
| composerFooter | exact | 33 | 33 | 33 |  |
| externalFooter | exact | 3 | 3 | 3 |  |

## plus

| Component | Status | Reference Nodes | Current Nodes | Equal Prefix | First Mismatch |
| --- | --- | ---: | ---: | ---: | --- |
| composer | exact | 28 | 28 | 28 |  |
| composerFooter | exact | 33 | 33 | 33 |  |
| plusMenu | exact | 30 | 30 | 30 |  |

## approval

| Component | Status | Reference Nodes | Current Nodes | Equal Prefix | First Mismatch |
| --- | --- | ---: | ---: | ---: | --- |
| composer | exact | 28 | 28 | 28 |  |
| composerFooter | exact | 33 | 33 | 33 |  |
| approvalMenu | exact | 25 | 25 | 25 |  |

## model

| Component | Status | Reference Nodes | Current Nodes | Equal Prefix | First Mismatch |
| --- | --- | ---: | ---: | ---: | --- |
| composer | exact | 28 | 28 | 28 |  |
| composerFooter | exact | 33 | 33 | 33 |  |
| modelMenu | exact | 53 | 53 | 53 |  |

## thread

| Component | Status | Reference Nodes | Current Nodes | Equal Prefix | First Mismatch |
| --- | --- | ---: | ---: | ---: | --- |
| root | exact | 29 | 29 | 29 |  |
| header | exact | 28 | 28 | 28 |  |
| conversation | exact | 67 | 67 | 67 |  |
| userBubble | exact | 5 | 5 | 5 |  |
| markdown | exact | 17 | 17 | 17 |  |
| assistantActions | exact | 2 | 2 | 2 |  |
| composer | exact | 29 | 29 | 29 |  |
| composerFooter | exact | 38 | 38 | 38 |  |
| externalFooter | exact | 15 | 15 | 15 |  |

## Required Follow-Up

- Treat any `different` status as unfinished unless the difference is a deliberate data-binding hook or host adaptation documented in `reference/codex-panel-worklist.md`.
- Fix structure/class mismatches before using screenshots for visual verification.

