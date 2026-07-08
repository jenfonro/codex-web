# Codex Dynamic State Audit

Generated: 2026-07-06T17:06:42.759Z

## Summary

- Checks: 46
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
| running activity body present | ok | div class="flex flex-col gap-2 pt-2 pb-1 pl-6"<br>  div class="text-size-chat text-token-text-secondary"<br>    #text "frontend/src/pages/codex/index.js"<br>  div class="text-size-chat text-token-text-secondary"<br>    #text "scripts/audit-codex-dynamic-states.cjs" |
| running shell command block present | ok | div class="group flex flex-col overflow-hidden rounded-lg border border-token-input-background bg-token-text-code-block-background text-token-text-primary"<br>  div class="flex flex-col overflow-clip rounded-none border-none"<br>    div class="flex items-center justify-between gap-2 px-2 py-1 font-sans text-sm text-token-description-foreground select-none"<br>      span<br>        #text "Node"<br>    div class="relative overflow-hidden"<br>      div class="relative"<br>        div class="px-2 pt-2"<br>          div class="group/command relative pr-6"<br>        div class="group/output relative min-h-[1.25rem] pr-0"<br>          div class="vertical-scroll-fade-mask max-h-[140px] [--edge-fade-distance:2rem] box-border flex flex-col-reverse overflow-x-auto overflow-y-auto whitespace-pre font-vscode-editor font-medium [animation-direction:reverse] text-token-description-foreground text-size-chat-sm p-2"<br>  div class="text-size-chat px-2.5 pt-0.5 pb-1" |
| running shell command text is visible | ok | $ npm run build |
| running shell status is preserved | ok | running |
| running shell footer is in-progress | ok | div class="text-size-chat px-2.5 pt-0.5 pb-1" |
| completed transition command is hidden for official alignment | ok |  |
| completed transition command has no visible running status | ok |  |
| completed transition command is not shimmer | ok |  |
| completed transition does not expose success footer | ok |  |
| failed shell command remains visible | ok | $ exit 1 |
| failed shell command carries failed status | ok | exec_command exit 1 failed |
| failed shell footer shows exit code | ok | Exit code 1 |
| error activity row present | ok | button class="group/activity-header inline-flex min-w-0 max-w-full self-start items-center gap-1.5 p-0 text-left cursor-interaction" aria-expanded="false"<br>  span class="text-size-chat flex min-w-0 shrink items-center gap-1.5 truncate"<br>    span class="text-token-editor-error-foreground flex min-w-0 max-w-full items-center truncate shrink overflow-hidden [mask-image:linear-gradient(to_right,black_calc(100%_-_0.25rem),transparent)] [mask-repeat:no-repeat] pr-1 group-hover/activity-header:text-token-foreground"<br>      span class="inline-flex max-w-full min-w-0 items-center gap-1.5 overflow-hidden"<br>        svg class="[object SVGAnimatedString]"<br>          path class="[object SVGAnimatedString]"<br>        span class="min-w-0 flex-1 truncate"<br>          #text "Error"<br>        span class="codex-turn-activity-status text-token-editor-error-foreground"<br>          #text "failed"<br>  svg class="[object SVGAnimatedString]"<br>    path class="[object SVGAnimatedString]" |
| error activity row uses error tone | ok | button class="group/activity-header inline-flex min-w-0 max-w-full self-start items-center gap-1.5 p-0 text-left cursor-interaction" aria-expanded="false"<br>  span class="text-size-chat flex min-w-0 shrink items-center gap-1.5 truncate"<br>    span class="text-token-editor-error-foreground flex min-w-0 max-w-full items-center truncate shrink overflow-hidden [mask-image:linear-gradient(to_right,black_calc(100%_-_0.25rem),transparent)] [mask-repeat:no-repeat] pr-1 group-hover/activity-header:text-token-foreground"<br>      span class="inline-flex max-w-full min-w-0 items-center gap-1.5 overflow-hidden"<br>        svg class="[object SVGAnimatedString]"<br>          path class="[object SVGAnimatedString]"<br>        span class="min-w-0 flex-1 truncate"<br>          #text "Error"<br>        span class="codex-turn-activity-status text-token-editor-error-foreground"<br>          #text "failed"<br>  svg class="[object SVGAnimatedString]"<br>    path class="[object SVGAnimatedString]" |
| error activity row is not shimmer | ok | button class="group/activity-header inline-flex min-w-0 max-w-full self-start items-center gap-1.5 p-0 text-left cursor-interaction" aria-expanded="false"<br>  span class="text-size-chat flex min-w-0 shrink items-center gap-1.5 truncate"<br>    span class="text-token-editor-error-foreground flex min-w-0 max-w-full items-center truncate shrink overflow-hidden [mask-image:linear-gradient(to_right,black_calc(100%_-_0.25rem),transparent)] [mask-repeat:no-repeat] pr-1 group-hover/activity-header:text-token-foreground"<br>      span class="inline-flex max-w-full min-w-0 items-center gap-1.5 overflow-hidden"<br>        svg class="[object SVGAnimatedString]"<br>          path class="[object SVGAnimatedString]"<br>        span class="min-w-0 flex-1 truncate"<br>          #text "Error"<br>        span class="codex-turn-activity-status text-token-editor-error-foreground"<br>          #text "failed"<br>  svg class="[object SVGAnimatedString]"<br>    path class="[object SVGAnimatedString]" |
| error activity details are collapsed by default | ok | {"found":true,"tagName":"div","className":"overflow-hidden","text":"Simulated CLI failure","ariaExpanded":null,"signature":"div class=\"overflow-hidden\" aria-hidden=\"true\"\n  div class=\"flex flex-col gap-2 pt-2 pb-1 pl-6\"\n    div class=\"flex flex-col overflow-clip rounded-none border-none\"\n      div class=\"relative overflow-hidden\"\n        div class=\"relative\"\n          div class=\"group/output relative min-h-[1.25rem] pr-0\""} |
| cancelled turn status row present | ok | button class="group/activity-header inline-flex min-w-0 max-w-full self-start items-center gap-1.5 p-0 text-left cursor-interaction" aria-expanded="false"<br>  span class="text-size-chat flex min-w-0 shrink items-center gap-1.5 truncate"<br>    span class="text-token-conversation-summary-trailing flex min-w-0 max-w-full items-center truncate shrink overflow-hidden [mask-image:linear-gradient(to_right,black_calc(100%_-_0.25rem),transparent)] [mask-repeat:no-repeat] pr-1 group-hover/activity-header:text-token-foreground"<br>      span class="inline-flex max-w-full min-w-0 items-center gap-1.5 overflow-hidden"<br>        span class="min-w-0 flex-1 truncate"<br>          #text "Stopped"<br>  svg class="[object SVGAnimatedString]"<br>    path class="[object SVGAnimatedString]" |
| cancelled turn status row is not shimmer | ok | button class="group/activity-header inline-flex min-w-0 max-w-full self-start items-center gap-1.5 p-0 text-left cursor-interaction" aria-expanded="false"<br>  span class="text-size-chat flex min-w-0 shrink items-center gap-1.5 truncate"<br>    span class="text-token-conversation-summary-trailing flex min-w-0 max-w-full items-center truncate shrink overflow-hidden [mask-image:linear-gradient(to_right,black_calc(100%_-_0.25rem),transparent)] [mask-repeat:no-repeat] pr-1 group-hover/activity-header:text-token-foreground"<br>      span class="inline-flex max-w-full min-w-0 items-center gap-1.5 overflow-hidden"<br>        span class="min-w-0 flex-1 truncate"<br>          #text "Stopped"<br>  svg class="[object SVGAnimatedString]"<br>    path class="[object SVGAnimatedString]" |
| cancelled turn hides stale running command | ok | sleep 600 visible=false |
| composer placeholder is not editable text | ok | {"found":true,"text":"","empty":"true","html":"<p><br class=\"ProseMirror-trailingBreak\"></p>","placeholder":"\"要求后续变更\"","sendClass":"codex-composer-send-button codex-send-disabled cursor-interaction size-token-button-composer flex items-center justify-center rounded-full focus-visible:outline-2 bg-token-foreground p-0.5 focus-visible:outline-token-button-background","sendStyle":"","sendDisabled":true,"sendReady":false,"sendOpacity":"0.5","sendAriaDisabled":"","sendOpacityRules":[]} |
| send button is dimmed when composer is empty | ok | {"found":true,"text":"","empty":"true","html":"<p><br class=\"ProseMirror-trailingBreak\"></p>","placeholder":"\"要求后续变更\"","sendClass":"codex-composer-send-button codex-send-disabled cursor-interaction size-token-button-composer flex items-center justify-center rounded-full focus-visible:outline-2 bg-token-foreground p-0.5 focus-visible:outline-token-button-background","sendStyle":"","sendDisabled":true,"sendReady":false,"sendOpacity":"0.5","sendAriaDisabled":"","sendOpacityRules":[]} |
| empty composer delete keeps placeholder state | ok | {"found":true,"text":"","empty":"true","html":"<p><br class=\"ProseMirror-trailingBreak\"></p>","placeholder":"\"要求后续变更\"","sendClass":"codex-composer-send-button codex-send-disabled cursor-interaction size-token-button-composer flex items-center justify-center rounded-full focus-visible:outline-2 bg-token-foreground p-0.5 focus-visible:outline-token-button-background","sendStyle":"","sendDisabled":true,"sendReady":false,"sendOpacity":"0.5","sendAriaDisabled":"","sendOpacityRules":[],"defaultPrevented":true,"dispatchResult":false} |
| send button stays dimmed after empty delete | ok | {"found":true,"text":"","empty":"true","html":"<p><br class=\"ProseMirror-trailingBreak\"></p>","placeholder":"\"要求后续变更\"","sendClass":"codex-composer-send-button codex-send-disabled cursor-interaction size-token-button-composer flex items-center justify-center rounded-full focus-visible:outline-2 bg-token-foreground p-0.5 focus-visible:outline-token-button-background","sendStyle":"","sendDisabled":true,"sendReady":false,"sendOpacity":"0.5","sendAriaDisabled":"","sendOpacityRules":[],"defaultPrevented":true,"dispatchResult":false} |
| composer typed text is visible text | ok | {"found":true,"text":"hello codex","empty":"false","html":"hello codex","placeholder":"none","sendClass":"codex-composer-send-button cursor-interaction size-token-button-composer flex items-center justify-center rounded-full focus-visible:outline-2 bg-token-foreground p-0.5 focus-visible:outline-token-button-background codex-send-ready","sendStyle":"","sendDisabled":false,"sendReady":true,"sendOpacity":"1","sendAriaDisabled":"","sendOpacityRules":[]} |
| send button becomes ready with text | ok | {"found":true,"text":"hello codex","empty":"false","html":"hello codex","placeholder":"none","sendClass":"codex-composer-send-button cursor-interaction size-token-button-composer flex items-center justify-center rounded-full focus-visible:outline-2 bg-token-foreground p-0.5 focus-visible:outline-token-button-background codex-send-ready","sendStyle":"","sendDisabled":false,"sendReady":true,"sendOpacity":"1","sendAriaDisabled":"","sendOpacityRules":[]} |
| send button resets when composer is cleared | ok | {"found":true,"text":"","empty":"true","html":"<p><br class=\"ProseMirror-trailingBreak\"></p>","placeholder":"\"要求后续变更\"","sendClass":"codex-composer-send-button cursor-interaction size-token-button-composer flex items-center justify-center rounded-full focus-visible:outline-2 bg-token-foreground p-0.5 focus-visible:outline-token-button-background codex-send-disabled","sendStyle":"","sendDisabled":true,"sendReady":false,"sendOpacity":"0.5","sendAriaDisabled":"","sendOpacityRules":[]} |

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

