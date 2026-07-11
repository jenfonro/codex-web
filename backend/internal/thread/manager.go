package thread

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"codex-web/backend/internal/appserver"
)

type Config = appserver.Config

type codexBackend interface {
	ListThreads(ctx context.Context) ([]appserver.Thread, error)
	ReadThread(ctx context.Context, threadID string) (appserver.Thread, error)
	StartThread(ctx context.Context, cwd string) (appserver.Thread, error)
	ResumeThread(ctx context.Context, threadID, cwd string) (appserver.Thread, error)
	StartTurn(ctx context.Context, threadID, prompt, cwd string) error
	InterruptTurn(ctx context.Context, threadID, turnID string) error
	Subscribe() (<-chan appserver.Notification, func())
}

type Manager struct {
	cfg     Config
	backend codexBackend

	mu          sync.Mutex
	changed     *sync.Cond
	threads     map[string]*managedThread
	threadOrder []string
	subscribers map[int]chan StateUpdate
	nextSubID   int
}

type managedThread struct {
	thread        appserver.Thread
	historyLoaded bool
	sequence      int64
}

type StateUpdate struct {
	ThreadID string          `json:"threadId"`
	Sequence int64           `json:"-"`
	Type     string          `json:"type"`
	Data     json.RawMessage `json:"data"`
}

func StateSnapshotUpdate(threadID string, thread appserver.Thread, sequence int64) StateUpdate {
	return StateUpdate{
		ThreadID: threadID,
		Sequence: sequence,
		Type:     "state",
		Data:     encodeJSON(thread),
	}
}

func New(cfg Config) *Manager {
	return NewWithBackend(cfg, appserver.New(cfg))
}

func NewWithBackend(cfg Config, backend codexBackend) *Manager {
	manager := &Manager{
		cfg:         cfg,
		backend:     backend,
		threads:     map[string]*managedThread{},
		subscribers: map[int]chan StateUpdate{},
	}
	manager.changed = sync.NewCond(&manager.mu)
	manager.watchBackend()
	return manager
}

func (m *Manager) Initialize(ctx context.Context) error {
	threads, err := m.backend.ListThreads(ctx)
	if err != nil {
		return err
	}

	m.mu.Lock()
	m.threads = make(map[string]*managedThread, len(threads))
	m.threadOrder = make([]string, 0, len(threads))
	for _, thread := range threads {
		m.appendListedThreadLocked(thread)
	}
	m.mu.Unlock()
	return nil
}

func (m *Manager) List() []appserver.Thread {
	m.mu.Lock()
	threads := make([]appserver.Thread, len(m.threadOrder))
	for index, threadID := range m.threadOrder {
		threads[index] = cloneThread(m.threads[threadID].thread)
	}
	m.mu.Unlock()
	return threads
}

func (m *Manager) Create(ctx context.Context, prompt string) (string, error) {
	cwd := m.cfg.RootDir

	thread, err := m.backend.StartThread(ctx, cwd)
	if err != nil {
		return "", err
	}
	threadID := thread.ID
	m.waitForThread(threadID)

	if err := m.backend.StartTurn(ctx, threadID, prompt, cwd); err != nil {
		return "", err
	}
	return threadID, nil
}

func (m *Manager) Send(ctx context.Context, threadID, prompt string) error {
	m.mu.Lock()
	thread := m.threads[threadID].thread
	m.mu.Unlock()

	thread, err := m.backend.ResumeThread(ctx, threadID, thread.CWD)
	if err != nil {
		return err
	}
	if err := m.backend.StartTurn(ctx, thread.ID, prompt, thread.CWD); err != nil {
		return err
	}
	return nil
}

func (m *Manager) Cancel(threadID string) error {
	m.mu.Lock()
	managed := m.threads[threadID]
	turnID := managed.thread.Turns[len(managed.thread.Turns)-1].ID
	m.mu.Unlock()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := m.backend.InterruptTurn(ctx, threadID, turnID); err != nil {
		return err
	}
	return nil
}

func (m *Manager) State(threadID string) (appserver.Thread, int64, error) {
	if err := m.loadThreadHistory(threadID); err != nil {
		return appserver.Thread{}, 0, err
	}
	m.mu.Lock()
	managed := m.threads[threadID]
	thread := cloneThread(managed.thread)
	sequence := managed.sequence
	m.mu.Unlock()
	return thread, sequence, nil
}

