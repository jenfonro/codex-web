export function createEmptyThreadState() {
  return {
    turns: [],
    turnErrors: [],
  };
}

export function createNewThreadState() {
  return createEmptyThreadState();
}

export function applyStateUpdate(state, update) {
  switch (update.type) {
    case "state":
      return {
        turns: update.data.history?.turns ?? [],
        turnErrors: [],
      };
    case "turnStarted":
      return {
        turns: [...state.turns, update.data],
        turnErrors: [],
      };
    case "turnUpdated":
      return {
        turns: replaceTurn(state.turns, update.data),
        turnErrors: update.data.status !== "inProgress" && update.data.error === null ? [] : state.turnErrors,
      };
    case "turnError":
      return {
        turns: state.turns,
        turnErrors: [...state.turnErrors, update.data],
      };
    default:
      return state;
  }
}

export function messagesFromCodexState(state, isRunning = false) {
  const messages = [];

  for (const turn of state.turns) {
    const user = userMessageForTurn(turn);
    if (user) messages.push(user);

    const assistant = assistantMessageForTurn(turn, isRunning);
    if (assistant) messages.push(assistant);
  }

  for (const notification of state.turnErrors) {
    messages.push(turnNotificationMessage(notification));
  }

  return messages;
}

export function threadTitle(thread) {
  const name = typeof thread?.name === "string" ? thread.name.trim() : "";
  const preview = typeof thread?.preview === "string" ? thread.preview.trim() : "";
  return name || preview || "未命名会话";
}

export function extractPrompt(message) {
  const parts = Array.isArray(message?.content) ? message.content : [];
  return parts
    .filter((part) => part?.type === "text")
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
}

function userMessageForTurn(turn) {
  const userItems = (turn.items ?? []).filter((item) => item?.type === "userMessage");
  if (!userItems.length) return null;
  const text = userItems.map(userTextForItem).filter(Boolean).join("\n\n");
  if (!text) return null;
  return {
    id: userItems.length === 1 ? userItems[0].id : `${turn.id}-user`,
    role: "user",
    createdAt: timestampToDate(turn.startedAt),
    content: [{ type: "text", text }],
    attachments: [],
    metadata: baseMetadata(turn, { id: `${turn.id}-user`, type: "userMessage" }),
  };
}

function assistantMessageForTurn(turn, isRunning) {
  const sections = [];

  for (const item of turn.items ?? []) {
    if (!item || typeof item !== "object" || item.type === "userMessage") continue;
    const text = assistantTextForItem(item);
    if (text) sections.push(text);
  }

  if (turn.error) sections.push(formatError(turn.error));
  if (!sections.length) return null;

  return assistantMessage(
    turn,
    { id: `${turn.id}-assistant`, type: "assistantTurn" },
    sections.join("\n\n---\n\n"),
    isRunning && turn.status === "inProgress",
  );
}

function assistantMessage(turn, item, text, running) {
  return {
    id: item.id,
    role: "assistant",
    createdAt: timestampToDate(turn.startedAt),
    content: [{ type: "text", text }],
    status: running ? { type: "running" } : { type: "complete", reason: "stop" },
    metadata: {
      unstable_state: null,
      unstable_annotations: [],
      unstable_data: [],
      steps: [],
      custom: baseCustom(turn, item),
    },
  };
}

function userTextForItem(item) {
  return (item.content ?? [])
    .map((part) => (part?.type === "text" ? part.text ?? "" : ""))
    .filter(Boolean)
    .join("\n\n");
}

function turnErrorMessage(turn) {
  return assistantMessage(turn, { id: `${turn.id}-error`, type: "turnError" }, formatError(turn.error), false);
}

function turnNotificationMessage(notification) {
  const turn = {
    id: notification.turnId,
    status: notification.willRetry ? "inProgress" : "failed",
    startedAt: null,
  };
  const item = {
    id: `${notification.turnId}-${notification.willRetry ? "retry" : "error"}-${hashText(notification.error?.message ?? "")}`,
    type: "turnError",
  };
  return assistantMessage(turn, item, formatError(notification.error), notification.willRetry);
}

function assistantTextForItem(item) {
  switch (item.type) {
    case "agentMessage":
      return item.text ?? "";
    case "reasoning":
      return formatReasoning(item);
    case "commandExecution":
      return formatCommand(item);
    case "fileChange":
      return formatFileChange(item);
    case "mcpToolCall":
      return formatToolCall("MCP 工具", item.server ? `${item.server}.${item.tool}` : item.tool, item);
    case "dynamicToolCall":
      return formatToolCall("工具调用", item.namespace ? `${item.namespace}.${item.tool}` : item.tool, item);
    case "webSearch":
      return `搜索：${item.action?.query ?? item.query ?? ""}`.trim();
    case "plan":
      return item.text ? `计划\n\n${item.text}` : "";
    case "contextCompaction":
      return "上下文已自动压缩。";
    case "imageView":
      return item.path ? `查看图片：${item.path}` : "查看图片";
    case "sleep":
      return item.durationMs ? `等待 ${Math.round(item.durationMs / 1000)} 秒。` : "等待中。";
    default:
      return "";
  }
}

function formatReasoning(item) {
  const summary = Array.isArray(item.summary) ? item.summary.filter(Boolean).join("\n\n") : "";
  const content = Array.isArray(item.content) ? item.content.filter(Boolean).join("\n\n") : "";
  const text = summary || content;
  return text ? `思考\n\n${text}` : "思考中...";
}

function formatCommand(item) {
  const output = item.aggregatedOutput ? `\n\n输出\n\n\`\`\`\n${item.aggregatedOutput.trim()}\n\`\`\`` : "";
  const status = item.status ? `\n状态：${item.status}` : "";
  const cwd = item.cwd ? `\n目录：${item.cwd}` : "";
  return `命令\n\n\`\`\`bash\n${item.command ?? ""}\n\`\`\`${status}${cwd}${output}`;
}

function formatFileChange(item) {
  const changes = Array.isArray(item.changes) ? item.changes : [];
  if (!changes.length) return "文件变更已完成。";
  return `文件变更\n\n${changes.map((change) => `- ${change.path ?? "未知文件"} (${change.kind?.type ?? "change"})`).join("\n")}`;
}

function formatToolCall(label, name, item) {
  const status = item.status ? `\n状态：${item.status}` : "";
  const args = item.arguments ? `\n\n参数\n\n\`\`\`json\n${JSON.stringify(item.arguments, null, 2)}\n\`\`\`` : "";
  return `${label}：${name ?? "unknown"}${status}${args}`;
}

function formatError(error) {
  if (!error) return "发生未知错误。";
  const details = error.additionalDetails ? `\n\n${error.additionalDetails}` : "";
  return `错误：${error.message ?? "未知错误"}${details}`;
}

function replaceTurn(turns, turn) {
  const index = turns.findIndex((item) => item.id === turn.id);
  if (index < 0) return [...turns, turn];
  const next = turns.slice();
  next[index] = mergeTurn(next[index], turn);
  return next;
}

function mergeTurn(current, incoming) {
  if ((incoming.items?.length ?? 0) > 0 || (current.items?.length ?? 0) === 0) {
    return incoming;
  }
  return {
    ...incoming,
    items: current.items,
    itemsView: current.itemsView,
  };
}

function baseMetadata(turn, item) {
  return {
    custom: baseCustom(turn, item),
  };
}

function baseCustom(turn, item) {
  return {
    turnId: turn.id,
    itemType: item.type,
  };
}

function timestampToDate(value) {
  if (!value) return new Date();
  return new Date(value < 1_000_000_000_000 ? value * 1000 : value);
}

function hashText(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}
