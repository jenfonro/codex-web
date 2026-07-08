"use strict";

(function bootstrapCodexPanel(global) {
  const icons = global.CodexIcons;
  const config = global.CodexPanelConfig;
  const api = global.CodexPanelAPI;
  const utils = global.CodexPanelUtils;
  const lifecycle = global.CodexPanelLifecycle;
  const grouping = global.CodexPanelGrouping;
  const store = global.CodexPanelStore;
  const rendererFactory = global.CodexPanelRenderer;
  const panel = document.getElementById("codexPanel");
  if (!panel || !icons || !config || !api || !utils || !lifecycle || !grouping || !store || !rendererFactory) return;

  const EVENT_PAGE_SIZE = 100;
  const FOCUSED_EVENT_PAGE_SIZE = 1600;
  const FOCUSED_TURN_WINDOW_SIZE = 36;
  const FOCUSED_TURN_PRE_CONTEXT = 2;
  const FILE_DETAIL_PAGE_SIZE = 80;
  const LOAD_OLDER_EDGE_PX = 480;
  const SSE_RECONNECT_INITIAL_MS = 1000;
  const SSE_RECONNECT_MAX_MS = 15000;

  const mount = config.createPanelMount(panel);
  const fixtureMode = new URLSearchParams(global.location.search).get("codexFixture") || "";
  const useDynamicFixture = fixtureMode === "dynamic";
  const useReferenceFixture = fixtureMode === "reference";
  const useVirtualFixture = fixtureMode === "virtual-scroll" || fixtureMode === "virtual";
  const useFixtureMode = useDynamicFixture || useReferenceFixture || useVirtualFixture;

  const state = store.createCodexPanelState();

  const runtime = {
    icons,
    config,
    state,
    mount,
    samples: null,
    fixtureModule: null,
    onThreadScroll: maybeLoadOlderEvents,
  };
  const renderer = rendererFactory.create(runtime);
  const renderPanel = renderer.render.bind(renderer);
  let initialized = false;
  let sessionReloadTimer = 0;
  let renderFrame = 0;
  let fileDetailHydrationFrame = 0;

  function render(options = {}) {
    renderPanel(options);
    scheduleVisibleFileDetailHydration();
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
    mount.root.addEventListener("beforeinput", handleBeforeInput);
    mount.root.addEventListener("input", handleInput);
    mount.root.addEventListener("keydown", handleKeyDown);
    global.addEventListener("codex-web:node-selected", handleExternalNodeSelected);
    global.addEventListener("codex-web:open-session", handleExternalOpenSession);
    if (useFixtureMode) {
      let fixtureModule = null;
      try {
        fixtureModule = await loadFixtureModule();
      } catch (error) {
        state.apiAvailable = false;
        state.apiError = `Unable to load Codex panel fixture runtime: ${error.message}`;
        render();
        return;
      }
      if (!fixtureModule?.createSampleData) {
        state.apiAvailable = false;
        state.apiError = "Unable to load Codex panel fixture runtime.";
        render();
        return;
      }
      const referenceAttachmentSrc = await config.loadReferenceAttachmentDataURL();
      runtime.fixtureModule = fixtureModule;
      runtime.samples = fixtureModule.createSampleData({ icons, useDynamicFixture, useVirtualFixture, referenceAttachmentSrc });
      if (useDynamicFixture) {
        useSampleSessions(false);
        state.activeSessionId = "dynamic-running";
        state.view = "thread";
        render();
        return;
      }
      if (useVirtualFixture) {
        useSampleSessions(false);
        state.activeSessionId = "virtual-scroll";
        state.view = "thread";
        render();
        return;
      }
      if (useReferenceFixture) {
        useSampleSessions(false);
        render();
        return;
      }
    }
    await loadNodes();
    await loadSessions();
    subscribeNodeSessions();
    render();
  }

  async function loadNodes() {
    try {
      const payload = await api.fetchJSON("/api/nodes");
      const nodes = api.normalizeNodes(payload.nodes);
      state.nodes = nodes;
      const saved = nodes.find((node) => node.id === state.nodeId && node.online);
      const selected = saved || nodes.find((node) => node.online) || nodes[0];
      if (selected?.id) {
        state.nodeId = selected.id;
        store.setStoredNodeId(state.nodeId);
        state.apiError = "";
      } else {
        state.nodeId = "";
        state.apiAvailable = false;
        state.apiError = "No agent node is available.";
      }
    } catch (error) {
      state.nodes = [];
      state.nodeId = "";
      state.apiAvailable = false;
      state.apiError = `Unable to load agent nodes: ${error.message}`;
    }
  }

  async function loadSessions(preserveEvents = false) {
    if (!state.nodeId) {
      state.apiAvailable = false;
      state.sessions = [];
      if (!preserveEvents) clearLoadedEvents();
      state.apiError ||= "No agent node is selected.";
      return;
    }
    try {
      const payload = await api.fetchJSON(`/api/sessions?nodeId=${encodeURIComponent(state.nodeId)}`);
      const sessions = api.normalizeSessions(payload.sessions);
      state.sessions = sessions;
      if (!preserveEvents) clearLoadedEvents();
      state.apiAvailable = true;
      state.apiError = "";
    } catch (error) {
      state.apiAvailable = false;
      state.apiError = `Unable to load sessions: ${error.message}`;
      if (!preserveEvents) {
        state.sessions = [];
        clearLoadedEvents();
      }
    }
  }

  function useSampleSessions(apiAvailable) {
    if (!runtime.samples) {
      state.sessions = [];
      state.eventsBySession = new Map();
      state.eventPagesBySession = new Map();
      state.apiAvailable = false;
      state.apiError = "Codex panel fixture data is not loaded.";
      return;
    }
    state.sessions = runtime.samples.sessions.slice();
    state.eventsBySession = new Map(runtime.samples.eventsBySession);
    state.eventPagesBySession = new Map();
    state.apiAvailable = apiAvailable;
    state.apiError = "";
  }

  async function loadFixtureModule() {
    if (global.CodexPanelFixtures?.createSampleData) return global.CodexPanelFixtures;
    await loadScript(config.withAssetVersion("app/codex-fixtures.js"), "codex-fixtures");
    return global.CodexPanelFixtures;
  }

  function loadScript(src, key) {
    return new Promise((resolve, reject) => {
      const selector = key ? `script[data-codex-script="${key}"]` : "";
      const existing = selector ? document.querySelector(selector) : null;
      if (existing) {
        if (existing.dataset.loaded === "true") {
          resolve();
          return;
        }
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(`Unable to load ${src}`)), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      if (key) script.dataset.codexScript = key;
      script.addEventListener("load", () => {
        script.dataset.loaded = "true";
        resolve();
      }, { once: true });
      script.addEventListener("error", () => reject(new Error(`Unable to load ${src}`)), { once: true });
      document.head.appendChild(script);
    });
  }

  function clearLoadedEvents() {
    state.eventsBySession = new Map();
    state.eventPagesBySession = new Map();
    state.fileDetailRequests = new Set();
  }

  async function openSession(sessionID, options = {}) {
    state.activeSessionId = sessionID;
    state.view = "thread";
    state.popover = "";
    state.threadWindows.delete(sessionID);
    if (!state.eventsBySession.has(sessionID)) state.eventsBySession.set(sessionID, []);
    render();
    await loadEvents(sessionID);
    await ensureEventRangeLoaded(sessionID, Number(options.focusSeq || 0));
    focusThreadWindow(sessionID, Number(options.focusSeq || 0), Number(options.focusTop));
    subscribeSession(sessionID);
    render();
  }

  async function loadEvents(sessionID) {
    if (!state.apiAvailable) return;
    try {
      const qs = sessionEventParams({ limit: String(EVENT_PAGE_SIZE) });
      const payload = await api.fetchJSON(`/api/sessions/${encodeURIComponent(sessionID)}/events?${qs.toString()}`);
      const events = api.normalizeEvents(payload.events);
      state.eventsBySession.set(sessionID, events);
      updateEventPage(sessionID, payload, events);
      state.apiError = "";
    } catch (error) {
      setSessionError(sessionID, `Unable to load session events: ${error.message}`);
    }
  }

  async function maybeLoadOlderEvents(scroll, windowState = null) {
    if (!state.apiAvailable || state.view !== "thread" || !state.activeSessionId) return;
    if (!scroll) return;
    if (scroll.scrollTop > LOAD_OLDER_EDGE_PX) {
      if (windowState?.suppressHistoryLoadAtTop) windowState.suppressHistoryLoadAtTop = false;
      return;
    }
    if (windowState?.suppressHistoryLoadAtTop) return;
    const sessionID = state.activeSessionId;
    const page = state.eventPagesBySession.get(sessionID);
    if (!sessionHasOlderEvents(sessionID, page) || page?.loadingBefore) return;
    await loadOlderEvents(sessionID);
  }

  async function loadOlderEvents(sessionID) {
    const page = state.eventPagesBySession.get(sessionID) || {};
    if (!sessionHasOlderEvents(sessionID, page) || page.loadingBefore) return;
    const loadingPage = { ...page, hasMoreBefore: true, loadingBefore: true };
    state.eventPagesBySession.set(sessionID, loadingPage);
    renderPreservingThreadScroll();
    try {
      const beforeSeq = firstLoadedSeq(sessionID);
      if (!beforeSeq || beforeSeq <= 1) {
        state.eventPagesBySession.set(sessionID, { ...loadingPage, hasMoreBefore: false, loadingBefore: false, exhaustedBefore: true });
        renderPreservingThreadScroll();
        return;
      }
      const qs = sessionEventParams({
        beforeSeq: String(beforeSeq),
        limit: String(EVENT_PAGE_SIZE),
      });
      const payload = await api.fetchJSON(`/api/sessions/${encodeURIComponent(sessionID)}/events?${qs.toString()}`);
      const olderEvents = api.normalizeEvents(payload.events);
      if (!olderEvents.length) {
        state.eventPagesBySession.set(sessionID, { ...loadingPage, hasMoreBefore: false, loadingBefore: false, exhaustedBefore: true });
        renderPreservingThreadScroll();
        return;
      }
      const events = mergeSessionEvents(olderEvents, state.eventsBySession.get(sessionID) || []);
      markOlderEventsPrepended(sessionID, olderEvents.length);
      state.eventsBySession.set(sessionID, events);
      updateEventPage(sessionID, payload, events);
      renderPreservingThreadScroll();
    } catch {
      state.eventPagesBySession.set(sessionID, { ...loadingPage, loadingBefore: false });
      renderPreservingThreadScroll();
    }
  }

  async function ensureEventRangeLoaded(sessionID, focusSeq) {
    if (!state.apiAvailable || !focusSeq) return;
    await loadEventsNearSeq(sessionID, focusSeq);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const events = state.eventsBySession.get(sessionID) || [];
      const firstSeq = firstSeqOf(events);
      const lastSeq = lastSeqOf(events);
      if (firstSeq && lastSeq && focusSeq >= firstSeq && focusSeq <= lastSeq) return;
      if (lastSeq && focusSeq > lastSeq) return;
      if (!sessionHasOlderEvents(sessionID, state.eventPagesBySession.get(sessionID))) return;
      await loadOlderEvents(sessionID);
    }
  }

  async function loadEventsNearSeq(sessionID, focusSeq) {
    if (!focusSeq) return;
    const events = state.eventsBySession.get(sessionID) || [];
    const firstSeq = firstSeqOf(events);
    const lastSeq = lastSeqOf(events);
    if (firstSeq && lastSeq && firstSeq <= focusSeq - 300 && lastSeq >= focusSeq + 100) return;
    try {
      const qs = sessionEventParams({
        beforeSeq: String(focusSeq + 250),
        limit: String(Math.max(EVENT_PAGE_SIZE, FOCUSED_EVENT_PAGE_SIZE)),
      });
      const payload = await api.fetchJSON(`/api/sessions/${encodeURIComponent(sessionID)}/events?${qs.toString()}`);
      const nearbyEvents = api.normalizeEvents(payload.events);
      if (!nearbyEvents.length) return;
      const merged = mergeSessionEvents(nearbyEvents, events);
      state.eventsBySession.set(sessionID, merged);
      updateEventPage(sessionID, payload, merged);
    } catch {
      // Fall back to incremental older-page loading below.
    }
  }

  function focusThreadWindow(sessionID, focusSeq, focusTop = NaN) {
    if (!focusSeq) return;
    const events = state.eventsBySession.get(sessionID) || [];
    const visibleEvents = lifecycle.visibleConversationEvents(events);
    const page = state.eventPagesBySession.get(sessionID);
    const items = grouping.groupConversationEvents(visibleEvents, { hideLeadingPartial: shouldHideLeadingPartial(page, visibleEvents) });
    const index = items.findIndex((item) => itemContainsSeq(item, focusSeq));
    if (index < 0) return;
    const start = focusedThreadWindowStart(index, items.length);
    const end = Math.min(items.length, start + FOCUSED_TURN_WINDOW_SIZE);
    state.threadWindows.set(sessionID, {
      start,
      end,
      itemCount: items.length,
      stickToBottom: false,
      restoreScrollTop: 0,
      estimates: [],
      focusSeq,
      focusTop: Number.isFinite(focusTop) ? focusTop : null,
      focusLockUntil: Date.now() + 700,
      suppressHistoryLoadAtTop: true,
    });
  }

  function focusedThreadWindowStart(index, itemCount) {
    return Math.max(0, Math.min(index - FOCUSED_TURN_PRE_CONTEXT, Math.max(0, itemCount - 1)));
  }

  function shouldHideLeadingPartial(page, events) {
    if (!Array.isArray(events) || !events.length) return false;
    if (!page?.hasMoreBefore && firstSeqOf(events) <= 1) return false;
    return (events[0]?.kind || "assistant_message") !== "user_message";
  }

  function itemContainsSeq(item, seq) {
    if (!item) return false;
    if (Number(item.event?.seq || 0) === seq) return true;
    return Array.isArray(item.followups) && item.followups.some((event) => Number(event?.seq || 0) === seq);
  }

  function sessionHasOlderEvents(sessionID, page = null) {
    if (page?.exhaustedBefore) return false;
    return Boolean(page?.hasMoreBefore) || firstLoadedSeq(sessionID) > 1;
  }

  function markOlderEventsPrepended(sessionID, count) {
    if (!count) return;
    const windowState = state.threadWindows?.get(sessionID);
    if (!windowState) return;
    const scroll = mount.root.querySelector("[data-thread-scroll]");
    windowState.preserveOnPrepend = true;
    windowState.prependScrollTop = scroll?.scrollTop || 0;
  }

  function updateEventPage(sessionID, payload, events) {
    const eventFirstSeq = firstSeqOf(events);
    const eventLastSeq = lastSeqOf(events);
    const firstSeq = Number(payload.firstSeq || eventFirstSeq || firstLoadedSeq(sessionID) || 0);
    const lastSeq = Math.max(Number(payload.lastSeq || 0), eventLastSeq, latestSeqForSession(sessionID));
    state.eventPagesBySession.set(sessionID, {
      firstSeq,
      lastSeq,
      hasMoreBefore: Boolean(payload.hasMoreBefore),
      exhaustedBefore: !payload.hasMoreBefore && firstSeq > 1,
      loadingBefore: false,
      loaded: true,
    });
  }

  function subscribeNodeSessions() {
    closeNodeEventSource(true);
    if (!state.apiAvailable || !state.nodeId) return;
    const qs = new URLSearchParams({ nodeId: state.nodeId });
    const source = new EventSource(`/api/sessions/events?${qs.toString()}`);
    source.onopen = () => {
      state.nodeEventSourceReconnectDelay = SSE_RECONNECT_INITIAL_MS;
    };
    source.onmessage = (event) => {
      try {
        applyIncomingSessionEvent(api.normalizeEvent(JSON.parse(event.data)));
      } catch {
        // Keep the stream alive if one row is malformed.
      }
    };
    source.onerror = () => {
      if (state.nodeEventSource !== source) return;
      closeNodeEventSource(false);
      scheduleNodeSessionsReconnect();
    };
    state.nodeEventSource = source;
  }

  function subscribeSession(sessionID) {
    closeSessionEventSource(true);
    if (!state.apiAvailable || !sessionID) return;
    state.eventSourceSessionId = sessionID;
    const qs = sessionEventParams({ sessionId: sessionID });
    const lastSeq = latestSeqForSession(sessionID);
    if (lastSeq > 0) qs.set("lastSeq", String(lastSeq));
    const source = new EventSource(`/api/sessions/events?${qs.toString()}`);
    source.onopen = () => {
      state.eventSourceReconnectDelay = SSE_RECONNECT_INITIAL_MS;
    };
    source.onmessage = (event) => {
      try {
        applyIncomingSessionEvent(api.normalizeEvent(JSON.parse(event.data)));
      } catch {
        // Keep the stream alive if one row is malformed.
      }
    };
    source.onerror = () => {
      if (state.eventSource !== source) return;
      source.close();
      state.eventSource = null;
      scheduleSessionReconnect(sessionID);
    };
    state.eventSource = source;
  }

function closeNodeEventSource(clearRetry = true) {
  if (clearRetry && state.nodeEventSourceReconnectTimer) {
    global.clearTimeout(state.nodeEventSourceReconnectTimer);
    state.nodeEventSourceReconnectTimer = 0;
  }
  if (state.nodeEventSource) {
    state.nodeEventSource.close();
    state.nodeEventSource = null;
  }
}

function closeSessionEventSource(clearRetry = true) {
  if (clearRetry && state.eventSourceReconnectTimer) {
    global.clearTimeout(state.eventSourceReconnectTimer);
    state.eventSourceReconnectTimer = 0;
  }
  if (state.eventSource) {
    state.eventSource.close();
    state.eventSource = null;
  }
  if (clearRetry) state.eventSourceSessionId = "";
}

function scheduleNodeSessionsReconnect() {
  if (state.nodeEventSourceReconnectTimer || !state.apiAvailable || !state.nodeId) return;
  const delay = nextNodeReconnectDelay();
  state.nodeEventSourceReconnectTimer = global.setTimeout(async () => {
    state.nodeEventSourceReconnectTimer = 0;
    await loadSessions(true);
    subscribeNodeSessions();
    requestRender();
  }, delay);
}

function scheduleSessionReconnect(sessionID) {
  if (state.eventSourceReconnectTimer || !state.apiAvailable || !sessionID) return;
  if (state.view !== "thread" || state.activeSessionId !== sessionID) return;
  state.eventSourceSessionId = sessionID;
  const delay = nextSessionReconnectDelay();
  state.eventSourceReconnectTimer = global.setTimeout(() => {
    state.eventSourceReconnectTimer = 0;
    if (state.view === "thread" && state.activeSessionId === sessionID) {
      subscribeSession(sessionID);
    }
  }, delay);
}

function nextNodeReconnectDelay() {
  const delay = state.nodeEventSourceReconnectDelay || SSE_RECONNECT_INITIAL_MS;
  state.nodeEventSourceReconnectDelay = Math.min(SSE_RECONNECT_MAX_MS, delay * 2);
  return delay;
}

function nextSessionReconnectDelay() {
  const delay = state.eventSourceReconnectDelay || SSE_RECONNECT_INITIAL_MS;
  state.eventSourceReconnectDelay = Math.min(SSE_RECONNECT_MAX_MS, delay * 2);
  return delay;
}

function sessionEventParams(params = {}) {
  return new URLSearchParams({
    nodeId: state.nodeId,
    compact: "true",
    ...params,
  });
}

function scheduleVisibleFileDetailHydration() {
  if (fileDetailHydrationFrame || state.view !== "thread" || !state.activeSessionId) return;
  fileDetailHydrationFrame = global.requestAnimationFrame(() => {
    fileDetailHydrationFrame = 0;
    const seqs = visibleFileDetailSeqs();
    if (seqs.length) void hydrateFileDetailsForSeqs(state.activeSessionId, seqs, captureThreadScroll());
  });
}

function visibleFileDetailSeqs() {
  const seqs = [];
  const seen = new Set();
  const containers = Array.from(mount.root.querySelectorAll([
    "[data-codex-focus-turn='true']",
    "[data-codex-virtual-turn]",
    "[data-disclosure-body][aria-hidden='false']",
  ].join(",")));
  for (const container of containers) {
    for (const seq of eventSeqsInsideElement(container)) {
      if (seen.has(seq)) continue;
      seen.add(seq);
      seqs.push(seq);
    }
  }
  return seqs;
}

function eventSeqsInsideElement(element) {
  const seqs = [];
  const seen = new Set();
  const nodes = [
    element,
    ...Array.from(element?.querySelectorAll?.("[data-codex-event-seq], [data-codex-event-seqs]") || []),
  ].filter(Boolean);
  for (const node of nodes) {
    for (const name of ["codexEventSeq", "codexEventSeqs"]) {
      const value = node.dataset?.[name];
      if (!value) continue;
      for (const seq of parseSeqList(value)) {
        if (seen.has(seq)) continue;
        seen.add(seq);
        seqs.push(seq);
      }
    }
  }
  return seqs;
}

async function hydrateFileDetailsForSeqs(sessionID, seqs, threadScrollIntent = null) {
  if (!state.apiAvailable || !sessionID || !Array.isArray(seqs) || !seqs.length) return;
  const events = state.eventsBySession.get(sessionID) || [];
  const wantedSeqs = seqs
    .map((seq) => events.find((event) => Number(event.seq || 0) === seq))
    .filter(eventNeedsFileDetails)
    .map((event) => Number(event.seq || 0))
    .filter((seq) => seq > 0);
  if (!wantedSeqs.length) return;

  for (const range of eventSeqRanges(wantedSeqs)) {
    const requestKey = `${sessionID}:${range.start}:${range.end}`;
    if (state.fileDetailRequests.has(requestKey)) continue;
    state.fileDetailRequests.add(requestKey);
    try {
      const qs = sessionEventParams({
        beforeSeq: String(range.end + 1),
        limit: String(range.end - range.start + 1),
        fileDetails: "true",
      });
      const payload = await api.fetchJSON(`/api/sessions/${encodeURIComponent(sessionID)}/events?${qs.toString()}`);
      const detailedEvents = api.normalizeEvents(payload.events);
      if (!detailedEvents.length) continue;
      const currentEvents = state.eventsBySession.get(sessionID) || [];
      state.eventsBySession.set(sessionID, mergeSessionEvents(currentEvents, detailedEvents));
      render({ threadScrollIntent: captureThreadScroll() || threadScrollIntent });
    } catch (error) {
      setSessionError(sessionID, `Unable to load file details: ${error.message}`);
    } finally {
      state.fileDetailRequests.delete(requestKey);
    }
  }
}

function eventSeqsFromElement(element) {
  const seqs = [];
  const seen = new Set();
  for (let node = element; node && node !== mount.root; node = node.parentElement) {
    for (const name of ["codexEventSeq", "codexEventSeqs", "codexTurnSeqs"]) {
      const value = node.dataset?.[name];
      if (!value) continue;
      for (const seq of parseSeqList(value)) {
        if (seen.has(seq)) continue;
        seen.add(seq);
        seqs.push(seq);
      }
    }
    if (seqs.length) break;
  }
  return seqs;
}

function parseSeqList(value) {
  return String(value || "")
    .split(/[,\s]+/)
    .map((item) => Number(item || 0))
    .filter((seq) => seq > 0);
}

function eventNeedsFileDetails(event) {
  if (!event || event.kind !== "file_change") return false;
  const files = Array.isArray(event?.data?.files) ? event.data.files : [];
  return files.some((file) => file?.detailOmitted && !file?.unifiedDiff && !file?.content);
}

function eventSeqRanges(seqs) {
  const sorted = Array.from(new Set(seqs)).sort((a, b) => a - b);
  const ranges = [];
  let start = 0;
  let end = 0;
  for (const seq of sorted) {
    if (!start) {
      start = seq;
      end = seq;
      continue;
    }
    if (seq <= end + 1 && (seq - start + 1) <= FILE_DETAIL_PAGE_SIZE) {
      end = seq;
      continue;
    }
    ranges.push({ start, end });
    start = seq;
    end = seq;
  }
  if (start) ranges.push({ start, end });
  return ranges;
}

function applyIncomingSessionEvent(incoming) {
  if (!incoming?.sessionId) return;
  state.apiError = "";
  const events = state.eventsBySession.get(incoming.sessionId) || [];
  if (hasSessionEvent(events, incoming)) return;
  state.eventsBySession.set(incoming.sessionId, mergeSessionEvents(events, [incoming]));
  touchEventPage(incoming.sessionId, incoming);
  if (!updateSessionFromEvent(incoming)) scheduleSessionReload();
  if (state.view === "list" || state.activeSessionId === incoming.sessionId) requestRender();
}

function hasSessionEvent(events, incoming) {
  const seq = Number(incoming.seq || 0);
  if (seq > 0) return events.some((event) => Number(event.seq || 0) === seq && !event.local);
  return events.some((event) =>
    !event.local &&
    event.kind === incoming.kind &&
    event.time === incoming.time &&
    event.text === incoming.text
  );
}

function latestSeqForSession(sessionID) {
  return store.knownLastSeq(state, sessionID);
}

function firstLoadedSeq(sessionID) {
  return firstSeqOf(state.eventsBySession.get(sessionID) || []);
}

function firstSeqOf(events) {
  return events.reduce((first, event) => {
    const seq = Number(event.seq || 0);
    if (!seq) return first;
    return first ? Math.min(first, seq) : seq;
  }, 0);
}

function lastSeqOf(events) {
  return events.reduce((last, event) => Math.max(last, Number(event.seq || 0)), 0);
}

function mergeSessionEvents(...groups) {
  const byKey = new Map();
  for (const events of groups) {
    for (const event of events || []) {
      const key = sessionEventKey(event);
      const existing = byKey.get(key);
      if (!existing || shouldReplaceSessionEvent(existing, event)) {
        byKey.set(key, event);
      }
    }
  }
  return Array.from(byKey.values()).sort(compareEvents);
}

function shouldReplaceSessionEvent(existing, candidate) {
  if (existing?.local && !candidate?.local) return true;
  if (!existing?.local && candidate?.local) return false;
  return true;
}

function sessionEventKey(event) {
  const seq = Number(event?.seq || 0);
  if (seq > 0) return `seq:${seq}`;
  return `event:${event?.kind || ""}:${event?.time || ""}:${event?.text || ""}`;
}

function compareEvents(a, b) {
  const aSeq = Number(a?.seq || 0);
  const bSeq = Number(b?.seq || 0);
  if (aSeq && bSeq && aSeq !== bSeq) return aSeq - bSeq;
  return String(a?.time || "").localeCompare(String(b?.time || ""));
}

function touchEventPage(sessionID, event) {
  const page = state.eventPagesBySession.get(sessionID);
  if (!page) return;
  const seq = Number(event?.seq || 0);
  if (!seq) return;
  state.eventPagesBySession.set(sessionID, {
    ...page,
    firstSeq: page.firstSeq ? Math.min(page.firstSeq, seq) : seq,
    lastSeq: Math.max(page.lastSeq || 0, seq),
  });
}

function requestRender() {
  if (renderFrame) return;
  renderFrame = global.requestAnimationFrame(() => {
    renderFrame = 0;
    render();
  });
}

function updateSessionFromEvent(event) {
  const index = state.sessions.findIndex((session) => session.id === event.sessionId);
  if (index < 0) return false;
  const session = state.sessions[index];
  const status = lifecycle.sessionStatusFromEvent(event, session.status);
  const updatedAt = event.time || session.updatedAt || new Date().toISOString();
  const lastSeq = Math.max(Number(session.lastSeq || 0), Number(event.seq || 0));
  state.sessions[index] = {
    ...session,
    status,
    updatedAt,
    lastSeq,
    timeLabel: utils.relativeTime(updatedAt),
  };
  state.sessions.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return true;
}

function scheduleSessionReload() {
  if (sessionReloadTimer) return;
  sessionReloadTimer = global.setTimeout(async () => {
    sessionReloadTimer = 0;
    await loadSessions(true);
    render();
  }, 500);
}

function renderPreservingThreadScroll() {
  render({ threadScrollIntent: captureThreadScroll() });
}

function captureDisclosureAnchor(disclosureButton) {
  const scroll = mount.root.querySelector("[data-thread-scroll]");
  const key = disclosureButton?.dataset?.disclosureToggle || "";
  if (!scroll || !key) return captureThreadScroll();
  const buttonRect = disclosureButton.getBoundingClientRect();
  const scrollRect = scroll.getBoundingClientRect();
  return {
    kind: "disclosure-anchor",
    key,
    offsetTop: buttonRect.top - scrollRect.top,
    fallback: captureThreadScroll(),
  };
}

function captureThreadScroll() {
  const scroll = mount.root.querySelector("[data-thread-scroll]");
  if (!scroll) return null;
  return {
    kind: "thread-scroll",
    scrollTop: scroll.scrollTop,
    scrollHeight: scroll.scrollHeight,
    anchor: captureVisibleThreadAnchor(scroll),
  };
}

function captureVisibleThreadAnchor(scroll) {
  const scrollRect = scroll.getBoundingClientRect();
  const turns = Array.from(mount.root.querySelectorAll("[data-codex-virtual-turn]"));
  for (const turn of turns) {
    const rect = turn.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (rect.bottom <= scrollRect.top + 16 || rect.top >= scrollRect.bottom - 16) continue;
    const seq = firstSeqFromTurn(turn);
    const turnKey = turn.querySelector("[data-turn-key]")?.getAttribute("data-turn-key") || "";
    if (!seq && !turnKey) continue;
    return {
      seq,
      turnKey,
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

function handleClick(event) {
  const disclosureButton = event.target.closest("[data-disclosure-toggle]");
  const nodeOption = event.target.closest("[data-codex-node-id]");
  const popoverButton = event.target.closest("[data-popover]");
  const action = event.target.closest("[data-action]")?.dataset.action;
  const sessionRow = event.target.closest("[data-codex-session-id]");
  const resourceButton = event.target.closest("[data-codex-resource-url]");

  if (nodeOption) {
    void switchNode(nodeOption.dataset.codexNodeId);
    return;
  }

  if (disclosureButton) {
    const key = disclosureButton.dataset.disclosureToggle;
    if (key) {
      const current = state.disclosures.get(key) ?? disclosureButton.getAttribute("aria-expanded") === "true";
      const expanded = !current;
      const seqs = expanded ? eventSeqsFromElement(disclosureButton) : [];
      const threadScrollIntent = captureDisclosureAnchor(disclosureButton);
      state.disclosures.set(key, expanded);
      render({ threadScrollIntent });
      if (expanded) void hydrateFileDetailsForSeqs(state.activeSessionId, seqs, threadScrollIntent);
    }
    return;
  }

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
    closeSessionEventSource();
    render();
    return;
  }

  if (action === "send") {
    void submitComposer();
    return;
  }

  if (resourceButton) {
    openResourceURL(resourceButton.dataset.codexResourceUrl);
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

function openResourceURL(value) {
  const url = String(value || "").trim();
  if (!url) return;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;
    global.open(parsed.href, "_blank", "noopener,noreferrer");
  } catch {
    // Ignore malformed resource links emitted by older session data.
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
  if (!input || !String(event.inputType || "").startsWith("delete")) return;
  if (renderer.composerText(input)) return;
  event.preventDefault();
  renderer.clearComposer(input);
  renderer.syncComposerState();
}

async function submitComposer() {
  const input = mount.root.querySelector("[data-codex-composer]");
  const prompt = renderer.composerText(input);
  if (!prompt) return;

  if (state.view === "thread" && state.activeSessionId) {
    renderer.clearComposer(input);
    renderer.syncComposerState();
    appendLocalEvent(state.activeSessionId, { kind: "user_message", text: prompt });
    render();
    if (!state.apiAvailable && !useFixtureMode) {
      appendLocalEvent(state.activeSessionId, { kind: "error", text: state.apiError || "Agent connection is not available." });
      render();
      return;
    }
    if (state.apiAvailable) {
      try {
        const payload = await api.fetchJSON(`/api/sessions/${encodeURIComponent(state.activeSessionId)}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodeId: state.nodeId, prompt }),
        });
        upsertSession(api.normalizeSession(payload.session));
        state.apiError = "";
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

  if (!state.apiAvailable && !useFixtureMode) {
    state.apiError = state.apiError || "Agent connection is not available.";
    render();
    return;
  }

  if (state.apiAvailable) {
    renderer.clearComposer(input);
    renderer.syncComposerState();
    try {
      const payload = await api.fetchJSON("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: state.nodeId, prompt }),
      });
      const session = api.normalizeSession(payload.session);
      if (session?.id) {
        upsertSession(session);
        state.eventsBySession.set(session.id, [{
          sessionId: session.id,
          kind: "user_message",
          text: prompt,
          seq: Math.max(1, Number(session.lastSeq || 1)),
          time: new Date().toISOString(),
          local: true,
        }]);
        await openSession(session.id);
      }
    } catch (error) {
      state.apiError = `Unable to create session: ${error.message}`;
      render();
    }
  } else {
    renderer.clearComposer(input);
    renderer.syncComposerState();
    createFixtureSession(prompt);
  }
}

async function switchNode(nodeID) {
  const node = state.nodes.find((item) => item.id === nodeID);
  if (!node || !node.online) return;
  state.popover = "";
  if (node.id === state.nodeId) {
    render();
    return;
  }
  closeNodeEventSource();
  closeSessionEventSource();
  state.nodeId = node.id;
  store.setStoredNodeId(node.id);
  state.view = "list";
  state.activeSessionId = "";
  state.sessions = [];
  clearLoadedEvents();
  state.threadWindows.clear();
  state.disclosures.clear();
  state.apiAvailable = true;
  state.apiError = "";
  render();
  try {
    await api.fetchJSON("/api/nodes/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId: node.id }),
    });
    await loadSessions();
    subscribeNodeSessions();
  } catch (error) {
    state.apiAvailable = false;
    state.apiError = `Unable to switch node: ${error.message}`;
  }
  render();
}

  async function handleExternalNodeSelected(event) {
    const nodeID = String(event.detail?.nodeId || "");
    if (!nodeID) return;
    if (!state.nodes.some((item) => item.id === nodeID)) {
      await loadNodes();
    }
    await switchNode(nodeID);
  }

  async function handleExternalOpenSession(event) {
    const nodeID = String(event.detail?.nodeId || "");
    const sessionID = String(event.detail?.sessionId || "");
    const focusSeq = Number(event.detail?.focusSeq || 0);
    const focusTop = Number(event.detail?.focusTop);
    if (!sessionID) return;
    if (nodeID) {
      if (!state.nodes.some((item) => item.id === nodeID)) await loadNodes();
      await switchNode(nodeID);
    }
    if (!state.sessions.some((session) => session.id === sessionID)) {
      await loadSessions(true);
    }
    await openSession(sessionID, { focusSeq, focusTop });
  }

function createFixtureSession(prompt, errorText = "") {
  const createInteractiveSession = runtime.fixtureModule?.createInteractiveSession;
  if (!createInteractiveSession) {
    state.apiError = "Codex panel fixture session creator is not loaded.";
    render();
    return;
  }
  createInteractiveSession({ state, utils, prompt, errorText, openSession });
}

function upsertSession(session) {
  if (!session?.id) return;
  const index = state.sessions.findIndex((item) => item.id === session.id);
  if (index >= 0) {
    state.sessions[index] = {
      ...state.sessions[index],
      ...session,
      lastSeq: Math.max(Number(state.sessions[index].lastSeq || 0), Number(session.lastSeq || 0)),
    };
  } else {
    state.sessions.unshift(session);
  }
  state.sessions.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function appendLocalEvent(sessionID, partial) {
  const events = state.eventsBySession.get(sessionID) || [];
  const event = { ...partial, sessionId: sessionID, seq: store.nextLocalEventSeq(state, sessionID), time: partial.time || new Date().toISOString(), local: true };
  state.eventsBySession.set(sessionID, mergeSessionEvents(events, [event]));
  updateSessionFromEvent(event);
}

function setSessionError(sessionID, message) {
  const events = state.eventsBySession.get(sessionID) || [];
  const errorEvent = {
    kind: "error",
    sessionId: sessionID,
    text: message,
    seq: store.nextLocalEventSeq(state, sessionID),
    time: new Date().toISOString(),
    local: true,
  };
  state.eventsBySession.set(sessionID, mergeSessionEvents(events, [errorEvent]));
  updateSessionFromEvent(errorEvent);
}

})(window);
