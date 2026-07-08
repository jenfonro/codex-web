"use strict";

(function defineCodexPanelVirtualizer(global) {
  const { assistantTextFromData } = global.CodexPanelUtils;
  const { isActivityEvent, isActivityPending } = global.CodexPanelLifecycle;
  const activitySummary = global.CodexPanelActivitySummary;

  const VIRTUAL_TURN_THRESHOLD = 28;
  const VIRTUAL_WINDOW_TURNS = 36;
  const VIRTUAL_PAGE_TURNS = 12;
  const VIRTUAL_EDGE_PX = 800;
  const TURN_GAP_PX = 12;

  function createConversationVirtualizer(state, activeSession) {
    function windowFor(items) {
      const itemCount = items.length;
      const fullWindow = {
        items,
        start: 0,
        end: itemCount,
        topPadding: 0,
        bottomPadding: 0,
        gap: TURN_GAP_PX,
      };
      if (itemCount <= VIRTUAL_TURN_THRESHOLD) return fullWindow;

      const sessionID = activeSession()?.id || "sample-thread";
      const windows = state.threadWindows || (state.threadWindows = new Map());
      let windowState = windows.get(sessionID);
      if (!windowState) {
        windowState = {
          start: Math.max(0, itemCount - VIRTUAL_WINDOW_TURNS),
          end: itemCount,
          itemCount,
          stickToBottom: true,
          pendingScrollTop: null,
          estimates: [],
        };
        windows.set(sessionID, windowState);
      }

      windowState.estimates = items.map(estimateItemHeight);
      reconcileWindow(windowState, itemCount);

      return {
        items: items.slice(windowState.start, windowState.end),
        start: windowState.start,
        end: windowState.end,
        topPadding: estimatedBlockHeight(windowState, 0, windowState.start),
        bottomPadding: estimatedBlockHeight(windowState, windowState.end, itemCount),
        gap: TURN_GAP_PX,
      };
    }

    function handleScroll(scroll) {
      if (!scroll) return false;
      const sessionID = activeSession()?.id;
      const windowState = sessionID ? state.threadWindows?.get(sessionID) : null;
      if (!windowState || windowState.itemCount <= VIRTUAL_TURN_THRESHOLD) return false;

      const maxScrollTop = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
      const distanceToBottom = maxScrollTop - scroll.scrollTop;
      windowState.stickToBottom = distanceToBottom < VIRTUAL_EDGE_PX;

      if (scroll.scrollTop < VIRTUAL_EDGE_PX && windowState.start > 0) {
        const oldStart = windowState.start;
        const newStart = Math.max(0, oldStart - VIRTUAL_PAGE_TURNS);
        const addedHeight = estimatedBlockHeight(windowState, newStart, oldStart);
        windowState.start = newStart;
        if (windowState.end - windowState.start > VIRTUAL_WINDOW_TURNS) {
          windowState.end = Math.min(windowState.itemCount, windowState.start + VIRTUAL_WINDOW_TURNS);
        }
        windowState.pendingScrollTop = scroll.scrollTop + addedHeight;
        windowState.stickToBottom = false;
        return true;
      }

      if (distanceToBottom < VIRTUAL_EDGE_PX && windowState.end < windowState.itemCount) {
        const oldStart = windowState.start;
        const newEnd = Math.min(windowState.itemCount, windowState.end + VIRTUAL_PAGE_TURNS);
        let newStart = windowState.start;
        if (newEnd - newStart > VIRTUAL_WINDOW_TURNS) {
          newStart = Math.max(0, newEnd - VIRTUAL_WINDOW_TURNS);
        }
        const removedHeight = estimatedBlockHeight(windowState, oldStart, newStart);
        windowState.start = newStart;
        windowState.end = newEnd;
        windowState.pendingScrollTop = Math.max(0, scroll.scrollTop - removedHeight);
        windowState.stickToBottom = windowState.end >= windowState.itemCount;
        return true;
      }

      return false;
    }

    function activeWindow() {
      const session = activeSession();
      return session ? state.threadWindows?.get(session.id) : null;
    }

    return {
      activeWindow,
      handleScroll,
      windowFor,
    };
  }

  function reconcileWindow(windowState, itemCount) {
    if (windowState.itemCount !== itemCount) {
      if (windowState.end >= windowState.itemCount || windowState.stickToBottom) {
        windowState.end = itemCount;
        windowState.start = Math.max(0, windowState.end - VIRTUAL_WINDOW_TURNS);
        windowState.stickToBottom = true;
      }
      windowState.itemCount = itemCount;
    }

    windowState.start = clampIndex(windowState.start, itemCount);
    windowState.end = clampIndex(windowState.end || itemCount, itemCount);
    if (windowState.end <= windowState.start) {
      windowState.end = Math.min(itemCount, windowState.start + VIRTUAL_WINDOW_TURNS);
    }
    if (windowState.end - windowState.start > VIRTUAL_WINDOW_TURNS) {
      if (windowState.stickToBottom) {
        windowState.start = Math.max(0, windowState.end - VIRTUAL_WINDOW_TURNS);
      } else {
        windowState.end = Math.min(itemCount, windowState.start + VIRTUAL_WINDOW_TURNS);
      }
    }
  }

  function clampIndex(value, itemCount) {
    const number = Number.isFinite(value) ? value : 0;
    return Math.max(0, Math.min(itemCount, Math.floor(number)));
  }

  function estimatedBlockHeight(windowState, start, end) {
    if (end <= start) return 0;
    const estimates = windowState.estimates || [];
    let height = 0;
    for (let index = start; index < end; index += 1) {
      height += estimates[index] || 180;
    }
    return height + ((end - start) * TURN_GAP_PX);
  }

  function estimateItemHeight(item) {
    if (!item) return 180;
    if (item.type !== "user-turn") return estimateEventHeight(item.event);
    const split = activitySummary?.splitTurnFollowups(item.followups || []);
    if (split?.hasProcessBlock) {
      const events = [
        item.event,
        ...split.streamFollowups,
        ...(split.finalFollowup ? [split.finalFollowup] : []),
      ];
      return Math.max(120, events.reduce((total, event) => total + estimateEventHeight(event), 68));
    }
    const events = [item.event, ...(item.followups || [])];
    return Math.max(120, events.reduce((total, event) => total + estimateEventHeight(event), 24));
  }

  function estimateEventHeight(event) {
    const kind = event?.kind || "assistant_message";
    const text = String(event?.text || assistantTextFromData(event?.data) || "");
    const wrappedLines = Math.max(1, Math.ceil(text.length / 86));
    const explicitLines = text ? text.split("\n").length : 1;
    const lines = Math.max(wrappedLines, explicitLines);
    if (kind === "user_message") return 52 + (lines * 19);
    if (kind === "summary") return 44 + (lines * 18);
    if (isActivityEvent(event)) return isActivityPending(event) ? 34 : 30;
    if (kind === "error") return 48 + (lines * 19);
    return 56 + (lines * 20);
  }

  global.CodexPanelVirtualizer = {
    create: createConversationVirtualizer,
  };
})(window);
