"use strict";

(function defineCodexPanelFixtures(global) {
  const { escapeHTML } = global.CodexPanelUtils;

function summaryFollowupHTML() {
  return `
    <p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">对，你这个判断是对的。现在继续在 Linux VNC 里靠字体 fallback 和截图猜测，确实不适合做“完全一致”的视觉复刻。</p>
    <p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">更稳的做法是：</p>
    <ol class="_markdownText_lzkx4_86 _list_lzkx4_133 _orderedList_lzkx4_159" start="1">
      <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">在你的 Windows 浏览器里打开真实 code-server + ChatGPT/Codex 扩展界面。</li>
      <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">用 Playwright 或 DevTools 抓目标区域的：
        <ul class="_markdownText_lzkx4_86 _list_lzkx4_133 _unorderedList_lzkx4_147">
          <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">DOM 结构</li>
          <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">className</li>
          <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">CSS 文件</li>
          <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">computed styles</li>
          <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">字体实际解析结果</li>
          <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">元素尺寸、间距、颜色、border-radius、box-shadow</li>
        </ul>
      </li>
      <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">把抓取结果保存成文件给我，或让我直接在 Windows 环境里操作。</li>
      <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">我只按抓取结果实现，不再凭 Linux VNC 的偏差截图调样式。</li>
    </ol>
    <p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">我刚才在 Linux 里加的 <span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">Segoe UI</span> alias 只能让截图环境更接近一点，但它不是根本方案。真正要完全对齐，你这边的 Windows Chrome 环境才是准基线。</p>`;
}

function resetFollowupHTML() {
  return `
    <p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">是的，当前这套前端试验实现不值得继续在上面修。</p>
    <p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">但现在不需要 <span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">reset + push</span>。</p>
    <ul class="_markdownText_lzkx4_86 _list_lzkx4_133 _unorderedList_lzkx4_147">
      <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168"><span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">main</span> 和 <span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">origin/main</span>、<span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">HEAD</span> 已经一致</li>
      <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">现在显示偏差大的内容只是本地未提交改动</li>
      <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">所以 <span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">push</span> 没意义</li>
    </ul>
    <p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">建议处理方式：</p>
    <ol class="_markdownText_lzkx4_86 _list_lzkx4_133 _orderedList_lzkx4_159">
      <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168"><p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">先丢弃当前前端试验改动：</p>
        <ul class="_markdownText_lzkx4_86 _list_lzkx4_133 _unorderedList_lzkx4_147">
          <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168"><span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">frontend/src/app/bootstrap.js</span></li>
          <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168"><span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">frontend/src/index.html</span></li>
          <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168"><span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">frontend/src/app/layout.css</span></li>
          <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">新增的 OpenAI 字体/图标资源</li>
        </ul>
      </li>
      <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168"><p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">后端认证删除改动要单独确认：</p>
        <ul class="_markdownText_lzkx4_86 _list_lzkx4_133 _unorderedList_lzkx4_147">
          <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">你之前明确说现在完全不需要认证</li>
          <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">所以不应该直接 <span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">git reset</span></li>
        </ul>
      </li>
      <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168"><p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">清理后重新 build/restart。</p></li>
    </ol>
    <p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">我建议不要 <span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">git reset --hard</span> 整仓库。</p>`;
}

function cleanedFollowupHTML() {
  return `
    <p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">已处理。</p>
    <p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">我只清理了前端试验改动，保留了后端无认证改动。</p>
    <ul class="_markdownText_lzkx4_86 _list_lzkx4_133 _unorderedList_lzkx4_147">
      <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">${inlineMention("config.go")}</li>
      <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">${inlineMention("app.go")}</li>
      <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">${inlineMention("types.go")}</li>
    </ul>
    <p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">验证已完成：<span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">node --check</span>、<span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">go test ./...</span>、<span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">./build-all.sh</span>、<span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">GET /api/nodes</span>。</p>
    <p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">服务状态：active。</p>
    <ul class="_markdownText_lzkx4_86 _list_lzkx4_133 _unorderedList_lzkx4_147">
      <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168"><span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">node --check frontend/src/app/bootstrap.js</span></li>
      <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168"><span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">go test ./...</span> in <span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">backend</span></li>
      <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168"><span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">go test ./...</span> in <span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">agent</span></li>
      <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168"><span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">./build-all.sh</span></li>
      <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168"><span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">systemctl restart</span></li>
      <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168"><span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">GET /</span></li>
      <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168"><span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">GET /api/nodes</span></li>
      <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168"><span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">host-docker-agent</span>、<span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">active</span></li>
    </ul>`;
}

function pushedFollowupHTML() {
  return `
    <p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82"><span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">20e38bd</span></p>
    <p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">已提交并推送到 origin/main。</p>
    <p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">最新提交：<span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">feat: remove controller web auth</span></p>
    <p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">确认结果：</p>
    <ul class="_markdownText_lzkx4_86 _list_lzkx4_133 _unorderedList_lzkx4_147">
      <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168"><span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">main</span> 和 <span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">origin/main</span> 一致</li>
      <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">工作区干净</li>
      <li class="_markdownText_lzkx4_86 _listItem_lzkx4_168">远端 <span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">refs/heads/main</span> 指向 <span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">20e38bd</span></li>
    </ul>
    <p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">现在重新 <span data-markdown-copy="inline-code" class="inline-markdown _inlineMarkdown_lzkx4_385">git clone</span> 会直接获取这个版本。</p>`;
}

function inlineMention(label) {
  const icons = inlineMention.icons;
  return `<span class="group/inline-mention cursor-pointer" role="button" data-state="closed"><span class="break-words whitespace-normal" data-state="closed"><span class="px-0.5 inline-mention-brand-aware font-medium text-[color:var(--inline-mention-color)] [--inline-mention-color:var(--inline-mention-resolved-base-color,var(--inline-mention-base-color))] [--inline-mention-base-color:color-mix(in_srgb,var(--color-token-text-link-foreground)_80%,var(--color-token-foreground)_20%)] group-hover/inline-mention:underline group-hover/inline-mention:decoration-current group-hover/inline-mention:decoration-dashed group-hover/inline-mention:decoration-[0.5px] group-hover/inline-mention:underline-offset-2 _tableCellFileLink_lzkx4_413"><span class="relative mr-[3px] inline-block h-[1lh] w-4 align-bottom">${icons.svg("editFile", "icon-xs")}</span><span class="min-w-0 break-words">${escapeHTML(label)}</span></span></span></span>`;
}

function createVirtualScrollEvents(now) {
  const events = [];
  let seq = 1;
  const base = now - 2 * 3600 * 1000;
  const iso = (offsetSeconds) => new Date(base + offsetSeconds * 1000).toISOString();
  for (let index = 1; index <= 90; index += 1) {
    const turnKey = `virtual-scroll-turn-${String(index).padStart(3, "0")}`;
    events.push({
      kind: "user_message",
      text: `Virtual scroll turn ${index}: verify long-session rendering, disclosure rows, summaries, and scroll anchoring.`,
      turnKey,
      time: iso(index * 20),
      seq: seq++,
    });
    if (index % 7 === 0) {
      for (let callIndex = 1; callIndex <= 3; callIndex += 1) {
        const callID = `virtual-call-${index}-${callIndex}`;
        const command = callIndex === 1
          ? "git status --short"
          : callIndex === 2
            ? "node --check frontend/src/pages/codex/renderer.js"
            : "go test ./...";
        events.push({
          kind: "tool_call",
          text: "exec_command",
          data: {
            name: "exec_command",
            call_id: callID,
            arguments: JSON.stringify({ cmd: command, workdir: "C:/workspace/codex-web" }),
            args: { cmd: command, workdir: "C:/workspace/codex-web" },
            status: "completed",
          },
          turnKey,
          time: iso(index * 20 + callIndex),
          seq: seq++,
        });
        events.push({
          kind: "tool_output",
          text: callIndex === 1 ? " M frontend/src/pages/codex/renderer.js" : "Process exited with code 0",
          data: {
            call_id: callID,
            output: callIndex === 1 ? " M frontend/src/pages/codex/renderer.js" : "Process exited with code 0",
            status: "completed",
          },
          turnKey,
          time: iso(index * 20 + callIndex + 3),
          seq: seq++,
        });
      }
    }
    if (index % 5 === 0) {
      events.push({
        kind: "summary",
        inline: true,
        text: `Processed ${30 + index}s`,
        turnKey,
        time: iso(index * 20 + 8),
        seq: seq++,
      });
    }
    const fileHTML = index % 9 === 0
      ? `<p class="_markdownText_lzkx4_86 _paragraph_lzkx4_82">Updated ${inlineMention(`frontend/src/pages/codex/virtual-${index}.js`)} while keeping the disclosure body collapsed by default.</p>`
      : "";
    events.push({
      kind: "assistant_message",
      placement: "final",
      text: fileHTML ? "" : `Completed virtual scroll turn ${index}. This text is intentionally long enough to wrap in the Codex panel and exercise estimated row heights without using fake outer offsets.`,
      html: fileHTML || "",
      turnKey,
      time: iso(index * 20 + 12),
      seq: seq++,
    });
  }
  return events;
}

function createSampleData(options = {}) {
  const { icons, useDynamicFixture = false, useVirtualFixture = false, referenceAttachmentSrc = global.CodexPanelConfig.USER_ATTACHMENT_PLACEHOLDER } = options;
  inlineMention.icons = icons || global.CodexIcons;
  const now = Date.now();
  const sessions = [
    {
      id: "backup-unarchived",
      title: "备份未归档会话",
      status: "idle",
      updatedAt: new Date(now - 56 * 60 * 1000).toISOString(),
      timeLabel: "56 分",
    },
    {
      id: "thread-reference",
      title: "分析一下codex-web 现在我还有问题,我是想做成这样的,由一个网站统一管理所有服务器的 所以我猜测应该是要拆封出…",
      status: "idle",
      updatedAt: new Date(now - 5 * 24 * 3600 * 1000).toISOString(),
      timeLabel: "5 天",
    },
  ];
  if (useDynamicFixture) {
    sessions.unshift({
      id: "dynamic-running",
      title: "Dynamic running fixture",
      status: "running",
      updatedAt: new Date(now).toISOString(),
      timeLabel: "now",
    });
  }
  if (useVirtualFixture) {
    sessions.unshift({
      id: "virtual-scroll",
      title: "Virtual scroll fixture",
      status: "idle",
      updatedAt: new Date(now).toISOString(),
      timeLabel: "now",
    });
  }
  const eventsBySession = new Map();
  if (useDynamicFixture) {
    eventsBySession.set("dynamic-running", [
      {
        kind: "user_message",
        text: "\u53d6\u6d88\u8fd9\u4e2a\u8fd0\u884c\u4e2d\u4efb\u52a1",
        turnKey: "dynamic-cancelled-turn",
        time: new Date(now - 7000).toISOString(),
        seq: 1,
      },
      {
        kind: "turn_started",
        status: "running",
        text: "\u6b63\u5728\u601d\u8003",
        turnKey: "dynamic-cancelled-turn",
        contentUnit: 1,
        time: new Date(now - 6500).toISOString(),
        seq: 2,
      },
      {
        kind: "tool_call",
        status: "running",
        text: "exec_command",
        data: {
          name: "exec_command",
          call_id: "dynamic-cancelled-shell",
          arguments: JSON.stringify({ cmd: "sleep 600", workdir: "C:/workspace/codex-web" }),
          args: { cmd: "sleep 600", workdir: "C:/workspace/codex-web" },
          status: "running",
        },
        turnKey: "dynamic-cancelled-turn",
        contentUnit: 2,
        time: new Date(now - 6000).toISOString(),
        seq: 3,
      },
      {
        kind: "turn_cancelled",
        status: "cancelled",
        text: "Stopped",
        data: { status: "cancelled" },
        turnKey: "dynamic-cancelled-turn",
        contentUnit: 3,
        time: new Date(now - 5500).toISOString(),
        seq: 4,
      },
      {
        kind: "user_message",
        text: "complete this command after it starts running",
        turnKey: "dynamic-completed-turn",
        time: new Date(now - 5200).toISOString(),
        seq: 5,
      },
      {
        kind: "turn_started",
        status: "running",
        text: "\u6b63\u5728\u601d\u8003",
        turnKey: "dynamic-completed-turn",
        contentUnit: 1,
        time: new Date(now - 5100).toISOString(),
        seq: 6,
      },
      {
        kind: "tool_call",
        status: "running",
        text: "exec_command",
        data: {
          name: "exec_command",
          call_id: "dynamic-completed-shell",
          arguments: JSON.stringify({ cmd: "echo done", workdir: "C:/workspace/codex-web" }),
          args: { cmd: "echo done", workdir: "C:/workspace/codex-web" },
          status: "running",
        },
        turnKey: "dynamic-completed-turn",
        contentUnit: 2,
        time: new Date(now - 5000).toISOString(),
        seq: 7,
      },
      {
        kind: "tool_output",
        status: "completed",
        text: "Process exited with code 0\nOutput:\ndone",
        data: {
          call_id: "dynamic-completed-shell",
          output: "Process exited with code 0\nOutput:\ndone",
          status: "completed",
          exit_code: 0,
        },
        turnKey: "dynamic-completed-turn",
        contentUnit: 3,
        time: new Date(now - 4900).toISOString(),
        seq: 8,
      },
      {
        kind: "turn_completed",
        status: "completed",
        data: { status: "completed" },
        turnKey: "dynamic-completed-turn",
        contentUnit: 4,
        time: new Date(now - 4800).toISOString(),
        seq: 9,
      },
      {
        kind: "assistant_message",
        placement: "final",
        text: "Completed command after running state resolved.",
        turnKey: "dynamic-completed-turn",
        contentUnit: 5,
        time: new Date(now - 4700).toISOString(),
        seq: 10,
      },
      {
        kind: "user_message",
        text: "show a processed summary disclosure with reasoning text",
        turnKey: "dynamic-processed-summary-turn",
        time: new Date(now - 4650).toISOString(),
        seq: 11,
      },
      {
        kind: "summary",
        text: "Checked the processed-summary disclosure path and kept command rows out of the expanded body.",
        turnKey: "dynamic-processed-summary-turn",
        contentUnit: 1,
        time: new Date(now - 4625).toISOString(),
        seq: 12,
      },
      {
        kind: "assistant_message",
        placement: "final",
        text: "Processed summary disclosure fixture complete.",
        turnKey: "dynamic-processed-summary-turn",
        contentUnit: 2,
        time: new Date(now - 4600).toISOString(),
        seq: 13,
      },
      {
        kind: "summary",
        inline: true,
        text: "已处理 22s",
        data: { status: "completed", durationMs: 22000 },
        turnKey: "dynamic-processed-summary-turn",
        contentUnit: 3,
        time: new Date(now - 4575).toISOString(),
        seq: 14,
      },
      {
        kind: "user_message",
        text: "show an error activity row",
        turnKey: "dynamic-error-turn",
        time: new Date(now - 4400).toISOString(),
        seq: 15,
      },
      {
        kind: "turn_started",
        status: "running",
        text: "\u6b63\u5728\u601d\u8003",
        turnKey: "dynamic-error-turn",
        contentUnit: 1,
        time: new Date(now - 4300).toISOString(),
        seq: 16,
      },
      {
        kind: "tool_call",
        status: "running",
        text: "exec_command",
        data: {
          name: "exec_command",
          call_id: "dynamic-error-shell",
          arguments: JSON.stringify({ cmd: "exit 1", workdir: "C:/workspace/codex-web" }),
          args: { cmd: "exit 1", workdir: "C:/workspace/codex-web" },
          status: "running",
        },
        turnKey: "dynamic-error-turn",
        contentUnit: 2,
        time: new Date(now - 4200).toISOString(),
        seq: 17,
      },
      {
        kind: "tool_output",
        status: "failed",
        text: "Process exited with code 1\nOutput:\nfailed",
        data: {
          call_id: "dynamic-error-shell",
          output: "Process exited with code 1\nOutput:\nfailed",
          status: "failed",
          exit_code: 1,
        },
        turnKey: "dynamic-error-turn",
        contentUnit: 3,
        time: new Date(now - 4100).toISOString(),
        seq: 18,
      },
      {
        kind: "error",
        status: "error",
        text: "Simulated CLI failure",
        data: { status: "error" },
        turnKey: "dynamic-error-turn",
        contentUnit: 4,
        time: new Date(now - 4000).toISOString(),
        seq: 19,
      },
      {
        kind: "user_message",
        text: "\u8bf7\u7ee7\u7eed\u6309\u5b98\u65b9\u6269\u5c55\u7684\u52a8\u6001\u72b6\u6001\u6e32\u67d3",
        turnKey: "dynamic-running-turn",
        time: new Date(now - 3000).toISOString(),
        seq: 20,
      },
      {
        kind: "turn_started",
        status: "running",
        text: "\u6b63\u5728\u601d\u8003",
        turnKey: "dynamic-running-turn",
        contentUnit: 1,
        time: new Date(now - 2000).toISOString(),
        seq: 21,
      },
      {
        kind: "tool_call",
        status: "running",
        text: "\u6b63\u5728\u7f16\u8f91 1 \u4e2a\u6587\u4ef6",
        items: [
          { text: "frontend/src/pages/codex/index.js" },
          { text: "scripts/audit-codex-dynamic-states.cjs" },
        ],
        turnKey: "dynamic-running-turn",
        contentUnit: 2,
        time: new Date(now - 1000).toISOString(),
        seq: 22,
      },
      {
        kind: "tool_call",
        status: "running",
        text: "exec_command",
        data: {
          name: "exec_command",
          call_id: "dynamic-running-shell",
          arguments: JSON.stringify({ cmd: "npm run build", workdir: "C:/workspace/codex-web" }),
          args: { cmd: "npm run build", workdir: "C:/workspace/codex-web" },
          status: "running",
        },
        turnKey: "dynamic-running-turn",
        contentUnit: 3,
        time: new Date(now - 500).toISOString(),
        seq: 23,
      },
    ]);
  }
  if (useVirtualFixture) {
    eventsBySession.set("virtual-scroll", createVirtualScrollEvents(now));
  }
  eventsBySession.set("thread-reference", [
    {
      kind: "user_message",
      text: "  哪里\n",
      attachments: [{ label: "用户附件", src: referenceAttachmentSrc }],
      turnKey: "019f23e7-087b-7b73-8a8c-2a3d5d5b32b5",
      time: "2026-07-02T17:36:00.000Z",
      seq: 1,
    },
    {
      kind: "assistant_message",
      text: "就在你截图里这一项：\n\n`投放、保存和分享` 右边有个 `>`，点进去，里面会有：\n\n`网页另存为...` / `保存网页为...`\n\n然后保存类型选：\n\n`网页，全部`\n\n如果你要抓更完整的资源，走：\n\n`更多工具` → `开发者工具` → `Network` → 刷新页面 → 右键请求列表 → `Save all as HAR with content`。",
      contentUnit: 1,
      time: "2026-07-02T17:36:10.000Z",
      seq: 2,
    },
    { kind: "user_message", text: "我现在上传了/root/code/codex-web.tar  你可以将它解包,然后看一下我们现在的差异,如果差异较大,那么可以直接reset再实现可能更省事", turnKey: "019f23ea-830d-7410-8437-f627ecc5b9de", time: "2026-07-02T17:39:00.000Z", seq: 3 },
    { kind: "assistant_message", contentUnit: 1, text: "我会先把这个 tar 解到临时目录，不覆盖当前仓库，然后对比前端和服务端差异。只有确认上传版本更接近目标且当前改动确实偏离较大时，才考虑按它回退重做。", time: "2026-07-02T17:39:08.000Z", seq: 4 },
    { kind: "assistant_message", contentUnit: 2, text: "这个 tar 不是源码仓库，而是 Chrome 保存出来的两份页面：会话列表和会话内页面，正好可以作为更贴近你本机 Chrome 的样式参考。我先解包并抽取里面的 webview/样式结构。", time: "2026-07-02T17:39:12.000Z", seq: 5 },
    { kind: "assistant_message", contentUnit: 3, text: "已解到 `/tmp/codex-web-upload.Gzq21b`。我会先看两份 `HTML` 和资源里真实的 webview 内容，再和我们 frontend/src 当前实现做结构/样式差异判断。", time: "2026-07-02T17:39:16.000Z", seq: 6 },
    { kind: "assistant_message", contentUnit: 4, text: "初步差异已经很明显：你这份 Chrome 保存页里 webview 的变量是 Windows/Chrome 实际环境，例如 `--vscode-font-family: \"Segoe WPC\", \"Segoe UI\"`，而我们之前用 headless Linux 对照会看到 Ubuntu/system-ui，所以字体和部分控件会自然偏。", time: "2026-07-02T17:39:20.000Z", seq: 7 },
    { kind: "assistant_message", contentUnit: 5, text: "差异不是一个小 CSS 偏差：当前实现是我们手写的 `.codex-*` 简化结构；你保存的页面里 Codex 面板是完整的扩展 DOM + token utility class。", time: "2026-07-02T17:39:24.000Z", seq: 8 },
    { kind: "assistant_message", contentUnit: 6, text: "截图已经生成：`/tmp/codex-upload-list.png`、`/tmp/codex-upload-thread.png`、`/tmp/codex-current.png`。", time: "2026-07-02T17:39:28.000Z", seq: 9 },
    { kind: "assistant_message", contentUnit: 7, text: "当前页面和你保存的目标页相比，最大问题不只是字体：`composer` 的底部按钮、授权状态、线程页 header、消息区、任务列表 spacing 都是简化版。", time: "2026-07-02T17:39:32.000Z", seq: 10 },
    { kind: "assistant_message", contentUnit: 8, text: "完整保存页本身在 `headless` 打开有一些 Chrome 保存造成的副作用，比如左侧活动栏图标状态/`hover` 被固化了。", time: "2026-07-02T17:39:34.000Z", seq: 11 },
    { kind: "assistant_message", contentUnit: 9, text: "`fake.html` 单独打开没有加载扩展 CSS；但它仍然给了真实 `DOM`、`class` 和文本。", time: "2026-07-02T17:39:35.000Z", seq: 12 },
    { kind: "assistant_message", contentUnit: 10, text: "我会先不动后端。前端保留参考工作区布局，只重写 `frontend/src` 里 Codex 面板相关 DOM/CSS/JS。", time: "2026-07-02T17:39:36.000Z", seq: 13 },
    { kind: "assistant_message", contentUnit: 11, text: "我现在开始改文件：`app.js` 会重写为状态化 Codex 面板，直接接 `/api/nodes`、`/api/sessions` 和 `SSE`。", time: "2026-07-02T17:39:37.000Z", seq: 14 },
    { kind: "tool_call", text: "已创建 1 个文件", time: "2026-07-02T17:39:38.000Z", seq: 15 },
    { kind: "assistant_message", contentUnit: 13, text: "`app.js` 已经重写完成，接下来补样式覆盖。这里会保留 `composer-surface-chrome`、`ProseMirror`、`data-user-message-bubble`、`_markdownContent_lzkx4_60`。", time: "2026-07-02T17:39:39.000Z", seq: 16 },
    { kind: "tool_call", text: "已编辑 2 个文件", time: "2026-07-02T17:39:40.000Z", seq: 17 },
    { kind: "assistant_message", contentUnit: 16, text: "前端静态结构和样式覆盖已经写完。现在我会先做语法检查和构建，再运行截图看它和保存页的主要布局是否靠近。", time: "2026-07-02T17:39:40.200Z", seq: 18 },
    { kind: "assistant_message", contentUnit: 17, text: "语法检查通过。接下来构建并重启服务，然后用 1920×1002 截图确认实际运行效果。", time: "2026-07-02T17:39:40.400Z", seq: 19 },
    { kind: "assistant_message", contentUnit: 18, text: "构建和 Go 测试都通过了：`./build-all.sh`。", time: "2026-07-02T17:39:40.600Z", seq: 20 },
    { kind: "assistant_message", contentUnit: 19, text: "服务已重启且处于 active。接下来我会访问本地 58888 截图，并检查控制台/API 是否有明显错误。", time: "2026-07-02T17:39:40.800Z", seq: 21 },
    { kind: "assistant_message", contentUnit: 20, text: "API 正常返回远程 agent 和会话列表。截图已生成，我会查看当前效果，如果有明显偏差就继续调整。", placement: "final", diffCard: { files: ["frontend/src/app/bootstrap.js", "frontend/src/app/layout.css", "frontend/src/pages/codex/index.js"], total: 4, showMore: true }, time: "2026-07-02T17:51:00.000Z", seq: 22 },
    { kind: "user_message", text: "检查连续命令折叠显示", turnKey: "fixture-exec-group-turn", time: "2026-07-02T17:52:00.000Z", seq: 23 },
    { kind: "tool_call", text: "exec_command", data: { name: "exec_command", call_id: "fixture-call-1", arguments: "{\"cmd\":\"git status --short\",\"workdir\":\"C:/workspace/codex-web\"}", args: { cmd: "git status --short", workdir: "C:/workspace/codex-web" }, status: "completed" }, time: "2026-07-02T17:52:02.000Z", seq: 24 },
    { kind: "tool_output", text: " M frontend/src/pages/codex/renderer.js", data: { call_id: "fixture-call-1", output: " M frontend/src/pages/codex/renderer.js", status: "completed" }, time: "2026-07-02T17:52:03.000Z", seq: 25 },
    { kind: "tool_call", text: "exec_command", data: { name: "exec_command", call_id: "fixture-call-2", arguments: "{\"cmd\":\"node --check frontend/src/pages/codex/renderer.js\",\"workdir\":\"C:/workspace/codex-web\"}", args: { cmd: "node --check frontend/src/pages/codex/renderer.js", workdir: "C:/workspace/codex-web" }, status: "completed" }, time: "2026-07-02T17:52:04.000Z", seq: 26 },
    { kind: "tool_output", text: "Process exited with code 0", data: { call_id: "fixture-call-2", output: "Process exited with code 0", status: "completed" }, time: "2026-07-02T17:52:05.000Z", seq: 27 },
    { kind: "tool_call", text: "exec_command", data: { name: "exec_command", call_id: "fixture-call-3", arguments: "{\"cmd\":\"go test ./...\",\"workdir\":\"C:/workspace/codex-web/backend\"}", args: { cmd: "go test ./...", workdir: "C:/workspace/codex-web/backend" }, status: "completed" }, time: "2026-07-02T17:52:06.000Z", seq: 28 },
    { kind: "tool_output", text: "ok ./...", data: { call_id: "fixture-call-3", output: "ok ./...", status: "completed" }, time: "2026-07-02T17:52:07.000Z", seq: 29 },
    { kind: "assistant_message", contentUnit: 21, text: "连续命令已经检查完。", placement: "final", time: "2026-07-02T17:52:10.000Z", seq: 30 },
    { kind: "summary", turnKey: "019f23f4-f091-75e2-bfc2-dc8a7cc4cb53", text: "已处理 3m 5s", followup: { contentUnit: 12, html: summaryFollowupHTML(), diffCard: { files: [
      { path: "code/codex-web/frontend/src/app/layout.css", additions: "+12", deletions: "-0" },
      { path: "codex-web-browser/fonts.conf", additions: "+41", deletions: "-0" },
      { path: "codex-web-browser/run.sh", additions: "+4", deletions: "-1" },
    ], total: 4, additions: "+61", deletions: "-2", showMore: true }, time: "2026-07-02T17:54:00.000Z" }, time: "2026-07-02T17:51:20.000Z", seq: 3 },
    { kind: "user_message", text: "那么我源码的话现在是否直接reset  push更好  而不是还在现在显示效果差别很大的实现\n", turnKey: "019f23f8-a04c-7993-9c12-af1ad7cf7085", time: "2026-07-02T17:55:00.000Z", seq: 23 },
    { kind: "summary", inline: true, text: "已处理 40s", time: "2026-07-02T17:52:40.000Z", seq: 24 },
    { kind: "assistant_message", placement: "final", html: resetFollowupHTML(), time: "2026-07-02T17:52:41.000Z", seq: 25 },
    { kind: "user_message", text: "那你进行", turnKey: "019f23f6-16c0-7210-b9f3-eccb7cb14da6", time: "2026-07-02T17:53:00.000Z", seq: 26 },
    { kind: "summary", inline: true, text: "已处理 1m 17s", time: "2026-07-02T17:54:17.000Z", seq: 27 },
    { kind: "assistant_message", placement: "final", html: cleanedFollowupHTML(), time: "2026-07-02T17:54:18.000Z", seq: 28 },
    { kind: "user_message", text: "给我push一下  确保我git clone可以直接获取", editable: true, turnKey: "019f23f7-a46a-7b50-9c3a-4b4dd24ed123", time: "2026-07-02T17:55:00.000Z", seq: 29 },
    { kind: "summary", inline: true, text: "已处理 41s", time: "2026-07-02T17:55:41.000Z", seq: 30 },
    { kind: "assistant_message", placement: "final", actionsVisible: true, html: pushedFollowupHTML(), time: "2026-07-02T17:55:42.000Z", seq: 31 },
  ]);
  eventsBySession.set("backup-unarchived", [
    { kind: "user_message", text: "备份未归档会话", time: new Date(now - 56 * 60 * 1000).toISOString(), seq: 1 },
    { kind: "assistant_message", text: "可以，我会整理当前未归档的会话记录。", time: new Date(now - 55 * 60 * 1000).toISOString(), seq: 2 },
  ]);
  return { sessions, eventsBySession };
}

function createInteractiveSession(options = {}) {
  const { state, utils, prompt = "", errorText = "", openSession } = options;
  if (!state || !prompt) return null;
  const id = `fixture-${Date.now()}`;
  const now = new Date().toISOString();
  const trimTitle = typeof utils?.trimTitle === "function"
    ? utils.trimTitle
    : (value) => String(value || "New fixture session").trim().slice(0, 80) || "New fixture session";
  const session = {
    id,
    title: trimTitle(prompt),
    status: "idle",
    updatedAt: now,
    lastSeq: 2,
    timeLabel: "刚刚",
  };
  state.sessions.unshift(session);
  state.eventsBySession.set(id, [
    { sessionId: id, kind: "user_message", text: prompt, time: now, seq: 1 },
    errorText
      ? { sessionId: id, kind: "error", text: errorText, time: now, seq: 2 }
      : { sessionId: id, kind: "assistant_message", text: "本地样式预览会话已创建。", time: now, seq: 2 },
  ]);
  if (typeof openSession === "function") void openSession(id);
  return session;
}

  global.CodexPanelFixtures = { createSampleData, createInteractiveSession };
})(window);
