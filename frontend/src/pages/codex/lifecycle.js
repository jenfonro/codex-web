"use strict";

(function defineCodexPanelLifecycle(global) {
  const activityTypes = new Set([
    "reasoning",
    "commandExecution",
    "mcpToolCall",
    "dynamicToolCall",
    "webSearch",
    "imageView",
  ]);

  function isTurnRunning(turn) {
    return turn.status === "inProgress";
  }

  function isCurrentItem(ref) {
    return isTurnRunning(ref.turn) && ref.itemIndex === ref.turn.items.length - 1;
  }

  function isStreamingAssistant(ref) {
    return ref.item.type === "agentMessage" && isCurrentItem(ref);
  }

  function isActivityItem(ref) {
    return activityTypes.has(ref.item.type);
  }

  function isItemPending(ref) {
    if (ref.item.type === "reasoning" || ref.item.type === "agentMessage") {
      return isCurrentItem(ref);
    }
    if (ref.item.type === "commandExecution" || ref.item.type === "fileChange" || ref.item.type === "mcpToolCall" || ref.item.type === "dynamicToolCall") {
      return ref.item.status === "inProgress";
    }
    return false;
  }

  global.CodexPanelLifecycle = {
    isTurnRunning,
    isStreamingAssistant,
    isActivityItem,
    isItemPending,
  };
})(window);
