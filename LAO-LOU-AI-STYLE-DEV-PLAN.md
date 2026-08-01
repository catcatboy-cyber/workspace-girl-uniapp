# AI 分析风格注册体系 + 老娄布道风格开发计划 v3

> 本版按 2026-08-01 当前代码重写，替代旧 v2。旧版基于已经删除的 `normalizeRawReply()`、`ensureDirectRawReplySection()` 和旧 AI 评分链，不能继续执行。
>
> 目标不仅是增加 `lao_lou`，还要把新增风格从“修改多处白名单和标题正则”收敛为“注册一条风格定义 + 配置一份 prompt”。

---

## 0. 最终目标

### 0.1 本期交付

1. 新增可选风格 `lao_lou`，用户可在“我 → AI 分析风格”中选择并保存。
2. 老娄风格作用于分析类文案，但不得改变语义归一化和评分。
3. 每条分析结果保存当时真正生效的风格，用户以后切换风格不会改变历史记录标题。
4. 首页和时间线优先渲染结构化四段内容，不再依赖标题正则识别新记录。
5. 未成年人和敏感边界事件继续由安全覆盖规则控制。
6. 建立统一风格注册表；以后增加普通风格时，不再修改多个后端数组、前端联合类型和页面标题解析器。

### 0.2 本期明确不做

1. 不修改 `NormalizedEventV1.event` 字段、评分表或 `SCORING_POLICY_V1`。
2. 不让风格改变 `actor`、`interaction`、`commitmentStatus`、`strength`、`signals`、`eventType` 或三项分数。
3. 不给每种风格创建独立的 `xxx-prompt.js` 文件。
4. 不修改事件分析的 `temperature=0.2`；风格通过明确指令实现，不通过提高温度实现。
5. 不把本风格注入 `petLines` 的“帮我回复TA”“主动说一句”“多轮策略”等话术生成。它们是独立产品能力，当前使用独立 prompt 和较高温度。
6. 不在本计划中实现“快速提问后台配置”。该需求与人格风格没有运行链路依赖，必须拆成独立计划，避免扩大本期回归面。

### 0.3 本期风格覆盖范围

| 模块 | 是否应用 `aiStyle` | 说明 |
|---|---:|---|
| `eventAssessment` | 是 | 只影响 `copy` 文案和展示标题，不影响 `event` 与评分 |
| `weeklyReview` | 是 | 影响周报表达口吻，不改变统计数据 |
| `sideRead` | 是 | 影响侧写文案，不改变输入事实 |
| `attachmentAnalysis` | 否 | 附件抽取应保持客观 |
| `petLines` | 否 | 回复生成有独立 prompt、温度和安全上下文 |
| `eventTagging` | 否 | 标签维护属于结构化处理 |

前端名称继续使用“AI 分析风格”，不要改成容易让用户误解为全站所有回复都会变化的“AI 风格”。

---

## 1. 当前真实调用链

### 1.1 即时分析

```text
src/pages/index/index.vue
  → createTimeline（先保存 pending 记录）
  → generateAssessmentAI
  → _shared/event-recalculate.js
  → _shared/ai-event.js
  → AI 返回 NormalizedEventV1：{ event, copy }
  → _shared/normalized-event.js
      ├─ 校验 event/copy
      ├─ 根据 event 计算评分
      ├─ 投影 semanticTags
      └─ 根据 copy 生成 rawReply
  → assessment / timeline_records / case.latestResult
  → 首页和时间线展示
```

### 1.2 必须遵守的现有边界

当前 `_shared/ai-event.js` 已明确：

```text
人格和建议强度只影响 copy，不得影响 event。
```

本次开发必须保留该边界。老娄风格不能为了“更有冲击力”而把普通回应归一为拒绝、把普通拖延归一为违约，或放大 `strength`。

### 1.3 当前技术债

风格 key 和风格列表目前分散在以下位置：

- `cloudfunctions/_shared/persona-config.js`
- `cloudfunctions/adminManage/index.js`
- `cloudfunctions/getAISettings/index.js`
- `cloudfunctions/updateAISettings/index.js`
- `cloudfunctions/userProfile/index.js`
- `src/utils/api.ts`
- `src/pages/admin/admin.vue`
- `src/pages/me/me.vue`

