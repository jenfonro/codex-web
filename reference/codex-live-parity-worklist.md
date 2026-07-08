# Codex Web 官方会话对齐工作清单

Created: 2026-07-08
Reset: 44
Status: active

## 当前结论

Codex Web 长会话显示还没有通过官方 code-server Codex/ChatGPT 扩展对齐验收。

Reset 43 及更早的工作文件和证据只能作为排查线索，不能作为完成证据。Reset 43 active 工作文件已归档到：

- `reference/legacy/20260708-reset43-false-positive-active-archive/codex-live-parity-worklist.reset43.md`

## 固定验收目标

- source: `https://code-tx.zelt.cn/?folder=/root`
- target: `https://codex.zelt.cn/?nodeId=host-docker-agent`
- session: `019f0a04-7f0b-7483-8bc4-18f214a5c8f1`
- viewport: `1920x1080`
- source 状态：Codex/ChatGPT 扩展必须在左侧 Activity Bar，右侧聊天侧边栏必须关闭。
- 验收方式：按相同语义文本锚点，从长会话最新内容开始倒序向上覆盖整个会话。

## 不能再接受的假阳性

- 不能把工作文件更新当作进度。
- 不能把 `build passed`、`service active`、`audit 0 failed`、target-only 探针当作 UI 对齐完成证据。
- 不能只看源码、单边 DOM、单边截图或单个局部锚点就标记 accepted。
- 不能把官方结构化的 processed、thinking、running、file、diff、代码改动块渲染成普通文本。
- 不能保留 parity path 之外的增强显示，例如命令汇总、`exec_command xN`、运行摘要。
- 不能用裁剪历史、隐藏内容、跳过事件、遮罩层、pointer-events hack 或错误 spacer 解决长会话问题。
- 不能在可点击区域、展开/收缩区域没有 hit-test 证据时标记完成。

## 完成标准

任一 UI 对齐任务只有同时满足以下条件，才能标记 `accepted`：

- local HEAD、origin HEAD、server HEAD 一致。
- 线上已 git 同步、构建、重启，浏览器实际加载最新 JS/CSS。
- source/target 在同一轮 Playwright/CDP 中打开，viewport 不小于 `1920x1080`。
- 每个锚点都证明 source/target 是同一语义位置，不是重复文本误匹配。
- 结构化锚点必须证明 DOM 结构正确，例如 file/diff activity 不能只靠普通文本匹配。
- 可展开区域必须验证 collapsed 和 expanded 两种状态，且 hit-test 命中真实控件。
- 长会话倒序滚动不能闪烁、跳回、白屏、卡死或无法点击。
- 用户在线上仍可复现的问题必须保持 open。

## 当前失败证据

### R44-F1. `已编辑 4 个文件` 同锚点文件卡片

Status: verified-specific

Evidence:

- `reference/same-anchor-evidence/20260707-211809/summary.json`
- target API 唯一命中 `seq=7570`，kind 为 `file_change`。
- target DOM 当前可以渲染 `data-codex-event-seq="7570"` 的文件卡片。
- 旧脚本错误地把 `file_change` 强制归到父级 `已处理` disclosure，导致要求展开错误控件。
- 旧脚本定位命中后滚到整轮 turn，而不是滚到精确文件卡片，导致截图可落在错误可见区域。
- `reference/same-anchor-evidence/20260707-212748/` 证明取证链已可定位到同一文件卡片，但截图发现 target 多出一行卡片外部 `再显示 1 个文件`，且文件路径保留 `/root/` 前缀。
- `reference/same-anchor-evidence/20260707-213509/` 证明 source/target 均按结构化 activity 验收，API 唯一命中 `seq=7570`，source/target 截图均显示同一个 `已编辑 4 个文件` 文件卡片。

Required fix:

- `file_change` 锚点按结构化文件 activity 卡片验收，不按父级 processed disclosure 验收。
- DOM 定位命中后必须滚到最深的锚点元素。
- 文件卡片只能保留官方式卡片内部 show-more 控件，不能额外在卡片外重复显示。
- 文件路径显示需要去掉运行环境前缀，例如 `/root/`、`/workspace/`。
- 同锚点报告必须显示 source/target 都找到结构化 file activity，且截图中可见同一个 `已编辑 4 个文件` 卡片。
- 当前结论：该具体锚点已验证；这不代表 processed/file/diff 全规则或完整长会话已验收。

### R44-F2. processed / file / diff 分组规则仍未整段验收

Status: open

Verified-specific anchors:

- `已处理 40s`
  - Evidence: `reference/same-anchor-evidence/20260707-215121/summary.json`
  - Screenshots:
    - `reference/same-anchor-evidence/20260707-215121/source-anchor-1-collapsed.png`
    - `reference/same-anchor-evidence/20260707-215121/target-anchor-1-collapsed.png`
    - `reference/same-anchor-evidence/20260707-215121/source-anchor-1-expanded.png`
    - `reference/same-anchor-evidence/20260707-215121/target-anchor-1-expanded.png`
  - Result: source/target 同锚点、同语义上下文、target API 唯一命中 `seq=7592`，collapsed/expanded 两态均验证通过。
  - Click evidence: target 使用 `data-disclosure-toggle="turn-activity:019f23f8-a04c-7993-9c12-af1ad7cf7085"` 精确 DOM click；hit-test 前后均命中 `已处理 40s` 控件，settled `aria-expanded=true`。
  - Screenshot evidence: 截图前重新按同锚点定位并等待两帧绘制，target collapsed/expanded PNG 均显示 `已处理 40s` 位置。
  - Scope: 该具体 processed 锚点通过；不代表 processed/file/diff 全规则或完整长会话已验收。
