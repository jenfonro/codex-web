package server

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"time"
)

type bridgeResponse struct {
	Messages []map[string]any `json:"messages"`
}

type bridgeRPCRequest struct {
	ID     string          `json:"id"`
	Method string          `json:"method"`
	Params json.RawMessage `json:"params"`
}

type bridgeMCPResponse struct {
	ID     string          `json:"id"`
	Result json.RawMessage `json:"result,omitempty"`
	Error  *bridgeRPCError `json:"error,omitempty"`
}

type bridgeRPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

const (
	maxFileSearchResults = 80
	maxFileSearchVisited = 6000
)

func (a *App) handleBridgeMessage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var msg map[string]json.RawMessage
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64*1024*1024))
	if err := dec.Decode(&msg); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	messageType := bridgeRawString(msg["type"])
	messages, err := a.handleBridgeEnvelope(r.Context(), messageType, msg)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, bridgeResponse{Messages: messages})
}

func (a *App) handleBridgeEnvelope(ctx context.Context, messageType string, msg map[string]json.RawMessage) ([]map[string]any, error) {
	switch messageType {
	case "persisted-atom-sync-request":
		return []map[string]any{{
			"type":  "persisted-atom-sync",
			"state": a.initialHostState(),
		}}, nil
	case "persisted-atom-update":
		key := bridgeRawString(msg["key"])
		if key != "" {
			a.mu.Lock()
			if a.state.HostState == nil {
				a.state.HostState = map[string]any{}
			}
			if bridgeRawBool(msg["deleted"]) {
				delete(a.state.HostState, key)
			} else {
				var value any
				_ = json.Unmarshal(msg["value"], &value)
				a.state.HostState[key] = value
			}
			a.mu.Unlock()
			a.saveState()
		}
		return nil, nil
	case "fetch":
		return a.handleBridgeFetch(ctx, msg)
	case "fetch-stream":
		return []map[string]any{{"type": "fetch-stream-complete", "requestId": bridgeRawString(msg["requestId"])}}, nil
	case "mcp-request", "thread-prewarm-start":
		return a.handleBridgeRPC(ctx, msg)
	case "mcp-response":
		return nil, a.handleBridgeServerResponse(msg)
	case "shared-object-subscribe":
		key := bridgeRawString(msg["key"])
		return []map[string]any{a.sharedObjectUpdatedMessage(key)}, nil
	case "shared-object-set":
		key := bridgeRawString(msg["key"])
		var value any
		_ = json.Unmarshal(msg["value"], &value)
		a.setSharedObjectValue(key, value)
		return []map[string]any{a.sharedObjectUpdatedMessage(key)}, nil
	case "worker-request":
		return a.handleBridgeWorkerRequest(ctx, msg)
	case "electron-window-focus-request":
		return []map[string]any{{"type": "electron-window-focus-changed", "isFocused": true}}, nil
	case "ready", "view-focused", "log-message", "cancel-fetch", "cancel-fetch-stream",
		"desktop-notification-hide", "open-in-browser", "open-config-toml", "open-vscode-command",
		"show-diff", "show-plan-summary", "update-diff-if-open", "set-vs-context",
		"query-cache-invalidate", "thread-queued-followups-changed", "shared-object-unsubscribe",
		"worker-request-cancel", "set-telemetry-user", "desktop-notification-show",
		"mac-menu-bar-enabled-changed", "tray-menu-threads-changed",
		"thread-stream-state-changed", "heartbeat-automation-thread-state-changed":
		return nil, nil
	default:
		log.Printf("unhandled Codex webview bridge message type: %s", messageType)
		return nil, nil
	}
}

func (a *App) handleBridgeEvents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "streaming unsupported")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	events, unsubscribe := a.appsrv.Subscribe()
	defer unsubscribe()
	ticker := time.NewTicker(25 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
			_, _ = w.Write([]byte(": ping\n\n"))
			flusher.Flush()
		case event := <-events:
			msg := bridgeEventMessage(event.Method, event.Params)
			if msg == nil {
				continue
			}
			data, _ := json.Marshal(msg)
			_, _ = w.Write([]byte("data: "))
			_, _ = w.Write(data)
			_, _ = w.Write([]byte("\n\n"))
			flusher.Flush()
		}
	}
}

func bridgeEventMessage(method string, params map[string]any) map[string]any {
	if method == "appserver/request" {
		request, _ := params["request"].(map[string]any)
		if request == nil {
			return nil
		}
		hostID := firstString(strAny(params["hostId"]), "local")
		return map[string]any{"type": "mcp-request", "hostId": hostID, "request": request}
	}
	if method == "serverRequest/resolved" {
		return nil
	}
	return map[string]any{
		"type":   "mcp-notification",
		"hostId": "local",
		"method": method,
		"params": params,
	}
}

func (a *App) handleBridgeRPC(ctx context.Context, msg map[string]json.RawMessage) ([]map[string]any, error) {
	var req bridgeRPCRequest
	if err := json.Unmarshal(msg["request"], &req); err != nil {
		return nil, err
	}
	hostID := firstString(bridgeRawString(msg["hostId"]), "local")
	timeoutMs := bridgeRawInt(msg["timeoutMs"])
	result, err := a.appsrv.RequestRaw(ctx, req.Method, req.Params, timeoutMs)
	message := map[string]any{"id": req.ID}
	if err != nil {
		message["error"] = map[string]any{"code": -32000, "message": err.Error()}
	} else {
		var value any
		if len(result) > 0 {
			_ = json.Unmarshal(result, &value)
		}
		if value == nil {
			value = map[string]any{}
		}
		message["result"] = value
	}
	return []map[string]any{{"type": "mcp-response", "hostId": hostID, "message": message}}, nil
}

