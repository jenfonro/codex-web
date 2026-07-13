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
    assert.match(messages[1].content[0].text, /思考/);
    assert.match(messages[1].content[0].text, /Answer/);
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
