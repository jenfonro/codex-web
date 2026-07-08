"use strict";

(function defineCodexPanelVirtualizer(global) {
  const { assistantTextFromData, websiteResourcesFromEvents } = global.CodexPanelUtils;
  const { isActivityEvent, isActivityPending } = global.CodexPanelLifecycle;
  const activitySummary = global.CodexPanelActivitySummary;

  const VIRTUAL_TURN_THRESHOLD = 28;
  const VIRTUAL_WINDOW_TURNS = 36;
  const VIRTUAL_OVERSCAN_TURNS = 8;
  const VIRTUAL_EDGE_PX = 800;
  const TURN_GAP_PX = 12;
  const FILE_ACTIVITY_VISIBLE_FILE_LIMIT = 3;

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

      const sessionID = activeSession()?.id || "thread-reference";
      const windows = state.threadWindows || (state.threadWindows = new Map());
      let windowState = windows.get(sessionID);
      if (!windowState) {
        windowState = {
          start: Math.max(0, itemCount - VIRTUAL_WINDOW_TURNS),
          end: itemCount,
          itemCount,
          stickToBottom: true,
          restoreScrollTop: null,
          estimates: [],
        };
        windows.set(sessionID, windowState);
      }

      windowState.estimates = items.map((item, index) => estimateItemHeight(item, state, index));
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

      if (windowState.focusLockUntil) {
        if (Date.now() < Number(windowState.focusLockUntil || 0)) {
          const lockTop = Number(windowState.focusLockScrollTop);
          const currentTop = Number(scroll.scrollTop || 0);
          const releaseDistance = Math.max(32, Math.floor((scroll.clientHeight || 0) * 0.05));
          if (!Number.isFinite(lockTop) || Math.abs(currentTop - lockTop) <= releaseDistance) {
            windowState.stickToBottom = false;
            windowState.restoreScrollTop = currentTop;
            return false;
          }
        }
        windowState.focusLockUntil = 0;
        windowState.focusLockScrollTop = null;
      }

      const maxScrollTop = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
      const distanceToBottom = maxScrollTop - scroll.scrollTop;
      const shouldStickToBottom = distanceToBottom < VIRTUAL_EDGE_PX;

      if (shouldStickToBottom) {
        const nextEnd = windowState.itemCount;
        const nextStart = Math.max(0, nextEnd - VIRTUAL_WINDOW_TURNS);
        const changed = windowState.start !== nextStart || windowState.end !== nextEnd || !windowState.stickToBottom;
        windowState.start = nextStart;
        windowState.end = nextEnd;
        windowState.stickToBottom = true;
        return changed;
      }

      const measuredVisibleIndex = measuredFirstVisibleIndex(scroll);
      const firstVisibleIndex = Number.isFinite(measuredVisibleIndex)
        ? measuredVisibleIndex
        : estimatedIndexForOffset(windowState, Math.max(0, scroll.scrollTop));
      let nextStart = Math.max(0, firstVisibleIndex - VIRTUAL_OVERSCAN_TURNS);
      let nextEnd = Math.min(windowState.itemCount, nextStart + VIRTUAL_WINDOW_TURNS);
      if (nextEnd - nextStart < VIRTUAL_WINDOW_TURNS) {
        nextStart = Math.max(0, nextEnd - VIRTUAL_WINDOW_TURNS);
      }
      const changed = windowState.start !== nextStart || windowState.end !== nextEnd || windowState.stickToBottom;
      windowState.start = nextStart;
      windowState.end = nextEnd;
      windowState.stickToBottom = false;
      if (changed) windowState.restoreScrollTop = Math.max(0, scroll.scrollTop);

      return changed;
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
      const previousItemCount = windowState.itemCount || 0;
      const delta = itemCount - previousItemCount;
      if (delta > 0 && windowState.preserveOnPrepend && !windowState.stickToBottom) {
        windowState.start += delta;
        windowState.end += delta;
        windowState.itemCount = itemCount;
        windowState.restoreScrollTop = null;
        windowState.preserveOnPrepend = false;
        windowState.prependScrollTop = null;
        return;
      }
      windowState.preserveOnPrepend = false;
      windowState.prependScrollTop = null;
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

  function estimatedIndexForOffset(windowState, offset) {
    const estimates = windowState.estimates || [];
    let cursor = 0;
    for (let index = 0; index < windowState.itemCount; index += 1) {
      const itemHeight = (estimates[index] || 180) + TURN_GAP_PX;
      if (cursor + itemHeight > offset) return index;
      cursor += itemHeight;
    }
    return Math.max(0, windowState.itemCount - 1);
  }

  function measuredFirstVisibleIndex(scroll) {
    const scrollRect = scroll?.getBoundingClientRect?.();
    if (!scrollRect) return Number.NaN;
    const turns = Array.from(scroll.querySelectorAll("[data-codex-virtual-turn]"));
    for (const turn of turns) {
      const rect = turn.getBoundingClientRect();
      const index = Number(turn.getAttribute("data-codex-virtual-turn"));
      if (!Number.isFinite(index)) continue;
      if (rect.width <= 0 || rect.height <= 0) continue;
      if (rect.bottom <= scrollRect.top + 16 || rect.top >= scrollRect.bottom - 16) continue;
      return index;
    }
    return Number.NaN;
  }

  function estimateItemHeight(item, state, index) {
    if (!item) return 180;
    if (item.type !== "user-turn") return estimateEventHeight(item.event);
    const split = activitySummary?.splitTurnFollowups(item.followups || []);
    if (split?.hasProcessSummary) {
      const summaryFinalFollowup = split.finalFollowupPlacement === "summary" ? split.finalFollowup : null;
      const finalFollowup = split.finalFollowupPlacement === "summary" ? null : split.finalFollowup;
      const summaryEvents = [
        ...(split.summaryItems || []).map((summaryItem) => summaryItem?.event || summaryItem),
        ...(split.processEvents || []),
        ...(summaryFinalFollowup ? [summaryFinalFollowup] : []),
      ];
      const outsideEvents = [
        ...(split.streamFollowups || []),
        ...(finalFollowup ? [finalFollowup] : []),
        ...(split.detailEvents || []),
      ];
      const resourceHeight = estimateWebsiteResourcesHeight(websiteResourcesFromEvents([item.event, ...(item.followups || [])]));
      const summaryKey = `turn-activity:${eventTurnKey(item.event, index)}`;
      const defaultExpanded = summaryEvents.some(isActivityPending);
      const expanded = summaryKey && state?.disclosures?.has(summaryKey)
        ? Boolean(state.disclosures.get(summaryKey))
        : defaultExpanded;
      const summaryHeight = expanded
        ? summaryEvents.reduce((total, event) => total + estimateEventHeight(event), 68)
        : 72;
      const outsideHeight = outsideEvents.reduce((total, event) => total + estimateEventHeight(event), 0);
      const outsideGaps = outsideEvents.length ? outsideEvents.length * TURN_GAP_PX : 0;
      return Math.max(120, estimateEventHeight(item.event) + summaryHeight + outsideHeight + outsideGaps + resourceHeight + 24);
    }
    const events = [item.event, ...(item.followups || [])];
    const resourceHeight = estimateWebsiteResourcesHeight(websiteResourcesFromEvents(events));
    return Math.max(120, events.reduce((total, event) => total + estimateEventHeight(event), 24) + resourceHeight);
  }

  function estimateWebsiteResourcesHeight(resources) {
    const count = Math.min(3, Array.isArray(resources) ? resources.length : 0);
    if (!count) return 0;
    return TURN_GAP_PX + (count * 68) + ((count - 1) * TURN_GAP_PX);
  }

  function eventTurnKey(event, index) {
    return String(
      event?.turnKey ||
      event?.data?.turnKey ||
      event?.turnId ||
      event?.data?.turnId ||
      event?.data?.turn_id ||
      (index == null ? "" : `codex-turn-${index}`),
    ).trim();
  }

  function estimateEventHeight(event) {
    const kind = event?.kind || "assistant_message";
    const text = String(event?.text || assistantTextFromData(event?.data) || "");
    const wrappedLines = Math.max(1, Math.ceil(text.length / 86));
    const explicitLines = text ? text.split("\n").length : 1;
    const lines = Math.max(wrappedLines, explicitLines);
    if (kind === "file_change") return estimateFileChangeHeight(event);
    if (kind === "user_message") return 52 + (lines * 19);
    if (kind === "summary") return 44 + (lines * 18);
    if (isActivityEvent(event)) return isActivityPending(event) ? 34 : 30;
    if (kind === "error") return 48 + (lines * 19);
    return 56 + (lines * 20);
  }

  function estimateFileChangeHeight(event) {
    const files = Array.isArray(event?.data?.files)
      ? event.data.files
      : Array.isArray(event?.files)
        ? event.files
        : [];
    if (!files.length) return 48;
    const visibleRows = Math.min(FILE_ACTIVITY_VISIBLE_FILE_LIMIT, files.length);
    const overflowToggle = files.length > visibleRows ? 36 : 0;
    const contentHeight = files
      .slice(0, visibleRows)
      .reduce((total, file) => total + estimateFilePatchContentHeight(file), 0);
    return 86 + (visibleRows * 36) + contentHeight + overflowToggle;
  }

  function estimateFilePatchContentHeight(file) {
    const text = String(file?.unifiedDiff || file?.unified_diff || file?.content || "");
    if (!text.trim()) return 0;
    const lineCount = Math.max(1, text.split("\n").length);
    return Math.min(220, lineCount * 18) + 1;
  }

  global.CodexPanelVirtualizer = {
    create: createConversationVirtualizer,
  };
})(window);