func (m *Manager) Subscribe() (<-chan StateUpdate, func()) {
	ch := make(chan StateUpdate, 256)
	m.mu.Lock()
	id := m.nextSubID
	m.nextSubID++
	m.subscribers[id] = ch
	m.mu.Unlock()
	return ch, func() {
		m.mu.Lock()
		existing := m.subscribers[id]
		delete(m.subscribers, id)
		close(existing)
		m.mu.Unlock()
	}
}

func (m *Manager) waitForThread(threadID string) {
	m.mu.Lock()
	for m.threads[threadID] == nil {
		m.changed.Wait()
	}
	m.mu.Unlock()
}

func (m *Manager) loadThreadHistory(threadID string) error {
	for {
		m.mu.Lock()
		managed := m.threads[threadID]
		if managed.historyLoaded {
			m.mu.Unlock()
			return nil
		}
		sequence := managed.sequence
		m.mu.Unlock()

		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		loaded, err := m.backend.ReadThread(ctx, threadID)
		cancel()
		if err != nil {
			return err
		}

		m.mu.Lock()
		managed = m.threads[threadID]
		if managed.sequence != sequence {
			m.mu.Unlock()
			continue
		}
		managed = m.replaceThreadLocked(loaded)
		managed.historyLoaded = true
		m.mu.Unlock()
		return nil
	}
}

func (m *Manager) watchBackend() {
	events, unsubscribe := m.backend.Subscribe()
	go func() {
		defer unsubscribe()
		for notification := range events {
			m.handleNotification(notification)
		}
	}()
}

func (m *Manager) handleNotification(notification appserver.Notification) {
	switch notification.Method {
	case "thread/started":
		params := notificationParams[appserver.ThreadStartedNotification](notification)
		m.mu.Lock()
		managed := m.addThreadLocked(params.Thread)
		update := m.threadStartedUpdateLocked(managed)
		subscribers := m.subscriberListLocked()
		m.mu.Unlock()
		m.publishToSubscribers(subscribers, update)
	case "thread/status/changed":
		params := notificationParams[appserver.ThreadStatusChangedNotification](notification)
		m.applyStatus(params.ThreadID, params.Status)
	case "thread/name/updated":
		params := notificationParams[appserver.ThreadNameUpdatedNotification](notification)
		m.mu.Lock()
		managed := m.threads[params.ThreadID]
		managed.thread.Name = params.ThreadName
		update := m.threadUpdateLocked(managed)
		subscribers := m.subscriberListLocked()
		m.mu.Unlock()
		m.publishToSubscribers(subscribers, update)
	case "turn/started":
		params := notificationParams[appserver.TurnStartedNotification](notification)
		m.applyTurnStarted(params.ThreadID, params.Turn)
	case "turn/completed":
		params := notificationParams[appserver.TurnCompletedNotification](notification)
		m.applyTurnCompleted(params.ThreadID, params.Turn)
	case "item/started":
		params := notificationParams[appserver.ItemStartedNotification](notification)
		m.applyItemStarted(params.ThreadID, params.TurnID, params.Item)
	case "item/completed":
		params := notificationParams[appserver.ItemCompletedNotification](notification)
		m.applyItemCompleted(params.ThreadID, params.TurnID, params.Item)
	case "item/agentMessage/delta":
		params := notificationParams[appserver.ItemDeltaNotification](notification)
		m.appendAssistantDelta(params.ThreadID, params.TurnID, params.ItemID, params.Delta)
	case "item/commandExecution/outputDelta":
		params := notificationParams[appserver.ItemDeltaNotification](notification)
		m.appendCommandOutputDelta(params.ThreadID, params.TurnID, params.ItemID, params.Delta)
	case "item/plan/delta":
		params := notificationParams[appserver.ItemDeltaNotification](notification)
		m.appendItemStringField(params.ThreadID, params.TurnID, params.ItemID, "text", params.Delta)
	case "item/reasoning/summaryPartAdded":
		params := notificationParams[appserver.ReasoningSummaryPartAddedNotification](notification)
		m.insertItemStringArrayElement(params.ThreadID, params.TurnID, params.ItemID, "summary", params.SummaryIndex, "")
	case "item/reasoning/summaryTextDelta":
		params := notificationParams[appserver.ReasoningSummaryDeltaNotification](notification)
		m.appendItemStringArrayDelta(params.ThreadID, params.TurnID, params.ItemID, "summary", params.SummaryIndex, params.Delta)
	case "item/reasoning/textDelta":
		params := notificationParams[appserver.ReasoningTextDeltaNotification](notification)
		m.appendItemStringArrayDelta(params.ThreadID, params.TurnID, params.ItemID, "content", params.ContentIndex, params.Delta)
	case "error":
		m.publishTurnError(notificationParams[appserver.ErrorNotification](notification))
	default:
		panic("unhandled app-server notification: " + notification.Method)
	}
}

