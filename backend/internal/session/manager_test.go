package session

import (
	"context"
	"testing"
	"time"

	"codex-web/backend/internal/appserver"
	"codex-web/backend/internal/model"
)

func TestManagerListUsesAppServerThreads(t *testing.T) {
	backend := newFakeBackend()
	name := "Indexed task name"
	backend.threads = []appserver.Thread{
		{
			ID:        "thread-1",
			Preview:   "first prompt preview",
			Name:      &name,
			CWD:       "/workspace",
			Status:    appserver.ThreadStatus{Type: "idle"},
			CreatedAt: 100,
			UpdatedAt: 200,
		},
	}
	manager := NewWithBackend(Config{RootDir: "/workspace"}, backend)

	got, err := manager.List(context.Background())
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("List() len = %d, want 1", len(got))
	}
	if got[0].ID != "thread-1" {
		t.Fatalf("record ID = %#v", got[0])
	}
	if got[0].Title != name {
		t.Fatalf("Title = %q, want %q", got[0].Title, name)
	}
}

func TestManagerListAcceptsMillisecondTimestamps(t *testing.T) {
	backend := newFakeBackend()
	backend.threads = []appserver.Thread{
		{
			ID:        "thread-1",
			Preview:   "timestamp probe",
			CWD:       "/workspace",
			Status:    appserver.ThreadStatus{Type: "idle"},
			CreatedAt: 1_757_280_000_000,
			UpdatedAt: 1_757_280_030_000,
		},
	}
	manager := NewWithBackend(Config{}, backend)

	got, err := manager.List(context.Background())
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("List() len = %d, want 1", len(got))
	}
	if year := got[0].UpdatedAt.Year(); year != 2025 {
		t.Fatalf("UpdatedAt = %s, want 2025 timestamp", got[0].UpdatedAt)
	}
}

func TestManagerCreateStartsThreadAndTurn(t *testing.T) {
	backend := newFakeBackend()
	backend.startThread = appserver.Thread{
		ID:        "thread-new",
		Preview:   "new prompt",
		CWD:       "/workspace",
		Status:    appserver.ThreadStatus{Type: statusRunning},
		CreatedAt: 100,
		UpdatedAt: 100,
	}
	backend.startTurn = appserver.Turn{ID: "turn-1", Status: statusRunning}
	manager := NewWithBackend(Config{RootDir: "/workspace"}, backend)

	record, err := manager.Create(context.Background(), model.SessionCreateRequest{Prompt: "new prompt"})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if record.ID != "thread-new" || record.Status != statusRunning {
		t.Fatalf("record = %#v", record)
	}
	if backend.startedTurnThreadID != "thread-new" || backend.startedTurnPrompt != "new prompt" {
		t.Fatalf("turn start = %q/%q", backend.startedTurnThreadID, backend.startedTurnPrompt)
	}
	state, err := manager.State("thread-new")
	if err != nil {
		t.Fatalf("State() error = %v", err)
	}
	if len(state.Turns) != 1 || len(state.Turns[0].Items) != 0 {
		t.Fatalf("Create() state = %#v", state.Turns)
	}

	backend.emitUserMessage("thread-new", "user-1", "new prompt")
	waitForCondition(t, func() bool {
		state, err := manager.State("thread-new")
		return err == nil &&
			len(state.Turns) == 1 &&
			len(state.Turns[0].Items) == 1 &&
			state.Turns[0].Items[0].Type == "userMessage" &&
			state.Turns[0].Items[0].Text == "new prompt"
	})
}

