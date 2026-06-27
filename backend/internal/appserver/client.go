package appserver

import (
	"bufio"
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

type Client struct {
	cfg Config

	cmd    *exec.Cmd
	stdin  io.WriteCloser
	ws     *websocketConn
	cancel context.CancelFunc

	nextID atomic.Int64

	mu          sync.Mutex
	pendingRPC  map[string]chan rpcMessage
	subscribers map[int]chan Event
	nextSubID   int
	requests    map[string]*PendingRequest

	writeMu sync.Mutex
}

type Config struct {
	Endpoint  string
	CodexBin  string
	CodexHome string
	RootDir   string
}

type Event struct {
	Method string         `json:"method"`
	Params map[string]any `json:"params"`
}

type PendingRequest struct {
	ID        string         `json:"id"`
	Method    string         `json:"method"`
	Kind      string         `json:"kind"`
	ThreadID  string         `json:"threadId,omitempty"`
	TurnID    string         `json:"turnId,omitempty"`
	ItemID    string         `json:"itemId,omitempty"`
	Title     string         `json:"title"`
	Reason    string         `json:"reason,omitempty"`
	Command   string         `json:"command,omitempty"`
	CWD       string         `json:"cwd,omitempty"`
	Params    map[string]any `json:"params"`
	CreatedAt string         `json:"createdAt"`

	responseID json.RawMessage
}

type Thread struct {
	ID            string         `json:"id"`
	SessionID     string         `json:"sessionId"`
	Name          string         `json:"name"`
	Preview       string         `json:"preview"`
	ModelProvider string         `json:"modelProvider"`
	CWD           string         `json:"cwd"`
	Path          string         `json:"path"`
	Source        string         `json:"source"`
	CreatedAt     int64          `json:"createdAt"`
	UpdatedAt     int64          `json:"updatedAt"`
	Status        map[string]any `json:"status"`
	Turns         []Turn         `json:"turns"`
}

type ThreadTurnsPage struct {
	Data            []Turn `json:"data"`
	NextCursor      string `json:"nextCursor"`
	BackwardsCursor string `json:"backwardsCursor"`
}

type ThreadGoal struct {
	ThreadID        string `json:"threadId"`
	Objective       string `json:"objective"`
	Status          string `json:"status"`
	TokenBudget     *int64 `json:"tokenBudget"`
	TokensUsed      int64  `json:"tokensUsed"`
	TimeUsedSeconds int64  `json:"timeUsedSeconds"`
	CreatedAt       int64  `json:"createdAt"`
	UpdatedAt       int64  `json:"updatedAt"`
}

type Model struct {
	ID                        string                  `json:"id"`
	Model                     string                  `json:"model"`
	DisplayName               string                  `json:"displayName"`
	Description               string                  `json:"description"`
	Hidden                    bool                    `json:"hidden"`
	Default                   bool                    `json:"isDefault"`
	SupportedReasoningEfforts []ReasoningEffortOption `json:"supportedReasoningEfforts"`
	DefaultReasoningEffort    string                  `json:"defaultReasoningEffort"`
}

type ReasoningEffortOption struct {
	ReasoningEffort string `json:"reasoningEffort"`
	Description     string `json:"description"`
}

type CodexConfig struct {
	Provider          string
	Model             string
	Reasoning         string
	ThreadDetailLevel string
}

type ConfigRequirements struct {
	AllowedApprovalPolicies   []any           `json:"allowedApprovalPolicies"`
	AllowedApprovalsReviewers []string        `json:"allowedApprovalsReviewers"`
	AllowedPermissionProfiles map[string]bool `json:"allowedPermissionProfiles"`
	AllowedSandboxModes       []string        `json:"allowedSandboxModes"`
	DefaultPermissions        string          `json:"defaultPermissions"`
}

type Turn struct {
	ID                           string       `json:"id"`
	Status                       string       `json:"status"`
	Items                        []ThreadItem `json:"items"`
	StartedAt                    int64        `json:"startedAt"`
	CompletedAt                  int64        `json:"completedAt"`
	DurationMs                   int64        `json:"durationMs"`
	FirstTurnWorkItemStartedAtMs int64        `json:"firstTurnWorkItemStartedAtMs"`
	FinalAssistantStartedAtMs    int64        `json:"finalAssistantStartedAtMs"`
}

type ThreadItem struct {
	Type              string           `json:"type"`
	ID                string           `json:"id"`
	Text              string           `json:"text"`
	Phase             string           `json:"phase"`
	Content           []any            `json:"content"`
	Summary           []string         `json:"summary"`
	Command           string           `json:"command"`
	CWD               string           `json:"cwd"`
	Status            string           `json:"status"`
	AggregatedOutput  string           `json:"aggregatedOutput"`
	ExitCode          *int             `json:"exitCode"`
	Changes           []map[string]any `json:"changes"`
	CommandActions    []map[string]any `json:"commandActions"`
	DurationMs        *int64           `json:"durationMs"`
	Arguments         any              `json:"arguments"`
	Result            any              `json:"result"`
	Error             any              `json:"error"`
	ContentItems      any              `json:"contentItems"`
	Tool              string           `json:"tool"`
	Server            string           `json:"server"`
	Namespace         string           `json:"namespace"`
	Success           *bool            `json:"success"`
	Query             string           `json:"query"`
	Action            any              `json:"action"`
	Path              string           `json:"path"`
	Review            string           `json:"review"`
	SavedPath         string           `json:"savedPath"`
	RevisedPrompt     string           `json:"revisedPrompt"`
	Prompt            string           `json:"prompt"`
	Model             string           `json:"model"`
	ReasoningEffort   string           `json:"reasoningEffort"`
	ReceiverThreadIDs []string         `json:"receiverThreadIds"`
	Raw               map[string]any   `json:"-"`
}

type SendOptions struct {
	ThreadID    string
	CWD         string
	Model       string
	Reasoning   string
	AgentMode   string
	PlanMode    bool
	Prompt      string
	Attachments []InputAttachment
}

type ReviewOptions struct {
	ThreadID string
	Target   map[string]any
	Delivery string
}

type InputAttachment struct {
	Type   string
	Name   string
	Path   string
	URL    string
	Detail string
}

type ResolveRequest struct {
	Action           string            `json:"action"`
	Scope            string            `json:"scope"`
	StrictAutoReview *bool             `json:"strictAutoReview,omitempty"`
	Answers          map[string]string `json:"answers"`
	Content          map[string]any    `json:"content"`
	Meta             map[string]any    `json:"_meta"`
}

type rpcMessage struct {
	ID     json.RawMessage `json:"id,omitempty"`
	Method string          `json:"method,omitempty"`
	Params json.RawMessage `json:"params,omitempty"`
	Result json.RawMessage `json:"result,omitempty"`
	Error  *rpcError       `json:"error,omitempty"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func (t *ThreadItem) UnmarshalJSON(data []byte) error {
	type threadItem ThreadItem
	var item threadItem
	if err := json.Unmarshal(data, &item); err != nil {
		return err
	}
	var raw map[string]any
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	*t = ThreadItem(item)
	t.Raw = raw
	return nil
}

func New(cfg Config) *Client {
	if strings.TrimSpace(cfg.Endpoint) == "" {
		cfg.Endpoint = "stdio"
	}
	if strings.TrimSpace(cfg.CodexBin) == "" {
		cfg.CodexBin = "codex"
	}
	return &Client{
		cfg:         cfg,
		pendingRPC:  map[string]chan rpcMessage{},
		subscribers: map[int]chan Event{},
		requests:    map[string]*PendingRequest{},
	}
}

func (c *Client) Start(ctx context.Context) error {
	endpoint := strings.TrimSpace(c.cfg.Endpoint)
	if strings.HasPrefix(endpoint, "unix://") {
		return c.startWebSocket(ctx, endpoint)
	}
	if strings.HasPrefix(endpoint, "ws://") {
		return c.startWebSocket(ctx, endpoint)
	}
	if endpoint == "stdio://" {
		endpoint = "stdio"
	}
	if endpoint != "stdio" {
		return fmt.Errorf("unsupported Codex app-server endpoint %q", endpoint)
	}
	return c.startStdio(ctx)
}

func (c *Client) startStdio(ctx context.Context) error {
	ctx, cancel := context.WithCancel(ctx)
	cmd := exec.CommandContext(ctx, c.cfg.CodexBin, "app-server", "--listen", "stdio://")
	cmd.Env = append(os.Environ(), "CODEX_HOME="+c.cfg.CodexHome, "PATH="+pathWithCodexBin(c.cfg.CodexBin))
	stdin, err := cmd.StdinPipe()
	if err != nil {
		cancel()
		return err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		return err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		cancel()
		return err
	}
	if err := cmd.Start(); err != nil {
		cancel()
		return err
	}
	c.cmd = cmd
	c.stdin = stdin
	c.cancel = cancel
	go c.readLoop(stdout)
	go c.logStderr(stderr)
	go func() {
		_ = cmd.Wait()
		c.closePending(errors.New("codex app-server exited"))
	}()

	return c.initialize()
}

func (c *Client) startWebSocket(ctx context.Context, endpoint string) error {
	ws, err := dialWebSocket(ctx, endpoint)
	if err != nil {
		return err
	}
	c.ws = ws
	go c.readWebSocketLoop(ws)
	return c.initialize()
}

func (c *Client) initialize() error {
	if _, err := c.request(context.Background(), "initialize", map[string]any{
		"clientInfo": map[string]any{
			"name":    "codex_web",
			"title":   "Codex Web",
			"version": "0.1.0",
		},
		"capabilities": map[string]any{
			"experimentalApi": true,
		},
	}); err != nil {
		c.Close()
		return err
	}
	return c.notify("initialized", map[string]any{})
}

func pathWithCodexBin(bin string) string {
	path := os.Getenv("PATH")
	dir := filepath.Dir(bin)
	if dir == "." || dir == "" {
		return path
	}
	if path == "" {
		return dir
	}
	return dir + string(os.PathListSeparator) + path
}

func (c *Client) Close() {
	if c.cancel != nil {
		c.cancel()
	}
	if c.stdin != nil {
		_ = c.stdin.Close()
	}
	if c.ws != nil {
		_ = c.ws.Close()
	}
}

func (c *Client) Subscribe() (<-chan Event, func()) {
	ch := make(chan Event, 128)
	c.mu.Lock()
	id := c.nextSubID
	c.nextSubID++
	c.subscribers[id] = ch
	c.mu.Unlock()
	return ch, func() {
		c.mu.Lock()
		delete(c.subscribers, id)
		close(ch)
		c.mu.Unlock()
	}
}

func (c *Client) ListThreads(ctx context.Context, limit int) ([]Thread, error) {
	if limit <= 0 {
		limit = 100
	}
	raw, err := c.request(ctx, "thread/list", map[string]any{
		"limit":         limit,
		"sortKey":       "updated_at",
		"sortDirection": "desc",
	})
	if err != nil {
		return nil, err
	}
	var response struct {
		Data []Thread `json:"data"`
	}
	if err := json.Unmarshal(raw, &response); err != nil {
		return nil, err
	}
	return response.Data, nil
}

func (c *Client) ReadThread(ctx context.Context, threadID string) (Thread, error) {
	raw, err := c.request(ctx, "thread/read", map[string]any{
		"threadId": threadID,
	})
	if err != nil {
		return Thread{}, err
	}
	var response struct {
		Thread Thread `json:"thread"`
	}
	if err := json.Unmarshal(raw, &response); err != nil {
		return Thread{}, err
	}
	return response.Thread, nil
}

func (c *Client) ReadThreadWithTurns(ctx context.Context, threadID string) (Thread, error) {
	thread, err := c.ReadThread(ctx, threadID)
	if err != nil {
		return Thread{}, err
	}
	turns, err := c.ListAllThreadTurns(ctx, threadID)
	if err != nil {
		return Thread{}, err
	}
	thread.Turns = turns
	return thread, nil
}

func (c *Client) ListAllThreadTurns(ctx context.Context, threadID string) ([]Turn, error) {
	var turns []Turn
	cursor := ""
	seenCursors := map[string]bool{}
	for {
		page, err := c.ListThreadTurns(ctx, threadID, cursor, 100, "asc")
		if err != nil {
			return nil, err
		}
		turns = append(turns, page.Data...)
		if page.NextCursor == "" {
			return turns, nil
		}
		if seenCursors[page.NextCursor] {
			return nil, fmt.Errorf("thread/turns/list returned repeated cursor %q", page.NextCursor)
		}
		seenCursors[page.NextCursor] = true
		cursor = page.NextCursor
	}
}

func (c *Client) ListThreadTurns(ctx context.Context, threadID, cursor string, limit int, sortDirection string) (ThreadTurnsPage, error) {
	params := map[string]any{
		"threadId":  threadID,
		"itemsView": "full",
	}
	if cursor != "" {
		params["cursor"] = cursor
	}
	if limit > 0 {
		params["limit"] = limit
	}
	if sortDirection != "" {
		params["sortDirection"] = sortDirection
	}
	raw, err := c.request(ctx, "thread/turns/list", params)
	if err != nil {
		return ThreadTurnsPage{}, err
	}
	var response ThreadTurnsPage
	if err := json.Unmarshal(raw, &response); err != nil {
		return ThreadTurnsPage{}, err
	}
	return response, nil
}

func (c *Client) GetThreadGoal(ctx context.Context, threadID string) (*ThreadGoal, error) {
	raw, err := c.request(ctx, "thread/goal/get", map[string]any{
		"threadId": threadID,
	})
	if err != nil {
		return nil, err
	}
	var response struct {
		Goal *ThreadGoal `json:"goal"`
	}
	if err := json.Unmarshal(raw, &response); err != nil {
		return nil, err
	}
	return response.Goal, nil
}

func (c *Client) SetThreadGoal(ctx context.Context, threadID, objective, status string, tokenBudget *int64) (*ThreadGoal, error) {
	params := map[string]any{
		"threadId":  threadID,
		"objective": strings.TrimSpace(objective),
		"status":    firstString(status, "active"),
	}
	if tokenBudget != nil {
		params["tokenBudget"] = *tokenBudget
	}
	raw, err := c.request(ctx, "thread/goal/set", params)
	if err != nil {
		return nil, err
	}
	var response struct {
		Goal ThreadGoal `json:"goal"`
	}
	if err := json.Unmarshal(raw, &response); err != nil {
		return nil, err
	}
	return &response.Goal, nil
}

func (c *Client) ClearThreadGoal(ctx context.Context, threadID string) error {
	_, err := c.request(ctx, "thread/goal/clear", map[string]any{
		"threadId": threadID,
	})
	return err
}

func (c *Client) ListModels(ctx context.Context) ([]Model, error) {
	raw, err := c.request(ctx, "model/list", map[string]any{
		"limit":         100,
		"includeHidden": false,
	})
	if err != nil {
		return nil, err
	}
	var response struct {
		Data []Model `json:"data"`
	}
	if err := json.Unmarshal(raw, &response); err != nil {
		return nil, err
	}
	return response.Data, nil
}

func (c *Client) ReadConfig(ctx context.Context, cwd string) (CodexConfig, error) {
	params := map[string]any{
		"includeLayers": false,
	}
	if strings.TrimSpace(cwd) != "" {
		params["cwd"] = cwd
	}
	raw, err := c.request(ctx, "config/read", params)
	if err != nil {
		return CodexConfig{}, err
	}
	var response struct {
		Config struct {
			Provider           string `json:"model_provider"`
			Model              string `json:"model"`
			Reasoning          string `json:"model_reasoning_effort"`
			ThreadDetailLevel  string `json:"thread_detail_level"`
			ConversationDetail string `json:"conversation_detail_mode"`
		} `json:"config"`
	}
	if err := json.Unmarshal(raw, &response); err != nil {
		return CodexConfig{}, err
	}
	return CodexConfig{
		Provider:          response.Config.Provider,
		Model:             response.Config.Model,
		Reasoning:         response.Config.Reasoning,
		ThreadDetailLevel: firstString(response.Config.ThreadDetailLevel, response.Config.ConversationDetail),
	}, nil
}

func (c *Client) ReadConfigRequirements(ctx context.Context) (*ConfigRequirements, error) {
	raw, err := c.request(ctx, "configRequirements/read", nil)
	if err != nil {
		return nil, err
	}
	var response struct {
		Requirements *ConfigRequirements `json:"requirements"`
	}
	if err := json.Unmarshal(raw, &response); err != nil {
		return nil, err
	}
	return response.Requirements, nil
}

func (c *Client) RequestRaw(ctx context.Context, method string, params json.RawMessage, timeoutMs int) (json.RawMessage, error) {
	method = strings.TrimSpace(method)
	if method == "" {
		return nil, errors.New("method is required")
	}
	if timeoutMs > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, time.Duration(timeoutMs)*time.Millisecond)
		defer cancel()
	}
	var value any
	if len(params) > 0 && string(params) != "null" {
		if err := json.Unmarshal(params, &value); err != nil {
			return nil, err
		}
	}
	return c.request(ctx, method, value)
}

func (c *Client) StartThread(ctx context.Context, opts SendOptions) (Thread, error) {
	raw, err := c.request(ctx, "thread/start", threadParams(opts))
	if err != nil {
		return Thread{}, err
	}
	var response struct {
		Thread Thread `json:"thread"`
	}
	if err := json.Unmarshal(raw, &response); err != nil {
		return Thread{}, err
	}
	return response.Thread, nil
}

func (c *Client) StartTurn(ctx context.Context, opts SendOptions) (Turn, error) {
	raw, err := c.request(ctx, "turn/start", turnParams(opts))
	if err != nil {
		return Turn{}, err
	}
	var response struct {
		Turn Turn `json:"turn"`
	}
	if err := json.Unmarshal(raw, &response); err != nil {
		return Turn{}, err
	}
	return response.Turn, nil
}

func (c *Client) StartReview(ctx context.Context, opts ReviewOptions) (string, Turn, error) {
	params := map[string]any{
		"threadId": opts.ThreadID,
		"target":   opts.Target,
	}
	if opts.Delivery != "" {
		params["delivery"] = opts.Delivery
	}
	raw, err := c.request(ctx, "review/start", params)
	if err != nil {
		return "", Turn{}, err
	}
	var response struct {
		ReviewThreadID string `json:"reviewThreadId"`
		Turn           Turn   `json:"turn"`
	}
	if err := json.Unmarshal(raw, &response); err != nil {
		return "", Turn{}, err
	}
	return response.ReviewThreadID, response.Turn, nil
}

func (c *Client) SteerTurn(ctx context.Context, threadID, turnID, prompt string, attachments []InputAttachment) error {
	prompt = strings.TrimSpace(prompt)
	if threadID == "" || turnID == "" || (prompt == "" && len(attachments) == 0) {
		return fmt.Errorf("threadId, turnId and prompt or attachments are required")
	}
	_, err := c.request(ctx, "turn/steer", steerParams(threadID, turnID, prompt, attachments))
	return err
}

func (c *Client) InterruptTurn(ctx context.Context, threadID, turnID string) error {
	_, err := c.request(ctx, "turn/interrupt", map[string]any{
		"threadId": threadID,
		"turnId":   turnID,
	})
	return err
}

func userInput(text string, attachments []InputAttachment) []map[string]any {
	var input []map[string]any
	if strings.TrimSpace(text) != "" {
		input = append(input, map[string]any{
			"type":          "text",
			"text":          text,
			"text_elements": []any{},
		})
	}
	for _, attachment := range attachments {
		switch attachment.Type {
		case "localImage":
			if attachment.Path == "" {
				continue
			}
			item := map[string]any{
				"type": "localImage",
				"path": attachment.Path,
			}
			if attachment.Detail != "" {
				item["detail"] = attachment.Detail
			}
			input = append(input, item)
		case "image":
			if attachment.URL == "" {
				continue
			}
			item := map[string]any{
				"type": "image",
				"url":  attachment.URL,
			}
			if attachment.Detail != "" {
				item["detail"] = attachment.Detail
			}
			input = append(input, item)
		case "mention":
			if attachment.Path == "" {
				continue
			}
			name := attachment.Name
			if name == "" {
				name = attachment.Path
			}
			input = append(input, map[string]any{
				"type": "mention",
				"name": name,
				"path": attachment.Path,
			})
		}
	}
	return input
}

func (c *Client) PendingRequests() []PendingRequest {
	c.mu.Lock()
	defer c.mu.Unlock()
	out := make([]PendingRequest, 0, len(c.requests))
	for _, req := range c.requests {
		copyReq := *req
		copyReq.responseID = nil
		out = append(out, copyReq)
	}
	return out
}

func (c *Client) DismissRequestsForThread(threadID string) {
	threadID = strings.TrimSpace(threadID)
	if threadID == "" {
		return
	}
	var dismissed []PendingRequest
	c.mu.Lock()
	for id, req := range c.requests {
		if req.ThreadID != threadID {
			continue
		}
		dismissed = append(dismissed, *req)
		delete(c.requests, id)
	}
	c.mu.Unlock()
	for _, req := range dismissed {
		c.broadcast(Event{
			Method: "serverRequest/resolved",
			Params: map[string]any{
				"requestId": req.ID,
				"threadId":  req.ThreadID,
				"turnId":    req.TurnID,
			},
		})
	}
}

func (c *Client) ResolveRequest(id string, req ResolveRequest) error {
	c.mu.Lock()
	pending := c.requests[id]
	if pending != nil {
		delete(c.requests, id)
	}
	c.mu.Unlock()
	if pending == nil {
		return fmt.Errorf("pending request not found")
	}
	result, err := pending.resultFor(req)
	if err != nil {
		return err
	}
	if err := c.respond(pending.responseID, result); err != nil {
		return err
	}
	c.broadcast(Event{
		Method: "serverRequest/resolved",
		Params: map[string]any{
			"requestId": id,
			"threadId":  pending.ThreadID,
			"turnId":    pending.TurnID,
		},
	})
	return nil
}

func (c *Client) RespondPendingRaw(id string, result any) error {
	c.mu.Lock()
	pending := c.requests[id]
	if pending != nil {
		delete(c.requests, id)
	}
	c.mu.Unlock()
	if pending == nil {
		return fmt.Errorf("pending request not found")
	}
	if err := c.respond(pending.responseID, result); err != nil {
		return err
	}
	c.broadcast(Event{
		Method: "serverRequest/resolved",
		Params: map[string]any{
			"requestId": id,
			"threadId":  pending.ThreadID,
			"turnId":    pending.TurnID,
		},
	})
	return nil
}

func (c *Client) RespondPendingError(id string, code int, message string) error {
	c.mu.Lock()
	pending := c.requests[id]
	if pending != nil {
		delete(c.requests, id)
	}
	c.mu.Unlock()
	if pending == nil {
		return fmt.Errorf("pending request not found")
	}
	if code == 0 {
		code = -32603
	}
	if strings.TrimSpace(message) == "" {
		message = "request rejected"
	}
	if err := c.respondError(pending.responseID, code, message); err != nil {
		return err
	}
	c.broadcast(Event{
		Method: "serverRequest/resolved",
		Params: map[string]any{
			"requestId": id,
			"threadId":  pending.ThreadID,
			"turnId":    pending.TurnID,
		},
	})
	return nil
}

func threadParams(opts SendOptions) map[string]any {
	permissions := agentPermissions(opts.AgentMode, opts.CWD)
	params := map[string]any{
		"approvalPolicy":    permissions.ApprovalPolicy,
		"approvalsReviewer": permissions.ApprovalsReviewer,
		"sandbox":           permissions.Sandbox,
		"serviceName":       "Codex Web",
	}
	if opts.CWD != "" {
		params["cwd"] = opts.CWD
	}
	if opts.Model != "" {
		params["model"] = opts.Model
	}
	if opts.Reasoning != "" {
		params["config"] = map[string]any{
			"model_reasoning_effort": opts.Reasoning,
		}
	}
	return params
}

func turnParams(opts SendOptions) map[string]any {
	prompt := strings.TrimSpace(opts.Prompt)
	permissions := agentPermissions(opts.AgentMode, opts.CWD)
	params := map[string]any{
		"threadId":          opts.ThreadID,
		"input":             userInput(prompt, opts.Attachments),
		"approvalPolicy":    permissions.ApprovalPolicy,
		"approvalsReviewer": permissions.ApprovalsReviewer,
		"sandboxPolicy":     permissions.SandboxPolicy,
	}
	if opts.CWD != "" {
		params["cwd"] = opts.CWD
	}
	if opts.Model != "" {
		params["model"] = opts.Model
	}
	if opts.Reasoning != "" {
		params["effort"] = opts.Reasoning
	}
	if mode := collaborationMode(opts); mode != nil {
		params["collaborationMode"] = mode
	}
	return params
}

func steerParams(threadID, turnID, prompt string, attachments []InputAttachment) map[string]any {
	return map[string]any{
		"threadId":       threadID,
		"expectedTurnId": turnID,
		"input":          userInput(strings.TrimSpace(prompt), attachments),
	}
}

func collaborationMode(opts SendOptions) map[string]any {
	if strings.TrimSpace(opts.Model) == "" {
		return nil
	}
	mode := "default"
	if opts.PlanMode {
		mode = "plan"
	}
	return map[string]any{
		"mode": mode,
		"settings": map[string]any{
			"model":                  opts.Model,
			"reasoning_effort":       nullableString(opts.Reasoning),
			"developer_instructions": nil,
		},
	}
}

func nullableString(value string) any {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return value
}

type permissionParams struct {
	ApprovalPolicy    any
	ApprovalsReviewer string
	Sandbox           string
	SandboxPolicy     map[string]any
}

func agentPermissions(agentMode, cwd string) permissionParams {
	switch normalizeAgentMode(agentMode) {
	case "read-only":
		return readOnlyPermissions("on-request", "user")
	case "auto":
		return workspaceWritePermissions(cwd, "on-request", "user")
	case "granular":
		return workspaceWritePermissions(cwd, map[string]any{
			"granular": map[string]bool{
				"sandbox_approval":    false,
				"rules":               false,
				"skill_approval":      false,
				"request_permissions": true,
				"mcp_elicitations":    true,
			},
		}, "user")
	case "guardian-approvals":
		return workspaceWritePermissions(cwd, "on-request", "auto_review")
	case "full-access":
		fallthrough
	default:
		return permissionParams{
			ApprovalPolicy:    "never",
			ApprovalsReviewer: "user",
			Sandbox:           "danger-full-access",
			SandboxPolicy:     map[string]any{"type": "dangerFullAccess"},
		}
	}
}

func normalizeAgentMode(agentMode string) string {
	switch strings.TrimSpace(agentMode) {
	case "read-only", "auto", "granular", "guardian-approvals", "full-access":
		return strings.TrimSpace(agentMode)
	default:
		return "auto"
	}
}

func readOnlyPermissions(approvalPolicy any, reviewer string) permissionParams {
	return permissionParams{
		ApprovalPolicy:    approvalPolicy,
		ApprovalsReviewer: reviewer,
		Sandbox:           "read-only",
		SandboxPolicy: map[string]any{
			"type":          "readOnly",
			"networkAccess": false,
		},
	}
}

func workspaceWritePermissions(cwd string, approvalPolicy any, reviewer string) permissionParams {
	roots := []string{}
	cwd = strings.TrimSpace(cwd)
	if cwd != "" {
		roots = append(roots, cwd)
	}
	return permissionParams{
		ApprovalPolicy:    approvalPolicy,
		ApprovalsReviewer: reviewer,
		Sandbox:           "workspace-write",
		SandboxPolicy: map[string]any{
			"type":                "workspaceWrite",
			"writableRoots":       roots,
			"excludeSlashTmp":     false,
			"excludeTmpdirEnvVar": false,
			"networkAccess":       false,
		},
	}
}

func (p *PendingRequest) resultFor(req ResolveRequest) (any, error) {
	action := strings.TrimSpace(req.Action)
	if action == "" {
		action = "accept"
	}
	switch p.Method {
	case "item/commandExecution/requestApproval":
		return map[string]any{"decision": commandDecision(action, p.Params)}, nil
	case "item/fileChange/requestApproval":
		return map[string]any{"decision": fileDecision(action)}, nil
	case "item/permissions/requestApproval":
		scope := req.Scope
		if scope != "session" {
			scope = "turn"
		}
		if action == "decline" || action == "cancel" {
			return map[string]any{"permissions": map[string]any{}, "scope": "turn"}, nil
		}
		permissions, _ := p.Params["permissions"].(map[string]any)
		if permissions == nil {
			permissions = map[string]any{}
		}
		result := map[string]any{"permissions": permissions, "scope": scope}
		if req.StrictAutoReview != nil {
			result["strictAutoReview"] = *req.StrictAutoReview
		}
		return result, nil
	case "item/tool/requestUserInput":
		answers := map[string]any{}
		for id, value := range req.Answers {
			value = strings.TrimSpace(value)
			if value != "" {
				answers[id] = map[string]any{"answers": []string{value}}
			}
		}
		return map[string]any{"answers": answers}, nil
	case "mcpServer/elicitation/request":
		switch action {
		case "decline", "cancel":
			return map[string]any{"action": action, "content": nil, "_meta": nil}, nil
		default:
			return map[string]any{"action": "accept", "content": req.Content, "_meta": req.Meta}, nil
		}
	default:
		return nil, fmt.Errorf("unsupported pending request method %s", p.Method)
	}
}

func commandDecision(action string, params map[string]any) any {
	switch action {
	case "acceptForSession":
		return "acceptForSession"
	case "decline":
		return "decline"
	case "cancel":
		return "cancel"
	case "acceptWithExecpolicyAmendment":
		if amendment, ok := params["proposedExecpolicyAmendment"]; ok && amendment != nil {
			return map[string]any{"acceptWithExecpolicyAmendment": map[string]any{"execpolicy_amendment": amendment}}
		}
		return "acceptForSession"
	case "applyNetworkPolicyAmendment":
		if amendments, ok := params["proposedNetworkPolicyAmendments"].([]any); ok {
			for _, item := range amendments {
				if m, ok := item.(map[string]any); ok && m["action"] == "allow" {
					return map[string]any{"applyNetworkPolicyAmendment": map[string]any{"network_policy_amendment": m}}
				}
			}
		}
		return "acceptForSession"
	default:
		return "accept"
	}
}

func fileDecision(action string) string {
	switch action {
	case "acceptForSession":
		return "acceptForSession"
	case "decline":
		return "decline"
	case "cancel":
		return "cancel"
	default:
		return "accept"
	}
}

func (c *Client) request(ctx context.Context, method string, params any) (json.RawMessage, error) {
	id := c.nextID.Add(1)
	idRaw := json.RawMessage(fmt.Sprintf("%d", id))
	key := string(idRaw)
	ch := make(chan rpcMessage, 1)

	c.mu.Lock()
	c.pendingRPC[key] = ch
	c.mu.Unlock()

	if err := c.write(map[string]any{"id": id, "method": method, "params": params}); err != nil {
		c.mu.Lock()
		delete(c.pendingRPC, key)
		c.mu.Unlock()
		return nil, err
	}

	select {
	case msg := <-ch:
		if msg.Error != nil {
			return nil, fmt.Errorf("%s: %s", method, msg.Error.Message)
		}
		return msg.Result, nil
	case <-ctx.Done():
		c.mu.Lock()
		delete(c.pendingRPC, key)
		c.mu.Unlock()
		return nil, ctx.Err()
	case <-time.After(2 * time.Minute):
		c.mu.Lock()
		delete(c.pendingRPC, key)
		c.mu.Unlock()
		return nil, fmt.Errorf("%s timed out", method)
	}
}

func (c *Client) notify(method string, params any) error {
	return c.write(map[string]any{"method": method, "params": params})
}

func (c *Client) respond(id json.RawMessage, result any) error {
	return c.write(map[string]any{"id": json.RawMessage(id), "result": result})
}

func (c *Client) respondError(id json.RawMessage, code int, message string) error {
	return c.write(map[string]any{
		"id": json.RawMessage(id),
		"error": map[string]any{
			"code":    code,
			"message": message,
		},
	})
}

func (c *Client) write(msg any) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	if c.stdin == nil {
		if c.ws == nil {
			return errors.New("codex app-server is not running")
		}
		return c.ws.sendText(data)
	}
	_, err = c.stdin.Write(append(data, '\n'))
	return err
}

func (c *Client) readLoop(reader io.Reader) {
	scanner := bufio.NewScanner(reader)
	scanner.Buffer(make([]byte, 0, 64*1024), 16*1024*1024)
	for scanner.Scan() {
		line := bytes.TrimSpace(scanner.Bytes())
		if len(line) == 0 {
			continue
		}
		c.handleRawMessage(line)
	}
	c.closePending(errors.New("codex app-server output closed"))
}

func (c *Client) readWebSocketLoop(ws *websocketConn) {
	for {
		data, err := ws.readMessage()
		if err != nil {
			c.closePending(err)
			return
		}
		c.handleRawMessage(bytes.TrimSpace(data))
	}
}

func (c *Client) handleRawMessage(data []byte) {
	if len(data) == 0 {
		return
	}
	var msg rpcMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		return
	}
	if len(msg.ID) > 0 && msg.Method == "" {
		c.resolveRPC(msg)
		return
	}
	if len(msg.ID) > 0 && msg.Method != "" {
		c.handleServerRequest(msg)
		return
	}
	if msg.Method != "" {
		c.handleNotification(msg)
	}
}

func (c *Client) resolveRPC(msg rpcMessage) {
	key := string(msg.ID)
	c.mu.Lock()
	ch := c.pendingRPC[key]
	delete(c.pendingRPC, key)
	c.mu.Unlock()
	if ch != nil {
		ch <- msg
	}
}

func (c *Client) handleNotification(msg rpcMessage) {
	params := map[string]any{}
	if len(msg.Params) > 0 {
		_ = json.Unmarshal(msg.Params, &params)
	}
	c.broadcast(Event{Method: msg.Method, Params: params})
}

func (c *Client) handleServerRequest(msg rpcMessage) {
	params := map[string]any{}
	if len(msg.Params) > 0 {
		_ = json.Unmarshal(msg.Params, &params)
	}
	req := newPendingRequest(msg.Method, msg.ID, params)
	c.mu.Lock()
	c.requests[req.ID] = req
	c.mu.Unlock()
	c.broadcast(Event{Method: "serverRequest/pending", Params: map[string]any{
		"request": req.publicMap(),
	}})
	c.broadcast(Event{Method: "appserver/request", Params: map[string]any{
		"hostId": "local",
		"request": map[string]any{
			"id":     req.ID,
			"method": msg.Method,
			"params": params,
		},
	}})
}

func newPendingRequest(method string, responseID json.RawMessage, params map[string]any) *PendingRequest {
	kind := "approval"
	title := "批准请求"
	switch method {
	case "item/commandExecution/requestApproval":
		kind = "command"
		title = "运行命令？"
	case "item/fileChange/requestApproval":
		kind = "file"
		title = "应用更改？"
	case "item/permissions/requestApproval":
		kind = "permissions"
		title = "允许额外访问？"
	case "item/tool/requestUserInput":
		kind = "userInput"
		title = "Codex 需要你输入"
	case "mcpServer/elicitation/request":
		kind = "mcpElicitation"
		title = "MCP 需要你输入"
	}

	command := str(params["command"])
	if command == "" {
		if list, ok := params["command"].([]any); ok {
			parts := make([]string, 0, len(list))
			for _, item := range list {
				parts = append(parts, fmt.Sprint(item))
			}
			command = strings.Join(parts, " ")
		}
	}
	req := &PendingRequest{
		ID:         randomID(12),
		Method:     method,
		Kind:       kind,
		ThreadID:   firstString(str(params["threadId"]), str(params["conversationId"])),
		TurnID:     str(params["turnId"]),
		ItemID:     firstString(str(params["itemId"]), str(params["callId"])),
		Title:      title,
		Reason:     str(params["reason"]),
		Command:    command,
		CWD:        str(params["cwd"]),
		Params:     params,
		CreatedAt:  time.Now().UTC().Format(time.RFC3339Nano),
		responseID: responseID,
	}
	return req
}

func (p PendingRequest) publicMap() map[string]any {
	return map[string]any{
		"id":        p.ID,
		"method":    p.Method,
		"kind":      p.Kind,
		"threadId":  p.ThreadID,
		"turnId":    p.TurnID,
		"itemId":    p.ItemID,
		"title":     p.Title,
		"reason":    p.Reason,
		"command":   p.Command,
		"cwd":       p.CWD,
		"params":    p.Params,
		"createdAt": p.CreatedAt,
	}
}

func (c *Client) broadcast(event Event) {
	c.mu.Lock()
	subscribers := make([]chan Event, 0, len(c.subscribers))
	for _, ch := range c.subscribers {
		subscribers = append(subscribers, ch)
	}
	c.mu.Unlock()
	for _, ch := range subscribers {
		select {
		case ch <- event:
		default:
		}
	}
}

func (c *Client) closePending(err error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for key, ch := range c.pendingRPC {
		delete(c.pendingRPC, key)
		ch <- rpcMessage{Error: &rpcError{Code: -1, Message: err.Error()}}
	}
}

func (c *Client) logStderr(reader io.Reader) {
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		log.Printf("codex app-server: %s", scanner.Text())
	}
}

func randomID(byteCount int) string {
	buf := make([]byte, byteCount)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return base64.RawURLEncoding.EncodeToString(buf)
}

func str(value any) string {
	switch v := value.(type) {
	case string:
		return v
	default:
		return ""
	}
}

func firstString(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
