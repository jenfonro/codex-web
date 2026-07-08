package session

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"codex-web/agent/internal/model"
)

const (
	statusRunning = "running"
	statusIdle    = "idle"
	statusError   = "error"

	diskRefreshMinInterval = 2 * time.Second
)

type Config struct {
	CodexBin  string
	CodexHome string
	RootDir   string
}

type Manager struct {
	cfg Config

	mu          sync.Mutex
	sessions    map[string]*managedSession
	subscribers map[int]chan model.SessionEvent
	nextSubID   int

	lastDiskRefresh time.Time
}

type managedSession struct {
	record         model.SessionRecord
	events         []model.SessionEvent
	cancel         context.CancelFunc
	activeTurnID   string
	historyPath    string
	historyModTime time.Time
	historySize    int64
	historyEvents  []historyEventRef
}

type eventBroadcast struct {
	event       model.SessionEvent
	subscribers []chan model.SessionEvent
}

func New(cfg Config) *Manager {
	manager := &Manager{
		cfg:         cfg,
		sessions:    map[string]*managedSession{},
		subscribers: map[int]chan model.SessionEvent{},
	}
	manager.refreshFromDisk(true)
	return manager
}

func (m *Manager) List() []model.SessionRecord {
	m.refreshFromDisk(true)
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]model.SessionRecord, 0, len(m.sessions))
	for _, session := range m.sessions {
		out = append(out, session.record)
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].UpdatedAt.After(out[j].UpdatedAt)
	})
	return out
}

func (m *Manager) Create(ctx context.Context, req model.SessionCreateRequest) (model.SessionRecord, error) {
	prompt := strings.TrimSpace(req.Prompt)
	if prompt == "" {
		return model.SessionRecord{}, errors.New("prompt is required")
	}
	cwd, err := safePath(m.cfg.RootDir, req.CWD)
	if err != nil {
		return model.SessionRecord{}, err
	}
	id := newID()
	now := time.Now().UTC()
	record := model.SessionRecord{
		ID:        id,
		Title:     titleFromPrompt(prompt),
		CWD:       cwd,
		Status:    statusRunning,
		CreatedAt: now,
		UpdatedAt: now,
	}
	m.mu.Lock()
	m.sessions[id] = &managedSession{record: record}
	m.mu.Unlock()

	m.appendEvent(id, "user_message", prompt, map[string]any{"cwd": cwd})
	m.startTurn(ctx, id, "", prompt, cwd)
	return m.record(id)
}

func (m *Manager) Send(ctx context.Context, req model.SessionSendRequest) (model.SessionRecord, error) {
	m.refreshFromDisk(true)
	prompt := strings.TrimSpace(req.Prompt)
	if prompt == "" {
		return model.SessionRecord{}, errors.New("prompt is required")
	}
	session, err := m.lookup(req.SessionID)
	if err != nil {
		return model.SessionRecord{}, err
	}
	if session.record.Status == statusRunning {
		return model.SessionRecord{}, errors.New("session is already running")
	}
	if session.record.CodexThreadID == "" {
		return model.SessionRecord{}, errors.New("session does not have a Codex thread id yet")
	}
	m.setStatus(req.SessionID, statusRunning)
	m.appendEvent(req.SessionID, "user_message", prompt, nil)
	m.startTurn(ctx, req.SessionID, session.record.CodexThreadID, prompt, session.record.CWD)
	return m.record(req.SessionID)
}

func (m *Manager) Cancel(id string) error {
	m.mu.Lock()
	session := m.sessions[id]
	if session == nil {
		m.mu.Unlock()
		return errors.New("session not found")
	}
	cancel := session.cancel
	wasRunning := cancel != nil || session.record.Status == statusRunning
	session.cancel = nil
	session.activeTurnID = ""
	session.record.Status = statusIdle
	session.record.UpdatedAt = time.Now().UTC()
	m.mu.Unlock()
	if cancel != nil {
		cancel()
	}
	if wasRunning {
		m.appendEvent(id, "turn_cancelled", "Stopped", map[string]any{"status": "cancelled"})
	}
	return nil
}

