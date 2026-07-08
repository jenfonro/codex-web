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
      eventsBySession: new Map(),
      eventPagesBySession: new Map(),
      threadWindows: new Map(),
      eventSource: null,
      sessionEventSource: null,
    };
  }

  global.CodexPanelStore = {
    createCodexPanelState,
  };
})(window);