四段标题和解析逻辑也分别存在于：

- `cloudfunctions/_shared/normalized-event.js`
- `src/pages/index/index.vue`
- `src/pages/timeline/timeline.vue`

本期必须同时消除这两类重复源。

---

## 2. 核心架构决定

### 2.1 建立唯一风格注册表

新建：

```text
cloudfunctions/_shared/persona-style-registry.js
```

该文件只描述“系统允许存在哪些风格”和风格的稳定元数据，不读取数据库、不调用 AI。

建议结构：

```javascript
const PERSONA_CATALOG_VERSION = 1
const DEFAULT_STYLE_KEY = 'gentle_bestie'
const MINOR_STYLE_KEY = 'careful_guardian'
const DEFAULT_BOLDNESS_KEY = 'balanced'

const REPLY_SECTION_KEYS = ['answer', 'targetMind', 'nextStep', 'caution']

const STYLE_DEFINITIONS = [
  {
    key: 'gentle_bestie',
    labelZh: '温柔陪伴',
    descriptionZh: '先接住情绪，再给清楚动作。',
    sortOrder: 10,
    selectable: true,
    replyLabels: {
      answer: '小咪先回答你的问题',
      targetMind: '对方可能在想',
      nextStep: '下一步可以这样推进',
      caution: '留个心眼'
    },
    fallbackPromptZh: '语气温柔、清楚，不回避结论；先接住情绪，再给可执行建议。'
  },
  // 其余原有风格……
  {
    key: 'lao_lou',
    labelZh: '老娄布道',
    descriptionZh: '像有阅历的情感布道者，直接点破，再给行动。',
    sortOrder: 60,
    selectable: true,
    replyLabels: {
      answer: '老娄诊断',
      targetMind: '你的人性课',
      nextStep: '你给我听着',
      caution: '老娄最后送你一句话'
    },
    fallbackPromptZh: '用市井、直接、有阅历的中文表达；先给判断，再点破关系逻辑和行动建议。可以有轻微山东口语感，但不得辱骂、贬低性别、鼓励操控或越界。'
  }
]
```

必须导出：

```javascript
PERSONA_CATALOG_VERSION
DEFAULT_STYLE_KEY
MINOR_STYLE_KEY
DEFAULT_BOLDNESS_KEY
REPLY_SECTION_KEYS
STYLE_DEFINITIONS
STYLE_KEYS
getStyleDefinition(key)
isRegisteredStyleKey(key)
getPublicStyleCatalog(personaConfig)
getReplyLabels(styleKey)
```

约束：

- `key` 只能使用 `/^[a-z][a-z0-9_]{1,31}$/`。
- key 不可重复。
- `replyLabels` 必须完整覆盖四个稳定 section key。
- section key 永远固定，风格只能更换 label，不能更换数据含义。
- `careful_guardian` 必须存在且不可被删除。
- `gentle_bestie` 必须存在并作为最终 fallback。

首期注册表必须完整包含下列6项，不允许只注册 `lao_lou`：

| key | labelZh | sortOrder | 默认四段标题 |
|---|---|---:|---|
| `gentle_bestie` | 温柔陪伴 | 10 | 小咪四段式 |
| `calm_strategist` | 冷静军师 | 20 | 小咪四段式 |
| `playful_flirty` | 轻痞幽默 | 30 | 小咪四段式 |
| `direct_sharp` | 不绕弯子 | 40 | 小咪四段式 |
| `careful_guardian` | 谨慎守护 | 50 | 小咪四段式 |
| `lao_lou` | 老娄布道 | 60 | 老娄四段式 |

原有5种风格的 `fallbackPromptZh` 应从当前线上 persona 配置或现有产品定义整理，不能用空字符串。DB 中存在非空 prompt 时始终优先使用 DB 值。

### 2.2 不创建 `lao-lou-prompt.js`

所有风格通过同一条注册和配置链工作。禁止出现：

```javascript
if (styleKey === 'lao_lou') { ... }
```

业务代码只能使用：

```javascript
const style = getStyleDefinition(effectiveStyleKey)
```

