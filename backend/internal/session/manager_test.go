package session

import (
	"context"
	"strconv"
	"strings"
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
			Preview:   "first prompt fallback",
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
	if got[0].ID != "thread-1" || got[0].CodexThreadID != "thread-1" {
		t.Fatalf("record IDs = %#v", got[0])
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
		Status:    appserver.ThreadStatus{Type: "active"},
		CreatedAt: 100,
		UpdatedAt: 100,
	}
	backend.startTurn = appserver.Turn{ID: "turn-1", Status: "inProgress"}
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
	page, err := manager.Events(model.SessionEventsRequest{SessionID: "thread-new"})
	if err != nil {
		t.Fatalf("Events() error = %v", err)
	}
	if len(page.Events) != 0 {
		t.Fatalf("Create() added local events = %#v", page.Events)
	}

	backend.emitUserMessage("thread-new", "user-1", "new prompt")
	waitForCondition(t, func() bool {
		page, err := manager.Events(model.SessionEventsRequest{SessionID: "thread-new"})
		return err == nil && len(page.Events) == 1 && page.Events[0].Kind == "user_message" && page.Events[0].Text == "new prompt"
	})
	page, _ = manager.Events(model.SessionEventsRequest{SessionID: "thread-new"})
	if len(page.Events) != 1 {
		t.Fatalf("events after app-server userMessage = %#v", page.Events)
	}
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
	backend.startTurn = appserver.Turn{ID: "turn-2", Status: "inProgress"}
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

func TestManagerEventsLoadsThreadReadItems(t *testing.T) {
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

	page, err := manager.Events(model.SessionEventsRequest{SessionID: "thread-1"})
	if err != nil {
		t.Fatalf("Events() error = %v", err)
	}
	kinds := eventKinds(page.Events)
	want := "user_message,reasoning,tool_call,tool_output,assistant_message"
	if kinds != want {
		t.Fatalf("kinds = %s, want %s", kinds, want)
	}
	if page.Events[2].Data["name"] != "exec_command" {
		t.Fatalf("tool call data = %#v", page.Events[2].Data)
	}
	if page.Events[4].Data["phase"] != "final_answer" {
		t.Fatalf("assistant data = %#v", page.Events[4].Data)
	}
}

func TestManagerEventsIncludesTurnError(t *testing.T) {
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
			Status:      "failed",
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

	page, err := manager.Events(model.SessionEventsRequest{SessionID: "thread-1"})
	if err != nil {
		t.Fatalf("Events() error = %v", err)
	}
	if got := eventKinds(page.Events); got != "user_message,error" {
		t.Fatalf("kinds = %s, want user_message,error", got)
	}
	if page.Events[1].Text != "invalid codex request" {
		t.Fatalf("error text = %q", page.Events[1].Text)
	}
	if page.Events[1].Data["turnId"] != "turn-1" {
		t.Fatalf("error data = %#v", page.Events[1].Data)
	}
}

func TestManagerAssistantDeltaUpdatesSameSequence(t *testing.T) {
	backend := newFakeBackend()
	manager := NewWithBackend(Config{RootDir: "/workspace"}, backend)
	backend.emit(appserver.Notification{
		Method: "item/agentMessage/delta",
		Params: map[string]any{
			"threadId": "thread-1",
			"itemId":   "agent-1",
			"delta":    "Hel",
		},
	})
	backend.emit(appserver.Notification{
		Method: "item/agentMessage/delta",
		Params: map[string]any{
			"threadId": "thread-1",
			"itemId":   "agent-1",
			"delta":    "lo",
		},
	})
	waitForCondition(t, func() bool {
		page, err := manager.Events(model.SessionEventsRequest{SessionID: "thread-1"})
		return err == nil && len(page.Events) == 1 && page.Events[0].Text == "Hello"
	})
	page, _ := manager.Events(model.SessionEventsRequest{SessionID: "thread-1"})
	if page.Events[0].Seq != 1 {
		t.Fatalf("delta seq = %d, want 1", page.Events[0].Seq)
	}
}

func TestManagerAssistantDeltaPreservesWhitespace(t *testing.T) {
	backend := newFakeBackend()
	manager := NewWithBackend(Config{RootDir: "/workspace"}, backend)
	backend.emit(appserver.Notification{
		Method: "item/agentMessage/delta",
		Params: map[string]any{
			"threadId": "thread-1",
			"itemId":   "agent-1",
			"delta":    "Streaming",
		},
	})
	backend.emit(appserver.Notification{
		Method: "item/agentMessage/delta",
		Params: map[string]any{
			"threadId": "thread-1",
			"itemId":   "agent-1",
			"delta":    " output",
		},
	})
	waitForCondition(t, func() bool {
		page, err := manager.Events(model.SessionEventsRequest{SessionID: "thread-1"})
		return err == nil && len(page.Events) == 1 && page.Events[0].Text == "Streaming output"
	})
}

func TestManagerToolOutputDeltaPreservesWhitespace(t *testing.T) {
	backend := newFakeBackend()
	manager := NewWithBackend(Config{RootDir: "/workspace"}, backend)
	backend.emit(appserver.Notification{
		Method: "item/commandExecution/outputDelta",
		Params: map[string]any{
			"threadId": "thread-1",
			"itemId":   "cmd-1",
			"delta":    "line one",
		},
	})
	backend.emit(appserver.Notification{
		Method: "item/commandExecution/outputDelta",
		Params: map[string]any{
			"threadId": "thread-1",
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
	backend.emit(appserver.Notification{
		Method: "item/agentMessage/delta",
		Params: map[string]any{
			"threadId": "thread-1",
			"itemId":   "agent-1",
			"delta":    "partial",
		},
	})
	backend.emit(appserver.Notification{
		Method: "item/completed",
		Params: map[string]any{
			"threadId": "thread-1",
			"item": map[string]any{
				"type":  "agentMessage",
				"id":    "agent-1",
				"text":  "partial answer",
				"phase": "final_answer",
			},
		},
	})
	waitForCondition(t, func() bool {
		page, err := manager.Events(model.SessionEventsRequest{SessionID: "thread-1"})
		if err != nil || len(page.Events) != 1 {
			return false
		}
		return page.Events[0].Text == "partial answer" &&
			page.Events[0].Data["phase"] == "final_answer" &&
			page.Events[0].Data["streaming"] == false
	})
}

func TestManagerAgentMessageStartedCreatesRunningState(t *testing.T) {
	backend := newFakeBackend()
	manager := NewWithBackend(Config{RootDir: "/workspace"}, backend)
	backend.emit(appserver.Notification{
		Method: "item/started",
		Params: map[string]any{
			"threadId": "thread-1",
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

func TestManagerEventsPaginatesFromTailAndBeforeSeq(t *testing.T) {
	backend := newFakeBackend()
	manager := NewWithBackend(Config{RootDir: "/workspace"}, backend)
	session := &managedSession{
		record:      model.SessionRecord{ID: "session-1", LastSeq: 5, CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()},
		stateLoaded: true,
		lastSeq:     5,
		turns: []model.SessionTurn{
			{ID: "turn-1", Status: "completed", Items: []model.SessionItem{
				{ID: "user-1", Type: "userMessage", Text: "one"},
				{ID: "agent-1", Type: "agentMessage", Text: "two"},
			}},
			{ID: "turn-2", Status: "completed", Items: []model.SessionItem{
				{ID: "user-2", Type: "userMessage", Text: "three"},
				{ID: "agent-2", Type: "agentMessage", Text: "four"},
				{ID: "agent-3", Type: "agentMessage", Text: "five"},
			}},
		},
	}
	session.rebuildIndexes()
	manager.sessions["session-1"] = session

	page, err := manager.Events(model.SessionEventsRequest{SessionID: "session-1", Limit: 2})
	if err != nil {
		t.Fatalf("Events(tail) error = %v", err)
	}
	if got := eventSeqs(page.Events); got != "4,5" || !page.HasMoreBefore || page.FirstSeq != 4 || page.LastSeq != 5 {
		t.Fatalf("tail page = %#v, seqs = %s", page, got)
	}

	page, err = manager.Events(model.SessionEventsRequest{SessionID: "session-1", BeforeSeq: 4, Limit: 2})
	if err != nil {
		t.Fatalf("Events(before) error = %v", err)
	}
	if got := eventSeqs(page.Events); got != "2,3" || !page.HasMoreBefore || page.FirstSeq != 2 || page.LastSeq != 3 {
		t.Fatalf("before page = %#v, seqs = %s", page, got)
	}
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

func eventKinds(events []model.SessionEvent) string {
	kinds := make([]string, 0, len(events))
	for _, event := range events {
		kinds = append(kinds, event.Kind)
	}
	return strings.Join(kinds, ",")
}

func eventSeqs(events []model.SessionEvent) string {
	seqs := make([]string, 0, len(events))
	for _, event := range events {
		seqs = append(seqs, strconv.FormatInt(event.Seq, 10))
	}
	return strings.Join(seqs, ",")
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