### Running Shell

```text
div class="group flex flex-col overflow-hidden rounded-lg border border-token-input-background bg-token-text-code-block-background text-token-text-primary"
  div class="flex flex-col overflow-clip rounded-none border-none"
    div class="flex items-center justify-between gap-2 px-2 py-1 font-sans text-sm text-token-description-foreground select-none"
      span
        #text "Node"
    div class="relative overflow-hidden"
      div class="relative"
        div class="px-2 pt-2"
          div class="group/command relative pr-6"
        div class="group/output relative min-h-[1.25rem] pr-0"
          div class="vertical-scroll-fade-mask max-h-[140px] [--edge-fade-distance:2rem] box-border flex flex-col-reverse overflow-x-auto overflow-y-auto whitespace-pre font-vscode-editor font-medium [animation-direction:reverse] text-token-description-foreground text-size-chat-sm p-2"
  div class="text-size-chat px-2.5 pt-0.5 pb-1"
```

### Completed Transition Shell

```text

```

### Failed Shell

```text
div class="group flex flex-col overflow-hidden rounded-lg border border-token-input-background bg-token-text-code-block-background text-token-text-primary"
  div class="flex flex-col overflow-clip rounded-none border-none"
    div class="flex items-center justify-between gap-2 px-2 py-1 font-sans text-sm text-token-description-foreground select-none"
      span
        #text "Shell"
    div class="relative overflow-hidden"
      div class="relative"
        div class="px-2 pt-2"
          div class="group/command relative pr-6"
        div class="group/output relative min-h-[1.25rem] pr-0"
          div class="vertical-scroll-fade-mask max-h-[140px] [--edge-fade-distance:2rem] box-border flex flex-col-reverse overflow-x-auto overflow-y-auto whitespace-pre font-vscode-editor font-medium [animation-direction:reverse] text-token-description-foreground text-size-chat-sm p-2"
  div class="text-size-chat flex items-center gap-2 px-2.5 pt-0.5 pb-1 text-token-input-placeholder-foreground"
    span class="ml-auto"
      #text "Exit code 1"
```

