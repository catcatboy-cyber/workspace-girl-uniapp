# 老娄 AI 分析风格 MVP 开发计划

> 版本：MVP v1  
> 日期：2026-08-01  
> 状态：可执行  
> 目标执行者：DeepSeek / Codex / 项目开发者  
> 参考资料：`design-previews/SKILL.md`、`design-previews/examples.md`  
> 效果预览：`design-previews/lao-lou-minimal-result.html`

---

## 1. 本期结论

本期不执行 `LAO-LOU-AI-STYLE-DEV-PLAN.md` 中的完整风格注册中心、动态标题、`replyPresentation` 和历史结构迁移。

直接复用项目现有能力：

- 用户已有 `selfProfile.aiStyle`。
- 后台已有 `personaConfig.styles`。
- AI 已返回 `copy.answer / targetMind / nextStep / caution` 四个展示字段。
- 首页和时间线已通过 `rawReply` 展示四段建议。
- 事件语义和评分已经由 `NormalizedEventV1.event` 与代码评分表负责。

本期只完成两项用户可见能力：

1. 新增可选择的 `lao_lou` 分析风格。
2. 当输入与 `examples.md` 中已审核案例高度相似时，四段回复优先使用该案例中的原句。

必须保证：

```text
风格和案例只能改变 copy 文案
不得改变 event 语义字段
不得改变代码评分结果
不得增加第二次 AI 或 Embedding 调用
```

---

## 2. 明确不做

以下内容不属于 MVP：

- 不新增风格注册中心。
- 不新增动态标题生成。
- 不新增 `replyPresentation`。
- 不迁移旧历史记录。
- 不增加向量数据库。
- 不调用 Embedding API。
- 不增加第二次大模型调用。
- 不让后台管理员创建任意新 style key。
- 不改动 `SCORING_POLICY_V1`。
- 不改动事件枚举、主体判断和评分矩阵。
- 不把完整 `examples.md` 注入提示词。
- 不在云函数运行时读取 Markdown 文件。
- 不改 `petLines` 的聊天回复风格。

完整动态风格体系以后根据真实使用效果另立二期。

---

## 3. 当前代码链路

### 3.1 风格链路

```text
src/pages/me/me.vue
  -> 用户选择 aiStyle
  -> cloudfunctions/userProfile/index.js 校验并保存
  -> generateAssessmentAI 读取 selfProfile
  -> _shared/persona-config.js resolvePersona/buildPersonaPrompt
  -> _shared/ai-event.js 注入 eventAssessment prompt
```

现有风格白名单：

```js
[
  'gentle_bestie',
  'calm_strategist',
  'playful_flirty',
  'direct_sharp',
  'careful_guardian'
]
```

MVP 只需在现有白名单增加：

```js
'lao_lou'
```

### 3.2 分析与展示链路

```text
_shared/ai-event.js
  -> AI 返回 NormalizedEventV1
  -> _shared/normalized-event.js 校验 event/copy
  -> 代码根据 event 评分
  -> buildRawReplyFromCopy(copy)
  -> assessment.rawReply
  -> 首页和时间线 parseRawReplySections()
```

现有四段字段继续使用：

| 字段 | 默认标题 | 老娄标题 |
|---|---|---|
| `copy.answer` | 小咪先回答你的问题 | 老娄诊断 |
| `copy.targetMind` | 对方可能在想 | 你的人性课 |
| `copy.nextStep` | 下一步可以这样推进 | 你给我听着 |
| `copy.caution` | 留个心眼 | 老娄最后送你一句话 |

不增加新的 copy 字段。

---

## 4. MVP 技术方案

### 4.1 一次调用完成语义、文案和案例匹配

只有 `effectiveStyle === 'lao_lou'` 时，在当前 AI JSON 顶层增加：

```json
{
  "schemaVersion": 1,
  "event": {},
  "copy": {},
  "styleMatch": {
    "caseKey": "repeated_rejection",
    "matchScore": 0.93,
    "facts": [
      "pursuit_sustained",
      "rejected_three_plus",
      "high_frequency_attention",
      "no_alternative_plan"
    ],
    "hasConflict": false
  }
}
```

非老娄风格继续返回现有 JSON，不要求 `styleMatch`。

`styleMatch` 不是 `NormalizedEventV1.event` 的一部分，不参与评分，也不能导致整个事件协议失败。

### 4.2 不把示例全文放进 prompt

提示词只提供四个案例的紧凑事实指纹：

```text
repeated_betrayal:
  已建立关系；同一对象明确背叛至少两次；用户长期提供主要经济支持；用户仍考虑再给机会。

cold_silence_after_conflict:
  争执后对方失联约14天或以上；用户反复发消息、送礼或上门；对方仍无有效回应。

repeated_rejection:
  持续追求；明确邀约被拒至少3次；用户高频问候、点赞、请客或送礼；对方没有提供替代安排。

financial_overgiving:
  已建立关系；用户承担大部分生活或消费开销；对方继续要求更多消费；用户因害怕分手不敢设边界。
```

