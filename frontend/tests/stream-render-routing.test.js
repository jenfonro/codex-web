"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const listeners = new Map();
const eventSources = [];
const renderCalls = [];
const animationFrames = new Map();
let nextAnimationFrame = 0;
let animationNow = 0;
let rendererRuntime = null;
let resizeObserver = null;
let activityState = "closed";
let activityAriaExpanded = "false";
let activityAriaHidden = "true";
let activityContentConnected = false;
const turnNode = {};
const activityContentListeners = new Map();
function createStyle() {
  return {
    clipPath: "",
    height: "",
    opacity: "",
    overflow: "",
    pointerEvents: "",
    transform: "",
    transition: "",
    willChange: "",
    removeProperty(name) {
      this[name.replace(/-([a-z])/g, (_, value) => value.toUpperCase())] = "";
    },
  };
}
const activityContent = {
  dataset: {},
  hidden: false,
  offsetHeight: 0,
  scrollHeight: 60,
  style: createStyle(),
  addEventListener(type, callback) {
    activityContentListeners.set(type, callback);
  },
  removeEventListener(type, callback) {
    if (activityContentListeners.get(type) === callback) activityContentListeners.delete(type);
  },
  dispatchTransitionEnd(propertyName = "transform") {
    activityContentListeners.get("transitionend")?.({ target: this, propertyName });
  },
  getBoundingClientRect() {
    return { height: Number.parseFloat(this.style.height) || this.scrollHeight };
  },
  getAttribute(name) {
    if (name === "aria-hidden") return activityAriaHidden;
    return null;
  },
  remove() {
    activityContentConnected = false;
    threadScroll.scrollHeight = 1000;
  },
  setAttribute(name, value) {
    if (name === "aria-hidden") activityAriaHidden = value;
  },
};
const activityTemplate = {
  content: {
    firstElementChild: {
      cloneNode() {
        return activityContent;
      },
    },
  },
  after(node) {
    if (node === activityContent) {
      activityContentConnected = true;
      threadScroll.scrollHeight = 1060;
    }
  },
};
const threadScroll = {
  scrollTop: 700,
  scrollHeight: 1000,
  clientHeight: 300,
};
const activity = {
  dataset: {
    get state() { return activityState; },
    set state(value) { activityState = value; },
  },
  closest(selector) {
    if (selector === "[data-thread-scroll]") return threadScroll;
    if (selector === "[data-turn-key], [data-codex-turn-key], [data-turn-id]") return turnNode;
    return null;
  },
  querySelector(selector) {
    if (selector === "[data-codex-turn-activity-content]") return activityContentConnected ? activityContent : null;
    if (selector === "[data-codex-turn-activity-template]") return activityTemplate;
    return null;
  },
};
const activityToggle = {
  isConnected: true,
  documentTop: 750,
  closest(selector) {
    if (selector === "[data-codex-turn-activity]") return activity;
    return null;
  },
  getBoundingClientRect() {
    return { top: this.documentTop - threadScroll.scrollTop };
  },
  setAttribute(name, value) {
    if (name === "aria-expanded") activityAriaExpanded = value;
  },
};

class FakeResizeObserver {
  constructor(callback) {
    this.callback = callback;
    this.observed = null;
    resizeObserver = this;
  }

  observe(node) {
    this.observed = node;
  }

  disconnect() {
    this.observed = null;
  }

  trigger() {
    this.callback();
  }
}

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

