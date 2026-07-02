package server

import (
	"net/http"
	"strings"
)

type setActiveNodeRequest struct {
	NodeID string `json:"nodeId"`
}

func (a *App) handleNodes(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, map[string]any{"nodes": a.nodes.List()})
	default:
		methodNotAllowed(w)
	}
}

func (a *App) handleActiveNode(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req setActiveNodeRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	nodeID := cleanNodeID(req.NodeID)
	if nodeID == "" {
		writeError(w, http.StatusBadRequest, "nodeId is required")
		return
	}
	if client := a.nodes.Client(nodeID); client == nil || !client.Online() {
		writeError(w, http.StatusNotFound, "node is not online")
		return
	}
	writeJSON(w, map[string]any{"ok": true, "nodeId": nodeID})
}

func (a *App) handleNodeItem(w http.ResponseWriter, r *http.Request, id string) {
	nodeID := cleanNodeID(id)
	if nodeID == "" {
		writeError(w, http.StatusBadRequest, "node id is required")
		return
	}
	switch r.Method {
	case http.MethodDelete:
		if err := a.nodes.DeleteOffline(nodeID); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, map[string]bool{"ok": true})
	default:
		methodNotAllowed(w)
	}
}

func cleanNodeID(value string) string {
	return strings.TrimSpace(strings.Trim(value, "/"))
}