func (m *Manager) Events(req model.SessionEventsRequest) (model.SessionEventsPage, error) {
	m.refreshFromDisk(false)
	m.refreshKnownSessionFromDisk(req.SessionID)
	m.mu.Lock()
	session := m.sessions[req.SessionID]
	if session == nil {
		m.mu.Unlock()
		return model.SessionEventsPage{}, errors.New("session not found")
	}
	if session.historyPath != "" {
		path := session.historyPath
		sessionID := session.record.ID
		refs := append([]historyEventRef(nil), session.historyEvents...)
		memoryEvents := append([]model.SessionEvent(nil), session.events...)
		m.mu.Unlock()
		events, err := loadHistoryAndMemoryEvents(path, sessionID, refs, memoryEvents, req)
		if err != nil {
			return model.SessionEventsPage{}, err
		}
		if req.Compact {
			events = compactSessionEvents(events, req.FileDetails)
		}
		return sessionEventsPage(events), nil
	}
	events := make([]model.SessionEvent, 0, len(session.events))
	for _, event := range session.events {
		if req.LastSeq > 0 && event.Seq <= req.LastSeq {
			continue
		}
		if req.BeforeSeq > 0 && event.Seq >= req.BeforeSeq {
			continue
		}
		events = append(events, event)
	}
	if req.Limit > 0 && len(events) > req.Limit {
		if req.BeforeSeq > 0 || req.LastSeq == 0 {
			events = events[len(events)-req.Limit:]
		} else {
			events = events[:req.Limit]
		}
	}
	if req.Compact {
		events = compactSessionEvents(events, req.FileDetails)
	}
	m.mu.Unlock()
	return sessionEventsPage(events), nil
}

func sessionEventsPage(events []model.SessionEvent) model.SessionEventsPage {
	page := model.SessionEventsPage{Events: events}
	if len(events) == 0 {
		return page
	}
	page.FirstSeq = events[0].Seq
	page.LastSeq = events[len(events)-1].Seq
	page.HasMoreBefore = page.FirstSeq > 1
	return page
}

func (m *Manager) Subscribe() (<-chan model.SessionEvent, func()) {
	ch := make(chan model.SessionEvent, 256)
	m.mu.Lock()
	id := m.nextSubID
	m.nextSubID++
	m.subscribers[id] = ch
	m.mu.Unlock()
	return ch, func() {
		m.mu.Lock()
		if existing := m.subscribers[id]; existing != nil {
			delete(m.subscribers, id)
			close(existing)
		}
		m.mu.Unlock()
	}
}

func (m *Manager) lookup(id string) (*managedSession, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	session := m.sessions[id]
	if session == nil {
		return nil, errors.New("session not found")
	}
	copySession := *session
	return &copySession, nil
}

func (m *Manager) record(id string) (model.SessionRecord, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	session := m.sessions[id]
	if session == nil {
		return model.SessionRecord{}, errors.New("session not found")
	}
	return session.record, nil
}

func (m *Manager) startTurn(parent context.Context, sessionID, codexThreadID, prompt, cwd string) {
	_ = parent
	ctx, cancel := context.WithCancel(context.Background())
	turnID := newID()
	m.mu.Lock()
	if session := m.sessions[sessionID]; session != nil {
		if session.cancel != nil {
			session.cancel()
		}
		session.cancel = cancel
		session.activeTurnID = turnID
	}
	m.mu.Unlock()
	go m.runCodex(ctx, sessionID, turnID, codexThreadID, prompt, cwd)
}

