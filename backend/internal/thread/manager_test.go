package thread

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"codex-web/backend/internal/appserver"
)

type userMessageTestItem struct {
	Type    string `json:"type"`
	Content []struct {
		Text string `json:"text"`
	} `json:"content"`
}

type agentMessageTestItem struct {
	Type  string  `json:"type"`
	Text  string  `json:"text"`
	Phase *string `json:"phase"`
}

type commandExecutionTestItem struct {
	Type             string  `json:"type"`
	Command          string  `json:"command"`
	AggregatedOutput *string `json:"aggregatedOutput"`
}

type statusTestItem struct {
	Status string `json:"status"`
}

type reasoningTestItem struct {
	Summary []string `json:"summary"`
	Content []string `json:"content"`
}

type planTestItem struct {
	Text string `json:"text"`
}

func TestManagerListUsesAppServerThreads(t *testing.T) {
	backend := newFakeBackend()
	name := "Indexed task name"
	thread := officialThread("thread-1", "idle", 200, []appserver.Turn{})
	thread.Name = &name
	backend.threads = []appserver.Thread{thread}
	manager := NewWithBackend(Config{RootDir: "/workspace"}, backend)
	initializeManager(t, manager)

	got := manager.List()
	if len(got) != 1 {
		t.Fatalf("List() len = %d, want 1", len(got))
	}
	if got[0].ID != "thread-1" {
		t.Fatalf("thread ID = %#v", got[0])
	}
	if *got[0].Name != name {
		t.Fatalf("Name = %q, want %q", *got[0].Name, name)
	}
}

func TestManagerListPreservesAppServerTimestamps(t *testing.T) {
	backend := newFakeBackend()
	backend.threads = []appserver.Thread{officialThread("thread-1", "idle", 1_757_280_030, []appserver.Turn{})}
	manager := NewWithBackend(Config{}, backend)
	initializeManager(t, manager)

	got := manager.List()
	if len(got) != 1 {
		t.Fatalf("List() len = %d, want 1", len(got))
	}
	if got[0].UpdatedAt != 1_757_280_030 {
		t.Fatalf("UpdatedAt = %d, want app-server timestamp", got[0].UpdatedAt)
	}
}

func TestManagerCreateStartsThreadAndTurn(t *testing.T) {
	backend := newFakeBackend()
	backend.startThread = officialThread("thread-new", "active", 100, []appserver.Turn{})
	backend.startThread.Status.ActiveFlags = &[]string{}
	backend.startTurn = officialTurn("turn-1", "inProgress", []json.RawMessage{})
	manager := NewWithBackend(Config{RootDir: "/workspace"}, backend)

	threadID, err := manager.Create(context.Background(), "new prompt")
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if threadID != "thread-new" {
		t.Fatalf("thread ID = %q", threadID)
	}
	if backend.startedTurnThreadID != "thread-new" || backend.startedTurnPrompt != "new prompt" {
		t.Fatalf("turn start = %q/%q", backend.startedTurnThreadID, backend.startedTurnPrompt)
	}
	waitForCondition(t, func() bool {
		thread, _, err := manager.State("thread-new")
		return err == nil && len(thread.Turns) == 1 && len(thread.Turns[0].Items) == 0
	})

	backend.emitUserMessage("thread-new", "user-1", "new prompt")
	waitForCondition(t, func() bool {
		thread, _, err := manager.State("thread-new")
		if err != nil || len(thread.Turns) != 1 || len(thread.Turns[0].Items) != 1 {
			return false
		}
		item := decodeTestJSON[userMessageTestItem](thread.Turns[0].Items[0])
		return err == nil &&
			item.Type == "userMessage" &&
			item.Content[0].Text == "new prompt"
	})
}

func TestManagerSendResumesThreadBeforeTurnStart(t *testing.T) {
	backend := newFakeBackend()
	backend.threads = []appserver.Thread{officialThread("thread-1", "idle", 100, []appserver.Turn{})}
	backend.resumeThread = backend.threads[0]
	backend.startTurn = officialTurn("turn-2", "inProgress", []json.RawMessage{})
	manager := NewWithBackend(Config{RootDir: "/workspace"}, backend)
	initializeManager(t, manager)

	if err := manager.Send(context.Background(), "thread-1", "follow up"); err != nil {
		t.Fatalf("Send() error = %v", err)
	}
	if backend.resumedThreadID != "thread-1" {
		t.Fatalf("resumedThreadID = %q", backend.resumedThreadID)
	}
	if backend.startedTurnThreadID != "thread-1" || backend.startedTurnPrompt != "follow up" {
		t.Fatalf("turn start = %q/%q", backend.startedTurnThreadID, backend.startedTurnPrompt)
	}
}