新增其他风格时，应只新增一条 `STYLE_DEFINITIONS` 配置和对应数据库 prompt，不新增风格专属模块。

### 2.3 风格 prompt 保持简短

风格 prompt 只定义语言表现，不重复：

- NormalizedEventV1 schema
- 主体、承诺、评分规则
- 未成年人护栏
- JSON 输出要求
- 全局安全红线

这些内容已经由固定系统提示词统一注入。`lao_lou.promptZh` 建议控制在 300～600 个中文字符内，不加入大段场景速查表。

### 2.4 请求风格与生效风格分离

必须区分：

```text
requestedStyleKey：用户选择的风格
effectiveStyleKey：本次请求真正使用的风格
```

覆盖规则：

```javascript
if (user is under18) {
  effectiveStyleKey = 'careful_guardian'
} else if (requested style is missing / disabled / invalid) {
  effectiveStyleKey = 'gentle_bestie'
} else {
  effectiveStyleKey = requestedStyleKey
}
```

`aiBoldness` 同理必须返回 `requestedBoldnessKey` 和 `effectiveBoldnessKey`。边界敏感事件可以把 `bold` 降为 `balanced`，不得绕过。

---

## 3. 数据结构

### 3.1 全局 AI 设置中的 personaConfig

继续使用：

```text
system_settings/settings_global_ai.personaConfig
```

扩展每个 style 的结构：

```javascript
personaConfig: {
  styles: {
    lao_lou: {
      enabled: true,
      labelZh: '老娄布道',
      labelEn: 'Lao Lou',
      descriptionZh: '像有阅历的情感布道者，直接点破，再给行动。',
      descriptionEn: '',
      promptZh: '用市井、直接、有阅历的中文表达……',
      promptEn: '',
      sortOrder: 60
    }
  },
  boldness: {
    // 保持现有结构
  }
}
```

说明：

- `replyLabels` 属于代码注册表中的稳定展示契约，不允许后台随意编辑，避免历史解析失控。
- 后台可编辑 label、description、prompt、enabled、sortOrder。
- 如果 DB 没有某风格配置，使用注册表 fallback，不得生成空风格。
- 如果 DB 存在未注册 key，运行时忽略，但保存设置时不要误删其余无关字段。

### 3.2 每条分析结果保存结构化展示

新增：

```javascript
replyPresentation: {
  schemaVersion: 1,
  catalogVersion: 1,
  requestedStyleKey: 'lao_lou',
  effectiveStyleKey: 'lao_lou',
  requestedBoldnessKey: 'balanced',
  effectiveBoldnessKey: 'balanced',
  sections: [
    { key: 'answer', label: '老娄诊断', text: '……' },
    { key: 'targetMind', label: '你的人性课', text: '……' },
    { key: 'nextStep', label: '你给我听着', text: '……' },
    { key: 'caution', label: '老娄最后送你一句话', text: '……' }
  ]
}
```

同时继续保存：

```javascript
rawReply: '老娄诊断：……\n\n你的人性课：……'
```

`rawReply` 用于旧客户端兼容；新版客户端只要 `replyPresentation.sections` 合法，就不得重新解析 `rawReply`。

### 3.3 历史兼容

旧 assessment 没有 `replyPresentation` 时：

1. 使用共享前端 helper 解析旧的“小咪四段式”别名。
2. 解析失败时显示一段纯文本，不能丢内容。
3. 不根据用户当前 `aiStyle` 给旧记录重新贴标题。
4. 不做数据库批量迁移，不回写旧记录。

---

## 4. 后端改动

### B1. 新建统一注册表

文件：

```text
cloudfunctions/_shared/persona-style-registry.js
```

按 2.1 实现，并为注册表唯一性、section 完整性提供可直接调用的校验函数。

### B2. 重构 persona-config.js

文件：

```text
cloudfunctions/_shared/persona-config.js
```

改动：

1. 删除本文件自己的 `STYLE_KEYS` 定义，改从 registry 导入。
2. `normalizePersonaConfig()` 按 registry 遍历，不再维护第二份 key 数组。
3. `resolvePersona()` 返回：

