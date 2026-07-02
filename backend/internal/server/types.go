package server

type apiError struct {
	Error string `json:"error"`
}

type appConfig struct {
	Addr                string
	DataDir             string
	AgentToken          string
	AgentTokenGenerated bool
}
