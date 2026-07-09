"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const scroll = {
  scrollHeight: 300,
  scrollTop: 100,
  clientHeight: 180,
};
const content = {
  dataset: { codexStateItemId: "agent-1" },
  innerHTML: "<p>old</p>",
};
const context = {
  window: null,
  requestAnimationFrame(callback) {
    callback();
  },
  CodexPanelUtils: {
    activityLabel() { return ""; },
    activityIcon() { return ""; },
    assistantTextFromData() { return ""; },
    timeFromEvent() { return ""; },
    escapeHTML(value) { return String(value); },
    escapeAttr(value) { return String(value); },
  },
  CodexPanelLifecycle: {
    isActivityEvent() { return false; },
    isActivityPending() { return false; },
    visibleConversationEvents(events) { return events; },
  },
  CodexPanelActivitySummary: {
    splitTurnFollowups() {
      return { finalFollowup: null, streamFollowups: [], hasProcessBlock: false };
    },
  },
  CodexMarkdown: {
    render(value) { return `<p>${String(value)}</p>`; },
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
  state: { view: "thread", sessions: [], activeSessionId: "" },
  mount: {
    root: {
      querySelector(selector) {
        return selector === "[data-thread-scroll]" ? scroll : null;
      },
      querySelectorAll(selector) {
        return selector === "[data-codex-state-item-id]" ? [content] : [];
      },
    },
  },
  icons: { svg() { return ""; } },
  config: {},
});

assert.strictEqual(renderer.updateAssistantItem({ id: "missing", text: "ignored" }), false);
assert.strictEqual(renderer.updateAssistantItem({ id: "agent-1", text: "hello" }), true);
assert.strictEqual(content.innerHTML, "<p>hello</p>");
assert.strictEqual(scroll.scrollTop, scroll.scrollHeight);
