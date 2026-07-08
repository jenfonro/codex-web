# Codex Web 官方会话对齐工作清单

Created: 2026-07-08
Reset: 39
Status: active

## Reset 39 重建原因

Reset 38 仍然把“证据采集方法可用”“局部同锚点截图可生成”“某个问题已有候选修复”写得过像完成结论，导致假阳性风险仍然存在。用户已经明确指出：没有达到最终验收标准的工作必须整理移出，active 工作文件必须重建。

本次重建后的默认结论只有一个：**官方长会话显示对齐尚未通过**。

已移出的未验收材料：

- Reset 38 active 工作文件：`reference/legacy/20260708-reset38-unaccepted-active-archive/codex-live-parity-worklist.reset38.md`
- Reset 38 same-anchor 采集证据：`reference/legacy/20260708-reset38-unaccepted-active-archive/same-anchor-evidence/`
- Reset 37 及更早的 false-positive / unaccepted 材料继续只作为历史排查参考，不能作为完成依据。

## 固定目标

让 Codex Web 的会话显示严格对齐官方 code-server 中 Codex/ChatGPT 扩展的同一长会话。

固定参考：

- 官方参考页：`https://code-tx.zelt.cn/?folder=/root`
- 目标页：`https://codex.zelt.cn/?nodeId=host-docker-agent`
- 目标会话：`019f0a04-7f0b-7483-8bc4-18f214a5c8f1`
- 视口：`1920x1080` 或更大，优先 1080p 全屏
- 官方页状态：Codex/ChatGPT 扩展必须在左侧 Activity Bar；右侧聊天侧边栏必须关闭
- 验收方向：从最新消息开始，按相同文本锚点向上倒序，覆盖整个长会话

## 硬边界

每个任务开始前、修改代码前、标记完成前，都必须核对：

- 不能自己造一套“差不多”的结构、样式、分组或交互。
- 不能把官方结构化文件、diff、processed、thinking、running 块渲染成普通文本。
- 不能在 parity path 中保留 Codex Web 自己额外增强的命令汇总、命令次数统计或说明文本。
- 不能用裁剪、隐藏、跳过事件、减少历史内容解决长会话白屏、卡顿、闪烁或滚动异常。
- 不能用页面级遮罩、拖动层、pointer-events hack、hit-test 绕过点击问题。
- 不能只看源码、DOM、computed style、单页截图、单边页面或脚本 pass/fail 就标记完成。
- 不能因为 build、service active、agent online、console 0 error、currentness 通过就标记 UI 完成。
- 用户在线上仍可复现的问题必须保持 open，并先写入本文件，再修。

## 有效验收门槛

任何 UI 对齐任务从 open 改成 done 前，必须同时满足：

- local HEAD、origin HEAD、server HEAD 一致。
- 线上已 pull/build/restart，浏览器实际加载到最新 JS/CSS 版本。
- `codex-web.service` active，目标 agent 在线。
- 同一次 Playwright/CDP 运行同时打开官方页和目标页。
- 官方页和目标页 viewport 都是 `1920x1080` 或更大。
- 官方页 Codex/ChatGPT 扩展在左侧 Activity Bar，右侧聊天侧边栏关闭。
- 目标 nodeId 和 sessionId 正确。
- 每个锚点必须证明 source/target 是同一语义位置，不是重复消息误匹配。
- 每个锚点必须有 source collapsed、target collapsed；如果该区域可展开，还必须有 source expanded、target expanded。
- 必须记录真实滚动、点击、展开、收缩；hit-test 必须证明点击落在正确控件上。
- 必须对比 DOM 层级、class、row order、grouping、disclosure state。
- 必须对比 computed style：字体、行高、间距、颜色、border、radius、icon、button、overflow、hit target。
- 长会话多屏向上滚动不得闪烁、跳回、卡住、白屏、被遮罩拦截。
- 必须覆盖整个长会话倒序验收；发现任何差异都要新增 open 任务，不能跳过。

## 无效证据

以下内容只能作为排查线索，不能关闭 UI 任务：

- capture validity、surface validity、frame tree、scroll chunk 覆盖率。
- currentness、build、service active、agent online、console 0 error。
- 单个锚点截图看起来接近。
- 只对比官方或只对比目标。
- 只跑代码检查或测试，不做真实浏览器同锚点验收。
- 审计脚本只输出 pass/fail，没有可人工复核的每个锚点证据。

## 当前 Open 问题