这部分控制在约 300 个中文字以内，不注入 `examples.md` 的长篇回答。

### 4.3 “90% 相似”的代码门槛

不得只看模型返回的 `matchScore`。

本 MVP 的 `matchScore` 是同一次大模型根据案例事实指纹返回的“匹配置信度”，不是 Embedding 余弦相似度，也不是数学意义上的真实语义相似率。产品所说的“90% 相似”在本期落地为：

```text
模型匹配置信度 >= 0.90
+ 本地 requiredFacts 全量门槛
+ 无事实冲突
+ 性别和关系角色兼容
```

日志和后台诊断继续使用 `exampleMatchScore` 字段，但文档和代码注释必须说明它是模型匹配置信度。

必须同时满足：

```js
effectiveStyle === 'lao_lou'
&& catalog[caseKey]?.approved === true
&& matchScore >= 0.90
&& hasConflict === false
&& requiredFacts.every((fact) => facts.includes(fact))
&& genderCompatibilityPassed === true
```

任何条件不满足：

```text
保留 AI 本次生成的老娄风格 copy
不得失败
不得回退 unknown
不得影响 event 和评分
```

### 4.4 性别兼容规则

原始 `examples.md` 大量使用“男人/女人/女朋友”等固定称谓，直接复用时必须避免角色错位。

MVP 规则：

- 原句明确包含男性用户和女性对象时，仅允许 `selfProfile.gender=male` 且对象资料明确为 female 时直出。
- 当前项目自我画像主要保存 `male/female`，对象档案可能保存 `男/女/非二元/未说明`；实现时必须先做只读别名归一：`male/男/男生 -> male`，`female/女/女生 -> female`，其他值归为 `unknown`。
- 性别缺失、性别相反或关系角色不一致时，不命中原句库，仍由 AI 生成老娄风格文案。
- MVP 不做自动替换“他/她/男人/女人”，避免产生语法错误，也保证“原句”仍是原句。
- 后续可以新增审核后的性别中性案例，但不属于本期必做。

### 4.5 原句库使用边界

`examples.md` 仅是原始素材，不得整份进入生产 prompt。

生产代码只能包含人工审核通过的短句或短段落：

- 每个 copy 字段最多 160 字，匹配现有 `normalizeCopy` 限制。
- 必须确实出现在 `examples.md` 中。
- 可以选择原案例的一句或数句，不要求复制完整长回答。
- 不允许直出羞辱人格、性别群体贬低、报复、骚扰、故意操控、武断认定他人动机的句子。
- 行动建议不得包含跟踪、堵门、泄露隐私、威胁、违法取回财物等内容。
- 原句不合规时，该字段继续使用 AI 生成结果，不得为了凑齐四段强行复制。

---

## 5. 新增案例目录

新增 canonical 文件：

```text
cloudfunctions/_shared/lao-lou-examples.js
```

建议结构：

```js
const MATCH_THRESHOLD = 0.9

const MATCH_FACTS = [
  'established_relationship',
  'repeated_betrayal',
  'financial_support',
  'considering_another_chance',
  'post_conflict_silence_14d',
  'repeated_contact_attempts',
  'target_still_silent',
  'pursuit_sustained',
  'rejected_three_plus',
  'high_frequency_attention',
  'no_alternative_plan',
  'user_covers_majority_expenses',
  'target_demands_more_spending',
  'user_fears_breakup'
]

const CASES = {
  repeated_betrayal: {
    approved: true,
    requiredFacts: [
      'established_relationship',
      'repeated_betrayal',
      'financial_support',
      'considering_another_chance'
    ],
    selfGender: 'male',
    targetGender: 'female',
    copyOverrides: {
      answer: '背叛只有 0 次和无数次。',
      nextStep: '停止一切金钱付出。别再给她打一分钱。',
      caution: '你原谅第二次，就是告诉对方你可以被无限欺负。'
    }
  },
  cold_silence_after_conflict: {
    approved: true,
    requiredFacts: [
      'established_relationship',
      'post_conflict_silence_14d',
      'repeated_contact_attempts',
      'target_still_silent'
    ],
    selfGender: 'male',
    targetGender: 'female',
    copyOverrides: {
      answer: '你这不是在挽回，你是在给她递刀。你每发一条消息，她就往后退一步。',
      nextStep: '可以吵架可以冷静，但不允许无故失联，再有下次直接结束。',
      caution: '让人一步是风度，步步退让是窝囊。'
    }
  },
  repeated_rejection: {
    approved: true,
    requiredFacts: [
      'pursuit_sustained',
      'rejected_three_plus',
      'high_frequency_attention',
      'no_alternative_plan'
    ],
    selfGender: 'male',
    targetGender: 'female',
    copyOverrides: {
      answer: '约五次全都被拒，你还觉得是自己哪里不够好——这就是你最大的问题。',
      nextStep: '不要再主动约她。',
      caution: '你越是把脸贴上去，她越往后躲。'
    }
  },
  financial_overgiving: {
    approved: true,
    requiredFacts: [
      'established_relationship',
      'user_covers_majority_expenses',
      'target_demands_more_spending',
      'user_fears_breakup'
    ],
    selfGender: 'male',
    targetGender: 'female',
    copyOverrides: {
      nextStep: '从现在开始，停止一切转账、红包、奢侈品。日常生活开销 AA，不再包揽。',
      caution: '你不是她的银行。'
    }
  }
}
```

