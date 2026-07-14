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
  const content = [];
  const refs = assistantRefsForTurn(turn);
  const split = splitTurnFollowups(refs);
  const processFirst = !split.finalFollowup && split.processFollowups.length > 0;

  if (!processFirst) {
    for (const ref of split.streamFollowups) {
      const part = assistantPartForItem(ref.item);
      if (part) appendAssistantPart(content, part);
    }
  }

  const visibleProcessFollowups = mergeAdjacentActivityMessages(
    split.processFollowups.filter(isVisibleProcessFollowup),
  );

  for (const ref of visibleProcessFollowups) {
    const part = activityPartForItem(ref.item, turn);
    if (part) appendAssistantPart(content, part);
  }

  if (processFirst) {
    for (const ref of split.streamFollowups) {
      const part = assistantPartForItem(ref.item);
      if (part) appendAssistantPart(content, part);
    }
  }

  if (split.finalFollowup) {
    appendTextPart(content, split.finalFollowup.item.text ?? "");
  }

  if (turn.error) appendTextPart(content, formatError(turn.error));
  if (!content.length) return null;

  return assistantMessage(
    turn,
    { id: `${turn.id}-assistant`, type: "assistantTurn" },
    content,
    isRunning && turn.status === "inProgress",
    visibleProcessFollowups.length
      ? {
          codexActivityLabel: activitySummaryLabel(turn),
          codexActivityCount: visibleProcessFollowups.length,
          codexActivityParentId: activityParentId(turn),
        }
      : undefined,
  );
}

