import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyStateUpdate,
  extractPrompt,
  messagesFromCodexState,
  threadTitle,
} from "../src/support/codex-transform.js";

describe("codex transform", () => {
  it("converts codex turns into assistant-ui messages", () => {
    const state = {
      turns: [
        {
          id: "turn-1",
          status: "completed",
          error: null,
          startedAt: 1783950000,
          items: [
            {
              id: "user-1",
              type: "userMessage",
              content: [{ type: "text", text: "Question" }],
            },
            {
              id: "reason-1",
              type: "reasoning",
              summary: ["Looked around"],
              content: ["private text"],
            },
            {
              id: "agent-1",
              type: "agentMessage",
              text: "Answer",
            },
          ],
        },
      ],
      turnErrors: [],
    };

    const messages = messagesFromCodexState(state);
    assert.equal(messages.length, 2);
    assert.equal(messages[0].role, "user");
    assert.equal(messages[0].content[0].text, "Question");
    assert.equal(messages[1].role, "assistant");
    assert.equal(messages[1].content.length, 1);
    assert.equal(messages[1].content[0].type, "text");
    assert.match(messages[1].content[0].text, /Answer/);
    assert.ok(!messages[1].content.some((part) => part.codexActivityKind === "reasoning"));
    assert.ok(!messages[1].content.some((part) => part.toolName === "已思考"));
  });

  it("strips Codex app file envelopes from displayed user messages", () => {
    const state = {
      turns: [
        {
          id: "turn-1",
          status: "completed",
          error: null,
          startedAt: 1783950000,
          items: [
            {
              id: "user-1",
              type: "userMessage",
              content: [
                {
                  type: "text",
                  text: [
                    "# Files mentioned by the user:",
                    "",
                    "## screenshot.png: C:/Users/example/AppData/Local/Temp/screenshot.png",
                    "",
                    "## My request for Codex:",
                    "比如这个",
                  ].join("\n"),
                },
              ],
            },
          ],
        },
      ],
      turnErrors: [],
    };

    const [message] = messagesFromCodexState(state);
    assert.equal(message.content[0].text, "比如这个");
  });

  it("converts processed codex items into assistant-ui tool-call parts", () => {
    const state = {
      turns: [
        {
          id: "turn-1",
          status: "completed",
          error: null,
          startedAt: 1783950000,
          items: [
            {
              id: "cmd-1",
              type: "commandExecution",
              status: "completed",
              command: "git status --short",
              cwd: "/workspace",
              aggregatedOutput: " M file.go\n",
            },
            {
              id: "agent-1",
              type: "agentMessage",
              text: "Done",
            },
          ],
        },
      ],
      turnErrors: [],
    };

    const [message] = messagesFromCodexState(state);
    assert.equal(message.content[0].type, "tool-call");
    assert.equal(message.content[0].toolCallId, "cmd-1");
    assert.equal(message.content[0].toolName, "已运行命令");
    assert.equal(message.content[0].codexActivityKind, "command");
    assert.equal(message.content[0].args.command, "git status --short");
    assert.match(message.content[0].result, /M file\.go/);
    assert.equal(message.content[1].type, "text");
    assert.equal(message.content[1].text, "Done");
  });

  it("uses a compact label for grouped command activity", () => {
    const state = {
      turns: [
        {
          id: "turn-1",
          status: "completed",
          error: null,
          startedAt: 1783950000,
          items: [
            {
              id: "cmd-1",
              type: "commandExecution",
              status: "completed",
              command: "git status --short",
              commandActions: [
                { type: "read", name: "base.tsx" },
                { type: "search", query: "activity" },
              ],
            },
          ],
        },
      ],
      turnErrors: [],
    };

    const [message] = messagesFromCodexState(state);
    assert.equal(message.content[0].codexActivityLabel, "运行了多个命令");
  });

  it("summarizes internal dynamic tool calls as command activity", () => {
    const state = {
      turns: [
        {
          id: "turn-1",
          status: "completed",
          error: null,
          startedAt: 1783950000,
          items: [
            {
              id: "tool-1",
              type: "dynamicToolCall",
              namespace: "node_repl",
              tool: "js",
              status: "completed",
              result: "ok",
            },
          ],
        },
      ],
      turnErrors: [],
    };

    const [message] = messagesFromCodexState(state);
    assert.equal(message.content[0].codexActivityKind, "command");
    assert.equal(message.content[0].codexActivityLabel, "运行了多个命令");
    assert.ok(!JSON.stringify(message.content).includes("node_repl.js"));
  });

  it("moves completed pre-final activity out of the visible answer", () => {
    const state = {
      turns: [
        {
          id: "turn-1",
          status: "completed",
          error: null,
          startedAt: 1783950000,
          durationMs: 130000,
          items: [
            {
              id: "reason-1",
              type: "reasoning",
              summary: ["Read old renderer"],
            },
            {
              id: "commentary-1",
              type: "agentMessage",
              phase: "commentary",
              text: "I am checking the old logic.",
            },
            {
              id: "cmd-1",
              type: "commandExecution",
              status: "completed",
              command: "git grep activity",
              aggregatedOutput: "activity-summary.js\n",
            },
            {
              id: "final-1",
              type: "agentMessage",
              phase: "final_answer",
              text: "Final answer only.",
            },
          ],
        },
      ],
      turnErrors: [],
    };

    const [message] = messagesFromCodexState(state);
    assert.equal(message.metadata.custom.codexActivityLabel, "已处理 2m 10s");
    assert.equal(message.metadata.custom.codexActivityParentId, "codex-activity:turn-1");
    assert.equal(message.metadata.custom.codexActivityCount, 2);
    assert.equal(message.content.length, 3);
    assert.deepEqual(
      message.content.slice(0, 2).map((part) => part.type),
      ["tool-call", "tool-call"],
    );
    assert.ok(message.content.slice(0, 2).every((part) => part.parentId === "codex-activity:turn-1"));
    assert.ok(!message.content.some((part) => part.codexActivityKind === "reasoning"));
    assert.equal(message.content[0].toolName, "进展");
    assert.equal(message.content[0].codexActivityKind, "message");
    assert.equal(message.content[0].result, "I am checking the old logic.");
    assert.equal(message.content[1].codexActivityKind, "command");
    assert.equal(message.content[1].codexActivityLabel, "已运行命令");
    assert.equal(message.content[2].type, "text");
    assert.equal(message.content[2].text, "Final answer only.");
  });

  it("collapses commentary activity even when a turn has no final answer", () => {
    const state = {
      turns: [
        {
          id: "turn-1",
          status: "interrupted",
          error: null,
          startedAt: 1783950000,
          durationMs: null,
          items: [
            {
              id: "reason-1",
              type: "reasoning",
              summary: ["Checking runtime"],
            },
            {
              id: "commentary-1",
              type: "agentMessage",
              phase: "commentary",
              text: "I am still working.",
            },
          ],
        },
      ],
      turnErrors: [],
    };

    const [message] = messagesFromCodexState(state);
    assert.equal(message.metadata.custom.codexActivityLabel, "已处理");
    assert.equal(message.metadata.custom.codexActivityCount, 1);
    assert.equal(message.content.length, 1);
    assert.deepEqual(
      message.content.map((part) => part.type),
      ["tool-call"],
    );
    assert.ok(message.content.every((part) => part.parentId === "codex-activity:turn-1"));
    assert.ok(!message.content.some((part) => part.codexActivityKind === "reasoning"));
    assert.equal(message.content[0].toolName, "进展");
    assert.equal(message.content[0].codexActivityKind, "message");
    assert.equal(message.content[0].result, "I am still working.");
  });

  it("uses reasoning only as a process signal and merges adjacent progress text", () => {
    const state = {
      turns: [
        {
          id: "turn-1",
          status: "interrupted",
          error: null,
          startedAt: 1783950000,
          items: [
            { id: "reason-1", type: "reasoning", summary: ["First thought"] },
            {
              id: "commentary-1",
              type: "agentMessage",
              phase: "commentary",
              text: "Progress one.",
            },
            { id: "reason-2", type: "reasoning", summary: ["Second thought"] },
            {
              id: "commentary-2",
              type: "agentMessage",
              phase: "commentary",
              text: "Progress two.",
            },
          ],
        },
      ],
      turnErrors: [],
    };

    const [message] = messagesFromCodexState(state);
    const reasoningParts = message.content.filter((part) => part.codexActivityKind === "reasoning");
    assert.equal(reasoningParts.length, 0);
    assert.ok(!message.content.some((part) => part.toolName === "已思考"));
    assert.ok(!JSON.stringify(message.content).includes("First thought"));
    assert.ok(!JSON.stringify(message.content).includes("Second thought"));
    assert.deepEqual(
      message.content.map((part) => part.codexActivityKind),
      ["message"],
    );
    assert.equal(message.content[0].result, "Progress one.\n\nProgress two.");
    assert.equal(message.metadata.custom.codexActivityCount, 1);
  });

  it("marks active assistant messages as running", () => {
    const state = {
      turns: [
        {
          id: "turn-1",
          status: "inProgress",
          error: null,
          startedAt: null,
          items: [{ id: "agent-1", type: "agentMessage", text: "Streaming" }],
        },
      ],
      turnErrors: [],
    };

    const [message] = messagesFromCodexState(state, true);
    assert.equal(message.status.type, "running");
  });

  it("applies streamed turn updates", () => {
    const state = {
      turns: [{ id: "turn-1", status: "inProgress", error: null, items: [] }],
      turnErrors: [{ turnId: "turn-1", error: { message: "retry" }, willRetry: true }],
    };
    const next = applyStateUpdate(state, {
      type: "turnUpdated",
      data: { id: "turn-1", status: "completed", error: null, items: [] },
    });

    assert.equal(next.turns[0].status, "completed");
    assert.deepEqual(next.turnErrors, []);
  });

  it("does not replace existing turn items with an empty completed update", () => {
    const state = {
      turns: [
        {
          id: "turn-1",
          status: "inProgress",
          error: null,
          itemsView: "full",
          items: [{ id: "user-1", type: "userMessage", content: [{ type: "text", text: "Prompt" }] }],
        },
      ],
      turnErrors: [],
    };
    const next = applyStateUpdate(state, {
      type: "turnUpdated",
      data: { id: "turn-1", status: "completed", error: null, itemsView: "notLoaded", items: [] },
    });

    assert.equal(next.turns[0].status, "completed");
    assert.equal(next.turns[0].items.length, 1);
    assert.equal(next.turns[0].itemsView, "full");
  });

  it("extracts composer text from assistant-ui append messages", () => {
    assert.equal(
      extractPrompt({
        content: [
          { type: "text", text: "First" },
          { type: "text", text: "Second" },
        ],
      }),
      "First\nSecond",
    );
  });

  it("uses name, preview, then fallback for titles", () => {
    assert.equal(threadTitle({ name: "Named", preview: "Preview" }), "Named");
    assert.equal(threadTitle({ name: "", preview: "Preview" }), "Preview");
    assert.equal(threadTitle({}), "未命名会话");
  });
});