- 长会话进入后仍需要验证是否会加载慢、白屏、崩溃、闪烁、跳回或滚动异常。
- 线上曾出现整页被拖出一块画面的行为；必须确认没有页面级拖动层、遮罩或错误 spacer 残留。
- `已处理 XXs` 必须能真实点击展开和收缩，展开后的内容必须按官方同锚点样式和分组对齐。
- processed / thinking / running / duration 的分组规则、位置、顺序、折叠内容仍未完整验收。
- 文件/diff 活动存在被普通文本铺开的风险，必须改成官方结构化文件块显示。
- parity path 中的额外命令增强、命令次数汇总、`exec_command xN` 等必须先移除或隔离。
- 当前有一个 agent duration 候选修复：`41628ms` 应显示 `已处理 41s`，不是 `42s`；该修复已本地实现但未完成线上同锚点验收，不能标 done。
- 同锚点采集脚本仍有风险：如果页面初始 `已处理 XXs` 已经是展开态，脚本的 `collapsed` / `expanded` 截图命名可能反向。必须按真实 `aria-expanded` 强制收起、截图、再展开、截图，不能只“点一下”。
- 旧 renderer、virtualizer、scroll restore、disclosure、code-server 兼容命名和补丁式代码需要重新审计，保留项必须能被最终同锚点验收覆盖。

## Active Tasks

### R39-A0. 移出 Reset 38 未验收工作材料并重建 active 文件

Status: done-admin

Scope:

- 归档 Reset 38 active 工作文件。
- 归档 Reset 38 same-anchor evidence。
- 重建 Reset 39 active 工作文件。
- 明确所有 UI 对齐任务仍为 open，候选修复不得继承为通过状态。

Evidence:

- `reference/legacy/20260708-reset38-unaccepted-active-archive/`

### R39-A1. 建立当前性前置检查

Status: done-preflight

Scope:

- 确认 local HEAD、origin HEAD、server HEAD 一致。
- 确认线上 pull/build/restart 完成。
- 确认浏览器加载最新 JS/CSS 版本。
- 确认 `codex-web.service` active，目标 agent 在线。

Acceptance:

- 只作为 UI 验收前置，不关闭任何 UI 对齐任务。

Evidence:

- Local/origin/server HEAD were aligned at deployed product commit `a07493c` for the duration validation.
- Server `codex-web.service` was active after restart.
- Docker `codex-web-agent` was online and `/api/nodes` returned `host-docker-agent` with `online: true`.

### R39-A2. 修复并验收长会话滚动、点击、展开/收缩

Status: open

Scope:

- 复现并定位长会话滚动异常、闪烁、跳回、白屏、崩溃。
- 确认没有页面级拖动层、遮罩、错误 spacer 或隐藏元素拦截点击。
- 验证 `已处理 XXs` 的真实点击展开和收缩。

Acceptance:

- 同锚点 source/target 滚动、点击、展开/收缩行为一致。
- hit-test 证明点击落在正确 disclosure 控件。
- 多屏倒序滚动稳定，不出现线上已报告异常。

### R39-A3. 对齐 processed / thinking / running 分组规则

Status: open

Scope:

- 从官方扩展源码和官方页面 DOM 同时确认分组规则。
- 对齐 collapsed / expanded 的 row order、缩进、图标、间距、文本和状态。
- 对齐完成态、运行态、思考态、duration row 的位置和显示。

Acceptance:

- 多个同锚点 collapsed / expanded 截图、DOM、computed style 与官方一致。
- 不能出现本项目自定义说明替代官方结构。

### R39-A4. 验证 agent duration 候选修复

Status: done-verified-specific

Scope:

- 本地候选修复在 `agent/internal/session/history.go`：duration 毫秒转秒改为向下取整，低于 1s 仍显示 1s。
- 覆盖测试在 `agent/internal/session/history_test.go`。

Required Validation:

- 部署到线上后，用同锚点 `已提交并推送到 origin/main` 对比。
- 官方和目标都必须显示 `已处理 41s`。
- 需要 source/target collapsed 和 expanded 证据。

Validation Result:

- Evidence directory: `reference/same-anchor-evidence/20260707-171506/`
- Source and target were captured in the same CDP run at `1920x1080`.
- Source states: `initial=true`, `collapsed=false`, `expanded=true`.
- Target states: `initial=true`, `collapsed=false`, `expanded=true`.
- Source/target collapse and expand clicks all returned OK.
- Target collapsed and expanded screenshots both show `已处理 41s`; target no longer shows `已处理 42s`.
- This closes only the duration rounding mismatch. It does not close R39-A2, R39-A3, R39-A5, R39-A6, or R39-A8.

Current Local Checks:

- `go test ./internal/session` 已通过。
- `go test ./...` 已通过。
- `node --check scripts/capture-codex-same-anchor-evidence.cjs` 已通过。
- `git diff --check` 已通过。
- `./build-all.sh` 已通过。

