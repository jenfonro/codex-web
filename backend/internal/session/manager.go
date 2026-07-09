package session

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"codex-web/backend/internal/appserver"
	"codex-web/backend/internal/model"
)

const (
	statusRunning = "running"
	statusIdle    = "idle"
	statusError   = "error"
)

type Config struct {
	CodexBin  string
	CodexHome string
	RootDir   string
}

type codexBackend interface {
	ListThreads(ctx context.Context, limit int) ([]appserver.Thread, error)
	ReadThread(ctx context.Context, threadID string) (appserver.Thread, error)
	StartThread(ctx context.Context, cwd string) (appserver.Thread, error)
	ResumeThread(ctx context.Context, threadID, cwd string) (appserver.Thread, error)
	StartTurn(ctx context.Context, threadID, prompt, cwd string) (appserver.Turn, error)
	InterruptTurn(ctx context.Context, threadID, turnID string) error
	Subscribe() (<-chan appserver.Notification, func())
}

type Manager struct {
	cfg     Config
	backend codexBackend

	mu          sync.Mutex
	sessions    map[string]*managedSession
	subscribers map[int]chan model.SessionEvent
	nextSubID   int
}

type managedSession struct {
	record        model.SessionRecord
	events        []model.SessionEvent
	eventsLoaded  bool
	runningTurnID string
	itemSeq       map[string]int64
}

func New(cfg Config) *Manager {
	return NewWithBackend(cfg, appserver.New(appserver.Config{
		CodexBin:  cfg.CodexBin,
		CodexHome: cfg.CodexHome,
		RootDir:   cfg.RootDir,
	}))
}

func NewWithBackend(cfg Config, backend codexBackend) *Manager {
	manager := &Manager{
		cfg:         cfg,
		backend:     backend,
		sessions:    map[string]*managedSession{},
		subscribers: map[int]chan model.SessionEvent{},
	}
	manager.watchBackend()
	return manager
}

func (m *Manager) List(ctx context.Context) ([]model.SessionRecord, error) {
	threads, err := m.backend.ListThreads(ctx, 500)
	if err != nil {
		return nil, err
	}
	m.mu.Lock()
	for _, thread := range threads {
		m.applyThreadLocked(thread)
	}
	out := make([]model.SessionRecord, 0, len(m.sessions))
	for _, session := range m.sessions {
		out = append(out, session.record)
	}
	m.mu.Unlock()

	sort.Slice(out, func(i, j int) bool {
		return out[i].UpdatedAt.After(out[j].UpdatedAt)
	})
	return out, nil
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

	thread, err := m.backend.StartThread(ctx, cwd)
	if err != nil {
		return model.SessionRecord{}, err
	}
	m.mu.Lock()
	session := m.applyThreadLocked(thread)
	session.eventsLoaded = true
	m.mu.Unlock()

	turn, err := m.backend.StartTurn(ctx, thread.ID, prompt, cwd)
	if err != nil {
		m.finishWithError(thread.ID, err)
		return model.SessionRecord{}, err
	}
	m.setRunningTurn(thread.ID, turn.ID)
	return m.record(thread.ID)
}

func (m *Manager) Send(ctx context.Context, req model.SessionSendRequest) (model.SessionRecord, error) {
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
	threadID := firstNonEmpty(session.record.CodexThreadID, session.record.ID)
	if threadID == "" {
		return model.SessionRecord{}, errors.New("session does not have a Codex thread id")
	}

	thread, err := m.backend.ResumeThread(ctx, threadID, session.record.CWD)
	if err != nil {
		m.finishWithError(req.SessionID, err)
		return model.SessionRecord{}, err
	}
	m.mu.Lock()
	m.applyThreadLocked(thread)
	m.mu.Unlock()

	m.setStatus(thread.ID, statusRunning)
	turn, err := m.backend.StartTurn(ctx, thread.ID, prompt, session.record.CWD)
	if err != nil {
		m.finishWithError(thread.ID, err)
		return model.SessionRecord{}, err
	}
	m.setRunningTurn(thread.ID, turn.ID)
	return m.record(thread.ID)
}

