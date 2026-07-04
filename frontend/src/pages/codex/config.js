"use strict";

(function defineCodexPanelConfig(global) {
  const USER_ATTACHMENT_PLACEHOLDER = "assets/reference-user-attachment.png";
  const ASSET_VERSION = String(global.CODEX_WEB_ASSET_VERSION || "");
  const SHADOW_STYLE_HREFS = [
    "assets/workbench/codicon.css",
    "assets/codex-panel/app-main-DH0Qggoi.css",
    "assets/codex-panel/app-shell-DJDX7Pvr.css",
    "assets/codex-panel/at-mention-list-BF8TOyej.css",
    "assets/codex-panel/cmdk-pBm4kpmV.css",
    "assets/codex-panel/composer-CXInBfIq.css",
    "assets/codex-panel/composer-footer-D2K4qkyA.css",
    "assets/codex-panel/composer-top-menu-chrome-EBEHrbNH.css",
    "assets/codex-panel/dialog-layout-sS9Dm_y9.css",
    "assets/codex-panel/diff-unified-updTK7TW.css",
    "assets/codex-panel/dropdown-9F1MU8ql.css",
    "assets/codex-panel/local-conversation-turn-CGBrbw6f.css",
    "assets/codex-panel/local-task-row-Bj9zvK4d.css",
    "assets/codex-panel/markdown-DmSBSKzD.css",
    "assets/codex-panel/progression-donut-BI3OQbB8.css",
    "assets/codex-panel/prompt-editor-BuS6Xjko.css",
    "assets/codex-panel/prosemirror-ptHiDCW_.css",
    "assets/codex-panel/scroll-to-bottom-buton-H4NGgmRi.css",
    "assets/codex-panel/thinking-shimmer-BhOGlSiR.css",
    "assets/codex-panel/thread-page-bottom-panel-state-BrqwKW_G.css",
    "assets/codex-panel/thread-side-panel-tabs-CYswclfQ.css",
    "assets/codex-panel/worktree-init-tool-activities-CxuoHau6.css",
    "assets/codex-panel/codex-panel-vars.css",
    "pages/codex/panel-shadow.css",
  ];

  function withAssetVersion(href) {
    if (!ASSET_VERSION || href.startsWith("data:") || /[?&]v=/.test(href)) {
      return href;
    }
    return `${href}${href.includes("?") ? "&" : "?"}v=${encodeURIComponent(ASSET_VERSION)}`;
  }

  function createPanelMount(host) {
    const shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
    shadow.replaceChildren();

    for (const href of SHADOW_STYLE_HREFS) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = withAssetVersion(href);
      shadow.appendChild(link);
    }

    const root = document.createElement("div");
    root.id = "root";
    root.dir = "ltr";
    root.setAttribute("data-codex-window-type", "extension");
    root.setAttribute("data-window-type", "extension");
    root.setAttribute("data-codex-os", "win32");
    root.setAttribute("data-codex-window-chrome", "native");
    shadow.appendChild(root);

    return { root, shadow };
  }

  async function loadReferenceAttachmentDataURL() {
    try {
      const response = await fetch(USER_ATTACHMENT_PLACEHOLDER);
      if (!response.ok) return USER_ATTACHMENT_PLACEHOLDER;
      const blob = await response.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => resolve(String(reader.result || USER_ATTACHMENT_PLACEHOLDER)), { once: true });
        reader.addEventListener("error", () => resolve(USER_ATTACHMENT_PLACEHOLDER), { once: true });
        reader.readAsDataURL(blob);
      });
    } catch {
      return USER_ATTACHMENT_PLACEHOLDER;
    }
  }

  global.CodexPanelConfig = {
    USER_ATTACHMENT_PLACEHOLDER,
    SHADOW_STYLE_HREFS,
    withAssetVersion,
    createPanelMount,
    loadReferenceAttachmentDataURL,
  };
})(window);
