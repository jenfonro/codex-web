"use strict";

(function defineCodexPanelFixtures(global) {
  function createSampleData(options = {}) {
    const {
      useDynamicFixture = false,
      sampleAttachmentSrc = global.CodexPanelConfig.SAMPLE_ATTACHMENT_PLACEHOLDER,
    } = options;
    const now = Date.now();
    const sessions = [
      {
        id: "sample-setup",
        title: "Prepare Codex Web runtime",
        status: "idle",
        updatedAt: new Date(now - 56 * 60 * 1000).toISOString(),
        timeLabel: "56m",
      },
      {
        id: "sample-thread",
        title: "Review local Codex sessions",
        status: "idle",
        updatedAt: new Date(now - 5 * 60 * 1000).toISOString(),
        timeLabel: "5m",
      },
    ];

    if (useDynamicFixture) {
      sessions.unshift({
        id: "dynamic-running",
        title: "Live runtime state",
        status: "running",
        updatedAt: new Date(now).toISOString(),
        timeLabel: "now",
      });
    }

    const eventsBySession = new Map();
    if (useDynamicFixture) {
      eventsBySession.set("dynamic-running", [
        {
          kind: "user_message",
          text: "Continue the current session.",
          data: { turnId: "dynamic-running-turn" },
          time: new Date(now - 3000).toISOString(),
          seq: 1,
        },
        {
          kind: "turn_started",
          text: "Thinking",
          data: { status: "running", turnId: "dynamic-running-turn", contentUnit: 1 },
          time: new Date(now - 2000).toISOString(),
          seq: 2,
        },
        {
          kind: "tool_call",
          text: "Editing 1 file",
          items: [
            { text: "frontend/src/pages/codex/index.js" },
            { text: "frontend/src/pages/codex/renderer.js" },
          ],
          data: { status: "running", turnId: "dynamic-running-turn", contentUnit: 2 },
          time: new Date(now - 1000).toISOString(),
          seq: 3,
        },
      ]);
    }

    eventsBySession.set("sample-thread", [
      {
        kind: "user_message",
        text: "Connect the session list and thread view to local Codex data.",
        data: {
          turnId: "sample-turn-1",
          attachments: [{ label: "Sample attachment", src: sampleAttachmentSrc }],
        },
        time: new Date(now - 9 * 60 * 1000).toISOString(),
        seq: 1,
      },
      {
        kind: "summary",
        data: {
          turnId: "sample-turn-1",
          followup: {
            data: { contentUnit: 1 },
            text: "The list loads from the local Codex host, and the thread view receives incremental updates through SSE.",
            time: new Date(now - 8 * 60 * 1000).toISOString(),
          },
        },
        text: "Processed 18s",
        time: new Date(now - 8 * 60 * 1000).toISOString(),
        seq: 2,
      },
      {
        kind: "assistant_message",
        text: "The local data flow is connected. History and streaming output use the same rendering structure.",
        data: {
          turnId: "sample-turn-1",
          contentUnit: 2,
          diffCard: {
            files: [
              { path: "frontend/src/pages/codex/index.js", additions: "+36", deletions: "-8" },
              { path: "backend/internal/appserver/client.go", additions: "+22", deletions: "-3" },
              { path: "backend/internal/server/sessions.go", additions: "+18", deletions: "-2" },
            ],
            total: 3,
            additions: "+76",
            deletions: "-13",
          },
        },
        time: new Date(now - 7 * 60 * 1000).toISOString(),
        seq: 3,
      },
      {
        kind: "user_message",
        text: "Pressing Enter in the composer should send directly.",
        data: { turnId: "sample-turn-2" },
        time: new Date(now - 6 * 60 * 1000).toISOString(),
        seq: 4,
      },
      {
        kind: "assistant_message",
        text: "Handled: Enter sends, Shift+Enter keeps a newline, and IME composition is ignored.",
        data: {
          turnId: "sample-turn-2",
          contentUnit: 1,
          placement: "final",
          actionsVisible: true,
        },
        time: new Date(now - 5 * 60 * 1000).toISOString(),
        seq: 5,
      },
    ]);

    eventsBySession.set("sample-setup", [
      {
        kind: "user_message",
        text: "Check whether Codex Web keeps CODEX_HOME persistent.",
        time: new Date(now - 56 * 60 * 1000).toISOString(),
        seq: 1,
      },
      {
        kind: "assistant_message",
        text: "CODEX_HOME is mounted as persistent data, so sessions remain after the container restarts.",
        time: new Date(now - 55 * 60 * 1000).toISOString(),
        seq: 2,
      },
    ]);

    return { sessions, eventsBySession };
  }

  global.CodexPanelFixtures = { createSampleData };
})(window);