```javascript
{
  requestedStyleKey,
  effectiveStyleKey,
  requestedBoldnessKey,
  effectiveBoldnessKey,
  isMinor,
  boundarySensitive,
  style,
  boldness,
  replyLabels,
  catalogVersion
}
```

4. `buildPersonaPrompt()` 除 `systemPrompt/userPrompt` 外，也返回上述 key 和 labels。
5. 导出 `resolvePersona`、`normalizePersonaConfig` 和 registry helper。
6. 将 `promptZh` 上限从当前 260 调整到 800；超过上限截断并在后台保存接口返回明确错误，不能静默保存残缺 prompt。

### B3. 删除三套后台重复 normalizer

文件：

```text
cloudfunctions/adminManage/index.js
cloudfunctions/getAISettings/index.js
cloudfunctions/updateAISettings/index.js
```

改动：

1. 删除各自的 `PERSONA_STYLE_KEYS`。
2. 删除各自的 `createEmptyPersonaConfig()` 和 `normalizePersonaConfig()` 重复实现。
3. 全部从 `./_shared/persona-config` 和 `./_shared/persona-style-registry` 导入。
4. 设置读取接口返回 `personaCatalog`。
5. 保存接口逐项校验 key、长度、enabled、sortOrder。
6. `eventAssessment` 的固定 schema/rules 仍由代码管理，persona prompt 不进入 DB 业务规则区。
7. 新增 `mergePersonaConfigPreservingUnknown(base, patch)`：只更新本次提交的注册风格字段，保留未提交 style、boldness 和未来版本字段；禁止用 normalized 对象整体覆盖数据库原值。

### B4. userProfile 使用动态 catalog

文件：

```text
cloudfunctions/userProfile/index.js
```

改动：

1. 删除本地 `AI_STYLES` Set。
2. `action=get` 读取 `settings_global_ai.personaConfig`，返回：

```javascript
{
  success: true,
  selfProfile,
  personaCatalog,
  personaCatalogVersion
}
```

3. `action=update` 修改 `aiStyle` 时，读取当前 catalog，只允许选择 `registered + enabled + selectable` 的风格。
4. 客户端提交非法风格时返回 `INVALID_AI_STYLE`，不得静默写成空字符串。
5. 旧用户已有已禁用风格时允许读取原值；运行时由 `resolvePersona()` fallback，不要求清库。
6. 未提交 `aiStyle` 的画像更新不得覆盖原值。

### B5. ai-event 传递人格元数据

文件：

```text
cloudfunctions/_shared/ai-event.js
```

改动：

1. `buildEventAssessmentMessages()` 中只解析一次 persona。
2. `personaPrompt.userPrompt/systemPrompt` 只影响 AI 的 `copy`。
3. 保留固定语义指令：人格不得影响 `event`。
4. 函数返回 `{ settings, messages, persona }`。
5. AI 成功后调用：

```javascript
buildAnalysisFromNormalizedEvent(normalized.value, {
  ...aiMeta,
  persona
})
```

6. 不增加第二次 AI 调用。
7. 不让风格修改 `responseFormat`、`temperature`、`maxTokens` 或语义枚举。

### B6. normalized-event 生成结构化展示

文件：

```text
cloudfunctions/_shared/normalized-event.js
```

改动：

1. 将 `buildRawReplyFromCopy(copy)` 重构为：

```javascript
buildReplyPresentation(copy, persona)
serializeReplyPresentation(presentation)
```

2. section 内容固定映射：

```text
answer     ← copy.answer
targetMind ← copy.targetMind
nextStep   ← copy.nextStep
caution    ← copy.caution
```

3. `buildAnalysisFromNormalizedEvent()` 返回：

```javascript
replyPresentation
rawReply
requestedStyleKey
effectiveStyleKey
requestedBoldnessKey
effectiveBoldnessKey
```

4. fallback 分析也返回合法 presentation；没有 persona 时使用 `gentle_bestie`。
5. presentation 构建不得读取 `event` 内容来修改评分。

### B7. 持久化字段不丢失

检查并修改：

```text
cloudfunctions/_shared/event-recalculate.js
cloudfunctions/generateAssessmentAI/index.js
cloudfunctions/deleteTimeline/index.js
```

要求：

