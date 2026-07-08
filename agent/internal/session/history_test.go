package session

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
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
	if got := toolCall.Data["status"]; got != "completed" {
		t.Fatalf("history tool_call status = %#v, want completed", got)
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

func TestParseHistoryFileIncludesPatchApplyFileChange(t *testing.T) {
	path := writeHistoryFile(t, t.TempDir(), testSessionID, []string{
		`{"timestamp":"2026-07-04T01:00:00Z","type":"session_meta","payload":{"session_id":"` + testSessionID + `","cwd":"/workspace"}}`,
		`{"timestamp":"2026-07-04T01:00:01Z","type":"event_msg","payload":{"type":"user_message","message":"edit files"}}`,
		`{"timestamp":"2026-07-04T01:00:02Z","type":"event_msg","payload":{"type":"patch_apply_end","call_id":"call-patch","success":true,"changes":{"/workspace/frontend/src/app.js":{"type":"update","unified_diff":"@@\n-old\n+new\n+extra\n","move_path":null},"/workspace/frontend/src/new.js":{"type":"add","unified_diff":"@@\n+created\n","move_path":null}},"status":"completed"}}`,
		`{"timestamp":"2026-07-04T01:00:03Z","type":"event_msg","payload":{"type":"agent_message","message":"Done.","phase":"final_answer"}}`,
	})

	parsed, err := parseHistoryFile(path)
	if err != nil {
		t.Fatalf("parseHistoryFile() error = %v", err)
	}
	if len(parsed.events) != 3 {
		t.Fatalf("events = %#v, want 3 visible events", parsed.events)
	}
	event := parsed.events[1]
	if event.Kind != "file_change" || event.Text != "\u5df2\u7f16\u8f91 2 \u4e2a\u6587\u4ef6" {
		t.Fatalf("file change event = %#v", event)
	}
	if event.Data["type"] != "file_change" || event.Data["status"] != "completed" || event.Data["call_id"] != "call-patch" {
		t.Fatalf("file change data = %#v", event.Data)
	}
	files, ok := event.Data["files"].([]map[string]any)
	if !ok || len(files) != 2 {
		t.Fatalf("file change files = %#v", event.Data["files"])
	}
	if files[0]["path"] != "/workspace/frontend/src/app.js" || files[0]["type"] != "update" || files[0]["additions"] != 2 || files[0]["deletions"] != 1 {
		t.Fatalf("first file = %#v", files[0])
	}
	if files[0]["unifiedDiff"] != "@@\n-old\n+new\n+extra" {
		t.Fatalf("first file unifiedDiff = %#v", files[0]["unifiedDiff"])
	}
	if files[1]["path"] != "/workspace/frontend/src/new.js" || files[1]["type"] != "add" || files[1]["additions"] != 1 || files[1]["deletions"] != 0 {
		t.Fatalf("second file = %#v", files[1])
	}
	if files[1]["unifiedDiff"] != "@@\n+created" {
		t.Fatalf("second file unifiedDiff = %#v", files[1]["unifiedDiff"])
	}
}

func TestParseHistoryFilePreservesUserImageAttachments(t *testing.T) {
	path := writeHistoryFile(t, t.TempDir(), testSessionID, []string{
		`{"timestamp":"2026-07-04T01:00:00Z","type":"session_meta","payload":{"session_id":"` + testSessionID + `","cwd":"/workspace"}}`,
		`{"timestamp":"2026-07-04T01:00:01Z","type":"event_msg","payload":{"type":"user_message","message":"where is it","images":["data:image/png;base64,abc"],"local_images":["/tmp/screenshot.png"],"text_elements":[]}}`,
	})

	parsed, err := parseHistoryFile(path)
	if err != nil {
		t.Fatalf("parseHistoryFile() error = %v", err)
	}
	if len(parsed.events) != 1 {
		t.Fatalf("events = %#v, want one user event", parsed.events)
	}
	attachments, ok := parsed.events[0].Data["attachments"].([]map[string]any)
	if !ok || len(attachments) != 2 {
		t.Fatalf("attachments = %#v", parsed.events[0].Data["attachments"])
	}
	if attachments[0]["src"] != "data:image/png;base64,abc" || attachments[0]["label"] != "用户附件" {
		t.Fatalf("first attachment = %#v", attachments[0])
	}
	if attachments[1]["src"] != "/tmp/screenshot.png" || attachments[1]["label"] != "用户附件" {
		t.Fatalf("second attachment = %#v", attachments[1])
	}
}

func TestParseHistoryFileCountsAddedContentWithoutUnifiedDiff(t *testing.T) {
	path := writeHistoryFile(t, t.TempDir(), testSessionID, []string{
		`{"timestamp":"2026-07-04T01:00:00Z","type":"session_meta","payload":{"session_id":"` + testSessionID + `","cwd":"/workspace"}}`,
		`{"timestamp":"2026-07-04T01:00:01Z","type":"event_msg","payload":{"type":"user_message","message":"create file"}}`,
		`{"timestamp":"2026-07-04T01:00:02Z","type":"event_msg","payload":{"type":"patch_apply_end","call_id":"call-patch","success":true,"changes":{"/workspace/cdp-full-capture.mjs":{"type":"add","content":"line 1\nline 2\nline 3\n","move_path":null}},"status":"completed"}}`,
	})

	parsed, err := parseHistoryFile(path)
	if err != nil {
		t.Fatalf("parseHistoryFile() error = %v", err)
	}
	event := parsed.events[1]
	files, ok := event.Data["files"].([]map[string]any)
	if !ok || len(files) != 1 {
		t.Fatalf("file change files = %#v", event.Data["files"])
	}
	if files[0]["additions"] != 3 || files[0]["deletions"] != 0 {
		t.Fatalf("file stats = %#v, want +3 -0", files[0])
	}
	if files[0]["content"] != "line 1\nline 2\nline 3" {
		t.Fatalf("file content = %#v", files[0]["content"])
	}
}

func TestCompactSessionEventsOmitHeavyDetails(t *testing.T) {
	events := []model.SessionEvent{
		{
			Seq:  1,
			Kind: "tool_output",
			Text: strings.Repeat("output", 100),
			Data: map[string]any{
				"call_id": "call-1",
				"output":  strings.Repeat("x", 1000),
				"status":  "completed",
			},
		},
		{
			Seq:  2,
			Kind: "file_change",
			Text: "\u5df2\u7f16\u8f91 1 \u4e2a\u6587\u4ef6",
			Data: map[string]any{
				"files": []map[string]any{
					{
						"path":        "frontend/src/app.js",
						"type":        "modify",
						"additions":   3,
						"deletions":   1,
						"unifiedDiff": "@@ -1 +1 @@\n-old\n+new\n",
					},
				},
			},
		},
	}

	compacted := compactSessionEvents(events, false)
	if compacted[0].Text != "" {
		t.Fatalf("tool output text was not omitted")
	}
	if _, ok := compacted[0].Data["output"]; ok {
		t.Fatalf("tool output data still contains output: %#v", compacted[0].Data)
	}
	if compacted[0].Data["outputOmitted"] != true {
		t.Fatalf("tool output missing omission marker: %#v", compacted[0].Data)
	}
	if events[0].Text == "" || events[0].Data["output"] == nil {
		t.Fatalf("compactSessionEvents mutated original tool output")
	}

	files, ok := compacted[1].Data["files"].([]map[string]any)
	if !ok || len(files) != 1 {
		t.Fatalf("compacted file list = %#v", compacted[1].Data["files"])
	}
	if _, ok := files[0]["unifiedDiff"]; ok {
		t.Fatalf("file change still contains unifiedDiff: %#v", files[0])
	}
	if files[0]["detailOmitted"] != true || files[0]["path"] != "frontend/src/app.js" {
		t.Fatalf("file change compact metadata = %#v", files[0])
	}
	if originalFiles := events[1].Data["files"].([]map[string]any); originalFiles[0]["unifiedDiff"] == nil {
		t.Fatalf("compactSessionEvents mutated original file diff")
	}
}

func TestCompactSessionEventsCanKeepFileDetails(t *testing.T) {
	events := []model.SessionEvent{
		{
			Seq:  1,
			Kind: "tool_output",
			Text: strings.Repeat("output", 100),
			Data: map[string]any{
				"call_id": "call-1",
				"output":  strings.Repeat("x", 1000),
				"status":  "completed",
			},
		},
		{
			Seq:  2,
			Kind: "file_change",
			Text: "\u5df2\u521b\u5efa 1 \u4e2a\u6587\u4ef6",
			Data: map[string]any{
				"files": []map[string]any{
					{
						"path":        "frontend/src/app.js",
						"type":        "add",
						"additions":   2,
						"deletions":   0,
						"unifiedDiff": "@@ -0,0 +1,2 @@\n+one\n+two\n",
					},
				},
			},
		},
	}

	compacted := compactSessionEvents(events, true)
	if compacted[0].Text != "" || compacted[0].Data["outputOmitted"] != true {
		t.Fatalf("tool output was not compacted with file details enabled: %#v", compacted[0])
	}
	files, ok := compacted[1].Data["files"].([]map[string]any)
	if !ok || len(files) != 1 {
		t.Fatalf("file change files = %#v", compacted[1].Data["files"])
	}
	if files[0]["unifiedDiff"] == "" || files[0]["detailOmitted"] != nil {
		t.Fatalf("file details were not preserved: %#v", files[0])
	}
}

func TestLiveFunctionCallStartsRunningAndHistoryCompletes(t *testing.T) {
	entry := historyEntry{
		Type:      "response_item",
		Timestamp: "2026-07-04T01:00:04Z",
		Payload: map[string]any{
			"type":      "function_call",
			"name":      "exec_command",
			"call_id":   "call-live",
			"arguments": `{"cmd":"sleep 10","workdir":"/workspace"}`,
		},
	}
	eventTime := time.Date(2026, 7, 4, 1, 0, 4, 0, time.UTC)

	live, ok := eventFromHistoryEntry(entry, eventTime, true)
	if !ok {
		t.Fatalf("live function_call was not parsed")
	}
	if live.Kind != "tool_call" || live.Text != "exec_command" {
		t.Fatalf("live event = %#v", live)
	}
	if got := live.Data["status"]; got != "running" {
		t.Fatalf("live tool_call status = %#v, want running", got)
	}

	history, ok := eventFromHistoryEntry(entry, eventTime, false)
	if !ok {
		t.Fatalf("history function_call was not parsed")
	}
	if got := history.Data["status"]; got != "completed" {
		t.Fatalf("history tool_call status = %#v, want completed", got)
	}
}

func TestParseHistoryFileIncludesToolCallResponseItems(t *testing.T) {
	codexHome := t.TempDir()
	sessionID := "619f2402-138c-7092-8098-7fcb30ade7f1"
	path := writeHistoryFile(t, codexHome, sessionID, []string{
		`{"timestamp":"2026-07-04T01:00:00Z","type":"session_meta","payload":{"session_id":"` + sessionID + `","cwd":"/workspace"}}`,
		`{"timestamp":"2026-07-04T01:00:01Z","type":"event_msg","payload":{"type":"user_message","message":"check repo"}}`,
		`{"timestamp":"2026-07-04T01:00:02Z","type":"response_item","payload":{"type":"tool_call","name":"exec_command","call_id":"call-2","arguments":"{\"cmd\":\"git diff\",\"workdir\":\"/workspace\"}"}}`,
		`{"timestamp":"2026-07-04T01:00:03Z","type":"response_item","payload":{"type":"tool_call_output","call_id":"call-2","output":"Process exited with code 0\nOutput:\ndiff --git a/file.go b/file.go\n"}}`,
		`{"timestamp":"2026-07-04T01:00:04Z","type":"event_msg","payload":{"type":"agent_message","message":"Done.","phase":"final_answer"}}`,
	})

	parsed, err := parseHistoryFile(path)
	if err != nil {
		t.Fatalf("parseHistoryFile() error = %v", err)
	}
	if parsed.record.LastSeq != 4 {
		t.Fatalf("LastSeq = %d, want indexed visible tool call events", parsed.record.LastSeq)
	}
	if len(parsed.eventRefs) != 4 {
		t.Fatalf("eventRefs len = %d, want 4", len(parsed.eventRefs))
	}
	if len(parsed.events) != 4 {
		t.Fatalf("events len = %d, want 4: %#v", len(parsed.events), parsed.events)
	}
	if parsed.events[1].Kind != "tool_call" || parsed.events[1].Text != "exec_command" {
		t.Fatalf("tool_call event = %#v", parsed.events[1])
	}
	if got := parsed.events[1].Data["status"]; got != "completed" {
		t.Fatalf("tool_call status = %#v, want completed", got)
	}
	args, ok := parsed.events[1].Data["args"].(map[string]any)
	if !ok || args["cmd"] != "git diff" || args["workdir"] != "/workspace" {
		t.Fatalf("tool_call args = %#v", parsed.events[1].Data["args"])
	}
	if parsed.events[2].Kind != "tool_output" || parsed.events[2].Data["output"] == "" {
		t.Fatalf("tool_output event = %#v", parsed.events[2])
	}
	if parsed.events[2].Data["call_id"] != "call-2" {
		t.Fatalf("tool_output call_id = %#v", parsed.events[2].Data)
	}
}

func TestTaskCompleteDurationBecomesInlineSummaryInHistory(t *testing.T) {
	entry := historyEntry{
		Type:      "event_msg",
		Timestamp: "2026-07-04T01:00:06Z",
		Payload: map[string]any{
			"type":                   "task_complete",
			"duration_ms":            float64(125000),
			"time_to_first_token_ms": float64(2700),
		},
	}
	eventTime := time.Date(2026, 7, 4, 1, 0, 6, 0, time.UTC)

	history, ok := eventFromHistoryEntry(entry, eventTime, false)
	if !ok {
		t.Fatalf("history task_complete was not parsed")
	}
	if history.Kind != "summary" || history.Text != "\u5df2\u5904\u7406 2m 5s" || !history.Inline {
		t.Fatalf("history summary = %#v", history)
	}
	if history.Data["durationMs"] != int64(125000) || history.Data["timeToFirstTokenMs"] != int64(2700) {
		t.Fatalf("history summary data = %#v", history.Data)
	}

	live, ok := eventFromHistoryEntry(entry, eventTime, true)
	if !ok {
		t.Fatalf("live task_complete was not parsed")
	}
	if live.Kind != "turn_completed" || live.Data["status"] != "completed" {
		t.Fatalf("live task_complete = %#v", live)
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
			"type":        "task_complete",
			"duration_ms": float64(2730),
		},
	})

	select {
	case event := <-events:
		if event.Kind != "summary" || event.Text != "\u5df2\u5904\u7406 2s" || !event.Inline {
			t.Fatalf("first event = %#v, want inline summary", event)
		}
	case <-time.After(time.Second):
		t.Fatalf("timed out waiting for summary")
	}

	select {
	case event := <-events:
		if event.Kind != "turn_completed" {
			t.Fatalf("second event.Kind = %q, want turn_completed", event.Kind)
		}
		if event.Data["durationMs"] != int64(2730) || event.Data["status"] != "completed" {
			t.Fatalf("turn_completed data = %#v", event.Data)
		}
	case <-time.After(time.Second):
		t.Fatalf("timed out waiting for turn_completed")
	}
	if got := manager.sessions["session-1"].record.Status; got != statusIdle {
		t.Fatalf("status = %q, want %q", got, statusIdle)
	}
}