必须导出：

```js
module.exports = {
  MATCH_THRESHOLD,
  MATCH_FACTS,
  CASES,
  normalizeStyleMatch,
  resolveLaoLouExampleCopy,
  buildLaoLouMatchInstruction
}
```

### 5.1 `normalizeStyleMatch()`

职责：

- 非对象返回 `caseKey='none'`。
- 非法 `caseKey` 返回 `none`。
- `matchScore` 限制到 `0..1`。
- `facts` 只保留 `MATCH_FACTS`，去重且最多 6 个。
- `hasConflict` 只接受严格布尔值，否则按 `true` 处理。
- 此函数永远不得抛错。

### 5.2 `resolveLaoLouExampleCopy()`

输入：

```js
{
  effectiveStyle,
  styleMatch,
  selfProfile,
  caseProfile,
  aiCopy
}
```

输出：

```js
{
  copy,
  copySource: 'ai_generated' | 'example_exact',
  exampleCaseKey: '',
  exampleMatchScore: 0
}
```

只有全部门槛通过才用：

```js
  copy = {
  ...aiCopy,
  ...catalogCase.copyOverrides
}
```

只覆盖 `copyOverrides` 中实际存在且非空的字段：

```text
answer / targetMind / nextStep / caution
```

不得覆盖：

```text
title / summary / reason / petLine / petMood / event
```

允许案例只配置其中 1 至 4 个字段。没有审核通过原句的字段继续使用 AI 生成结果，不得为了凑齐四段复制不合适的内容。

### 5.3 首批允许直出的原句

开发时必须使用下表内容，不得由开发者临时自行选择其他原句。

| caseKey | 字段 | 首批原句 |
|---|---|---|
| `repeated_betrayal` | `answer` | 背叛只有 0 次和无数次。 |
| `repeated_betrayal` | `nextStep` | 停止一切金钱付出。别再给她打一分钱。 |
| `repeated_betrayal` | `caution` | 你原谅第二次，就是告诉对方你可以被无限欺负。 |
| `cold_silence_after_conflict` | `answer` | 你这不是在挽回，你是在给她递刀。你每发一条消息，她就往后退一步。 |
| `cold_silence_after_conflict` | `nextStep` | 可以吵架可以冷静，但不允许无故失联，再有下次直接结束。 |
| `cold_silence_after_conflict` | `caution` | 让人一步是风度，步步退让是窝囊。 |
| `repeated_rejection` | `answer` | 约五次全都被拒，你还觉得是自己哪里不够好——这就是你最大的问题。 |
| `repeated_rejection` | `nextStep` | 不要再主动约她。 |
| `repeated_rejection` | `caution` | 你越是把脸贴上去，她越往后躲。 |
| `financial_overgiving` | `nextStep` | 从现在开始，停止一切转账、红包、奢侈品。日常生活开销 AA，不再包揽。 |
| `financial_overgiving` | `caution` | 你不是她的银行。 |

没有列出的字段由 AI 按老娄风格生成。

以上句子必须在测试中与 `examples.md` 做空白归一后的逐字核对。以后新增原句必须先修改本计划或建立单独的内容审核清单，并补测试；不得只改数据库提示词绕过审核。

---

## 6. Prompt 修改

修改：

```text
cloudfunctions/_shared/ai-event.js
```

### 6.1 `persona-config.js` 返回有效风格 key

修改 `resolvePersona()` 返回值，补充：

```js
requestedStyle,
effectiveStyle,
requestedBoldness,
effectiveBoldness
```

修改 `buildPersonaPrompt()` 返回值，补充：

```js
effectiveStyle: persona.effectiveStyle
```

未成年人仍强制：

```text
effectiveStyle=careful_guardian
effectiveBoldness=conservative
```

因此未成年人即使请求 `lao_lou`，也不会进入案例匹配和老娄文案。

### 6.2 条件式输出协议

把：

```js
buildSchemaInstruction()
```

改为：

```js
buildSchemaInstruction({ includeStyleMatch = false })
```

当 `includeStyleMatch=false` 时，输出协议与现在完全一致。

当 `includeStyleMatch=true` 时，追加：

```text
styleMatch={caseKey,matchScore,facts,hasConflict}。
caseKey 只能是 none/repeated_betrayal/cold_silence_after_conflict/repeated_rejection/financial_overgiving。
只有原文和上下文明确满足案例全部必要事实、无冲突时，matchScore 才允许 >=0.90；否则返回 none 或低于0.90。
styleMatch 只用于选择展示文案，不得影响 event。
```