- assessment 保存 `replyPresentation` 和四个 requested/effective key。
- `case.latestResult` 保留这些字段。
- 删除时间线触发重算时，已有 `analysisSnapshot` 重放不应重新生成不同风格文案。
- replay 旧 snapshot 没有 presentation 时允许 fallback 到旧 `rawReply`。
- 不把上一条 assessment 的风格字段错误继承到新记录；每条新记录使用本次 persona。

### B8. 周报和侧写继续使用统一 persona

文件：

```text
cloudfunctions/weeklyReview/index.js
cloudfunctions/generateSideRead/index.js
```

要求：

- 继续调用 `buildPersonaPrompt()`。
- 不新增 `lao_lou` 专属分支。
- 未成年人覆盖使用 `effectiveStyleKey`。
- 风格只改变文案，不改变已计算统计值。

### B9. 同步共享代码

执行：

```bash
npm run sync:shared
npm run sync:shared:dry
```

`sync:shared:dry` 除已知专用 extra 文件外，不得报告 canonical 文件不同步。

### B10. 新增数据库迁移与核验脚本

新建：

```text
scripts/migrate-persona-style-v3.cjs
scripts/verify-persona-style-v3.cjs
```

迁移脚本要求：

- 默认 `--dry-run`，不带 `--apply` 时禁止写数据库。
- 接受明确的 `--env <envId>`，禁止使用模糊默认环境。
- 只补 `personaConfig.styles.lao_lou` 和 `personaCatalogVersion`。
- 默认只补缺失字段，不覆盖管理员已有非空值。
- `--overwrite-lao-lou` 必须与 `--apply` 同时显式提供才允许覆盖老娄字段。
- 写入前输出字段级 diff，但不得输出 API key、完整模型配置或用户数据。
- 写入后立即重新读取并执行第6.3节核验。

核验脚本只读，并以非零退出码报告：缺 key、prompt 为空、prompt 超长、boldness 丢失、runtimeConfig 被改变等问题。

---

## 5. 前端改动

### F1. API 类型改为运行时 catalog

文件：

```text
src/utils/api.ts
```

删除固定联合类型：

```typescript
type AIStyleValue = 'gentle_bestie' | ...
```

改为：

```typescript
export type AIStyleValue = string

export type PersonaStyleOption = {
  key: string
  labelZh: string
  descriptionZh: string
  sortOrder: number
  enabled: boolean
}
```

`getSelfProfile()` 返回并缓存 `personaCatalog`。前端不能因为没认识新 key 就自动改回 `gentle_bestie`；只有 catalog 不可用时才使用本地5种风格 fallback。

### F2. “我”页面动态渲染

文件：

```text
src/pages/me/me.vue
```

改动：

1. 删除硬编码 `aiStyleOptions` 主数据。
2. 使用 `getSelfProfile()` 返回的 catalog，按 `sortOrder` 排序。
3. API 失败时使用现有5种风格作为只读 fallback；不要在 fallback 中提前展示未确认可用的 `lao_lou`。
4. 保存后使用后端返回的 `selfProfile.aiStyle` 更新状态。
5. catalog 中当前风格已禁用时，页面显示“当前风格已停用，将使用温柔陪伴”，但不立即改写数据库。

### F3. Admin 动态渲染

文件：

```text
src/pages/admin/admin.vue
```

改动：

1. 删除 `personaStyleKeys` 和 `personaStyleTitles` 硬编码。
2. 使用后端 `personaCatalog` 生成编辑列表。
3. 支持编辑 `enabled/labelZh/descriptionZh/promptZh/sortOrder`。
4. `careful_guardian` 不允许禁用。
5. 显示 prompt 字符数和 800 字上限。
6. 保存失败时保留草稿并显示具体字段错误。

### F4. 新建统一展示 helper

新建：

```text
src/utils/reply-presentation.ts
```

导出：

```typescript
normalizeReplyPresentation(result: any): ReplyPresentation | null
getReplySections(result: any): ReplySection[]
parseLegacyRawReply(rawReply: unknown): ReplySection[]
```

处理顺序：

1. `replyPresentation.schemaVersion === 1` 且 section key 完整：直接使用。
2. 否则解析旧小咪标题及历史别名。
3. 否则返回 `{ key: 'legacy', label: '分析建议', text: rawText }`。

