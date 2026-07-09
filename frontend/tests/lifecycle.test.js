"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = {
  window: null,
};
context.window = context;
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(root, "src", "pages", "codex", "lifecycle.js"), "utf8"),
  context,
  { filename: "lifecycle.js" },
);

const {
  eventKind,
  eventStatus,
  isActivityEvent,
  isActivityPending,
} = context.CodexPanelLifecycle;

assert.strictEqual(eventKind({ kind: "reasoning" }), "reasoning");
assert.strictEqual(eventKind({}, "assistant_message"), "assistant_message");
assert.strictEqual(eventStatus({ data: { status: "RUNNING" } }), "running");

assert.strictEqual(isActivityEvent({ kind: "reasoning" }), true);
assert.strictEqual(isActivityEvent({ kind: "assistant_message" }), false);

assert.strictEqual(isActivityPending({ kind: "reasoning" }), true);
assert.strictEqual(isActivityPending({ kind: "reasoning", data: { status: "completed" } }), false);
assert.strictEqual(isActivityPending({ kind: "tool_call", data: { status: "running" } }), true);
