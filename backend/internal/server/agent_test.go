package server

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"codex-web/backend/internal/model"
	"codex-web/backend/internal/node"
	"github.com/gorilla/websocket"
)

func TestAgentConnectHelloHeartbeatEventAndDisconnect(t *testing.T) {
	app := &App{
		cfg:   appConfig{AgentToken: "secret"},
		nodes: node.NewRegistry(filepath.Join(t.TempDir(), "nodes.json")),
	}
	server := httptest.NewServer(http.HandlerFunc(app.handleAgentConnect))
	defer server.Close()

	wsURL := "ws" + server.URL[len("http"):]
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, http.Header{"Authorization": []string{"Bearer secret"}})
	if err != nil {
		t.Fatalf("Dial() error = %v", err)
	}

	if err := conn.WriteJSON(model.AgentEnvelope{
		Type:   "agent.hello",
		NodeID: "server-a",
		Hello: &model.AgentHello{
			NodeID:    "server-a",
			Name:      "Server A",
			Hostname:  "host-a",
			RootDir:   "/srv",
			CodexHome: "/srv/.codex",
		},
	}); err != nil {
		t.Fatalf("hello WriteJSON() error = %v", err)
	}

	remote := waitForClient(t, app, "server-a")
	info := remote.Info()
	if info.Name != "Server A" || !info.Online {
		t.Fatalf("registered info = %#v", info)
	}

	before := app.nodes.List()[0].LastSeen
	time.Sleep(time.Millisecond)
	if err := conn.WriteJSON(model.AgentEnvelope{Type: "agent.heartbeat", NodeID: "server-a"}); err != nil {
		t.Fatalf("heartbeat WriteJSON() error = %v", err)
	}
	waitFor(t, func() bool {
		nodes := app.nodes.List()
		return len(nodes) == 1 && nodes[0].LastSeen.After(before)
	})

	events, unsubscribe := remote.Subscribe()
	defer unsubscribe()
	if err := conn.WriteJSON(model.AgentEnvelope{
		Type:   "agent.event",
		NodeID: "server-a",
		Event:  &model.AgentEvent{Method: "thread/updated", Params: map[string]any{"id": "thread-1"}},
	}); err != nil {
		t.Fatalf("event WriteJSON() error = %v", err)
	}
	select {
	case event := <-events:
		if event.Method != "thread/updated" || event.Params["id"] != "thread-1" {
			t.Fatalf("event = %#v", event)
		}
	case <-time.After(time.Second):
		t.Fatalf("timed out waiting for agent event")
	}

	_ = conn.Close()
	waitFor(t, func() bool {
		return app.nodes.Client("server-a") == nil
	})
	nodes := app.nodes.List()
	if len(nodes) != 1 || nodes[0].Online {
		t.Fatalf("nodes after disconnect = %#v", nodes)
	}
}

func TestAgentConnectRejectsBadToken(t *testing.T) {
	app := &App{
		cfg:   appConfig{AgentToken: "secret"},
		nodes: node.NewRegistry(filepath.Join(t.TempDir(), "nodes.json")),
	}
	req := httptest.NewRequest(http.MethodGet, "/api/agent/connect", nil)
	req.Header.Set("Authorization", "Bearer wrong")
	w := httptest.NewRecorder()
	app.handleAgentConnect(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", w.Code)
	}
}

func waitForClient(t *testing.T, app *App, id string) node.Client {
	t.Helper()
	var client node.Client
	waitFor(t, func() bool {
		client = app.nodes.Client(id)
		return client != nil
	})
	return client
}

func waitFor(t *testing.T, fn func() bool) {
	t.Helper()
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		if fn() {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("condition was not met before timeout")
}
