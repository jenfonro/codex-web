import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { AssistantRuntimeProvider, useExternalStoreRuntime } from "@assistant-ui/react";
import { Thread, makeMarkdownText } from "@assistant-ui/react-ui";
import "@assistant-ui/react-ui/styles/index.css";
import "@assistant-ui/react-ui/styles/markdown.css";
import "@assistant-ui/react-ui/styles/themes/default.css";
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

const MarkdownText = makeMarkdownText();

function App() {
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState("");
  const [threadState, setThreadState] = useState(createEmptyThreadState());
  const [listLoading, setListLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [error, setError] = useState("");
  const activeEventsRef = useRef(null);
  const activeThreadIdRef = useRef("");

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? null,
    [activeThreadId, threads],
  );
  const isRunning = activeThread?.status?.type === "active";

  const refreshThreads = useCallback(async () => {
    setListLoading(true);
    try {
      const nextThreads = await fetchThreads();
      setThreads(nextThreads);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshThreads();
    const close = subscribeThreadListEvents((update) => {
      setThreads((current) => updateThreadList(current, update));
    });
    return close;
  }, [refreshThreads]);

  useEffect(() => {
    return () => activeEventsRef.current?.();
  }, []);

  const openThread = useCallback(async (threadId) => {
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
      activeEventsRef.current = subscribeThreadEvents(threadId, (update) => {
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
    async (appendMessage) => {
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

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div>
            <div className="sidebar-kicker">Codex Web</div>
            <h1>对话</h1>
          </div>
          <button className="icon-button" type="button" onClick={startNewThread} aria-label="新建对话">
            +
          </button>
        </div>
        <div className="thread-list" aria-label="会话列表">
          {listLoading ? <div className="empty-list">正在加载...</div> : null}
          {!listLoading && threads.length === 0 ? <div className="empty-list">暂无会话</div> : null}
          {threads.map((thread) => (
            <button
              className={`thread-row ${thread.id === activeThreadId ? "is-active" : ""}`}
              key={thread.id}
              type="button"
              onClick={() => void openThread(thread.id)}
            >
              <span className="thread-row-title">{threadTitle(thread)}</span>
              <span className="thread-row-meta">
                {thread.status?.type === "active" ? "运行中" : relativeTime(thread.updatedAt)}
              </span>
            </button>
          ))}
        </div>
      </aside>
      <main className="chat-area">
        <div className="chat-header">
          <div>
            <div className="chat-kicker">{activeThreadId ? "当前任务" : "新任务"}</div>
            <h2>{activeThread ? threadTitle(activeThread) : "开始一个 Codex 会话"}</h2>
          </div>
          {activeThreadId ? (
            <button className="secondary-button" type="button" onClick={startNewThread}>
              新建
            </button>
          ) : null}
        </div>
        {error ? <div className="error-banner">{error}</div> : null}
        {threadLoading ? <div className="loading-overlay">正在加载会话...</div> : null}
        <CodexThread
          key={activeThreadId || "new-thread"}
          isRunning={Boolean(isRunning)}
          isSendDisabled={threadLoading || Boolean(isRunning)}
          isLoading={threadLoading}
          messages={messagesFromCodexState(threadState, Boolean(isRunning))}
          onCancel={cancelActiveRun}
          onSubmit={submitPrompt}
        />
      </main>
    </div>
  );
}

async function reloadThreadState(threadId, setThreadState, setError) {
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

function CodexThread({ isRunning, isSendDisabled, isLoading, messages, onCancel, onSubmit }) {
  const runtime = useExternalStoreRuntime({
    messages,
    isRunning,
    isSendDisabled,
    isLoading,
    onNew: onSubmit,
    onCancel,
    unstable_capabilities: {
      copy: true,
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread
        assistantAvatar={{ fallback: "C" }}
        welcome={{
          message: "描述你想让 Codex 完成的工作。",
          suggestions: [
            { prompt: "总结这个项目目前的结构", text: "总结项目结构" },
            { prompt: "检查当前工作区状态", text: "检查工作区" },
          ],
        }}
        assistantMessage={{
          allowReload: false,
          allowSpeak: false,
          allowFeedbackPositive: false,
          allowFeedbackNegative: false,
          components: {
            Text: MarkdownText,
          },
        }}
        userMessage={{
          allowEdit: false,
        }}
        composer={{
          allowAttachments: false,
        }}
        strings={{
          composer: {
            input: { placeholder: "给 Codex 发送消息..." },
            send: { tooltip: "发送" },
            cancel: { tooltip: "停止" },
          },
          thread: {
            scrollToBottom: { tooltip: "回到底部" },
          },
        }}
      />
    </AssistantRuntimeProvider>
  );
}

function updateThreadList(threads, update) {
  if (update.type === "threadStarted") {
    if (threads.some((thread) => thread.id === update.data.id)) return threads;
    return [update.data, ...threads];
  }
  if (update.type === "threadUpdated") return replaceThread(threads, update.data);
  return threads;
}

function replaceThread(threads, thread) {
  const index = threads.findIndex((item) => item.id === thread.id);
  if (index < 0) return [thread, ...threads];
  const next = threads.slice();
  next[index] = thread;
  return next;
}

function relativeTime(value) {
  if (!value) return "";
  const date = timestampToDate(value);
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "刚刚";
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} 分钟前`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)} 小时前`;
  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

function timestampToDate(value) {
  return new Date(value < 1_000_000_000_000 ? value * 1000 : value);
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

createRoot(document.getElementById("root")).render(<App />);
