package session

import (
	"bufio"
	"bytes"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"codex-web/agent/internal/model"
)

type parsedSession struct {
	record    model.SessionRecord
	events    []model.SessionEvent
	eventRefs []historyEventRef
	path      string
	modTime   time.Time
	size      int64
}

type historyFile struct {
	path    string
	modTime time.Time
	size    int64
}

type historyEventRef struct {
	seq    int64
	offset int64
	length int
}

type historyEntry struct {
	Type      string         `json:"type"`
	Timestamp string         `json:"timestamp"`
	Payload   map[string]any `json:"payload"`
}

type historyIndexPayload struct {
	Type      string `json:"type"`
	SessionID string `json:"session_id"`
	ID        string `json:"id"`
	CWD       string `json:"cwd"`
	Timestamp string `json:"timestamp"`
}

type historyIndexEntry struct {
	Type      string              `json:"type"`
	Timestamp string              `json:"timestamp"`
	Payload   historyIndexPayload `json:"payload"`
}

func listHistoryFiles(codexHome string) ([]historyFile, error) {
	root := filepath.Join(codexHome, "sessions")
	entries, err := os.ReadDir(root)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	var files []historyFile
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
			info, err := d.Info()
			if err != nil {
				return nil
			}
			files = append(files, historyFile{path: path, modTime: info.ModTime().UTC(), size: info.Size()})
			return nil
		}); err != nil {
			return nil, err
		}
	}
	sort.Slice(files, func(i, j int) bool { return files[i].path < files[j].path })
	return files, nil
}

func parseHistoryFile(path string) (parsedSession, error) {
	parsed, err := parseHistoryIndex(path)
	if err != nil {
		return parsedSession{}, err
	}
	events, err := parseHistoryEvents(path, parsed.record.ID, parsed.eventRefs)
	if err != nil {
		return parsedSession{}, err
	}
	parsed.events = events
	return parsed, nil
}

