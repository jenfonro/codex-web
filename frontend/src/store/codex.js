"use strict";

(function defineCodexPanelStore(global) {
  const NODE_STORAGE_KEY = "codex-web:node-id";

  function createCodexPanelState() {
    return {
      view: "list",
      nodeId: getStoredNodeId(),
      apiAvailable: false,
      popover: "",
      sessions: [],
      activeSessionId: "",
      eventsBySession: new Map(),
      eventPagesBySession: new Map(),
      threadWindows: new Map(),
      eventSource: null,
      nodeEventSource: null,
    };
  }

  function getStoredNodeId() {
    return global.localStorage.getItem(NODE_STORAGE_KEY) || "";
  }

  function setStoredNodeId(nodeId) {
    global.localStorage.setItem(NODE_STORAGE_KEY, nodeId);
  }

  global.CodexPanelStore = {
    createCodexPanelState,
    getStoredNodeId,
    setStoredNodeId,
  };
})(window);
