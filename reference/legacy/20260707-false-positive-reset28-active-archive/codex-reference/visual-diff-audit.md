# Codex Visual Diff Audit

Generated: 2026-07-04T10:32:18.7281550Z

Compares captured workspace reference screenshots against the latest local Codex Web screenshots. This is an auxiliary visual audit; source, DOM, markup, and computed-style audits remain the primary exactness gates.

- Threshold: max channel delta > 6 counts as different.
- Local capture: C:\Users\79917\Desktop\codex\codex-web\reference\windows-captures\20260704-035934-local-codex-panel-playwright

| View | Layer | Size | Different Pixels | Different % | Mean Channel Delta | Max Channel Delta | Diff |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| list | panel | 610x893 | 7355 | 1.3502 | 0.5224 | 221 | visual-diffs/list-panel-diff.png |
| list | workspace | 700x985 | 12535 | 1.818 | 0.6061 | 249 | visual-diffs/list-workspace-diff.png |
| thread | panel | 610x893 | 85343 | 15.667 | 5.7703 | 250 | visual-diffs/thread-panel-diff.png |
| thread | workspace | 700x985 | 92392 | 13.3999 | 5.1833 | 250 | visual-diffs/thread-workspace-diff.png |
| plus | panel | 579x893 | 13977 | 2.7032 | 1.1416 | 255 | visual-diffs/plus-panel-diff.png |
| plus | workspace | 700x985 | 21389 | 3.1021 | 1.5242 | 255 | visual-diffs/plus-workspace-diff.png |
| approval | panel | 579x893 | 15924 | 3.0798 | 1.452 | 250 | visual-diffs/approval-panel-diff.png |
| approval | workspace | 700x985 | 23336 | 3.3845 | 1.757 | 250 | visual-diffs/approval-workspace-diff.png |
| model | panel | 579x893 | 15723 | 3.0409 | 1.4354 | 250 | visual-diffs/model-panel-diff.png |
| model | workspace | 700x985 | 23135 | 3.3553 | 1.7446 | 250 | visual-diffs/model-workspace-diff.png |

Interpretation notes:
- workspace includes activity bar, title/sidebar chrome, editor edge, and status bar.
- panel crops the actual Codex webview area from the reference and compares it with the local panel screenshot.
- Dynamic labels and sampled conversation text can create legitimate pixel differences; inspect source/DOM/computed audits before treating visual diffs as actionable.
