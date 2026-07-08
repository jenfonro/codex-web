# Codex Web 官方会话对齐工作清单

Created: 2026-07-08
Reset: 40
Status: active

## Reset 40 重建原因

之前的工作文件和证据里出现过假阳性：有些任务只是完成了本地修复、脚本采集、局部截图或服务上线检查，却被写得像已经满足最终验收。用户已经明确指出：没有按同一长会话、同一文本锚点、同一浏览器运行完成对比的内容，不能算完成。

本次重建后的默认结论只有一个：**官方长会话显示对齐尚未通过最终验收**。

已移出 active 依据的材料：

- Reset 39 工作文件：`reference/legacy/20260708-reset39-false-positive-active-archive/codex-live-parity-worklist.reset39.md`
- Reset 39 同锚点证据：`reference/legacy/20260708-reset39-false-positive-active-archive/same-anchor-evidence/`
- 更早的 reset、截图、审计报告、脚本 pass/fail 结果：只允许作为历史排查线索，不能作为关闭 UI 任务的依据。

## 固定目标

让 Codex Web 的会话显示严格对齐官方 code-server 中 Codex/ChatGPT 扩展的同一个长会话。

固定参考：

- 官方参考页：`https://code-tx.zelt.cn/?folder=/root`
- 目标页：`https://codex.zelt.cn/?nodeId=host-docker-agent`
- 目标会话：`019f0a04-7f0b-7483-8bc4-18f214a5c8f1`
- 视口：`1920x1080` 或更大，优先 1080p 全屏
- 官方页状态：Codex/ChatGPT 扩展必须在左侧 Activity Bar；右侧聊天侧边栏必须关闭
- 验收方向：从最新消息开始，按相同文本锚点向上倒序覆盖整个长会话

## 硬边界

每次开始任务、修改代码、标记状态前，都必须核对这些边界：

- 不能自己造一套“差不多”的结构、样式、分组、收缩或交互。
- 不能把官方结构化的文件、diff、processed、thinking、running 块渲染成普通文本。
- parity path 中不能保留本项目额外增强的命令汇总、命令次数、运行摘要、说明文本或 `exec_command xN`。
- 不能通过裁剪、跳过事件、减少历史内容、隐藏内容来解决长会话白屏、卡顿、闪烁或滚动异常。
- 不能用页面级遮罩、拖动层、pointer-events hack、hit-test 绕过来掩盖点击问题。
- 不能只看源码、DOM、computed style、单页截图、单边页面或脚本 pass/fail 就标记完成。
- build 通过、service active、agent online、console 0 error、版本一致，只能作为前置检查，不能关闭 UI 任务。
- 用户在线上仍可复现的问题必须保持 open，并先写入本文件，再修。

## 有效验收门槛

任何 UI 对齐任务从 open 改为 accepted 前，必须同时满足：

- local HEAD、origin HEAD、server HEAD 一致。
- 线上已 pull/build/restart，浏览器实际加载到最新 JS/CSS 版本。
- `codex-web.service` active，目标 agent 在线。
- 同一次 Playwright/CDP 运行同时打开官方页和目标页。
- source/target viewport 都是 `1920x1080` 或更大。
- source 官方 Codex/ChatGPT 扩展在左侧 Activity Bar，右侧聊天侧边栏关闭。
- target nodeId 和 sessionId 正确。
- 每个锚点证明 source/target 是同一语义位置，不是重复消息误匹配。
- 每个锚点必须包含 collapsed 对比；如果该区域可展开，还必须包含 expanded 对比。
- 必须记录真实滚动、点击、展开、收缩；hit-test 必须证明点击落在正确控件上。
- 必须对比 DOM 层级、class、row order、grouping、disclosure state。
- 必须对比 computed style：字体、行高、间距、颜色、border、radius、icon、button、overflow、hit target。
- 长会话多屏向上滚动不得闪烁、跳回、卡住、白屏、被遮罩拦截。
- 必须覆盖整个长会话倒序验收；发现任何差异都新增 open 任务，不能跳过。

## 新问题处理规则

用户在我工作期间指出的新问题，必须按这个顺序处理：

1. 先写入本文件的 `New Findings` 或对应任务。
2. 如果当前正在修的点未验证完成，先完成当前点的最小验证。
3. 立即回到用户指出的问题，复现并定位。
4. 修复后部署到线上，保证用户访问的是最新版本。
5. 用同锚点 source/target 证据验证；没有证据就不能标 accepted。

