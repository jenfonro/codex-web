package session

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"codex-web/agent/internal/model"
)

type parsedSession struct {
	record  model.SessionRecord
	events  []model.SessionEvent
	path    string
	modTime time.Time
}

type historyEntry struct {
	Type      string         `json:"type"`
	Timestamp string         `json:"timestamp"`
	Payload   map[string]any `json:"payload"`
}

func loadHistorySessions(codexHome string) ([]parsedSession, error) {
	root := filepath.Join(codexHome, "sessions")
	entries, err := os.ReadDir(root)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	var files []string
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		yearDir := filepath.Join(root, entry.Name())
		if err := filepath.WalkDir(yearDir, func(path string, d os.DirEntry, walkErr error) error {
			if walkErr != nil {
				return walkErr
			}
			if d.IsDir() || !strings.HasSuffix(d.Name(), ".jsonl") {
				return nil
			}
			files = append(files, path)
			return nil
		}); err != nil {
			return nil, err
		}
	}
	sort.Strings(files)

	sessions := make([]parsedSession, 0, len(files))
	for _, path := range files {
		parsed, err := parseHistoryFile(path)
		if err != nil || parsed.record.ID == "" {
			continue
		}
		sessions = append(sessions, parsed)
	}
	return sessions, nil
}

func parseHistoryFile(path string) (parsedSession, error) {
	file, err := os.Open(path)
	if err != nil {
		return parsedSession{}, err
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		return parsedSession{}, err
	}

	now := info.ModTime().UTC()
	record := model.SessionRecord{
		ID:        sessionIDFromPath(path),
		Title:     "New session",
		Status:    statusIdle,
		CreatedAt: now,
		UpdatedAt: now,
	}
	var events []model.SessionEvent
	var firstUserText string

	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 0, 64*1024), 8*1024*1024)
	for scanner.Scan() {
		var entry historyEntry
		if err := json.Unmarshal(scanner.Bytes(), &entry); err != nil {
			continue
		}
		eventTime := parseTime(entry.Timestamp, now)
		if entry.Type == "session_meta" {
			applySessionMeta(&record, entry.Payload, eventTime)
			continue
		}
		event, ok := eventFromHistoryEntry(entry, eventTime, false)
		if !ok {
			continue
		}
		if event.Kind == "user_message" && firstUserText == "" {
			firstUserText = event.Text
		}
		event.Seq = int64(len(events) + 1)
		events = append(events, event)
		record.UpdatedAt = event.Time
	}
	if err := scanner.Err(); err != nil {
		return parsedSession{}, err
	}

	if record.CodexThreadID == "" {
		record.CodexThreadID = record.ID
	}
	if firstUserText != "" {
		record.Title = titleFromPrompt(firstUserText)
	}
	if record.CreatedAt.IsZero() {
		record.CreatedAt = now
	}
	if record.UpdatedAt.IsZero() {
		record.UpdatedAt = record.CreatedAt
	}
	record.LastSeq = int64(len(events))
	for index := range events {
		events[index].SessionID = record.ID
	}

	return parsedSession{record: record, events: events, path: path, modTime: now}, nil
}

func applySessionMeta(record *model.SessionRecord, payload map[string]any, eventTime time.Time) {
	if payload == nil {
		return
	}
	threadID := firstString(payload, "session_id", "id")
	if threadID != "" {
		record.ID = threadID
		record.CodexThreadID = threadID
	}
	if cwd := firstString(payload, "cwd"); cwd != "" {
		record.CWD = cwd
	}
	if ts := firstString(payload, "timestamp"); ts != "" {
		eventTime = parseTime(ts, eventTime)
	}
	record.CreatedAt = eventTime
	if record.UpdatedAt.IsZero() || record.UpdatedAt.Before(eventTime) {
		record.UpdatedAt = eventTime
	}
}

