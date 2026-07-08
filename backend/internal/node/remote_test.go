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
	clientConn, serverConn, cleanup := remoteWebsocketPair(t)
	defer cleanup()
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

func TestRemoteDisconnectResolvesPendingRequest(t *testing.T) {
	clientConn, serverConn, cleanup := remoteWebsocketPair(t)
	defer cleanup()
	remote := NewRemote(model.NodeInfo{ID: "server-a", Name: "A"}, clientConn, nil)
	go remote.Serve()

	result := make(chan error, 1)
	go func() {
		_, err := remote.Request(context.Background(), "session.list", nil)
		result <- err
	}()

	var req model.AgentEnvelope
	if err := serverConn.ReadJSON(&req); err != nil {
		t.Fatalf("ReadJSON() error = %v", err)
	}
	if req.Type != "controller.request" || req.Op != "session.list" {
		t.Fatalf("unexpected request: %#v", req)
	}
	_ = serverConn.Close()

	select {
	case err := <-result:
		if err == nil || err.Error() != "agent disconnected" {
			t.Fatalf("Request() error = %v, want agent disconnected", err)
		}
	case <-time.After(time.Second):
		t.Fatalf("pending request did not resolve after disconnect")
	}
}

func TestRemoteRequestAfterCloseReturnsOffline(t *testing.T) {
	clientConn, _, cleanup := remoteWebsocketPair(t)
	defer cleanup()
	remote := NewRemote(model.NodeInfo{ID: "server-a", Name: "A"}, clientConn, nil)
	if err := remote.Close(); err != nil {
		t.Fatalf("Close() error = %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	_, err := remote.Request(ctx, "session.list", nil)
	if err == nil || err.Error() != "node is offline" {
		t.Fatalf("Request() error = %v, want node is offline", err)
	}
}

func TestRemoteWriteFailureMarksOfflineAndClosesSubscribers(t *testing.T) {
	clientConn, _, cleanup := remoteWebsocketPair(t)
	defer cleanup()
	registry := NewRegistry(filepath.Join(t.TempDir(), "nodes.json"))
	remote := NewRemote(model.NodeInfo{ID: "server-a", Name: "A"}, clientConn, registry)
	if err := registry.UpsertRemote(remote); err != nil {
		t.Fatalf("UpsertRemote() error = %v", err)
	}
	events, unsubscribe := remote.Subscribe()
	defer unsubscribe()

	_ = clientConn.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 250*time.Millisecond)
	defer cancel()
	if _, err := remote.Request(ctx, "session.list", nil); err == nil {
		t.Fatalf("Request() error = nil, want write failure")
	}
	if remote.Online() {
		t.Fatalf("remote Online() = true after write failure")
	}
	if got := registry.Client("server-a"); got != nil {
		t.Fatalf("registry client = %#v after write failure, want nil", got)
	}
	select {
	case _, ok := <-events:
		if ok {
			t.Fatalf("event subscription remained open after write failure")
		}
	case <-time.After(time.Second):
		t.Fatalf("event subscription did not close after write failure")
	}
}

func TestRemoteSubscribeAfterCloseReturnsClosedChannel(t *testing.T) {
	clientConn, _, cleanup := remoteWebsocketPair(t)
	defer cleanup()
	remote := NewRemote(model.NodeInfo{ID: "server-a", Name: "A"}, clientConn, nil)
	if err := remote.Close(); err != nil {
		t.Fatalf("Close() error = %v", err)
	}

	events, unsubscribe := remote.Subscribe()
	defer unsubscribe()
	select {
	case _, ok := <-events:
		if ok {
			t.Fatalf("Subscribe() after Close returned an open event channel")
		}
	case <-time.After(time.Second):
		t.Fatalf("Subscribe() after Close did not return a closed channel")
	}
}

func TestRemoteEventAndDisconnectMarksOffline(t *testing.T) {
	clientConn, serverConn, cleanup := remoteWebsocketPair(t)
	defer cleanup()
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
			select {
			case _, ok := <-events:
				if ok {
					t.Fatalf("event subscription remained open after remote disconnect")
				}
				return
			case <-time.After(time.Second):
				t.Fatalf("event subscription did not close after remote disconnect")
			}
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("remote did not mark offline")
}

func TestRemoteHeartbeatTimeoutMarksOffline(t *testing.T) {
	oldTimeout := remoteHeartbeatTimeout
	remoteHeartbeatTimeout = 50 * time.Millisecond
	defer func() { remoteHeartbeatTimeout = oldTimeout }()

	clientConn, _, cleanup := remoteWebsocketPair(t)
	defer cleanup()
	registry := NewRegistry(filepath.Join(t.TempDir(), "nodes.json"))
	remote := NewRemote(model.NodeInfo{ID: "server-a", Name: "A"}, clientConn, registry)
	if err := registry.UpsertRemote(remote); err != nil {
		t.Fatalf("UpsertRemote() error = %v", err)
	}
	go remote.Serve()

	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		if registry.Client("server-a") == nil {
			if remote.Online() {
				t.Fatalf("remote Online() = true after heartbeat timeout")
			}
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("remote did not mark offline after heartbeat timeout")
}

func remoteWebsocketPair(t *testing.T) (*websocket.Conn, *websocket.Conn, func()) {
	t.Helper()
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	serverConnCh := make(chan *websocket.Conn, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("Upgrade() error = %v", err)
			return
		}
		serverConnCh <- conn
	}))

	wsURL := "ws" + server.URL[len("http"):]
	clientConn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		server.Close()
		t.Fatalf("Dial() error = %v", err)
	}

	select {
	case serverConn := <-serverConnCh:
		return clientConn, serverConn, func() {
			_ = clientConn.Close()
			_ = serverConn.Close()
			server.Close()
		}
	case <-time.After(time.Second):
		_ = clientConn.Close()
		server.Close()
		t.Fatalf("timed out waiting for server websocket")
		return nil, nil, func() {}
	}
}
