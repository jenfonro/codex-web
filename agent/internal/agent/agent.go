package agent

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"codex-web/agent/internal/config"
	"codex-web/agent/internal/host"
	"codex-web/agent/internal/model"
	"codex-web/agent/internal/session"
	"github.com/gorilla/websocket"
)

type Agent struct {
	cfg      config.Agent
	hostsvc  *host.Service
	sessions *session.Manager
	conn     *websocket.Conn
	writeMu  sync.Mutex
}

func New(cfg config.Agent) (*Agent, error) {
	agent := &Agent{
		cfg:     cfg,
		hostsvc: host.New(cfg.RootDir, cfg.CodexHome),
		sessions: session.New(session.Config{
			CodexBin:  cfg.CodexBin,
			CodexHome: cfg.CodexHome,
			RootDir:   cfg.RootDir,
		}),
	}
	return agent, nil
}

func (a *Agent) Run(ctx context.Context) error {
	for {
		if err := a.connectAndServe(ctx); err != nil {
			log.Printf("agent connection ended: %v", err)
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(3 * time.Second):
		}
	}
}

func (a *Agent) connectAndServe(ctx context.Context) error {
	header := http.Header{}
	header.Set("Authorization", "Bearer "+a.cfg.Token)
	conn, _, err := websocket.DefaultDialer.DialContext(ctx, a.cfg.ControllerURL, header)
	if err != nil {
		return err
	}
	connCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	a.conn = conn
	defer conn.Close()
	if err := a.write(a.hello()); err != nil {
		return err
	}
	done := make(chan error, 1)
	go func() { done <- a.readLoop(connCtx) }()
	go a.forwardEvents(connCtx)
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case err := <-done:
			return err
		case <-ticker.C:
			if err := a.write(model.AgentEnvelope{Type: "agent.heartbeat", NodeID: a.cfg.ID}); err != nil {
				return err
			}
		}
	}
}

func (a *Agent) hello() model.AgentEnvelope {
	hostname, _ := os.Hostname()
	return model.AgentEnvelope{
		Type:   "agent.hello",
		NodeID: a.cfg.ID,
		Hello: &model.AgentHello{
			NodeID:       a.cfg.ID,
			Name:         a.cfg.Name,
			Hostname:     hostname,
			RootDir:      a.cfg.RootDir,
			CodexHome:    a.cfg.CodexHome,
			Version:      "0.1.0",
			Capabilities: []string{"cli", "session", "workspace", "git"},
		},
	}
}

func (a *Agent) readLoop(ctx context.Context) error {
	for {
		var msg model.AgentEnvelope
		if err := a.conn.ReadJSON(&msg); err != nil {
			return err
		}
		if msg.Type != "controller.request" {
			continue
		}
		go a.handleRequest(ctx, msg)
	}
}

func (a *Agent) handleRequest(ctx context.Context, msg model.AgentEnvelope) {
	response := model.AgentEnvelope{
		Type:      "agent.response",
		RequestID: msg.RequestID,
		NodeID:    a.cfg.ID,
	}
	result, err := a.handle(ctx, msg)
	if err != nil {
		response.Error = err.Error()
	} else {
		response.Result = result
	}
	if err := a.write(response); err != nil {
		log.Printf("agent response failed: %v", err)
	}
}

func (a *Agent) handle(ctx context.Context, msg model.AgentEnvelope) (any, error) {
	switch msg.Op {
	case "session.list":
		return map[string]any{"sessions": a.sessions.List()}, nil
	case "session.create":
		var req model.SessionCreateRequest
		if err := decodeParams(msg.Params, &req); err != nil {
			return nil, err
		}
		record, err := a.sessions.Create(ctx, req)
		if err != nil {
			return nil, err
		}
		return map[string]any{"session": record}, nil
	case "session.send":
		var req model.SessionSendRequest
		if err := decodeParams(msg.Params, &req); err != nil {
			return nil, err
		}
		record, err := a.sessions.Send(ctx, req)
		if err != nil {
			return nil, err
		}
		return map[string]any{"session": record}, nil
	case "session.cancel":
		var req model.SessionCancelRequest
		if err := decodeParams(msg.Params, &req); err != nil {
			return nil, err
		}
		return map[string]bool{"ok": true}, a.sessions.Cancel(req.SessionID)
	case "session.events":
		var req model.SessionEventsRequest
		if err := decodeParams(msg.Params, &req); err != nil {
			return nil, err
		}
		page, err := a.sessions.Events(req)
		if err != nil {
			return nil, err
		}
		return page, nil
	case "workspace.fetch":
		endpoint := host.StrAny(msg.Params["endpoint"])
		value, handled, err := a.hostsvc.Fetch(ctx, endpoint, msg.Params)
		if err != nil {
			return nil, err
		}
		if !handled {
			return map[string]any{}, nil
		}
		return value, nil
	case "git.request":
		method := host.StrAny(msg.Params["method"])
		return a.hostsvc.GitWorker(ctx, method, msg.Params)
	default:
		return nil, &unknownOpError{op: msg.Op}
	}
}

func (a *Agent) forwardEvents(ctx context.Context) {
	events, unsubscribe := a.sessions.Subscribe()
	defer unsubscribe()
	for {
		select {
		case <-ctx.Done():
			return
		case event, ok := <-events:
			if !ok {
				return
			}
			msg := model.AgentEnvelope{
				Type:   "agent.event",
				NodeID: a.cfg.ID,
				Event:  &model.AgentEvent{Method: "session.event", Params: sessionEventParams(event)},
			}
			if err := a.write(msg); err != nil {
				return
			}
		}
	}
}

func (a *Agent) write(msg model.AgentEnvelope) error {
	a.writeMu.Lock()
	defer a.writeMu.Unlock()
	return a.conn.WriteJSON(msg)
}

type unknownOpError struct {
	op string
}

func (e *unknownOpError) Error() string {
	return "unknown agent operation: " + e.op
}

func decodeParams(params map[string]any, target any) error {
	data, err := json.Marshal(params)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, target)
}

func sessionEventParams(event model.SessionEvent) map[string]any {
	data, _ := json.Marshal(event)
	var out map[string]any
	_ = json.Unmarshal(data, &out)
	return out
}
