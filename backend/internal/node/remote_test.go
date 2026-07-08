package node

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"codex-web/backend/internal/model"
	"github.com/gorilla/websocket"
)

func TestRemoteRequestResponse(t *testing.T) {
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	var serverConn *websocket.Conn
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("Upgrade() error = %v", err)
			return
		}
		serverConn = conn
	}))
	defer server.Close()

	wsURL := "ws" + server.URL[len("http"):]
	clientConn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Dial() error = %v", err)
	}
	defer clientConn.Close()
	remote := NewRemote(model.NodeInfo{ID: "server-a", Name: "A"}, clientConn, nil)
	go remote.Serve()

	done := make(chan struct{})
	go func() {
		defer close(done)
		var req model.AgentEnvelope
		if err := serverConn.ReadJSON(&req); err != nil {
			t.Errorf("ReadJSON() error = %v", err)
			return
		}
		if req.Type != "controller.request" || req.Op != "session.list" {
			t.Errorf("unexpected request: %#v", req)
		}
		_ = serverConn.WriteJSON(model.AgentEnvelope{
			Type:      "agent.response",
			RequestID: req.RequestID,
			Result:    map[string]any{"sessions": []any{}},
		})
	}()

	result, err := remote.Request(context.Background(), "session.list", nil)
	if err != nil {
		t.Fatalf("Request() error = %v", err)
	}
	body, _ := result.(map[string]any)
	if _, ok := body["sessions"]; !ok {
		t.Fatalf("response = %#v", result)
	}
	<-done
}

func TestRemoteEventAndDisconnectMarksOffline(t *testing.T) {
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	var serverConn *websocket.Conn
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("Upgrade() error = %v", err)
			return
		}
		serverConn = conn
	}))
	defer server.Close()

	wsURL := "ws" + server.URL[len("http"):]
	clientConn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("Dial() error = %v", err)
	}
	registry := NewRegistry(filepath.Join(t.TempDir(), "nodes.json"))
	remote := NewRemote(model.NodeInfo{ID: "server-a", Name: "A"}, clientConn, registry)
	if err := registry.UpsertRemote(remote); err != nil {
		t.Fatalf("UpsertRemote() error = %v", err)
	}
	go remote.Serve()

	events, unsubscribe := remote.Subscribe()
	defer unsubscribe()
	if err := serverConn.WriteJSON(model.AgentEnvelope{
		Type:  "agent.event",
		Event: &model.AgentEvent{Method: "session.event", Params: map[string]any{"sessionId": "session-1", "seq": float64(1)}},
	}); err != nil {
		t.Fatalf("event WriteJSON() error = %v", err)
	}
	select {
	case event := <-events:
		if event.Method != "session.event" || event.Params["sessionId"] != "session-1" {
			t.Fatalf("event = %#v", event)
		}
	case <-time.After(time.Second):
		t.Fatalf("timed out waiting for event")
	}

	_ = serverConn.Close()
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		if registry.Client("server-a") == nil {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("remote did not mark offline")
}