func (m *Manager) runCodex(ctx context.Context, sessionID, turnID, codexThreadID, prompt, cwd string) {
	startedAt := time.Now().UTC()
	args := []string{}
	if codexThreadID == "" {
		args = append(args, "exec", "--json", "--skip-git-repo-check", "-C", cwd, "-")
	} else {
		args = append(args, "exec", "resume", "--json", "--skip-git-repo-check", codexThreadID, "-")
	}
	cmd := exec.CommandContext(ctx, m.cfg.CodexBin, args...)
	cmd.Dir = cwd
	cmd.Env = append(os.Environ(), "CODEX_HOME="+m.cfg.CodexHome)
	stdin, err := cmd.StdinPipe()
	if err != nil {
		m.finishWithError(sessionID, turnID, err)
		return
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		m.finishWithError(sessionID, turnID, err)
		return
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		m.finishWithError(sessionID, turnID, err)
		return
	}
	if err := cmd.Start(); err != nil {
		m.finishWithError(sessionID, turnID, err)
		return
	}
	go func() {
		_, _ = io.WriteString(stdin, prompt)
		_ = stdin.Close()
	}()
	go m.scanStderr(sessionID, turnID, stderr)
	m.scanStdout(sessionID, turnID, stdout)
	err = cmd.Wait()
	cancelled := errors.Is(ctx.Err(), context.Canceled)
	m.refreshFromDisk(true)
	if err != nil && !cancelled {
		for attempt := 0; attempt < 6 && !m.hasAssistantMessageSince(sessionID, startedAt); attempt++ {
			time.Sleep(500 * time.Millisecond)
			m.refreshFromDisk(true)
		}
		if m.hasAssistantMessageSince(sessionID, startedAt) {
			err = nil
		}
	}
	status := statusIdle
	if err != nil && !cancelled {
		status = statusError
	}
	var terminal model.SessionEvent
	var skipKind string
	if err != nil && cancelled {
		terminal = model.SessionEvent{Kind: "turn_cancelled", Text: "Stopped", Data: map[string]any{"status": "cancelled"}}
		skipKind = "turn_cancelled"
	} else if err != nil {
		terminal = model.SessionEvent{Kind: "error", Text: err.Error()}
	} else {
		terminal = model.SessionEvent{Kind: "turn_completed", Data: map[string]any{"status": "completed"}}
		skipKind = "turn_completed"
	}
	m.finishTurnWithTerminalEvent(sessionID, turnID, status, terminal, skipKind, startedAt)
}

func (m *Manager) scanStdout(sessionID, turnID string, reader io.Reader) {
	scanner := bufio.NewScanner(reader)
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, 2*1024*1024)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "Reading additional input from stdin") {
			continue
		}
		var raw map[string]any
		if err := json.Unmarshal([]byte(line), &raw); err != nil {
			m.appendEventForTurn(sessionID, turnID, "stdout", line, nil)
			continue
		}
		m.handleCLIEventForTurn(sessionID, turnID, raw)
	}
	if err := scanner.Err(); err != nil {
		m.appendEventForTurn(sessionID, turnID, "error", err.Error(), nil)
	}
}

func (m *Manager) scanStderr(sessionID, turnID string, reader io.Reader) {
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line != "" {
			m.appendEventForTurn(sessionID, turnID, "stderr", line, nil)
		}
	}
}

func (m *Manager) handleCLIEvent(sessionID string, raw map[string]any) {
	m.handleCLIEventForTurn(sessionID, "", raw)
}