func TestFormatDurationMSMatchesOfficialFlooring(t *testing.T) {
	tests := map[int64]string{
		1:      "1s",
		999:    "1s",
		1000:   "1s",
		2730:   "2s",
		41628:  "41s",
		125000: "2m 5s",
	}
	for input, want := range tests {
		if got := formatDurationMS(input); got != want {
			t.Fatalf("formatDurationMS(%d) = %q, want %q", input, got, want)
		}
	}
}

func TestHandleTopLevelTurnCompletedSetsSessionIdle(t *testing.T) {
	manager := New(Config{CodexHome: t.TempDir(), RootDir: "/workspace", CodexBin: "codex"})
	manager.sessions["session-1"] = &managedSession{
		record: model.SessionRecord{ID: "session-1", Status: statusRunning, CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()},
	}
	events, unsubscribe := manager.Subscribe()
	defer unsubscribe()

	manager.handleCLIEvent("session-1", map[string]any{
		"type":   "turn.completed",
		"status": "completed",
	})

	select {
	case event := <-events:
		if event.Kind != "turn_completed" {
			t.Fatalf("event.Kind = %q, want turn_completed", event.Kind)
		}
		if event.Data["status"] != "completed" {
			t.Fatalf("event.Data = %#v, want raw turn completed payload", event.Data)
		}
	case <-time.After(time.Second):
		t.Fatalf("timed out waiting for turn_completed")
	}
	if got := manager.sessions["session-1"].record.Status; got != statusIdle {
		t.Fatalf("status = %q, want %q", got, statusIdle)
	}
}

