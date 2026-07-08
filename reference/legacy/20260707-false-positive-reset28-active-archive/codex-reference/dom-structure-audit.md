# Codex DOM Structure Audit

Generated: 2026-07-06T17:06:30.388Z

This audit compares captured extension DOM against the current local Shadow DOM by source-backed semantic structure. Explicit Codex Web adapter carrier classes are ignored; screenshots are not used as evidence.

## list

| Component | Mode | Status | Reference Nodes | Current Nodes | Equal Prefix | Required Structure | First Mismatch |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| root | presence | compatible | 54 | 51 | 34 | ref 4/4, cur 4/4 | `34: ref   div#1.relative flex h-full flex-col / cur   div#1.relative flex min-h-0 flex-1 flex-col overflow-hidden` |
| header | semantic | compatible | 43 | 43 | 43 |  |  |
| sessionRow | signature | exact | 1 | 1 | 1 |  |  |
| composer | semantic | compatible | 28 | 34 | 3 | ref 3/3, cur 3/3 | `3: ref     div#1.contents / cur     div#1.mb-1 flex-grow overflow-y-auto px-3` |
| composerFooter | semantic | compatible | 33 | 33 | 30 | ref 3/3, cur 3/3 | `30: ref       button#0.cursor-interaction size-token-button-composer flex items-center justify-center rounded-full transition-opacity focus-visible:outline-2 bg-token-foreground p-0.5 focus-visible:outline-token-button-background opacity-50 [type="button" data-state="closed"] / cur       button#0.codex-composer-send-button cursor-interaction size-token-button-composer flex items-center justify-center rounded-full focus-visible:outline-2 bg-token-foreground p-0.5 focus-visible:outline-token-button-background [type="button" data-state="closed"]` |

## plus

| Component | Mode | Status | Reference Nodes | Current Nodes | Equal Prefix | Required Structure | First Mismatch |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| composer | semantic | compatible | 28 | 34 | 3 | ref 3/3, cur 3/3 | `3: ref     div#1.contents / cur     div#1.mb-1 flex-grow overflow-y-auto px-3` |
| composerFooter | semantic | compatible | 33 | 33 | 30 | ref 3/3, cur 3/3 | `30: ref       button#0.cursor-interaction size-token-button-composer flex items-center justify-center rounded-full transition-opacity focus-visible:outline-2 bg-token-foreground p-0.5 focus-visible:outline-token-button-background opacity-50 [type="button" data-state="closed"] / cur       button#0.codex-composer-send-button cursor-interaction size-token-button-composer flex items-center justify-center rounded-full focus-visible:outline-2 bg-token-foreground p-0.5 focus-visible:outline-token-button-background [type="button" data-state="closed"]` |
| plusMenu | signature | exact | 30 | 30 | 30 |  |  |

## approval

| Component | Mode | Status | Reference Nodes | Current Nodes | Equal Prefix | Required Structure | First Mismatch |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| composer | semantic | compatible | 28 | 34 | 3 | ref 3/3, cur 3/3 | `3: ref     div#1.contents / cur     div#1.mb-1 flex-grow overflow-y-auto px-3` |
| composerFooter | semantic | compatible | 33 | 33 | 30 | ref 3/3, cur 3/3 | `30: ref       button#0.cursor-interaction size-token-button-composer flex items-center justify-center rounded-full transition-opacity focus-visible:outline-2 bg-token-foreground p-0.5 focus-visible:outline-token-button-background opacity-50 [type="button" data-state="closed"] / cur       button#0.codex-composer-send-button cursor-interaction size-token-button-composer flex items-center justify-center rounded-full focus-visible:outline-2 bg-token-foreground p-0.5 focus-visible:outline-token-button-background [type="button" data-state="closed"]` |
| approvalMenu | signature | exact | 25 | 25 | 25 |  |  |

## model