func (a *App) handleBridgeServerResponse(msg map[string]json.RawMessage) error {
	var response bridgeMCPResponse
	if err := json.Unmarshal(msg["response"], &response); err != nil {
		return err
	}
	if response.ID == "" {
		return nil
	}
	if response.Error != nil {
		return a.appsrv.RespondPendingError(response.ID, response.Error.Code, response.Error.Message)
	}
	var result any
	if len(response.Result) > 0 {
		_ = json.Unmarshal(response.Result, &result)
	}
	return a.appsrv.RespondPendingRaw(response.ID, result)
}

func (a *App) handleBridgeFetch(ctx context.Context, msg map[string]json.RawMessage) ([]map[string]any, error) {
	requestID := bridgeRawString(msg["requestId"])
	endpoint := bridgeEndpoint(bridgeRawString(msg["url"]))
	params := rawBodyObject(msg["body"])
	body, err := a.handleBridgeFetchEndpoint(ctx, endpoint, params)
	if err != nil {
		return []map[string]any{bridgeFetchError(requestID, err)}, nil
	}
	data, _ := json.Marshal(body)
	return []map[string]any{{
		"type":           "fetch-response",
		"requestId":      requestID,
		"responseType":   "success",
		"status":         200,
		"headers":        map[string]string{"content-type": "application/json"},
		"bodyJsonString": string(data),
	}}, nil
}

func (a *App) handleBridgeFetchEndpoint(ctx context.Context, endpoint string, params map[string]any) (any, error) {
	params = bridgeParams(params)
	switch endpoint {
	case "get-settings":
		return map[string]any{"values": a.initialHostState()}, nil
	case "get-setting":
		key := strAny(params["key"])
		return map[string]any{"value": a.hostStateValue(key)}, nil
	case "set-setting":
		a.setHostStateValue(strAny(params["key"]), params["value"])
		return map[string]any{"ok": true}, nil
	case "get-global-state":
		key := strAny(params["key"])
		return map[string]any{"value": a.hostStateValue(key)}, nil
	case "set-global-state":
		a.setHostStateValue(strAny(params["key"]), params["value"])
		return map[string]any{"ok": true}, nil
	case "codex-home":
		return map[string]any{"codexHome": a.cfg.CodexHome}, nil
	case "home-directory":
		return map[string]any{"path": a.cfg.RootDir}, nil
	case "active-workspace-roots":
		return map[string]any{"roots": []string{a.cfg.RootDir}, "labels": map[string]string{a.cfg.RootDir: filepath.Base(a.cfg.RootDir)}}, nil
	case "workspace-root-options":
		return map[string]any{"roots": []string{a.cfg.RootDir}, "labels": map[string]string{a.cfg.RootDir: filepath.Base(a.cfg.RootDir)}}, nil
	case "locale-info":
		return map[string]any{"ideLocale": "zh-CN", "systemLocale": "zh-CN"}, nil
	case "git-origins":
		return map[string]any{"origins": []any{}}, nil
	case "app-server-connection-state":
		return map[string]any{"state": "connected", "error": nil}, nil
	case "list-pinned-threads":
		return map[string]any{"threadIds": a.pinnedThreadIDs()}, nil
	case "set-thread-pinned":
		return map[string]any{"success": a.setThreadPinned(strAny(params["threadId"]), boolAny(params["pinned"]))}, nil
	case "set-pinned-threads-order":
		a.setPinnedThreadIDs(stringSlice(params["threadIds"]))
		return map[string]any{"success": true}, nil
	case "extension-info":
		return a.bridgeExtensionInfo(), nil
	case "os-info":
		return map[string]any{"platform": runtime.GOOS, "osVersion": "", "hasWsl": false, "isVsCodeRunningInsideWsl": false}, nil
	case "is-copilot-api-available":
		return map[string]any{"available": false}, nil
	case "has-custom-cli-executable":
		return map[string]any{"hasCustomCliExecutable": false}, nil
	case "account-info":
		return map[string]any{"accountId": nil, "userId": nil, "plan": nil, "email": nil, "computeResidency": nil}, nil
	case "third-party-notices":
		return map[string]any{"text": nil}, nil
	case "ide-context":
		return map[string]any{"ideContext": nil}, nil
	case "set-vs-context":
		return map[string]any{"ok": true}, nil
	case "mcp-codex-config":
		config, err := a.bridgeReadConfig(ctx, params)
		if err != nil {
			return nil, err
		}
		return map[string]any{"config": config["config"]}, nil
	case "v1/initialize":
		return map[string]any{
			"feature_gates":   map[string]any{},
			"dynamic_configs": map[string]any{},
			"layer_configs":   map[string]any{},
			"sdkParams":       map[string]any{},
			"has_updates":     true,
			"time":            time.Now().UnixMilli(),
		}, nil
	case "ces/v1/rgstr":
		return map[string]any{}, nil
	case "wham/usage":
		return nil, nil
	case "read-config", "read-config-for-host":
		return a.bridgeReadConfig(ctx, params)
	case "get-config-requirements-for-host":
		return a.bridgeReadConfigRequirements(ctx)
	case "workspace-directory-entries":
		return a.bridgeWorkspaceDirectoryEntries(params)
	case "workspace-directory-tree-search":
		return a.bridgeWorkspaceDirectorySearch(params)
	case "projectless-thread-cwd":
		return map[string]any{"cwd": a.cfg.RootDir, "workspaceRoot": a.cfg.RootDir}, nil
	case "local-custom-agents":
		return map[string]any{"agents": []any{}}, nil
	case "get-is-conversation-archiving-for-host":
		return map[string]any{"isArchiving": false}, nil
	case "get-openai-capabilities-server-info", "get-copilot-api-proxy-info":
		return map[string]any{"value": nil}, nil
	case "get-windows-sandbox-readiness-for-host":
		return map[string]any{"status": "unsupported", "reason": "codex-web runs on linux"}, nil
	case "paths-exist":
		return a.bridgePathsExist(params), nil
	case "read-file-metadata":
		return a.bridgeReadFileMetadata(params)
	case "read-file-binary":
		return a.bridgeReadFileBinary(params)
	default:
		_ = ctx
		log.Printf("unhandled Codex webview bridge fetch endpoint: %s", endpoint)
		return map[string]any{}, nil
	}
}

