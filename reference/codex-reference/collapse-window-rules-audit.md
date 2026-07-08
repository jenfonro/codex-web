# Codex Collapse Window Rules Audit

Generated: 2026-07-07T22:54:33.622Z

Audits per-window turn grouping, semantic counts, and turn-level DOM/computed-style evidence from the latest collapse-alignment capture.

Capture: `reference\collapse-alignment\20260707-225412\summary.json`

## Summary

- Checks: 27
- Failed: 0

## Checks

| Check | Status | Details |
| --- | --- | --- |
| source scroll chunks are readable | ok | chunks=20 |
| source has multiple unique virtual windows | ok | unique=18 |
| source every visible turn has style evidence | ok | 146/146 |
| source every visible turn has DOM signature evidence | ok | 146/146 |
| source every visible turn has semantic selector evidence | ok | 146/146 |
| source grouped turns contain user anchors | ok | userAnchors=22 |
| source grouped turns contain assistant units | ok | assistantUnits=86 |
| source turn grouping has no rule violations | ok |  |
| source processed summary text appears in captured windows | ok | windows=17 |
| source file reference windows are captured | ok | windows=9 |
| target scroll chunks are readable | ok | chunks=9 |
| target has multiple unique virtual windows | ok | unique=6 |
| target every visible turn has style evidence | ok | 59/59 |
| target every visible turn has DOM signature evidence | ok | 59/59 |
| target every visible turn has semantic selector evidence | ok | 59/59 |
| target grouped turns contain user anchors | ok | userAnchors=10 |
| target grouped turns contain assistant units | ok | assistantUnits=15 |
| target turn grouping has no rule violations | ok |  |
| target processed summary text appears in captured windows | ok | windows=9 |
| target file reference windows are captured | ok | windows=7 |
| target activity headers are captured | ok | sourceMax=3, sourceSemanticMax=2, targetMax=2, targetSemanticMax=2 |
| target tool disclosures are captured | ok | sourceMax=6, sourceSemanticMax=4, targetMax=2, targetSemanticMax=2 |
| target windows with activity keep matching tool disclosure coverage | ok |  |
| target official-alignment windows do not expose Codex Web command enhancement rows | ok | windows=0 |
| target official-alignment windows do not expose grouped command child rows | ok | windows=0 |
| source and target both expose processed summary rows | ok | source=4, target=2 |
| source and target both expose file reference styling windows | ok | source=6, target=12 |

## Window Coverage

| Side | Chunks | Unique Windows | Turns | Groups | Content Units | User Anchors | Assistant Units | Style Evidence | Signature Evidence | Semantic Evidence | Issues |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| source | 20 | 18 | 146 | 38 | 108 | 22 | 86 | 146/146 | 146/146 | 146/146 | 0 |
| target | 9 | 6 | 59 | 34 | 25 | 10 | 15 | 59/59 | 59/59 | 59/59 | 0 |

## Rule

- This audit uses enhanced scroll chunk data. If it fails with missing style/signature/semantic evidence, rerun `scripts/capture-collapse-alignment.cjs` with the current script before judging UI alignment.
- Running/thinking shimmer is only required when present in the captured long session; fixture-level running-state coverage remains in `dynamic-state-audit`.
