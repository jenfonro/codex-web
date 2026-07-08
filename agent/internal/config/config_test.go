package config

import "testing"

func TestLoadAgentRequiresExplicitEnvironment(t *testing.T) {
	t.Setenv("CODEX_AGENT_CONTROLLER", "ws://controller/api/agent/connect")
	t.Setenv("CODEX_AGENT_ID", "server-a")
	t.Setenv("CODEX_AGENT_NAME", "Server A")
	t.Setenv("CODEX_AGENT_TOKEN", "secret")
	t.Setenv("CODEX_AGENT_ROOT", "/srv")
	t.Setenv("CODEX_AGENT_CODEX_BIN", "codex")
	if _, err := LoadAgent(); err == nil || err.Error() != "CODEX_HOME is required" {
		t.Fatalf("LoadAgent() error = %v, want CODEX_HOME required", err)
	}
}

func TestLoadAgent(t *testing.T) {
	t.Setenv("CODEX_AGENT_CONTROLLER", "ws://controller/api/agent/connect")
	t.Setenv("CODEX_AGENT_ID", "server-a")
	t.Setenv("CODEX_AGENT_NAME", "Server A")
	t.Setenv("CODEX_AGENT_TOKEN", "secret")
	t.Setenv("CODEX_HOME", "/srv/.codex")
	t.Setenv("CODEX_AGENT_ROOT", "/srv")
	t.Setenv("CODEX_AGENT_CODEX_BIN", "codex")

	cfg, err := LoadAgent()
	if err != nil {
		t.Fatalf("LoadAgent() error = %v", err)
	}
	if cfg.ID != "server-a" || cfg.Name != "Server A" || cfg.CodexHome != "/srv/.codex" || cfg.RootDir != "/srv" {
		t.Fatalf("cfg = %#v", cfg)
	}
}
