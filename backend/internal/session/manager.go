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
		if _, err := m.applyThreadLocked(thread); err != nil {
			m.mu.Unlock()
			return nil, err
		}
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
	session, err := m.applyThreadLocked(thread)
	if err != nil {
		m.mu.Unlock()
		return model.SessionRecord{}, err
	}
	if session != nil {
		session.stateLoaded = true
	}
	m.mu.Unlock()
	threadID := strings.TrimSpace(thread.ID)
	if threadID == "" {
		return model.SessionRecord{}, errors.New("Codex thread id is required")
	}

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
	threadID := strings.TrimSpace(session.record.ID)
	if threadID == "" {
		return model.SessionRecord{}, errors.New("session does not have a Codex thread id")
	}

	thread, err := m.backend.ResumeThread(ctx, threadID, session.record.CWD)
	if err != nil {
		m.finishWithError(req.SessionID, err)
		return model.SessionRecord{}, err
	}
	m.mu.Lock()
	if _, err := m.applyThreadLocked(thread); err != nil {
		m.mu.Unlock()
		return model.SessionRecord{}, err
	}
	resumedThreadID := strings.TrimSpace(thread.ID)
	if resumedThreadID == "" {
		m.mu.Unlock()
		err := errors.New("Codex thread id is required")
		m.finishWithError(req.SessionID, err)
		return model.SessionRecord{}, err
	}
	if m.setStatusLocked(resumedThreadID, statusRunning) == nil {
		m.mu.Unlock()
		return model.SessionRecord{}, errors.New("session not found")
	}
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
	threadID := strings.TrimSpace(session.record.ID)
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
	managed := m.sessionLocked(id)
	if managed == nil {
		m.mu.Unlock()
		return errors.New("session not found")
	}
	turnIndex, hasTurn := managed.turnIndex[session.runningTurnID]
	managed.runningTurnID = ""
	if hasTurn {
		now := time.Now().UTC()
		turn := &managed.turns[turnIndex]
		turn.Status = "interrupted"
		turn.CompletedAt = &now
		turn.DurationMs = appServerTurnDurationMs(turn.DurationMs)
	}
	if m.setStatusLocked(id, statusIdle) == nil {
		m.mu.Unlock()
		return errors.New("session not found")
	}
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
	m.mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	thread, err := m.backend.ReadThread(ctx, threadID)
	if err != nil {
		return err
	}
	if strings.TrimSpace(thread.ID) == "" {
		return errors.New("session not found")
	}

	m.mu.Lock()
	managed, err := m.applyThreadLocked(thread)
	if err != nil {
		m.mu.Unlock()
		return err
	}
	if managed != nil {
		turns, err := turnsFromThread(thread)
		if err != nil {
			m.mu.Unlock()
			return err
		}
		managed.turns = turns
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
		thread, err := threadFromParams(notification.Params, "thread")
		if err != nil {
			m.broadcastSystemError(err.Error())
			return
		}
		m.mu.Lock()
		session, err := m.applyThreadLocked(thread)
		if err != nil {
			m.mu.Unlock()
			m.broadcastSystemError(err.Error())
			return
		}
		update := m.sessionUpdateLocked(session, "session")
		subscribers := m.subscriberListLocked()
		m.mu.Unlock()
		m.publishToSubscribers(subscribers, update)
	case "thread/status/changed":
		threadID, err := requiredTrimmedString(notification.Params, "threadId", "thread/status/changed threadId")
		if err != nil {
			m.broadcastSystemError(err.Error())
			return
		}
		status, err := threadStatusFromAny(notification.Params["status"])
		if err != nil {
			m.finishWithError(threadID, err)
			return
		}
		m.applyStatus(threadID, status)
	case "thread/name/updated":
		threadID, err := requiredTrimmedString(notification.Params, "threadId", "thread/name/updated threadId")
		if err != nil {
			m.broadcastSystemError(err.Error())
			return
		}
		name, err := requiredTrimmedString(notification.Params, "threadName", "thread/name/updated threadName")
		if err != nil {
			m.finishWithError(threadID, err)
			return
		}
		m.mu.Lock()
		session := m.sessionLocked(threadID)
		if session == nil {
			m.mu.Unlock()
			return
		}
		session.record.Title = name
		session.record.UpdatedAt = time.Now().UTC()
		update := m.sessionUpdateLocked(session, "session")
		subscribers := m.subscriberListLocked()
		m.mu.Unlock()
		m.publishToSubscribers(subscribers, update)
	case "turn/started":
		threadID, err := requiredTrimmedString(notification.Params, "threadId", "turn/started threadId")
		if err != nil {
			m.broadcastSystemError(err.Error())
			return
		}
		turn, err := turnFromAny(notification.Params["turn"])
		if err != nil {
			m.finishWithError(threadID, err)
			return
		}
		m.applyTurnStarted(threadID, turn)
	case "turn/completed":
		threadID, err := requiredTrimmedString(notification.Params, "threadId", "turn/completed threadId")
		if err != nil {
			m.broadcastSystemError(err.Error())
			return
		}
		turn, err := turnFromAny(notification.Params["turn"])
		if err != nil {
			m.finishWithError(threadID, err)
			return
		}
		m.applyTurnCompleted(threadID, turn)
	case "item/started":
		m.applyItemNotification(notification, statusRunning)
	case "item/completed":
		m.applyItemNotification(notification, "completed")
	case "item/agentMessage/delta":
		threadID, err := requiredTrimmedString(notification.Params, "threadId", "item/agentMessage/delta threadId")
		if err != nil {
			m.broadcastSystemError(err.Error())
			return
		}
		turnID, err := requiredTrimmedString(notification.Params, "turnId", "item/agentMessage/delta turnId")
		if err != nil {
			m.finishWithError(threadID, err)
			return
		}
		itemID, err := requiredTrimmedString(notification.Params, "itemId", "item/agentMessage/delta itemId")
		if err != nil {
			m.finishWithError(threadID, err)
			return
		}
		delta, err := requiredTextString(notification.Params, "delta", "item/agentMessage/delta delta")
		if err != nil {
			m.finishWithError(threadID, err)
			return
		}
		m.appendAssistantDelta(threadID, turnID, itemID, delta)
	case "item/commandExecution/outputDelta":
		threadID, err := requiredTrimmedString(notification.Params, "threadId", "item/commandExecution/outputDelta threadId")
		if err != nil {
			m.broadcastSystemError(err.Error())
			return
		}
		turnID, err := requiredTrimmedString(notification.Params, "turnId", "item/commandExecution/outputDelta turnId")
		if err != nil {
			m.finishWithError(threadID, err)
			return
		}
		itemID, err := requiredTrimmedString(notification.Params, "itemId", "item/commandExecution/outputDelta itemId")
		if err != nil {
			m.finishWithError(threadID, err)
			return
		}
		delta, err := requiredTextString(notification.Params, "delta", "item/commandExecution/outputDelta delta")
		if err != nil {
			m.finishWithError(threadID, err)
			return
		}
		m.appendCommandOutputDelta(threadID, turnID, itemID, delta)
	case "error":
		threadID, err := requiredTrimmedString(notification.Params, "threadId", "error notification threadId")
		if err != nil {
			m.broadcastSystemError(err.Error())
			return
		}
		message, err := requiredTrimmedString(notification.Params, "message", "error notification message")
		if err != nil {
			m.finishWithError(threadID, err)
			return
		}
		m.finishWithError(threadID, errors.New(message))
	case "appserver/disconnected":
		m.broadcastSystemError("Codex app-server disconnected.")
	default:
		if notification.IsRequest {
			m.handleServerRequestNotification(notification)
		}
	}
}

