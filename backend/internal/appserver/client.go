package appserver

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
)

type Client struct {
	cfg Config

	startMu sync.Mutex

	mu          sync.Mutex
	cmd         *exec.Cmd
	stdin       io.WriteCloser
	initialized bool
	nextID      int64
	pending     map[string]chan rpcResult
	subscribers map[int]chan Notification
	nextSubID   int
	writeMu     sync.Mutex
}

type rpcResult struct {
	result json.RawMessage
	err    error
}

type rpcMessage struct {
	ID     json.RawMessage `json:"id,omitempty"`
	Method string          `json:"method,omitempty"`
	Params json.RawMessage `json:"params,omitempty"`
	Result json.RawMessage `json:"result,omitempty"`
	Error  *RPCError       `json:"error,omitempty"`
}

type rpcRequest struct {
	ID     string `json:"id"`
	Method string `json:"method"`
	Params any    `json:"params"`
}

type rpcNotification struct {
	Method string `json:"method"`
}

type rpcErrorResponse struct {
	ID    json.RawMessage `json:"id"`
	Error RPCError        `json:"error"`
}

var optOutNotificationMethods = []string{
	"thread/archived",
	"thread/deleted",
	"thread/unarchived",
	"thread/closed",
	"skills/changed",
	"thread/goal/updated",
	"thread/goal/cleared",
	"thread/settings/updated",
	"thread/tokenUsage/updated",
	"hook/started",
	"hook/completed",
	"turn/diff/updated",
	"turn/plan/updated",
	"item/autoApprovalReview/started",
	"item/autoApprovalReview/completed",
	"rawResponseItem/completed",
	"command/exec/outputDelta",
	"process/outputDelta",
	"process/exited",
	"item/commandExecution/terminalInteraction",
	"item/fileChange/outputDelta",
	"item/fileChange/patchUpdated",
	"serverRequest/resolved",
	"item/mcpToolCall/progress",
	"mcpServer/oauthLogin/completed",
	"mcpServer/startupStatus/updated",
	"account/updated",
	"account/rateLimits/updated",
	"app/list/updated",
	"remoteControl/status/changed",
	"externalAgentConfig/import/progress",
	"externalAgentConfig/import/completed",
	"fs/changed",
	"thread/compacted",
	"model/rerouted",
	"model/verification",
	"turn/moderationMetadata",
	"model/safetyBuffering/updated",
	"warning",
	"guardianWarning",
	"deprecationNotice",
	"configWarning",
	"fuzzyFileSearch/sessionUpdated",
	"fuzzyFileSearch/sessionCompleted",
	"thread/realtime/started",
	"thread/realtime/itemAdded",
	"thread/realtime/transcript/delta",
	"thread/realtime/transcript/done",
	"thread/realtime/outputAudio/delta",
	"thread/realtime/sdp",
	"thread/realtime/error",
	"thread/realtime/closed",
	"windows/worldWritableWarning",
	"windowsSandbox/setupCompleted",
	"account/login/completed",
}

func New(cfg Config) *Client {
	return &Client{
		cfg:         cfg,
		pending:     map[string]chan rpcResult{},
		subscribers: map[int]chan Notification{},
	}
}

func (c *Client) ListThreads(ctx context.Context) ([]Thread, error) {
	var threads []Thread
	var cursor *string
	for {
		var response ThreadListResponse
		err := c.RequestJSON(ctx, "thread/list", ThreadListParams{
			Cursor:        cursor,
			Limit:         100,
			SortKey:       "recency_at",
			SortDirection: "desc",
			Archived:      false,
			SourceKinds: []string{
				"appServer",
				"cli",
				"vscode",
				"exec",
			},
		}, &response)
		if err != nil {
			return nil, err
		}
		threads = append(threads, response.Data...)
		if response.NextCursor == nil {
			break
		}
		cursor = response.NextCursor
	}
	return threads, nil
}

func (c *Client) ListTurns(ctx context.Context, threadID string, cursor *string) (ThreadTurnsListResponse, error) {
	var response ThreadTurnsListResponse
	err := c.RequestJSON(ctx, "thread/turns/list", ThreadTurnsListParams{
		ThreadID:      threadID,
		Cursor:        cursor,
		Limit:         8,
		SortDirection: "desc",
		ItemsView:     "full",
	}, &response)
	return response, err
}

func (c *Client) StartThread(ctx context.Context, cwd string) (Thread, error) {
	var response ThreadStartResponse
	err := c.RequestJSON(ctx, "thread/start", ThreadStartParams{
		CWD:          cwd,
		ThreadSource: "codexWeb",
	}, &response)
	return response.Thread, err
}

