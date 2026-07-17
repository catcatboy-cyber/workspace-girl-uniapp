# 记上图片 AI 识别恢复 + 附件识别专用视觉模型 开发计划

**日期**：2026-07-17
**建议分支**：`feature/attachment-vision-model`（从 master 切出；与 timeline 重构、emoji 修复等未提交内容零文件重叠）

## 一、目标

1. 恢复【记上】图片附件的 AI 识别：点击【记上】提交时通过一次批量云函数请求分析所有图片（聊天截图提取文本、普通图摘要），结果随记录落库并在往事/分析页展示。
2. 支持为附件识别模块配置**专用视觉模型**，与全局默认文本模型解耦；模型不硬编码，全部后台配置驱动（Qwen3-VL / 混元 vision 均可）。
3. 附件识别必须满足：服务端所有权校验、请求幂等、并发额度安全、失败不阻塞记录保存、图片隐私可告知。

## 二、背景事实

- 前端调用点已于 2026-06-05（commit `44b9fb4`）移除，`analyzeAttachment` 云函数现为死代码；但下游全通：`createTimeline` 的 `sanitizeAttachment`（index.js:102-135）仍白名单接收 `attachment.analysis`，timeline.vue / assessments.vue 渲染逻辑都在。**只缺调用。**
- 云函数固定按 `aiDefaultModelId` 选模型（analyzeAttachment/index.js:36-61）；默认模型是文本模型时传 `image_url` 直接失败。
- 全库无任何 per-module 模型字段（grep 确认）。
- 已定决策：完整方案；触发时机 = 点【记上】时（删图重选不浪费 token）；模型用户自己在后台配。

## 三、数据契约

`system_settings/settings_global_ai` 文档新增**顶层字段**：

```js
aiModuleModels: { attachmentAnalysis: '<aiModels 数组中某项的 id>' }
```

- 键缺失或空字符串 = 跟随默认模型
- ⚠️ 不能放 `runtimeConfig`——adminManage 的 `normalizeRuntimeConfig`（index.js:313-334）是键白名单，未列入的键会被丢弃

## 四、安全与调用契约

### 4.1 批量请求

前端只调用一次 `analyzeAttachment`：

```ts
{
  requestId: string,
  caseId: string,
  attachments: Array<{
    fileID: string,
    mediaType: 'image'
  }>
}
```

约束：

- `requestId` 每次点击【记上】生成一次，格式使用随机串 + 时间戳，不使用图片文件名。
- `attachments` 服务端限制最多 6 项，超出直接拒绝。
- 服务端去重 `fileID`，禁止同一请求重复识别同一图片。
- 不再由前端对每张图分别调用云函数。

响应：

```ts
{
  success: true,
  requestId: string,
  results: Array<{
    fileID: string,
    success: boolean,
    skipped?: boolean,
    code?: string,
    analysis?: AttachmentAnalysis
  }>
}
```

单张失败不使整个批次失败。只有鉴权失败、非法附件归属或请求结构非法时整体失败。

### 4.2 附件所有权校验（上线阻断项）

`analyzeAttachment` 在生成临时 URL 前必须校验每个 `fileID`：

- 当前登录用户由 `requireAuthenticatedUserId` 获取，禁止相信前端 `userId`。
- `fileID` 必须是云存储 ID，解析后的对象路径必须以 `timeline/<authenticatedUserId>/` 开头。
- 路径含 `..`、反斜杠、编码后路径穿越或不属于 `timeline/` 时拒绝。
- `caseId` 必须属于当前登录用户；参照 `createTimeline` / `getCaseDetail` 的案例归属查询模式（`where({ caseId/_id, userId })`）。
- 任一附件归属不合法时返回 `ATTACHMENT_FORBIDDEN`，并且整个批次不得调用模型。
- 日志只记录 `fileID` 哈希或尾部短 ID，不记录完整临时 URL。

补充自动化测试：自己的路径允许；其他用户路径、非 timeline 路径、伪造 `userId`、路径穿越全部拒绝。

### 4.3 幂等与结果缓存（上线阻断项）

新增集合 `attachment_analysis_requests`，唯一业务键为：

```text
userId + requestId
```

记录字段：

