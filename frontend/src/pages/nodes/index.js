"use strict";

(function bootstrapCodexNodesPage(global) {
  const api = global.CodexPanelAPI;
  const store = global.CodexPanelStore;
  const utils = global.CodexPanelUtils;
  const panel = document.getElementById("nodesPanel");
  if (!panel || !api || !store || !utils) return;

  const POLL_MS = 5000;
  const state = {
    nodes: [],
    loading: false,
    error: "",
    selectingNodeId: "",
    deletingNodeId: "",
    loaded: false,
  };
  let pollTimer = 0;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  function init() {
    panel.addEventListener("click", handleClick);
    global.addEventListener("codex-web:view-changed", handleViewChanged);
    document.addEventListener("visibilitychange", syncPolling);
    render();
    if (isActive()) {
      void refreshNodes();
    }
    syncPolling();
  }

  function handleViewChanged(event) {
    if (event.detail?.view === "nodes") {
      void refreshNodes();
    }
    syncPolling();
  }

  function handleClick(event) {
    const action = event.target.closest("[data-node-action]");
    if (!action) return;
    const nodeId = action.dataset.nodeId || "";
    switch (action.dataset.nodeAction) {
      case "refresh":
        void refreshNodes();
        break;
      case "select":
        void selectNode(nodeId);
        break;
      case "delete":
        void deleteNode(nodeId);
        break;
    }
  }

  async function refreshNodes() {
    window.clearTimeout(pollTimer);
    state.loading = true;
    state.error = "";
    render();
    try {
      const payload = await api.fetchJSON("/api/nodes");
      state.nodes = api.normalizeNodes(payload.nodes);
      state.loaded = true;
    } catch (error) {
      state.error = `Unable to load nodes: ${error.message}`;
    } finally {
      state.loading = false;
      render();
      syncPolling();
    }
  }

  async function selectNode(nodeId) {
    const node = state.nodes.find((item) => item.id === nodeId);
    if (!node || !node.online) return;
    state.selectingNodeId = nodeId;
    state.error = "";
    render();
    try {
      await api.fetchJSON("/api/nodes/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId }),
      });
      store.setStoredNodeId(nodeId);
      global.dispatchEvent(new CustomEvent("codex-web:node-selected", { detail: { nodeId } }));
    } catch (error) {
      state.error = `Unable to select node: ${error.message}`;
    } finally {
      state.selectingNodeId = "";
      render();
    }
  }

  async function deleteNode(nodeId) {
    const node = state.nodes.find((item) => item.id === nodeId);
    if (!node || node.online) return;
    if (!global.confirm(`Delete offline node "${nodeLabel(node)}"?`)) return;
    state.deletingNodeId = nodeId;
    state.error = "";
    render();
    try {
      await api.fetchJSON(`/api/nodes/${encodeURIComponent(nodeId)}`, { method: "DELETE" });
      await refreshNodes();
    } catch (error) {
      state.error = `Unable to delete node: ${error.message}`;
    } finally {
      state.deletingNodeId = "";
      render();
    }
  }

  function syncPolling() {
    window.clearTimeout(pollTimer);
    pollTimer = 0;
    if (!isActive() || document.hidden) return;
    pollTimer = window.setTimeout(() => {
      void refreshNodes();
    }, POLL_MS);
  }

  function isActive() {
    return !panel.hidden;
  }

  function render() {
    const activeNodeId = store.getStoredNodeId();
    panel.innerHTML = `
      <div class="nodes-view" data-nodes-loaded="${state.loaded ? "true" : "false"}">
        <div class="nodes-toolbar">
          <div class="nodes-toolbar-summary">
            <span class="nodes-toolbar-title">Agents</span>
            <span class="nodes-toolbar-count">${state.nodes.length}</span>
          </div>
          <button type="button" class="nodes-icon-button codicon codicon-refresh" data-node-action="refresh" aria-label="Refresh nodes" title="Refresh nodes"${state.loading ? " disabled" : ""}></button>
        </div>
        ${state.error ? `<div class="nodes-error" role="alert">${utils.escapeHTML(state.error)}</div>` : ""}
        <div class="nodes-list" role="list" aria-label="Agent nodes">
          ${renderBody(activeNodeId)}
        </div>
      </div>`;
  }

  function renderBody(activeNodeId) {
    if (state.loading && !state.loaded) {
      return Array.from({ length: 3 }, (_, index) => `<div class="nodes-row nodes-row-skeleton" role="listitem" aria-hidden="true" style="--nodes-delay:${index};"></div>`).join("");
    }
    if (!state.nodes.length) {
      return `
        <div class="nodes-empty" role="status">
          <span class="codicon codicon-remote-explorer" aria-hidden="true"></span>
          <span>No agent nodes are connected.</span>
        </div>`;
    }
    return state.nodes.map((node) => renderNodeRow(node, activeNodeId)).join("");
  }

  function renderNodeRow(node, activeNodeId) {
    const selected = node.id === activeNodeId;
    const busy = state.selectingNodeId === node.id || state.deletingNodeId === node.id;
    const status = node.online ? "Online" : "Offline";
    const subtitle = [node.hostname, node.version].filter(Boolean).join(" / ") || node.kind;
    return `
      <div class="nodes-row${selected ? " selected" : ""}" role="listitem" data-node-online="${node.online ? "true" : "false"}" data-node-selected="${selected ? "true" : "false"}">
        <div class="nodes-row-main">
          <div class="nodes-row-title">
            <span class="nodes-status-dot" aria-hidden="true"></span>
            <span class="nodes-node-name">${utils.escapeHTML(nodeLabel(node))}</span>
            <span class="nodes-node-status">${status}</span>
          </div>
          <div class="nodes-node-id">${utils.escapeHTML(node.id)}</div>
          <div class="nodes-node-subtitle">${utils.escapeHTML(subtitle)}</div>
          <div class="nodes-node-meta">
            ${renderMeta("Root", node.rootDir)}
            ${renderMeta("Codex", node.codexHome)}
            ${renderMeta("Seen", formatLastSeen(node.lastSeen))}
          </div>
        </div>
        <div class="nodes-row-actions">
          <button type="button" class="nodes-action-button" data-node-action="select" data-node-id="${utils.escapeAttr(node.id)}"${node.online && !busy ? "" : " disabled"} title="Use this node">
            <span class="codicon codicon-check" aria-hidden="true"></span>
            <span>${selected ? "Active" : "Use"}</span>
          </button>
          <button type="button" class="nodes-icon-button codicon codicon-trash" data-node-action="delete" data-node-id="${utils.escapeAttr(node.id)}"${!node.online && !busy ? "" : " disabled"} aria-label="Delete offline node" title="Delete offline node"></button>
        </div>
      </div>`;
  }

  function renderMeta(label, value) {
    if (!value) return "";
    return `<span class="nodes-meta-item"><span>${utils.escapeHTML(label)}</span><strong>${utils.escapeHTML(value)}</strong></span>`;
  }

  function nodeLabel(node) {
    return String(node?.name || node?.id || "Node");
  }

  function formatLastSeen(value) {
    if (!value) return "";
    return utils.relativeTime(value) || String(value);
  }

  global.CodexNodesPage = { refresh: refreshNodes };
})(window);