func TestCancelRunningSessionBroadcastsTurnCancelled(t *testing.T) {
	manager := New(Config{CodexHome: t.TempDir(), RootDir: "/workspace", CodexBin: "codex"})
	ctx, cancel := context.WithCancel(context.Background())
	manager.sessions["session-1"] = &managedSession{
		record: model.SessionRecord{ID: "session-1", Status: statusRunning, CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()},
		cancel: cancel,
	}
	events, unsubscribe := manager.Subscribe()
	defer unsubscribe()

	if err := manager.Cancel("session-1"); err != nil {
		t.Fatalf("Cancel() error = %v", err)
	}
	if ctx.Err() != context.Canceled {
		t.Fatalf("context was not cancelled")
	}

	select {
	case event := <-events:
		if event.Kind != "turn_cancelled" {
			t.Fatalf("event.Kind = %q, want turn_cancelled", event.Kind)
		}
		if event.Text != "Stopped" || event.Data["status"] != "cancelled" {
			t.Fatalf("event = %#v, want stopped cancelled event", event)
		}
	case <-time.After(time.Second):
		t.Fatalf("timed out waiting for turn_cancelled")
	}
	if got := manager.sessions["session-1"].record.Status; got != statusIdle {
		t.Fatalf("status = %q, want %q", got, statusIdle)
	}
}