func (m *Manager) publishTurnError(params appserver.ErrorNotification) {
	m.mu.Lock()
	managed := m.threads[params.ThreadID]
	managed.sequence++
	update := StateUpdate{
		ThreadID: params.ThreadID,
		Sequence: managed.sequence,
		Type:     "turnError",
		Data:     encodeJSON(params),
	}
	subscribers := m.subscriberListLocked()
	m.mu.Unlock()
	m.publishToSubscribers(subscribers, update)
}

func (m *Manager) applyTurnStarted(threadID string, turn appserver.Turn) {
	m.mu.Lock()
	managed := m.threads[threadID]
	index := managed.appendTurn(turn)
	update := m.turnStartedUpdateLocked(managed, index)
	subscribers := m.subscriberListLocked()
	m.mu.Unlock()
	m.publishToSubscribers(subscribers, update)
}

func (m *Manager) applyTurnCompleted(threadID string, turn appserver.Turn) {
	m.mu.Lock()
	managed := m.threads[threadID]
	index := managed.replaceTurn(turn)
	update := m.turnUpdateLocked(managed, index)
	subscribers := m.subscriberListLocked()
	m.mu.Unlock()
	m.publishToSubscribers(subscribers, update)
}

func (m *Manager) applyItemStarted(threadID, turnID string, item json.RawMessage) {
	m.mu.Lock()
	managed := m.threads[threadID]
	turnIndex := managed.turnIndexFor(turnID)
	managed.appendItem(turnIndex, item)
	update := m.turnUpdateLocked(managed, turnIndex)
	subscribers := m.subscriberListLocked()
	m.mu.Unlock()
	m.publishToSubscribers(subscribers, update)
}

func (m *Manager) applyItemCompleted(threadID, turnID string, item json.RawMessage) {
	m.mu.Lock()
	managed := m.threads[threadID]
	turnIndex := managed.turnIndexFor(turnID)
	managed.replaceItem(turnIndex, item)
	update := m.turnUpdateLocked(managed, turnIndex)
	subscribers := m.subscriberListLocked()
	m.mu.Unlock()
	m.publishToSubscribers(subscribers, update)
}

func (m *Manager) appendAssistantDelta(threadID, turnID, itemID, delta string) {
	m.appendItemStringField(threadID, turnID, itemID, "text", delta)
}

func (m *Manager) appendCommandOutputDelta(threadID, turnID, itemID, delta string) {
	m.appendItemNullableStringField(threadID, turnID, itemID, "aggregatedOutput", delta)
}

func (m *Manager) appendItemStringField(threadID, turnID, itemID, field, delta string) {
	m.mu.Lock()
	managed := m.threads[threadID]
	turnIndex, itemIndex := managed.findItem(turnID, itemID)
	managed.thread.Turns[turnIndex].Items[itemIndex] = appendRequiredStringField(
		managed.thread.Turns[turnIndex].Items[itemIndex],
		field,
		delta,
	)
	m.publishTurnUpdateLocked(managed, turnIndex)
}

func (m *Manager) appendItemNullableStringField(threadID, turnID, itemID, field, delta string) {
	m.mu.Lock()
	managed := m.threads[threadID]
	turnIndex, itemIndex := managed.findItem(turnID, itemID)
	managed.thread.Turns[turnIndex].Items[itemIndex] = appendNullableStringField(
		managed.thread.Turns[turnIndex].Items[itemIndex],
		field,
		delta,
	)
	m.publishTurnUpdateLocked(managed, turnIndex)
}