`buildLaoLouMatchInstruction()` 必须由 `lao-lou-examples.js` 根据 `CASES` 和 `MATCH_FACTS` 构建，不能在 `ai-event.js` 再维护第二份 case key、事实枚举或 required facts。

生成的指令必须明确列出：

- 合法 `caseKey`。
- 合法 `facts` 枚举。
- 每个案例的全部 `requiredFacts`。
- 只有必要事实全部明确出现且没有冲突时，才允许返回该 `caseKey` 和 `matchScore >= 0.90`。
- 不确定、信息缺失或只满足部分事实时返回 `caseKey=none`、`hasConflict=true` 或低于 0.90。

### 6.3 风格提示词底线

后台 `lao_lou.promptZh` 使用：

```text
只改变 answer、targetMind、nextStep、caution 四个展示字段，不改变 event、评分、title、summary、reason、petLine、petMood。用直白、口语化、有节奏的老娄式表达：诊断、事实逻辑、明确动作、收尾金句。可以犀利，但禁止羞辱、性别贬低、操控、报复、骚扰和武断猜测动机。
```

长度必须保持在当前后台允许的 260 字以内。

### 6.4 应用原句的时机

处理顺序必须是：

```text
AI 返回原始 JSON
  -> parseJSONContent
  -> normalizeNormalizedEventV1 校验 event 和 AI copy
  -> 单独 normalizeStyleMatch(parsed.styleMatch)
  -> resolveLaoLouExampleCopy 覆盖该案例已审核的 copy 字段
  -> buildAnalysisFromNormalizedEvent
  -> 代码评分
```

禁止先覆盖 copy 再执行 `normalizeNormalizedEventV1`，否则原句可能被意外截断且难以区分错误来源。

`lao-lou-examples.js` 自身必须在测试中保证所有字段不超过 160 字。

### 6.5 `effectiveStyle` 完整传递链

不得只修改 `buildPersonaPrompt()` 返回值，必须把有效风格一直传到最终 rawReply 构建。

`buildEventAssessmentMessages(params)` 按以下方式修改：

```js
function buildEventAssessmentMessages(params) {
  const settings = normalizeSettings(params.settings)
  const personaPrompt = buildPersonaPrompt(params.settings, params.selfProfile, {
    boundarySensitive: isBoundarySensitiveEvent(params.event)
  })
  const includeStyleMatch = personaPrompt.effectiveStyle === 'lao_lou'

  const messages = buildPromptMessages({
    moduleKey: 'eventAssessment',
    settings: params.settings,
    systemExtra: personaPrompt.systemPrompt,
    contextLines: [
      personaPrompt.userPrompt,
      buildSemanticInstruction(params.event?.inputSubjectRole),
      buildSchemaInstruction({ includeStyleMatch }),
      includeStyleMatch ? buildLaoLouMatchInstruction() : '',
      // 保留现有问题、画像、身份、时间线和当前事件上下文
    ].filter(Boolean)
  })

  return {
    settings,
    messages,
    effectiveStyle: personaPrompt.effectiveStyle
  }
}
```

`analyzeTimelineEvent(params)` 必须按以下数据流处理：

```js
const { settings, messages, effectiveStyle } = buildEventAssessmentMessages(params)

// 完成现有 HTTP、JSON 解析和 NormalizedEventV1 校验后：
const styleMatch = normalizeStyleMatch(parsed.styleMatch)
const copyResolution = resolveLaoLouExampleCopy({
  effectiveStyle,
  styleMatch,
  selfProfile: params.selfProfile,
  caseProfile: params.caseProfile,
  aiCopy: normalized.value.copy
})

const normalizedWithResolvedCopy = {
  ...normalized.value,
  copy: copyResolution.copy
}

return buildAnalysisFromNormalizedEvent(normalizedWithResolvedCopy, {
  warnings: normalized.warnings,
  aiProvider: settings.provider,
  aiModel: data?.model || settings.model,
  tokenUsage: data?.usage || null,
  replyStyleKey: effectiveStyle,
  copySource: copyResolution.copySource,
  exampleCaseKey: copyResolution.exampleCaseKey,
  exampleMatchScore: copyResolution.exampleMatchScore
})
```

约束：

- `effectiveStyle` 缺失时按空字符串处理，继续走默认标题和 AI copy。
- 非老娄风格即使模型意外返回 `styleMatch`，`resolveLaoLouExampleCopy()` 也必须忽略。
- `styleMatch` 解析失败只影响案例直出，不得影响已经通过的 `NormalizedEventV1`。
- 不允许直接修改 `normalized.value.copy` 原对象，使用新对象便于测试和排查。

### 6.6 后台只读输出协议同步

修改：

```text
cloudfunctions/_shared/prompt-admin-view.js
cloudfunctions/getAISettings/index.js
cloudfunctions/updateAISettings/index.js
cloudfunctions/adminManage/index.js
```

`eventAssessment.outputContract` 在现有协议后追加：

```text
老娄有效风格时可额外返回顶层 styleMatch={caseKey,matchScore,facts,hasConflict}；styleMatch 不属于 NormalizedEventV1，不参与事件校验和评分，异常时只放弃案例原句。
```

