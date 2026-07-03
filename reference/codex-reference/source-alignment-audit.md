# Codex Source Alignment Audit

Generated: 2026-07-03T18:18:59.045Z

Static source alignment audit. Compares local component/CSS source against captured extension HTML and official extension CSS assets. Screenshots are not used.

## Summary

- Local class tokens: 398
- Reference/official class tokens: 4157
- Unexplained local class tokens: 0
- Unexplained local data attrs: 0
- Unexplained local CSS selectors: 0
- Non-exact copied extension CSS assets: 0

## Copied Extension CSS Assets

| Asset | Status | Local Bytes | Official Bytes |
| --- | --- | --- | --- |
| `app-main-DH0Qggoi.css` | `exact` | `549858` | `549858` |
| `app-shell-DJDX7Pvr.css` | `exact` | `1177` | `1177` |
| `at-mention-list-BF8TOyej.css` | `exact` | `460` | `460` |
| `cmdk-pBm4kpmV.css` | `exact` | `4680` | `4680` |
| `composer-CXInBfIq.css` | `exact` | `1005` | `1005` |
| `composer-footer-D2K4qkyA.css` | `exact` | `3036` | `3036` |
| `composer-top-menu-chrome-EBEHrbNH.css` | `exact` | `2311` | `2311` |
| `dialog-layout-sS9Dm_y9.css` | `exact` | `671` | `671` |
| `diff-unified-updTK7TW.css` | `exact` | `916` | `916` |
| `dropdown-9F1MU8ql.css` | `exact` | `2977` | `2977` |
| `local-conversation-turn-CGBrbw6f.css` | `exact` | `1544` | `1544` |
| `local-task-row-Bj9zvK4d.css` | `exact` | `302` | `302` |
| `markdown-DmSBSKzD.css` | `exact` | `8450` | `8450` |
| `progression-donut-BI3OQbB8.css` | `exact` | `236` | `236` |
| `prompt-editor-BuS6Xjko.css` | `exact` | `614` | `614` |
| `prosemirror-ptHiDCW_.css` | `exact` | `823` | `823` |
| `rate-limit-reset-modal-D3jrmUOb.css` | `exact` | `266` | `266` |
| `referral-invite-modal-DeNnfVpo.css` | `exact` | `7999` | `7999` |
| `scroll-to-bottom-buton-H4NGgmRi.css` | `exact` | `470` | `470` |
| `thinking-shimmer-BhOGlSiR.css` | `exact` | `1584` | `1584` |
| `thread-page-bottom-panel-state-BrqwKW_G.css` | `exact` | `4087` | `4087` |
| `thread-side-panel-tabs-CYswclfQ.css` | `exact` | `583` | `583` |
| `worktree-init-tool-activities-CxuoHau6.css` | `exact` | `2281` | `2281` |

## Non-Exact Copied Assets

None.

## Unexplained Class Tokens

None.

## Unexplained Data Attributes

None.

## Unexplained CSS Selectors

None.

## Adapter Class Allowlist

| Token |
| --- |
| `codex-error-message` |
| `codex-floating-menu` |
| `codex-floating-menu-approval` |
| `codex-floating-menu-model` |
| `codex-home-watermark` |
| `codex-send-ready` |
| `codex-sidebar-content` |
| `codex-webview` |
| `codex-webview-frame` |
| `light` |
| `vscode-light` |

## Adapter Data Attr Allowlist

| Attribute |
| --- |
| `data-action` |
| `data-codex-archive-button` |
| `data-codex-composer` |
| `data-codex-intelligence-trigger` |
| `data-codex-os` |
| `data-codex-panel-root` |
| `data-codex-session-id` |
| `data-codex-view` |
| `data-codex-window-chrome` |
| `data-codex-window-type` |
| `data-popover` |
| `data-thread-content-shell` |
| `data-thread-scroll` |

## Rule

- Any unexplained item is unfinished. Either replace it with captured extension structure/style, prove it exists in official assets, or document it as a necessary adapter hook.

