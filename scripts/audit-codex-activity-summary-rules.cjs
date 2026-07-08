"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.resolve(__dirname, "..");
const context = {
  console,
  window: {},
};
vm.createContext(context);

for (const file of [
  "frontend/src/pages/codex/utils.js",
  "frontend/src/pages/codex/lifecycle.js",
  "frontend/src/pages/codex/activity-summary.js",
]) {
  vm.runInContext(fs.readFileSync(path.join(repoRoot, file), "utf8"), context, { filename: file });
}

const summary = context.window.CodexPanelActivitySummary;

function split(events) {
  return summary.splitTurnFollowups(events);
}

function assistant(text, phase = "commentary") {
  return { kind: "assistant_message", text, data: { phase }, time: "2026-07-06T00:00:00.000Z" };
}

function toolCall(id, status = "completed") {
  return {
    kind: "tool_call",
    text: "exec_command",
    data: {
      call_id: id,
      name: "exec_command",
      status,
      args: { cmd: "node --check frontend/src/pages/codex/activity-summary.js" },
    },
    time: "2026-07-06T00:00:01.000Z",
  };
}

function toolOutput(id) {
  return {
    kind: "tool_output",
    text: "Process exited with code 0",
    data: { call_id: id, status: "completed", output: "Process exited with code 0" },
    time: "2026-07-06T00:00:02.000Z",
  };
}

function cancelledTurn() {
  return {
    kind: "turn_cancelled",
    text: "Stopped",
    status: "cancelled",
    data: { status: "cancelled" },
    time: "2026-07-06T00:00:03.000Z",
  };
}

function summaryEvent(text, inline = false) {
  return {
    kind: "summary",
    text,
    inline,
    time: "2026-07-06T00:00:02.500Z",
  };
}

function fileChange(options = {}) {
  return {
    kind: "file_change",
    text: options.text || "已编辑 1 个文件",
    data: {
      type: "file_change",
      status: "completed",
      files: [{
        path: options.path || "/workspace/frontend/src/app.js",
        type: options.type || "update",
        additions: options.additions ?? 2,
        deletions: options.deletions ?? 1,
      }],
    },
    time: "2026-07-06T00:00:02.250Z",
  };
}

{
  const result = split([
    assistant("I will inspect the current browser."),
    toolCall("call-1"),
    toolOutput("call-1"),
    assistant("The browser capture is saved."),
  ]);
  assert.equal(result.hasProcessSummary, true, "settled tool turns should expose a processed summary");
  assert.equal(result.streamFollowups.length, 0, "settled tool calls must not render as visible inline rows");
  assert.equal(result.processEvents.length, 2, "settled tool call and output should be counted as process events");
  assert.equal(result.finalFollowup, null, "settled commentary without explicit final answer stays in processed body");
  assert.deepEqual(
    result.summaryItems.map((item) => item.type),
    ["assistant", "assistant"],
    "settled assistant commentary keeps source event order inside processed body",
  );
}

{
  const result = split([
    assistant("I am starting the command."),
    toolCall("call-running", "running"),
  ]);
  assert.equal(result.hasProcessSummary, false, "running tool turns should stay live instead of collapsing early");
  assert.equal(result.streamFollowups.length, 2, "running tool turns should keep live followups visible");
}

{
  const result = split([
    toolCall("call-2"),
    toolOutput("call-2"),
  ]);
  assert.equal(result.hasProcessSummary, true, "tool-only settled turns should still expose processed state");
  assert.equal(result.finalFollowup, null, "tool-only settled turns should not invent assistant text");
  assert.equal(result.streamFollowups.length, 0, "tool-only settled turns should not expose raw command rows");
}

{
  const result = split([
    cancelledTurn(),
  ]);
  assert.equal(result.hasProcessSummary, false, "cancelled turns should not collapse into a processed summary");
  assert.equal(result.streamFollowups.length, 1, "cancelled turns should keep the stopped status row visible");
  assert.equal(result.streamFollowups[0].kind, "turn_cancelled");
}