func TestManagerSendResumesThreadBeforeTurnStart(t *testing.T) {
	backend := newFakeBackend()
	backend.threads = []appserver.Thread{{
		ID:        "thread-1",
		Preview:   "existing",
		CWD:       "/workspace",
		Status:    appserver.ThreadStatus{Type: "idle"},
		CreatedAt: 100,
		UpdatedAt: 100,
	}}
	backend.resumeThread = backend.threads[0]
	backend.startTurn = appserver.Turn{ID: "turn-2", Status: statusRunning}
	manager := NewWithBackend(Config{RootDir: "/workspace"}, backend)
	if _, err := manager.List(context.Background()); err != nil {
		t.Fatalf("List() error = %v", err)
	}

	record, err := manager.Send(context.Background(), model.SessionSendRequest{
		SessionID: "thread-1",
		Prompt:    "follow up",
	})
	if err != nil {
		t.Fatalf("Send() error = %v", err)
	}
	if backend.resumedThreadID != "thread-1" {
		t.Fatalf("resumedThreadID = %q", backend.resumedThreadID)
	}
	if backend.startedTurnThreadID != "thread-1" || backend.startedTurnPrompt != "follow up" {
		t.Fatalf("turn start = %q/%q", backend.startedTurnThreadID, backend.startedTurnPrompt)
	}
	if record.Status != statusRunning {
		t.Fatalf("record.Status = %q, want running", record.Status)
	}
}

func TestManagerStateLoadsThreadReadItems(t *testing.T) {
	backend := newFakeBackend()
	backend.readThread = appserver.Thread{
		ID:        "thread-1",
		Preview:   "inspect",
		CWD:       "/workspace",
		Status:    appserver.ThreadStatus{Type: "idle"},
		CreatedAt: 100,
		UpdatedAt: 130,
		Turns: []appserver.Turn{{
			ID:        "turn-1",
			Status:    "completed",
			StartedAt: int64Ptr(100),
			Items: []map[string]any{
				{
					"type": "userMessage",
					"id":   "user-1",
					"content": []any{
						map[string]any{"type": "text", "text": "inspect"},
					},
				},
				{
					"type":    "reasoning",
					"id":      "reason-1",
					"summary": []any{"Checked the workspace"},
				},
				{
					"type":             "commandExecution",
					"id":               "cmd-1",
					"command":          "git status --short",
					"cwd":              "/workspace",
					"status":           "completed",
					"aggregatedOutput": " M file.go\n",
				},
				{
					"type":  "agentMessage",
					"id":    "agent-1",
					"text":  "Done.",
					"phase": "final_answer",
				},
			},
		}},
	}
	manager := NewWithBackend(Config{RootDir: "/workspace"}, backend)

	state, err := manager.State("thread-1")
	if err != nil {
		t.Fatalf("State() error = %v", err)
	}
	if len(state.Turns) != 1 || hasItemType(state.Turns[0].Items, "error") {
		t.Fatalf("state items = %#v", state.Turns[0].Items)
	}
	items := state.Turns[0].Items
	if len(items) != 4 {
		t.Fatalf("state item count = %d, want 4", len(items))
	}
	if items[2].Type != "commandExecution" || items[2].Command != "git status --short" || items[2].Output != " M file.go\n" {
		t.Fatalf("command item = %#v", items[2])
	}
	if items[3].Type != "agentMessage" || items[3].Phase != "final_answer" || items[3].Text != "Done." {
		t.Fatalf("assistant item = %#v", items[3])
	}
}

func TestManagerStateIncludesTurnError(t *testing.T) {
	backend := newFakeBackend()
	backend.readThread = appserver.Thread{
		ID:        "thread-1",
		Preview:   "failure",
		CWD:       "/workspace",
		Status:    appserver.ThreadStatus{Type: "idle"},
		CreatedAt: 100,
		UpdatedAt: 130,
		Turns: []appserver.Turn{{
			ID:          "turn-1",
			Status:      statusError,
			StartedAt:   int64Ptr(100),
			CompletedAt: int64Ptr(101),
			Error: map[string]any{
				"message": `{"error":{"message":"invalid codex request","type":"upstream_error"}}`,
			},
			Items: []map[string]any{
				{
					"type": "userMessage",
					"id":   "user-1",
					"content": []any{
						map[string]any{"type": "text", "text": "fail now"},
					},
				},
			},
		}},
	}
	manager := NewWithBackend(Config{RootDir: "/workspace"}, backend)

	state, err := manager.State("thread-1")
	if err != nil {
		t.Fatalf("State() error = %v", err)
	}
	if len(state.Turns) != 1 || len(state.Turns[0].Items) != 1 {
		t.Fatalf("state items = %#v", state.Turns)
	}
	if len(state.Turns[0].Error) == 0 {
		t.Fatalf("turn error was not preserved: %#v", state.Turns[0])
	}
}