func TestManagerSendDoesNotReplaceStateWithResumeResponse(t *testing.T) {
	backend := newFakeBackend()
	name := "listed thread"
	listed := officialThread("thread-1", "idle", 100, []appserver.Turn{})
	listed.Name = &name
	backend.threads = []appserver.Thread{listed}
	backend.resumeThread = officialThread("thread-1", "active", 200, []appserver.Turn{})
	backend.startTurn = officialTurn("turn-1", "inProgress", []json.RawMessage{})
	manager := NewWithBackend(Config{RootDir: "/workspace"}, backend)
	initializeManager(t, manager)

	if err := manager.Send(context.Background(), "thread-1", "follow up"); err != nil {
		t.Fatalf("Send() error = %v", err)
	}

	got := manager.List()[0]
	if got.Name == nil || *got.Name != name {
		t.Fatalf("resume response replaced thread state: %#v", got)
	}
}

func TestManagerStateLoadsThreadReadItems(t *testing.T) {
	backend := newFakeBackend()
	turn := officialTurn("turn-1", "completed", rawItems(
		userMessageItem("user-1", "inspect"),
		reasoningItem("reason-1", []string{"Checked the workspace"}, []string{}),
		commandExecutionItem("cmd-1", "completed", "git status --short", stringPtr(" M file.go\n")),
		agentMessageItem("agent-1", "Done.", stringPtr("final_answer")),
	))
	turn.StartedAt = int64Ptr(100)
	backend.threads = []appserver.Thread{officialThread("thread-1", "idle", 100, []appserver.Turn{})}
	backend.readThread = officialThread("thread-1", "idle", 130, []appserver.Turn{turn})
	manager := NewWithBackend(Config{RootDir: "/workspace"}, backend)
	initializeManager(t, manager)

	thread, _, err := manager.State("thread-1")
	if err != nil {
		t.Fatalf("State() error = %v", err)
	}
	if len(thread.Turns) != 1 {
		t.Fatalf("state items = %#v", thread.Turns[0].Items)
	}
	items := thread.Turns[0].Items
	if len(items) != 4 {
		t.Fatalf("state item count = %d, want 4", len(items))
	}
	command := decodeTestJSON[commandExecutionTestItem](items[2])
	if command.Type != "commandExecution" || command.Command != "git status --short" || *command.AggregatedOutput != " M file.go\n" {
		t.Fatalf("command item = %#v", command)
	}
	agent := decodeTestJSON[agentMessageTestItem](items[3])
	if agent.Type != "agentMessage" || *agent.Phase != "final_answer" || agent.Text != "Done." {
		t.Fatalf("assistant item = %#v", agent)
	}
}

func TestManagerStateReadsHistoryAfterLiveTurnStarts(t *testing.T) {
	backend := newFakeBackend()
	backend.threads = []appserver.Thread{officialThread("thread-1", "idle", 100, []appserver.Turn{})}
	backend.readThread = officialThread("thread-1", "active", 102, []appserver.Turn{
		officialTurn("turn-old", "completed", rawItems(userMessageItem("user-old", "earlier"))),
		officialTurn("turn-live", "inProgress", rawItems(userMessageItem("user-live", "current"))),
	})
	manager := NewWithBackend(Config{RootDir: "/workspace"}, backend)
	initializeManager(t, manager)

	backend.emit(notification("turn/started", map[string]any{
		"threadId": "thread-1",
		"turn":     officialTurn("turn-live", "inProgress", []json.RawMessage{}),
	}))
	waitForCondition(t, func() bool {
		manager.mu.Lock()
		defer manager.mu.Unlock()
		return len(manager.threads["thread-1"].thread.Turns) == 1
	})

	thread, _, err := manager.State("thread-1")
	if err != nil {
		t.Fatalf("State() error = %v", err)
	}
	if len(thread.Turns) != 2 || thread.Turns[0].ID != "turn-old" || thread.Turns[1].ID != "turn-live" {
		t.Fatalf("turns = %#v", thread.Turns)
	}
}

