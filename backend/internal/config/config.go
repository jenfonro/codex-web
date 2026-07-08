package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type App struct {
	Addr      string
	DataDir   string
	CodexHome string
	RootDir   string
	CodexBin  string
}

func Load() (App, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return App{}, fmt.Errorf("resolve user home: %w", err)
	}
	cfg := App{
		Addr:      getenv("CODEX_WEB_ADDR", "127.0.0.1:58888"),
		DataDir:   getenv("CODEX_WEB_DATA", "./data"),
		CodexHome: getenv("CODEX_HOME", filepath.Join(home, ".codex")),
		RootDir:   getenv("CODEX_WEB_ROOT", home),
		CodexBin:  getenv("CODEX_WEB_CODEX_BIN", "codex"),
	}
	return cfg, nil
}

func getenv(key, defaultValue string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return defaultValue
	}
	return value
}
