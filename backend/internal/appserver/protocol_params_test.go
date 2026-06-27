package appserver

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestThreadAndTurnParamsUseOnlyOfficialAppServerKeys(t *testing.T) {
	opts := SendOptions{
		ThreadID:  "thread-1",
		CWD:       "/root/my_code/codex-web",
		Model:     "gpt-5.5",
		Reasoning: "high",
		AgentMode: "auto",
		PlanMode:  true,
		Prompt:    "核对状态显示",
	}

	thread := threadParams(opts)
	turn := turnParams(opts)

	assertParamsMatchSchema(t, "thread/start", thread, "ThreadStartParams.json")
	assertParamsMatchSchema(t, "turn/start", turn, "TurnStartParams.json")
	assertParamsMatchSchema(t, "turn/steer", steerParams("thread-1", "turn-1", "补充要求", nil), "TurnSteerParams.json")

	for _, forbidden := range []string{"dynamicTools", "collaborationMode"} {
		if _, ok := thread[forbidden]; ok {
			t.Fatalf("thread/start included extension-omitted field %q: %#v", forbidden, thread)
		}
	}
	if _, ok := turn["dynamicTools"]; ok {
		t.Fatalf("turn/start included extension-omitted field dynamicTools: %#v", turn)
	}
	mode, ok := turn["collaborationMode"].(map[string]any)
	if !ok {
		t.Fatalf("turn/start did not include official collaborationMode: %#v", turn)
	}
	if mode["mode"] != "plan" {
		t.Fatalf("collaboration mode = %#v, want plan", mode["mode"])
	}
	settings, ok := mode["settings"].(map[string]any)
	if !ok {
		t.Fatalf("collaboration mode settings = %#v", mode["settings"])
	}
	if settings["model"] != "gpt-5.5" || settings["reasoning_effort"] != "high" {
		t.Fatalf("collaboration mode settings = %#v", settings)
	}
}

func TestTurnParamsCollaborationModeVariants(t *testing.T) {
	defaultTurn := turnParams(SendOptions{
		ThreadID: "thread-1",
		Model:    "gpt-5.5",
		Prompt:   "继续",
	})
	defaultMode, ok := defaultTurn["collaborationMode"].(map[string]any)
	if !ok {
		t.Fatalf("default turn missing collaborationMode: %#v", defaultTurn)
	}
	if defaultMode["mode"] != "default" {
		t.Fatalf("default collaboration mode = %#v, want default", defaultMode["mode"])
	}

	noModelTurn := turnParams(SendOptions{
		ThreadID: "thread-1",
		Prompt:   "继续",
		PlanMode: true,
	})
	if _, ok := noModelTurn["collaborationMode"]; ok {
		t.Fatalf("turn/start included incomplete collaborationMode without model: %#v", noModelTurn)
	}
}

func TestAgentPermissionsUseCurrentAutoReviewReviewer(t *testing.T) {
	params := turnParams(SendOptions{
		ThreadID:  "thread-1",
		CWD:       "/root/my_code/codex-web",
		Model:     "gpt-5.5",
		Prompt:    "核对自动审核",
		AgentMode: "guardian-approvals",
	})

	if params["approvalsReviewer"] != "auto_review" {
		t.Fatalf("approvalsReviewer = %#v, want auto_review", params["approvalsReviewer"])
	}
	if params["approvalsReviewer"] == "guardian_subagent" {
		t.Fatalf("approvalsReviewer used legacy reviewer: %#v", params)
	}
}