func TestStaleTurnCannotOverwriteActiveTurn(t *testing.T) {
	manager := New(Config{CodexHome: t.TempDir(), RootDir: "/workspace", CodexBin: "codex"})
	_, cancel := context.WithCancel(context.Background())
	defer cancel()
	manager.sessions["session-1"] = &managedSession{
		record: model.SessionRecord{
			ID:        "session-1",
			Status:    statusRunning,
			CreatedAt: time.Now().UTC(),
			UpdatedAt: time.Now().UTC(),
		},
		cancel:       cancel,
		activeTurnID: "new-turn",
	}

	manager.appendEventForTurn("session-1", "old-turn", "assistant_message", "stale output", nil)
	manager.finishWithError("session-1", "old-turn", errors.New("stale failure"))
	if manager.finishTurnWithTerminalEvent("session-1", "old-turn", statusIdle, model.SessionEvent{
		Kind: "turn_completed",
		Data: map[string]any{"status": "completed"},
	}, "", time.Time{}) {
		t.Fatalf("finishTurnWithTerminalEvent(old-turn) returned true, want stale turn ignored")
	}
	if manager.finishTurn("session-1", "old-turn", statusIdle) {
		t.Fatalf("finishTurn(old-turn) returned true, want stale turn ignored")
	}

	session := manager.sessions["session-1"]
	if session.activeTurnID != "new-turn" || session.cancel == nil || session.record.Status != statusRunning {
		t.Fatalf("session after stale turn = %#v, want active new turn preserved", session)
	}
	if len(session.events) != 0 {
		t.Fatalf("stale turn appended events: %#v", session.events)
	}
	if !manager.finishTurn("session-1", "new-turn", statusIdle) {
		t.Fatalf("finishTurn(new-turn) returned false, want active turn finished")
	}
	if session.activeTurnID != "" || session.cancel != nil || session.record.Status != statusIdle {
		t.Fatalf("session after active finish = %#v, want idle with no active turn", session)
	}
}

