# Codex Virtual Scroll Audit

Generated: 2026-07-07T21:30:45.658Z
Fixture: http://127.0.0.1:58888/?codexFixture=virtual-scroll&auditRun=20260707213044298
Viewport: 1920x1080

## Summary

- Checks: 13
- Failed: 0
- Steps: 4
- Unique windows: 4

## Checks

| Check | Status | Details |
| --- | --- | --- |
| audit completed | ok | ok |
| viewport is 1920x1080 or larger | ok | 1920x1080 |
| focused historical seq renders in viewport | ok | seq=133, found=true, scrollTop=8829, text="Virtual scroll turn 45: verify long-session rendering, disclosure rows, summaries, and scroll anchoring. 3:45 Processed 75s Updated frontend/src/pages/codex/vir" |
| long session is scrollable | ok | maxScroll=17271 |
| multiple virtual windows observed | ok | unique=4 |
| every captured step has visible turns | ok | 4 step(s) |
| no visible turn overlap | ok | none |
| top renders real turns, not blank spacer | ok | top: 0..4, visible=5, scrollTop=0 |
| bottom return renders latest turns | ok | bottom-return: 86..89, visible=4, scrollTop=17361 |
| summary rows appear while scrolling | ok | max=12 |
| no grouped command detail rows appear while scrolling | ok | max=0 |
| no Codex Web-only command enhancement text appears while scrolling | ok | max=0 |
| file references appear while scrolling | ok | max=4 |

## Windows

- initial-bottom: 43..47, visible=5, scrollTop=8829
- up-1: 40..44, visible=5, scrollTop=8138
- top: 0..4, visible=5, scrollTop=0
- bottom-return: 86..89, visible=4, scrollTop=17361
