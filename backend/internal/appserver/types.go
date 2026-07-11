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
	return e.Message
}

type Notification struct {
	Method string
	Params json.RawMessage
}

type ThreadStatus struct {
	Type        string    `json:"type"`
	ActiveFlags *[]string `json:"activeFlags,omitempty"`
}

type Thread struct {
	ID             string          `json:"id"`
	Extra          json.RawMessage `json:"extra"`
	SessionID      string          `json:"sessionId"`
	ForkedFromID   *string         `json:"forkedFromId"`
	ParentThreadID *string         `json:"parentThreadId"`
	Preview        string          `json:"preview"`
	Ephemeral      bool            `json:"ephemeral"`
	HistoryMode    string          `json:"historyMode"`
	ModelProvider  string          `json:"modelProvider"`
	CreatedAt      int64           `json:"createdAt"`
	UpdatedAt      int64           `json:"updatedAt"`
	RecencyAt      *int64          `json:"recencyAt"`
	Status         ThreadStatus    `json:"status"`
	Path           *string         `json:"path"`
	CWD            string          `json:"cwd"`
	CLIVersion     string          `json:"cliVersion"`
	Source         json.RawMessage `json:"source"`
	ThreadSource   *string         `json:"threadSource"`
	AgentNickname  *string         `json:"agentNickname"`
	AgentRole      *string         `json:"agentRole"`
	GitInfo        *GitInfo        `json:"gitInfo"`
	Name           *string         `json:"name"`
	Turns          []Turn          `json:"turns"`
}

type Turn struct {
	ID          string            `json:"id"`
	Items       []json.RawMessage `json:"items"`
	ItemsView   string            `json:"itemsView"`
	Status      string            `json:"status"`
	Error       *TurnError        `json:"error"`
	StartedAt   *int64            `json:"startedAt"`
	CompletedAt *int64            `json:"completedAt"`
	DurationMs  *int64            `json:"durationMs"`
}

type GitInfo struct {
	SHA       *string `json:"sha"`
	Branch    *string `json:"branch"`
	OriginURL *string `json:"originUrl"`
}

type TurnError struct {
	Message           string          `json:"message"`
	CodexErrorInfo    json.RawMessage `json:"codexErrorInfo"`
	AdditionalDetails *string         `json:"additionalDetails"`
}

type ThreadStartedNotification struct {
	Thread Thread `json:"thread"`
}

type ThreadStatusChangedNotification struct {
	ThreadID string       `json:"threadId"`
	Status   ThreadStatus `json:"status"`
}

type ThreadNameUpdatedNotification struct {
	ThreadID   string  `json:"threadId"`
	ThreadName *string `json:"threadName"`
}

type TurnStartedNotification struct {
	ThreadID string `json:"threadId"`
	Turn     Turn   `json:"turn"`
}

type TurnCompletedNotification struct {
	ThreadID string `json:"threadId"`
	Turn     Turn   `json:"turn"`
}

type ItemStartedNotification struct {
	ThreadID    string          `json:"threadId"`
	TurnID      string          `json:"turnId"`
	Item        json.RawMessage `json:"item"`
	StartedAtMs int64           `json:"startedAtMs"`
}

type ItemCompletedNotification struct {
	ThreadID      string          `json:"threadId"`
	TurnID        string          `json:"turnId"`
	Item          json.RawMessage `json:"item"`
	CompletedAtMs int64           `json:"completedAtMs"`
}

type ItemDeltaNotification struct {
	ThreadID string `json:"threadId"`
	TurnID   string `json:"turnId"`
	ItemID   string `json:"itemId"`
	Delta    string `json:"delta"`
}

type ReasoningSummaryDeltaNotification struct {
	ThreadID     string `json:"threadId"`
	TurnID       string `json:"turnId"`
	ItemID       string `json:"itemId"`
	Delta        string `json:"delta"`
	SummaryIndex int    `json:"summaryIndex"`
}

type ReasoningSummaryPartAddedNotification struct {
	ThreadID     string `json:"threadId"`
	TurnID       string `json:"turnId"`
	ItemID       string `json:"itemId"`
	SummaryIndex int    `json:"summaryIndex"`
}

type ReasoningTextDeltaNotification struct {
	ThreadID     string `json:"threadId"`
	TurnID       string `json:"turnId"`
	ItemID       string `json:"itemId"`
	Delta        string `json:"delta"`
	ContentIndex int    `json:"contentIndex"`
}