func (a *App) handleBridgeWorkerRequest(ctx context.Context, msg map[string]json.RawMessage) ([]map[string]any, error) {
	workerID := bridgeRawString(msg["workerId"])
	var req struct {
		ID     any            `json:"id"`
		Method string         `json:"method"`
		Params map[string]any `json:"params"`
	}
	if err := json.Unmarshal(msg["request"], &req); err != nil {
		return nil, err
	}
	if workerID != "git" {
		return []map[string]any{bridgeWorkerError(workerID, req.ID, req.Method, "Unknown worker: "+workerID)}, nil
	}
	value, err := a.handleGitWorkerRequest(ctx, req.Method, req.Params)
	if err != nil {
		return []map[string]any{bridgeWorkerError(workerID, req.ID, req.Method, err.Error())}, nil
	}
	return []map[string]any{bridgeWorkerOK(workerID, req.ID, req.Method, value)}, nil
}

func bridgeWorkerOK(workerID string, id any, method string, value any) map[string]any {
	return map[string]any{
		"type":     "worker-response",
		"workerId": workerID,
		"response": map[string]any{
			"id":     id,
			"method": method,
			"result": map[string]any{"type": "ok", "value": value},
		},
	}
}

func bridgeWorkerError(workerID string, id any, method string, message string) map[string]any {
	return map[string]any{
		"type":     "worker-response",
		"workerId": workerID,
		"response": map[string]any{
			"id":     id,
			"method": method,
			"result": map[string]any{"type": "error", "error": map[string]any{"message": message}},
		},
	}
}

func (a *App) handleGitWorkerRequest(ctx context.Context, method string, params map[string]any) (any, error) {
	switch method {
	case "stable-metadata":
		return a.gitStableMetadata(ctx, params)
	case "watch-repo", "unwatch-repo", "invalidate-untracked-paths-cache", "invalidate-stable-metadata", "dispose-git-init-watch":
		return map[string]any{"success": true}, nil
	case "current-branch":
		branch, _ := a.gitCurrentBranch(ctx, params)
		return map[string]any{"branch": nullableString(branch)}, nil
	case "upstream-branch":
		upstream, _ := a.gitOutput(ctx, gitCWD(params), "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}")
		return map[string]any{"upstreamBranch": nullableString(upstream)}, nil
	case "branch-ahead-count":
		count := a.gitAheadCount(ctx, params)
		return map[string]any{"commitsAhead": count}, nil
	case "default-branch":
		return map[string]any{"defaultBranch": nullableString(a.gitDefaultBranch(ctx, params))}, nil
	case "base-branch":
		return map[string]any{"baseBranch": nullableString(a.gitDefaultBranch(ctx, params))}, nil
	case "recent-branches", "search-branches":
		return map[string]any{"branches": a.gitBranches(ctx, params)}, nil
	case "branch-commits":
		return map[string]any{"commits": []any{}}, nil
	case "nearest-ancestor-branch":
		return map[string]any{"branch": nullableString(a.gitDefaultBranch(ctx, params))}, nil
	case "branch-metadata":
		return a.gitBranchMetadata(ctx, params), nil
	case "status-summary":
		return a.gitStatusSummary(ctx, params), nil
	case "branch-diff-stats":
		summary, err := a.gitReviewSummary(ctx, params)
		if err != nil {
			return map[string]any{"type": "error", "error": err.Error()}, nil
		}
		return map[string]any{
			"type":      "success",
			"additions": sumIntField(summary, "additions"),
			"deletions": sumIntField(summary, "deletions"),
			"files":     summary["files"],
		}, nil
	case "review-summary", "review-path-summary":
		return a.gitReviewSummary(ctx, params)
	case "review-patch":
		diff, err := a.gitReviewPatch(ctx, params)
		if err != nil {
			return map[string]any{"diff": map[string]any{"type": "error", "error": err.Error()}}, nil
		}
		return map[string]any{"diff": map[string]any{"type": "success", "unifiedDiff": diff}}, nil
	case "review-diff":
		return a.gitReviewDiff(ctx, params)
	case "review-search":
		return a.gitReviewSearch(ctx, params)
	case "tracked-uncommitted-changes":
		return map[string]any{"type": "success", "files": []any{}}, nil
	case "index-info":
		return map[string]any{"hasStagedChanges": a.gitHasStagedChanges(ctx, params)}, nil
	case "submodule-paths":
		return map[string]any{"paths": []any{}}, nil
	case "git-origins":
		return map[string]any{"origins": []any{}}, nil
	case "config-value":
		return map[string]any{"value": nil}, nil
	case "set-config-value", "set-worktree-owner-thread", "restore-worktree":
		return map[string]any{"success": false}, nil
	case "list-worktrees", "codex-worktrees":
		return map[string]any{"worktrees": []any{}}, nil
	case "resolve-worktree-for-thread", "move-thread-to-local", "move-thread-to-worktree", "apply-review-section-changes", "apply-changes", "commit":
		return nil, fmt.Errorf("Unknown method: %s", method)
	default:
		return nil, fmt.Errorf("Unknown method: %s", method)
	}
}