func (m *Manager) Cancel(id string) error {
	session, err := m.lookup(id)
	if err != nil {
		return err
	}
	threadID := firstNonEmpty(session.record.CodexThreadID, session.record.ID)
	if threadID == "" || session.runningTurnID == "" {
		m.setStatus(id, statusIdle)
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := m.backend.InterruptTurn(ctx, threadID, session.runningTurnID); err != nil {
		return err
	}
	m.setRunningTurn(id, "")
	m.setStatus(id, statusIdle)
	m.appendEvent(id, "system", "Session cancelled.", nil)
	return nil
}

func (m *Manager) Events(req model.SessionEventsRequest) (model.SessionEventsPage, error) {
	if err := m.ensureEventsLoaded(req.SessionID); err != nil {
		return model.SessionEventsPage{}, err
	}
	m.mu.Lock()
	session := m.sessions[req.SessionID]
	if session == nil {
		m.mu.Unlock()
		return model.SessionEventsPage{}, errors.New("session not found")
	}
	events := eventsInRange(session.events, req)
	m.mu.Unlock()
	return sessionEventsPage(events), nil
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

func (m *Manager) ensureEventsLoaded(sessionID string) error {
	m.mu.Lock()
	session := m.sessions[sessionID]
	if session != nil && session.eventsLoaded {
		m.mu.Unlock()
		return nil
	}
	threadID := sessionID
	if session != nil && session.record.CodexThreadID != "" {
		threadID = session.record.CodexThreadID
	}
	m.mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	thread, err := m.backend.ReadThread(ctx, threadID)
	if err != nil {
		return err
	}
	if thread.ID == "" && thread.SessionID == "" {
		m.mu.Lock()
		existing := m.sessions[sessionID]
		m.mu.Unlock()
		if existing != nil {
			return nil
		}
		return errors.New("session not found")
	}
	events := eventsFromThread(thread)

	m.mu.Lock()
	managed := m.applyThreadLocked(thread)
	managed.events = events
	managed.eventsLoaded = true
	managed.itemSeq = itemSeqIndex(events)
	if len(events) > 0 {
		managed.record.LastSeq = events[len(events)-1].Seq
		managed.record.UpdatedAt = events[len(events)-1].Time
	}
	m.mu.Unlock()
	return nil
}

func eventsInRange(events []model.SessionEvent, req model.SessionEventsRequest) []model.SessionEvent {
	out := make([]model.SessionEvent, 0, len(events))
	for _, event := range events {
		if req.LastSeq > 0 && event.Seq <= req.LastSeq {
			continue
		}
		if req.BeforeSeq > 0 && event.Seq >= req.BeforeSeq {
			continue
		}
		out = append(out, event)
	}
	if req.Limit > 0 && len(out) > req.Limit {
		if req.BeforeSeq > 0 || req.LastSeq == 0 {
			out = out[len(out)-req.Limit:]
		} else {
			out = out[:req.Limit]
		}
	}
	return out
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

func (m *Manager) watchBackend() {
	events, _ := m.backend.Subscribe()
	go func() {
		for notification := range events {
			m.handleNotification(notification)
		}
	}()
}

func (m *Manager) handleNotification(notification appserver.Notification) {
	switch notification.Method {
	case "thread/started":
		thread := threadFromParams(notification.Params, "thread")
		if thread.ID == "" {
			return
		}
		m.mu.Lock()
		m.applyThreadLocked(thread)
		m.mu.Unlock()
		m.appendEvent(thread.ID, "thread_started", "", map[string]any{"thread": notification.Params["thread"]})
	case "thread/status/changed":
		threadID := strAny(notification.Params["threadId"])
		if threadID == "" {
			return
		}
		status := threadStatusFromAny(notification.Params["status"])
		m.setStatus(threadID, status)
		m.appendEvent(threadID, "thread_status", "", map[string]any{"status": status, "rawStatus": notification.Params["status"]})
	case "thread/name/updated":
		threadID := strAny(notification.Params["threadId"])
		name := strAny(notification.Params["threadName"])
		if threadID == "" || name == "" {
			return
		}
		m.mu.Lock()
		if session := m.ensureSessionLocked(threadID); session != nil {
			session.record.Title = name
			session.record.UpdatedAt = time.Now().UTC()
		}
		m.mu.Unlock()
	case "turn/started":
		threadID := strAny(notification.Params["threadId"])
		turn := turnFromAny(notification.Params["turn"])
		if threadID == "" {
			return
		}
		m.setRunningTurn(threadID, turn.ID)
		m.appendEvent(threadID, "turn_started", "", map[string]any{"status": statusRunning, "turn": notification.Params["turn"]})
	case "turn/completed":
		threadID := strAny(notification.Params["threadId"])
		turn := turnFromAny(notification.Params["turn"])
		if threadID == "" {
			return
		}
		m.setRunningTurn(threadID, "")
		if turn.Status == "failed" {
			m.setStatus(threadID, statusError)
		} else {
			m.setStatus(threadID, statusIdle)
		}
		m.appendEvent(threadID, "turn_completed", "", map[string]any{"status": turn.Status, "turn": notification.Params["turn"]})
	case "item/started", "item/completed":
		threadID := strAny(notification.Params["threadId"])
		if threadID == "" {
			return
		}
		event, extra := eventFromThreadItem(threadID, itemMap(notification.Params["item"]), time.Now().UTC())
		if event.Kind == "" {
			return
		}
		if notification.Method == "item/started" {
			if event.Data == nil {
				event.Data = map[string]any{}
			}
			event.Data["status"] = firstNonEmpty(strAny(event.Data["status"]), statusRunning)
		}
		m.upsertItemEvent(threadID, event)
		for _, followup := range extra {
			m.upsertItemEvent(threadID, followup)
		}
	case "item/agentMessage/delta":
		threadID := strAny(notification.Params["threadId"])
		itemID := strAny(notification.Params["itemId"])
		delta := textAny(notification.Params["delta"])
		if threadID != "" && itemID != "" && delta != "" {
			m.appendAssistantDelta(threadID, itemID, delta)
		}
	case "item/commandExecution/outputDelta":
		threadID := strAny(notification.Params["threadId"])
		itemID := strAny(notification.Params["itemId"])
		delta := textAny(notification.Params["delta"])
		if threadID != "" && itemID != "" && delta != "" {
			m.appendToolOutputDelta(threadID, itemID, delta)
		}
	case "error":
		threadID := strAny(notification.Params["threadId"])
		message := firstNonEmpty(strAny(notification.Params["message"]), strAny(notification.Params["error"]))
		if threadID != "" && message != "" {
			m.finishWithError(threadID, errors.New(message))
		}
	case "appserver/disconnected":
		m.broadcastSystemError("Codex app-server disconnected.")
	default:
		if notification.IsRequest {
			m.handleServerRequestNotification(notification)
		}
	}
}

func (m *Manager) handleServerRequestNotification(notification appserver.Notification) {
	threadID := strAny(notification.Params["threadId"])
	if threadID == "" {
		threadID = strAny(notification.Params["conversationId"])
	}
	if threadID == "" {
		return
	}
	text := "Codex requested approval; this version declined it automatically."
	if command := strAny(notification.Params["command"]); command != "" {
		text = "Approval requested for command: " + command
	}
	m.appendEvent(threadID, "approval_request", text, map[string]any{
		"method":    notification.Method,
		"requestId": notification.RequestID,
		"params":    notification.Params,
		"decision":  "decline",
	})
}

func (m *Manager) applyThreadLocked(thread appserver.Thread) *managedSession {
	id := thread.ID
	if id == "" {
		id = thread.SessionID
	}
	if id == "" {
		return nil
	}
	session := m.sessions[id]
	if session == nil {
		session = &managedSession{
			itemSeq: map[string]int64{},
		}
		m.sessions[id] = session
	}
	record := recordFromThread(thread)
	if session.record.LastSeq > 0 {
		record.LastSeq = session.record.LastSeq
	}
	if len(session.events) > 0 && session.events[len(session.events)-1].Time.After(record.UpdatedAt) {
		record.UpdatedAt = session.events[len(session.events)-1].Time
	}
	session.record = record
	if session.itemSeq == nil {
		session.itemSeq = map[string]int64{}
	}
	return session
}

func recordFromThread(thread appserver.Thread) model.SessionRecord {
	id := firstNonEmpty(thread.ID, thread.SessionID)
	createdAt := unixSeconds(thread.CreatedAt)
	updatedAt := unixSeconds(thread.UpdatedAt)
	if thread.RecencyAt != nil && *thread.RecencyAt > thread.UpdatedAt {
		updatedAt = unixSeconds(*thread.RecencyAt)
	}
	if updatedAt.IsZero() {
		updatedAt = createdAt
	}
	title := strings.TrimSpace(thread.Preview)
	if thread.Name != nil && strings.TrimSpace(*thread.Name) != "" {
		title = strings.TrimSpace(*thread.Name)
	}
	if title == "" {
		title = "New session"
	}
	return model.SessionRecord{
		ID:            id,
		CodexThreadID: thread.ID,
		Title:         title,
		CWD:           thread.CWD,
		Status:        statusFromThreadStatus(thread.Status),
		CreatedAt:     createdAt,
		UpdatedAt:     updatedAt,
	}
}

func statusFromThreadStatus(status appserver.ThreadStatus) string {
	switch strings.ToLower(status.Type) {
	case "active":
		return statusRunning
	case "systemerror", "error":
		return statusError
	default:
		return statusIdle
	}
}

func threadStatusFromAny(value any) string {
	status, _ := value.(map[string]any)
	return statusFromThreadStatus(appserver.ThreadStatus{
		Type: strAny(status["type"]),
	})
}

func eventsFromThread(thread appserver.Thread) []model.SessionEvent {
	events := []model.SessionEvent{}
	sessionID := firstNonEmpty(thread.ID, thread.SessionID)
	var seq int64
	for _, turn := range thread.Turns {
		eventTime := turnTime(turn)
		for _, item := range turn.Items {
			event, extra := eventFromThreadItem(sessionID, item, eventTime.Add(time.Duration(seq)*time.Millisecond))
			if event.Kind == "" {
				continue
			}
			seq++
			event.SessionID = sessionID
			event.Seq = seq
			events = append(events, event)
			for _, followup := range extra {
				seq++
				followup.SessionID = sessionID
				followup.Seq = seq
				events = append(events, followup)
			}
		}
	}
	return events
}

func eventFromThreadItem(sessionID string, item map[string]any, eventTime time.Time) (model.SessionEvent, []model.SessionEvent) {
	itemType := strAny(item["type"])
	itemID := strAny(item["id"])
	data := compactItemData(item)
	if itemID != "" {
		data["itemId"] = itemID
	}
	data["itemType"] = itemType

	switch itemType {
	case "userMessage":
		return newParsedEvent("user_message", userInputText(item["content"]), eventTime, data), nil
	case "agentMessage":
		text := strAny(item["text"])
		data["streaming"] = false
		if phase := strAny(item["phase"]); phase != "" {
			data["phase"] = phase
		}
		return newParsedEvent("assistant_message", text, eventTime, data), nil
	case "reasoning":
		if text := stringListText(item["summary"]); text != "" {
			return newParsedEvent("summary", text, eventTime, data), nil
		}
		if text := stringListText(item["content"]); text != "" {
			return newParsedEvent("reasoning", text, eventTime, data), nil
		}
		data["status"] = firstNonEmpty(strAny(data["status"]), statusRunning)
		return newParsedEvent("reasoning", "", eventTime, data), nil
	case "commandExecution":
		command := strAny(item["command"])
		data["name"] = "exec_command"
		data["args"] = map[string]any{
			"cmd":     command,
			"workdir": strAny(item["cwd"]),
		}
		event := newParsedEvent("tool_call", "exec_command", eventTime, data)
		output := strAny(item["aggregatedOutput"])
		if output == "" {
			return event, nil
		}
		outputData := map[string]any{
			"itemId":    itemID + ":output",
			"call_id":   itemID,
			"output":    output,
			"status":    strAny(item["status"]),
			"streaming": false,
		}
		return event, []model.SessionEvent{newParsedEvent("tool_output", output, eventTime.Add(time.Millisecond), outputData)}
	case "fileChange":
		files := fileChangeItems(item["changes"])
		data["items"] = files
		return model.SessionEvent{
			Kind:  "tool_summary",
			Text:  fileChangeSummary(files),
			Time:  eventTime,
			Data:  data,
			Items: files,
		}, nil
	case "mcpToolCall":
		server := strAny(item["server"])
		tool := strAny(item["tool"])
		data["name"] = firstNonEmpty(server+"/"+tool, tool, "mcp_tool")
		return newParsedEvent("tool_call", data["name"].(string), eventTime, data), nil
	case "dynamicToolCall":
		tool := strAny(item["tool"])
		data["name"] = firstNonEmpty(tool, "dynamic_tool")
		return newParsedEvent("tool_call", data["name"].(string), eventTime, data), nil
	case "plan":
		return newParsedEvent("summary", strAny(item["text"]), eventTime, data), nil
	case "contextCompaction":
		return newParsedEvent("summary", "Context compacted", eventTime, data), nil
	case "webSearch":
		data["name"] = "web_search"
		return newParsedEvent("tool_call", "web_search", eventTime, data), nil
	case "imageView":
		return newParsedEvent("tool_summary", strAny(item["path"]), eventTime, data), nil
	default:
		if text := strAny(item["text"]); text != "" {
			return newParsedEvent(itemType, text, eventTime, data), nil
		}
		return model.SessionEvent{}, nil
	}
}

func newParsedEvent(kind, text string, eventTime time.Time, data map[string]any) model.SessionEvent {
	if eventTime.IsZero() {
		eventTime = time.Now().UTC()
	}
	return model.SessionEvent{
		Time: eventTime.UTC(),
		Kind: kind,
		Text: strings.TrimSpace(text),
		Data: data,
	}
}

func (m *Manager) appendEvent(sessionID, kind, text string, data map[string]any) {
	m.appendParsedEvent(sessionID, model.SessionEvent{
		Kind: kind,
		Text: text,
		Time: time.Now().UTC(),
		Data: data,
	})
}

func (m *Manager) appendParsedEvent(sessionID string, event model.SessionEvent) {
	m.mu.Lock()
	if event.Time.IsZero() {
		event.Time = time.Now().UTC()
	}
	session := m.ensureSessionLocked(sessionID)
	seq := session.record.LastSeq + 1
	event.SessionID = sessionID
	event.Seq = seq
	session.record.LastSeq = seq
	session.record.UpdatedAt = event.Time
	session.events = append(session.events, event)
	if itemID := eventItemID(event); itemID != "" {
		session.itemSeq[itemID] = seq
	}
	subscribers := m.subscriberListLocked()
	m.mu.Unlock()
	m.publishToSubscribers(subscribers, event)
}

func (m *Manager) upsertItemEvent(sessionID string, event model.SessionEvent) {
	itemID := eventItemID(event)
	if itemID == "" {
		m.appendParsedEvent(sessionID, event)
		return
	}

	m.mu.Lock()
	session := m.ensureSessionLocked(sessionID)
	if seq := session.itemSeq[itemID]; seq > 0 {
		event.SessionID = sessionID
		event.Seq = seq
		if event.Time.IsZero() {
			event.Time = time.Now().UTC()
		}
		for index := range session.events {
			if session.events[index].Seq == seq {
				session.events[index] = mergeEventUpdate(session.events[index], event)
				event = session.events[index]
				break
			}
		}
		session.record.UpdatedAt = event.Time
		subscribers := m.subscriberListLocked()
		m.mu.Unlock()
		m.publishToSubscribers(subscribers, event)
		return
	}
	if event.Time.IsZero() {
		event.Time = time.Now().UTC()
	}
	seq := session.record.LastSeq + 1
	event.SessionID = sessionID
	event.Seq = seq
	session.record.LastSeq = seq
	session.record.UpdatedAt = event.Time
	session.events = append(session.events, event)
	session.itemSeq[itemID] = seq
	subscribers := m.subscriberListLocked()
	m.mu.Unlock()
	m.publishToSubscribers(subscribers, event)
}

func mergeEventUpdate(existing, incoming model.SessionEvent) model.SessionEvent {
	if incoming.Kind != "" {
		existing.Kind = incoming.Kind
	}
	if incoming.Text != "" || existing.Text == "" {
		existing.Text = incoming.Text
	}
	if !incoming.Time.IsZero() {
		existing.Time = incoming.Time
	}
	if incoming.Data != nil {
		if existing.Data == nil {
			existing.Data = map[string]any{}
		}
		for key, value := range incoming.Data {
			existing.Data[key] = value
		}
	}
	if incoming.Items != nil {
		existing.Items = incoming.Items
	}
	return existing
}

func (m *Manager) appendAssistantDelta(sessionID, itemID, delta string) {
	m.mu.Lock()
	session := m.ensureSessionLocked(sessionID)
	now := time.Now().UTC()
	if seq := session.itemSeq[itemID]; seq > 0 {
		var event model.SessionEvent
		for index := range session.events {
			if session.events[index].Seq == seq {
				session.events[index].Text += delta
				session.events[index].Time = now
				if session.events[index].Data == nil {
					session.events[index].Data = map[string]any{}
				}
				session.events[index].Data["streaming"] = true
				session.events[index].Data["replace"] = true
				event = session.events[index]
				break
			}
		}
		session.record.UpdatedAt = now
		subscribers := m.subscriberListLocked()
		m.mu.Unlock()
		if event.Kind != "" {
			m.publishToSubscribers(subscribers, event)
		}
		return
	}
	event := model.SessionEvent{
		SessionID: sessionID,
		Seq:       session.record.LastSeq + 1,
		Time:      now,
		Kind:      "assistant_message",
		Text:      delta,
		Data: map[string]any{
			"itemId":    itemID,
			"streaming": true,
			"replace":   true,
		},
	}
	session.record.LastSeq = event.Seq
	session.record.UpdatedAt = now
	session.events = append(session.events, event)
	session.itemSeq[itemID] = event.Seq
	subscribers := m.subscriberListLocked()
	m.mu.Unlock()
	m.publishToSubscribers(subscribers, event)
}

func (m *Manager) appendToolOutputDelta(sessionID, itemID, delta string) {
	outputID := itemID + ":output"
	m.mu.Lock()
	session := m.ensureSessionLocked(sessionID)
	now := time.Now().UTC()
	if seq := session.itemSeq[outputID]; seq > 0 {
		var event model.SessionEvent
		for index := range session.events {
			if session.events[index].Seq == seq {
				session.events[index].Text += delta
				session.events[index].Time = now
				if session.events[index].Data == nil {
					session.events[index].Data = map[string]any{}
				}
				session.events[index].Data["output"] = session.events[index].Text
				session.events[index].Data["streaming"] = true
				session.events[index].Data["replace"] = true
				event = session.events[index]
				break
			}
		}
		session.record.UpdatedAt = now
		subscribers := m.subscriberListLocked()
		m.mu.Unlock()
		if event.Kind != "" {
			m.publishToSubscribers(subscribers, event)
		}
		return
	}
	event := model.SessionEvent{
		SessionID: sessionID,
		Seq:       session.record.LastSeq + 1,
		Time:      now,
		Kind:      "tool_output",
		Text:      delta,
		Data: map[string]any{
			"itemId":    outputID,
			"call_id":   itemID,
			"output":    delta,
			"streaming": true,
			"replace":   true,
		},
	}
	session.record.LastSeq = event.Seq
	session.record.UpdatedAt = now
	session.events = append(session.events, event)
	session.itemSeq[outputID] = event.Seq
	subscribers := m.subscriberListLocked()
	m.mu.Unlock()
	m.publishToSubscribers(subscribers, event)
}

func (m *Manager) ensureSessionLocked(sessionID string) *managedSession {
	session := m.sessions[sessionID]
	if session == nil {
		now := time.Now().UTC()
		session = &managedSession{
			record: model.SessionRecord{
				ID:            sessionID,
				CodexThreadID: sessionID,
				Title:         "New session",
				Status:        statusIdle,
				CreatedAt:     now,
				UpdatedAt:     now,
			},
			itemSeq: map[string]int64{},
		}
		m.sessions[sessionID] = session
	}
	if session.itemSeq == nil {
		session.itemSeq = map[string]int64{}
	}
	return session
}

func (m *Manager) setRunningTurn(sessionID, turnID string) {
	m.mu.Lock()
	if session := m.ensureSessionLocked(sessionID); session != nil {
		session.runningTurnID = turnID
		if turnID != "" {
			session.record.Status = statusRunning
		}
		session.record.UpdatedAt = time.Now().UTC()
	}
	m.mu.Unlock()
}

func (m *Manager) setStatus(sessionID, status string) {
	m.mu.Lock()
	if session := m.ensureSessionLocked(sessionID); session != nil {
		session.record.Status = status
		session.record.UpdatedAt = time.Now().UTC()
	}
	m.mu.Unlock()
}

func (m *Manager) finishWithError(sessionID string, err error) {
	m.setRunningTurn(sessionID, "")
	m.setStatus(sessionID, statusError)
	m.appendEvent(sessionID, "error", err.Error(), nil)
}

func (m *Manager) broadcastSystemError(text string) {
	m.mu.Lock()
	ids := make([]string, 0, len(m.sessions))
	for id := range m.sessions {
		ids = append(ids, id)
	}
	m.mu.Unlock()
	for _, id := range ids {
		m.finishWithError(id, errors.New(text))
	}
}

func (m *Manager) subscriberListLocked() []chan model.SessionEvent {
	subscribers := make([]chan model.SessionEvent, 0, len(m.subscribers))
	for _, ch := range m.subscribers {
		subscribers = append(subscribers, ch)
	}
	return subscribers
}

func (m *Manager) publishToSubscribers(subscribers []chan model.SessionEvent, event model.SessionEvent) {
	for _, ch := range subscribers {
		select {
		case ch <- event:
		default:
		}
	}
}

func itemSeqIndex(events []model.SessionEvent) map[string]int64 {
	index := map[string]int64{}
	for _, event := range events {
		if itemID := eventItemID(event); itemID != "" {
			index[itemID] = event.Seq
		}
	}
	return index
}

func eventItemID(event model.SessionEvent) string {
	if event.Data == nil {
		return ""
	}
	return strAny(event.Data["itemId"])
}

func threadFromParams(params map[string]any, key string) appserver.Thread {
	var thread appserver.Thread
	raw, err := json.Marshal(params[key])
	if err != nil {
		return thread
	}
	_ = json.Unmarshal(raw, &thread)
	return thread
}

func turnFromAny(value any) appserver.Turn {
	var turn appserver.Turn
	raw, err := json.Marshal(value)
	if err != nil {
		return turn
	}
	_ = json.Unmarshal(raw, &turn)
	return turn
}

func itemMap(value any) map[string]any {
	item, _ := value.(map[string]any)
	return item
}

func compactItemData(item map[string]any) map[string]any {
	data := map[string]any{}
	for _, key := range []string{
		"type",
		"id",
		"status",
		"phase",
		"command",
		"cwd",
		"aggregatedOutput",
		"exitCode",
		"durationMs",
		"server",
		"tool",
		"arguments",
		"result",
		"error",
		"changes",
	} {
		if value, ok := item[key]; ok && value != nil {
			data[key] = value
		}
	}
	return data
}

func userInputText(value any) string {
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
		if text := strAny(body["text"]); text != "" {
			parts = append(parts, text)
		}
	}
	return strings.TrimSpace(strings.Join(parts, "\n\n"))
}

func stringListText(value any) string {
	items, ok := value.([]any)
	if !ok {
		return strAny(value)
	}
	parts := make([]string, 0, len(items))
	for _, item := range items {
		if text := strAny(item); text != "" {
			parts = append(parts, text)
		}
	}
	return strings.TrimSpace(strings.Join(parts, "\n"))
}

func fileChangeItems(value any) []map[string]any {
	changes, ok := value.([]any)
	if !ok {
		return nil
	}
	items := make([]map[string]any, 0, len(changes))
	for _, change := range changes {
		body, ok := change.(map[string]any)
		if !ok {
			continue
		}
		path := firstNonEmpty(strAny(body["path"]), strAny(body["file"]))
		if path == "" {
			continue
		}
		items = append(items, map[string]any{
			"text": path,
			"path": path,
			"kind": strAny(body["kind"]),
		})
	}
	return items
}

func fileChangeSummary(files []map[string]any) string {
	if len(files) == 0 {
		return "Edited files"
	}
	if len(files) == 1 {
		return strAny(files[0]["path"])
	}
	return fmt.Sprintf("Edited %d files", len(files))
}

func turnTime(turn appserver.Turn) time.Time {
	if turn.StartedAt != nil && *turn.StartedAt > 0 {
		return unixSeconds(*turn.StartedAt)
	}
	if turn.CompletedAt != nil && *turn.CompletedAt > 0 {
		return unixSeconds(*turn.CompletedAt)
	}
	return time.Now().UTC()
}

func unixSeconds(value int64) time.Time {
	if value <= 0 {
		return time.Time{}
	}
	if value > 1_000_000_000_000 {
		return time.UnixMilli(value).UTC()
	}
	return time.Unix(value, 0).UTC()
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

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func strAny(value any) string {
	switch v := value.(type) {
	case string:
		return strings.TrimSpace(v)
	case fmt.Stringer:
		return strings.TrimSpace(v.String())
	case json.Number:
		return v.String()
	default:
		return ""
	}
}

func textAny(value any) string {
	switch v := value.(type) {
	case string:
		return v
	case fmt.Stringer:
		return v.String()
	case json.Number:
		return v.String()
	default:
		return ""
	}
}
