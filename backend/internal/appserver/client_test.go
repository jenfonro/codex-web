package appserver

import (
	"bytes"
	"encoding/json"
	"io"
	"strings"
	"testing"
	"time"
)

func TestClientHandleLineDeliversResponse(t *testing.T) {
	client := New(Config{})
	ch := make(chan rpcResult, 1)
	client.pending["req-1"] = ch

	client.handleLine([]byte(`{"id":"req-1","result":{"ok":true}}`))

	select {
	case result := <-ch:
		if result.err != nil {
			t.Fatalf("response error = %v", result.err)
		}
		var body map[string]bool
		if err := json.Unmarshal(result.result, &body); err != nil {
			t.Fatalf("decode response: %v", err)
		}
		if !body["ok"] {
			t.Fatalf("response body = %#v, want ok=true", body)
		}
	case <-time.After(time.Second):
		t.Fatalf("response was not delivered")
	}
}

func TestClientHandleLinePublishesNotification(t *testing.T) {
	client := New(Config{})
	events, unsubscribe := client.Subscribe()
	defer unsubscribe()

	client.handleLine([]byte(`{"method":"thread/status/changed","params":{"threadId":"thread-1"}}`))

	select {
	case event := <-events:
		if event.Method != "thread/status/changed" || event.Params["threadId"] != "thread-1" {
			t.Fatalf("notification = %#v", event)
		}
	case <-time.After(time.Second):
		t.Fatalf("notification was not published")
	}
}

func TestClientHandleLineAutoRepliesToServerRequest(t *testing.T) {
	client := New(Config{})
	stdin := &captureWriteCloser{}
	client.stdin = stdin
	events, unsubscribe := client.Subscribe()
	defer unsubscribe()

	client.handleLine([]byte(`{"id":"server-1","method":"item/commandExecution/requestApproval","params":{"threadId":"thread-1","command":"git status"}}`))

	select {
	case event := <-events:
		if !event.IsRequest || event.RequestID != "server-1" || event.Method != "item/commandExecution/requestApproval" {
			t.Fatalf("request notification = %#v", event)
		}
	case <-time.After(time.Second):
		t.Fatalf("server request notification was not published")
	}

	written := stdin.String()
	if !strings.Contains(written, `"id":"server-1"`) || !strings.Contains(written, `"decision":"decline"`) {
		t.Fatalf("auto reply = %q", written)
	}
}

func TestClientHandleLineRejectsUnsupportedServerRequest(t *testing.T) {
	client := New(Config{})
	stdin := &captureWriteCloser{}
	client.stdin = stdin

	client.handleLine([]byte(`{"id":"server-2","method":"unknown/request","params":{"threadId":"thread-1"}}`))

	written := stdin.String()
	if !strings.Contains(written, `"id":"server-2"`) || !strings.Contains(written, `"unsupported server request: unknown/request"`) {
		t.Fatalf("reject reply = %q", written)
	}
}

type captureWriteCloser struct {
	bytes.Buffer
}

func (c *captureWriteCloser) Close() error {
	return nil
}

var _ io.WriteCloser = (*captureWriteCloser)(nil)
