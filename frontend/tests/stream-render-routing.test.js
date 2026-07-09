"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const listeners = new Map();
const eventSources = [];
const renderCalls = [];
let rendererRuntime = null;

class FakeEventSource {
  constructor(url) {
    this.url = url;
    this.closed = false;
    eventSources.push(this);
  }

  close() {
    this.closed = true;
  }
}

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

const rootNode = {
  addEventListener(type, handler) {
    listeners.set(type, handler);
  },
  querySelector() {
    return null;
  },
};

const context = {
  window: null,
  document: {
    readyState: "complete",
    getElementById(id) {
      return id === "codexPanel" ? {} : null;
    },
    addEventListener() {},
  },
  EventSource: FakeEventSource,
  URLSearchParams,
  setTimeout,
  clearTimeout,
  requestAnimationFrame(callback) {
    callback();
  },
  location: { search: "" },
  CodexIcons: { svg() { return ""; } },
  CodexPanelConfig: {
    createPanelMount() {
      return { root: rootNode, shadow: {} };
    },
  },
  CodexPanelAPI: {
    async fetchJSON(url) {
      if (url === "/api/sessions") {
        return { sessions: [{ id: "s1", title: "Session", status: "running", updatedAt: "2026-07-09T00:00:00Z" }] };
      }
      if (url === "/api/sessions/s1/state") {
        return {
          session: { id: "s1", title: "Session", status: "running", updatedAt: "2026-07-09T00:00:00Z" },
          lastSeq: 1,
          turns: [{
            id: "turn-1",
            status: "running",
            items: [
              { id: "user-1", type: "userMessage", text: "hello", status: "completed" },
              { id: "agent-1", type: "agentMessage", text: "Hel", status: "running", phase: "final_answer" },
            ],
          }],
        };
      }
      throw new Error(`unexpected URL ${url}`);
    },
    parseSessions(value) { return value; },
    parseSession(value) { return value; },
    parseSessionState(value) { return value; },
    parseStateUpdate(value) { return value; },
  },
  CodexPanelUtils: {
    relativeTime() { return ""; },
  },
  CodexPanelLifecycle: {},
  CodexPanelStore: {
    createCodexPanelState() {
      return {
        view: "list",
        apiAvailable: false,
        popover: "",
        modelMenuExpanded: false,
        sessions: [],
        activeSessionId: "",
        statesBySession: new Map(),
        appliedSeqBySession: new Map(),
        eventSource: null,
        sessionEventSource: null,
      };
    },
  },
  CodexPanelRenderer: {
    create(runtime) {
      rendererRuntime = runtime;
      return {
        render() { renderCalls.push("render"); },
        syncComposerState() {},
        composerText() { return ""; },
        clearComposer() {},
      };
    },
  },
};
context.window = context;
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(root, "src", "pages", "codex", "index.js"), "utf8"),
  context,
  { filename: "index.js" },
);

(async () => {
  await flush();
  await flush();

  const click = listeners.get("click");
  assert.ok(click, "click listener should be registered");

  const row = {
    dataset: { codexSessionId: "s1" },
    closest(selector) {
      if (selector === "[data-codex-session-id]") return row;
      return null;
    },
  };
  click({ target: row });
  await flush();
  await flush();

  const rendersBeforeStream = renderCalls.length;
  const update = {
    type: "item",
    sessionId: "s1",
    seq: 2,
    session: { id: "s1", title: "Session", status: "running", updatedAt: "2026-07-09T00:00:01Z" },
    turn: {
      id: "turn-1",
      status: "running",
      items: [{ id: "agent-1", type: "agentMessage", text: "Hello", status: "running", phase: "final_answer" }],
    },
    item: { id: "agent-1", type: "agentMessage", text: "Hello", status: "running", phase: "final_answer" },
  };

  for (const source of eventSources) {
    source.onmessage?.({ data: JSON.stringify(update) });
  }
  await flush();

  assert.strictEqual(renderCalls.length, rendersBeforeStream + 1, "streaming update should schedule one unified render");

  const activeState = rendererRuntime.state.statesBySession.get("s1");
  assert.strictEqual(activeState.turns[0].items[1].text, "Hello", "streaming text should be merged into item state");

  const completedUpdate = {
    type: "item",
    sessionId: "s1",
    seq: 3,
    turn: { id: "turn-1", status: "completed" },
    item: { id: "agent-1", type: "agentMessage", status: "completed", phase: "final_answer" },
  };

  for (const source of eventSources) {
    source.onmessage?.({ data: JSON.stringify(completedUpdate) });
  }
  await flush();

  assert.strictEqual(renderCalls.length, rendersBeforeStream + 2, "completion update should schedule one unified render");
  assert.strictEqual(activeState.turns[0].items[1].text, "Hello", "completion without text should not erase streamed text");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
