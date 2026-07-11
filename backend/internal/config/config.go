package config

import (
	"os"
)

type App struct {
	Addr      string
	CodexHome string
	RootDir   string
	CodexBin  string
}

func Load() App {
	return App{
		Addr:      os.Getenv("CODEX_WEB_ADDR"),
		CodexHome: os.Getenv("CODEX_HOME"),
		RootDir:   os.Getenv("CODEX_WEB_ROOT"),
		CodexBin:  os.Getenv("CODEX_WEB_CODEX_BIN"),
	}
}