func (m *Manager) applyTurnStarted(sessionID string, turn appserver.Turn) {
	turnID := strings.TrimSpace(turn.ID)
	if turnID == "" {
		m.finishWithError(sessionID, errors.New("Codex turn id is required"))
		return
	}
	m.mu.Lock()
	session := m.sessionLocked(sessionID)
	if session == nil {
		m.mu.Unlock()
		return
	}
	session.stateLoaded = true
	turn.ID = turnID
	modelTurn, err := turnFromAppServer(turn)
	if err != nil {
		m.mu.Unlock()
		m.finishWithError(sessionID, err)
		return
	}
	modelTurn.Status = statusRunning
	index := session.upsertTurn(modelTurn)
	session.runningTurnID = turnID
	if m.setStatusLocked(sessionID, statusRunning) == nil {
		m.mu.Unlock()
		return
	}
	update := m.turnUpdateLocked(session, index)
	subscribers := m.subscriberListLocked()
	m.mu.Unlock()
	m.publishToSubscribers(subscribers, update)
}

func (m *Manager) applyTurnCompleted(sessionID string, turn appserver.Turn) {
	turnID := strings.TrimSpace(turn.ID)
	if turnID == "" {
		return
	}
	m.mu.Lock()
	session := m.sessionLocked(sessionID)
	if session == nil {
		m.mu.Unlock()
		return
	}
	turn.ID = turnID
	modelTurn, err := turnFromAppServer(turn)
	if err != nil {
		m.mu.Unlock()
		m.finishWithError(sessionID, err)
		return
	}
	modelTurn.Status = "completed"
	index := session.upsertTurn(modelTurn)
	if session.runningTurnID == turnID {
		session.runningTurnID = ""
	}
	if modelTurn.Status == statusError {
		if m.setStatusLocked(sessionID, statusError) == nil {
			m.mu.Unlock()
			return
		}
	} else {
		if m.setStatusLocked(sessionID, statusIdle) == nil {
			m.mu.Unlock()
			return
		}
	}
	update := m.turnUpdateLocked(session, index)
	subscribers := m.subscriberListLocked()
	m.mu.Unlock()
	m.publishToSubscribers(subscribers, update)
}

