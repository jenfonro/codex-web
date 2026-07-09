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
for (const file of ["lifecycle.js", "activity-summary.js"]) {
  vm.runInContext(
    fs.readFileSync(path.join(root, "src", "pages", "codex", file), "utf8"),
    context,
    { filename: file },
  );
}

const { splitTurnFollowups, summaryLabel } = context.CodexPanelActivitySummary;

const streaming = splitTurnFollowups([
  { kind: "turn_started", data: { status: "running" } },
  { kind: "assistant_message", text: "partial answer", data: { streaming: true } },
]);

assert.strictEqual(streaming.finalFollowup, null);
assert.strictEqual(
  streaming.streamFollowups.map((event) => event.kind).join(","),
  "turn_started,assistant_message",
);

const completed = splitTurnFollowups([
  { kind: "turn_started", data: { status: "running" } },
  { kind: "assistant_message", text: "final answer", data: { phase: "final_answer", streaming: false } },
]);

assert.strictEqual(completed.finalFollowup.kind, "assistant_message");
assert.strictEqual(completed.finalFollowup.text, "final answer");
assert.strictEqual(completed.streamFollowups.length, 0);

const durationSplit = splitTurnFollowups([
  {
    kind: "turn_started",
    time: "2026-07-10T00:00:00.000Z",
    data: { status: "completed", turnDurationMs: 62000 },
  },
  {
    kind: "assistant_message",
    text: "final answer",
    time: "2026-07-10T00:00:00.000Z",
    data: { phase: "final_answer", streaming: false, turnDurationMs: 62000 },
  },
]);

assert.strictEqual(
  summaryLabel({ kind: "user_message", time: "2026-07-10T00:00:00.000Z", data: { turnDurationMs: 62000 } }, durationSplit),
  "已处理 1m 2s",
);

const timestampSplit = splitTurnFollowups([
  {
    kind: "turn_started",
    data: {
      status: "completed",
      turnStartedAt: "2026-07-10T00:00:00.000Z",
      turnCompletedAt: "2026-07-10T00:00:45.000Z",
    },
  },
  {
    kind: "assistant_message",
    text: "final answer",
    data: {
      phase: "final_answer",
      streaming: false,
      turnStartedAt: "2026-07-10T00:00:00.000Z",
      turnCompletedAt: "2026-07-10T00:00:45.000Z",
    },
  },
]);

assert.strictEqual(
  summaryLabel({ kind: "user_message", data: { turnStartedAt: "2026-07-10T00:00:00.000Z", turnCompletedAt: "2026-07-10T00:00:45.000Z" } }, timestampSplit),
  "已处理 45s",
);
