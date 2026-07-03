"use strict";

(function defineCodexPanelConfig(global) {
  const USER_ATTACHMENT_PLACEHOLDER = "assets/reference-user-attachment.png";
  const SHADOW_STYLE_HREFS = [
    "assets/code-server-codicon.css",
    "assets/chatgpt/app-main-DH0Qggoi.css",
    "assets/chatgpt/app-shell-DJDX7Pvr.css",
    "assets/chatgpt/at-mention-list-BF8TOyej.css",
    "assets/chatgpt/cmdk-pBm4kpmV.css",
    "assets/chatgpt/composer-CXInBfIq.css",
    "assets/chatgpt/composer-footer-D2K4qkyA.css",
    "assets/chatgpt/composer-top-menu-chrome-EBEHrbNH.css",
    "assets/chatgpt/dialog-layout-sS9Dm_y9.css",
    "assets/chatgpt/diff-unified-updTK7TW.css",
    "assets/chatgpt/dropdown-9F1MU8ql.css",
    "assets/chatgpt/local-conversation-turn-CGBrbw6f.css",
    "assets/chatgpt/local-task-row-Bj9zvK4d.css",
    "assets/chatgpt/markdown-DmSBSKzD.css",
    "assets/chatgpt/progression-donut-BI3OQbB8.css",
    "assets/chatgpt/prompt-editor-BuS6Xjko.css",
    "assets/chatgpt/prosemirror-ptHiDCW_.css",
    "assets/chatgpt/scroll-to-bottom-buton-H4NGgmRi.css",
    "assets/chatgpt/thinking-shimmer-BhOGlSiR.css",
    "assets/chatgpt/thread-page-bottom-panel-state-BrqwKW_G.css",
    "assets/chatgpt/thread-side-panel-tabs-CYswclfQ.css",
    "assets/chatgpt/worktree-init-tool-activities-CxuoHau6.css",
    "assets/chatgpt/codex-panel-vars.css",
    "pages/codex/panel-shadow.css?v=20260704-composer-input",
  ];

  function createPanelMount(host) {
    const shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
    shadow.replaceChildren();

    for (const href of SHADOW_STYLE_HREFS) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
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
    createPanelMount,
    loadReferenceAttachmentDataURL,
  };
})(window);
