"use strict";

(function defineCodexPanelLifecycle(global) {
  const utils = global.CodexPanelUtils;

  const activityKinds = ["turn_started", "reasoning", "tool_call", "stdout", "stderr", "turn_cancelled"];
  const defaultPendingActivityKinds = ["turn_started", "reasoning"];
  const controlKinds = ["turn_completed", "thread_started", "cli_event"];
  const runningStatuses = ["pending", "running", "active", "starting"];
  const terminalStatuses = ["completed", "complete", "done", "succeeded", "success", "failed", "error", "cancelled", "canceled", "interrupted", "stopped", "skipped"];

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
    return eventKind(event) === "assistant_message" && Boolean(assistantEventContent(event));
  }

  function assistantEventContent(event) {
    return String(
      event?.text ||
      event?.html ||
      event?.data?.message ||
      event?.data?.html ||
      utils.assistantTextFromData(event?.data),
    ).trim();
  }

  function isFinalAssistantEvent(event) {
    return eventKind(event) === "assistant_message" && event?.data?.phase === "final_answer";
  }

  function isTurnSettlingEvent(event) {
    const kind = eventKind(event);
    if (kind === "turn_completed" || kind === "turn_cancelled" || kind === "error") return true;
    return assistantEventHasContent(event) || isFinalAssistantEvent(event);
  }

  function callIDFor(event) {
    return String(event?.data?.call_id || event?.data?.callId || event?.call_id || event?.callId || "");
  }

  function resolvedToolCallIDs(events) {
    const ids = new Set();
    for (const event of events) {
      if (eventKind(event) !== "tool_output") continue;
      const callID = callIDFor(event);
      if (callID) ids.add(callID);
    }
    return ids;
  }

  function shouldHideSettledPendingActivity(event, resolvedCalls) {
    if (!isActivityPending(event)) return false;
    if (eventKind(event) !== "tool_call") return true;
    const callID = callIDFor(event);
    return !callID || !resolvedCalls.has(callID);
  }

  function sessionStatusFromEvent(event, fallback = "idle") {
    const kind = eventKind(event);
    if (kind === "error") return "error";
    if (kind === "turn_completed" || kind === "turn_cancelled" || assistantEventHasContent(event) || isFinalAssistantEvent(event)) return "idle";
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

    const flushTurnEvents = () => {
      if (!turnEvents.length) return;
      const settled = turnEvents.some(isTurnSettlingEvent);
      const resolvedCalls = settled ? resolvedToolCallIDs(turnEvents) : new Set();
      for (const event of turnEvents) {
        if (isControlEvent(event)) continue;
        if (settled && shouldHideSettledPendingActivity(event, resolvedCalls)) continue;
        visible.push(event);
      }
      turnEvents = [];
    };

    for (const event of Array.isArray(events) ? events : []) {
      if (eventKind(event, "assistant_message") === "user_message") {
        flushTurnEvents();
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
