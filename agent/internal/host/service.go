package host

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
)

const (
	maxFileSearchResults = 80
	maxFileSearchVisited = 6000
)

type Service struct {
	rootDir   string
	codexHome string
}

func New(rootDir, codexHome string) *Service {
	return &Service{rootDir: rootDir, codexHome: codexHome}
}

func (s *Service) RootDir() string {
	return s.rootDir
}

func (s *Service) CodexHome() string {
	return s.codexHome
}

func (s *Service) Fetch(ctx context.Context, endpoint string, params map[string]any) (any, bool, error) {
	params = Params(params)
	switch endpoint {
	case "codex-home":
		return map[string]any{"codexHome": s.codexHome}, true, nil
	case "home-directory":
		return map[string]any{"path": s.rootDir}, true, nil
	case "active-workspace-roots":
		return map[string]any{"roots": []string{s.rootDir}, "labels": map[string]string{s.rootDir: filepath.Base(s.rootDir)}}, true, nil
	case "workspace-root-options":
		return map[string]any{"roots": []string{s.rootDir}, "labels": map[string]string{s.rootDir: filepath.Base(s.rootDir)}}, true, nil
	case "locale-info":
		return map[string]any{"ideLocale": "zh-CN", "systemLocale": "zh-CN"}, true, nil
	case "git-origins":
		return map[string]any{"origins": []any{}}, true, nil
	case "cli-connection-state":
		return map[string]any{"state": "connected", "error": nil}, true, nil
	case "extension-info":
		return extensionInfo(), true, nil
	case "os-info":
		return map[string]any{"platform": runtime.GOOS, "osVersion": "", "hasWsl": false, "isVsCodeRunningInsideWsl": false}, true, nil
	case "is-copilot-api-available":
		return map[string]any{"available": false}, true, nil
	case "has-custom-cli-executable":
		return map[string]any{"hasCustomCliExecutable": false}, true, nil
	case "account-info":
		return map[string]any{"accountId": nil, "userId": nil, "plan": nil, "email": nil, "computeResidency": nil}, true, nil
	case "third-party-notices":
		return map[string]any{"text": nil}, true, nil
	case "ide-context":
		return map[string]any{"ideContext": nil}, true, nil
	case "set-vs-context":
		return map[string]any{"ok": true}, true, nil
	case "mcp-codex-config":
		config, err := s.ReadConfig(ctx, params)
		if err != nil {
			return nil, true, err
		}
		return map[string]any{"config": config["config"]}, true, nil
	case "read-config", "read-config-for-host":
		value, err := s.ReadConfig(ctx, params)
		return value, true, err
	case "get-config-requirements-for-host":
		value, err := s.ReadConfigRequirements(ctx)
		return value, true, err
	case "workspace-directory-entries":
		value, err := s.WorkspaceDirectoryEntries(params)
		return value, true, err
	case "workspace-directory-tree-search":
		value, err := s.WorkspaceDirectorySearch(params)
		return value, true, err
	case "projectless-thread-cwd":
		return map[string]any{"cwd": s.rootDir, "workspaceRoot": s.rootDir}, true, nil
	case "local-custom-agents":
		return map[string]any{"agents": []any{}}, true, nil
	case "get-is-conversation-archiving-for-host":
		return map[string]any{"isArchiving": false}, true, nil
	case "get-openai-capabilities-server-info", "get-copilot-api-proxy-info":
		return map[string]any{"value": nil}, true, nil
	case "get-windows-sandbox-readiness-for-host":
		return map[string]any{"status": "unsupported", "reason": "codex-web runs on linux"}, true, nil
	case "paths-exist":
		return s.PathsExist(params), true, nil
	case "read-file-metadata":
		value, err := s.ReadFileMetadata(params)
		return value, true, err
	case "read-file-binary":
		value, err := s.ReadFileBinary(params)
		return value, true, err
	default:
		return nil, false, nil
	}
}

