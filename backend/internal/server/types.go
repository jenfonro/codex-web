package server

type apiError struct {
	Error string `json:"error"`
}

type authStatus struct {
	Authenticated bool   `json:"authenticated"`
	PasswordHint  string `json:"passwordHint,omitempty"`
}

type loginRequest struct {
	Password string `json:"password"`
}

type appConfig struct {
	Addr                string
	CodexHome           string
	RootDir             string
	DataDir             string
	CodexBin            string
	AppServerEndpoint   string
	Password            string
	PasswordIsGenerated bool
}

type reasoningEffortSummary struct {
	ReasoningEffort string `json:"reasoningEffort"`
	Description     string `json:"description,omitempty"`
}