### Error

```text
button class="group/activity-header inline-flex min-w-0 max-w-full self-start items-center gap-1.5 p-0 text-left cursor-interaction" aria-expanded="false"
  span class="text-size-chat flex min-w-0 shrink items-center gap-1.5 truncate"
    span class="text-token-editor-error-foreground flex min-w-0 max-w-full items-center truncate shrink overflow-hidden [mask-image:linear-gradient(to_right,black_calc(100%_-_0.25rem),transparent)] [mask-repeat:no-repeat] pr-1 group-hover/activity-header:text-token-foreground"
      span class="inline-flex max-w-full min-w-0 items-center gap-1.5 overflow-hidden"
        svg class="[object SVGAnimatedString]"
          path class="[object SVGAnimatedString]"
        span class="min-w-0 flex-1 truncate"
          #text "Error"
        span class="codex-turn-activity-status text-token-editor-error-foreground"
          #text "failed"
  svg class="[object SVGAnimatedString]"
    path class="[object SVGAnimatedString]"
```

### Cancelled

```text
button class="group/activity-header inline-flex min-w-0 max-w-full self-start items-center gap-1.5 p-0 text-left cursor-interaction" aria-expanded="false"
  span class="text-size-chat flex min-w-0 shrink items-center gap-1.5 truncate"
    span class="text-token-conversation-summary-trailing flex min-w-0 max-w-full items-center truncate shrink overflow-hidden [mask-image:linear-gradient(to_right,black_calc(100%_-_0.25rem),transparent)] [mask-repeat:no-repeat] pr-1 group-hover/activity-header:text-token-foreground"
      span class="inline-flex max-w-full min-w-0 items-center gap-1.5 overflow-hidden"
        span class="min-w-0 flex-1 truncate"
          #text "Stopped"
  svg class="[object SVGAnimatedString]"
    path class="[object SVGAnimatedString]"
```

