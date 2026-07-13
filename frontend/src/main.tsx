import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  type AppendMessage,
} from "@assistant-ui/react";
import { Base } from "./base";
import "./styles.css";
import {
  applyStateUpdate,
  createEmptyThreadState,
  createNewThreadState,
  extractPrompt,
  messagesFromCodexState,
  threadTitle,
} from "./support/codex-transform.js";
import {
  cancelThread,
  createThread,
  fetchThreadState,
  fetchThreads,
  sendToThread,
  subscribeThreadEvents,
  subscribeThreadListEvents,
} from "./support/codex-api.js";

const NEW_THREAD_ID = "new";

function App() {
  const [threads, setThreads] = useState<any[]>([]);
  const [activeThreadId, setActiveThreadId] = useState("");
  const [threadState, setThreadState] = useState(createEmptyThreadState());
  const [listLoading, setListLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [error, setError] = useState("");
  const activeEventsRef = useRef<null | (() => void)>(null);
  const activeThreadIdRef = useRef("");

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? null,
    [activeThreadId, threads],
  );
  const isRunning = activeThread?.status?.type === "active";

  const refreshThreads = useCallback(async () => {
    setListLoading(true);
    try {
      setThreads(await fetchThreads());
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshThreads();
    const close = subscribeThreadListEvents((update: any) => {
      setThreads((current) => updateThreadList(current, update));
    });
    return close;
  }, [refreshThreads]);

  useEffect(() => {
    return () => activeEventsRef.current?.();
  }, []);

  const openThread = useCallback(async (threadId: string) => {
    if (!threadId || threadId === NEW_THREAD_ID) return;
    activeEventsRef.current?.();
    activeEventsRef.current = null;
    activeThreadIdRef.current = threadId;
    setActiveThreadId(threadId);
    setThreadLoading(true);
    setThreadState(createEmptyThreadState());
    setError("");
    try {
      const snapshot = await fetchThreadState(threadId);
      setThreadState({
        turns: snapshot.history?.turns ?? [],
        turnErrors: [],
      });
      setThreads((current) => replaceThread(current, snapshot.thread));
      activeEventsRef.current = subscribeThreadEvents(threadId, (update: any) => {
        setThreadState((current) => applyStateUpdate(current, update));
        if (update.type === "threadUpdated") {
          setThreads((current) => replaceThread(current, update.data));
          if (update.data?.status?.type !== "active") {
            window.setTimeout(() => {
              if (activeThreadIdRef.current === threadId) {
                void reloadThreadState(threadId, setThreadState, setError);
              }
            }, 700);
          }
        }
      });
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setThreadLoading(false);
    }
  }, []);

  const startNewThread = useCallback(() => {
    activeEventsRef.current?.();
    activeEventsRef.current = null;
    activeThreadIdRef.current = "";
    setActiveThreadId("");
    setThreadState(createNewThreadState());
    setThreadLoading(false);
    setError("");
  }, []);

  const submitPrompt = useCallback(
    async (appendMessage: AppendMessage) => {
      const prompt = extractPrompt(appendMessage);
      if (!prompt) return;
      setError("");
      try {
        if (activeThreadId) {
          await sendToThread(activeThreadId, prompt);
          await openThread(activeThreadId);
          return;
        }

        const result = await createThread(prompt);
        await openThread(result.threadId);
      } catch (nextError) {
        setError(errorMessage(nextError));
      }
    },
    [activeThreadId, openThread],
  );

  const cancelActiveRun = useCallback(async () => {
    if (!activeThreadId) return;
    try {
      await cancelThread(activeThreadId);
    } catch (nextError) {
      setError(errorMessage(nextError));
    }
  }, [activeThreadId]);

  const runtime = useExternalStoreRuntime({
    messages: messagesFromCodexState(threadState, Boolean(isRunning)),
    isRunning: Boolean(isRunning),
    isSendDisabled: threadLoading || Boolean(isRunning),
    isLoading: threadLoading,
    onNew: submitPrompt,
    onCancel: cancelActiveRun,
    unstable_capabilities: {
      copy: true,
    },
    adapters: {
      threadList: {
        threadId: activeThreadId || NEW_THREAD_ID,
        isLoading: listLoading,
        threads: threads.map(toThreadListItem),
        archivedThreads: [],
        onSwitchToThread: openThread,
        onSwitchToNewThread: startNewThread,
        onArchive: async () => {},
        onDelete: async () => {},
      },
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="h-dvh w-dvw overflow-hidden">
        <Base />
        {error ? <div className="codex-error-banner">{error}</div> : null}
      </div>
    </AssistantRuntimeProvider>
  );
}

async function reloadThreadState(threadId: string, setThreadState: any, setError: any) {
  try {
    const snapshot = await fetchThreadState(threadId);
    setThreadState({
      turns: snapshot.history?.turns ?? [],
      turnErrors: [],
    });
  } catch (nextError) {
    setError(errorMessage(nextError));
  }
}

function updateThreadList(threads: any[], update: any) {
  if (update.type === "threadStarted") {
    if (threads.some((thread) => thread.id === update.data.id)) return threads;
    return [update.data, ...threads];
  }
  if (update.type === "threadUpdated") return replaceThread(threads, update.data);
  return threads;
}

function replaceThread(threads: any[], thread: any) {
  const index = threads.findIndex((item) => item.id === thread.id);
  if (index < 0) return [thread, ...threads];
  const next = threads.slice();
  next[index] = thread;
  return next;
}

function toThreadListItem(thread: any) {
  return {
    id: thread.id,
    status: "regular" as const,
    title: threadTitle(thread),
    lastMessageAt: timestampToDate(thread.updatedAt),
    custom: {
      codexStatus: thread.status,
    },
  };
}

function timestampToDate(value: any) {
  if (!value) return undefined;
  return new Date(value < 1_000_000_000_000 ? value * 1000 : value);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

createRoot(document.getElementById("root")!).render(<App />);