func (a *App) sharedObjectUpdatedMessage(key string) map[string]any {
	return map[string]any{"type": "shared-object-updated", "key": key, "value": a.sharedObjectValue(key)}
}

func (a *App) sharedObjectValue(key string) any {
	a.mu.Lock()
	defer a.mu.Unlock()
	if value, ok := a.state.SharedObjects[key]; ok {
		return value
	}
	if value, ok := a.defaultHostState()[key]; ok {
		return value
	}
	return nil
}

func (a *App) setSharedObjectValue(key string, value any) {
	if key == "" {
		return
	}
	a.mu.Lock()
	if a.state.SharedObjects == nil {
		a.state.SharedObjects = map[string]any{}
	}
	a.state.SharedObjects[key] = value
	a.mu.Unlock()
	a.saveState()
}

func (a *App) pinnedThreadIDs() []string {
	a.mu.Lock()
	defer a.mu.Unlock()
	return append([]string{}, a.state.PinnedThreadIDs...)
}

func (a *App) setThreadPinned(threadID string, pinned bool) bool {
	threadID = strings.TrimSpace(threadID)
	if threadID == "" {
		return false
	}
	a.mu.Lock()
	next := make([]string, 0, len(a.state.PinnedThreadIDs)+1)
	seen := false
	for _, existing := range a.state.PinnedThreadIDs {
		if existing == threadID {
			seen = true
			if pinned {
				next = append(next, existing)
			}
			continue
		}
		next = append(next, existing)
	}
	if pinned && !seen {
		next = append([]string{threadID}, next...)
	}
	a.state.PinnedThreadIDs = next
	a.mu.Unlock()
	a.saveState()
	return true
}

func (a *App) setPinnedThreadIDs(threadIDs []string) {
	a.mu.Lock()
	a.state.PinnedThreadIDs = uniqueStrings(threadIDs)
	a.mu.Unlock()
	a.saveState()
}

func (a *App) bridgeExtensionInfo() map[string]any {
	return map[string]any{
		"version":       firstString(os.Getenv("CODEX_WEB_EXTENSION_VERSION"), installedCodexExtensionVersion(), "unknown"),
		"buildNumber":   nil,
		"buildFlavor":   "vscode",
		"osName":        runtime.GOOS,
		"systemVersion": nil,
		"appName":       "Codex",
		"appIconMedium": nil,
	}
}

func installedCodexExtensionVersion() string {
	home, _ := os.UserHomeDir()
	if home == "" {
		return ""
	}
	pattern := filepath.Join(home, ".local", "share", "code-server", "extensions", "openai.chatgpt-*", "package.json")
	matches, _ := filepath.Glob(pattern)
	sort.Strings(matches)
	for i := len(matches) - 1; i >= 0; i-- {
		data, err := os.ReadFile(matches[i])
		if err != nil {
			continue
		}
		var pkg struct {
			Version string `json:"version"`
		}
		if json.Unmarshal(data, &pkg) == nil && strings.TrimSpace(pkg.Version) != "" {
			return strings.TrimSpace(pkg.Version)
		}
	}
	return ""
}

func (a *App) gitStableMetadata(ctx context.Context, params map[string]any) (any, error) {
	cwd := gitCWD(params)
	root, err := a.gitOutput(ctx, cwd, "rev-parse", "--show-toplevel")
	if err != nil || root == "" {
		return nil, nil
	}
	commonDir, err := a.gitOutput(ctx, root, "rev-parse", "--git-common-dir")
	if err != nil {
		return nil, nil
	}
	if commonDir != "" && !filepath.IsAbs(commonDir) {
		commonDir = filepath.Clean(filepath.Join(root, commonDir))
	}
	return map[string]any{"commonDir": commonDir, "root": root}, nil
}

func (a *App) gitCurrentBranch(ctx context.Context, params map[string]any) (string, error) {
	branch, err := a.gitOutput(ctx, gitCWD(params), "branch", "--show-current")
	if err == nil && branch != "" {
		return branch, nil
	}
	return a.gitOutput(ctx, gitCWD(params), "rev-parse", "--abbrev-ref", "HEAD")
}

func (a *App) gitDefaultBranch(ctx context.Context, params map[string]any) string {
	cwd := gitCWD(params)
	for _, ref := range []string{"origin/HEAD", "main", "master"} {
		out, err := a.gitOutput(ctx, cwd, "rev-parse", "--abbrev-ref", ref)
		if err != nil || out == "" {
			continue
		}
		out = strings.TrimPrefix(out, "origin/")
		if out != "HEAD" {
			return out
		}
	}
	return ""
}

