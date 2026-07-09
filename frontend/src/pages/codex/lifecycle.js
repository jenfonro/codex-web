"use strict";

(function defineCodexPanelLifecycle(global) {
  const activityKinds = ["turn_started", "reasoning", "tool_call"];
  const defaultPendingActivityKinds = ["turn_started", "reasoning"];
  const controlKinds = ["turn_completed", "thread_started", "thread_status"];
  const runningStatuses = ["pending", "running", "active", "starting"];
  const terminalStatuses = ["completed", "complete", "done", "succeeded", "success", "failed", "error", "cancelled", "canceled", "skipped"];

  function eventKind(event, fallback = "") {
    return String(event?.kind || fallback || "");
  }

  function eventStatus(event) {
    return String(event?.data?.status || "").toLowerCase();
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
    if (isEmptyAssistantEvent(event)) return true;
    if (isFinalAssistantEvent(event) && !assistantEventHasContent(event)) return true;
    return controlKinds.includes(eventKind(event));
  }

  function isStreamingAssistantEvent(event) {
    return eventKind(event) === "assistant_message" && event?.data?.streaming === true;
  }

  function assistantEventHasContent(event) {
    return eventKind(event) === "assistant_message" && Boolean(String(event?.text || "").trim());
  }

  function isEmptyAssistantEvent(event) {
    return eventKind(event) === "assistant_message" && !assistantEventHasContent(event);
  }

  function isFinalAssistantEvent(event) {
    return eventKind(event) === "assistant_message" && !isStreamingAssistantEvent(event) && event?.data?.phase === "final_answer";
  }

  function isTurnSettlingEvent(event) {
    const kind = eventKind(event);
    if (kind === "turn_completed" || kind === "error") return true;
    return isFinalAssistantEvent(event);
  }

  function isEmptyTransientActivity(event) {
    const kind = eventKind(event);
    if (kind !== "turn_started" && kind !== "reasoning") return false;
    return !String(event?.text || "").trim();
  }

  function isPreUserTurnSignal(event) {
    return isControlEvent(event) || isEmptyTransientActivity(event);
  }

  function sessionStatusFromEvent(event, fallback = "idle") {
    const kind = eventKind(event);
    if (kind === "error") return "error";
    if (isStreamingAssistantEvent(event)) return "running";
    if (kind === "turn_completed" || isFinalAssistantEvent(event)) return "idle";
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
    let pendingPreUserEvents = [];
    let currentTurnEvents = [];

    const pushRenderableTurnEvents = (turnEvents) => {
      const settled = turnEvents.some(isTurnSettlingEvent);
      for (const event of turnEvents) {
        if (isControlEvent(event)) continue;
        if (settled && (isActivityPending(event) || isEmptyTransientActivity(event))) continue;
        visible.push(event);
      }
    };

    const flushPendingPreUserEvents = () => {
      if (!pendingPreUserEvents.length) return;
      if (!pendingPreUserEvents.every(isPreUserTurnSignal)) {
        pushRenderableTurnEvents(pendingPreUserEvents);
      }
      pendingPreUserEvents = [];
    };

    const flushCurrentTurnEvents = () => {
      if (!currentTurnEvents.length) return;
      pushRenderableTurnEvents(currentTurnEvents);
      currentTurnEvents = [];
    };

    for (const event of Array.isArray(events) ? events : []) {
      if (eventKind(event, "assistant_message") === "user_message") {
        flushCurrentTurnEvents();
        const carriedSignals = pendingPreUserEvents.every(isPreUserTurnSignal)
          ? pendingPreUserEvents.filter((pendingEvent) => !isControlEvent(pendingEvent))
          : [];
        if (!carriedSignals.length) flushPendingPreUserEvents();
        pendingPreUserEvents = [];
        currentTurnEvents = [event, ...carriedSignals];
        continue;
      }
      if (currentTurnEvents.length) {
        currentTurnEvents.push(event);
      } else {
        pendingPreUserEvents.push(event);
      }
    }
    flushCurrentTurnEvents();
    flushPendingPreUserEvents();

    return visible;
  }

  global.CodexPanelLifecycle = {
    eventKind,
    eventStatus,
    isActivityEvent,
    isActivityPending,
    isControlEvent,
    isStreamingAssistantEvent,
    isTurnSettlingEvent,
    sessionStatusFromEvent,
    visibleConversationEvents,
  };
})(window);