```js
{
  userId,
  requestId,
  caseId,
  fileIdsHash,
  modelId,
  status: 'processing' | 'completed' | 'failed',
  results,
  estimatedTokens,
  actualTokens,
  createdAt,
  updatedAt,
  expiresAt
}
```

规则：

- 同一 `userId + requestId` 再次调用且附件集合一致：`completed` 直接返回旧结果；`processing` 返回 `REQUEST_IN_PROGRESS`。
- **僵尸恢复**：`processing` 记录超过 90 秒（大于函数 60s 顶格）视为失效——重放请求可接管重跑或将其标记 `failed`，防止函数超时被杀后同 requestId 永久卡死。
- **并发插入冲突**：两个并发同 requestId 请求同时查无记录并插入时，后者捕获唯一索引冲突错误，转为读取已有记录按状态处理。
- 同一 requestId 携带不同附件集合：返回 `IDEMPOTENCY_CONFLICT`。
- `failed` 是否允许重试必须生成新 requestId，避免重复扣费语义不清。
- 缓存保存结构化分析结果，不保存临时 URL、图片二进制和 API Key。
- 设置 TTL 或维护任务清理请求记录，建议保留 7 天。
- 增强（推荐）：结果同时按 `fileID + modelId + promptHash` 建立单图缓存（云存储 fileID 内容不可变；`promptHash` = attachmentAnalysis 模块 prompt 文本的简易哈希）——同一张图跨 requestId 重复提交直接复用分析结果，不再调模型、不再计费；管理员改 prompt/换模型后缓存自然失效。

### 4.4 Token 门控：软预检 + 尽力扣 + 免单制（已定）

用户决策：余额不足不阻塞分析，扣不满免单（现状 `consumeTokens` 天然行为，零改动）。

- 批量函数入口保留 `checkFeatureAccess(db, userId, '附件识别')`（订阅功能门槛，不允许 → 整批 `FEATURE_NOT_AVAILABLE`）。
- Token 预检降为**软门槛**：`checkTokenBalance(db, userId, 1)`（余额 > 0 即放行）；余额 ≤ 0 整批不调模型，单图结果返回 `TOKEN_INSUFFICIENT`。
- 每张图完成后沿用现有 `recordTokenUsage`（内部 `consumeTokens` 尽力扣：月度封顶 + extra 封顶，subscription.js:427-436，**扣不满差额免单、余额永不为负**），并把批次 `requestId` 写入 usage doc（字段已存在，token-usage.js:32）。
- **不引入预留/结算/释放机制，不改 `_shared`**。
- `consumeTokens` 失败或 `tokensDeducted < 实际用量` 均为终态（免单），`completed` 状态与扣费结果**无一致性耦合**——缓存复用不再计费本就是设计意图，无需 settlement_pending/补偿任务（codex 审计 #2 由免单语义消解）。
- 多端并发场景（codex 审计 #1）：用户明确接受不做服务端约束；免单制下"超扣"实际含义是**平台多免单**（用户余额不会变负），最坏成本 = 边缘并发 × 每批 ≤6 次模型调用，`call_usage` 明细可追溯。
- AI 未开启、prompt 禁用、所有权校验失败、`BATCH_TIMEOUT` 未执行的图片：不产生任何 `token_usage` 记录。

### 4.5 服务端并发与超时

- 批次内部固定并发 **3**（worker pool）：6 张 = 2 波 × 25s = 最坏 50s，60s 函数顶格内留 ~10s 给鉴权/DB/幂等写入。（并发 2 × 25s × 3 波 = 75s 会结构性超时，故弃用。）
- 单张模型 HTTP 超时控制在 25 秒以内。
- 批量函数总超时按 60 秒设计（TCB 顶格，cloudbaserc 已配）；剩余未开始图片返回 `BATCH_TIMEOUT`。
- 前端等待时间设为 55 秒，必须大于单张服务端超时，不能用前端提前超时假装取消云函数。
- ⚠️ 验证项：微信端 `callFunction` 为裸透传（cloudbase.ts:150-152），客户端 SDK 默认超时可能远小于 55s——实现时须确认并显式配置 SDK timeout，dev 真机验证长耗时批次不被客户端提前掐断。
- 前端超时后不得自动重新发起识别；继续保存纯附件，并记录 requestId 供日志排查。

