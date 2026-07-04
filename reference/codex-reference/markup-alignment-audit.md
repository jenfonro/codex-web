# Codex Markup Alignment Audit

Generated: 2026-07-04T10:46:27.745Z

This audit compares canonical markup from captured extension DOM to the current Codex Web Shadow DOM. Screenshots are not used.

## list

| Component | Status | Reference Lines | Current Lines | Equal Prefix | First Mismatch |
| --- | --- | ---: | ---: | ---: | --- |
| sessionRow | exact | 2 | 2 | 2 |  |
| composer | exact | 51 | 51 | 51 |  |
| composerFooter | exact | 43 | 43 | 43 |  |
| externalFooter | exact | 3 | 3 | 3 |  |

## plus

| Component | Status | Reference Lines | Current Lines | Equal Prefix | First Mismatch |
| --- | --- | ---: | ---: | ---: | --- |
| plusMenu | exact | 38 | 38 | 38 |  |

## approval

| Component | Status | Reference Lines | Current Lines | Equal Prefix | First Mismatch |
| --- | --- | ---: | ---: | ---: | --- |
| approvalMenu | exact | 31 | 31 | 31 |  |

## model

| Component | Status | Reference Lines | Current Lines | Equal Prefix | First Mismatch |
| --- | --- | ---: | ---: | ---: | --- |
| modelMenu | exact | 70 | 70 | 70 |  |

## thread

| Component | Status | Reference Lines | Current Lines | Equal Prefix | First Mismatch |
| --- | --- | ---: | ---: | ---: | --- |
| header | exact | 35 | 35 | 35 |  |
| conversation | exact | 260 | 260 | 260 |  |
| userBubble | exact | 6 | 6 | 6 |  |
| markdown | exact | 36 | 36 | 36 |  |
| assistantActions | exact | 3 | 3 | 3 |  |
| composer | exact | 56 | 56 | 56 |  |
| composerFooter | exact | 48 | 48 | 48 |  |
| externalFooter | exact | 17 | 17 | 17 |  |

## Rule

- Any `different` status is unfinished unless the mismatch is documented as a required runtime adapter and kept out of visible styling/structure.
- Fix markup/code differences before accepting screenshot similarity.
