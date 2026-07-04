package session

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"codex-web/agent/internal/model"
)

const testSessionID = "019f2402-138c-7092-8098-7fcb30ade7f1"

func TestParseHistoryFile(t *testing.T) {
	path := writeHistoryFile(t, t.TempDir(), testSessionID, []string{
		`{"timestamp":"2026-07-04T01:00:00Z","type":"session_meta","payload":{"session_id":"` + testSessionID + `","cwd":"/workspace","timestamp":"2026-07-04T01:00:00Z"}}`,
		`{"timestamp":"2026-07-04T01:00:01Z","type":"event_msg","payload":{"type":"task_started"}}`,
		`{"timestamp":"2026-07-04T01:00:02Z","type":"event_msg","payload":{"type":"user_message","message":"inspect the repo"}}`,
		`{"timestamp":"2026-07-04T01:00:03Z","type":"response_item","payload":{"type":"reasoning","summary":[{"text":"Checked the workspace"}]}}`,
		`{"timestamp":"2026-07-04T01:00:04Z","type":"response_item","payload":{"type":"function_call","name":"exec_command","call_id":"call-1"}}`,
		`{"timestamp":"2026-07-04T01:00:05Z","type":"event_msg","payload":{"type":"agent_message","message":"Done.","phase":"final_answer"}}`,
		`{"timestamp":"2026-07-04T01:00:06Z","type":"event_msg","payload":{"type":"task_complete"}}`,
	})

	parsed, err := parseHistoryFile(path)
	if err != nil {
		t.Fatalf("parseHistoryFile() error = %v", err)
	}
	if parsed.record.ID != testSessionID || parsed.record.CodexThreadID != testSessionID {
		t.Fatalf("record IDs = %q/%q", parsed.record.ID, parsed.record.CodexThreadID)
	}
	if parsed.record.CWD != "/workspace" {
		t.Fatalf("CWD = %q", parsed.record.CWD)
	}
	if parsed.record.Title != "inspect the repo" {
		t.Fatalf("Title = %q", parsed.record.Title)
	}
	kinds := make([]string, 0, len(parsed.events))
	for _, event := range parsed.events {
		kinds = append(kinds, event.Kind)
		if event.SessionID != testSessionID {
			t.Fatalf("event session = %q", event.SessionID)
		}
	}
	want := []string{"user_message", "summary", "tool_call", "assistant_message"}
	if len(kinds) != len(want) {
		t.Fatalf("kinds = %#v, want %#v", kinds, want)
	}
	for index := range want {
		if kinds[index] != want[index] {
			t.Fatalf("kinds = %#v, want %#v", kinds, want)
		}
	}
	if parsed.record.LastSeq != int64(len(want)) {
		t.Fatalf("LastSeq = %d", parsed.record.LastSeq)
	}
}

func TestManagerListRefreshesHistory(t *testing.T) {
	codexHome := t.TempDir()
	first := "119f2402-138c-7092-8098-7fcb30ade7f1"
	second := "219f2402-138c-7092-8098-7fcb30ade7f1"
	writeHistoryFile(t, codexHome, first, []string{
		`{"timestamp":"2026-07-04T01:00:00Z","type":"session_meta","payload":{"session_id":"` + first + `","cwd":"/workspace"}}`,
		`{"timestamp":"2026-07-04T01:00:01Z","type":"event_msg","payload":{"type":"user_message","message":"first prompt"}}`,
	})

	manager := New(Config{CodexHome: codexHome, RootDir: "/workspace", CodexBin: "codex"})
	if got := manager.List(); len(got) != 1 || got[0].ID != first {
		t.Fatalf("initial List() = %#v", got)
	}

	writeHistoryFile(t, codexHome, second, []string{
		`{"timestamp":"2026-07-04T02:00:00Z","type":"session_meta","payload":{"session_id":"` + second + `","cwd":"/workspace"}}`,
		`{"timestamp":"2026-07-04T02:00:01Z","type":"event_msg","payload":{"type":"user_message","message":"second prompt"}}`,
	})
	got := manager.List()
	if len(got) != 2 {
		t.Fatalf("refreshed List() len = %d, want 2: %#v", len(got), got)
	}
	if got[0].ID != second {
		t.Fatalf("List() sort = %#v, want newest session first", got)
	}
	events, err := manager.Events(second, 0)
	if err != nil {
		t.Fatalf("Events() error = %v", err)
	}
	if len(events) != 1 || events[0].Text != "second prompt" {
		t.Fatalf("Events() = %#v", events)
	}
}

func TestItemTextTreatsCLIConfigWarningAsNonFatal(t *testing.T) {
	text, kind := itemText(map[string]any{
		"type":    "error",
		"message": "Ignored unsupported project-local config keys in /workspace/.codex/config.toml: model_provider, model_providers.",
	})
	if text != "" || kind != "" {
		t.Fatalf("itemText() = %q/%q, want skipped warning", text, kind)
	}

	text, kind = itemText(map[string]any{"type": "error", "message": "real stderr"})
	if text != "real stderr" || kind != "stderr" {
		t.Fatalf("itemText() = %q/%q, want stderr", text, kind)
	}
}

func TestHandleCLIEventBroadcastsTurnCompleted(t *testing.T) {
	manager := New(Config{CodexHome: t.TempDir(), RootDir: "/workspace", CodexBin: "codex"})
	manager.sessions["session-1"] = &managedSession{
		record: model.SessionRecord{ID: "session-1", Status: statusRunning, CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()},
	}
	events, unsubscribe := manager.Subscribe()
	defer unsubscribe()

	manager.handleCLIEvent("session-1", map[string]any{
		"type":      "event_msg",
		"timestamp": "2026-07-04T01:00:06Z",
		"payload": map[string]any{
			"type": "task_complete",
		},
	})

	select {
	case event := <-events:
		if event.Kind != "turn_completed" {
			t.Fatalf("event.Kind = %q, want turn_completed", event.Kind)
		}
	case <-time.After(time.Second):
		t.Fatalf("timed out waiting for turn_completed")
	}
	if got := manager.sessions["session-1"].record.Status; got != statusIdle {
		t.Fatalf("status = %q, want %q", got, statusIdle)
	}
}

func writeHistoryFile(t *testing.T, codexHome, sessionID string, lines []string) string {
	t.Helper()
	dir := filepath.Join(codexHome, "sessions", "2026", "07", "04")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}
	path := filepath.Join(dir, "rollout-2026-07-04T01-00-00-"+sessionID+".jsonl")
	data := ""
	for _, line := range lines {
		data += line + "\n"
	}
	if err := os.WriteFile(path, []byte(data), 0o600); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}
	return path
}