func TestCreateContinuesAfterCallerContextCancelled(t *testing.T) {
	rootDir := t.TempDir()
	codexHome := t.TempDir()
	manager := New(Config{
		CodexBin:  buildFakeCodexBinary(t),
		CodexHome: codexHome,
		RootDir:   rootDir,
	})
	ctx, cancel := context.WithCancel(context.Background())
	record, err := manager.Create(ctx, model.SessionCreateRequest{Prompt: "keep running after browser disconnect", CWD: rootDir})
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	cancel()

	var page model.SessionEventsPage
	waitForSessionTest(t, func() bool {
		var err error
		page, err = manager.Events(model.SessionEventsRequest{SessionID: record.ID})
		if err != nil {
			return false
		}
		session, err := manager.record(record.ID)
		if err != nil || session.Status != statusIdle {
			return false
		}
		return hasEventKind(page.Events, "assistant_message") && hasEventKind(page.Events, "turn_completed")
	})
	if hasEventKind(page.Events, "turn_cancelled") || hasEventKind(page.Events, "error") {
		t.Fatalf("events after caller cancel = %#v, want completed without cancellation/error", page.Events)
	}
	session, err := manager.record(record.ID)
	if err != nil {
		t.Fatalf("record() error = %v", err)
	}
	if session.CodexThreadID != "fake-thread" {
		t.Fatalf("CodexThreadID = %q, want fake-thread", session.CodexThreadID)
	}
}