func TestManagerAssistantDeltaUpdatesSameSequence(t *testing.T) {
	backend := newFakeBackend()
	manager := NewWithBackend(Config{RootDir: "/workspace"}, backend)
	seedThread(t, manager, backend)
	startAgentMessage(backend, "agent-1")
	backend.emit(appserver.Notification{
		Method: "item/agentMessage/delta",
		Params: map[string]any{
			"threadId": "thread-1",
			"turnId":   "turn-1",
			"itemId":   "agent-1",
			"delta":    "Hel",
		},
	})
	backend.emit(appserver.Notification{
		Method: "item/agentMessage/delta",
		Params: map[string]any{
			"threadId": "thread-1",
			"turnId":   "turn-1",
			"itemId":   "agent-1",
			"delta":    "lo",
		},
	})
	waitForCondition(t, func() bool {
		state, err := manager.State("thread-1")
		return err == nil &&
			len(state.Turns) == 1 &&
			len(state.Turns[0].Items) == 1 &&
			state.Turns[0].Items[0].Text == "Hello"
	})
}

func TestManagerAssistantDeltaPreservesWhitespace(t *testing.T) {
	backend := newFakeBackend()
	manager := NewWithBackend(Config{RootDir: "/workspace"}, backend)
	seedThread(t, manager, backend)
	startAgentMessage(backend, "agent-1")
	backend.emit(appserver.Notification{
		Method: "item/agentMessage/delta",
		Params: map[string]any{
			"threadId": "thread-1",
			"turnId":   "turn-1",
			"itemId":   "agent-1",
			"delta":    "Streaming",
		},
	})
	backend.emit(appserver.Notification{
		Method: "item/agentMessage/delta",
		Params: map[string]any{
			"threadId": "thread-1",
			"turnId":   "turn-1",
			"itemId":   "agent-1",
			"delta":    " output",
		},
	})
	waitForCondition(t, func() bool {
		state, err := manager.State("thread-1")
		return err == nil &&
			len(state.Turns) == 1 &&
			len(state.Turns[0].Items) == 1 &&
			state.Turns[0].Items[0].Text == "Streaming output"
	})
}

func TestManagerToolOutputDeltaPreservesWhitespace(t *testing.T) {
	backend := newFakeBackend()
	manager := NewWithBackend(Config{RootDir: "/workspace"}, backend)
	seedThread(t, manager, backend)
	startCommandExecution(backend, "cmd-1")
	backend.emit(appserver.Notification{
		Method: "item/commandExecution/outputDelta",
		Params: map[string]any{
			"threadId": "thread-1",
			"turnId":   "turn-1",
			"itemId":   "cmd-1",
			"delta":    "line one",
		},
	})
	backend.emit(appserver.Notification{
		Method: "item/commandExecution/outputDelta",
		Params: map[string]any{
			"threadId": "thread-1",
			"turnId":   "turn-1",
			"itemId":   "cmd-1",
			"delta":    "\n  line two",
		},
	})
	waitForCondition(t, func() bool {
		state, err := manager.State("thread-1")
		return err == nil &&
			len(state.Turns) == 1 &&
			len(state.Turns[0].Items) == 1 &&
			state.Turns[0].Items[0].Output == "line one\n  line two"
	})
}