### R39-A5. 对齐文件 / diff 活动块

Status: open

Scope:

- 找到官方文件/diff 活动块的 DOM、class、computed style 和折叠规则。
- 目标页不得把文件、代码或 diff 作为普通文本连续铺开。
- 暂不实现右侧 diff 查看器，除非当前会话可见显示必须依赖它。

Acceptance:

- 同锚点文件/diff 区域 source/target 的块结构、图标、文本、间距、折叠状态一致。

### R39-A6. 移除 parity path 中的额外命令增强

Status: open

Scope:

- 移除或隔离命令汇总、命令次数、`exec_command xN`、运行结果摘要等非官方显示。
- 后续如要做增强，必须在官方 parity 通过后以独立开关实现。

Acceptance:

- parity path 的同锚点截图不再因为额外增强产生结构差异。

### R39-A7. 审计并清理补丁式代码和旧命名

Status: open

Scope:

- 审计 renderer、virtualizer、scroll restore、disclosure。
- 审计旧 code-server 兼容命名、shell 命名、临时脚本和补丁式样式。
- 保留的代码必须职责清楚，能被最终同锚点验收覆盖。

Acceptance:

- 记录保留/删除原因。
- 语法检查、测试、构建通过。
- 不以清理名义改变已经对齐的视觉效果。

### R39-A8. 完整长会话倒序验收

Status: open

Scope:

- 从最新消息开始向上滚完整个目标长会话。
- 每屏选择相同文本锚点定位 source/target。
- 所有可展开区域都要展开后对比。
- 发现差异立即新增 open 任务。

Acceptance:

- 整个长会话没有未解释、未修复、未记录的显示差异。
- 用户在线上可复现的问题全部关闭，或明确保持 open。

### R39-A9. 修复 same-anchor 采集脚本的展开态命名风险

Status: done-tool

Scope:

- 读取 disclosure 的真实 `aria-expanded` / DOM 状态。
- 如果需要 collapsed 截图，先强制收起后截图。
- 如果需要 expanded 截图，再强制展开后截图。
- 输出里记录状态变化和 click hit-test，不再把“点一下后截图”命名为 expanded。

Acceptance:

- 同一个锚点的 source/target evidence 中，collapsed 截图确实是收起态，expanded 截图确实是展开态。
- summary 明确记录 initial/collapsed/expanded 状态。
- 该任务只修取证工具，不关闭任何 UI 对齐任务。

Validation:

- `node --check scripts/capture-codex-same-anchor-evidence.cjs` passed.
- `git diff --check` passed.
- Same-anchor run `reference/same-anchor-evidence/20260707-171506/` recorded deterministic states:
  - source: `initial=true`, `collapsed=false`, `expanded=true`
  - target: `initial=true`, `collapsed=false`, `expanded=true`
- The script now uses initial anchor discovery for `found`, and separately records collapsed/expanded disclosure state.

## Running Notes

- 2026-07-08: Reset 39 建立。Reset 38 active 文件和 same-anchor evidence 已归档到 `reference/legacy/20260708-reset38-unaccepted-active-archive/`。所有 UI 对齐任务重新保持 open。
- 2026-07-08: 记录 duration 候选修复为 `implemented-unverified`，不得在未完成线上同锚点验收前标记为 done。
- 2026-07-08: 重新验证本地候选修复和工具：`go test ./...` in `agent/` 通过，`node --check scripts/capture-codex-same-anchor-evidence.cjs` 通过，`git diff --check` 通过，`./build-all.sh` 通过并生成 `build/codex-web.exe`、`build/codex-agent.exe`。这些只证明本地可构建，不关闭任何 UI 对齐任务。
- 2026-07-08: 已部署 `a07493c` 到线上，`codex-web.service` active，`codex-web-agent` online。同锚点 `已提交并推送到 origin/main` 证据显示 target 已从 `已处理 42s` 变为 `已处理 41s`，hit-test 文本也是 `已处理 41s`。但该轮 evidence 发现 `collapsed` / `expanded` 截图命名可能因初始展开态而反向，纳入 R39-A9 修复；R39-A4 仍需用修复后的脚本重跑后才能改为 done。
- 2026-07-08: R39-A9 工具修复完成并重跑 `reference/same-anchor-evidence/20260707-171506/`。该轮 source/target 均为 `initial=true`、`collapsed=false`、`expanded=true`，点击均 OK。R39-A4 duration mismatch 标记为 `done-verified-specific`，但完整长会话、分组规则、文件/diff 活动块和额外命令增强仍保持 open。
