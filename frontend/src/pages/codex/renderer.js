"use strict";

(function defineCodexPanelRenderer(global) {
  const {
    activityLabel,
    activityIcon,
    isActivityPending,
    assistantTextFromData,
    formatText,
    formatInlineText,
    formatUserText,
    formatInlineCodeText,
    timeFromEvent,
    escapeHTML,
    escapeAttr,
  } = global.CodexPanelUtils;

  function createCodexPanelRenderer(runtime) {
    const { state, mount, icons, config } = runtime;
    let shimmerCleanups = [];

function render() {
  clearShimmerTimers();
  mount.root.innerHTML = `${state.view === "thread" ? renderThreadView() : renderListView()}${renderToastViewport()}`;
  syncComposerState();
  syncThreadScrollPosition();
  syncCadencedShimmers();
}

function clearShimmerTimers() {
  for (const cleanup of shimmerCleanups) cleanup();
  shimmerCleanups = [];
}

function syncCadencedShimmers() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const nodes = Array.from(mount.root.querySelectorAll("._cadencedShimmer_18j3y_1"));
  for (const node of nodes) {
    let activeTimer = 0;
    const stopActive = () => {
      if (activeTimer) window.clearTimeout(activeTimer);
      activeTimer = 0;
    };
    const run = () => {
      stopActive();
      node.classList.remove("_cadencedShimmerActive_18j3y_46");
      node.classList.add("_cadencedShimmerActive_18j3y_46");
      activeTimer = window.setTimeout(() => {
        node.classList.remove("_cadencedShimmerActive_18j3y_46");
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
    scroll.scrollTop = 0;
  });
}

function renderListView() {
  return `
    <div class="flex h-full flex-col" data-vscode-context="{&quot;chatgpt.supportsNewChatMenu&quot;: true}" tabindex="0" data-codex-panel-root data-codex-view="list">
      ${renderListHeaderAndSessions()}
      <div class="relative flex h-full flex-col">
        <div class="[container-type:size] relative flex w-full flex-1 flex-col items-center justify-center overflow-hidden [container-name:home-main-content]" role="main">
          <div class="mx-auto flex w-full max-w-3xl flex-col gap-3 px-panel">
            ${icons.svg("blossom", "pointer-events-none fixed top-[calc(50%_-_55px)] left-1/2 -z-1 h-12 w-12 -translate-x-1/2 -translate-y-1/2 text-token-foreground/20 electron:hidden codex-home-watermark")}
          </div>
        </div>
        ${renderHomeComposer()}
      </div>
    </div>`;
}

function renderListHeaderAndSessions() {
  return `
    <div class="draggable extension:px-panel">
      <div class="flex items-center electron:h-toolbar extension:py-row-y justify-between">
        <div class="mr-3 line-clamp-1 flex min-w-0 flex-1 items-center gap-1 truncate" style="view-transition-name: header-title;">
          <span class="text-token-description-foreground">任务</span>
        </div>
        <div class="flex flex-shrink-0 items-center gap-1">${renderHeaderActions()}</div>
      </div>
      <div>
        <div class="group/inline -mx-[var(--padding-row-x)] flex flex-col gap-px rounded-xl pb-1 transition-colors [--task-row-trailing-inset:calc(var(--spacing)*1.5)]">
          ${state.sessions.map(renderSessionRow).join("")}
        </div>
      </div>
    </div>`;
}

function renderThreadView() {
  const session = activeSession();
  const sessionID = session?.id || "thread-reference";
  const fallbackEvents = runtime.samples?.eventsBySession?.get("thread-reference") || [];
  const events = state.eventsBySession.get(sessionID) || fallbackEvents;
  return `
    <div class="relative flex h-full flex-col min-h-0" data-vscode-context="{&quot;chatgpt.supportsNewChatMenu&quot;: true}" data-codex-panel-root data-codex-view="thread">
      <div class="sticky top-0 z-10">${renderHeader(session?.title || "任务", "thread")}</div>
      <div class="flex min-h-0 flex-1 flex-col [&_[data-thread-find-target=conversation]]:scroll-mt-24">
        <div class="relative mx-auto flex min-h-0 w-full flex-1 flex-col">
          <div class="min-h-0 flex-1">
            <div class="relative h-full flex-1 [content-visibility:auto]">
              <div data-app-action-timeline-scroll="" tabindex="0" class="thread-scroll-container relative h-full overflow-x-hidden overflow-y-auto [overflow-anchor:none] [scroll-padding-bottom:var(--thread-scroll-padding-bottom,0px)] electron:[scrollbar-gutter:stable_both-edges] pt-(--thread-content-top-inset) [container-name:thread-content] [container-type:inline-size] focus:outline-none [&:has([data-thread-scroll-footer='true']:focus-within)]:[scroll-padding-bottom:0px] flex flex-col-reverse" style="--thread-scroll-padding-bottom: 160px;" data-thread-scroll>
                  <div class="flex min-h-full shrink-0 flex-col justify-start" data-thread-content-shell>
                    <div data-mcp-app-portal-target="true" class="mx-auto w-full max-w-(--thread-content-max-width) px-toolbar relative flex flex-1 shrink-0 flex-col pb-8">
                      <div data-thread-find-target="conversation" class="relative flex flex-col gap-3 electron:[--color-token-description-foreground:color-mix(in_srgb,var(--color-token-foreground)_70%,transparent)]">
                        ${renderConversationEvents(events)}
                      </div>
                    </div>
                    ${renderThreadComposer()}
                  </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function renderHeader(title, mode) {
  if (mode === "thread") {
    return `
      <div class="draggable extension:px-panel">
        <div class="flex items-center electron:h-toolbar extension:py-row-y justify-between">
          <div class="mr-3 line-clamp-1 flex min-w-0 flex-1 items-center gap-1 truncate" style="view-transition-name: header-title;">
            <div class="flex min-w-0 flex-1 items-center gap-1">
              <span data-state="closed" class="contents">
                <button type="button" class="border-token-border no-drag cursor-interaction flex items-center gap-1 border whitespace-nowrap select-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 rounded-full electron:rounded-md text-token-text-tertiary enabled:hover:bg-token-list-hover-background data-[state=open]:bg-token-list-hover-background border-transparent electron:p-1 electron:[&>svg]:icon-sm flex items-center justify-center p-0.5 opacity-70 hover:bg-transparent hover:opacity-100 focus:bg-transparent active:bg-transparent" aria-label="返回" data-action="back">${icons.svg("back", "size-3")}</button>
              </span>
              <button type="button" class="border-token-border no-drag cursor-interaction flex items-center gap-1 border whitespace-nowrap select-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 rounded-full text-token-foreground enabled:hover:bg-token-list-hover-background data-[state=open]:bg-token-list-hover-background border-transparent px-2 py-0.5 text-sm leading-[18px] min-w-0 flex-1 truncate !px-0 !py-0 text-left text-sm text-token-foreground hover:!bg-transparent hover:opacity-80 electron:font-medium">
                <span class="truncate">${escapeHTML(title)}</span>
              </button>
            </div>
          </div>
          <div class="flex flex-shrink-0 items-center gap-1">
            <button type="button" class="border-token-border no-drag cursor-interaction flex items-center gap-1 border whitespace-nowrap select-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 rounded-full electron:rounded-md text-token-text-tertiary enabled:hover:bg-token-list-hover-background data-[state=open]:bg-token-list-hover-background border-transparent electron:p-1 electron:[&>svg]:icon-sm flex items-center justify-center p-0.5 outline-hidden cursor-interaction no-drag" aria-label="对话操作" aria-haspopup="menu" aria-expanded="false" data-state="closed">${icons.svg("more21", "icon-xs")}</button>
            ${renderHeaderActions()}
          </div>
        </div>
      </div>`;
  }
  return `
    <div class="draggable extension:px-panel">
      <div class="flex items-center electron:h-toolbar extension:py-row-y justify-between">
        <div class="mr-3 line-clamp-1 flex min-w-0 flex-1 items-center gap-1 truncate" style="view-transition-name: header-title;">
          <span class="text-token-description-foreground">${escapeHTML(title)}</span>
        </div>
        <div class="flex flex-shrink-0 items-center gap-1">${renderHeaderActions()}</div>
      </div>
    </div>`;
}

function renderConversationEvents(events) {
  const items = groupConversationEvents(events);
  const virtualList = conversationVirtualList(events);
  const outerStyle = virtualList.height ? ` style="height: ${escapeAttr(virtualList.height)}"` : "";
  const innerStyle = `gap: 12px; margin-top: ${virtualList.marginTop || "0px"};`;
  return `
    <div class="relative shrink-0"${outerStyle}>
      <div class="flex flex-col" style="${innerStyle}">
        ${items.map((item, index) => `<div style="">${renderConversationItem(item, index)}</div>`).join("")}
      </div>
    </div>`;
}

function conversationVirtualList(events) {
  const configEvent = events.find((event) => event.virtualList || event.data?.virtualList);
  const config = configEvent?.virtualList || configEvent?.data?.virtualList || {};
  return {
    height: config.height || "",
    marginTop: config.marginTop || "",
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
          <button type="button" class="border-token-border no-drag cursor-interaction flex items-center gap-1 border whitespace-nowrap select-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 rounded-full electron:rounded-md text-token-text-tertiary enabled:hover:bg-token-list-hover-background data-[state=open]:bg-token-list-hover-background border-transparent electron:p-1 electron:[&>svg]:icon-sm flex items-center justify-center p-0.5 relative" aria-label="最近任务。0 正在进行中">
            ${icons.svg("history", "icon-xs hover:opacity-80")}
            <span class="sr-only" aria-live="polite" aria-atomic="true">没有正在进行的任务</span>
          </button>
        </span>
        <span type="button" aria-haspopup="menu" aria-expanded="false" data-state="closed" class="contents outline-hidden cursor-interaction">
          <button type="button" class="border-token-border no-drag cursor-interaction flex items-center gap-1 border whitespace-nowrap select-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 rounded-full electron:rounded-md text-token-text-tertiary enabled:hover:bg-token-list-hover-background data-[state=open]:bg-token-list-hover-background border-transparent electron:p-1 electron:[&>svg]:icon-sm flex items-center justify-center p-0.5">${icons.svg("settings", "icon-xs")}</button>
        </span>
        <span data-state="closed" class="contents">
          <button type="button" class="border-token-border no-drag cursor-interaction flex items-center gap-1 border whitespace-nowrap select-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 rounded-full electron:rounded-md text-token-text-tertiary enabled:hover:bg-token-list-hover-background data-[state=open]:bg-token-list-hover-background border-transparent electron:p-1 electron:[&>svg]:icon-sm flex items-center justify-center p-0.5" aria-label="新聊天" data-action="new-chat">${icons.svg("newChat", "icon-xs")}</button>
        </span>
      </div>
    </div>`;
}

function renderSessionRow(session) {
  const running = session.status === "running";
  const trailing = running
    ? `<div class="codex-session-status-running"><span class="codex-session-status-dot"></span><span>&#27491;&#22312;&#22788;&#29702;</span></div>`
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
  if (["turn_started", "reasoning", "tool_call", "stdout", "stderr"].includes(kind)) {
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
  const finalIndex = followups.findIndex((event) => event.placement === "final" || event.data?.placement === "final");
  let finalFollowup = finalIndex >= 0 ? followups[finalIndex] : null;
  const summaryIndex = followups.findIndex((event) => (event.kind || "") === "summary");
  const summaryFollowup = summaryIndex >= 0 ? followups[summaryIndex] : null;
  let streamFollowups = followups.filter((_, eventIndex) => eventIndex !== finalIndex && eventIndex !== summaryIndex);
  if (!finalFollowup && streamFollowups.length === 1 && (streamFollowups[0].kind || "assistant_message") === "assistant_message") {
    finalFollowup = streamFollowups[0];
    streamFollowups = [];
  }
  const turnKey = turnKeyFromEvent(baseEvent, index);

  if (!streamFollowups.length && !summaryFollowup && !finalFollowup) {
    return `
        <div class="flex flex-col"><div class="-mx-1.5 px-1.5" style="overflow: hidden; opacity: 1; height: auto;"></div></div>
        <div aria-hidden="true" class="w-full" style="height: var(--conversation-tool-assistant-gap, 8px);"></div>
        <div class="flex flex-col"><div></div></div>`;
  }

  if (finalFollowup && !streamFollowups.length && !summaryFollowup) {
    const finalUnit = contentUnitFor(finalFollowup, 1);
    return `<div class="flex flex-col" data-local-conversation-final-assistant="true"><div data-content-search-unit-key="${escapeAttr(contentSearchKey(turnKey, finalUnit, "assistant"))}">${renderAssistantContent(finalFollowup, `${index}-final`, false)}</div></div>`;
  }

  if (summaryFollowup && !streamFollowups.length) {
    const finalAttrs = finalFollowup ? ' data-local-conversation-final-assistant="true"' : "";
    const finalUnit = contentUnitFor(finalFollowup, 1);
    return `
        <div class="flex flex-col">${renderSummaryBody(summaryFollowup)}</div>
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
  const kind = event.kind || "assistant_message";
  return ["turn_started", "reasoning", "tool_call", "stdout", "stderr"].includes(kind);
}

function renderInlineFollowupContent(event, turnIndex, offset) {
  const kind = event.kind || "assistant_message";
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
  const src = attachment?.src || config.USER_ATTACHMENT_PLACEHOLDER;
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
            <div class="text-size-chat whitespace-pre-wrap">${formatUserText(event.text)}</div>
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
  const markdownHTML = event.html || event.data?.html || formatText(event.text || assistantTextFromData(event.data));
  const actionsVisible = Boolean(event.actionsVisible || event.data?.actionsVisible);
  const actionClass = actionsVisible
    ? "extension:-translate-x-1.5 electron:-translate-x-2 mt-1.5 flex h-5 items-center justify-start gap-0.5 [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-token-focus-border [&_button]:focus-visible:ring-offset-0"
    : "extension:-translate-x-1.5 electron:-translate-x-2 mt-1.5 flex h-5 items-center justify-start gap-0.5 [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-token-focus-border [&_button]:focus-visible:ring-offset-0 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100";
  return `
    <div class="group flex min-w-0 flex-col">
      <div data-selected-text-overlay-target="codex-assistant-${index}" class="[&>*:first-child]:mt-0 _markdownContent_lzkx4_60 [&>*:last-child]:mb-0 [&>ol:first-child]:mt-0 [&>ul:first-child]:mt-0${errorClass}">${markdownHTML}</div>
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
          <div class="flex max-w-full flex-col overflow-hidden rounded-lg bg-token-dropdown-background/50 text-token-foreground [--thread-resource-card-row-padding-x:0.75rem] electron:elevation-stroke extension:border extension:border-token-border extension:bg-token-input-background/50 extension:shadow-sm mb-2 text-base [--turn-diff-row-padding-y:0.25rem]">
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
            <div class="flex flex-col border-t border-token-border [--codex-diffs-header-padding-x:var(--thread-resource-card-row-padding-x)] [--codex-diffs-header-padding-y:var(--turn-diff-row-padding-y)] [--codex-diffs-surface-override:color-mix(in_oklab,var(--color-token-dropdown-background)_50%,transparent)] extension:[--codex-diffs-surface-override:color-mix(in_oklab,var(--color-token-input-background)_50%,transparent)]">
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
                  <button type="button" data-state="closed" class="text-size-chat flex h-9 w-full cursor-interaction items-center gap-2 bg-token-main-surface-primary/70 px-[var(--thread-resource-card-row-padding-x)] py-[var(--turn-diff-row-padding-y)] text-left hover:bg-token-list-hover-background/60 focus-visible:ring-1 focus-visible:ring-token-focus-border focus-visible:outline-none focus-visible:ring-inset extension:bg-token-input-background/70 extension:hover:bg-token-list-hover-background/60">
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

function renderMessageIconButton(label, codicon, sizeClass = "p-0.5", withFocusRing = true) {
  const iconName = codicon === "branch" ? "branchMessage" : codicon === "edit" ? "editMessage" : "copyMessage";
  const focusClass = withFocusRing ? " focus-visible:ring-2 focus-visible:ring-token-focus-border focus-visible:ring-offset-0" : "";
  return `
    <span data-state="closed" class="contents">
      <button type="button" class="border-token-border no-drag cursor-interaction flex items-center gap-1 border whitespace-nowrap select-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 rounded-full electron:rounded-md text-token-text-tertiary enabled:hover:bg-token-list-hover-background data-[state=open]:bg-token-list-hover-background border-transparent electron:p-1 electron:[&>svg]:icon-sm flex items-center justify-center ${sizeClass}${focusClass}" aria-label="${escapeAttr(label)}">
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
            ${items.map((item) => `<div class="text-size-chat text-token-text-secondary">${formatInlineCodeText(String(item?.text || item?.path || item || ""))}</div>`).join("")}
          </div>
        </div>`;
}

function renderShimmerText(text, className) {
  const label = escapeHTML(text);
  return `
        <span class="loading-shimmer-pure-text _cadencedShimmer_18j3y_1 ${className}">
          ${label}
          <span aria-hidden="true" class="_cadencedShimmerSweep_18j3y_12"><span class="_cadencedShimmerHighlight_18j3y_37">${label}</span></span>
        </span>`;
}

function renderToolSummaryTurn(event, index) {
  return renderTurnContainer(index, "tool-summary", renderToolSummaryContent(event, index), undefined, event);
}

function renderToolSummaryContent(event, index) {
  const items = Array.isArray(event.items)
    ? event.items
    : Array.isArray(event.data?.items)
      ? event.data.items
      : String(event.text || "").split("\n").filter(Boolean);
  const list = items.map((item) => `<li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">${String(item).includes("`") ? formatInlineText(item) : formatInlineCodeText(item)}</li>`).join("");
  return `
    <div class="group flex min-w-0 flex-col gap-2">
      <div data-selected-text-overlay-target="codex-tool-summary-${index}" class="[&>*:first-child]:mt-0 _markdownContent_lzkx4_60 [&>*:last-child]:mb-0 [&>ol:first-child]:mt-0 [&>ul:first-child]:mt-0"><ul class="_markdownText_lzkx4_86 _list_lzkx4_133 _unorderedList_lzkx4_147">${list}</ul></div>
    </div>`;
}

function renderHomeComposer() {
  return `
    <div class="mx-auto w-full max-w-(--thread-content-max-width) px-toolbar relative z-10 -mt-[var(--thread-footer-overlap)] flex flex-col gap-2 pb-2">
      <div class="home-banners mt-2 flex flex-col gap-2 empty:hidden"></div>
      <div class="min-w-0 electron:hidden">${renderComposerSurface("随心输入", false)}</div>
    </div>`;
}

function renderThreadComposer() {
  return `
    <div data-thread-scroll-footer="true" class="sticky bottom-0 z-10 mt-auto w-full pb-4">
      <div class="pointer-events-none absolute inset-x-0 bottom-0 z-0 flex h-full w-full justify-center pt-4">
        <div class="z-0 h-full w-full bg-gradient-to-t from-token-main-surface-primary via-token-main-surface-primary extension:from-token-bg-primary extension:via-token-bg-primary"></div>
      </div>
      <div data-pip-obstacle="thread-footer" class="relative z-10 flex flex-col mx-auto w-full max-w-(--thread-content-max-width) px-toolbar">
        <div class="flex flex-col" data-thread-find-composer="true">
          <div class="relative h-0">
            <button class="cursor-interaction absolute z-30 flex h-8 w-8 translate-x-1/2 items-center justify-center rounded-full border border-token-border-default bg-token-main-surface-primary bg-clip-padding text-token-text-secondary transition-opacity duration-150 ease-in-out end-1/2 print:hidden pointer-events-none opacity-0 bottom-[calc(100%+6*var(--spacing))]" aria-hidden="true" aria-label="滚动到底部" type="button" tabindex="-1">${icons.svg("send", "icon rotate-180 text-token-text-primary")}</button>
          </div>
          <div class="flex flex-col gap-2"><div class="min-w-0">${renderComposerSurface("要求后续变更", true)}</div></div>
        </div>
      </div>
    </div>`;
}

function renderComposerSurface(placeholder, includeExternalFooter) {
  const proseMirrorClass =
    state.view === "list" && (state.popover === "" || state.popover === "plus")
      ? "ProseMirror ProseMirror-focused"
      : "ProseMirror";
  return `
    <div id="above-composer-portal" data-above-composer-portal="true" class="relative px-5 empty:hidden"></div>
    <div id="above-composer-queue-portal" data-above-composer-queue-portal="true" class="relative px-5 empty:hidden"></div>
    <div class="relative flex w-full flex-col gap-2">
      <div class="relative">
        ${state.popover === "plus" ? renderPlusOverlay() : '<div class="@container pointer-events-none absolute inset-x-0 bottom-full z-20 mb-2 flex justify-center"></div>'}
        <div class="composer-surface-chrome relative flex flex-col bg-token-input-background/90 backdrop-blur-lg electron:dark:bg-token-dropdown-background _multilineSurface_1u8sk_2">
          <div class="relative z-10 flex min-h-0 flex-1 flex-col">
            <div class="_attachmentsDefault_1u8sk_2"></div>
            <div class="contents">
              <div class="mb-1 flex-grow overflow-y-auto px-3">
                <div class="text-size-chat [&_.ProseMirror]:focus-visible:outline-none text-token-foreground h-auto max-h-[25dvh] overflow-y-auto [&_.ProseMirror]:h-auto [&_.ProseMirror]:min-h-[2rem] [&_.ProseMirror]:resize-none [&_.ProseMirror_p]:m-0 text-base [&_.ProseMirror]:leading-5">
                  <div contenteditable="true" spellcheck="true" translate="no" class="${proseMirrorClass}" data-virtualkeyboard="true" data-placeholder="${escapeAttr(placeholder)}" data-codex-empty="true" style="font-size: var(--codex-chat-font-size); height: auto; resize: none; min-height: 2.75rem;" data-codex-composer="true"><p><br class="ProseMirror-trailingBreak"></p></div>
                </div>
              </div>
              ${renderComposerFooter()}
            </div>
          </div>
        </div>
      </div>
      ${includeExternalFooter ? renderExternalFooter() : '<div class="select-none _footer_z984f_2 flex flex-nowrap items-center gap-1 overflow-hidden pr-2 flex-wrap gap-2 overflow-visible pl-2"><div class="flex min-w-0 flex-1 flex-nowrap items-center gap-1"></div><div class="flex min-w-0 shrink-0 items-center gap-3"></div></div>'}
    </div>
    ${renderFloatingPopover()}`;
}

function renderComposerFooter() {
  const plusState = state.popover === "plus" ? "open" : "closed";
  const approvalState = state.popover === "approval" ? "open" : "closed";
  const modelState = state.popover === "model" ? "open" : "closed";
  const plusWrapperState = plusState === "open" ? "delayed-open" : "closed";
  return `
    <div class="_footer_1u8sk_2 grid grid-cols-[minmax(0,auto)_auto_minmax(0,1fr)] items-center gap-[5px] select-none mb-2 px-2">
      <div class="flex min-w-0 items-center gap-[5px]">
        <span data-state="${plusWrapperState}" class="contents">
          <button type="button" class="border-token-border no-drag cursor-interaction flex items-center gap-1 border whitespace-nowrap select-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 rounded-full ${plusState === "open" ? "text-token-foreground" : "text-token-text-tertiary"} enabled:hover:bg-token-list-hover-background data-[state=open]:bg-token-list-hover-background border-transparent h-token-button-composer px-2 py-0 text-sm leading-[18px] aspect-square items-center justify-center !px-0" aria-label="添加文件等内容" aria-expanded="${plusState === "open"}" data-state="${plusState}" data-popover="plus">${icons.svg("plus", "icon-sm")}</button>
        </span>
        <span type="button" aria-haspopup="menu" aria-expanded="${approvalState === "open"}" data-state="closed" class="contents outline-hidden cursor-interaction">
          <button type="button" class="border-token-border no-drag cursor-interaction flex items-center gap-1 border whitespace-nowrap select-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 rounded-full text-token-text-tertiary enabled:hover:bg-token-list-hover-background data-[state=open]:bg-token-list-hover-background border-transparent h-token-button-composer-sm px-1.5 py-0 text-sm leading-[18px] min-w-0" data-popover="approval">
            ${icons.svg("hand", "icon-xs shrink-0")}
            <span class="_labelXs_z984f_2 max-w-40 truncate whitespace-nowrap text-left">请求批准</span>
            ${icons.svg("chevron20x21", "icon-2xs shrink-0 text-token-input-placeholder-foreground")}
          </button>
        </span>
      </div>
      <div class="flex items-center"></div>
      <div class="flex min-w-0 items-center justify-end w-full">
        <div class="flex min-w-0 flex-1 justify-end">
          <div class="flex min-w-0 items-center gap-1">
            ${state.view === "thread" ? `<span><span aria-label="上下文用量：43%" class="icon-xs inline-flex items-center justify-center text-token-description-foreground" role="img" data-state="closed">${icons.svg("contextUsage", "shrink-0")}</span></span>` : ""}
            <span><span type="button" aria-haspopup="menu" aria-expanded="${modelState === "open"}" data-state="closed" class="contents outline-hidden cursor-interaction">
              <button type="button" class="border-token-border no-drag cursor-interaction flex items-center gap-1 border whitespace-nowrap select-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 rounded-full text-token-text-tertiary enabled:hover:bg-token-list-hover-background data-[state=open]:bg-token-list-hover-background border-transparent h-token-button-composer px-2 py-0 text-sm leading-[18px] min-w-0" data-codex-intelligence-trigger="true" data-selected-reasoning-effort="xhigh" data-popover="model">
                <span class="flex max-w-40 min-w-0 items-center gap-1.5">
                  <span class="flex min-w-0 items-center gap-1 tabular-nums"><span class="truncate whitespace-nowrap text-token-foreground">5.5</span></span>
                  <span class="_labelSm_z984f_2 shrink-0 text-token-description-foreground">超高</span>
                </span>
                ${icons.svg("chevron20x21", "icon-2xs text-token-input-placeholder-foreground")}
              </button>
            </span></span>
            <span class="flex items-center gap-1">
              <div class="h-4 w-px bg-token-border/70"></div>
              <span data-state="closed" class="contents">
                <button type="button" class="border-token-border no-drag cursor-interaction flex items-center gap-1 border whitespace-nowrap select-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 rounded-full text-token-text-tertiary enabled:hover:bg-token-list-hover-background data-[state=open]:bg-token-list-hover-background border-transparent h-token-button-composer px-2 py-0 text-sm leading-[18px] group flex items-center gap-1 text-token-text-link-foreground">
                  ${icons.svg("ide", "icon-xs shrink-0 group-hover:hidden", { ariaHidden: true })}
                  ${icons.svg("closeCircle", "icon-xs hidden shrink-0 group-hover:block", { ariaHidden: true })}
                  <span class="_footerLabel_1u8sk_2 truncate max-w-20">IDE 上下文</span>
                </button>
              </span>
            </span>
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <button type="button" class="cursor-interaction size-token-button-composer flex items-center justify-center rounded-full transition-opacity focus-visible:outline-2 bg-token-foreground p-0.5 focus-visible:outline-token-button-background opacity-50" data-state="closed" data-action="send">${icons.svg("send", "icon-sm text-token-dropdown-background")}</button>
        </div>
      </div>
    </div>`;
}

function renderPlusOverlay() {
  return `
    <div data-composer-overlay-floating-ui="true" class="absolute left-0 right-0 bottom-full mb-2 z-50">
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

function radixMenuContentStyle() {
  return "outline: none; max-width: min(var(--radix-dropdown-menu-content-available-width), calc(100vw - 16px)); max-height: min(var(--radix-dropdown-menu-content-available-height), calc(100vh - 16px)); --radix-dropdown-menu-content-transform-origin: var(--radix-popper-transform-origin); --radix-dropdown-menu-content-available-width: var(--radix-popper-available-width); --radix-dropdown-menu-content-available-height: var(--radix-popper-available-height); --radix-dropdown-menu-trigger-width: var(--radix-popper-anchor-width); --radix-dropdown-menu-trigger-height: var(--radix-popper-anchor-height);";
}

function renderApprovalMenu() {
  return `
    <div class="codex-floating-menu codex-floating-menu-approval" data-radix-popper-content-wrapper="" dir="ltr">
      <div data-side="top" data-align="start" role="menu" aria-orientation="vertical" data-state="open" data-radix-menu-content="" dir="ltr" class="_content_1hiti_1 no-drag bg-token-dropdown-background/90 text-token-foreground ring-token-border z-50 m-px flex select-none flex-col overflow-y-auto rounded-xl ring-[0.5px] px-1 py-1 shadow-xl-spread backdrop-blur-sm" tabindex="-1" data-orientation="vertical" style="${radixMenuContentStyle()}">
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
    <div class="no-drag text-token-foreground outline-hidden rounded-lg px-[var(--padding-row-x)] py-[var(--padding-row-y)] text-sm group hover:bg-token-list-hover-background focus:bg-token-list-hover-background cursor-interaction flex flex-col" role="menuitem" tabindex="-1" data-orientation="vertical" data-radix-collection-item="">
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
  return `
    <div class="codex-floating-menu codex-floating-menu-model" data-radix-popper-content-wrapper="" dir="ltr">
      <div data-side="top" data-align="end" role="menu" aria-orientation="vertical" data-state="open" data-radix-menu-content="" dir="ltr" class="_content_1hiti_1 no-drag bg-token-dropdown-background/90 text-token-foreground ring-token-border z-50 m-px flex select-none flex-col overflow-y-auto rounded-xl ring-[0.5px] px-1 py-1 shadow-xl-spread backdrop-blur-sm w-52" tabindex="-1" data-orientation="vertical" style="${radixMenuContentStyle()}">
        <div class="text-token-description-foreground flex min-h-6 items-center truncate px-[var(--padding-row-x)] py-[var(--padding-row-y)] text-sm leading-4">推理</div>
        <div class="flex max-h-[250px] flex-col overflow-y-auto">
          ${menuItem("低")}
          ${menuItem("中")}
          ${menuItem("高")}
          ${menuItem("超高", true)}
        </div>
        <div class="w-full px-[var(--padding-row-x)] py-1"><div class="h-[1px] w-full bg-token-menu-border"></div></div>
        <div class="flex flex-col" data-state="open">
          ${menuItem("GPT-5.5", false, true)}
          <div class="overflow-hidden" style="height: auto; opacity: 1;">
            <div class="text-token-description-foreground flex min-h-6 items-center truncate px-[var(--padding-row-x)] py-[var(--padding-row-y)] text-sm leading-4">模型</div>
            <div class="vertical-scroll-fade-mask flex max-h-[250px] flex-col overflow-y-auto">
              ${menuItem("GPT-5.5", true, false, "model")}
              ${menuItem("GPT-5.4")}
              ${menuItem("GPT-5.4-Mini")}
              ${menuItem("GPT-5.3-Codex")}
              ${menuItem("GPT-5.2")}
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function menuItem(label, selected = false, nested = false, selectedKind = "reasoning") {
  const simple = !nested && !String(label).startsWith("GPT-");
  const selectedAttr = selected ? `data-${selectedKind}-selected="true"` : "";
  return `
    <div class="no-drag text-token-foreground outline-hidden rounded-lg px-[var(--padding-row-x)] py-[var(--padding-row-y)] text-sm group hover:bg-token-list-hover-background focus:bg-token-list-hover-background cursor-interaction flex flex-col" role="menuitem" ${selectedAttr} tabindex="-1" data-orientation="vertical" data-radix-collection-item="">
      <div class="flex w-full items-center gap-1.5">
        <span class="flex-1 min-w-0 truncate">${simple ? escapeHTML(label) : `<span class="flex min-w-0 items-center gap-1 tabular-nums"><span class="truncate whitespace-nowrap">${escapeHTML(label)}</span></span>`}</span>
        ${selected ? icons.svg("check17", "icon-xs shrink-0 opacity-75 group-focus:opacity-100 group-hover:opacity-100") : ""}
        ${nested ? `<span aria-hidden="true" class="inline-flex items-center justify-center text-token-input-placeholder-foreground" style="transform: rotate(90deg);">${icons.svg("chevronRight", "icon-xs shrink-0 opacity-75 group-focus:opacity-100 group-hover:opacity-100")}</span>` : ""}
      </div>
    </div>`;
}

function renderExternalFooter() {
  return `
    <div class="select-none _footer_z984f_2 flex flex-nowrap items-center gap-1 overflow-hidden pr-2 flex-wrap gap-2 overflow-visible pl-2">
      <div class="flex min-w-0 flex-1 flex-nowrap items-center gap-1">
        <span type="button" aria-haspopup="menu" aria-expanded="false" data-state="closed" class="contents outline-hidden cursor-interaction">
          <button type="button" class="border-token-border no-drag cursor-interaction flex items-center gap-1 border whitespace-nowrap select-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 rounded-full text-token-text-tertiary enabled:hover:bg-token-list-hover-background data-[state=open]:bg-token-list-hover-background border-transparent h-token-button-composer-sm px-1.5 py-0 text-sm leading-[18px] _externalFooterItem_z984f_2 min-w-0">
            <span class="inline-flex shrink-0">${icons.svg("localMode", "icon-xs")}</span>
            <span class="_externalFooterItemText_z984f_2 inline-flex min-w-0 items-baseline gap-1 text-left">
              <span class="_labelXs_z984f_2 _externalFooterItemValue_z984f_2 min-w-0 truncate font-normal whitespace-nowrap max-w-40">
                <span class="_externalFooterItemValueContent_z984f_2 block max-w-full min-w-0 truncate" data-tooltip-overflow-target="true"><span class="_defaultExternalFooterOnly_z984f_2">本地模式</span><span class="_homeExternalFooterOnly_z984f_2 hidden">本地</span></span>
              </span>
            </span>
            ${icons.svg("chevron20x21", "_externalFooterItemChevron_z984f_2 icon-2xs shrink-0 text-token-input-placeholder-foreground")}
          </button>
        </span>
      </div>
      <div class="flex min-w-0 shrink-0 items-center gap-3"></div>
    </div>`;
}

function syncComposerState() {
  const input = mount.root.querySelector("[data-codex-composer]");
  const send = mount.root.querySelector("[data-action='send']");
  if (!input || !send) return;
  const hasText = Boolean(composerText(input));
  if (!hasText) ensureEmptyComposerStructure(input);
  input.dataset.codexEmpty = hasText ? "false" : "true";
  send.classList.toggle("opacity-50", !hasText);
  send.classList.toggle("codex-send-ready", hasText);
}

function composerText(input) {
  if (!input) return "";
  return (input.innerText || input.textContent || "").replace(/\u00a0/g, " ").trim();
}

function clearComposer(input) {
  if (!input) return;
  input.innerHTML = '<p><br class="ProseMirror-trailingBreak"></p>';
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

    return {
      render,
      syncComposerState,
      composerText,
      clearComposer,
    };
  }

  global.CodexPanelRenderer = { create: createCodexPanelRenderer };
})(window);
