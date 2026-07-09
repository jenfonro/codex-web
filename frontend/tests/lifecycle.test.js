"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = {
  window: null,
  CodexPanelUtils: {
    assistantTextFromData(data) {
      if (!data || typeof data !== "object") return "";
      return String(data.text || data.message || "");
    },
  },
};
context.window = context;
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(root, "src", "pages", "codex", "lifecycle.js"), "utf8"),
  context,
  { filename: "lifecycle.js" },
);

const { visibleConversationEvents } = context.CodexPanelLifecycle;

function kinds(events) {
  return visibleConversationEvents(events).map((event) => event.kind).join(",");
}

assert.strictEqual(
  kinds([
    { kind: "thread_status", data: { status: "running" } },
    { kind: "turn_started", data: { status: "running" } },
    { kind: "user_message", text: "hello" },
  ]),
  "user_message,turn_started",
);

assert.strictEqual(
  kinds([
    { kind: "thread_status", data: { status: "running" } },
    { kind: "turn_started", data: { status: "running" } },
    { kind: "user_message", text: "hello" },
    { kind: "reasoning", data: { status: "running" } },
    { kind: "assistant_message", text: "done", data: { phase: "final_answer" } },
    { kind: "turn_completed", data: { status: "completed" } },
  ]),
  "user_message,assistant_message",
);

assert.strictEqual(
  kinds([
    { kind: "assistant_message", text: "orphaned history" },
    { kind: "user_message", text: "next" },
  ]),
  "assistant_message,user_message",
);
