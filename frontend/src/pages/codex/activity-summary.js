"use strict";

(function defineCodexPanelActivitySummary(global) {
  const lifecycle = global.CodexPanelLifecycle;

  function splitTurnFollowups(followups) {
    const finalIndex = findFinalIndex(followups);
    if (finalIndex < 0) {
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
      if (isAssistant(ref) && ref.item.phase === "final_answer" && !lifecycle.isStreamingAssistant(ref)) {
        return index;
      }
    }
    return -1;
  }

  function isProcessSignal(ref) {
    if (lifecycle.isActivityItem(ref)) return true;
    if (ref.item.type === "fileChange" || ref.item.type === "plan" || ref.item.type === "contextCompaction") return true;
    return isAssistant(ref) && ref.item.phase === "commentary";
  }

  function isAssistant(ref) {
    return ref.item.type === "agentMessage";
  }

  function summaryLabel(turn) {
    if (turn.durationMs === null) return "已处理";
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

  global.CodexPanelActivitySummary = {
    splitTurnFollowups,
    summaryLabel,
  };
})(window);
