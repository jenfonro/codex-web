package session

import (
	"context"
	"os"
	"path/filepath"
	"strconv"
	"strings"
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
		`{"timestamp":"2026-07-04T01:00:04Z","type":"response_item","payload":{"type":"function_call","name":"exec_command","call_id":"call-1","arguments":"{\"cmd\":\"git status --short\",\"workdir\":\"/workspace\"}"}}`,
		`{"timestamp":"2026-07-04T01:00:04Z","type":"response_item","payload":{"type":"function_call_output","call_id":"call-1","output":"Chunk ID: abc\nProcess exited with code 0\nOutput:\n M file.go\n"}}`,
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
	want := []string{"user_message", "summary", "tool_call", "tool_output", "assistant_message"}
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
	toolCall := parsed.events[2]
	if got := toolCall.Data["arguments"]; got == "" {
		t.Fatalf("tool_call arguments missing: %#v", toolCall.Data)
	}
	args, ok := toolCall.Data["args"].(map[string]any)
	if !ok || args["cmd"] != "git status --short" || args["workdir"] != "/workspace" {
		t.Fatalf("tool_call args = %#v", toolCall.Data["args"])
	}
	toolOutput := parsed.events[3]
	if toolOutput.Data["call_id"] != "call-1" || toolOutput.Data["output"] == "" {
		t.Fatalf("tool_output data = %#v", toolOutput.Data)
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
	page, err := manager.Events(model.SessionEventsRequest{SessionID: second})
	if err != nil {
		t.Fatalf("Events() error = %v", err)
	}
	events := page.Events
	if len(events) != 1 || events[0].Text != "second prompt" {
		t.Fatalf("Events() = %#v", events)
	}
}

func TestManagerListUsesSessionIndexThreadName(t *testing.T) {
	codexHome := t.TempDir()
	sessionID := "619f2402-138c-7092-8098-7fcb30ade7f1"
	writeHistoryFile(t, codexHome, sessionID, []string{
		`{"timestamp":"2026-07-04T01:00:00Z","type":"session_meta","payload":{"session_id":"` + sessionID + `","cwd":"/workspace"}}`,
		`{"timestamp":"2026-07-04T01:00:01Z","type":"event_msg","payload":{"type":"user_message","message":"this is the first user prompt and should not become the list title"}}`,
	})
	writeHistoryTitleIndex(t, codexHome, []string{
		`{"id":"` + sessionID + `","thread_name":"Short task name","updated_at":"2026-07-04T01:00:02Z"}`,
	})

	manager := New(Config{CodexHome: codexHome, RootDir: "/workspace", CodexBin: "codex"})
	got := manager.List()
	if len(got) != 1 {
		t.Fatalf("List() len = %d, want 1: %#v", len(got), got)
	}
	if got[0].Title != "Short task name" {
		t.Fatalf("Title = %q, want session index thread_name", got[0].Title)
	}
}

func TestManagerListRefreshesSessionIndexThreadName(t *testing.T) {
	codexHome := t.TempDir()
	sessionID := "719f2402-138c-7092-8098-7fcb30ade7f1"
	writeHistoryFile(t, codexHome, sessionID, []string{
		`{"timestamp":"2026-07-04T01:00:00Z","type":"session_meta","payload":{"session_id":"` + sessionID + `","cwd":"/workspace"}}`,
		`{"timestamp":"2026-07-04T01:00:01Z","type":"event_msg","payload":{"type":"user_message","message":"fallback prompt title"}}`,
	})

	manager := New(Config{CodexHome: codexHome, RootDir: "/workspace", CodexBin: "codex"})
	if got := manager.List()[0].Title; got != "fallback prompt title" {
		t.Fatalf("initial Title = %q", got)
	}

	writeHistoryTitleIndex(t, codexHome, []string{
		`{"id":"` + sessionID + `","thread_name":"Indexed task title","updated_at":"2026-07-04T01:00:02Z"}`,
	})
	if got := manager.List()[0].Title; got != "Indexed task title" {
		t.Fatalf("refreshed Title = %q, want session index thread_name", got)
	}
}

func TestManagerEventsPaginatesFromTailAndBeforeSeq(t *testing.T) {
	manager := New(Config{CodexHome: t.TempDir(), RootDir: "/workspace", CodexBin: "codex"})
	manager.sessions["session-1"] = &managedSession{
		record: model.SessionRecord{ID: "session-1", LastSeq: 5, CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()},
		events: []model.SessionEvent{
			{SessionID: "session-1", Seq: 1, Kind: "user_message", Text: "one"},
			{SessionID: "session-1", Seq: 2, Kind: "assistant_message", Text: "two"},
			{SessionID: "session-1", Seq: 3, Kind: "user_message", Text: "three"},
			{SessionID: "session-1", Seq: 4, Kind: "assistant_message", Text: "four"},
			{SessionID: "session-1", Seq: 5, Kind: "assistant_message", Text: "five"},
		},
	}

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

	page, err = manager.Events(model.SessionEventsRequest{SessionID: "session-1", LastSeq: 3})
	if err != nil {
		t.Fatalf("Events(lastSeq) error = %v", err)
	}
	if got := eventSeqs(page.Events); got != "4,5" {
		t.Fatalf("lastSeq page seqs = %s", got)
	}
}

func TestManagerEventsUsesIndexedHistoryWithoutStoringFullEvents(t *testing.T) {
	codexHome := t.TempDir()
	sessionID := "319f2402-138c-7092-8098-7fcb30ade7f1"
	writeHistoryFile(t, codexHome, sessionID, []string{
		`{"timestamp":"2026-07-04T01:00:00Z","type":"session_meta","payload":{"session_id":"` + sessionID + `","cwd":"/workspace"}}`,
		`{"timestamp":"2026-07-04T01:00:01Z","type":"event_msg","payload":{"type":"user_message","message":"one"}}`,
		`{"timestamp":"2026-07-04T01:00:02Z","type":"event_msg","payload":{"type":"agent_message","message":"two"}}`,
		`{"timestamp":"2026-07-04T01:00:03Z","type":"event_msg","payload":{"type":"user_message","message":"three"}}`,
	})

	manager := New(Config{CodexHome: codexHome, RootDir: "/workspace", CodexBin: "codex"})
	session := manager.sessions[sessionID]
	if session == nil {
		t.Fatalf("session was not indexed")
	}
	if len(session.events) != 0 {
		t.Fatalf("indexed history stored full events, len = %d", len(session.events))
	}
	if len(session.historyEvents) != 3 {
		t.Fatalf("historyEvents len = %d, want 3", len(session.historyEvents))
	}

	page, err := manager.Events(model.SessionEventsRequest{SessionID: sessionID, Limit: 2})
	if err != nil {
		t.Fatalf("Events() error = %v", err)
	}
	if got := eventSeqs(page.Events); got != "2,3" || !page.HasMoreBefore {
		t.Fatalf("indexed page = %#v, seqs = %s", page, got)
	}
}

func TestManagerEventsCombinesIndexedHistoryWithRunningMemoryEvents(t *testing.T) {
	codexHome := t.TempDir()
	sessionID := "419f2402-138c-7092-8098-7fcb30ade7f1"
	writeHistoryFile(t, codexHome, sessionID, []string{
		`{"timestamp":"2026-07-04T01:00:00Z","type":"session_meta","payload":{"session_id":"` + sessionID + `","cwd":"/workspace"}}`,
		`{"timestamp":"2026-07-04T01:00:01Z","type":"event_msg","payload":{"type":"user_message","message":"one"}}`,
		`{"timestamp":"2026-07-04T01:00:02Z","type":"event_msg","payload":{"type":"agent_message","message":"two"}}`,
		`{"timestamp":"2026-07-04T01:00:03Z","type":"event_msg","payload":{"type":"agent_message","message":"three"}}`,
	})

	manager := New(Config{CodexHome: codexHome, RootDir: "/workspace", CodexBin: "codex"})
	_, cancel := context.WithCancel(context.Background())
	defer cancel()
	manager.sessions[sessionID].cancel = cancel
	manager.appendEvent(sessionID, "user_message", "live prompt", nil)

	page, err := manager.Events(model.SessionEventsRequest{SessionID: sessionID, Limit: 2})
	if err != nil {
		t.Fatalf("Events(tail) error = %v", err)
	}
	if got := eventSeqs(page.Events); got != "3,4" || page.Events[1].Text != "live prompt" {
		t.Fatalf("combined tail page = %#v, seqs = %s", page, got)
	}

	page, err = manager.Events(model.SessionEventsRequest{SessionID: sessionID, BeforeSeq: 4, Limit: 2})
	if err != nil {
		t.Fatalf("Events(before) error = %v", err)
	}
	if got := eventSeqs(page.Events); got != "2,3" {
		t.Fatalf("combined before page seqs = %s, page = %#v", got, page)
	}

	page, err = manager.Events(model.SessionEventsRequest{SessionID: sessionID, LastSeq: 3})
	if err != nil {
		t.Fatalf("Events(lastSeq) error = %v", err)
	}
	if got := eventSeqs(page.Events); got != "4" || page.Events[0].Text != "live prompt" {
		t.Fatalf("combined lastSeq page = %#v, seqs = %s", page, got)
	}
}

func TestManagerRefreshDetectsHistoryFileSizeChanges(t *testing.T) {
	codexHome := t.TempDir()
	sessionID := "519f2402-138c-7092-8098-7fcb30ade7f1"
	path := writeHistoryFile(t, codexHome, sessionID, []string{
		`{"timestamp":"2026-07-04T01:00:00Z","type":"session_meta","payload":{"session_id":"` + sessionID + `","cwd":"/workspace"}}`,
		`{"timestamp":"2026-07-04T01:00:01Z","type":"event_msg","payload":{"type":"user_message","message":"cached prompt"}}`,
	})
	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("Stat() error = %v", err)
	}

	manager := New(Config{CodexHome: codexHome, RootDir: "/workspace", CodexBin: "codex"})
	page, err := manager.Events(model.SessionEventsRequest{SessionID: sessionID})
	if err != nil {
		t.Fatalf("Events(initial) error = %v", err)
	}
	if len(page.Events) != 1 || page.Events[0].Text != "cached prompt" {
		t.Fatalf("initial events = %#v", page.Events)
	}

	replacement := strings.Join([]string{
		`{"timestamp":"2026-07-04T01:00:00Z","type":"session_meta","payload":{"session_id":"` + sessionID + `","cwd":"/workspace"}}`,
		`{"timestamp":"2026-07-04T01:00:01Z","type":"event_msg","payload":{"type":"user_message","message":"reparsed prompt"}}`,
	}, "\n") + "\n"
	if err := os.WriteFile(path, []byte(replacement), 0o600); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}
	if err := os.Chtimes(path, info.ModTime(), info.ModTime()); err != nil {
		t.Fatalf("Chtimes() error = %v", err)
	}

	page, err = manager.Events(model.SessionEventsRequest{SessionID: sessionID})
	if err != nil {
		t.Fatalf("Events(reparsed) error = %v", err)
	}
	if len(page.Events) != 1 || page.Events[0].Text != "reparsed prompt" {
		t.Fatalf("size-changed history was not reindexed: %#v", page.Events)
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

func writeHistoryTitleIndex(t *testing.T, codexHome string, lines []string) string {
	t.Helper()
	path := filepath.Join(codexHome, "session_index.test.jsonl")
	data := strings.Join(lines, "\n") + "\n"
	if err := os.WriteFile(path, []byte(data), 0o600); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}
	return path
}

func eventSeqs(events []model.SessionEvent) string {
	seqs := make([]string, 0, len(events))
	for _, event := range events {
		seqs = append(seqs, strconv.FormatInt(event.Seq, 10))
	}
	return strings.Join(seqs, ",")
}