func (a *App) gitAheadCount(ctx context.Context, params map[string]any) int {
	cwd := gitCWD(params)
	out, err := a.gitOutput(ctx, cwd, "rev-list", "--count", "@{u}..HEAD")
	if err != nil {
		return 0
	}
	count, _ := strconv.Atoi(strings.TrimSpace(out))
	return count
}

func (a *App) gitBranches(ctx context.Context, params map[string]any) []map[string]any {
	limit := intAny(params["limit"])
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	out, err := a.gitOutput(ctx, gitCWD(params), "for-each-ref", "--sort=-committerdate", "--format=%(refname:short)", "refs/heads")
	if err != nil {
		return nil
	}
	lines := strings.Split(out, "\n")
	branches := make([]map[string]any, 0, minInt(limit, len(lines)))
	for _, line := range lines {
		name := strings.TrimSpace(line)
		if name == "" {
			continue
		}
		if query := strings.ToLower(strAny(params["query"])); query != "" && !strings.Contains(strings.ToLower(name), query) {
			continue
		}
		branches = append(branches, map[string]any{"branch": name, "name": name})
		if len(branches) >= limit {
			break
		}
	}
	return branches
}

func (a *App) gitBranchMetadata(ctx context.Context, params map[string]any) map[string]any {
	metadata, _ := a.gitStableMetadata(ctx, params)
	root := ""
	if m, ok := metadata.(map[string]any); ok {
		root = strAny(m["root"])
	}
	branch, _ := a.gitCurrentBranch(ctx, params)
	defaultBranch := a.gitDefaultBranch(ctx, params)
	upstream, _ := a.gitOutput(ctx, gitCWD(params), "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}")
	return map[string]any{
		"type":          "success",
		"branch":        nullableString(branch),
		"defaultBranch": nullableString(defaultBranch),
		"upstreamRef":   nullableString(upstream),
		"gitRoot":       nullableString(root),
	}
}

func (a *App) gitStatusSummary(ctx context.Context, params map[string]any) map[string]any {
	out, err := a.gitOutput(ctx, gitCWD(params), "status", "--porcelain=v1")
	if err != nil {
		return map[string]any{"type": "error", "error": err.Error()}
	}
	staged, unstaged, untracked := 0, 0, 0
	for _, line := range strings.Split(out, "\n") {
		if len(line) < 2 {
			continue
		}
		if strings.HasPrefix(line, "??") {
			untracked++
			continue
		}
		if line[0] != ' ' {
			staged++
		}
		if line[1] != ' ' {
			unstaged++
		}
	}
	return map[string]any{
		"type": "success",
		"stageCounts": map[string]any{
			"stagedFileCount":    staged,
			"unstagedFileCount":  unstaged,
			"untrackedFileCount": untracked,
		},
		"hasChanges": staged+unstaged+untracked > 0,
	}
}

func (a *App) gitReviewSummary(ctx context.Context, params map[string]any) (map[string]any, error) {
	args := gitDiffArgs(params, "--numstat")
	out, err := a.gitOutput(ctx, gitCWD(params), args...)
	if err != nil {
		return map[string]any{"type": "error", "error": err.Error()}, nil
	}
	files := make([]map[string]any, 0)
	for _, line := range strings.Split(out, "\n") {
		parts := strings.Split(line, "\t")
		if len(parts) < 3 {
			continue
		}
		additions := parseGitNumstat(parts[0])
		deletions := parseGitNumstat(parts[1])
		path := strings.TrimSpace(parts[len(parts)-1])
		if path == "" {
			continue
		}
		files = append(files, map[string]any{
			"path":       path,
			"gitPath":    path,
			"changeKind": "modified",
			"additions":  additions,
			"deletions":  deletions,
		})
	}
	if shouldIncludeUntracked(params) {
		for _, path := range a.gitUntrackedFiles(ctx, params) {
			files = append(files, map[string]any{
				"path":       path,
				"gitPath":    path,
				"changeKind": "untracked",
				"additions":  0,
				"deletions":  0,
			})
		}
	}
	stageCounts := a.gitStatusSummary(ctx, params)["stageCounts"]
	return map[string]any{"type": "success", "files": files, "stageCounts": stageCounts}, nil
}

func (a *App) gitReviewPatch(ctx context.Context, params map[string]any) (string, error) {
	return a.gitOutput(ctx, gitCWD(params), gitDiffArgs(params, "--patch")...)
}

func (a *App) gitReviewDiff(ctx context.Context, params map[string]any) (map[string]any, error) {
	files := fileParams(params["files"])
	diffs := map[string]any{}
	for _, file := range files {
		args := append(gitDiffArgs(params, "--patch"), "--", file.Path)
		diff, err := a.gitOutput(ctx, gitCWD(params), args...)
		if err != nil {
			diffs[file.Path] = map[string]any{"type": "error", "error": err.Error()}
			continue
		}
		diffs[file.Path] = map[string]any{"type": "success", "diff": diff}
	}
	return map[string]any{"diffs": diffs}, nil
}

