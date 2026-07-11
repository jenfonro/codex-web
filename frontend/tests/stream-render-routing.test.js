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

function officialTurn(status, items) {
  return {
    id: "turn-1",
    items,
    itemsView: "full",
    status,
    error: null,
    startedAt: null,
    completedAt: null,
    durationMs: null,
  };
}

function officialThread(status, turns) {
  return {
    id: "s1",
    extra: null,
    sessionId: "s1",
    forkedFromId: null,
    parentThreadId: null,
    preview: "",
    ephemeral: false,
    historyMode: "legacy",
    modelProvider: "openai",
    createdAt: 1783555200,
    updatedAt: 1783555200,
    recencyAt: null,
    status: { type: status, activeFlags: status === "active" ? [] : undefined },
    path: null,
    cwd: "/workspace",
    cliVersion: "0.144.1",
    source: "appServer",
    threadSource: "codexWeb",
    agentNickname: null,
    agentRole: null,
    gitInfo: null,
    name: "Thread",
    turns,
  };
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
      if (url === "/api/threads") {
        return [officialThread("active", [])];
      }
      throw new Error(`unexpected URL ${url}`);
    },
  },
  CodexPanelUtils: {
    relativeTime() { return ""; },
  },
  CodexPanelLifecycle: {},
  CodexPanelStore: {
    createCodexPanelState() {
      return {
        view: "list",
        popover: "",
        modelMenuExpanded: false,
        threads: [],
        activeThreadId: "",
        threadEventSource: null,
        threadListEventSource: null,
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
    dataset: { codexThreadId: "s1" },
    closest(selector) {
      if (selector === "[data-codex-thread-id]") return row;
      return null;
    },
  };
  click({ target: row });
  await flush();
  await flush();

  const threadSource = eventSources.find((source) => source.url.includes("threadId=s1"));
  threadSource.onmessage({ data: JSON.stringify({
    type: "state",
    threadId: "s1",
    data: officialThread("active", [officialTurn("inProgress", [
      { id: "user-1", type: "userMessage", clientId: null, content: [{ type: "text", text: "hello", text_elements: [] }] },
      { id: "agent-1", type: "agentMessage", text: "Hel", phase: "final_answer", memoryCitation: null },
    ])]),
  }) });
  await flush();

  const rendersBeforeStream = renderCalls.length;
  const update = {
    type: "turnUpdated",
    threadId: "s1",
    data: officialTurn("inProgress", [
        { id: "user-1", type: "userMessage", clientId: null, content: [{ type: "text", text: "hello", text_elements: [] }] },
        { id: "agent-1", type: "agentMessage", text: "Hello", phase: "final_answer", memoryCitation: null },
    ]),
  };

  threadSource.onmessage({ data: JSON.stringify(update) });
  await flush();

  assert.strictEqual(renderCalls.length, rendersBeforeStream + 1, "streaming update should schedule one unified render");

  const activeThread = rendererRuntime.state.threads.find((thread) => thread.id === "s1");
  assert.strictEqual(activeThread.turns[0].items[1].text, "Hello", "streaming turn should replace the previous turn state");

  const completedUpdate = {
    type: "turnUpdated",
    threadId: "s1",
    data: officialTurn("completed", [
        { id: "user-1", type: "userMessage", clientId: null, content: [{ type: "text", text: "hello", text_elements: [] }] },
        { id: "agent-1", type: "agentMessage", text: "Hello", phase: "final_answer", memoryCitation: null },
    ]),
  };

  threadSource.onmessage({ data: JSON.stringify(completedUpdate) });
  await flush();

  assert.strictEqual(renderCalls.length, rendersBeforeStream + 2, "completion update should schedule one unified render");
  assert.strictEqual(activeThread.turns[0].items[1].text, "Hello", "completed turn should contain the final text");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