func eventFromHistoryEntry(entry historyEntry, eventTime time.Time, includeTransient bool) (model.SessionEvent, bool) {
	payload := entry.Payload
	if payload == nil {
		return model.SessionEvent{}, false
	}
	payloadType := firstString(payload, "type")
	data := compactEventData(payload)
	switch entry.Type {
	case "event_msg":
		switch payloadType {
		case "user_message":
			return newParsedEvent("user_message", messageText(payload["message"]), eventTime, data), true
		case "agent_message":
			return newParsedEvent("assistant_message", messageText(payload["message"]), eventTime, data), true
		case "task_started":
			if includeTransient {
				return newParsedEvent("turn_started", "", eventTime, map[string]any{"status": "running"}), true
			}
		case "task_complete":
			if includeTransient {
				return newParsedEvent("turn_completed", "", eventTime, map[string]any{"status": "completed"}), true
			}
		}
	case "response_item":
		switch payloadType {
		case "reasoning":
			if text := summaryText(payload["summary"]); text != "" {
				return newParsedEvent("summary", text, eventTime, data), true
			}
			if includeTransient {
				return newParsedEvent("reasoning", "", eventTime, map[string]any{"status": "running"}), true
			}
		case "function_call":
			data["status"] = "completed"
			return newParsedEvent("tool_call", toolCallText(payload), eventTime, data), true
		case "function_call_output":
			data["status"] = "completed"
			return newParsedEvent("tool_output", toolOutputText(payload), eventTime, data), true
		}
	}
	return model.SessionEvent{}, false
}

func historyEntryFromMap(raw map[string]any) historyEntry {
	entry := historyEntry{
		Type:      firstString(raw, "type"),
		Timestamp: firstString(raw, "timestamp"),
	}
	if payload, ok := raw["payload"].(map[string]any); ok {
		entry.Payload = payload
	}
	return entry
}

func newParsedEvent(kind, text string, eventTime time.Time, data map[string]any) model.SessionEvent {
	return model.SessionEvent{
		Time: eventTime,
		Kind: kind,
		Text: strings.TrimSpace(text),
		Data: data,
	}
}

func compactEventData(payload map[string]any) map[string]any {
	data := map[string]any{}
	for _, key := range []string{"type", "phase", "name", "call_id", "id", "arguments", "output"} {
		if value, ok := payload[key]; ok && value != nil {
			data[key] = value
		}
	}
	if arguments := firstString(payload, "arguments"); arguments != "" {
		var args map[string]any
		if err := json.Unmarshal([]byte(arguments), &args); err == nil {
			data["args"] = args
		}
	}
	return data
}

func sessionIDFromPath(path string) string {
	name := strings.TrimSuffix(filepath.Base(path), ".jsonl")
	if len(name) >= 36 {
		return name[len(name)-36:]
	}
	return name
}

func parseTime(value string, fallback time.Time) time.Time {
	value = strings.TrimSpace(value)
	if value == "" {
		if fallback.IsZero() {
			return time.Now().UTC()
		}
		return fallback.UTC()
	}
	if ts, err := time.Parse(time.RFC3339Nano, value); err == nil {
		return ts.UTC()
	}
	if ts, err := time.Parse("2006-01-02T15-04-05", value); err == nil {
		return ts.UTC()
	}
	if fallback.IsZero() {
		return time.Now().UTC()
	}
	return fallback.UTC()
}

func messageText(value any) string {
	switch v := value.(type) {
	case string:
		return strings.TrimSpace(v)
	case []any:
		return contentText(v)
	default:
		return ""
	}
}

func contentText(value any) string {
	items, ok := value.([]any)
	if !ok {
		return ""
	}
	parts := make([]string, 0, len(items))
	for _, item := range items {
		body, ok := item.(map[string]any)
		if !ok {
			continue
		}
		if text := firstString(body, "text", "input_text", "output_text"); text != "" {
			parts = append(parts, text)
		}
	}
	return strings.TrimSpace(strings.Join(parts, "\n\n"))
}

func summaryText(value any) string {
	switch v := value.(type) {
	case string:
		return strings.TrimSpace(v)
	case []any:
		parts := make([]string, 0, len(v))
		for _, item := range v {
			body, ok := item.(map[string]any)
			if !ok {
				continue
			}
			if text := firstString(body, "text", "summary"); text != "" {
				parts = append(parts, text)
			}
		}
		return strings.TrimSpace(strings.Join(parts, "\n"))
	default:
		return ""
	}
}

func toolCallText(payload map[string]any) string {
	name := firstString(payload, "name")
	if name == "" {
		return "Running tool"
	}
	return name
}

func toolOutputText(payload map[string]any) string {
	return firstString(payload, "output")
}

func firstString(values map[string]any, keys ...string) string {
	for _, key := range keys {
		if value := stringAny(values[key]); value != "" {
			return value
		}
	}
	return ""
}
