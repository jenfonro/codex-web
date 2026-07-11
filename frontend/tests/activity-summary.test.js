"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = { window: null };
context.window = context;
vm.createContext(context);
for (const file of ["lifecycle.js", "activity-summary.js"]) {
  vm.runInContext(
    fs.readFileSync(path.join(root, "src", "pages", "codex", file), "utf8"),
    context,
    { filename: file },
  );
}

const { splitTurnFollowups, summaryLabel } = context.CodexPanelActivitySummary;
const turn = {
  id: "turn-1",
  itemsView: "full",
  status: "completed",
  error: null,
  startedAt: null,
  completedAt: null,
  durationMs: 62000,
  items: [],
};
const reasoning = { turn, item: { id: "reason-1", type: "reasoning", summary: ["Checked"], content: [] }, itemIndex: 0 };
const commentary = { turn, item: { id: "agent-1", type: "agentMessage", text: "Working", phase: "commentary", memoryCitation: null }, itemIndex: 1 };
const final = { turn, item: { id: "agent-2", type: "agentMessage", text: "Done", phase: "final_answer", memoryCitation: null }, itemIndex: 2 };
const compaction = { turn, item: { id: "compact-1", type: "contextCompaction" }, itemIndex: 3 };

turn.items = [reasoning.item, commentary.item, final.item];
const split = splitTurnFollowups([reasoning, commentary, final]);

assert.strictEqual(split.processFollowups.length, 2);
assert.strictEqual(split.finalFollowup, final);
assert.strictEqual(split.streamFollowups.length, 0);
const compacted = splitTurnFollowups([reasoning, compaction, final]);
assert.deepStrictEqual(Array.from(compacted.processFollowups), [reasoning]);
assert.deepStrictEqual(Array.from(compacted.streamFollowups), [compaction]);
assert.strictEqual(summaryLabel(turn), "已处理 1m 2s");
assert.strictEqual(summaryLabel({ ...turn, durationMs: null }), "已处理");