func TestSendResumeContinuesAfterCallerContextCancelled(t *testing.T) {
	rootDir := t.TempDir()
	codexHome := t.TempDir()
	manager := New(Config{
		CodexBin:  buildFakeCodexBinary(t),
		CodexHome: codexHome,
		RootDir:   rootDir,
	})
	now := time.Now().UTC()
	manager.sessions["session-1"] = &managedSession{
		record: model.SessionRecord{
			ID:            "session-1",
			CodexThreadID: "fake-thread",
			Title:         "existing thread",
			CWD:           rootDir,
			Status:        statusIdle,
			CreatedAt:     now,
			UpdatedAt:     now,
		},
	}

	ctx, cancel := context.WithCancel(context.Background())
	record, err := manager.Send(ctx, model.SessionSendRequest{SessionID: "session-1", Prompt: "resume after browser disconnect"})
	if err != nil {
		t.Fatalf("Send() error = %v", err)
	}
	cancel()

	var page model.SessionEventsPage
	waitForSessionTest(t, func() bool {
		var err error
		page, err = manager.Events(model.SessionEventsRequest{SessionID: record.ID})
		if err != nil {
			return false
		}
		session, err := manager.record(record.ID)
		if err != nil || session.Status != statusIdle {
			return false
		}
		for _, event := range page.Events {
			if event.Kind == "assistant_message" && event.Text == "resumed turn survived caller context cancelled" {
				return hasEventKind(page.Events, "turn_completed")
			}
		}
		return false
	})
	if hasEventKind(page.Events, "turn_cancelled") || hasEventKind(page.Events, "error") {
		t.Fatalf("events after caller cancel = %#v, want resumed turn completed without cancellation/error", page.Events)
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

func buildFakeCodexBinary(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	source := filepath.Join(dir, "fake-codex.go")
	if err := os.WriteFile(source, []byte(fakeCodexSource), 0o600); err != nil {
		t.Fatalf("WriteFile(fake codex) error = %v", err)
	}
	exe := ""
	if runtime.GOOS == "windows" {
		exe = ".exe"
	}
	bin := filepath.Join(dir, "fake-codex"+exe)
	cmd := exec.Command("go", "build", "-o", bin, source)
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("go build fake codex error = %v\n%s", err, output)
	}
	return bin
}

const fakeCodexSource = `package main

import (
	"fmt"
	"io"
	"os"
	"time"
)

func main() {
	_, _ = io.ReadAll(os.Stdin)
	time.Sleep(200 * time.Millisecond)
	cwd, _ := os.Getwd()
	message := "still running after caller context cancelled"
	for _, arg := range os.Args[1:] {
		if arg == "resume" {
			message = "resumed turn survived caller context cancelled"
			break
		}
	}
	fmt.Printf("{\"timestamp\":\"2026-07-04T01:00:00Z\",\"type\":\"session_meta\",\"payload\":{\"session_id\":\"fake-thread\",\"cwd\":%q}}\n", cwd)
	fmt.Println("{\"timestamp\":\"2026-07-04T01:00:01Z\",\"type\":\"event_msg\",\"payload\":{\"type\":\"task_started\"}}")
	fmt.Printf("{\"timestamp\":\"2026-07-04T01:00:02Z\",\"type\":\"event_msg\",\"payload\":{\"type\":\"agent_message\",\"message\":%q,\"phase\":\"final_answer\"}}\n", message)
	fmt.Println("{\"timestamp\":\"2026-07-04T01:00:03Z\",\"type\":\"event_msg\",\"payload\":{\"type\":\"task_complete\"}}")
}
`

func eventSeqs(events []model.SessionEvent) string {
	seqs := make([]string, 0, len(events))
	for _, event := range events {
		seqs = append(seqs, strconv.FormatInt(event.Seq, 10))
	}
	return strings.Join(seqs, ",")
}

func hasEventKind(events []model.SessionEvent, kind string) bool {
	for _, event := range events {
		if event.Kind == kind {
			return true
		}
	}
	return false
}

func waitForSessionTest(t *testing.T, fn func() bool) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if fn() {
			return
		}
		time.Sleep(25 * time.Millisecond)
	}
	t.Fatalf("condition was not met before timeout")
}
