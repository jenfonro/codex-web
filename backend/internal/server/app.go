package server

import (
	"encoding/json"
	"io"
	"io/fs"
	"log"
	"mime"
	"net/http"
	"path/filepath"
	"strings"

	"codex-web/backend/internal/config"
	"codex-web/backend/internal/node"
	"codex-web/backend/public"
)

type App struct {
	cfg   appConfig
	nodes *node.Registry
}

func New() (*App, error) {
	cfg, err := loadConfig()
	if err != nil {
		return nil, err
	}
	nodes := node.NewRegistry(filepath.Join(cfg.DataDir, "nodes.json"))
	if err := nodes.Load(); err != nil {
		return nil, err
	}
	if err := nodes.Save(); err != nil {
		return nil, err
	}
	app := &App{
		cfg:   cfg,
		nodes: nodes,
	}
	return app, nil
}

func (a *App) Run() error {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/agent/connect", a.handleAgentConnect)
	mux.HandleFunc("/api/", a.handleAPI)
	mux.Handle("/", a.staticHandler())

	if a.cfg.AgentTokenGenerated {
		log.Printf("generated agent token stored in %s", filepath.Join(a.cfg.DataDir, "agent-token.txt"))
	}
	log.Printf("codex-web listening on http://%s", a.cfg.Addr)
	log.Printf("codex-web controller data dir: %s", a.cfg.DataDir)
	return http.ListenAndServe(a.cfg.Addr, mux)
}

func loadConfig() (appConfig, error) {
	loaded, err := config.LoadController()
	if err != nil {
		return appConfig{}, err
	}
	cfg := appConfig{
		Addr:                loaded.Addr,
		DataDir:             loaded.DataDir,
		AgentToken:          loaded.AgentToken,
		AgentTokenGenerated: loaded.AgentTokenIsGenerated,
	}
	return cfg, nil
}

func (a *App) handleAPI(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api")
	switch {
	case path == "/nodes":
		a.handleNodes(w, r)
	case path == "/nodes/active":
		a.handleActiveNode(w, r)
	case strings.HasPrefix(path, "/nodes/"):
		a.handleNodeItem(w, r, strings.TrimPrefix(path, "/nodes/"))
	case path == "/sessions":
		a.handleSessions(w, r)
	case path == "/sessions/events":
		a.handleSessionEvents(w, r)
	case strings.HasPrefix(path, "/sessions/"):
		a.handleSessionItem(w, r, strings.TrimPrefix(path, "/sessions/"))
	case path == "/workspace":
		a.handleWorkspace(w, r)
	case path == "/git":
		a.handleGit(w, r)
	default:
		writeError(w, http.StatusNotFound, "not found")
	}
}

func (a *App) staticHandler() http.Handler {
	staticFS, err := fs.Sub(public.Public, "dist")
	if err != nil {
		panic(err)
	}
	fileServer := http.FileServer(http.FS(staticFS))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}
		if _, err := staticFS.Open(path); err != nil {
			r.URL.Path = "/"
			path = "index.html"
		}
		if path == "index.html" {
			w.Header().Set("Cache-Control", "no-cache")
		} else {
			w.Header().Set("Cache-Control", "public, max-age=3600")
		}
		if ctype := mime.TypeByExtension(filepath.Ext(path)); ctype != "" {
			w.Header().Set("Content-Type", ctype)
		}
		fileServer.ServeHTTP(w, r)
	})
}

func readJSON(r *http.Request, v any) error {
	defer r.Body.Close()
	dec := json.NewDecoder(io.LimitReader(r.Body, 2*1024*1024))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		return err
	}
	return nil
}

func writeJSON(w http.ResponseWriter, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(apiError{Error: message})
}

func methodNotAllowed(w http.ResponseWriter) {
	writeError(w, http.StatusMethodNotAllowed, "请求方法不允许")
}

func firstString(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