func (m *Manager) handleCLIEventForTurn(sessionID, turnID string, raw map[string]any) {
	eventType := stringAny(raw["type"])
	switch eventType {
	case "session_meta":
		entry := historyEntryFromMap(raw)
		threadID := firstString(entry.Payload, "session_id", "id")
		m.mu.Lock()
		if session := m.sessions[sessionID]; session != nil && threadID != "" && turnMatches(session, turnID) {
			session.record.CodexThreadID = threadID
			if cwd := firstString(entry.Payload, "cwd"); cwd != "" {
				session.record.CWD = cwd
			}
			session.record.UpdatedAt = time.Now().UTC()
		}
		m.mu.Unlock()
	case "event_msg", "response_item":
		entry := historyEntryFromMap(raw)
		eventTime := parseTime(entry.Timestamp, time.Now().UTC())
		if entry.Type == "event_msg" && firstString(entry.Payload, "type") == "task_complete" {
			events := []model.SessionEvent{}
			if summary, ok := taskCompleteSummaryEvent(eventTime, entry.Payload); ok {
				events = append(events, summary)
			}
			events = append(events, model.SessionEvent{Kind: "turn_completed", Time: eventTime, Data: taskCompleteData(entry.Payload)})
			m.setStatusAndAppendEventsForTurn(sessionID, turnID, statusIdle, events)
			return
		}
		event, ok := eventFromHistoryEntry(entry, eventTime, true)
		if !ok {
			return
		}
		if event.Kind == "turn_completed" {
			m.setStatusAndAppendEventsForTurn(sessionID, turnID, statusIdle, []model.SessionEvent{event})
			return
		}
		m.appendParsedEventForTurn(sessionID, turnID, event)
	case "thread.started":
		threadID := stringAny(raw["thread_id"])
		m.mu.Lock()
		if session := m.sessions[sessionID]; session != nil && threadID != "" && turnMatches(session, turnID) {
			session.record.CodexThreadID = threadID
			session.record.UpdatedAt = time.Now().UTC()
		}
		m.mu.Unlock()
		m.appendEventForTurn(sessionID, turnID, "thread_started", "", raw)
	case "turn.started":
		m.appendEventForTurn(sessionID, turnID, "turn_started", "", raw)
	case "turn.completed":
		m.setStatusAndAppendEventsForTurn(sessionID, turnID, statusIdle, []model.SessionEvent{{Kind: "turn_completed", Data: raw}})
	case "item.completed":
		text, kind := itemText(raw["item"])
		if kind == "" {
			return
		}
		m.appendEventForTurn(sessionID, turnID, kind, text, raw)
	default:
		m.appendEventForTurn(sessionID, turnID, "cli_event", "", raw)
	}
}

func (m *Manager) finishWithError(sessionID, turnID string, err error) {
	m.finishTurnWithTerminalEvent(sessionID, turnID, statusError, model.SessionEvent{Kind: "error", Text: err.Error()}, "", time.Time{})
}

func (m *Manager) finishTurn(sessionID, turnID, status string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	if session := m.sessions[sessionID]; session != nil {
		if !turnMatches(session, turnID) {
			return false
		}
		session.cancel = nil
		session.activeTurnID = ""
		session.record.Status = status
		session.record.UpdatedAt = time.Now().UTC()
		return true
	}
	return false
}

func (m *Manager) finishTurnWithTerminalEvent(sessionID, turnID, status string, event model.SessionEvent, skipKind string, since time.Time) bool {
	m.mu.Lock()
	session := m.sessions[sessionID]
	if session == nil || !turnMatches(session, turnID) {
		m.mu.Unlock()
		return false
	}
	session.cancel = nil
	session.activeTurnID = ""
	session.record.Status = status
	session.record.UpdatedAt = time.Now().UTC()
	var broadcasts []eventBroadcast
	if event.Kind != "" && (skipKind == "" || !sessionHasEventKindSince(session, skipKind, since)) {
		broadcasts = append(broadcasts, m.appendParsedEventLocked(sessionID, session, event))
	}
	m.mu.Unlock()
	broadcastSessionEvents(broadcasts)
	return true
}

func (m *Manager) setStatus(sessionID, status string) {
	m.setStatusForTurn(sessionID, "", status)
}

func (m *Manager) setStatusForTurn(sessionID, turnID, status string) {
	m.mu.Lock()
	if session := m.sessions[sessionID]; session != nil {
		if !turnMatches(session, turnID) {
			m.mu.Unlock()
			return
		}
		session.record.Status = status
		session.record.UpdatedAt = time.Now().UTC()
	}
	m.mu.Unlock()
}

func (m *Manager) setStatusAndAppendEventsForTurn(sessionID, turnID, status string, events []model.SessionEvent) bool {
	m.mu.Lock()
	session := m.sessions[sessionID]
	if session == nil || !turnMatches(session, turnID) {
		m.mu.Unlock()
		return false
	}
	session.record.Status = status
	session.record.UpdatedAt = time.Now().UTC()
	broadcasts := make([]eventBroadcast, 0, len(events))
	for _, event := range events {
		if event.Kind == "" {
			continue
		}
		broadcasts = append(broadcasts, m.appendParsedEventLocked(sessionID, session, event))
	}
	m.mu.Unlock()
	broadcastSessionEvents(broadcasts)
	return true
}

