"use strict";

(function defineCodexPanelActivitySummary(global) {
  const utils = global.CodexPanelUtils;
  const lifecycle = global.CodexPanelLifecycle;

  function splitTurnFollowups(followups) {
    const entries = Array.isArray(followups)
      ? followups.map((event, index) => ({ event, index }))
      : [];
    const summaryEvents = [];
    const contentEntries = [];

    for (const entry of entries) {
      if (eventKind(entry.event) === "summary") {
        summaryEvents.push(entry.event);
      } else {
        contentEntries.push(entry);
      }
    }

    const explicitFinalEntry = findExplicitFinalEntry(contentEntries);
    if (!explicitFinalEntry) {
      const settledProcessSplit = splitSettledProcessFollowups(summaryEvents, contentEntries);
      if (settledProcessSplit) return settledProcessSplit;
    }

    const finalEntry = explicitFinalEntry || findFinalEntry(contentEntries);
    if (!finalEntry) {
      return {
        summaryEvents,
        summaryDetails: summaryDetailEvents(summaryEvents),
        summaryItems: summaryDetailEvents(summaryEvents).map(summaryAssistantItem),
        processEvents: [],
        detailEvents: [],
        finalFollowup: null,
        finalFollowupPlacement: "none",
        streamFollowups: buildStreamFollowups(contentEntries),
        hasProcessSummary: summaryEvents.length > 0,
      };
    }

    const assistantEntries = contentEntries
      .filter((entry) => entry.index <= finalEntry.index && finalAssistantEntry(entry, explicitFinalEntry));
    const assistantEntrySet = new Set(assistantEntries);
    const processSummaryItems = explicitFinalEntry
      ? orderedProcessSummaryItems(
        contentEntries.filter((entry) => entry.index <= finalEntry.index && !assistantEntrySet.has(entry)),
      )
      : [];
    const processAssistantDetails = processSummaryItems
      .filter((item) => item.type === "assistant")
      .map((item) => item.event);
    const processEntries = contentEntries
      .filter((entry) => entry.index <= finalEntry.index && !assistantEntrySet.has(entry) && isCollapsibleProcessSignal(entry.event));
    const detailEntries = contentEntries
      .filter((entry) => isActivityDetailEvent(entry.event));
    const afterFinal = contentEntries
      .filter((entry) => entry.index > finalEntry.index && !isCollapsibleProcessSignal(entry.event) && !isActivityDetailEvent(entry.event));
    const processEvents = processEntries
      .filter((entry) => isProcessSignal(entry.event))
      .map((entry) => entry.event);
    const streamFollowups = buildStreamFollowups(afterFinal);
    const hasProcessSummary = summaryEvents.length > 0 || processEvents.length > 0;
    const finalFollowupPlacement = explicitFinalEntry ? "final" : hasProcessSummary ? "summary" : "final";

    return {
      summaryEvents,
      summaryDetails: [...summaryDetailEvents(summaryEvents), ...processAssistantDetails],
      summaryItems: [
        ...summaryDetailEvents(summaryEvents).map(summaryAssistantItem),
        ...processSummaryItems,
      ],
      processEvents,
      detailEvents: detailEntries.map((entry) => entry.event),
      finalFollowup: mergeAssistantEvents(assistantEntries.map((entry) => entry.event), finalEntry.event),
      finalFollowupPlacement,
      streamFollowups,
      hasProcessSummary,
    };
  }

  function findFinalEntry(entries) {
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      if (isExplicitFinalAssistant(entries[index].event)) return entries[index];
    }

    const assistantEntries = entries.filter((entry) => assistantEventHasContent(entry.event));
    if (assistantEntries.length === 1 && entries.length === 1) return assistantEntries[0];
    if (!entries.some((entry) => isProcessSignal(entry.event)) && assistantEntries.length) {
      return assistantEntries[assistantEntries.length - 1];
    }
    return null;
  }

  function findExplicitFinalEntry(entries) {
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      if (isExplicitFinalAssistant(entries[index].event)) return entries[index];
    }
    return null;
  }

  function finalAssistantEntry(entry, explicitFinalEntry) {
    if (!assistantEventHasContent(entry.event)) return false;
    if (!explicitFinalEntry) return true;
    return isExplicitFinalAssistant(entry.event);
  }

  function splitSettledProcessFollowups(summaryEvents, contentEntries) {
    if (contentEntries.some((entry) => isStandaloneTerminalActivity(entry.event))) return null;

    const processEntries = contentEntries.filter((entry) => isCollapsibleProcessSignal(entry.event));
    const detailEntries = contentEntries.filter((entry) => isActivityDetailEvent(entry.event));
    if (!processEntries.length) return null;
    if (!processEntries.every((entry) => isSettledProcessSignal(entry.event))) return null;

    return {
      summaryEvents,
      summaryDetails: summaryDetailEvents(summaryEvents),
      summaryItems: [
        ...summaryDetailEvents(summaryEvents).map(summaryAssistantItem),
        ...orderedProcessSummaryItems(contentEntries),
      ],
      processEvents: processEntries.map((entry) => entry.event),
      detailEvents: detailEntries.map((entry) => entry.event),
      finalFollowup: null,
      finalFollowupPlacement: "none",
      streamFollowups: [],
      hasProcessSummary: summaryEvents.length > 0 || processEntries.length > 0,
    };
  }

  function isSettledProcessSignal(event) {
    if (!isProcessSignal(event)) return true;
    if (eventKind(event) === "tool_output" || eventKind(event) === "tool_summary") return true;
    return !lifecycle.isActivityPending(event);
  }

  function mergeAssistantEvents(events, fallback) {
    const assistantEvents = events.filter(assistantEventHasContent);
    if (assistantEvents.length <= 1) return fallback;
    const text = assistantEvents
      .map((event) => String(event?.text || utils.assistantTextFromData(event?.data)).trim())
      .filter(Boolean)
      .join("\n\n");
    const diffCard = assistantEvents.map((event) => event?.diffCard || event?.data?.diffCard).find(Boolean);
    return {
      ...fallback,
      text,
      html: "",
      diffCard: diffCard || fallback?.diffCard || fallback?.data?.diffCard,
      data: {
        ...(fallback?.data || {}),
        html: "",
        message: text,
        phase: fallback?.data?.phase || "final_answer",
      },
    };
  }

  function summaryLabel(baseEvent, split) {
    const explicit = split.summaryEvents.find(isProcessedSummaryLabel);
    if (explicit) return String(explicit.text).trim();

    const start = eventTime(baseEvent) || eventTime(split.processEvents[0]);
    const end = eventTime(split.finalFollowup) || eventTime(split.processEvents[split.processEvents.length - 1]);
    const duration = formatDuration(start, end);
    return duration ? `已处理 ${duration}` : "已处理";
  }

  function summaryDetailEvents(events) {
    return (Array.isArray(events) ? events : [])
      .filter((event) => !isProcessedSummaryLabel(event))
      .filter((event) => String(event?.text || utils.assistantTextFromData(event?.data)).trim());
  }

  function orderedProcessSummaryItems(entries, options = {}) {
    const includeAssistant = options.includeAssistant !== false;
    const items = [];
    for (const entry of Array.isArray(entries) ? entries : []) {
      const event = entry.event || entry;
      if (includeAssistant && assistantEventHasContent(event)) {
        items.push(summaryAssistantItem(event));
        continue;
      }
      if (isGuidanceEvent(event)) {
        items.push({ type: "guidance", event });
        continue;
      }
    }
    return items;
  }

  function summaryAssistantItem(event) {
    return { type: "assistant", event };
  }

  function isProcessedSummaryLabel(event) {
    if (!event) return false;
    if (event.inline) return true;
    const text = String(event.text || "").trim();
    if (/^(已处理|Processed)\b/i.test(text)) return true;
    const data = event.data && typeof event.data === "object" ? event.data : {};
    return data.type === "task_complete" || data.status === "completed" || Boolean(data.durationMs);
  }

  function detailLabel(item) {
    const event = item.event || item;
    const data = event?.data && typeof event.data === "object" ? event.data : {};
    if (eventKind(event) === "tool_output") return "tool_output";
    return String(event?.text || data.name || data.type || eventKind(event) || "activity");
  }

  function detailStatus(item) {
    const event = item.event || item;
    if (item.outputEvent) return eventStatus(item.outputEvent) || "completed";
    return String(event?.status || event?.data?.status || "").trim();
  }

  function detailIcon(item) {
    const event = item.event || item;
    if (eventKind(event) === "file_change") return "editFile";
    if (eventKind(event) === "tool_call") return "editFile";
    return "";
  }

  function detailKind(item) {
    if (item?.kind) return item.kind;
    return eventKind(item.event || item);
  }

  function detailArgs(item) {
    const data = item?.event?.data || {};
    return data.args && typeof data.args === "object" ? data.args : parseJSONMap(data.arguments);
  }

  function detailOutput(item) {
    const event = item?.outputEvent || (eventKind(item?.event) === "tool_output" ? item.event : null);
    return String(event?.data?.output || event?.text || "");
  }

  function buildStreamFollowups(entries) {
    const itemByEvent = new WeakMap();
    const callsByID = new Map();

    for (const entry of entries) {
      const event = entry.event;
      const kind = eventKind(event);
      if (kind === "tool_call") {
        const item = {
          event,
          kind,
          label: detailLabel(event),
          status: detailStatus(event),
          startTime: event?.time || "",
          endTime: event?.time || "",
          codexActivityItem: true,
        };
        itemByEvent.set(event, item);
        const callID = callIDFor(event);
        if (callID) callsByID.set(callID, item);
        continue;
      }
      if (kind === "tool_output") {
        const callID = callIDFor(event);
        const target = callID ? callsByID.get(callID) : null;
        if (target) {
          target.outputEvent = event;
          target.endTime = event?.time || target.endTime;
        }
      }
    }

    const rawItems = [];
    for (const entry of entries) {
      const event = entry.event;
      const kind = eventKind(event);
      if (kind === "tool_output" || kind === "stdout" || kind === "stderr") continue;
      if (kind === "tool_call") {
        const item = itemByEvent.get(event);
        if (item) rawItems.push(item);
        continue;
      }
      rawItems.push(event);
    }

    return rawItems;
  }

  function isExplicitFinalAssistant(event) {
    if (!isAssistantMessage(event)) return false;
    return event?.placement === "final" || event?.data?.placement === "final" || event?.data?.phase === "final_answer";
  }

  function assistantEventHasContent(event) {
    return isAssistantMessage(event) && Boolean(assistantEventContent(event));
  }

  function assistantEventContent(event) {
    return String(
      event?.text ||
      event?.html ||
      event?.data?.message ||
      event?.data?.html ||
      utils.assistantTextFromData(event?.data),
    ).trim();
  }

  function isAssistantMessage(event) {
    return eventKind(event, "assistant_message") === "assistant_message";
  }

  function isProcessSignal(event) {
    const kind = eventKind(event);
    if (lifecycle.isActivityEvent(event)) return true;
    if (kind === "tool_output") return true;
    if (kind === "tool_summary") return true;
    return false;
  }

  function isCollapsibleProcessSignal(event) {
    if (isActivityDetailEvent(event)) return false;
    return isProcessSignal(event) && !isStandaloneTerminalActivity(event);
  }

  function isActivityDetailEvent(event) {
    return eventKind(event) === "file_change";
  }

  function isGuidanceEvent(event) {
    return eventKind(event) === "user_message";
  }

  function isStandaloneTerminalActivity(event) {
    return eventKind(event) === "turn_cancelled";
  }

  function eventKind(event, fallback = "") {
    return lifecycle.eventKind ? lifecycle.eventKind(event, fallback) : String(event?.kind || fallback || "");
  }

  function eventStatus(event) {
    if (lifecycle.eventStatus) return lifecycle.eventStatus(event);
    return String(event?.status || event?.data?.status || "").toLowerCase();
  }

  function eventTime(event) {
    if (!event?.time) return 0;
    const time = new Date(event.time).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  function callIDFor(event) {
    return String(event?.data?.call_id || event?.data?.callId || event?.call_id || event?.callId || "");
  }

  function parseJSONMap(value) {
    if (!value || typeof value !== "string") return null;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  function formatDuration(start, end) {
    if (!start || !end || end < start) return "";
    const totalSeconds = Math.max(1, Math.floor((end - start) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes <= 0) return `${seconds}s`;
    if (minutes < 60) return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const restMinutes = minutes % 60;
    return restMinutes ? `${hours}h ${restMinutes}m` : `${hours}h`;
  }

  global.CodexPanelActivitySummary = {
    detailIcon,
    detailKind,
    detailLabel,
    detailArgs,
    detailOutput,
    detailStatus,
    splitTurnFollowups,
    summaryLabel,
  };
})(window);
