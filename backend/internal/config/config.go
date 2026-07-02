package config

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type Controller struct {
	Addr                  string
	DataDir               string
	Password              string
	PasswordIsGenerated   bool
	AgentToken            string
	AgentTokenIsGenerated bool
}

func LoadController() (Controller, error) {
	dataDir := getenv("CODEX_WEB_DATA", "./data")
	cfg := Controller{
		Addr:    getenv("CODEX_WEB_ADDR", "127.0.0.1:58888"),
		DataDir: dataDir,
	}
	password := os.Getenv("CODEX_WEB_PASSWORD")
	if password == "" {
		generated, err := loadOrCreateSecret(filepath.Join(dataDir, "password.txt"), 18)
		if err != nil {
			return cfg, err
		}
		password = generated
		cfg.PasswordIsGenerated = true
	}
	cfg.Password = password

	agentToken := os.Getenv("CODEX_WEB_AGENT_TOKEN")
	if agentToken == "" {
		generated, err := loadOrCreateSecret(filepath.Join(dataDir, "agent-token.txt"), 32)
		if err != nil {
			return cfg, err
		}
		agentToken = generated
		cfg.AgentTokenIsGenerated = true
	}
	cfg.AgentToken = agentToken
	return cfg, nil
}

func getenv(key, defaultValue string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return defaultValue
	}
	return value
}

func loadOrCreateSecret(path string, byteCount int) (string, error) {
	if data, err := os.ReadFile(path); err == nil {
		if value := strings.TrimSpace(string(data)); value != "" {
			return value, nil
		}
	}
	secret := randomToken(byteCount)
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return "", err
	}
	if err := os.WriteFile(path, []byte(secret+"\n"), 0o600); err != nil {
		return "", err
	}
	return secret, nil
}

func randomToken(byteCount int) string {
	buf := make([]byte, byteCount)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("%d", os.Getpid())
	}
	return base64.RawURLEncoding.EncodeToString(buf)
}
