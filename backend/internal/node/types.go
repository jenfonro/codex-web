package node

import (
	"context"

	"codex-web/backend/internal/model"
)

type Event struct {
	Method string         `json:"method"`
	Params map[string]any `json:"params"`
}

type Client interface {
	Info() model.NodeInfo
	Online() bool
	Request(ctx context.Context, op string, params map[string]any) (any, error)
	Subscribe() (<-chan Event, func())
	Close() error
}
