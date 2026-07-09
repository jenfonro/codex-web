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
	"codex-web/backend/internal/host"
	"codex-web/backend/internal/session"
	"codex-web/backend/public"
)

type App struct {
	cfg      appConfig
	hostsvc  *host.Service
	sessions *session.Manager
}

func New() (*App, error) {
	cfg, err := loadConfig()
	if err != nil {
		return nil, err
	}
	app := &App{
		cfg:     cfg,
		hostsvc: host.New(cfg.RootDir, cfg.CodexHome),
		sessions: session.New(session.Config{
			CodexBin:  cfg.CodexBin,
			CodexHome: cfg.CodexHome,
			RootDir:   cfg.RootDir,
		}),
	}
	return app, nil
}

func (a *App) Run() error {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/", a.handleAPI)
	mux.Handle("/", a.staticHandler())

	log.Printf("codex-web listening on http://%s", a.cfg.Addr)
	log.Printf("codex-web data dir: %s", a.cfg.DataDir)
	log.Printf("codex-web codex home: %s", a.cfg.CodexHome)
	log.Printf("codex-web workspace root: %s", a.cfg.RootDir)
	return http.ListenAndServe(a.cfg.Addr, mux)
}

func loadConfig() (appConfig, error) {
	loaded, err := config.Load()
	if err != nil {
		return appConfig{}, err
	}
	cfg := appConfig{
		Addr:      loaded.Addr,
		DataDir:   loaded.DataDir,
		CodexHome: loaded.CodexHome,
		RootDir:   loaded.RootDir,
		CodexBin:  loaded.CodexBin,
	}
	return cfg, nil
}

func (a *App) handleAPI(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api")
	switch {
	case path == "/sessions":
		a.handleSessions(w, r)
	case path == "/sessions/state-events":
		a.handleSessionStateEvents(w, r)
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
		} else if r.URL.Query().Get("v") != "" {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			w.Header().Set("Cache-Control", "no-cache")
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
	writeError(w, http.StatusMethodNotAllowed, "method not allowed")
}

func firstString(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