func (m *Manager) insertItemStringArrayElement(threadID, turnID, itemID, field string, index int, value string) {
	m.mu.Lock()
	managed := m.threads[threadID]
	turnIndex, itemIndex := managed.findItem(turnID, itemID)
	managed.thread.Turns[turnIndex].Items[itemIndex] = insertStringArrayElement(
		managed.thread.Turns[turnIndex].Items[itemIndex],
		field,
		index,
		value,
	)
	m.publishTurnUpdateLocked(managed, turnIndex)
}

func (m *Manager) appendItemStringArrayDelta(threadID, turnID, itemID, field string, index int, delta string) {
	m.mu.Lock()
	managed := m.threads[threadID]
	turnIndex, itemIndex := managed.findItem(turnID, itemID)
	managed.thread.Turns[turnIndex].Items[itemIndex] = appendStringArrayDelta(
		managed.thread.Turns[turnIndex].Items[itemIndex],
		field,
		index,
		delta,
	)
	m.publishTurnUpdateLocked(managed, turnIndex)
}

func (m *Manager) publishTurnUpdateLocked(managed *managedThread, turnIndex int) {
	update := m.turnUpdateLocked(managed, turnIndex)
	subscribers := m.subscriberListLocked()
	m.mu.Unlock()
	m.publishToSubscribers(subscribers, update)
}

func (m *Manager) applyStatus(threadID string, status appserver.ThreadStatus) {
	m.mu.Lock()
	managed := m.threads[threadID]
	managed.thread.Status = status
	update := m.threadUpdateLocked(managed)
	subscribers := m.subscriberListLocked()
	m.mu.Unlock()
	m.publishToSubscribers(subscribers, update)
}

func (m *Manager) addThreadLocked(thread appserver.Thread) *managedThread {
	managed := m.newManagedThreadLocked(thread, true)
	m.threadOrder = append([]string{thread.ID}, m.threadOrder...)
	m.changed.Broadcast()
	return managed
}

func (m *Manager) appendListedThreadLocked(thread appserver.Thread) {
	m.newManagedThreadLocked(thread, false)
	m.threadOrder = append(m.threadOrder, thread.ID)
}

func (m *Manager) newManagedThreadLocked(thread appserver.Thread, historyLoaded bool) *managedThread {
	if m.threads[thread.ID] != nil {
		panic("thread already exists: " + thread.ID)
	}
	managed := &managedThread{
		thread:        cloneThread(thread),
		historyLoaded: historyLoaded,
	}
	m.threads[thread.ID] = managed
	return managed
}

func (m *Manager) replaceThreadLocked(thread appserver.Thread) *managedThread {
	managed := m.threads[thread.ID]
	managed.thread = cloneThread(thread)
	return managed
}

func (s *managedThread) turnIndexFor(turnID string) int {
	for index := range s.thread.Turns {
		if s.thread.Turns[index].ID == turnID {
			return index
		}
	}
	panic("turn not found: " + turnID)
}

func (s *managedThread) appendTurn(turn appserver.Turn) int {
	s.thread.Turns = append(s.thread.Turns, cloneTurn(turn))
	return len(s.thread.Turns) - 1
}

func (s *managedThread) replaceTurn(turn appserver.Turn) int {
	index := s.turnIndexFor(turn.ID)
	s.thread.Turns[index] = cloneTurn(turn)
	return index
}

func (s *managedThread) appendItem(turnIndex int, item json.RawMessage) {
	s.thread.Turns[turnIndex].Items = append(s.thread.Turns[turnIndex].Items, cloneRawMessage(item))
}

func (s *managedThread) replaceItem(turnIndex int, item json.RawMessage) {
	itemIndex := s.itemIndexFor(turnIndex, itemHeader(item).ID)
	s.thread.Turns[turnIndex].Items[itemIndex] = cloneRawMessage(item)
}

func (s *managedThread) findItem(turnID, itemID string) (int, int) {
	turnIndex := s.turnIndexFor(turnID)
	return turnIndex, s.itemIndexFor(turnIndex, itemID)
}

func (s *managedThread) itemIndexFor(turnIndex int, itemID string) int {
	for itemIndex := range s.thread.Turns[turnIndex].Items {
		if itemHeader(s.thread.Turns[turnIndex].Items[itemIndex]).ID == itemID {
			return itemIndex
		}
	}
	panic("item not found: " + itemID)
}

func (m *Manager) turnStartedUpdateLocked(managed *managedThread, turnIndex int) StateUpdate {
	managed.sequence++
	return StateUpdate{
		ThreadID: managed.thread.ID,
		Sequence: managed.sequence,
		Type:     "turnStarted",
		Data:     encodeJSON(cloneTurn(managed.thread.Turns[turnIndex])),
	}
}

