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

const thread = {
  id: "thread-1",
  name: "Thread",
  status: { type: "idle" },
  turns: [turn, compactionTurn],
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

const renderer = context.CodexPanelRenderer.create({
  state: {
    view: "thread",
    popover: "",
    modelMenuExpanded: false,
    threads: [thread],
    turnErrors: [],
    activeThreadId: thread.id,
    threadHistory: {
      turns: thread.turns,
      beforeTurnId: null,
      loading: false,
      loadingOlder: false,
    },
  },
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
assert.strictEqual((html.match(/codex-context-compaction-line/g) || []).length, 2);
assert.ok(html.includes("codex-context-compaction-icon"));
assert.ok(html.includes("上下文已自动压缩"));
