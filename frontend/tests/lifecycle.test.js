"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = { window: null };
context.window = context;
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(root, "src", "pages", "codex", "lifecycle.js"), "utf8"),
  context,
  { filename: "lifecycle.js" },
);

const lifecycle = context.CodexPanelLifecycle;
const turn = {
  id: "turn-1",
  itemsView: "full",
  status: "inProgress",
  error: null,
  startedAt: null,
  completedAt: null,
  durationMs: null,
  items: [
    { id: "reason-1", type: "reasoning", summary: [], content: [] },
    {
      id: "command-1",
      type: "commandExecution",
      command: "pwd",
      cwd: "/workspace",
      processId: null,
      source: "agent",
      status: "inProgress",
      commandActions: [],
      aggregatedOutput: null,
      exitCode: null,
      durationMs: null,
    },
  ],
};

assert.strictEqual(lifecycle.isTurnRunning(turn), true);
assert.strictEqual(lifecycle.isItemPending({ turn, item: turn.items[0], itemIndex: 0 }), false);
assert.strictEqual(lifecycle.isItemPending({ turn, item: turn.items[1], itemIndex: 1 }), true);
assert.strictEqual(lifecycle.isStreamingAssistant({
  turn: {
    id: "turn-2",
    items: [{ id: "agent-1", type: "agentMessage", text: "", phase: null, memoryCitation: null }],
    itemsView: "full",
    status: "inProgress",
    error: null,
    startedAt: null,
    completedAt: null,
    durationMs: null,
  },
  item: { id: "agent-1", type: "agentMessage", text: "", phase: null, memoryCitation: null },
  itemIndex: 0,
}), true);