## 五、改动清单（预计 6-7 个文件，约 250-350 行）

### 1. `cloudfunctions/analyzeAttachment/index.js`

- 新增 `resolveModuleModel(settings, moduleKey)`：从 `aiModuleModels[moduleKey]` 取 modelId → 在 `aiModels` 查找 → 校验 apiKey 非空 → 任一失败返回 null（回落）
- `normalizeSettings`（36 行）加第二参数 `moduleKey`，v2 分支模型选择改为：`resolveModuleModel(...) || 按 aiDefaultModelId 查找 || aiModels[0]`；v1 分支不动
- 主入口改为批量契约，限制最多 6 张并去重。
- **旧契约兼容层**：收到旧版 `{fileID, mediaType}` 入参时转换为单元素批量请求处理（服务端代生成幂等键），日志标记 deprecated——防调试工具/历史调用收到结构错误。
- 在获取临时 URL 前完成用户、案例和文件路径归属校验。
- 接入 `requestId` 幂等记录、入口软预检（feature 门控 + 余额>0）+ 完成后 `recordTokenUsage` 尽力扣（免单制）、并发数 3 的 worker pool。
- 三处 fallback（AI 未开启 / prompt 禁用 / AI 报错）以单图结果返回 `skipped: true`。
- 临时 URL、提取全文不得写入日志。

### 2. `cloudfunctions/adminManage/index.js`

- 新增 `MODULE_MODEL_KEYS = ['attachmentAnalysis']` + `normalizeModuleModels(value, baseValue, models)`（放 normalizeModels 847 行附近），合并规则：
  - 请求显式带键：有效 id → 写入；空串 → 清除；无效 id → 保留旧值
  - 请求没带键 → **保留旧值**（老客户端保存不清配置——防覆盖纪律）
  - 旧值指向已删除的模型 → 自动清理
- `updateAISettings` update 白名单（1096 行 `aiDefaultModelId` 后）加一行：
  `aiModuleModels: normalizeModuleModels(event.aiModuleModels, base.aiModuleModels, normalizedModels)`
- `applySettingsDefaults`（336 行）加保底 `base.aiModuleModels = 是对象 ? 原值 : {}`
- 读链路（getOverview → buildAdminAISettings → redactSettings 浅拷贝）自动透传新字段，**getOverview 无需改**

### 3. `src/pages/admin/admin.vue`

- 模型卡片列表后、「小咪帮你说」区块（273 行）前，新增「模块专用模型」section：`<picker mode="selector">` 下拉，选项 = `['跟随默认模型（默认模型名）', ...aiModels 各项 name/model]`
- 状态：`attachmentModelId = ref('')` + `attachmentModelOptions/Labels/Index` computed + `onAttachmentModelChange`
- 三个既有函数联动：
  - 回填 `applyOverview`（1215 行附近）：从 `settings.aiModuleModels.attachmentAnalysis` 取值，存在于 models 才回填
  - 保存 `saveAISettings`（1538 行 payload）加 `aiModuleModels: { attachmentAnalysis: attachmentModelId.value }`
  - `removeModel`（1503 行）：删的是当前选中模型则复位 ''
- 少量 `.picker-value` 样式（白底黑边，对齐 Campus Pop）
- section 描述文案提示：需选择支持图片理解的视觉模型（后台「测试」按钮是纯文本测试，验不了视觉能力）

### 4. `src/pages/index/index.vue`

- import 加 `analyzeAttachment`（api.ts:804 包装已存在）
- 新状态 `quickSubmitStage: 'idle' | 'analyzing' | 'saving'`；记上按钮（135 行）文案：analyzing →「识别图片中...」，saving →「保存中...」
- `submitQuickRecord`（2057 行）在 `currentAttachments` 构建后（2081 行）、`createTimeline` 前插入：
  - 过滤图片附件，生成单个 `requestId`，一次调用批量 `analyzeAttachment({ requestId, caseId, attachments })`。
  - 前端最长等待 55 秒；超时只停止等待，不自动重试，并继续保存纯附件。
  - 成功且 `!result.skipped` 且 analysis 有内容时，以 `fileID` 为键建立 `analysisByFileId`。
  - 显式生成 `analyzedAttachments`，禁止依赖过滤数组对象引用隐式回写：

