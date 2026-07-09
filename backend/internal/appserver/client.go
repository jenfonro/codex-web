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
	"time"
)

const defaultRequestTimeout = 60 * time.Second

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

func New(cfg Config) *Client {
	return &Client{
		cfg:         cfg,
		pending:     map[string]chan rpcResult{},
		subscribers: map[int]chan Notification{},
	}
}

func (c *Client) ListThreads(ctx context.Context, limit int) ([]Thread, error) {
	if limit <= 0 {
		limit = 200
	}
	var threads []Thread
	var cursor *string
	for len(threads) < limit {
		pageLimit := limit - len(threads)
		if pageLimit > 100 {
			pageLimit = 100
		}
		var response ThreadListResponse
		err := c.RequestJSON(ctx, "thread/list", map[string]any{
			"cursor":        cursor,
			"limit":         pageLimit,
			"sortKey":       "recency_at",
			"sortDirection": "desc",
			"archived":      false,
			"sourceKinds": []string{
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
		if response.NextCursor == nil || *response.NextCursor == "" {
			break
		}
		cursor = response.NextCursor
	}
	return threads, nil
}

func (c *Client) ReadThread(ctx context.Context, threadID string) (Thread, error) {
	var response ThreadReadResponse
	err := c.RequestJSON(ctx, "thread/read", map[string]any{
		"threadId":     threadID,
		"includeTurns": true,
	}, &response)
	return response.Thread, err
}

func (c *Client) StartThread(ctx context.Context, cwd string) (Thread, error) {
	params := map[string]any{
		"cwd":          cwd,
		"threadSource": "codexWeb",
	}
	var response ThreadStartResponse
	err := c.RequestJSON(ctx, "thread/start", params, &response)
	return response.Thread, err
}

func (c *Client) ResumeThread(ctx context.Context, threadID, cwd string) (Thread, error) {
	params := map[string]any{
		"threadId": threadID,
	}
	if strings.TrimSpace(cwd) != "" {
		params["cwd"] = cwd
	}
	var response ThreadResumeResponse
	err := c.RequestJSON(ctx, "thread/resume", params, &response)
	return response.Thread, err
}

func (c *Client) StartTurn(ctx context.Context, threadID, prompt, cwd string) (Turn, error) {
	params := map[string]any{
		"threadId": threadID,
		"input": []map[string]any{
			{
				"type":          "text",
				"text":          prompt,
				"text_elements": []any{},
			},
		},
	}
	if strings.TrimSpace(cwd) != "" {
		params["cwd"] = cwd
	}
	var response TurnStartResponse
	err := c.RequestJSON(ctx, "turn/start", params, &response)
	return response.Turn, err
}

func (c *Client) InterruptTurn(ctx context.Context, threadID, turnID string) error {
	var response map[string]any
	return c.RequestJSON(ctx, "turn/interrupt", map[string]any{
		"threadId": threadID,
		"turnId":   turnID,
	}, &response)
}

func (c *Client) RequestJSON(ctx context.Context, method string, params any, out any) error {
	raw, err := c.Request(ctx, method, params)
	if err != nil {
		return err
	}
	if out == nil {
		return nil
	}
	if len(raw) == 0 {
		raw = []byte("{}")
	}
	if err := json.Unmarshal(raw, out); err != nil {
		return fmt.Errorf("decode app-server %s response: %w", method, err)
	}
	return nil
}

func (c *Client) Request(ctx context.Context, method string, params any) (json.RawMessage, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	if deadline, ok := ctx.Deadline(); !ok || time.Until(deadline) <= 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, defaultRequestTimeout)
		defer cancel()
	}
	if err := c.ensureStarted(ctx); err != nil {
		return nil, err
	}
	return c.requestStarted(ctx, method, params)
}

func (c *Client) Notify(ctx context.Context, method string, params any) error {
	if err := c.ensureStarted(ctx); err != nil {
		return err
	}
	msg := map[string]any{"method": method}
	if params != nil {
		msg["params"] = params
	}
	return c.writeMessage(msg)
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
		if existing := c.subscribers[id]; existing != nil {
			delete(c.subscribers, id)
			close(existing)
		}
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
	if stdin != nil {
		_ = stdin.Close()
	}
	if cmd != nil && cmd.Process != nil {
		return cmd.Process.Kill()
	}
	return nil
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

	if _, err := c.requestStarted(ctx, "initialize", map[string]any{
		"clientInfo": map[string]any{
			"name":    "codex_web",
			"title":   "Codex Web",
			"version": "0.1.0",
		},
		"capabilities": map[string]any{
			"experimentalApi":                true,
			"requestAttestation":             false,
			"mcpServerOpenaiFormElicitation": false,
			"optOutNotificationMethods":      []string{},
		},
	}); err != nil {
		_ = c.Close()
		return err
	}
	if err := c.writeMessage(map[string]any{"method": "initialized"}); err != nil {
		_ = c.Close()
		return err
	}

	c.mu.Lock()
	c.initialized = true
	c.mu.Unlock()
	return nil
}

func (c *Client) startProcess() error {
	args := []string{"app-server", "--stdio"}
	cmd := exec.Command(c.cfg.CodexBin, args...)
	if strings.TrimSpace(c.cfg.RootDir) != "" {
		cmd.Dir = c.cfg.RootDir
	}
	cmd.Env = append(os.Environ(), "CODEX_HOME="+c.cfg.CodexHome)

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return fmt.Errorf("open app-server stdin: %w", err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		_ = stdin.Close()
		return fmt.Errorf("open app-server stdout: %w", err)
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		_ = stdin.Close()
		return fmt.Errorf("open app-server stderr: %w", err)
	}
	if err := cmd.Start(); err != nil {
		_ = stdin.Close()
		return fmt.Errorf("start codex app-server: %w", err)
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
	c.pending[id] = ch
	c.mu.Unlock()

	msg := map[string]any{
		"method": method,
		"id":     id,
	}
	if params != nil {
		msg["params"] = params
	}
	if err := c.writeMessage(msg); err != nil {
		c.mu.Lock()
		delete(c.pending, id)
		c.mu.Unlock()
		return nil, err
	}

	select {
	case <-ctx.Done():
		c.mu.Lock()
		delete(c.pending, id)
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
	if stdin == nil {
		return errors.New("app-server stdin is not open")
	}

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
			if !errors.Is(err, io.EOF) {
				log.Printf("codex app-server stdout read failed: %v", err)
			}
			c.mu.Lock()
			c.failPendingLocked(errors.New("app-server stdout closed"))
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
		log.Printf("codex app-server sent invalid JSON-RPC: %v", err)
		return
	}

	id := rpcID(msg.ID)
	switch {
	case id != "" && msg.Method == "":
		c.deliverResponse(id, msg.Result, msg.Error)
	case id != "" && msg.Method != "":
		c.handleServerRequest(id, msg.Method, msg.Params)
	case msg.Method != "":
		c.publish(Notification{Method: msg.Method, Params: rawParamsMap(msg.Params)})
	}
}

func (c *Client) deliverResponse(id string, result json.RawMessage, rpcErr *RPCError) {
	c.mu.Lock()
	ch := c.pending[id]
	delete(c.pending, id)
	c.mu.Unlock()
	if ch == nil {
		return
	}
	if rpcErr != nil {
		ch <- rpcResult{err: rpcErr}
		return
	}
	ch <- rpcResult{result: result}
}

func (c *Client) handleServerRequest(id, method string, rawParams json.RawMessage) {
	params := rawParamsMap(rawParams)
	c.publish(Notification{
		Method:    method,
		Params:    params,
		RequestID: id,
		IsRequest: true,
	})

	result, ok := automaticServerRequestResult(method)
	if ok {
		if err := c.writeMessage(map[string]any{"id": id, "result": result}); err != nil {
			log.Printf("reply to app-server request %s failed: %v", method, err)
		}
		return
	}
	errPayload := map[string]any{
		"id": id,
		"error": map[string]any{
			"code":    -32601,
			"message": "unsupported server request: " + method,
		},
	}
	if err := c.writeMessage(errPayload); err != nil {
		log.Printf("reject app-server request %s failed: %v", method, err)
	}
}

func automaticServerRequestResult(method string) (map[string]any, bool) {
	switch method {
	case "item/commandExecution/requestApproval":
		return map[string]any{"decision": "decline"}, true
	case "item/fileChange/requestApproval":
		return map[string]any{"decision": "decline"}, true
	case "tool/requestUserInput":
		return map[string]any{"answers": map[string]any{}}, true
	default:
		return nil, false
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
		select {
		case ch <- notification:
		default:
		}
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
		c.failPendingLocked(errors.New("app-server exited"))
	}
	c.mu.Unlock()
	c.publish(Notification{Method: "appserver/disconnected", Params: map[string]any{"error": fmt.Sprint(err)}})
}

func (c *Client) failPendingLocked(err error) {
	for id, ch := range c.pending {
		delete(c.pending, id)
		ch <- rpcResult{err: err}
	}
}

func rpcID(raw json.RawMessage) string {
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 || bytes.Equal(raw, []byte("null")) {
		return ""
	}
	var text string
	if err := json.Unmarshal(raw, &text); err == nil {
		return text
	}
	var num json.Number
	if err := json.Unmarshal(raw, &num); err == nil {
		return num.String()
	}
	return string(raw)
}

func rawParamsMap(raw json.RawMessage) map[string]any {
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 || bytes.Equal(raw, []byte("null")) {
		return nil
	}
	var params map[string]any
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	if err := dec.Decode(&params); err != nil {
		return nil
	}
	return params
}
