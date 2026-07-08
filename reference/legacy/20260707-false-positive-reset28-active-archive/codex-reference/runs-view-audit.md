# Runs View Audit

Generated: 2026-07-06T17:06:27.039816+00:00
App URL: http://127.0.0.1:58888/?codexFixture=reference
Viewport: 1920x1080

## Summary

- Checks: 12
- Failed: 0

## Checks

| Check | Status | Details |
| --- | --- | --- |
| runs view audit completed | ok | ok |
| viewport is 1920x1080 or larger | ok | 1920x1080 |
| runs view is reachable from Activity Bar | ok | title='RUNS' |
| running session row renders | ok | title='Running smoke session' |
| running and recent sessions are grouped | ok | running=1, idle=1 |
| runs subtitle summarizes active and total sessions | ok | subtitle='1 running / 2 total' |
| nodes API is requested | ok | GET /api/nodes?, GET /api/sessions?nodeId=server-a, GET /api/sessions/events?nodeId=server-a, POST /api/sessions/run-1/cancel?, GET /api/nodes?, GET /api/sessions?nodeId=server-a, GET /api/nodes?, GET /api/sessions?nodeId=server-a, GET /api/sessions/run-1/events?nodeId=server-a&limit=100 |
| sessions are loaded with nodeId | ok | GET /api/nodes?, GET /api/sessions?nodeId=server-a, GET /api/sessions/events?nodeId=server-a, POST /api/sessions/run-1/cancel?, GET /api/nodes?, GET /api/sessions?nodeId=server-a, GET /api/nodes?, GET /api/sessions?nodeId=server-a, GET /api/sessions/run-1/events?nodeId=server-a&limit=100 |
| all-session SSE is opened with nodeId | ok | GET /api/nodes?, GET /api/sessions?nodeId=server-a, GET /api/sessions/events?nodeId=server-a, POST /api/sessions/run-1/cancel?, GET /api/nodes?, GET /api/sessions?nodeId=server-a, GET /api/nodes?, GET /api/sessions?nodeId=server-a, GET /api/sessions/run-1/events?nodeId=server-a&limit=100 |
| cancel posts selected node id | ok | [{"nodeId": "server-a"}] |
| open run switches back to Codex view | ok | view='codex' |
| open run stores selected node id | ok | stored='server-a' |

## Evidence

```json
{
  "cancelRequests": [
    {
      "nodeId": "server-a"
    }
  ],
  "apiRequests": [
    {
      "method": "GET",
      "path": "/api/nodes",
      "query": ""
    },
    {
      "method": "GET",
      "path": "/api/sessions",
      "query": "nodeId=server-a"
    },
    {
      "method": "GET",
      "path": "/api/sessions/events",
      "query": "nodeId=server-a"
    },
    {
      "method": "POST",
      "path": "/api/sessions/run-1/cancel",
      "query": ""
    },
    {
      "method": "GET",
      "path": "/api/nodes",
      "query": ""
    },
    {
      "method": "GET",
      "path": "/api/sessions",
      "query": "nodeId=server-a"
    },
    {
      "method": "GET",
      "path": "/api/nodes",
      "query": ""
    },
    {
      "method": "GET",
      "path": "/api/sessions",
      "query": "nodeId=server-a"
    },
    {
      "method": "GET",
      "path": "/api/sessions/run-1/events",
      "query": "nodeId=server-a&limit=100"
    }
  ],
  "title": "RUNS",
  "runningTitle": "Running smoke session",
  "subtitle": "1 running / 2 total",
  "runningCount": 1,
  "idleCount": 1,
  "activeViewAfterOpen": "codex",
  "storedNodeAfterOpen": "server-a"
}
```
