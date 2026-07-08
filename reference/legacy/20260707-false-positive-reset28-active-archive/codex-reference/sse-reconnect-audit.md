# Codex SSE Reconnect Audit

Generated: 2026-07-06T17:06:22.302Z

Frontend SSE reconnect audit. It verifies node-level and per-session EventSource streams recover after errors and use backlog sequencing for the active session.

## Summary

- Checks: 9
- Passed: 9
- Failed: 0

## Checks

| Status | Check | Details |
| --- | --- | --- |
| PASS | store tracks SSE reconnect state | session and node streams both have retry delay and timer state |
| PASS | reconnect backoff constants are bounded | frontend uses a bounded reconnect delay instead of tight retry loops |
| PASS | node-level SSE schedules reconnect on error | node stream errors must not permanently stop the session list updater |
| PASS | node-level reconnect refreshes session list state | node stream reconnect refreshes list status before reopening the all-session stream |
| PASS | session SSE reconnects with current lastSeq | active session reconnect keeps using the latest known sequence for backlog replay |
| PASS | session reconnect is gated to the current visible thread | stale reconnect timers cannot reopen old sessions after navigation |
| PASS | manual subscription closes clear retry timers | switching streams clears old retry timers before opening a new EventSource |
| PASS | leaving a thread closes the active session stream and retry | back/new-chat navigation must stop the per-session stream |
| PASS | malformed SSE rows do not kill the stream | JSON parse errors are isolated per message |

## Evidence

### PASS: store tracks SSE reconnect state

- `frontend/src/store/codex.js`

### PASS: reconnect backoff constants are bounded

- `frontend/src/pages/codex/index.js`

### PASS: node-level SSE schedules reconnect on error

- `frontend/src/pages/codex/index.js`

### PASS: node-level reconnect refreshes session list state

- `frontend/src/pages/codex/index.js`

### PASS: session SSE reconnects with current lastSeq

- `frontend/src/pages/codex/index.js`

### PASS: session reconnect is gated to the current visible thread

- `frontend/src/pages/codex/index.js`

### PASS: manual subscription closes clear retry timers

- `frontend/src/pages/codex/index.js`

### PASS: leaving a thread closes the active session stream and retry

- `frontend/src/pages/codex/index.js`

### PASS: malformed SSE rows do not kill the stream

- `frontend/src/pages/codex/index.js`