后台“固定输出结构（只读）”必须显示该说明，避免管理员误以为数据库业务规则或固定结构需要手工填写 `styleMatch`。

---

## 7. 固定四段标题

修改：

```text
cloudfunctions/_shared/normalized-event.js
```

增加：

```js
const RAW_REPLY_LABELS = {
  default: [
    '小咪先回答你的问题',
    '对方可能在想',
    '下一步可以这样推进',
    '留个心眼'
  ],
  lao_lou: [
    '老娄诊断',
    '你的人性课',
    '你给我听着',
    '老娄最后送你一句话'
  ]
}
```

修改函数：

```js
buildRawReplyFromCopy(copy, styleKey = '')
```

规则：

```js
const labels = styleKey === 'lao_lou'
  ? RAW_REPLY_LABELS.lao_lou
  : RAW_REPLY_LABELS.default
```

修改：

```js
buildAnalysisFromNormalizedEvent(normalized, meta)
```

使用：

```js
rawReply: buildRawReplyFromCopy(copy, meta.replyStyleKey)
```

同时返回诊断字段：

```js
copySource: ['ai_generated', 'example_exact', 'fallback'].includes(meta.copySource)
  ? meta.copySource
  : 'ai_generated',
exampleCaseKey: clean diagnostic case key or '',
exampleMatchScore: clamped 0..1 number
```

这样标题直接写进 `rawReply`，现有数据库字段和历史展示链路都能继续使用，不需要新历史结构。

---

## 8. 前端最小修改

### 8.1 用户风格入口

修改：

```text
src/utils/api.ts
src/pages/me/me.vue
```

`AIStyleValue` 增加：

```ts
| 'lao_lou'
```

`aiStyleOptions` 增加：

```ts
{
  value: 'lao_lou',
  label: '老娄拆解',
  description: '直白拆事实、讲人性、给动作，犀利但不羞辱。'
}
```

不新增独立页面，不新增风格详情弹窗。

### 8.2 后台风格配置

修改：

```text
src/pages/admin/admin.vue
```

`personaStyleKeys` 增加 `lao_lou`。

`personaStyleTitles` 增加：

```ts
lao_lou: '老娄拆解'
```

继续复用现有四个后台字段：

```text
labelZh / labelEn / promptZh / promptEn
```

不增加 `enabled / sortOrder / descriptionZh`。

### 8.3 首页和时间线解析标题

修改：

```text
src/pages/index/index.vue
src/pages/timeline/timeline.vue
```

两个 `parseRawReplySections()` 必须同时兼容两套标题：

```js
const labelSets = [
  ['小咪先回答你的问题', '对方可能在想', '下一步可以这样推进', '留个心眼'],
  ['老娄诊断', '你的人性课', '你给我听着', '老娄最后送你一句话']
]
```

解析时选择实际命中的一套标题，并保留原标题展示。

禁止把老娄标题统一转换回默认标题，否则用户看不到风格差异。

旧 `rawReply` 继续正常解析，不做数据库迁移。

两个页面的 `normalizeRawReplyText()` 对对象格式的处理也必须同步支持两套标题，不能只改字符串解析器。

对象格式兼容逻辑：

```js
const allLabels = labelSets.flat()
return allLabels
  .map((label) => {
    const text = normalizeRawReplyText(value[label])
    return text ? `${label}：${text}` : ''
  })
  .filter(Boolean)
  .join('\n')
  .trim()
```

测试必须覆盖：

- `rawReply` 为普通字符串。
- `rawReply` 为老娄标题字符串。
- `rawReply` 为默认标题对象。
- `rawReply` 为老娄标题对象。

---

## 9. 后端白名单修改

以下位置全部增加 `lao_lou`：

```text
cloudfunctions/_shared/persona-config.js
cloudfunctions/userProfile/index.js
cloudfunctions/getAISettings/index.js
cloudfunctions/updateAISettings/index.js
cloudfunctions/adminManage/index.js
```

还需修改 `adminManage/index.js` 中本地预览使用的 `PERSONA_STYLE_KEYS` 和 `resolvePreviewPersona()` 链路。

本期不重构这些重复白名单，只做一致性修改。完整去重属于二期。

---

## 10. 保存诊断字段

为了线上判断是否真的命中案例，在 assessment 增加三个非必填字段：

```js
copySource: 'ai_generated' | 'example_exact' | 'fallback',
exampleCaseKey: '',
exampleMatchScore: 0
```

修改：

```text
cloudfunctions/_shared/normalized-event.js
cloudfunctions/_shared/event-recalculate.js
```

`buildAnalysisFromNormalizedEvent()` 返回上述字段。

`buildAssessmentFromAnalysis()` 原样写入 assessment。

`buildFallbackAnalysis()` 必须显式返回 `copySource='fallback'`，不得把 AI 调用失败后的保守文案误标成 `ai_generated`。

### 10.1 同时保存到触发事件

