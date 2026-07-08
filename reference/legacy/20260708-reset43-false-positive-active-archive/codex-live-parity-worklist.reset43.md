# Codex Web 官方会话对齐工作清单

Created: 2026-07-08
Reset: 43
Status: active

## 当前结论

**Codex Web 长会话显示尚未通过官方 code-server Codex/ChatGPT 扩展对齐验收。**

Reset 43 是新的有效工作起点。Reset 42 以及更早的截图、summary、单边探针、局部 DOM 判断、构建结果、服务状态、脚本 pass/fail，都只能作为排查线索，不能作为 UI 对齐完成依据。

本次重建已经把 Reset 42 的 active 证据和工作文件整体移出 active 区域：

- `reference/live-anchor-alignment/` 已移到 `reference/legacy/20260708-reset42-unaccepted-active-archive/live-anchor-alignment/`。
- `reference/same-anchor-evidence/` 已移到 `reference/legacy/20260708-reset42-unaccepted-active-archive/same-anchor-evidence/`。
- Reset 42 工作文件已移到 `reference/legacy/20260708-reset42-unaccepted-active-archive/codex-live-parity-worklist.reset42.md`。
- 当前 active 工作文件只记录 Reset 43 的验收规则、任务、未验收候选和新发现。

## 固定验收目标

让 Codex Web 在同一条长会话中，对齐官方 code-server 中 Codex/ChatGPT 扩展的：

- 显示规则
- 分组规则
- 收缩/展开规则
- 运行态/完成态变化
- 文件、diff、代码改动块样式
- 主要间距、字体、颜色、图标、交互反馈

固定参考：

- 官方参考页：`https://code-tx.zelt.cn/?folder=/root`
- 目标页面：`https://codex.zelt.cn/?nodeId=host-docker-agent`
- 目标节点：`host-docker-agent`
- 目标长会话：`019f0a04-7f0b-7483-8bc4-18f214a5c8f1`
- 视口：`1920x1080` 或更大，优先 1080p 全屏
- 官方页状态：Codex/ChatGPT 扩展必须在左侧 Activity Bar，右侧聊天侧边栏必须关闭
- 验收方式：从最新消息开始，按相同语义锚点倒序向上覆盖完整长会话

## 硬边界

每次开始任务、改代码、提交、部署、标记状态前，都必须核对：

- 不能自己造一套“差不多”的 DOM、样式、分组、收缩或交互。
- 不能把官方结构化的 processed、thinking、running、文件、diff、代码改动块渲染成普通文本。
- parity path 不能保留本项目额外增强的命令汇总、命令次数、运行摘要、解释文案或 `exec_command xN`。
- 不能通过裁剪历史、跳过事件、隐藏内容、减少消息、截断长会话来解决白屏、崩溃、闪烁、卡顿或滚动异常。
- 不能用页面级遮罩、拖动层、pointer-events hack、错误 spacer 或 hit-test 绕过点击问题。
- 不能只看源码、DOM、computed style、单页截图、单边页面或脚本 pass/fail 就标记完成。
- build 通过、service active、agent online、console 0 error、版本一致，只能作为前置检查，不能关闭 UI 任务。
- 用户在线上仍可复现的问题必须保持 open；修复前必须先写入本文件。

## 有效验收门槛

任何 UI 对齐任务从 `open`、`in-progress`、`candidate-local` 或 `candidate-live` 变为 `accepted` 前，必须同时满足：

- local HEAD、origin HEAD、server HEAD 一致。
- 线上已 pull/build/restart，浏览器实际加载到最新 JS/CSS。
- `codex-web.service` active，目标 agent 在线。
- 同一轮 Playwright/CDP 同时打开 source 和 target。
- source/target viewport 都是 `1920x1080` 或更大。
- source 官方 Codex/ChatGPT 扩展在左侧 Activity Bar，右侧聊天侧边栏关闭。
- target nodeId 和 sessionId 正确。
- 每个锚点都证明 source/target 是同一语义位置，不是重复消息误匹配。
- 重复文本锚点默认不可验收；除非脚本能证明上下文、序号、邻近结构都唯一。
- 每个锚点都有 source/target 双边截图、DOM 摘要和关键 computed style 摘要。
- 可收缩区域必须同时验证 collapsed 和 expanded；hit-test 必须证明点击落在正确控件上。
- 长会话多屏倒序滚动不得闪烁、跳回、卡住、白屏、被遮罩拦截或无法点击。
- 必须覆盖整个目标长会话；发现任何差异都新增 open 任务，不能跳过。

