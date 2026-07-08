"use strict";

(function bootstrapCodexGitPage(global) {
  const api = global.CodexPanelAPI;
  const store = global.CodexPanelStore;
  const utils = global.CodexPanelUtils;
  const panel = document.getElementById("gitPanel");
  if (!panel || !api || !store || !utils) return;

  const state = {
    node: null,
    nodes: [],
    cwd: "",
    metadata: null,
    status: null,
    summary: null,
    loading: false,
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
    global.addEventListener("codex-web:view-changed", handleViewChanged);
    global.addEventListener("codex-web:node-selected", () => {
      state.cwd = "";
      if (isActive()) void refreshGit();
    });
    render();
    if (isActive()) void refreshGit();
  }

  function handleViewChanged(event) {
    if (event.detail?.view === "git") {
      void refreshGit();
    }
  }

  function handleClick(event) {
    const action = event.target.closest("[data-git-action]");
    if (!action) return;
    if (action.dataset.gitAction === "refresh") {
      void refreshGit();
    }
  }

  async function refreshGit() {
    state.loading = true;
    state.error = "";
    render();
    try {
      await loadNode();
      if (!state.node?.online) {
        state.metadata = null;
        state.status = null;
        state.summary = null;
        state.loaded = true;
        state.error = state.node ? `Node "${nodeLabel(state.node)}" is offline.` : "No online node is selected.";
        return;
      }
      state.cwd = state.cwd || state.node.rootDir || "";
      const [metadata, status, summary] = await Promise.all([
        gitRequest("branch-metadata"),
        gitRequest("status-summary"),
        gitRequest("review-summary", { includeUntrackedFiles: true }),
      ]);
      state.metadata = normalizeMetadata(metadata);
      state.status = normalizeStatus(status);
      state.summary = normalizeSummary(summary);
      state.loaded = true;
      const error = state.status?.type === "error" ? state.status.error : "";
      state.error = error ? `Unable to read git status: ${error}` : "";
    } catch (error) {
      state.metadata = null;
      state.status = null;
      state.summary = null;
      state.error = `Unable to load git status: ${error.message}`;
    } finally {
      state.loading = false;
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

  async function gitRequest(method, params = {}) {
    return api.fetchJSON("/api/git", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nodeId: state.node.id,
        method,
        params: {
          cwd: state.cwd || state.node.rootDir || "",
          ...params,
        },
      }),
    });
  }

  function render() {
    const counts = state.status?.stageCounts || {};
    const files = state.summary?.files || [];
    panel.innerHTML = `
      <div class="git-view" data-git-loaded="${state.loaded ? "true" : "false"}">
        <div class="git-toolbar">
          <div class="git-title-block">
            <span class="git-title">${utils.escapeHTML(state.metadata?.currentBranch || "Source Control")}</span>
            <span class="git-subtitle">${utils.escapeHTML(state.metadata?.gitRoot || state.cwd || state.node?.rootDir || "Select an online node")}</span>
          </div>
          <button type="button" class="git-icon-button codicon codicon-refresh" data-git-action="refresh" aria-label="Refresh git status" title="Refresh git status"${state.loading ? " disabled" : ""}></button>
        </div>
        <div class="git-summary-row">
          ${renderCount("Staged", counts.staged)}
          ${renderCount("Changed", counts.unstaged)}
          ${renderCount("Untracked", counts.untracked)}
        </div>
        ${renderBranchMeta()}
        ${state.error ? `<div class="git-error" role="alert">${utils.escapeHTML(state.error)}</div>` : ""}
        <div class="git-file-list" role="list" aria-label="Changed files">
          ${renderBody(files)}
        </div>
      </div>`;
  }

  function renderBranchMeta() {
    const items = [
      ["Default", state.metadata?.defaultBranch],
      ["Upstream", state.metadata?.upstreamBranch],
      ["Base", state.metadata?.baseBranch],
    ].filter(([, value]) => value);
    if (!items.length) return "";
    return `<div class="git-branch-meta">${items.map(([label, value]) => `<span class="git-meta-pill"><span>${utils.escapeHTML(label)}</span><strong>${utils.escapeHTML(value)}</strong></span>`).join("")}</div>`;
  }

  function renderBody(files) {
    if (state.loading && !state.loaded) {
      return Array.from({ length: 6 }, (_, index) => `<div class="git-file-row git-row-skeleton" role="listitem" aria-hidden="true" style="--git-delay:${index};"></div>`).join("");
    }
    if (!files.length) {
      return `<div class="git-empty" role="status"><span class="codicon codicon-check" aria-hidden="true"></span><span>No changed files.</span></div>`;
    }
    return files.map(renderFile).join("");
  }

  function renderFile(file) {
    const change = file.changeType || "modified";
    const added = Number(file.additions || 0);
    const deleted = Number(file.deletions || 0);
    return `
      <div class="git-file-row" role="listitem" title="${utils.escapeAttr(file.path)}">
        <span class="codicon ${change === "untracked" ? "codicon-untracked" : "codicon-diff-modified"} git-file-icon" aria-hidden="true"></span>
        <span class="git-file-main">
          <span class="git-file-name">${utils.escapeHTML(file.path.split("/").pop() || file.path)}</span>
          <span class="git-file-path">${utils.escapeHTML(file.path)}</span>
        </span>
        <span class="git-file-stats">${added ? `+${added}` : ""}${added && deleted ? " " : ""}${deleted ? `-${deleted}` : ""}</span>
      </div>`;
  }

  function renderCount(label, value) {
    return `<span class="git-count"><strong>${Number(value || 0)}</strong><span>${utils.escapeHTML(label)}</span></span>`;
  }

  function normalizeMetadata(value) {
    if (!value || typeof value !== "object") return {};
    return {
      currentBranch: stringOrEmpty(value.currentBranch),
      defaultBranch: stringOrEmpty(value.defaultBranch),
      baseBranch: stringOrEmpty(value.baseBranch),
      upstreamBranch: stringOrEmpty(value.upstreamBranch),
      gitRoot: stringOrEmpty(value.gitRoot),
    };
  }

  function normalizeStatus(value) {
    if (!value || typeof value !== "object") return { stageCounts: {} };
    return {
      type: stringOrEmpty(value.type || "success"),
      error: stringOrEmpty(value.error),
      hasChanges: Boolean(value.hasChanges),
      stageCounts: value.stageCounts && typeof value.stageCounts === "object" ? value.stageCounts : {},
    };
  }

  function normalizeSummary(value) {
    if (!value || typeof value !== "object") return { files: [] };
    return {
      type: stringOrEmpty(value.type || "success"),
      files: Array.isArray(value.files) ? value.files.map(normalizeFile).filter(Boolean) : [],
    };
  }

  function normalizeFile(value) {
    if (!value || typeof value !== "object") return null;
    const path = stringOrEmpty(value.path || value.gitPath);
    if (!path) return null;
    return {
      path,
      additions: Number(value.additions || 0) || 0,
      deletions: Number(value.deletions || 0) || 0,
      changeType: stringOrEmpty(value.changeType || "modified"),
    };
  }

  function stringOrEmpty(value) {
    return value == null ? "" : String(value);
  }

  function nodeLabel(node) {
    return String(node?.name || node?.id || "Node");
  }

  function isActive() {
    return !panel.hidden;
  }

  global.CodexGitPage = { refresh: refreshGit };
})(window);