function flushAnimationFrame() {
  const [id, callback] = animationFrames.entries().next().value;
  animationFrames.delete(id);
  animationNow += 250;
  callback();
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

function officialThread(status) {
  return {
    id: "s1",
    preview: "",
    updatedAt: 1783555200,
    status: { type: status, activeFlags: status === "active" ? [] : undefined },
    name: "Thread",
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
    nextAnimationFrame += 1;
    animationFrames.set(nextAnimationFrame, callback);
    return nextAnimationFrame;
  },
  cancelAnimationFrame(id) {
    animationFrames.delete(id);
  },
  performance: {
    now() { return animationNow; },
  },
  ResizeObserver: FakeResizeObserver,
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
        return [officialThread("active")];
      }
      if (url === "/api/threads/s1/state") {
        return {
          thread: officialThread("active"),
          history: {
            turns: [officialTurn("inProgress", [
              { id: "user-1", type: "userMessage", clientId: null, content: [{ type: "text", text: "hello", text_elements: [] }] },
              { id: "agent-1", type: "agentMessage", text: "Hel", phase: "final_answer", memoryCitation: null },
            ])],
          },
        };
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
        turnErrors: [],
        activeThreadId: "",
        threadHistory: {
          turns: [],
          loading: false,
        },
        threadEventSource: null,
        threadListEventSource: null,
      };
    },
  },
  CodexPanelRenderer: {
    create(runtime) {
      rendererRuntime = runtime;
      return {
        render() {
          renderCalls.push("render");
        },
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

  click({
    target: {
      closest(selector) {
        if (selector === "[data-codex-turn-activity-toggle]") return activityToggle;
        return null;
      },
    },
  });
  assert.strictEqual(activityState, "open");
  assert.strictEqual(activityAriaExpanded, "true");
  assert.strictEqual(activityAriaHidden, "false");
  assert.strictEqual(activityContentConnected, true);
  assert.strictEqual(activityContent.dataset.codexActivityAnimating, "expand");
  assert.strictEqual(activityContent.style.height, "");
  assert.ok(activityContent.style.transition.includes("clip-path"), "activity expansion should visually reveal content instead of only fading it in");
  assert.strictEqual(activityContent.style.willChange, "opacity, transform, clip-path");
  flushAnimationFrame();
  assert.strictEqual(threadScroll.scrollTop, 760, "bottom expansion should move with the inserted activity content");
  activityContent.dispatchTransitionEnd();
  assert.strictEqual(activityContent.dataset.codexActivityAnimating, undefined);
  assert.strictEqual(activityContent.style.height, "");
  click({
    target: {
      closest(selector) {
        if (selector === "[data-codex-turn-activity-toggle]") return activityToggle;
        return null;
      },
    },
  });
  assert.strictEqual(activityState, "closed");
  assert.strictEqual(activityAriaExpanded, "false");
  assert.strictEqual(activityAriaHidden, "true");
  assert.strictEqual(activityContentConnected, false, "collapse should release layout immediately");
  assert.strictEqual(activityContent.dataset.codexActivityAnimating, undefined);
  assert.strictEqual(activityContent.style.height, "");
  assert.strictEqual(threadScroll.scrollTop, 700, "bottom collapse should return as soon as activity content is removed");
  threadScroll.scrollHeight = 1000;

  threadScroll.scrollTop = 100;
  threadScroll.scrollHeight = 1000;
  activityToggle.documentTop = 150;
  click({
    target: {
      closest(selector) {
        if (selector === "[data-codex-turn-activity-toggle]") return activityToggle;
        return null;
      },
    },
  });
  assert.strictEqual(activityState, "open");
  assert.strictEqual(activityContentConnected, true);
  assert.strictEqual(threadScroll.scrollTop, 100, "activity expansion must preserve a reading position away from the bottom");
  activityContent.dispatchTransitionEnd();
  while (animationFrames.size > 0) flushAnimationFrame();

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
  await flush();

  const threadSource = eventSources.find((source) => source.url.includes("threadId=s1"));
  assert.ok(threadSource, "thread SSE should start after state fetch");

  const rendersBeforeStream = renderCalls.length;
  const firstUpdate = {
    type: "turnUpdated",
    threadId: "s1",
    data: officialTurn("inProgress", [
        { id: "user-1", type: "userMessage", clientId: null, content: [{ type: "text", text: "hello", text_elements: [] }] },
        { id: "agent-1", type: "agentMessage", text: "Hell", phase: "final_answer", memoryCitation: null },
    ]),
  };
  const secondUpdate = {
    type: "turnUpdated",
    threadId: "s1",
    data: officialTurn("inProgress", [
        { id: "user-1", type: "userMessage", clientId: null, content: [{ type: "text", text: "hello", text_elements: [] }] },
        { id: "agent-1", type: "agentMessage", text: "Hello", phase: "final_answer", memoryCitation: null },
    ]),
  };

  threadSource.onmessage({ data: JSON.stringify(firstUpdate) });
  threadSource.onmessage({ data: JSON.stringify(secondUpdate) });
  flushAnimationFrame();
  await flush();

  assert.strictEqual(renderCalls.length, rendersBeforeStream + 1, "streaming update should schedule one unified render");

  const activeThread = rendererRuntime.state.threads.find((thread) => thread.id === "s1");
  assert.strictEqual(rendererRuntime.state.threadHistory.turns[0].items[1].text, "Hell", "the first queued delta should render before the next delta");

  flushAnimationFrame();
  await flush();
  assert.strictEqual(renderCalls.length, rendersBeforeStream + 2, "the second delta should render on the next frame");
  assert.strictEqual(rendererRuntime.state.threadHistory.turns[0].items[1].text, "Hello", "the second queued delta should remain visible");

  const completedUpdate = {
    type: "turnUpdated",
    threadId: "s1",
    data: officialTurn("completed", [
        { id: "user-1", type: "userMessage", clientId: null, content: [{ type: "text", text: "hello", text_elements: [] }] },
        { id: "agent-1", type: "agentMessage", text: "Hello", phase: "final_answer", memoryCitation: null },
    ]),
  };

  threadSource.onmessage({ data: JSON.stringify(completedUpdate) });
  flushAnimationFrame();
  await flush();

  assert.strictEqual(renderCalls.length, rendersBeforeStream + 3, "completion update should schedule one unified render");
  assert.strictEqual(rendererRuntime.state.threadHistory.turns[0].items[1].text, "Hello", "completed turn should contain the final text");

  const retryError = {
    error: {
      message: "Reconnecting... 1/5",
      codexErrorInfo: null,
      additionalDetails: "unexpected status 503 Service Unavailable, url: https://api.zelt.cn/v1/responses",
    },
    willRetry: true,
    threadId: "s1",
    turnId: "turn-1",
  };
  threadSource.onmessage({ data: JSON.stringify({
    type: "turnError",
    threadId: "s1",
    data: retryError,
  }) });
  flushAnimationFrame();
  await flush();
  assert.strictEqual(
    JSON.stringify(rendererRuntime.state.turnErrors),
    JSON.stringify([retryError]),
    "retry notification should remain exact",
  );

  const finalError = {
    error: {
      message: "unexpected status 503 Service Unavailable",
      codexErrorInfo: null,
      additionalDetails: null,
    },
    willRetry: false,
    threadId: "s1",
    turnId: "turn-1",
  };
  threadSource.onmessage({ data: JSON.stringify({
    type: "turnError",
    threadId: "s1",
    data: finalError,
  }) });
  flushAnimationFrame();
  await flush();
  assert.strictEqual(
    JSON.stringify(rendererRuntime.state.turnErrors),
    JSON.stringify([retryError, finalError]),
    "final failure should preserve the official retry notification",
  );

  const failedTurn = officialTurn("failed", completedUpdate.data.items);
  failedTurn.error = finalError.error;
  threadSource.onmessage({ data: JSON.stringify({
    type: "turnUpdated",
    threadId: "s1",
    data: failedTurn,
  }) });
  flushAnimationFrame();
  await flush();
  assert.strictEqual(rendererRuntime.state.turnErrors.length, 2, "failed turn should retain connection-scoped errors");

  const nextTurn = officialTurn("inProgress", []);
  nextTurn.id = "turn-2";
  threadSource.onmessage({ data: JSON.stringify({
    type: "turnStarted",
    threadId: "s1",
    data: nextTurn,
  }) });
  flushAnimationFrame();
  await flush();
  assert.strictEqual(rendererRuntime.state.turnErrors.length, 0, "new turn should clear prior transient errors");

})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