## 状态词

- `open`：尚未修复或尚未验证。
- `in-progress`：正在定位、实现或验证。
- `candidate-local`：本地有候选修复，但未上线或未同锚点验证。
- `candidate-live`：已上线，但未完成 source/target 同锚点验证。
- `verified-specific`：只证明某个具体 bug、具体脚本或具体锚点已复现/修复，不代表整体通过。
- `accepted`：满足有效验收门槛，并且没有用户在线上可复现的残留问题。
- `closed-admin`：只用于文件整理、归档、工作清单重建等非 UI 工作，不能代表 UI 通过。

## 未验收本地候选

以下改动存在于本地工作区，但不能视为已完成，也不能直接提交为“对齐完成”：

- `frontend/src/pages/codex/renderer.js`
  - 候选方向：把 processed summary 的 detail rows 纳入 disclosure body，完成态默认收起，运行态才按 pending 展开。
  - 当前状态：未通过 source/target 同锚点验收，未部署，未接受。
- `frontend/src/pages/codex/virtualizer.js`
  - 候选方向：高度估算读取 disclosure state，收起态按较短高度估算。
  - 当前状态：未通过长会话完整倒序滚动验收，未部署，未接受。

处理规则：

- 这两个候选要么在 Reset 43 中经过完整验收后保留，要么回退/重写。
- 不能因为 `node --check`、构建通过、单边点击成功，就把它们当作有效 UI 修复。

## 新问题处理规则

用户在工作期间指出的新问题，必须按这个顺序处理：

1. 先写入 `New Findings` 或对应任务。
2. 如果当前点未验证完成，先做当前点的最小验证，避免又留下半截状态。
3. 立即回到用户指出的问题，复现并定位。
4. 修复后推送并部署线上，保证用户访问的是最新代码。
5. 用同锚点 source/target 证据验证；没有证据不能标为 `accepted`。

## Active Tasks

### R43-A0. 重建 active 工作文件并隔离 Reset 42 证据

Status: closed-admin

Scope:

- 将 Reset 42 active evidence 移入 legacy。
- 将 Reset 42 工作文件归档。
- 重建 `reference/codex-live-parity-worklist.md`。
- 明确没有任何 UI 对齐任务被接受。

Evidence:

- 2026-07-08: `reference/live-anchor-alignment/` 已移到 `reference/legacy/20260708-reset42-unaccepted-active-archive/live-anchor-alignment/`。
- 2026-07-08: `reference/same-anchor-evidence/` 已移到 `reference/legacy/20260708-reset42-unaccepted-active-archive/same-anchor-evidence/`。
- 2026-07-08: Reset 42 工作文件已移到 `reference/legacy/20260708-reset42-unaccepted-active-archive/codex-live-parity-worklist.reset42.md`。

### R43-A1. 重新确认线上/本地/远端基线

Status: verified-specific

Scope:

- 确认 local HEAD、origin HEAD、server HEAD 是否一致。
- 确认线上服务、agent、资源版本正常。
- 确认当前浏览器实际加载的是最新资源。

Acceptance:

- 只允许标记为 `verified-specific`。
- 不能关闭 UI 对齐任务。

Evidence:

- 2026-07-08: `git fetch origin main` 后，本地 HEAD 与 `origin/main` 均为 `e56bb5d358ea9a57295d9d009ac4bcd1a709ecef`。
- 2026-07-08: 服务器 `/root/code/codex-web` 位于 `main`，server HEAD 与 server `origin/main` 均为 `e56bb5d358ea9a57295d9d009ac4bcd1a709ecef`。
- 2026-07-08: `codex-web.service` 为 `active`。
- 2026-07-08: `GET https://codex.zelt.cn/?nodeId=host-docker-agent` 返回 200，HTML 资源版本为 `v=20260707182859`。
- 2026-07-08: `GET https://codex.zelt.cn/api/nodes` 返回 `host-docker-agent` 在线，`rootDir=/workspace`，`codexHome=/data/codex-home`，hostname 为 `VM-0-7-ubuntu`。
- 2026-07-08: 服务器 `frontend/dist/index.html` 与 `build/codex-web` 时间为 2026-07-08 02:28。
- 本任务只证明基线可用；不证明 UI 对齐、滚动、展开收缩或长会话验收通过。

