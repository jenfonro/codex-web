"use strict";

(function defineCodexPanelRenderer(global) {
  const {
    activityLabel,
    activityIcon,
    assistantTextFromData,
    timeFromEvent,
    escapeHTML,
    escapeAttr,
  } = global.CodexPanelUtils;
  const {
    isActivityEvent,
    isActivityPending,
    visibleConversationEvents,
  } = global.CodexPanelLifecycle;
  const activitySummary = global.CodexPanelActivitySummary;
  const markdown = global.CodexMarkdown;
  if (!markdown?.render) {
    throw new Error("CodexMarkdown renderer is required");
  }
  const virtualizerFactory = global.CodexPanelVirtualizer;

  function createCodexPanelRenderer(runtime) {
    const { state, mount, icons, config } = runtime;
    const virtualizer = virtualizerFactory.create(state, activeSession);
    let shimmerCleanups = [];
    let threadScrollFrame = 0;
    let suppressThreadScroll = false;

function render() {
  clearShimmerTimers();
  mount.root.innerHTML = `${state.view === "thread" ? renderThreadView() : renderListView()}${renderToastViewport()}`;
  syncComposerState();
  bindThreadScrollHandler();
  syncThreadScrollPosition();
  syncCadencedShimmers();
}

function clearShimmerTimers() {
  for (const cleanup of shimmerCleanups) cleanup();
  shimmerCleanups = [];
}

function syncCadencedShimmers() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const nodes = Array.from(mount.root.querySelectorAll(".codex-shimmer"));
  for (const node of nodes) {
    let activeTimer = 0;
    const stopActive = () => {
      if (activeTimer) window.clearTimeout(activeTimer);
      activeTimer = 0;
    };
    const run = () => {
      stopActive();
      node.classList.remove("codex-shimmer-active");
      node.classList.add("codex-shimmer-active");
      activeTimer = window.setTimeout(() => {
        node.classList.remove("codex-shimmer-active");
        activeTimer = 0;
      }, 1000);
    };
    const startTimer = window.setTimeout(() => {
      run();
      const interval = window.setInterval(run, 4000);
      shimmerCleanups.push(() => window.clearInterval(interval));
    }, 600);
    shimmerCleanups.push(() => {
      window.clearTimeout(startTimer);
      stopActive();
    });
  }
}

function renderToastViewport() {
  return '<span class="pointer-events-none fixed inset-0 z-[60] mx-auto my-2 flex max-w-[560px] flex-col items-center justify-start md:pb-5"></span>';
}

function syncThreadScrollPosition() {
  if (state.view !== "thread") return;
  requestAnimationFrame(() => {
    const scroll = mount.root.querySelector("[data-thread-scroll]");
    if (!scroll) return;
    const windowState = virtualizer.activeWindow();
    if (windowState?.pendingScrollTop != null) {
      setThreadScrollTop(scroll, Math.max(0, windowState.pendingScrollTop));
      windowState.pendingScrollTop = null;
      return;
    }
    if (!windowState || windowState.stickToBottom) {
      setThreadScrollTop(scroll, scroll.scrollHeight);
    }
  });
}

function bindThreadScrollHandler() {
  if (state.view !== "thread") return;
  const scroll = mount.root.querySelector("[data-thread-scroll]");
  if (!scroll) return;
  scroll.addEventListener("scroll", () => {
    if (suppressThreadScroll) return;
    if (threadScrollFrame) return;
    threadScrollFrame = window.requestAnimationFrame(() => {
      threadScrollFrame = 0;
      if (suppressThreadScroll) return;
      if (virtualizer.handleScroll(scroll)) {
        render();
        return;
      }
      runtime.onThreadScroll?.(scroll, virtualizer.activeWindow());
    });
  }, { passive: true });
}

function setThreadScrollTop(scroll, value) {
  suppressThreadScroll = true;
  scroll.scrollTop = value;
  window.requestAnimationFrame(() => {
    suppressThreadScroll = false;
  });
}

function renderListView() {
  return `
    <div class="codex-panel-view codex-panel-view-list flex h-full flex-col" tabindex="0" data-codex-panel-root data-codex-view="list">
      ${renderListHeader()}
      <div class="codex-list-body relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div class="codex-list-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto" data-codex-session-list-scroll>
          <div class="[container-type:size] relative flex w-full min-h-full flex-col [container-name:home-main-content]" role="main">
            <div class="mx-auto flex w-full max-w-3xl flex-col gap-3 px-panel">
              ${renderSessionList()}
            </div>
          </div>
        </div>
        ${renderHomeComposer()}
      </div>
    </div>`;
}

function renderListHeader() {
  return `
    <div class="codex-panel-header-frame">
      <div class="codex-panel-header-row flex items-center justify-between">
        <div class="mr-3 line-clamp-1 flex min-w-0 flex-1 items-center gap-1 truncate" style="view-transition-name: header-title;">
          <span class="text-token-description-foreground">任务</span>
        </div>
        <div class="flex flex-shrink-0 items-center gap-1">${renderHeaderActions()}</div>
      </div>
    </div>`;
}

function renderSessionList() {
  return `
    <div>
      <div class="group/inline -mx-[var(--padding-row-x)] flex flex-col gap-px rounded-xl pb-1 transition-colors [--task-row-trailing-inset:calc(var(--spacing)*1.5)]">
        ${state.sessions.map(renderSessionRow).join("")}
      </div>
    </div>`;
}

function renderThreadView() {
  const session = activeSession();
  const sessionID = session?.id || "sample-thread";
  const sessionState = state.statesBySession.get(sessionID);
  const fallbackEvents = runtime.samples?.eventsBySession?.get("sample-thread") || [];
  const events = state.eventsBySession.has(sessionID)
    ? state.eventsBySession.get(sessionID)
    : state.apiAvailable
      ? []
      : fallbackEvents;
  const conversation = sessionState
    ? renderConversationState(sessionState)
    : renderConversationEvents(events);
  return `
    <div class="codex-panel-view codex-panel-view-thread relative flex h-full flex-col min-h-0" data-codex-panel-root data-codex-view="thread">
      <div class="sticky top-0 z-10">${renderHeader(session?.title || "任务", "thread")}</div>
      <div class="codex-thread-body flex min-h-0 flex-1 flex-col [&_[data-thread-find-target=conversation]]:scroll-mt-24">
        <div class="codex-thread-scroll-region relative mx-auto flex min-h-0 w-full flex-1 flex-col">
          <div class="min-h-0 flex-1">
            <div class="relative h-full flex-1 [content-visibility:auto]">
              <div data-app-action-timeline-scroll="" tabindex="0" class="codex-thread-scroll thread-scroll-container relative h-full overflow-x-hidden overflow-y-auto [overflow-anchor:none] [scroll-padding-bottom:var(--thread-scroll-padding-bottom,0px)] pt-(--thread-content-top-inset) [container-name:thread-content] [container-type:inline-size] focus:outline-none [&:has([data-thread-scroll-footer='true']:focus-within)]:[scroll-padding-bottom:0px] flex flex-col" style="--thread-scroll-padding-bottom: 160px;" data-thread-scroll>
                  <div class="codex-thread-content-frame flex min-h-full shrink-0 flex-col justify-start" data-thread-content-frame>
                    <div data-codex-thread-content="true" class="codex-thread-content mx-auto w-full max-w-(--thread-content-max-width) px-toolbar relative flex flex-1 shrink-0 flex-col pb-8">
                      <div data-thread-find-target="conversation" class="relative flex flex-col gap-3">
                        ${conversation}
                      </div>
                    </div>
                  </div>
              </div>
            </div>
          </div>
        </div>
        ${renderThreadComposer()}
      </div>
    </div>`;
}

function renderHeader(title, mode) {
  if (mode === "thread") {
    return `
      <div class="codex-panel-header-frame">
        <div class="codex-panel-header-row flex items-center justify-between">
          <div class="mr-3 line-clamp-1 flex min-w-0 flex-1 items-center gap-1 truncate" style="view-transition-name: header-title;">
            <div class="codex-thread-header-title-group flex min-w-0 flex-1 items-center gap-1">
              <span data-state="closed" class="contents">
                <button type="button" class="codex-thread-back-button" aria-label="返回" data-action="back">${icons.svg("back", "codex-thread-back-icon")}</button>
              </span>
              <button type="button" class="codex-thread-title-button" aria-label="${escapeAttr(title)}">
                <span class="codex-thread-title-text truncate">${escapeHTML(title)}</span>
              </button>
            </div>
          </div>
          <div class="flex flex-shrink-0 items-center gap-1">
            <button type="button" class="border-token-border no-drag cursor-interaction flex items-center gap-1 border whitespace-nowrap select-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 rounded-full text-token-text-tertiary enabled:hover:bg-token-list-hover-background data-[state=open]:bg-token-list-hover-background border-transparent flex items-center justify-center p-0.5 outline-hidden cursor-interaction no-drag" aria-label="对话操作" aria-haspopup="menu" aria-expanded="false" data-state="closed">${icons.svg("more21", "icon-xs")}</button>
            ${renderHeaderActions()}
          </div>
        </div>
      </div>`;
  }
  return `
    <div class="codex-panel-header-frame">
      <div class="codex-panel-header-row flex items-center justify-between">
        <div class="mr-3 line-clamp-1 flex min-w-0 flex-1 items-center gap-1 truncate" style="view-transition-name: header-title;">
          <span class="text-token-description-foreground">${escapeHTML(title)}</span>
        </div>
        <div class="flex flex-shrink-0 items-center gap-1">${renderHeaderActions()}</div>
      </div>
    </div>`;
}

function renderConversationEvents(events) {
  const sessionID = activeSession()?.id || "sample-thread";
  const page = state.eventPagesBySession.get(sessionID);
  const visibleEvents = visibleConversationEvents(events);
  const items = groupConversationEvents(visibleEvents);
  const virtualList = conversationVirtualList(events, items);
  const outerStyle = virtualList.height ? ` style="height: ${escapeAttr(virtualList.height)}"` : "";
  const innerStyle = `gap: ${virtualList.gap}px; margin-top: ${virtualList.marginTop || "0px"};`;
  return `
    <div class="relative shrink-0"${outerStyle}>
      ${renderOlderEventsLoader(page)}
      ${virtualList.topPadding ? `<div aria-hidden="true" data-codex-virtual-spacer="top" style="height:${escapeAttr(virtualList.topPadding)}px"></div>` : ""}
      <div class="flex flex-col" style="${innerStyle}">
        ${virtualList.items.map((item, offset) => `<div style="" data-codex-virtual-turn="${virtualList.start + offset}">${renderConversationItem(item, virtualList.start + offset)}</div>`).join("")}
      </div>
      ${virtualList.bottomPadding ? `<div aria-hidden="true" data-codex-virtual-spacer="bottom" style="height:${escapeAttr(virtualList.bottomPadding)}px"></div>` : ""}
    </div>`;
}

function renderConversationState(sessionState) {
  const turns = Array.isArray(sessionState?.turns) ? sessionState.turns : [];
  const items = conversationItemsFromState(turns);
  const virtualList = conversationVirtualList([], items);
  const innerStyle = `gap: ${virtualList.gap}px; margin-top: ${virtualList.marginTop || "0px"};`;
  return `
    <div class="relative shrink-0">
      <div class="flex flex-col" style="${innerStyle}">
        ${virtualList.topPadding ? `<div aria-hidden="true" data-codex-virtual-spacer="top" style="height:${escapeAttr(virtualList.topPadding)}px"></div>` : ""}
        ${virtualList.items.map((item, offset) => `<div data-codex-virtual-turn="${virtualList.start + offset}">${renderConversationItem(item, virtualList.start + offset)}</div>`).join("")}
        ${virtualList.bottomPadding ? `<div aria-hidden="true" data-codex-virtual-spacer="bottom" style="height:${escapeAttr(virtualList.bottomPadding)}px"></div>` : ""}
      </div>
    </div>`;
}

function conversationItemsFromState(turns) {
  const items = [];
  for (let turnIndex = 0; turnIndex < turns.length; turnIndex += 1) {
    const turn = turns[turnIndex];
    const events = stateTurnEvents(turn, turnIndex);
    const userIndex = events.findIndex((event) => (event.kind || "") === "user_message");
    if (userIndex < 0) {
      for (const event of events) items.push({ type: "event", event });
      if (isTurnRunning(turn) && !events.some(isPendingEvent)) {
        items.push({ type: "event", event: turnPendingEvent(turn, turnIndex) });
      }
      continue;
    }
    const userEvent = events[userIndex];
    const followups = events.filter((_, index) => index !== userIndex);
    if (isTurnRunning(turn) && !followups.some(isPendingEvent)) {
      followups.push(turnPendingEvent(turn, turnIndex));
    }
    items.push({ type: "user-turn", event: userEvent, followups });
  }
  return items;
}

function stateTurnEvents(turn, turnIndex) {
  const sourceItems = Array.isArray(turn?.items) ? turn.items : [];
  const lastAgentIndex = lastIndexOfType(sourceItems, "agentMessage");
  return sourceItems.flatMap((item, itemIndex) => stateItemEvents(item, turn, turnIndex, itemIndex, itemIndex === lastAgentIndex));
}

function stateItemEvents(item, turn, turnIndex, itemIndex, isLastAgent) {
  if (!item || typeof item !== "object") return [];
  const type = item.type || item.raw?.type || "";
  const eventTime = item.time || turn?.startedAt || turn?.completedAt || new Date().toISOString();
  const data = {
    itemId: item.id,
    itemType: type,
    status: item.status,
    phase: item.phase,
    turnId: turn?.id || "",
    turnKey: turn?.id || `turn-${turnIndex}`,
    contentUnit: itemIndex,
    item: item.raw || item,
  };

  if (type === "userMessage") {
    return [{ sessionId: activeSession()?.id || "", kind: "user_message", text: item.text || "", time: eventTime, data }];
  }
  if (type === "agentMessage") {
    if (!String(item.text || "").trim() && isItemRunning(item)) {
      return [turnPendingEvent(turn, turnIndex, itemIndex)];
    }
    const phase = item.phase || (!isTurnRunning(turn) && isLastAgent ? "final_answer" : "");
    return [{
      sessionId: activeSession()?.id || "",
      kind: "assistant_message",
      text: item.text || "",
      time: eventTime,
      data: { ...data, phase, streaming: isItemRunning(item) },
    }];
  }
  if (type === "reasoning") {
    return [{
      sessionId: activeSession()?.id || "",
      kind: "reasoning",
      text: item.text || "",
      time: eventTime,
      data: { ...data, status: item.status || (isTurnRunning(turn) ? "running" : "completed") },
    }];
  }
  if (type === "commandExecution") {
    const call = {
      sessionId: activeSession()?.id || "",
      kind: "tool_call",
      text: "exec_command",
      time: eventTime,
      data: {
        ...data,
        name: "exec_command",
        args: { cmd: item.command || "", workdir: item.cwd || "" },
      },
    };
    if (!item.output) return [call];
    return [
      call,
      {
        sessionId: activeSession()?.id || "",
        kind: "tool_output",
        text: item.output || "",
        time: eventTime,
        data: {
          ...data,
          itemId: `${item.id}:output`,
          call_id: item.id,
          output: item.output || "",
          status: item.status,
        },
      },
    ];
  }
  if (type === "fileChange") {
    const files = Array.isArray(item.items) ? item.items : [];
    return [{
      sessionId: activeSession()?.id || "",
      kind: "tool_summary",
      text: item.text || toolSummaryText({ items: files }),
      items: files,
      time: eventTime,
      data: { ...data, items: files },
    }];
  }
  if (type === "mcpToolCall" || type === "dynamicToolCall" || type === "webSearch") {
    const name = item.name || item.tool || type;
    return [{ sessionId: activeSession()?.id || "", kind: "tool_call", text: name, time: eventTime, data: { ...data, name } }];
  }
  if (type === "plan" || type === "contextCompaction") {
    return [{ sessionId: activeSession()?.id || "", kind: "summary", text: item.text || "", time: eventTime, data }];
  }
  if (item.text) {
    return [{ sessionId: activeSession()?.id || "", kind: type || "assistant_message", text: item.text, time: eventTime, data }];
  }
  return [];
}

function turnPendingEvent(turn, turnIndex, itemIndex = 0) {
  return {
    sessionId: activeSession()?.id || "",
    kind: "turn_started",
    text: "",
    time: turn?.startedAt || new Date().toISOString(),
    data: {
      status: "running",
      turnId: turn?.id || "",
      turnKey: turn?.id || `turn-${turnIndex}`,
      contentUnit: itemIndex,
    },
  };
}

function lastIndexOfType(items, type) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if ((items[index]?.type || items[index]?.raw?.type) === type) return index;
  }
  return -1;
}

