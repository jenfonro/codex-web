# Codex Dynamic State Audit

Generated: 2026-07-03T18:19:14.369Z

## Summary

- Checks: 21
- Failed: 0

## Checks

| Check | Status | Details |
| --- | --- | --- |
| official asset present: thinking-shimmer-B8u0gTMT.js | ok | 3242 bytes |
| official asset present: thinking-shimmer-BhOGlSiR.css | ok | 1584 bytes |
| official asset present: tool-activity-disclosure-BLOD7VGb.js | ok | 3349 bytes |
| official asset present: timeline-item-kfxn1jgJ.js | ok | 2051 bytes |
| official asset present: local-conversation-turn-BZInUTC2.js | ok | 676101 bytes |
| official source contains: loading-shimmer-pure-text | ok | loading-shimmer-pure-text |
| official source contains: _cadencedShimmer_18j3y_1 | ok | _cadencedShimmer_18j3y_1 |
| official source contains: _cadencedShimmerSweep_18j3y_12 | ok | _cadencedShimmerSweep_18j3y_12 |
| official source contains: _cadencedShimmerHighlight_18j3y_37 | ok | _cadencedShimmerHighlight_18j3y_37 |
| official source contains: group/activity-header inline-flex min-w-0 max-w-full self-start items-center gap-1.5 p-0 text-left | ok | group/activity-header inline-flex min-w-0 max-w-full self-start items-center gap-1.5 p-0 text-left |
| official source contains: text-size-chat min-w-0 truncate text-token-conversation-summary-leading group-hover/activity-header:text-token-foreground | ok | text-size-chat min-w-0 truncate text-token-conversation-summary-leading group-hover/activity-header:text-token-foreground |
| official source contains: min-w-0 text-size-chat | ok | min-w-0 text-size-chat |
| official source contains: relative overflow-visible py-0 | ok | relative overflow-visible py-0 |
| official source contains: flex flex-col gap-2 pt-2 pb-1 | ok | flex flex-col gap-2 pt-2 pb-1 |
| thinking shimmer node present | ok | span class="loading-shimmer-pure-text _cadencedShimmer_18j3y_1 min-w-0 truncate select-none _cadencedShimmerActive_18j3y_46"<br>  #text "正在思考"<br>  span class="_cadencedShimmerSweep_18j3y_12" aria-hidden="true"<br>    span class="_cadencedShimmerHighlight_18j3y_37"<br>      #text "正在思考" |
| thinking shimmer sweep/highlight present | ok | span class="loading-shimmer-pure-text _cadencedShimmer_18j3y_1 min-w-0 truncate select-none _cadencedShimmerActive_18j3y_46"<br>  #text "正在思考"<br>  span class="_cadencedShimmerSweep_18j3y_12" aria-hidden="true"<br>    span class="_cadencedShimmerHighlight_18j3y_37"<br>      #text "正在思考" |
| cadenced active class observed | ok | 2 active shimmer node(s) |
| running activity header present | ok | button class="group/activity-header inline-flex min-w-0 max-w-full self-start items-center gap-1.5 p-0 text-left cursor-interaction" aria-expanded="true"<br>  span class="text-size-chat flex min-w-0 shrink items-center gap-1.5 truncate"<br>    svg class="[object SVGAnimatedString]"<br>      path class="[object SVGAnimatedString]"<br>    span class="loading-shimmer-pure-text _cadencedShimmer_18j3y_1 text-size-chat min-w-0 truncate text-token-conversation-summary-leading group-hover/activity-header:text-token-foreground _cadencedShimmerActive_18j3y_46"<br>      #text "已编辑 1 个文件"<br>      span class="_cadencedShimmerSweep_18j3y_12" aria-hidden="true"<br>        span class="_cadencedShimmerHighlight_18j3y_37"<br>          #text "已编辑 1 个文件"<br>  svg class="[object SVGAnimatedString]"<br>    path class="[object SVGAnimatedString]" |
| running activity is expanded | ok | aria-expanded=true |
| running activity shimmer source classes present | ok | span class="loading-shimmer-pure-text _cadencedShimmer_18j3y_1 text-size-chat min-w-0 truncate text-token-conversation-summary-leading group-hover/activity-header:text-token-foreground _cadencedShimmerActive_18j3y_46"<br>  #text "已编辑 1 个文件"<br>  span class="_cadencedShimmerSweep_18j3y_12" aria-hidden="true"<br>    span class="_cadencedShimmerHighlight_18j3y_37"<br>      #text "已编辑 1 个文件" |
| running activity body present | ok | div class="flex flex-col gap-2 pt-2 pb-1 pl-6"<br>  div class="text-size-chat text-token-text-secondary"<br>    #text "frontend/src/codex-panel.js"<br>  div class="text-size-chat text-token-text-secondary"<br>    #text "scripts/audit-codex-dynamic-states.cjs" |

## DOM Signatures

### Thinking

```text
span class="loading-shimmer-pure-text _cadencedShimmer_18j3y_1 min-w-0 truncate select-none _cadencedShimmerActive_18j3y_46"
  #text "正在思考"
  span class="_cadencedShimmerSweep_18j3y_12" aria-hidden="true"
    span class="_cadencedShimmerHighlight_18j3y_37"
      #text "正在思考"
```

### Activity

```text
button class="group/activity-header inline-flex min-w-0 max-w-full self-start items-center gap-1.5 p-0 text-left cursor-interaction" aria-expanded="true"
  span class="text-size-chat flex min-w-0 shrink items-center gap-1.5 truncate"
    svg class="[object SVGAnimatedString]"
      path class="[object SVGAnimatedString]"
    span class="loading-shimmer-pure-text _cadencedShimmer_18j3y_1 text-size-chat min-w-0 truncate text-token-conversation-summary-leading group-hover/activity-header:text-token-foreground _cadencedShimmerActive_18j3y_46"
      #text "已编辑 1 个文件"
      span class="_cadencedShimmerSweep_18j3y_12" aria-hidden="true"
        span class="_cadencedShimmerHighlight_18j3y_37"
          #text "已编辑 1 个文件"
  svg class="[object SVGAnimatedString]"
    path class="[object SVGAnimatedString]"
```

