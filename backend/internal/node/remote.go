package node

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"codex-web/backend/internal/model"
	"github.com/gorilla/websocket"
)

type Remote struct {
	info model.NodeInfo
	conn *websocket.Conn

	registry *Registry

	nextID atomic.Int64

	mu          sync.Mutex
	closed      bool
	pending     map[string]chan model.AgentEnvelope
	subscribers map[int]chan Event
	nextSubID   int
	writeMu     sync.Mutex
}

func NewRemote(info model.NodeInfo, conn *websocket.Conn, registry *Registry) *Remote {
	info.Kind = "remote"
	info.Online = true
	info.LastSeen = time.Now().UTC()
	return &Remote{
		info:        info,
		conn:        conn,
		registry:    registry,
		pending:     map[string]chan model.AgentEnvelope{},
		subscribers: map[int]chan Event{},
	}
}

func (r *Remote) Info() model.NodeInfo {
	r.mu.Lock()
	defer r.mu.Unlock()
	info := r.info
	info.Online = !r.closed
	return info
}

func (r *Remote) Online() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return !r.closed
}

func (r *Remote) Serve() {
	defer func() {
		_ = r.Close()
		if r.registry != nil {
			_ = r.registry.MarkOffline(r.info.ID, r)
		}
	}()
	for {
		var msg model.AgentEnvelope
		if err := r.conn.ReadJSON(&msg); err != nil {
			return
		}
		switch msg.Type {
		case "agent.response":
			r.resolve(msg)
		case "agent.event":
			if msg.Event != nil {
				r.broadcast(Event{Method: msg.Event.Method, Params: msg.Event.Params})
			}
		case "agent.heartbeat":
			r.touch()
		}
	}
}

func (r *Remote) Request(ctx context.Context, op string, params map[string]any) (any, error) {
	return r.request(ctx, op, params)
}

func (r *Remote) Subscribe() (<-chan Event, func()) {
	ch := make(chan Event, 128)
	r.mu.Lock()
	id := r.nextSubID
	r.nextSubID++
	r.subscribers[id] = ch
	r.mu.Unlock()
	return ch, func() {
		r.mu.Lock()
		delete(r.subscribers, id)
		close(ch)
		r.mu.Unlock()
	}
}

func (r *Remote) Close() error {
	r.mu.Lock()
	if r.closed {
		r.mu.Unlock()
		return nil
	}
	r.closed = true
	pending := r.pending
	r.pending = map[string]chan model.AgentEnvelope{}
	r.mu.Unlock()
	for _, ch := range pending {
		ch <- model.AgentEnvelope{Type: "agent.response", Error: "agent disconnected"}
	}
	return r.conn.Close()
}

func (r *Remote) request(ctx context.Context, op string, params map[string]any) (any, error) {
	if !r.Online() {
		return nil, errors.New("node is offline")
	}
	requestID := fmt.Sprintf("%d", r.nextID.Add(1))
	ch := make(chan model.AgentEnvelope, 1)
	r.mu.Lock()
	r.pending[requestID] = ch
	r.mu.Unlock()
	msg := model.AgentEnvelope{
		Type:      "controller.request",
		RequestID: requestID,
		NodeID:    r.info.ID,
		Op:        op,
		Params:    params,
	}
	if err := r.write(msg); err != nil {
		r.mu.Lock()
		delete(r.pending, requestID)
		r.mu.Unlock()
		return nil, err
	}
	select {
	case response := <-ch:
		if response.Error != "" {
			return nil, errors.New(response.Error)
		}
		return response.Result, nil
	case <-ctx.Done():
		r.mu.Lock()
		delete(r.pending, requestID)
		r.mu.Unlock()
		return nil, ctx.Err()
	case <-time.After(2 * time.Minute):
		r.mu.Lock()
		delete(r.pending, requestID)
		r.mu.Unlock()
		return nil, fmt.Errorf("%s timed out", op)
	}
}

func (r *Remote) write(msg model.AgentEnvelope) error {
	r.writeMu.Lock()
	defer r.writeMu.Unlock()
	return r.conn.WriteJSON(msg)
}

func (r *Remote) resolve(msg model.AgentEnvelope) {
	r.mu.Lock()
	ch := r.pending[msg.RequestID]
	delete(r.pending, msg.RequestID)
	r.mu.Unlock()
	if ch != nil {
		ch <- msg
	}
}

func (r *Remote) touch() {
	r.mu.Lock()
	r.info.LastSeen = time.Now().UTC()
	r.mu.Unlock()
	if r.registry != nil {
		_ = r.registry.Touch(r.info.ID)
	}
}

func (r *Remote) broadcast(event Event) {
	r.mu.Lock()
	subscribers := make([]chan Event, 0, len(r.subscribers))
	for _, ch := range r.subscribers {
		subscribers = append(subscribers, ch)
	}
	r.mu.Unlock()
	for _, ch := range subscribers {
		select {
		case ch <- event:
		default:
		}
	}
}