function isTurnRunning(turn) {
  return ["running", "active", "pending", "starting", "inprogress", "in_progress"].includes(String(turn?.status || "").trim().toLowerCase());
}

function isItemRunning(item) {
  return ["running", "active", "pending", "starting", "inprogress", "in_progress"].includes(String(item?.status || "").trim().toLowerCase());
}

function isPendingEvent(event) {
  return isActivityPending(event) || event?.data?.streaming === true;
}

function renderOlderEventsLoader(page) {
  if (!page?.loadingBefore) return "";
  return `
    <div class="codex-history-page-loader" role="status" aria-live="polite">
      <span class="codex-session-status-spinner" aria-hidden="true"></span>
      <span>正在加载更早记录</span>
    </div>`;
}

function conversationVirtualList(events, items) {
  const configEvent = events.find((event) => event.virtualList || event.data?.virtualList);
  const config = configEvent?.virtualList || configEvent?.data?.virtualList || {};
  const windowed = virtualizer.windowFor(items);
  return {
    height: config.height || "",
    marginTop: config.marginTop || "",
    ...windowed,
  };
}

function groupConversationEvents(events) {
  const items = [];
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if ((event.kind || "assistant_message") !== "user_message") {
      items.push({ type: "event", event });
      continue;
    }

    const followups = [];
    let cursor = index + 1;
    while (cursor < events.length) {
      const next = events[cursor];
      const kind = next.kind || "assistant_message";
      if (kind === "user_message" || (kind === "summary" && !next.inline)) break;
      followups.push(next);
      cursor += 1;
    }

    items.push({ type: "user-turn", event, followups });
    index = cursor - 1;
  }
  return items;
}

