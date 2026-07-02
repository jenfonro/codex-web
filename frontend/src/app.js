"use strict";

applyWorkbenchPlatformClass();

const entries = [
  [".cache", "folder"],
  [".codex", "folder"],
  [".codex-code-server", "folder"],
  [".config", "folder"],
  [".local", "folder"],
  [".npm", "folder"],
  [".pip", "folder"],
  [".ssh", "folder"],
  ["code", "folder"],
  ["go", "folder"],
  [".bash_history", "file"],
  [".bashrc", "file"],
  [".bashrc.bak.20260627032540", "file"],
  [".gitconfig", "file"],
  [".lesshst", "file"],
  [".npmrc", "file"],
  [".profile", "file"],
  [".pydistutils.cfg", "file"],
  [".viminfo", "file"],
  [".wget-hsts", "file"],
  [".Xauthority", "file"],
  ["fix-codeserver-codex.sh", "file"],
  ["install-bashrc-extras.sh", "file"],
  ["Waifu2x-Extension-GUI-v2.21.12-Portable.7z", "file"],
];

const rows = document.getElementById("explorerRows");
if (rows) {
  rows.replaceChildren(...entries.map(([name, type], index) => explorerRow(name, type, index)));
}

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

function explorerRow(name, type, index) {
  const row = document.createElement("div");
  row.className = "monaco-list-row";
  row.setAttribute("role", "treeitem");
  row.setAttribute("data-index", String(index));
  row.setAttribute("data-parity", index % 2 === 0 ? "even" : "odd");
  row.setAttribute("aria-setsize", String(entries.length));
  row.setAttribute("aria-posinset", String(index + 1));
  row.setAttribute("aria-selected", "false");
  row.setAttribute("aria-label", name);
  row.setAttribute("aria-level", "1");
  row.style.top = `${index * 22}px`;
  row.style.height = "22px";
  row.style.lineHeight = "22px";

  const twistie = type === "folder"
    ? '<div class="monaco-tl-twistie codicon codicon-tree-item-expanded collapsible collapsed"></div>'
    : '<div class="monaco-tl-twistie codicon"></div>';
  const iconClass = type === "folder" ? folderIconClass(name) : fileIconClass(name);
  row.innerHTML = `
    <div class="monaco-tl-row">
      <div class="monaco-tl-indent"></div>
      ${twistie}
      <div class="monaco-tl-contents">
        <div class="monaco-icon-label ${iconClass} explorer-item" aria-label="~/${escapeAttr(name)}" custom-hover="true">
          <div class="monaco-icon-label-container">
            <span class="monaco-icon-name-container">
              <a class="label-name"><span class="monaco-highlighted-label">${escapeHTML(name)}</span></a>
            </span>
          </div>
        </div>
      </div>
    </div>`;
  return row;
}

function folderIconClass(name) {
  return `folder-icon root-name-dir-icon ${name.toLowerCase()}-name-folder-icon name-folder-icon`;
}

function fileIconClass(name) {
  const lower = name.toLowerCase();
  const parts = lower.split(".").filter(Boolean);
  const ext = parts.length ? parts[parts.length - 1] : "";
  const classes = ["file-icon", "root-name-dir-icon", `${lower}-name-file-icon`, "name-file-icon"];
  if (ext) classes.push(`${ext}-ext-file-icon`, "ext-file-icon");
  if (ext === "sh" || ext === "bashrc" || lower === ".profile") classes.push("shellscript-lang-file-icon");
  if (lower === ".gitconfig" || lower.endsWith("config")) classes.push("properties-lang-file-icon");
  if (ext === "7z") classes.push("unknown-lang-file-icon");
  return classes.join(" ");
}

function escapeHTML(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[char]);
}

function escapeAttr(value) {
  return escapeHTML(value);
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
  document.documentElement.style.setProperty("--cw-sidebar-width", `${clampSidebarWidth(width)}px`);
}

function clampSidebarWidth(width) {
  const max = Math.max(300, Math.min(900, window.innerWidth - 48 - 420));
  return Math.round(Math.min(Math.max(width, 220), max));
}
