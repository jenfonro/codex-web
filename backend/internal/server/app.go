package server

import (
	"context"
	"encoding/json"
	"io/fs"
	"log"
	"mime"
	"net/http"
	"path/filepath"
	"strings"

	"codex-web/backend/internal/config"
	"codex-web/backend/internal/thread"
	"codex-web/backend/public"
)

type App struct {
	cfg     config.App
	threads *thread.Manager
}

func New() *App {
	cfg := config.Load()
	app := &App{
		cfg: cfg,
		threads: thread.New(thread.Config{
			CodexBin:  cfg.CodexBin,
			CodexHome: cfg.CodexHome,
			RootDir:   cfg.RootDir,
		}),
	}
	return app
}

func (a *App) Run() error {
	if err := a.threads.Initialize(context.Background()); err != nil {
		return err
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/", a.handleAPI)
	mux.Handle("/", a.staticHandler())

	log.Printf("codex-web listening on http://%s", a.cfg.Addr)
	log.Printf("codex-web codex home: %s", a.cfg.CodexHome)
	log.Printf("codex-web workspace root: %s", a.cfg.RootDir)
	return http.ListenAndServe(a.cfg.Addr, mux)
}

func (a *App) handleAPI(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api")
	switch {
	case path == "/threads":
		a.handleThreads(w, r)
	case path == "/threads/state-events":
		a.handleThreadStateEvents(w, r)
	case strings.HasPrefix(path, "/threads/"):
		a.handleThreadAction(w, r, strings.TrimPrefix(path, "/threads/"))
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

func readJSON(r *http.Request, v any) {
	defer r.Body.Close()
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(v); err != nil {
		panic(err)
	}
}

func writeJSON(w http.ResponseWriter, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if err := json.NewEncoder(w).Encode(value); err != nil {
		panic(err)
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(apiError{Error: message}); err != nil {
		panic(err)
	}
}

func methodNotAllowed(w http.ResponseWriter) {
	writeError(w, http.StatusMethodNotAllowed, "method not allowed")
}