func (a *App) gitReviewSearch(ctx context.Context, params map[string]any) (map[string]any, error) {
	query := strings.TrimSpace(strAny(params["query"]))
	if query == "" {
		return map[string]any{"type": "success", "query": query, "matches": []any{}, "totalMatches": 0, "isCapped": false}, nil
	}
	diff, err := a.gitReviewPatch(ctx, params)
	if err != nil {
		return map[string]any{"type": "error", "error": err.Error(), "query": query, "matches": []any{}, "totalMatches": 0, "isCapped": false}, nil
	}
	lowerQuery := strings.ToLower(query)
	matches := []map[string]any{}
	currentPath := ""
	for lineNo, line := range strings.Split(diff, "\n") {
		if strings.HasPrefix(line, "+++ b/") {
			currentPath = strings.TrimPrefix(line, "+++ b/")
			continue
		}
		if !strings.Contains(strings.ToLower(line), lowerQuery) {
			continue
		}
		start := strings.Index(strings.ToLower(line), lowerQuery)
		matches = append(matches, map[string]any{
			"path":      currentPath,
			"hunkId":    "0",
			"lineStart": lineNo + 1,
			"lineEnd":   lineNo + 1,
			"start":     start,
			"end":       start + len(query),
			"snippet":   strings.TrimSpace(line),
		})
		if len(matches) >= 100 {
			return map[string]any{"type": "success", "query": query, "matches": matches, "totalMatches": len(matches), "isCapped": true}, nil
		}
	}
	return map[string]any{"type": "success", "query": query, "matches": matches, "totalMatches": len(matches), "isCapped": false}, nil
}

func (a *App) gitHasStagedChanges(ctx context.Context, params map[string]any) bool {
	out, err := a.gitOutput(ctx, gitCWD(params), "diff", "--cached", "--name-only")
	return err == nil && strings.TrimSpace(out) != ""
}

func (a *App) gitUntrackedFiles(ctx context.Context, params map[string]any) []string {
	out, err := a.gitOutput(ctx, gitCWD(params), "ls-files", "--others", "--exclude-standard")
	if err != nil {
		return nil
	}
	return uniqueStrings(strings.Split(out, "\n"))
}

func (a *App) gitOutput(ctx context.Context, cwd string, args ...string) (string, error) {
	if strings.TrimSpace(cwd) == "" {
		cwd = a.cfg.RootDir
	}
	dir, err := safePath(a.cfg.RootDir, cwd)
	if err != nil {
		return "", err
	}
	cmdArgs := append([]string{"-C", dir}, args...)
	cmd := exec.CommandContext(ctx, "git", cmdArgs...)
	output, err := cmd.CombinedOutput()
	text := strings.TrimSpace(string(output))
	if err != nil {
		if text == "" {
			text = err.Error()
		}
		return "", fmt.Errorf("git %s: %s", strings.Join(args, " "), text)
	}
	return text, nil
}

func gitCWD(params map[string]any) string {
	return firstString(
		strAny(params["cwd"]),
		strAny(params["root"]),
		strAny(params["localCwd"]),
		strAny(params["sourceWorktreeCwd"]),
		strAny(params["worktreeWorkspaceRoot"]),
	)
}

func gitDiffArgs(params map[string]any, mode string) []string {
	source := strings.TrimSpace(strAny(params["source"]))
	hideWhitespace := boolAny(params["hideWhitespace"])
	commitSha := strings.TrimSpace(strAny(params["commitSha"]))
	baseBranch := strings.TrimSpace(strAny(params["baseBranch"]))
	args := []string{}
	switch source {
	case "commit":
		args = []string{"show", "--format="}
		if mode != "" {
			args = append(args, mode)
		}
		if commitSha != "" {
			args = append(args, commitSha)
		} else {
			args = append(args, "HEAD")
		}
	case "staged", "index":
		args = []string{"diff", "--cached"}
		if mode != "" {
			args = append(args, mode)
		}
	case "branch", "remote-refs":
		args = []string{"diff"}
		if mode != "" {
			args = append(args, mode)
		}
		if baseBranch != "" {
			args = append(args, baseBranch+"...HEAD")
		} else {
			args = append(args, "HEAD")
		}
	default:
		args = []string{"diff"}
		if mode != "" {
			args = append(args, mode)
		}
	}
	if hideWhitespace {
		args = append(args, "-w")
	}
	return args
}

type gitFileParam struct {
	Path string
}

func fileParams(value any) []gitFileParam {
	items, ok := value.([]any)
	if !ok {
		return nil
	}
	out := make([]gitFileParam, 0, len(items))
	for _, item := range items {
		switch v := item.(type) {
		case string:
			if strings.TrimSpace(v) != "" {
				out = append(out, gitFileParam{Path: strings.TrimSpace(v)})
			}
		case map[string]any:
			path := firstString(strAny(v["path"]), strAny(v["gitPath"]))
			if path != "" {
				out = append(out, gitFileParam{Path: path})
			}
		}
	}
	return out
}

func shouldIncludeUntracked(params map[string]any) bool {
	source := strings.TrimSpace(strAny(params["source"]))
	if source == "staged" || source == "index" || source == "commit" {
		return false
	}
	if value, ok := params["includeUntrackedFiles"].(bool); ok {
		return value
	}
	return source == "" || source == "unstaged" || source == "working-tree"
}

func parseGitNumstat(value string) int {
	n, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil {
		return 0
	}
	return n
}

func sumIntField(summary map[string]any, field string) int {
	files, ok := summary["files"].([]map[string]any)
	if !ok {
		rawFiles, ok := summary["files"].([]any)
		if !ok {
			return 0
		}
		total := 0
		for _, item := range rawFiles {
			if file, ok := item.(map[string]any); ok {
				total += intAny(file[field])
			}
		}
		return total
	}
	total := 0
	for _, file := range files {
		total += intAny(file[field])
	}
	return total
}

func bridgeParams(params map[string]any) map[string]any {
	if nested, ok := params["params"].(map[string]any); ok && nested != nil {
		return nested
	}
	return params
}