func (s *Service) ReadConfig(ctx context.Context, params map[string]any) (map[string]any, error) {
	_ = ctx
	cwd := FirstString(StrAny(params["cwd"]), s.rootDir)
	raw, _ := os.ReadFile(filepath.Join(s.codexHome, "config.toml"))
	config := map[string]any{
		"cwd":        cwd,
		"configPath": filepath.Join(s.codexHome, "config.toml"),
		"raw":        string(raw),
		"analytics":  map[string]any{"enabled": false},
	}
	return map[string]any{
		"config":  config,
		"layers":  []any{},
		"origins": map[string]any{},
	}, nil
}

func (s *Service) ReadConfigRequirements(ctx context.Context) (map[string]any, error) {
	_ = ctx
	return map[string]any{"requirements": []any{}}, nil
}

func (s *Service) PathsExist(params map[string]any) map[string]any {
	paths := StringSlice(params["paths"])
	existing := []string{}
	for _, requested := range paths {
		if path, err := SafePath(s.rootDir, requested); err == nil {
			if _, err := os.Stat(path); err == nil {
				existing = append(existing, path)
			}
		}
	}
	return map[string]any{"existingPaths": existing}
}

func (s *Service) ReadFileMetadata(params map[string]any) (map[string]any, error) {
	path, err := SafePath(s.rootDir, StrAny(params["path"]))
	if err != nil {
		return nil, err
	}
	stat, err := os.Stat(path)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"sizeBytes":    stat.Size(),
		"modifiedAtMs": stat.ModTime().UnixMilli(),
		"isDirectory":  stat.IsDir(),
		"isFile":       !stat.IsDir(),
	}, nil
}

func (s *Service) ReadFileBinary(params map[string]any) (map[string]any, error) {
	path, err := SafePath(s.rootDir, StrAny(params["path"]))
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return map[string]any{"contentsBase64": base64.StdEncoding.EncodeToString(data)}, nil
}

