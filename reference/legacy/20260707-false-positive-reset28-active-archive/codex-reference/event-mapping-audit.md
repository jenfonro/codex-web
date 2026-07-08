# Codex Event Mapping Audit

Generated: 2026-07-07T02:17:25.624Z

## Summary

- Checks: 33
- Failed: 0

## Checks

| Check | Status | Details |
| --- | --- | --- |
| agent maps user_message | ok | case "user_message": ... newParsedEvent\("user_message" |
| agent maps agent_message to assistant_message | ok | case "agent_message": ... newParsedEvent\("assistant_message" |
| agent maps task_started to transient turn_started | ok | case "task_started": ... includeTransient ... newParsedEvent\("turn_started" ... "running" |
| agent maps task_complete to transient turn_completed | ok | case "task_complete": ... includeTransient ... newParsedEvent\("turn_completed" ... "completed" |
| agent maps reasoning summary to summary event | ok | case "reasoning": ... summaryText\(payload\["summary"\]\) ... newParsedEvent\("summary" |
| agent maps live function/tool_call as running tool_call | ok | case "function_call"(?:,\s*"tool_call")?: ... if includeTransient ... data\["status"\] = "running" ... else ... data\["status"\] = "completed" ... newParsedEvent\("tool_call" |
| agent maps function/tool_call_output to completed tool_output | ok | case "function_call_output"(?:,\s*"tool_call_output")?: ... data\["status"\] = "completed" ... newParsedEvent\("tool_output" |
| agent preserves call/output/status/exit metadata | ok | "call_id" ... "arguments" ... "output" ... "status" ... "exit_code" |
| agent parses JSON arguments into args | ok | json\.Unmarshal\(\[\]byte\(arguments\), &args\) ... data\["args"\] = args |
| manager emits user prompts | ok | appendEvent\(.*"user_message" |
| manager emits turn_cancelled status | ok | appendEvent\(.*"turn_cancelled" ... "status": "cancelled" |
| manager streams stdout for the active turn | ok | appendEventForTurn\(sessionID,\s*turnID,\s*"stdout" |
| manager streams stderr for the active turn | ok | appendEventForTurn\(sessionID,\s*turnID,\s*"stderr" |
| manager emits turn_started from CLI events for the active turn | ok | case "turn\.started": ... appendEventForTurn\(sessionID,\s*turnID,\s*"turn_started" |
| manager emits turn_completed from CLI events atomically | ok | case "turn\.completed": ... setStatusAndAppendEventsForTurn\(sessionID,\s*turnID,\s*statusIdle, ... Kind:\s*"turn_completed" |
| frontend activity kinds include running/control surface | ok | activityKinds = \["turn_started", "reasoning", "tool_call", "stdout", "stderr", "turn_cancelled"\] |
| frontend terminal statuses include success failure cancel states | ok | terminalStatuses = \[[^\]]*"completed" ... "failed" ... "error" ... "cancelled" ... "stopped" |
| frontend settling hides stale pending activity | ok | isTurnSettlingEvent ... turn_completed ... turn_cancelled ... shouldHideSettledPendingActivity |
| frontend keeps resolved tool_call visible after output | ok | resolvedToolCallIDs ... eventKind\(event\) !== "tool_output" ... resolvedCalls\.has\(callID\) |
| frontend starts new visual turn on user_message | ok | eventKind\(event, "assistant_message"\) === "user_message" ... flushTurnEvents\(\) ... visible\.push\(event\) |
| processed summary label is separated from reasoning detail text | ok | const explicit = split\.summaryEvents\.find\(isProcessedSummaryLabel\) ... summaryDetailEvents ... !isProcessedSummaryLabel\(event\) |
| process summary can be generated from process events | ok | const hasProcessSummary = summaryEvents\.length > 0 \\|\\| processEvents\.length > 0 |
| assistant commentary merges into final answer after process summary | ok | mergeAssistantEvents ... join\("\\n\\n"\) ... phase: fallback\?\.data\?\.phase \\|\\| "final_answer" |
| completed turn stream only keeps non-collapsible events after final answer | ok | const afterFinal = contentEntries ... entry\.index > finalEntry\.index && !isCollapsibleProcessSignal\(entry\.event\) ... const streamFollowups = buildStreamFollowups\(afterFinal\) |
| cancelled terminal activity stays out of process summaries | ok | isCollapsibleProcessSignal ... !isStandaloneTerminalActivity\(event\) ... eventKind\(event\) === "turn_cancelled" |
| tool outputs bind to tool calls by call id | ok | callsByID\.set\(callID, item\) ... const target = callID \? callsByID\.get\(callID\) |
| orphan stdout stderr output hidden from stream rows | ok | kind === "tool_output" \\|\\| kind === "stdout" \\|\\| kind === "stderr" |
| exec_command grouping is disabled for official alignment | ok | return name === "exec_command"\|kind: "tool_group"\|groupedToolStatus |
| renderer uses official-style tool disclosure | ok | renderToolActivityDisclosure ... group\/activity-header ... renderDisclosureBody |
| renderer renders running shell tool calls | ok | isActivityPending\(event\) ... event\.kind ... tool_call ... hasShellArgs\(event\) |
| renderer exposes exit code footer | ok | exit_code + Exit code |
| dynamic audit covers running completed failed cancelled composer states | ok | running shell command block present ... completed transition command is hidden for official alignment ... failed shell command remains visible ... cancelled turn status row present ... composer typed text is visible text |
| final screenshot capture covers required visual states | ok | completed-summary + file-reference + running-thinking |
