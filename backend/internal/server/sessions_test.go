package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"codex-web/backend/internal/model"
	"codex-web/backend/internal/node"
)

func TestRequestNodeIDPriority(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/sessions?nodeId=query-node", nil)
	req.Header.Set("X-Codex-Web-Node-ID", "header-node")
	if got := requestNodeID(req, map[string]any{"nodeId": "body-node"}); got != "body-node" {
		t.Fatalf("requestNodeID() = %q, want body-node", got)
	}
	if got := requestNodeID(req, nil); got != "header-node" {
		t.Fatalf("requestNodeID() = %q, want header-node", got)
	}
	req.Header.Del("X-Codex-Web-Node-ID")
	if got := requestNodeID(req, nil); got != "query-node" {
		t.Fatalf("requestNodeID() = %q, want query-node", got)
	}
}

func TestNodeClientUnknownAndOffline(t *testing.T) {
	app := &App{nodes: node.NewRegistry(t.TempDir() + "/nodes.json")}
	if _, err := app.nodeClient("missing"); err == nil {
		t.Fatalf("nodeClient() error = nil, want missing node error")
	}
	client := &serverFakeClient{info: model.NodeInfo{ID: "server-a", Name: "Server A", Online: true}}
	if err := app.nodes.UpsertRemote(client); err != nil {
		t.Fatalf("UpsertRemote() error = %v", err)
	}
	if err := app.nodes.MarkOffline("server-a", client); err != nil {
		t.Fatalf("MarkOffline() error = %v", err)
	}
	if _, err := app.nodeClient("server-a"); err == nil || err.Error() != `node "server-a" is offline` {
		t.Fatalf("nodeClient() error = %v, want offline error", err)
	}
}

