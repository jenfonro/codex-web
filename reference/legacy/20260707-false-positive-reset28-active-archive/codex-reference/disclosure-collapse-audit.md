# Codex Disclosure Collapse Audit

Generated: 2026-07-06T18:17:44.986Z
Fixture: http://127.0.0.1:58888/?codexFixture=dynamic&auditRun=20260706181743798
Viewport: 1920x1080
Sidebar: 611px

## Summary

- Checks: 27
- Failed: 0

## Checks

| Check | Status | Details |
| --- | --- | --- |
| official disclosure asset present | ok | 3349 bytes |
| official source contains: group/activity-header inline-flex min-w-0 max-w-full self-start items-center gap-1.5 p-0 text-left | ok | group/activity-header inline-flex min-w-0 max-w-full self-start items-center gap-1.5 p-0 text-left |
| official source contains: animate:{height:O?w:0,opacity:O?1:0} | ok | animate:{height:O?w:0,opacity:O?1:0} |
| official source contains: "aria-hidden":!O,inert:!O | ok | "aria-hidden":!O,inert:!O |
| official source contains: className:O?`overflow-visible`:`overflow-hidden` | ok | className:O?`overflow-visible`:`overflow-hidden` |
| official source contains: style:{pointerEvents:O?`auto`:`none`} | ok | style:{pointerEvents:O?`auto`:`none`} |
| official source contains: flex flex-col gap-2 pt-2 pb-1 | ok | flex flex-col gap-2 pt-2 pb-1 |
| viewport is 1920x1080 or larger | ok | 1920x1080 |
| sidebar target is wide enough | ok | 611px |
| official-style disclosure toggle found | ok | 已处理 22s |
| audited disclosure body found | ok | overflow-hidden -mx-1.5 px-1.5 |
| collapsed body retains DOM text | ok | 93 |
| collapsed body is aria-hidden | ok | true |
| collapsed body is inert | ok | true |
| collapsed body uses overflow-hidden | ok | overflow-hidden -mx-1.5 px-1.5 hidden |
| collapsed body has zero visual height | ok | 0px |
| collapsed body opacity is zero | ok | 0 |
| collapsed body ignores pointer events | ok | none |
| collapsed body has no visible text | ok |  |
| collapsed body has no visible descendants | ok | 0 |
| expanded body is not aria-hidden | ok | false |
| expanded body is not inert | ok | false |
| expanded body uses overflow-visible | ok | overflow-visible -mx-1.5 px-1.5 visible |
| expanded body has visual height | ok | 50px |
| expanded body exposes visible text | ok | Checked the processed-summary disclosure path and kept command rows out of the expanded body. |
| expanded disclosure keeps toggle anchored | ok | 0px |
| re-collapsed body hides again | ok | aria=true, height=0, text= |

## DOM Evidence

```json
{
  "ok": true,
  "toggle": {
    "found": true,
    "key": "turn-activity:dynamic-processed-summary-turn",
    "text": "已处理 22s",
    "className": "text-size-chat hover:bg-token-bg-subtle cursor-interaction inline-flex items-center gap-1 rounded-md border border-transparent focus-visible:ring-2 focus-visible:ring-token-focus-border focus-visible:outline-none"
  },
  "collapsed": {
    "label": "collapsed",
    "toggleFound": true,
    "bodyFound": true,
    "ariaExpanded": "false",
    "ariaHidden": "true",
    "inert": true,
    "className": "overflow-hidden -mx-1.5 px-1.5",
    "rectWidth": 575,
    "rectHeight": 0,
    "overflow": "hidden",
    "opacity": "0",
    "pointerEvents": "none",
    "domTextLength": 93,
    "visibleText": "",
    "rawText": "Checked the processed-summary disclosure path and kept command rows out of the expanded body.",
    "visibleDescendantCount": 0
  },
  "expanded": {
    "label": "expanded",
    "toggleFound": true,
    "bodyFound": true,
    "ariaExpanded": "true",
    "ariaHidden": "false",
    "inert": false,
    "className": "overflow-visible -mx-1.5 px-1.5",
    "rectWidth": 575,
    "rectHeight": 50,
    "overflow": "visible",
    "opacity": "1",
    "pointerEvents": "auto",
    "domTextLength": 93,
    "visibleText": "Checked the processed-summary disclosure path and kept command rows out of the expanded body.",
    "rawText": "Checked the processed-summary disclosure path and kept command rows out of the expanded body.",
    "visibleDescendantCount": 4
  },
  "anchor": {
    "beforeExpand": {
      "found": true,
      "top": 417,
      "bottom": 438,
      "height": 22,
      "scrollTop": 66
    },
    "afterExpand": {
      "found": true,
      "top": 417,
      "bottom": 438,
      "height": 22,
      "scrollTop": 0
    },
    "expandDeltaTop": 0
  },
  "recollapsed": {
    "label": "recollapsed",
    "toggleFound": true,
    "bodyFound": true,
    "ariaExpanded": "false",
    "ariaHidden": "true",
    "inert": true,
    "className": "overflow-hidden -mx-1.5 px-1.5",
    "rectWidth": 575,
    "rectHeight": 0,
    "overflow": "hidden",
    "opacity": "0",
    "pointerEvents": "none",
    "domTextLength": 93,
    "visibleText": "",
    "rawText": "Checked the processed-summary disclosure path and kept command rows out of the expanded body.",
    "visibleDescendantCount": 0
  }
}
```

