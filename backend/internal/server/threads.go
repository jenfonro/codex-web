package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"codex-web/backend/internal/thread"
)

type promptRequest struct {
	Prompt string `json:"prompt"`
}

type createThreadResponse struct {
	ThreadID string `json:"threadId"`
}

func (a *App) handleThreads(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, a.threads.List())
	case http.MethodPost:
		var req promptRequest
		readJSON(r, &req)
		threadID, err := a.threads.Create(r.Context(), req.Prompt)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, createThreadResponse{ThreadID: threadID})
	default:
		methodNotAllowed(w)
	}
}

func (a *App) handleThreadAction(w http.ResponseWriter, r *http.Request, tail string) {
	parts := strings.Split(strings.Trim(tail, "/"), "/")
	threadID := parts[0]
	action := parts[1]
	switch {
	case r.Method == http.MethodGet && action == "turns":
		page, err := a.threads.Turns(threadID, r.URL.Query().Get("beforeTurnId"))
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, page)
	case r.Method == http.MethodPost && action == "send":
		var req promptRequest
		readJSON(r, &req)
		if err := a.threads.Send(r.Context(), threadID, req.Prompt); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		w.WriteHeader(http.StatusNoContent)
	case r.Method == http.MethodPost && action == "cancel":
		if err := a.threads.Cancel(threadID); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		writeError(w, http.StatusNotFound, "not found")
	}
}

func (a *App) handleThreadStateEvents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	flusher := w.(http.Flusher)
	updates, unsubscribe := a.threads.Subscribe()
	defer unsubscribe()

	threadID := r.URL.Query().Get("threadId")
	var lastSequence int64
	w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	if threadID != "" {
		current, sequence, err := a.threads.State(threadID)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}

		writeSSE(w, thread.StateSnapshotUpdate(threadID, current, sequence))
		lastSequence = sequence
	}
	flusher.Flush()

	for {
		select {
		case <-r.Context().Done():
			return
		case update, ok := <-updates:
			if !ok {
				return
			}
			if threadID == "" {
				if update.Type != "threadStarted" && update.Type != "threadUpdated" {
					continue
				}
			} else {
				if update.ThreadID != threadID || update.Sequence <= lastSequence {
					continue
				}
				if update.Type == "threadStarted" || update.Type == "threadUpdated" {
					continue
				}
			}
			writeSSE(w, update)
			flusher.Flush()
		}
	}
}

func writeSSE(w http.ResponseWriter, value any) {
	data, err := json.Marshal(value)
	if err != nil {
		panic(err)
	}
	if _, err := fmt.Fprintf(w, "data: %s\n\n", data); err != nil {
		panic(err)
	}
}