func (a *App) bridgePathsExist(params map[string]any) map[string]any {
	paths := stringSlice(params["paths"])
	existing := []string{}
	for _, requested := range paths {
		if path, err := safePath(a.cfg.RootDir, requested); err == nil {
			if _, err := os.Stat(path); err == nil {
				existing = append(existing, path)
			}
		}
	}
	return map[string]any{"existingPaths": existing}
}

func (a *App) bridgeReadFileMetadata(params map[string]any) (map[string]any, error) {
	path, err := safePath(a.cfg.RootDir, strAny(params["path"]))
	if err != nil {
		return nil, err
	}
	stat, err := os.Stat(path)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"sizeBytes":    stat.Size(),
		"modifiedAtMs": stat.ModTime().UnixMilli(),
		"isDirectory":  stat.IsDir(),
		"isFile":       !stat.IsDir(),
	}, nil
}

func (a *App) bridgeReadFileBinary(params map[string]any) (map[string]any, error) {
	path, err := safePath(a.cfg.RootDir, strAny(params["path"]))
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return map[string]any{"contentsBase64": base64.StdEncoding.EncodeToString(data)}, nil
}

func (a *App) bridgeReadConfig(ctx context.Context, params map[string]any) (map[string]any, error) {
	cwd := firstString(strAny(params["cwd"]), a.cfg.RootDir)
	cfg, err := a.appsrv.ReadConfig(ctx, cwd)
	if err != nil {
		return nil, err
	}
	config := map[string]any{
		"model_provider":           cfg.Provider,
		"model":                    cfg.Model,
		"model_reasoning_effort":   cfg.Reasoning,
		"thread_detail_level":      cfg.ThreadDetailLevel,
		"conversation_detail_mode": cfg.ThreadDetailLevel,
		"approval_policy":          "on-request",
		"approvals_reviewer":       "user",
		"sandbox_mode":             "workspace-write",
		"analytics":                map[string]any{"enabled": false},
	}
	return map[string]any{
		"config":  config,
		"layers":  []any{},
		"origins": map[string]any{},
	}, nil
}

func (a *App) bridgeReadConfigRequirements(ctx context.Context) (map[string]any, error) {
	requirements, err := a.appsrv.ReadConfigRequirements(ctx)
	if err != nil {
		return nil, err
	}
	return map[string]any{"requirements": requirements}, nil
}