### Composer

```json
{
  "initial": {
    "found": true,
    "text": "",
    "empty": "true",
    "html": "<p><br class=\"ProseMirror-trailingBreak\"></p>",
    "placeholder": "\"要求后续变更\"",
    "sendClass": "codex-composer-send-button codex-send-disabled cursor-interaction size-token-button-composer flex items-center justify-center rounded-full focus-visible:outline-2 bg-token-foreground p-0.5 focus-visible:outline-token-button-background",
    "sendStyle": "",
    "sendDisabled": true,
    "sendReady": false,
    "sendOpacity": "0.5",
    "sendAriaDisabled": "",
    "sendOpacityRules": []
  },
  "afterDelete": {
    "found": true,
    "text": "",
    "empty": "true",
    "html": "<p><br class=\"ProseMirror-trailingBreak\"></p>",
    "placeholder": "\"要求后续变更\"",
    "sendClass": "codex-composer-send-button codex-send-disabled cursor-interaction size-token-button-composer flex items-center justify-center rounded-full focus-visible:outline-2 bg-token-foreground p-0.5 focus-visible:outline-token-button-background",
    "sendStyle": "",
    "sendDisabled": true,
    "sendReady": false,
    "sendOpacity": "0.5",
    "sendAriaDisabled": "",
    "sendOpacityRules": [],
    "defaultPrevented": true,
    "dispatchResult": false
  },
  "afterType": {
    "found": true,
    "text": "hello codex",
    "empty": "false",
    "html": "hello codex",
    "placeholder": "none",
    "sendClass": "codex-composer-send-button cursor-interaction size-token-button-composer flex items-center justify-center rounded-full focus-visible:outline-2 bg-token-foreground p-0.5 focus-visible:outline-token-button-background codex-send-ready",
    "sendStyle": "",
    "sendDisabled": false,
    "sendReady": true,
    "sendOpacity": "1",
    "sendAriaDisabled": "",
    "sendOpacityRules": []
  },
  "afterClear": {
    "found": true,
    "text": "",
    "empty": "true",
    "html": "<p><br class=\"ProseMirror-trailingBreak\"></p>",
    "placeholder": "\"要求后续变更\"",
    "sendClass": "codex-composer-send-button cursor-interaction size-token-button-composer flex items-center justify-center rounded-full focus-visible:outline-2 bg-token-foreground p-0.5 focus-visible:outline-token-button-background codex-send-disabled",
    "sendStyle": "",
    "sendDisabled": true,
    "sendReady": false,
    "sendOpacity": "0.5",
    "sendAriaDisabled": "",
    "sendOpacityRules": []
  }
}
```