| Component | Mode | Status | Reference Nodes | Current Nodes | Equal Prefix | Required Structure | First Mismatch |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| composer | semantic | compatible | 28 | 34 | 3 | ref 3/3, cur 3/3 | `3: ref     div#1.contents / cur     div#1.mb-1 flex-grow overflow-y-auto px-3` |
| composerFooter | semantic | compatible | 33 | 33 | 30 | ref 3/3, cur 3/3 | `30: ref       button#0.cursor-interaction size-token-button-composer flex items-center justify-center rounded-full transition-opacity focus-visible:outline-2 bg-token-foreground p-0.5 focus-visible:outline-token-button-background opacity-50 [type="button" data-state="closed"] / cur       button#0.codex-composer-send-button cursor-interaction size-token-button-composer flex items-center justify-center rounded-full focus-visible:outline-2 bg-token-foreground p-0.5 focus-visible:outline-token-button-background [type="button" data-state="closed"]` |
| modelMenu | signature | exact | 53 | 53 | 53 |  |  |

## thread

| Component | Mode | Status | Reference Nodes | Current Nodes | Equal Prefix | Required Structure | First Mismatch |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| root | presence | compatible | 29 | 39 | 25 | ref 7/7, cur 7/7 | `25: ref           div#0.thread-scroll-container relative h-full overflow-x-hidden overflow-y-auto [overflow-anchor:none] [scroll-padding-bottom:var(--thread-scroll-padding-bottom,0px)] electron:[scrollbar-gutter:stable_both-edges] pt-(--thread-content-top-inset) [container-name:thread-content] [container-type:inline-size] focus:outline-none [&:has([data-thread-scroll-footer='true']:focus-within)]:[scroll-padding-bottom:0px] flex flex-col-reverse [style="--thread-scroll-padding-bottom: 160px;"] / cur           div#0.thread-scroll-container relative h-full overflow-x-hidden overflow-y-auto [overflow-anchor:none] [scroll-padding-bottom:var(--thread-scroll-padding-bottom,0px)] electron:[scrollbar-gutter:stable_both-edges] pt-(--thread-content-top-inset) [container-name:thread-content] [container-type:inline-size] focus:outline-none [&:has([data-thread-scroll-footer='true']:focus-within)]:[scroll-padding-bottom:0px] flex flex-col [style="--thread-scroll-padding-bottom: 160px;"]` |
| header | semantic | compatible | 28 | 28 | 28 |  |  |
| conversation | semantic | compatible | 67 | 73 | 2 | ref 3/3, cur 3/3 | `2: ref     div#0.flex flex-col / cur     div#0.h-px w-full` |
| userBubble | signature | exact | 5 | 5 | 5 |  |  |
| markdown | signature | exact | 17 | 17 | 17 |  |  |
| assistantActions | signature | exact | 2 | 2 | 2 |  |  |
| composer | semantic | compatible | 29 | 36 | 3 | ref 3/3, cur 3/3 | `3: ref     div#1.contents / cur     div#1.mb-1 flex-grow overflow-y-auto px-3` |
| composerFooter | semantic | compatible | 38 | 38 | 35 | ref 3/3, cur 3/3 | `35: ref       button#0.cursor-interaction size-token-button-composer flex items-center justify-center rounded-full transition-opacity focus-visible:outline-2 bg-token-foreground p-0.5 focus-visible:outline-token-button-background opacity-50 [type="button" data-state="closed"] / cur       button#0.codex-composer-send-button cursor-interaction size-token-button-composer flex items-center justify-center rounded-full focus-visible:outline-2 bg-token-foreground p-0.5 focus-visible:outline-token-button-background [type="button" data-state="closed"]` |
| externalFooter | signature | exact | 15 | 15 | 15 |  |  |

## Required Follow-Up

- Treat any status other than `exact` or `compatible` as unfinished.
- A `compatible` component means the captured extension primitive is present after stripping explicit local adapter carrier classes, or all required semantic selectors are present in both reference and current DOM.
- Screenshots remain follow-up evidence only after these structural checks pass.