### R43-A2. 审计未验收本地候选代码

Status: candidate-local

Scope:

- 审计 `renderer.js` 和 `virtualizer.js` 中未提交候选改动。
- 判断候选是否符合官方源码规则和 DOM 结构。
- 决定保留、重写或回退。

Acceptance:

- 每个候选都有保留/删除原因。
- 不使用补丁式遮罩、拖动层、pointer-events hack 或裁剪历史。
- 代码检查和构建通过。

Audit Notes:

- 2026-07-08: `renderer.js` 候选方向保留。原因：此前把 `detailRows` 渲染在 processed summary disclosure 外部，会让官方应随 `已处理 XXs` 收缩/展开的内容裸露，和官方 activity disclosure 规则不一致。
- 2026-07-08: `renderer.js` 候选已补充 `split.processEvents` 参与 grouped seq 与 pending 判断，避免运行态只存在于 process events 时错误默认收起。
- 2026-07-08: `virtualizer.js` 候选方向保留但已修正。原因：高度估算需要跟 processed summary disclosure 状态一致，否则完成态默认收起后仍按展开态估算，容易造成长会话滚动跳动。
- 2026-07-08: `virtualizer.js` 已改为用和 renderer 同源的 turn key fallback：`turn-activity:${turnKey || codex-turn-${index}}`，避免 disclosure state 与高度估算 key 不一致。
- 2026-07-08: `node --check frontend\src\pages\codex\renderer.js` 通过。
- 2026-07-08: `node --check frontend\src\pages\codex\virtualizer.js` 通过。
- 2026-07-08: `git diff --check` 通过，仅有 Windows LF/CRLF 提示。
- 2026-07-08: `frontend/build.sh` 通过。
- 2026-07-08: `build-all.sh` 通过，生成 `build/codex-web.exe` 与 `build/codex-agent.exe`。
- 2026-07-08: `go test ./...` 在 `backend` 通过。
- 2026-07-08: `go test ./...` 在 `agent` 通过。
- 当前仍未通过 source/target 同锚点验收，不能标记为 `accepted`。

### R43-A3. 重建可靠的同锚点取证策略

Status: candidate-local

Scope:

- 禁止把 `./build-all.sh` 这类重复文本当作默认验收锚点。
- 对每个锚点输出 source/target 候选数量、上下文、邻近结构、collapsed/expanded 状态。
- 对结构化 activity、文件、diff 锚点要求额外验证 DOM 类型和交互状态。

Acceptance:

- ambiguous anchor 必须明确失败，不能输出伪通过。
- evidence 只用于记录，不得直接写成任务 accepted。

Audit Notes:

- 2026-07-08: `scripts/capture-codex-same-anchor-evidence.cjs` 已将 target API 语义定位改为硬门槛：未检查、未找到、或 `eligibleCandidateCount !== 1` 都会让 `evidenceUsable=false`。
- 2026-07-08: `targetAPI.ambiguous` 不再降级为 warning；即使 source/target DOM 都找到，也会作为 evidence problem。
- 2026-07-08: 该改动专门堵住 `./build-all.sh` 这类重复文本锚点造成的假阳性入口。
- 2026-07-08: `node --check scripts\capture-codex-same-anchor-evidence.cjs` 通过。
- 2026-07-08: `git diff --check` 通过，仅有 Windows LF/CRLF 提示。
- 2026-07-08: 发现 `reference/same-anchor-evidence/20260707-193706/summary.md` 中 `./build-all.sh` 的 target API 已唯一定位到 `seq=7616`，但 target DOM 被错误报告为未找到；手动 CDP 探针 `reference/same-anchor-evidence/manual-7616-1783453473769/summary.json` 证明最新线上 DOM 实际包含该文本，原因为脚本未优先限定到 focus seq 所在 turn。
- 2026-07-08: `scripts/capture-codex-same-anchor-evidence.cjs` 已修正：target API 唯一命中时，DOM 定位优先限定在包含该 seq 的 turn；唯一 seq 已确认时不再强制套 source 上下文词；路径文本只有匹配到 activity/diff/file 结构节点时才强制验证 disclosure。
- 2026-07-08: 单锚点复测 `ANCHORS='./build-all.sh' node scripts\capture-codex-same-anchor-evidence.cjs` 生成 `reference/same-anchor-evidence/20260707-194817/summary.md`，该锚点被正确判定为普通文本锚点，但 source/target API 仍因多候选而不可验收。
- 当前仍未完成可验收 source/target 同锚点采集，不能标记为 `accepted`。

