"use strict";

window.CodexWorkspaceInteractions = {
  installNativeDragGuard,
};

initCodexWorkspace();

function initCodexWorkspace() {
  installNativeDragGuard(document);
  window.CodexWorkspaceLayout?.render();
  applyFixedWorkspacePlatformClass();
  initWorkspaceViews();
}

function installNativeDragGuard(root) {
  if (!root || root.__codexNativeDragGuardInstalled) return;
  Object.defineProperty(root, "__codexNativeDragGuardInstalled", {
    value: true,
    configurable: true,
  });

  root.addEventListener("dragstart", blockNativeDrag, true);
  root.addEventListener("dragenter", blockNativeDrag, true);
  root.addEventListener("dragover", blockNativeDrag, true);
  root.addEventListener("drop", blockNativeDrag, true);
}

function blockNativeDrag(event) {
  if (isNativeDragAllowed(event)) return;
  event.preventDefault();
  event.stopPropagation();
  if (event.dataTransfer) {
    try {
      event.dataTransfer.effectAllowed = "none";
      event.dataTransfer.dropEffect = "none";
    } catch {}
  }
}

function isNativeDragAllowed(event) {
  const path = event.composedPath?.() || [event.target];
  return path.some((node) => node?.nodeType === Node.ELEMENT_NODE && node.matches?.("[data-allow-native-drag='true']"));
}

function applyFixedWorkspacePlatformClass() {
  const workbench = document.querySelector(".monaco-workbench");
  if (!workbench) return;
  workbench.classList.remove("linux", "windows", "mac");
  workbench.classList.add("windows");
}

function initWorkspaceViews() {
  const storageKey = "codex-web:workspace-view";
  const views = new Set(["codex", "workspace", "nodes", "git", "runs"]);
  const titles = {
    codex: "CODEX",
    workspace: "WORKSPACE",
    nodes: "NODES",
    git: "SOURCE CONTROL",
    runs: "RUNS",
  };
  const root = document.querySelector(".monaco-workbench");
  const title = document.getElementById(window.CodexWorkspaceLayout?.IDS?.sidebarTitle || "codexSidebarTitle");
  if (!root || !title) return;

  root.addEventListener("click", (event) => {
    const item = event.target.closest("[data-workspace-view]");
    if (!item) return;
    const view = item.dataset.workspaceView || "";
    if (!views.has(view)) return;
    switchWorkspaceView(view, { persist: true });
  });
  window.addEventListener("codex-web:open-view", (event) => {
    const view = event.detail?.view || "";
    if (views.has(view)) switchWorkspaceView(view, { persist: true });
  });

  const saved = window.localStorage.getItem(storageKey);
  switchWorkspaceView(views.has(saved) ? saved : "codex", { persist: false });

  function switchWorkspaceView(view, options = {}) {
    if (!views.has(view)) return;
    if (options.persist) window.localStorage.setItem(storageKey, view);
    root.dataset.workspaceView = view;
    title.textContent = titles[view] || "CODEX";

    for (const panel of document.querySelectorAll("[data-workspace-panel]")) {
      panel.hidden = panel.dataset.workspacePanel !== view;
    }
    for (const item of document.querySelectorAll("[data-workspace-view]")) {
      const active = item.dataset.workspaceView === view;
      item.classList.toggle("checked", active);
      item.setAttribute("aria-expanded", active ? "true" : "false");
      item.setAttribute("aria-selected", active ? "true" : "false");
    }
    window.dispatchEvent(new CustomEvent("codex-web:view-changed", { detail: { view } }));
  }
}
