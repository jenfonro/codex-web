"use strict";

applyWorkbenchPlatformClass();
initSidebarResize();

function applyWorkbenchPlatformClass() {
  const workbench = document.querySelector(".monaco-workbench");
  if (!workbench) return;
  const ua = navigator.userAgent || "";
  const platform = navigator.userAgentData?.platform || navigator.platform || "";
  const isWindows = /Windows/i.test(ua) || /^Win/i.test(platform);
  const isMac = /Macintosh|Mac OS X/i.test(ua) || /^Mac/i.test(platform);
  workbench.classList.remove("linux", "windows", "mac");
  workbench.classList.add(isWindows ? "windows" : isMac ? "mac" : "linux");
}

function initSidebarResize() {
  const handle = document.getElementById("sidebarResizeHandle");
  if (!handle) return;

  const storageKey = "codex-web:sidebar-width";
  const saved = Number(window.localStorage.getItem(storageKey));
  if (Number.isFinite(saved) && saved > 0) {
    setSidebarWidth(saved);
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
    const width = event.clientX - 48;
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
  document.documentElement.style.setProperty("--cw-sidebar-width", String(clampSidebarWidth(width)) + "px");
}

function clampSidebarWidth(width) {
  const max = Math.max(300, Math.min(900, window.innerWidth - 48 - 420));
  return Math.round(Math.min(Math.max(width, 220), max));
}
