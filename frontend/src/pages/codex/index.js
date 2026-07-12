"use strict";

(function bootstrapCodexPanel(global) {
  const icons = global.CodexIcons;
  const config = global.CodexPanelConfig;
  const api = global.CodexPanelAPI;
  const store = global.CodexPanelStore;
  const rendererFactory = global.CodexPanelRenderer;
  const panel = document.getElementById("codexPanel");

  const mount = config.createPanelMount(panel);

  const state = store.createCodexPanelState();

  const runtime = {
    icons,
    config,
    state,
    mount,
  };
  const renderer = rendererFactory.create(runtime);
  const threadStartedWaiters = new Map();
  const stateUpdateQueue = [];
  const activityAnimationCleanups = new WeakMap();
  const ACTIVITY_ANIMATION_MS = 220;
  const ACTIVITY_ANIMATION_EASING = "cubic-bezier(.33, 1, .68, 1)";
  const ACTIVITY_ANCHOR_MS = 250;
  let stateUpdateFrame = 0;
  let activityAnimationSerial = 0;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    void init();
  }

  async function init() {
    mount.root.addEventListener("click", handleClick);
    mount.root.addEventListener("beforeinput", handleBeforeInput);
    mount.root.addEventListener("input", handleInput);
    mount.root.addEventListener("keydown", handleKeyDown);
    await loadThreads();
    subscribeThreadList();
    renderer.render();
  }

  async function loadThreads() {
    state.threads = await api.fetchJSON("/api/threads");
  }

  function openThread(threadID) {
    state.activeThreadId = threadID;
    state.threadHistory = {
      turns: [],
      loading: true,
    };
    state.view = "thread";
    state.popover = "";
    renderer.render();
    void loadThreadState(threadID);
  }

  function subscribeThreadList() {
    if (state.threadListEventSource) {
      state.threadListEventSource.close();
      state.threadListEventSource = null;
    }
    const source = new EventSource("/api/threads/state-events");
    source.onmessage = (event) => {
      enqueueStateUpdate(JSON.parse(event.data));
    };
    state.threadListEventSource = source;
  }

  function subscribeThread(threadID) {
    if (state.threadEventSource) {
      state.threadEventSource.close();
      state.threadEventSource = null;
    }
    const qs = new URLSearchParams({ threadId: threadID });
    const source = new EventSource(`/api/threads/state-events?${qs.toString()}`);
    source.onmessage = (event) => {
      if (state.activeThreadId !== threadID) return;
      enqueueStateUpdate(JSON.parse(event.data));
    };
    state.threadEventSource = source;
  }

async function loadThreadState(threadID) {
  const snapshot = await api.fetchJSON(`/api/threads/${encodeURIComponent(threadID)}/state`);
  if (state.activeThreadId !== threadID) return;
  applyStateUpdate({
    type: "state",
    threadId: threadID,
    data: snapshot,
  });
  if (state.activeThreadId === threadID) subscribeThread(threadID);
}

function applyStateUpdate(update) {
  switch (update.type) {
    case "state":
      replaceThread(update.data.thread);
      state.threadHistory.turns = update.data.history.turns;
      state.threadHistory.loading = false;
      state.turnErrors = [];
      break;
    case "threadStarted":
      appendThread(update.data);
      break;
    case "threadUpdated":
      replaceThread(update.data);
      break;
    case "turnStarted":
      state.turnErrors = [];
      appendTurn(update.threadId, update.data);
      break;
    case "turnUpdated":
      replaceTurn(update.threadId, update.data);
      if (update.data.status !== "inProgress" && update.data.error === null) state.turnErrors = [];
      break;
    case "turnError":
      state.turnErrors.push(update.data);
      break;
    default:
      throw new Error(`Unhandled thread state update: ${update.type}`);
  }
  renderStateUpdate(update);
}

function enqueueStateUpdate(update) {
  stateUpdateQueue.push(update);
  if (stateUpdateFrame) return;
  stateUpdateFrame = global.requestAnimationFrame(applyNextStateUpdate);
}

function applyNextStateUpdate() {
  stateUpdateFrame = 0;
  applyStateUpdate(stateUpdateQueue.shift());
  if (stateUpdateQueue.length) {
    stateUpdateFrame = global.requestAnimationFrame(applyNextStateUpdate);
  }
}

function appendTurn(threadID, turn) {
  if (threadID !== state.activeThreadId) return;
  state.threadHistory.turns.push(turn);
}

function replaceTurn(threadID, turn) {
  if (threadID !== state.activeThreadId) return;
  const index = state.threadHistory.turns.findIndex((item) => item.id === turn.id);
  if (index < 0) throw new Error(`Turn not found: ${turn.id}`);
  state.threadHistory.turns[index] = turn;
}

function renderStateUpdate(update) {
  if (state.view !== "list" && state.activeThreadId !== update.threadId) return;
  renderer.render();
}

function handleClick(event) {
  const activityToggle = event.target.closest("[data-codex-turn-activity-toggle]");
  const popoverButton = event.target.closest("[data-popover]");
  const action = event.target.closest("[data-action]")?.dataset.action;
  const threadRow = event.target.closest("[data-codex-thread-id]");

  if (activityToggle) {
    const activity = activityToggle.closest("[data-codex-turn-activity]");
    const expanded = activity.dataset.state !== "open";
    const scroll = activity.closest("[data-thread-scroll]");
    const scrollAnchor = createActivityScrollAnchor(activityToggle, activity, scroll);
    const content = expanded
      ? ensureActivityContent(activity)
      : activity.querySelector("[data-codex-turn-activity-content]");
    activityToggle.setAttribute("aria-expanded", String(expanded));
    activity.dataset.state = expanded ? "open" : "closed";
    animateActivityContent(content, expanded, scrollAnchor);
    return;
  }

  if (popoverButton) {
    const name = popoverButton.dataset.popover;
    state.popover = state.popover === name ? "" : name;
    state.modelMenuExpanded = false;
    renderer.render();
    return;
  }

  if (action === "back" || action === "new-chat") {
    state.view = "list";
    state.activeThreadId = "";
    state.threadHistory = {
      turns: [],
      loading: false,
    };
    state.popover = "";
    state.modelMenuExpanded = false;
    if (state.threadEventSource) state.threadEventSource.close();
    state.threadEventSource = null;
    renderer.render();
    return;
  }

  if (action === "send") {
    void submitComposer();
    return;
  }

  if (action === "cancel") {
    void cancelActiveThread();
    return;
  }

  if (action === "toggle-model-submenu") {
    state.modelMenuExpanded = !state.modelMenuExpanded;
    renderer.render();
    return;
  }

  if (threadRow && !event.target.closest("[data-codex-archive-button]")) {
    openThread(threadRow.dataset.codexThreadId);
    return;
  }

  if (state.popover && !event.target.closest("[data-codex-menu-wrapper], [data-composer-overlay]")) {
    state.popover = "";
    state.modelMenuExpanded = false;
    renderer.render();
  }
}

function handleInput(event) {
  if (event.target.matches("[data-codex-composer]")) renderer.syncComposerState();
}

function handleKeyDown(event) {
  const input = event.target.closest?.("[data-codex-composer]");
  if (!input || event.key !== "Enter") return;
  if (event.shiftKey || event.isComposing || event.keyCode === 229) return;
  event.preventDefault();
  void submitComposer();
}

function handleBeforeInput(event) {
  const input = event.target.closest?.("[data-codex-composer]");
  if (!input || !event.inputType.startsWith("delete")) return;
  if (renderer.composerText(input)) return;
  event.preventDefault();
  renderer.clearComposer(input);
  renderer.syncComposerState();
}

async function submitComposer() {
  if (isActiveThreadRunning()) return;
  const input = mount.root.querySelector("[data-codex-composer]");
  const prompt = renderer.composerText(input);
  renderer.clearComposer(input);
  renderer.syncComposerState();

  if (state.view === "thread" && state.activeThreadId) {
    await api.fetchNoContent(`/api/threads/${encodeURIComponent(state.activeThreadId)}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    return;
  }

  const result = await api.fetchJSON("/api/threads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  await waitForThreadStarted(result.threadId);
  openThread(result.threadId);
}

function createActivityScrollAnchor(toggle, activity, scroll) {
  if (!scroll) return null;
  return {
    activity,
    scroll,
    toggle,
    scrollHeight: scroll.scrollHeight,
    scrollTop: scroll.scrollTop,
    bottomOffset: Math.max(0, scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight),
    top: toggle.getBoundingClientRect().top,
    keepBottom: isScrollNearBottom(scroll),
  };
}

function preserveActivityTogglePosition(anchor, durationMs = 250) {
  if (!anchor) return;
  const { activity, scroll, toggle, top } = anchor;
  if (!scroll) return;

  let frame = 0;
  const adjust = () => {
    if (toggle.isConnected) {
      scroll.scrollTop += toggle.getBoundingClientRect().top - top;
    }
  };
  const schedule = () => {
    if (frame) return;
    frame = global.requestAnimationFrame(() => {
      frame = 0;
      adjust();
    });
  };
  const handleResize = () => {
    if (frame) {
      global.cancelAnimationFrame(frame);
      frame = 0;
    }
    adjust();
    schedule();
  };
  const turn = activity.closest("[data-turn-key], [data-codex-turn-key], [data-turn-id]");
  const observer = turn && typeof global.ResizeObserver !== "undefined"
    ? new global.ResizeObserver(handleResize)
    : null;

  if (observer) observer.observe(turn);
  schedule();
  global.setTimeout(() => {
    if (frame) global.cancelAnimationFrame(frame);
    observer?.disconnect();
  }, durationMs);
}

function isScrollNearBottom(scroll) {
  return scroll && scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 80;
}

function animateActivityContent(content, expanded, scrollAnchor) {
  if (!content) return;

  cancelActivityContentAnimation(content);
  activityAnimationSerial += 1;
  const token = String(activityAnimationSerial);
  const reducedMotion = global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;

  if (!expanded) {
    content.setAttribute("aria-hidden", "true");
    resetActivityContentStyle(content);
    content.remove();
    preserveActivityScrollAfterCollapse(scrollAnchor);
    return;
  }

  const wasHidden = isActivityContentHidden(content);
  const scrollAnimation = startActivityScrollAnimation(scrollAnchor, content, true, reducedMotion);

  if (!content.style || reducedMotion) {
    content.setAttribute("aria-hidden", "false");
    scrollAnimation?.finish();
    resetActivityContentStyle(content);
    return;
  }

  content.setAttribute("aria-hidden", "false");
  content.dataset.codexActivityAnimating = "expand";
  content.dataset.codexActivityAnimationToken = token;

  content.style.transition = "none";
  content.style.pointerEvents = "auto";
  content.style.overflow = "hidden";
  content.style.clipPath = wasHidden ? "inset(0 0 100% 0)" : "inset(0 0 0 0)";
  content.style.willChange = "opacity, transform, clip-path";
  content.style.opacity = wasHidden ? "0" : "1";
  content.style.transform = wasHidden ? "translateY(-8px)" : "translateY(0)";

  void content.offsetHeight;

  const finish = () => {
    if (content.dataset.codexActivityAnimationToken !== token) return;
    cancelActivityContentAnimation(content);
    scrollAnimation?.finish();
    resetActivityContentStyle(content);
  };
  const finishOnTransitionEnd = (event) => {
    if (event.target !== content || event.propertyName !== "transform") return;
    finish();
  };
  const timeout = global.setTimeout(finish, ACTIVITY_ANIMATION_MS + 80);
  activityAnimationCleanups.set(content, () => {
    global.clearTimeout(timeout);
    content.removeEventListener?.("transitionend", finishOnTransitionEnd);
  });

  content.addEventListener?.("transitionend", finishOnTransitionEnd);
  content.style.transition = [
    `opacity ${ACTIVITY_ANIMATION_MS}ms ${ACTIVITY_ANIMATION_EASING}`,
    `transform ${ACTIVITY_ANIMATION_MS}ms ${ACTIVITY_ANIMATION_EASING}`,
    `clip-path ${ACTIVITY_ANIMATION_MS}ms ${ACTIVITY_ANIMATION_EASING}`,
  ].join(", ");
  content.style.clipPath = "inset(0 0 0 0)";
  content.style.opacity = "1";
  content.style.transform = "translateY(0)";
}

function preserveActivityScrollAfterCollapse(anchor) {
  if (!anchor) return;
  const { scroll, bottomOffset } = anchor;
  if (!scroll) return;
  if (anchor.keepBottom) {
    scroll.scrollTop = Math.max(0, scroll.scrollHeight - scroll.clientHeight - bottomOffset);
    return;
  }
  preserveActivityTogglePosition(anchor, ACTIVITY_ANCHOR_MS);
}

function startActivityScrollAnimation(anchor, content, expanded, reducedMotion) {
  if (!anchor) return null;
  if (!anchor.keepBottom) {
    preserveActivityTogglePosition(anchor, ACTIVITY_ANCHOR_MS);
    return null;
  }

  const { scroll } = anchor;
  const from = scroll.scrollTop;
  const contentHeight = activityContentCurrentHeight(content);
  const scrollHeightDelta = expanded
    ? Math.max(0, scroll.scrollHeight - anchor.scrollHeight)
    : -contentHeight;
  const to = Math.max(0, from + scrollHeightDelta);
  if (Math.abs(to - from) < 1) return null;

  if (reducedMotion) {
    scroll.scrollTop = to;
    return null;
  }

  let frame = 0;
  let finished = false;
  const startTime = performanceNow();
  const tick = () => {
    if (finished) return;
    const elapsed = Math.min(1, (performanceNow() - startTime) / ACTIVITY_ANIMATION_MS);
    const eased = easeOutCubic(elapsed);
    scroll.scrollTop = from + (to - from) * eased;
    if (elapsed < 1) {
      frame = global.requestAnimationFrame(tick);
    } else {
      finished = true;
      frame = 0;
    }
  };
  frame = global.requestAnimationFrame(tick);
  return {
    finish() {
      finished = true;
      if (frame) global.cancelAnimationFrame(frame);
      scroll.scrollTop = to;
    },
  };
}

function activityContentCurrentHeight(content) {
  const rectHeight = content.getBoundingClientRect?.().height;
  if (Number.isFinite(rectHeight) && rectHeight > 0) return rectHeight;
  if (Number.isFinite(content.offsetHeight) && content.offsetHeight > 0) return content.offsetHeight;
  return content.scrollHeight || 0;
}

function performanceNow() {
  return global.performance?.now?.() ?? Date.now();
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function ensureActivityContent(activity) {
  const existing = activity.querySelector("[data-codex-turn-activity-content]");
  if (existing) return existing;
  const template = activity.querySelector("[data-codex-turn-activity-template]");
  const content = template?.content?.firstElementChild?.cloneNode(true);
  if (!content) return null;
  template.after(content);
  return content;
}

function isActivityContentHidden(content) {
  return content.hidden || content.getAttribute("aria-hidden") === "true";
}

function cancelActivityContentAnimation(content) {
  const cleanup = activityAnimationCleanups.get(content);
  if (!cleanup) return;
  cleanup();
  activityAnimationCleanups.delete(content);
}

function resetActivityContentStyle(content) {
  content.style?.removeProperty("clip-path");
  content.style?.removeProperty("opacity");
  content.style?.removeProperty("overflow");
  content.style?.removeProperty("pointer-events");
  content.style?.removeProperty("transform");
  content.style?.removeProperty("transition");
  content.style?.removeProperty("will-change");
  delete content.dataset.codexActivityAnimating;
  delete content.dataset.codexActivityAnimationToken;
}

function waitForThreadStarted(threadID) {
  if (state.threads.some((thread) => thread.id === threadID)) return Promise.resolve();
  return new Promise((resolve) => {
    threadStartedWaiters.set(threadID, resolve);
  });
}

async function cancelActiveThread() {
  const threadID = state.activeThreadId;
  if (!threadID) return;
  await api.fetchNoContent(`/api/threads/${encodeURIComponent(threadID)}/cancel`, {
    method: "POST",
  });
}

function appendThread(thread) {
  state.threads.unshift(thread);
  const resolve = threadStartedWaiters.get(thread.id);
  if (resolve) {
    threadStartedWaiters.delete(thread.id);
    resolve();
  }
}

function replaceThread(thread) {
  const index = state.threads.findIndex((item) => item.id === thread.id);
  if (index < 0) throw new Error(`Thread not found: ${thread.id}`);
  state.threads[index] = thread;
}

function isActiveThreadRunning() {
  if (state.view !== "thread") return false;
  const thread = state.threads.find((item) => item.id === state.activeThreadId);
  return thread.status.type === "active";
}

})(window);