function renderConversationItem(item, index) {
  if (item.type === "user-turn") return renderUserTurn(item.event, item.followups, index);
  return renderEvent(item.event, index);
}

function renderHeaderActions() {
  return `
    <div class="flex flex-shrink-0 items-center">
      <div class="flex items-center gap-1">
        <span type="button" aria-haspopup="menu" aria-expanded="false" data-state="closed" class="contents outline-hidden cursor-interaction">
          <button type="button" class="border-token-border no-drag cursor-interaction flex items-center gap-1 border whitespace-nowrap select-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 rounded-full text-token-text-tertiary enabled:hover:bg-token-list-hover-background data-[state=open]:bg-token-list-hover-background border-transparent flex items-center justify-center p-0.5 relative" aria-label="最近任务。0 正在进行中">
            ${icons.svg("history", "icon-xs hover:opacity-80")}
            <span class="sr-only" aria-live="polite" aria-atomic="true">没有正在进行的任务</span>
          </button>
        </span>
        <span type="button" aria-haspopup="menu" aria-expanded="false" data-state="closed" class="contents outline-hidden cursor-interaction">
          <button type="button" class="border-token-border no-drag cursor-interaction flex items-center gap-1 border whitespace-nowrap select-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 rounded-full text-token-text-tertiary enabled:hover:bg-token-list-hover-background data-[state=open]:bg-token-list-hover-background border-transparent flex items-center justify-center p-0.5">${icons.svg("settings", "icon-xs")}</button>
        </span>
        <span data-state="closed" class="contents">
          <button type="button" class="border-token-border no-drag cursor-interaction flex items-center gap-1 border whitespace-nowrap select-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 rounded-full text-token-text-tertiary enabled:hover:bg-token-list-hover-background data-[state=open]:bg-token-list-hover-background border-transparent flex items-center justify-center p-0.5" aria-label="新聊天" data-action="new-chat">${icons.svg("newChat", "icon-xs")}</button>
        </span>
      </div>
    </div>`;
}

function renderSessionRow(session) {
  const running = session.status === "running";
  const trailing = running
    ? `<span class="codex-session-status-spinner" aria-label="Running" role="img"></span>`
    : escapeHTML(session.timeLabel || "");
  return `
    <div class="group relative h-[var(--height-token-row)] cursor-interaction rounded-[var(--radius-token-row)] py-row-y text-sm hover:bg-token-list-hover-background focus-visible:outline-offset-[-2px] px-[var(--padding-row-cell-x,var(--padding-row-x))]" role="button" tabindex="0" data-codex-session-id="${escapeAttr(session.id)}">
      <div class="contents" data-hover-card-open-immediately="true">
        <div class="absolute right-0 top-0 z-10 flex h-full items-center justify-end gap-2 pr-0.5 mr-0.5 w-[52px]" style="right: var(--task-row-trailing-inset);">
          <button type="button" class="focus-visible:outline-token-focus-ring pointer-events-none flex h-5 w-5 items-center justify-center rounded-md opacity-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-50 hover:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2" aria-label="归档对话" data-codex-archive-button>${icons.svg("archive", "icon-xs")}</button>
        </div>
      </div>
      <div class="flex h-full w-full items-center text-sm leading-4">
        <div class="flex min-w-0 flex-1 items-center gap-2 pl-0.5">
          <div class="flex min-w-0 flex-1 self-stretch items-center gap-2 text-base leading-5 text-token-foreground" data-thread-title-trigger="true">
            <span class="min-w-0 truncate select-none flex-1" data-thread-title="true" draggable="false">${escapeHTML(session.title)}</span>
          </div>
        </div>
        <div class="ml-[3px] flex items-center justify-end gap-1 relative mr-[var(--task-row-trailing-inset)] min-w-[26px]">
          <div><div class="text-token-description-foreground text-sm leading-4 empty:hidden tabular-nums overflow-visible truncate text-right group-focus-within:hidden group-hover:hidden shrink-0">${trailing}</div></div>
        </div>
      </div>
    </div>`;
}

function renderEvent(event, index) {
  const kind = event.kind || "assistant_message";
  if (kind === "user_message") return renderUserMessage(event, index);
  if (kind === "summary") return renderSummary(event, index);
  if (kind === "tool_summary") return renderToolSummaryTurn(event, index);
  if (isActivityEvent(event)) {
    return renderActivity(event, index);
  }
  if (kind === "error") return renderAssistantMessage({ ...event, text: event.text || "糟糕，出错了" }, index, true);
  return renderAssistantMessage(event, index, false);
}

function renderTurnContainer(index, role, content, afterContentOverride, eventForKey) {
  const turnKey = turnKeyFromEvent(eventForKey, index);
  const unit = contentUnitFor(eventForKey, role === "user" ? 0 : 0);
  const afterContent = afterContentOverride !== undefined
    ? afterContentOverride
    : role === "user"
    ? `
        <div class="flex flex-col"><div class="-mx-1.5 px-1.5" style="overflow: hidden; opacity: 1; height: auto;"></div></div>
        <div aria-hidden="true" class="w-full" style="height: var(--conversation-tool-assistant-gap, 8px);"></div>
        <div class="flex flex-col"><div></div></div>`
    : `<div class="flex flex-col"><div></div></div>`;
  return `
    <div class="[&_[data-virtualized-turn-content]]:[content-visibility:visible]" data-turn-key="${escapeAttr(turnKey)}">
      <div class="flex flex-col gap-0">
        <div class="flex flex-col">
          <div class="scroll-mt-4" data-content-search-unit-key="${escapeAttr(contentSearchKey(turnKey, unit, role))}" ${role === "user" ? "data-local-conversation-user-anchor=\"true\"" : ""}>
            ${content}
          </div>
        </div>
        <div aria-hidden="true" class="w-full" style="height: var(--conversation-tool-assistant-gap, 8px);"></div>
        ${afterContent}
      </div>
    </div>`;
}

function turnKeyFromEvent(event, index) {
  return event?.turnKey || event?.data?.turnKey || event?.turnId || event?.data?.turnId || `codex-turn-${index}`;
}

function contentUnitFor(event, fallback) {
  return event?.contentUnit ?? event?.data?.contentUnit ?? fallback;
}

function contentSearchKey(turnKey, unit, role) {
  return `${turnKey}:${unit}:${role}`;
}

function renderUserMessage(event, index) {
  return renderUserTurn(event, [], index);
}

function renderUserTurn(event, followups, index) {
  return renderTurnContainer(index, "user", renderUserContent(event), renderUserTurnAfterContent(followups, index, event), event);
}