禁止根据用户当前风格重命名历史 section。

### F5. 首页和时间线删除重复解析

文件：

```text
src/pages/index/index.vue
src/pages/timeline/timeline.vue
```

改动：

1. 删除页面内重复的 `normalizeRawReplyText()` 和 `parseRawReplySections()`。
2. 统一调用 `src/utils/reply-presentation.ts`。
3. section 的 `key` 用作 Vue key，`label` 只负责展示。
4. 如果 presentation 不完整，回退纯文本，不显示空卡片。

---

## 6. 数据库增量更新

### 6.1 禁止整体覆盖 personaConfig

新增老娄配置时必须使用字段级更新或“读取 → 深合并 → 写回”，不能用新的 `personaConfig` 对象整体覆盖旧值。

需要保留：

- 原有5种风格的所有 label/prompt。
- 原有3种 boldness 配置。
- `settings_global_ai` 的模型、模块、运行参数和安全配置。

### 6.2 更新内容

仅补充：

```text
personaConfig.styles.lao_lou
personaCatalogVersion
```

如果 `lao_lou` 已存在：

- 默认不覆盖管理员已填写的非空 prompt。
- 只补缺失字段。
- 如需强制更新，脚本必须提供显式 `--overwrite-lao-lou`，默认关闭。

### 6.3 更新后只读核验

核验：

```text
原5种 style key 仍存在
lao_lou.enabled === true
lao_lou.promptZh 非空且 <= 800
3种 boldness 仍存在
runtimeConfig.eventTemperature 仍为原值
promptModules 未被修改
模型 API key 未被输出到日志
```

---

## 7. 安全要求

1. 全局安全护栏优先级高于 persona prompt。
2. 老娄风格可以直接、口语化，但不得包含：
   - 性别贬低或群体刻板印象；
   - 暴力、威胁、羞辱；
   - 操控、跟踪、灌酒、强迫、越界建议；
   - 未成年人成人化内容；
   - 把猜测写成事实。
3. 用户未满18岁时：
   - `requestedStyleKey` 可以仍为 `lao_lou`；
   - `effectiveStyleKey` 必须为 `careful_guardian`；
   - 保存的 presentation 必须使用 `careful_guardian` 标签。
4. persona prompt 不得覆盖 JSON schema、语义枚举和评分策略。
5. 不使用真实人物身份冒充措辞。产品文案使用“老娄布道风格”，不要宣称系统就是某位真实人物。

---

## 8. 测试计划

### 8.1 Registry 单元测试

新建：

```text
tests/run-persona-style.cjs
```

在 `package.json` 增加：

```json
{
  "scripts": {
    "test:persona-style": "node tests/run-persona-style.cjs"
  }
}
```

至少覆盖：

| # | 场景 | 预期 |
|---|---|---|
| R1 | 所有 style key | 唯一且符合格式 |
| R2 | 所有 replyLabels | 四个 section key 完整 |
| R3 | 未知 key | fallback `gentle_bestie` |
| R4 | disabled key | fallback `gentle_bestie` |
| R5 | under18 + lao_lou | effective 为 `careful_guardian` |
| R6 | boundary + bold | effectiveBoldness 为 `balanced` |
| R7 | DB 未配置 lao_lou | 使用 registry fallback prompt |
| R8 | prompt 超长 | 保存接口返回字段错误 |

### 8.2 归一化与评分不变量

在 `tests/run-normalized-event.cjs` 增加：

1. 同一个标准 `event` 分别使用6种风格构建 analysis。
2. 六次结果的以下字段必须完全相同：

```text
normalizedEvent
intentDelta
riskDelta
evidenceDelta
eventType
semanticTags
analysisSnapshot.score
```

3. 允许不同的只有：

```text
replyPresentation.labels
rawReply headings
requested/effective style metadata
copy 文案（真实 AI 场景）
```

### 8.3 完整链路回归

在 `tests/run-regression.cjs` 增加：