func TestHandleSessionsCreateRoutesToNode(t *testing.T) {
	app := &App{nodes: node.NewRegistry(t.TempDir() + "/nodes.json")}
	client := &serverFakeClient{
		info:   model.NodeInfo{ID: "server-a", Name: "Server A", Online: true},
		result: map[string]any{"session": map[string]any{"id": "session-1"}},
	}
	if err := app.nodes.UpsertRemote(client); err != nil {
		t.Fatalf("UpsertRemote() error = %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/sessions", strings.NewReader(`{"nodeId":"server-a","prompt":"hello"}`))
	w := httptest.NewRecorder()
	app.handleSessions(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	if client.op != "session.create" || client.params["prompt"] != "hello" {
		t.Fatalf("request = %s %#v", client.op, client.params)
	}
}

func TestHandleSessionSendRoutesToNode(t *testing.T) {
	app := &App{nodes: node.NewRegistry(t.TempDir() + "/nodes.json")}
	client := &serverFakeClient{
		info:   model.NodeInfo{ID: "server-a", Name: "Server A", Online: true},
		result: map[string]any{"session": map[string]any{"id": "session-1"}},
	}
	if err := app.nodes.UpsertRemote(client); err != nil {
		t.Fatalf("UpsertRemote() error = %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/sessions/session-1/send", strings.NewReader(`{"nodeId":"server-a","prompt":"next"}`))
	w := httptest.NewRecorder()
	app.handleSessionItem(w, req, "session-1/send")
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	if client.op != "session.send" || client.params["sessionId"] != "session-1" || client.params["prompt"] != "next" {
		t.Fatalf("request = %s %#v", client.op, client.params)
	}
}

func TestWriteSessionBacklogPassesPaging(t *testing.T) {
	app := &App{nodes: node.NewRegistry(t.TempDir() + "/nodes.json")}
	client := &serverFakeClient{
		info:   model.NodeInfo{ID: "server-a", Name: "Server A", Online: true},
		result: map[string]any{"events": []any{}, "hasMoreBefore": false},
	}
	if err := app.nodes.UpsertRemote(client); err != nil {
		t.Fatalf("UpsertRemote() error = %v", err)
	}
	req := httptest.NewRequest(http.MethodGet, "/api/sessions/session-1/events?nodeId=server-a&beforeSeq=42&limit=800&compact=true&fileDetails=true", nil)
	w := httptest.NewRecorder()
	app.handleSessionItem(w, req, "session-1/events")
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	if client.op != "session.events" || client.params["sessionId"] != "session-1" {
		t.Fatalf("request = %s %#v", client.op, client.params)
	}
	if client.params["beforeSeq"] != int64(42) || client.params["limit"] != 800 || client.params["compact"] != true || client.params["fileDetails"] != true {
		t.Fatalf("paging params = %#v", client.params)
	}
}

func TestHandleSessionEventsAllowsNodeLevelStream(t *testing.T) {
	app := &App{nodes: node.NewRegistry(t.TempDir() + "/nodes.json")}
	client := &serverFakeClient{info: model.NodeInfo{ID: "server-a", Name: "Server A", Online: true}}
	if err := app.nodes.UpsertRemote(client); err != nil {
		t.Fatalf("UpsertRemote() error = %v", err)
	}
	req := httptest.NewRequest(http.MethodGet, "/api/sessions/events?nodeId=server-a", nil)
	w := httptest.NewRecorder()
	app.handleSessionEvents(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	if got := w.Header().Get("Content-Type"); got != "text/event-stream; charset=utf-8" {
		t.Fatalf("Content-Type = %q", got)
	}
	if got := w.Header().Get("X-Accel-Buffering"); got != "no" {
		t.Fatalf("X-Accel-Buffering = %q, want no", got)
	}
	if client.op != "" {
		t.Fatalf("op = %q, want no backlog request", client.op)
	}
}

func TestHandleSessionEventsSubscribesBeforeBacklog(t *testing.T) {
	app := &App{nodes: node.NewRegistry(t.TempDir() + "/nodes.json")}
	eventCh := make(chan node.Event, 1)
	client := &serverFakeClient{
		info: model.NodeInfo{ID: "server-a", Name: "Server A", Online: true},
		result: map[string]any{"events": []any{
			map[string]any{"sessionId": "session-1", "seq": float64(1), "kind": "user_message", "text": "backlog"},
		}},
		events: eventCh,
	}
	client.onRequest = func(f *serverFakeClient) {
		eventCh <- node.Event{
			Method: "session.event",
			Params: map[string]any{"sessionId": "session-1", "seq": float64(2), "kind": "assistant_message", "text": "live"},
		}
		close(eventCh)
	}
	if err := app.nodes.UpsertRemote(client); err != nil {
		t.Fatalf("UpsertRemote() error = %v", err)
	}
	req := httptest.NewRequest(http.MethodGet, "/api/sessions/events?nodeId=server-a&sessionId=session-1", nil)
	w := httptest.NewRecorder()
	app.handleSessionEvents(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	if !client.requestSawSubscription {
		t.Fatalf("session backlog was requested before live subscription was established")
	}
	body := w.Body.String()
	if !strings.Contains(body, "backlog") || !strings.Contains(body, "live") {
		t.Fatalf("SSE body = %q, want backlog and live events", body)
	}
}

type serverFakeClient struct {
	info                   model.NodeInfo
	op                     string
	params                 map[string]any
	result                 any
	events                 chan node.Event
	subscribed             bool
	requestSawSubscription bool
	onRequest              func(*serverFakeClient)
}

func (f *serverFakeClient) Info() model.NodeInfo { return f.info }
func (f *serverFakeClient) Online() bool         { return f.info.Online }
func (f *serverFakeClient) Request(_ context.Context, op string, params map[string]any) (any, error) {
	f.op = op
	f.params = params
	f.requestSawSubscription = f.subscribed
	if f.onRequest != nil {
		f.onRequest(f)
	}
	if f.result != nil {
		return f.result, nil
	}
	return map[string]any{}, nil
}
func (f *serverFakeClient) Subscribe() (<-chan node.Event, func()) {
	f.subscribed = true
	if f.events != nil {
		return f.events, func() {}
	}
	ch := make(chan node.Event)
	close(ch)
	return ch, func() {}
}
func (f *serverFakeClient) Close() error { return nil }

func decodeBody(t *testing.T, w *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("Unmarshal() error = %v", err)
	}
	return body
}
