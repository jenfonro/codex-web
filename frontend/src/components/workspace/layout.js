"use strict";

(function defineCodexWorkspaceLayout(global) {
  const IDS = {
    root: "codexWorkspaceRoot",
    panel: "codexPanel",
    sidebarResizeHandle: "codexSidebarResizeHandle",
  };

  const activityItems = [
    { label: "Sessions", icon: "codicon-explorer-view-icon" },
    { label: "Search", icon: "codicon-search-view-icon" },
    { label: "Nodes", icon: "codicon-remote-explorer" },
    { label: "Git", icon: "codicon-source-control-view-icon" },
    { label: "Runs", icon: "codicon-run-view-icon" },
    { label: "Codex", iconClass: "activity-workbench-view-extension-codexSecondaryViewContainer-eba858aa00fa38501c2916b4309e17680d24d5c3 uri-icon", active: true },
  ];

  const footerItems = [
    { label: "Account", icon: "codicon-accounts-view-bar-icon" },
    { label: "Settings", icon: "codicon-settings-view-bar-icon" },
  ];

  const titleActions = [
    { label: "Workspace layout", icon: "codicon-configure-layout-icon", active: false },
    { label: "Toggle sidebar", icon: "codicon-panel-left", active: true },
    { label: "Toggle lower panel", icon: "codicon-panel-layout-icon-off", active: false },
    { label: "Toggle assistant panel", icon: "codicon-auxiliarybar-right-off-layout-icon", active: false },
  ];

  const statusLeftItems = [
    { id: "codex.status.node", label: "controller", icon: "codicon-remote", text: "" },
    { id: "codex.status.sessions", label: "No session problems", icon: "codicon-error", text: "0", afterIcon: "codicon-warning", afterText: "0" },
    { id: "codex.status.streams", label: "No active streams", icon: "codicon-radio-tower", text: "0" },
  ];

  const statusRightItems = [
    { id: "codex.status.notifications", label: "Notifications", icon: "codicon-bell", text: "" },
    { id: "codex.status.mode", label: "Workspace mode", text: "Codex Web" },
    { id: "codex.status.agent", label: "Agent status", icon: "codicon-copilot", text: "" },
  ];

  function render(target = document.getElementById(IDS.root)) {
    if (!target || target.dataset.codexWorkspaceRendered === "true") return;
    target.innerHTML = renderWorkspace();
    target.dataset.codexWorkspaceRendered = "true";
  }

  function renderWorkspace() {
    return `
      <div class="monaco-enable-motion monaco-workbench windows web chromium nopanel noauxiliarybar fullscreen file-icons-enabled vs vscode-theme-defaults-themes-2026-light-json" role="application" aria-label="Codex Web workspace">
        ${renderTitlebar()}
        <main class="codex-workspace-main" aria-label="Codex Web workspace">
          ${renderActivityBar()}
          ${renderSidebar()}
          <div class="monaco-sash vertical sidebar-resize-handle" id="${IDS.sidebarResizeHandle}" role="separator" aria-orientation="vertical" aria-label="Resize Codex sidebar" tabindex="0"></div>
          ${renderWorkspaceSurface()}
        </main>
        ${renderStatusbar()}
      </div>`;
  }

  function renderTitlebar() {
    return `
      <div class="part titlebar light" id="codexTitlebar" role="none">
        <div class="titlebar-container has-center">
          <div class="titlebar-drag-region"></div>
          <div class="titlebar-left">
            <a class="window-appicon" aria-hidden="true"></a>
            <div class="window-controls-container"></div>
          </div>
          <div class="titlebar-center">
            <div class="window-title">
              <div class="command-center">
                <div class="monaco-toolbar">
                  <div class="monaco-action-bar">
                    <ul class="actions-container" role="toolbar" aria-label="Workspace navigation">
                      ${renderIconAction("Back", "codicon-arrow-left", "disabled menu-entry", "true", "0")}
                      ${renderIconAction("Forward", "codicon-arrow-right", "disabled menu-entry", "true", "-1")}
                      ${renderCommandCenter()}
                      ${renderAgentStatus()}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="titlebar-right">
            <div class="center-adjacent-toolbar-container has-no-actions">
              <div class="monaco-toolbar"><div class="monaco-action-bar"><ul class="actions-container" role="toolbar"></ul></div></div>
            </div>
            <div class="action-toolbar-container">
              <div class="monaco-toolbar">
                <div class="monaco-action-bar">
                  <ul class="actions-container" role="toolbar" aria-label="Workspace actions">
                    ${titleActions.map(renderTitleAction).join("")}
                  </ul>
                </div>
              </div>
            </div>
            <div class="window-controls-container"></div>
          </div>
        </div>
      </div>`;
  }

  function renderIconAction(label, icon, extraClass = "menu-entry", disabled = "false", tabindex = "-1") {
    const disabledClass = disabled === "true" ? " disabled" : "";
    return `
      <li class="action-item ${extraClass}" role="presentation" custom-hover="true">
        <a class="action-label${disabledClass} codicon ${icon}" role="button" aria-label="${label}" aria-disabled="${disabled}" tabindex="${tabindex}"></a>
      </li>`;
  }

  function renderCommandCenter() {
    return `
      <li class="action-item command-center-center" role="presentation" custom-hover="true" tabindex="-1">
        <div class="monaco-toolbar">
          <div class="monaco-action-bar">
            <ul class="actions-container" role="toolbar">
              <li class="action-item command-center-quick-pick compact-mode" role="button" aria-description="Open Codex Web command center" custom-hover="true" tabindex="0">
                <span class="search-label">root</span>
              </li>
            </ul>
          </div>
        </div>
      </li>`;
  }

  function renderAgentStatus() {
    return `
      <li class="action-item agent-status-container" role="toolbar" aria-label="Agent status" tabindex="-1">
        <div class="agent-status-pill chat-input-mode compact-mode">
          <div class="agent-status-input-area" role="button" aria-label="Open quick access" tabindex="0" custom-hover="true">
            <span class="agent-status-label">root</span>
          </div>
          <span class="agent-status-badge-section unread" role="button" tabindex="-1" custom-hover="true">
            <span class="agent-status-icon"><span class="codicon codicon-circle-filled"></span></span>
            <span class="agent-status-text">2</span>
          </span>
          <span class="agent-status-badge-section sparkle monaco-dropdown-with-primary" tabindex="-1">
            <span class="action-container menu-entry" role="button" aria-disabled="false" custom-hover="true">
              <a class="action-label codicon codicon-chat-sparkle" role="button" aria-label="Switch chat"></a>
            </span>
            <span class="dropdown-action-container">
              <span class="monaco-dropdown">
                <span class="dropdown-label">
                  <a class="action-label codicon codicon-chevron-down agent-status-sparkle-dropdown" role="button" aria-haspopup="true" aria-expanded="false" aria-label="More actions" custom-hover="true"></a>
                </span>
              </span>
            </span>
          </span>
        </div>
      </li>`;
  }

  function renderTitleAction(action) {
    const checked = action.active ? " checked" : "";
    const pressed = action.active ? "true" : "false";
    return `
      <li class="action-item menu-entry" role="presentation" custom-hover="true">
        <a class="action-label${checked} codicon ${action.icon}" role="button" aria-label="${action.label}" aria-pressed="${pressed}" tabindex="-1"></a>
      </li>`;
  }

  function renderActivityBar() {
    return `
      <nav class="part activitybar left bordered" id="codexActivityRail" role="none">
        <div class="content">
          <div class="menubar compact overflow-menu-only" role="menubar">
            <div class="menubar-menu-button" role="menuitem" tabindex="0" aria-label="Application menu" aria-haspopup="true">
              <div class="menubar-menu-title toolbar-toggle-more codicon codicon-menubar-more" role="none" aria-hidden="true"></div>
            </div>
          </div>
          <div class="composite-bar">
            <div class="monaco-action-bar vertical">
              <ul class="actions-container" role="tablist" aria-label="Workspace navigation">
                ${activityItems.map(renderActivityItem).join("")}
              </ul>
            </div>
          </div>
          <div class="activitybar-bottom">
            <div class="monaco-action-bar vertical">
              <ul class="actions-container" role="toolbar" aria-label="Workspace footer">
                ${footerItems.map(renderFooterActivityItem).join("")}
              </ul>
            </div>
          </div>
        </div>
      </nav>`;
  }

  function renderActivityItem(item) {
    const checked = item.active ? " checked" : "";
    const expanded = item.active ? "true" : "false";
    const selected = item.active ? "true" : "false";
    const iconClass = item.iconClass || `codicon ${item.icon}`;
    return `
      <li class="action-item icon${checked}" role="tab" draggable="${item.active ? "true" : "false"}" aria-label="${item.label}" aria-expanded="${expanded}" aria-selected="${selected}" tabindex="-1" style="--insert-border-color: #202020;">
        <a class="action-label ${iconClass}" aria-label="${item.label}"></a>
        ${item.active ? '<div class="badge" aria-hidden="true" aria-label="Codex" style="display: none;"><div class="badge-content" style="color: rgb(255, 255, 255); background-color: rgb(0, 105, 204);"></div></div>' : ""}
        <div class="active-item-indicator"></div>
      </li>`;
  }

  function renderFooterActivityItem(item) {
    return `
      <li class="action-item icon" role="button" aria-haspopup="true" aria-label="${item.label}" tabindex="-1">
        <a class="action-label codicon ${item.icon}" aria-label="${item.label}"></a>
        <div class="active-item-indicator"></div>
      </li>`;
  }

  function renderSidebar() {
    return `
      <aside class="part sidebar left pane-composite-part" id="codexSidebar" role="none">
        <div class="composite title has-actions">
          <div class="title-label"><h2 custom-hover="true">CODEX</h2></div>
          <div class="title-actions">
            <div class="monaco-toolbar">
              <div class="monaco-action-bar has-overflow">
                <ul class="actions-container" role="toolbar" aria-label="Codex actions">
                  <li class="action-item" role="presentation">
                    <div class="monaco-dropdown"><div class="dropdown-label"><a class="action-label codicon codicon-toolbar-more" role="button" aria-haspopup="true" aria-expanded="false" aria-label="More Codex actions" tabindex="0"></a></div></div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div class="content codex-sidebar-content">
          <div id="${IDS.panel}" class="codex-panel-frame" aria-label="Codex"></div>
        </div>
      </aside>`;
  }

  function renderWorkspaceSurface() {
    return `
      <section class="part editor" id="codexWorkspaceSurface" role="main" aria-label="Workspace preview">
        <div class="content">
          <div class="grid-view-container">
            <div class="editor-group-container active" tabindex="0" aria-label="Workspace surface">
              <div class="title tabs show-file-icons">
                <div class="tabs-and-actions-container tabs-border-bottom">
                  <div class="tabs-container">
                    <div class="tab tab-actions-right sizing-fit active selected tab-border-bottom tab-border-top has-icon">
                      <div class="monaco-icon-label file-icon vscode_getting_started_page-name-file-icon name-file-icon ext-file-icon unknown-lang-file-icon tab-label tab-label-has-badge italic">
                        <div class="monaco-icon-label-container">
                          <span class="monaco-icon-name-container"><a class="label-name"><span class="monaco-highlighted-label">Workspace</span></a></span>
                        </div>
                      </div>
                      <div class="tab-actions">
                        <div class="monaco-action-bar">
                          <ul class="actions-container" role="toolbar" aria-label="Workspace tab actions">
                            <li class="action-item" role="presentation"><a class="action-label codicon codicon-close" role="button" aria-label="Close" tabindex="-1"></a></li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="editor-actions"></div>
                </div>
              </div>
              <div class="editor-container">
                <div class="editor-group-container-toolbar">
                  <div class="monaco-action-bar"><ul class="actions-container highlight-toggled" role="toolbar" aria-label="Workspace actions"></ul></div>
                </div>
                <div class="editor-group-watermark-wrapper">
                  <div class="editor-group-watermark">
                    <div class="watermark-container">
                      <div class="letterpress"></div>
                      <div class="shortcuts">
                        <div class="watermark-box">
                          ${renderShortcut("Open Codex", ["Ctrl", "Alt", "I"])}
                          ${renderShortcut("Command palette", ["Ctrl", "Shift", "P"])}
                          ${renderShortcut("Search sessions", ["Ctrl", "Shift", "F"])}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>`;
  }

  function renderShortcut(label, keys) {
    return `
      <dl>
        <dt>${label}</dt>
        <dd>
          <div class="monaco-keybinding" aria-label="${keys.join("+")}">
            ${keys.map((key, index) => `${index ? '<span class="monaco-keybinding-key-separator">+</span>' : ""}<span class="monaco-keybinding-key">${key}</span>`).join("")}
          </div>
        </dd>
      </dl>`;
  }

  function renderStatusbar() {
    return `
      <footer class="part statusbar status-border-top" id="codexStatusbar" role="status" aria-live="off" tabindex="0">
        <div class="left-items items-container">
          ${statusLeftItems.map((item, index) => renderStatusItem(item, "left", index === 0 ? "first-visible-item" : index === statusLeftItems.length - 1 ? "last-visible-item" : "")).join("")}
        </div>
        <div class="right-items items-container">
          ${statusRightItems.map((item, index) => renderStatusItem(item, "right", index === 0 ? "last-visible-item" : index === statusRightItems.length - 1 ? "first-visible-item" : "")).join("")}
        </div>
      </footer>`;
  }

  function renderStatusItem(item, side, extraClass) {
    return `
      <div class="statusbar-item ${side} ${extraClass}" id="${item.id}" aria-label="${item.label}">
        <a class="statusbar-item-label" role="button" tabindex="-1" aria-label="${item.label}">
          ${item.icon ? `<span class="codicon ${item.icon}"></span>` : ""}${item.text ? ` ${item.text}` : ""}${item.afterIcon ? ` <span class="codicon ${item.afterIcon}"></span>` : ""}${item.afterText ? ` ${item.afterText}` : ""}
        </a>
      </div>`;
  }

  global.CodexWorkspaceLayout = { IDS, render };
})(window);