## 状态词

只允许使用这些状态，避免把中间结果写成完成：

- `open`：尚未修复或尚未验证。
- `in-progress`：正在定位或修复。
- `candidate-local`：本地已有候选修复，但未上线或未同锚点验证。
- `candidate-live`：已上线，但未完成同锚点 source/target 验证。
- `verified-specific`：只证明某个具体锚点或具体 bug 已修复，不能代表整体通过。
- `accepted`：满足“有效验收门槛”，并且没有用户在线上可复现的残留问题。

## 当前 Open 问题

- 长会话进入后仍需验证是否会加载慢、白屏、崩溃、闪烁、跳回或滚动异常。
- 线上曾出现整页被拖出一块画面的行为；必须确认没有页面级拖动层、遮罩或错误 spacer 残留。
- `已处理 XXs` 必须能真实点击展开和收缩，展开后的内容必须按官方同锚点样式和分组对齐。
- processed / thinking / running / duration 的分组规则、位置、顺序、折叠内容尚未完成整会话验收。
- 文件/diff 活动存在被普通文本铺开的风险，必须改成官方结构化文件块显示。
- parity path 中的额外命令增强、命令次数汇总、`exec_command xN` 等必须先移除或隔离。
- 旧 renderer、virtualizer、scroll restore、disclosure 和 code-server 兼容命名需要重新审计，删除补丁式或误导性实现。
- 同锚点采集脚本本身曾出现过假阳性风险，必须先审计采集逻辑，再信任它的输出。

## Active Tasks

### R40-A0. 重建 active 工作文件并移出 Reset 39 材料

Status: verified-specific

Scope:

- 将 Reset 39 active 文件移入 legacy。
- 将 Reset 39 same-anchor evidence 移出 active 证据区。
- 重建 Reset 40 active 文件。
- 明确旧材料不能作为 UI 完成依据。

Acceptance:

- `reference/codex-live-parity-worklist.md` 只包含 Reset 40 规则和 open 任务。
- Reset 39 材料只在 legacy 中保留。
- 不把任何 UI 对齐任务标为 accepted。

Evidence:

- `reference/codex-live-parity-worklist.md` 已重建为 Reset 40。
- `reference/legacy/20260708-reset39-false-positive-active-archive/codex-live-parity-worklist.reset39.md` 已保留旧 Reset 39 工作文件。
- `reference/legacy/20260708-reset39-false-positive-active-archive/same-anchor-evidence/` 已保留旧 Reset 39 证据。
- `reference/same-anchor-evidence/` 已清空为后续 Reset 40 重新采集使用。
- Git 只显示 active 工作文件变更和归档 Markdown；旧截图证据不进入待提交列表。

### R40-A1. 审计同锚点采集工具，避免继续产生假阳性

Status: verified-specific

Scope:

- 检查 `scripts/capture-codex-same-anchor-evidence.cjs` 的锚点匹配、滚动、点击、展开、收缩、截图命名和 summary 输出。
- 明确失败、未找到、歧义匹配、source/target 未同屏语义定位时的输出状态。
- 工具输出必须能让人工复核，不允许只给 pass/fail。

Acceptance:

- 工具能稳定记录 initial/collapsed/expanded 状态。
- 工具能记录 hit-test 目标。
- 工具不能把初始展开态截图误命名为 collapsed 或 expanded。
- 工具不能因为 API 找到事件就认为 DOM 已找到锚点。

Findings:

- `captureAnchorSide` 曾在 disclosure 状态未知时用 anchor 是否可见推断 expanded 状态，这会制造假阳性。
- 强制收起失败时仍会写出 `*-collapsed.png`，文件名会误导人工复核。
- `matchTargetAPIAnchor` 曾在多条 API 候选同时命中时选择第一条，没有明确标记 ambiguous。
- `clickControl` 曾只要坐标存在就返回 OK，没有把控件中心 hit-test 未命中视为点击失败。
- Shadow DOM 内控件曾使用 top-level `document.elementFromPoint` 做 hit-test，导致 target 命中 shadow host 而不是内部 disclosure 控件，产生 false negative。
- DOM 锚点匹配曾把同一语义 turn 的父容器和子内容块分别计为多个候选，导致 ancestor/descendant duplicate 被误报为 ambiguous。
- 展开/收起后的状态读取曾优先使用全局 `findDisclosureControl`，在同文本 disclosure 存在时可能抓到错误控件；必须优先使用当前同锚点窗口内的 disclosure。
- target API 匹配只是 focus helper；如果 source/target DOM 已经定位且状态验证通过，API 命中 summary/assistant_message 的重复项不应把证据降级为 unusable。
- anchor 状态截图前曾调用会发送 Escape 的 `neutralizePage()`；官方扩展可能把 Escape 视为收起/关闭操作，导致截图过程改变 expanded/collapsed 状态。

