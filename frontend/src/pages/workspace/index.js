"use strict";

(function bootstrapCodexWorkspacePage(global) {
  const api = global.CodexPanelAPI;
  const store = global.CodexPanelStore;
  const utils = global.CodexPanelUtils;
  const panel = document.getElementById("workspacePanel");
  if (!panel || !api || !store || !utils) return;

  const state = {
    node: null,
    nodes: [],
    directoryPath: "",
    entries: [],
    query: "",
    searchResults: [],
    includeHidden: false,
    loading: false,
    searching: false,
    error: "",
    loaded: false,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  function init() {
    panel.addEventListener("click", handleClick);
    panel.addEventListener("input", handleInput);
    panel.addEventListener("keydown", handleKeyDown);
    global.addEventListener("codex-web:view-changed", handleViewChanged);
    global.addEventListener("codex-web:node-selected", () => {
      state.directoryPath = "";
      state.query = "";
      state.searchResults = [];
      if (isActive()) void refreshWorkspace();
    });
    render();
    if (isActive()) void refreshWorkspace();
  }

  function handleViewChanged(event) {
    if (event.detail?.view === "workspace") {
      void refreshWorkspace();
    }
  }

  function handleClick(event) {
    const action = event.target.closest("[data-workspace-action]");
    const row = event.target.closest("[data-workspace-entry]");
    if (action) {
      switch (action.dataset.workspaceAction) {
        case "refresh":
          void refreshWorkspace();
          break;
        case "up":
          openDirectory(parentPath(state.directoryPath));
          break;
        case "toggle-hidden":
          state.includeHidden = !state.includeHidden;
          void refreshWorkspace();
          break;
        case "clear-search":
          state.query = "";
          state.searchResults = [];
          render();
          break;
      }
      return;
    }
    if (row && row.dataset.workspaceType === "directory") {
      openDirectory(row.dataset.workspaceEntry || "");
    }
  }

  function handleInput(event) {
    if (!event.target.matches("[data-workspace-search]")) return;
    state.query = event.target.value;
    if (!state.query.trim()) {
      state.searchResults = [];
      render();
    }
  }

  function handleKeyDown(event) {
    if (!event.target.matches("[data-workspace-search]") || event.key !== "Enter") return;
    event.preventDefault();
    void searchWorkspace();
  }

  async function refreshWorkspace() {
    state.loading = true;
    state.error = "";
    render();
    try {
      await loadNode();
      if (!state.node?.online) {
        state.entries = [];
        state.loaded = true;
        state.error = state.node ? `Node "${nodeLabel(state.node)}" is offline.` : "No online node is selected.";
        return;
      }
      const payload = await api.fetchJSON("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeId: state.node.id,
          endpoint: "workspace-directory-entries",
          params: {
            directoryPath: state.directoryPath,
            includeHidden: state.includeHidden,
          },
        }),
      });
      state.directoryPath = normalizePath(payload.directoryPath || state.directoryPath);
      state.entries = normalizeEntries(payload.entries);
      state.loaded = true;
    } catch (error) {
      state.entries = [];
      state.error = `Unable to load workspace: ${error.message}`;
    } finally {
      state.loading = false;
      render();
    }
  }

  async function searchWorkspace() {
    const query = state.query.trim();
    if (!query) return;
    state.searching = true;
    state.error = "";
    render();
    try {
      await loadNode();
      if (!state.node?.online) {
        state.error = state.node ? `Node "${nodeLabel(state.node)}" is offline.` : "No online node is selected.";
        return;
      }
      const payload = await api.fetchJSON("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeId: state.node.id,
          endpoint: "workspace-directory-tree-search",
          params: {
            query,
            includeHidden: state.includeHidden,
          },
        }),
      });
      state.searchResults = normalizeEntries(payload.files);
    } catch (error) {
      state.searchResults = [];
      state.error = `Unable to search workspace: ${error.message}`;
    } finally {
      state.searching = false;
      render();
    }
  }

  async function loadNode() {
    const payload = await api.fetchJSON("/api/nodes");
    state.nodes = api.normalizeNodes(payload.nodes);
    const stored = store.getStoredNodeId();
    state.node = state.nodes.find((node) => node.id === stored) || state.nodes.find((node) => node.online) || state.nodes[0] || null;
    if (state.node?.online && state.node.id !== stored) {
      store.setStoredNodeId(state.node.id);
      global.dispatchEvent(new CustomEvent("codex-web:node-selected", { detail: { nodeId: state.node.id } }));
    }
  }

  function openDirectory(path) {
    state.directoryPath = normalizePath(path);
    state.query = "";
    state.searchResults = [];
    void refreshWorkspace();
  }

  function render() {
    panel.innerHTML = `
      <div class="workspace-view" data-workspace-loaded="${state.loaded ? "true" : "false"}">
        <div class="workspace-toolbar">
          <div class="workspace-title-block">
            <span class="workspace-title">${utils.escapeHTML(state.node ? nodeLabel(state.node) : "Workspace")}</span>
            <span class="workspace-subtitle">${utils.escapeHTML(state.node?.rootDir || "Select an online node")}</span>
          </div>
          <div class="workspace-toolbar-actions">
            <button type="button" class="workspace-icon-button codicon codicon-eye${state.includeHidden ? " active" : ""}" data-workspace-action="toggle-hidden" aria-label="Toggle hidden files" title="Toggle hidden files"></button>
            <button type="button" class="workspace-icon-button codicon codicon-refresh" data-workspace-action="refresh" aria-label="Refresh workspace" title="Refresh workspace"${state.loading ? " disabled" : ""}></button>
          </div>
        </div>
        <div class="workspace-search-row">
          <span class="codicon codicon-search" aria-hidden="true"></span>
          <input class="workspace-search-input" data-workspace-search type="search" placeholder="Search files" value="${utils.escapeAttr(state.query)}">
          ${state.query ? '<button type="button" class="workspace-icon-button codicon codicon-close" data-workspace-action="clear-search" aria-label="Clear search" title="Clear search"></button>' : ""}
        </div>
        <div class="workspace-path-row">
          <button type="button" class="workspace-icon-button codicon codicon-arrow-up" data-workspace-action="up" aria-label="Parent directory" title="Parent directory"${state.directoryPath ? "" : " disabled"}></button>
          <span class="workspace-current-path">${utils.escapeHTML(state.directoryPath || ".")}</span>
        </div>
        ${state.error ? `<div class="workspace-error" role="alert">${utils.escapeHTML(state.error)}</div>` : ""}
        <div class="workspace-list" role="list" aria-label="Workspace files">
          ${renderBody()}
        </div>
      </div>`;
  }

  function renderBody() {
    if ((state.loading && !state.loaded) || state.searching) {
      return Array.from({ length: 8 }, (_, index) => `<div class="workspace-row workspace-row-skeleton" role="listitem" aria-hidden="true" style="--workspace-delay:${index};"></div>`).join("");
    }
    const results = state.query.trim() && state.searchResults.length ? state.searchResults : state.entries;
    if (!results.length) {
      return `<div class="workspace-empty" role="status"><span class="codicon codicon-folder-opened" aria-hidden="true"></span><span>${state.query.trim() ? "No matching files." : "No files to show."}</span></div>`;
    }
    return results.map(renderEntry).join("");
  }

  function renderEntry(entry) {
    const icon = entry.isDirectory ? "codicon-folder" : "codicon-file";
    const size = entry.isDirectory ? "" : formatBytes(entry.sizeBytes);
    const modified = formatModified(entry.modifiedAtMs);
    return `
      <div class="workspace-row" role="listitem" data-workspace-entry="${utils.escapeAttr(entry.path)}" data-workspace-type="${entry.isDirectory ? "directory" : "file"}" title="${utils.escapeAttr(entry.path)}">
        <span class="codicon ${icon} workspace-entry-icon" aria-hidden="true"></span>
        <span class="workspace-entry-main">
          <span class="workspace-entry-name">${utils.escapeHTML(entry.name || entry.path)}</span>
          <span class="workspace-entry-path">${utils.escapeHTML(entry.displayPath || entry.path)}</span>
        </span>
        <span class="workspace-entry-meta">${utils.escapeHTML([size, modified].filter(Boolean).join("  "))}</span>
      </div>`;
  }

  function normalizeEntries(value) {
    return Array.isArray(value)
      ? value.map(normalizeEntry).filter(Boolean)
      : [];
  }

  function normalizeEntry(value) {
    if (!value || typeof value !== "object") return null;
    const path = normalizePath(value.path || value.Path || "");
    if (!path && !value.name) return null;
    const isDirectory = Boolean(value.isDirectory ?? value.IsDirectory ?? value.type === "directory");
    const name = String(value.name || value.Name || path.split("/").filter(Boolean).pop() || path || ".");
    return {
      name,
      path,
      displayPath: String(value.displayPath || value.DisplayPath || path),
      isDirectory,
      sizeBytes: Number(value.sizeBytes || value.SizeBytes || 0) || 0,
      modifiedAtMs: Number(value.modifiedAtMs || value.ModifiedAtMs || 0) || 0,
    };
  }

  function parentPath(path) {
    const parts = normalizePath(path).split("/").filter(Boolean);
    parts.pop();
    return parts.join("/");
  }

  function normalizePath(path) {
    return String(path || "").replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/").replace(/\/$/, "");
  }

  function nodeLabel(node) {
    return String(node?.name || node?.id || "Node");
  }

  function formatBytes(bytes) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function formatModified(value) {
    if (!value) return "";
    return utils.relativeTime(new Date(value).toISOString());
  }

  function isActive() {
    return !panel.hidden;
  }

  global.CodexWorkspacePage = { refresh: refreshWorkspace };
})(window);
