package appserver

import "encoding/json"

type Config struct {
	CodexBin  string
	CodexHome string
	RootDir   string
}

type RPCError struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data,omitempty"`
}

func (e *RPCError) Error() string {
	if e == nil {
		return ""
	}
	return e.Message
}

type Notification struct {
	Method    string         `json:"method"`
	Params    map[string]any `json:"params,omitempty"`
	RequestID string         `json:"requestId,omitempty"`
	IsRequest bool           `json:"isRequest,omitempty"`
}

type ThreadStatus struct {
	Type        string   `json:"type"`
	ActiveFlags []string `json:"activeFlags,omitempty"`
}

type Thread struct {
	ID            string       `json:"id"`
	SessionID     string       `json:"sessionId"`
	Preview       string       `json:"preview"`
	Name          *string      `json:"name"`
	CWD           string       `json:"cwd"`
	ModelProvider string       `json:"modelProvider"`
	Source        string       `json:"source"`
	ThreadSource  *string      `json:"threadSource"`
	Status        ThreadStatus `json:"status"`
	CreatedAt     int64        `json:"createdAt"`
	UpdatedAt     int64        `json:"updatedAt"`
	RecencyAt     *int64       `json:"recencyAt"`
	Turns         []Turn       `json:"turns"`
}

type Turn struct {
	ID          string           `json:"id"`
	Items       []map[string]any `json:"items"`
	Status      string           `json:"status"`
	StartedAt   *int64           `json:"startedAt"`
	CompletedAt *int64           `json:"completedAt"`
	DurationMs  *int64           `json:"durationMs"`
	Error       map[string]any   `json:"error"`
}

type ThreadListResponse struct {
	Data            []Thread `json:"data"`
	NextCursor      *string  `json:"nextCursor"`
	BackwardsCursor *string  `json:"backwardsCursor"`
}

type ThreadReadResponse struct {
	Thread Thread `json:"thread"`
}

type ThreadStartResponse struct {
	Thread Thread `json:"thread"`
}

type ThreadResumeResponse struct {
	Thread Thread `json:"thread"`
}

type TurnStartResponse struct {
	Turn Turn `json:"turn"`
}
