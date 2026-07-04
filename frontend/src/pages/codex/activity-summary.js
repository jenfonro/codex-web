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

    const finalEntry = findFinalEntry(contentEntries);
    if (!finalEntry) {
      return {
        summaryEvents,
        processEvents: [],
        detailEvents: [],
        finalFollowup: null,
        streamFollowups: contentEntries.map((entry) => entry.event),
        hasProcessSummary: summaryEvents.length > 0,
      };
    }

    const beforeFinal = contentEntries.filter((entry) => entry.index < finalEntry.index);
    const afterFinal = contentEntries.filter((entry) => entry.index > finalEntry.index);
    const hasProcessSignals = beforeFinal.some((entry) => isProcessSignal(entry.event));
    const processEvents = beforeFinal
      .filter((entry) => isProcessSignal(entry.event) || (hasProcessSignals && isAssistantMessage(entry.event)))
      .map((entry) => entry.event);
    const streamFollowups = [
      ...beforeFinal
        .filter((entry) => !(isProcessSignal(entry.event) || (hasProcessSignals && isAssistantMessage(entry.event))))
        .map((entry) => entry.event),
      ...afterFinal.map((entry) => entry.event),
    ];

    return {
      summaryEvents,
      processEvents,
      detailEvents: compactDetailEvents(processEvents.filter(isInspectableProcessEvent)),
      finalFollowup: finalEntry.event,
      streamFollowups,
      hasProcessSummary: summaryEvents.length > 0 || processEvents.length > 0,
    };
  }

  function findFinalEntry(entries) {
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      if (isExplicitFinalAssistant(entries[index].event)) return entries[index];
    }

    const assistantEntries = entries.filter((entry) => assistantEventHasContent(entry.event));
    if (assistantEntries.length === 1 && entries.length === 1) return assistantEntries[0];
    if (entries.some((entry) => isProcessSignal(entry.event)) && assistantEntries.length) {
      return assistantEntries[assistantEntries.length - 1];
    }
    return null;
  }

  function summaryLabel(baseEvent, split) {
    const explicit = split.summaryEvents.find((event) => String(event?.text || "").trim());
    if (explicit) return String(explicit.text).trim();

    const start = eventTime(baseEvent) || eventTime(split.processEvents[0]);
    const end = eventTime(split.finalFollowup) || eventTime(split.processEvents[split.processEvents.length - 1]);
    const duration = formatDuration(start, end);
    return duration ? `已处理 ${duration}` : "已处理";
  }

  function detailLabel(item) {
    const event = item.event || item;
    const data = event?.data && typeof event.data === "object" ? event.data : {};
    return String(event?.text || data.name || data.type || eventKind(event) || "activity");
  }

  function detailStatus(item) {
    const event = item.event || item;
    return String(event?.status || event?.data?.status || "").trim();
  }

  function detailIcon(item) {
    const event = item.event || item;
    if (eventKind(event) === "tool_call") return "editFile";
    return "";
  }

  function detailKind(item) {
    return eventKind(item.event || item);
  }

  function compactDetailEvents(events) {
    const items = [];
    for (const event of events) {
      const label = detailLabel(event);
      const status = detailStatus(event);
      const kind = eventKind(event);
      const previous = items[items.length - 1];
      if (previous && previous.kind === kind && previous.label === label && previous.status === status) {
        previous.count += 1;
        previous.endTime = event?.time || previous.endTime;
        continue;
      }
      items.push({
        event,
        kind,
        label,
        status,
        count: 1,
        startTime: event?.time || "",
        endTime: event?.time || "",
      });
    }
    return items;
  }

  function isExplicitFinalAssistant(event) {
    if (!isAssistantMessage(event)) return false;
    return event?.placement === "final" || event?.data?.placement === "final" || event?.data?.phase === "final_answer";
  }

  function assistantEventHasContent(event) {
    return isAssistantMessage(event) && Boolean(String(event?.text || utils.assistantTextFromData(event?.data)).trim());
  }

  function isAssistantMessage(event) {
    return eventKind(event, "assistant_message") === "assistant_message";
  }

  function isProcessSignal(event) {
    const kind = eventKind(event);
    if (lifecycle.isActivityEvent(event)) return true;
    if (kind === "tool_summary") return true;
    if (isAssistantMessage(event) && event?.data?.phase === "commentary") return true;
    return false;
  }

  function isInspectableProcessEvent(event) {
    const kind = eventKind(event);
    return (
      kind === "tool_call" ||
      kind === "stdout" ||
      kind === "stderr" ||
      kind === "tool_summary" ||
      assistantEventHasContent(event)
    );
  }

  function eventKind(event, fallback = "") {
    return lifecycle.eventKind ? lifecycle.eventKind(event, fallback) : String(event?.kind || fallback || "");
  }

  function eventTime(event) {
    if (!event?.time) return 0;
    const time = new Date(event.time).getTime();
    return Number.isFinite(time) ? time : 0;
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
    detailStatus,
    splitTurnFollowups,
    summaryLabel,
  };
})(window);
