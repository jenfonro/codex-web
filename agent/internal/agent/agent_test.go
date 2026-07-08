package agent

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"codex-web/agent/internal/config"
	"codex-web/agent/internal/model"
	"codex-web/agent/internal/session"
	"github.com/gorilla/websocket"
)

func TestHandleRequestWritesResponseToOwningConnection(t *testing.T) {
	firstAgent, firstController, cleanupFirst := websocketPair(t)
	defer cleanupFirst()
	_, secondController, cleanupSecond := websocketPair(t)
	defer cleanupSecond()

	agent := &Agent{cfg: config.Agent{ID: "server-a"}}
	done := make(chan struct{})
	go func() {
		defer close(done)
		agent.handleRequest(context.Background(), firstAgent, model.AgentEnvelope{
			Type:      "controller.request",
			RequestID: "old-request",
			NodeID:    "server-a",
			Op:        "unknown.op",
		})
	}()

	var response model.AgentEnvelope
	if err := firstController.SetReadDeadline(time.Now().Add(time.Second)); err != nil {
		t.Fatalf("SetReadDeadline(first) error = %v", err)
	}
	if err := firstController.ReadJSON(&response); err != nil {
		t.Fatalf("ReadJSON(first) error = %v", err)
	}
	if response.Type != "agent.response" || response.RequestID != "old-request" {
		t.Fatalf("response = %#v", response)
	}
	if response.NodeID != "server-a" {
		t.Fatalf("response NodeID = %q, want server-a", response.NodeID)
	}
	if response.Error != "unknown agent operation: unknown.op" {
		t.Fatalf("response Error = %q", response.Error)
	}

	var unexpected model.AgentEnvelope
	if err := secondController.SetReadDeadline(time.Now().Add(150 * time.Millisecond)); err != nil {
		t.Fatalf("SetReadDeadline(second) error = %v", err)
	}
	err := secondController.ReadJSON(&unexpected)
	if err == nil {
		t.Fatalf("second connection received stale response: %#v", unexpected)
	}
	var netErr net.Error
	if !errors.As(err, &netErr) || !netErr.Timeout() {
		t.Fatalf("ReadJSON(second) error = %v, want timeout", err)
	}

	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatalf("handleRequest did not return")
	}
}

func TestForwardEventsReturnsWriteError(t *testing.T) {
	agentConn, controllerConn, cleanup := websocketPair(t)
	defer cleanup()

	root := t.TempDir()
	agent := &Agent{
		cfg: config.Agent{ID: "server-a"},
		sessions: session.New(session.Config{
			CodexBin:  root + "/missing-codex",
			CodexHome: t.TempDir(),
			RootDir:   root,
		}),
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	result := make(chan error, 1)
	go func() {
		result <- agent.forwardEvents(ctx, agentConn)
	}()
	time.Sleep(50 * time.Millisecond)

	_ = controllerConn.Close()
	_ = agentConn.Close()
	if _, err := agent.sessions.Create(context.Background(), model.SessionCreateRequest{Prompt: "hello", CWD: root}); err != nil {
		t.Fatalf("Create() error = %v", err)
	}

	select {
	case err := <-result:
		if err == nil {
			t.Fatalf("forwardEvents() error = nil, want websocket write error")
		}
	case <-time.After(time.Second):
		t.Fatalf("forwardEvents() did not return after write failure")
	}
}

func websocketPair(t *testing.T) (*websocket.Conn, *websocket.Conn, func()) {
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
	agentConn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		server.Close()
		t.Fatalf("Dial() error = %v", err)
	}
	var controllerConn *websocket.Conn
	select {
	case controllerConn = <-serverConnCh:
	case <-time.After(time.Second):
		_ = agentConn.Close()
		server.Close()
		t.Fatalf("timed out waiting for server websocket")
	}

	cleanup := func() {
		_ = agentConn.Close()
		_ = controllerConn.Close()
		server.Close()
	}
	return agentConn, controllerConn, cleanup
}