func TestTurnFromAppServerPreservesOfficialToolStatuses(t *testing.T) {
	tests := []struct {
		name     string
		itemType string
		statuses []string
	}{
		{
			name:     "command execution",
			itemType: "commandExecution",
			statuses: []string{"inProgress", "completed", "failed", "declined"},
		},
		{
			name:     "file change",
			itemType: "fileChange",
			statuses: []string{"inProgress", "completed", "failed", "declined"},
		},
		{
			name:     "MCP tool call",
			itemType: "mcpToolCall",
			statuses: []string{"inProgress", "completed", "failed"},
		},
		{
			name:     "dynamic tool call",
			itemType: "dynamicToolCall",
			statuses: []string{"inProgress", "completed", "failed"},
		},
	}

	for _, test := range tests {
		for _, status := range test.statuses {
			t.Run(test.name+"/"+status, func(t *testing.T) {
				source := officialToolItem(test.itemType, "tool-1", status)
				item := decodeTestJSON[statusTestItem](rawItems(source)[0])
				if item.Status != status {
					t.Fatalf("Status = %q, want %q", item.Status, status)
				}
			})
		}
	}
}

func TestManagerCompletedToolNotificationPreservesTerminalStatus(t *testing.T) {
	tests := []struct {
		name     string
		itemType string
		status   string
	}{
		{
			name:     "failed command",
			itemType: "commandExecution",
			status:   "failed",
		},
		{
			name:     "declined command",
			itemType: "commandExecution",
			status:   "declined",
		},
		{
			name:     "declined file change",
			itemType: "fileChange",
			status:   "declined",
		},
		{
			name:     "failed MCP tool call",
			itemType: "mcpToolCall",
			status:   "failed",
		},
		{
			name:     "failed dynamic tool call",
			itemType: "dynamicToolCall",
			status:   "failed",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			backend := newFakeBackend()
			manager := NewWithBackend(Config{RootDir: "/workspace"}, backend)
			seedThread(t, manager, backend)
			backend.emit(notification("item/started", map[string]any{
				"threadId":    "thread-1",
				"turnId":      "turn-1",
				"startedAtMs": int64(500),
				"item":        officialToolItem(test.itemType, "tool-1", "inProgress"),
			}))
			item := officialToolItem(test.itemType, "tool-1", test.status)
			backend.emit(notification("item/completed", map[string]any{
				"threadId":      "thread-1",
				"turnId":        "turn-1",
				"completedAtMs": int64(1_000),
				"item":          item,
			}))

			waitForCondition(t, func() bool {
				thread, _, err := manager.State("thread-1")
				if err != nil || len(thread.Turns) != 1 || len(thread.Turns[0].Items) != 1 {
					return false
				}
				return decodeTestJSON[statusTestItem](thread.Turns[0].Items[0]).Status == test.status
			})
		})
	}
}

func TestManagerAssistantDeltaUpdatesSameSequence(t *testing.T) {
	backend := newFakeBackend()
	manager := NewWithBackend(Config{RootDir: "/workspace"}, backend)
	seedThread(t, manager, backend)
	startAgentMessage(backend, "agent-1")
	backend.emit(notification("item/agentMessage/delta", map[string]any{
		"threadId": "thread-1",
		"turnId":   "turn-1",
		"itemId":   "agent-1",
		"delta":    "Hel",
	}))
	backend.emit(notification("item/agentMessage/delta", map[string]any{
		"threadId": "thread-1",
		"turnId":   "turn-1",
		"itemId":   "agent-1",
		"delta":    "lo",
	}))
	waitForCondition(t, func() bool {
		thread, _, err := manager.State("thread-1")
		if err != nil || len(thread.Turns) != 1 || len(thread.Turns[0].Items) != 1 {
			return false
		}
		return decodeTestJSON[agentMessageTestItem](thread.Turns[0].Items[0]).Text == "Hello"
	})
}

func TestManagerAssistantDeltaPreservesWhitespace(t *testing.T) {
	backend := newFakeBackend()
	manager := NewWithBackend(Config{RootDir: "/workspace"}, backend)
	seedThread(t, manager, backend)
	startAgentMessage(backend, "agent-1")
	backend.emit(notification("item/agentMessage/delta", map[string]any{
		"threadId": "thread-1",
		"turnId":   "turn-1",
		"itemId":   "agent-1",
		"delta":    "Streaming",
	}))
	backend.emit(notification("item/agentMessage/delta", map[string]any{
		"threadId": "thread-1",
		"turnId":   "turn-1",
		"itemId":   "agent-1",
		"delta":    " output",
	}))
	waitForCondition(t, func() bool {
		thread, _, err := manager.State("thread-1")
		if err != nil || len(thread.Turns) != 1 || len(thread.Turns[0].Items) != 1 {
			return false
		}
		return decodeTestJSON[agentMessageTestItem](thread.Turns[0].Items[0]).Text == "Streaming output"
	})
}