### R43-A4. 重新复现长会话滚动、点击、展开/收缩问题

Status: in-progress

Scope:

- 在线上目标长会话复现滚动异常、闪烁、跳回、白屏、崩溃、误拖动画面。
- 验证 `已处理 XXs` 等 disclosure 是否真实可点击展开/收缩。
- 验证点击不被遮罩、spacer 或错误层拦截。

Acceptance:

- source/target 同锚点验证 collapsed 和 expanded。
- 多屏倒序滚动稳定，无闪烁、跳回、白屏或误拖动画面。

Evidence:

- 2026-07-08: 线上 target-only 探针 `node scripts\audit-codex-live-target-interactions.cjs` 生成 `reference/live-anchor-alignment/20260707-185743/summary.json`。
- 2026-07-08: 该探针在 `1920x1080` 视口下返回 11 checks、0 failed、18 scroll steps、13 unique windows。
- 2026-07-08: 目标页 `已处理 41s` 与滚动后的 `已处理 1m 17s` disclosure 均可真实点击 `false -> true -> false`，hit-test 落在 disclosure 控件内。
- 2026-07-08: target-only 探针显示 browser console/page errors 为 0，未发现 Codex Web-only command transcript rows。
- 2026-07-08: 最新线上 `cbccb96` 后再次运行 `node scripts\audit-codex-live-target-interactions.cjs`，生成 `reference/live-anchor-alignment/20260707-194855/summary.json`；返回 11 checks、0 failed、18 scroll steps、13 unique windows。
- 该证据只证明目标页自身交互探针可用；没有 source/target 同锚点对比，不能关闭 R43-A4，也不能作为 UI 对齐验收。

### R43-A5. 提取并实现官方 processed / thinking / running 分组规则

Status: open

Scope:

- 从官方扩展源码、官方页面 DOM、同锚点截图三处确认规则。
- 明确 completed、running、thinking、duration row 的位置、顺序、折叠内容。
- 明确哪些事件合并，哪些事件独立显示。

Acceptance:

- 规则有源码和浏览器证据双重确认。
- 本项目渲染结果在同锚点截图、DOM、computed style 上与官方一致。

### R43-A6. 对齐文件 / diff / 代码改动活动块

Status: candidate-local

Scope:

- 找到官方文件/diff 活动块的 DOM、class、computed style 和折叠规则。
- 目标页不得把文件、代码或 diff 当作普通文本连续铺开。
- 第一阶段只做列表/块样式和折叠规则；右侧 diff 查看器暂不作为必须项。

Acceptance:

- 同锚点文件/diff 区域 source/target 的块结构、图标、文本、间距、折叠状态一致。

Candidate Notes:

