"use strict";

(function defineCodexAppFrame(global) {
  const IDS = {
    root: "codexAppRoot",
    panel: "codexPanel",
    sidebarResizeHandle: "codexSidebarResizeHandle",
  };

  const railItems = [
    { label: "Sessions", icon: "history" },
    { label: "Search", icon: "target" },
    { label: "Nodes", icon: "localMode" },
    { label: "Git", icon: "branchMessage" },
    { label: "Runs", icon: "plan" },
    { label: "Codex", icon: "blossom", active: true },
  ];

  const footerItems = [
    { label: "Account", icon: "shield" },
    { label: "Settings", icon: "settings" },
  ];

  const statusLeftItems = [
    { id: "codex.status.node", label: "controller", icon: "localMode" },
    { id: "codex.status.sessions", label: "Session problems", text: "0 / 0" },
    { id: "codex.status.streams", label: "Active streams", text: "0" },
  ];

  const statusRightItems = [
    { id: "codex.status.mode", label: "Mode", text: "Codex Web" },
    { id: "codex.status.agent", label: "Agent", icon: "target", text: "online" },
  ];

  function render(target = document.getElementById(IDS.root)) {
    if (!target || target.dataset.codexAppFrameRendered === "true") return;
    target.innerHTML = renderAppFrame();
    target.dataset.codexAppFrameRendered = "true";
  }

  function renderAppFrame() {
    return `
      <div class="codex-app-frame" role="application" aria-label="Codex Web">
        ${renderTopbar()}
        <main class="codex-app-main" aria-label="Codex Web">
          ${renderRail()}
          ${renderSidebar()}
          <div class="codex-sidebar-resize" id="${IDS.sidebarResizeHandle}" role="separator" aria-orientation="vertical" aria-label="Resize Codex sidebar" tabindex="0"></div>
          ${renderSurface()}
        </main>
        ${renderStatusbar()}
      </div>`;
  }

  function renderTopbar() {
    return `
      <header class="codex-topbar" id="codexTopbar">
        <div class="codex-topbar-left">
          <span class="codex-app-mark" aria-hidden="true">${icon("blossom", "codex-app-mark-icon")}</span>
          ${renderIconButton("Back", "back", "codex-topbar-button is-disabled", true)}
          ${renderIconButton("Forward", "chevronRight", "codex-topbar-button is-disabled", true)}
        </div>
        <div class="codex-topbar-center">
          <button type="button" class="codex-command-center" aria-label="Open command center">
            <span class="codex-command-path">root</span>
          </button>
          <div class="codex-agent-pill" aria-label="Agent status">
            <button type="button" class="codex-agent-path">root</button>
            <button type="button" class="codex-agent-count" aria-label="Unread sessions">
              <span class="codex-agent-dot" aria-hidden="true"></span>
              <span>2</span>
            </button>
            <button type="button" class="codex-agent-action" aria-label="Switch chat">
              ${icon("newChat", "codex-icon")}
              ${icon("chevron20x21", "codex-icon codex-icon-xs")}
            </button>
          </div>
        </div>
        <div class="codex-topbar-right">
          ${renderIconButton("Layout", "plan", "codex-topbar-button")}
          ${renderIconButton("Sidebar", "localMode", "codex-topbar-button is-active")}
          ${renderIconButton("Settings", "settings", "codex-topbar-button")}
        </div>
      </header>`;
  }

  function renderRail() {
    return `
      <nav class="codex-rail" id="codexActivityRail" aria-label="Codex navigation">
        <button type="button" class="codex-rail-menu" aria-label="Application menu">${icon("more21", "codex-icon")}</button>
        <div class="codex-rail-primary" role="tablist">
          ${railItems.map(renderRailItem).join("")}
        </div>
        <div class="codex-rail-footer" role="toolbar" aria-label="Codex footer">
          ${footerItems.map(renderFooterItem).join("")}
        </div>
      </nav>`;
  }

  function renderRailItem(item) {
    const activeClass = item.active ? " is-active" : "";
    const selected = item.active ? "true" : "false";
    return `
      <button type="button" class="codex-rail-item${activeClass}" role="tab" aria-selected="${selected}" aria-label="${item.label}">
        ${icon(item.icon, "codex-rail-icon")}
        <span class="codex-rail-active-indicator" aria-hidden="true"></span>
      </button>`;
  }

  function renderFooterItem(item) {
    return `
      <button type="button" class="codex-rail-item" aria-label="${item.label}">
        ${icon(item.icon, "codex-rail-icon")}
      </button>`;
  }

  function renderSidebar() {
    return `
      <aside class="codex-sidebar" id="codexSidebar" aria-label="Codex">
        <div class="codex-sidebar-header">
          <h1>CODEX</h1>
          <button type="button" class="codex-sidebar-menu" aria-label="More Codex actions">${icon("more21", "codex-icon")}</button>
        </div>
        <div class="codex-sidebar-content">
          <div id="${IDS.panel}" class="codex-panel-frame" aria-label="Codex"></div>
        </div>
      </aside>`;
  }

  function renderSurface() {
    return `
      <section class="codex-surface" id="codexAgentSurface" role="main" aria-label="Agent preview">
        <div class="codex-surface-tabs">
          <div class="codex-surface-tab is-active">
            ${icon("cursor", "codex-icon codex-icon-sm")}
            <span>Agent</span>
            <button type="button" class="codex-surface-close" aria-label="Close">${icon("closeCircle", "codex-icon codex-icon-xs")}</button>
          </div>
        </div>
        <div class="codex-surface-body">
          <div class="codex-surface-watermark" aria-hidden="true">${icon("blossom", "codex-surface-mark")}</div>
          <dl class="codex-shortcuts">
            ${renderShortcut("Open Codex", ["Ctrl", "Alt", "I"])}
            ${renderShortcut("Command palette", ["Ctrl", "Shift", "P"])}
            ${renderShortcut("Search sessions", ["Ctrl", "Shift", "F"])}
          </dl>
        </div>
      </section>`;
  }

  function renderShortcut(label, keys) {
    return `
      <div class="codex-shortcut-row">
        <dt>${label}</dt>
        <dd>${keys.map((key) => `<kbd>${key}</kbd>`).join("<span>+</span>")}</dd>
      </div>`;
  }

  function renderStatusbar() {
    return `
      <footer class="codex-statusbar" id="codexStatusbar" role="status" aria-live="off">
        <div class="codex-statusbar-left">
          ${statusLeftItems.map(renderStatusItem).join("")}
        </div>
        <div class="codex-statusbar-right">
          ${statusRightItems.map(renderStatusItem).join("")}
        </div>
      </footer>`;
  }

  function renderStatusItem(item) {
    return `
      <button type="button" class="codex-status-item" id="${item.id}" aria-label="${item.label}">
        ${item.icon ? icon(item.icon, "codex-status-icon") : ""}
        ${item.text ? `<span>${item.text}</span>` : ""}
      </button>`;
  }

  function renderIconButton(label, iconName, className, disabled = false) {
    const disabledAttr = disabled ? ' aria-disabled="true" tabindex="-1"' : "";
    return `<button type="button" class="${className}" aria-label="${label}"${disabledAttr}>${icon(iconName, "codex-icon")}</button>`;
  }

  function icon(name, className = "codex-icon") {
    return global.CodexIcons?.svg(name, className, { ariaHidden: true }) || "";
  }

  global.CodexAppFrame = { IDS, render };
})(window);