func (m *Manager) appendEvent(sessionID, kind, text string, data map[string]any) {
	m.appendEventForTurn(sessionID, "", kind, text, data)
}

func (m *Manager) appendEventForTurn(sessionID, turnID, kind, text string, data map[string]any) {
	m.appendParsedEventForTurn(sessionID, turnID, model.SessionEvent{
		Kind: kind,
		Text: text,
		Time: time.Now().UTC(),
		Data: data,
	})
}

func (m *Manager) appendParsedEvent(sessionID string, event model.SessionEvent) {
	m.appendParsedEventForTurn(sessionID, "", event)
}

func (m *Manager) appendParsedEventForTurn(sessionID, turnID string, event model.SessionEvent) {
	m.mu.Lock()
	session := m.sessions[sessionID]
	if session == nil {
		m.mu.Unlock()
		return
	}
	if !turnMatches(session, turnID) {
		m.mu.Unlock()
		return
	}
	broadcast := m.appendParsedEventLocked(sessionID, session, event)
	m.mu.Unlock()
	broadcastSessionEvent(broadcast)
}

func (m *Manager) appendParsedEventLocked(sessionID string, session *managedSession, event model.SessionEvent) eventBroadcast {
	if event.Time.IsZero() {
		event.Time = time.Now().UTC()
	}
	seq := session.record.LastSeq + 1
	event.SessionID = sessionID
	event.Seq = seq
	session.record.LastSeq = seq
	session.record.UpdatedAt = event.Time
	session.events = append(session.events, event)
	subscribers := make([]chan model.SessionEvent, 0, len(m.subscribers))
	for _, ch := range m.subscribers {
		subscribers = append(subscribers, ch)
	}
	return eventBroadcast{event: event, subscribers: subscribers}
}

func broadcastSessionEvents(broadcasts []eventBroadcast) {
	for _, broadcast := range broadcasts {
		broadcastSessionEvent(broadcast)
	}
}

func broadcastSessionEvent(broadcast eventBroadcast) {
	for _, ch := range broadcast.subscribers {
		select {
		case ch <- broadcast.event:
		default:
		}
	}
}

func (m *Manager) refreshFromDisk(force bool) {
	if !force {
		m.mu.Lock()
		lastRefresh := m.lastDiskRefresh
		if !lastRefresh.IsZero() && time.Since(lastRefresh) < diskRefreshMinInterval {
			m.mu.Unlock()
			return
		}
		m.lastDiskRefresh = time.Now()
		m.mu.Unlock()
	}

	files, err := listHistoryFiles(m.cfg.CodexHome)
	if err != nil {
		return
	}
	if force {
		m.mu.Lock()
		m.lastDiskRefresh = time.Now()
		m.mu.Unlock()
	}
	m.mu.Lock()
	pending := make([]historyFile, 0, len(files))
	for _, file := range files {
		if id := m.sessionIDForPathLocked(file.path); id != "" {
			existing := m.sessions[id]
			if existing != nil && existing.activeTurnID != "" {
				continue
			}
			if existing != nil && !existing.historyModTime.IsZero() && !file.modTime.After(existing.historyModTime) && file.size == existing.historySize {
				continue
			}
		}
		pending = append(pending, file)
	}
	m.mu.Unlock()

	for _, file := range pending {
		history, err := parseHistoryIndex(file.path)
		if err != nil || history.record.ID == "" {
			continue
		}
		m.applyHistorySession(history)
	}
}

func (m *Manager) refreshKnownSessionFromDisk(sessionID string) {
	m.mu.Lock()
	session := m.sessions[sessionID]
	if session == nil || session.historyPath == "" || session.activeTurnID != "" {
		m.mu.Unlock()
		return
	}
	path := session.historyPath
	modTime := session.historyModTime
	size := session.historySize
	m.mu.Unlock()

	info, err := os.Stat(path)
	if err != nil {
		return
	}
	currentModTime := info.ModTime().UTC()
	currentSize := info.Size()
	if !modTime.IsZero() && !currentModTime.After(modTime) && currentSize == size {
		return
	}
	history, err := parseHistoryIndex(path)
	if err != nil || history.record.ID == "" {
		return
	}
	m.applyHistorySession(history)
}

