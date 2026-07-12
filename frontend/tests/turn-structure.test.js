"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const composer = { innerText: "", dataset: {} };
const sendButton = { classList: { toggle() {} } };
const panelView = { dataset: { codexView: "list" } };
const scroll = { scrollTop: 0, scrollHeight: 0 };
const mountRoot = {
  innerHTML: "",
  querySelector(selector) {
    if (selector === "[data-codex-panel-root]") return panelView;
    if (selector === "[data-thread-scroll]") return scroll;
    if (selector === "[data-codex-composer]") return composer;
    if (selector === ".codex-composer-send-button") return sendButton;
    throw new Error(`Unexpected selector: ${selector}`);
  },
};

const turn = {
  id: "turn-1",
  itemsView: "full",
  status: "completed",
  error: null,
  startedAt: null,
  completedAt: null,
  durationMs: 1000,
  items: [
    {
      id: "user-1",
      type: "userMessage",
      clientId: null,
      content: [{ type: "text", text: "Question", text_elements: [] }],
    },
    {
      id: "agent-1",
      type: "agentMessage",
      text: "Answer",
      phase: "final_answer",
      memoryCitation: null,
    },
  ],
};

const compactionTurn = {
  id: "turn-2",
  itemsView: "full",
  status: "completed",
  error: null,
  startedAt: null,
  completedAt: null,
  durationMs: null,
  items: [
    {
      id: "compact-1",
      type: "contextCompaction",
    },
  ],
};

const multiUserTurn = {
  id: "turn-3",
  itemsView: "full",
  status: "completed",
  error: null,
  startedAt: null,
  completedAt: null,
  durationMs: 2000,
  items: [
    {
      id: "compact-2",
      type: "contextCompaction",
    },
    {
      id: "user-2",
      type: "userMessage",
      clientId: null,
      content: [{ type: "text", text: "First followup", text_elements: [] }],
    },
    {
      id: "agent-2",
      type: "agentMessage",
      text: "First answer",
      phase: "final_answer",
      memoryCitation: null,
    },
    {
      id: "user-3",
      type: "userMessage",
      clientId: null,
      content: [{ type: "text", text: "Second followup", text_elements: [] }],
    },
    {
      id: "agent-3",
      type: "agentMessage",
      text: "Second answer",
      phase: "final_answer",
      memoryCitation: null,
    },
  ],
};

const thread = {
  id: "thread-1",
  name: "Thread",
  status: { type: "idle" },
  turns: [turn, compactionTurn, multiUserTurn],
};

const context = {
  window: null,
  document: {},
  requestAnimationFrame(callback) {
    callback();
    return 1;
  },
  CodexPanelUtils: {
    timeFromTurn() { return ""; },
    threadTitle(value) { return value.name; },
    escapeHTML(value) { return String(value); },
    escapeAttr(value) { return String(value); },
    relativeTime() { return ""; },
  },
  CodexPanelLifecycle: {
    isStreamingAssistant() { return false; },
    isTurnRunning() { return false; },
    isItemPending() { return false; },
  },
  CodexPanelActivitySummary: {
    splitTurnFollowups(refs) {
      if (refs[0]?.item.type === "contextCompaction") {
        return {
          processFollowups: [],
          finalFollowup: null,
          streamFollowups: refs,
        };
      }
      return {
        processFollowups: [],
        finalFollowup: refs[0],
        streamFollowups: [],
      };
    },
  },
  CodexMarkdown: {
    render(value) { return value; },
  },
};
context.window = context;
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(root, "src", "pages", "codex", "renderer.js"), "utf8"),
  context,
  { filename: "renderer.js" },
);

const state = {
  view: "thread",
  popover: "",
  modelMenuExpanded: false,
  threads: [thread],
  turnErrors: [],
  expandedProcessTurns: new Set(),
  activeThreadId: thread.id,
  threadHistory: {
    turns: thread.turns,
    nextCursor: null,
    loading: false,
    loadingOlder: false,
  },
};
const renderer = context.CodexPanelRenderer.create({
  state,
  mount: { root: mountRoot },
  icons: {
    svg(name, className) {
      return `<svg data-icon="${name}" class="${className}"></svg>`;
    },
  },
});
renderer.render();

const html = mountRoot.innerHTML;
assert.strictEqual((html.match(/data-turn-id="turn-1"/g) || []).length, 1);
assert.strictEqual((html.match(/data-codex-turn-key="turn-1"/g) || []).length, 1);
assert.ok(html.includes("data-codex-turn-user"));
assert.ok(html.includes("data-codex-turn-response"));
assert.ok(html.indexOf("data-codex-turn-user") < html.indexOf("data-codex-turn-response"));
assert.ok(html.includes("Question"));
assert.ok(html.includes("Answer"));
assert.strictEqual((html.match(/data-turn-id="turn-2"/g) || []).length, 1);
assert.strictEqual((html.match(/codex-context-compaction-line/g) || []).length, 4);
assert.ok(html.includes("codex-context-compaction-icon"));
assert.strictEqual((html.match(/data-turn-id="turn-3"/g) || []).length, 1);
assert.ok(html.includes("First followup"));
assert.ok(html.includes("First answer"));
assert.ok(html.includes("Second followup"));
assert.ok(html.includes("Second answer"));

state.threadHistory = {
  turns: [],
  nextCursor: null,
  loading: true,
  loadingOlder: false,
};
renderer.render();
const loadingHTML = mountRoot.innerHTML;
assert.ok(loadingHTML.includes('class="codex-thread-loading-overlay"'));
assert.ok(loadingHTML.includes("codex-thread-loading-spinner"));
assert.ok(loadingHTML.includes("正在加载..."));
assert.ok(loadingHTML.includes("data-codex-turn-list"), "loading must preserve the conversation list structure");
assert.ok(!loadingHTML.includes("loading-shimmer-pure-text"), "page loading must not render as a streaming message");
assert.ok(html.includes("上下文已自动压缩"));
