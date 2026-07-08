package node

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"codex-web/backend/internal/model"
)

type Registry struct {
	path string

	mu      sync.Mutex
	records map[string]model.NodeRecord
	clients map[string]Client
}

func NewRegistry(path string) *Registry {
	return &Registry{
		path:    path,
		records: map[string]model.NodeRecord{},
		clients: map[string]Client{},
	}
}

func (r *Registry) Load() error {
	data, err := os.ReadFile(r.path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	var records []model.NodeRecord
	if err := json.Unmarshal(data, &records); err != nil {
		return err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.records = map[string]model.NodeRecord{}
	for _, record := range records {
		if record.ID != "" {
			r.records[record.ID] = record
		}
	}
	return nil
}

func (r *Registry) Save() error {
	r.mu.Lock()
	records := make([]model.NodeRecord, 0, len(r.records))
	for _, record := range r.records {
		records = append(records, record)
	}
	r.mu.Unlock()
	sort.Slice(records, func(i, j int) bool { return records[i].ID < records[j].ID })
	if err := os.MkdirAll(filepath.Dir(r.path), 0o700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(records, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(r.path, data, 0o600)
}

func (r *Registry) UpsertRemote(client Client) error {
	info := client.Info()
	now := time.Now().UTC()
	if info.LastSeen.IsZero() {
		info.LastSeen = now
	}
	record := recordFromInfo(info)
	record.Kind = "remote"
	record.LastSeen = info.LastSeen
	r.mu.Lock()
	if existing := r.clients[info.ID]; existing != nil && existing != client {
		_ = existing.Close()
	}
	r.clients[info.ID] = client
	r.records[info.ID] = record
	r.mu.Unlock()
	return r.Save()
}

func (r *Registry) MarkOffline(id string, client Client) error {
	r.mu.Lock()
	if current := r.clients[id]; current == client {
		delete(r.clients, id)
	}
	if record, ok := r.records[id]; ok {
		record.LastSeen = time.Now().UTC()
		r.records[id] = record
	}
	r.mu.Unlock()
	return r.Save()
}

func (r *Registry) Touch(id string) error {
	r.mu.Lock()
	if record, ok := r.records[id]; ok {
		record.LastSeen = time.Now().UTC()
		r.records[id] = record
	}
	r.mu.Unlock()
	return r.Save()
}

func (r *Registry) Client(id string) Client {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.clients[id]
}

func (r *Registry) Exists(id string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	_, ok := r.records[id]
	return ok
}

func (r *Registry) List() []model.NodeInfo {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]model.NodeInfo, 0, len(r.records))
	for id, record := range r.records {
		info := model.NodeInfo{
			ID:        record.ID,
			Name:      record.Name,
			Kind:      record.Kind,
			RootDir:   record.RootDir,
			CodexHome: record.CodexHome,
			Hostname:  record.Hostname,
			Version:   record.Version,
			LastSeen:  record.LastSeen,
		}
		if client := r.clients[id]; client != nil && client.Online() {
			info = client.Info()
			info.Online = true
		}
		out = append(out, info)
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].ID < out[j].ID
	})
	return out
}

func (r *Registry) DeleteOffline(id string) error {
	if id == "" {
		return errors.New("cannot delete this node")
	}
	r.mu.Lock()
	if client := r.clients[id]; client != nil && client.Online() {
		r.mu.Unlock()
		return errors.New("cannot delete an online node")
	}
	delete(r.records, id)
	r.mu.Unlock()
	return r.Save()
}

func recordFromInfo(info model.NodeInfo) model.NodeRecord {
	return model.NodeRecord{
		ID:        info.ID,
		Name:      info.Name,
		Kind:      info.Kind,
		RootDir:   info.RootDir,
		CodexHome: info.CodexHome,
		Hostname:  info.Hostname,
		Version:   info.Version,
		LastSeen:  info.LastSeen,
	}
}
