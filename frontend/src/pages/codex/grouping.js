"use strict";

(function defineCodexPanelGrouping(global) {
  const lifecycle = global.CodexPanelLifecycle;
  const LOADED_RANGE_GAP_SEQ = 500;

  function groupConversationEvents(events, options = {}) {
    const items = [];
    let currentUser = null;
    let currentFollowups = [];
    let leadingEvents = [];
    let hasSeenUser = false;
    const hideLeadingPartial = Boolean(options.hideLeadingPartial);
    let previousSeq = 0;

    const sourceEvents = Array.isArray(events) ? events : [];

    for (let index = 0; index < sourceEvents.length; index += 1) {
      const event = sourceEvents[index];
      const seq = eventSeq(event);
      if (isSequenceGap(previousSeq, seq)) {
        flushUserTurn(items, currentUser, currentFollowups);
        currentUser = null;
        currentFollowups = [];
        flushLeadingEvents(items, leadingEvents, hasSeenUser, hideLeadingPartial);
        leadingEvents = [];
      }
      if (seq > 0) previousSeq = seq;

      if (eventKind(event, "assistant_message") === "user_message") {
        if (currentUser && shouldKeepUserAsGuidance(currentFollowups, sourceEvents, index + 1)) {
          currentFollowups.push(event);
          continue;
        }
        flushUserTurn(items, currentUser, currentFollowups);
        flushLeadingEvents(items, leadingEvents, hasSeenUser, hideLeadingPartial);
        leadingEvents = [];
        hasSeenUser = true;
        currentUser = event;
        currentFollowups = [];
        continue;
      }

      if (!currentUser) {
        leadingEvents.push(event);
        if (isTerminalSummary(event)) {
          flushLeadingEvents(items, leadingEvents, hasSeenUser, hideLeadingPartial);
          leadingEvents = [];
        }
        continue;
      }

      currentFollowups.push(event);
      if (isTerminalSummary(event)) {
        flushUserTurn(items, currentUser, currentFollowups);
        currentUser = null;
        currentFollowups = [];
      }
    }

    flushUserTurn(items, currentUser, currentFollowups);
    flushLeadingEvents(items, leadingEvents, hasSeenUser, hideLeadingPartial);
    return items;
  }

  function flushUserTurn(items, userEvent, followups) {
    if (!userEvent) return;
    const normalizedFollowups = followups || [];
    const turnID = officialTurnIDForTurn(userEvent, normalizedFollowups);
    const event = turnID && !eventTurnID(userEvent) ? { ...userEvent, turnKey: turnID } : userEvent;
    items.push({ type: "user-turn", event, followups: normalizedFollowups });
  }

  function isSequenceGap(previousSeq, nextSeq) {
    return previousSeq > 0 && nextSeq > 0 && nextSeq > previousSeq + LOADED_RANGE_GAP_SEQ;
  }

  function eventSeq(event) {
    return Number(event?.seq || event?.data?.seq || 0);
  }

  function flushLeadingEvents(items, events, hasSeenUser, hideLeadingPartial) {
    if (!events.length) return;
    if (hideLeadingPartial && !hasSeenUser) return;
    flushSequential(items, events);
  }

  function flushSequential(items, events) {
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      if (eventKind(event, "assistant_message") !== "user_message") {
        if (shouldHideStandaloneEvent(event)) continue;
        items.push({ type: "event", event });
        continue;
      }

      const followups = [];
      let cursor = index + 1;
      while (cursor < events.length) {
        const next = events[cursor];
        const kind = eventKind(next, "assistant_message");
        if (kind === "user_message" || (kind === "summary" && !next.inline)) break;
        followups.push(next);
        cursor += 1;
      }

      items.push({ type: "user-turn", event, followups });
      index = cursor - 1;
    }
  }

  function isTerminalSummary(event) {
    if (eventKind(event) !== "summary" || !event?.inline) return false;
    const data = event.data && typeof event.data === "object" ? event.data : {};
    return data.type === "task_complete" || data.status === "completed" || Boolean(data.turn_id || data.durationMs);
  }

  function shouldKeepUserAsGuidance(followups, events = [], nextIndex = 0) {
    const entries = Array.isArray(followups) ? followups : [];
    if (!entries.length) return false;
    const activeTurnID = lastOfficialTurnID(entries);
    if (activeTurnID && !entries.some((event) => isTerminalSummaryForTurn(event, activeTurnID))) {
      const nextTurnID = firstOfficialTurnIDAhead(events, nextIndex);
      return !nextTurnID || nextTurnID === activeTurnID;
    }
    if (!entries.some(isInProgressProcessSignal)) return false;
    return !entries.some(isTurnEndingBeforeNextUser);
  }

  function lastOfficialTurnID(events) {
    for (let index = (events || []).length - 1; index >= 0; index -= 1) {
      const id = eventTurnID(events[index]);
      if (id) return id;
    }
    return "";
  }

  function firstOfficialTurnIDAhead(events, startIndex) {
    for (let index = Math.max(0, Number(startIndex || 0)); index < (events || []).length; index += 1) {
      const id = eventTurnID(events[index]);
      if (id) return id;
    }
    return "";
  }

  function isTerminalSummaryForTurn(event, turnID) {
    return isTerminalSummary(event) && eventTurnID(event) === turnID;
  }

  function isInProgressProcessSignal(event) {
    const kind = eventKind(event);
    if (kind === "tool_call" || kind === "tool_output" || kind === "stdout" || kind === "stderr") return true;
    if (lifecycle?.isActivityEvent?.(event)) return true;
    return kind === "file_change";
  }

  function isTurnEndingBeforeNextUser(event) {
    const kind = eventKind(event);
    if (isTerminalSummary(event)) return true;
    if (kind === "turn_completed" || kind === "turn_cancelled" || kind === "error") return true;
    return kind === "assistant_message" && (event?.placement === "final" || event?.data?.phase === "final_answer");
  }

  function officialTurnIDForTurn(userEvent, followups) {
    const direct = eventTurnID(userEvent);
    if (direct) return direct;
    for (let index = (followups || []).length - 1; index >= 0; index -= 1) {
      const id = eventTurnID(followups[index]);
      if (id) return id;
    }
    return "";
  }

  function eventTurnID(event) {
    return String(
      event?.turnKey ||
      event?.data?.turnKey ||
      event?.turnId ||
      event?.data?.turnId ||
      event?.data?.turn_id ||
      "",
    ).trim();
  }

  function shouldHideStandaloneEvent(event) {
    const kind = eventKind(event);
    if (kind === "tool_output" || kind === "stdout" || kind === "stderr") return true;
    if (!lifecycle?.isActivityEvent?.(event)) return false;
    if (kind === "turn_cancelled") return false;
    return !lifecycle.isActivityPending(event);
  }

  function eventKind(event, fallback = "") {
    return lifecycle?.eventKind ? lifecycle.eventKind(event, fallback) : String(event?.kind || fallback || "");
  }

  global.CodexPanelGrouping = {
    groupConversationEvents,
    isTerminalSummary,
    shouldHideStandaloneEvent,
    eventTurnID,
  };
})(window);