```ts
const analyzedAttachments = currentAttachments.map((item: any) => ({
  ...item,
  analysis: analysisByFileId[item.fileID] || item.analysis
}))
```

  - `createTimeline` 和 `applyPendingQuickFeedback` 必须统一使用 `analyzedAttachments`。
  - **任何失败/token 不足/超时都不阻塞提交**，只 `indexAILog`，不弹付费墙
  - `finally` 复位 `quickSubmitStage = 'idle'`
- ⚠️ 不用 `??`（微信不支持），用三元/`&&`

### 5. `src/utils/api.ts`

- `adminUpdateAISettings`（1266 行）参数类型加 `aiModuleModels?: Record<string, string>`
- `analyzeAttachment` 包装改为批量请求/响应类型，并补 `...getBusinessAuthPayload()`（H5 运行时鉴权，微信端无影响）。

### 6. 幂等相关模块

- **不改 `_shared`**（免单制决策）：Token 走既有 `checkTokenBalance` 软预检（余额>0 放行）+ `recordTokenUsage` 尽力扣（扣不满免单）。
- `attachment_analysis_requests` 数据访问和状态恢复逻辑收敛在 analyzeAttachment 内部。
- 需要显式索引：`userId + requestId` 唯一索引；`expiresAt` 清理（先在 CloudBase 控制台确认 TTL 索引支持性，不支持则用定时触发器清理）。

### 7. 隐私提示位置

- 在【记上】图片选择区或提交区增加简短说明：“图片可能发送至管理员配置的第三方 AI 模型进行识别”。
- ⚠️ 审计修正：**项目当前没有隐私政策页面**（pages.json 无相关页）——不做"复用现有隐私页面"。方案改为：小字说明 + 点击 `uni.showModal` 展示详细说明（处理目的、数据类型、第三方模型、结果存储），不新增页面、不做阻断式弹窗。
- 首次启用图片识别时可使用一次性确认并持久化确认状态（uni.setStorageSync）；确认版本号随 analyzeAttachment 请求带 `consentVersion` 字段，服务端写入 `attachment_analysis_requests` 记录，形成账号级留痕（零额外集合）。
- 独立的隐私政策页面另立任务（不在本次范围）。

## 六、不改的部分

`_shared/*`（零改动，B 档决策，无需 sync:shared）、`createTimeline`、timeline.vue / assessments.vue 展示端、数据库已有配置结构（runtimeConfig / promptModules / aiModels）不改变。

## 七、边界处理

| 场景 | 行为 |
|---|---|
| 多图（上限 6 张，index.vue:1811 已限） | 单次批量请求，服务端并发 3（2 波 × 25s ≤ 50s），防止供应商限流 |
| AI 慢/超时 | 单张服务端 25s；前端等待 55s（须显式配置并验证 SDK timeout）；超时不自动重试，未完成图片降级纯附件 |
| AI 未开启 / prompt 禁用 | 云函数秒回 skipped，前端静默跳过 |
| 模块模型被删/key 空 | 双重校验回落默认模型；保存时服务端清理悬空 id |
| 配的模型不支持视觉 | AI 4xx → 走既有错误兜底，记录仍正常保存 |
| 老后台客户端保存 | hasOwnProperty 分支保留旧配置，不会清空 |
| 重复提交 | `quickSubmitting` 已互斥（2058 行） |
| 多端重复请求 | `userId + requestId` 幂等；相同请求返回缓存，不重复调用模型和扣费 |
| 非本人 fileID | 整批拒绝 `ATTACHMENT_FORBIDDEN`，模型不调用、不计费 |
| 前端 55s 放弃但云函数后续完成 | 本次记录保存为纯附件（结果孤儿化，**本期不做异步回写**，此为明确验收标准而非缺陷）；分析结果留在幂等/单图缓存中，同图下次提交直接复用不再计费 |

## 八、验证与部署（本地 → dev 云环境 → 用户确认 → 生产）

