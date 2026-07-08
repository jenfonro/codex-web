package server

type apiError struct {
	Error string `json:"error"`
}

type appConfig struct {
	Addr      string
	DataDir   string
	CodexHome string
	RootDir   string
	CodexBin  string
}