- `./build-all.sh`
  - Evidence: `reference/same-anchor-evidence/20260707-215530/summary.json`
  - Screenshots:
    - `reference/same-anchor-evidence/20260707-215530/source-anchor-1-current.png`
    - `reference/same-anchor-evidence/20260707-215530/target-anchor-1-current.png`
  - Result: source/target 同锚点、同语义上下文、target API 唯一命中 `seq=7631`，current 状态验证通过。
  - Screenshot evidence: 两边均显示同一段“验证已完成”列表，`./build-all.sh` 作为官方样式的灰色 code pill 出现，没有 Codex-Web-only 命令增强块。
  - Scope: 该具体文本/结构锚点通过；不代表 command/tool/file/diff 全规则或完整长会话已验收。
- `已处理 1m 17s`
  - Evidence: `reference/same-anchor-evidence/20260707-220939/summary.json`
  - Screenshots:
    - `reference/same-anchor-evidence/20260707-220939/source-anchor-1-collapsed.png`
    - `reference/same-anchor-evidence/20260707-220939/target-anchor-1-collapsed.png`
    - `reference/same-anchor-evidence/20260707-220939/source-anchor-1-expanded.png`
    - `reference/same-anchor-evidence/20260707-220939/target-anchor-1-expanded.png`
  - Result: source/target 同锚点均找到并验证 collapsed/expanded；target 展开点击成功。
  - Warning: target API 使用唯一候选 fallback，不能作为完整上下文命中证据；仅作为该局部 processed 锚点证据。
- `fonts.conf`
  - Evidence: `reference/same-anchor-evidence/20260707-221251/summary.json`
  - Screenshots:
    - `reference/same-anchor-evidence/20260707-221251/source-anchor-1-current.png`
    - `reference/same-anchor-evidence/20260707-221251/target-anchor-1-current.png`
  - Result: 使用 `TARGET_FOCUS_SEQ=7570` 和 `TARGET_API_KIND=file_change` 严格覆盖；target API 命中 `seq=7570 kind=file_change`，且该 seq 文本包含 `fonts.conf`，source/target 截图均为文件 activity 卡片。
  - Scope: 该具体 file_change 锚点通过；不代表所有 file/diff 卡片规则完成。
- `已创建 1 个文件`
  - Evidence: `reference/same-anchor-evidence/20260707-222235/summary.json`
  - Screenshots:
    - `reference/same-anchor-evidence/20260707-222235/source-anchor-1-current.png`
    - `reference/same-anchor-evidence/20260707-222235/target-anchor-1-current.png`
  - Result: 使用 `SOURCE_CONTEXT_TERMS=codex-web.tar||chrome 保存` 将 source 两个候选过滤到 1 个；target API 严格命中 `seq=7492 kind=file_change`，source/target 截图均为官方结构化文件 activity 卡片。
  - Scope: 该具体 file_change 锚点通过；不代表所有 file/diff 卡片规则完成。
- `frontend/src/styles.css`
  - Evidence: `reference/same-anchor-evidence/20260707-222333/summary.json`
  - Screenshots:
    - `reference/same-anchor-evidence/20260707-222333/source-anchor-1-current.png`
    - `reference/same-anchor-evidence/20260707-222333/target-anchor-1-current.png`
  - Result: 使用 `SOURCE_CONTEXT_TERMS=codex-web.tar||chrome 保存` 与 `TARGET_FOCUS_SEQ=7494`、`TARGET_API_KIND=file_change`；source/target 均唯一命中同一文件 activity 卡片，target API contextMatched 为 true。
  - Scope: 该具体 file_change 锚点通过；不代表所有 file/diff 卡片规则完成。
- `已处理 3m 5s`
  - Evidence: `reference/same-anchor-evidence/20260707-222431/summary.json`
  - Screenshots:
    - `reference/same-anchor-evidence/20260707-222431/source-anchor-1-collapsed.png`
    - `reference/same-anchor-evidence/20260707-222431/target-anchor-1-collapsed.png`
    - `reference/same-anchor-evidence/20260707-222431/source-anchor-1-expanded.png`
    - `reference/same-anchor-evidence/20260707-222431/target-anchor-1-expanded.png`
  - Result: source/target 同锚点唯一命中，collapsed/expanded 两态均验证通过；target 展开点击成功。
  - Scope: 该具体 processed 锚点通过；不代表 processed/file/diff 全规则或完整长会话已验收。
- `frontend/src/index.html`
  - Evidence: `reference/same-anchor-evidence/20260707-223047/summary.json`
  - Screenshots:
    - `reference/same-anchor-evidence/20260707-223047/source-anchor-1-current.png`
    - `reference/same-anchor-evidence/20260707-223047/target-anchor-1-current.png`
  - Result: source/target 均找到同锚点；target API 严格命中 `seq=7495 kind=file_change`，target 按结构化 file activity 验收。
  - Warning: target API `contextMatched=false`，因此只能作为该 `seq=7495` 的局部 file_change 证据，不能升级为规则级证据。
  - Scope: 该具体 file_change 锚点通过；不代表所有 file/diff 卡片规则完成。
