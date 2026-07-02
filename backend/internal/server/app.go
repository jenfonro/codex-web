package server

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"mime"
	"net/http"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"codex-web/backend/internal/config"
	"codex-web/backend/internal/node"
	"codex-web/backend/public"
)

type App struct {
	cfg      appConfig
	nodes    *node.Registry
	sessions map[string]time.Time
	mu       sync.Mutex
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
		cfg:      cfg,
		nodes:    nodes,
		sessions: map[string]time.Time{},
	}
	return app, nil
}

func (a *App) Run() error {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/auth/status", a.handleAuthStatus)
	mux.HandleFunc("/api/auth/login", a.handleLogin)
	mux.HandleFunc("/api/auth/logout", a.handleLogout)
	mux.HandleFunc("/api/agent/connect", a.handleAgentConnect)
	mux.Handle("/api/", a.requireAuth(http.HandlerFunc(a.handleAPI)))
	mux.Handle("/", a.staticHandler())

	if a.cfg.PasswordIsGenerated {
		log.Printf("generated login password: %s", a.cfg.Password)
	}
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
		Password:            loaded.Password,
		PasswordIsGenerated: loaded.PasswordIsGenerated,
		AgentToken:          loaded.AgentToken,
		AgentTokenGenerated: loaded.AgentTokenIsGenerated,
	}
	return cfg, nil
}

func randomToken(byteCount int) string {
	buf := make([]byte, byteCount)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return base64.RawURLEncoding.EncodeToString(buf)
}

func (a *App) handleAuthStatus(w http.ResponseWriter, r *http.Request) {
	status := authStatus{Authenticated: a.isAuthenticated(r)}
	if !status.Authenticated && a.cfg.PasswordIsGenerated {
		status.PasswordHint = "password is printed in the server log and stored in build/data/password.txt"
	}
	writeJSON(w, status)
}

func (a *App) handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var req loginRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if subtle.ConstantTimeCompare([]byte(req.Password), []byte(a.cfg.Password)) != 1 {
		writeError(w, http.StatusUnauthorized, "invalid password")
		return
	}
	token := randomToken(32)
	expires := time.Now().Add(24 * time.Hour)
	a.mu.Lock()
	a.sessions[token] = expires
	a.mu.Unlock()
	http.SetCookie(w, &http.Cookie{
		Name:     "codex_web_session",
		Value:    token,
		Path:     "/",
		Expires:  expires,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	writeJSON(w, map[string]bool{"ok": true})
}

func (a *App) handleLogout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie("codex_web_session"); err == nil {
		a.mu.Lock()
		delete(a.sessions, cookie.Value)
		a.mu.Unlock()
	}
	http.SetCookie(w, &http.Cookie{Name: "codex_web_session", Path: "/", MaxAge: -1})
	writeJSON(w, map[string]bool{"ok": true})
}

func (a *App) requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !a.isAuthenticated(r) {
			writeError(w, http.StatusUnauthorized, "需要登录")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (a *App) isAuthenticated(r *http.Request) bool {
	cookie, err := r.Cookie("codex_web_session")
	if err != nil || cookie.Value == "" {
		return false
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	expires, ok := a.sessions[cookie.Value]
	if !ok || time.Now().After(expires) {
		delete(a.sessions, cookie.Value)
		return false
	}
	return true
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
		w.Header().Set("Cache-Control", "no-store, max-age=0")
		w.Header().Set("Clear-Site-Data", `"cache"`)
		w.Header().Set("Pragma", "no-cache")
		w.Header().Set("Expires", "0")
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