func TestInitializeNegotiatesExperimentalApi(t *testing.T) {
	client := New(Config{})
	sink := &writeBuffer{writes: make(chan string, 2)}
	client.stdin = sink

	done := make(chan error, 1)
	go func() {
		done <- client.initialize()
	}()

	req := readRPCRequest(t, sink.writes)
	if req.Method != "initialize" {
		t.Fatalf("method = %q, want initialize", req.Method)
	}
	clientInfo, ok := req.Params["clientInfo"].(map[string]any)
	if !ok || clientInfo["name"] != "codex_web" || clientInfo["title"] != "Codex Web" {
		t.Fatalf("clientInfo = %#v", req.Params["clientInfo"])
	}
	capabilities, ok := req.Params["capabilities"].(map[string]any)
	if !ok || capabilities["experimentalApi"] != true {
		t.Fatalf("capabilities = %#v, want experimentalApi true", req.Params["capabilities"])
	}
	client.handleRawMessage([]byte(`{"id":1,"result":{}}`))

	notification := readRPCRequest(t, sink.writes)
	if notification.ID != 0 || notification.Method != "initialized" {
		t.Fatalf("notification = %#v, want initialized notification without id", notification)
	}

	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for initialize")
	}
}

func TestStartTurnSendsOfficialTurnStartRequestOnly(t *testing.T) {
	client := New(Config{})
	sink := &writeBuffer{writes: make(chan string, 2)}
	client.stdin = sink

	type result struct {
		turn Turn
		err  error
	}
	done := make(chan result, 1)
	go func() {
		turn, err := client.StartTurn(context.Background(), SendOptions{
			ThreadID:  "thread-1",
			CWD:       "/root/my_code/codex-web",
			Model:     "gpt-5.5",
			Reasoning: "high",
			AgentMode: "auto",
			PlanMode:  true,
			Prompt:    "继续核对状态",
			Attachments: []InputAttachment{
				{Type: "localImage", Path: "/tmp/state.png", Detail: "high"},
				{Type: "mention", Path: "/root/my_code/codex-web/frontend/codex-web-shim.js", Name: "codex-web-shim.js"},
			},
		})
		done <- result{turn: turn, err: err}
	}()

	req := readRPCRequest(t, sink.writes)
	if req.Method != "turn/start" {
		t.Fatalf("method = %q, want turn/start", req.Method)
	}
	assertParamsMatchSchema(t, "turn/start", req.Params, "TurnStartParams.json")
	if req.Params["threadId"] != "thread-1" || req.Params["model"] != "gpt-5.5" || req.Params["effort"] != "high" {
		t.Fatalf("turn/start params = %#v", req.Params)
	}
	input, ok := req.Params["input"].([]any)
	if !ok || len(input) != 3 {
		t.Fatalf("turn/start input = %#v, want text plus two attachments", req.Params["input"])
	}
	if input[0].(map[string]any)["type"] != "text" || input[1].(map[string]any)["type"] != "localImage" || input[2].(map[string]any)["type"] != "mention" {
		t.Fatalf("turn/start input order = %#v", input)
	}
	mode, ok := req.Params["collaborationMode"].(map[string]any)
	if !ok || mode["mode"] != "plan" {
		t.Fatalf("collaborationMode = %#v, want plan mode", req.Params["collaborationMode"])
	}
	client.handleRawMessage([]byte(`{"id":1,"result":{"turn":{"id":"turn-1","status":"active"}}}`))

	select {
	case got := <-done:
		if got.err != nil {
			t.Fatal(got.err)
		}
		if got.turn.ID != "turn-1" {
			t.Fatalf("turn = %#v, want turn-1", got.turn)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for StartTurn")
	}
	assertNoExtraRPCRequest(t, sink.writes, "thread/resume compatibility request after turn/start")
}

func TestStartReviewSendsOfficialReviewStartRequestOnly(t *testing.T) {
	client := New(Config{})
	sink := &writeBuffer{writes: make(chan string, 2)}
	client.stdin = sink

	type result struct {
		reviewThreadID string
		turn           Turn
		err            error
	}
	done := make(chan result, 1)
	go func() {
		reviewThreadID, turn, err := client.StartReview(context.Background(), ReviewOptions{
			ThreadID: "thread-1",
			Target:   map[string]any{"type": "uncommittedChanges"},
			Delivery: "inline",
		})
		done <- result{reviewThreadID: reviewThreadID, turn: turn, err: err}
	}()

	req := readRPCRequest(t, sink.writes)
	if req.Method != "review/start" {
		t.Fatalf("method = %q, want review/start", req.Method)
	}
	assertParamsMatchSchema(t, "review/start", req.Params, "ReviewStartParams.json")
	if req.Params["threadId"] != "thread-1" || req.Params["delivery"] != "inline" {
		t.Fatalf("review/start params = %#v", req.Params)
	}
	target, ok := req.Params["target"].(map[string]any)
	if !ok || target["type"] != "uncommittedChanges" {
		t.Fatalf("review target = %#v", req.Params["target"])
	}
	client.handleRawMessage([]byte(`{"id":1,"result":{"reviewThreadId":"thread-1","turn":{"id":"turn-review","status":"active"}}}`))

	select {
	case got := <-done:
		if got.err != nil {
			t.Fatal(got.err)
		}
		if got.reviewThreadID != "thread-1" || got.turn.ID != "turn-review" {
			t.Fatalf("review result = %#v", got)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for StartReview")
	}
	assertNoExtraRPCRequest(t, sink.writes, "thread/resume compatibility request after review/start")
}

func TestSteerTurnSendsOfficialTurnSteerRequestOnly(t *testing.T) {
	client := New(Config{})
	sink := &writeBuffer{writes: make(chan string, 2)}
	client.stdin = sink

	done := make(chan error, 1)
	go func() {
		done <- client.SteerTurn(context.Background(), "thread-1", "turn-1", "补充引导", []InputAttachment{{Type: "mention", Path: "/root/README.md", Name: "README.md"}})
	}()

	req := readRPCRequest(t, sink.writes)
	if req.Method != "turn/steer" {
		t.Fatalf("method = %q, want turn/steer", req.Method)
	}
	assertParamsMatchSchema(t, "turn/steer", req.Params, "TurnSteerParams.json")
	if req.Params["threadId"] != "thread-1" || req.Params["expectedTurnId"] != "turn-1" {
		t.Fatalf("turn/steer params = %#v", req.Params)
	}
	input, ok := req.Params["input"].([]any)
	if !ok || len(input) != 2 || input[0].(map[string]any)["type"] != "text" || input[1].(map[string]any)["type"] != "mention" {
		t.Fatalf("turn/steer input = %#v", req.Params["input"])
	}
	client.handleRawMessage([]byte(`{"id":1,"result":{}}`))

	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for SteerTurn")
	}
	assertNoExtraRPCRequest(t, sink.writes, "queued guidance should not start a new turn")
}

func assertParamsMatchSchema(t *testing.T, method string, params map[string]any, schemaFile string) {
	t.Helper()
	allowed := schemaProperties(t, schemaFile)
	for key := range params {
		if !allowed[key] {
			t.Fatalf("%s param %q is not in %s", method, key, schemaFile)
		}
	}
}

func schemaProperties(t *testing.T, schemaFile string) map[string]bool {
	t.Helper()
	path := filepath.Join("..", "..", "..", "build", "tmp", "app-schema", "v2", schemaFile)
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read schema %s: %v", path, err)
	}
	var schema struct {
		Properties map[string]any `json:"properties"`
	}
	if err := json.Unmarshal(data, &schema); err != nil {
		t.Fatalf("parse schema %s: %v", path, err)
	}
	if len(schema.Properties) == 0 {
		t.Fatalf("schema %s has no properties", path)
	}
	allowed := make(map[string]bool, len(schema.Properties))
	for key := range schema.Properties {
		allowed[key] = true
	}
	return allowed
}

func assertNoExtraRPCRequest(t *testing.T, writes <-chan string, reason string) {
	t.Helper()
	select {
	case raw := <-writes:
		t.Fatalf("unexpected extra rpc request (%s): %s", reason, raw)
	case <-time.After(100 * time.Millisecond):
	}
}