function assistantMessage(turn, item, content, running, custom = undefined) {
  return {
    id: item.id,
    role: "assistant",
    createdAt: timestampToDate(turn.startedAt),
    content: Array.isArray(content) ? content : [{ type: "text", text: content }],
    status: running ? { type: "running" } : { type: "complete", reason: "stop" },
    metadata: {
      unstable_state: null,
      unstable_annotations: [],
      unstable_data: [],
      steps: [],
      custom: {
        ...baseCustom(turn, item),
        ...(custom ?? {}),
      },
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

function assistantPartForItem(item) {
  switch (item.type) {
    case "agentMessage":
      return textPart(item.text ?? "");
    case "reasoning":
      return null;
    case "commandExecution":
      return commandToolPart(item);
    case "fileChange":
      return fileChangeToolPart(item);
    case "mcpToolCall":
      return genericToolPart(item, item.server ? `${item.server}.${item.tool}` : item.tool, "MCP 工具");
    case "dynamicToolCall":
      return genericToolPart(item, item.namespace ? `${item.namespace}.${item.tool}` : item.tool, "工具调用");
    case "webSearch":
      return processedToolPart(item, "搜索", { query: item.action?.query ?? item.query ?? "" }, "已完成");
    case "plan":
      return textPart(item.text ? `计划\n\n${item.text}` : "");
    case "contextCompaction":
      return processedToolPart(item, "上下文压缩", {}, "上下文已自动压缩。");
    case "imageView":
      return processedToolPart(item, "查看图片", item.path ? { path: item.path } : {}, "已查看");
    case "sleep":
      return processedToolPart(
        item,
        "等待",
        item.durationMs ? { durationSeconds: Math.round(item.durationMs / 1000) } : {},
        isRunningStatus(item.status) ? undefined : "已完成",
      );
    default:
      return null;
  }
}

function activityPartForItem(item, turn) {
  const parentId = activityParentId(turn);
  let part = null;
  let activity = null;

  switch (item.type) {
    case "agentMessage":
      part = processedToolPart(item, "进展", {}, item.text ?? "");
      activity = { kind: "message", text: item.text ?? "" };
      break;
    case "commandExecution":
      part = commandToolPart(item, commandExecutionLabel(item, isRunningStatus(item.status)));
      activity = {
        kind: "command",
        label: commandExecutionLabel(item, isRunningStatus(item.status)),
        command: item.command ?? "",
        output: typeof item.aggregatedOutput === "string" ? item.aggregatedOutput.trim() : "",
      };
      break;
    case "fileChange":
      part = fileChangeToolPart(item);
      activity = { kind: "fileChange", changes: fileChangeRows(item) };
      break;
    case "mcpToolCall":
      part = genericToolPart(item, item.server ? `${item.server}.${item.tool}` : item.tool, "MCP 工具");
      activity = { kind: "tool", label: part?.toolName, text: part?.result };
      break;
    case "dynamicToolCall":
      part = genericToolPart(item, item.namespace ? `${item.namespace}.${item.tool}` : item.tool, "工具调用");
      activity = { kind: "tool", label: part?.toolName, text: part?.result };
      break;
    case "webSearch":
      part = processedToolPart(item, "搜索", { query: item.action?.query ?? item.query ?? "" }, "已完成");
      activity = { kind: "webSearch", label: "已搜索网页", text: item.action?.query ?? item.query ?? "" };
      break;
    case "contextCompaction":
      part = processedToolPart(item, "上下文压缩", {}, "上下文已自动压缩。");
      activity = { kind: "contextCompaction", text: "上下文已自动压缩" };
      break;
    case "imageView":
      part = processedToolPart(item, "查看图片", item.path ? { path: item.path } : {}, "已查看");
      activity = { kind: "tool", label: "已查看图片", text: item.path ?? "" };
      break;
    case "sleep":
      part = processedToolPart(
        item,
        "等待",
        item.durationMs ? { durationSeconds: Math.round(item.durationMs / 1000) } : {},
        isRunningStatus(item.status) ? undefined : "已完成",
      );
      activity = {
        kind: "tool",
        label: isRunningStatus(item.status) ? "正在等待" : "已等待",
        text: item.durationMs ? `${Math.round(item.durationMs / 1000)} 秒` : "",
      };
      break;
    default:
      part = assistantPartForItem(item);
  }

  if (!part) return null;
  if (part.type !== "tool-call") {
    return processedToolPart(item, item.type ?? "处理", {}, part.text ?? "");
  }
  return withActivityMetadata(part, parentId, activity);
}

function textPart(text) {
  return typeof text === "string" && text.trim() ? { type: "text", text } : null;
}

function appendAssistantPart(content, part) {
  if (part.type === "text") {
    appendTextPart(content, part.text);
    return;
  }
  content.push(part);
}

function appendTextPart(content, text) {
  if (typeof text !== "string" || !text.trim()) return;
  const previous = content[content.length - 1];
  if (previous?.type === "text") {
    previous.text = `${previous.text}\n\n${text}`;
    return;
  }
  content.push({ type: "text", text });
}

function commandToolPart(item, toolName = "命令") {
  const args = {
    command: item.command ?? "",
    ...(item.cwd ? { cwd: item.cwd } : {}),
  };
  const result = commandResult(item);
  return processedToolPart(item, toolName, args, result);
}

function commandResult(item) {
  if (isRunningStatus(item.status) && !item.aggregatedOutput) return undefined;
  const lines = [];
  if (item.status) lines.push(`状态：${item.status}`);
  if (item.exitCode !== undefined && item.exitCode !== null) lines.push(`退出码：${item.exitCode}`);
  if (item.durationMs !== undefined && item.durationMs !== null) lines.push(`耗时：${item.durationMs}ms`);
  const output = typeof item.aggregatedOutput === "string" ? item.aggregatedOutput.trim() : "";
  if (output) lines.push(`输出\n\n${output}`);
  return lines.length ? lines.join("\n") : "已完成";
}

function fileChangeToolPart(item) {
  const changes = fileChangeRows(item);
  const result = changes.length
    ? changes.map((change) => `- ${change.path} (${change.action})`).join("\n")
    : "文件变更已完成。";
  return processedToolPart(item, "文件变更", {}, result);
}

function genericToolPart(item, name, fallbackName) {
  const result = item.error ?? item.result ?? item.contentItems ?? (isRunningStatus(item.status) ? undefined : "已完成");
  return processedToolPart(item, name ?? fallbackName, safeObject(item.arguments), result, Boolean(item.error));
}

function processedToolPart(item, toolName, args, result, isError = false) {
  const normalizedArgs = safeObject(args);
  const argsText = Object.keys(normalizedArgs).length ? JSON.stringify(normalizedArgs, null, 2) : "";
  const hasResult = result !== undefined && result !== null && !isRunningStatus(item.status);
  return {
    type: "tool-call",
    toolCallId: item.id ?? `${item.type}-${hashText(`${toolName}:${JSON.stringify(normalizedArgs)}`)}`,
    toolName,
    args: normalizedArgs,
    argsText,
    ...(hasResult ? { result } : {}),
    ...(isError ? { isError: true } : {}),
  };
}

function withActivityMetadata(part, parentId, activity) {
  if (!activity) return { ...part, parentId };
  return {
    ...part,
    parentId,
    codexActivityKind: activity.kind,
    ...(activity.label ? { codexActivityLabel: activity.label } : {}),
    ...(activity.text !== undefined && activity.text !== null ? { codexActivityText: activity.text } : {}),
    ...(activity.command ? { codexActivityCommand: activity.command } : {}),
    ...(activity.output ? { codexActivityOutput: activity.output } : {}),
    ...(activity.changes ? { codexActivityChanges: activity.changes } : {}),
  };
}

function commandExecutionLabel(item, pending) {
  const actions = Array.isArray(item.commandActions) ? item.commandActions : [];
  if (actions.length !== 1) return commandStatusLabel(pending);
  const action = actions[0];
  if (action.type === "read") return `${pending ? "正在读取" : "已读取"} ${action.name ?? ""}`.trim();
  if (action.type === "search") return `${pending ? "正在搜索" : "已搜索"} ${action.query ?? ""}`.trim();
  if (action.type === "listFiles") return `${pending ? "正在列出" : "已列出"} ${action.path ?? ""}`.trim();
  return commandStatusLabel(pending);
}

function commandStatusLabel(pending) {
  return pending ? "正在运行命令" : "已运行命令";
}

function fileChangeRows(item) {
  const changes = Array.isArray(item.changes) ? item.changes : [];
  return changes.map((change) => ({
    path: change.path ?? "未知文件",
    action: fileChangeActionLabel(change.kind?.type, item.status),
    kind: change.kind?.type ?? "change",
    diff: change.diff ?? "",
  }));
}

function fileChangeActionLabel(kind, status) {
  if (status === "inProgress") {
    if (kind === "add") return "正在创建";
    if (kind === "delete") return "正在删除";
    return "正在编辑";
  }
  if (status === "declined" || status === "failed") return "已拒绝";
  if (kind === "add") return "已创建";
  if (kind === "delete") return "已删除";
  return "已编辑";
}

function assistantRefsForTurn(turn) {
  return (turn.items ?? [])
    .map((item, itemIndex) => ({ turn, item, itemIndex }))
    .filter((ref) => ref.item && typeof ref.item === "object" && ref.item.type !== "userMessage");
}

function splitTurnFollowups(followups) {
  const finalIndex = findFinalIndex(followups);
  if (finalIndex < 0) {
    const hasProcessSignals = followups.some(isProcessSignal);
    if (hasProcessSignals) {
      const processFollowups = followups.filter(isProcessSignal);
      return {
        processFollowups,
        finalFollowup: null,
        streamFollowups: followups.filter((ref) => !processFollowups.includes(ref)),
      };
    }
    return {
      processFollowups: [],
      finalFollowup: null,
      streamFollowups: followups,
    };
  }

  const beforeFinal = followups.slice(0, finalIndex);
  const afterFinal = followups.slice(finalIndex + 1);
  const hasProcessSignals = beforeFinal.some(isProcessSignal);
  const processFollowups = beforeFinal.filter((ref) => isProcessSignal(ref) || (hasProcessSignals && isAssistant(ref)));
  const streamFollowups = [
    ...beforeFinal.filter((ref) => !processFollowups.includes(ref)),
    ...afterFinal,
  ];
  return {
    processFollowups,
    finalFollowup: followups[finalIndex],
    streamFollowups,
  };
}

function findFinalIndex(followups) {
  for (let index = followups.length - 1; index >= 0; index -= 1) {
    const ref = followups[index];
    if (isAssistant(ref) && ref.item.phase === "final_answer" && !isStreamingAssistant(ref)) {
      return index;
    }
  }
  return -1;
}

function isProcessSignal(ref) {
  if ([
    "reasoning",
    "commandExecution",
    "fileChange",
    "webSearch",
    "mcpToolCall",
    "dynamicToolCall",
    "contextCompaction",
    "imageView",
    "sleep",
  ].includes(ref.item.type)) return true;
  return isAssistant(ref) && ref.item.phase === "commentary";
}

function isVisibleProcessFollowup(ref) {
  return ref.item.type !== "reasoning";
}

function mergeAdjacentActivityMessages(followups) {
  const merged = [];
  let messages = [];

  const flushMessages = () => {
    if (!messages.length) return;
    merged.push(mergedActivityMessage(messages));
    messages = [];
  };

  for (const ref of followups) {
    if (isAssistant(ref)) {
      messages.push(ref);
      continue;
    }
    flushMessages();
    merged.push(ref);
  }

  flushMessages();
  return merged;
}

function mergedActivityMessage(refs) {
  if (refs.length === 1) return refs[0];
  const first = refs[0];
  const text = refs
    .map((ref) => ref.item.text ?? "")
    .filter((value) => value.trim())
    .join("\n\n");
  return {
    ...first,
    item: {
      ...first.item,
      id: `${first.turn.id}-activity-message-${hashText(text)}`,
      text,
    },
  };
}

function isAssistant(ref) {
  return ref.item.type === "agentMessage";
}

function isStreamingAssistant(ref) {
  return isAssistant(ref) && ref.turn.status === "inProgress" && ref.itemIndex === (ref.turn.items?.length ?? 0) - 1;
}

function activityParentId(turn) {
  return `codex-activity:${turn.id}`;
}

function activitySummaryLabel(turn) {
  if (turn.durationMs === null || turn.durationMs === undefined) return "已处理";
  return `已处理 ${formatDurationMs(turn.durationMs)}`;
}

function formatDurationMs(durationMs) {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  if (minutes < 60) return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes ? `${hours}h ${restMinutes}m` : `${hours}h`;
}

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function isRunningStatus(status) {
  return status === "inProgress" || status === "running" || status === "pending";
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
