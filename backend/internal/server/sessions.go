package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"codex-web/backend/internal/host"
	"codex-web/backend/internal/model"
)

type sessionCreateHTTP struct {
	Prompt string `json:"prompt"`
	CWD    string `json:"cwd,omitempty"`
}

type sessionSendHTTP struct {
	Prompt string `json:"prompt"`
}

type workspaceRequest struct {
	Endpoint string         `json:"endpoint"`
	Params   map[string]any `json:"params,omitempty"`
}

type gitRequest struct {
	Method string         `json:"method"`
	Params map[string]any `json:"params,omitempty"`
}

func (a *App) handleSessions(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		sessions, err := a.sessions.List(r.Context())
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, map[string]any{"sessions": sessions})
	case http.MethodPost:
		var req sessionCreateHTTP
		if err := readJSON(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		record, err := a.sessions.Create(r.Context(), model.SessionCreateRequest{
			Prompt: req.Prompt,
			CWD:    req.CWD,
		})
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, map[string]any{"session": record})
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
		record, err := a.sessions.Send(r.Context(), model.SessionSendRequest{
			SessionID: sessionID,
			Prompt:    req.Prompt,
		})
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, map[string]any{"session": record})
	case r.Method == http.MethodPost && action == "cancel":
		if err := a.sessions.Cancel(sessionID); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, map[string]bool{"ok": true})
	case r.Method == http.MethodGet && action == "state":
		state, err := a.sessions.State(sessionID)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, state)
	case r.Method == http.MethodGet && action == "events":
		a.writeSessionBacklog(w, r, sessionID)
	default:
		writeError(w, http.StatusNotFound, "not found")
	}
}

func (a *App) writeSessionBacklog(w http.ResponseWriter, r *http.Request, sessionID string) {
	lastSeq, beforeSeq, limit := sessionEventQuery(r)
	page, err := a.sessions.Events(model.SessionEventsRequest{
		SessionID: sessionID,
		LastSeq:   lastSeq,
		BeforeSeq: beforeSeq,
		Limit:     limit,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, page)
}

func (a *App) handleSessionEvents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "streaming is not supported")
		return
	}

	sessionID := strings.TrimSpace(r.URL.Query().Get("sessionId"))
	lastSeq, beforeSeq, limit := sessionEventQuery(r)

	w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	if sessionID != "" {
		page, err := a.sessions.Events(model.SessionEventsRequest{
			SessionID: sessionID,
			LastSeq:   lastSeq,
			BeforeSeq: beforeSeq,
			Limit:     limit,
		})
		if err != nil {
			writeSSE(w, map[string]any{"kind": "error", "text": err.Error(), "sessionId": sessionID})
			flusher.Flush()
			return
		}
		for _, event := range page.Events {
			writeSSE(w, event)
		}
	}
	flusher.Flush()

	updates, unsubscribe := a.sessions.Subscribe()
	defer unsubscribe()
	currentLastSeq := lastSeq
	for {
		select {
		case <-r.Context().Done():
			return
		case update, ok := <-updates:
			if !ok {
				return
			}
			if sessionID != "" && update.SessionID != sessionID {
				continue
			}
			page, err := a.sessions.Events(model.SessionEventsRequest{
				SessionID: update.SessionID,
				LastSeq:   currentLastSeq,
			})
			if err != nil {
				continue
			}
			for _, event := range page.Events {
				writeSSE(w, event)
				if event.Seq > currentLastSeq {
					currentLastSeq = event.Seq
				}
			}
			flusher.Flush()
		}
	}
}

func (a *App) handleSessionStateEvents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "streaming is not supported")
		return
	}

	sessionID := strings.TrimSpace(r.URL.Query().Get("sessionId"))
	lastSeq, _ := strconv.ParseInt(r.URL.Query().Get("lastSeq"), 10, 64)

	w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	if sessionID != "" {
		state, err := a.sessions.State(sessionID)
		if err != nil {
			writeSSE(w, map[string]any{"type": "error", "error": err.Error(), "sessionId": sessionID})
			flusher.Flush()
			return
		}
		if state.LastSeq > lastSeq {
			writeSSE(w, map[string]any{
				"type":      "state",
				"sessionId": sessionID,
				"seq":       state.LastSeq,
				"time":      state.Session.UpdatedAt,
				"state":     state,
			})
		}
	}
	flusher.Flush()

	updates, unsubscribe := a.sessions.Subscribe()
	defer unsubscribe()
	for {
		select {
		case <-r.Context().Done():
			return
		case update, ok := <-updates:
			if !ok {
				return
			}
			if update.Seq <= lastSeq {
				continue
			}
			if sessionID != "" && update.SessionID != sessionID {
				continue
			}
			writeSSE(w, update)
			flusher.Flush()
		}
	}
}

func sessionEventQuery(r *http.Request) (int64, int64, int) {
	lastSeq, _ := strconv.ParseInt(r.URL.Query().Get("lastSeq"), 10, 64)
	beforeSeq, _ := strconv.ParseInt(r.URL.Query().Get("beforeSeq"), 10, 64)
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 0 {
		limit = 0
	}
	if limit > 2000 {
		limit = 2000
	}
	return lastSeq, beforeSeq, limit
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
	params := req.Params
	if params == nil {
		params = map[string]any{}
	}
	params["endpoint"] = req.Endpoint
	result, handled, err := a.hostsvc.Fetch(r.Context(), req.Endpoint, params)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if !handled {
		writeJSON(w, map[string]any{})
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
	params := req.Params
	if params == nil {
		params = map[string]any{}
	}
	params["method"] = req.Method
	result, err := a.hostsvc.GitWorker(r.Context(), host.StrAny(params["method"]), params)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, result)
}

func writeSSE(w http.ResponseWriter, value any) {
	data, _ := json.Marshal(value)
	_, _ = fmt.Fprintf(w, "data: %s\n\n", data)
}
