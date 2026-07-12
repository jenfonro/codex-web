"use strict";

(function defineCodexPanelStore(global) {
  function createCodexPanelState() {
    return {
      view: "list",
      popover: "",
      modelMenuExpanded: false,
      threads: [],
      turnErrors: [],
      expandedProcessTurns: new Set(),
      activeThreadId: "",
      threadHistory: {
        turns: [],
        loading: false,
      },
      threadEventSource: null,
      threadListEventSource: null,
    };
  }

  global.CodexPanelStore = {
    createCodexPanelState,
  };
})(window);