function renderUserTurnAfterContent(followups, index, baseEvent) {
  const split = activitySummary.splitTurnFollowups(followups);
  const finalFollowup = split.finalFollowup;
  const streamFollowups = split.streamFollowups;
  const turnKey = turnKeyFromEvent(baseEvent, index);

  if (!streamFollowups.length && !split.hasProcessBlock && !finalFollowup) {
    return `
        <div class="flex flex-col"><div class="-mx-1.5 px-1.5" style="overflow: hidden; opacity: 1; height: auto;"></div></div>
        <div aria-hidden="true" class="w-full" style="height: var(--conversation-tool-assistant-gap, 8px);"></div>
        <div class="flex flex-col"><div></div></div>`;
  }

  if (finalFollowup && !streamFollowups.length && !split.hasProcessBlock) {
    const finalUnit = contentUnitFor(finalFollowup, 1);
    return `<div class="flex flex-col" data-local-conversation-final-assistant="true"><div data-content-search-unit-key="${escapeAttr(contentSearchKey(turnKey, finalUnit, "assistant"))}">${renderAssistantContent(finalFollowup, `${index}-final`, false)}</div></div>`;
  }

  if (split.hasProcessBlock && !streamFollowups.length) {
    const finalAttrs = finalFollowup ? ' data-local-conversation-final-assistant="true"' : "";
    const finalUnit = contentUnitFor(finalFollowup, 1);
    return `
        <div class="flex flex-col">${renderTurnProcessBlock(split, baseEvent, index)}</div>
        <div aria-hidden="true" class="w-full" style="height: var(--conversation-tool-assistant-gap, 8px);"></div>
        <div class="flex flex-col"${finalAttrs}><div${finalFollowup ? ` data-content-search-unit-key="${escapeAttr(contentSearchKey(turnKey, finalUnit, "assistant"))}"` : ""}>${finalFollowup ? renderAssistantContent(finalFollowup, `${index}-final`, false) : ""}</div></div>`;
  }

  const finalAttrs = finalFollowup ? ' data-local-conversation-final-assistant="true"' : "";
  const finalUnit = contentUnitFor(finalFollowup, streamFollowups.length + 1);
  return `
        <div class="flex flex-col">
          <div class="-mx-1.5 px-1.5" style="overflow: hidden; opacity: 1; height: auto;">
            <div class="flex flex-col space-y-0">
              ${streamFollowups.map((event, offset) => renderInlineTurnFollowup(event, baseEvent, index, offset)).join("")}
            </div>
          </div>
        </div>
        ${split.hasProcessBlock ? `<div aria-hidden="true" class="w-full" style="height: var(--conversation-tool-assistant-gap, 8px);"></div><div class="flex flex-col">${renderTurnProcessBlock(split, baseEvent, index)}</div>` : ""}
        <div aria-hidden="true" class="w-full" style="height: var(--conversation-tool-assistant-gap, 8px);"></div>
        <div class="flex flex-col"${finalAttrs}><div${finalFollowup ? ` data-content-search-unit-key="${escapeAttr(contentSearchKey(turnKey, finalUnit, "assistant"))}"` : ""}>${finalFollowup ? renderAssistantContent(finalFollowup, `${index}-final`, false) : ""}</div></div>`;
}

function renderInlineTurnFollowup(event, baseEvent, turnIndex, offset) {
  const content = renderInlineFollowupContent(event, turnIndex, offset);
  const direct = isInlineActivity(event);
  const turnKey = turnKeyFromEvent(baseEvent, turnIndex);
  const unit = contentUnitFor(event, offset + 1);
  const wrapped = direct
    ? content
    : `<div data-content-search-unit-key="${escapeAttr(contentSearchKey(turnKey, unit, "assistant"))}">${content}</div>`;
  if (offset === 0) return `<div style="overflow: hidden;">${wrapped}</div>`;
  return `
    <div style="overflow: hidden;">
      <div aria-hidden="true" class="w-full" style="height: var(--conversation-tool-assistant-gap, 8px);"></div>
      ${wrapped}
    </div>`;
}

function isInlineActivity(event) {
  return isActivityEvent(event);
}

function renderInlineFollowupContent(event, turnIndex, offset) {
  const kind = event.kind || "assistant_message";
  if (kind === "command_group") {
    return renderCommandGroupActivity(event);
  }
  if (isInlineActivity(event)) {
    return renderActivityContent(event);
  }
  if (kind === "tool_summary") return renderToolSummaryContent(event);
  if (kind === "error") return renderAssistantContent({ ...event, text: event.text || "糟糕，出错了" }, turnIndex, true, false);
  return renderAssistantContent(event, `${turnIndex}-${offset}`, false, false);
}

function renderUserContent(event) {
  return `
    <div class="flex flex-col items-end gap-2">
      ${renderUserAttachments(event)}
      ${renderUserBubble(event)}
    </div>`;
}

function renderUserAttachments(event) {
  const attachments = Array.isArray(event.attachments)
    ? event.attachments
    : Array.isArray(event.data?.attachments)
      ? event.data.attachments
      : [];
  if (!attachments.length) return "";
  return `
      <div class="hide-scrollbar flex max-w-full flex-row-reverse self-end overflow-x-auto">
        <div class="flex min-w-max items-end gap-2">
          ${attachments.map(renderUserAttachment).join("")}
        </div>
      </div>`;
}

function renderUserAttachment(attachment) {
  const src = attachment?.src || config.SAMPLE_ATTACHMENT_PLACEHOLDER;
  const label = attachment?.label || "用户附件";
  return `
          <div class="size-20 cursor-interaction rounded-lg border border-token-border-heavy focus:outline-none focus-visible:ring-1 focus-visible:ring-token-focus-border" role="button" tabindex="0" aria-label="${escapeAttr(label)}" type="button" aria-haspopup="dialog" aria-expanded="false" data-state="closed">
            <img class="h-full w-full rounded-md object-cover" referrerpolicy="no-referrer" alt="${escapeAttr(label)}" src="${escapeAttr(src)}">
          </div>`;
}

function renderUserBubble(event) {
  const editable = Boolean(event.editable || event.data?.editable);
  const bubbleAttrs = editable
    ? `role="button" aria-label="编辑用户消息" data-user-message-bubble="true"`
    : `data-user-message-bubble="true" tabindex="0"`;
  const cursorClass = editable ? " cursor-interaction" : "";
  return `
    <div class="group flex w-full flex-col items-end justify-end gap-1">
      <div ${bubbleAttrs} class="bg-token-foreground/5 max-w-[77%] min-w-0 overflow-hidden break-words rounded-2xl px-3 py-2 [&_.contain-inline-size]:[contain:initial] text-left focus-visible:ring-2 focus-visible:ring-token-focus-border focus-visible:outline-none${cursorClass}">
        <div class="flex flex-col items-end gap-1">
          <div class="text-size-chat relative w-full min-w-0">
            <div class="codex-message-content text-size-chat">${markdown.render(event.text, { variant: "user" })}</div>
          </div>
        </div>
      </div>
      <div class="flex flex-row-reverse items-center gap-1">
        <div class="mr-1 ms-1 flex items-center gap-2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
          <span class="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
            <span class="text-xs text-token-text-tertiary">${timeFromEvent(event)}</span>
          </span>
          <div class="flex items-center gap-0.5">
            ${renderMessageIconButton("复制消息", "copy")}
            ${editable ? renderMessageIconButton("编辑消息", "edit") : ""}
          </div>
        </div>
      </div>
    </div>`;
}

function renderAssistantMessage(event, index, isError) {
  return renderTurnContainer(index, "assistant", renderAssistantContent(event, index, isError), undefined, event);
}

function renderAssistantContent(event, index, isError, includeActions = true) {
  const errorClass = isError ? " codex-error-message" : "";
  const messageText = markdown.render(event.text || assistantTextFromData(event.data), {
    variant: isError ? "error" : "assistant",
  });
  const actionsVisible = Boolean(event.actionsVisible || event.data?.actionsVisible);
  const actionClass = actionsVisible
    ? "-translate-x-1.5 mt-1.5 flex h-5 items-center justify-start gap-0.5 [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-token-focus-border [&_button]:focus-visible:ring-offset-0"
    : "-translate-x-1.5 mt-1.5 flex h-5 items-center justify-start gap-0.5 [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-token-focus-border [&_button]:focus-visible:ring-offset-0 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100";
  return `
    <div class="group flex min-w-0 flex-col">
      <div data-selected-text-overlay-target="codex-assistant-${index}" class="codex-message-content text-size-chat${errorClass}">${messageText}</div>
      ${event.diffCard || event.data?.diffCard ? renderDiffCard(event.diffCard || event.data.diffCard) : ""}
      ${includeActions ? `<div class="${actionClass}">
        ${renderMessageIconButton("复制", "copy", "p-0.5", false)}
        ${renderMessageIconButton("从此处开始分叉", "branch", "p-0.5", false)}
        <span class="ml-1.5 flex h-full items-center opacity-0 group-focus-within:opacity-100 group-hover:opacity-100" data-assistant-message-sent-time="true"><span class="text-xs text-token-text-tertiary">${timeFromEvent(event)}</span></span>
      </div>` : ""}
    </div>`;
}