- `已处理 19m 22s`
  - Evidence: `reference/same-anchor-evidence/20260707-223216/summary.json`
  - Screenshots:
    - `reference/same-anchor-evidence/20260707-223216/source-anchor-1-collapsed.png`
    - `reference/same-anchor-evidence/20260707-223216/target-anchor-1-collapsed.png`
    - `reference/same-anchor-evidence/20260707-223216/source-anchor-1-expanded.png`
    - `reference/same-anchor-evidence/20260707-223216/target-anchor-1-expanded.png`
  - Result: source/target 同锚点、同语义上下文；target API 严格命中 `seq=7352 kind=summary`，collapsed/expanded 两态均验证通过。
  - Scope: 该具体 processed 锚点通过；不代表 processed/file/diff 全规则或完整长会话已验收。

Rejected/unusable evidence:

- `reference/same-anchor-evidence/20260707-221759/summary.json`
  - Anchor: `frontend/src/app.js`
  - Result: unusable；target API 严格命中 `seq=7492 kind=file_change`，但 source DOM 有 3 个候选。
  - Decision: 不作为对齐证据；后续必须使用 source 上下文约束或更结构化锚点。
- `reference/same-anchor-evidence/20260707-221953/summary.json`
  - Anchor: `已创建 1 个文件`
  - Result: unusable；source DOM 有 2 个候选。
  - Decision: 不作为对齐证据；已由 `reference/same-anchor-evidence/20260707-222235/` 使用 `SOURCE_CONTEXT_TERMS` 重新取证。
- `reference/same-anchor-evidence/20260707-223354/summary.json`
  - Anchor: `已处理 19s`
  - Result: unusable；target API 严格命中 `seq=7426 kind=summary` 且 target 可展开，但 source anchor 未找到。
  - Decision: 不作为对齐证据；后续必须用可在 source/target 同时定位的语义锚点重新取证。
- `reference/same-anchor-evidence/20260707-223504/summary.json`
  - Anchor: `已处理 12s`
  - Result: unusable；source anchor 未找到，target expanded state 未验证通过，截图为 `target-anchor-1-still-collapsed.png`。
  - Decision: 不作为对齐证据；该证据暴露脚本存在误选附近 `aria-expanded` 控件的风险，必须收紧 disclosure 控件匹配，避免附件/无关按钮被当成 processed 展开控件。
- `reference/same-anchor-evidence/20260707-224250/summary.json`
  - Anchor: `已处理 12s`
  - Result: unusable；source anchor 未找到，target 严格命中 `seq=7429 kind=summary`，但未找到可验证的官方 status disclosure 控件。
  - Decision: 不作为对齐证据；该负例用于证明脚本已不再把附近附件/无关 `aria-expanded` 控件误判为 processed 展开控件。

Required fix:

- 对比官方扩展源码、source DOM、target DOM 三方规则。
- 文件卡片、diff 卡片、processed 折叠体、running/thinking 状态必须按官方显示和分组。
- 先移除 parity path 中额外命令增强显示，后续增强必须独立开关。

### R44-F3. 长会话滚动与点击稳定性未完成验收

Status: open

Current evidence:

- `reference/collapse-alignment/20260707-224643/summary.json`
  - Capture scope: `MAX_SCROLL_CHUNKS=14` + `EXPAND_SUMMARIES_FOR_CAPTURE=1`，source/target 均为 `1920x1080`。
  - Audit before fix: `reference/codex-reference/collapse-window-rules-audit.json`
  - Result: 27 checks, 2 failed。
  - Failed signals: target activity headers/tool disclosures captured 为 0，而 source activity headers/tool disclosures 非 0。
  - Interpretation: 目标展开体可显示 fileReferences，但 diff/file activity header 没有官方 `group/activity-header` DOM 语义，不能算官方 activity 结构对齐。
- `reference/collapse-alignment/20260707-225412/summary.json`
  - Capture scope: 线上部署 `9e4945f` 后，`MAX_SCROLL_CHUNKS=14` + `EXPAND_SUMMARIES_FOR_CAPTURE=1`，source/target 均为 `1920x1080`。
  - Audit: `reference/codex-reference/collapse-window-rules-audit.json`
  - Result: 27 checks, 0 failed。
  - Passed signals: target `activityHeaders/toolDisclosures` 从 0 变为非 0，sourceMax/targetMax 均有 activity/tool disclosure 覆盖，且没有 Codex-Web-only command enhancement rows。
  - Interpretation: 这证明当前窗口采样内 diff card activity header DOM 语义已修复；仍不是完整长会话倒序验收。
- `reference/collapse-alignment/20260707-215848/summary.json`
  - Capture scope: `MAX_SCROLL_CHUNKS=4`，source/target 均为 `1920x1080`，target session 为 `019f0a04-7f0b-7483-8bc4-18f214a5c8f1`。
  - Audit: `reference/codex-reference/collapse-window-rules-audit.json`
  - Result: 27 checks, 2 failed。
  - Passed signals: source/target 均有多个 unique virtual windows；每个可见 turn 都有 style/signature/semantic evidence；未发现 Codex-Web-only command enhancement rows；未发现 grouped command child rows。
  - Failed signals: target activity headers/tool disclosures captured 为 0。
  - Interpretation: 本轮 collapse capture 只覆盖 collapsed summary 和普通 assistant markdown，没有展开 processed body，因此不能证明 target tool disclosure 缺失，也不能关闭 F3。下一轮必须增加“展开 processed 后采样 tool disclosure”的捕获。
- `reference/live-anchor-alignment/20260707-220904/summary.json`
  - Capture scope: target-only 线上交互探针，`1920x1080`，8 次真实滚轮向上滚动。
  - Result: 11 checks, 0 failed；两次 processed 真实点击均成功；观察到 7 个 unique virtual windows；未发现命令增强残留。
  - Interpretation: 只能证明本轮 target 覆盖位置未复现“点不开/滚不动”，不能关闭 F3。