- 2026-07-08: 从官方 `local-conversation-turn-BZInUTC2.js` 提取完成态 diff 资源卡规则：默认最多显示 3 个文件，超过后由独立的 `再显示 N 个文件` / `收起文件` 控件切换，不由卡片 header 把整个文件列表收起。
- 2026-07-08: 本地 `frontend/src/pages/codex/renderer.js` 已将 `FILE_ACTIVITY_VISIBLE_FILE_LIMIT` 从 4 改为 3，并将文件活动 disclosure 默认展开改为 false；运行态或同锚点 focus 命中时仍允许展开。
- 2026-07-08: 本地 `renderDiffCard` 已改为始终展示文件卡内容区，文件列表超过 3 条时使用独立 file-list disclosure；移除 header 作为文件列表 disclosure 的行为。
- 2026-07-08: 本地 `frontend/src/pages/codex/virtualizer.js` 已同步文件活动默认可见数为 3，避免长会话高度估算继续按旧规则漂移。
- 2026-07-08: 本地 Playwright fixture DOM 验证使用内存注入 5 个文件的 diffCard：默认 `fileRowCount=3` 且存在 `再显示 2 个文件`；点击后 `fileRowCount=5` 且控件变为 `收起文件`。截图为 `build/tmp/file-card-rule-fixture.png`。
- 2026-07-08: 验证命令通过：`node --check frontend/src/pages/codex/renderer.js`、`node --check frontend/src/pages/codex/virtualizer.js`、`node --check scripts/capture-codex-same-anchor-evidence.cjs`、`git diff --check`、`go test ./...` in `backend`、`go test ./...` in `agent`、`./build-all.sh`。
- 该候选尚未部署到线上，也尚未用 `https://code-tx.zelt.cn/` 与 `https://codex.zelt.cn/` 的同语义锚点完成 source/target 对比，因此不能标记为 `accepted`。

### R43-A7. 移除 parity path 中的额外命令增强

Status: open

Scope:

- 移除或隔离命令汇总、命令次数、`exec_command xN`、运行结果摘要等非官方显示。
- 后续增强必须在官方 parity 通过后以独立开关实现。

Acceptance:

- parity path 的同锚点截图不再因为额外增强产生结构差异。

### R43-A8. 审计并清理补丁式代码和旧命名

Status: open

Scope:

- 审计 renderer、grouping、virtualizer、scroll restore、disclosure 相关代码。
- 审计旧 code-server 兼容命名、shell 命名、临时脚本和补丁式样式。
- 保留的代码必须职责清晰，并能被最终同锚点验收覆盖。

Acceptance:

- 记录保留/删除原因。
- 语法检查、测试、构建通过。
- 不以清理名义改变已经对齐的视觉效果。

### R43-A9. 完整长会话倒序验收

Status: open

Scope:

- 从最新消息开始向上滚完整个目标长会话。
- 每屏选择相同语义锚点定位 source/target。
- 所有可展开区域都要展开后对比。
- 发现差异立即新增 open 任务。

Acceptance:

- 整个长会话没有未解释、未修复、未记录的显示差异。
- 用户在线上可复现的问题全部关闭，或明确保持 open。

### R43-A10. 线上最新版本同步

Status: verified-specific

Scope:

- 每次候选修复后推送到 GitHub。
- 服务器使用 git pull/fetch 同步，不上传本地构建产物。
- 服务器执行构建脚本并重启服务。
- 确认浏览器加载的是最新版本资源。

Acceptance:

- local HEAD、origin HEAD、server HEAD 一致。
- 线上 service 和 agent 正常。
- 用户可直接访问线上验证最新问题。

Evidence:

- 2026-07-08: 已提交并推送 `df3cba8f6aed1df1120c77cf5088712a06e34505`，提交信息为 `tighten codex parity candidate evidence`。
- 2026-07-08: 服务器 `/root/code/codex-web` 已 `git fetch origin main` 并 `git reset --hard origin/main` 到 `df3cba8f6aed1df1120c77cf5088712a06e34505`。
- 2026-07-08: 服务器已执行 `./build-all.sh`，生成 `build/codex-web` 与 `build/codex-agent`，并重启 `codex-web.service`。
- 2026-07-08: `codex-web.service` 为 `active`。
- 2026-07-08: 线上 `GET https://codex.zelt.cn/?nodeId=host-docker-agent&cacheCheck=df3cba8` 返回 200，HTML 资源版本为 `v=20260707185713`。
- 2026-07-08: 线上 `GET https://codex.zelt.cn/api/nodes` 返回 `host-docker-agent` 在线。
- 2026-07-08: 本地 HEAD 与 `origin/main` 为 `cbccb964692917e52befbf34413c3066736f5d71`，提交信息为 `Align codex file activity disclosure rules`。
- 2026-07-08: 服务器 `/root/code/codex-web` 已 `git fetch origin main` 并 `git reset --hard origin/main` 到 `cbccb964692917e52befbf34413c3066736f5d71`。
- 2026-07-08: 服务器已执行 `./build-all.sh`，生成 `build/codex-web` 与 `build/codex-agent`，并重启 `codex-web.service`。
- 2026-07-08: 线上 `GET https://codex.zelt.cn/?nodeId=host-docker-agent&cacheCheck=cbccb96` 返回 200，HTML 资源版本为 `v=20260707193620`。
- 2026-07-08: 线上 `GET https://codex.zelt.cn/api/nodes` 返回 `host-docker-agent` 在线。
- 本任务只证明候选代码已同步到线上并可访问；不证明 UI 对齐验收通过。

