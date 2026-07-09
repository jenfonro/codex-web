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
	statusDone    = "completed"
	statusStopped = "interrupted"
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
	subscribers map[int]chan model.SessionStateUpdate
	nextSubID   int
}

type managedSession struct {
	record        model.SessionRecord
	turns         []model.SessionTurn
	stateLoaded   bool
	runningTurnID string
	lastSeq       int64
	turnIndex     map[string]int
	itemIndex     map[string]itemLocation
}

type itemLocation struct {
	Turn int
	Item int
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
		subscribers: map[int]chan model.SessionStateUpdate{},
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
	if session != nil {
		session.stateLoaded = true
	}
	m.mu.Unlock()
	threadID := firstNonEmpty(thread.ID, thread.SessionID)

	turn, err := m.backend.StartTurn(ctx, threadID, prompt, cwd)
	if err != nil {
		m.finishWithError(threadID, err)
		return model.SessionRecord{}, err
	}
	m.applyTurnStarted(threadID, turn)
	return m.record(threadID)
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
	resumedThreadID := firstNonEmpty(thread.ID, thread.SessionID, threadID)
	m.setStatusLocked(resumedThreadID, statusRunning)
	m.mu.Unlock()

	turn, err := m.backend.StartTurn(ctx, resumedThreadID, prompt, session.record.CWD)
	if err != nil {
		m.finishWithError(resumedThreadID, err)
		return model.SessionRecord{}, err
	}
	m.applyTurnStarted(resumedThreadID, turn)
	return m.record(resumedThreadID)
}