- `reference/collapse-alignment/20260707-221051/summary.json`
  - Capture scope: `MAX_SCROLL_CHUNKS=4` + `EXPAND_SUMMARIES_FOR_CAPTURE=1`，source/target 均为 `1920x1080`。
  - Audit: `reference/codex-reference/collapse-window-rules-audit.json`
  - Result: 27 checks, 0 failed。
  - Passed signals: 小范围窗口内 source/target 均有 processed summary、file reference styling；未发现 Codex-Web-only command enhancement rows；未发现 grouped command child rows。
  - Interpretation: 这只是 4 个窗口的小范围 collapse 采样，不是完整长会话倒序验收。
- `reference/live-anchor-alignment/20260707-231821/summary.json`
  - Capture scope: 修复前的完整同锚点 plan，`DISCOVER_MAX_WINDOWS=80`、`DISCOVER_MAX_ANCHORS=60`，source/target 均为 `1920x1080`。
  - Result: 14 checks, 1 failed；14 accepted, 46 rejected, 16 plan failures。
  - Failed signals: 16 个 `target-visual-missing` 均为 target API 能命中 `assistant_message` seq，但渲染层找不到可见锚点。
  - Interpretation: 失败原因不是直接证明产品缺渲染，而是暴露验收脚本在 target focus turn 加载前就尝试展开 processed summary，导致折叠体内 assistant 文本被误判为不可见。
- `reference/target-focus-seq/20260707-231404/summary.json`
  - Capture scope: target-only 探针，`TARGET_FOCUS_SEQ=858`。
  - Result: focus turn 已加载，当前可见节点为 `已处理 7m 13s`，目标 assistant 文本位于该 processed summary 关联区域。
  - Interpretation: 该证据证明 `seq=858` 类失败需要先把目标 focus turn 滚入 DOM，再展开 processed summary 后才能按同锚点查找；不能作为 source/target parity 通过证据。
- `reference/live-anchor-alignment/20260707-233319/summary.json`
  - Capture scope: 修复展开时机后的局部同锚点 plan，`DISCOVER_MAX_WINDOWS=35`、`DISCOVER_MAX_ANCHORS=35`，覆盖 `seq=484/476/466/61` 等旧失败点。
  - Result: 14 checks, 0 failed；7 accepted, 28 rejected, 0 plan failures。
  - Interpretation: 该局部验证证明“滚动/历史加载后再展开 processed summary”能消除旧 visual-missing 假阳性；仍不是完整长会话验收。
- `reference/live-anchor-alignment/20260707-234105/summary.json`
  - Capture scope: 修复展开时机后的完整同锚点 plan，`DISCOVER_MAX_WINDOWS=80`、`DISCOVER_MAX_ANCHORS=60`，source/target 均为 `1920x1080`。
  - Result: 14 checks, 0 failed；14 accepted, 46 rejected, 0 plan failures。
  - Accepted coverage includes `seq=1470/1428/1424/1278/950/858/857/484/482/476/466/444/61/1`。
  - Interpretation: 这证明上一轮完整 plan 的 target visual missing 是验收脚本假阳性并已修复；它只证明锚点计划链路可用，不能关闭 F2/F3，因为还没有完成全会话逐段样式、分组、collapsed/expanded、hit-test 的最终验收。

Required fix:

- 用同锚点倒序滚完整个长会话。
- 每个出现的 processed/file/diff 可展开块都要验证可点击、可展开、可收起。
- 不允许用 target-only 探针关闭此任务。

## 当前变更记录

- 2026-07-08: Reset 43 active 工作文件已归档。
- 2026-07-08: `scripts/capture-codex-same-anchor-evidence.cjs` 已收紧：
  - `file_change` 锚点不再要求父级 `已处理` disclosure。
  - `file_change` 锚点必须验证结构化 activity。
  - 命中锚点后滚到最深锚点元素，而不是整轮 turn。
  - summary 输出 `requiresStructuredActivity`。
  - source selector 已补充官方 `.thread-diff-virtualized` / `turn-diff` 文件活动节点，避免 source 侧退化为普通文本验收。
- 2026-07-08: `frontend/src/pages/codex/renderer.js` 已移除 file activity 卡片外层重复 show-more 行。
- 2026-07-08: `frontend/src/pages/codex/renderer.js` 已规范化 diff/file activity 显示路径，去掉 `/root/` 和 `/workspace/` 前缀。
- 2026-07-08: `scripts/capture-codex-same-anchor-evidence.cjs` 已修正 processed disclosure 取证链：
  - 带 `data-disclosure-toggle` 的 target 控件先通过语义键精确 DOM click，保留 hit-test 证明，不再依赖不稳定的 CDP 坐标点击。
  - DOM click 后等待两帧绘制并记录 settled `aria-expanded`，避免 immediate state 造成误判。
  - 每次 anchor 截图前重新按同锚点定位并等待绘制，避免 summary DOM 状态和 PNG 可视状态脱节。
  - `已处理 40s` 同锚点证据已在 `reference/same-anchor-evidence/20260707-215121/` 通过；这只是具体锚点证据，不是整体验收。
