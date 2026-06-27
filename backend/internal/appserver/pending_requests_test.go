package appserver

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestPendingRequestMcpElicitationResultMatchesAppServerShape(t *testing.T) {
	pending := &PendingRequest{Method: "mcpServer/elicitation/request"}

	got, err := pending.resultFor(ResolveRequest{
		Action:  "accept",
		Content: map[string]any{"workspace": "/root/my_code"},
		Meta:    map[string]any{"persist": "always"},
	})
	if err != nil {
		t.Fatal(err)
	}

	want := map[string]any{
		"action":  "accept",
		"content": map[string]any{"workspace": "/root/my_code"},
		"_meta":   map[string]any{"persist": "always"},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("mcp accept result = %#v, want %#v", got, want)
	}

	got, err = pending.resultFor(ResolveRequest{Action: "cancel"})
	if err != nil {
		t.Fatal(err)
	}
	want = map[string]any{"action": "cancel", "content": nil, "_meta": nil}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("mcp cancel result = %#v, want %#v", got, want)
	}
}

func TestPendingRequestPermissionsResultIncludesGrantedProfileAndScope(t *testing.T) {
	permissions := map[string]any{
		"network": map[string]any{"enabled": true},
	}
	strictAutoReview := true
	pending := &PendingRequest{
		Method: "item/permissions/requestApproval",
		Params: map[string]any{"permissions": permissions},
	}

	got, err := pending.resultFor(ResolveRequest{Action: "accept", Scope: "session", StrictAutoReview: &strictAutoReview})
	if err != nil {
		t.Fatal(err)
	}

	want := map[string]any{"permissions": permissions, "scope": "session", "strictAutoReview": true}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("permissions result = %#v, want %#v", got, want)
	}
}

func TestPendingRequestRejectsDeprecatedLegacyApprovalMethods(t *testing.T) {
	for _, method := range []string{"applyPatchApproval", "execCommandApproval"} {
		pending := &PendingRequest{Method: method}
		if _, err := pending.resultFor(ResolveRequest{Action: "accept"}); err == nil {
			t.Fatalf("resultFor(%q) returned nil error for deprecated legacy approval method", method)
		}
	}
}

func TestDismissRequestsForThreadOnlyClearsMatchingThread(t *testing.T) {
	client := New(Config{})
	client.requests["first"] = &PendingRequest{ID: "first", ThreadID: "thread-a", TurnID: "turn-1"}
	client.requests["second"] = &PendingRequest{ID: "second", ThreadID: "thread-b", TurnID: "turn-2"}
	client.requests["third"] = &PendingRequest{ID: "third", ThreadID: "thread-a", TurnID: "turn-3"}

	client.DismissRequestsForThread("thread-a")

	got := client.PendingRequests()
	if len(got) != 1 || got[0].ID != "second" {
		t.Fatalf("pending requests after dismiss = %#v, want only second", got)
	}
}

func TestCommandDecisionUsesOfficialPolicyAmendmentShape(t *testing.T) {
	amendment := []any{"npm", "run"}
	got := commandDecision("acceptWithExecpolicyAmendment", map[string]any{
		"proposedExecpolicyAmendment": amendment,
	})

	want := map[string]any{
		"acceptWithExecpolicyAmendment": map[string]any{
			"execpolicy_amendment": amendment,
		},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("command decision = %#v, want %#v", got, want)
	}
}

func TestDynamicToolCallRequestIsForwardedToHostBridge(t *testing.T) {
	client := New(Config{})
	sink := &writeBuffer{}
	client.stdin = sink
	events, unsubscribe := client.Subscribe()
	defer unsubscribe()

	params := map[string]any{
		"threadId":  "thread-1",
		"turnId":    "turn-1",
		"callId":    "call-1",
		"namespace": "browser",
		"tool":      "open",
		"arguments": map[string]any{"url": "https://example.com"},
	}
	raw, err := json.Marshal(params)
	if err != nil {
		t.Fatal(err)
	}
	client.handleServerRequest(rpcMessage{
		ID:     json.RawMessage("1"),
		Method: "item/tool/call",
		Params: raw,
	})

	if response := sink.String(); response != "" {
		t.Fatalf("dynamic tool request wrote directly to app server = %s", response)
	}

	var forwarded bool
	deadline := time.After(time.Second)
	for !forwarded {
		select {
		case event := <-events:
			if event.Method != "appserver/request" {
				continue
			}
			request, _ := event.Params["request"].(map[string]any)
			if request["method"] != "item/tool/call" {
				t.Fatalf("forwarded method = %#v, want item/tool/call", request["method"])
			}
			params, _ := request["params"].(map[string]any)
			if params["tool"] != "open" || params["namespace"] != "browser" {
				t.Fatalf("forwarded params = %#v", params)
			}
			forwarded = true
		case <-deadline:
			t.Fatal("timed out waiting for appserver/request event")
		}
	}
}