func (m *Manager) Cancel(id string) error {
	session, err := m.lookup(id)
	if err != nil {
		return err
	}
	threadID := firstNonEmpty(session.record.CodexThreadID, session.record.ID)
	if threadID == "" || session.runningTurnID == "" {
		m.applyStatus(id, statusIdle)
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := m.backend.InterruptTurn(ctx, threadID, session.runningTurnID); err != nil {
		return err
	}
	m.mu.Lock()
	managed := m.ensureSessionLocked(id)
	turnIndex, hasTurn := managed.turnIndex[session.runningTurnID]
	managed.runningTurnID = ""
	if hasTurn {
		now := time.Now().UTC()
		turn := &managed.turns[turnIndex]
		turn.Status = "interrupted"
		turn.CompletedAt = &now
		turn.DurationMs = normalizedTurnDurationMs(turn.DurationMs, turn.StartedAt, turn.CompletedAt)
	}
	m.setStatusLocked(id, statusIdle)
	update := m.sessionUpdateLocked(managed, "session")
	if hasTurn {
		turn := cloneTurn(managed.turns[turnIndex])
		update.Type = "turn"
		update.Turn = &turn
	}
	subscribers := m.subscriberListLocked()
	m.mu.Unlock()
	m.publishToSubscribers(subscribers, update)
	return nil
}

func (m *Manager) State(sessionID string) (model.SessionState, error) {
	if err := m.ensureStateLoaded(sessionID); err != nil {
		return model.SessionState{}, err
	}
	m.mu.Lock()
	session := m.sessions[sessionID]
	if session == nil {
		m.mu.Unlock()
		return model.SessionState{}, errors.New("session not found")
	}
	state := stateCopyLocked(session)
	m.mu.Unlock()
	return state, nil
}

func (m *Manager) Events(req model.SessionEventsRequest) (model.SessionEventsPage, error) {
	state, err := m.State(req.SessionID)
	if err != nil {
		return model.SessionEventsPage{}, err
	}
	events := eventsInRange(eventsFromState(state), req)
	return sessionEventsPage(events), nil
}

func (m *Manager) Subscribe() (<-chan model.SessionStateUpdate, func()) {
	ch := make(chan model.SessionStateUpdate, 256)
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

func (m *Manager) ensureStateLoaded(sessionID string) error {
	m.mu.Lock()
	session := m.sessions[sessionID]
	if session != nil && session.stateLoaded {
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

	m.mu.Lock()
	managed := m.applyThreadLocked(thread)
	if managed != nil {
		managed.turns = turnsFromThread(thread)
		managed.stateLoaded = true
		managed.rebuildIndexes()
		managed.runningTurnID = runningTurnID(managed.turns)
		if managed.lastSeq == 0 {
			managed.lastSeq = int64(countStateItems(managed.turns))
		}
		managed.record.LastSeq = managed.lastSeq
		if managed.runningTurnID != "" {
			managed.record.Status = statusRunning
		}
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
	return sessionCopyLocked(session), nil
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
		session := m.applyThreadLocked(thread)
		update := m.sessionUpdateLocked(session, "session")
		subscribers := m.subscriberListLocked()
		m.mu.Unlock()
		m.publishToSubscribers(subscribers, update)
	case "thread/status/changed":
		threadID := strAny(notification.Params["threadId"])
		if threadID == "" {
			return
		}
		m.applyStatus(threadID, threadStatusFromAny(notification.Params["status"]))
	case "thread/name/updated":
		threadID := strAny(notification.Params["threadId"])
		name := strAny(notification.Params["threadName"])
		if threadID == "" || name == "" {
			return
		}
		m.mu.Lock()
		session := m.ensureSessionLocked(threadID)
		session.record.Title = name
		session.record.UpdatedAt = time.Now().UTC()
		update := m.sessionUpdateLocked(session, "session")
		subscribers := m.subscriberListLocked()
		m.mu.Unlock()
		m.publishToSubscribers(subscribers, update)
	case "turn/started":
		threadID := strAny(notification.Params["threadId"])
		if threadID == "" {
			return
		}
		m.applyTurnStarted(threadID, turnFromAny(notification.Params["turn"]))
	case "turn/completed":
		threadID := strAny(notification.Params["threadId"])
		if threadID == "" {
			return
		}
		m.applyTurnCompleted(threadID, turnFromAny(notification.Params["turn"]))
	case "item/started":
		m.applyItemNotification(notification, statusRunning)
	case "item/completed":
		m.applyItemNotification(notification, "completed")
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
			m.appendCommandOutputDelta(threadID, itemID, delta)
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

func (m *Manager) applyTurnStarted(sessionID string, turn appserver.Turn) {
	m.mu.Lock()
	session := m.ensureSessionLocked(sessionID)
	turnID := firstNonEmpty(turn.ID, session.runningTurnID, fmt.Sprintf("turn-%d", session.lastSeq+1))
	turn.ID = turnID
	modelTurn := turnFromAppServer(turn)
	modelTurn.Status = normalizeRuntimeStatus(modelTurn.Status, statusRunning)
	index := session.upsertTurn(modelTurn)
	session.runningTurnID = turnID
	m.setStatusLocked(sessionID, statusRunning)
	update := m.turnUpdateLocked(session, index)
	subscribers := m.subscriberListLocked()
	m.mu.Unlock()
	m.publishToSubscribers(subscribers, update)
}

func (m *Manager) applyTurnCompleted(sessionID string, turn appserver.Turn) {
	m.mu.Lock()
	session := m.ensureSessionLocked(sessionID)
	turnID := firstNonEmpty(turn.ID, session.runningTurnID)
	if turnID == "" {
		m.mu.Unlock()
		return
	}
	turn.ID = turnID
	modelTurn := turnFromAppServer(turn)
	modelTurn.Status = normalizeRuntimeStatus(modelTurn.Status, statusDone)
	index := session.upsertTurn(modelTurn)
	if session.runningTurnID == turnID {
		session.runningTurnID = ""
	}
	if modelTurn.Status == statusError {
		m.setStatusLocked(sessionID, statusError)
	} else {
		m.setStatusLocked(sessionID, statusIdle)
	}
	update := m.turnUpdateLocked(session, index)
	subscribers := m.subscriberListLocked()
	m.mu.Unlock()
	m.publishToSubscribers(subscribers, update)
}

func (m *Manager) applyItemNotification(notification appserver.Notification, defaultStatus string) {
	threadID := strAny(notification.Params["threadId"])
	rawItem := itemMap(notification.Params["item"])
	if threadID == "" || rawItem == nil {
		return
	}
	item := itemFromMap(rawItem, time.Now().UTC())
	if item.ID == "" {
		item.ID = fmt.Sprintf("%s-%d", firstNonEmpty(item.Type, "item"), time.Now().UnixNano())
	}
	if item.Status == "" {
		item.Status = defaultStatus
	}
	m.mu.Lock()
	session := m.ensureSessionLocked(threadID)
	turnID := m.turnIDForItemLocked(session, notification.Params, rawItem)
	turnIndex := session.ensureTurn(turnID)
	itemIndex := session.upsertItem(turnIndex, item)
	if item.Status == statusRunning {
		session.runningTurnID = session.turns[turnIndex].ID
		m.setStatusLocked(threadID, statusRunning)
	}
	update := m.itemUpdateLocked(session, turnIndex, itemIndex)
	subscribers := m.subscriberListLocked()
	m.mu.Unlock()
	m.publishToSubscribers(subscribers, update)
}

func (m *Manager) appendAssistantDelta(sessionID, itemID, delta string) {
	m.mu.Lock()
	session := m.ensureSessionLocked(sessionID)
	turnIndex, itemIndex := session.ensureItem(m.turnIDForItemLocked(session, nil, nil), model.SessionItem{
		ID:     itemID,
		Type:   "agentMessage",
		Status: statusRunning,
		Phase:  "final_answer",
		Time:   time.Now().UTC(),
	})
	item := &session.turns[turnIndex].Items[itemIndex]
	item.Text += delta
	item.Status = statusRunning
	item.Time = time.Now().UTC()
	session.runningTurnID = session.turns[turnIndex].ID
	m.setStatusLocked(sessionID, statusRunning)
	update := m.itemUpdateLocked(session, turnIndex, itemIndex)
	subscribers := m.subscriberListLocked()
	m.mu.Unlock()
	m.publishToSubscribers(subscribers, update)
}

func (m *Manager) appendCommandOutputDelta(sessionID, itemID, delta string) {
	m.mu.Lock()
	session := m.ensureSessionLocked(sessionID)
	turnIndex, itemIndex := session.ensureItem(m.turnIDForItemLocked(session, nil, nil), model.SessionItem{
		ID:     itemID,
		Type:   "commandExecution",
		Status: statusRunning,
		Time:   time.Now().UTC(),
	})
	item := &session.turns[turnIndex].Items[itemIndex]
	item.Output += delta
	item.Status = statusRunning
	item.Time = time.Now().UTC()
	session.runningTurnID = session.turns[turnIndex].ID
	m.setStatusLocked(sessionID, statusRunning)
	update := m.itemUpdateLocked(session, turnIndex, itemIndex)
	subscribers := m.subscriberListLocked()
	m.mu.Unlock()
	m.publishToSubscribers(subscribers, update)
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
	now := time.Now().UTC()
	item := model.SessionItem{
		ID:     firstNonEmpty(notification.RequestID, fmt.Sprintf("approval-%d", now.UnixNano())),
		Type:   "approvalRequest",
		Status: "declined",
		Text:   text,
		Time:   now,
	}
	m.mu.Lock()
	session := m.ensureSessionLocked(threadID)
	turnIndex, itemIndex := session.ensureItem(m.turnIDForItemLocked(session, notification.Params, nil), item)
	update := m.itemUpdateLocked(session, turnIndex, itemIndex)
	subscribers := m.subscriberListLocked()
	m.mu.Unlock()
	m.publishToSubscribers(subscribers, update)
}

func (m *Manager) applyStatus(sessionID, status string) {
	m.mu.Lock()
	session := m.ensureSessionLocked(sessionID)
	m.setStatusLocked(sessionID, status)
	update := m.sessionUpdateLocked(session, "session")
	subscribers := m.subscriberListLocked()
	m.mu.Unlock()
	m.publishToSubscribers(subscribers, update)
}

func (m *Manager) finishWithError(sessionID string, err error) {
	m.mu.Lock()
	session := m.ensureSessionLocked(sessionID)
	session.runningTurnID = ""
	m.setStatusLocked(sessionID, statusError)
	update := m.sessionUpdateLocked(session, "error")
	update.Error = err.Error()
	subscribers := m.subscriberListLocked()
	m.mu.Unlock()
	m.publishToSubscribers(subscribers, update)
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
			turnIndex: map[string]int{},
			itemIndex: map[string]itemLocation{},
		}
		m.sessions[id] = session
	}
	record := recordFromThread(thread)
	if session.lastSeq > 0 {
		record.LastSeq = session.lastSeq
	}
	if !session.record.UpdatedAt.IsZero() && session.record.UpdatedAt.After(record.UpdatedAt) {
		record.UpdatedAt = session.record.UpdatedAt
	}
	session.record = record
	if len(thread.Turns) > 0 && !session.stateLoaded {
		session.turns = turnsFromThread(thread)
		session.stateLoaded = true
		session.rebuildIndexes()
		session.runningTurnID = runningTurnID(session.turns)
	}
	session.ensureIndexes()
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
	switch strings.ToLower(strings.TrimSpace(status.Type)) {
	case "active", "running":
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

func turnsFromThread(thread appserver.Thread) []model.SessionTurn {
	turns := make([]model.SessionTurn, 0, len(thread.Turns))
	for turnIndex, turn := range thread.Turns {
		modelTurn := turnFromAppServer(turn)
		if modelTurn.ID == "" {
			modelTurn.ID = fmt.Sprintf("turn-%d", turnIndex+1)
		}
		for itemIndex := range modelTurn.Items {
			if modelTurn.Items[itemIndex].ID == "" {
				modelTurn.Items[itemIndex].ID = fmt.Sprintf("%s-%d", firstNonEmpty(modelTurn.Items[itemIndex].Type, "item"), itemIndex+1)
			}
		}
		turns = append(turns, modelTurn)
	}
	return turns
}

func turnFromAppServer(turn appserver.Turn) model.SessionTurn {
	startedAt := timePtrFromUnix(turn.StartedAt)
	completedAt := timePtrFromUnix(turn.CompletedAt)
	itemTime := time.Now().UTC()
	if startedAt != nil {
		itemTime = *startedAt
	} else if completedAt != nil {
		itemTime = *completedAt
	}
	items := make([]model.SessionItem, 0, len(turn.Items))
	for index, sourceItem := range turn.Items {
		item := itemFromMap(sourceItem, itemTime.Add(time.Duration(index)*time.Millisecond))
		items = append(items, item)
	}
	return model.SessionTurn{
		ID:          turn.ID,
		Status:      normalizeRuntimeStatus(turn.Status, statusIdle),
		StartedAt:   startedAt,
		CompletedAt: completedAt,
		DurationMs:  normalizedTurnDurationMs(turn.DurationMs, startedAt, completedAt),
		Error:       turn.Error,
		Items:       items,
	}
}

func itemFromMap(item map[string]any, itemTime time.Time) model.SessionItem {
	if itemTime.IsZero() {
		itemTime = time.Now().UTC()
	}
	itemKind := strAny(item["type"])
	out := model.SessionItem{
		ID:      strAny(item["id"]),
		Type:    itemKind,
		Status:  normalizeRuntimeStatus(strAny(item["status"]), ""),
		Time:    itemTime.UTC(),
		Phase:   strAny(item["phase"]),
		Command: strAny(item["command"]),
		CWD:     strAny(item["cwd"]),
		Server:  strAny(item["server"]),
		Tool:    strAny(item["tool"]),
		Name:    strAny(item["name"]),
	}
	switch itemKind {
	case "userMessage":
		out.Text = userInputText(item["content"])
	case "agentMessage":
		out.Text = textAny(item["text"])
	case "reasoning":
		out.Text = firstNonEmpty(stringListText(item["summary"]), stringListText(item["content"]))
	case "commandExecution":
		out.Text = out.Command
		out.Output = textAny(item["aggregatedOutput"])
		if out.Name == "" {
			out.Name = "exec_command"
		}
	case "fileChange":
		out.Items = fileChangeItems(item["changes"])
		out.Text = fileChangeSummary(out.Items)
	case "mcpToolCall":
		out.Name = firstNonEmpty(out.Server+"/"+out.Tool, out.Tool, "mcp_tool")
		out.Text = out.Name
	case "dynamicToolCall":
		out.Name = firstNonEmpty(strAny(item["tool"]), "dynamic_tool")
		out.Text = out.Name
	case "plan":
		out.Text = textAny(item["text"])
	case "contextCompaction":
		out.Text = "Context compacted"
	case "webSearch":
		out.Name = "web_search"
		out.Text = "web_search"
	case "imageView":
		out.Text = strAny(item["path"])
	default:
		out.Text = textAny(item["text"])
	}
	return out
}

func runningTurnID(turns []model.SessionTurn) string {
	for index := len(turns) - 1; index >= 0; index-- {
		if isRunningStatus(turns[index].Status) {
			return turns[index].ID
		}
	}
	return ""
}

func countStateItems(turns []model.SessionTurn) int {
	count := 0
	for _, turn := range turns {
		count++
		count += len(turn.Items)
	}
	return count
}

func (m *Manager) turnIDForItemLocked(session *managedSession, params map[string]any, rawItem map[string]any) string {
	if params != nil {
		if turnID := strAny(params["turnId"]); turnID != "" {
			return turnID
		}
	}
	if rawItem != nil {
		if turnID := strAny(rawItem["turnId"]); turnID != "" {
			return turnID
		}
	}
	if session.runningTurnID != "" {
		return session.runningTurnID
	}
	if len(session.turns) > 0 {
		return session.turns[len(session.turns)-1].ID
	}
	return fmt.Sprintf("turn-%d", session.lastSeq+1)
}

func (s *managedSession) ensureIndexes() {
	if s.turnIndex == nil {
		s.turnIndex = map[string]int{}
	}
	if s.itemIndex == nil {
		s.itemIndex = map[string]itemLocation{}
	}
}

func (s *managedSession) rebuildIndexes() {
	s.ensureIndexes()
	clear(s.turnIndex)
	clear(s.itemIndex)
	for turnIndex := range s.turns {
		turn := &s.turns[turnIndex]
		if turn.ID != "" {
			s.turnIndex[turn.ID] = turnIndex
		}
		for itemIndex := range turn.Items {
			item := &turn.Items[itemIndex]
			if item.ID != "" {
				s.itemIndex[item.ID] = itemLocation{Turn: turnIndex, Item: itemIndex}
			}
		}
	}
}

func (s *managedSession) ensureTurn(turnID string) int {
	s.ensureIndexes()
	turnID = strings.TrimSpace(turnID)
	if turnID == "" {
		turnID = fmt.Sprintf("turn-%d", len(s.turns)+1)
	}
	if index, ok := s.turnIndex[turnID]; ok {
		return index
	}
	now := time.Now().UTC()
	turn := model.SessionTurn{
		ID:        turnID,
		Status:    statusRunning,
		StartedAt: &now,
		Items:     []model.SessionItem{},
	}
	s.turns = append(s.turns, turn)
	index := len(s.turns) - 1
	s.turnIndex[turnID] = index
	return index
}

func (s *managedSession) upsertTurn(turn model.SessionTurn) int {
	s.ensureIndexes()
	if turn.ID == "" {
		turn.ID = fmt.Sprintf("turn-%d", len(s.turns)+1)
	}
	if index, ok := s.turnIndex[turn.ID]; ok {
		existing := &s.turns[index]
		mergeTurn(existing, turn)
		s.rebuildIndexes()
		return index
	}
	s.turns = append(s.turns, turn)
	index := len(s.turns) - 1
	s.turnIndex[turn.ID] = index
	for itemIndex := range turn.Items {
		if itemID := turn.Items[itemIndex].ID; itemID != "" {
			s.itemIndex[itemID] = itemLocation{Turn: index, Item: itemIndex}
		}
	}
	return index
}

func (s *managedSession) upsertItem(turnIndex int, item model.SessionItem) int {
	s.ensureIndexes()
	if item.ID != "" {
		if location, ok := s.itemIndex[item.ID]; ok {
			existing := &s.turns[location.Turn].Items[location.Item]
			mergeItem(existing, item)
			return location.Item
		}
	}
	if item.Time.IsZero() {
		item.Time = time.Now().UTC()
	}
	s.turns[turnIndex].Items = append(s.turns[turnIndex].Items, item)
	itemIndex := len(s.turns[turnIndex].Items) - 1
	if item.ID != "" {
		s.itemIndex[item.ID] = itemLocation{Turn: turnIndex, Item: itemIndex}
	}
	return itemIndex
}

func finalizeTerminalTurnItems(turn *model.SessionTurn) {
	if turn == nil {
		return
	}
	status := terminalItemStatus(turn.Status)
	if status == "" {
		return
	}
	for index := range turn.Items {
		if turn.Items[index].Status == "" || isRunningStatus(turn.Items[index].Status) {
			turn.Items[index].Status = status
		}
	}
}

func terminalItemStatus(turnStatus string) string {
	switch strings.ToLower(strings.TrimSpace(turnStatus)) {
	case statusError:
		return statusError
	case statusStopped:
		return statusStopped
	case statusDone:
		return statusDone
	default:
		return ""
	}
}

func (s *managedSession) ensureItem(turnID string, item model.SessionItem) (int, int) {
	s.ensureIndexes()
	if item.ID != "" {
		if location, ok := s.itemIndex[item.ID]; ok {
			return location.Turn, location.Item
		}
	}
	turnIndex := s.ensureTurn(turnID)
	itemIndex := s.upsertItem(turnIndex, item)
	return turnIndex, itemIndex
}

func mergeTurn(existing *model.SessionTurn, incoming model.SessionTurn) {
	if incoming.Status != "" {
		existing.Status = incoming.Status
	}
	if incoming.StartedAt != nil {
		existing.StartedAt = incoming.StartedAt
	}
	if incoming.CompletedAt != nil {
		existing.CompletedAt = incoming.CompletedAt
	}
	if incoming.DurationMs != nil {
		existing.DurationMs = incoming.DurationMs
	}
	if incoming.Error != nil {
		existing.Error = cloneMap(incoming.Error)
	}
	if len(incoming.Items) > 0 {
		for _, item := range incoming.Items {
			index := -1
			for existingIndex := range existing.Items {
				if item.ID != "" && existing.Items[existingIndex].ID == item.ID {
					index = existingIndex
					break
				}
			}
			if index >= 0 {
				mergeItem(&existing.Items[index], item)
			} else {
				existing.Items = append(existing.Items, item)
			}
		}
	}
}

func mergeItem(existing *model.SessionItem, incoming model.SessionItem) {
	if incoming.Type != "" {
		existing.Type = incoming.Type
	}
	if incoming.Status != "" {
		existing.Status = incoming.Status
	}
	if !incoming.Time.IsZero() {
		existing.Time = incoming.Time
	}
	if incoming.Text != "" || existing.Text == "" {
		existing.Text = incoming.Text
	}
	if incoming.Output != "" || existing.Output == "" {
		existing.Output = incoming.Output
	}
	if incoming.Command != "" {
		existing.Command = incoming.Command
	}
	if incoming.CWD != "" {
		existing.CWD = incoming.CWD
	}
	if incoming.Phase != "" {
		existing.Phase = incoming.Phase
	}
	if incoming.Server != "" {
		existing.Server = incoming.Server
	}
	if incoming.Tool != "" {
		existing.Tool = incoming.Tool
	}
	if incoming.Name != "" {
		existing.Name = incoming.Name
	}
	if incoming.Items != nil {
		existing.Items = cloneMapSlice(incoming.Items)
	}
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
			turnIndex: map[string]int{},
			itemIndex: map[string]itemLocation{},
		}
		m.sessions[sessionID] = session
	}
	session.ensureIndexes()
	return session
}

func (m *Manager) setStatusLocked(sessionID, status string) {
	session := m.ensureSessionLocked(sessionID)
	session.record.Status = status
	session.record.UpdatedAt = time.Now().UTC()
}

func (m *Manager) sessionUpdateLocked(session *managedSession, updateType string) model.SessionStateUpdate {
	now := time.Now().UTC()
	session.lastSeq++
	session.record.LastSeq = session.lastSeq
	session.record.UpdatedAt = now
	record := session.record
	return model.SessionStateUpdate{
		SessionID: record.ID,
		Seq:       session.lastSeq,
		Time:      now,
		Type:      updateType,
		Session:   &record,
	}
}

func (m *Manager) turnUpdateLocked(session *managedSession, turnIndex int) model.SessionStateUpdate {
	update := m.sessionUpdateLocked(session, "turn")
	turn := cloneTurn(session.turns[turnIndex])
	update.Turn = &turn
	return update
}

func (m *Manager) itemUpdateLocked(session *managedSession, turnIndex, itemIndex int) model.SessionStateUpdate {
	update := m.sessionUpdateLocked(session, "item")
	turn := cloneTurn(session.turns[turnIndex])
	item := cloneItem(session.turns[turnIndex].Items[itemIndex])
	update.Turn = &turn
	update.Item = &item
	return update
}

func (m *Manager) subscriberListLocked() []chan model.SessionStateUpdate {
	subscribers := make([]chan model.SessionStateUpdate, 0, len(m.subscribers))
	for _, ch := range m.subscribers {
		subscribers = append(subscribers, ch)
	}
	return subscribers
}

func (m *Manager) publishToSubscribers(subscribers []chan model.SessionStateUpdate, update model.SessionStateUpdate) {
	for _, ch := range subscribers {
		select {
		case ch <- update:
		default:
		}
	}
}

func stateCopyLocked(session *managedSession) model.SessionState {
	turns := make([]model.SessionTurn, 0, len(session.turns))
	for _, turn := range session.turns {
		turns = append(turns, cloneTurn(turn))
	}
	return model.SessionState{
		Session: session.record,
		Turns:   turns,
		LastSeq: session.lastSeq,
	}
}

func sessionCopyLocked(session *managedSession) *managedSession {
	copySession := *session
	copySession.turns = make([]model.SessionTurn, 0, len(session.turns))
	for _, turn := range session.turns {
		copySession.turns = append(copySession.turns, cloneTurn(turn))
	}
	copySession.turnIndex = map[string]int{}
	copySession.itemIndex = map[string]itemLocation{}
	copySession.rebuildIndexes()
	return &copySession
}

func cloneTurn(turn model.SessionTurn) model.SessionTurn {
	out := turn
	if turn.StartedAt != nil {
		startedAt := *turn.StartedAt
		out.StartedAt = &startedAt
	}
	if turn.CompletedAt != nil {
		completedAt := *turn.CompletedAt
		out.CompletedAt = &completedAt
	}
	if turn.DurationMs != nil {
		duration := *turn.DurationMs
		out.DurationMs = &duration
	}
	out.Error = cloneMap(turn.Error)
	out.Items = make([]model.SessionItem, 0, len(turn.Items))
	for _, item := range turn.Items {
		out.Items = append(out.Items, cloneItem(item))
	}
	finalizeTerminalTurnItems(&out)
	if item := terminalTurnItem(out); item != nil {
		out.Items = append(out.Items, *item)
	}
	return out
}

func cloneItem(item model.SessionItem) model.SessionItem {
	out := item
	out.Items = cloneMapSlice(item.Items)
	return out
}

func eventsFromState(state model.SessionState) []model.SessionEvent {
	events := []model.SessionEvent{}
	var seq int64
	for _, turn := range state.Turns {
		for itemIndex, item := range turn.Items {
			eventTime := item.Time
			if eventTime.IsZero() && turn.StartedAt != nil {
				eventTime = *turn.StartedAt
			}
			event, extra := eventFromStateItem(state.Session.ID, turn, item, eventTime)
			if event.Kind == "" {
				continue
			}
			seq++
			event.SessionID = state.Session.ID
			event.Seq = seq
			if event.Data == nil {
				event.Data = map[string]any{}
			}
			event.Data["turnId"] = turn.ID
			event.Data["contentUnit"] = itemIndex
			events = append(events, event)
			for _, followup := range extra {
				seq++
				followup.SessionID = state.Session.ID
				followup.Seq = seq
				events = append(events, followup)
			}
		}
	}
	return events
}

func terminalTurnItem(turn model.SessionTurn) *model.SessionItem {
	if len(turn.Error) > 0 {
		return &model.SessionItem{
			ID:     firstNonEmpty(turn.ID, "turn") + "-terminal",
			Type:   "error",
			Status: firstNonEmpty(turn.Status, statusError),
			Time:   terminalTurnTime(turn),
			Text:   turnErrorText(turn.Error),
		}
	}
	if !turnHasNoVisibleResponse(turn) {
		return nil
	}
	text := "No response was produced for this turn."
	if strings.EqualFold(turn.Status, "interrupted") {
		text = "Generation stopped."
	}
	return &model.SessionItem{
		ID:     firstNonEmpty(turn.ID, "turn") + "-terminal",
		Type:   "error",
		Status: turn.Status,
		Time:   terminalTurnTime(turn),
		Text:   text,
	}
}

func terminalTurnTime(turn model.SessionTurn) time.Time {
	if turn.CompletedAt != nil {
		return *turn.CompletedAt
	}
	if turn.StartedAt != nil {
		return *turn.StartedAt
	}
	return time.Now().UTC()
}

func turnHasNoVisibleResponse(turn model.SessionTurn) bool {
	if terminalItemStatus(turn.Status) == "" {
		return false
	}
	hasUserMessage := false
	for _, item := range turn.Items {
		if item.Type == "userMessage" {
			hasUserMessage = true
			continue
		}
		if itemHasVisibleOutput(item) {
			return false
		}
	}
	return hasUserMessage
}

func itemHasVisibleOutput(item model.SessionItem) bool {
	if strings.TrimSpace(item.Text) != "" || strings.TrimSpace(item.Output) != "" || len(item.Items) > 0 {
		return true
	}
	switch item.Type {
	case "commandExecution", "fileChange", "mcpToolCall", "dynamicToolCall", "webSearch", "imageView":
		return true
	default:
		return false
	}
}

func turnErrorText(errorData map[string]any) string {
	if len(errorData) == 0 {
		return "Codex turn failed."
	}
	if message := nestedErrorMessage(strAny(errorData["message"])); message != "" {
		return message
	}
	if message := firstNonEmpty(strAny(errorData["message"]), strAny(errorData["error"]), strAny(errorData["codexErrorInfo"])); message != "" {
		return message
	}
	return "Codex turn failed."
}

func nestedErrorMessage(text string) string {
	if text == "" || !strings.HasPrefix(strings.TrimSpace(text), "{") {
		return ""
	}
	var payload map[string]any
	if err := json.Unmarshal([]byte(text), &payload); err != nil {
		return ""
	}
	if errorBody, ok := payload["error"].(map[string]any); ok {
		if message := strAny(errorBody["message"]); message != "" {
			return message
		}
	}
	return strAny(payload["message"])
}

func eventFromStateItem(sessionID string, turn model.SessionTurn, item model.SessionItem, eventTime time.Time) (model.SessionEvent, []model.SessionEvent) {
	data := compactStateItemData(turn, item)
	switch item.Type {
	case "userMessage":
		return newParsedEvent("user_message", item.Text, eventTime, data), nil
	case "agentMessage":
		if item.Phase != "" {
			data["phase"] = item.Phase
		}
		data["streaming"] = isRunningStatus(item.Status)
		return newParsedEvent("assistant_message", item.Text, eventTime, data), nil
	case "reasoning":
		return newParsedEvent("reasoning", item.Text, eventTime, data), nil
	case "commandExecution":
		data["name"] = "exec_command"
		data["args"] = map[string]any{
			"cmd":     item.Command,
			"workdir": item.CWD,
		}
		event := newParsedEvent("tool_call", "exec_command", eventTime, data)
		if item.Output == "" {
			return event, nil
		}
		outputData := map[string]any{
			"itemId": item.ID + ":output",
			"callId": item.ID,
		}
		if item.Status != "" {
			outputData["status"] = item.Status
		}
		return event, []model.SessionEvent{newParsedEvent("tool_output", item.Output, eventTime.Add(time.Millisecond), outputData)}
	case "fileChange":
		return model.SessionEvent{
			Kind:  "tool_summary",
			Text:  item.Text,
			Time:  eventTime,
			Data:  data,
			Items: item.Items,
		}, nil
	case "mcpToolCall", "dynamicToolCall", "webSearch":
		data["name"] = firstNonEmpty(item.Name, item.Tool, item.Type)
		return newParsedEvent("tool_call", data["name"].(string), eventTime, data), nil
	case "plan", "contextCompaction":
		return newParsedEvent("summary", item.Text, eventTime, data), nil
	case "approvalRequest":
		return newParsedEvent("approval_request", item.Text, eventTime, data), nil
	default:
		if item.Text != "" {
			return newParsedEvent(item.Type, item.Text, eventTime, data), nil
		}
		return model.SessionEvent{}, nil
	}
}

func compactStateItemData(turn model.SessionTurn, item model.SessionItem) map[string]any {
	data := map[string]any{
		"itemId": item.ID,
		"turnId": turn.ID,
	}
	if item.Status != "" {
		data["status"] = item.Status
	}
	if duration := turnDurationMillis(turn); duration != nil {
		data["durationMs"] = *duration
	}
	if item.Phase != "" {
		data["phase"] = item.Phase
	}
	if item.Name != "" {
		data["name"] = item.Name
	}
	return data
}

func turnDurationMillis(turn model.SessionTurn) *int64 {
	if turn.DurationMs != nil && *turn.DurationMs > 0 {
		duration := *turn.DurationMs
		return &duration
	}
	return nil
}

func normalizedTurnDurationMs(explicit *int64, startedAt, completedAt *time.Time) *int64 {
	if explicit != nil && *explicit > 0 {
		duration := *explicit
		return &duration
	}
	if startedAt == nil || completedAt == nil || completedAt.Before(*startedAt) {
		return nil
	}
	duration := completedAt.Sub(*startedAt).Milliseconds()
	if duration <= 0 {
		return nil
	}
	return &duration
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

func threadFromParams(params map[string]any, key string) appserver.Thread {
	var thread appserver.Thread
	payload, err := json.Marshal(params[key])
	if err != nil {
		return thread
	}
	_ = json.Unmarshal(payload, &thread)
	return thread
}

func turnFromAny(value any) appserver.Turn {
	var turn appserver.Turn
	payload, err := json.Marshal(value)
	if err != nil {
		return turn
	}
	_ = json.Unmarshal(payload, &turn)
	return turn
}

func itemMap(value any) map[string]any {
	item, _ := value.(map[string]any)
	return item
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

func isRunningStatus(status string) bool {
	return strings.EqualFold(strings.TrimSpace(status), statusRunning)
}

func normalizeRuntimeStatus(status string, defaultStatus string) string {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "":
		return defaultStatus
	case "running", "active", "pending", "starting", "inprogress", "in_progress":
		return statusRunning
	case "completed", "complete", "done", "succeeded", "success":
		return statusDone
	case "failed", "error":
		return statusError
	case "cancelled", "canceled", "interrupted", "skipped":
		return statusStopped
	default:
		return defaultStatus
	}
}

func timePtrFromUnix(value *int64) *time.Time {
	if value == nil || *value <= 0 {
		return nil
	}
	t := unixSeconds(*value)
	return &t
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

func cloneMap(in map[string]any) map[string]any {
	if in == nil {
		return nil
	}
	out := make(map[string]any, len(in))
	for key, value := range in {
		out[key] = value
	}
	return out
}

func cloneMapSlice(in []map[string]any) []map[string]any {
	if in == nil {
		return nil
	}
	out := make([]map[string]any, 0, len(in))
	for _, item := range in {
		out = append(out, cloneMap(item))
	}
	return out
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