func (m *Manager) applyItemNotification(notification appserver.Notification, eventStatus string) {
	threadID, err := requiredTrimmedString(notification.Params, "threadId", "item notification threadId")
	if err != nil {
		m.broadcastSystemError(err.Error())
		return
	}
	rawItem := itemMap(notification.Params["item"])
	if rawItem == nil {
		m.finishWithError(threadID, errors.New("item notification item is required"))
		return
	}
	item, err := itemFromMap(rawItem)
	if err != nil {
		m.finishWithError(threadID, err)
		return
	}
	if item.Status == "" {
		item.Status = eventStatus
	}
	m.mu.Lock()
	session := m.sessionLocked(threadID)
	if session == nil {
		m.mu.Unlock()
		return
	}
	turnID, err := turnIDForItemLocked(notification.Params)
	if err != nil {
		m.mu.Unlock()
		m.finishWithError(threadID, err)
		return
	}
	turnIndex, ok := session.ensureTurn(turnID)
	if !ok {
		m.mu.Unlock()
		m.finishWithError(threadID, errors.New("item notification turnId is required"))
		return
	}
	itemIndex := session.upsertItem(turnIndex, item)
	if item.Status == statusRunning {
		session.runningTurnID = session.turns[turnIndex].ID
		if m.setStatusLocked(threadID, statusRunning) == nil {
			m.mu.Unlock()
			return
		}
	}
	update := m.itemUpdateLocked(session, turnIndex, itemIndex)
	subscribers := m.subscriberListLocked()
	m.mu.Unlock()
	m.publishToSubscribers(subscribers, update)
}

func (m *Manager) appendAssistantDelta(sessionID, turnID, itemID, delta string) {
	m.mu.Lock()
	session := m.sessionLocked(sessionID)
	if session == nil {
		m.mu.Unlock()
		return
	}
	turnIndex, itemIndex, ok := session.findItem(turnID, itemID)
	if !ok {
		m.mu.Unlock()
		m.finishWithError(sessionID, errors.New("agent message item must be started before delta"))
		return
	}
	item := &session.turns[turnIndex].Items[itemIndex]
	item.Text += delta
	item.Status = statusRunning
	item.Time = time.Now().UTC()
	session.runningTurnID = session.turns[turnIndex].ID
	if m.setStatusLocked(sessionID, statusRunning) == nil {
		m.mu.Unlock()
		return
	}
	update := m.itemUpdateLocked(session, turnIndex, itemIndex)
	subscribers := m.subscriberListLocked()
	m.mu.Unlock()
	m.publishToSubscribers(subscribers, update)
}

func (m *Manager) appendCommandOutputDelta(sessionID, turnID, itemID, delta string) {
	m.mu.Lock()
	session := m.sessionLocked(sessionID)
	if session == nil {
		m.mu.Unlock()
		return
	}
	turnIndex, itemIndex, ok := session.findItem(turnID, itemID)
	if !ok {
		m.mu.Unlock()
		m.finishWithError(sessionID, errors.New("command execution item must be started before output delta"))
		return
	}
	item := &session.turns[turnIndex].Items[itemIndex]
	item.Output += delta
	item.Status = statusRunning
	item.Time = time.Now().UTC()
	session.runningTurnID = session.turns[turnIndex].ID
	if m.setStatusLocked(sessionID, statusRunning) == nil {
		m.mu.Unlock()
		return
	}
	update := m.itemUpdateLocked(session, turnIndex, itemIndex)
	subscribers := m.subscriberListLocked()
	m.mu.Unlock()
	m.publishToSubscribers(subscribers, update)
}

