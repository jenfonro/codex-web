package node

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"codex-web/backend/internal/model"
)

func TestRegistryLoadEmptyFile(t *testing.T) {
	reg := NewRegistry(filepath.Join(t.TempDir(), "nodes.json"))
	if err := reg.Load(); err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if got := reg.List(); len(got) != 0 {
		t.Fatalf("List() len = %d, want 0", len(got))
	}
}

func TestRegistrySaveAndLoad(t *testing.T) {
	path := filepath.Join(t.TempDir(), "nodes.json")
	reg := NewRegistry(path)
	if err := reg.UpsertRemote(&fakeClient{info: model.NodeInfo{ID: "server-a", Name: "Server A", Kind: "remote", Online: true}}); err != nil {
		t.Fatalf("UpsertRemote() error = %v", err)
	}
	if err := reg.Save(); err != nil {
		t.Fatalf("Save() error = %v", err)
	}
	loaded := NewRegistry(path)
	if err := loaded.Load(); err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	nodes := loaded.List()
	if len(nodes) != 1 || nodes[0].ID != "server-a" {
		t.Fatalf("loaded nodes = %#v", nodes)
	}
	if !loaded.Exists("server-a") {
		t.Fatalf("Exists(server-a) = false, want true")
	}
	if loaded.Exists("missing") {
		t.Fatalf("Exists(missing) = true, want false")
	}
}

func TestRegistryRemoteReconnectReplacesClient(t *testing.T) {
	reg := NewRegistry(filepath.Join(t.TempDir(), "nodes.json"))
	first := &fakeClient{info: model.NodeInfo{ID: "server-a", Name: "A", Kind: "remote", Online: true}}
	second := &fakeClient{info: model.NodeInfo{ID: "server-a", Name: "A2", Kind: "remote", Online: true}}
	if err := reg.UpsertRemote(first); err != nil {
		t.Fatalf("UpsertRemote(first) error = %v", err)
	}
	if err := reg.UpsertRemote(second); err != nil {
		t.Fatalf("UpsertRemote(second) error = %v", err)
	}
	if !first.closed {
		t.Fatalf("first client was not closed on reconnect")
	}
	if got := reg.Client("server-a"); got != second {
		t.Fatalf("current client was not replaced")
	}
}

func TestRegistryDeleteOfflineRejectsOnline(t *testing.T) {
	reg := NewRegistry(filepath.Join(t.TempDir(), "nodes.json"))
	client := &fakeClient{info: model.NodeInfo{ID: "server-a", Name: "A", Kind: "remote", Online: true}}
	if err := reg.UpsertRemote(client); err != nil {
		t.Fatalf("UpsertRemote() error = %v", err)
	}
	if err := reg.DeleteOffline("server-a"); err == nil {
		t.Fatalf("DeleteOffline() error = nil, want online rejection")
	}
	if err := reg.MarkOffline("server-a", client); err != nil {
		t.Fatalf("MarkOffline() error = %v", err)
	}
	if err := reg.DeleteOffline("server-a"); err != nil {
		t.Fatalf("DeleteOffline() error = %v", err)
	}
}

type fakeClient struct {
	info   model.NodeInfo
	closed bool
}

func (f *fakeClient) Info() model.NodeInfo {
	if f.info.LastSeen.IsZero() {
		f.info.LastSeen = time.Now().UTC()
	}
	return f.info
}
func (f *fakeClient) Online() bool                                                 { return f.info.Online && !f.closed }
func (f *fakeClient) Request(context.Context, string, map[string]any) (any, error) { return nil, nil }
func (f *fakeClient) Subscribe() (<-chan Event, func()) {
	ch := make(chan Event)
	close(ch)
	return ch, func() {}
}
func (f *fakeClient) Close() error {
	f.closed = true
	return nil
}