### 本地
1. `node --check` 两个云函数
2. `npm.cmd run build:mp-weixin`（必须走 npm script，禁止裸 uni build——postbuild 负责拷图标等）
3. `npm.cmd run test:regression`
4. 新增并运行附件识别专项测试（按 `tests/run-regression.cjs` 既有 `loadFunction` 集成测试模式编写）：
   - 自有附件成功；他人附件、非 timeline 路径、路径穿越拒绝
   - 伪造 `userId` 无效
   - 7 张图片拒绝；重复 fileID 去重
   - 同 requestId 重放不重复调用模型、不重复扣费
   - 同 requestId 不同附件返回冲突
   - 余额 ≤ 0 时整批模型调用次数为 0（`TOKEN_INSUFFICIENT`）
   - 余额 > 0 但不足以覆盖全批时：分析正常完成、扣不满免单、余额不为负
   - AI 失败/超时/未开启时不产生 token_usage 记录
   - 同一 fileID 复用缓存结果时不重复调模型、不重复计费
   - 老后台请求不传 `aiModuleModels` 时保留旧值
   - 空串清除、无效 ID、删除模型后的引用清理
   - 遮罩 API Key 不覆盖真实 Key

### dev 环境
`npx.cmd tcb fn deploy adminManage -e <devEnvId> --force --json`，同理 analyzeAttachment

1. 后台：出现「附件识别模型」下拉 → 选视觉模型保存 → 刷新回填正确 → 切回"跟随默认"保存 → 控制台确认 DB 键被清除
2. **防覆盖专项回归（必做）**：保存后确认 promptModules / runtimeConfig / petSpeakConfig / aiModels 的 apiKey 均未丢失
3. 开发者工具连 dev：记上 + 聊天截图 → 隐私说明可见 →「识别图片中...」→ 提交成功 → 往事页出现提取文本/摘要；`token_usage` 有 `attachmentAnalysis` 条目且 model = 模块模型名
4. 异常路径：关 AI 提交带图（正常保存无报错）；模块模型 id 改成无效值（回落默认）
5. 多图 4-6 张并发；真机预览完整流程一次

### 生产（用户确认后）
1. **索引前置（幂等正确性的前提，先于函数部署）**：创建 `attachment_analysis_requests` 集合 → 控制台创建并验证 `userId + requestId` 唯一索引 → 配置 TTL 或定时清理
2. 部署两个云函数（顺序：adminManage → analyzeAttachment；旧前端不调用 + 旧契约兼容层 = 兼容）
3. 运行并发幂等探针（同 requestId 并发 × 2，确认只调用一次模型）
4. 生产后台配置视觉模型并保存
5. 小程序提审发版
6. 回滚 = 前端不调用即回到现状；云函数改动向后兼容可原样保留

## 九、风险

- `updateAISettings` 白名单覆盖写是全局配置的命门，merge 逻辑错误会清用户配置 → dev 防覆盖专项回归必做
- 后台「测试」按钮验不了视觉能力，管理员可能误配文本模型 → 文案提示 + dev 真图验证；后续可加视觉测试按钮（不在本次范围）
- 每图 1000 token 门控是预估，观察 `token_usage` 实际消耗后可在后台调 `attachmentMaxTokens`
- 提交总时长变长（识别串联在保存前）→ 用户已接受该权衡，loading 文案缓解
- 批量识别、所有权校验和幂等是防止越权读取与重复计费的上线前置条件，不能降级为前端全并发；Token 采用免单制（软预检 + 尽力扣），多端并发的最坏结果是平台多免单而非用户余额异常，为已接受的权衡（观察 `call_usage`/`token_usage` 明细，异常放量时再补服务端配额）。
- 聊天截图属于高敏感内容，隐私说明、日志脱敏和第三方模型风险提示必须与功能同时上线。

## 十、工程纪律备忘

- 改代码用 Edit 工具（禁 Node 脚本注入）；文件 UTF-8
- 前端改完自动 `npm.cmd run build:mp-weixin`
- 完成后不自动 commit，留工作树给用户验证

## 十一、预估工作量

| 阶段 | 预估 |
|---|---|
| analyzeAttachment 批量契约、所有权校验、模型选择 | 60min |
| 幂等记录 + Token 入口预检 | 45min |
| adminManage 归一化与合并写入 | 30min |
| admin.vue 下拉 UI + 联动 | 40min |
| index.vue 批量识别、显式回写、隐私提示 | 45min |
| 自动化测试、本地构建 + dev 部署验证 | 75min |
| **合计** | **约 4.5-5 小时**（生产部署另计，等确认） |
