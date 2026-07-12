"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const panelView = { dataset: { codexView: "list" } };
const mountRoot = {
  innerHTML: "",
  querySelector(selector) {
    if (selector === "[data-codex-panel-root]") return panelView;
    if (selector === "[data-thread-scroll]") return { scrollTop: 0, scrollHeight: 0 };
    if (selector === "[data-codex-composer]") return { innerText: "", dataset: {} };
    if (selector === ".codex-composer-send-button") return { classList: { toggle() {} } };
    throw new Error(`Unexpected selector: ${selector}`);
  },
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
    threadTitle(thread) { return thread.name; },
    escapeHTML(value) { return String(value); },
    escapeAttr(value) { return String(value); },
    relativeTime() { return ""; },
  },
  CodexMarkdown: {
    render(value, options) {
      return `<md data-variant="${options.variant}">${value}</md>`;
    },
  },
};
context.window = context;
vm.createContext(context);
const rendererSource = fs.readFileSync(path.join(root, "src", "pages", "codex", "renderer.js"), "utf8");
for (const file of ["lifecycle.js", "activity-summary.js", "renderer.js"]) {
  vm.runInContext(
    file === "renderer.js"
      ? rendererSource
      : fs.readFileSync(path.join(root, "src", "pages", "codex", file), "utf8"),
    context,
    { filename: file },
  );
}

const items = [
  {
    id: "user-1",
    type: "userMessage",
    clientId: null,
    content: [{ type: "text", text: "Question", text_elements: [] }],
  },
  { id: "reason-1", type: "reasoning", summary: ["Summary", "Details"], content: ["Reasoning body"] },
  {
    id: "command-1",
    type: "commandExecution",
    command: "rg renderer",
    cwd: "/workspace",
    processId: null,
    source: "agent",
    status: "completed",
    commandActions: [{ type: "search", command: "rg renderer", query: "renderer", path: null }],
    aggregatedOutput: "renderer.js",
    exitCode: 0,
    durationMs: 20,
  },
  {
    id: "patch-1",
    type: "fileChange",
    status: "completed",
    changes: [{ path: "frontend/src/app.js", kind: { type: "update", move_path: null }, diff: "" }],
  },
  {
    id: "mcp-1",
    type: "mcpToolCall",
    server: "docs",
    tool: "lookup",
    status: "completed",
    arguments: { query: "x" },
    appContext: null,
    pluginId: null,
    result: null,
    error: null,
    durationMs: 1,
  },
  {
    id: "dynamic-1",
    type: "dynamicToolCall",
    namespace: null,
    tool: "custom_tool",
    arguments: { input: "x" },
    status: "completed",
    contentItems: null,
    success: true,
    durationMs: 1,
  },
  {
    id: "search-1",
    type: "webSearch",
    query: "fallback",
    action: { type: "findInPage", url: "https://example.com/docs", pattern: "Codex" },
  },
  { id: "plan-1", type: "plan", text: "1. First step" },
  { id: "image-1", type: "imageView", path: "/workspace/image.png" },
  { id: "sleep-1", type: "sleep", durationMs: 1000 },
  { id: "review-in-1", type: "enteredReviewMode", review: "review" },
  { id: "review-out-1", type: "exitedReviewMode", review: "review" },
  {
    id: "agent-1",
    type: "agentMessage",
    text: "Answer",
    phase: "final_answer",
    memoryCitation: null,
  },
];
const turn = {
  id: "turn-1",
  itemsView: "full",
  status: "completed",
  error: null,
  startedAt: null,
  completedAt: null,
  durationMs: 1000,
  items,
};
const thread = {
  id: "thread-1",
  name: "Thread",
  status: { type: "idle" },
  turns: [turn],
};
const state = {
  view: "thread",
  popover: "",
  modelMenuExpanded: false,
  threads: [thread],
  turnErrors: [],
  expandedProcessTurns: new Set([turn.id]),
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
    svg(name, className = "") {
      return `<svg data-icon="${name}" class="${className}"></svg>`;
    },
  },
});

renderer.render();
const html = mountRoot.innerHTML;

