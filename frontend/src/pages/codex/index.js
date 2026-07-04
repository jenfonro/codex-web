"use strict";

(function bootstrapCodexPanel(global) {
  const icons = global.CodexIcons;
  const config = global.CodexPanelConfig;
  const api = global.CodexPanelAPI;
  const fixtures = global.CodexPanelFixtures;
  const utils = global.CodexPanelUtils;
  const store = global.CodexPanelStore;
  const rendererFactory = global.CodexPanelRenderer;
  const panel = document.getElementById("codexPanel");
  if (!panel || !icons || !config || !api || !fixtures || !utils || !store || !rendererFactory) return;

  const mount = config.createPanelMount(panel);
  const fixtureMode = new URLSearchParams(global.location.search).get("codexFixture") || "";
  const useDynamicFixture = fixtureMode === "dynamic";
  const useReferenceFixture = fixtureMode === "reference";

  const state = store.createCodexPanelState();

  const runtime = {
    icons,
    config,
    state,
    mount,
    samples: fixtures.createSampleData({ icons, useDynamicFixture, referenceAttachmentSrc: config.USER_ATTACHMENT_PLACEHOLDER }),
  };
  const renderer = rendererFactory.create(runtime);
  let initialized = false;

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
    const referenceAttachmentSrc = await config.loadReferenceAttachmentDataURL();
    runtime.samples = fixtures.createSampleData({ icons, useDynamicFixture, referenceAttachmentSrc });
    if (useDynamicFixture) {
      useSampleSessions(false);
      state.activeSessionId = "dynamic-running";
      state.view = "thread";
      renderer.render();
      return;
    }
    if (useReferenceFixture) {
      useSampleSessions(false);
      renderer.render();
      return;
    }
    await loadNodes();
    await loadSessions();
    renderer.render();
  }

  async function loadNodes() {
    try {
      const payload = await api.fetchJSON("/api/nodes");
      const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
      const saved = nodes.find((node) => node.id === state.nodeId && node.online);
      const selected = saved || nodes.find((node) => node.online) || nodes[0];
      if (selected?.id) {
        state.nodeId = selected.id;
        store.setStoredNodeId(state.nodeId);
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
      const payload = await api.fetchJSON(`/api/sessions?nodeId=${encodeURIComponent(state.nodeId)}`);
      const sessions = api.normalizeSessions(payload.sessions);
      state.sessions = sessions;
      state.eventsBySession = new Map();
      state.apiAvailable = true;
    } catch {
      useSampleSessions(false);
    }
  }

  function useSampleSessions(apiAvailable) {
    state.sessions = runtime.samples.sessions.slice();
    state.eventsBySession = new Map(runtime.samples.eventsBySession);
    state.apiAvailable = apiAvailable;
  }

  async function openSession(sessionID) {
    state.activeSessionId = sessionID;
    state.view = "thread";
    state.popover = "";
    await loadEvents(sessionID);
    subscribeSession(sessionID);
    renderer.render();
  }

  async function loadEvents(sessionID) {
    if (!state.apiAvailable) return;
    try {
      const payload = await api.fetchJSON(`/api/sessions/${encodeURIComponent(sessionID)}/events?nodeId=${encodeURIComponent(state.nodeId)}`);
      const events = api.normalizeEvents(payload.events);
      if (events.length) state.eventsBySession.set(sessionID, events);
    } catch {
      if (!state.eventsBySession.has(sessionID)) {
        state.eventsBySession.set(sessionID, runtime.samples.eventsBySession.get("thread-reference") || []);
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
        const incoming = api.normalizeEvent(JSON.parse(event.data));
        const events = state.eventsBySession.get(sessionID) || [];
        if (!events.some((item) => item.seq === incoming.seq && incoming.seq != null)) {
          events.push(incoming);
          state.eventsBySession.set(sessionID, events);
          if (state.view === "thread" && state.activeSessionId === sessionID) renderer.render();
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

function handleClick(event) {
  const popoverButton = event.target.closest("[data-popover]");
  const action = event.target.closest("[data-action]")?.dataset.action;
  const sessionRow = event.target.closest("[data-codex-session-id]");

  if (popoverButton) {
    const name = popoverButton.dataset.popover;
    state.popover = state.popover === name ? "" : name;
    renderer.render();
    return;
  }

  if (action === "back" || action === "new-chat") {
    state.view = "list";
    state.activeSessionId = "";
    state.popover = "";
    if (state.eventSource) state.eventSource.close();
    state.eventSource = null;
    renderer.render();
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
    renderer.render();
  }
}

function handleInput(event) {
  if (event.target.matches("[data-codex-composer]")) renderer.syncComposerState();
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
  renderer.clearComposer(input);
  renderer.syncComposerState();

  if (state.view === "thread" && state.activeSessionId) {
    appendLocalEvent(state.activeSessionId, { kind: "user_message", text: prompt });
    renderer.render();
    if (state.apiAvailable) {
      try {
        await api.fetchJSON(`/api/sessions/${encodeURIComponent(state.activeSessionId)}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodeId: state.nodeId, prompt }),
        });
      } catch (error) {
        appendLocalEvent(state.activeSessionId, { kind: "error", text: error.message });
        renderer.render();
      }
    } else {
      appendLocalEvent(state.activeSessionId, { kind: "turn_started", text: "正在思考" });
      appendLocalEvent(state.activeSessionId, { kind: "assistant_message", text: "我会按当前参考样式继续处理这个请求。", time: new Date().toISOString() });
      renderer.render();
    }
    return;
  }

  if (state.apiAvailable) {
    try {
      const payload = await api.fetchJSON("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId: state.nodeId, prompt }),
      });
      const session = api.normalizeSession(payload.session);
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
    title: utils.trimTitle(prompt),
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

})(window);
