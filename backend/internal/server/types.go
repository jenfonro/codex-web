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
	DataDir             string
	Password            string
	PasswordIsGenerated bool
	AgentToken          string
	AgentTokenGenerated bool
}
