"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, "reference", "codex-reference");
const outJSON = path.join(outDir, "grouping-rules-audit.json");
const outMD = path.join(outDir, "grouping-rules-audit.md");
const checks = [];
const context = {
  console,
  window: {},
};
vm.createContext(context);

for (const file of [
  "frontend/src/pages/codex/utils.js",
  "frontend/src/pages/codex/lifecycle.js",
  "frontend/src/pages/codex/grouping.js",
]) {
  vm.runInContext(fs.readFileSync(path.join(repoRoot, file), "utf8"), context, { filename: file });
}

const grouping = context.window.CodexPanelGrouping;

const completedRun = [
  user(5748, "为什么你越改越错,而且主题颜色都没有改对"),
  assistant(5749, "你说得对，我会重新抓取。", "commentary"),
  tool(5751),
  output(5753),
  assistant(5757, "我已经生成了同区域的参考和当前裁剪图。", "commentary"),
  user(5766, "你最好截图取色看看 色号是否一致"),
  assistant(5767, "对，这里应该直接截图取色。", "commentary"),
  assistant(5882, "已按你说的用截图取色校准了。", "final_answer"),
  summary(5883, "019f22ac-abe1-7aa3-b916-b04913df9ef3"),
];

check("guided user input before final answer stays in the active official turn", () => {
  const items = grouping.groupConversationEvents(completedRun);
  assert.equal(items.length, 1, "guided user input before final answer stays in the same official turn");
  assert.equal(items[0].type, "user-turn");
  assert.equal(items[0].event.text, completedRun[0].text);
  assert.equal(items[0].followups.at(-1).seq, 5883, "terminal summary closes the official turn");
  assert.equal(items[0].followups.some((event) => event.seq === 5766), true, "guided user input is retained as turn context");
  assert.equal(items[0].followups.some((event) => event.seq === 5882), true, "later final answer stays with the official turn");
  assert.equal(items[0].event.turnKey, "019f22ac-abe1-7aa3-b916-b04913df9ef3", "terminal turn_id becomes the visible turn key");
});

check("same turn file activity remains with the earlier visible user anchor", () => {
  const turnID = "019f23a0-151e-7930-8abb-7aa7335638f8";
  const items = grouping.groupConversationEvents([
    user(7047, "现在首先,你先对浏览器截图,并进行下载"),
    assistant(7048, "我会从当前正在运行的 Chromium/CDP 里抓取同一个浏览器页面。", "commentary"),
    tool(7049),
    output(7052, "ok", "call-7049"),
    assistant(7055, "当前浏览器页是 code-server。", "commentary"),
    user(7058, "现在我打开了codex的扩展 在会话列表的界面"),
    assistant(7059, "你现在已经切到 Codex 扩展会话列表界面了。", "commentary"),
    fileChange(7061, turnID),
    assistant(7062, "完整抓取脚本已经写好。", "commentary"),
    assistant(7086, "已重新抓取当前 Codex 会话列表界面。", "final_answer"),
    summary(7087, turnID),
  ]);
  assert.equal(items.length, 1, "official turn_id keeps the whole run in one visible turn");
  assert.equal(items[0].event.seq, 7047);
  assert.equal(items[0].event.turnKey, turnID);
  assert.deepEqual(items[0].followups.map((event) => event.seq), [7048, 7049, 7052, 7055, 7058, 7059, 7061, 7062, 7086, 7087]);
});

check("new official turn id promotes the intervening user message to a visible turn", () => {
  const firstTurnID = "019f23ea-830d-7410-8437-f627ecc5b9de";
  const secondTurnID = "019f23f4-f091-75e2-bfc2-dc8a7cc4cb53";
  const items = grouping.groupConversationEvents([
    user(7430, "uploaded codex-web.tar"),
    assistant(7431, "checking the archive", "commentary"),
    tool(7432),
    output(7433, "ok", "call-7432"),
    fileChange(7492, firstTurnID),
    assistant(7520, "screenshot generated", "commentary"),
    user(7523, "can we change VNC to Segoe UI"),
    assistant(7524, "checking fonts", "commentary"),
    tool(7525),
    output(7526, "ok", "call-7525"),
    fileChange(7570, secondTurnID),
    user(7571, "would Windows be better"),
    assistant(7572, "yes", "final_answer"),
    user(7573, "not guessing back and forth"),
    assistant(7574, "correct", "final_answer"),
    summary(7575, secondTurnID),
  ]);
  assert.equal(items.length, 2, "the second official turn id starts from the intervening user message");
  assert.equal(items[0].event.seq, 7430);
  assert.equal(items[0].event.turnKey, firstTurnID);
  assert.deepEqual(items[0].followups.map((event) => event.seq), [7431, 7432, 7433, 7492, 7520]);
  assert.equal(items[1].event.seq, 7523);
  assert.equal(items[1].event.turnKey, secondTurnID);
  assert.deepEqual(items[1].followups.map((event) => event.seq), [7524, 7525, 7526, 7570, 7571, 7572, 7573, 7574, 7575]);
});

check("adjacent completed user turns stay separate", () => {
  const items = grouping.groupConversationEvents([
    user(7228, "move to Windows?"),
    assistant(7229, "yes", "final_answer"),
    user(7230, "not guessing back and forth"),
    assistant(7231, "correct", "final_answer"),
    summary(7232, "019f23f4-f091-75e2-bfc2-dc8a7cc4cb53"),
  ]);
  assert.equal(items.length, 2, "real adjacent user turns are kept separate");
  assert.equal(items[0].event.seq, 7228);
  assert.deepEqual(items[0].followups.map((event) => event.seq), [7229]);
  assert.equal(items[1].event.seq, 7230);
  assert.deepEqual(items[1].followups.map((event) => event.seq), [7231, 7232]);
});

