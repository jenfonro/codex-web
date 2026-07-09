"use strict";

(function defineCodexPanelLifecycle(global) {
  const utils = global.CodexPanelUtils;

  const activityKinds = ["turn_started", "reasoning", "tool_call", "stdout", "stderr"];
  const defaultPendingActivityKinds = ["turn_started", "reasoning"];
  const controlKinds = ["turn_completed", "thread_started", "thread_status"];
  const runningStatuses = ["pending", "running", "active", "starting"];
  const terminalStatuses = ["completed", "complete", "done", "succeeded", "success", "failed", "error", "cancelled", "canceled", "skipped"];

  function eventKind(event, fallback = "") {
    return String(event?.kind || fallback || "");
  }

  function eventStatus(event) {
    return String(event?.status || event?.data?.status || "").toLowerCase();
  }

  function isRunningStatus(status) {
    return runningStatuses.includes(String(status || "").toLowerCase());
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

  function isControlEvent(event) {
    if (isFinalAssistantEvent(event) && !assistantEventHasContent(event)) return true;
    return controlKinds.includes(eventKind(event));
  }

  function assistantEventHasContent(event) {
    return eventKind(event) === "assistant_message" && Boolean(String(event?.text || utils.assistantTextFromData(event?.data)).trim());
  }

  function isFinalAssistantEvent(event) {
    return eventKind(event) === "assistant_message" && event?.data?.phase === "final_answer";
  }

  function isTurnSettlingEvent(event) {
    const kind = eventKind(event);
    if (kind === "turn_completed" || kind === "error") return true;
    return assistantEventHasContent(event) || isFinalAssistantEvent(event);
  }

  function isEmptyTransientActivity(event) {
    const kind = eventKind(event);
    if (kind !== "turn_started" && kind !== "reasoning") return false;
    return !String(event?.text || utils.assistantTextFromData(event?.data)).trim();
  }

  function isPreUserTurnSignal(event) {
    return isControlEvent(event) || isEmptyTransientActivity(event);
  }

  function sessionStatusFromEvent(event, fallback = "idle") {
    const kind = eventKind(event);
    if (kind === "error") return "error";
    if (kind === "turn_completed" || assistantEventHasContent(event) || isFinalAssistantEvent(event)) return "idle";
    if (kind === "user_message") return "running";
    if (isActivityPending(event)) return "running";
    if (isActivityEvent(event)) return fallback || "idle";

    const status = eventStatus(event);
    if (isRunningStatus(status)) return "running";
    if (isTerminalStatus(status)) return fallback || "idle";
    return fallback || "idle";
  }

  function visibleConversationEvents(events) {
    const visible = [];
    let turnEvents = [];

    const flushTurnEvents = (beforeUser = false) => {
      if (!turnEvents.length) return;
      if (beforeUser && turnEvents.every(isPreUserTurnSignal)) {
        turnEvents = [];
        return;
      }
      const settled = turnEvents.some(isTurnSettlingEvent);
      for (const event of turnEvents) {
        if (isControlEvent(event)) continue;
        if (settled && (isActivityPending(event) || isEmptyTransientActivity(event))) continue;
        visible.push(event);
      }
      turnEvents = [];
    };

    for (const event of Array.isArray(events) ? events : []) {
      if (eventKind(event, "assistant_message") === "user_message") {
        flushTurnEvents(true);
        visible.push(event);
        continue;
      }
      turnEvents.push(event);
    }
    flushTurnEvents();

    return visible;
  }

  global.CodexPanelLifecycle = {
    eventKind,
    eventStatus,
    isActivityEvent,
    isActivityPending,
    isControlEvent,
    isTurnSettlingEvent,
    sessionStatusFromEvent,
    visibleConversationEvents,
  };
})(window);
