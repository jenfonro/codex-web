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
        title: "准备 Agent 运行环境",
        status: "idle",
        updatedAt: new Date(now - 56 * 60 * 1000).toISOString(),
        timeLabel: "56 分钟",
      },
      {
        id: "sample-thread",
        title: "接入多服务器会话管理",
        status: "idle",
        updatedAt: new Date(now - 5 * 60 * 1000).toISOString(),
        timeLabel: "5 分钟",
      },
    ];

    if (useDynamicFixture) {
      sessions.unshift({
        id: "dynamic-running",
        title: "动态状态示例",
        status: "running",
        updatedAt: new Date(now).toISOString(),
        timeLabel: "刚刚",
      });
    }

    const eventsBySession = new Map();
    if (useDynamicFixture) {
      eventsBySession.set("dynamic-running", [
        {
          kind: "user_message",
          text: "请继续处理当前会话",
          turnKey: "dynamic-running-turn",
          time: new Date(now - 3000).toISOString(),
          seq: 1,
        },
        {
          kind: "turn_started",
          status: "running",
          text: "正在思考",
          turnKey: "dynamic-running-turn",
          contentUnit: 1,
          time: new Date(now - 2000).toISOString(),
          seq: 2,
        },
        {
          kind: "tool_call",
          status: "running",
          text: "正在编辑 1 个文件",
          items: [
            { text: "frontend/src/pages/codex/index.js" },
            { text: "frontend/src/pages/codex/renderer.js" },
          ],
          turnKey: "dynamic-running-turn",
          contentUnit: 2,
          time: new Date(now - 1000).toISOString(),
          seq: 3,
        },
      ]);
    }

    eventsBySession.set("sample-thread", [
      {
        kind: "user_message",
        text: "把会话列表和会话详情接回 Agent 数据流。",
        attachments: [{ label: "用户附件", src: sampleAttachmentSrc }],
        turnKey: "sample-turn-1",
        time: new Date(now - 9 * 60 * 1000).toISOString(),
        seq: 1,
      },
      {
        kind: "summary",
        turnKey: "sample-turn-1",
        text: "已处理 18s",
        followup: {
          contentUnit: 1,
          text: "会话列表从控制器读取，详情页按 sessionId 加载事件，并通过 SSE 接收增量更新。",
          time: new Date(now - 8 * 60 * 1000).toISOString(),
        },
        time: new Date(now - 8 * 60 * 1000).toISOString(),
        seq: 2,
      },
      {
        kind: "assistant_message",
        contentUnit: 2,
        text: "已完成基础数据流接入。历史会话和实时输出会使用同一套结构显示。",
        diffCard: {
          files: [
            { path: "frontend/src/pages/codex/index.js", additions: "+36", deletions: "-8" },
            { path: "agent/internal/session/store.go", additions: "+22", deletions: "-3" },
            { path: "backend/internal/server/sessions.go", additions: "+18", deletions: "-2" },
          ],
          total: 3,
          additions: "+76",
          deletions: "-13",
        },
        time: new Date(now - 7 * 60 * 1000).toISOString(),
        seq: 3,
      },
      {
        kind: "user_message",
        text: "输入框按回车时要直接发送。",
        turnKey: "sample-turn-2",
        time: new Date(now - 6 * 60 * 1000).toISOString(),
        seq: 4,
      },
      {
        kind: "assistant_message",
        contentUnit: 1,
        text: "已处理：Enter 发送，Shift+Enter 保留换行，输入法组合状态不会误触发发送。",
        placement: "final",
        actionsVisible: true,
        time: new Date(now - 5 * 60 * 1000).toISOString(),
        seq: 5,
      },
    ]);

    eventsBySession.set("sample-setup", [
      {
        kind: "user_message",
        text: "检查 Agent 容器是否可以持久化 Codex 数据。",
        time: new Date(now - 56 * 60 * 1000).toISOString(),
        seq: 1,
      },
      {
        kind: "assistant_message",
        text: "Agent 数据目录已挂载到宿主机，容器重启后会保留 CODEX_HOME。",
        time: new Date(now - 55 * 60 * 1000).toISOString(),
        seq: 2,
      },
    ]);

    return { sessions, eventsBySession };
  }

  global.CodexPanelFixtures = { createSampleData };
})(window);