check("incomplete streams keep sequential grouping", () => {
  const items = grouping.groupConversationEvents([
    user(1, "first"),
    assistant(2, "first reply", "commentary"),
    user(3, "second"),
    assistant(4, "second is still running", "commentary"),
  ]);
  assert.equal(items.length, 2, "incomplete streams keep sequential grouping");
  assert.equal(items[0].followups.length, 1);
  assert.equal(items[1].followups.length, 1);
});

check("paged windows hide incomplete leading non-user turns", () => {
  const partialWindow = [
    tool(10),
    output(12),
    assistant(13, "partial previous turn", "commentary"),
    user(20, "current turn"),
    assistant(21, "current answer", "final_answer"),
    summary(22, "current-turn"),
  ];
  const visible = grouping.groupConversationEvents(partialWindow, { hideLeadingPartial: true });
  assert.equal(visible.length, 1, "paged windows hide incomplete leading non-user turns");
  assert.equal(visible[0].type, "user-turn");
  assert.equal(visible[0].event.seq, 20);
  assert.deepEqual(visible[0].followups.map((event) => event.seq), [21, 22]);

  const unfiltered = grouping.groupConversationEvents(partialWindow);
  assert.equal(unfiltered[0].type, "event", "non-paged grouping still preserves leading events");
});

check("standalone completed internal tool events are hidden", () => {
  const items = grouping.groupConversationEvents([
    user(5260, "previous turn"),
    assistant(5261, "done", "final_answer"),
    summary(5262, "previous-turn"),
    tool(5268, "write_stdin"),
    output(5269, "Process running with session ID 47454", "call-5268"),
    assistant(5270, "orphan commentary", "commentary"),
    tool(5271, "write_stdin"),
    output(5272, "Target page, context or browser has been closed", "call-5271"),
    user(5273, "new user anchor"),
  ]);
  assert.equal(items.length, 3, "standalone completed tools should not create visible turns");
  assert.equal(items[0].type, "user-turn");
  assert.equal(items[1].type, "event");
  assert.equal(items[1].event.seq, 5270, "standalone assistant text is preserved");
  assert.equal(items[2].type, "user-turn");
  assert.deepEqual(items.map((item) => item.event.seq), [5260, 5270, 5273]);
});

check("standalone running tools and cancelled rows remain visible", () => {
  const items = grouping.groupConversationEvents([
    runningTool(6001, "exec_command"),
    cancelled(6002),
    user(6003, "next request"),
  ]);
  assert.equal(items.length, 3, "running and cancelled standalone activity rows remain visible");
  assert.deepEqual(items.map((item) => item.event.seq), [6001, 6002, 6003]);
});

writeReport();

function user(seq, text) {
  return { seq, kind: "user_message", text };
}

function assistant(seq, text, phase) {
  return { seq, kind: "assistant_message", text, data: { phase } };
}

function tool(seq, name = "exec_command") {
  return { seq, kind: "tool_call", text: name, data: { name, status: "completed", call_id: `call-${seq}` } };
}

function runningTool(seq, name = "exec_command") {
  return { seq, kind: "tool_call", text: name, data: { name, status: "running", call_id: `call-${seq}` } };
}

function output(seq, text = "ok", callID = `call-${seq - 2}`) {
  return { seq, kind: "tool_output", text, data: { status: "completed", call_id: callID, output: text } };
}

function cancelled(seq) {
  return { seq, kind: "turn_cancelled", text: "Stopped", status: "cancelled", data: { status: "cancelled" } };
}

function summary(seq, turnID) {
  return {
    seq,
    kind: "summary",
    inline: true,
    text: "已处理 18m 1s",
    data: { status: "completed", type: "task_complete", turn_id: turnID, durationMs: 1080434 },
  };
}

function fileChange(seq, turnID) {
  return {
    seq,
    kind: "file_change",
    text: "已创建 1 个文件",
    data: {
      status: "completed",
      type: "file_change",
      turn_id: turnID,
      files: [{ path: "/root/codex-web-browser/cdp-full-capture.mjs", type: "add", additions: 0, deletions: 0 }],
    },
  };
}

function check(name, fn) {
  try {
    fn();
    checks.push({ name, ok: true, details: "" });
  } catch (error) {
    checks.push({ name, ok: false, details: error && error.message ? error.message : String(error) });
  }
}

function writeReport() {
  fs.mkdirSync(outDir, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    basis: "Rules audit for Codex Web conversation turn grouping, including completed adjacent user turns and paged leading partial windows.",
    summary: {
      checks: checks.length,
      failed: checks.filter((item) => !item.ok).length,
    },
    checks,
  };
  fs.writeFileSync(outJSON, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(outMD, renderMarkdown(report));
  console.log(`${path.relative(repoRoot, outJSON).replace(/\\/g, "/")} (${report.summary.failed} failed)`);
  if (report.summary.failed > 0) process.exit(1);
}

function renderMarkdown(report) {
  const lines = [
    "# Codex Grouping Rules Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    report.basis,
    "",
    "## Checks",
    "",
    "| Status | Check | Details |",
    "| --- | --- | --- |",
  ];
  for (const item of report.checks) {
    lines.push(`| ${item.ok ? "PASS" : "FAIL"} | ${escapeMD(item.name)} | ${escapeMD(item.details || "")} |`);
  }
  return `${lines.join("\n")}\n`;
}

function escapeMD(value) {
  return String(value || "").replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}