func parseHistoryIndex(path string) (parsedSession, error) {
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
	var eventRefs []historyEventRef
	var firstUserText string

	reader := bufio.NewReader(file)
	var offset int64
	for {
		rawLine, readErr := reader.ReadBytes('\n')
		if len(rawLine) == 0 && readErr == io.EOF {
			break
		}
		lineOffset := offset
		offset += int64(len(rawLine))
		line := bytes.TrimSpace(rawLine)
		if len(line) == 0 {
			if readErr == io.EOF {
				break
			}
			if readErr != nil {
				return parsedSession{}, readErr
			}
			continue
		}

		var entry historyIndexEntry
		if err := json.Unmarshal(line, &entry); err != nil {
			if readErr == io.EOF {
				break
			}
			if readErr != nil {
				return parsedSession{}, readErr
			}
			continue
		}
		eventTime := parseTime(entry.Timestamp, now)
		if entry.Type == "session_meta" {
			applySessionMetaIndex(&record, entry.Payload, eventTime)
		} else if indexedHistoryEventVisible(line, entry) {
			if entry.Type == "event_msg" && entry.Payload.Type == "user_message" && firstUserText == "" {
				firstUserText = indexedUserMessageText(line)
			}
			eventRefs = append(eventRefs, historyEventRef{
				seq:    int64(len(eventRefs) + 1),
				offset: lineOffset,
				length: len(rawLine),
			})
			record.UpdatedAt = eventTime
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return parsedSession{}, readErr
		}
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
	record.LastSeq = int64(len(eventRefs))

	return parsedSession{record: record, eventRefs: eventRefs, path: path, modTime: now, size: info.Size()}, nil
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

func applySessionMetaIndex(record *model.SessionRecord, payload historyIndexPayload, eventTime time.Time) {
	threadID := strings.TrimSpace(payload.SessionID)
	if threadID == "" {
		threadID = strings.TrimSpace(payload.ID)
	}
	if threadID != "" {
		record.ID = threadID
		record.CodexThreadID = threadID
	}
	if cwd := strings.TrimSpace(payload.CWD); cwd != "" {
		record.CWD = cwd
	}
	if ts := strings.TrimSpace(payload.Timestamp); ts != "" {
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

func indexedHistoryEventVisible(line []byte, entry historyIndexEntry) bool {
	switch entry.Type {
	case "event_msg":
		return entry.Payload.Type == "user_message" || entry.Payload.Type == "agent_message"
	case "response_item":
		switch entry.Payload.Type {
		case "reasoning":
			return indexedReasoningSummaryText(line) != ""
		case "function_call", "function_call_output":
			return true
		}
	}
	return false
}

func indexedUserMessageText(line []byte) string {
	var entry struct {
		Payload struct {
			Message any `json:"message"`
		} `json:"payload"`
	}
	if err := json.Unmarshal(line, &entry); err != nil {
		return ""
	}
	return messageText(entry.Payload.Message)
}

func indexedReasoningSummaryText(line []byte) string {
	var entry struct {
		Payload struct {
			Summary any `json:"summary"`
		} `json:"payload"`
	}
	if err := json.Unmarshal(line, &entry); err != nil {
		return ""
	}
	return summaryText(entry.Payload.Summary)
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

func parseHistoryEvents(path, sessionID string, refs []historyEventRef) ([]model.SessionEvent, error) {
	if len(refs) == 0 {
		return nil, nil
	}
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	events := make([]model.SessionEvent, 0, len(refs))
	for _, ref := range refs {
		if ref.length <= 0 {
			continue
		}
		line := make([]byte, ref.length)
		n, err := file.ReadAt(line, ref.offset)
		if err != nil && err != io.EOF {
			return nil, err
		}
		line = bytes.TrimSpace(line[:n])
		if len(line) == 0 {
			continue
		}
		var entry historyEntry
		if err := json.Unmarshal(line, &entry); err != nil {
			continue
		}
		eventTime := parseTime(entry.Timestamp, time.Time{})
		event, ok := eventFromHistoryEntry(entry, eventTime, false)
		if !ok {
			continue
		}
		event.SessionID = sessionID
		event.Seq = ref.seq
		events = append(events, event)
	}
	return events, nil
}

func newParsedEvent(kind, text string, eventTime time.Time, data map[string]any) model.SessionEvent {
	return model.SessionEvent{
		Time: eventTime,
		Kind: kind,
		Text: strings.TrimSpace(text),
		Data: data,
	}
}

func loadHistoryAndMemoryEvents(path, sessionID string, refs []historyEventRef, memoryEvents []model.SessionEvent, req model.SessionEventsRequest) ([]model.SessionEvent, error) {
	startSeq, endSeq := sessionEventSeqRange(refs, memoryEvents, req)
	if endSeq < startSeq {
		return nil, nil
	}
	historyEvents, err := parseHistoryEvents(path, sessionID, historyRefsInSeqRange(refs, startSeq, endSeq))
	if err != nil {
		return nil, err
	}
	events := append(historyEvents, memoryEventsInSeqRange(memoryEvents, startSeq, endSeq)...)
	sort.Slice(events, func(i, j int) bool {
		return events[i].Seq < events[j].Seq
	})
	return events, nil
}

func sessionEventSeqRange(refs []historyEventRef, memoryEvents []model.SessionEvent, req model.SessionEventsRequest) (int64, int64) {
	latestSeq := latestSessionSeq(refs, memoryEvents)
	if latestSeq == 0 {
		return 1, 0
	}
	startSeq := int64(1)
	endSeq := latestSeq
	if req.LastSeq > 0 {
		startSeq = req.LastSeq + 1
	}
	if req.BeforeSeq > 0 && req.BeforeSeq-1 < endSeq {
		endSeq = req.BeforeSeq - 1
	}
	if endSeq < startSeq {
		return 1, 0
	}
	if req.Limit > 0 {
		limit := int64(req.Limit)
		if req.BeforeSeq > 0 || req.LastSeq == 0 {
			if limitedStart := endSeq - limit + 1; limitedStart > startSeq {
				startSeq = limitedStart
			}
		} else if limitedEnd := startSeq + limit - 1; limitedEnd < endSeq {
			endSeq = limitedEnd
		}
	}
	return startSeq, endSeq
}

func latestSessionSeq(refs []historyEventRef, memoryEvents []model.SessionEvent) int64 {
	var latest int64
	if len(refs) > 0 {
		latest = refs[len(refs)-1].seq
	}
	for _, event := range memoryEvents {
		if event.Seq > latest {
			latest = event.Seq
		}
	}
	return latest
}

func historyRefsInSeqRange(refs []historyEventRef, startSeq, endSeq int64) []historyEventRef {
	if len(refs) == 0 || endSeq < startSeq {
		return nil
	}
	start := sort.Search(len(refs), func(i int) bool { return refs[i].seq >= startSeq })
	end := sort.Search(len(refs), func(i int) bool { return refs[i].seq > endSeq })
	if end < start {
		end = start
	}
	return append([]historyEventRef(nil), refs[start:end]...)
}

func memoryEventsInSeqRange(events []model.SessionEvent, startSeq, endSeq int64) []model.SessionEvent {
	if len(events) == 0 || endSeq < startSeq {
		return nil
	}
	out := make([]model.SessionEvent, 0, len(events))
	for _, event := range events {
		if event.Seq >= startSeq && event.Seq <= endSeq {
			out = append(out, event)
		}
	}
	return out
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
