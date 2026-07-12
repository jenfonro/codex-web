"use strict";

(function defineCodexPanelRenderer(global) {
  const {
    timeFromTurn,
    threadTitle,
    escapeHTML,
    escapeAttr,
  } = global.CodexPanelUtils;
  const lifecycle = global.CodexPanelLifecycle;
  const activitySummary = global.CodexPanelActivitySummary;
  const markdown = global.CodexMarkdown;

  function createCodexPanelRenderer(runtime) {
    const { state, mount, icons } = runtime;

function render() {
  const html = renderPanelHTML();
  if (state.view === "thread" && currentPanelView() === "thread") {
    reconcileThreadView(html);
  } else {
    replacePanelHTML(html);
  }
  syncComposerState();
}

function renderPanelHTML() {
  return `${state.view === "thread" ? renderThreadView() : renderListView()}${renderToastViewport()}`;
}

function replacePanelHTML(html) {
  mount.root.innerHTML = html;
  syncThreadScrollPosition();
}

function currentPanelView() {
  return mount.root.querySelector("[data-codex-panel-root]").dataset.codexView;
}

function renderToastViewport() {
  return '<span class="pointer-events-none fixed inset-0 z-[60] mx-auto my-2 flex max-w-[560px] flex-col items-center justify-start md:pb-5"></span>';
}

function syncThreadScrollPosition() {
  if (state.view !== "thread") return;
  requestAnimationFrame(() => {
    const scroll = mount.root.querySelector("[data-thread-scroll]");
    scroll.scrollTop = scroll.scrollHeight;
  });
}

function reconcileThreadView(html) {
  const currentRoot = mount.root.querySelector("[data-codex-panel-root][data-codex-view='thread']");
  const nextRoot = panelRootFromHTML(html);
  const scroll = currentRoot.querySelector("[data-thread-scroll]");
  const stickToBottom = isThreadScrollAtBottom(scroll);
  syncNodeFromNext(currentRoot, nextRoot, "[data-codex-thread-header]");
  reconcileThreadTurns(currentRoot, nextRoot);
  syncComposerSurface(currentRoot, nextRoot);
  if (stickToBottom) {
    requestAnimationFrame(() => {
      scroll.scrollTop = scroll.scrollHeight;
    });
  }
}

function panelRootFromHTML(html) {
  const template = global.document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.querySelector("[data-codex-panel-root]");
}

function syncNodeFromNext(currentRoot, nextRoot, selector) {
  const currentNode = currentRoot.querySelector(selector);
  const nextNode = nextRoot.querySelector(selector);
  if (currentNode.outerHTML !== nextNode.outerHTML) {
    currentNode.replaceWith(nextNode);
  }
}

function reconcileThreadTurns(currentRoot, nextRoot) {
  const currentList = currentRoot.querySelector("[data-codex-turn-list]");
  const nextList = nextRoot.querySelector("[data-codex-turn-list]");
  reconcileTurnList(currentList, nextList);
}

function syncComposerSurface(currentRoot, nextRoot) {
  const currentSurface = currentRoot.querySelector("[data-codex-composer-surface]");
  const nextSurface = nextRoot.querySelector("[data-codex-composer-surface]");
  if (currentSurface.dataset.codexComposerSignature === nextSurface.dataset.codexComposerSignature) {
    return;
  }
  const currentInput = currentSurface.querySelector("[data-codex-composer]");
  const nextInput = nextSurface.querySelector("[data-codex-composer]");
  nextInput.innerHTML = currentInput.innerHTML;
  nextInput.dataset.codexEmpty = currentInput.dataset.codexEmpty;
  currentSurface.replaceWith(nextSurface);
}

function reconcileTurnList(currentList, nextList) {
  const currentByKey = new Map();
  for (const child of Array.from(currentList.children)) {
    currentByKey.set(child.dataset.codexTurnKey, child);
  }

  const nextChildren = Array.from(nextList.children);
  for (let index = 0; index < nextChildren.length; index += 1) {
    const nextChild = nextChildren[index];
    const key = nextChild.dataset.codexTurnKey;
    const currentChild = currentByKey.get(key);
    const child = currentChild
      ? reconcileTurn(currentChild, nextChild)
      : nextChild;
    if (currentChild) currentByKey.delete(key);
    const reference = currentList.children.item(index);
    if (child !== reference) currentList.insertBefore(child, reference);
  }

  for (const child of currentByKey.values()) {
    child.remove();
  }
}

function reconcileTurn(currentChild, nextChild) {
  if (currentChild.dataset.codexTurnSignature === nextChild.dataset.codexTurnSignature) {
    syncMarkdownNodes(currentChild, nextChild);
    return currentChild;
  }
  currentChild.replaceWith(nextChild);
  return nextChild;
}

function syncMarkdownNodes(currentRoot, nextRoot) {
  const currentByID = new Map();
  for (const node of currentRoot.querySelectorAll("[data-codex-markdown-item-id]")) {
    currentByID.set(node.dataset.codexMarkdownItemId, node);
  }
  for (const nextNode of nextRoot.querySelectorAll("[data-codex-markdown-item-id]")) {
    const id = nextNode.dataset.codexMarkdownItemId;
    const currentNode = currentByID.get(id);
    if (currentNode && currentNode.innerHTML !== nextNode.innerHTML) {
      currentNode.innerHTML = nextNode.innerHTML;
    }
  }
}

function isThreadScrollAtBottom(scroll) {
  return scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 80;
}

function renderListView() {
  return `
    <div class="codex-panel-view codex-panel-view-list flex h-full flex-col" tabindex="0" data-codex-panel-root data-codex-view="list">
      ${renderListHeader()}
      <div class="codex-list-body relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div class="codex-list-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto" data-codex-thread-list-scroll>
          <div class="[container-type:size] relative flex w-full min-h-full flex-col [container-name:home-main-content]" role="main">
            <div class="mx-auto flex w-full max-w-3xl flex-col gap-3 px-panel">
              ${renderThreadList()}
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

function renderThreadList() {
  return `
    <div>
      <div class="group/inline -mx-[var(--padding-row-x)] flex flex-col gap-px rounded-xl pb-1 transition-colors [--task-row-trailing-inset:calc(var(--spacing)*1.5)]">
        ${state.threads.map(renderThreadRow).join("")}
      </div>
    </div>`;
}

function renderThreadView() {
  const thread = activeThread();
  return `
    <div class="codex-panel-view codex-panel-view-thread relative flex h-full flex-col min-h-0" data-codex-panel-root data-codex-view="thread">
      <div class="sticky top-0 z-10" data-codex-thread-header>${renderHeader(threadTitle(thread))}</div>
      <div class="codex-thread-body flex min-h-0 flex-1 flex-col [&_[data-thread-find-target=conversation]]:scroll-mt-24">
        <div class="codex-thread-scroll-region relative mx-auto flex min-h-0 w-full flex-1 flex-col">
          <div class="min-h-0 flex-1">
            <div class="relative h-full flex-1 [content-visibility:auto]">
              <div data-app-action-timeline-scroll="" tabindex="0" class="codex-thread-scroll thread-scroll-container relative h-full overflow-x-hidden overflow-y-auto [overflow-anchor:none] [scroll-padding-bottom:var(--thread-scroll-padding-bottom,0px)] pt-(--thread-content-top-inset) [container-name:thread-content] [container-type:inline-size] focus:outline-none [&:has([data-thread-scroll-footer='true']:focus-within)]:[scroll-padding-bottom:0px] flex flex-col" style="--thread-scroll-padding-bottom: 160px;" data-thread-scroll>
                  <div class="codex-thread-content-frame flex min-h-full shrink-0 flex-col justify-start" data-thread-content-frame>
                    <div data-codex-thread-content="true" class="codex-thread-content mx-auto w-full max-w-(--thread-content-max-width) px-toolbar relative flex flex-1 shrink-0 flex-col pb-8">
                      <div data-thread-find-target="conversation" class="relative flex flex-col gap-3">
                        ${renderActiveConversation()}
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

function renderActiveConversation() {
  return renderConversationState(activeThread());
}

function renderHeader(title) {
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

function renderConversationState(thread) {
  const turnErrors = state.turnErrors.filter((notification) => notification.threadId === thread.id);
  return `
    <div class="relative shrink-0">
      ${renderTurnList(thread.turns, turnErrors)}
    </div>`;
}

function renderTurnList(turns, turnErrors) {
  return `
      <div class="flex flex-col" style="gap: 12px;" data-codex-turn-list>
        ${turns.map((turn, turnIndex) => renderConversationTurn(
          turn,
          turnIndex,
          turnErrors.filter((notification) => notification.turnId === turn.id),
        )).join("")}
      </div>`;
}

function renderConversationTurn(turn, turnIndex, turnErrors) {
  const refs = turn.items.map((item, itemIndex) => ({ turn, item, itemIndex }));
  const signature = `${turn.status}:${JSON.stringify(turn.error)}:${JSON.stringify(turnErrors)}:${refs.map(itemRefSignature).join("|")}`;
  const user = refs.find((ref) => ref.item.type === "userMessage");
  const responseRefs = refs.filter((ref) => ref !== user);
  return `
    <div class="flex flex-col" style="gap: var(--conversation-tool-assistant-gap, 8px);" data-turn-id="${escapeAttr(turn.id)}" data-codex-turn-key="${escapeAttr(turn.id)}" data-codex-turn-signature="${escapeAttr(signature)}">
      <div class="flex flex-col empty:hidden" data-codex-turn-user>${user ? renderTurnUser(user) : ""}</div>
      <div class="flex flex-col empty:hidden" style="gap: var(--conversation-tool-assistant-gap, 8px);" data-codex-turn-response>${renderTurnResponse(turn, responseRefs, turnIndex, turnErrors)}</div>
    </div>`;
}

function itemRefSignature(ref) {
  if (lifecycle.isStreamingAssistant(ref)) {
    return `${ref.item.type}:${ref.item.id}:streaming:${ref.item.phase}`;
  }
  return `${ref.turn.status}:${JSON.stringify(ref.item)}`;
}

function renderTurnStatus(turn, refs, turnErrors) {
  const content = [];
  const retry = turnErrors.findLast((notification) => notification.willRetry);
  const failure = turn.error ?? turnErrors.findLast((notification) => !notification.willRetry)?.error;
  if (retry) content.push(renderRetryStatus(retry.error));
  if (failure) {
    content.push(renderTurnError(failure));
  } else if ((retry || lifecycle.isTurnRunning(turn)) && !refs.some(lifecycle.isItemPending)) {
    content.push(renderTurnPending());
  }
  return content;
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

function renderThreadRow(thread) {
  const running = thread.status.type === "active";
  const trailing = running
    ? `<span class="codex-thread-status-spinner" aria-label="Running" role="img"></span>`
    : escapeHTML(global.CodexPanelUtils.relativeTime(thread.updatedAt));
  return `
    <div class="group relative h-[var(--height-token-row)] cursor-interaction rounded-[var(--radius-token-row)] py-row-y text-sm hover:bg-token-list-hover-background focus-visible:outline-offset-[-2px] px-[var(--padding-row-cell-x,var(--padding-row-x))]" role="button" tabindex="0" data-codex-thread-id="${escapeAttr(thread.id)}">
      <div class="contents" data-hover-card-open-immediately="true">
        <div class="absolute right-0 top-0 z-10 flex h-full items-center justify-end gap-2 pr-0.5 mr-0.5 w-[52px]" style="right: var(--task-row-trailing-inset);">
          <button type="button" class="focus-visible:outline-token-focus-ring pointer-events-none flex h-5 w-5 items-center justify-center rounded-md opacity-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-50 hover:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2" aria-label="归档对话" data-codex-archive-button>${icons.svg("archive", "icon-xs")}</button>
        </div>
      </div>
      <div class="flex h-full w-full items-center text-sm leading-4">
        <div class="flex min-w-0 flex-1 items-center gap-2 pl-0.5">
          <div class="flex min-w-0 flex-1 self-stretch items-center gap-2 text-base leading-5 text-token-foreground" data-thread-title-trigger="true">
            <span class="min-w-0 truncate select-none flex-1" data-thread-title="true" draggable="false">${escapeHTML(threadTitle(thread))}</span>
          </div>
        </div>
        <div class="ml-[3px] flex items-center justify-end gap-1 relative mr-[var(--task-row-trailing-inset)] min-w-[26px]">
          <div><div class="text-token-description-foreground text-sm leading-4 empty:hidden tabular-nums overflow-visible truncate text-right group-focus-within:hidden group-hover:hidden shrink-0">${trailing}</div></div>
        </div>
      </div>
    </div>`;
}

function renderTurnUser(ref) {
  return `
    <div class="scroll-mt-4" data-content-search-unit-key="${escapeAttr(contentSearchKey(ref.turn.id, ref.itemIndex, "user"))}" data-codex-conversation-user-anchor="true">
      ${renderUserContent(ref)}
    </div>`;
}

function contentSearchKey(turnId, unit, role) {
  return `${turnId}:${unit}:${role}`;
}

function renderTurnResponse(turn, refs, index, turnErrors) {
  const split = activitySummary.splitTurnFollowups(refs);
  const finalFollowup = split.finalFollowup;
  const streamFollowups = split.streamFollowups;
  const processFollowups = split.processFollowups;
  const statusContent = renderTurnStatus(turn, refs, turnErrors);
  const inlineContent = streamFollowups
    .map((ref, offset) => renderInlineTurnFollowupBody(ref, index, offset))
    .filter(Boolean)
    .concat(statusContent);
  const turnId = turn.id;
  const sections = [];
  if (inlineContent.length) {
    sections.push(`
      <div class="flex flex-col" data-codex-turn-stream>
          <div class="-mx-1.5 px-1.5" style="overflow: hidden; opacity: 1; height: auto;">
            <div class="flex flex-col space-y-0">
              ${inlineContent.map(renderInlineTurnSegment).join("")}
            </div>
          </div>
      </div>`);
  }
  if (processFollowups.length) {
    sections.push(`<div class="flex flex-col" data-codex-turn-process>${renderTurnProcessBlock(turn, processFollowups, index)}</div>`);
  }
  if (finalFollowup) {
    sections.push(`
      <div class="flex flex-col" data-codex-turn-final>
        <div data-content-search-unit-key="${escapeAttr(contentSearchKey(turnId, finalFollowup.itemIndex, "assistant"))}">
          ${renderAssistantContent(finalFollowup, `${index}-final`)}
        </div>
      </div>`);
  }
  return sections.join("");
}

function renderInlineTurnFollowup(ref, turnIndex, offset) {
  return renderInlineTurnSegment(renderInlineTurnFollowupBody(ref, turnIndex, offset), offset);
}

function renderInlineTurnFollowupBody(ref, turnIndex, offset) {
  const content = renderInlineFollowupContent(ref, turnIndex, offset);
  if (!content) return "";
  const turnId = ref.turn.id;
  const unit = ref.itemIndex;
  return `<div data-content-search-unit-key="${escapeAttr(contentSearchKey(turnId, unit, "assistant"))}">${content}</div>`;
}

function renderInlineTurnSegment(content, offset) {
  if (offset === 0) return `<div style="overflow: hidden;">${content}</div>`;
  return `
    <div style="overflow: hidden;">
      <div aria-hidden="true" class="w-full" style="height: var(--conversation-tool-assistant-gap, 8px);"></div>
      ${content}
    </div>`;
}

function renderInlineFollowupContent(ref, turnIndex, offset) {
  switch (ref.item.type) {
    case "agentMessage":
      if (lifecycle.isStreamingAssistant(ref) && ref.item.text.length === 0) return renderThinkingPlaceholder("正在思考");
      return renderAssistantContent(ref, `${turnIndex}-${offset}`);
    case "reasoning":
      return renderReasoningContent(ref);
    case "commandExecution":
      return renderCommandExecutionContent(ref);
    case "fileChange":
      return renderFileChangeContent(ref);
    case "mcpToolCall":
    case "dynamicToolCall":
      return "";
    case "webSearch":
      return renderWebSearchContent(ref);
    case "imageView":
      return "";
    case "enteredReviewMode":
    case "exitedReviewMode":
    case "sleep":
      return "";
    case "plan":
      return renderPlanContent(ref);
    case "contextCompaction":
      return renderContextCompaction();
  }
  throw new Error(`Unhandled followup item type: ${ref.item.type}`);
}

function renderUserContent(ref) {
  return `
    <div class="flex flex-col items-end gap-2">
      ${renderUserBubble(ref)}
    </div>`;
}

function renderUserBubble(ref) {
  const text = ref.item.content.map((input) => input.text).join("\n\n");
  return `
    <div class="group flex w-full flex-col items-end justify-end gap-1">
      <div data-user-message-bubble="true" tabindex="0" class="bg-token-foreground/5 max-w-[77%] min-w-0 overflow-hidden break-words rounded-2xl px-3 py-2 [&_.contain-inline-size]:[contain:initial] text-left focus-visible:ring-2 focus-visible:ring-token-focus-border focus-visible:outline-none">
        <div class="flex flex-col items-end gap-1">
          <div class="text-size-chat relative w-full min-w-0">
            <div class="codex-message-content text-size-chat">${markdown.render(text, { variant: "user" })}</div>
          </div>
        </div>
      </div>
      <div class="flex flex-row-reverse items-center gap-1">
        <div class="mr-1 ms-1 flex items-center gap-2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
          <span class="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
            <span class="text-xs text-token-text-tertiary">${timeFromTurn(ref.turn)}</span>
          </span>
          <div class="flex items-center gap-0.5">
            ${renderCopyMessageButton()}
          </div>
        </div>
      </div>
    </div>`;
}

function renderAssistantContent(ref, index) {
  const itemAttr = ` data-codex-markdown-item-id="${escapeAttr(ref.item.id)}"`;
  const messageText = markdown.render(ref.item.text, { variant: "assistant" });
  return `
    <div class="group flex min-w-0 flex-col">
      <div data-selected-text-overlay-target="codex-assistant-${index}" class="codex-message-content text-size-chat"${itemAttr}>${messageText}</div>
    </div>`;
}

function renderCopyMessageButton() {
  return `
    <span data-state="closed" class="contents">
      <button type="button" class="border-token-border no-drag cursor-interaction flex items-center gap-1 border whitespace-nowrap select-none focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 rounded-full text-token-text-tertiary enabled:hover:bg-token-list-hover-background data-[state=open]:bg-token-list-hover-background border-transparent flex items-center justify-center p-0.5 focus-visible:ring-2 focus-visible:ring-token-focus-border focus-visible:ring-offset-0" aria-label="复制消息">
        ${icons.svg("copyMessage", "icon-xs")}
      </button>
    </span>`;
}

function renderPlanContent(ref) {
  return `
    <details class="codex-plan-summary">
      <summary class="codex-plan-summary-header">
        <span class="codex-plan-summary-title">计划</span>
        ${icons.svg("chevronRight", "codex-plan-summary-chevron icon-2xs shrink-0")}
      </summary>
      <div class="codex-plan-summary-body">${renderMarkdownBody(ref.item.text, "plan")}</div>
    </details>`;
}

function renderContextCompaction() {
  return `
    <div class="codex-context-compaction">
      <span class="codex-context-compaction-line"></span>
      <span class="codex-context-compaction-label">
        ${icons.svg("contextCompaction", "codex-context-compaction-icon")}
        <span>上下文已自动压缩</span>
      </span>
      <span class="codex-context-compaction-line"></span>
    </div>`;
}

function renderTurnProcessBlock(turn, processFollowups, turnIndex) {
  const label = activitySummary.summaryLabel(turn);
  return `
          <div class="text-size-chat text-token-text-secondary codex-turn-activity">
            <details class="codex-turn-activity-details">
              <summary class="codex-turn-activity-summary">
                <span class="text-size-chat hover:bg-token-bg-subtle inline-flex cursor-interaction items-center gap-1 rounded-md border border-transparent focus-visible:ring-2 focus-visible:ring-token-focus-border focus-visible:outline-none">
                  <span><span class="codex-status-label">${escapeHTML(label)}</span></span>
                  ${icons.svg("chevronRight", "codex-turn-activity-chevron icon-2xs text-token-foreground/40 transition-transform duration-200 rotate-0")}
                </span>
                <span class="text-size-chat block pt-1 text-token-text-secondary">
                  <span class="block w-full border-t border-token-border-light"></span>
                </span>
              </summary>
              <div class="codex-turn-activity-expanded">
                ${renderTurnProcessContent(processFollowups, turnIndex)}
              </div>
            </details>
          </div>`;
}

function renderTurnProcessContent(refs, turnIndex) {
  return refs.map((ref, offset) => renderInlineTurnFollowup(ref, turnIndex, offset))
    .join("");
}

function renderReasoningContent(ref) {
  const pending = lifecycle.isItemPending(ref);
  const text = reasoningSummary(ref.item.summary);
  if (pending && text.length === 0) return renderThinkingPlaceholder("正在思考");
  return renderToolDisclosure({
    className: "codex-reasoning-disclosure",
    label: pending ? "正在思考" : "已思考",
    body: renderMarkdownBody(text, "reasoning"),
    pending,
    expanded: pending,
  });
}

function renderTurnPending() {
  return `<div class="text-size-chat text-token-text-secondary">${renderThinkingPlaceholder("正在思考")}</div>`;
}

function renderRetryStatus(error) {
  const progress = /^Reconnecting(?:\.\.\.)?\s+(\d+)\/(\d+)$/.exec(error.message);
  const label = progress
    ? `正在重新连接 ${progress[1]}/${progress[2]}`
    : error.message;
  if (error.additionalDetails === null || error.additionalDetails.trim().length === 0) {
    return `<div class="codex-stream-error codex-stream-error-static text-size-chat">${escapeHTML(label)}</div>`;
  }
  return `
    <details class="codex-stream-error text-size-chat">
      <summary class="codex-stream-error-summary">
        <span class="codex-stream-error-label">${escapeHTML(label)}</span>
        ${icons.svg("chevron20x21", "codex-stream-error-chevron icon-2xs")}
      </summary>
      <div class="codex-stream-error-details">${escapeHTML(error.additionalDetails)}</div>
    </details>`;
}

function renderTurnError(error) {
  return `
    <div class="codex-turn-error" role="alert">
      <div class="codex-turn-error-icon">${icons.svg("errorCircle", "icon-sm")}</div>
      <div class="codex-turn-error-content">
        <div class="codex-turn-error-message">${escapeHTML(error.message)}</div>
      </div>
    </div>`;
}

function renderThinkingPlaceholder(label) {
  return `
    <div class="min-w-0 text-size-chat py-0">
      <div class="inline-flex min-w-0 items-center">
        <span aria-hidden="true" class="h-4 w-0 shrink-0"></span>
        ${renderShimmerText(label, "min-w-0 truncate select-none")}
      </div>
    </div>`;
}

function renderToolDisclosure({ className, label, body, pending = false, expanded = false }) {
  const labelHTML = pending
    ? renderShimmerText(label, "text-size-chat min-w-0 truncate text-token-conversation-summary-leading group-hover/activity-header:text-token-foreground")
    : `<span class="min-w-0 truncate text-token-conversation-summary-trailing group-hover/activity-header:text-token-foreground">${escapeHTML(label)}</span>`;
  if (!body) {
    return `
      <div class="codex-tool-row ${className}">
        <span class="text-size-chat flex min-w-0 shrink items-center gap-1.5 truncate">${labelHTML}</span>
      </div>`;
  }
  const open = expanded ? " open" : "";
  return `
    <details class="codex-tool-disclosure ${className}"${open}>
      <summary class="group/activity-header codex-tool-disclosure-summary">
        <span class="text-size-chat flex min-w-0 shrink items-center gap-1.5 truncate">${labelHTML}</span>
        ${icons.svg("chevronRight", "codex-tool-disclosure-chevron icon-2xs shrink-0 text-token-input-placeholder-foreground transition-transform duration-300")}
      </summary>
      <div class="codex-tool-disclosure-body">${body}</div>
    </details>`;
}

function renderMarkdownBody(text, variant) {
  if (!text) return "";
  return `<div class="codex-message-content text-size-chat text-token-text-secondary">${markdown.render(text, { variant })}</div>`;
}

function renderCommandExecutionContent(ref) {
  const pending = lifecycle.isItemPending(ref);
  const body = [
    `<pre class="codex-command-source"><code>${escapeHTML(ref.item.command)}</code></pre>`,
    ref.item.aggregatedOutput === null
      ? ""
      : `<pre class="codex-command-output"><code>${escapeHTML(ref.item.aggregatedOutput)}</code></pre>`,
  ].join("");
  return renderToolDisclosure({
    className: "codex-command-disclosure",
    label: commandExecutionLabel(ref.item, pending),
    body,
    pending,
    expanded: pending,
  });
}

function reasoningSummary(summary) {
  const [first, ...rest] = summary;
  if (!first || rest.length === 0) return first ?? "";
  if (first.startsWith("**")) return [first, ...rest].join("\n\n");
  return [`**${first}**`, ...rest].join("\n\n");
}

function commandExecutionLabel(item, pending) {
  if (item.commandActions.length !== 1) return commandStatusLabel(pending);
  const action = item.commandActions[0];
  if (action.type === "read") return `${pending ? "正在读取" : "已读取"} ${action.name}`;
  if (action.type === "search") return `${pending ? "正在搜索" : "已搜索"} ${action.query ?? ""}`.trim();
  if (action.type === "listFiles") return `${pending ? "正在列出" : "已列出"} ${action.path ?? ""}`.trim();
  return commandStatusLabel(pending);
}

function commandStatusLabel(pending) {
  if (pending) return "正在运行命令";
  return "已运行命令";
}

function renderWebSearchContent(ref) {
  const pending = lifecycle.isItemPending(ref);
  const label = pending ? "正在搜索网页" : "已搜索网页";
  const labelHTML = pending
    ? renderShimmerText(label, "text-token-conversation-summary-leading")
    : `<span class="text-token-conversation-summary-leading">${label}</span>`;
  const query = webSearchDetail(ref.item).trim();
  return `
    <div class="codex-web-search-row">
      ${labelHTML}
      ${query ? `<span class="codex-web-search-query"> ${escapeHTML(query)}</span>` : ""}
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

function renderFileChangeContent(ref) {
  const rows = ref.item.changes.map((change) => {
    const action = fileChangeActionLabel(change.kind.type, ref.item.status);
    const body = renderPatchChangeBody(change);
    if (!body) {
      return `<div class="codex-patch-file-row"><span>${escapeHTML(action)}</span><span class="codex-patch-file-path">${escapeHTML(change.path)}</span></div>`;
    }
    return `
      <details class="codex-patch-file" open>
        <summary class="codex-patch-file-summary">
          <span>${escapeHTML(action)}</span>
          <span class="codex-patch-file-path">${escapeHTML(change.path)}</span>
          ${icons.svg("chevronRight", "codex-patch-file-chevron icon-2xs shrink-0")}
        </summary>
        <div class="codex-patch-file-body">${body}</div>
      </details>`;
  }).join("");
  return `<div class="codex-patch-file-list">${rows}</div>`;
}

function renderPatchChangeBody(change) {
  if (change.kind.type === "delete") return `<div class="codex-patch-empty-state">内容已删除</div>`;
  if (!change.diff) return "";
  return `<pre class="codex-patch-diff"><code>${escapeHTML(change.diff)}</code></pre>`;
}

function fileChangeActionLabel(kind, status) {
  if (status === "inProgress") {
    if (kind === "add") return "正在创建";
    if (kind === "delete") return "正在删除";
    return "正在编辑";
  }
  if (status === "declined" || status === "failed") return "已拒绝";
  if (kind === "add") return "已创建";
  if (kind === "delete") return "已删除";
  return "已编辑";
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
  const signature = composerSurfaceSignature(includeExternalFooter);
  return `
    <div class="codex-composer-surface relative flex w-full min-w-0 flex-col gap-2" data-codex-composer-surface data-codex-composer-signature="${escapeAttr(signature)}">
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

function webSearchDetail(item) {
  const action = item.action;
  if (action) {
    if (action.type === "search") {
      const query = action.query?.trim();
      if (query) return formatWebSearchQuery(query);
      const queries = action.queries ?? [];
      const first = queries.map((value) => value.trim()).find(Boolean) ?? "";
      if (first) return `${formatWebSearchQuery(first)}${queries.length > 1 ? " ..." : ""}`;
    }
    if (action.type === "openPage") return action.url ?? item.query;
    if (action.type === "findInPage") {
      if (action.pattern && action.url) return `'${action.pattern}' in ${action.url}`;
      if (action.pattern) return `'${action.pattern}'`;
      if (action.url) return action.url;
    }
  }
  return item.query;
}

function formatWebSearchQuery(query) {
  const sites = [];
  const withoutSites = query.replace(/\bsite:([^\s]+)/giu, (match, value) => {
    try {
      const host = new URL(`https://${value}`).hostname.replace(/^www\./u, "");
      if (!sites.includes(host)) sites.push(host);
      return "";
    } catch {
      return match;
    }
  });
  if (sites.length === 0) return query;
  const text = withoutSites.replace(/\bOR\b/gu, " ").replace(/\s+/gu, " ").trim();
  return text ? `${text} | ${sites.join(" · ")}` : query;
}

function composerSurfaceSignature(includeExternalFooter) {
  const running = isActiveThreadRunning() ? "running" : "idle";
  const popover = state.popover === "" ? "closed" : state.popover;
  const modelMenu = state.modelMenuExpanded ? "expanded" : "collapsed";
  return `${state.view}:${includeExternalFooter ? "thread-footer" : "home-footer"}:${running}:${popover}:${modelMenu}`;
}

function renderComposerFooter() {
  const plusState = state.popover === "plus" ? "open" : "closed";
  const approvalState = state.popover === "approval" ? "open" : "closed";
  const modelState = state.popover === "model" ? "open" : "closed";
  const running = isActiveThreadRunning();
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
  const simple = !nested && !label.startsWith("GPT-");
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
  const hasText = Boolean(composerText(input));
  input.dataset.codexEmpty = hasText ? "false" : "true";
  const running = isActiveThreadRunning();
  send.classList.toggle("opacity-50", !hasText && !running);
  send.classList.toggle("codex-send-ready", hasText || running);
  send.classList.toggle("codex-stop-ready", running);
}

function composerText(input) {
  return input.innerText.replace(/\u00a0/g, " ").trim();
}

function clearComposer(input) {
  input.innerHTML = '<p><br class="codex-editor-trailing-break"></p>';
  input.dataset.codexEmpty = "true";
}

    function activeThread() {
      return state.threads.find((thread) => thread.id === state.activeThreadId);
    }

    function isActiveThreadRunning() {
      if (state.view !== "thread") return false;
      return activeThread().status.type === "active";
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