func (c *Client) ResumeThread(ctx context.Context, threadID, cwd string) (Thread, error) {
	var response ThreadResumeResponse
	err := c.RequestJSON(ctx, "thread/resume", ThreadResumeParams{
		ThreadID:     threadID,
		CWD:          cwd,
		ExcludeTurns: true,
	}, &response)
	return response.Thread, err
}

func (c *Client) StartTurn(ctx context.Context, threadID, prompt, cwd string) error {
	var response TurnStartResponse
	return c.RequestJSON(ctx, "turn/start", TurnStartParams{
		ThreadID: threadID,
		CWD:      cwd,
		Input: []TextInput{
			{
				Type:         "text",
				Text:         prompt,
				TextElements: []struct{}{},
			},
		},
	}, &response)
}

func (c *Client) InterruptTurn(ctx context.Context, threadID, turnID string) error {
	var response struct{}
	return c.RequestJSON(ctx, "turn/interrupt", TurnInterruptParams{
		ThreadID: threadID,
		TurnID:   turnID,
	}, &response)
}

func (c *Client) RequestJSON(ctx context.Context, method string, params any, out any) error {
	raw, err := c.Request(ctx, method, params)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(raw, out); err != nil {
		return fmt.Errorf("decode app-server %s response: %w", method, err)
	}
	return nil
}

func (c *Client) Request(ctx context.Context, method string, params any) (json.RawMessage, error) {
	if err := c.ensureStarted(ctx); err != nil {
		return nil, err
	}
	return c.requestStarted(ctx, method, params)
}

func (c *Client) Subscribe() (<-chan Notification, func()) {
	ch := make(chan Notification, 256)
	c.mu.Lock()
	id := c.nextSubID
	c.nextSubID++
	c.subscribers[id] = ch
	c.mu.Unlock()
	return ch, func() {
		c.mu.Lock()
		existing := c.subscribers[id]
		delete(c.subscribers, id)
		close(existing)
		c.mu.Unlock()
	}
}

func (c *Client) Close() error {
	c.mu.Lock()
	cmd := c.cmd
	stdin := c.stdin
	c.cmd = nil
	c.stdin = nil
	c.initialized = false
	c.failPendingLocked(errors.New("app-server closed"))
	c.mu.Unlock()
	var closeErr error
	if stdin != nil {
		closeErr = stdin.Close()
	}
	if cmd != nil && cmd.Process != nil {
		return errors.Join(closeErr, cmd.Process.Kill())
	}
	return closeErr
}

func (c *Client) ensureStarted(ctx context.Context) error {
	c.startMu.Lock()
	defer c.startMu.Unlock()

	c.mu.Lock()
	if c.initialized {
		c.mu.Unlock()
		return nil
	}
	c.mu.Unlock()

	if err := c.startProcess(); err != nil {
		return err
	}

	if _, err := c.requestStarted(ctx, "initialize", InitializeParams{
		ClientInfo: ClientInfo{
			Name:    "codex_web",
			Title:   "Codex Web",
			Version: "0.1.0",
		},
		Capabilities: ClientCapabilities{
			ExperimentalAPI:                true,
			RequestAttestation:             false,
			MCPServerOpenAIFormElicitation: false,
			OptOutNotificationMethods:      optOutNotificationMethods,
		},
	}); err != nil {
		return errors.Join(err, c.Close())
	}
	if err := c.writeMessage(rpcNotification{Method: "initialized"}); err != nil {
		return errors.Join(err, c.Close())
	}

	c.mu.Lock()
	c.initialized = true
	c.mu.Unlock()
	return nil
}

func (c *Client) startProcess() error {
	args := []string{"app-server", "--stdio"}
	cmd := exec.Command(c.cfg.CodexBin, args...)
	cmd.Dir = c.cfg.RootDir
	cmd.Env = append(os.Environ(), "CODEX_HOME="+c.cfg.CodexHome)

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return fmt.Errorf("open app-server stdin: %w", err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return errors.Join(fmt.Errorf("open app-server stdout: %w", err), stdin.Close())
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return errors.Join(fmt.Errorf("open app-server stderr: %w", err), stdin.Close())
	}
	if err := cmd.Start(); err != nil {
		return errors.Join(fmt.Errorf("start codex app-server: %w", err), stdin.Close())
	}

	c.mu.Lock()
	c.cmd = cmd
	c.stdin = stdin
	c.mu.Unlock()

	go c.readLoop(stdout)
	go c.stderrLoop(stderr)
	go c.waitLoop(cmd)
	return nil
}