function renderDiffCard(card) {
  const files = Array.isArray(card?.files) && card.files.length ? card.files : ["frontend/src/app/bootstrap.js", "frontend/src/app/layout.css", "frontend/src/pages/codex/index.js"];
  const total = card?.total || files.length;
  const additions = card?.additions || "+1,198";
  const deletions = card?.deletions || "-2";
  return `
      <div class="mt-3">
        <div class="flex w-full flex-col gap-3">
          <div class="flex max-w-full flex-col overflow-hidden rounded-lg bg-token-dropdown-background/50 text-token-foreground [--thread-resource-card-row-padding-x:0.75rem] mb-2 text-base [--turn-diff-row-padding-y:0.25rem]">
            <div class="group/turn-diff-header relative focus-within:[&_.turn-diff-default-subtitle]:hidden hover:[&_.turn-diff-default-subtitle]:hidden focus-within:[&_.turn-diff-hover-subtitle]:inline-flex hover:[&_.turn-diff-hover-subtitle]:inline-flex">
              <button type="button" class="absolute inset-0 cursor-interaction bg-transparent group-hover/turn-diff-header:bg-token-list-hover-background/30 focus-visible:ring-1 focus-visible:ring-token-focus-border focus-visible:outline-none focus-visible:ring-inset" aria-label="审查已更改的文件"></button>
              <span class="flex min-w-0 items-center gap-2.5 text-left px-[var(--thread-resource-card-row-padding-x)] py-3 pointer-events-none relative z-10">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-token-bg-secondary text-token-text-secondary">${icons.svg("newChat", "icon-sm")}</span>
                <span class="flex min-w-0 flex-1 flex-col">
                  <span class="text-size-chat truncate font-medium text-token-foreground">已编辑 ${escapeHTML(total)} 个文件</span>
                  <span class="text-size-chat-sm truncate text-token-text-secondary">
                    <span class="turn-diff-default-subtitle inline-flex">
                      <span data-thread-find-skip="true" class="inline-flex items-center gap-1 disambiguated-digits tabular-nums tracking-tight text-size-chat-sm">
                        <span class="flex shrink-0 items-center text-token-git-decoration-added-resource-foreground">${escapeHTML(additions)}</span>
                        <span class="flex shrink-0 items-center text-token-git-decoration-deleted-resource-foreground">${escapeHTML(deletions)}</span>
                      </span>
                    </span>
                    <span class="turn-diff-hover-subtitle hidden items-center gap-1">查看更改${icons.svg("chevronRight", "icon-2xs")}</span>
                  </span>
                </span>
                <div class="pointer-events-auto flex items-center gap-2">
                  <button type="button" class="border-token-border no-drag cursor-interaction flex items-center gap-1 border whitespace-nowrap select-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 rounded-lg text-token-foreground enabled:hover:bg-token-list-hover-background data-[state=open]:bg-token-list-hover-background border-transparent h-token-button-composer px-2 py-0 text-base leading-[18px]">撤销${icons.svg("back", "icon-2xs")}</button>
                  <button type="button" class="border-token-border no-drag cursor-interaction flex items-center gap-1 border whitespace-nowrap select-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 rounded-lg border-token-border text-token-button-tertiary-foreground bg-token-bg-fog enabled:hover:bg-token-list-hover-background data-[state=open]:bg-token-list-hover-background border h-token-button-composer px-2 py-0 text-base leading-[18px]">审核</button>
                </div>
              </span>
            </div>
            <div class="flex flex-col border-t border-token-border [--codex-diffs-header-padding-x:var(--thread-resource-card-row-padding-x)] [--codex-diffs-header-padding-y:var(--turn-diff-row-padding-y)] [--codex-diffs-surface-override:color-mix(in_oklab,var(--color-token-dropdown-background)_50%,transparent)]">
              ${files.map(renderDiffFileRow).join("")}
              ${card?.showMore ? `<button type="button" class="text-size-chat flex h-9 w-full cursor-interaction items-center px-[var(--thread-resource-card-row-padding-x)] py-[var(--turn-diff-row-padding-y)] text-left text-token-text-primary hover:bg-token-list-hover-background/30 focus-visible:ring-1 focus-visible:ring-token-focus-border focus-visible:outline-none focus-visible:ring-inset" aria-expanded="false">
                <span class="inline-flex min-w-0 items-center gap-2"><span class="truncate">再显示 1 个文件</span>${icons.svg("chevronRight", "icon-2xs")}</span>
              </button>` : ""}
            </div>
          </div>
        </div>
      </div>`;
}

function renderDiffFileRow(file) {
  const item = normalizeDiffFile(file);
  return `
              <div class="thread-diff-virtualized">
                <span data-state="closed" class="contents">
                  <button type="button" data-state="closed" class="text-size-chat flex h-9 w-full cursor-interaction items-center gap-2 bg-token-main-surface-primary/70 px-[var(--thread-resource-card-row-padding-x)] py-[var(--turn-diff-row-padding-y)] text-left hover:bg-token-list-hover-background/60 focus-visible:ring-1 focus-visible:ring-token-focus-border focus-visible:outline-none focus-visible:ring-inset">
                    <span class="sr-only">${escapeHTML(item.path)}</span>
                    <span aria-hidden="true" class="flex min-w-0 flex-1 items-center">
                      <span class="min-w-0 truncate text-token-description-foreground">${escapeHTML(item.dir)}</span>
                      <span class="max-w-full shrink-0 truncate text-token-foreground">${escapeHTML(item.name)}</span>
                    </span>
                    <span data-thread-find-skip="true" class="inline-flex items-center gap-1 disambiguated-digits tabular-nums tracking-tight">
                      <span class="flex shrink-0 items-center text-token-git-decoration-added-resource-foreground">${escapeHTML(item.additions)}</span>
                      <span class="flex shrink-0 items-center text-token-git-decoration-deleted-resource-foreground">${escapeHTML(item.deletions)}</span>
                    </span>
                  </button>
                </span>
              </div>`;
}

function normalizeDiffFile(file) {
  const pathValue = typeof file === "string" ? file : String(file?.path || "");
  const parts = pathValue.split("/");
  const name = parts.pop() || pathValue;
  const dir = parts.length ? `${parts.join("/")}/` : "./";
  return {
    path: pathValue || name,
    dir,
    name,
    additions: typeof file === "object" && file?.additions ? file.additions : "+1",
    deletions: typeof file === "object" && file?.deletions ? file.deletions : "-0",
  };
}

function renderMessageIconButton(label, iconKind, sizeClass = "p-0.5", withFocusRing = true) {
  const iconName = iconKind === "branch" ? "branchMessage" : iconKind === "edit" ? "editMessage" : "copyMessage";
  const focusClass = withFocusRing ? " focus-visible:ring-2 focus-visible:ring-token-focus-border focus-visible:ring-offset-0" : "";
  return `
    <span data-state="closed" class="contents">
      <button type="button" class="border-token-border no-drag cursor-interaction flex items-center gap-1 border whitespace-nowrap select-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 rounded-full text-token-text-tertiary enabled:hover:bg-token-list-hover-background data-[state=open]:bg-token-list-hover-background border-transparent flex items-center justify-center ${sizeClass}${focusClass}" aria-label="${escapeAttr(label)}">
        ${icons.svg(iconName, "icon-xs")}
      </button>
    </span>`;
}

function renderSummary(event, index) {
  const followup = event.followup || event.data?.followup;
  const turnKey = turnKeyFromEvent(event, index);
  const followupUnit = contentUnitFor(followup, 1);
  return `
    <div class="[&_[data-virtualized-turn-content]]:[content-visibility:visible]" data-turn-key="${escapeAttr(turnKey)}">
      <div class="flex flex-col gap-0">
        <div class="flex flex-col">
          ${renderSummaryBody(event)}
        </div>
        <div aria-hidden="true" class="w-full" style="height: var(--conversation-tool-assistant-gap, 8px);"></div>
        <div class="flex flex-col"${followup ? ' data-local-conversation-final-assistant="true"' : ""}><div${followup ? ` data-content-search-unit-key="${escapeAttr(contentSearchKey(turnKey, followupUnit, "assistant"))}"` : ""}>${followup ? renderAssistantContent(followup, `${index}-summary`, false) : ""}</div></div>
      </div>
    </div>`;
}

function renderSummaryBody(event) {
  return `
          <div class="text-size-chat text-token-text-secondary">
            <button type="button" class="text-size-chat hover:bg-token-bg-subtle inline-flex items-center gap-1 rounded-md border border-transparent focus-visible:ring-2 focus-visible:ring-token-focus-border focus-visible:outline-none" aria-expanded="false">
              <span><span class="text-token-foreground/60">${escapeHTML(event.text || "已处理")}</span></span>
              ${icons.svg("chevronRight", "icon-2xs text-token-foreground/40 transition-transform duration-200 rotate-0")}
            </button>
          </div>
          <div class="text-size-chat pt-1 text-token-text-secondary">
            <div class="w-full border-t border-token-border-light"></div>
          </div>`;
}

function renderTurnProcessBlock(split, baseEvent, turnIndex) {
  const label = activitySummary.summaryLabel(baseEvent, split);
  if (!split.processFollowups.length) return renderSummaryBody({ text: label });

  return `
          <div class="text-size-chat text-token-text-secondary codex-turn-activity">
            <details class="codex-turn-activity-details">
              <summary class="codex-turn-activity-summary">
                <span class="text-size-chat hover:bg-token-bg-subtle inline-flex cursor-interaction items-center gap-1 rounded-md border border-transparent focus-visible:ring-2 focus-visible:ring-token-focus-border focus-visible:outline-none">
                  <span><span class="text-token-foreground/60">${escapeHTML(label)}</span></span>
                  ${icons.svg("chevronRight", "codex-turn-activity-chevron icon-2xs text-token-foreground/40 transition-transform duration-200 rotate-0")}
                </span>
                <span class="text-size-chat block pt-1 text-token-text-secondary">
                  <span class="block w-full border-t border-token-border-light"></span>
                </span>
              </summary>
              <div class="codex-turn-activity-expanded">
                ${renderTurnProcessContent(split.processFollowups, baseEvent, turnIndex)}
              </div>
            </details>
          </div>`;
}