Fix:

- disclosure 状态不再从 anchor 可见性推断；未知就是 unknown。
- 截图文件名按真实状态写入：`collapsed`、`still-expanded`、`collapse-unverified`、`expanded`、`still-collapsed`、`expand-unverified`。
- DOM 和 API 匹配都会记录 `candidateCount`、`eligibleCandidateCount`、`ambiguous` 和候选摘要。
- API 匹配 ambiguous 时不再自动 focus 到第一条候选。
- click 前使用控件自身 hit-test；中心点未命中控件时点击记录为失败。
- Shadow DOM 内 hit-test 必须使用控件所属 root 的 `elementFromPoint`，不能只用 top-level document。
- DOM ambiguity 必须按语义组判断；父子嵌套的同一 turn 候选要合并，只有不同语义组才算 ambiguous。
- disclosure 状态读取必须以当前 matched window 内控件为准，全局查找只能作为 fallback。
- API ambiguous 记录为 warning；只有在 DOM 侧未定位或未验证时，API ambiguity 才能作为 evidence problem。
- anchor 状态截图必须保留当前交互状态，不能在截图前发送 Escape；只允许移动鼠标离开目标区域。
- summary 增加 `evidenceUsable` 和 `evidenceProblems`，证据不可用时脚本返回非零。

Validation:

- `node --check scripts/capture-codex-same-anchor-evidence.cjs` 通过。
- `git diff --check` 通过，仅有 Windows LF/CRLF 提示。
- Reset 40 单锚点无截图验证：`reference/same-anchor-evidence/20260707-174428/`。该锚点被标为 `evidenceUsable=false`，原因包含 source/target DOM ambiguous 和 target collapsed 未验证。
- Reset 40 单锚点带截图验证：`reference/same-anchor-evidence/20260707-174510/`。该轮证明截图命名不会误写成通过态，但同时暴露了 Shadow DOM hit-test false negative；该轮不能作为最终验证。
- Shadow DOM hit-test 修复后重跑：`reference/same-anchor-evidence/20260707-174811/`。target collapse/expand 均通过 hit-test 与状态验证，截图为 `target-anchor-1-collapsed.png` 和 `target-anchor-1-expanded.png`。该轮同时暴露 DOM ambiguous 由父子嵌套候选造成，需去重后再确认。
- DOM 语义去重和同窗口 disclosure 优先级修复后重跑：`reference/same-anchor-evidence/20260707-175236/`。该锚点 `evidenceUsable=true`，source/target 均 non-ambiguous，collapsed/expanded 状态均 verified，截图分别为 source/target 的 `collapsed.png` 和 `expanded.png`。
- 截图保真修复后两锚点带截图重跑：`reference/same-anchor-evidence/20260707-180504/`。`已提交并推送到 origin/main` 与 `./build-all.sh` 均 `evidenceUsable=true`，source/target collapsed/expanded 均 verified，截图文件均为正确状态名。
- 本任务只验证取证工具不会继续给该锚点假阳性；不代表任何 UI 对齐任务通过。

### R40-A2. 复现并修复长会话滚动、点击、展开/收缩稳定性

Status: in-progress

Scope:

- 在线上目标会话复现长会话滚动异常、闪烁、跳回、白屏、崩溃。
- 确认没有页面级拖动层、遮罩、错误 spacer 或隐藏元素拦截点击。
- 验证 `已处理 XXs` 的真实点击展开和收缩。

Acceptance:

- source/target 同锚点滚动、点击、展开/收缩行为一致。
- hit-test 证明点击落在正确 disclosure 控件。
- 多屏倒序滚动稳定，不出现用户已报告的异常。

Current Entry Point:

