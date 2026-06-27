(function () {
  "use strict";

  var vscodeStateKey = "codex-web:vscode-state";
  var deliveredDebugKey = "codex-web:bridge-debug";

  function readState() {
    try {
      var raw = window.localStorage.getItem(vscodeStateKey);
      return raw ? JSON.parse(raw) : undefined;
    } catch (_) {
      return undefined;
    }
  }

  function writeState(value) {
    try {
      if (value === undefined) {
        window.localStorage.removeItem(vscodeStateKey);
      } else {
        window.localStorage.setItem(vscodeStateKey, JSON.stringify(value));
      }
    } catch (_) {
      // VS Code's webview state API is best-effort; keep that behavior here.
    }
  }

  var vscodeState = readState();

  function deliver(message) {
    if (!message || typeof message.type !== "string") {
      return;
    }
    window.postMessage(message, window.location.origin || "*");
  }

  function redirectToLogin() {
    if (window.location.pathname !== "/login.html") {
      window.location.href = "/login.html";
    }
  }

  function debugBridge(message, value) {
    try {
      if (window.localStorage.getItem(deliveredDebugKey) === "1") {
        console.debug("[codex-web bridge]", message, value);
      }
    } catch (_) {
      // Debug logging must never affect the extension runtime.
    }
  }

  async function sendToHost(message) {
    try {
      debugBridge("renderer -> host", message);
      var response = await window.fetch("/api/bridge/message", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(message || {}),
      });
      if (response.status === 401) {
        redirectToLogin();
        return;
      }
      if (!response.ok) {
        var text = await response.text();
        throw new Error(text || "bridge request failed");
      }
      var body = await response.json();
      var messages = Array.isArray(body.messages) ? body.messages : [];
      for (var i = 0; i < messages.length; i += 1) {
        debugBridge("host -> renderer", messages[i]);
        deliver(messages[i]);
      }
    } catch (error) {
      console.error("[codex-web bridge] postMessage failed", error);
    }
  }

  function openExternal(url) {
    if (typeof url !== "string" || url.trim() === "") {
      return false;
    }
    try {
      window.open(url, "_blank", "noopener,noreferrer");
      return true;
    } catch (_) {
      return false;
    }
  }

  function handleLocalCommand(message) {
    if (!message || typeof message.type !== "string") {
      return false;
    }
    switch (message.type) {
      case "open-in-browser":
        return openExternal(message.url);
      default:
        return false;
    }
  }

  function installBrowserHostDefaults() {
    var originalMatchMedia =
      typeof window.matchMedia === "function"
        ? window.matchMedia.bind(window)
        : null;
    window.matchMedia = function matchMedia(query) {
      if (typeof query === "string" && query.indexOf("prefers-color-scheme") >= 0) {
        var wantsLight = query.indexOf("light") >= 0;
        return {
          matches: !wantsLight,
          media: query,
          onchange: null,
          addEventListener: function addEventListener() {},
          removeEventListener: function removeEventListener() {},
          addListener: function addListener() {},
          removeListener: function removeListener() {},
          dispatchEvent: function dispatchEvent() {
            return false;
          },
        };
      }
      return originalMatchMedia
        ? originalMatchMedia(query)
        : {
            matches: false,
            media: query,
            onchange: null,
            addEventListener: function addEventListener() {},
            removeEventListener: function removeEventListener() {},
            addListener: function addListener() {},
            removeListener: function removeListener() {},
            dispatchEvent: function dispatchEvent() {
              return false;
            },
          };
    };

    var bridge = window.electronBridge || {};
    bridge.getSystemThemeVariant =
      bridge.getSystemThemeVariant ||
      function getSystemThemeVariant() {
        return "dark";
      };
    bridge.subscribeToSystemThemeVariant =
      bridge.subscribeToSystemThemeVariant ||
      function subscribeToSystemThemeVariant(callback) {
        if (typeof callback === "function") {
          window.setTimeout(function notifyTheme() {
            callback("dark");
          }, 0);
        }
        return function unsubscribe() {};
      };
    bridge.openExternal = bridge.openExternal || openExternal;
    bridge.showOpenDialog =
      bridge.showOpenDialog ||
      async function showOpenDialog() {
        return { canceled: true, filePaths: [] };
      };
    bridge.showSaveDialog =
      bridge.showSaveDialog ||
      async function showSaveDialog() {
        return { canceled: true, filePath: null };
      };
    bridge.clipboard =
      bridge.clipboard ||
      {
        readText: async function readText() {
          if (navigator.clipboard && navigator.clipboard.readText) {
            return navigator.clipboard.readText();
          }
          return "";
        },
        writeText: async function writeText(value) {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(String(value || ""));
          }
        },
      };
    window.electronBridge = bridge;
  }

  function applyThemeDOM() {
    var targets = [document.documentElement, document.body].filter(Boolean);
    for (var i = 0; i < targets.length; i += 1) {
      targets[i].dataset.vscodeThemeKind = "vscode-dark";
      targets[i].classList.add("vscode-dark");
      targets[i].classList.remove("vscode-light", "vscode-high-contrast");
    }
  }

  function installThemeDefaults() {
    applyThemeDOM();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", applyThemeDOM, { once: true });
    }
    var style = document.createElement("style");
    style.textContent = [
      ":root {",
      "  --vscode-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;",
      "  --vscode-editor-font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;",
      "  --vscode-font-size: 13px;",
      "  --vscode-editor-font-size: 13px;",
      "  --vscode-foreground: #cccccc;",
      "  --vscode-icon-foreground: #c5c5c5;",
      "  --vscode-descriptionForeground: #9d9d9d;",
      "  --vscode-disabledForeground: #6a6a6a;",
      "  --vscode-errorForeground: #f48771;",
      "  --vscode-focusBorder: #007fd4;",
      "  --vscode-editor-background: #1e1e1e;",
      "  --vscode-editor-foreground: #d4d4d4;",
      "  --vscode-editor-selectionBackground: #264f78;",
      "  --vscode-editor-inactiveSelectionBackground: #3a3d41;",
      "  --vscode-editor-lineHighlightBorder: #282828;",
      "  --vscode-editorLineNumber-foreground: #858585;",
      "  --vscode-editorLineNumber-activeForeground: #c6c6c6;",
      "  --vscode-editorCursor-foreground: #aeafad;",
      "  --vscode-editorError-foreground: #f14c4c;",
      "  --vscode-editorWarning-foreground: #cca700;",
      "  --vscode-editorInfo-foreground: #3794ff;",
      "  --vscode-editorGroup-border: #2b2b2b;",
      "  --vscode-editorGroup-dropBackground: rgba(83, 89, 93, 0.5);",
      "  --vscode-editorGroup-dropIntoPromptBackground: #252526;",
      "  --vscode-editorGroup-dropIntoPromptForeground: #cccccc;",
      "  --vscode-editorWidget-background: #252526;",
      "  --vscode-editorWidget-border: #454545;",
      "  --vscode-editorHoverWidget-background: #252526;",
      "  --vscode-editorHoverWidget-border: #454545;",
      "  --vscode-editorSuggestWidget-background: #252526;",
      "  --vscode-editorSuggestWidget-border: #454545;",
      "  --vscode-editorSuggestWidget-selectedBackground: #04395e;",
      "  --vscode-editorGutter-addedBackground: #587c0c;",
      "  --vscode-editorGutter-modifiedBackground: #0c7d9d;",
      "  --vscode-editorGutter-deletedBackground: #94151b;",
      "  --vscode-terminal-background: #1e1e1e;",
      "  --vscode-terminal-border: #2b2b2b;",
      "  --vscode-terminal-foreground: #cccccc;",
      "  --vscode-terminal-selectionBackground: #264f78;",
      "  --vscode-terminal-inactiveSelectionBackground: #3a3d41;",
      "  --vscode-terminal-ansiBlack: #000000;",
      "  --vscode-terminal-ansiRed: #cd3131;",
      "  --vscode-terminal-ansiGreen: #0dbc79;",
      "  --vscode-terminal-ansiYellow: #e5e510;",
      "  --vscode-terminal-ansiBlue: #2472c8;",
      "  --vscode-terminal-ansiMagenta: #bc3fbc;",
      "  --vscode-terminal-ansiCyan: #11a8cd;",
      "  --vscode-terminal-ansiWhite: #e5e5e5;",
      "  --vscode-terminal-ansiBrightBlack: #666666;",
      "  --vscode-terminal-ansiBrightRed: #f14c4c;",
      "  --vscode-terminal-ansiBrightGreen: #23d18b;",
      "  --vscode-terminal-ansiBrightYellow: #f5f543;",
      "  --vscode-terminal-ansiBrightBlue: #3b8eea;",
      "  --vscode-terminal-ansiBrightMagenta: #d670d6;",
      "  --vscode-terminal-ansiBrightCyan: #29b8db;",
      "  --vscode-terminal-ansiBrightWhite: #e5e5e5;",
      "  --vscode-sideBar-background: #181818;",
      "  --vscode-sideBar-foreground: #cccccc;",
      "  --vscode-sideBar-border: #2b2b2b;",
      "  --vscode-sideBarTitle-background: #181818;",
      "  --vscode-sideBarTitle-foreground: #cccccc;",
      "  --vscode-sideBarSectionHeader-background: #181818;",
      "  --vscode-sideBarSectionHeader-foreground: #cccccc;",
      "  --vscode-sideBarSectionHeader-border: #2b2b2b;",
      "  --vscode-activityBar-background: #181818;",
      "  --vscode-activityBar-foreground: #ffffff;",
      "  --vscode-activityBar-inactiveForeground: #868686;",
      "  --vscode-activityBar-border: #2b2b2b;",
      "  --vscode-panel-background: #1e1e1e;",
      "  --vscode-panel-border: #2b2b2b;",
      "  --vscode-input-background: #313131;",
      "  --vscode-input-foreground: #cccccc;",
      "  --vscode-input-border: #3c3c3c;",
      "  --vscode-input-placeholderForeground: #989898;",
      "  --vscode-inputValidation-errorBackground: #5a1d1d;",
      "  --vscode-inputValidation-errorBorder: #be1100;",
      "  --vscode-inputValidation-infoBackground: #063b49;",
      "  --vscode-inputValidation-warningBackground: #352a05;",
      "  --vscode-inputValidation-warningBorder: #b89500;",
      "  --vscode-button-background: #0e639c;",
      "  --vscode-button-foreground: #ffffff;",
      "  --vscode-button-hoverBackground: #1177bb;",
      "  --vscode-button-border: transparent;",
      "  --vscode-button-secondaryBackground: #3a3d41;",
      "  --vscode-button-secondaryForeground: #ffffff;",
      "  --vscode-button-secondaryHoverBackground: #45494e;",
      "  --vscode-list-hoverBackground: #2a2d2e;",
      "  --vscode-list-activeSelectionBackground: #04395e;",
      "  --vscode-list-activeSelectionForeground: #ffffff;",
      "  --vscode-list-activeSelectionIconForeground: #ffffff;",
      "  --vscode-list-inactiveSelectionBackground: #37373d;",
      "  --vscode-list-inactiveSelectionForeground: #cccccc;",
      "  --vscode-list-focusOutline: #007fd4;",
      "  --vscode-list-highlightForeground: #2aaaff;",
      "  --vscode-badge-background: #4d4d4d;",
      "  --vscode-badge-foreground: #ffffff;",
      "  --vscode-textLink-foreground: #3794ff;",
      "  --vscode-textLink-activeForeground: #4daafc;",
      "  --vscode-textBlockQuote-background: #252526;",
      "  --vscode-textCodeBlock-background: #2a2a2a;",
      "  --vscode-textPreformat-background: #2a2a2a;",
      "  --vscode-textPreformat-foreground: #d4d4d4;",
      "  --vscode-widget-shadow: rgba(0, 0, 0, 0.36);",
      "  --vscode-widget-border: #454545;",
      "  --vscode-dropdown-background: #3c3c3c;",
      "  --vscode-dropdown-foreground: #f0f0f0;",
      "  --vscode-dropdown-border: #3c3c3c;",
      "  --vscode-menu-background: #252526;",
      "  --vscode-menu-foreground: #cccccc;",
      "  --vscode-menu-border: #454545;",
      "  --vscode-menu-selectionBackground: #04395e;",
      "  --vscode-menu-selectionForeground: #ffffff;",
      "  --vscode-menubar-selectionBackground: #04395e;",
      "  --vscode-menubar-selectionForeground: #ffffff;",
      "  --vscode-checkbox-background: #313131;",
      "  --vscode-checkbox-border: #3c3c3c;",
      "  --vscode-checkbox-foreground: #cccccc;",
      "  --vscode-radio-activeForeground: #ffffff;",
      "  --vscode-radio-activeBackground: #0e639c;",
      "  --vscode-radio-activeBorder: #0e639c;",
      "  --vscode-radio-inactiveBorder: #3c3c3c;",
      "  --vscode-progressBar-background: #0e70c0;",
      "  --vscode-toolbar-hoverBackground: rgba(90, 93, 94, 0.31);",
      "  --vscode-scrollbarSlider-background: rgba(121, 121, 121, 0.4);",
      "  --vscode-scrollbarSlider-hoverBackground: rgba(100, 100, 100, 0.7);",
      "  --vscode-scrollbarSlider-activeBackground: rgba(191, 191, 191, 0.4);",
      "  --vscode-charts-foreground: #cccccc;",
      "  --vscode-charts-lines: rgba(204, 204, 204, 0.5);",
      "  --vscode-charts-red: #f14c4c;",
      "  --vscode-charts-blue: #3794ff;",
      "  --vscode-charts-yellow: #cca700;",
      "  --vscode-charts-orange: #d18616;",
      "  --vscode-charts-green: #89d185;",
      "  --vscode-charts-purple: #b180d7;",
      "  --vscode-gitDecoration-addedResourceForeground: #81b88b;",
      "  --vscode-gitDecoration-modifiedResourceForeground: #e2c08d;",
      "  --vscode-gitDecoration-deletedResourceForeground: #c74e39;",
      "  --vscode-gitDecoration-untrackedResourceForeground: #73c991;",
      "  --vscode-gitDecoration-ignoredResourceForeground: #8c8c8c;",
      "  --vscode-gitDecoration-conflictingResourceForeground: #e4676b;",
      "  --vscode-diffEditor-insertedTextBackground: rgba(156, 204, 44, 0.2);",
      "  --vscode-diffEditor-removedTextBackground: rgba(255, 0, 0, 0.2);",
      "  --vscode-diffEditor-insertedLineBackground: rgba(155, 185, 85, 0.2);",
      "  --vscode-diffEditor-removedLineBackground: rgba(255, 0, 0, 0.2);",
      "  --color-background-surface: var(--vscode-editor-background);",
      "  --color-background-surface-under: var(--vscode-sideBar-background);",
      "  --color-background-primary: var(--vscode-editor-background);",
      "  --color-background-secondary: #252526;",
      "  --color-background-tertiary: #2d2d2d;",
      "  --color-background-panel: var(--vscode-panel-background);",
      "  --color-background-control: var(--vscode-input-background);",
      "  --color-background-elevated-primary: #252526;",
      "  --color-background-elevated-secondary: #2d2d2d;",
      "  --color-token-bg-primary: var(--vscode-sideBar-background);",
      "  --color-token-bg-secondary: #1e1e1e;",
      "  --color-token-bg-tertiary: #252526;",
      "  --color-token-bg-fog: rgba(24, 24, 24, 0.8);",
      "  --color-token-main-surface-primary: var(--vscode-editor-background);",
      "  --color-token-side-bar-background: var(--vscode-sideBar-background);",
      "  --color-token-editor-background: var(--vscode-editor-background);",
      "  --color-token-foreground: var(--vscode-foreground);",
      "  --color-token-editor-foreground: var(--vscode-editor-foreground);",
      "  --color-token-text-primary: #f0f0f0;",
      "  --color-token-text-secondary: #c5c5c5;",
      "  --color-token-text-tertiary: #9d9d9d;",
      "  --color-token-description-foreground: var(--vscode-descriptionForeground);",
      "  --color-token-disabled-foreground: var(--vscode-disabledForeground);",
      "  --color-token-icon-foreground: var(--vscode-icon-foreground);",
      "  --color-token-border: #2b2b2b;",
      "  --color-token-border-default: #2b2b2b;",
      "  --color-token-border-light: #313131;",
      "  --color-token-border-heavy: #454545;",
      "  --color-token-link: var(--vscode-textLink-foreground);",
      "  --color-token-text-link-foreground: var(--vscode-textLink-foreground);",
      "  --color-token-text-link-active-foreground: var(--vscode-textLink-activeForeground);",
      "  --color-token-button-background: var(--vscode-button-background);",
      "  --color-token-button-foreground: var(--vscode-button-foreground);",
      "  --color-token-button-border: var(--vscode-button-border);",
      "  --color-token-button-secondary-background: var(--vscode-button-secondaryBackground);",
      "  --color-token-button-secondary-foreground: var(--vscode-button-secondaryForeground);",
      "  --color-token-button-secondary-hover-background: var(--vscode-button-secondaryHoverBackground);",
      "  --color-token-input-background: var(--vscode-input-background);",
      "  --color-token-input-foreground: var(--vscode-input-foreground);",
      "  --color-token-input-border: var(--vscode-input-border);",
      "  --color-token-input-placeholder-foreground: var(--vscode-input-placeholderForeground);",
      "  --color-token-list-hover-background: var(--vscode-list-hoverBackground);",
      "  --color-token-list-active-selection-background: var(--vscode-list-activeSelectionBackground);",
      "  --color-token-list-active-selection-foreground: var(--vscode-list-activeSelectionForeground);",
      "  --color-token-list-active-selection-icon-foreground: var(--vscode-list-activeSelectionIconForeground);",
      "  --color-token-list-focus-outline: var(--vscode-list-focusOutline);",
      "  --color-token-menu-background: var(--vscode-menu-background);",
      "  --color-token-menu-border: var(--vscode-menu-border);",
      "  --color-token-menubar-selection-background: var(--vscode-menubar-selectionBackground);",
      "  --color-token-menubar-selection-foreground: var(--vscode-menubar-selectionForeground);",
      "  --color-token-checkbox-background: var(--vscode-checkbox-background);",
      "  --color-token-checkbox-border: var(--vscode-checkbox-border);",
      "  --color-token-checkbox-foreground: var(--vscode-checkbox-foreground);",
      "  --color-token-radio-active-foreground: var(--vscode-radio-activeForeground);",
      "  --color-token-scrollbar-slider-background: var(--vscode-scrollbarSlider-background);",
      "  --color-token-scrollbar-slider-hover-background: var(--vscode-scrollbarSlider-hoverBackground);",
      "  --color-token-scrollbar-slider-active-background: var(--vscode-scrollbarSlider-activeBackground);",
      "  --color-token-progress-bar-background: var(--vscode-progressBar-background);",
      "  --color-token-toolbar-hover-background: var(--vscode-toolbar-hoverBackground);",
      "  --color-token-terminal-background: var(--vscode-terminal-background);",
      "  --color-token-terminal-foreground: var(--vscode-terminal-foreground);",
      "  --color-token-terminal-border: var(--vscode-terminal-border);",
      "  --color-token-text-code-block-background: var(--vscode-textCodeBlock-background);",
      "  --color-token-text-preformat-background: var(--vscode-textPreformat-background);",
      "  --color-token-text-preformat-foreground: var(--vscode-textPreformat-foreground);",
      "  --color-token-charts-red: var(--vscode-charts-red);",
      "  --color-token-charts-blue: var(--vscode-charts-blue);",
      "  --color-token-charts-yellow: var(--vscode-charts-yellow);",
      "  --color-token-charts-orange: var(--vscode-charts-orange);",
      "  --color-token-charts-green: var(--vscode-charts-green);",
      "  --color-token-charts-purple: var(--vscode-charts-purple);",
      "  --color-token-error-foreground: var(--vscode-errorForeground);",
      "  --color-token-editor-error-foreground: var(--vscode-editorError-foreground);",
      "  --color-token-editor-warning-foreground: var(--vscode-editorWarning-foreground);",
      "  --color-token-editor-info-foreground: var(--vscode-editorInfo-foreground);",
      "}",
      "html, body, #root, .startup-loader {",
      "  background-color: var(--color-background-surface-under) !important;",
      "  color: var(--color-token-foreground);",
      "}",
    ].join("\n");
    document.head.appendChild(style);
  }

  installBrowserHostDefaults();
  installThemeDefaults();

  window.acquireVsCodeApi = function acquireVsCodeApi() {
    return {
      postMessage: function postMessage(message) {
        handleLocalCommand(message);
        sendToHost(message);
      },
      getState: function getState() {
        return vscodeState;
      },
      setState: function setState(nextState) {
        vscodeState = nextState;
        writeState(nextState);
      },
    };
  };

  if (window.EventSource) {
    var events = new window.EventSource("/api/bridge/events");
    events.onmessage = function onBridgeEvent(event) {
      try {
        var message = JSON.parse(event.data);
        debugBridge("sse -> renderer", message);
        deliver(message);
      } catch (error) {
        console.error("[codex-web bridge] invalid SSE message", error);
      }
    };
    events.onerror = function onBridgeError() {
      debugBridge("sse error", null);
    };
  }
})();
