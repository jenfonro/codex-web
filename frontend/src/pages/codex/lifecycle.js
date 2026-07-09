"use strict";

(function defineCodexPanelLifecycle(global) {
  const activityKinds = ["turn_started", "reasoning", "tool_call"];
  const defaultPendingActivityKinds = ["turn_started", "reasoning"];
  const terminalStatuses = ["completed", "error", "interrupted", "idle"];

  function eventKind(event, defaultKind = "") {
    return String(event?.kind || defaultKind || "");
  }

  function eventStatus(event) {
    return String(event?.data?.status || "").toLowerCase();
  }

  function isRunningStatus(status) {
    return String(status || "").toLowerCase() === "running";
  }

  function isTerminalStatus(status) {
    return terminalStatuses.includes(String(status || "").toLowerCase());
  }

  function isActivityEvent(event) {
    return activityKinds.includes(eventKind(event));
  }

  function isActivityPending(event) {
    if (!isActivityEvent(event)) return false;
    const status = eventStatus(event);
    if (isRunningStatus(status)) return true;
    if (isTerminalStatus(status)) return false;
    return defaultPendingActivityKinds.includes(eventKind(event));
  }

  global.CodexPanelLifecycle = {
    eventKind,
    eventStatus,
    isActivityEvent,
    isActivityPending,
  };
})(window);