当前 `deleteTimeline` 会根据 `timeline_records.analysisSnapshot` 重建评估，而现有回放代码把 `rawReply` 固定为空。如果只把老娄文案保存在 assessment，删除任意时间线记录后，其他历史评估的老娄标题和原句会丢失。

因此修改：

```text
cloudfunctions/generateAssessmentAI/index.js
```

在更新触发事件的 `timelineUpdate` 中增加：

```js
rawReply: recalculated.rawReply || '',
copySource: ['ai_generated', 'example_exact', 'fallback'].includes(recalculated.copySource)
  ? recalculated.copySource
  : 'fallback',
exampleCaseKey: recalculated.exampleCaseKey || '',
exampleMatchScore: Number(recalculated.exampleMatchScore || 0)
```

这些字段是事件分析快照的一部分，只用于历史回放，不参与评分。

### 10.2 删除后的回放恢复

修改：

```text
cloudfunctions/_shared/event-recalculate.js
cloudfunctions/deleteTimeline/index.js（由 sync:shared 获得副本）
```

`replayAssessmentFromEvent()` 构建 analysis 时使用：

```js
rawReply: typeof event.rawReply === 'string' ? event.rawReply : '',
copySource: ['ai_generated', 'example_exact', 'fallback'].includes(event.copySource)
  ? event.copySource
  : 'fallback',
exampleCaseKey: typeof event.exampleCaseKey === 'string' ? event.exampleCaseKey : '',
exampleMatchScore: clampToZeroOne(event.exampleMatchScore)
```

`buildAssessmentFromAnalysis()` 再把这些字段写入重建后的 assessment。

旧事件没有这些字段时安全回退为空，不报错、不迁移旧数据。

不新增集合，不新增索引，不影响旧记录。

建议日志增加：

```js
console.log('[lao-lou example match]', JSON.stringify({
  caseKey,
  matchScore,
  copySource,
  effectiveStyle
}))
```

日志不得包含用户完整原文和完整示例答案。

---

## 11. 数据库配置

数据库文档：

```text
collection: system_settings
document: settings_global_ai
field: personaConfig.styles.lao_lou
```

新增值：

```json
{
  "labelZh": "老娄拆解",
  "labelEn": "Lao Lou",
  "promptZh": "只改变 answer、targetMind、nextStep、caution 四个展示字段，不改变 event、评分、title、summary、reason、petLine、petMood。用直白、口语化、有节奏的老娄式表达：诊断、事实逻辑、明确动作、收尾金句。可以犀利，但禁止羞辱、性别贬低、操控、报复、骚扰和武断猜测动机。",
  "promptEn": "Change only answer, targetMind, nextStep and caution; never event, scores, title, summary, reason, petLine or petMood. Be direct and rhythmic: diagnose, explain facts, give clear action, end with one line. No humiliation, gender disparagement, manipulation, retaliation, harassment or invented motives."
}
```

必须遵守：

- 先部署支持 `lao_lou` 白名单的后台云函数，再通过后台填写并保存。
- 保存前刷新后台，确认页面已经显示“老娄拆解”。
- 不整体覆盖 `personaConfig`。
- 不覆盖原五种 `styles`。
- 不覆盖 `boldness`。
- 不修改 `runtimeConfig.eventTemperature`。
- 不修改模型、API Key、Max Tokens 和其他 prompt module。

本期不需要数据库迁移脚本，直接复用后台保存能力即可。

---

## 12. 文件修改清单

### 12.1 新增

```text
cloudfunctions/_shared/lao-lou-examples.js
tests/run-lao-lou-style.cjs
```

### 12.2 修改 canonical 和业务文件

```text
cloudfunctions/_shared/persona-config.js
cloudfunctions/_shared/ai-event.js
cloudfunctions/_shared/normalized-event.js
cloudfunctions/_shared/event-recalculate.js
cloudfunctions/_shared/prompt-admin-view.js
cloudfunctions/userProfile/index.js
cloudfunctions/getAISettings/index.js
cloudfunctions/updateAISettings/index.js
cloudfunctions/adminManage/index.js
cloudfunctions/generateAssessmentAI/index.js
src/utils/api.ts
src/pages/me/me.vue
src/pages/admin/admin.vue
src/pages/index/index.vue
src/pages/timeline/timeline.vue
package.json
```

### 12.3 机械同步文件

执行：

```bash
npm run sync:shared
```

该命令会更新多个云函数目录中的 `_shared` 副本。代码审计以：

```text
cloudfunctions/_shared
```

为准，副本不得手工分别修改。

---

## 13. 测试要求

新增：

```json
"test:lao-lou-style": "node tests/run-lao-lou-style.cjs"
```

### 13.1 案例目录测试

必须覆盖：

1. 四个 case key 唯一且合法。
2. 每个 `approved=true` 案例的 `requiredFacts` 都在允许枚举中。
3. 每个 `approved=true` 案例至少配置一个 `copyOverrides` 字段。
4. 每个已配置字段都是非空字符串且不超过 160 字。
5. 对 `copyOverrides` 文本进行空白归一后，每个直出句子都能在 `design-previews/examples.md` 找到，证明是原句而不是模型改写。
6. 禁止词和禁止行动扫描通过。