func TestManagerAgentMessageCompletedClearsStreamingState(t *testing.T) {
	backend := newFakeBackend()
	manager := NewWithBackend(Config{RootDir: "/workspace"}, backend)
	seedThread(t, manager, backend)
	startAgentMessage(backend, "agent-1")
	backend.emit(appserver.Notification{
		Method: "item/agentMessage/delta",
		Params: map[string]any{
			"threadId": "thread-1",
			"turnId":   "turn-1",
			"itemId":   "agent-1",
			"delta":    "partial",
		},
	})
	backend.emit(appserver.Notification{
		Method: "item/completed",
		Params: map[string]any{
			"threadId": "thread-1",
			"turnId":   "turn-1",
			"item": map[string]any{
				"type":  "agentMessage",
				"id":    "agent-1",
				"text":  "partial answer",
				"phase": "final_answer",
			},
		},
	})
	waitForCondition(t, func() bool {
		state, err := manager.State("thread-1")
		if err != nil || len(state.Turns) != 1 || len(state.Turns[0].Items) != 1 {
			return false
		}
		item := state.Turns[0].Items[0]
		return item.Text == "partial answer" &&
			item.Phase == "final_answer" &&
			item.Status == "completed"
	})
}

func TestManagerTurnCompletedKeepsStreamedAssistantMessage(t *testing.T) {
	backend := newFakeBackend()
	manager := NewWithBackend(Config{RootDir: "/workspace"}, backend)
	seedThread(t, manager, backend)
	startAgentMessage(backend, "agent-1")
	backend.emit(appserver.Notification{
		Method: "item/agentMessage/delta",
		Params: map[string]any{
			"threadId": "thread-1",
			"turnId":   "turn-1",
			"itemId":   "agent-1",
			"delta":    "final answer",
		},
	})
	backend.emit(appserver.Notification{
		Method: "turn/completed",
		Params: map[string]any{
			"threadId": "thread-1",
			"turn": map[string]any{
				"id":     "turn-1",
				"status": "completed",
			},
		},
	})

	waitForCondition(t, func() bool {
		state, err := manager.State("thread-1")
		return err == nil &&
			len(state.Turns) == 1 &&
			state.Turns[0].Status == "completed" &&
			len(state.Turns[0].Items) == 1 &&
			state.Turns[0].Items[0].Text == "final answer" &&
			state.Turns[0].Items[0].Status == statusRunning
	})
}

func TestManagerAgentMessageStartedCreatesRunningState(t *testing.T) {
	backend := newFakeBackend()
	manager := NewWithBackend(Config{RootDir: "/workspace"}, backend)
	seedThread(t, manager, backend)
	backend.emit(appserver.Notification{
		Method: "item/started",
		Params: map[string]any{
			"threadId": "thread-1",
			"turnId":   "turn-1",
			"item": map[string]any{
				"type":  "agentMessage",
				"id":    "agent-1",
				"phase": "final_answer",
			},
		},
	})

	waitForCondition(t, func() bool {
		state, err := manager.State("thread-1")
		return err == nil &&
			len(state.Turns) == 1 &&
			len(state.Turns[0].Items) == 1 &&
			state.Turns[0].Items[0].Type == "agentMessage" &&
			state.Turns[0].Items[0].Status == statusRunning
	})

	backend.emit(appserver.Notification{
		Method: "item/agentMessage/delta",
		Params: map[string]any{
			"threadId": "thread-1",
			"turnId":   "turn-1",
			"itemId":   "agent-1",
			"delta":    "partial",
		},
	})
	waitForCondition(t, func() bool {
		state, err := manager.State("thread-1")
		return err == nil &&
			len(state.Turns) == 1 &&
			len(state.Turns[0].Items) == 1 &&
			state.Turns[0].Items[0].Text == "partial" &&
			state.Turns[0].Items[0].Status == statusRunning
	})
}

