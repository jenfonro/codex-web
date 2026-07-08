# Workspace Native Interactions Audit

Generated: 2026-07-06T17:06:57.993Z
Fixture: http://127.0.0.1:58888/?codexFixture=virtual-scroll&auditRun=20260706170654322
Disclosure fixture: http://127.0.0.1:58888/?codexFixture=dynamic&auditRun=20260706170654322
Viewport: 1920x1080
Sidebar: 611px

## Summary

- Checks: 13
- Failed: 0

## Checks

| Check | Status | Details |
| --- | --- | --- |
| workspace has no sidebar resize handle | ok | 0 |
| workspace has no explicit draggable elements | ok | 0 |
| workspace disables native user drag | ok | none |
| codex shadow disables native user drag | ok | none |
| codex panel has no app-region draggable header | ok | 0 |
| activity drag gesture does not emit dragstart | ok | 0 |
| panel header drag gesture does not emit dragstart | ok | 0 |
| thread content drag gesture does not emit dragstart | ok | 0 |
| long thread has scrollable content | ok | max=18661 |
| mouse wheel changes long-thread scrollTop | ok | before=18653, after=17753 |
| official-style disclosure toggle is visible | ok | exec_command exit 1 failed |
| real mouse click toggles disclosure | ok | before=false, after=true |
| disclosure click target is not blocked by overlay | ok | SPAN min-w-0 flex-1 truncate |

## Runtime Evidence

```json
{
  "shell": {
    "sidebarResizeHandleCount": 0,
    "draggableAttributeCount": 0,
    "draggableAttributeLabels": [],
    "workbenchUserDrag": "none",
    "shadowRootUserDrag": "none",
    "shadowDraggableClassCount": 0,
    "shadowHeaderCount": 1
  },
  "activityDrag": {
    "dragStarts": 0,
    "draggableAttributeCount": 0,
    "shadowDraggableClassCount": 0
  },
  "headerDrag": {
    "dragStarts": 0,
    "draggableAttributeCount": 0,
    "shadowDraggableClassCount": 0
  },
  "contentDrag": {
    "dragStarts": 0,
    "draggableAttributeCount": 0,
    "shadowDraggableClassCount": 0
  },
  "scroll": {
    "found": true,
    "before": 18653,
    "maxScroll": 18661,
    "x": 353,
    "y": 507,
    "after": 17753,
    "changed": true
  },
  "disclosure": {
    "found": true,
    "key": "inline-activity:3:0",
    "beforeExpanded": "false",
    "text": "exec_command exit 1 failed",
    "x": 168,
    "y": 472,
    "rect": {
      "left": 64,
      "top": 463,
      "width": 209,
      "height": 20
    },
    "clickedAtExpectedPoint": true,
    "hitSummary": "SPAN min-w-0 flex-1 truncate",
    "afterExpanded": "true",
    "toggled": true
  }
}
```