type ThreadItemHeader struct {
	ID   string `json:"id"`
	Type string `json:"type"`
}

type ThreadListResponse struct {
	Data            []Thread `json:"data"`
	NextCursor      *string  `json:"nextCursor"`
	BackwardsCursor *string  `json:"backwardsCursor"`
}

type ThreadListParams struct {
	Cursor        *string  `json:"cursor"`
	Limit         int      `json:"limit"`
	SortKey       string   `json:"sortKey"`
	SortDirection string   `json:"sortDirection"`
	Archived      bool     `json:"archived"`
	SourceKinds   []string `json:"sourceKinds"`
}

type ThreadReadParams struct {
	ThreadID     string `json:"threadId"`
	IncludeTurns bool   `json:"includeTurns"`
}

type ThreadStartParams struct {
	CWD          string `json:"cwd"`
	ThreadSource string `json:"threadSource"`
}

type ThreadResumeParams struct {
	ThreadID string `json:"threadId"`
	CWD      string `json:"cwd"`
}

type TextInput struct {
	Type         string     `json:"type"`
	Text         string     `json:"text"`
	TextElements []struct{} `json:"text_elements"`
}

type TurnStartParams struct {
	ThreadID string      `json:"threadId"`
	CWD      string      `json:"cwd"`
	Input    []TextInput `json:"input"`
}

type TurnInterruptParams struct {
	ThreadID string `json:"threadId"`
	TurnID   string `json:"turnId"`
}

type ClientInfo struct {
	Name    string `json:"name"`
	Title   string `json:"title"`
	Version string `json:"version"`
}

type ClientCapabilities struct {
	ExperimentalAPI                bool     `json:"experimentalApi"`
	RequestAttestation             bool     `json:"requestAttestation"`
	MCPServerOpenAIFormElicitation bool     `json:"mcpServerOpenaiFormElicitation"`
	OptOutNotificationMethods      []string `json:"optOutNotificationMethods"`
}

type InitializeParams struct {
	ClientInfo   ClientInfo         `json:"clientInfo"`
	Capabilities ClientCapabilities `json:"capabilities"`
}

type ThreadReadResponse struct {
	Thread Thread `json:"thread"`
}

type ThreadStartResponse struct {
	Thread                  Thread          `json:"thread"`
	Model                   string          `json:"model"`
	ModelProvider           string          `json:"modelProvider"`
	ServiceTier             *string         `json:"serviceTier"`
	CWD                     string          `json:"cwd"`
	RuntimeWorkspaceRoots   []string        `json:"runtimeWorkspaceRoots"`
	InstructionSources      []string        `json:"instructionSources"`
	ApprovalPolicy          json.RawMessage `json:"approvalPolicy"`
	ApprovalsReviewer       json.RawMessage `json:"approvalsReviewer"`
	Sandbox                 json.RawMessage `json:"sandbox"`
	ActivePermissionProfile json.RawMessage `json:"activePermissionProfile"`
	ReasoningEffort         json.RawMessage `json:"reasoningEffort"`
	MultiAgentMode          json.RawMessage `json:"multiAgentMode"`
}

type ThreadResumeResponse struct {
	Thread                  Thread          `json:"thread"`
	Model                   string          `json:"model"`
	ModelProvider           string          `json:"modelProvider"`
	ServiceTier             *string         `json:"serviceTier"`
	CWD                     string          `json:"cwd"`
	RuntimeWorkspaceRoots   []string        `json:"runtimeWorkspaceRoots"`
	InstructionSources      []string        `json:"instructionSources"`
	ApprovalPolicy          json.RawMessage `json:"approvalPolicy"`
	ApprovalsReviewer       json.RawMessage `json:"approvalsReviewer"`
	Sandbox                 json.RawMessage `json:"sandbox"`
	ActivePermissionProfile json.RawMessage `json:"activePermissionProfile"`
	ReasoningEffort         json.RawMessage `json:"reasoningEffort"`
	MultiAgentMode          json.RawMessage `json:"multiAgentMode"`
	InitialTurnsPage        json.RawMessage `json:"initialTurnsPage"`
}

type TurnStartResponse struct {
	Turn Turn `json:"turn"`
}