type fakeBackend struct {
	threads []appserver.Thread

	startThread  appserver.Thread
	resumeThread appserver.Thread
	readThread   appserver.Thread
	startTurn    appserver.Turn

	resumedThreadID     string
	startedTurnThreadID string
	startedTurnPrompt   string
	interruptedThreadID string
	interruptedTurnID   string

	events chan appserver.Notification
}

func newFakeBackend() *fakeBackend {
	return &fakeBackend{events: make(chan appserver.Notification, 32)}
}

func seedThread(t *testing.T, manager *Manager, backend *fakeBackend) {
	t.Helper()
	backend.threads = []appserver.Thread{{
		ID:        "thread-1",
		Preview:   "existing",
		CWD:       "/workspace",
		Status:    appserver.ThreadStatus{Type: statusIdle},
		CreatedAt: 100,
		UpdatedAt: 100,
	}}
	if _, err := manager.List(context.Background()); err != nil {
		t.Fatalf("List() error = %v", err)
	}
	backend.emit(appserver.Notification{
		Method: "turn/started",
		Params: map[string]any{
			"threadId": "thread-1",
			"turn": map[string]any{
				"id":     "turn-1",
				"status": statusRunning,
			},
		},
	})
}

func startAgentMessage(backend *fakeBackend, itemID string) {
	backend.emit(appserver.Notification{
		Method: "item/started",
		Params: map[string]any{
			"threadId": "thread-1",
			"turnId":   "turn-1",
			"item": map[string]any{
				"type":  "agentMessage",
				"id":    itemID,
				"phase": "final_answer",
			},
		},
	})
}

func startCommandExecution(backend *fakeBackend, itemID string) {
	backend.emit(appserver.Notification{
		Method: "item/started",
		Params: map[string]any{
			"threadId": "thread-1",
			"turnId":   "turn-1",
			"item": map[string]any{
				"type":    "commandExecution",
				"id":      itemID,
				"command": "printf test",
				"cwd":     "/workspace",
			},
		},
	})
}

func (f *fakeBackend) ListThreads(context.Context, int) ([]appserver.Thread, error) {
	return append([]appserver.Thread(nil), f.threads...), nil
}

func (f *fakeBackend) ReadThread(context.Context, string) (appserver.Thread, error) {
	return f.readThread, nil
}

func (f *fakeBackend) StartThread(context.Context, string) (appserver.Thread, error) {
	return f.startThread, nil
}

func (f *fakeBackend) ResumeThread(_ context.Context, threadID, _ string) (appserver.Thread, error) {
	f.resumedThreadID = threadID
	return f.resumeThread, nil
}

func (f *fakeBackend) StartTurn(_ context.Context, threadID, prompt, _ string) (appserver.Turn, error) {
	f.startedTurnThreadID = threadID
	f.startedTurnPrompt = prompt
	return f.startTurn, nil
}

func (f *fakeBackend) InterruptTurn(_ context.Context, threadID, turnID string) error {
	f.interruptedThreadID = threadID
	f.interruptedTurnID = turnID
	return nil
}

func (f *fakeBackend) Subscribe() (<-chan appserver.Notification, func()) {
	return f.events, func() {}
}

func (f *fakeBackend) emit(notification appserver.Notification) {
	f.events <- notification
}

func (f *fakeBackend) emitUserMessage(threadID, itemID, text string) {
	f.emit(appserver.Notification{
		Method: "item/started",
		Params: map[string]any{
			"threadId": threadID,
			"turnId":   "turn-1",
			"item": map[string]any{
				"type": "userMessage",
				"id":   itemID,
				"content": []any{
					map[string]any{"type": "text", "text": text},
				},
			},
		},
	})
}

func int64Ptr(value int64) *int64 {
	return &value
}

func hasItemType(items []model.SessionItem, itemKind string) bool {
	for _, item := range items {
		if item.Type == itemKind {
			return true
		}
	}
	return false
}

func waitForCondition(t *testing.T, fn func() bool) {
	t.Helper()
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		if fn() {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("condition not met before timeout")
}