function renderTurnProcessContent(events, baseEvent, turnIndex) {
  return (Array.isArray(events) ? events : [])
    .map((event, offset) => renderInlineTurnFollowup(event, baseEvent, turnIndex, offset))
    .join("");
}

function renderCommandGroupActivity(event) {
  const label = event.text || "已运行命令";
  const status = event.status || event.data?.status || "";
  const statusText = status && status !== "completed" ? `<span class="codex-turn-activity-status">${escapeHTML(status)}</span>` : "";
  return `
                  <div class="codex-turn-activity-row">
                    ${icons.svg("cursor", "codex-turn-activity-icon")}
                    <span class="codex-turn-activity-row-label">${escapeHTML(label)}</span>
                    ${statusText}
                  </div>`;
}

function renderActivity(event, index) {
  const turnKey = turnKeyFromEvent(event, index);
  return `
    <div class="[&_[data-virtualized-turn-content]]:[content-visibility:visible]" data-turn-key="${escapeAttr(turnKey)}">
      <div class="flex flex-col gap-0">
        <div class="flex flex-col"><div class="scroll-mt-4"></div></div>
        <div aria-hidden="true" class="w-full" style="height: var(--conversation-tool-assistant-gap, 8px);"></div>
        <div class="flex flex-col">
          <div class="text-size-chat text-token-text-secondary">
            ${renderActivityContent(event)}
          </div>
          <div class="text-size-chat pt-1 text-token-text-secondary"></div>
        </div>
        <div aria-hidden="true" class="w-full" style="height: var(--conversation-tool-assistant-gap, 8px);"></div>
        <div class="flex flex-col"><div></div></div>
      </div>
    </div>`;
}

function renderActivityContent(event) {
  if (isActivityPending(event) && ["turn_started", "reasoning"].includes(event.kind || "")) {
    return renderThinkingPlaceholder(event);
  }
  if (isActivityPending(event)) {
    return renderRunningActivityDisclosure(event);
  }

  const label = activityLabel(event);
  const iconName = activityIcon(event);
  return `
    <div class="min-w-0 text-size-chat relative overflow-visible py-0">
      <div class="flex min-w-0 flex-col">
        <button type="button" class="group/activity-header inline-flex min-w-0 max-w-full self-start items-center gap-1.5 p-0 text-left cursor-interaction" aria-expanded="false">
          <span class="text-size-chat flex min-w-0 shrink items-center gap-1.5 truncate">
            <span class="text-token-conversation-summary-trailing flex min-w-0 max-w-full items-center truncate shrink overflow-hidden [mask-image:linear-gradient(to_right,black_calc(100%_-_0.25rem),transparent)] [mask-repeat:no-repeat] pr-1 group-hover/activity-header:text-token-foreground">
              <span class="inline-flex max-w-full min-w-0 items-center gap-1.5 overflow-hidden">
                ${iconName ? icons.svg(iconName, "icon-xs shrink-0 text-token-input-placeholder-foreground") : ""}
                <span class="min-w-0 flex-1 truncate">${escapeHTML(label)}</span>
              </span>
            </span>
          </span>
          ${icons.svg("chevronRight", "icon-2xs shrink-0 text-token-input-placeholder-foreground opacity-0 group-hover/activity-header:opacity-100 group-hover/activity-header:text-token-foreground group-focus-visible/activity-header:opacity-100 group-focus-visible/activity-header:text-token-foreground transition-transform duration-300")}
        </button>
      </div>
    </div>`;
}

function renderThinkingPlaceholder(event) {
  const label = activityLabel(event);
  return `
    <div class="min-w-0 text-size-chat py-0">
      <div class="inline-flex min-w-0 items-center">
        <span aria-hidden="true" class="h-4 w-0 shrink-0"></span>
        ${renderShimmerText(label, "min-w-0 truncate select-none")}
      </div>
    </div>`;
}

function renderRunningActivityDisclosure(event) {
  const label = activityLabel(event);
  const iconName = activityIcon(event);
  const body = renderActivityDisclosureBody(event);
  const chevronClass = body
    ? "icon-2xs shrink-0 text-token-input-placeholder-foreground opacity-0 group-hover/activity-header:opacity-100 group-hover/activity-header:text-token-foreground group-focus-visible/activity-header:opacity-100 group-focus-visible/activity-header:text-token-foreground transition-transform duration-300 rotate-90 opacity-100"
    : "icon-2xs shrink-0 text-token-input-placeholder-foreground opacity-0 group-hover/activity-header:opacity-100 group-hover/activity-header:text-token-foreground group-focus-visible/activity-header:opacity-100 group-focus-visible/activity-header:text-token-foreground transition-transform duration-300";
  return `
    <div class="min-w-0 text-size-chat relative overflow-visible py-0">
      <div class="flex min-w-0 flex-col">
        <button type="button" class="group/activity-header inline-flex min-w-0 max-w-full self-start items-center gap-1.5 p-0 text-left cursor-interaction" aria-expanded="${body ? "true" : "false"}">
          <span class="text-size-chat flex min-w-0 shrink items-center gap-1.5 truncate">
            ${iconName ? icons.svg(iconName, "icon-xs shrink-0 text-token-input-placeholder-foreground") : ""}
            ${renderShimmerText(label, "text-size-chat min-w-0 truncate text-token-conversation-summary-leading group-hover/activity-header:text-token-foreground")}
          </span>
          ${icons.svg("chevronRight", chevronClass)}
        </button>
        ${body}
      </div>
    </div>`;
}

function renderActivityDisclosureBody(event) {
  const items = Array.isArray(event.items)
    ? event.items
    : Array.isArray(event.data?.items)
      ? event.data.items
      : [];
  if (!items.length) return "";
  return `
        <div aria-hidden="false" class="overflow-visible" style="pointer-events: auto;">
          <div class="flex flex-col gap-2 pt-2 pb-1 pl-6">
            ${items.map((item) => `<div class="codex-message-content text-size-chat text-token-text-secondary">${markdown.render(toolSummaryItemText(item), { variant: "activity" })}</div>`).join("")}
          </div>
        </div>`;
}

function renderShimmerText(text, className) {
  const label = escapeHTML(text);
  return `
        <span class="loading-shimmer-pure-text codex-shimmer ${className}">
          ${label}
          <span aria-hidden="true" class="codex-shimmer-sweep"><span class="codex-shimmer-highlight">${label}</span></span>
        </span>`;
}

function renderToolSummaryTurn(event, index) {
  return renderTurnContainer(index, "tool-summary", renderToolSummaryContent(event, index), undefined, event);
}

function renderToolSummaryContent(event, index) {
  const summaryText = toolSummaryText(event);
  return `
    <div class="group flex min-w-0 flex-col gap-2">
      <div data-selected-text-overlay-target="codex-tool-summary-${index}" class="codex-message-content codex-tool-summary-content text-size-chat">${markdown.render(summaryText, { variant: "tool-summary" })}</div>
    </div>`;
}

function toolSummaryText(event) {
  const items = Array.isArray(event.items)
    ? event.items
    : Array.isArray(event.data?.items)
      ? event.data.items
      : null;
  if (!items) return String(event.text || "");
  return items.map(toolSummaryItemText).join("\n");
}

function toolSummaryItemText(item) {
  if (item && typeof item === "object") {
    return String(item.text || item.path || item.file || item.name || "");
  }
  return String(item || "");
}

function renderHomeComposer() {
  return `
    <div class="codex-home-composer mx-auto w-full max-w-(--thread-content-max-width) px-toolbar relative z-10 flex shrink-0 flex-col gap-2 pb-2">
      <div class="home-banners mt-2 flex flex-col gap-2 empty:hidden"></div>
      <div class="min-w-0">${renderComposerSurface("随心输入", false)}</div>
    </div>`;
}