func (a *App) bridgeWorkspaceDirectoryEntries(params map[string]any) (map[string]any, error) {
	root, dir, relDir, err := a.bridgeWorkspaceDirectory(params)
	if err != nil {
		return nil, err
	}
	includeHidden, _ := params["includeHidden"].(bool)
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	out := make([]map[string]any, 0, len(entries))
	for _, entry := range entries {
		name := entry.Name()
		if !includeHidden && strings.HasPrefix(name, ".") {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		relPath := filepath.ToSlash(filepath.Join(relDir, name))
		entryType := "file"
		if entry.IsDir() {
			entryType = "directory"
		}
		out = append(out, map[string]any{
			"type":         entryType,
			"name":         name,
			"path":         relPath,
			"displayPath":  relPath,
			"sizeBytes":    info.Size(),
			"modifiedAtMs": info.ModTime().UnixMilli(),
			"isDirectory":  entry.IsDir(),
			"isFile":       !entry.IsDir(),
		})
	}
	sort.SliceStable(out, func(i, j int) bool {
		leftDir, _ := out[i]["isDirectory"].(bool)
		rightDir, _ := out[j]["isDirectory"].(bool)
		if leftDir != rightDir {
			return leftDir
		}
		return strings.ToLower(strAny(out[i]["path"])) < strings.ToLower(strAny(out[j]["path"]))
	})
	return map[string]any{
		"root":          root,
		"directoryPath": relDir,
		"entries":       out,
	}, nil
}

func (a *App) bridgeWorkspaceDirectorySearch(params map[string]any) (map[string]any, error) {
	root, _, _, err := a.bridgeWorkspaceDirectory(params)
	if err != nil {
		return nil, err
	}
	query := strings.ToLower(strings.TrimSpace(firstString(strAny(params["query"]), strAny(params["searchQuery"]))))
	if query == "" {
		return map[string]any{"query": query, "files": []any{}}, nil
	}
	includeHidden, _ := params["includeHidden"].(bool)
	files := []map[string]any{}
	visited := 0
	truncated := false
	err = filepath.WalkDir(root, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return nil
		}
		if path != root {
			visited++
		}
		if visited > maxFileSearchVisited {
			truncated = true
			return filepath.SkipAll
		}
		name := entry.Name()
		if path != root && entry.IsDir() && shouldSkipSearchDir(name) {
			return filepath.SkipDir
		}
		if !includeHidden && strings.HasPrefix(name, ".") {
			if entry.IsDir() && path != root {
				return filepath.SkipDir
			}
			return nil
		}
		if path == root || !strings.Contains(strings.ToLower(name), query) {
			return nil
		}
		relPath, err := filepath.Rel(root, path)
		if err != nil {
			return nil
		}
		relPath = filepath.ToSlash(relPath)
		entryType := "file"
		if entry.IsDir() {
			entryType = "directory"
		}
		files = append(files, map[string]any{
			"type":        entryType,
			"name":        name,
			"path":        relPath,
			"displayPath": relPath,
			"isDirectory": entry.IsDir(),
			"isFile":      !entry.IsDir(),
		})
		if len(files) >= maxFileSearchResults {
			truncated = true
			return filepath.SkipAll
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return map[string]any{"query": query, "files": files, "truncated": truncated}, nil
}

func (a *App) bridgeWorkspaceDirectory(params map[string]any) (string, string, string, error) {
	root := firstString(strAny(params["workspaceRoot"]), strAny(params["root"]), a.cfg.RootDir)
	root, err := safePath(a.cfg.RootDir, root)
	if err != nil {
		return "", "", "", err
	}
	relDir := filepath.Clean(strAny(params["directoryPath"]))
	if relDir == "." {
		relDir = ""
	}
	dir := root
	if relDir != "" {
		dir, err = safePath(root, relDir)
		if err != nil {
			return "", "", "", err
		}
	}
	if stat, err := os.Stat(dir); err != nil {
		return "", "", "", err
	} else if !stat.IsDir() {
		return "", "", "", fmt.Errorf("%s is not a directory", dir)
	}
	return root, dir, filepath.ToSlash(relDir), nil
}

func (a *App) initialHostState() map[string]any {
	state := a.defaultHostState()
	a.mu.Lock()
	for key, value := range a.state.HostState {
		state[key] = value
	}
	a.mu.Unlock()
	return state
}

func (a *App) defaultHostState() map[string]any {
	return map[string]any{
		"appearanceTheme":                  "dark",
		"remote_connections":               []any{},
		"remote_control_connections":       []any{},
		"remote_control_connections_state": map[string]any{"clientAuthorized": true},
		"host_config":                      map[string]any{"id": "local", "display_name": "本机", "kind": "local"},
		"active-remote-project-id":         nil,
		"agent-mode-by-host-id":            map[string]any{"local": "auto"},
		"composer-auto-context-enabled":    false,
	}
}

func (a *App) hostStateValue(key string) any {
	a.mu.Lock()
	defer a.mu.Unlock()
	if key == "" || a.state.HostState == nil {
		return nil
	}
	if value, ok := a.state.HostState[key]; ok {
		return value
	}
	return a.defaultHostState()[key]
}

func (a *App) setHostStateValue(key string, value any) {
	if key == "" {
		return
	}
	a.mu.Lock()
	if a.state.HostState == nil {
		a.state.HostState = map[string]any{}
	}
	a.state.HostState[key] = value
	a.mu.Unlock()
	a.saveState()
}

func bridgeFetchError(requestID string, err error) map[string]any {
	return map[string]any{
		"type":         "fetch-response",
		"requestId":    requestID,
		"responseType": "error",
		"status":       500,
		"error":        err.Error(),
		"errorCode":    "codex_web_bridge_error",
	}
}

func bridgeEndpoint(rawURL string) string {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return strings.Trim(rawURL, "/")
	}
	if parsed.Scheme == "vscode" && parsed.Host == "codex" {
		return strings.Trim(parsed.Path, "/")
	}
	return strings.Trim(parsed.Path, "/")
}

func rawBodyObject(raw json.RawMessage) map[string]any {
	if len(raw) == 0 || string(raw) == "null" {
		return map[string]any{}
	}
	var bodyString string
	if err := json.Unmarshal(raw, &bodyString); err == nil {
		if strings.TrimSpace(bodyString) == "" {
			return map[string]any{}
		}
		var value map[string]any
		if err := json.Unmarshal([]byte(bodyString), &value); err == nil && value != nil {
			return value
		}
		return map[string]any{}
	}
	var value map[string]any
	if err := json.Unmarshal(raw, &value); err == nil && value != nil {
		return value
	}
	return map[string]any{}
}

func bridgeRawString(raw json.RawMessage) string {
	var value string
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &value)
	}
	return strings.TrimSpace(value)
}

func bridgeRawBool(raw json.RawMessage) bool {
	var value bool
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &value)
	}
	return value
}

func bridgeRawInt(raw json.RawMessage) int {
	var value int
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &value)
	}
	return value
}

func boolAny(value any) bool {
	switch v := value.(type) {
	case bool:
		return v
	case string:
		return strings.EqualFold(strings.TrimSpace(v), "true")
	default:
		return false
	}
}

func intAny(value any) int {
	switch v := value.(type) {
	case int:
		return v
	case int64:
		return int(v)
	case float64:
		return int(v)
	case json.Number:
		n, _ := v.Int64()
		return int(n)
	case string:
		n, _ := strconv.Atoi(strings.TrimSpace(v))
		return n
	default:
		return 0
	}
}

func strAny(value any) string {
	switch v := value.(type) {
	case string:
		return strings.TrimSpace(v)
	case fmt.Stringer:
		return strings.TrimSpace(v.String())
	default:
		return ""
	}
}

func stringSlice(value any) []string {
	items, ok := value.([]any)
	if !ok {
		if valueString := strAny(value); valueString != "" {
			return []string{valueString}
		}
		return nil
	}
	out := make([]string, 0, len(items))
	for _, item := range items {
		if value := strAny(item); value != "" {
			out = append(out, value)
		}
	}
	return out
}

func uniqueStrings(values []string) []string {
	out := make([]string, 0, len(values))
	seen := map[string]bool{}
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		out = append(out, value)
	}
	return out
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func nullableString(value string) any {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return value
}

func shouldSkipSearchDir(name string) bool {
	switch name {
	case ".git", "node_modules", "vendor", "dist", "build", ".cache", ".next", ".turbo":
		return true
	default:
		return false
	}
}
