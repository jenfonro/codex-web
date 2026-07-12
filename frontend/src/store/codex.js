"use strict";

(function defineCodexPanelStore(global) {
  function createCodexPanelState() {
    return {
      view: "list",
      popover: "",
      modelMenuExpanded: false,
      threads: [],
      turnErrors: [],
      activeThreadId: "",
      threadHistory: {
        turns: [],
        beforeTurnId: null,
        loading: false,
        loadingOlder: false,
      },
      threadEventSource: null,
      threadListEventSource: null,
    };
  }

  global.CodexPanelStore = {
    createCodexPanelState,
  };
})(window);