## New Findings

本段只记录 Reset 43 之后的新发现。新问题必须先写到这里，再进入对应任务。

- 2026-07-08: 用户指出此前工作出现假阳性，没有达到最终验收标准；要求整理并移出此前工作，重建工作文件。
- 2026-07-08: Reset 42 的 active evidence 与工作文件已归档，不能用于关闭 Reset 43 UI 任务。
- 2026-07-08: 当前本地存在 `renderer.js` 和 `virtualizer.js` 候选改动；它们必须按 Reset 43 标准重新验收或回退，不能继承此前结论。
- 2026-07-08: 官方完成态 diff 文件卡默认可见文件数为 3；当前项目旧实现为 4 且存在 header 控制整个文件列表收缩的问题，已形成本地候选修复，但仍需线上同锚点验证。
- 2026-07-08: `./build-all.sh` 不能作为默认验收锚点；它在当前官方页面和目标 API 中都有多候选，必须配合唯一上下文、明确 seq 或改用更稳定的文件/diff/processed 锚点。
- 2026-07-08: 取证脚本曾出现 target DOM 假阴性：target API 唯一定位 `seq=7616` 后，DOM 搜索没有限制到该 seq 所在 turn，导致报告 target not found；已修脚本，但这只修取证可靠性，不代表 UI 对齐。
- 2026-07-08: 重新用线上目标页 shadowRoot 聚焦 `seq=6405` 检查 `innerHTML`、`textContent`、`innerText`，当前未复现 `s` 字母缺失；旧 `manual-7616` 中的缺字记录暂降级为探针/上下文问题，不能作为产品 bug 或 UI 对齐证据。取证脚本语义匹配改为优先使用 `textContent`，降低布局依赖。
- 2026-07-08: 单锚点同源/目标复测 `workbench class 被我硬编码成了` 生成 `reference/same-anchor-evidence/20260707-200811/summary.json`，source/target 均可定位且 target API 唯一命中 `seq=6405`。该证据只证明取证链恢复可用；因本轮关闭截图且不是 processed/file-diff 验收锚点，不能关闭 UI 任务。

## Running Notes

- 2026-07-08: Reset 43 建立。当前没有任何 UI 对齐任务被接受；下一步应先做 R43-A1 和 R43-A2，再进入同锚点策略与真实线上复现。
- 2026-07-08: R43-A1 已完成基线确认，只能作为 `verified-specific`；R43-A2/R43-A3 已形成本地候选修复，但尚未部署、尚未进行 source/target 同锚点采集，不能作为 UI 验收。
- 2026-07-08: R43-A10 已完成线上候选同步，R43-A4 已完成一轮 target-only 交互探针；下一步仍必须做 source/target 同锚点对比，尤其是 processed collapse、文件/diff 块和完整长会话倒序滚动。
- 2026-07-08: R43-A6 已有本地候选 UI 修复与 fixture DOM 证据；下一步应提交/部署该候选后，针对文件/diff 锚点重跑 source/target 同锚点证据，不能用 fixture 证据替代最终验收。
- 2026-07-08: `cbccb96` 已部署到线上并通过最新 target-only 交互探针；同锚点脚本已修正一个假阴性入口。下一步应选择非重复、结构明确的锚点，优先验证 processed/file-diff 区域的 collapsed/expanded 双态。
- 2026-07-08: 当前推进应从真实产品差异继续，不再围绕 `s` 缺字假设展开；该点只有 target-side 文本完整性证据，不关闭任何 source/target 同锚点 UI 任务。
- 2026-07-08: 取证链下一步不是扩大普通文本锚点数量，而是选 processed/file-diff 结构锚点，并强制采集 source/target 截图、DOM 摘要、computed style、collapsed 和 expanded 双态。