func (s *Service) WorkspaceDirectoryEntries(params map[string]any) (map[string]any, error) {
	root, dir, relDir, err := s.workspaceDirectory(params)
	if err != nil {
		return nil, err
	}
	includeHidden, _ := params["includeHidden"].(bool)
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	out := make([]map[string]any, 0, len(entries))
	for _, entry := range entries {
		name := entry.Name()
		if !includeHidden && strings.HasPrefix(name, ".") {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		relPath := filepath.ToSlash(filepath.Join(relDir, name))
		entryType := "file"
		if entry.IsDir() {
			entryType = "directory"
		}
		out = append(out, map[string]any{
			"type":         entryType,
			"name":         name,
			"path":         relPath,
			"displayPath":  relPath,
			"sizeBytes":    info.Size(),
			"modifiedAtMs": info.ModTime().UnixMilli(),
			"isDirectory":  entry.IsDir(),
			"isFile":       !entry.IsDir(),
		})
	}
	sort.SliceStable(out, func(i, j int) bool {
		leftDir, _ := out[i]["isDirectory"].(bool)
		rightDir, _ := out[j]["isDirectory"].(bool)
		if leftDir != rightDir {
			return leftDir
		}
		return strings.ToLower(StrAny(out[i]["path"])) < strings.ToLower(StrAny(out[j]["path"]))
	})
	return map[string]any{"root": root, "directoryPath": relDir, "entries": out}, nil
}

func (s *Service) WorkspaceDirectorySearch(params map[string]any) (map[string]any, error) {
	root, _, _, err := s.workspaceDirectory(params)
	if err != nil {
		return nil, err
	}
	query := strings.ToLower(strings.TrimSpace(FirstString(StrAny(params["query"]), StrAny(params["searchQuery"]))))
	if query == "" {
		return map[string]any{"query": query, "files": []any{}}, nil
	}
	includeHidden, _ := params["includeHidden"].(bool)
	files := []map[string]any{}
	visited := 0
	truncated := false
	err = filepath.WalkDir(root, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return nil
		}
		if path != root {
			visited++
		}
		if visited > maxFileSearchVisited {
			truncated = true
			return filepath.SkipAll
		}
		name := entry.Name()
		if path != root && entry.IsDir() && shouldSkipSearchDir(name) {
			return filepath.SkipDir
		}
		if !includeHidden && strings.HasPrefix(name, ".") {
			if entry.IsDir() && path != root {
				return filepath.SkipDir
			}
			return nil
		}
		if path == root || !strings.Contains(strings.ToLower(name), query) {
			return nil
		}
		relPath, err := filepath.Rel(root, path)
		if err != nil {
			return nil
		}
		relPath = filepath.ToSlash(relPath)
		entryType := "file"
		if entry.IsDir() {
			entryType = "directory"
		}
		files = append(files, map[string]any{
			"type":        entryType,
			"name":        name,
			"path":        relPath,
			"displayPath": relPath,
			"isDirectory": entry.IsDir(),
			"isFile":      !entry.IsDir(),
		})
		if len(files) >= maxFileSearchResults {
			truncated = true
			return filepath.SkipAll
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return map[string]any{"query": query, "files": files, "truncated": truncated}, nil
}

func (s *Service) workspaceDirectory(params map[string]any) (string, string, string, error) {
	root := FirstString(StrAny(params["workspaceRoot"]), StrAny(params["root"]), s.rootDir)
	root, err := SafePath(s.rootDir, root)
	if err != nil {
		return "", "", "", err
	}
	relDir := filepath.Clean(StrAny(params["directoryPath"]))
	if relDir == "." {
		relDir = ""
	}
	dir := root
	if relDir != "" {
		dir, err = SafePath(root, relDir)
		if err != nil {
			return "", "", "", err
		}
	}
	if stat, err := os.Stat(dir); err != nil {
		return "", "", "", err
	} else if !stat.IsDir() {
		return "", "", "", fmt.Errorf("%s is not a directory", dir)
	}
	return root, dir, filepath.ToSlash(relDir), nil
}

func extensionInfo() map[string]any {
	return map[string]any{
		"version":       FirstString(os.Getenv("CODEX_AGENT_EXTENSION_VERSION"), "unknown"),
		"buildNumber":   nil,
		"buildFlavor":   "vscode",
		"osName":        runtime.GOOS,
		"systemVersion": nil,
		"appName":       "Codex",
		"appIconMedium": nil,
	}
}

func Params(params map[string]any) map[string]any {
	if nested, ok := params["params"].(map[string]any); ok && nested != nil {
		return nested
	}
	return params
}

func SafePath(base, requested string) (string, error) {
	base = filepath.Clean(base)
	if requested == "" {
		return base, nil
	}
	path := requested
	if !filepath.IsAbs(path) {
		path = filepath.Join(base, path)
	}
	clean := filepath.Clean(path)
	if clean != base && !strings.HasPrefix(clean, base+string(os.PathSeparator)) {
		return "", errors.New("invalid path")
	}
	return clean, nil
}

func FirstString(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func StrAny(value any) string {
	switch v := value.(type) {
	case string:
		return strings.TrimSpace(v)
	case fmt.Stringer:
		return strings.TrimSpace(v.String())
	default:
		return ""
	}
}

func StringSlice(value any) []string {
	items, ok := value.([]any)
	if !ok {
		if valueString := StrAny(value); valueString != "" {
			return []string{valueString}
		}
		return nil
	}
	out := make([]string, 0, len(items))
	for _, item := range items {
		if value := StrAny(item); value != "" {
			out = append(out, value)
		}
	}
	return out
}

func IntAny(value any) int {
	switch v := value.(type) {
	case int:
		return v
	case int64:
		return int(v)
	case float64:
		return int(v)
	case json.Number:
		n, _ := v.Int64()
		return int(n)
	case string:
		n, _ := strconv.Atoi(strings.TrimSpace(v))
		return n
	default:
		return 0
	}
}

func shouldSkipSearchDir(name string) bool {
	switch name {
	case ".git", "node_modules", "vendor", "dist", "build", ".cache", ".next", ".turbo":
		return true
	default:
		return false
	}
}
