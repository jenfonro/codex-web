export async function fetchThreads() {
  return fetchJSON("/api/threads");
}

export async function fetchThreadState(threadId) {
  return fetchJSON(`/api/threads/${encodeURIComponent(threadId)}/state`);
}

export async function createThread(prompt) {
  return fetchJSON("/api/threads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
}

export async function sendToThread(threadId, prompt) {
  await fetchNoContent(`/api/threads/${encodeURIComponent(threadId)}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
}

export async function cancelThread(threadId) {
  await fetchNoContent(`/api/threads/${encodeURIComponent(threadId)}/cancel`, {
    method: "POST",
  });
}

export function subscribeThreadListEvents(onUpdate) {
  return subscribe("/api/threads/state-events", onUpdate);
}

export function subscribeThreadEvents(threadId, onUpdate) {
  const qs = new URLSearchParams({ threadId });
  return subscribe(`/api/threads/state-events?${qs.toString()}`, onUpdate);
}

async function fetchJSON(url, init) {
  const response = await request(url, init);
  return response.json();
}

async function fetchNoContent(url, init) {
  await request(url, init);
}

async function request(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = await response.json();
      message = body.error || message;
    } catch {
      // Keep the HTTP status text if the response is not JSON.
    }
    throw new Error(message);
  }
  return response;
}

function subscribe(url, onUpdate) {
  const source = new EventSource(url);
  source.onmessage = (event) => {
    onUpdate(JSON.parse(event.data));
  };
  source.onerror = () => {
    // EventSource retries automatically; the UI keeps the current snapshot.
  };
  return () => source.close();
}