func (m *Manager) handleServerRequestNotification(notification appserver.Notification) {
	threadID, err := requiredTrimmedString(notification.Params, "threadId", "server request threadId")
	if err != nil {
		m.broadcastSystemError(err.Error())
		return
	}
	text := "Codex requested approval; this version declined it automatically."
	if command, err := optionalTextString(notification.Params, "command", "server request command"); err != nil {
		m.finishWithError(threadID, err)
		return
	} else if command != "" {
		text = "Approval requested for command: " + command
	}
	now := time.Now().UTC()
	requestID := strings.TrimSpace(notification.RequestID)
	if requestID == "" {
		return
	}
	item := model.SessionItem{
		ID:     requestID,
		Type:   "approvalRequest",
		Status: "declined",
		Text:   text,
		Time:   now,
	}
	m.mu.Lock()
	session := m.sessionLocked(threadID)
	if session == nil {
		m.mu.Unlock()
		return
	}
	turnID, err := turnIDForItemLocked(notification.Params)
	if err != nil {
		m.mu.Unlock()
		m.finishWithError(threadID, err)
		return
	}
	turnIndex, itemIndex, ok := session.ensureItem(turnID, item)
	if !ok {
		m.mu.Unlock()
		return
	}
	update := m.itemUpdateLocked(session, turnIndex, itemIndex)
	subscribers := m.subscriberListLocked()
	m.mu.Unlock()
	m.publishToSubscribers(subscribers, update)
}

func (m *Manager) applyStatus(sessionID, status string) {
	m.mu.Lock()
	session := m.setStatusLocked(sessionID, status)
	if session == nil {
		m.mu.Unlock()
		return
	}
	update := m.sessionUpdateLocked(session, "session")
	subscribers := m.subscriberListLocked()
	m.mu.Unlock()
	m.publishToSubscribers(subscribers, update)
}

