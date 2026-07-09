package model

import "time"

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
	SessionID string           `json:"sessionId"`
	Seq       int64            `json:"seq"`
	Time      time.Time        `json:"time"`
	Kind      string           `json:"kind"`
	Text      string           `json:"text,omitempty"`
	Items     []map[string]any `json:"items,omitempty"`
	Data      map[string]any   `json:"data,omitempty"`
}

type SessionState struct {
	Session SessionRecord `json:"session"`
	Turns   []SessionTurn `json:"turns"`
	LastSeq int64         `json:"lastSeq"`
}

type SessionTurn struct {
	ID          string         `json:"id"`
	Status      string         `json:"status"`
	StartedAt   *time.Time     `json:"startedAt,omitempty"`
	CompletedAt *time.Time     `json:"completedAt,omitempty"`
	DurationMs  *int64         `json:"durationMs,omitempty"`
	Error       map[string]any `json:"error,omitempty"`
	Outcome     *TurnOutcome   `json:"outcome,omitempty"`
	Items       []SessionItem  `json:"items"`
}

type TurnOutcome struct {
	Type   string         `json:"type"`
	Text   string         `json:"text"`
	Status string         `json:"status,omitempty"`
	Raw    map[string]any `json:"raw,omitempty"`
}

type SessionItem struct {
	ID      string           `json:"id"`
	Type    string           `json:"type"`
	Status  string           `json:"status,omitempty"`
	Time    time.Time        `json:"time,omitempty"`
	Text    string           `json:"text,omitempty"`
	Output  string           `json:"output,omitempty"`
	Command string           `json:"command,omitempty"`
	CWD     string           `json:"cwd,omitempty"`
	Phase   string           `json:"phase,omitempty"`
	Server  string           `json:"server,omitempty"`
	Tool    string           `json:"tool,omitempty"`
	Name    string           `json:"name,omitempty"`
	Items   []map[string]any `json:"items,omitempty"`
	Raw     map[string]any   `json:"raw,omitempty"`
}

type SessionStateUpdate struct {
	SessionID string         `json:"sessionId"`
	Seq       int64          `json:"seq"`
	Time      time.Time      `json:"time"`
	Type      string         `json:"type"`
	Session   *SessionRecord `json:"session,omitempty"`
	State     *SessionState  `json:"state,omitempty"`
	Turn      *SessionTurn   `json:"turn,omitempty"`
	Item      *SessionItem   `json:"item,omitempty"`
	Error     string         `json:"error,omitempty"`
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
	SessionID string `json:"sessionId"`
	LastSeq   int64  `json:"lastSeq"`
	BeforeSeq int64  `json:"beforeSeq,omitempty"`
	Limit     int    `json:"limit,omitempty"`
}

type SessionEventsPage struct {
	Events        []SessionEvent `json:"events"`
	FirstSeq      int64          `json:"firstSeq"`
	LastSeq       int64          `json:"lastSeq"`
	HasMoreBefore bool           `json:"hasMoreBefore"`
}
