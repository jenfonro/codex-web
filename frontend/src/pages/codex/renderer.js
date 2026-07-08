"use strict";

(function defineCodexPanelRenderer(global) {
  const {
    activityLabel,
    activityIcon,
    assistantTextFromData,
    formatText,
    formatInlineText,
    formatUserText,
    formatInlineCodeText,
    websiteResourcesFromEvents,
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
  const grouping = global.CodexPanelGrouping;
  const virtualizerFactory = global.CodexPanelVirtualizer;
  const HISTORY_LOAD_EDGE_PX = 480;
  const FOCUSED_TURN_WINDOW_SIZE = 36;
  const FOCUSED_TURN_PRE_CONTEXT = 2;
  const FILE_ACTIVITY_VISIBLE_FILE_LIMIT = 3;
  const FILE_ACTIVITY_DEFAULT_EXPANDED = false;

  function createCodexPanelRenderer(runtime) {
    const { state, mount, icons, config } = runtime;
    const virtualizer = virtualizerFactory.create(state, activeSession);
    let shimmerCleanups = [];
    let historyEdgeObserver = null;
    let historyEdgePollTimer = 0;
    let threadScrollFrame = 0;
    let suppressThreadScroll = false;
    let suppressThreadScrollTimer = 0;

function render(options = {}) {
  const threadScrollIntent = options.threadScrollIntent || state.pendingThreadScrollIntent || null;
  state.pendingThreadScrollIntent = null;
  clearShimmerTimers();
  disconnectHistoryEdgeObserver();
  mount.root.innerHTML = `${state.view === "thread" ? renderThreadView() : renderListView()}${renderToastViewport()}`;
  syncComposerState();
  syncThreadFooterSafeArea();
  bindThreadScrollHandler();
  syncThreadScrollPosition(threadScrollIntent);
  syncCadencedShimmers();
}

function syncThreadFooterSafeArea() {
  if (state.view !== "thread") return;
  const scroll = mount.root.querySelector("[data-thread-scroll]");
  if (!scroll) return;
  const footer = mount.root.querySelector("[data-thread-scroll-footer='true']");
  const rect = footer?.getBoundingClientRect?.();
  const measuredHeight = rect && rect.height > 0 ? Math.ceil(rect.height + 8) : 160;
  scroll.style.setProperty("--thread-scroll-padding-bottom", `${measuredHeight}px`);
}

function clearShimmerTimers() {
  for (const cleanup of shimmerCleanups) cleanup();
  shimmerCleanups = [];
}

function disconnectHistoryEdgeObserver() {
  if (historyEdgeObserver) historyEdgeObserver.disconnect();
  historyEdgeObserver = null;
  if (historyEdgePollTimer) window.clearInterval(historyEdgePollTimer);
  historyEdgePollTimer = 0;
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

function syncThreadScrollPosition(threadScrollIntent = null) {
  if (state.view !== "thread") return;
  let synced = false;
  const sync = () => {
    if (synced) return;
    synced = true;
    const scroll = mount.root.querySelector("[data-thread-scroll]");
    if (!scroll) return;
    const windowState = virtualizer.activeWindow();
    if (applyThreadScrollIntent(scroll, windowState, threadScrollIntent)) {
      bindThreadHistoryObserver();
      ensureThreadViewportHasContent(scroll);
      notifyThreadScrollEdge(scroll);
      return;
    }
    if (restoreFocusedTurn(scroll, windowState)) {
      bindThreadHistoryObserver();
      ensureThreadViewportHasContent(scroll);
      return;
    }
    if (windowState?.restoreScrollTop != null) {
      setThreadScrollTop(scroll, Math.max(0, windowState.restoreScrollTop));
      windowState.restoreScrollTop = null;
      bindThreadHistoryObserver();
      ensureThreadViewportHasContent(scroll);
      notifyThreadScrollEdge(scroll);
      return;
    }
    if (!windowState || windowState.stickToBottom) {
      setThreadScrollTop(scroll, scroll.scrollHeight);
    }
    bindThreadHistoryObserver();
    ensureThreadViewportHasContent(scroll);
    notifyThreadScrollEdge(scroll);
  };
  sync();
  requestAnimationFrame(sync);
  window.setTimeout(sync, 60);
}

function restoreFocusedTurn(scroll, windowState) {
  const focusSeq = Number(windowState?.focusSeq || 0);
  if (!focusSeq) return false;
  const turn = mount.root.querySelector("[data-codex-focus-turn='true']");
  if (!turn) return false;
  const exactTarget = focusElementForSeq(turn, focusSeq);
  const scrollRect = scroll.getBoundingClientRect();
  const rawFocusTop = windowState?.focusTop;
  const requestedFocusTop = typeof rawFocusTop === "number" ? rawFocusTop : Number.NaN;
  const hasRequestedFocusTop = Number.isFinite(requestedFocusTop);
  const focusTarget = focusScrollElementForSeq(turn, exactTarget, { preferDisclosureAnchor: !hasRequestedFocusTop });
  const target = visibleElementForScroll(focusTarget) || visibleElementForScroll(exactTarget) || turn;
  const targetRect = target.getBoundingClientRect();
  const canUseRequestedFocusTop = hasRequestedFocusTop && target !== turn;
  const requestedOffset = canUseRequestedFocusTop
    ? clampNumber(requestedFocusTop - scrollRect.top, 16, Math.max(16, scroll.clientHeight - 48))
    : null;
  const offset = requestedOffset != null
    ? requestedOffset
    : target === turn
    ? Math.max(0, Math.floor((scroll.clientHeight - Math.min(targetRect.height, scroll.clientHeight)) / 2))
    : Math.max(32, Math.floor(scroll.clientHeight * 0.18));
  const nextTop = Math.max(0, scroll.scrollTop + targetRect.top - scrollRect.top - offset);
  const focusedDisclosureKey = target.getAttribute?.("data-disclosure-toggle") || "";
  setManualThreadScroll(windowState);
  windowState.focusSeq = 0;
  windowState.focusTop = null;
  windowState.focusLockUntil = Date.now() + 700;
  windowState.focusLockScrollTop = nextTop;
  setThreadScrollTop(scroll, nextTop);
  if (focusedDisclosureKey) {
    scheduleDisclosureAnchorIntoView(scroll, windowState, focusedDisclosureKey, offset);
  }
  return true;
}

function focusElementForSeq(root, seq) {
  if (!root || !seq) return null;
  const exactSelector = `[data-codex-event-seq="${escapeSelectorValue(seq)}"]`;
  const listSelector = `[data-codex-event-seqs~="${escapeSelectorValue(seq)}"]`;
  return root.querySelector(exactSelector) || root.querySelector(listSelector);
}

function focusScrollElementForSeq(root, element, options = {}) {
  if (!root || !element) return element || null;
  if (options.preferDisclosureAnchor === false) return element;
  const disclosureBody = element.closest?.("[data-disclosure-body]");
  const disclosureKey = disclosureBody?.getAttribute?.("data-disclosure-body") || "";
  if (disclosureKey) {
    const toggle = root.querySelector(disclosureToggleSelector(disclosureKey));
    if (toggle) return toggle;
  }
  if (element.hasAttribute?.("data-local-conversation-user-anchor")) {
    const processedToggle = firstProcessedDisclosureToggle(element.closest?.("[data-codex-virtual-turn]"));
    if (processedToggle) return processedToggle;
  }
  return element;
}

function firstProcessedDisclosureToggle(turn) {
  if (!turn) return null;
  const processedPattern = /(?:\u5df2\u5904\u7406|Processed)\s*\d/i;
  return Array.from(turn.querySelectorAll("[data-disclosure-toggle]"))
    .find((control) => processedPattern.test(String(control.textContent || "").replace(/\s+/g, " ").trim())) || null;
}

function visibleElementForScroll(element) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  if (rect.width <= 0 || rect.height <= 0) return null;
  if (style.display === "none" || style.visibility === "hidden") return null;
  return element;
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function notifyThreadScrollEdge(scroll) {
  if (!runtime.onThreadScroll) return;
  requestAnimationFrame(() => {
    if (!scroll.isConnected || state.view !== "thread") return;
    requestThreadHistoryEdge(scroll);
  });
}

function requestThreadHistoryEdge(scroll) {
  virtualizer.handleScroll(scroll);
  void runtime.onThreadScroll(scroll, virtualizer.activeWindow());
}

function ensureThreadViewportHasContent(scroll) {
  window.setTimeout(() => {
    if (!scroll.isConnected || state.view !== "thread") return;
    const scrollRect = scroll.getBoundingClientRect();
    const turns = Array.from(mount.root.querySelectorAll("[data-codex-virtual-turn]"))
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter((item) => item.rect.width > 0 && item.rect.height > 0);
    if (!turns.length) return;
    if (turns.some((item) => item.rect.bottom >= scrollRect.top && item.rect.top <= scrollRect.bottom)) return;
    const below = turns.find((item) => item.rect.top > scrollRect.bottom);
    const target = below || turns.at(-1);
    if (!target) return;
    setThreadScrollTop(scroll, Math.max(0, scroll.scrollTop + target.rect.top - scrollRect.top));
  }, 90);
}

function applyThreadScrollIntent(scroll, windowState, intent) {
  if (!intent) return false;
  if (intent.kind === "disclosure-anchor") {
    const restored = restoreDisclosureAnchor(scroll, windowState, intent);
    if (restored) return true;
    return applyThreadScrollIntent(scroll, windowState, intent.fallback);
  }
  if (intent.kind === "thread-scroll") {
    if (restoreThreadScrollAnchor(scroll, windowState, intent.anchor)) return true;
    const previousScrollTop = Number(intent.scrollTop || 0);
    const previousScrollHeight = Number(intent.scrollHeight || 0);
    const heightDelta = Number.isFinite(previousScrollHeight) ? scroll.scrollHeight - previousScrollHeight : 0;
    setManualThreadScroll(windowState);
    setThreadScrollTop(scroll, Math.max(0, previousScrollTop + heightDelta));
    return true;
  }
  return false;
}

function restoreThreadScrollAnchor(scroll, windowState, anchor) {
  if (!anchor?.offsetTop && anchor?.offsetTop !== 0) return false;
  const target = findThreadScrollAnchor(anchor);
  if (!target) return false;
  const scrollRect = scroll.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  if (targetRect.width <= 0 || targetRect.height <= 0) return false;
  const delta = (targetRect.top - scrollRect.top) - Number(anchor.offsetTop || 0);
  if (!Number.isFinite(delta)) return false;
  setManualThreadScroll(windowState);
  setThreadScrollTop(scroll, Math.max(0, scroll.scrollTop + delta));
  return true;
}

function findThreadScrollAnchor(anchor) {
  const seq = Number(anchor?.seq || 0);
  if (seq > 0) {
    const turns = Array.from(mount.root.querySelectorAll("[data-codex-virtual-turn]"));
    const match = turns.find((turn) => String(turn.getAttribute("data-codex-turn-seqs") || "")
      .split(",")
      .map((value) => Number(value || 0))
      .includes(seq));
    if (match) return match;
  }
  const turnKey = anchor?.turnKey || "";
  if (turnKey) {
    const keyed = mount.root.querySelector(`[data-turn-key="${escapeSelectorValue(turnKey)}"]`);
    const turn = keyed?.closest?.("[data-codex-virtual-turn]");
    if (turn) return turn;
  }
  const index = Number(anchor?.index);
  if (Number.isFinite(index) && index >= 0) {
    const indexed = mount.root.querySelector(`[data-codex-virtual-turn="${escapeSelectorValue(index)}"]`);
    if (indexed) return indexed;
  }
  return null;
}

function restoreDisclosureAnchor(scroll, windowState, intent) {
  const key = intent?.key || "";
  if (!key) return false;
  const button = mount.root.querySelector(disclosureToggleSelector(key));
  if (!button) return false;
  const buttonRect = button.getBoundingClientRect();
  const scrollRect = scroll.getBoundingClientRect();
  const delta = (buttonRect.top - scrollRect.top) - Number(intent.offsetTop || 0);
  if (!Number.isFinite(delta)) return false;
  setManualThreadScroll(windowState);
  setThreadScrollTop(scroll, Math.max(0, scroll.scrollTop + delta));
  return true;
}

function scheduleDisclosureAnchorIntoView(scroll, windowState, key, offsetTop) {
  if (!scroll || !key) return;
  const targetOffsetTop = Number.isFinite(offsetTop) ? offsetTop : Math.max(32, Math.floor(scroll.clientHeight * 0.18));
  const adjust = () => {
    if (!scroll.isConnected || state.view !== "thread") return;
    const button = mount.root.querySelector(disclosureToggleSelector(key));
    if (!button) return;
    const buttonRect = button.getBoundingClientRect();
    const scrollRect = scroll.getBoundingClientRect();
    if (buttonRect.width <= 0 || buttonRect.height <= 0) return;
    const delta = (buttonRect.top - scrollRect.top) - targetOffsetTop;
    if (Math.abs(delta) <= 4) return;
    setManualThreadScroll(windowState);
    setThreadScrollTop(scroll, Math.max(0, scroll.scrollTop + delta));
  };
  window.requestAnimationFrame(adjust);
  for (const delay of [80, 160, 320, 640, 1000, 1400, 1800]) {
    window.setTimeout(adjust, delay);
  }
}

function setManualThreadScroll(windowState) {
  if (!windowState) return;
  windowState.stickToBottom = false;
  windowState.restoreScrollTop = null;
}

function disclosureToggleSelector(key) {
  if (global.CSS?.escape) return `[data-disclosure-toggle="${global.CSS.escape(key)}"]`;
  return `[data-disclosure-toggle="${String(key).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
}

function escapeSelectorValue(value) {
  const string = String(value);
  if (global.CSS?.escape) return global.CSS.escape(string);
  return string.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
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
      const threadScrollIntent = captureRenderedThreadScroll(scroll);
      const changed = virtualizer.handleScroll(scroll);
      runtime.onThreadScroll?.(scroll, virtualizer.activeWindow());
      if (changed) {
        render({ threadScrollIntent });
        return;
      }
    });
  }, { passive: true });
}

function captureRenderedThreadScroll(scroll) {
  if (!scroll) return null;
  return {
    kind: "thread-scroll",
    scrollTop: scroll.scrollTop,
    scrollHeight: scroll.scrollHeight,
    anchor: captureRenderedTurnAnchor(scroll),
  };
}

function captureRenderedTurnAnchor(scroll) {
  const scrollRect = scroll.getBoundingClientRect();
  const turns = Array.from(mount.root.querySelectorAll("[data-codex-virtual-turn]"));
  for (const turn of turns) {
    const rect = turn.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (rect.bottom <= scrollRect.top + 16 || rect.top >= scrollRect.bottom - 16) continue;
    const seq = firstSeqFromTurn(turn);
    const turnKey = turn.querySelector("[data-turn-key]")?.getAttribute("data-turn-key") || "";
    const index = Number(turn.getAttribute("data-codex-virtual-turn"));
    if (!seq && !turnKey && !Number.isFinite(index)) continue;
    return {
      seq,
      turnKey,
      index: Number.isFinite(index) ? index : null,
      offsetTop: rect.top - scrollRect.top,
    };
  }
  return null;
}

function firstSeqFromTurn(turn) {
  return String(turn?.getAttribute("data-codex-turn-seqs") || "")
    .split(",")
    .map((value) => Number(value || 0))
    .find((value) => value > 0) || 0;
}

function bindThreadHistoryObserver() {
  if (state.view !== "thread" || !runtime.onThreadScroll) return;
  const scroll = mount.root.querySelector("[data-thread-scroll]");
  const edge = mount.root.querySelector("[data-history-load-edge]");
  if (!scroll || !edge) return;
  if (!("IntersectionObserver" in window)) {
    notifyThreadScrollEdge(scroll);
  } else {
    historyEdgeObserver = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      requestThreadHistoryEdge(scroll);
    }, { root: scroll, threshold: 0 });
    historyEdgeObserver.observe(edge);
  }
  historyEdgePollTimer = window.setInterval(() => {
    if (!scroll.isConnected || state.view !== "thread") {
      disconnectHistoryEdgeObserver();
      return;
    }
    if (scroll.scrollTop <= HISTORY_LOAD_EDGE_PX && scroll.dataset.historyCanLoadBefore === "true") {
      requestThreadHistoryEdge(scroll);
    }
  }, 500);
}

function setThreadScrollTop(scroll, value) {
  suppressThreadScroll = true;
  scroll.scrollTop = value;
  if (suppressThreadScrollTimer) window.clearTimeout(suppressThreadScrollTimer);
  const release = () => {
    if (suppressThreadScrollTimer) window.clearTimeout(suppressThreadScrollTimer);
    suppressThreadScrollTimer = 0;
    suppressThreadScroll = false;
  };
  window.requestAnimationFrame(release);
  suppressThreadScrollTimer = window.setTimeout(release, 120);
}

function renderListView() {
  return `
    <div class="codex-panel-view codex-panel-view-list flex h-full flex-col" data-vscode-context="{&quot;chatgpt.supportsNewChatMenu&quot;: true}" tabindex="0" data-codex-panel-root data-codex-view="list">
      ${renderListHeaderAndSessions()}
      <div class="codex-list-body relative flex min-h-0 flex-1 flex-col overflow-hidden">
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
    <div class="codex-panel-header extension:px-panel">
      <div class="flex items-center electron:h-toolbar extension:py-row-y justify-between">
        <div class="mr-3 line-clamp-1 flex min-w-0 flex-1 items-center gap-1 truncate" style="view-transition-name: header-title;">
          <span class="text-token-description-foreground">任务</span>
        </div>
        <div class="flex flex-shrink-0 items-center gap-1">${renderHeaderActions()}</div>
      </div>
      ${renderNodeMenu()}
      <div>
        <div class="group/inline -mx-[var(--padding-row-x)] flex flex-col gap-px rounded-xl pb-1 transition-colors [--task-row-trailing-inset:calc(var(--spacing)*1.5)]">
          ${state.sessions.map(renderSessionRow).join("")}
        </div>
        ${renderListStatusNotice()}
      </div>
    </div>`;
}

function renderThreadView() {
  const session = activeSession();
  const sessionID = state.activeSessionId || session?.id || "thread-reference";
  const events = state.eventsBySession.has(sessionID) ? state.eventsBySession.get(sessionID) : [];
  const page = state.eventPagesBySession.get(sessionID) || {};
  const historyStateAttrs = renderHistoryStateAttrs(page, events);
  return `
    <div class="codex-panel-view codex-panel-view-thread relative flex h-full flex-col min-h-0" data-vscode-context="{&quot;chatgpt.supportsNewChatMenu&quot;: true}" data-codex-panel-root data-codex-view="thread">
      <div class="sticky top-0 z-10">${renderHeader(session?.title || "任务", "thread")}</div>
      <div class="codex-thread-body flex min-h-0 flex-1 flex-col [&_[data-thread-find-target=conversation]]:scroll-mt-24">
        <div class="codex-thread-scroll-region relative mx-auto flex min-h-0 w-full flex-1 flex-col">
          <div class="min-h-0 flex-1">
            <div class="relative h-full flex-1">
              <div data-app-action-timeline-scroll="" tabindex="0" class="codex-thread-scroll thread-scroll-container relative h-full overflow-x-hidden overflow-y-auto [overflow-anchor:none] [scroll-padding-bottom:var(--thread-scroll-padding-bottom,0px)] electron:[scrollbar-gutter:stable_both-edges] pt-(--thread-content-top-inset) [container-name:thread-content] [container-type:inline-size] focus:outline-none [&:has([data-thread-scroll-footer='true']:focus-within)]:[scroll-padding-bottom:0px] flex flex-col" style="--thread-scroll-padding-bottom: 160px;" data-thread-scroll ${historyStateAttrs}>
                  <div class="codex-thread-content-shell flex min-h-full shrink-0 flex-col justify-start" data-thread-content-shell>
                    <div data-mcp-app-portal-target="true" class="codex-thread-content mx-auto w-full max-w-(--thread-content-max-width) px-toolbar relative flex flex-1 shrink-0 flex-col pb-8">
                      <div data-thread-find-target="conversation" class="relative flex flex-col gap-3 electron:[--color-token-description-foreground:color-mix(in_srgb,var(--color-token-foreground)_70%,transparent)]">
                        ${renderConversationEvents(events)}
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

function renderListStatusNotice() {
  if (!state.apiError) return "";
  return `
        <div class="codex-list-status-notice text-size-chat text-token-text-secondary" role="status" data-codex-api-error>
          ${escapeHTML(state.apiError)}
    </div>`;
}

function renderHistoryStateAttrs(page, events) {
  const firstSeq = events.reduce((first, event) => {
    const seq = Number(event?.seq || 0);
    if (!seq) return first;
    return first ? Math.min(first, seq) : seq;
  }, 0);
  const lastSeq = events.reduce((last, event) => Math.max(last, Number(event?.seq || 0) || 0), 0);
  const canLoadBefore = !page?.exhaustedBefore && (Boolean(page?.hasMoreBefore) || firstSeq > 1);
  return [
    `data-history-first-seq="${escapeAttr(firstSeq)}"`,
    `data-history-last-seq="${escapeAttr(lastSeq)}"`,
    `data-history-has-more-before="${escapeAttr(Boolean(page?.hasMoreBefore))}"`,
    `data-history-can-load-before="${escapeAttr(canLoadBefore)}"`,
    `data-history-loading-before="${escapeAttr(Boolean(page?.loadingBefore))}"`,
    `data-history-exhausted-before="${escapeAttr(Boolean(page?.exhaustedBefore))}"`,
  ].join(" ");
}

function renderHeader(title, mode) {
  if (mode === "thread") {
    return `
      <div class="codex-panel-header extension:px-panel">
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
        ${renderNodeMenu()}
      </div>`;
  }
  return `
    <div class="codex-panel-header extension:px-panel">
      <div class="flex items-center electron:h-toolbar extension:py-row-y justify-between">
        <div class="mr-3 line-clamp-1 flex min-w-0 flex-1 items-center gap-1 truncate" style="view-transition-name: header-title;">
          <span class="text-token-description-foreground">${escapeHTML(title)}</span>
        </div>
        <div class="flex flex-shrink-0 items-center gap-1">${renderHeaderActions()}</div>
      </div>
    </div>`;
}

function renderConversationEvents(events) {
  const sessionID = state.activeSessionId || activeSession()?.id || "thread-reference";
  const page = state.eventPagesBySession.get(sessionID);
  const visibleEvents = visibleConversationEvents(events);
  const items = groupConversationEvents(visibleEvents, { hideLeadingPartial: shouldHideLeadingPartial(sessionID, page, visibleEvents) });
  alignWindowToFocusedTurn(sessionID, items);
  const virtualList = conversationVirtualList(items);
  const focusSeq = Number(virtualizer.activeWindow()?.focusSeq || 0);
  const innerStyle = `gap: ${virtualList.gap}px;`;
  return `
    <div class="relative shrink-0">
      <div data-history-load-edge aria-hidden="true" class="h-px w-full"></div>
      ${renderOlderEventsLoader(page)}
      ${virtualList.topPadding ? `<div aria-hidden="true" data-codex-virtual-spacer="top" style="height:${escapeAttr(virtualList.topPadding)}px"></div>` : ""}
      <div class="flex flex-col" style="${innerStyle}">
        ${virtualList.items.map((item, offset) => renderVirtualTurn(item, virtualList.start + offset, focusSeq)).join("")}
      </div>
      ${virtualList.bottomPadding ? `<div aria-hidden="true" data-codex-virtual-spacer="bottom" style="height:${escapeAttr(virtualList.bottomPadding)}px"></div>` : ""}
      <div aria-hidden="true" data-thread-footer-spacer style="height: var(--thread-scroll-padding-bottom, 160px); flex: 0 0 auto;"></div>
    </div>`;
}

function alignWindowToFocusedTurn(sessionID, items) {
  const windowState = state.threadWindows?.get(sessionID);
  const focusSeq = Number(windowState?.focusSeq || 0);
  if (!windowState || !focusSeq || !Array.isArray(items) || !items.length) return;
  const index = items.findIndex((item) => itemContainsSeq(item, focusSeq));
  if (index < 0) return;
  if (index >= windowState.start && index < windowState.end) return;
  const start = focusedThreadWindowStart(index, items.length);
  windowState.start = start;
  windowState.end = Math.min(items.length, start + FOCUSED_TURN_WINDOW_SIZE);
  windowState.itemCount = items.length;
  windowState.stickToBottom = false;
  windowState.restoreScrollTop = 0;
}

function focusedThreadWindowStart(index, itemCount) {
  return Math.max(0, Math.min(index - FOCUSED_TURN_PRE_CONTEXT, Math.max(0, itemCount - 1)));
}

function renderVirtualTurn(item, index, focusSeq) {
  const containsFocus = focusSeq > 0 && itemContainsSeq(item, focusSeq);
  const attrs = [
    `data-codex-virtual-turn="${escapeAttr(index)}"`,
    `data-codex-turn-seqs="${escapeAttr(itemSeqs(item).join(","))}"`,
    containsFocus ? 'data-codex-focus-turn="true"' : "",
  ].filter(Boolean).join(" ");
  return `<div style="" ${attrs}>${renderConversationItem(item, index)}</div>`;
}

function itemContainsSeq(item, seq) {
  if (!item || !seq) return false;
  if (Number(item.event?.seq || 0) === seq) return true;
  return Array.isArray(item.followups) && item.followups.some((event) => Number(event?.seq || 0) === seq);
}

function itemSeqs(item) {
  if (!item) return [];
  const seqs = [];
  const pushSeq = (event) => {
    for (const seq of eventSeqs(event)) {
      if (seq > 0 && !seqs.includes(seq)) seqs.push(seq);
    }
  };
  pushSeq(item.event);
  if (Array.isArray(item.followups)) {
    for (const event of item.followups) pushSeq(event);
  }
  return seqs;
}

function eventSeqs(event) {
  if (!event) return [];
  const values = [
    event.seq,
    event.data?.seq,
    ...(Array.isArray(event.groupedSeqs) ? event.groupedSeqs : []),
    ...(Array.isArray(event.data?.groupedSeqs) ? event.data.groupedSeqs : []),
  ];
  return values
    .map((value) => Number(value || 0))
    .filter((value, index, items) => value > 0 && items.indexOf(value) === index);
}

function eventSeqAttrs(event) {
  const seqs = eventSeqs(event);
  if (!seqs.length) return "";
  const exact = seqs.length === 1 ? ` data-codex-event-seq="${escapeAttr(seqs[0])}"` : "";
  return `${exact} data-codex-event-seqs="${escapeAttr(seqs.join(" "))}"`;
}

function activeFocusSeq() {
  return Number(virtualizer.activeWindow()?.focusSeq || 0);
}

function eventHasFocusSeq(event) {
  const focusSeq = activeFocusSeq();
  return focusSeq > 0 && eventSeqs(event).includes(focusSeq);
}

function eventsContainFocusSeq(events) {
  const focusSeq = activeFocusSeq();
  if (!focusSeq) return false;
  for (const item of Array.isArray(events) ? events : []) {
    const event = item?.event || item;
    if (eventSeqs(event).includes(focusSeq)) return true;
  }
  return false;
}

function seqsForEvents(events) {
  const seqs = [];
  for (const item of Array.isArray(events) ? events : []) {
    const event = item?.event || item;
    for (const seq of eventSeqs(event)) {
      if (!seqs.includes(seq)) seqs.push(seq);
    }
  }
  return seqs;
}

function shouldHideLeadingPartial(sessionID, page, events) {
  if (!Array.isArray(events) || !events.length) return false;
  if ((page?.hasMoreBefore || firstLoadedSeq(sessionID, events) > 1) !== true) return false;
  return (events[0]?.kind || "assistant_message") !== "user_message";
}

function firstLoadedSeq(sessionID, events = null) {
  const list = events || state.eventsBySession.get(sessionID) || [];
  return list.reduce((first, event) => {
    const seq = Number(event?.seq || 0);
    if (!seq) return first;
    return first ? Math.min(first, seq) : seq;
  }, 0);
}

function renderOlderEventsLoader(page) {
  if (!page?.loadingBefore) return "";
  return `
    <div class="codex-history-page-loader" role="status" aria-live="polite">
      <span class="codex-session-status-spinner" aria-hidden="true"></span>
      <span>正在加载更早记录</span>
    </div>`;
}

function conversationVirtualList(items) {
  return virtualizer.windowFor(items);
}

function groupConversationEvents(events, options = {}) {
  return grouping.groupConversationEvents(events, options);
}

function renderConversationItem(item, index) {
  if (item.type === "user-turn") return renderUserTurn(item.event, item.followups, index);
  return renderEvent(item.event, index);
}

function renderHeaderActions() {
  return `
    <div class="flex flex-shrink-0 items-center">
      <div class="flex items-center gap-1">
        ${renderNodeSelectorButton()}
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

function renderNodeSelectorButton() {
  if (!Array.isArray(state.nodes) || state.nodes.length < 2) return "";
  const node = activeNode();
  const label = nodeLabel(node);
  const open = state.popover === "nodes";
  return `
        <span type="button" aria-haspopup="menu" aria-expanded="${open}" data-state="${open ? "open" : "closed"}" class="contents outline-hidden cursor-interaction">
          <button type="button" class="border-token-border no-drag cursor-interaction flex items-center gap-1 border whitespace-nowrap select-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 rounded-full electron:rounded-md text-token-text-tertiary enabled:hover:bg-token-list-hover-background data-[state=open]:bg-token-list-hover-background border-transparent electron:p-1 electron:[&>svg]:icon-sm flex items-center justify-center p-0.5" aria-label="切换节点：${escapeAttr(label)}" aria-expanded="${open}" data-state="${open ? "open" : "closed"}" data-popover="nodes">
            ${icons.svg("target", "icon-xs shrink-0")}
            <span class="truncate">${escapeHTML(label)}</span>
            ${icons.svg("chevron20x21", "icon-2xs shrink-0 text-token-input-placeholder-foreground")}
          </button>
        </span>`;
}

function renderNodeMenu() {
  if (state.popover !== "nodes" || !Array.isArray(state.nodes) || state.nodes.length < 2) return "";
  return `
      <div class="codex-floating-menu codex-floating-menu-node" data-radix-popper-content-wrapper="" dir="ltr">
        <div data-side="bottom" data-align="end" role="menu" aria-orientation="vertical" data-state="open" data-radix-menu-content="" dir="ltr" class="_content_1hiti_1 no-drag bg-token-dropdown-background/90 text-token-foreground ring-token-border z-50 m-px flex select-none flex-col overflow-y-auto rounded-xl ring-[0.5px] px-1 py-1 shadow-xl-spread backdrop-blur-sm" tabindex="-1" data-orientation="vertical" style="${radixMenuContentStyle()} width: min(260px, calc(100vw - 16px));">
          ${state.nodes.map(renderNodeMenuItem).join("")}
        </div>
      </div>`;
}

function renderNodeMenuItem(node) {
  const selected = node.id === state.nodeId;
  const disabled = !node.online;
  const statusColor = node.online ? "var(--color-token-charts-green)" : "var(--color-token-text-tertiary)";
  const title = nodeLabel(node);
  const subtitle = node.hostname || node.rootDir || node.id;
  return `
          <button type="button" class="no-drag text-token-foreground outline-hidden rounded-lg px-[var(--padding-row-x)] py-[var(--padding-row-y)] text-sm group hover:bg-token-list-hover-background focus:bg-token-list-hover-background cursor-interaction flex flex-col${disabled ? " opacity-50" : ""}" role="menuitem" tabindex="-1" data-orientation="vertical" data-radix-collection-item="" data-codex-node-id="${escapeAttr(node.id)}" aria-disabled="${disabled}">
            <span class="flex w-full min-w-0 items-center gap-2">
              <span aria-hidden="true" class="shrink-0 rounded-full" style="width: 6px; height: 6px; background: ${statusColor};"></span>
              <span class="min-w-0 flex-1 truncate">${escapeHTML(title)}</span>
              ${selected ? icons.svg("check17", "icon-xs shrink-0 opacity-75 group-focus:opacity-100 group-hover:opacity-100") : ""}
            </span>
            <span class="min-w-0 truncate text-token-text-tertiary">${escapeHTML(subtitle)}</span>
          </button>`;
}

function nodeLabel(node) {
  return String(node?.name || node?.id || "Node");
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
            <span class="min-w-0 truncate select-none flex-1" data-thread-title="true">${escapeHTML(session.title)}</span>
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
  if (kind === "file_change") return renderStandaloneFileChange(event, index);
  if (isActivityEvent(event)) {
    return renderActivity(event, index);
  }
  if (kind === "error") return renderErrorTurn(event, index);
  return renderAssistantMessage(event, index, false);
}

function renderStandaloneFileChange(event, index) {
  const key = `standalone-file-change:${turnKeyFromEvent(event, index)}`;
  const body = renderTurnActivityDetail(event, key);
  return renderTurnContainer(index, "assistant", `<div class="flex flex-col">${body}</div>`, undefined, event);
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
          <div class="scroll-mt-4" data-content-search-unit-key="${escapeAttr(contentSearchKey(turnKey, unit, role))}"${eventSeqAttrs(eventForKey)} ${role === "user" ? "data-local-conversation-user-anchor=\"true\"" : ""}>
            ${content}
          </div>
        </div>
        <div aria-hidden="true" class="w-full" style="height: var(--conversation-tool-assistant-gap, 8px);"></div>
        ${afterContent}
      </div>
    </div>`;
}

function turnKeyFromEvent(event, index) {
  return event?.turnKey || event?.data?.turnKey || event?.turnId || event?.data?.turnId || event?.data?.turn_id || `codex-turn-${index}`;
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
  const summaryFinalFollowup = split.finalFollowupPlacement === "summary" ? split.finalFollowup : null;
  const finalFollowup = split.finalFollowupPlacement === "summary" ? null : split.finalFollowup;
  const streamFollowups = split.streamFollowups;
  const turnKey = turnKeyFromEvent(baseEvent, index);
  const resourceCards = renderWebsiteResourceCards(websiteResourcesFromEvents([baseEvent, ...followups]));
  const detailFollowups = renderTurnActivityDetails(split.detailEvents, `turn-details:${turnKey}`);

  if (!streamFollowups.length && !split.hasProcessSummary && !finalFollowup && !resourceCards && !detailFollowups) {
    return `
        <div class="flex flex-col"><div class="-mx-1.5 px-1.5" style="overflow: hidden; opacity: 1; height: auto;"></div></div>
        <div aria-hidden="true" class="w-full" style="height: var(--conversation-tool-assistant-gap, 8px);"></div>
        <div class="flex flex-col"><div></div></div>`;
  }

  if (finalFollowup && !streamFollowups.length && !split.hasProcessSummary && !resourceCards && !detailFollowups) {
    const finalUnit = contentUnitFor(finalFollowup, 1);
    return `<div class="flex flex-col" data-local-conversation-final-assistant="true"><div data-content-search-unit-key="${escapeAttr(contentSearchKey(turnKey, finalUnit, "assistant"))}"${eventSeqAttrs(finalFollowup)}>${renderAssistantContent(finalFollowup, `${index}-final`, false)}</div></div>`;
  }

  if (split.hasProcessSummary && !streamFollowups.length) {
    const finalAttrs = finalFollowup ? ' data-local-conversation-final-assistant="true"' : "";
    const finalUnit = contentUnitFor(finalFollowup, 1);
    return `
        <div class="flex flex-col">${renderTurnActivitySummary(split, baseEvent, index, summaryFinalFollowup)}</div>
        <div aria-hidden="true" class="w-full" style="height: var(--conversation-tool-assistant-gap, 8px);"></div>
        <div class="flex flex-col"${finalAttrs}><div${finalFollowup ? ` data-content-search-unit-key="${escapeAttr(contentSearchKey(turnKey, finalUnit, "assistant"))}"${eventSeqAttrs(finalFollowup)}` : ""}>${finalFollowup ? renderAssistantContent(finalFollowup, `${index}-final`, false) : ""}</div></div>
        ${resourceCards ? `<div aria-hidden="true" class="w-full" style="height: var(--conversation-tool-assistant-gap, 8px);"></div><div class="flex flex-col">${resourceCards}</div>` : ""}
        ${detailFollowups ? `<div aria-hidden="true" class="w-full" style="height: var(--conversation-tool-assistant-gap, 8px);"></div><div class="flex flex-col">${detailFollowups}</div>` : ""}`;
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
        ${split.hasProcessSummary ? `<div aria-hidden="true" class="w-full" style="height: var(--conversation-tool-assistant-gap, 8px);"></div><div class="flex flex-col">${renderTurnActivitySummary(split, baseEvent, index, summaryFinalFollowup)}</div>` : ""}
        <div aria-hidden="true" class="w-full" style="height: var(--conversation-tool-assistant-gap, 8px);"></div>
        <div class="flex flex-col"${finalAttrs}><div${finalFollowup ? ` data-content-search-unit-key="${escapeAttr(contentSearchKey(turnKey, finalUnit, "assistant"))}"${eventSeqAttrs(finalFollowup)}` : ""}>${finalFollowup ? renderAssistantContent(finalFollowup, `${index}-final`, false) : ""}</div></div>
        ${resourceCards ? `<div aria-hidden="true" class="w-full" style="height: var(--conversation-tool-assistant-gap, 8px);"></div><div class="flex flex-col">${resourceCards}</div>` : ""}
        ${detailFollowups ? `<div aria-hidden="true" class="w-full" style="height: var(--conversation-tool-assistant-gap, 8px);"></div><div class="flex flex-col">${detailFollowups}</div>` : ""}`;
}

function renderWebsiteResourceCards(resources) {
  if (!Array.isArray(resources) || !resources.length) return "";
  const visibleResources = resources.slice(0, 3);
  return `
      <div class="flex flex-col gap-3">
        ${visibleResources.map(renderWebsiteResourceCard).join("")}
      </div>`;
}

function renderWebsiteResourceCard(resource) {
  const title = resource?.title || "网页预览";
  const subtitle = resource?.subtitle || "网站";
  const url = resource?.url || resource?.target || "";
  return `
        <div class="group/end-resource relative">
          <button aria-label="${escapeAttr(`打开 ${title}`)}" class="peer/end-resource absolute inset-0 cursor-interaction bg-transparent group-hover/end-resource:bg-token-list-hover-background/30 focus-visible:ring-1 focus-visible:ring-token-focus-border focus-visible:outline-none focus-visible:ring-inset" type="button" data-codex-resource-url="${escapeAttr(url)}"></button>
          <div class="flex max-w-full flex-col overflow-hidden rounded-lg bg-token-dropdown-background/50 text-token-foreground [--thread-resource-card-row-padding-x:0.75rem] electron:elevation-stroke extension:border extension:border-token-border extension:bg-token-input-background/50 extension:shadow-sm">
            <span class="pointer-events-none relative z-10 flex min-w-0 items-center gap-2.5 text-left px-[var(--thread-resource-card-row-padding-x)] py-3 peer-hover/end-resource:[&_.end-resource-default-subtitle]:hidden peer-hover/end-resource:[&_.end-resource-hover-subtitle]:inline-flex">
              <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-token-bg-secondary text-token-text-secondary">${icons.svg("websiteGlobe", "size-6")}</span>
              <span class="flex min-w-0 flex-1 flex-col">
                <span class="text-size-chat truncate font-medium text-token-foreground">${escapeHTML(title)}</span>
                <span class="text-size-chat-sm truncate text-token-text-secondary">
                  <span class="end-resource-default-subtitle">${escapeHTML(subtitle)}</span>
                  <span class="end-resource-hover-subtitle hidden items-center gap-1">打开${icons.svg("chevronRight", "icon-2xs")}</span>
                </span>
              </span>
              <span class="pointer-events-auto flex shrink-0 items-center gap-2">
                <button type="button" class="end-resource-open-button border-token-border no-drag cursor-interaction flex items-center gap-1 border whitespace-nowrap select-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 rounded-lg text-token-foreground enabled:hover:bg-token-list-hover-background data-[state=open]:bg-token-list-hover-background border-transparent h-token-button-composer px-2 py-0 text-base leading-[18px] !self-center !bg-transparent hover:!bg-token-list-hover-background data-[state=open]:!bg-token-list-hover-background" data-codex-resource-url="${escapeAttr(url)}">打开方式${icons.svg("chevron20x21", "icon-2xs opacity-50")}</button>
              </span>
            </span>
          </div>
        </div>`;
}

function renderInlineTurnFollowup(event, baseEvent, turnIndex, offset) {
  const content = renderInlineFollowupContent(event, turnIndex, offset);
  const direct = isInlineActivity(event);
  const turnKey = turnKeyFromEvent(baseEvent, turnIndex);
  const unit = contentUnitFor(event, offset + 1);
  const wrapped = direct
    ? content
    : `<div data-content-search-unit-key="${escapeAttr(contentSearchKey(turnKey, unit, "assistant"))}"${eventSeqAttrs(event)}>${content}</div>`;
  if (offset === 0) return `<div style="overflow: hidden;">${wrapped}</div>`;
  return `
    <div style="overflow: hidden;">
      <div aria-hidden="true" class="w-full" style="height: var(--conversation-tool-assistant-gap, 8px);"></div>
      ${wrapped}
    </div>`;
}

function isInlineActivity(event) {
  return Boolean(event?.codexActivityItem) || isActivityEvent(event);
}

function renderInlineFollowupContent(event, turnIndex, offset) {
  const kind = event.kind || "assistant_message";
  if (event?.codexActivityItem) {
    return renderTurnActivityDetail(event, `inline-activity:${turnIndex}:${offset}`);
  }
  if (isInlineActivity(event)) {
    return renderActivityContent(event);
  }
  if (kind === "tool_summary") return renderToolSummaryContent(event);
  if (kind === "error") return renderErrorActivity(event, `inline-error:${turnIndex}:${offset}`);
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
    <div class="group flex min-w-0 flex-col"${eventSeqAttrs(event)}>
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
  const hasCardFiles = Array.isArray(card?.files) && card.files.length;
  const files = hasCardFiles ? card.files : ["frontend/src/app/bootstrap.js", "frontend/src/app/layout.css", "frontend/src/pages/codex/index.js"];
  const total = card?.total || files.length;
  const label = card?.label || `已编辑 ${total} 个文件`;
  const additions = card?.additions || (hasCardFiles ? signedStatTotal(files, "additions", "+") : "+1,198");
  const deletions = card?.deletions || (hasCardFiles ? signedStatTotal(files, "deletions", "-") : "-2");
  const seqAttrs = card?.seqAttrs || "";
  const collapseKey = card?.collapseKey || "";
  const fileListKey = collapseKey ? `${collapseKey}:file-list` : `diff-card-files:${stableTextHash(files.map(diffFileStableKey).join("|"))}`;
  const showAllFiles = files.length > FILE_ACTIVITY_VISIBLE_FILE_LIMIT
    ? disclosureExpanded(fileListKey, false)
    : true;
  const visibleFiles = showAllFiles ? files : files.slice(0, FILE_ACTIVITY_VISIBLE_FILE_LIMIT);
  const hiddenFileCount = Math.max(0, files.length - visibleFiles.length);
  return `
      <div class="mt-3"${seqAttrs}>
        <div class="flex w-full flex-col gap-3">
          <div class="flex max-w-full flex-col overflow-hidden rounded-lg bg-token-dropdown-background/50 text-token-foreground [--thread-resource-card-row-padding-x:0.75rem] electron:elevation-stroke extension:border extension:border-token-border extension:bg-token-input-background/50 extension:shadow-sm mb-2 text-base [--turn-diff-row-padding-y:0.25rem]">
            <div class="group/turn-diff-header group/activity-header relative focus-within:[&_.turn-diff-default-subtitle]:hidden hover:[&_.turn-diff-default-subtitle]:hidden focus-within:[&_.turn-diff-hover-subtitle]:inline-flex hover:[&_.turn-diff-hover-subtitle]:inline-flex">
              <button type="button" class="absolute inset-0 cursor-interaction bg-transparent group-hover/turn-diff-header:bg-token-list-hover-background/30 focus-visible:ring-1 focus-visible:ring-token-focus-border focus-visible:outline-none focus-visible:ring-inset" aria-label="审查已更改的文件"></button>
              <span class="flex min-w-0 items-center gap-2.5 text-left px-[var(--thread-resource-card-row-padding-x)] py-3 pointer-events-none relative z-10">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-token-bg-secondary text-token-text-secondary">${icons.svg("newChat", "icon-sm")}</span>
                <span class="flex min-w-0 flex-1 flex-col">
                  <span class="text-size-chat truncate font-medium text-token-foreground">${escapeHTML(label)}</span>
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
              ${visibleFiles.map(renderDiffFileRow).join("")}
              ${files.length > FILE_ACTIVITY_VISIBLE_FILE_LIMIT ? renderDiffFileShowMoreToggle(fileListKey, showAllFiles, hiddenFileCount) : ""}
            </div>
          </div>
        </div>
      </div>`;
}

function renderDiffFileShowMoreToggle(key, expanded, hiddenFileCount) {
  const label = expanded
    ? "收起文件"
    : `再显示 ${Math.max(1, Number(hiddenFileCount || 0))} 个文件`;
  const chevronClass = expanded ? "icon-2xs shrink-0 rotate-90 transition-transform duration-200" : "icon-2xs shrink-0 transition-transform duration-200";
  return `
              <button type="button" class="text-size-chat flex h-9 w-full cursor-interaction items-center px-[var(--thread-resource-card-row-padding-x)] py-[var(--turn-diff-row-padding-y)] text-left text-token-text-primary hover:bg-token-list-hover-background/30 focus-visible:ring-1 focus-visible:ring-token-focus-border focus-visible:outline-none focus-visible:ring-inset" aria-expanded="${expanded}" data-disclosure-toggle="${escapeAttr(key)}">
                <span class="inline-flex min-w-0 items-center gap-2"><span class="truncate">${escapeHTML(label)}</span>${icons.svg("chevronRight", chevronClass)}</span>
              </button>`;
}

function diffFileStableKey(file) {
  if (typeof file === "string") return file;
  return [
    file?.path || file?.file || file?.name || "",
    file?.type || "",
    file?.additions || 0,
    file?.deletions || 0,
  ].join(":");
}

function stableTextHash(value) {
  const text = String(value || "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
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
  const pathValue = displayDiffPath(typeof file === "string" ? file : String(file?.path || ""));
  const parts = pathValue.split("/");
  const name = parts.pop() || pathValue;
  const dir = parts.length ? `${parts.join("/")}/` : "./";
  return {
    path: pathValue || name,
    dir,
    name,
    type: typeof file === "object" ? String(file?.type || "update") : "update",
    additions: typeof file === "object" ? signedStat(file?.additions, "+") : "+1",
    deletions: typeof file === "object" ? signedStat(file?.deletions, "-") : "-0",
    unifiedDiff: typeof file === "object" ? String(file?.unifiedDiff || file?.unified_diff || "") : "",
    content: typeof file === "object" ? String(file?.content || "") : "",
  };
}

function displayDiffPath(pathValue) {
  return String(pathValue || "")
    .replace(/^\/root\//, "")
    .replace(/^\/workspace\//, "");
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
        <div class="flex flex-col"${followup ? ' data-local-conversation-final-assistant="true"' : ""}><div${followup ? ` data-content-search-unit-key="${escapeAttr(contentSearchKey(turnKey, followupUnit, "assistant"))}"${eventSeqAttrs(followup)}` : ""}>${followup ? renderAssistantContent(followup, `${index}-summary`, false) : ""}</div></div>
      </div>
    </div>`;
}

function renderSummaryBody(event, options = {}) {
  const label = event.text || "已处理";
  const key = options.key || `summary:${turnKeyFromEvent(event, 0)}`;
  const body = options.body || "";
  const interactive = Boolean(String(body || "").trim());
  const expanded = interactive ? disclosureExpanded(key, Boolean(options.defaultExpanded)) : false;
  const shouldRenderBody = body && (expanded || !options.unmountWhenCollapsed);
  const tag = interactive ? "button" : "div";
  const toggleAttrs = interactive ? ` type="button" aria-expanded="${expanded}" data-disclosure-toggle="${escapeAttr(key)}"` : "";
  const chevronClass = expanded ? "icon-2xs text-token-foreground/40 transition-transform duration-200 rotate-90" : "icon-2xs text-token-foreground/40 transition-transform duration-200 rotate-0";
  return `
          <div class="text-size-chat text-token-text-secondary"${eventSeqAttrs(event)}>
            <${tag}${toggleAttrs} class="text-size-chat ${interactive ? "hover:bg-token-bg-subtle cursor-interaction" : ""} inline-flex items-center gap-1 rounded-md border border-transparent focus-visible:ring-2 focus-visible:ring-token-focus-border focus-visible:outline-none">
              <span><span class="text-token-foreground/60">${escapeHTML(label)}</span></span>
              ${interactive ? icons.svg("chevronRight", chevronClass) : ""}
            </${tag}>
          </div>
          <div class="text-size-chat pt-1 text-token-text-secondary">
            <div class="w-full border-t border-token-border-light"></div>
          </div>
          ${shouldRenderBody ? renderDisclosureBody(expanded, body, "-mx-1.5 px-1.5", "flex flex-col space-y-0 pt-2", key) : ""}`;
}

function renderTurnActivitySummary(split, baseEvent, index, summaryFinalFollowup = null) {
  const label = activitySummary.summaryLabel(baseEvent, split);
  const key = `turn-activity:${turnKeyFromEvent(baseEvent, index)}`;
  const summaryBody = renderSummaryActivityItems(split, `${key}:summary`);
  const finalBody = summaryFinalFollowup ? renderAssistantContent(summaryFinalFollowup, `${index}-summary-final`, false) : "";
  const body = [summaryBody, finalBody].filter(Boolean).join("");
  const summaryEvents = [
    ...(split.summaryEvents || []),
    ...(split.summaryDetails || []),
    ...(split.summaryItems || []).map((item) => item?.event || item),
    ...(split.processEvents || []),
    ...(summaryFinalFollowup ? [summaryFinalFollowup] : []),
  ];
  const defaultExpanded = summaryEvents.some(isActivityPending);
  return `${renderSummaryBody({ text: label, data: { groupedSeqs: seqsForEvents(summaryEvents) } }, {
    key,
    body,
    defaultExpanded,
    unmountWhenCollapsed: true,
  })}`;
}

function renderTurnActivityDetails(detailEvents, key) {
  const details = groupAdjacentFileChangeDetails(detailEvents);
  return details
    .map((item, offset) => renderTurnActivityDetail(item, `${key}:detail:${offset}`))
    .join("");
}

function renderSummaryActivityItems(split, key) {
  if (Array.isArray(split?.summaryItems)) {
    return groupAdjacentFileChangeDetails(split.summaryItems)
      .map((item, offset) => renderSummaryActivityItem(item, `${key}:${offset}`))
      .join("");
  }
  return renderSummaryDetailBody(split?.summaryDetails || [], key);
}

function renderSummaryActivityItem(item, key) {
  const event = item?.event || item;
  if (item?.type === "guidance" || event?.kind === "user_message") return renderGuidanceActivityRow(event);
  if (event?.kind === "file_change") return renderSummaryFileChangeActivity(event, key);
  if (item?.type === "activity") return renderTurnActivityDetail(event, key);
  return renderAssistantContent(event, key, false, false);
}

function renderGuidanceActivityRow(event = null) {
  return `
    <div class="min-w-0 text-size-chat relative overflow-visible py-0"${eventSeqAttrs(event)}>
      <span class="block truncate text-token-conversation-summary-trailing">已引导对话</span>
    </div>`;
}

function renderSummaryDetailBody(events, key) {
  return (Array.isArray(events) ? events : [])
    .map((event, offset) => renderAssistantContent(event, `${key}:${offset}`, false, false))
    .join("");
}

function disclosureExpanded(key, defaultExpanded = false) {
  if (!state.disclosures) state.disclosures = new Map();
  return state.disclosures.has(key) ? Boolean(state.disclosures.get(key)) : defaultExpanded;
}

function renderDisclosureBody(expanded, body, outerClass = "", innerClass = "flex flex-col gap-2 pt-2 pb-1 pl-6", key = "") {
  const visibilityClass = expanded ? "overflow-visible" : "overflow-hidden";
  const inertAttr = expanded ? "" : " inert=\"\"";
  const keyAttr = key ? ` data-disclosure-body="${escapeAttr(key)}"` : "";
  const style = expanded
    ? "pointer-events: auto; opacity: 1; height: auto;"
    : "pointer-events: none; opacity: 0; height: 0px;";
  const className = [visibilityClass, outerClass].filter(Boolean).join(" ");
  return `
        <div aria-hidden="${expanded ? "false" : "true"}"${inertAttr}${keyAttr} class="${className}" style="${style}">
          <div class="${innerClass}">${body}</div>
        </div>`;
}

function groupAdjacentFileChangeDetails(detailEvents) {
  const groups = [];
  let current = [];
  let currentAction = "";
  let currentTurnID = "";
  let currentSeq = 0;

  const flush = () => {
    if (!current.length) return;
    groups.push(current.length === 1 ? current[0] : mergeFileChangeDetails(current));
    current = [];
    currentAction = "";
    currentTurnID = "";
    currentSeq = 0;
  };

  for (const item of Array.isArray(detailEvents) ? detailEvents : []) {
    const event = item?.event || item;
    if (activitySummary.detailKind(event) !== "file_change") {
      flush();
      groups.push(item);
      continue;
    }
    const files = normalizeFileChangeFiles(event?.data?.files || event?.files || []);
    const action = fileChangeAction(files);
    const turnID = turnIDForFileChange(event);
    const seq = Number(event?.seq || 0);
    const sameTurn = Boolean(currentTurnID && turnID && currentTurnID === turnID);
    const adjacentSeq = !currentSeq || !seq || seq === currentSeq + 1;
    const canMerge = current.length
      && action === currentAction
      && (sameTurn || adjacentSeq);
    if (!files.length || (current.length && !canMerge)) {
      flush();
    }
    current.push(item);
    currentAction = action;
    currentTurnID = currentTurnID || turnID;
    currentSeq = seq || currentSeq;
  }
  flush();
  return groups;
}

function mergeFileChangeDetails(items) {
  const events = items.map((item) => item?.event || item).filter(Boolean);
  const first = events[0] || {};
  const groupedSeqs = seqsForEvents(events);
  const files = mergeFileChangeFiles(events.flatMap((event) => normalizeFileChangeFiles(event?.data?.files || event?.files || [])));
  const data = {
    ...(first.data || {}),
    type: "file_change",
    status: first.data?.status || first.status || "completed",
    files,
    groupedSeqs,
    groupedCallIds: events
      .map((event) => event?.data?.call_id || event?.data?.callId || event?.call_id || event?.callId || "")
      .filter(Boolean),
  };
  return {
    ...first,
    kind: "file_change",
    text: fileChangeLabel(files),
    data,
    files,
    groupedSeqs,
  };
}

function turnIDForFileChange(event) {
  return String(
    event?.turnKey ||
    event?.data?.turnKey ||
    event?.turnId ||
    event?.data?.turnId ||
    event?.data?.turn_id ||
    "",
  ).trim();
}

function mergeFileChangeFiles(files) {
  const merged = [];
  const byPath = new Map();
  for (const file of Array.isArray(files) ? files : []) {
    const key = displayDiffPath(file?.path || "").trim();
    if (!key) continue;
    const existing = byPath.get(key);
    if (!existing) {
      const copy = { ...file };
      copy.path = file.path;
      copy.additions = Math.max(0, Number(file.additions || 0));
      copy.deletions = Math.max(0, Number(file.deletions || 0));
      byPath.set(key, copy);
      merged.push(copy);
      continue;
    }
    existing.additions += Math.max(0, Number(file.additions || 0));
    existing.deletions += Math.max(0, Number(file.deletions || 0));
    if (!existing.unifiedDiff && file.unifiedDiff) {
      existing.unifiedDiff = file.unifiedDiff;
    } else if (existing.unifiedDiff && file.unifiedDiff && !existing.unifiedDiff.includes(file.unifiedDiff)) {
      existing.unifiedDiff = `${existing.unifiedDiff}\n${file.unifiedDiff}`;
    }
    if (!existing.content && file.content) {
      existing.content = file.content;
    }
  }
  return merged;
}

function renderTurnActivityDetail(item, key) {
  const iconName = activitySummary.detailIcon(item);
  const kind = activitySummary.detailKind(item);
  const label = activitySummary.detailLabel(item);
  const status = activitySummary.detailStatus(item);
  if (kind === "file_change") {
    return renderFileChangeActivityDetail(item.event || item, iconName, label, key);
  }
  if (kind === "tool_call" && isActivityPending(item.event || item)) {
    if (hasShellArgs(item)) {
      return renderToolCallActivityDetail(item, iconName, label, status, key);
    }
    return renderRunningActivityDisclosure(item.event || item);
  }
  if (kind === "tool_call") {
    return renderToolCallActivityDetail(item, iconName, label, status, key);
  }
  return renderToolActivityDisclosure({
    body: "",
    expanded: false,
    iconName,
    key: "",
    label,
    status,
    wrapLabel: kind === "assistant_message",
    seqAttrs: eventSeqAttrs(item.event || item),
  });
}

function renderFileChangeActivityDetail(event, iconName, label, key) {
  const files = mergeFileChangeFiles(normalizeFileChangeFiles(event?.data?.files || event?.files || []));
  if (!files.length) return "";
  return renderDiffCard({
    files,
    total: files.length,
    label: label || fileChangeLabel(files),
    additions: signedStatTotal(files, "additions", "+"),
    deletions: signedStatTotal(files, "deletions", "-"),
    collapseKey: `${key}:files`,
    seqAttrs: eventSeqAttrs(event),
  });
}

function renderSummaryFileChangeActivity(event, key) {
  const files = mergeFileChangeFiles(normalizeFileChangeFiles(event?.data?.files || event?.files || []));
  if (!files.length) return "";
  const action = fileChangeAction(files);
  const label = fileChangeLabel(files);
  const body = renderSummaryPatchFileGroup(files, action);
  return renderToolActivityDisclosure({
    body,
    expanded: disclosureExpanded(key, isActivityPending(event) || eventHasFocusSeq(event) || FILE_ACTIVITY_DEFAULT_EXPANDED),
    iconName: activitySummary.detailIcon(event),
    key,
    label,
    seqAttrs: eventSeqAttrs(event),
    bodyInnerClass: "flex flex-col",
  });
}

function renderSummaryPatchFileGroup(files, action) {
  const actionLabel = patchFileActionLabel(action);
  return `
                        <div class="flex flex-col" style="--conversation-patch-file-gap: 4px;">
                          <div>
                            <div aria-hidden="true" class="w-full" style="height: 4px;"></div>
                            <div class="min-w-0 text-size-chat relative overflow-visible py-0">
                              <div class="flex flex-col gap-[var(--conversation-patch-file-gap,var(--conversation-tool-assistant-gap,8px))]">
                                ${files.map((file) => renderSummaryPatchFile(file, actionLabel)).join("")}
                              </div>
                            </div>
                          </div>
                        </div>`;
}

function renderSummaryPatchFile(file, actionLabel) {
  const item = normalizeDiffFile(file);
  return `
                                <div class="px-0">
                                  <div class="flex flex-col overflow-clip rounded-lg">
                                    <div class="cursor-interaction group/activity-header flex items-center justify-between gap-1 text-ellipsis text-size-chat px-0 py-0">
                                      <div class="text-size-chat flex min-w-0 items-center gap-1 text-token-description-foreground/80">
                                        <span class="text-token-description-foreground/80 select-text group-hover/activity-header:text-token-foreground">${escapeHTML(actionLabel)}</span>
                                        <div class="flex items-center gap-1.5"></div>
                                        ${icons.svg("chevronRight", "icon-2xs shrink-0 text-token-input-placeholder-foreground opacity-0 group-hover/activity-header:opacity-100 group-hover/activity-header:text-token-foreground group-focus-visible/activity-header:opacity-100 group-focus-visible/activity-header:text-token-foreground transition-transform duration-300 rotate-90 opacity-100")}
                                      </div>
                                      <div class="ml-1 flex items-center gap-1 transition-opacity duration-200"></div>
                                    </div>
                                    <div class="overflow-visible" style="pointer-events: auto; opacity: 1;">
                                      <div>
                                        <div class="border-token-border flex flex-col overflow-hidden rounded-lg border mt-1.5">
                                          <div class="text-size-chat-sm flex items-center justify-between gap-2 border-b border-token-border bg-token-list-hover-background/60 px-2.5 py-0.5 text-token-description-foreground/80">
                                            <div class="flex min-w-0 items-center gap-2">
                                              <button type="button" class="text-token-description-foreground/80 cursor-interaction max-w-full truncate text-start hover:underline" data-state="closed">${escapeHTML(item.name)}</button>
                                              <span data-thread-find-skip="true" class="inline-flex items-center gap-1 disambiguated-digits tabular-nums tracking-tight text-size-chat-sm">
                                                <span class="flex shrink-0 items-center text-token-git-decoration-added-resource-foreground">${escapeHTML(item.additions)}</span>
                                                <span class="flex shrink-0 items-center text-token-git-decoration-deleted-resource-foreground">${escapeHTML(item.deletions)}</span>
                                              </span>
                                            </div>
                                            ${renderMessageIconButton("\u590d\u5236", "copy", "p-0.5", false)}
                                          </div>
                                          ${renderSummaryPatchFileContent(item)}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>`;
}

function renderSummaryPatchFileContent(file) {
  const lines = summaryPatchFileLines(file);
  if (!lines.length) return "";
  const borderColor = summaryPatchBlockBorderColor(lines);
  return `
                                          <div class="thread-diff-virtualized border-token-border bg-token-text-code-block-background overflow-auto border-t font-vscode-editor text-[var(--diffs-font-size,12px)] leading-[18px]" style="max-height: 220px;">
                                            <div class="min-w-full" style="border-left: 4px solid ${borderColor};">
                                              ${renderPatchLines(lines)}
                                            </div>
                                          </div>`;
}

function summaryPatchFileLines(file) {
  const diff = String(file?.unifiedDiff || "").trimEnd();
  if (diff) return parseUnifiedPatchLines(diff);
  const content = String(file?.content || "").trimEnd();
  if (!content) return [];
  const kind = file?.type === "delete" ? "delete" : "add";
  return content
    .split("\n")
    .map((text, index) => ({ kind, text, lineNumber: index + 1 }));
}

function parseUnifiedPatchLines(diff) {
  let newLineNumber = 0;
  return String(diff || "")
    .split("\n")
    .map((rawLine) => {
      const hunk = rawLine.match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)/);
      if (hunk) {
        newLineNumber = Number(hunk[1]) || newLineNumber;
        return { kind: "hunk", text: rawLine, lineNumber: "" };
      }
      if (/^(diff --git|index |--- |\+\+\+ )/.test(rawLine)) {
        return { kind: "meta", text: rawLine, lineNumber: "" };
      }
      if (rawLine.startsWith("+")) {
        const line = { kind: "add", text: rawLine.slice(1), lineNumber: newLineNumber || "" };
        newLineNumber += 1;
        return line;
      }
      if (rawLine.startsWith("-")) {
        return { kind: "delete", text: rawLine.slice(1), lineNumber: "" };
      }
      const line = { kind: "context", text: rawLine.startsWith(" ") ? rawLine.slice(1) : rawLine, lineNumber: newLineNumber || "" };
      newLineNumber += 1;
      return line;
    });
}

function renderPatchLines(lines) {
  return lines
    .map((line) => {
      const style = summaryPatchLineStyle(line.kind);
      const gutter = line.lineNumber ? escapeHTML(String(line.lineNumber)) : "";
      return `
                                                <div class="flex min-w-full" style="${style.row}">
                                                  <span aria-hidden="true" class="shrink-0 select-none text-right tabular-nums" style="${style.gutter}">${gutter}</span>
                                                  <code class="block flex-1 whitespace-pre px-2" style="${style.code}">${escapeHTML(line.text || " ")}</code>
                                                </div>`;
    })
    .join("");
}

function summaryPatchLineStyle(kind) {
  if (kind === "add") {
    return {
      row: "background: color-mix(in srgb, var(--color-token-git-decoration-added-resource-foreground, #2e7d32) 12%, transparent);",
      gutter: "width: 40px; padding-right: 8px; color: var(--color-token-git-decoration-added-resource-foreground, #2e7d32); background: color-mix(in srgb, var(--color-token-git-decoration-added-resource-foreground, #2e7d32) 10%, transparent);",
      code: "min-height: 18px; color: var(--color-token-text-primary);",
    };
  }
  if (kind === "delete") {
    return {
      row: "background: color-mix(in srgb, var(--color-token-git-decoration-deleted-resource-foreground, #b3261e) 12%, transparent);",
      gutter: "width: 40px; padding-right: 8px; color: var(--color-token-git-decoration-deleted-resource-foreground, #b3261e); background: color-mix(in srgb, var(--color-token-git-decoration-deleted-resource-foreground, #b3261e) 10%, transparent);",
      code: "min-height: 18px; color: var(--color-token-text-primary);",
    };
  }
  return {
    row: kind === "hunk" || kind === "meta" ? "background: var(--color-token-bg-secondary);" : "",
    gutter: "width: 40px; padding-right: 8px; color: var(--color-token-description-foreground);",
    code: "min-height: 18px; color: var(--color-token-description-foreground);",
  };
}

function summaryPatchBlockBorderColor(lines) {
  if (lines.some((line) => line.kind === "add")) return "var(--color-token-git-decoration-added-resource-foreground, #2e7d32)";
  if (lines.some((line) => line.kind === "delete")) return "var(--color-token-git-decoration-deleted-resource-foreground, #b3261e)";
  return "var(--color-token-border)";
}

function patchFileActionLabel(action) {
  if (action === "add") return "\u6587\u4ef6\u5df2\u521b\u5efa";
  if (action === "delete") return "\u6587\u4ef6\u5df2\u5220\u9664";
  return "\u6587\u4ef6\u5df2\u7f16\u8f91";
}

function normalizeFileChangeFiles(files) {
  return (Array.isArray(files) ? files : [])
    .map((file) => {
      const pathValue = String(file?.path || file?.file || file?.name || "").trim();
      if (!pathValue) return null;
      return {
        path: pathValue,
        type: String(file?.type || "update"),
        additions: Number(file?.additions || 0),
        deletions: Number(file?.deletions || 0),
        unifiedDiff: String(file?.unifiedDiff || file?.unified_diff || ""),
        content: String(file?.content || ""),
      };
    })
    .filter(Boolean);
}

function fileChangeLabel(files) {
  const action = fileChangeActionLabel(fileChangeAction(files));
  return `${action} ${files.length} \u4e2a\u6587\u4ef6`;
}

function fileChangeAction(files) {
  if (files.length && files.every((file) => file.type === "add")) return "add";
  if (files.length && files.every((file) => file.type === "delete")) return "delete";
  return "update";
}

function fileChangeActionLabel(action) {
  if (action === "add") return "\u5df2\u521b\u5efa";
  if (action === "delete") return "\u5df2\u5220\u9664";
  return "\u5df2\u7f16\u8f91";
}

function signedStat(value, sign) {
  const number = Number(value || 0);
  return `${sign}${Math.max(0, Math.trunc(Math.abs(number)))}`;
}

function signedStatTotal(files, property, sign) {
  const total = (Array.isArray(files) ? files : []).reduce((sum, file) => {
    const value = typeof file === "object" ? Number(file?.[property] || 0) : 0;
    return sum + (Number.isFinite(value) ? Math.abs(value) : 0);
  }, 0);
  return signedStat(total, sign);
}

function renderToolCallActivityDetail(item, iconName, label, status, key) {
  const args = activitySummary.detailArgs(item) || {};
  const output = activitySummary.detailOutput(item);
  const command = String(args.cmd || args.command || "");
  const workdir = String(args.workdir || args.cwd || "");
  const outputEvent = item?.outputEvent || null;
  const preview = command || toolArgumentsPreview(args);
  const extraArgs = renderToolCallExtraArgs(args);
  const body = command || workdir || output || extraArgs
    ? `
            ${command || workdir ? renderShellCommandBlock({ command, workdir, output, status, outputEvent }) : ""}
            ${extraArgs}
            ${!command && output ? renderToolOutputOnlyBlock(output) : ""}`
    : "";
  return renderToolActivityDisclosure({
    body,
    expanded: disclosureExpanded(key, isRunningShellStatus(status) || eventHasFocusSeq(item.event || item)),
    iconName,
    key,
    label,
    preview,
    status,
    buttonLike: true,
    tone: isFailureStatus(status, outputEvent) ? "error" : "",
    seqAttrs: eventSeqAttrs(item.event || item),
  });
}

function renderToolActivityDisclosure({ body, expanded, iconName, key, label, preview = "", status = "", wrapLabel = false, buttonLike = false, tone = "", bodyOuterClass = "", bodyInnerClass = "flex flex-col gap-2 pt-2 pb-1 pl-6", seqAttrs = "" }) {
  const isErrorTone = tone === "error";
  const leadingColorClass = isErrorTone ? "text-token-editor-error-foreground" : "text-token-conversation-summary-trailing";
  const iconColorClass = isErrorTone ? "text-token-editor-error-foreground" : "text-token-input-placeholder-foreground";
  const statusClass = isErrorTone ? "codex-turn-activity-status text-token-editor-error-foreground" : "codex-turn-activity-status";
  const statusText = status && status !== "completed" ? `<span class="${statusClass}">${escapeHTML(status)}</span>` : "";
  const hasBody = Boolean(String(body || "").trim());
  const hasButtonHeader = hasBody || buttonLike;
  const chevronClass = expanded
    ? "icon-2xs shrink-0 text-token-input-placeholder-foreground opacity-100 group-hover/activity-header:text-token-foreground group-focus-visible/activity-header:text-token-foreground transition-transform duration-300 rotate-90"
    : "icon-2xs shrink-0 text-token-input-placeholder-foreground opacity-0 group-hover/activity-header:opacity-100 group-hover/activity-header:text-token-foreground group-focus-visible/activity-header:opacity-100 group-focus-visible/activity-header:text-token-foreground transition-transform duration-300";
  const tag = hasButtonHeader ? "button" : "div";
  const toggleAttrs = hasBody
    ? ` type="button" aria-expanded="${expanded}" data-disclosure-toggle="${escapeAttr(key)}"`
    : buttonLike
      ? ' type="button" aria-expanded="false"'
      : "";
  const labelClass = wrapLabel ? "min-w-0 flex-1 whitespace-normal break-words" : "min-w-0 flex-1 truncate";
  return `
                  <div class="min-w-0 text-size-chat relative overflow-visible py-0"${seqAttrs}>
                    <div class="flex min-w-0 flex-col">
                      <${tag}${toggleAttrs} class="group/activity-header inline-flex min-w-0 max-w-full self-start items-center gap-1.5 p-0 text-left${hasButtonHeader ? " cursor-interaction" : ""}">
                        <span class="text-size-chat flex min-w-0 shrink items-center gap-1.5 truncate">
                          <span class="${leadingColorClass} flex min-w-0 max-w-full items-center truncate shrink overflow-hidden [mask-image:linear-gradient(to_right,black_calc(100%_-_0.25rem),transparent)] [mask-repeat:no-repeat] pr-1 group-hover/activity-header:text-token-foreground">
                            <span class="inline-flex max-w-full min-w-0 items-center gap-1.5 overflow-hidden">
                              ${iconName ? icons.svg(iconName, `icon-xs shrink-0 ${iconColorClass}`) : '<span class="codex-turn-activity-icon-spacer" aria-hidden="true"></span>'}
                              <span class="${labelClass}">${formatInlineCodeText(label)}</span>
                              ${preview ? `<span class="min-w-0 truncate text-token-conversation-summary-trailing group-hover/activity-header:text-token-foreground">${formatInlineCodeText(preview)}</span>` : ""}
                              ${statusText}
                            </span>
                          </span>
                        </span>
                      ${hasButtonHeader ? icons.svg("chevronRight", chevronClass) : ""}
                      </${tag}>
                      ${hasBody ? renderDisclosureBody(expanded, body, bodyOuterClass, bodyInnerClass, key) : ""}
                    </div>
                  </div>`;
}

function renderToolCallExtraArgs(args) {
  const extra = Object.entries(args || {}).filter(([key]) => !["cmd", "command", "workdir", "cwd"].includes(key));
  if (!extra.length) return "";
  return renderToolJsonBlock(JSON.stringify(Object.fromEntries(extra), null, 2));
}

function renderToolJsonBlock(value) {
  if (!String(value || "").trim()) return "";
  return `
                      <pre class="[&_*]:text-token-non-assistant-body-descendant bg-token-input-background text-token-description-foreground/80 max-h-48 overflow-auto whitespace-pre-wrap rounded-md px-3 py-2 text-size-chat">${escapeHTML(value)}</pre>`;
}

function renderToolOutputOnlyBlock(output) {
  return renderShellContentBlock({ command: "", output, isInProgress: false, surface: "plain" });
}

function renderShellCommandBlock({ command, workdir, output, status, outputEvent }) {
  const isInProgress = isRunningShellStatus(status);
  return `
                      <div class="group flex flex-col overflow-hidden rounded-lg border border-token-input-background bg-token-text-code-block-background text-token-text-primary">
                        ${renderShellContentBlock({ command, output, isInProgress })}
                        ${renderShellFooter({ isInProgress, status, outputEvent })}
                      </div>`;
}

function renderShellContentBlock({ command, output, isInProgress = false, surface = "default" }) {
  const displayCommand = shellDisplayCommand(command);
  const shellName = shellNameForCommand(displayCommand);
  const hasOutput = /\S/.test(output || "");
  const outputText = hasOutput ? output : isInProgress ? "" : "No output";
  const commandBlock = displayCommand.trim()
    ? `
                            <div class="px-2 pt-2">
                              <div class="group/command relative pr-6">
                                <div class="cursor-interaction" role="button" tabindex="0">
                                  <code class="text-size-chat-sm text-token-description-foreground whitespace-pre-wrap break-words font-vscode-editor line-clamp-2">$ ${escapeHTML(displayCommand)}</code>
                                </div>
                              </div>
                            </div>`
    : "";
  const shellHeader = surface === "plain"
    ? ""
    : `
                            <div class="flex items-center justify-between gap-2 px-2 py-1 font-sans text-sm text-token-description-foreground select-none">
                              <span>${escapeHTML(shellName)}</span>
                            </div>`;
  return `
                        <div class="flex flex-col overflow-clip rounded-none border-none">
                          ${shellHeader}
                          <div class="relative overflow-hidden">
                            <div class="relative">
                              ${commandBlock}
                              <div class="group/output relative min-h-[1.25rem] pr-0">
                                <div class="vertical-scroll-fade-mask max-h-[140px] [--edge-fade-distance:2rem] box-border flex flex-col-reverse overflow-x-auto overflow-y-auto whitespace-pre font-vscode-editor font-medium [animation-direction:reverse] text-token-description-foreground text-size-chat-sm p-2">
                                  <code class="text-token-description-foreground">${escapeHTML(outputText)}</code>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>`;
}

function renderShellFooter({ isInProgress, status, outputEvent }) {
  if (isInProgress) return '<div class="text-size-chat px-2.5 pt-0.5 pb-1"></div>';
  if (isInterruptedStatus(status, outputEvent)) {
    return `
                        <div class="text-size-chat flex items-center gap-2 px-2.5 pt-0.5 pb-1 text-token-input-placeholder-foreground">
                          <span class="ml-auto">Stopped</span>
                        </div>`;
  }
  const exitCode = shellExitCode(outputEvent);
  const success = exitCode == null ? !isFailureStatus(status, outputEvent) : exitCode === 0;
  const content = success
    ? `<span class="ml-auto flex items-center gap-1">${icons.svg("check17", "icon-xxs")}<span>Success</span></span>`
    : `<span class="ml-auto">Exit code ${escapeHTML(String(exitCode ?? "unknown"))}</span>`;
  return `
                        <div class="text-size-chat flex items-center gap-2 px-2.5 pt-0.5 pb-1 text-token-input-placeholder-foreground">
                          ${content}
                        </div>`;
}

function shellDisplayCommand(command) {
  const raw = String(command || "").trim();
  if (!raw) return "";
  const unquoted = stripOuterShellQuotes(raw.replace(/^\$\s+/, ""));
  const shellMatch = unquoted.match(/^(?:\/bin\/zsh|\/bin\/bash|zsh|bash)\s+-lc\s+([\s\S]+)$/);
  if (shellMatch) return stripOuterShellQuotes(shellMatch[1] || "").trim();
  return unquoted;
}

function stripOuterShellQuotes(value) {
  let text = String(value || "").trim();
  let changed = true;
  while (changed) {
    changed = false;
    if (text.startsWith("$'") && text.endsWith("'")) {
      text = text.slice(2, -1).replace(/\\'/g, "'");
      changed = true;
    } else if ((text.startsWith("'") && text.endsWith("'")) || (text.startsWith('"') && text.endsWith('"'))) {
      text = text.slice(1, -1).replace(/'"'"'/g, "'").replace(/\\"/g, '"').trim();
      changed = true;
    }
  }
  return text.replace(/^["']+/, "").replace(/["']+$/, "").trim();
}

function shellNameForCommand(command) {
  const first = String(command || "").trim().match(/^(['"])?([^'"`\s]+)/)?.[2] || "";
  const name = first.split(/[\\/]/).pop().toLowerCase();
  if (name === "powershell" || name === "pwsh") return "PowerShell";
  if (name === "cmd") return "Command Prompt";
  if (name === "bash") return "Bash";
  if (name === "zsh") return "Zsh";
  if (name === "node" || name === "npm" || name === "pnpm" || name === "yarn") return "Node";
  if (name === "python" || name === "python3") return "Python";
  return "Shell";
}

function shellExitCode(outputEvent) {
  const data = outputEvent?.data && typeof outputEvent.data === "object" ? outputEvent.data : {};
  const candidates = [
    data.exitCode,
    data.exit_code,
    data.code,
    outputEvent?.exitCode,
    outputEvent?.exit_code,
  ];
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null || candidate === "") continue;
    const parsed = Number(candidate);
    if (Number.isFinite(parsed)) return parsed;
  }
  const text = String(data.output || outputEvent?.text || "");
  const match = text.match(/(?:exit(?:ed)?\s+with\s+code|exit\s+code)\s+(-?\d+)/i);
  return match ? Number(match[1]) : null;
}

function isInterruptedStatus(status, outputEvent) {
  const value = String(status || outputEvent?.status || outputEvent?.data?.status || "").toLowerCase();
  return value === "interrupted" || value === "cancelled" || value === "canceled" || value === "stopped";
}

function isFailureStatus(status, outputEvent) {
  const value = String(status || outputEvent?.status || outputEvent?.data?.status || "").toLowerCase();
  return value === "failed" || value === "error";
}

function isRunningShellStatus(status) {
  return ["pending", "running", "active", "starting"].includes(String(status || "").toLowerCase());
}

function hasShellArgs(item) {
  const args = activitySummary.detailArgs(item) || {};
  return Boolean(String(args.cmd || args.command || args.workdir || args.cwd || "").trim());
}

function toolArgumentsPreview(args) {
  const entries = Object.entries(args || {});
  if (!entries.length) return "";
  return entries.slice(0, 2).map(([key, value]) => `${key}: ${String(value)}`).join(", ");
}

function renderErrorTurn(event, index) {
  return renderTurnContainer(
    index,
    "assistant",
    `<div class="text-size-chat text-token-text-secondary">${renderErrorActivity(event, `error:${turnKeyFromEvent(event, index)}`)}</div>`,
    undefined,
    event,
  );
}

function renderErrorActivity(event, key) {
  const data = event?.data && typeof event.data === "object" ? event.data : {};
  const detail = String(event?.text || data.message || data.error || "Error").trim();
  const body = detail ? renderToolOutputOnlyBlock(detail) : "";
  return renderToolActivityDisclosure({
    body,
    expanded: disclosureExpanded(key, false),
    iconName: "closeCircle",
    key,
    label: "Error",
    status: "failed",
    buttonLike: true,
    tone: "error",
    seqAttrs: eventSeqAttrs(event),
  });
}

function renderActivity(event, index) {
  const turnKey = turnKeyFromEvent(event, index);
  return `
    <div class="[&_[data-virtualized-turn-content]]:[content-visibility:visible]" data-turn-key="${escapeAttr(turnKey)}">
      <div class="flex flex-col gap-0">
        <div class="flex flex-col"><div class="scroll-mt-4"></div></div>
        <div aria-hidden="true" class="w-full" style="height: var(--conversation-tool-assistant-gap, 8px);"></div>
        <div class="flex flex-col">
          <div class="text-size-chat text-token-text-secondary"${eventSeqAttrs(event)}>
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
    if ((event.kind || "") === "tool_call" && hasShellArgs(event)) {
      return renderToolCallActivityDetail(
        { event, kind: "tool_call", codexActivityItem: true },
        activityIcon(event),
        activitySummary.detailLabel(event),
        activitySummary.detailStatus(event),
        `running-tool:${turnKeyFromEvent(event, event.seq || 0)}`,
      );
    }
    return renderRunningActivityDisclosure(event);
  }

  const label = activityLabel(event);
  const iconName = activityIcon(event);
  return `
    <div class="min-w-0 text-size-chat relative overflow-visible py-0"${eventSeqAttrs(event)}>
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
    <div class="min-w-0 text-size-chat py-0"${eventSeqAttrs(event)}>
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
    <div class="min-w-0 text-size-chat relative overflow-visible py-0"${eventSeqAttrs(event)}>
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
            ${items.map((item) => `<div class="text-size-chat text-token-text-secondary">${formatInlineCodeText(toolSummaryItemText(item))}</div>`).join("")}
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
  const list = items.map((item) => `<li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">${formatInlineCodeText(toolSummaryItemText(item))}</li>`).join("");
  return `
    <div class="group flex min-w-0 flex-col gap-2">
      <div data-selected-text-overlay-target="codex-tool-summary-${index}" class="[&>*:first-child]:mt-0 _markdownContent_lzkx4_60 [&>*:last-child]:mb-0 [&>ol:first-child]:mt-0 [&>ul:first-child]:mt-0"><ul class="_markdownText_lzkx4_86 _list_lzkx4_133 _unorderedList_lzkx4_147">${list}</ul></div>
    </div>`;
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
      <div class="min-w-0 electron:hidden">${renderComposerSurface("随心输入", false)}</div>
    </div>`;
}

function renderThreadComposer() {
  return `
    <div data-thread-scroll-footer="true" class="codex-thread-footer w-full">
      <div class="codex-thread-footer-fade pointer-events-none absolute inset-x-0 bottom-0 z-0 flex h-full w-full justify-center pt-4">
        <div class="z-0 h-full w-full bg-gradient-to-t from-token-main-surface-primary via-token-main-surface-primary extension:from-token-bg-primary extension:via-token-bg-primary"></div>
      </div>
      <div data-pip-obstacle="thread-footer" class="codex-thread-footer-content relative z-10 flex flex-col mx-auto w-full max-w-(--thread-content-max-width) px-toolbar">
        <div class="flex flex-col" data-thread-find-composer="true">
          <div class="relative h-0">
            <button class="cursor-interaction absolute z-30 flex h-8 w-8 translate-x-1/2 items-center justify-center rounded-full border border-token-border-default bg-token-main-surface-primary bg-clip-padding text-token-text-secondary transition-opacity duration-150 ease-in-out end-1/2 print:hidden pointer-events-none opacity-0 bottom-[calc(100%+6*var(--spacing))]" aria-hidden="true" aria-label="Scroll to bottom" type="button" tabindex="-1">${icons.svg("send", "icon rotate-180 text-token-text-primary")}</button>
          </div>
          <div class="flex flex-col gap-2"><div class="codex-composer-shell min-w-0">${renderComposerSurface("要求后续变更", true)}</div></div>
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
    <div class="codex-composer-surface relative flex w-full min-w-0 flex-col gap-2" data-codex-composer-surface>
      <div id="above-composer-portal" data-above-composer-portal="true" class="relative px-5 empty:hidden"></div>
      <div id="above-composer-queue-portal" data-above-composer-queue-portal="true" class="relative px-5 empty:hidden"></div>
      <div class="codex-composer-card-wrap relative">
        ${state.popover === "plus" ? renderPlusOverlay() : '<div class="@container pointer-events-none absolute inset-x-0 bottom-full z-20 mb-2 flex justify-center"></div>'}
        <div class="codex-composer-card composer-surface-chrome relative flex flex-col bg-token-input-background/90 backdrop-blur-lg electron:dark:bg-token-dropdown-background _multilineSurface_1u8sk_2">
          <div class="codex-composer-card-inner relative z-10 flex min-h-0 flex-1 flex-col">
            <div class="codex-composer-attachments _attachmentsDefault_1u8sk_2"></div>
            <div class="codex-composer-editor-viewport mb-1 flex-grow overflow-y-auto px-3">
              <div class="codex-composer-editor text-size-chat [&_.ProseMirror]:focus-visible:outline-none text-token-foreground h-auto max-h-[25dvh] overflow-y-auto [&_.ProseMirror]:h-auto [&_.ProseMirror]:min-h-[2rem] [&_.ProseMirror]:resize-none [&_.ProseMirror_p]:m-0 text-base [&_.ProseMirror]:leading-5">
                <div contenteditable="true" spellcheck="true" translate="no" class="${proseMirrorClass}" data-virtualkeyboard="true" data-placeholder="${escapeAttr(placeholder)}" data-codex-empty="true" style="font-size: var(--codex-chat-font-size); height: auto; resize: none; min-height: 2.75rem;" data-codex-composer="true"><p><br class="ProseMirror-trailingBreak"></p></div>
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
  const plusWrapperState = plusState === "open" ? "delayed-open" : "closed";
  return `
    <div class="codex-composer-footer _footer_1u8sk_2 grid grid-cols-[minmax(0,auto)_auto_minmax(0,1fr)] items-center gap-[5px] select-none mb-2 px-2">
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
          <button type="button" class="codex-composer-send-button codex-send-disabled cursor-interaction size-token-button-composer flex items-center justify-center rounded-full focus-visible:outline-2 bg-token-foreground p-0.5 focus-visible:outline-token-button-background" data-state="closed" data-action="send">${icons.svg("send", "icon-sm text-token-dropdown-background")}</button>
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
    <div class="codex-composer-external-footer select-none _footer_z984f_2 flex flex-nowrap items-center gap-1 overflow-hidden pr-2 flex-wrap gap-2 overflow-visible pl-2">
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
  send.classList.toggle("codex-send-ready", hasText);
  send.classList.toggle("codex-send-disabled", !hasText);
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
      const selected = state.sessions.find((session) => session.id === state.activeSessionId);
      if (selected) return selected;
      if (state.view === "thread" && state.activeSessionId) {
        return { id: state.activeSessionId, title: "任务" };
      }
      return state.sessions[0];
    }

    function activeNode() {
      return (state.nodes || []).find((node) => node.id === state.nodeId) || (state.nodes || [])[0] || null;
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
