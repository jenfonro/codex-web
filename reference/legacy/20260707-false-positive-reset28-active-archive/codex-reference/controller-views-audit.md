# Controller Views Audit

Generated: 2026-07-06T17:06:29.010701+00:00
App URL: http://127.0.0.1:58888/?codexFixture=reference
Viewport: 1920x1080

## Summary

- Checks: 16
- Failed: 0

## Checks

| Check | Status | Details |
| --- | --- | --- |
| controller views audit completed | ok | ok |
| viewport is 1920x1080 or larger | ok | 1920x1080 |
| Nodes view is reachable from Activity Bar | ok | title='NODES' |
| online and offline nodes render | ok | online=1, offline=1 |
| selecting a node posts active node id | ok | [{"nodeId": "server-a"}] |
| selecting a node updates stored node id | ok | stored='server-a' |
| offline node deletion calls controller | ok | ["server-b"] |
| Workspace view is reachable from Activity Bar | ok | title='WORKSPACE' |
| workspace directory entries use selected node | ok | server-a:workspace-directory-entries:{'directoryPath': '', 'includeHidden': False}, server-a:workspace-directory-entries:{'directoryPath': 'src', 'includeHidden': False}, server-a:workspace-directory-tree-search:{'query': 'main', 'includeHidden': False} |
| workspace directory navigation sends path | ok | server-a:workspace-directory-entries:{'directoryPath': '', 'includeHidden': False}, server-a:workspace-directory-entries:{'directoryPath': 'src', 'includeHidden': False}, server-a:workspace-directory-tree-search:{'query': 'main', 'includeHidden': False} |
| workspace search uses selected node | ok | server-a:workspace-directory-entries:{'directoryPath': '', 'includeHidden': False}, server-a:workspace-directory-entries:{'directoryPath': 'src', 'includeHidden': False}, server-a:workspace-directory-tree-search:{'query': 'main', 'includeHidden': False} |
| workspace search sends query | ok | server-a:workspace-directory-entries:{'directoryPath': '', 'includeHidden': False}, server-a:workspace-directory-entries:{'directoryPath': 'src', 'includeHidden': False}, server-a:workspace-directory-tree-search:{'query': 'main', 'includeHidden': False} |
| Git view is reachable from Activity Bar | ok | title='SOURCE CONTROL' |
| git requests use selected node | ok | server-a:branch-metadata:{'cwd': '/workspace'}, server-a:status-summary:{'cwd': '/workspace'}, server-a:review-summary:{'cwd': '/workspace', 'includeUntrackedFiles': True} |
| git requests cover metadata, status, and review summary | ok | server-a:branch-metadata:{'cwd': '/workspace'}, server-a:status-summary:{'cwd': '/workspace'}, server-a:review-summary:{'cwd': '/workspace', 'includeUntrackedFiles': True} |
| git changed file renders | ok | file='app.go' |

## Evidence

```json
{
  "apiRequests": [
    {
      "method": "GET",
      "path": "/api/nodes",
      "query": "",
      "body": {}
    },
    {
      "method": "POST",
      "path": "/api/nodes/active",
      "query": "",
      "body": {
        "nodeId": "server-a"
      }
    },
    {
      "method": "GET",
      "path": "/api/nodes",
      "query": "",
      "body": {}
    },
    {
      "method": "DELETE",
      "path": "/api/nodes/server-b",
      "query": "",
      "body": {}
    },
    {
      "method": "GET",
      "path": "/api/nodes",
      "query": "",
      "body": {}
    },
    {
      "method": "GET",
      "path": "/api/nodes",
      "query": "",
      "body": {}
    },
    {
      "method": "POST",
      "path": "/api/workspace",
      "query": "",
      "body": {
        "nodeId": "server-a",
        "endpoint": "workspace-directory-entries",
        "params": {
          "directoryPath": "",
          "includeHidden": false
        }
      }
    },
    {
      "method": "GET",
      "path": "/api/nodes",
      "query": "",
      "body": {}
    },
    {
      "method": "POST",
      "path": "/api/workspace",
      "query": "",
      "body": {
        "nodeId": "server-a",
        "endpoint": "workspace-directory-entries",
        "params": {
          "directoryPath": "src",
          "includeHidden": false
        }
      }
    },
    {
      "method": "GET",
      "path": "/api/nodes",
      "query": "",
      "body": {}
    },
    {
      "method": "POST",
      "path": "/api/workspace",
      "query": "",
      "body": {
        "nodeId": "server-a",
        "endpoint": "workspace-directory-tree-search",
        "params": {
          "query": "main",
          "includeHidden": false
        }
      }
    },
    {
      "method": "GET",
      "path": "/api/nodes",
      "query": "",
      "body": {}
    },
    {
      "method": "POST",
      "path": "/api/git",
      "query": "",
      "body": {
        "nodeId": "server-a",
        "method": "branch-metadata",
        "params": {
          "cwd": "/workspace"
        }
      }
    },
    {
      "method": "POST",
      "path": "/api/git",
      "query": "",
      "body": {
        "nodeId": "server-a",
        "method": "status-summary",
        "params": {
          "cwd": "/workspace"
        }
      }
    },
    {
      "method": "POST",
      "path": "/api/git",
      "query": "",
      "body": {
        "nodeId": "server-a",
        "method": "review-summary",
        "params": {
          "cwd": "/workspace",
          "includeUntrackedFiles": true
        }
      }
    }
  ],
  "activeNodeRequests": [
    {
      "nodeId": "server-a"
    }
  ],
  "deletedNodes": [
    "server-b"
  ],
  "workspaceRequests": [
    {
      "nodeId": "server-a",
      "endpoint": "workspace-directory-entries",
      "params": {
        "directoryPath": "",
        "includeHidden": false
      }
    },
    {
      "nodeId": "server-a",
      "endpoint": "workspace-directory-entries",
      "params": {
        "directoryPath": "src",
        "includeHidden": false
      }
    },
    {
      "nodeId": "server-a",
      "endpoint": "workspace-directory-tree-search",
      "params": {
        "query": "main",
        "includeHidden": false
      }
    }
  ],
  "gitRequests": [
    {
      "nodeId": "server-a",
      "method": "branch-metadata",
      "params": {
        "cwd": "/workspace"
      }
    },
    {
      "nodeId": "server-a",
      "method": "status-summary",
      "params": {
        "cwd": "/workspace"
      }
    },
    {
      "nodeId": "server-a",
      "method": "review-summary",
      "params": {
        "cwd": "/workspace",
        "includeUntrackedFiles": true
      }
    }
  ],
  "nodesTitle": "NODES",
  "onlineNodeCount": 1,
  "offlineNodeCount": 1,
  "storedNodeAfterSelect": "server-a",
  "nodeRowsAfterDelete": 1,
  "workspaceTitle": "WORKSPACE",
  "workspaceFirstEntry": "src",
  "workspaceNestedEntry": "main.go",
  "gitTitle": "SOURCE CONTROL",
  "gitBranch": "Source Control",
  "gitFileName": "app.go"
}
```
