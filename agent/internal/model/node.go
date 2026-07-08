package model

import "time"

type AgentHello struct {
	NodeID       string   `json:"nodeId"`
	Name         string   `json:"name"`
	Hostname     string   `json:"hostname"`
	RootDir      string   `json:"rootDir"`
	CodexHome    string   `json:"codexHome"`
	Version      string   `json:"version"`
	Capabilities []string `json:"capabilities,omitempty"`
}

type AgentEnvelope struct {
	Type      string         `json:"type"`
	RequestID string         `json:"requestId,omitempty"`
	NodeID    string         `json:"nodeId,omitempty"`
	Hello     *AgentHello    `json:"hello,omitempty"`
	Op        string         `json:"op,omitempty"`
	Params    map[string]any `json:"params,omitempty"`
	Result    any            `json:"result,omitempty"`
	Error     string         `json:"error,omitempty"`
	Event     *AgentEvent    `json:"event,omitempty"`
}

type AgentEvent struct {
	Method string         `json:"method"`
	Params map[string]any `json:"params"`
}

type SessionRecord struct {
	ID            string    `json:"id"`
	CodexThreadID string    `json:"codexThreadId,omitempty"`
	Title         string    `json:"title"`
	CWD           string    `json:"cwd"`
	Status        string    `json:"status"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
	LastSeq       int64     `json:"lastSeq"`
}

type SessionEvent struct {
	SessionID string         `json:"sessionId"`
	Seq       int64          `json:"seq"`
	Time      time.Time      `json:"time"`
	Kind      string         `json:"kind"`
	Text      string         `json:"text,omitempty"`
	Inline    bool           `json:"inline,omitempty"`
	Data      map[string]any `json:"data,omitempty"`
}

type SessionCreateRequest struct {
	Prompt string `json:"prompt"`
	CWD    string `json:"cwd,omitempty"`
}

type SessionSendRequest struct {
	SessionID string `json:"sessionId"`
	Prompt    string `json:"prompt"`
}

type SessionCancelRequest struct {
	SessionID string `json:"sessionId"`
}

type SessionEventsRequest struct {
	SessionID   string `json:"sessionId"`
	LastSeq     int64  `json:"lastSeq"`
	BeforeSeq   int64  `json:"beforeSeq,omitempty"`
	Limit       int    `json:"limit,omitempty"`
	Compact     bool   `json:"compact,omitempty"`
	FileDetails bool   `json:"fileDetails,omitempty"`
}

type SessionEventsPage struct {
	Events        []SessionEvent `json:"events"`
	FirstSeq      int64          `json:"firstSeq"`
	LastSeq       int64          `json:"lastSeq"`
	HasMoreBefore bool           `json:"hasMoreBefore"`
}