func TestManagerToolOutputDeltaPreservesWhitespace(t *testing.T) {
	backend := newFakeBackend()
	manager := NewWithBackend(Config{RootDir: "/workspace"}, backend)
	seedThread(t, manager, backend)
	startCommandExecution(backend, "cmd-1")
	backend.emit(notification("item/commandExecution/outputDelta", map[string]any{
		"threadId": "thread-1",
		"turnId":   "turn-1",
		"itemId":   "cmd-1",
		"delta":    "line one",
	}))
	backend.emit(notification("item/commandExecution/outputDelta", map[string]any{
		"threadId": "thread-1",
		"turnId":   "turn-1",
		"itemId":   "cmd-1",
		"delta":    "\n  line two",
	}))
	waitForCondition(t, func() bool {
		thread, _, err := manager.State("thread-1")
		if err != nil || len(thread.Turns) != 1 || len(thread.Turns[0].Items) != 1 {
			return false
		}
		output := decodeTestJSON[commandExecutionTestItem](thread.Turns[0].Items[0]).AggregatedOutput
		return *output == "line one\n  line two"
	})
}

func TestManagerReasoningAndPlanDeltasUpdateOfficialItems(t *testing.T) {
	backend := newFakeBackend()
	manager := NewWithBackend(Config{RootDir: "/workspace"}, backend)
	seedThread(t, manager, backend)
	backend.emit(notification("item/started", map[string]any{
		"threadId":    "thread-1",
		"turnId":      "turn-1",
		"startedAtMs": int64(1_000),
		"item":        reasoningItem("reason-1", []string{}, []string{""}),
	}))
	backend.emit(notification("item/reasoning/summaryPartAdded", map[string]any{
		"threadId":     "thread-1",
		"turnId":       "turn-1",
		"itemId":       "reason-1",
		"summaryIndex": 0,
	}))
	backend.emit(notification("item/reasoning/summaryTextDelta", map[string]any{
		"threadId":     "thread-1",
		"turnId":       "turn-1",
		"itemId":       "reason-1",
		"summaryIndex": 0,
		"delta":        "Inspecting",
	}))
	backend.emit(notification("item/reasoning/textDelta", map[string]any{
		"threadId":     "thread-1",
		"turnId":       "turn-1",
		"itemId":       "reason-1",
		"contentIndex": 0,
		"delta":        "details",
	}))

	waitForCondition(t, func() bool {
		thread, _, err := manager.State("thread-1")
		if err != nil || len(thread.Turns) != 1 || len(thread.Turns[0].Items) != 1 {
			return false
		}
		item := decodeTestJSON[reasoningTestItem](thread.Turns[0].Items[0])
		if len(item.Summary) != 1 || len(item.Content) != 1 {
			return false
		}
		return item.Summary[0] == "Inspecting" && item.Content[0] == "details"
	})

	backend.emit(notification("item/started", map[string]any{
		"threadId":    "thread-1",
		"turnId":      "turn-1",
		"startedAtMs": int64(1_000),
		"item": map[string]any{
			"type": "plan",
			"id":   "plan-1",
			"text": "",
		},
	}))
	backend.emit(notification("item/plan/delta", map[string]any{
		"threadId": "thread-1",
		"turnId":   "turn-1",
		"itemId":   "plan-1",
		"delta":    "Plan text",
	}))

	waitForCondition(t, func() bool {
		thread, _, err := manager.State("thread-1")
		if err != nil || len(thread.Turns) != 1 || len(thread.Turns[0].Items) != 2 {
			return false
		}
		return decodeTestJSON[planTestItem](thread.Turns[0].Items[1]).Text == "Plan text"
	})
}