func TestLegacyDynamicToolCallFailureShape(t *testing.T) {
	response := dynamicToolText(false, "Codex Web does not provide the dynamic tool: browser.open")
	if response["success"] != false {
		t.Fatalf("dynamic tool response = %#v, want success false", response)
	}
	contentItems, _ := response["contentItems"].([]map[string]any)
	if len(contentItems) != 1 || contentItems[0]["text"] == "" {
		t.Fatalf("dynamic tool content items = %#v", response["contentItems"])
	}
	if !strings.Contains(contentItems[0]["text"].(string), "browser.open") {
		t.Fatalf("dynamic tool text = %#v", contentItems[0]["text"])
	}
}

func TestServerRequestPendingEventIsPublic(t *testing.T) {
	client := New(Config{})
	events, unsubscribe := client.Subscribe()
	defer unsubscribe()

	params := map[string]any{
		"threadId": "thread-1",
		"turnId":   "turn-1",
		"command":  "go test ./...",
	}
	raw, err := json.Marshal(params)
	if err != nil {
		t.Fatal(err)
	}
	client.handleServerRequest(rpcMessage{
		ID:     json.RawMessage("1"),
		Method: "item/commandExecution/requestApproval",
		Params: raw,
	})

	select {
	case event := <-events:
		if event.Method != "serverRequest/pending" {
			t.Fatalf("event method = %q, want serverRequest/pending", event.Method)
		}
		request, _ := event.Params["request"].(map[string]any)
		if request["method"] != "item/commandExecution/requestApproval" || request["command"] != "go test ./..." {
			t.Fatalf("pending request = %#v", request)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for pending request event")
	}
}

func TestListAllThreadTurnsUsesFullAscendingPagination(t *testing.T) {
	client := New(Config{})
	sink := &writeBuffer{writes: make(chan string, 4)}
	client.stdin = sink

	type result struct {
		turns []Turn
		err   error
	}
	done := make(chan result, 1)
	go func() {
		turns, err := client.ListAllThreadTurns(context.Background(), "thread-1")
		done <- result{turns: turns, err: err}
	}()

	first := readRPCRequest(t, sink.writes)
	if first.Method != "thread/turns/list" {
		t.Fatalf("first method = %q, want thread/turns/list", first.Method)
	}
	firstParams := first.Params
	if firstParams["threadId"] != "thread-1" || firstParams["itemsView"] != "full" || firstParams["sortDirection"] != "asc" || firstParams["limit"].(float64) != 100 {
		t.Fatalf("first params = %#v", firstParams)
	}
	if _, ok := firstParams["cursor"]; ok {
		t.Fatalf("first request unexpectedly had cursor: %#v", firstParams)
	}
	client.handleRawMessage([]byte(`{"id":1,"result":{"data":[{"id":"turn-1","status":"completed"}],"nextCursor":"cursor-1"}}`))

	second := readRPCRequest(t, sink.writes)
	secondParams := second.Params
	if secondParams["cursor"] != "cursor-1" {
		t.Fatalf("second params = %#v, want cursor", secondParams)
	}
	client.handleRawMessage([]byte(`{"id":2,"result":{"data":[{"id":"turn-2","status":"completed"}],"nextCursor":null}}`))

	select {
	case got := <-done:
		if got.err != nil {
			t.Fatal(got.err)
		}
		if len(got.turns) != 2 || got.turns[0].ID != "turn-1" || got.turns[1].ID != "turn-2" {
			t.Fatalf("turns = %#v, want paged turns in order", got.turns)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for paged turns")
	}
}

func TestReadThreadWithTurnsDoesNotFallbackToDeprecatedIncludeTurns(t *testing.T) {
	client := New(Config{})
	sink := &writeBuffer{writes: make(chan string, 4)}
	client.stdin = sink

	type result struct {
		thread Thread
		err    error
	}
	done := make(chan result, 1)
	go func() {
		thread, err := client.ReadThreadWithTurns(context.Background(), "thread-1")
		done <- result{thread: thread, err: err}
	}()

	readReq := readRPCRequest(t, sink.writes)
	if readReq.Method != "thread/read" {
		t.Fatalf("first method = %q, want thread/read", readReq.Method)
	}
	if readReq.Params["threadId"] != "thread-1" {
		t.Fatalf("first params = %#v, want threadId", readReq.Params)
	}
	if _, ok := readReq.Params["includeTurns"]; ok {
		t.Fatalf("first params unexpectedly included deprecated turns expansion: %#v", readReq.Params)
	}
	client.handleRawMessage([]byte(`{"id":1,"result":{"thread":{"id":"thread-1","name":"Thread"}}}`))

	turnsReq := readRPCRequest(t, sink.writes)
	if turnsReq.Method != "thread/turns/list" {
		t.Fatalf("second method = %q, want thread/turns/list", turnsReq.Method)
	}
	client.handleRawMessage([]byte(`{"id":2,"error":{"code":-32601,"message":"method not found"}}`))

	select {
	case got := <-done:
		if got.err == nil || !strings.Contains(got.err.Error(), "thread/turns/list") {
			t.Fatalf("ReadThreadWithTurns error = %v, want thread/turns/list error", got.err)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for ReadThreadWithTurns")
	}

	select {
	case raw := <-sink.writes:
		t.Fatalf("unexpected deprecated fallback request after thread/turns/list failure: %s", raw)
	case <-time.After(100 * time.Millisecond):
	}
}

func TestReadConfigRequirementsUsesOfficialNullParamsRequest(t *testing.T) {
	client := New(Config{})
	sink := &writeBuffer{writes: make(chan string, 1)}
	client.stdin = sink

	type result struct {
		requirements *ConfigRequirements
		err          error
	}
	done := make(chan result, 1)
	go func() {
		requirements, err := client.ReadConfigRequirements(context.Background())
		done <- result{requirements: requirements, err: err}
	}()

	req := readRPCRequest(t, sink.writes)
	if req.Method != "configRequirements/read" {
		t.Fatalf("method = %q, want configRequirements/read", req.Method)
	}
	if req.Params != nil {
		t.Fatalf("params = %#v, want null", req.Params)
	}
	client.handleRawMessage([]byte(`{"id":1,"result":{"requirements":{"allowedSandboxModes":["workspace-write"],"allowedApprovalPolicies":["on-request",{"granular":{"sandbox_approval":false,"rules":false,"skill_approval":false,"request_permissions":true,"mcp_elicitations":true}}],"allowedApprovalsReviewers":["user","auto_review"],"defaultPermissions":"auto"}}}`))

	select {
	case got := <-done:
		if got.err != nil {
			t.Fatal(got.err)
		}
		if got.requirements == nil || len(got.requirements.AllowedSandboxModes) != 1 || got.requirements.AllowedSandboxModes[0] != "workspace-write" {
			t.Fatalf("requirements = %#v", got.requirements)
		}
		if len(got.requirements.AllowedApprovalPolicies) != 2 {
			t.Fatalf("approval policies = %#v", got.requirements.AllowedApprovalPolicies)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for config requirements")
	}
}

type writeBuffer struct {
	bytes.Buffer
	writes chan string
}

func (w *writeBuffer) Write(p []byte) (int, error) {
	n, err := w.Buffer.Write(p)
	if w.writes != nil {
		select {
		case w.writes <- string(p):
		default:
		}
	}
	return n, err
}

func (w *writeBuffer) Close() error {
	return nil
}

var _ io.WriteCloser = (*writeBuffer)(nil)

type capturedRPCRequest struct {
	ID     int            `json:"id"`
	Method string         `json:"method"`
	Params map[string]any `json:"params"`
}

func readRPCRequest(t *testing.T, writes <-chan string) capturedRPCRequest {
	t.Helper()
	select {
	case raw := <-writes:
		var req capturedRPCRequest
		if err := json.Unmarshal([]byte(strings.TrimSpace(raw)), &req); err != nil {
			t.Fatalf("failed to decode rpc request %q: %v", raw, err)
		}
		return req
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for rpc request")
		return capturedRPCRequest{}
	}
}