- 2026-07-08: `./build-all.sh` 同锚点证据已在 `reference/same-anchor-evidence/20260707-215530/` 通过；两边均为官方样式 code pill 列表，未出现额外命令增强块。
- 2026-07-08: `capture-collapse-alignment.cjs` 小规模采样已跑过 `reference/collapse-alignment/20260707-215848/`；窗口规则 audit 未发现命令增强残留，但未覆盖展开态 tool disclosure，F3 继续 open。
- 2026-07-08: `scripts/capture-codex-same-anchor-evidence.cjs` 新增严格覆盖入口：
  - `TARGET_FOCUS_SEQ` / `TARGET_API_SEQ` 可指定目标 API seq。
  - `TARGET_API_KIND` 可指定目标 API kind。
  - 覆盖必须命中同一 anchor 文本和指定 kind，否则证据失败。
- 2026-07-08: `scripts/capture-codex-same-anchor-evidence.cjs` 新增 source 侧上下文约束：
  - `SOURCE_CONTEXT_TERMS` 可用 `||` 或换行分隔。
  - source 候选必须命中指定上下文词，避免同名文件或同名 summary 跨 turn 误匹配。
- 2026-07-08: `已处理 1m 17s` 同锚点证据已在 `reference/same-anchor-evidence/20260707-220939/` 通过；该证据带唯一候选 fallback warning，只能作为局部 processed 证据。
- 2026-07-08: `fonts.conf` 同锚点证据已在 `reference/same-anchor-evidence/20260707-221251/` 通过；target API 严格命中 `seq=7570 kind=file_change`，截图显示 source/target 文件 activity 卡片。
- 2026-07-08: `frontend/src/app.js` 和 `已创建 1 个文件` 的无上下文尝试分别在 `reference/same-anchor-evidence/20260707-221759/`、`reference/same-anchor-evidence/20260707-221953/` 被拒绝为 unusable，原因是 source 候选不唯一。
- 2026-07-08: `已创建 1 个文件` 在 `reference/same-anchor-evidence/20260707-222235/` 通过；使用 source 上下文约束和 target `seq=7492 kind=file_change`。
- 2026-07-08: `frontend/src/styles.css` 在 `reference/same-anchor-evidence/20260707-222333/` 通过；使用 source 上下文约束和 target `seq=7494 kind=file_change`。
- 2026-07-08: `已处理 3m 5s` 在 `reference/same-anchor-evidence/20260707-222431/` 通过 collapsed/expanded 两态验证；这是局部 processed 证据。
- 2026-07-08: `frontend/src/index.html` 在 `reference/same-anchor-evidence/20260707-223047/` 通过；target 严格命中 `seq=7495 kind=file_change`，但 `contextMatched=false`，只作为局部 file_change 证据。
- 2026-07-08: `已处理 19m 22s` 在 `reference/same-anchor-evidence/20260707-223216/` 通过 collapsed/expanded 两态验证；这是局部 processed 证据。
- 2026-07-08: `已处理 19s` 在 `reference/same-anchor-evidence/20260707-223354/` 被拒绝为 unusable，原因是 source anchor 未找到。
- 2026-07-08: `已处理 12s` 在 `reference/same-anchor-evidence/20260707-223504/` 被拒绝为 unusable，原因是 source anchor 未找到且 target 展开态未验证通过。
- 2026-07-08: `scripts/capture-codex-same-anchor-evidence.cjs` 已进一步收紧 disclosure 候选：
  - 只有语义文本匹配 `已处理/processed/正在思考/thinking/正在运行/running` 等官方状态行，且带有展开状态或官方 disclosure key 的控件，才可作为 processed 展开验收控件。
  - 明确排除用户附件、attachment、image preview、`size-20 cursor-interaction` 等附件/预览控件，避免无关 `aria-expanded` 元素造成假阳性。
- 2026-07-08: `已处理 12s` 已用新脚本重跑到 `reference/same-anchor-evidence/20260707-224250/`；结果保持 unusable，且失败原因为 target 没有可验证的官方 status disclosure 控件，说明附件/无关控件不再被误选。
- 2026-07-08: `reference/collapse-alignment/20260707-224643/` 的 14 窗口展开采样失败，原因是 target activity headers/tool disclosures 为 0。
- 2026-07-08: `frontend/src/pages/codex/renderer.js` 已将 diff card 顶部文件变更标题从仅 `group/turn-diff-header` 调整为 `group/turn-diff-header group/activity-header`，让 `已编辑 N 个文件` 这类文件变更卡片具备官方 activity header DOM 语义。
- 2026-07-08: 线上已部署 `9e4945f`，并用 `reference/collapse-alignment/20260707-225412/` 重新采样；`collapse-window-rules-audit` 为 27 checks, 0 failed。这只是当前 14 窗口采样通过，不能关闭完整长会话验收。
- 2026-07-08: target-only 线上交互探针 `reference/live-anchor-alignment/20260707-220904/` 通过；只能证明覆盖位置点击/滚动可用，不能关闭 F3。
- 2026-07-08: 带展开采样的 collapse 窗口审计 `reference/collapse-alignment/20260707-221051/` 通过；范围仍是小窗口，不是完整长会话。

- 2026-07-08: `scripts/audit-codex-live-anchor-alignment.cjs` 修复 target focus processed summary 展开时机：
  - 旧逻辑在目标 focus turn 滚入 DOM 前就尝试展开，导致 `seq=858` 等折叠体内 assistant 文本被误报为 `target-visual-missing`。
  - 新逻辑在每次滚动、历史加载和恢复搜索后都先尝试展开 focus turn 内的 official processed summary，并在失败报告中记录 `expandedFocusDisclosureAttempts`。
  - 修复前完整 plan `reference/live-anchor-alignment/20260707-231821/` 为 16 个 plan failures。
  - 修复后局部 plan `reference/live-anchor-alignment/20260707-233319/` 和完整 plan `reference/live-anchor-alignment/20260707-234105/` 均为 0 failed。
  - 该结果只关闭“验收脚本假阳性”这一排查项；F2/F3 仍保持 open。
