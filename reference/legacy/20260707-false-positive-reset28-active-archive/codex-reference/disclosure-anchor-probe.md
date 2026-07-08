# Codex Disclosure Anchor Probe

Generated: 2026-07-06T17:06:48.028Z
Panel: http://127.0.0.1:58888/?codexFixture=dynamic&disclosureProbe=20260706170646154
Viewport: 1920x1080

## Summary

- Checks: 7
- Failed: 0

## Checks

| Check | Status | Details |
| --- | --- | --- |
| viewport is 1920x1080 or larger | ok | 1920x1080 |
| thread scroll container found | ok |  |
| matching disclosure toggle found | ok | exec_command npm run build running |
| toggle is visible before expand | ok | top=847, bottom=866, height=20 |
| body expands | ok | {"found":true,"ariaHidden":"false","height":91} |
| expanded toggle remains visible | ok | top=847, bottom=866, height=20 |
| expanded toggle remains anchored | ok | 0px |

## Probe

```json
{
  "ok": true,
  "scrollFound": true,
  "toggle": {
    "found": true,
    "key": "inline-activity:4:2",
    "text": "exec_command npm run build running"
  },
  "before": {
    "label": "before-expand",
    "found": true,
    "visible": true,
    "expanded": "false",
    "text": "exec_command npm run build running",
    "rect": {
      "top": 847,
      "bottom": 866,
      "left": 64,
      "right": 337,
      "width": 273,
      "height": 20
    },
    "scroll": {
      "top": 0,
      "height": 1080,
      "clientHeight": 1080
    },
    "body": {
      "found": true,
      "ariaHidden": "true",
      "height": 0
    }
  },
  "after": {
    "label": "after-expand",
    "found": true,
    "visible": true,
    "expanded": "true",
    "text": "exec_command npm run build running",
    "rect": {
      "top": 847,
      "bottom": 866,
      "left": 64,
      "right": 337,
      "width": 273,
      "height": 20
    },
    "scroll": {
      "top": 0,
      "height": 1080,
      "clientHeight": 1080
    },
    "body": {
      "found": true,
      "ariaHidden": "false",
      "height": 91
    }
  },
  "deltaTop": 0
}
```