for (const className of [
  "codex-reasoning-disclosure",
  "codex-command-disclosure",
  "codex-patch-file-list",
  "codex-web-search-row",
  "codex-plan-summary",
]) {
  assert.ok(html.includes(className), `missing semantic renderer ${className}`);
}
assert.ok(html.includes('data-variant="reasoning"'));
assert.ok(html.includes('data-variant="plan"'));
assert.ok(!html.includes('<md data-variant="reasoning">Reasoning body</md>'), "official reasoning renderer only uses summary");
assert.ok(html.includes("<md data-variant=\"reasoning\">**Summary**\n\nDetails</md>"));
assert.ok(html.includes("'Codex' in https://example.com/docs"));
assert.ok(html.includes("frontend/src/app.js"));
assert.ok(!html.includes("turn-1:4:assistant"), "MCP calls must remain unrendered until their dedicated renderer exists");
assert.ok(!html.includes("turn-1:5:assistant"), "dynamic calls must remain unrendered until their dedicated renderer exists");
for (const itemIndex of [8, 9, 10, 11]) {
  assert.ok(!html.includes(`turn-1:${itemIndex}:assistant`), "officially skipped items must not create visible conversation units");
}
assert.ok(!html.includes('data-icon="editFile"'), "tool types must not share the file-edit icon");
assert.ok(!rendererSource.includes("renderStructuredToolBody"), "tool bodies must not share a guessed renderer");
assert.ok(!rendererSource.includes("renderSemanticDisclosure"), "unrelated items must not share a semantic renderer");

state.expandedProcessTurns = new Set();
renderer.render();
const collapsedProcessHTML = mountRoot.innerHTML;
assert.ok(collapsedProcessHTML.includes("codex-turn-activity-summary"), "collapsed activity must keep its summary row");
assert.ok(!collapsedProcessHTML.includes("codex-reasoning-disclosure"), "collapsed activity must not render reasoning body");
assert.ok(!collapsedProcessHTML.includes("codex-command-disclosure"), "collapsed activity must not render command body");
assert.ok(!collapsedProcessHTML.includes("codex-patch-file-list"), "collapsed activity must not render file changes");
assert.ok(collapsedProcessHTML.includes("Answer"), "collapsed activity must keep the final answer visible");

state.expandedProcessTurns = new Set([turn.id]);
turn.status = "inProgress";
state.turnErrors = [{
  error: {
    message: "Reconnecting... 5/5",
    codexErrorInfo: null,
    additionalDetails: "unexpected status 503 Service Unavailable\nurl: https://api.zelt.cn/v1/responses",
  },
  willRetry: true,
  threadId: thread.id,
  turnId: turn.id,
}];
renderer.render();
const retryWithDetailsHTML = mountRoot.innerHTML;
assert.ok(retryWithDetailsHTML.includes('<details class="codex-stream-error text-size-chat">'));
assert.ok(!retryWithDetailsHTML.includes('<details class="codex-stream-error text-size-chat" open'));
assert.ok(retryWithDetailsHTML.includes("正在重新连接 5/5"));
assert.ok(retryWithDetailsHTML.includes("unexpected status 503 Service Unavailable\nurl: https://api.zelt.cn/v1/responses"));
assert.ok(retryWithDetailsHTML.includes("codex-stream-error-chevron"));

state.turnErrors = [{
  error: {
    message: "Reconnecting 2/5",
    codexErrorInfo: null,
    additionalDetails: null,
  },
  willRetry: true,
  threadId: thread.id,
  turnId: turn.id,
}];
renderer.render();
const retryWithoutDetailsHTML = mountRoot.innerHTML;
assert.ok(retryWithoutDetailsHTML.includes("codex-stream-error-static"));
assert.ok(retryWithoutDetailsHTML.includes("正在重新连接 2/5"));
assert.ok(!retryWithoutDetailsHTML.includes('<details class="codex-stream-error text-size-chat">'));
assert.ok(!retryWithoutDetailsHTML.includes("codex-stream-error-chevron"));

state.turnErrors = [];
turn.status = "failed";
turn.error = {
  message: "unexpected status 503 Service Unavailable",
  codexErrorInfo: null,
  additionalDetails: null,
};
renderer.render();
const turnErrorHTML = mountRoot.innerHTML;
assert.ok(turnErrorHTML.includes('<div class="codex-turn-error-icon"><svg'));
assert.ok(turnErrorHTML.includes('<div class="codex-turn-error-content">'));
assert.ok(turnErrorHTML.includes('<div class="codex-turn-error-message">unexpected status 503 Service Unavailable</div>'));