- 2026-07-08: `scripts/audit-codex-live-anchor-alignment.cjs` 继续修复同锚点审计链路，避免新的假阳性：
  - source 锚点发现不再依赖浏览器当前滚动状态；默认 `SOURCE_DISCOVERY_START=latest`，当前 code-server reverse scroll 的 latest 端实测为 `scrollTop=0`。
  - 删除发现后按 `abs(scrollTop)` 重排 anchors 的逻辑，保留“从最新向历史”的发现顺序。
  - 发现窗口不再因为 `DISCOVER_MAX_ANCHORS` 已满而提前停止；窗口采样按完整 `scrollTop` 范围均匀覆盖，避免只覆盖最近半段会话。
  - target 锚点定位在 focus turn 已经可见时仍会按 source 锚点 top 对齐；processed summary 展开后也会再次对齐并在 anchor 仍不可见时继续恢复搜索。
  - 报告新增 `summary.compact.json`，并压缩 `sourceAnchorDiscovery.windows`，避免巨大 JSON 影响后续判断。
  - 验证：`node --check scripts\audit-codex-live-anchor-alignment.cjs`、`git diff --check` 通过。
  - 小范围真实 UI 审计 `reference/live-anchor-alignment/20260708-003104/` 曾因锚点垂直位置误差失败 2 项；修复后同范围 `reference/live-anchor-alignment/20260708-003432/` 为 62 checks, 0 failed。
  - 全范围 8 窗口 plan-only `reference/live-anchor-alignment/20260708-003927/` 曾在 `seq=1424` 出现 `target-visual-missing`；target-only 探针 `reference/target-focus-seq/20260708-004246/` 证明该 seq 的 focus turn 可加载；恢复搜索修复后 `reference/live-anchor-alignment/20260708-004359/` 为 0 failed，覆盖 `seq=7633/6700/6204/1424/444/1`。
  - 这些结果只证明“验收链路假阳性继续收敛”；不能关闭 R44-F2/R44-F3，完整长会话的逐段样式、分组、collapsed/expanded、hit-test 验收仍未完成。
- 2026-07-08: `reference/live-anchor-alignment/20260708-004820/` 跑过 8 窗口全范围非 plan-only 审计，结果为 78 checks, 3 failed。
  - 3 个失败都集中在 anchor 2：user 文本 `你为什么自作主张给我加了密码的相关样式 我现在完全不需要认证!` 附近的 activity/file label parity。
  - 截图和 DOM 检查显示该 anchor 是普通 user 锚点，不是 file/diff 结构锚点；source 视口附近出现文件 activity，target 由于滚动 framing 和 user/assistant 分段不同没有在同一 anchor-near band 命中，不能作为 file/diff 产品差异强证据。
  - 审计脚本已改为：只有 `kind=file/activity/diff` 或锚点文本本身是 `已编辑/已创建/已删除 N 个文件` 时，才把 file/diff/activity parity 作为失败门槛；普通 user/assistant 锚点只记录，不用于关闭或触发 file/diff 差异。
  - 复核：`reference/live-anchor-alignment/20260708-005813/` 在失败附近窗口复跑为 46 checks, 0 failed；原 auth user 锚点被 rejected 为 `source-missing`，不能作为产品差异证据。
  - 当前结论：`004820` 不进入产品修复队列；下一步需要选取真正 file/diff 结构锚点继续审计。
- 2026-07-08: anchor discovery 已开始优先采集结构化 activity：
  - 默认 `DISCOVER_ANCHOR_KINDS` 从 `user,file` 改为 `activity,file,user`。
  - source window 采样新增 `selectors.activityHeader` 候选，`kind=activity`。
  - `validateAnchorCandidateText` 允许 `已编辑/已创建/已删除 N 个文件` 这类短 activity label 进入 plan，不再按普通文本最小长度拒绝。
  - 验证：`reference/live-anchor-alignment/20260708-010651/` 中 `已编辑 2 个文件` 和 `已创建 5 个文件` 已进入候选；其中 `已编辑 2 个文件` target API 命中 `seq=2875 kind=file_change`，但因短标签重复且上下文不唯一，被正确 rejected 为 `ambiguous-context`。
  - 当前结论：activity 候选入口已打通，但还不能只靠短标签验收；下一步需要把 activity 锚点绑定到 file_change seq、文件路径和增删统计，形成结构化 disambiguation。
- 2026-07-08: `scripts/audit-codex-live-anchor-alignment.cjs` 已加入 activity/file_change 结构化消歧，避免短标签假阳性：
  - source discovery 的 activity anchor 现在保留 `activity.label/action/count/fileTokens/basenames/stats`，去重 key 也加入 file tokens，避免同名 `已编辑 N 个文件` 被当作同一个锚点。
  - target API 匹配时，`kind=activity` 必须绑定 `file_change` 记录；短标签必须同时满足 label/action/count，并且至少命中一个 source file token，不能只靠 `已编辑 N 个文件` 文本通过。
  - 验证：`reference/live-anchor-alignment/20260708-012247/` 中自动发现的 `已编辑 2 个文件` 因 source 未采到 file token 被 rejected 为 `target-api-ambiguous`；这是正确拒绝，不能作为 UI 对齐证据。
  - 验证：固定锚点 `已编辑 4 个文件` + `fonts.conf` 在 `reference/live-anchor-alignment/20260708-012717/` plan-only 中严格命中 target API `seq=7570 kind=file_change`，`structuredActivityMatch=true`，`tokenMatches=1/1; tokens=fonts.conf`。
  - 这只证明 API 结构化消歧路径可用，不证明 UI parity 完成。