func (m *Manager) applyHistorySession(history parsedSession) {
	m.mu.Lock()
	defer m.mu.Unlock()
	targetID := history.record.ID
	if existingID := m.sessionIDForThreadLocked(history.record.CodexThreadID); existingID != "" {
		targetID = existingID
	}
	existing := m.sessions[targetID]
	if existing != nil {
		if existing.activeTurnID != "" {
			return
		}
		if !existing.historyModTime.IsZero() && !history.modTime.After(existing.historyModTime) && history.size == existing.historySize {
			return
		}
	}
	if targetID != history.record.ID {
		history.record.ID = targetID
		for index := range history.events {
			history.events[index].SessionID = targetID
		}
	}
	m.sessions[targetID] = &managedSession{
		record:         history.record,
		events:         history.events,
		historyPath:    history.path,
		historyModTime: history.modTime,
		historySize:    history.size,
		historyEvents:  history.eventRefs,
	}
}

func (m *Manager) sessionIDForPathLocked(path string) string {
	clean := filepath.Clean(path)
	for id, session := range m.sessions {
		if session.historyPath != "" && filepath.Clean(session.historyPath) == clean {
			return id
		}
	}
	return ""
}

func (m *Manager) sessionIDForThreadLocked(threadID string) string {
	if strings.TrimSpace(threadID) == "" {
		return ""
	}
	for id, session := range m.sessions {
		if session.record.CodexThreadID == threadID {
			return id
		}
	}
	return ""
}

func turnMatches(session *managedSession, turnID string) bool {
	return turnID == "" || session.activeTurnID == turnID
}

func (m *Manager) hasAssistantMessageSince(sessionID string, since time.Time) bool {
	return m.hasEventKindSince(sessionID, "assistant_message", since)
}

func (m *Manager) hasEventKindSince(sessionID, kind string, since time.Time) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	session := m.sessions[sessionID]
	if session == nil {
		return false
	}
	return sessionHasEventKindSince(session, kind, since)
}

func sessionHasEventKindSince(session *managedSession, kind string, since time.Time) bool {
	for _, event := range session.events {
		if event.Kind == kind && !event.Time.Before(since) {
			return true
		}
	}
	return false
}

func itemText(value any) (string, string) {
	item, _ := value.(map[string]any)
	itemType := stringAny(item["type"])
	switch itemType {
	case "agent_message":
		return stringAny(item["text"]), "assistant_message"
	case "user_message":
		return stringAny(item["text"]), "user_message"
	case "reasoning":
		return stringAny(item["text"]), "reasoning"
	case "tool_call":
		return stringAny(item["text"]), "tool_call"
	case "error":
		message := stringAny(item["message"])
		if strings.HasPrefix(message, "Ignored unsupported project-local config keys") {
			return "", ""
		}
		return message, "stderr"
	default:
		if text := stringAny(item["text"]); text != "" {
			return text, itemType
		}
		if itemType != "" {
			return "", itemType
		}
		return "", "item_completed"
	}
}

func titleFromPrompt(prompt string) string {
	prompt = strings.Join(strings.Fields(prompt), " ")
	if prompt == "" {
		return "New session"
	}
	runes := []rune(prompt)
	if len(runes) > 48 {
		return string(runes[:48]) + "..."
	}
	return prompt
}

func newID() string {
	return fmt.Sprintf("session-%d", time.Now().UnixNano())
}

func safePath(root, requested string) (string, error) {
	root = filepath.Clean(root)
	if requested == "" {
		return root, nil
	}
	path := requested
	if !filepath.IsAbs(path) {
		path = filepath.Join(root, path)
	}
	clean := filepath.Clean(path)
	if clean != root && !strings.HasPrefix(clean, root+string(os.PathSeparator)) {
		return "", errors.New("invalid cwd")
	}
	return clean, nil
}

func stringAny(value any) string {
	switch v := value.(type) {
	case string:
		return strings.TrimSpace(v)
	case fmt.Stringer:
		return strings.TrimSpace(v.String())
	default:
		return ""
	}
}
