"use strict";

(function defineCodexPanelConfig(global) {
  const SAMPLE_ATTACHMENT_PLACEHOLDER = "assets/sample-user-attachment.png";
  const ASSET_VERSION = String(global.CODEX_WEB_ASSET_VERSION || "");
  const SHADOW_STYLE_HREFS = [
    "pages/codex/panel-shadow.css",
    "pages/codex/markdown.css",
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
    shadow.appendChild(root);

    return { root, shadow };
  }

  async function loadSampleAttachmentDataURL() {
    try {
      const response = await fetch(SAMPLE_ATTACHMENT_PLACEHOLDER);
      if (!response.ok) return SAMPLE_ATTACHMENT_PLACEHOLDER;
      const blob = await response.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => resolve(String(reader.result || SAMPLE_ATTACHMENT_PLACEHOLDER)), { once: true });
        reader.addEventListener("error", () => resolve(SAMPLE_ATTACHMENT_PLACEHOLDER), { once: true });
        reader.readAsDataURL(blob);
      });
    } catch {
      return SAMPLE_ATTACHMENT_PLACEHOLDER;
    }
  }

  global.CodexPanelConfig = {
    SAMPLE_ATTACHMENT_PLACEHOLDER,
    SHADOW_STYLE_HREFS,
    withAssetVersion,
    createPanelMount,
    loadSampleAttachmentDataURL,
  };
})(window);