- 2026-07-08: activity/file parity 审计已从“target 不缺即可”改为 strict parity，修复新的假阳性：
  - 旧规则中 `reference/live-anchor-alignment/20260708-012811/` 对同一 `seq=7570` 真实 UI 审计报 0 failed，但细节显示 `source=0; target=1` 仍被判通过，这是验收脚本假阳性。
  - 新规则对 activity 锚点要求 source/target activity rows、file rows、visible file labels 和 file stats 一致，不再允许 source 为空时静默通过。
  - 验证：同一固定锚点重跑到 `reference/live-anchor-alignment/20260708-013040/`，结果为 29 checks, 3 failed。
  - 继续排查确认 `013040` 的失败主要来自审计链路：source file stats 没看 `beforeTurnText/afterTurnText/turnText`，target 同一 `data-disclosure-toggle` 的 snapshot 状态和 real-click 状态被重复保留。
  - 已修复：file activity 分类纳入 turn 文本；`mergeDisclosureEvidence` 改为按 disclosure key 构建去重数组；file stats 使用统一 file token 归一化并去重。
  - 验证：`reference/live-anchor-alignment/20260708-013707/` 对同一固定锚点重跑为 29 checks, 0 failed；关键项显示 source/target 均为 `source=1; target=1`、`sourceFileStats=4; targetFileStats=4`、`sourceLabels=收起文件; targetLabels=收起文件`、`statsEqual=true`。
  - 当前结论：`seq=7570` 这个具体 activity/file_change 锚点的审计链路已收紧并通过；这仍只是局部固定锚点，不关闭 R44-F2/R44-F3。
- 2026-07-08: 更大范围自动发现审计继续收紧：
  - `reference/live-anchor-alignment/20260708-013856/` 暴露自动发现 activity 容器过宽：`已编辑 2 个文件` 携带 7 个 source token，但 label count 只有 2，结果只因 `index.html/styles.css` 两个 token 命中而误绑到 `seq=2875`。
  - 已修复：`normalizeFileToken` 过滤 `li.action-item.icon` 等 CSS selector token；结构化匹配新增 `tokenScopeTooBroad`，当 source token 数明显超过 `count * 2` 时拒绝进入 UI 对比。
  - 复跑 plan-only：`reference/live-anchor-alignment/20260708-015234/` 结果为 14 checks, 1 failed；宽容器 `已编辑 2 个文件` 已被 rejected 为 `target-api-ambiguous`，不再误进入真实 UI 验收。
  - 剩余失败为 `已编辑 1 个文件`：target API 结构化命中 `seq=7494 kind=file_change`，但主审计按 `已编辑 1 个文件` 视觉定位失败。
  - target-only 探针 `reference/target-focus-seq/20260708-015501/` 证明 `seq=7494` 所在 turn 可加载，且 DOM 中该事件与 `7495` 合并为 `data-codex-event-seqs="7494 7495"` 的 `已编辑 2 个文件` 卡片。
  - 当前结论：`seq=7494` 不是简单 target 缺渲染；下一步要判断这是官方/目标分组差异，还是主审计需要支持 grouped file_change 视觉锚点。
- 2026-07-08: `scripts/probe-codex-source-activity-context.cjs` 已修复为 frame-aware source 探针：
  - 旧脚本在 code-server 顶层 page 执行，`reference/source-activity-context/20260708-015955/summary.json` 中 `contextFound=false`、`scroll.height=1080`，不能作为官方 webview 证据。
  - 新脚本枚举 CDP frame tree，在 isolated world 中选择 `extensionId=openai.chatgpt` 且 `purpose=webviewView` 的官方 Codex/ChatGPT webview frame。
  - 验证：`reference/source-activity-context/20260708-020609/summary.json` 中 `contextFound=true`，`scroll.top=-37144`，`scroll.height=130963`，`activityCards` 明确显示官方 source 同一上下文为：
    - `已创建 1 个文件`，`app.js +552 -0`
    - `已编辑 2 个文件`，`styles.css +644 -0`、`index.html +2 -2`
  - 结论：`seq=7494/7495` 在官方 source 也是合并显示为 `已编辑 2 个文件`；之前把 `styles.css` 误当成独立 `已编辑 1 个文件` 的 target-visual-missing 是验收脚本假失败，不是产品分组差异。
- 2026-07-08: `scripts/audit-codex-live-anchor-alignment.cjs` 已继续收紧自动 activity discovery，避免 `seq=7494` 类假失败：
  - 自动发现阶段的 `kind=activity` 候选现在必须带 source 结构化文件证据：至少有 file token 和 `+/-` stats；没有 stats 的 `已编辑 1 个文件` 不再进入结构化 file_change 验收。
  - `structuredActivityRecordMatch` 也要求 source activity 带 stats，避免只靠高重复文件名如 `styles.css` 命中错误 `file_change` record。
  - source discovery 侧同步过滤 `li.action-item.icon` 等 CSS selector-like token。
  - source 滚动窗口采样从固定 180ms 改为等待可见文本稳定，减少虚拟列表未填充文本时的假采样。
  - activity 生成已收紧为只接受 header 自身就是 `已编辑/已创建/已删除 N 个文件` 的节点，不再允许内部文件行或整轮 assistant body 反推出 activity label。
  - 复跑：`reference/live-anchor-alignment/20260708-021508/summary.json` 为 14 checks, 0 failed，且之前的 `已编辑 1 个文件/styles.css -> seq=7494 target-visual-missing` 不再出现。
  - focused discovery `reference/live-anchor-alignment/20260708-022225/summary.json` 和 8-window plan-only `reference/live-anchor-alignment/20260708-022411/summary.json` 均为 0 failed。
  - 限制：`022411` accepted 的仍是 3 个 user 锚点，不能证明 file/diff 规则完成；部分 activity candidate 仍来自宽容器，虽已被过滤，但 activity 自动采样还需要继续精确到官方文件卡片容器。因此 R44-F2/R44-F3 继续 open。
