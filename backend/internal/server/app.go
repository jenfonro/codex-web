package server

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"codex-web/backend/internal/appserver"
	"codex-web/backend/public"
)

type App struct {
	cfg      appConfig
	appsrv   *appserver.Client
	sessions map[string]time.Time
	mu       sync.Mutex
	state    persistedState
}

type persistedState struct {
	HostState       map[string]any `json:"hostState,omitempty"`
	SharedObjects   map[string]any `json:"sharedObjects,omitempty"`
	PinnedThreadIDs []string       `json:"pinnedThreadIds,omitempty"`
}

func New() (*App, error) {
	cfg, err := loadConfig()
	if err != nil {
		return nil, err
	}
	appsrv := appserver.New(appserver.Config{
		Endpoint:  cfg.AppServerEndpoint,
		CodexBin:  cfg.CodexBin,
		CodexHome: cfg.CodexHome,
		RootDir:   cfg.RootDir,
	})
	if err := appsrv.Start(context.Background()); err != nil {
		return nil, err
	}
	app := &App{
		cfg:      cfg,
		appsrv:   appsrv,
		sessions: map[string]time.Time{},
		state: persistedState{
			HostState:     map[string]any{},
			SharedObjects: map[string]any{},
		},
	}
	app.loadState()
	return app, nil
}

func (a *App) Run() error {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/auth/status", a.handleAuthStatus)
	mux.HandleFunc("/api/auth/login", a.handleLogin)
	mux.HandleFunc("/api/auth/logout", a.handleLogout)
	mux.Handle("/api/", a.requireAuth(http.HandlerFunc(a.handleAPI)))
	mux.Handle("/", a.staticHandler())

	if a.cfg.PasswordIsGenerated {
		log.Printf("generated login password: %s", a.cfg.Password)
	}
	log.Printf("codex-web listening on http://%s", a.cfg.Addr)
	log.Printf("codex home: %s, root dir: %s, app server: %s", a.cfg.CodexHome, a.cfg.RootDir, a.cfg.AppServerEndpoint)
	return http.ListenAndServe(a.cfg.Addr, mux)
}

func loadConfig() (appConfig, error) {
	home, _ := os.UserHomeDir()
	if home == "" {
		home = "/root"
	}
	dataDir := getenv("CODEX_WEB_DATA", "./data")
	cfg := appConfig{
		Addr:              getenv("CODEX_WEB_ADDR", "127.0.0.1:58888"),
		CodexHome:         getenv("CODEX_HOME", filepath.Join(home, ".codex")),
		RootDir:           getenv("CODEX_WEB_ROOT", "/root"),
		DataDir:           dataDir,
		CodexBin:          getenv("CODEX_WEB_CODEX_BIN", "codex"),
		AppServerEndpoint: getenv("CODEX_WEB_APP_SERVER", "stdio"),
	}
	password := os.Getenv("CODEX_WEB_PASSWORD")
	if password == "" {
		generated, err := loadOrCreatePassword(filepath.Join(dataDir, "password.txt"))
		if err != nil {
			return cfg, err
		}
		password = generated
		cfg.PasswordIsGenerated = true
	}
	cfg.Password = password
	return cfg, nil
}

func loadOrCreatePassword(path string) (string, error) {
	if data, err := os.ReadFile(path); err == nil {
		if password := strings.TrimSpace(string(data)); password != "" {
			return password, nil
		}
	}
	password := randomToken(18)
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return "", err
	}
	if err := os.WriteFile(path, []byte(password+"\n"), 0o600); err != nil {
		return "", err
	}
	return password, nil
}

func getenv(key, defaultValue string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return defaultValue
	}
	return value
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
	case path == "/bridge/events":
		a.handleBridgeEvents(w, r)
	case path == "/bridge/message":
		a.handleBridgeMessage(w, r)
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
		if !a.isAuthenticated(r) {
			path := strings.TrimPrefix(r.URL.Path, "/")
			if path != "login.html" {
				http.Redirect(w, r, "/login.html", http.StatusFound)
				return
			}
		}
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}
		if path == "login.html" && a.isAuthenticated(r) {
			http.Redirect(w, r, "/", http.StatusFound)
			return
		}
		if _, err := staticFS.Open(path); err != nil {
			r.URL.Path = "/"
		}
		if ctype := mime.TypeByExtension(filepath.Ext(path)); ctype != "" {
			w.Header().Set("Content-Type", ctype)
		}
		fileServer.ServeHTTP(w, r)
	})
}

func (a *App) statePath() string {
	return filepath.Join(a.cfg.DataDir, "state.json")
}

func (a *App) loadState() {
	data, err := os.ReadFile(a.statePath())
	if err != nil {
		return
	}
	_ = json.Unmarshal(data, &a.state)
	if a.state.HostState == nil {
		a.state.HostState = map[string]any{}
	}
	if a.state.SharedObjects == nil {
		a.state.SharedObjects = map[string]any{}
	}
}

func (a *App) saveState() {
	if err := os.MkdirAll(a.cfg.DataDir, 0o700); err != nil {
		return
	}
	data, err := json.MarshalIndent(a.state, "", "  ")
	if err != nil {
		return
	}
	_ = os.WriteFile(a.statePath(), data, 0o600)
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

func cleanRelativeID(id string) string {
	return strings.TrimSpace(strings.Trim(id, "/"))
}

func firstString(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func parseTime(value string) time.Time {
	if value == "" {
		return time.Time{}
	}
	if t, err := time.Parse(time.RFC3339Nano, value); err == nil {
		return t
	}
	if t, err := time.Parse(time.RFC3339, value); err == nil {
		return t
	}
	return time.Time{}
}

func safePath(base, requested string) (string, error) {
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