### 13.2 匹配门槛测试

必须覆盖：

| 场景 | 结果 |
|---|---|
| 老娄 + 0.91 + 全 facts + 无冲突 + 性别匹配 | `example_exact` |
| 老娄 + 0.89 | `ai_generated` |
| 老娄 + 0.99 但缺 required fact | `ai_generated` |
| 老娄 + 0.99 但 `hasConflict=true` | `ai_generated` |
| 老娄 + 非法 case key | `ai_generated` |
| 老娄 + 性别不匹配 | `ai_generated` |
| 默认风格 + 1.0 | `ai_generated` |
| 未成年人请求老娄 | 实际 `careful_guardian`，不命中 |
| styleMatch 缺失或格式错误 | 正常使用 AI copy，事件不失败 |

四个案例必须各自至少有一组“完整 required facts 命中”和一组“缺一个 required fact 不命中”的测试，禁止只测试 `repeated_rejection`。

### 13.3 语义和评分回归

必须确认：

```text
“我请他吃饭，他拒绝了我”
-> actor=target
-> interaction=rejected
-> commitmentStatus=none
-> intentDelta=-11
-> riskDelta=+14
-> evidenceDelta=+2
```

默认风格与老娄风格必须产生完全相同的：

```text
normalizedEvent
analysisSnapshot.event
intentDelta
riskDelta
evidenceDelta
scoringPolicyVersion
```

该测试必须使用“同一份已经归一化的 event/copy fixture”，分别传入默认 `replyStyleKey` 和 `lao_lou`，验证样式层不会修改语义与评分。此离线测试不比较两次真实模型调用的自然语言随机差异。

对同一 fixture，仅允许以下字段不同：

```text
rawReply
copySource
exampleCaseKey
exampleMatchScore
```

老娄 prompt 还必须明确：风格重点只作用于 `answer/targetMind/nextStep/caution`；`title/summary/reason/petLine/petMood` 保持简短、事实化和中性，不得因老娄风格改变事件主体或评分依据。

### 13.4 标题解析回归

首页和时间线分别验证：

- 默认四段标题解析为 4 项。
- 老娄四段标题解析为 4 项。
- 老记录缺少新字段时正常显示。
- 不允许整个老娄回复降级成单个“回复建议”段落。
- 默认标题对象能归一化为字符串并解析为 4 项。
- 老娄标题对象能归一化为字符串并解析为 4 项。

### 13.5 删除回放回归

构造带以下字段的 timeline event：

```js
{
  rawReply: '老娄诊断：...\n\n你的人性课：...\n\n你给我听着：...\n\n老娄最后送你一句话：...',
  copySource: 'example_exact',
  exampleCaseKey: 'repeated_rejection',
  exampleMatchScore: 0.93,
  analysisSnapshot: validSnapshot
}
```

调用 `replayAssessmentFromEvent()` 后必须保持：

```text
rawReply 完全一致
copySource=example_exact
exampleCaseKey=repeated_rejection
exampleMatchScore=0.93
```

再增加旧事件缺少上述字段的测试，预期安全回退为空或默认值。

### 13.6 后台协议回归

验证 canonical `MODULE_OUTPUT_CONTRACTS.eventAssessment` 以及 `getAISettings/updateAISettings/adminManage` 实际返回的后台只读结构都包含可选 `styleMatch` 说明。

### 13.7 完整命令

```bash
npm run test:lao-lou-style
npm run test:normalized-event
npm run test:regression
npm run sync:shared:dry
npm run build:h5
npm run build:mp-weixin
npm run build:app
```

---

## 14. 部署顺序

### 第一步：代码与测试

1. 完成案例目录和单元测试。
2. 完成 canonical `_shared` 修改。
3. 完成前后端白名单和页面修改。
4. 执行 `npm run sync:shared`。
5. 跑完第 13.7 节全部验证。

### 第二步：先部署配置链路

```text
adminManage
getAISettings
updateAISettings
userProfile
```

目的：后台能识别、显示、保存 `lao_lou`，用户资料接口也不再拒绝该值。

### 第三步：填写数据库配置

1. 打开后台 AI 配置页并刷新。
2. 确认出现“老娄拆解”。
3. 只填写第 11 节四个字段。
4. 保存后重新读取，确认原五种风格、boldness、模型和 runtimeConfig 均未变化。

### 第四步：部署分析链路

```text
generateAssessmentAI
deleteTimeline
weeklyReview
generateSideRead
```

说明：

- `generateAssessmentAI` 使用案例匹配与老娄固定标题。
- `deleteTimeline` 携带同步后的回放逻辑。
- `weeklyReview` 和 `generateSideRead` 已经使用 persona prompt；必须同步认识 `lao_lou`，否则同一用户不同分析入口风格会不一致。
- `createTimeline` 本身只创建 pending 记录，本功能无新增逻辑，不要求因本功能单独部署。

