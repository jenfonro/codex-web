"use strict";

(function defineCodexPanelStore(global) {
  function createCodexPanelState() {
    return {
      view: "list",
      apiAvailable: false,
      popover: "",
      modelMenuExpanded: false,
      sessions: [],
      activeSessionId: "",
      statesBySession: new Map(),
      appliedSeqBySession: new Map(),
      eventsBySession: new Map(),
      eventPagesBySession: new Map(),
      eventSource: null,
      sessionEventSource: null,
    };
  }

  global.CodexPanelStore = {
    createCodexPanelState,
  };
})(window);
