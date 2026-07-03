# Codex Visual Diff Audit

Generated: 2026-07-03T20:17:58.7582244Z

Compares captured code-server reference screenshots against the latest local Codex Web screenshots. This is an auxiliary visual audit; source, DOM, markup, and computed-style audits remain the primary exactness gates.

- Threshold: max channel delta > 6 counts as different.
- Local capture: C:\Users\79917\Desktop\codex\codex-web\reference\windows-captures\20260704-035934-local-codex-panel-playwright

| View | Layer | Size | Different Pixels | Different % | Mean Channel Delta | Max Channel Delta | Diff |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| list | panel | 610x893 | 7355 | 1.3502 | 0.5224 | 221 | visual-diffs/list-panel-diff.png |
| list | shell | 700x985 | 12535 | 1.818 | 0.6061 | 249 | visual-diffs/list-shell-diff.png |
| thread | panel | 610x893 | 85343 | 15.667 | 5.7703 | 250 | visual-diffs/thread-panel-diff.png |
| thread | shell | 700x985 | 92392 | 13.3999 | 5.1833 | 250 | visual-diffs/thread-shell-diff.png |
| plus | panel | 579x893 | 13977 | 2.7032 | 1.1416 | 255 | visual-diffs/plus-panel-diff.png |
| plus | shell | 700x985 | 21389 | 3.1021 | 1.5242 | 255 | visual-diffs/plus-shell-diff.png |
| approval | panel | 579x893 | 15924 | 3.0798 | 1.452 | 250 | visual-diffs/approval-panel-diff.png |
| approval | shell | 700x985 | 23336 | 3.3845 | 1.757 | 250 | visual-diffs/approval-shell-diff.png |
| model | panel | 579x893 | 15723 | 3.0409 | 1.4354 | 250 | visual-diffs/model-panel-diff.png |
| model | shell | 700x985 | 23135 | 3.3553 | 1.7446 | 250 | visual-diffs/model-shell-diff.png |

Interpretation notes:
- shell includes activity bar, title/sidebar chrome, editor edge, and status bar.
- panel crops the actual ChatGPT/Codex webview area from the reference and compares it with the local panel screenshot.
- Dynamic labels and sampled conversation text can create legitimate pixel differences; inspect source/DOM/computed audits before treating visual diffs as actionable.