| # | 场景 | 预期 |
|---|---|---|
| E1 | 用户保存 `lao_lou` | DB 保留该 key |
| E2 | 录入普通事件 | AI prompt 含老娄简短风格说明 |
| E3 | AI 返回 NormalizedEventV1 | 分数按固定策略计算 |
| E4 | assessment 保存 | 有 `replyPresentation` 和 effective key |
| E5 | 首页/详情 API 返回 | presentation 不被过滤 |
| E6 | 用户切回 gentle | 老记录仍显示老娄标题 |
| E7 | 未成年人选择 lao_lou | 保存 requested，运行 effective guardian |
| E8 | AI 失败 fallback | presentation 仍结构合法，评分为零 |
| E9 | 删除其他时间线并重算 | 剩余历史 presentation 不被重写 |
| E10 | 管理员保存新增 style | 原有5种配置和 boldness 不丢失 |

### 8.4 前端验证

| # | 场景 | 预期 |
|---|---|---|
| U1 | “我”页面加载 catalog | 显示6种风格并按 sortOrder 排序 |
| U2 | 选择老娄并刷新 | 仍选中老娄 |
| U3 | 新分析结果 | 显示四个老娄标题 |
| U4 | 首页与时间线 | section 内容一致 |
| U5 | 旧小咪记录 | 正常解析 |
| U6 | 无法解析的旧文本 | 纯文本展示，不丢失 |
| U7 | 风格被后台禁用 | 不再可选，已有用户安全 fallback |
| U8 | API catalog 失败 | 原5种 fallback 可用，页面不报错 |

### 8.5 不在本期变化的回归

必须确认：

- “我请他吃饭，他拒绝了我”仍归一为 `target/rejected/none/none`。
- 老娄风格与温柔风格对该事件计算出相同分数。
- `petLines` 回复温度和后台配置未变化。
- `eventAssessment` 仍使用当前 `eventTemperature`，本功能不写死新参数。
- 旧用户没有 `aiStyle` 时正常 fallback。

---

## 9. 实施顺序

1. **Registry**：完成 B1、测试 R1-R8。
2. **Persona 核心**：完成 B2-B3，删除重复白名单和 normalizer。
3. **结构化展示**：完成 B5-B7，跑 normalized-event 与 regression。
4. **用户和后台 API**：完成 B4、B3 的 catalog 返回与保存校验。
5. **前端 catalog**：完成 F1-F3。
6. **前端 presentation**：完成 F4-F5。
7. **共享同步**：执行 `npm run sync:shared` 和 dry-run。
8. **数据库增量更新**：只补 `lao_lou`，完成只读核验。
9. **构建验证**：H5、微信小程序、App 按项目现有脚本验证。
10. **部署后端**：按第10节顺序部署。
11. **发布前端**：后端 catalog 和保存接口稳定后再发布入口。
12. **线上复测**：完成 E1-E10、U1-U8。

完整本地命令：

```bash
npm run test:persona-style
npm run test:normalized-event
npm run test:regression
npm run sync:shared:dry
npm run build:h5
npm run build:mp-weixin
npm run build:app
```

禁止先发布前端 `lao_lou` 入口再部署 `userProfile` 白名单，否则保存时会被拒绝或清空。

---

## 10. 部署范围与顺序

### 10.1 首批：配置与画像

```text
adminManage
getAISettings
updateAISettings
userProfile
```

目的：先让后端认识 catalog、能读取和保存 `lao_lou`。

### 10.2 第二批：分析主链

```text
generateAssessmentAI
createTimeline
deleteTimeline
```

`generateAssessmentAI` 必须包含同步后的：

```text
persona-style-registry.js
persona-config.js
ai-event.js
normalized-event.js
event-recalculate.js
```

### 10.3 第三批：其他分析类输出

```text
weeklyReview
generateSideRead
```

### 10.4 不需要因本功能部署

```text
petLines
speechToText
contentSecCheck
attachmentAnalysis 相关函数
支付、登录、订阅相关函数
```

共享同步会更新本地副本，但不代表所有函数都必须因本功能上线重新部署。

---

## 11. 验收标准

以下全部满足才算完成：

