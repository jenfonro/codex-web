# Codex Session Sequencing Audit

Generated: 2026-07-06T17:06:22.219Z

Frontend session sequencing audit. It verifies sparse long-session event windows keep optimistic events ordered after the real agent sequence tail.

## Summary

- Checks: 9
- Passed: 9
- Failed: 0

## Checks

| Status | Check | Details |
| --- | --- | --- |
| PASS | normalizeSession preserves session lastSeq | lastSeq=7207 |
| PASS | normalizeSession preserves useful agent metadata | cwd=/workspace; codexThreadId=019f |
| PASS | knownLastSeq uses sparse loaded event tails | knownLastSeq=7207 |
| PASS | next local event seq follows the real session tail | nextLocalEventSeq=7208 |
| PASS | knownLastSeq also respects event page metadata | knownLastSeq=8000 |
| PASS | appendLocalEvent uses the shared nextLocalEventSeq helper | appendLocalEvent must not derive seq from events.length |
| PASS | appendLocalEvent no longer uses loaded event count as sequence | events.length is only the currently loaded window and is wrong for long sessions |
| PASS | optimistic events are explicitly marked local | local user/error placeholders must be identifiable when authoritative agent events arrive |
| PASS | authoritative SSE events can replace local placeholders | incoming agent events with the same seq must replace local optimistic placeholders instead of being dropped |

## Evidence

### PASS: normalizeSession preserves session lastSeq

- `frontend/src/pages/codex/api.js`

### PASS: normalizeSession preserves useful agent metadata

- `frontend/src/pages/codex/api.js`

### PASS: knownLastSeq uses sparse loaded event tails

- `frontend/src/store/codex.js`

### PASS: next local event seq follows the real session tail

- `frontend/src/store/codex.js`
- `frontend/src/pages/codex/index.js`

### PASS: knownLastSeq also respects event page metadata

- `frontend/src/store/codex.js`

### PASS: appendLocalEvent uses the shared nextLocalEventSeq helper

- `frontend/src/pages/codex/index.js`

### PASS: appendLocalEvent no longer uses loaded event count as sequence

- `frontend/src/pages/codex/index.js`

### PASS: optimistic events are explicitly marked local

- `frontend/src/pages/codex/index.js`

### PASS: authoritative SSE events can replace local placeholders

- `frontend/src/pages/codex/index.js`

