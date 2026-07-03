"use strict";

(function bootstrapCodexPanel() {
  const icons = window.CodexIcons;
  const panel = document.getElementById("codexPanel");
  if (!panel || !icons) return;

  const shadowStyleHrefs = [
    "assets/code-server-codicon.css",
    "assets/chatgpt/app-main-DH0Qggoi.css",
    "assets/chatgpt/app-shell-DJDX7Pvr.css",
    "assets/chatgpt/at-mention-list-BF8TOyej.css",
    "assets/chatgpt/cmdk-pBm4kpmV.css",
    "assets/chatgpt/composer-CXInBfIq.css",
    "assets/chatgpt/composer-footer-D2K4qkyA.css",
    "assets/chatgpt/composer-top-menu-chrome-EBEHrbNH.css",
    "assets/chatgpt/dialog-layout-sS9Dm_y9.css",
    "assets/chatgpt/diff-unified-updTK7TW.css",
    "assets/chatgpt/dropdown-9F1MU8ql.css",
    "assets/chatgpt/local-conversation-turn-CGBrbw6f.css",
    "assets/chatgpt/local-task-row-Bj9zvK4d.css",
    "assets/chatgpt/markdown-DmSBSKzD.css",
    "assets/chatgpt/progression-donut-BI3OQbB8.css",
    "assets/chatgpt/prompt-editor-BuS6Xjko.css",
    "assets/chatgpt/prosemirror-ptHiDCW_.css",
    "assets/chatgpt/scroll-to-bottom-buton-H4NGgmRi.css",
    "assets/chatgpt/thinking-shimmer-BhOGlSiR.css",
    "assets/chatgpt/thread-page-bottom-panel-state-BrqwKW_G.css",
    "assets/chatgpt/thread-side-panel-tabs-CYswclfQ.css",
    "assets/chatgpt/worktree-init-tool-activities-CxuoHau6.css",
    "assets/chatgpt/codex-webview-vars.css",
    "codex-panel-shadow.css?v=20260703-attachment-inset",
  ];

  const mount = createPanelMount(panel);
  const fixtureMode = new URLSearchParams(window.location.search).get("codexFixture") || "";
  const useDynamicFixture = fixtureMode === "dynamic";
  const useReferenceFixture = fixtureMode === "reference";

  const state = {
    view: "list",
    nodeId: window.localStorage.getItem("codex-web:node-id") || "",
    apiAvailable: false,
    popover: "",
    sessions: [],
    activeSessionId: "",
    eventsBySession: new Map(),
    eventSource: null,
  };

  const USER_ATTACHMENT_PLACEHOLDER = "assets/reference-user-attachment.png";
  let referenceAttachmentSrc = USER_ATTACHMENT_PLACEHOLDER;
  let samples = createSampleData();
  let initialized = false;
  let shimmerCleanups = [];

  function createPanelMount(host) {
    const shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
    shadow.replaceChildren();

    for (const href of shadowStyleHrefs) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      shadow.appendChild(link);
    }

    const root = document.createElement("div");
    root.id = "root";
    root.dir = "ltr";
    root.setAttribute("data-codex-window-type", "extension");
    root.setAttribute("data-window-type", "extension");
    root.setAttribute("data-codex-os", "win32");
    root.setAttribute("data-codex-window-chrome", "native");
    shadow.appendChild(root);

    return { root, shadow };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    void init();
  }

  async function init() {
    if (initialized) return;
    initialized = true;
    mount.root.addEventListener("click", handleClick);
    mount.root.addEventListener("input", handleInput);
    referenceAttachmentSrc = await loadReferenceAttachmentDataURL();
    samples = createSampleData();
    if (useDynamicFixture) {
      useSampleSessions(false);
      state.activeSessionId = "dynamic-running";
      state.view = "thread";
      render();
      return;
    }
    if (useReferenceFixture) {
      useSampleSessions(false);
      render();
      return;
    }
    await loadNodes();
    await loadSessions();
    render();
  }

  async function loadReferenceAttachmentDataURL() {
    try {
      const response = await fetch(USER_ATTACHMENT_PLACEHOLDER);
      if (!response.ok) return USER_ATTACHMENT_PLACEHOLDER;
      const blob = await response.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => resolve(String(reader.result || USER_ATTACHMENT_PLACEHOLDER)), { once: true });
        reader.addEventListener("error", () => resolve(USER_ATTACHMENT_PLACEHOLDER), { once: true });
        reader.readAsDataURL(blob);
      });
    } catch {
      return USER_ATTACHMENT_PLACEHOLDER;
    }
  }

  async function loadNodes() {
    try {
      const payload = await fetchJSON("/api/nodes");
      const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
      const saved = nodes.find((node) => node.id === state.nodeId && node.online);
      const selected = saved || nodes.find((node) => node.online) || nodes[0];
      if (selected?.id) {
        state.nodeId = selected.id;
        window.localStorage.setItem("codex-web:node-id", state.nodeId);
      }
    } catch {
      state.apiAvailable = false;
    }
  }

  async function loadSessions() {
    if (!state.nodeId) {
      useSampleSessions(false);
      return;
    }
    try {
      const payload = await fetchJSON(`/api/sessions?nodeId=${encodeURIComponent(state.nodeId)}`);
      const sessions = normalizeSessions(payload.sessions);
      state.sessions = sessions.length ? sessions : samples.sessions.slice();
      if (!sessions.length) state.eventsBySession = new Map(samples.eventsBySession);
      state.apiAvailable = sessions.length > 0;
    } catch {
      useSampleSessions(false);
    }
  }

  function useSampleSessions(apiAvailable) {
    state.sessions = samples.sessions.slice();
    state.eventsBySession = new Map(samples.eventsBySession);
    state.apiAvailable = apiAvailable;
  }

  async function openSession(sessionID) {
    state.activeSessionId = sessionID;
    state.view = "thread";
    state.popover = "";
    await loadEvents(sessionID);
    subscribeSession(sessionID);
    render();
  }

  async function loadEvents(sessionID) {
    if (!state.apiAvailable) return;
    try {
      const payload = await fetchJSON(`/api/sessions/${encodeURIComponent(sessionID)}/events?nodeId=${encodeURIComponent(state.nodeId)}`);
      const events = normalizeEvents(payload.events);
      if (events.length) state.eventsBySession.set(sessionID, events);
    } catch {
      if (!state.eventsBySession.has(sessionID)) {
        state.eventsBySession.set(sessionID, samples.eventsBySession.get("thread-reference") || []);
      }
    }
  }

  function subscribeSession(sessionID) {
    if (state.eventSource) {
      state.eventSource.close();
      state.eventSource = null;
    }
    if (!state.apiAvailable) return;
    const qs = new URLSearchParams({ sessionId: sessionID, nodeId: state.nodeId });
    const source = new EventSource(`/api/sessions/events?${qs.toString()}`);
    source.onmessage = (event) => {
      try {
        const incoming = normalizeEvent(JSON.parse(event.data));
        const events = state.eventsBySession.get(sessionID) || [];
        if (!events.some((item) => item.seq === incoming.seq && incoming.seq != null)) {
          events.push(incoming);
          state.eventsBySession.set(sessionID, events);
          if (state.view === "thread" && state.activeSessionId === sessionID) render();
        }
      } catch {
        // Keep the stream alive if one row is malformed.
      }
    };
    source.onerror = () => {
      source.close();
      if (state.eventSource === source) state.eventSource = null;
    };
    state.eventSource = source;
  }

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
    const events = state.eventsBySession.get(sessionID) || samples.eventsBySession.get("thread-reference") || [];
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
            <div><div class="text-token-description-foreground text-sm leading-4 empty:hidden tabular-nums overflow-visible truncate text-right group-focus-within:hidden group-hover:hidden shrink-0">${escapeHTML(session.timeLabel || "")}</div></div>
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

  function renderTurnShell(index, role, content, afterContentOverride, eventForKey) {
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
    return renderTurnShell(index, "user", renderUserContent(event), renderUserTurnAfterContent(followups, index, event), event);
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
    const src = attachment?.src || USER_ATTACHMENT_PLACEHOLDER;
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
    return renderTurnShell(index, "assistant", renderAssistantContent(event, index, isError), undefined, event);
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
    const files = Array.isArray(card?.files) && card.files.length ? card.files : ["frontend/src/app.js", "frontend/src/styles.css", "frontend/src/codex-panel.js"];
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
    return renderTurnShell(index, "tool-summary", renderToolSummaryContent(event, index), undefined, event);
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
                    <div contenteditable="true" spellcheck="true" translate="no" class="${proseMirrorClass}" data-virtualkeyboard="true" style="font-size: var(--codex-chat-font-size); height: auto; resize: none; min-height: 2.75rem;" data-codex-composer="true"><p data-placeholder="${escapeAttr(placeholder)}" class="placeholder"><br class="ProseMirror-trailingBreak"></p></div>
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

  function handleClick(event) {
    const popoverButton = event.target.closest("[data-popover]");
    const action = event.target.closest("[data-action]")?.dataset.action;
    const sessionRow = event.target.closest("[data-codex-session-id]");

    if (popoverButton) {
      const name = popoverButton.dataset.popover;
      state.popover = state.popover === name ? "" : name;
      render();
      return;
    }

    if (action === "back" || action === "new-chat") {
      state.view = "list";
      state.activeSessionId = "";
      state.popover = "";
      if (state.eventSource) state.eventSource.close();
      state.eventSource = null;
      render();
      return;
    }

    if (action === "send") {
      void submitComposer();
      return;
    }

    if (sessionRow && !event.target.closest("[data-codex-archive-button]")) {
      void openSession(sessionRow.dataset.codexSessionId);
      return;
    }

    if (state.popover && !event.target.closest("[data-radix-popper-content-wrapper], [data-composer-overlay-floating-ui]")) {
      state.popover = "";
      render();
    }
  }

  function handleInput(event) {
    if (event.target.matches("[data-codex-composer]")) syncComposerState();
  }

  async function submitComposer() {
    const input = mount.root.querySelector("[data-codex-composer]");
    const prompt = composerText(input);
    if (!prompt) return;
    clearComposer(input);
    syncComposerState();

    if (state.view === "thread" && state.activeSessionId) {
      appendLocalEvent(state.activeSessionId, { kind: "user_message", text: prompt });
      render();
      if (state.apiAvailable) {
        try {
          await fetchJSON(`/api/sessions/${encodeURIComponent(state.activeSessionId)}/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nodeId: state.nodeId, prompt }),
          });
        } catch (error) {
          appendLocalEvent(state.activeSessionId, { kind: "error", text: error.message });
          render();
        }
      } else {
        appendLocalEvent(state.activeSessionId, { kind: "turn_started", text: "正在思考" });
        appendLocalEvent(state.activeSessionId, { kind: "assistant_message", text: "我会按当前参考样式继续处理这个请求。", time: new Date().toISOString() });
        render();
      }
      return;
    }

    if (state.apiAvailable) {
      try {
        const payload = await fetchJSON("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodeId: state.nodeId, prompt }),
        });
        const session = normalizeSession(payload.session);
        if (session?.id) {
          state.sessions.unshift(session);
          state.eventsBySession.set(session.id, [{ kind: "user_message", text: prompt, time: new Date().toISOString() }]);
          await openSession(session.id);
        }
      } catch (error) {
        createLocalSession(prompt, error.message);
      }
    } else {
      createLocalSession(prompt);
    }
  }

  function createLocalSession(prompt, errorText = "") {
    const id = `local-${Date.now()}`;
    const session = {
      id,
      title: trimTitle(prompt),
      status: "idle",
      updatedAt: new Date().toISOString(),
      timeLabel: "刚刚",
    };
    state.sessions.unshift(session);
    state.eventsBySession.set(id, [
      { kind: "user_message", text: prompt, time: new Date().toISOString(), seq: 1 },
      errorText ? { kind: "error", text: errorText, time: new Date().toISOString(), seq: 2 } : { kind: "assistant_message", text: "本地样式预览会话已创建。", time: new Date().toISOString(), seq: 2 },
    ]);
    void openSession(id);
  }

  function appendLocalEvent(sessionID, partial) {
    const events = state.eventsBySession.get(sessionID) || [];
    events.push({ ...partial, seq: events.length + 1, time: new Date().toISOString() });
    state.eventsBySession.set(sessionID, events);
  }

  function syncComposerState() {
    const input = mount.root.querySelector("[data-codex-composer]");
    const send = mount.root.querySelector("[data-action='send']");
    if (!input || !send) return;
    const hasText = Boolean(composerText(input));
    send.classList.toggle("opacity-50", !hasText);
    send.classList.toggle("codex-send-ready", hasText);
  }

  function composerText(input) {
    if (!input) return "";
    const clone = input.cloneNode(true);
    clone.querySelectorAll(".placeholder").forEach((node) => node.remove());
    return (clone.innerText || "").trim();
  }

  function clearComposer(input) {
    if (!input) return;
    const placeholder = input.dataset.placeholder || "";
    input.innerHTML = `<p data-placeholder="${escapeAttr(placeholder)}" class="placeholder"><br class="ProseMirror-trailingBreak"></p>`;
  }

  function activeSession() {
    return state.sessions.find((session) => session.id === state.activeSessionId) || state.sessions[0];
  }

  async function fetchJSON(url, init) {
    const response = await fetch(url, init);
    if (!response.ok) {
      let message = `${response.status} ${response.statusText}`;
      try {
        const body = await response.json();
        message = body.error || message;
      } catch {
        // Keep response status message.
      }
      throw new Error(message);
    }
    return response.json();
  }

  function normalizeSessions(value) {
    return Array.isArray(value)
      ? value.map(normalizeSession).filter(Boolean).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      : [];
  }

  function normalizeSession(value) {
    if (!value || typeof value !== "object") return null;
    const updatedAt = value.updatedAt || value.UpdatedAt || value.createdAt || value.CreatedAt || new Date().toISOString();
    return {
      id: String(value.id || value.ID || ""),
      title: String(value.title || value.Title || "New session"),
      status: String(value.status || value.Status || "idle"),
      updatedAt,
      timeLabel: relativeTime(updatedAt),
    };
  }

  function normalizeEvents(value) {
    return Array.isArray(value) ? value.map(normalizeEvent).filter(Boolean) : [];
  }

  function normalizeEvent(value) {
    if (!value || typeof value !== "object") return null;
    return {
      sessionId: value.sessionId || value.SessionID || value.sessionID || "",
      seq: value.seq || value.Seq || 0,
      time: value.time || value.Time || new Date().toISOString(),
      kind: value.kind || value.Kind || "assistant_message",
      text: value.text || value.Text || "",
      items: value.items || value.Items || null,
      data: value.data || value.Data || null,
    };
  }

  function activityLabel(event) {
    switch (event.kind) {
      case "turn_started":
      case "reasoning":
        return event.text || "正在思考";
      case "tool_call":
        return summarizeToolActivity(event.text || "正在编辑文件");
      case "stdout":
        return event.text || "已运行命令";
      case "stderr":
        return event.text || "命令输出";
      default:
        return event.text || "正在思考";
    }
  }

  function activityIcon(event) {
    if (event.kind === "tool_call") return "editFile";
    return "";
  }

  function isActivityPending(event) {
    const status = String(event.status || event.data?.status || "").toLowerCase();
    if (["pending", "running", "active", "starting"].includes(status)) return true;
    return event.kind === "turn_started" || event.kind === "reasoning";
  }

  function summarizeToolActivity(text) {
    const value = String(text || "");
    if (/创建/.test(value)) return "已创建 1 个文件";
    if (/编辑|修改|写入/.test(value)) return "已编辑 1 个文件";
    return value || "已编辑 1 个文件";
  }

  function assistantTextFromData(data) {
    if (!data || typeof data !== "object") return "";
    const item = data.item;
    if (item && typeof item === "object") return String(item.text || item.message || "");
    return String(data.text || data.message || "");
  }

  function formatText(text) {
    const value = String(text || "");
    if (!value) return "";
    const chunks = [];
    const pattern = /```(?:[a-zA-Z0-9_-]+)?\n?([\s\S]*?)```/g;
    let cursor = 0;
    let match;
    while ((match = pattern.exec(value))) {
      if (match.index > cursor) chunks.push(formatTextBlock(value.slice(cursor, match.index)));
      chunks.push(`<pre class="_markdownText_lzkx4_86">${escapeHTML(match[1].trim())}</pre>`);
      cursor = match.index + match[0].length;
    }
    if (cursor < value.length) chunks.push(formatTextBlock(value.slice(cursor)));
    return chunks.join("");
  }

  function formatTextBlock(text) {
    return String(text || "")
      .split(/\n{2,}/)
      .map((group) => group.trim())
      .filter(Boolean)
      .map((group) => {
        const lines = group.split("\n").map((line) => line.trim()).filter(Boolean);
        if (lines.length && lines.every((line) => /^[-*]\s+/.test(line))) {
          return `<ul class="_markdownText_lzkx4_86 _list_lzkx4_133 _unorderedList_lzkx4_147">${lines.map((line) => `<li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">${formatInlineText(line.replace(/^[-*]\s+/, ""))}</li>`).join("")}</ul>`;
        }
        return `<p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">${lines.map(formatInlineText).join("<br>")}</p>`;
      })
      .join("");
  }

  function formatInlineText(text) {
    return String(text || "").split(/(`[^`]+`)/g).map((part) => {
      if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
        return `<span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">${escapeHTML(part.slice(1, -1))}</span>`;
      }
      return escapeHTML(part);
    }).join("");
  }

  function formatUserText(text) {
    return `<span>${escapeHTML(String(text || ""))}</span>`;
  }

  function formatInlineCodeText(text) {
    const value = String(text || "");
    if (!value) return "";
    const commandPattern = /((?:node|go|git|systemctl|\.\/build-all\.sh|GET)\s[^,\n。]*)/g;
    let cursor = 0;
    const pieces = [];
    let match;
    while ((match = commandPattern.exec(value))) {
      if (match.index > cursor) pieces.push(escapeHTML(value.slice(cursor, match.index)));
      pieces.push(`<span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">${escapeHTML(match[1].trim())}</span>`);
      cursor = match.index + match[1].length;
    }
    if (cursor < value.length) pieces.push(escapeHTML(value.slice(cursor)));
    return pieces.join("");
  }

  function timeFromEvent(event) {
    const date = event.time ? new Date(event.time) : null;
    if (!date || Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function relativeTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return "刚刚";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} 分`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} 小时`;
    return `${Math.floor(hours / 24)} 天`;
  }

  function trimTitle(text) {
    const value = text.replace(/\s+/g, " ").trim();
    return value.length > 70 ? `${value.slice(0, 68)}…` : value || "New session";
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    })[char]);
  }

  function escapeAttr(value) {
    return escapeHTML(value);
  }

  function summaryFollowupHTML() {
    return `
      <p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">对，你这个判断是对的。现在继续在 Linux VNC 里靠字体 fallback 和截图猜测，确实不适合做“完全一致”的视觉复刻。</p>
      <p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">更稳的做法是：</p>
      <ol class="_markdownText_lzkx4_86 _list_lzkx4_133 _orderedList_lzkx4_159" start="1">
        <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">在你的 Windows 浏览器里打开真实 code-server + ChatGPT/Codex 扩展界面。</li>
        <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">用 Playwright 或 DevTools 抓目标区域的：
          <ul class="_markdownText_lzkx4_86 _list_lzkx4_133 _unorderedList_lzkx4_147">
            <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">DOM 结构</li>
            <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">className</li>
            <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">CSS 文件</li>
            <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">computed styles</li>
            <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">字体实际解析结果</li>
            <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">元素尺寸、间距、颜色、border-radius、box-shadow</li>
          </ul>
        </li>
        <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">把抓取结果保存成文件给我，或让我直接在 Windows 环境里操作。</li>
        <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">我只按抓取结果实现，不再凭 Linux VNC 的偏差截图调样式。</li>
      </ol>
      <p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">我刚才在 Linux 里加的 <span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">Segoe UI</span> alias 只能让截图环境更接近一点，但它不是根本方案。真正要完全对齐，你这边的 Windows Chrome 环境才是准基线。</p>`;
  }

  function resetFollowupHTML() {
    return `
      <p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">是的，当前这套前端试验实现不值得继续在上面修。</p>
      <p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">但现在不需要 <span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">reset + push</span>。</p>
      <ul class="_markdownText_lzkx4_86 _list_lzkx4_133 _unorderedList_lzkx4_147">
        <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168"><span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">main</span> 和 <span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">origin/main</span>、<span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">HEAD</span> 已经一致</li>
        <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">现在显示偏差大的内容只是本地未提交改动</li>
        <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">所以 <span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">push</span> 没意义</li>
      </ul>
      <p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">建议处理方式：</p>
      <ol class="_markdownText_lzkx4_86 _list_lzkx4_133 _orderedList_lzkx4_159">
        <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168"><p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">先丢弃当前前端试验改动：</p>
          <ul class="_markdownText_lzkx4_86 _list_lzkx4_133 _unorderedList_lzkx4_147">
            <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168"><span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">frontend/src/app.js</span></li>
            <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168"><span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">frontend/src/index.html</span></li>
            <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168"><span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">frontend/src/styles.css</span></li>
            <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">新增的 OpenAI 字体/图标资源</li>
          </ul>
        </li>
        <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168"><p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">后端认证删除改动要单独确认：</p>
          <ul class="_markdownText_lzkx4_86 _list_lzkx4_133 _unorderedList_lzkx4_147">
            <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">你之前明确说现在完全不需要认证</li>
            <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">所以不应该直接 <span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">git reset</span></li>
          </ul>
        </li>
        <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168"><p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">清理后重新 build/restart。</p></li>
      </ol>
      <p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">我建议不要 <span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">git reset --hard</span> 整仓库。</p>`;
  }

  function cleanedFollowupHTML() {
    return `
      <p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">已处理。</p>
      <p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">我只清理了前端试验改动，保留了后端无认证改动。</p>
      <ul class="_markdownText_lzkx4_86 _list_lzkx4_133 _unorderedList_lzkx4_147">
        <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">${inlineMention("config.go")}</li>
        <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">${inlineMention("app.go")}</li>
        <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">${inlineMention("types.go")}</li>
      </ul>
      <p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">验证已完成：<span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">node --check</span>、<span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">go test ./...</span>、<span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">./build-all.sh</span>、<span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">GET /api/nodes</span>。</p>
      <p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">服务状态：active。</p>
      <ul class="_markdownText_lzkx4_86 _list_lzkx4_133 _unorderedList_lzkx4_147">
        <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168"><span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">node --check frontend/src/app.js</span></li>
        <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168"><span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">go test ./...</span> in <span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">backend</span></li>
        <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168"><span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">go test ./...</span> in <span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">agent</span></li>
        <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168"><span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">./build-all.sh</span></li>
        <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168"><span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">systemctl restart</span></li>
        <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168"><span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">GET /</span></li>
        <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168"><span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">GET /api/nodes</span></li>
        <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168"><span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">host-docker-agent</span>、<span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">active</span></li>
      </ul>`;
  }

  function pushedFollowupHTML() {
    return `
      <p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82"><span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">20e38bd</span></p>
      <p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">已提交并推送到 origin/main。</p>
      <p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">最新提交：<span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">feat: remove controller web auth</span></p>
      <p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">确认结果：</p>
      <ul class="_markdownText_lzkx4_86 _list_lzkx4_133 _unorderedList_lzkx4_147">
        <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168"><span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">main</span> 和 <span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">origin/main</span> 一致</li>
        <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">工作区干净</li>
        <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">远端 <span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">refs/heads/main</span> 指向 <span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">20e38bd</span></li>
      </ul>
      <p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">现在重新 <span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">git clone</span> 会直接获取这个版本。</p>`;
  }

  function inlineMention(label) {
    return `<span class="group/inline-mention cursor-pointer" role="button" data-state="closed"><span class="break-words whitespace-normal" data-state="closed"><span class="px-0.5 inline-mention-brand-aware font-medium text-[color:var(--inline-mention-color)] [--inline-mention-color:var(--inline-mention-resolved-base-color,var(--inline-mention-base-color))] [--inline-mention-base-color:color-mix(in_srgb,var(--color-token-text-link-foreground)_80%,var(--color-token-foreground)_20%)] group-hover/inline-mention:underline group-hover/inline-mention:decoration-current group-hover/inline-mention:decoration-dashed group-hover/inline-mention:decoration-[0.5px] group-hover/inline-mention:underline-offset-2 _tableCellFileLink_lzkx4_413"><span class="relative mr-[3px] inline-block h-[1lh] w-4 align-bottom">${icons.svg("editFile", "icon-xs")}</span><span class="min-w-0 break-words">${escapeHTML(label)}</span></span></span></span>`;
  }

  function createSampleData() {
    const now = Date.now();
    const sessions = [
      {
        id: "backup-unarchived",
        title: "备份未归档会话",
        status: "idle",
        updatedAt: new Date(now - 56 * 60 * 1000).toISOString(),
        timeLabel: "56 分",
      },
      {
        id: "thread-reference",
        title: "分析一下codex-web 现在我还有问题,我是想做成这样的,由一个网站统一管理所有服务器的 所以我猜测应该是要拆封出…",
        status: "idle",
        updatedAt: new Date(now - 5 * 24 * 3600 * 1000).toISOString(),
        timeLabel: "5 天",
      },
    ];
    if (useDynamicFixture) {
      sessions.unshift({
        id: "dynamic-running",
        title: "Dynamic running fixture",
        status: "running",
        updatedAt: new Date(now).toISOString(),
        timeLabel: "now",
      });
    }
    const eventsBySession = new Map();
    if (useDynamicFixture) {
      eventsBySession.set("dynamic-running", [
        {
          kind: "user_message",
          text: "\u8bf7\u7ee7\u7eed\u6309\u5b98\u65b9\u6269\u5c55\u7684\u52a8\u6001\u72b6\u6001\u6e32\u67d3",
          turnKey: "dynamic-running-turn",
          time: new Date(now - 3000).toISOString(),
          seq: 1,
        },
        {
          kind: "turn_started",
          status: "running",
          text: "\u6b63\u5728\u601d\u8003",
          turnKey: "dynamic-running-turn",
          contentUnit: 1,
          time: new Date(now - 2000).toISOString(),
          seq: 2,
        },
        {
          kind: "tool_call",
          status: "running",
          text: "\u6b63\u5728\u7f16\u8f91 1 \u4e2a\u6587\u4ef6",
          items: [
            { text: "frontend/src/codex-panel.js" },
            { text: "scripts/audit-codex-dynamic-states.cjs" },
          ],
          turnKey: "dynamic-running-turn",
          contentUnit: 2,
          time: new Date(now - 1000).toISOString(),
          seq: 3,
        },
      ]);
    }
    eventsBySession.set("thread-reference", [
      {
        kind: "user_message",
        text: "  哪里\n",
        attachments: [{ label: "用户附件", src: referenceAttachmentSrc }],
        turnKey: "019f23e7-087b-7b73-8a8c-2a3d5d5b32b5",
        virtualList: { height: "27568.5px", marginTop: "23068px" },
        time: "2026-07-02T17:36:00.000Z",
        seq: 1,
      },
      {
        kind: "assistant_message",
        text: "就在你截图里这一项：\n\n`投放、保存和分享` 右边有个 `>`，点进去，里面会有：\n\n`网页另存为...` / `保存网页为...`\n\n然后保存类型选：\n\n`网页，全部`\n\n如果你要抓更完整的资源，走：\n\n`更多工具` → `开发者工具` → `Network` → 刷新页面 → 右键请求列表 → `Save all as HAR with content`。",
        contentUnit: 1,
        time: "2026-07-02T17:36:10.000Z",
        seq: 2,
      },
      { kind: "user_message", text: "我现在上传了/root/code/codex-web.tar  你可以将它解包,然后看一下我们现在的差异,如果差异较大,那么可以直接reset再实现可能更省事", turnKey: "019f23ea-830d-7410-8437-f627ecc5b9de", time: "2026-07-02T17:39:00.000Z", seq: 3 },
      { kind: "assistant_message", contentUnit: 1, text: "我会先把这个 tar 解到临时目录，不覆盖当前仓库，然后对比前端和服务端差异。只有确认上传版本更接近目标且当前改动确实偏离较大时，才考虑按它回退重做。", time: "2026-07-02T17:39:08.000Z", seq: 4 },
      { kind: "assistant_message", contentUnit: 2, text: "这个 tar 不是源码仓库，而是 Chrome 保存出来的两份页面：会话列表和会话内页面，正好可以作为更贴近你本机 Chrome 的样式参考。我先解包并抽取里面的 webview/样式结构。", time: "2026-07-02T17:39:12.000Z", seq: 5 },
      { kind: "assistant_message", contentUnit: 3, text: "已解到 `/tmp/codex-web-upload.Gzq21b`。我会先看两份 `HTML` 和资源里真实的 webview 内容，再和我们 frontend/src 当前实现做结构/样式差异判断。", time: "2026-07-02T17:39:16.000Z", seq: 6 },
      { kind: "assistant_message", contentUnit: 4, text: "初步差异已经很明显：你这份 Chrome 保存页里 webview 的变量是 Windows/Chrome 实际环境，例如 `--vscode-font-family: \"Segoe WPC\", \"Segoe UI\"`，而我们之前用 headless Linux 对照会看到 Ubuntu/system-ui，所以字体和部分控件会自然偏。", time: "2026-07-02T17:39:20.000Z", seq: 7 },
      { kind: "assistant_message", contentUnit: 5, text: "差异不是一个小 CSS 偏差：当前实现是我们手写的 `.codex-*` 简化结构；你保存的页面里 Codex 面板是完整的扩展 DOM + token utility class。", time: "2026-07-02T17:39:24.000Z", seq: 8 },
      { kind: "assistant_message", contentUnit: 6, text: "截图已经生成：`/tmp/codex-upload-list.png`、`/tmp/codex-upload-thread.png`、`/tmp/codex-current.png`。", time: "2026-07-02T17:39:28.000Z", seq: 9 },
      { kind: "assistant_message", contentUnit: 7, text: "当前页面和你保存的目标页相比，最大问题不只是字体：`composer` 的底部按钮、授权状态、线程页 header、消息区、任务列表 spacing 都是简化版。", time: "2026-07-02T17:39:32.000Z", seq: 10 },
      { kind: "assistant_message", contentUnit: 8, text: "完整保存页本身在 `headless` 打开有一些 Chrome 保存造成的副作用，比如左侧活动栏图标状态/`hover` 被固化了。", time: "2026-07-02T17:39:34.000Z", seq: 11 },
      { kind: "assistant_message", contentUnit: 9, text: "`fake.html` 单独打开没有加载扩展 CSS；但它仍然给了真实 `DOM`、`class` 和文本。", time: "2026-07-02T17:39:35.000Z", seq: 12 },
      { kind: "assistant_message", contentUnit: 10, text: "我会先不动后端。前端保留 `code-server` 外壳，只重写 `frontend/src` 里 Codex 面板相关 DOM/CSS/JS。", time: "2026-07-02T17:39:36.000Z", seq: 13 },
      { kind: "assistant_message", contentUnit: 11, text: "我现在开始改文件：`app.js` 会重写为状态化 Codex 面板，直接接 `/api/nodes`、`/api/sessions` 和 `SSE`。", time: "2026-07-02T17:39:37.000Z", seq: 14 },
      { kind: "tool_call", text: "已创建 1 个文件", time: "2026-07-02T17:39:38.000Z", seq: 15 },
      { kind: "assistant_message", contentUnit: 13, text: "`app.js` 已经重写完成，接下来补样式覆盖。这里会保留 `composer-surface-chrome`、`ProseMirror`、`data-user-message-bubble`、`_markdownContent_lzkx4_60`。", time: "2026-07-02T17:39:39.000Z", seq: 16 },
      { kind: "tool_call", text: "已编辑 2 个文件", time: "2026-07-02T17:39:40.000Z", seq: 17 },
      { kind: "assistant_message", contentUnit: 16, text: "前端静态结构和样式覆盖已经写完。现在我会先做语法检查和构建，再运行截图看它和保存页的主要布局是否靠近。", time: "2026-07-02T17:39:40.200Z", seq: 18 },
      { kind: "assistant_message", contentUnit: 17, text: "语法检查通过。接下来构建并重启服务，然后用 1920×1002 截图确认实际运行效果。", time: "2026-07-02T17:39:40.400Z", seq: 19 },
      { kind: "assistant_message", contentUnit: 18, text: "构建和 Go 测试都通过了：`./build-all.sh`。", time: "2026-07-02T17:39:40.600Z", seq: 20 },
      { kind: "assistant_message", contentUnit: 19, text: "服务已重启且处于 active。接下来我会访问本地 58888 截图，并检查控制台/API 是否有明显错误。", time: "2026-07-02T17:39:40.800Z", seq: 21 },
      { kind: "assistant_message", contentUnit: 20, text: "API 正常返回远程 agent 和会话列表。截图已生成，我会查看当前效果，如果有明显偏差就继续调整。", placement: "final", diffCard: { files: ["frontend/src/app.js", "frontend/src/styles.css", "frontend/src/codex-panel.js"] }, time: "2026-07-02T17:51:00.000Z", seq: 22 },
      { kind: "summary", turnKey: "019f23f4-f091-75e2-bfc2-dc8a7cc4cb53", text: "已处理 3m 5s", followup: { contentUnit: 12, html: summaryFollowupHTML(), diffCard: { files: [
        { path: "code/codex-web/frontend/src/styles.css", additions: "+12", deletions: "-0" },
        { path: "codex-web-browser/fonts.conf", additions: "+41", deletions: "-0" },
        { path: "codex-web-browser/run.sh", additions: "+4", deletions: "-1" },
      ], total: 4, additions: "+61", deletions: "-2", showMore: true }, time: "2026-07-02T17:54:00.000Z" }, time: "2026-07-02T17:51:20.000Z", seq: 3 },
      { kind: "user_message", text: "那么我源码的话现在是否直接reset  push更好  而不是还在现在显示效果差别很大的实现\n", turnKey: "019f23f8-a04c-7993-9c12-af1ad7cf7085", time: "2026-07-02T17:55:00.000Z", seq: 23 },
      { kind: "summary", inline: true, text: "已处理 40s", time: "2026-07-02T17:52:40.000Z", seq: 24 },
      { kind: "assistant_message", placement: "final", html: resetFollowupHTML(), time: "2026-07-02T17:52:41.000Z", seq: 25 },
      { kind: "user_message", text: "那你进行", turnKey: "019f23f6-16c0-7210-b9f3-eccb7cb14da6", time: "2026-07-02T17:53:00.000Z", seq: 26 },
      { kind: "summary", inline: true, text: "已处理 1m 17s", time: "2026-07-02T17:54:17.000Z", seq: 27 },
      { kind: "assistant_message", placement: "final", html: cleanedFollowupHTML(), time: "2026-07-02T17:54:18.000Z", seq: 28 },
      { kind: "user_message", text: "给我push一下  确保我git clone可以直接获取", editable: true, turnKey: "019f23f7-a46a-7b50-9c3a-4b4dd24ed123", time: "2026-07-02T17:55:00.000Z", seq: 29 },
      { kind: "summary", inline: true, text: "已处理 41s", time: "2026-07-02T17:55:41.000Z", seq: 30 },
      { kind: "assistant_message", placement: "final", actionsVisible: true, html: pushedFollowupHTML(), time: "2026-07-02T17:55:42.000Z", seq: 31 },
    ]);
    eventsBySession.set("backup-unarchived", [
      { kind: "user_message", text: "备份未归档会话", time: new Date(now - 56 * 60 * 1000).toISOString(), seq: 1 },
      { kind: "assistant_message", text: "可以，我会整理当前未归档的会话记录。", time: new Date(now - 55 * 60 * 1000).toISOString(), seq: 2 },
    ]);
    return { sessions, eventsBySession };
  }
})();
