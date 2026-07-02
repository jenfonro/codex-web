package server

import (
	"net/http"
	"strings"

	"codex-web/backend/internal/model"
	"codex-web/backend/internal/node"
	"github.com/gorilla/websocket"
)

var agentUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func (a *App) handleAgentConnect(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	if !a.isAuthorizedAgent(r) {
		writeError(w, http.StatusUnauthorized, "invalid agent token")
		return
	}
	conn, err := agentUpgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	var first model.AgentEnvelope
	if err := conn.ReadJSON(&first); err != nil {
		_ = conn.Close()
		return
	}
	if first.Type != "agent.hello" || first.Hello == nil || strings.TrimSpace(first.Hello.NodeID) == "" {
		_ = conn.Close()
		return
	}
	info := model.NodeInfo{
		ID:        cleanNodeID(first.Hello.NodeID),
		Name:      strings.TrimSpace(first.Hello.Name),
		Kind:      "remote",
		Online:    true,
		RootDir:   strings.TrimSpace(first.Hello.RootDir),
		CodexHome: strings.TrimSpace(first.Hello.CodexHome),
		Hostname:  strings.TrimSpace(first.Hello.Hostname),
		Version:   strings.TrimSpace(first.Hello.Version),
	}
	if info.Name == "" {
		info.Name = info.ID
	}
	remote := node.NewRemote(info, conn, a.nodes)
	if err := a.nodes.UpsertRemote(remote); err != nil {
		_ = conn.Close()
		return
	}
	remote.Serve()
}

func (a *App) isAuthorizedAgent(r *http.Request) bool {
	token := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
	if token == "" {
		token = strings.TrimSpace(r.URL.Query().Get("token"))
	}
	return token != "" && token == a.cfg.AgentToken
}