func (m *Manager) finishWithError(sessionID string, err error) {
	m.mu.Lock()
	session := m.sessionLocked(sessionID)
	if session == nil {
		m.mu.Unlock()
		return
	}
	session.runningTurnID = ""
	if m.setStatusLocked(sessionID, statusError) == nil {
		m.mu.Unlock()
		return
	}
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

func (m *Manager) applyThreadLocked(thread appserver.Thread) (*managedSession, error) {
	id := strings.TrimSpace(thread.ID)
	if id == "" {
		return nil, errors.New("Codex thread id is required")
	}
	session := m.sessions[id]
	if session == nil {
		session = &managedSession{
			turnIndex: map[string]int{},
			itemIndex: map[string]itemLocation{},
		}
		m.sessions[id] = session
	}
	record, err := recordFromThread(thread)
	if err != nil {
		return nil, err
	}
	if session.lastSeq > 0 {
		record.LastSeq = session.lastSeq
	}
	if !session.record.UpdatedAt.IsZero() && session.record.UpdatedAt.After(record.UpdatedAt) {
		record.UpdatedAt = session.record.UpdatedAt
	}
	session.record = record
	if len(thread.Turns) > 0 && !session.stateLoaded {
		turns, err := turnsFromThread(thread)
		if err != nil {
			return nil, err
		}
		session.turns = turns
		session.stateLoaded = true
		session.rebuildIndexes()
		session.runningTurnID = runningTurnID(session.turns)
	}
	session.ensureIndexes()
	return session, nil
}

func recordFromThread(thread appserver.Thread) (model.SessionRecord, error) {
	id := strings.TrimSpace(thread.ID)
	if id == "" {
		return model.SessionRecord{}, errors.New("Codex thread id is required")
	}
	if strings.TrimSpace(thread.CWD) == "" {
		return model.SessionRecord{}, errors.New("Codex thread cwd is required")
	}
	status := statusFromThreadStatus(thread.Status)
	if status == "" {
		return model.SessionRecord{}, errors.New("Codex thread status is required")
	}
	createdAt := unixSeconds(thread.CreatedAt)
	updatedAt := unixSeconds(thread.UpdatedAt)
	title := strings.TrimSpace(thread.Preview)
	if thread.Name != nil && strings.TrimSpace(*thread.Name) != "" {
		title = strings.TrimSpace(*thread.Name)
	}
	return model.SessionRecord{
		ID:        id,
		Title:     title,
		CWD:       thread.CWD,
		Status:    status,
		CreatedAt: createdAt,
		UpdatedAt: updatedAt,
	}, nil
}

func statusFromThreadStatus(status appserver.ThreadStatus) string {
	return strings.TrimSpace(status.Type)
}

func turnStatus(status string) string {
	return strings.TrimSpace(status)
}

func threadStatusFromAny(value any) (string, error) {
	status, ok := value.(map[string]any)
	if !ok {
		return "", errors.New("thread status must be an object")
	}
	statusType, err := requiredTrimmedString(status, "type", "thread status type")
	if err != nil {
		return "", err
	}
	out := statusFromThreadStatus(appserver.ThreadStatus{
		Type: statusType,
	})
	if out == "" {
		return "", errors.New("thread status type is required")
	}
	return out, nil
}

func turnsFromThread(thread appserver.Thread) ([]model.SessionTurn, error) {
	turns := make([]model.SessionTurn, 0, len(thread.Turns))
	for _, turn := range thread.Turns {
		modelTurn, err := turnFromAppServer(turn)
		if err != nil {
			return nil, err
		}
		turns = append(turns, modelTurn)
	}
	return turns, nil
}

func turnFromAppServer(turn appserver.Turn) (model.SessionTurn, error) {
	if strings.TrimSpace(turn.ID) == "" {
		return model.SessionTurn{}, errors.New("Codex turn id is required")
	}
	startedAt := timePtrFromUnix(turn.StartedAt)
	completedAt := timePtrFromUnix(turn.CompletedAt)
	items := make([]model.SessionItem, 0, len(turn.Items))
	for _, sourceItem := range turn.Items {
		item, err := itemFromMap(sourceItem)
		if err != nil {
			return model.SessionTurn{}, err
		}
		items = append(items, item)
	}
	return model.SessionTurn{
		ID:          turn.ID,
		Status:      turnStatus(turn.Status),
		StartedAt:   startedAt,
		CompletedAt: completedAt,
		DurationMs:  appServerTurnDurationMs(turn.DurationMs),
		Error:       turn.Error,
		Items:       items,
	}, nil
}

func itemFromMap(item map[string]any) (model.SessionItem, error) {
	itemKind, err := requiredTrimmedString(item, "type", "Codex item type")
	if err != nil {
		return model.SessionItem{}, err
	}
	id, err := requiredTrimmedString(item, "id", "Codex item id")
	if err != nil {
		return model.SessionItem{}, err
	}
	out := model.SessionItem{
		ID:   id,
		Type: itemKind,
	}
	if out.Status, err = optionalTrimmedString(item, "status", "Codex item status"); err != nil {
		return model.SessionItem{}, err
	}
	if out.Phase, err = optionalTrimmedString(item, "phase", "Codex item phase"); err != nil {
		return model.SessionItem{}, err
	}
	if out.Command, err = optionalTextString(item, "command", "Codex item command"); err != nil {
		return model.SessionItem{}, err
	}
	if out.CWD, err = optionalTextString(item, "cwd", "Codex item cwd"); err != nil {
		return model.SessionItem{}, err
	}
	if out.Server, err = optionalTrimmedString(item, "server", "Codex item server"); err != nil {
		return model.SessionItem{}, err
	}
	if out.Tool, err = optionalTrimmedString(item, "tool", "Codex item tool"); err != nil {
		return model.SessionItem{}, err
	}
	if out.Name, err = optionalTrimmedString(item, "name", "Codex item name"); err != nil {
		return model.SessionItem{}, err
	}
	switch itemKind {
	case "userMessage":
		text, err := userInputText(item["content"])
		if err != nil {
			return model.SessionItem{}, err
		}
		out.Text = text
	case "agentMessage":
		text, err := optionalTextString(item, "text", "agentMessage text")
		if err != nil {
			return model.SessionItem{}, err
		}
		out.Text = text
	case "reasoning":
		text, err := stringListText(item["summary"])
		if err != nil {
			return model.SessionItem{}, err
		}
		out.Text = text
	case "commandExecution":
		output, err := optionalTextString(item, "aggregatedOutput", "commandExecution aggregatedOutput")
		if err != nil {
			return model.SessionItem{}, err
		}
		out.Output = output
	case "fileChange":
		items, err := fileChangeItems(item["changes"])
		if err != nil {
			return model.SessionItem{}, err
		}
		out.Items = items
	case "mcpToolCall":
	case "dynamicToolCall":
	case "plan":
		text, err := optionalTextString(item, "text", "plan text")
		if err != nil {
			return model.SessionItem{}, err
		}
		out.Text = text
	case "contextCompaction":
	case "webSearch":
	case "imageView":
		text, err := optionalTextString(item, "path", "imageView path")
		if err != nil {
			return model.SessionItem{}, err
		}
		out.Text = text
	default:
		return model.SessionItem{}, fmt.Errorf("unsupported Codex item type: %s", itemKind)
	}
	return out, nil
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

func turnIDForItemLocked(params map[string]any) (string, error) {
	if params == nil {
		return "", errors.New("turnId is required")
	}
	return requiredTrimmedString(params, "turnId", "turnId")
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

func (s *managedSession) ensureTurn(turnID string) (int, bool) {
	s.ensureIndexes()
	turnID = strings.TrimSpace(turnID)
	if turnID == "" {
		return -1, false
	}
	if index, ok := s.turnIndex[turnID]; ok {
		return index, true
	}
	return -1, false
}

func (s *managedSession) upsertTurn(turn model.SessionTurn) int {
	s.ensureIndexes()
	if turn.ID == "" {
		return -1
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
	s.turns[turnIndex].Items = append(s.turns[turnIndex].Items, item)
	itemIndex := len(s.turns[turnIndex].Items) - 1
	if item.ID != "" {
		s.itemIndex[item.ID] = itemLocation{Turn: turnIndex, Item: itemIndex}
	}
	return itemIndex
}

func (s *managedSession) ensureItem(turnID string, item model.SessionItem) (int, int, bool) {
	s.ensureIndexes()
	if item.ID != "" {
		if location, ok := s.itemIndex[item.ID]; ok {
			return location.Turn, location.Item, true
		}
	}
	turnIndex, ok := s.ensureTurn(turnID)
	if !ok {
		return -1, -1, false
	}
	itemIndex := s.upsertItem(turnIndex, item)
	return turnIndex, itemIndex, true
}

func (s *managedSession) findItem(turnID, itemID string) (int, int, bool) {
	s.ensureIndexes()
	turnID = strings.TrimSpace(turnID)
	itemID = strings.TrimSpace(itemID)
	if turnID == "" || itemID == "" {
		return -1, -1, false
	}
	location, ok := s.itemIndex[itemID]
	if !ok {
		return -1, -1, false
	}
	if location.Turn < 0 || location.Turn >= len(s.turns) {
		return -1, -1, false
	}
	if s.turns[location.Turn].ID != turnID {
		return -1, -1, false
	}
	return location.Turn, location.Item, true
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

func (m *Manager) sessionLocked(sessionID string) *managedSession {
	session := m.sessions[sessionID]
	if session != nil {
		session.ensureIndexes()
	}
	return session
}

func (m *Manager) setStatusLocked(sessionID, status string) *managedSession {
	session := m.sessionLocked(sessionID)
	if session == nil {
		return nil
	}
	session.record.Status = status
	session.record.UpdatedAt = time.Now().UTC()
	return session
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
	return out
}

func cloneItem(item model.SessionItem) model.SessionItem {
	out := item
	out.Items = cloneMapSlice(item.Items)
	return out
}

func appServerTurnDurationMs(explicit *int64) *int64 {
	if explicit != nil && *explicit > 0 {
		duration := *explicit
		return &duration
	}
	return nil
}

func threadFromParams(params map[string]any, key string) (appserver.Thread, error) {
	var thread appserver.Thread
	if params == nil {
		return thread, errors.New("notification params are required")
	}
	if _, ok := params[key]; !ok {
		return thread, errors.New("thread payload is required")
	}
	payload, err := json.Marshal(params[key])
	if err != nil {
		return thread, err
	}
	if err := json.Unmarshal(payload, &thread); err != nil {
		return thread, err
	}
	if strings.TrimSpace(thread.ID) == "" {
		return thread, errors.New("Codex thread id is required")
	}
	return thread, nil
}

func turnFromAny(value any) (appserver.Turn, error) {
	var turn appserver.Turn
	if value == nil {
		return turn, errors.New("turn payload is required")
	}
	payload, err := json.Marshal(value)
	if err != nil {
		return turn, err
	}
	if err := json.Unmarshal(payload, &turn); err != nil {
		return turn, err
	}
	if strings.TrimSpace(turn.ID) == "" {
		return turn, errors.New("Codex turn id is required")
	}
	return turn, nil
}

func itemMap(value any) map[string]any {
	item, _ := value.(map[string]any)
	return item
}

func userInputText(value any) (string, error) {
	items, ok := value.([]any)
	if !ok {
		return "", errors.New("userMessage content must be an array")
	}
	parts := make([]string, 0, len(items))
	for _, item := range items {
		body, ok := item.(map[string]any)
		if !ok {
			return "", errors.New("userMessage content item must be an object")
		}
		text, err := requiredTrimmedString(body, "text", "userMessage content text")
		if err != nil {
			return "", err
		}
		parts = append(parts, text)
	}
	return strings.TrimSpace(strings.Join(parts, "\n\n")), nil
}

func stringListText(value any) (string, error) {
	if value == nil {
		return "", nil
	}
	items, ok := value.([]any)
	if !ok {
		return "", errors.New("reasoning summary must be an array")
	}
	parts := make([]string, 0, len(items))
	for _, item := range items {
		text, err := stringValue(item, true)
		if err != nil {
			return "", errors.New("reasoning summary item text must be a string")
		}
		if text == "" {
			return "", errors.New("reasoning summary item text is required")
		}
		parts = append(parts, text)
	}
	return strings.TrimSpace(strings.Join(parts, "\n")), nil
}

func fileChangeItems(value any) ([]map[string]any, error) {
	changes, ok := value.([]any)
	if !ok {
		return nil, errors.New("fileChange changes must be an array")
	}
	items := make([]map[string]any, 0, len(changes))
	for _, change := range changes {
		body, ok := change.(map[string]any)
		if !ok {
			return nil, errors.New("fileChange change must be an object")
		}
		path, err := requiredTrimmedString(body, "path", "fileChange path")
		if err != nil {
			return nil, err
		}
		kind, err := optionalTrimmedString(body, "kind", "fileChange kind")
		if err != nil {
			return nil, err
		}
		items = append(items, map[string]any{
			"path": path,
			"kind": kind,
		})
	}
	return items, nil
}

func isRunningStatus(status string) bool {
	return strings.EqualFold(strings.TrimSpace(status), statusRunning)
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

func requiredTrimmedString(values map[string]any, key, label string) (string, error) {
	value, ok := values[key]
	if !ok {
		return "", fmt.Errorf("%s is required", label)
	}
	text, err := stringValue(value, true)
	if err != nil {
		return "", fmt.Errorf("%s must be a string", label)
	}
	if text == "" {
		return "", fmt.Errorf("%s is required", label)
	}
	return text, nil
}

func requiredTextString(values map[string]any, key, label string) (string, error) {
	value, ok := values[key]
	if !ok {
		return "", fmt.Errorf("%s is required", label)
	}
	text, err := stringValue(value, false)
	if err != nil {
		return "", fmt.Errorf("%s must be a string", label)
	}
	return text, nil
}

func optionalTrimmedString(values map[string]any, key, label string) (string, error) {
	value, ok := values[key]
	if !ok {
		return "", nil
	}
	text, err := stringValue(value, true)
	if err != nil {
		return "", fmt.Errorf("%s must be a string", label)
	}
	return text, nil
}

func optionalTextString(values map[string]any, key, label string) (string, error) {
	value, ok := values[key]
	if !ok {
		return "", nil
	}
	text, err := stringValue(value, false)
	if err != nil {
		return "", fmt.Errorf("%s must be a string", label)
	}
	return text, nil
}

func stringValue(value any, trim bool) (string, error) {
	var text string
	switch v := value.(type) {
	case string:
		text = v
	case fmt.Stringer:
		text = v.String()
	case json.Number:
		text = v.String()
	default:
		return "", errors.New("not a string")
	}
	if trim {
		text = strings.TrimSpace(text)
	}
	return text, nil
}