- 2026-07-08: source activity discovery 已能产出结构化可用候选，但 target 共同锚点选择仍未完成：
  - `scripts/audit-codex-live-anchor-alignment.cjs` 新增 `DISCOVERY_ONLY=1`，可只跑 source discovery 并写 report，避免为了看 source 候选而误进入长时间 target plan。
  - source discovery 不再按 `getBoundingClientRect` 强制过滤 viewport 内 turn；code-server reverse virtual scroll 中 rect 可能大幅偏离真实可用 DOM，改为采样当前 loaded visible turns。
  - source discovery 会在采样前尝试展开 loaded turn 内的官方 `已处理/Processed` summary，记录 `expandedProcessed`。
  - activity container 评分改为优先选择带文件 stats、activity header 少、文本更短的卡片容器，并把 `fileTokens` 优先收敛到 stats 里的文件名，减少 assistant body 文本污染。
  - `reference/live-anchor-alignment/20260708-024823/summary.json` 的 24-window discovery-only 已发现 usable activity：
    - `已创建 1 个文件` / `cdp-full-capture.mjs +242 -0`
    - `已编辑 1 个文件` / `styles.css +2 -2`
  - activity-only plan `reference/live-anchor-alignment/20260708-025012/summary.json` 仍为 1 failed：两个 source activity 都被 target API 拒绝为 `target-api-ambiguous`，原因是 target 当前 session 中没有同一 file_change record 命中这些 source 文件 token。
  - 已实现 target-aware activity selection：target API 拉取完成后，会从全部 source usable activity candidates 中优先挑选 target 也能结构化命中的 file_change 锚点，并写入 `targetAwareActivitySelection`。
  - 复跑 `reference/live-anchor-alignment/20260708-025632/summary.json`：`targetAwareActivitySelection.selectedCount=0`，activity-only plan 仍为 1 failed，失败原因仍是没有共同 target file_change 锚点，而不是 UI 视觉差异。
  - 结论：source activity 识别已经从“全过滤/宽容器”推进到“可产生结构化候选”，target-aware 过滤也已接入；下一步需要扩大或调整共同锚点搜索策略，让 discovery 找到 source/target 都存在的 file_change，而不是 source-only 文件变更。
- 2026-07-08: 产品修复 `b4f26a0` 已上线，修复同一 turn 内 file_change 被拆成多个单文件卡片的问题：
  - 真实差异证据：`reference/same-anchor-evidence/20260708-031414/` 中，source 官方在 `backend/internal/server/app.go` 锚点显示 `已编辑 7 个文件`，target 旧版显示多个 `已编辑 1 个文件` 卡片。
  - 修复内容：`frontend/src/pages/codex/renderer.js` 的 file_change 分组不再要求 seq 连续；同一 turn 且同一动作的 file_change 会合并，并按路径去重累计增删统计。
  - 部署证据：线上 `/root/code/codex-web` 已同步到 `b4f26a0`，`codex-web.service` 为 active，线上 bundle version 为 `20260708031831`，包含 `turnIDForFileChange` 与 `mergeFileChangeFiles`。
  - 复核证据：`reference/same-anchor-evidence/20260708-031842/target-anchor-1-current.png` 中 target 已显示 `已编辑 7 个文件`、`+7 -278`、前三个文件行和 `再显示 4 个文件`，与 source 同锚点大结构一致。
  - 回归探针：`reference/live-anchor-alignment/20260708-032010/summary.json` target-only 长会话滚动/processed 点击探针为 11 checks, 0 failed。该探针只证明覆盖窗口内交互未破坏，不能关闭完整长会话滚动验收。
  - 新发现的产品差异：同一 source 截图中 `已编辑 7 个文件` 上方存在 `网页预览 / 网站` 资源卡，target 仍缺失；这是独立渲染能力缺口，保持 open。

## 下一步

1. 追踪 `网页预览 / 网站` 资源卡缺失：从 target API/source DOM 找到对应事件类型，补齐官方资源卡渲染。
2. 改进共同锚点搜索策略：当 target-aware activity selection 为 0 时，继续扩大 source discovery 或根据 target file_change token 反向寻找 source DOM 锚点，直到找到 source/target 共同存在的 file_change。
3. 用 target-aware 结构化 activity 锚点重跑更大范围非 plan-only 审计，确认 file/diff 卡片的 source/target DOM、样式、collapsed/expanded 和 hit-test。
4. 对 grouped file_change 场景继续扩大验证范围：不能用 `seq=6743` 单个锚点替代所有 grouped file_change 规则。
5. 对失败锚点区分“产品 UI 差异”和“验收脚本假阳性”，只把强证据进入修复队列。
6. 对每个确认的 processed/file/diff 结构差异同时验证 collapsed、expanded 和 hit-test。
7. 倒序推进完整长会话，不用单个锚点替代整体验收。
