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
	"strings"
	"sync"
	"time"

	"codex-web/agent/internal/model"
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

type Manager struct {
	cfg Config

	mu          sync.Mutex
	sessions    map[string]*managedSession
	subscribers map[int]chan model.SessionEvent
	nextSubID   int
}

type managedSession struct {
	record model.SessionRecord
	events []model.SessionEvent
	cancel context.CancelFunc
}

func New(cfg Config) *Manager {
	return &Manager{
		cfg:         cfg,
		sessions:    map[string]*managedSession{},
		subscribers: map[int]chan model.SessionEvent{},
	}
}

func (m *Manager) List() []model.SessionRecord {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]model.SessionRecord, 0, len(m.sessions))
	for _, session := range m.sessions {
		out = append(out, session.record)
	}
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
	session.cancel = nil
	session.record.Status = statusIdle
	session.record.UpdatedAt = time.Now().UTC()
	m.mu.Unlock()
	if cancel != nil {
		cancel()
	}
	m.appendEvent(id, "system", "Session cancelled.", nil)
	return nil
}

func (m *Manager) Events(id string, lastSeq int64) ([]model.SessionEvent, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	session := m.sessions[id]
	if session == nil {
		return nil, errors.New("session not found")
	}
	events := make([]model.SessionEvent, 0, len(session.events))
	for _, event := range session.events {
		if event.Seq > lastSeq {
			events = append(events, event)
		}
	}
	return events, nil
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
	m.mu.Lock()
	if session := m.sessions[sessionID]; session != nil {
		if session.cancel != nil {
			session.cancel()
		}
		session.cancel = cancel
	}
	m.mu.Unlock()
	go m.runCodex(ctx, sessionID, codexThreadID, prompt, cwd)
}

func (m *Manager) runCodex(ctx context.Context, sessionID, codexThreadID, prompt, cwd string) {
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
		m.finishWithError(sessionID, err)
		return
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		m.finishWithError(sessionID, err)
		return
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		m.finishWithError(sessionID, err)
		return
	}
	if err := cmd.Start(); err != nil {
		m.finishWithError(sessionID, err)
		return
	}
	go func() {
		_, _ = io.WriteString(stdin, prompt)
		_ = stdin.Close()
	}()
	go m.scanStderr(sessionID, stderr)
	m.scanStdout(sessionID, stdout)
	err = cmd.Wait()
	m.mu.Lock()
	session := m.sessions[sessionID]
	if session != nil {
		session.cancel = nil
		if err != nil {
			session.record.Status = statusError
		} else {
			session.record.Status = statusIdle
		}
		session.record.UpdatedAt = time.Now().UTC()
	}
	m.mu.Unlock()
	if err != nil {
		m.appendEvent(sessionID, "error", err.Error(), nil)
	}
}

func (m *Manager) scanStdout(sessionID string, reader io.Reader) {
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
			m.appendEvent(sessionID, "stdout", line, nil)
			continue
		}
		m.handleCLIEvent(sessionID, raw)
	}
	if err := scanner.Err(); err != nil {
		m.appendEvent(sessionID, "error", err.Error(), nil)
	}
}

func (m *Manager) scanStderr(sessionID string, reader io.Reader) {
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line != "" {
			m.appendEvent(sessionID, "stderr", line, nil)
		}
	}
}

func (m *Manager) handleCLIEvent(sessionID string, raw map[string]any) {
	eventType := stringAny(raw["type"])
	switch eventType {
	case "thread.started":
		threadID := stringAny(raw["thread_id"])
		m.mu.Lock()
		if session := m.sessions[sessionID]; session != nil && threadID != "" {
			session.record.CodexThreadID = threadID
			session.record.UpdatedAt = time.Now().UTC()
		}
		m.mu.Unlock()
		m.appendEvent(sessionID, "thread_started", "", raw)
	case "turn.started":
		m.appendEvent(sessionID, "turn_started", "", raw)
	case "turn.completed":
		m.appendEvent(sessionID, "turn_completed", "", raw)
	case "item.completed":
		text, kind := itemText(raw["item"])
		m.appendEvent(sessionID, kind, text, raw)
	default:
		m.appendEvent(sessionID, "cli_event", "", raw)
	}
}

func (m *Manager) finishWithError(sessionID string, err error) {
	m.mu.Lock()
	if session := m.sessions[sessionID]; session != nil {
		session.cancel = nil
		session.record.Status = statusError
		session.record.UpdatedAt = time.Now().UTC()
	}
	m.mu.Unlock()
	m.appendEvent(sessionID, "error", err.Error(), nil)
}

func (m *Manager) setStatus(sessionID, status string) {
	m.mu.Lock()
	if session := m.sessions[sessionID]; session != nil {
		session.record.Status = status
		session.record.UpdatedAt = time.Now().UTC()
	}
	m.mu.Unlock()
}

func (m *Manager) appendEvent(sessionID, kind, text string, data map[string]any) {
	m.mu.Lock()
	session := m.sessions[sessionID]
	if session == nil {
		m.mu.Unlock()
		return
	}
	seq := session.record.LastSeq + 1
	event := model.SessionEvent{
		SessionID: sessionID,
		Seq:       seq,
		Time:      time.Now().UTC(),
		Kind:      kind,
		Text:      text,
		Data:      data,
	}
	session.record.LastSeq = seq
	session.record.UpdatedAt = event.Time
	session.events = append(session.events, event)
	subscribers := make([]chan model.SessionEvent, 0, len(m.subscribers))
	for _, ch := range m.subscribers {
		subscribers = append(subscribers, ch)
	}
	m.mu.Unlock()
	for _, ch := range subscribers {
		select {
		case ch <- event:
		default:
		}
	}
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
