# Codex Markup Alignment Audit

Generated: 2026-07-06T17:06:33.434Z

This audit compares canonical semantic markup from captured extension DOM to the current Codex Web Shadow DOM. Explicit Codex Web adapter classes are ignored; screenshots are not used.

## list

| Component | Mode | Status | Reference Lines | Current Lines | Equal Prefix | Required Structure | First Mismatch |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| sessionRow | canonical | exact | 2 | 2 | 2 |  |  |
| composer | semantic | compatible | 51 | 51 | 1 | ref 3/3, cur 3/3 | `1: ref   div#0 class="relative z-10 flex min-h-0 flex-1 flex-col" / cur   div#0 class="codex-composer-card-inner relative z-10 flex min-h-0 flex-1 flex-col"` |
| composerFooter | semantic | compatible | 43 | 43 | 40 | ref 3/3, cur 3/3 | `40: ref       button#0 class="cursor-interaction size-token-button-composer flex items-center justify-center rounded-full transition-opacity focus-visible:outline-2 bg-token-foreground p-0.5 focus-visible:outline-token-button-background opacity-50" data-state="closed" type="button" / cur       button#0 class="codex-composer-send-button cursor-interaction size-token-button-composer flex items-center justify-center rounded-full focus-visible:outline-2 bg-token-foreground p-0.5 focus-visible:outline-token-button-background" data-state="closed" type="button"` |

## plus

| Component | Mode | Status | Reference Lines | Current Lines | Equal Prefix | Required Structure | First Mismatch |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| plusMenu | canonical | exact | 38 | 38 | 38 |  |  |

## approval

| Component | Mode | Status | Reference Lines | Current Lines | Equal Prefix | Required Structure | First Mismatch |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| approvalMenu | canonical | exact | 31 | 31 | 31 |  |  |

## model

| Component | Mode | Status | Reference Lines | Current Lines | Equal Prefix | Required Structure | First Mismatch |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| modelMenu | canonical | exact | 70 | 70 | 70 |  |  |

## thread

| Component | Mode | Status | Reference Lines | Current Lines | Equal Prefix | Required Structure | First Mismatch |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| header | semantic | exact | 35 | 35 | 35 |  |  |
| conversation | semantic | compatible | 260 | 260 | 2 | ref 3/3, cur 3/3 | `2: ref     div#0 class="flex flex-col" style="gap: 12px; margin-top: 23068px" / cur     div#0 class="h-px w-full" aria-hidden="true" data-history-load-edge=""` |
| userBubble | canonical | exact | 6 | 6 | 6 |  |  |
| markdown | canonical | exact | 36 | 36 | 36 |  |  |
| assistantActions | canonical | exact | 3 | 3 | 3 |  |  |
| composer | semantic | compatible | 56 | 56 | 1 | ref 3/3, cur 3/3 | `1: ref   div#0 class="relative z-10 flex min-h-0 flex-1 flex-col" / cur   div#0 class="codex-composer-card-inner relative z-10 flex min-h-0 flex-1 flex-col"` |
| composerFooter | semantic | compatible | 48 | 48 | 45 | ref 3/3, cur 3/3 | `45: ref       button#0 class="cursor-interaction size-token-button-composer flex items-center justify-center rounded-full transition-opacity focus-visible:outline-2 bg-token-foreground p-0.5 focus-visible:outline-token-button-background opacity-50" data-state="closed" type="button" / cur       button#0 class="codex-composer-send-button cursor-interaction size-token-button-composer flex items-center justify-center rounded-full focus-visible:outline-2 bg-token-foreground p-0.5 focus-visible:outline-token-button-background" data-state="closed" type="button"` |
| externalFooter | canonical | exact | 17 | 17 | 17 |  |  |

## Rule

- Treat any status other than `exact` or `compatible` as unfinished.
- A `compatible` component means the captured extension primitive is present after stripping explicit local adapter carrier classes, or all required semantic selectors are present in both reference and current DOM.
- Screenshots remain follow-up evidence only after these markup checks pass.