{
  const result = split([
    summaryEvent("Checked the processed-summary disclosure path."),
    toolCall("call-summary"),
    toolOutput("call-summary"),
    assistant("Done.", "final_answer"),
    summaryEvent("Processed 22s", true),
  ]);
  assert.equal(result.hasProcessSummary, true, "reasoning summary plus processed label should expose a processed summary");
  assert.equal(result.summaryDetails.length, 1, "reasoning summary text should become processed-summary body content");
  assert.equal(result.summaryDetails[0].text, "Checked the processed-summary disclosure path.");
  assert.equal(result.detailEvents.length, 0, "tool commands must not be reintroduced into the processed-summary body");
  assert.equal(summary.summaryLabel({ time: "2026-07-06T00:00:00.000Z" }, result), "Processed 22s");
}

{
  const result = split([
    assistant("I will edit the file."),
    toolCall("call-patch"),
    toolOutput("call-patch"),
    fileChange(),
    assistant("Done.", "final_answer"),
    summaryEvent("已处理 12s", true),
  ]);
  assert.equal(result.hasProcessSummary, true, "file changes remain part of the processed turn");
  assert.equal(result.detailEvents.length, 1, "file changes should render as visible detail cards outside the processed body");
  assert.equal(result.streamFollowups.length, 0, "file changes must not render as raw command stream rows");
  assert.deepEqual(
    result.summaryItems.map((item) => item.type),
    ["assistant"],
    "explicit final turns keep commentary inside the processed body but leave file activity visible",
  );
  assert.equal(result.detailEvents[0].kind, "file_change");
}

{
  const result = split([
    assistant("I will capture the current browser."),
    user("现在我打开了codex的扩展 在会话列表的界面"),
    assistant("You are now on the Codex session list."),
    fileChange(),
    assistant("Capture script is ready."),
    assistant("Done.", "final_answer"),
    summaryEvent("已处理 12s", true),
  ]);
  assert.equal(result.hasProcessSummary, true, "guided input stays inside the processed turn");
  assert.deepEqual(
    result.summaryItems.map((item) => item.type),
    ["assistant", "guidance", "assistant", "assistant"],
    "processed body preserves official ordering for guidance and assistant commentary",
  );
  assert.equal(result.detailEvents.length, 1, "file changes are rendered as appended visible detail rows");
  assert.equal(
    result.summaryItems.some((item) => item.type === "activity"),
    false,
    "file activity does not disappear into the processed body",
  );
}

{
  const result = split([
    assistant("I will prepare scripts."),
    fileChange({ text: "已创建 2 个文件", type: "add", additions: 83, deletions: 0 }),
    assistant("启动脚本已放好。"),
    toolCall("call-start"),
    toolOutput("call-start"),
    assistant("I will patch the launcher."),
    fileChange({ text: "已编辑 1 个文件", type: "update", additions: 5, deletions: 5 }),
    assistant("脚本已改。"),
  ]);
  assert.equal(result.hasProcessSummary, true, "settled mixed file activity keeps the processed summary");
  assert.deepEqual(
    result.summaryItems.map((item) => item.type),
    ["assistant", "assistant", "assistant", "assistant"],
    "processed body keeps assistant commentary without swallowing file activity",
  );
  assert.equal(result.detailEvents.length, 2, "ordered file activity is exposed as visible detail cards outside the summary");
}

{
  const result = split([
    assistant("I will inspect the current UI."),
    toolCall("call-final"),
    toolOutput("call-final"),
    toolCall("call-3"),
    toolOutput("call-3"),
    assistant("Done.", "final_answer"),
  ]);
  assert.equal(result.hasProcessSummary, true, "explicit final answers keep the processed summary");
  assert.equal(result.streamFollowups.length, 0, "explicit final tool calls should stay inside the process summary");
  assert.equal(result.finalFollowup.text, "Done.");
  assert.equal(result.finalFollowup.text.includes("current UI"), false, "commentary before an explicit final answer must not be merged into final text");
}

console.log("codex activity summary rules: ok");

function user(text) {
  return { kind: "user_message", text, time: "2026-07-06T00:00:01.500Z" };
}
