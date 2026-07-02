package config

import (
	"fmt"
	"os"
	"strings"
)

type Agent struct {
	ControllerURL string
	ID            string
	Name          string
	Token         string
	CodexHome     string
	RootDir       string
	CodexBin      string
}

func LoadAgent() (Agent, error) {
	cfg := Agent{
		ControllerURL: strings.TrimSpace(os.Getenv("CODEX_AGENT_CONTROLLER")),
		ID:            strings.TrimSpace(os.Getenv("CODEX_AGENT_ID")),
		Name:          strings.TrimSpace(os.Getenv("CODEX_AGENT_NAME")),
		Token:         strings.TrimSpace(os.Getenv("CODEX_AGENT_TOKEN")),
		CodexHome:     strings.TrimSpace(os.Getenv("CODEX_HOME")),
		RootDir:       strings.TrimSpace(os.Getenv("CODEX_AGENT_ROOT")),
		CodexBin:      strings.TrimSpace(os.Getenv("CODEX_AGENT_CODEX_BIN")),
	}
	if cfg.ControllerURL == "" {
		return cfg, fmt.Errorf("CODEX_AGENT_CONTROLLER is required")
	}
	if cfg.ID == "" {
		return cfg, fmt.Errorf("CODEX_AGENT_ID is required")
	}
	if cfg.Name == "" {
		return cfg, fmt.Errorf("CODEX_AGENT_NAME is required")
	}
	if cfg.Token == "" {
		return cfg, fmt.Errorf("CODEX_AGENT_TOKEN is required")
	}
	if cfg.CodexHome == "" {
		return cfg, fmt.Errorf("CODEX_HOME is required")
	}
	if cfg.RootDir == "" {
		return cfg, fmt.Errorf("CODEX_AGENT_ROOT is required")
	}
	if cfg.CodexBin == "" {
		return cfg, fmt.Errorf("CODEX_AGENT_CODEX_BIN is required")
	}
	return cfg, nil
}
