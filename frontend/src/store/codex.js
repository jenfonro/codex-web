"use strict";

(function defineCodexPanelStore(global) {
  const NODE_STORAGE_KEY = "codex-web:node-id";

  function createCodexPanelState() {
    return {
      view: "list",
      nodeId: getStoredNodeId(),
      nodes: [],
      apiAvailable: false,
      apiError: "",
      popover: "",
      sessions: [],
      activeSessionId: "",
      eventsBySession: new Map(),
      eventPagesBySession: new Map(),
      fileDetailRequests: new Set(),
      threadWindows: new Map(),
      disclosures: new Map(),
      pendingThreadScrollIntent: null,
      eventSource: null,
      eventSourceReconnectDelay: 0,
      eventSourceReconnectTimer: 0,
      eventSourceSessionId: "",
      nodeEventSource: null,
      nodeEventSourceReconnectDelay: 0,
      nodeEventSourceReconnectTimer: 0,
    };
  }

  function getStoredNodeId() {
    return global.localStorage.getItem(NODE_STORAGE_KEY) || "";
  }

  function setStoredNodeId(nodeId) {
    global.localStorage.setItem(NODE_STORAGE_KEY, nodeId);
  }

  function knownLastSeq(state, sessionId) {
    const events = state.eventsBySession?.get(sessionId) || [];
    const eventLastSeq = events.reduce((latest, event) => Math.max(latest, Number(event?.seq || 0)), 0);
    const pageLastSeq = Number(state.eventPagesBySession?.get(sessionId)?.lastSeq || 0);
    const sessionLastSeq = Number((state.sessions || []).find((session) => session.id === sessionId)?.lastSeq || 0);
    return Math.max(eventLastSeq, pageLastSeq, sessionLastSeq);
  }

  function nextLocalEventSeq(state, sessionId) {
    return knownLastSeq(state, sessionId) + 1;
  }

  global.CodexPanelStore = {
    createCodexPanelState,
    getStoredNodeId,
    knownLastSeq,
    nextLocalEventSeq,
    setStoredNodeId,
  };
})(window);