func (c *Client) requestStarted(ctx context.Context, method string, params any) (json.RawMessage, error) {
	id := c.nextRequestID()
	ch := make(chan rpcResult, 1)

	c.mu.Lock()
	c.pending[strconv.Quote(id)] = ch
	c.mu.Unlock()

	msg := rpcRequest{
		Method: method,
		ID:     id,
		Params: params,
	}
	if err := c.writeMessage(msg); err != nil {
		c.mu.Lock()
		delete(c.pending, strconv.Quote(id))
		c.mu.Unlock()
		return nil, err
	}

	select {
	case <-ctx.Done():
		c.mu.Lock()
		delete(c.pending, strconv.Quote(id))
		c.mu.Unlock()
		return nil, ctx.Err()
	case result := <-ch:
		return result.result, result.err
	}
}

func (c *Client) nextRequestID() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.nextID++
	return "req-" + strconv.FormatInt(c.nextID, 10)
}

func (c *Client) writeMessage(value any) error {
	payload, err := json.Marshal(value)
	if err != nil {
		return err
	}
	payload = append(payload, '\n')

	c.mu.Lock()
	stdin := c.stdin
	c.mu.Unlock()

	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	_, err = stdin.Write(payload)
	if err != nil {
		return fmt.Errorf("write app-server message: %w", err)
	}
	return nil
}

func (c *Client) readLoop(reader io.Reader) {
	buf := bufio.NewReader(reader)
	for {
		line, err := buf.ReadBytes('\n')
		if len(bytes.TrimSpace(line)) > 0 {
			c.handleLine(bytes.TrimSpace(line))
		}
		if err != nil {
			c.mu.Lock()
			c.failPendingLocked(err)
			c.mu.Unlock()
			return
		}
	}
}

func (c *Client) handleLine(line []byte) {
	var msg rpcMessage
	dec := json.NewDecoder(bytes.NewReader(line))
	dec.UseNumber()
	if err := dec.Decode(&msg); err != nil {
		panic(err)
	}

	id := bytes.TrimSpace(msg.ID)
	switch {
	case len(id) > 0 && msg.Method == "":
		c.deliverResponse(string(id), msg.Result, msg.Error)
	case len(id) > 0 && msg.Method != "":
		c.handleServerRequest(id, msg.Method)
	case msg.Method != "":
		c.publish(Notification{Method: msg.Method, Params: msg.Params})
	default:
		panic("app-server message has neither response id nor method")
	}
}

func (c *Client) deliverResponse(id string, result json.RawMessage, rpcErr *RPCError) {
	c.mu.Lock()
	ch := c.pending[id]
	delete(c.pending, id)
	c.mu.Unlock()
	if ch == nil {
		panic("unexpected app-server response id: " + id)
	}
	if rpcErr != nil {
		ch <- rpcResult{err: rpcErr}
		return
	}
	ch <- rpcResult{result: result}
}

func (c *Client) handleServerRequest(id json.RawMessage, method string) {
	errPayload := rpcErrorResponse{
		ID: id,
		Error: RPCError{
			Code:    -32601,
			Message: "unsupported server request: " + method,
		},
	}
	if err := c.writeMessage(errPayload); err != nil {
		panic(err)
	}
}

func (c *Client) publish(notification Notification) {
	c.mu.Lock()
	subscribers := make([]chan Notification, 0, len(c.subscribers))
	for _, ch := range c.subscribers {
		subscribers = append(subscribers, ch)
	}
	c.mu.Unlock()

	for _, ch := range subscribers {
		ch <- notification
	}
}

func (c *Client) stderrLoop(reader io.Reader) {
	scanner := bufio.NewScanner(reader)
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, 1024*1024)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line != "" {
			log.Printf("codex app-server: %s", line)
		}
	}
	if err := scanner.Err(); err != nil {
		panic(err)
	}
}

func (c *Client) waitLoop(cmd *exec.Cmd) {
	err := cmd.Wait()
	if err != nil {
		log.Printf("codex app-server exited: %v", err)
	} else {
		log.Printf("codex app-server exited")
	}
	c.mu.Lock()
	if c.cmd == cmd {
		c.cmd = nil
		c.stdin = nil
		c.initialized = false
		c.failPendingLocked(fmt.Errorf("app-server exited with code %d", cmd.ProcessState.ExitCode()))
	}
	c.mu.Unlock()
}

func (c *Client) failPendingLocked(err error) {
	for id, ch := range c.pending {
		delete(c.pending, id)
		ch <- rpcResult{err: err}
	}
}