func (m *Manager) threadUpdateLocked(managed *managedThread) StateUpdate {
	managed.sequence++
	return StateUpdate{
		ThreadID: managed.thread.ID,
		Sequence: managed.sequence,
		Type:     "threadUpdated",
		Data:     encodeJSON(cloneThread(managed.thread)),
	}
}

func (m *Manager) threadStartedUpdateLocked(managed *managedThread) StateUpdate {
	managed.sequence++
	return StateUpdate{
		ThreadID: managed.thread.ID,
		Sequence: managed.sequence,
		Type:     "threadStarted",
		Data:     encodeJSON(cloneThread(managed.thread)),
	}
}

func (m *Manager) turnUpdateLocked(managed *managedThread, turnIndex int) StateUpdate {
	managed.sequence++
	return StateUpdate{
		ThreadID: managed.thread.ID,
		Sequence: managed.sequence,
		Type:     "turnUpdated",
		Data:     encodeJSON(cloneTurn(managed.thread.Turns[turnIndex])),
	}
}

func (m *Manager) subscriberListLocked() []chan StateUpdate {
	subscribers := make([]chan StateUpdate, 0, len(m.subscribers))
	for _, ch := range m.subscribers {
		subscribers = append(subscribers, ch)
	}
	return subscribers
}

func (m *Manager) publishToSubscribers(subscribers []chan StateUpdate, update StateUpdate) {
	for _, ch := range subscribers {
		ch <- update
	}
}

func cloneThread(thread appserver.Thread) appserver.Thread {
	out := thread
	out.Turns = make([]appserver.Turn, len(thread.Turns))
	for index := range thread.Turns {
		out.Turns[index] = cloneTurn(thread.Turns[index])
	}
	return out
}

func cloneTurn(turn appserver.Turn) appserver.Turn {
	out := turn
	out.Items = cloneRawMessages(turn.Items)
	return out
}

func notificationParams[T any](notification appserver.Notification) T {
	return decodeJSON[T](notification.Params)
}

func decodeJSON[T any](raw json.RawMessage) T {
	var value T
	if err := json.Unmarshal(raw, &value); err != nil {
		panic(err)
	}
	return value
}

func itemHeader(raw json.RawMessage) appserver.ThreadItemHeader {
	return decodeJSON[appserver.ThreadItemHeader](raw)
}

func appendRequiredStringField(raw json.RawMessage, field, delta string) json.RawMessage {
	object := decodeJSON[map[string]json.RawMessage](raw)
	value := decodeJSON[string](object[field])
	object[field] = encodeJSON(value + delta)
	return encodeJSON(object)
}

func appendNullableStringField(raw json.RawMessage, field, delta string) json.RawMessage {
	object := decodeJSON[map[string]json.RawMessage](raw)
	value := decodeJSON[*string](object[field])
	if value == nil {
		object[field] = encodeJSON(delta)
	} else {
		object[field] = encodeJSON(*value + delta)
	}
	return encodeJSON(object)
}

func insertStringArrayElement(raw json.RawMessage, field string, index int, value string) json.RawMessage {
	object := decodeJSON[map[string]json.RawMessage](raw)
	values := decodeJSON[[]string](object[field])
	values = append(values, "")
	copy(values[index+1:], values[index:])
	values[index] = value
	object[field] = encodeJSON(values)
	return encodeJSON(object)
}

func appendStringArrayDelta(raw json.RawMessage, field string, index int, delta string) json.RawMessage {
	object := decodeJSON[map[string]json.RawMessage](raw)
	values := decodeJSON[[]string](object[field])
	values[index] += delta
	object[field] = encodeJSON(values)
	return encodeJSON(object)
}

func encodeJSON(value any) json.RawMessage {
	raw, err := json.Marshal(value)
	if err != nil {
		panic(err)
	}
	return raw
}

func cloneRawMessages(items []json.RawMessage) []json.RawMessage {
	out := make([]json.RawMessage, len(items))
	for index := range items {
		out[index] = cloneRawMessage(items[index])
	}
	return out
}

func cloneRawMessage(item json.RawMessage) json.RawMessage {
	return append(json.RawMessage(nil), item...)
}
