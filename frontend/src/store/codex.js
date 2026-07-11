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
      threadEventSource: null,
      threadListEventSource: null,
    };
  }

  global.CodexPanelStore = {
    createCodexPanelState,
  };
})(window);