1. 后端和前端不存在第二份固定 style key 主列表。
2. 新增风格不需要修改 `userProfile`、Admin 页面数组、`api.ts` 联合类型和页面标题正则。
3. `lao_lou` 可选择、保存、刷新后保持。
4. 老娄只改变 `copy` 文案与 section label，不改变事件归一化和评分。
5. 每条新 assessment 保存 `replyPresentation` 和 requested/effective keys。
6. 用户切换风格不会改变历史记录标题。
7. 未成年人请求老娄时，实际使用 `careful_guardian` 并持久化 effective key。
8. 数据库更新没有覆盖原5种 persona、boldness、模型和 runtimeConfig。
9. 首页与时间线不再维护各自的新标题正则；旧记录走唯一兼容 helper。
10. `npm run test:normalized-event`、`npm run test:regression`、新增 persona 测试全部通过。
11. `npm run sync:shared:dry` 不报告本次 canonical 文件未同步。
12. 部署后后台预览能看到 requested/effective 风格和最终四段标题。

### 11.1 文件改动汇总

新增：

```text
cloudfunctions/_shared/persona-style-registry.js
src/utils/reply-presentation.ts
tests/run-persona-style.cjs
scripts/migrate-persona-style-v3.cjs
scripts/verify-persona-style-v3.cjs
```

修改：

```text
cloudfunctions/_shared/persona-config.js
cloudfunctions/_shared/ai-event.js
cloudfunctions/_shared/normalized-event.js
cloudfunctions/_shared/event-recalculate.js
cloudfunctions/adminManage/index.js
cloudfunctions/getAISettings/index.js
cloudfunctions/updateAISettings/index.js
cloudfunctions/userProfile/index.js
cloudfunctions/generateAssessmentAI/index.js
cloudfunctions/deleteTimeline/index.js
cloudfunctions/weeklyReview/index.js
cloudfunctions/generateSideRead/index.js
src/utils/api.ts
src/pages/admin/admin.vue
src/pages/me/me.vue
src/pages/index/index.vue
src/pages/timeline/timeline.vue
tests/run-normalized-event.cjs
tests/run-regression.cjs
package.json
```

`npm run sync:shared` 生成的各云函数 `_shared` 副本属于机械同步文件，应与 canonical 一起提交，但代码审查以 `cloudfunctions/_shared` 为准。

---

## 12. 回滚方案

### 12.1 前端回滚

隐藏 `lao_lou` 入口或将 catalog 中 `enabled=false`。已存用户无需清库，运行时自动 fallback `gentle_bestie`。

### 12.2 后端回滚

1. 保留数据库 `personaConfig.styles.lao_lou` 不影响旧代码。
2. 回滚代码后，旧代码不认识该 key 时会按原有 fallback 处理。
3. 不删除已有 `replyPresentation`；旧客户端仍可读取 `rawReply`。

### 12.3 数据库回滚

一般无需删除 `lao_lou`。如必须下线，只设置：

```text
personaConfig.styles.lao_lou.enabled=false
```

不要整体覆盖 `personaConfig`。

---

## 13. 以后增加其他风格的标准流程

完成本计划后，增加新风格只需要：

1. 在 `STYLE_DEFINITIONS` 增加一条注册项。
2. 运行 registry 单元测试，确认 key 和四段 labels 合法。
3. 通过后台或增量脚本补充该风格 prompt。
4. 执行 `npm run sync:shared`。
5. 部署配置/画像函数和实际使用 persona 的分析函数。
6. 前端从 catalog 自动出现新风格，无需新增页面分支。

如果未来要求“管理员完全不发版就能创建任意新风格”，应另立 v4，将 registry 从代码迁移到受严格校验的数据库 catalog。本期不开放任意 key，避免后台配置错误直接进入安全关键提示词。

---

## 14. 快速提问需求处理

旧 v2 中的“快速提问后台配置”从本计划移除，后续应单独编写：

```text
QUICK-QUESTIONS-CONFIG-DEV-PLAN.md
```

独立计划必须先统一前后端字段：

```javascript
{
  key: 'like',
  label: 'TA喜欢我吗',
  enabled: true,
  sortOrder: 10,
  requiresCustomText: false
}
```

不能继续同时使用数据库 `id`、首页 `value`、快速解读页 `key` 三种名称。该需求不阻塞老娄风格开发。
