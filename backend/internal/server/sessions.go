package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"codex-web/backend/internal/node"
)

type nodeRequest struct {
	NodeID string `json:"nodeId"`
}

type sessionCreateHTTP struct {
	NodeID string `json:"nodeId"`
	Prompt string `json:"prompt"`
	CWD    string `json:"cwd,omitempty"`
}

type sessionSendHTTP struct {
	NodeID string `json:"nodeId"`
	Prompt string `json:"prompt"`
}

type workspaceRequest struct {
	NodeID   string         `json:"nodeId"`
	Endpoint string         `json:"endpoint"`
	Params   map[string]any `json:"params,omitempty"`
}

type gitRequest struct {
	NodeID string         `json:"nodeId"`
	Method string         `json:"method"`
	Params map[string]any `json:"params,omitempty"`
}

func (a *App) handleSessions(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		client, err := a.nodeClientFromRequest(r, nil)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		result, err := client.Request(r.Context(), "session.list", nil)
		if err != nil {
			writeError(w, http.StatusBadGateway, err.Error())
			return
		}
		writeJSON(w, result)
	case http.MethodPost:
		var req sessionCreateHTTP
		if err := readJSON(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		client, err := a.nodeClientFromRequest(r, map[string]any{"nodeId": req.NodeID})
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		result, err := client.Request(r.Context(), "session.create", map[string]any{
			"prompt": req.Prompt,
			"cwd":    req.CWD,
		})
		if err != nil {
			writeError(w, http.StatusBadGateway, err.Error())
			return
		}
		writeJSON(w, result)
	default:
		methodNotAllowed(w)
	}
}

func (a *App) handleSessionItem(w http.ResponseWriter, r *http.Request, tail string) {
	parts := strings.Split(strings.Trim(tail, "/"), "/")
	if len(parts) < 2 {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	sessionID := parts[0]
	action := parts[1]
	switch {
	case r.Method == http.MethodPost && action == "send":
		var req sessionSendHTTP
		if err := readJSON(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		client, err := a.nodeClientFromRequest(r, map[string]any{"nodeId": req.NodeID})
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		result, err := client.Request(r.Context(), "session.send", map[string]any{
			"sessionId": sessionID,
			"prompt":    req.Prompt,
		})
		if err != nil {
			writeError(w, http.StatusBadGateway, err.Error())
			return
		}
		writeJSON(w, result)
	case r.Method == http.MethodPost && action == "cancel":
		var req nodeRequest
		_ = readJSON(r, &req)
		client, err := a.nodeClientFromRequest(r, map[string]any{"nodeId": req.NodeID})
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		result, err := client.Request(r.Context(), "session.cancel", map[string]any{"sessionId": sessionID})
		if err != nil {
			writeError(w, http.StatusBadGateway, err.Error())
			return
		}
		writeJSON(w, result)
	case r.Method == http.MethodGet && action == "events":
		a.writeSessionBacklog(w, r, sessionID)
	default:
		writeError(w, http.StatusNotFound, "not found")
	}
}

func (a *App) writeSessionBacklog(w http.ResponseWriter, r *http.Request, sessionID string) {
	lastSeq, _ := strconv.ParseInt(r.URL.Query().Get("lastSeq"), 10, 64)
	client, err := a.nodeClientFromRequest(r, nil)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	result, err := client.Request(r.Context(), "session.events", map[string]any{
		"sessionId": sessionID,
		"lastSeq":   lastSeq,
	})
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, result)
}

func (a *App) handleSessionEvents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	sessionID := strings.TrimSpace(r.URL.Query().Get("sessionId"))
	lastSeq, _ := strconv.ParseInt(r.URL.Query().Get("lastSeq"), 10, 64)
	client, err := a.nodeClientFromRequest(r, nil)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	var backlog any
	if sessionID != "" {
		backlog, err = client.Request(r.Context(), "session.events", map[string]any{
			"sessionId": sessionID,
			"lastSeq":   lastSeq,
		})
		if err != nil {
			writeError(w, http.StatusBadGateway, err.Error())
			return
		}
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "streaming is not supported")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	if sessionID != "" {
		for _, event := range sessionEventsFromResult(backlog) {
			writeSSE(w, event)
		}
	}
	flusher.Flush()
	events, unsubscribe := client.Subscribe()
	defer unsubscribe()
	for {
		select {
		case <-r.Context().Done():
			return
		case event, ok := <-events:
			if !ok {
				return
			}
			if event.Method != "session.event" {
				continue
			}
			sessionEvent, ok := event.Params["sessionId"].(string)
			if !ok {
				continue
			}
			if sessionID != "" && sessionEvent != sessionID {
				continue
			}
			writeSSE(w, event.Params)
			flusher.Flush()
		}
	}
}

func (a *App) handleWorkspace(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req workspaceRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	client, err := a.nodeClientFromRequest(r, map[string]any{"nodeId": req.NodeID})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	params := req.Params
	if params == nil {
		params = map[string]any{}
	}
	params["endpoint"] = req.Endpoint
	result, err := client.Request(r.Context(), "workspace.fetch", params)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, result)
}

func (a *App) handleGit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req gitRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	client, err := a.nodeClientFromRequest(r, map[string]any{"nodeId": req.NodeID})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	params := req.Params
	if params == nil {
		params = map[string]any{}
	}
	params["method"] = req.Method
	result, err := client.Request(r.Context(), "git.request", params)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, result)
}

func (a *App) nodeClientFromRequest(r *http.Request, body map[string]any) (node.Client, error) {
	nodeID := requestNodeID(r, body)
	if nodeID == "" {
		return nil, fmt.Errorf("nodeId is required")
	}
	return a.nodeClient(nodeID)
}

func (a *App) nodeClient(nodeID string) (node.Client, error) {
	nodeID = cleanNodeID(nodeID)
	if nodeID == "" {
		return nil, fmt.Errorf("nodeId is required")
	}
	client := a.nodes.Client(nodeID)
	if client != nil && client.Online() {
		return client, nil
	}
	if a.nodes.Exists(nodeID) {
		return nil, fmt.Errorf("node %q is offline", nodeID)
	}
	return nil, fmt.Errorf("node %q does not exist", nodeID)
}

func requestNodeID(r *http.Request, body map[string]any) string {
	if body != nil {
		if nodeID, _ := body["nodeId"].(string); strings.TrimSpace(nodeID) != "" {
			return cleanNodeID(nodeID)
		}
	}
	if nodeID := r.Header.Get("X-Codex-Web-Node-ID"); strings.TrimSpace(nodeID) != "" {
		return cleanNodeID(nodeID)
	}
	return cleanNodeID(r.URL.Query().Get("nodeId"))
}

func sessionEventsFromResult(value any) []any {
	result, _ := value.(map[string]any)
	events, _ := result["events"].([]any)
	return events
}

func writeSSE(w http.ResponseWriter, value any) {
	data, _ := json.Marshal(value)
	_, _ = fmt.Fprintf(w, "data: %s\n\n", data)
}

func encodeParams(value any) map[string]any {
	data, _ := json.Marshal(value)
	var out map[string]any
	_ = json.Unmarshal(data, &out)
	return out
}

func requestContext(r *http.Request) context.Context {
	if r == nil {
		return context.Background()
	}
	return r.Context()
}