func TestManagerAgentMessageCompletedReplacesStartedItem(t *testing.T) {
	backend := newFakeBackend()
	manager := NewWithBackend(Config{RootDir: "/workspace"}, backend)
	seedThread(t, manager, backend)
	startAgentMessage(backend, "agent-1")
	backend.emit(notification("item/agentMessage/delta", map[string]any{
		"threadId": "thread-1",
		"turnId":   "turn-1",
		"itemId":   "agent-1",
		"delta":    "partial",
	}))
	backend.emit(notification("item/completed", map[string]any{
		"threadId":      "thread-1",
		"turnId":        "turn-1",
		"completedAtMs": int64(1_000),
		"item":          agentMessageItem("agent-1", "partial answer", stringPtr("final_answer")),
	}))
	waitForCondition(t, func() bool {
		thread, _, err := manager.State("thread-1")
		if err != nil || len(thread.Turns) != 1 || len(thread.Turns[0].Items) != 1 {
			return false
		}
		item := decodeTestJSON[agentMessageTestItem](thread.Turns[0].Items[0])
		return item.Text == "partial answer" &&
			*item.Phase == "final_answer"
	})
}

func TestManagerTurnCompletedUsesCompletedTurn(t *testing.T) {
	backend := newFakeBackend()
	manager := NewWithBackend(Config{RootDir: "/workspace"}, backend)
	seedThread(t, manager, backend)
	startAgentMessage(backend, "agent-1")
	backend.emit(notification("item/agentMessage/delta", map[string]any{
		"threadId": "thread-1",
		"turnId":   "turn-1",
		"itemId":   "agent-1",
		"delta":    "final answer",
	}))
	backend.emit(notification("turn/completed", map[string]any{
		"threadId": "thread-1",
		"turn": officialTurn("turn-1", "completed", rawItems(
			agentMessageItem("agent-1", "final answer", stringPtr("final_answer")),
		)),
	}))

	waitForCondition(t, func() bool {
		thread, _, err := manager.State("thread-1")
		if err != nil || len(thread.Turns) != 1 || thread.Turns[0].Status != "completed" || len(thread.Turns[0].Items) != 1 {
			return false
		}
		return decodeTestJSON[agentMessageTestItem](thread.Turns[0].Items[0]).Text == "final answer"
	})
}

func TestManagerPublishesOfficialTurnErrors(t *testing.T) {
	backend := newFakeBackend()
	manager := NewWithBackend(Config{RootDir: "/workspace"}, backend)
	seedThread(t, manager, backend)
	waitForCondition(t, func() bool {
		thread, _, err := manager.State("thread-1")
		return err == nil && len(thread.Turns) == 1
	})
	updates, unsubscribe := manager.Subscribe()
	defer unsubscribe()

	retry := appserver.ErrorNotification{
		Error: appserver.TurnError{
			Message:           "Reconnecting... 1/5",
			CodexErrorInfo:    json.RawMessage("null"),
			AdditionalDetails: nil,
		},
		WillRetry: true,
		ThreadID:  "thread-1",
		TurnID:    "turn-1",
	}
	backend.emit(notification("error", retry))
	assertTurnErrorUpdate(t, updates, retry)

	failure := appserver.ErrorNotification{
		Error: appserver.TurnError{
			Message:           "unexpected status 503 Service Unavailable",
			CodexErrorInfo:    json.RawMessage("null"),
			AdditionalDetails: nil,
		},
		WillRetry: false,
		ThreadID:  "thread-1",
		TurnID:    "turn-1",
	}
	backend.emit(notification("error", failure))
	assertTurnErrorUpdate(t, updates, failure)
}

func TestManagerTurnCompletedPreservesOfficialError(t *testing.T) {
	backend := newFakeBackend()
	manager := NewWithBackend(Config{RootDir: "/workspace"}, backend)
	seedThread(t, manager, backend)
	completed := officialTurn("turn-1", "failed", []json.RawMessage{})
	completed.Error = &appserver.TurnError{
		Message:           "unexpected status 503 Service Unavailable",
		CodexErrorInfo:    json.RawMessage("null"),
		AdditionalDetails: nil,
	}
	backend.emit(notification("turn/completed", map[string]any{
		"threadId": "thread-1",
		"turn":     completed,
	}))

	waitForCondition(t, func() bool {
		thread, _, err := manager.State("thread-1")
		return err == nil &&
			len(thread.Turns) == 1 &&
			thread.Turns[0].Status == "failed" &&
			thread.Turns[0].Error != nil &&
			thread.Turns[0].Error.Message == completed.Error.Message
	})
}