- R40-A1 带截图验证目录 `reference/same-anchor-evidence/20260707-174510/` 显示 target `已处理` 收起点击未通过 hit-test，目标收起截图为 `target-anchor-1-still-expanded.png`。
- 初查显示该 hit-test 命中了 `.codex-panel-frame` shadow host，优先判定为取证工具的 Shadow DOM hit-test false negative。R40-A2 暂不据此判断产品点击问题，需等 R40-A1 修复后重跑。
- R40-A1 修复后验证目录 `reference/same-anchor-evidence/20260707-174811/` 显示 target collapse/expand 状态已可被工具正确验证；该具体 hit-test 失败暂不作为产品问题。R40-A2 仍需用非歧义锚点继续验证长会话滚动和真实展开/收缩稳定性。
- R40-A1 最终工具验证目录 `reference/same-anchor-evidence/20260707-175236/` 已证明该锚点 source/target collapse/expand 可被工具稳定验证。该证据只覆盖一个锚点，R40-A2 仍需多屏倒序滚动和更多可展开区域验证。
- 多锚点无截图验证目录 `reference/same-anchor-evidence/20260707-175642/` 暴露：`./build-all.sh` 的 DOM 定位和 collapsed/expanded 验证可用，但 target API helper 因 assistant_message 与 summary 重复命中把证据标为 unusable；这应作为工具规则修正，不是 UI 差异。
- 同一轮显示文件路径类锚点如 `/root/codex-web-browser/fonts.conf`、`systemd/codex-agent.service` 不适合作为普通文本锚点：source/target DOM 难以定位，且 file path 搜索可导致 target `Runtime.evaluate` 90s 超时。后续文件/diff 必须走 R40-A5 专门验证，不混入普通 R40-A2 锚点。
- 两稳定锚点带截图验证目录 `reference/same-anchor-evidence/20260707-180321/` 暴露：截图前发送 Escape 会把 source expanded 状态变回 collapsed；这是取证工具改变被测状态的问题，先回到 R40-A1 修截图流程。
- 截图流程修复后两稳定锚点带截图验证目录 `reference/same-anchor-evidence/20260707-180504/` 显示两个锚点均 `evidenceUsable=true`，collapsed/expanded 状态均 verified。该结果只覆盖两个局部锚点，R40-A2 仍保持 in-progress。

### R40-A3. 提取官方 processed / thinking / running 分组规则

Status: open

Scope:

- 从官方扩展源码、官方页面 DOM 和同锚点截图同时确认规则。
- 明确 completed、running、thinking、duration row 的位置、顺序、折叠内容。
- 明确哪些事件应该合并，哪些事件应该独立显示。

Acceptance:

- 规则以代码和浏览器证据双重确认。
- 规则写回本文件或独立说明文件。
- 不再靠猜测或本项目自定义说明替代官方结构。

### R40-A4. 对齐 processed / thinking / running 视觉和交互

Status: open

Scope:

- 对齐 collapsed / expanded 的 row order、缩进、图标、间距、文本、状态。
- 对齐运行中、思考中、已处理、duration 的显示。
- 确保实时事件结束后状态能正确消失或变为完成态。

Acceptance:

- 多个同锚点 collapsed / expanded 截图、DOM、computed style 与官方一致。
- 用户退回列表再进入前后状态一致，不依赖刷新掩盖问题。

### R40-A5. 对齐文件 / diff 活动块

Status: open

Scope:

- 找到官方文件/diff 活动块的 DOM、class、computed style 和折叠规则。
- 目标页不得把文件、代码或 diff 当作普通文本连续铺开。
- 暂不实现右侧 diff 查看器，除非当前可见样式必须依赖它。

Acceptance:

- 同锚点文件/diff 区域 source/target 的块结构、图标、文本、间距、折叠状态一致。

### R40-A6. 移除 parity path 中的额外命令增强

Status: open

Scope:

- 移除或隔离命令汇总、命令次数、`exec_command xN`、运行结果摘要等非官方显示。
- 如后续要做增强，必须在官方 parity 通过后以独立开关实现。

Acceptance:

- parity path 的同锚点截图不再因为额外增强产生结构差异。

### R40-A7. 审计并清理补丁式代码和旧命名

Status: open

Scope:

- 审计 renderer、virtualizer、scroll restore、disclosure。
- 审计旧 code-server 兼容命名、shell 命名、临时脚本和补丁式样式。
- 保留代码必须职责清楚，并能被最终同锚点验收覆盖。

Acceptance:

- 记录保留/删除原因。
- 语法检查、测试、构建通过。
- 不以清理名义改变已经对齐的视觉效果。

### R40-A8. 完整长会话倒序验收

Status: open

Scope:

- 从最新消息开始向上滚完整个目标长会话。
- 每屏选择相同文本锚点定位 source/target。
- 所有可展开区域都要展开后对比。
- 发现差异立即新增 open 任务。