### 第五步：发布前端

发布支持 `lao_lou` 的用户选择页、后台页、首页和时间线。

禁止先发布前端入口再部署 `userProfile`，否则保存 `lao_lou` 会被旧白名单拒绝。

---

## 15. 验收用例

### U1：普通老娄生成

输入：

```text
我第一次请他吃饭，他拒绝了我。
```

预期：

- 不命中 `repeated_rejection`。
- `copySource=ai_generated`。
- AI 用老娄语气生成四段。
- 标题显示老娄四段标题。
- 分数仍是 `-11/+14/+2`。

### U2：90% 以上多次拒绝案例

输入必须明确包含：持续追求、至少三次邀约被拒、高频关注或投入、对方没有替代安排。

预期：

- `caseKey=repeated_rejection`。
- `matchScore>=0.90`。
- required facts 全部满足。
- 性别匹配时 `copySource=example_exact`。
- 四段中配置为直出的字段与 `examples.md` 逐字一致。
- event 和评分不受案例文案影响。

### U3：看起来相似但事实不足

输入：

```text
她最近有点冷，我昨天约她，她说这周加班，下周再说。
```

预期：

- 不得命中 `repeated_rejection` 或 `cold_silence_after_conflict`。
- 保留 AI 生成 copy。
- 不得输出“五次全拒”“半个月失联”等原案例事实。

### U4：非老娄风格

同一输入选择 `gentle_bestie`。

预期：

- 不要求 AI 返回 styleMatch。
- 不应用案例原句。
- 使用默认标题。
- 评分与老娄风格一致。

### U5：未成年人

未成年人选择老娄。

预期：

- `effectiveStyle=careful_guardian`。
- 不应用案例原句。
- 只输出边界、安全和健康沟通建议。

### U6：历史显示

1. 生成一条老娄分析。
2. 切换为其他风格。
3. 打开时间线查看之前记录。

预期：

- 老记录仍显示当时写入 `rawReply` 的老娄四段标题。
- 不依赖用户当前风格重新解释历史。
- 无需 `replyPresentation`。

继续执行：

1. 新增另一条普通记录。
2. 删除这条普通记录，触发 `deleteTimeline` 重建。
3. 再次查看之前的老娄分析。

预期：

- 老娄 `rawReply`、四段标题和原句保持不变。
- `copySource/exampleCaseKey/exampleMatchScore` 保持不变。
- 删除重建不会把老娄历史降级为空回复。

---

## 16. 失败处理

| 失败点 | 处理 |
|---|---|
| AI 未返回 styleMatch | 使用 AI copy，不报错 |
| styleMatch JSON 不合法 | 归一为 none，不报错 |
| matchScore 不足 | 使用 AI copy |
| required facts 不全 | 使用 AI copy |
| 案例未审核 | 使用 AI copy |
| 性别不兼容 | 使用 AI copy |
| 案例字段超长 | 测试失败，禁止部署 |
| event/copy 主协议错误 | 沿用现有 unknown + 零分保守兜底 |
| 数据库没有 lao_lou 配置 | 风格 prompt 为空，但程序不崩溃；发布验收必须阻止上线 |

关键原则：

```text
案例匹配失败不等于 AI 分析失败
不得因为 styleMatch 问题把整条事件保存成 unknown 和零分
```

---

## 17. 回滚方案

最小回滚：

1. 在前端隐藏 `lao_lou` 选项。
2. 数据库保留 `personaConfig.styles.lao_lou`，旧代码会忽略未知字段。
3. 或将其四个配置字段清空。
4. 已生成的 `rawReply` 保留，不删除历史。
5. `copySource/exampleCaseKey/exampleMatchScore` 为非必填字段，不影响旧代码。

不需要数据库回滚和历史数据清理。

---

## 18. 完成标准

以下全部满足才算开发完成：

1. 用户可以选择并保存 `lao_lou`。
2. 后台可以配置并正确读回 `lao_lou` 四个字段。
3. 老娄只改变文案，不改变语义和评分。
4. 一次 AI 调用完成分析和案例匹配，没有额外 Embedding 调用。
5. 只有分数、必要事实、冲突和性别门槛全部通过时才使用原句。
6. 直出句子能在测试中证明来自 `examples.md`。
7. 普通相似但事实不足的输入不会误套重话。
8. `styleMatch` 异常不会导致整条事件失败。
9. 首页和时间线都显示老娄四段标题。
10. 删除其他时间线记录触发回放后，老娄 rawReply 和案例诊断字段仍然保留。
11. 后台固定输出结构正确说明可选 styleMatch，且无需管理员手工配置该字段。
12. 旧记录和旧用户正常使用，不需要数据迁移。
13. 未成年人保护不被老娄风格绕过。
14. normalized-event、regression 和三端构建全部通过。

达到以上标准后，本 MVP 即可上线收集真实反馈；动态标题、结构化历史和开放式风格注册中心根据数据再决定是否进入二期。
