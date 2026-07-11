"use strict";

initCodexApp();

function initCodexApp() {
  window.CodexAppFrame.render();
  initSidebarResize();
}

function initSidebarResize() {
  const handleID = window.CodexAppFrame.IDS.sidebarResizeHandle;
  const handle = document.getElementById(handleID);

  const storageKey = "codex-web:sidebar-width";
  const saved = window.localStorage.getItem(storageKey);
  if (saved !== null) {
    setSidebarWidth(Number(saved));
  }

  let dragging = false;

  handle.addEventListener("pointerdown", (event) => {
    dragging = true;
    handle.classList.add("resizing");
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  handle.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const width = event.clientX - railWidth();
    setSidebarWidth(width);
    window.localStorage.setItem(storageKey, String(clampSidebarWidth(width)));
  });

  handle.addEventListener("pointerup", (event) => {
    dragging = false;
    handle.classList.remove("resizing");
    handle.releasePointerCapture(event.pointerId);
  });

  handle.addEventListener("dblclick", () => {
    window.localStorage.removeItem(storageKey);
    document.documentElement.style.removeProperty("--cw-sidebar-width");
  });
}

function setSidebarWidth(width) {
  document.documentElement.style.setProperty("--cw-sidebar-width", `${clampSidebarWidth(width)}px`);
}

function clampSidebarWidth(width) {
  const max = Math.max(300, Math.min(900, window.innerWidth - railWidth() - 420));
  return Math.round(Math.min(Math.max(width, 220), max));
}

function railWidth() {
  return 48;
}