Acceptance:

- 整个长会话没有未解释、未修复、未记录的显示差异。
- 用户在线上可复现的问题全部关闭，或明确保持 open。

### R40-A9. 线上最新版本同步

Status: open

Scope:

- 每次候选修复后，推送到 GitHub。
- 服务器用 git pull/fetch 同步，不上传本地构建产物。
- 在服务器执行构建脚本并重启服务。
- 确认浏览器加载的是最新版本资源。

Acceptance:

- local HEAD、origin HEAD、server HEAD 一致。
- 线上 service 和 agent 正常。
- 用户可直接访问线上验证最新问题。

## New Findings

本段只记录 Reset 40 之后用户或浏览器验证中新发现的问题。新增问题必须先写到这里，再进入对应任务。

- 2026-07-08: R40-A1 工具验证锚点 `已提交并推送到 origin/main` 时，source/target DOM 都出现多候选 ambiguous；该锚点不能作为最终 UI 通过证据，后续 R40-A8 必须换用更稳定的文本锚点或增加更强语义定位。
- 2026-07-08: 同一验证中 target `已处理` 收起点击未通过 hit-test，进一步检查发现 hit-test 命中 `.codex-panel-frame` shadow host，属于工具未使用 ShadowRoot `elementFromPoint` 的 false negative；先回到 R40-A1 修工具，再判断是否存在真实 R40-A2 产品问题。
- 2026-07-08: 同一验证中 source 展开后仍被识别为 collapsed，说明官方页的可展开控件也可能需要更精确控件定位；该问题归入 R40-A1 后续工具精修或 R40-A8 锚点级验收，不得作为 UI 差异结论。
- 2026-07-08: Shadow DOM hit-test 修复后重跑同锚点，target collapse/expand 均验证通过；前一条 target 点击失败确认为工具 false negative，不作为产品 UI 缺陷。该锚点仍因多候选 ambiguous 不可用于最终验收。
- 2026-07-08: 同一轮的 source/target ambiguous 候选是同一 turn 的父子嵌套结构，属于取证工具候选去重不足；先回到 R40-A1 修 DOM 语义分组，不能把它当作真实重复消息差异。
- 2026-07-08: 语义去重后同锚点不再 ambiguous，但 source expanded 状态仍显示 collapsed；初查为全局 disclosure 查找覆盖了同锚点窗口内状态，继续修 R40-A1 状态读取优先级。
- 2026-07-08: 同窗口 disclosure 优先级修复后重跑同锚点，`evidenceUsable=true`，source/target collapsed/expanded 均 verified。R40-A1 工具层问题可关闭为 verified-specific。
- 2026-07-08: 多锚点无截图验证 `reference/same-anchor-evidence/20260707-175642/` 发现 `./build-all.sh` DOM 侧已可验证，但 API helper 的 summary/assistant_message 重复命中被当成 evidence problem；这是工具规则过严，需降级为 warning。
- 2026-07-08: 同一轮发现文件路径类锚点会找不到或超时，不能继续作为 R40-A2 普通锚点。文件/diff 对齐转入 R40-A5，R40-A2 使用可见文本锚点验证滚动和 disclosure。
- 2026-07-08: 两稳定锚点带截图验证发现截图前 Escape 会改变官方 source disclosure 状态，导致 expanded 截图变成 `still-collapsed`；这不是 UI 差异，先修 R40-A1 的截图保真。
- 2026-07-08: 截图保真修复后，`reference/same-anchor-evidence/20260707-180504/` 两个稳定锚点均 `evidenceUsable=true`。这证明局部滚动定位和 disclosure 点击链路可用，但不关闭完整 R40-A2。

## Running Notes

- 2026-07-08: Reset 40 建立。Reset 39 工作文件和 same-anchor evidence 已移出 active 依据。所有 UI 对齐任务重新保持 open；旧证据只作为历史排查线索。
- 2026-07-08: R40-A0 verified-specific，仅表示工作文件重建和旧材料归档已核对；不表示任何 UI 对齐任务通过。
- 2026-07-08: R40-A1 verified-specific。Shadow DOM hit-test、DOM 父子语义组去重、同窗口 disclosure 状态优先级、截图保真均已修复并重跑验证；采集工具现在会暴露 unusable evidence、DOM/API ambiguous、hit-test 失败和真实截图状态名。该结论只关闭取证工具的已发现假阳性/假阴性入口，不关闭 R40-A2 到 R40-A8。
