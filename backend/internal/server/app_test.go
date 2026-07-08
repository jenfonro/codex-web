package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestStaticHandlerBlocksFixtureAssetByDefault(t *testing.T) {
	app := &App{}
	for _, target := range []string{
		"/app/codex-fixtures.js",
		"/app/./codex-fixtures.js",
		"/app//codex-fixtures.js",
		"/app/%63odex-fixtures.js",
	} {
		t.Run(target, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, target, nil)
			w := httptest.NewRecorder()

			app.staticHandler().ServeHTTP(w, req)

			if w.Code != http.StatusNotFound {
				t.Fatalf("status = %d, want 404", w.Code)
			}
			if got := w.Header().Get("Cache-Control"); got != "no-store" {
				t.Fatalf("Cache-Control = %q, want no-store", got)
			}
		})
	}
}

func TestStaticHandlerAllowsFixtureAssetWhenEnabled(t *testing.T) {
	app := &App{cfg: appConfig{EnableFixtures: true}}
	req := httptest.NewRequest(http.MethodGet, "/app/codex-fixtures.js", nil)
	w := httptest.NewRecorder()

	app.staticHandler().ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	if got := w.Header().Get("Content-Type"); got != "text/javascript; charset=utf-8" && got != "application/javascript" && got != "text/javascript" {
		t.Fatalf("Content-Type = %q, want javascript", got)
	}
}

func TestStaticHandlerDoesNotFallbackForMissingStaticAssets(t *testing.T) {
	app := &App{}
	for _, target := range []string{
		"/app/missing.js",
		"/assets/missing.png",
		"/missing.css",
	} {
		t.Run(target, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, target, nil)
			w := httptest.NewRecorder()

			app.staticHandler().ServeHTTP(w, req)

			if w.Code != http.StatusNotFound {
				t.Fatalf("status = %d, want 404", w.Code)
			}
			if got := w.Header().Get("Cache-Control"); got != "no-store" {
				t.Fatalf("Cache-Control = %q, want no-store", got)
			}
		})
	}
}

func TestStaticHandlerFallsBackToIndexForClientRoutes(t *testing.T) {
	app := &App{}
	for _, target := range []string{
		"/nodes",
		"/runs/active",
	} {
		t.Run(target, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, target, nil)
			w := httptest.NewRecorder()

			app.staticHandler().ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200", w.Code)
			}
			if got := w.Header().Get("Cache-Control"); got != "no-cache" {
				t.Fatalf("Cache-Control = %q, want no-cache", got)
			}
			if got := w.Header().Get("Content-Type"); !strings.HasPrefix(got, "text/html") {
				t.Fatalf("Content-Type = %q, want text/html", got)
			}
		})
	}
}

func TestStaticHandlerServesIndexRoot(t *testing.T) {
	app := &App{}
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()

	app.staticHandler().ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	if got := w.Header().Get("Cache-Control"); got != "no-cache" {
		t.Fatalf("Cache-Control = %q, want no-cache", got)
	}
	if got := w.Header().Get("Content-Type"); !strings.HasPrefix(got, "text/html") {
		t.Fatalf("Content-Type = %q, want text/html", got)
	}
}

func TestStaticHandlerDoesNotListStaticDirectories(t *testing.T) {
	app := &App{}
	for _, target := range []string{
		"/app/",
		"/assets/",
		"/assets/codex-panel/",
	} {
		t.Run(target, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, target, nil)
			w := httptest.NewRecorder()

			app.staticHandler().ServeHTTP(w, req)

			if w.Code != http.StatusNotFound {
				t.Fatalf("status = %d, want 404", w.Code)
			}
			if got := w.Header().Get("Cache-Control"); got != "no-store" {
				t.Fatalf("Cache-Control = %q, want no-store", got)
			}
		})
	}
}

func TestStaticHandlerServesCleanedExistingStaticAsset(t *testing.T) {
	app := &App{}
	req := httptest.NewRequest(http.MethodGet, "/app/./codex-web.js", nil)
	w := httptest.NewRecorder()

	app.staticHandler().ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	if got := w.Header().Get("Cache-Control"); got != "public, max-age=3600" {
		t.Fatalf("Cache-Control = %q, want public cache", got)
	}
}