function renderThreadComposer() {
  return `
    <div data-thread-scroll-footer="true" class="codex-thread-footer w-full">
      <div class="codex-thread-footer-fade pointer-events-none absolute inset-x-0 bottom-0 z-0 flex h-full w-full justify-center pt-4">
        <div class="z-0 h-full w-full bg-gradient-to-t from-token-main-surface-primary via-token-main-surface-primary"></div>
      </div>
      <div data-pip-obstacle="thread-footer" class="codex-thread-footer-content relative z-10 flex flex-col mx-auto w-full max-w-(--thread-content-max-width) px-toolbar">
        <div class="flex flex-col" data-thread-find-composer="true">
          <div class="relative h-0">
            <button class="cursor-interaction absolute z-30 flex h-8 w-8 translate-x-1/2 items-center justify-center rounded-full border border-token-border-default bg-token-main-surface-primary bg-clip-padding text-token-text-secondary transition-opacity duration-150 ease-in-out end-1/2 print:hidden pointer-events-none opacity-0 bottom-[calc(100%+6*var(--spacing))]" aria-hidden="true" aria-label="Scroll to bottom" type="button" tabindex="-1">${icons.svg("send", "icon rotate-180 text-token-text-primary")}</button>
          </div>
          <div class="flex flex-col gap-2"><div class="codex-composer-frame min-w-0">${renderComposerSurface("要求后续变更", true)}</div></div>
        </div>
      </div>
    </div>`;
}

function renderComposerSurface(placeholder, includeExternalFooter) {
  const editorClass =
    state.view === "list" && (state.popover === "" || state.popover === "plus")
      ? "codex-editor codex-editor-focused"
      : "codex-editor";
  return `
    <div class="codex-composer-surface relative flex w-full min-w-0 flex-col gap-2" data-codex-composer-surface>
      <div id="aboveComposerLayer" data-above-composer-layer="true" class="relative px-5 empty:hidden"></div>
      <div id="aboveComposerQueueLayer" data-above-composer-queue-layer="true" class="relative px-5 empty:hidden"></div>
      <div class="codex-composer-card-wrap relative">
        ${state.popover === "plus" ? renderPlusOverlay() : '<div class="@container pointer-events-none absolute inset-x-0 bottom-full z-20 mb-2 flex justify-center"></div>'}
        <div class="codex-composer-card codex-composer-multiline-surface codex-composer-surface relative flex flex-col bg-token-input-background/90 backdrop-blur-lg">
          <div class="codex-composer-card-inner relative z-10 flex min-h-0 flex-1 flex-col">
            <div class="codex-composer-attachments codex-composer-attachments-default"></div>
            <div class="codex-composer-editor-viewport mb-1 flex-grow overflow-y-auto px-3">
              <div class="codex-composer-editor text-size-chat text-token-foreground h-auto max-h-[25dvh] overflow-y-auto text-base">
                <div contenteditable="true" spellcheck="true" translate="no" class="${editorClass}" data-virtualkeyboard="true" data-placeholder="${escapeAttr(placeholder)}" data-codex-empty="true" style="font-size: var(--codex-chat-font-size); height: auto; resize: none; min-height: 2.75rem;" data-codex-composer="true"><p><br class="codex-editor-trailing-break"></p></div>
              </div>
            </div>
            ${renderComposerFooter()}
          </div>
        </div>
      </div>
      ${includeExternalFooter ? renderExternalFooter() : ""}
      ${renderFloatingPopover()}
    </div>`;
}

function renderComposerFooter() {
  const plusState = state.popover === "plus" ? "open" : "closed";
  const approvalState = state.popover === "approval" ? "open" : "closed";
  const modelState = state.popover === "model" ? "open" : "closed";
  const running = isActiveSessionRunning();
  const sendAction = running ? "cancel" : "send";
  const sendLabel = running ? "停止生成" : "发送";
  const sendClass = running ? "codex-composer-send-button codex-send-ready codex-stop-ready" : "codex-composer-send-button opacity-50";
  const sendIcon = running ? "stop" : "send";
  return `
    <div class="codex-composer-footer select-none">
      <button type="button" class="codex-composer-button codex-composer-plus-button ${plusState === "open" ? "text-token-foreground" : "text-token-text-tertiary"}" aria-label="添加文件等内容" aria-expanded="${plusState === "open"}" data-state="${plusState}" data-popover="plus">${icons.svg("plus", "icon-sm")}</button>
      <button type="button" class="codex-composer-button codex-composer-approval-button text-token-text-tertiary" aria-haspopup="menu" aria-expanded="${approvalState === "open"}" data-state="${approvalState}" data-popover="approval">
        ${icons.svg("hand", "icon-xs shrink-0")}
        <span class="codex-label-xs max-w-40 truncate whitespace-nowrap text-left">请求批准</span>
        ${icons.svg("chevron20x21", "icon-2xs shrink-0 text-token-input-placeholder-foreground")}
      </button>
      <button type="button" class="codex-composer-button codex-composer-model-button text-token-text-tertiary" aria-haspopup="menu" aria-expanded="${modelState === "open"}" data-state="${modelState}" data-codex-intelligence-trigger="true" data-selected-reasoning-effort="xhigh" data-popover="model">
        <span class="flex max-w-40 min-w-0 items-center gap-1.5">
          <span class="flex min-w-0 items-center gap-1 tabular-nums"><span class="truncate whitespace-nowrap text-token-foreground">5.5</span></span>
          <span class="codex-label-sm shrink-0 text-token-description-foreground">超高</span>
        </span>
        ${icons.svg("chevron20x21", "icon-2xs text-token-input-placeholder-foreground")}
      </button>
      <button type="button" class="codex-composer-button codex-composer-context-button group text-token-text-link-foreground" data-state="closed">
        ${icons.svg("localMode", "icon-xs shrink-0 group-hover:hidden", { ariaHidden: true })}
        ${icons.svg("closeCircle", "icon-xs hidden shrink-0 group-hover:block", { ariaHidden: true })}
        <span class="codex-footer-label truncate max-w-20">运行上下文</span>
      </button>
      <button type="button" class="${sendClass}" aria-label="${sendLabel}" data-state="${running ? "open" : "closed"}" data-action="${sendAction}">${icons.svg(sendIcon, "codex-composer-send-icon")}</button>
    </div>`;
}

function renderPlusOverlay() {
  return `
    <div data-composer-overlay="true" class="absolute left-0 right-0 bottom-full mb-2 z-50">
      <div class="border-token-border bg-token-dropdown-background/90 relative flex w-full flex-col overflow-hidden rounded-2xl border p-1 text-sm backdrop-blur-sm max-h-[320px]">
        <div class="vertical-scroll-fade-mask flex w-full flex-1 flex-col overflow-y-auto">
          <div>
            <div class="bg-token-dropdown-background/95 text-token-description-foreground sticky top-0 z-10 px-row-x py-1 text-sm backdrop-blur-sm">添加</div>
            ${overlayButton("attach", "文件和文件夹", "", true)}
            ${overlayButton("target", "目标", "设置 Codex 将持续努力实现的目标", false)}
            ${overlayButton("plan", "计划模式", "开启计划模式", false)}
          </div>
          <div>
            <div class="bg-token-dropdown-background/95 text-token-description-foreground sticky top-0 z-10 px-row-x py-1 text-sm backdrop-blur-sm pt-2">文件和聊天</div>
            <div class="px-row-x py-row-y text-sm text-token-input-placeholder-foreground">输入以搜索文件或聊天</div>
          </div>
        </div>
      </div>
    </div>`;
}

function overlayButton(icon, title, description, selected) {
  const selectedClass = selected ? " bg-token-list-hover-background opacity-100" : "";
  return `
    <button type="button" data-list-navigation-item="true" aria-selected="${selected}" class="text-token-foreground outline-hidden opacity-75 focus:bg-token-list-hover-background cursor-interaction w-full shrink-0 overflow-hidden rounded-lg px-row-x py-row-y text-left text-sm${selectedClass}">
      <div class="flex w-full min-w-0 items-center gap-2">
        ${icons.svg(icon, "icon-xs shrink-0")}
        <span class="truncate ${description ? "flex-shrink-0" : ""}">${escapeHTML(title)}</span>
        ${description ? `<span class="flex-1 truncate text-sm text-token-description-foreground">${escapeHTML(description)}</span>` : ""}
      </div>
    </button>`;
}

function renderFloatingPopover() {
  if (state.popover === "approval") return renderApprovalMenu();
  if (state.popover === "model") return renderModelMenu();
  return "";
}

function menuContentStyle() {
  return "outline: none; max-width: calc(100vw - 16px); max-height: calc(100vh - 16px);";
}

function renderApprovalMenu() {
  return `
    <div class="codex-floating-menu codex-floating-menu-approval" data-codex-menu-wrapper="" dir="ltr">
      <div data-side="top" data-align="start" role="menu" aria-orientation="vertical" data-state="open" data-codex-menu-content="" dir="ltr" class="codex-dropdown-content no-drag bg-token-dropdown-background/90 text-token-foreground ring-token-border z-50 m-px flex select-none flex-col overflow-y-auto rounded-xl ring-[0.5px] px-1 py-1 shadow-xl-spread backdrop-blur-sm" tabindex="-1" data-orientation="vertical" style="${menuContentStyle()}">
        <div class="text-token-description-foreground flex min-h-6 items-center truncate px-[var(--padding-row-x)] py-[var(--padding-row-y)] text-sm leading-4">
          <div class="flex items-center justify-between gap-8"><span>应如何批准 Codex 操作？</span><button type="button" class="cursor-interaction underline underline-offset-2 hover:text-token-description-foreground">了解更多</button></div>
        </div>
        ${approvalItem("hand", "请求批准", "编辑外部文件和使用互联网时始终询问", true)}
        ${approvalItem("shield", "完全访问权限", "可不受限制地访问互联网和您电脑上的任何文件", false)}
      </div>
    </div>`;
}