func TestManagerAgentMessageStartedStoresOfficialItem(t *testing.T) {
	backend := newFakeBackend()
	manager := NewWithBackend(Config{RootDir: "/workspace"}, backend)
	seedThread(t, manager, backend)
	backend.emit(notification("item/started", map[string]any{
		"threadId":    "thread-1",
		"turnId":      "turn-1",
		"startedAtMs": int64(1_000),
		"item":        agentMessageItem("agent-1", "", stringPtr("final_answer")),
	}))

	waitForCondition(t, func() bool {
		thread, _, err := manager.State("thread-1")
		if err != nil || len(thread.Turns) != 1 || len(thread.Turns[0].Items) != 1 {
			return false
		}
		return decodeTestJSON[agentMessageTestItem](thread.Turns[0].Items[0]).Type == "agentMessage"
	})

	backend.emit(notification("item/agentMessage/delta", map[string]any{
		"threadId": "thread-1",
		"turnId":   "turn-1",
		"itemId":   "agent-1",
		"delta":    "partial",
	}))
	waitForCondition(t, func() bool {
		thread, _, err := manager.State("thread-1")
		if err != nil || len(thread.Turns) != 1 || len(thread.Turns[0].Items) != 1 {
			return false
		}
		return decodeTestJSON[agentMessageTestItem](thread.Turns[0].Items[0]).Text == "partial"
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
	backend.threads = []appserver.Thread{officialThread("thread-1", "idle", 100, []appserver.Turn{})}
	backend.readThread = backend.threads[0]
	initializeManager(t, manager)
	if _, _, err := manager.State("thread-1"); err != nil {
		t.Fatalf("State() error = %v", err)
	}
	backend.emit(notification("turn/started", map[string]any{
		"threadId": "thread-1",
		"turn":     officialTurn("turn-1", "inProgress", []json.RawMessage{}),
	}))
}

func startAgentMessage(backend *fakeBackend, itemID string) {
	backend.emit(notification("item/started", map[string]any{
		"threadId":    "thread-1",
		"turnId":      "turn-1",
		"startedAtMs": int64(1_000),
		"item":        agentMessageItem(itemID, "", stringPtr("final_answer")),
	}))
}

func startCommandExecution(backend *fakeBackend, itemID string) {
	backend.emit(notification("item/started", map[string]any{
		"threadId":    "thread-1",
		"turnId":      "turn-1",
		"startedAtMs": int64(1_000),
		"item":        commandExecutionItem(itemID, "inProgress", "printf test", nil),
	}))
}

func (f *fakeBackend) ListThreads(context.Context) ([]appserver.Thread, error) {
	return append([]appserver.Thread(nil), f.threads...), nil
}

func (f *fakeBackend) ReadThread(context.Context, string) (appserver.Thread, error) {
	return f.readThread, nil
}

func (f *fakeBackend) StartThread(context.Context, string) (appserver.Thread, error) {
	f.emit(notification("thread/started", map[string]any{"thread": f.startThread}))
	return f.startThread, nil
}

func (f *fakeBackend) ResumeThread(_ context.Context, threadID, _ string) (appserver.Thread, error) {
	f.resumedThreadID = threadID
	return f.resumeThread, nil
}

func (f *fakeBackend) StartTurn(_ context.Context, threadID, prompt, _ string) error {
	f.startedTurnThreadID = threadID
	f.startedTurnPrompt = prompt
	f.emit(notification("turn/started", map[string]any{
		"threadId": threadID,
		"turn":     f.startTurn,
	}))
	return nil
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
	f.emit(notification("item/started", map[string]any{
		"threadId":    threadID,
		"turnId":      "turn-1",
		"startedAtMs": int64(1_000),
		"item":        userMessageItem(itemID, text),
	}))
}

func initializeManager(t *testing.T, manager *Manager) {
	t.Helper()
	if err := manager.Initialize(context.Background()); err != nil {
		t.Fatalf("Initialize() error = %v", err)
	}
}

func officialTurn(id, status string, items []json.RawMessage) appserver.Turn {
	return appserver.Turn{
		ID:          id,
		Items:       items,
		ItemsView:   "full",
		Status:      status,
		Error:       nil,
		StartedAt:   nil,
		CompletedAt: nil,
		DurationMs:  nil,
	}
}

func officialThread(id, status string, updatedAt int64, turns []appserver.Turn) appserver.Thread {
	return appserver.Thread{
		ID:             id,
		Extra:          json.RawMessage("null"),
		SessionID:      id,
		ForkedFromID:   nil,
		ParentThreadID: nil,
		Preview:        "",
		Ephemeral:      false,
		HistoryMode:    "legacy",
		ModelProvider:  "openai",
		CreatedAt:      updatedAt,
		UpdatedAt:      updatedAt,
		RecencyAt:      nil,
		Status:         appserver.ThreadStatus{Type: status},
		Path:           nil,
		CWD:            "/workspace",
		CLIVersion:     "0.144.1",
		Source:         json.RawMessage(`"appServer"`),
		ThreadSource:   stringPtr("codexWeb"),
		AgentNickname:  nil,
		AgentRole:      nil,
		GitInfo:        nil,
		Name:           nil,
		Turns:          turns,
	}
}

func userMessageItem(id, text string) map[string]any {
	return map[string]any{
		"type":     "userMessage",
		"id":       id,
		"clientId": nil,
		"content": []any{
			map[string]any{"type": "text", "text": text, "text_elements": []any{}},
		},
	}
}

func agentMessageItem(id, text string, phase *string) map[string]any {
	return map[string]any{
		"type":           "agentMessage",
		"id":             id,
		"text":           text,
		"phase":          phase,
		"memoryCitation": nil,
	}
}

func reasoningItem(id string, summary, content []string) map[string]any {
	return map[string]any{
		"type":    "reasoning",
		"id":      id,
		"summary": summary,
		"content": content,
	}
}

func commandExecutionItem(id, status, command string, output *string) map[string]any {
	return map[string]any{
		"type":             "commandExecution",
		"id":               id,
		"command":          command,
		"cwd":              "/workspace",
		"processId":        nil,
		"source":           "agent",
		"status":           status,
		"commandActions":   []any{},
		"aggregatedOutput": output,
		"exitCode":         nil,
		"durationMs":       nil,
	}
}

func officialToolItem(itemType, id, status string) map[string]any {
	switch itemType {
	case "commandExecution":
		return commandExecutionItem(id, status, "printf test", nil)
	case "fileChange":
		return map[string]any{
			"type":    "fileChange",
			"id":      id,
			"changes": []any{},
			"status":  status,
		}
	case "mcpToolCall":
		return map[string]any{
			"type":       "mcpToolCall",
			"id":         id,
			"server":     "test-server",
			"tool":       "lookup",
			"status":     status,
			"arguments":  map[string]any{},
			"appContext": nil,
			"pluginId":   nil,
			"result":     nil,
			"error":      nil,
			"durationMs": nil,
		}
	case "dynamicToolCall":
		return map[string]any{
			"type":         "dynamicToolCall",
			"id":           id,
			"namespace":    nil,
			"tool":         "lookup",
			"arguments":    map[string]any{},
			"status":       status,
			"contentItems": nil,
			"success":      nil,
			"durationMs":   nil,
		}
	}
	panic("unhandled tool item type: " + itemType)
}

func int64Ptr(value int64) *int64 {
	return &value
}

func stringPtr(value string) *string {
	return &value
}

func notification(method string, params any) appserver.Notification {
	payload, err := json.Marshal(params)
	if err != nil {
		panic(err)
	}
	return appserver.Notification{Method: method, Params: payload}
}

func decodeTestJSON[T any](raw json.RawMessage) T {
	var value T
	if err := json.Unmarshal(raw, &value); err != nil {
		panic(err)
	}
	return value
}

func rawItems(items ...map[string]any) []json.RawMessage {
	out := make([]json.RawMessage, 0, len(items))
	for _, item := range items {
		payload, err := json.Marshal(item)
		if err != nil {
			panic(err)
		}
		out = append(out, payload)
	}
	return out
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

func assertTurnErrorUpdate(t *testing.T, updates <-chan StateUpdate, want appserver.ErrorNotification) {
	t.Helper()
	select {
	case update := <-updates:
		if update.Type != "turnError" || update.ThreadID != want.ThreadID {
			t.Fatalf("update = %#v", update)
		}
		got := decodeTestJSON[appserver.ErrorNotification](update.Data)
		if got.Error.Message != want.Error.Message ||
			got.WillRetry != want.WillRetry ||
			got.ThreadID != want.ThreadID ||
			got.TurnID != want.TurnID {
			t.Fatalf("turn error = %#v, want %#v", got, want)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for turn error update")
	}
}
