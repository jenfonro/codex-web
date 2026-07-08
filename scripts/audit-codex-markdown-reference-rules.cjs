#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.resolve(__dirname, "..");
const context = {
  console,
  window: {
    CodexIcons: {
      svg: () => '<svg aria-hidden="true"></svg>',
    },
  },
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(repoRoot, "frontend/src/pages/codex/utils.js"), "utf8"),
  context,
  { filename: "frontend/src/pages/codex/utils.js" },
);

const { formatText } = context.window.CodexPanelUtils;

{
  const html = formatText("Updated [docs/checklist.md](/root/code/codex-web/docs/checklist.md:61).");
  assert.match(html, /docs\/checklist\.md \(line 61\)/, "colon line suffix should be visible like the extension file mention label");
  assert.match(html, /data-file-reference="\/root\/code\/codex-web\/docs\/checklist\.md:61"/);
}

{
  const html = formatText("Updated [renderer.js](C:/work/codex-web/frontend/src/pages/codex/renderer.js#L41).");
  assert.match(html, /frontend\/src\/pages\/codex\/renderer\.js \(line 41\)/, "hash line suffix should be visible like the extension file mention label");
  assert.match(html, /data-file-reference="C:\/work\/codex-web\/frontend\/src\/pages\/codex\/renderer\.js#L41"/);
}

{
  const html = formatText("Updated [chatgpt-extension-ui-parity-checklist.md](/root/code/codex-web/docs/chatgpt-extension-ui-parity-checklist.md:41).");
  assert.match(html, /docs\/chatgpt-extension-ui-parity-checklist\.md \(line 41\)/, "file links with filename labels should display the workspace-relative path like code-server");
  assert.match(html, /data-file-reference="\/root\/code\/codex-web\/docs\/chatgpt-extension-ui-parity-checklist\.md:41"/);
}

{
  const html = formatText("Updated [utils.js](/root/code/codex-web/frontend/src/pages/codex/utils.js).");
  assert.match(html, />utils\.js</, "plain file references should keep their original label");
  assert.doesNotMatch(html, /\(line /, "plain file references must not invent a line suffix");
}

{
  const html = formatText("截图：/root/codex-web-browser/captures/20260703-002100-codex-sessions/screenshot.png\n目录：/root/codex-web-browser/captures/20260703-002100-codex-sessions/frames/");
  assert.match(html, /data-file-reference="\/root\/codex-web-browser\/captures\/20260703-002100-codex-sessions\/screenshot\.png"/);
  assert.match(html, />\/root\/codex-web-browser\/captures\/20260703-002100-codex-sessions\/screenshot\.png</);
  assert.doesNotMatch(html, /data-file-reference="\/root\/codex-web-browser\/captures\/20260703-002100-codex-sessions\/frames\//, "directory paths should not be promoted to file references");
}

{
  const html = formatText("截图：`/root/codex-web-browser/captures/20260703-002100-codex-sessions/screenshot.png`\n页面：`/root/codex-web-browser/captures/20260703-002100-codex-sessions/page.mhtml`");
  assert.match(html, /data-file-reference="\/root\/codex-web-browser\/captures\/20260703-002100-codex-sessions\/screenshot\.png"/, "backticked file paths should render as extension-style file mentions");
  assert.match(html, /data-file-reference="\/root\/codex-web-browser\/captures\/20260703-002100-codex-sessions\/page\.mhtml"/);
  assert.doesNotMatch(html, /data-markdown-copy="inline-code"[^>]*>\/root\/codex-web-browser\/captures\/20260703-002100-codex-sessions\/screenshot\.png/, "backticked file paths should not stay as plain inline code");
}

{
  const html = formatText("目录：`/root/codex-web-browser/captures/20260703-002100-codex-sessions/frames/`\n命令：`./build-all.sh`");
  assert.doesNotMatch(html, /data-file-reference="\/root\/codex-web-browser\/captures\/20260703-002100-codex-sessions\/frames\//, "backticked directory paths should not be promoted to file references");
  assert.doesNotMatch(html, /data-file-reference="\.\/build-all\.sh"/, "backticked commands should remain inline code");
  assert.match(html, /data-markdown-copy="inline-code"[^>]*>\.\/build-all\.sh<\/span>/);
}

{
  const html = formatText("Screenshots: `build/topbar-ref-now-stable-1400x220.png` and `build/topbar-cur-shadow-final7-1400x220.png`.");
  assert.match(html, /data-file-reference="build\/topbar-ref-now-stable-1400x220\.png"/, "backticked nested relative file paths should render as extension-style file mentions");
  assert.match(html, /data-file-reference="build\/topbar-cur-shadow-final7-1400x220\.png"/);
  assert.doesNotMatch(html, /data-markdown-copy="inline-code"[^>]*>build\/topbar-ref-now-stable-1400x220\.png/, "nested relative file paths should not stay as plain inline code");
}

console.log("codex markdown reference rules: ok");