function approvalItem(icon, title, description, selected) {
  return `
    <div class="no-drag text-token-foreground outline-hidden rounded-lg px-[var(--padding-row-x)] py-[var(--padding-row-y)] text-sm group hover:bg-token-list-hover-background focus:bg-token-list-hover-background cursor-interaction flex flex-col" role="menuitem" tabindex="-1" data-orientation="vertical" data-codex-menu-item="">
      <div class="flex w-full items-center gap-3">
        ${icons.svg(icon, "icon-sm shrink-0 opacity-75 group-focus:opacity-100 group-hover:opacity-100")}
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="min-w-0 whitespace-normal">${escapeHTML(title)}</span>
          <span class="min-w-0 truncate"><span class="text-token-description-foreground">${escapeHTML(description)}</span></span>
        </div>
        ${selected ? icons.svg("check17", "icon-xs shrink-0 opacity-75 group-focus:opacity-100 group-hover:opacity-100") : ""}
      </div>
    </div>`;
}

function renderModelMenu() {
  const expanded = Boolean(state.modelMenuExpanded);
  const parentArrowClass = expanded
    ? "icon-xs shrink-0 opacity-75 group-focus:opacity-100 group-hover:opacity-100 codex-model-submenu-chevron-open"
    : "icon-xs shrink-0 opacity-75 group-focus:opacity-100 group-hover:opacity-100";
  return `
    <div class="codex-floating-menu codex-floating-menu-model" data-codex-menu-wrapper="" dir="ltr">
      <div data-side="top" data-align="end" role="menu" aria-orientation="vertical" data-state="open" data-codex-menu-content="" dir="ltr" class="codex-dropdown-content no-drag bg-token-dropdown-background/90 text-token-foreground ring-token-border z-50 m-px flex select-none flex-col overflow-y-auto rounded-xl ring-[0.5px] px-1 py-1 shadow-xl-spread backdrop-blur-sm w-52" tabindex="-1" data-orientation="vertical" style="${menuContentStyle()}">
        <div class="text-token-description-foreground flex min-h-6 items-center truncate px-[var(--padding-row-x)] py-[var(--padding-row-y)] text-sm leading-4">推理</div>
        <div class="flex max-h-[250px] flex-col overflow-y-auto">
          ${menuItem("低")}
          ${menuItem("中")}
          ${menuItem("高")}
          ${menuItem("超高", { selected: true })}
        </div>
        <div class="w-full px-[var(--padding-row-x)] py-1"><div class="h-[1px] w-full bg-token-menu-border"></div></div>
        <div class="flex flex-col" data-state="${expanded ? "open" : "closed"}">
          ${menuItem("GPT-5.5", {
            action: "toggle-model-submenu",
            nested: true,
            expanded,
            arrowClass: parentArrowClass,
          })}
          ${expanded ? `
            <div class="overflow-hidden" style="height: auto; opacity: 1;">
              <div class="text-token-description-foreground flex min-h-6 items-center truncate px-[var(--padding-row-x)] py-[var(--padding-row-y)] text-sm leading-4">模型</div>
              <div class="vertical-scroll-fade-mask flex max-h-[250px] flex-col overflow-y-auto">
                ${menuItem("GPT-5.5", { selected: true, selectedKind: "model" })}
                ${menuItem("GPT-5.4")}
                ${menuItem("GPT-5.4-Mini")}
                ${menuItem("GPT-5.3-Codex")}
                ${menuItem("GPT-5.2")}
              </div>
            </div>` : ""}
        </div>
      </div>
    </div>`;
}

function menuItem(label, options = {}) {
  const {
    action = "",
    arrowClass = "icon-xs shrink-0 opacity-75 group-focus:opacity-100 group-hover:opacity-100",
    expanded = false,
    nested = false,
    selected = false,
    selectedKind = "reasoning",
  } = options;
  const simple = !nested && !String(label).startsWith("GPT-");
  const selectedAttr = selected ? `data-${selectedKind}-selected="true"` : "";
  const actionAttr = action ? `data-action="${escapeAttr(action)}"` : "";
  const expandedAttr = nested ? `aria-expanded="${expanded ? "true" : "false"}"` : "";
  return `
    <div class="no-drag text-token-foreground outline-hidden rounded-lg px-[var(--padding-row-x)] py-[var(--padding-row-y)] text-sm group hover:bg-token-list-hover-background focus:bg-token-list-hover-background cursor-interaction flex flex-col" role="menuitem" ${selectedAttr} ${actionAttr} ${expandedAttr} tabindex="-1" data-orientation="vertical" data-codex-menu-item="">
      <div class="flex w-full items-center gap-1.5">
        <span class="flex-1 min-w-0 truncate">${simple ? escapeHTML(label) : `<span class="flex min-w-0 items-center gap-1 tabular-nums"><span class="truncate whitespace-nowrap">${escapeHTML(label)}</span></span>`}</span>
        ${selected ? icons.svg("check17", "icon-xs shrink-0 opacity-75 group-focus:opacity-100 group-hover:opacity-100") : ""}
        ${nested ? `<span aria-hidden="true" class="inline-flex items-center justify-center text-token-input-placeholder-foreground">${icons.svg("chevronRight", arrowClass)}</span>` : ""}
      </div>
    </div>`;
}

function renderExternalFooter() {
  return `
    <div class="codex-composer-external-footer codex-composer-external-footer-row select-none flex flex-nowrap items-center gap-1 overflow-hidden pr-2 flex-wrap gap-2 overflow-visible pl-2">
      <div class="flex min-w-0 flex-1 flex-nowrap items-center gap-1">
        <span type="button" aria-haspopup="menu" aria-expanded="false" data-state="closed" class="contents outline-hidden cursor-interaction">
          <button type="button" class="border-token-border no-drag cursor-interaction flex items-center gap-1 border whitespace-nowrap select-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 rounded-full text-token-text-tertiary enabled:hover:bg-token-list-hover-background data-[state=open]:bg-token-list-hover-background border-transparent h-token-button-composer-sm px-1.5 py-0 text-sm leading-[18px] codex-external-footer-item min-w-0">
            <span class="inline-flex shrink-0">${icons.svg("localMode", "icon-xs")}</span>
            <span class="codex-external-footer-item-text inline-flex min-w-0 items-baseline gap-1 text-left">
              <span class="codex-label-xs codex-external-footer-item-value min-w-0 truncate font-normal whitespace-nowrap max-w-40">
                <span class="codex-external-footer-item-value-content block max-w-full min-w-0 truncate" data-tooltip-overflow-target="true"><span class="codex-default-external-footer-only">本地模式</span><span class="codex-home-external-footer-only hidden">本地</span></span>
              </span>
            </span>
            ${icons.svg("chevron20x21", "codex-external-footer-item-chevron icon-2xs shrink-0 text-token-input-placeholder-foreground")}
          </button>
        </span>
      </div>
      <div class="flex min-w-0 shrink-0 items-center gap-3"></div>
    </div>`;
}

function syncComposerState() {
  const input = mount.root.querySelector("[data-codex-composer]");
  const send = mount.root.querySelector(".codex-composer-send-button");
  if (!input || !send) return;
  const hasText = Boolean(composerText(input));
  if (!hasText) ensureEmptyComposerStructure(input);
  input.dataset.codexEmpty = hasText ? "false" : "true";
  const running = isActiveSessionRunning();
  send.classList.toggle("opacity-50", !hasText && !running);
  send.classList.toggle("codex-send-ready", hasText || running);
  send.classList.toggle("codex-stop-ready", running);
}

function composerText(input) {
  if (!input) return "";
  return (input.innerText || input.textContent || "").replace(/\u00a0/g, " ").trim();
}

function clearComposer(input) {
  if (!input) return;
  input.innerHTML = '<p><br class="codex-editor-trailing-break"></p>';
  input.dataset.codexEmpty = "true";
}

function ensureEmptyComposerStructure(input) {
  if (!input) return;
  if (input.querySelector("p")) return;
  clearComposer(input);
}



    function activeSession() {
      return state.sessions.find((session) => session.id === state.activeSessionId) || state.sessions[0];
    }

    function isActiveSessionRunning() {
      return String(activeSession()?.status || "").toLowerCase() === "running";
    }

    return {
      render,
      syncComposerState,
      composerText,
      clearComposer,
    };
  }

  global.CodexPanelRenderer = { create: createCodexPanelRenderer };
})(window);
