# 老娄布道 AI 风格 + 快速提问可配置 — 完整实现方案 v2

> 上一版被代码审查打回。本版覆盖全部白名单、完整调用链、安全覆盖、历史兼容。

---

## 0. 架构原则

### 0.1 单一风格注册源

当前问题：`STYLE_KEYS` 在 `_shared/persona-config.js`、`userProfile/index.js`、`adminManage/index.js`、`getAISettings/index.js`、`updateAISettings/index.js`、`api.ts` **六处独立定义**。加一个风格要改六处，极容易漏。

**改为**：`STYLE_KEYS` 只在 `_shared/persona-config.js` 定义，其他文件通过 `require('./_shared/persona-config')` 引用。若某文件无法引用 `_shared`（如前端 `api.ts`），则独立维护但必须在本方案改动清单中显式列出。

### 0.2 `effectiveStyleKey` 统一控制

`resolvePersona()` 已经处理了未成年人覆盖。但当前**只返回 `style` 对象（prompt 文案），不返回最终生效的 style key**。导致下游代码无法判断"这个请求最终用了哪个风格"，只能读用户原始 `aiStyle`，从而绕过安全覆盖。

**改为**：`resolvePersona()` 返回值新增 `effectiveStyleKey` 字段。所有下游逻辑（输出标签、prompt 构建、格式解析）只能读取 `effectiveStyleKey`，不能读取用户原始 `aiStyle`。

### 0.3 输出标签配置化

当前前端硬编码四段标签。改为从后端获取，或在前端定义 `OUTPUT_LABELS` 映射表，按 `effectiveStyleKey` 查找。历史记录使用存储时的 `replySchemaVersion` 或自动识别，不因用户切换风格而解析错误。

---

## 1. 老娄风格定义（不变）

```
【老娄诊断】→【你的人性课】→【你给我听着】→【老娄最后送你一句话】
```

Persona 特征、口头禅、场景速查表、红线同上一版。

---

## 2. 完整改动清单

### 2.1 后端共享层（`_shared/`）

| # | 文件 | 改动 | 说明 |
|---|------|------|------|
| **S1** | `_shared/persona-config.js` | `STYLE_KEYS` 加 `'lao_lou'`；`resolvePersona()` 返回值加 `effectiveStyleKey` | **核心改动**，所有其他文件引用此处 |
| **S2** | `_shared/lao-lou-prompt.js` | **新建**。导出 `buildLaoLouPrompt()` 和 `LAO_LOU_LABELS`（四段标签数组） | 风格 prompt 和标签集中管理 |

**S1 详细改动**：

```javascript
// persona-config.js

// 改前
const STYLE_KEYS = ['gentle_bestie', 'calm_strategist', 'playful_flirty', 'direct_sharp', 'careful_guardian']

// 改后
const STYLE_KEYS = ['gentle_bestie', 'calm_strategist', 'playful_flirty', 'direct_sharp', 'careful_guardian', 'lao_lou']

// resolvePersona 返回值改前
return {
  isMinor, boundarySensitive,
  style: personaConfig.styles[effectiveStyle] || createEmptyPersonaItem(),
  boldness: personaConfig.boldness[effectiveBoldness] || createEmptyPersonaItem()
}

// resolvePersona 返回值改后
return {
  effectiveStyleKey: effectiveStyle,    // ← 新增
  effectiveBoldnessKey: effectiveBoldness,  // ← 新增
  isMinor, boundarySensitive,
  style: personaConfig.styles[effectiveStyle] || createEmptyPersonaItem(),
  boldness: personaConfig.boldness[effectiveBoldness] || createEmptyPersonaItem()
}
```

**S2 内容**：

```javascript
// _shared/lao-lou-prompt.js

const LAO_LOU_LABELS = ['老娄诊断', '你的人性课', '你给我听着', '老娄最后送你一句话']

function buildLaoLouPrompt() {
  return {
    role: `你是老娄——山东情感布道者..."`,
    rules: [ /* 四段输出、口头禅、糙话、市井类比、禁止软话 */ ],
    redlines: [ /* 6 条红线 */ ]
  }
}
```

### 2.2 后端独立白名单（各自定义 `PERSONA_STYLE_KEYS` 的云函数）

这些文件各自有独立的 `PERSONA_STYLE_KEYS` 常量，不是从 `_shared` 引用的。需要逐一修改。

| # | 文件 | 行号 | 改动 |
|---|------|------|------|
| **S3** | `adminManage/index.js` | 44 | `PERSONA_STYLE_KEYS` 加 `'lao_lou'` |
| **S4** | `getAISettings/index.js` | 84 | `PERSONA_STYLE_KEYS` 加 `'lao_lou'` |
| **S5** | `updateAISettings/index.js` | 41 | `PERSONA_STYLE_KEYS` 加 `'lao_lou'` |

每处都是数组最后加一个元素，无需改其他逻辑——这些文件的 `normalize` 函数遍历 `PERSONA_STYLE_KEYS` 时自动包含新 key。

### 2.3 用户画像保存

| # | 文件 | 行号 | 改动 |
|---|------|------|------|
| **S6** | `userProfile/index.js` | 31 | `AI_STYLES` Set 加 `'lao_lou'` |

```diff
  const AI_STYLES = new Set([
    '',
    'gentle_bestie', 'calm_strategist', 'playful_flirty', 'direct_sharp', 'careful_guardian',
+   'lao_lou'
  ])
```

加在空字符串后面（空字符串是合法的"未设置"值），`has()` 校验自动通过。

### 2.4 AI 分析核心链（`ai-event.js`）

这是最复杂的改动。当前问题：

1. `normalizeRawReply()` 没有 `aiStyle` 参数
2. `ensureDirectRawReplySection()` 硬编码"小咪先回答你的问题："
3. 第 456 行 prompt 硬编码四段小咪标题
4. 第 526 行调用链没有传递风格

| # | 改动点 | 行号 | 说明 |
|---|--------|------|------|
| **S7** | `getOutputLabels(effectiveStyleKey)` | 43 | 新增函数，返回对应风格的四段标签数组 |
| **S8** | `normalizeRawReply(value, effectiveStyleKey)` | 23 | 函数签名加参数，内部 `labels` 改为 `getOutputLabels(effectiveStyleKey)` |
| **S9** | `ensureDirectRawReplySection(rawReply, event, effectiveStyleKey)` | 65 | 老娄风格跳过"先回答你的问题"逻辑 |
| **S10** | prompt 构建（456 行） | 456 | `rawReply must use exactly four headings` 改为读取 `getOutputLabels(effectiveStyleKey)` 动态生成 |
| **S11** | 主调用入口 | ~520 | 接收 `effectiveStyleKey`，传给上述函数。老娄风格额外注入 `lao-lou-prompt.js` 的 role + rules |

**S7 实现**：

```javascript
const DEFAULT_LABELS = ['小咪先回答你的问题', '对方可能在想', '下一步可以这样推进', '留个心眼']

function getOutputLabels(effectiveStyleKey) {
  if (effectiveStyleKey === 'lao_lou') {
    return ['老娄诊断', '你的人性课', '你给我听着', '老娄最后送你一句话']
  }
  return DEFAULT_LABELS
}
```

### 2.5 generateAssessmentAI

该云函数**不使用 `_shared/ai-event.js`**，有独立的 AI 调用链。需要确认它是否输出 `rawReply` 以及格式。当前该函数通过 `postChatCompletions` 直接调用 AI，返回结果存入 `assessments`。

| # | 文件 | 改动 | 说明 |
|---|------|------|------|
| **S12** | `generateAssessmentAI/index.js` | 如果它也在 prompt 里指定了输出格式，需要同步修改 | 待核实后确定 |

**首期策略**：generateAssessmentAI 的 AI 调用走的是 `buildPromptMessages`（`_shared/ai-prompt-config.js`），该函数已通过 `persona-config.js` 注入风格。检查确认 prompt 中是否有硬编码的四段标题，如有则改为从 `getOutputLabels()` 动态生成。

### 2.6 前端

| # | 文件 | 行号 | 改动 |
|---|------|------|------|
| **S13** | `src/utils/api.ts` | 439-441 | `AIStyleValue` 类型加 `| 'lao_lou'` |
| **S14** | `src/pages/me/me.vue` | — | `aiStyleOptions` 加一项 |
| **S15** | `src/pages/index/index.vue` | 784, 802, 816 | 三处硬编码 labels 改为调用 `getOutputLabels()`，`parseRawReplySections()` 的 label 列表和正则动态生成 |
| **S16** | `src/pages/timeline/timeline.vue` | 268, 721 | 两处硬编码 labels 改为从共享工具函数获取 |

**S15 核心思路**：

```javascript
// 新建 src/utils/reply-labels.js（前端版标签配置，与后端保持一致）
export const REPLY_LABELS = {
  default: ['小咪先回答你的问题', '对方可能在想', '下一步可以这样推进', '留个心眼'],
  lao_lou: ['老娄诊断', '你的人性课', '你给我听着', '老娄最后送你一句话']
}

export function getReplyLabels(effectiveStyleKey) {
  return REPLY_LABELS[effectiveStyleKey] || REPLY_LABELS.default
}
```

`normalizeRawReplyText()` 和 `parseRawReplySections()` 改为从 `getReplyLabels()` 取标签列表和正则。

### 2.7 历史兼容

| # | 文件 | 改动 |
|---|------|------|
| **S17** | `ai-event.js` 的 `normalizeRawReply` | 如果 JSON 对象里没有老娄标签也没有小咪标签 → fallback 到 `default` 标签尝试解析 |
| **S18** | `index.vue` / `timeline.vue` | `parseRawReplySections()` 增加自动识别逻辑：先试当前风格的标签，解析失败则用默认标签重试 |

这样历史记录（用小咪标签存的）在老娄风格下也能正常展示。

---

## 3. 同步与部署

### 3.1 共享代码同步

`_shared/` 目录的修改需要同步到所有引用它的云函数目录。项目有同步脚本：

```bash
npm run sync:shared
```

部署前必须执行。新增的 `lao-lou-prompt.js` 如果漏掉同步，部署包会缺模块报错。

受影响需要同步的云函数目录：`createCase`、`createTimeline`、`generateAssessmentAI`、`generateSideRead`、`adminManage`、`userProfile`、`getAISettings`、`updateAISettings`、`reassess` 等（通过 `scripts/sync-shared.js` 配置的完整列表）。

### 3.2 需要部署的云函数

| 云函数 | 原因 |
|--------|------|
| `userProfile` | `AI_STYLES` Set 更新 |
| `adminManage` | `PERSONA_STYLE_KEYS` 更新 + 问题配置 action |
| `getAISettings` | `PERSONA_STYLE_KEYS` 更新 |
| `updateAISettings` | `PERSONA_STYLE_KEYS` 更新 |
| `generateAssessmentAI` | prompt 格式动态化 |

其他引用 `_shared/persona-config.js` 的云函数不强制部署（它们不直接使用 `STYLE_KEYS`），但为安全建议全量部署。

---

## 4. 快速提问后台配置（独立需求）

### 4.1 数据模型

```javascript
// system_settings._id: 'settings_quick_questions'
{
  questions: [
    { id: 'like', label: '他喜欢我吗', enabled: true, sortOrder: 1 },
    // ...
    { id: 'custom', label: '其他问题', enabled: true, sortOrder: 99 }
  ]
}
```

### 4.2 改动清单

| # | 文件 | 改动 |
|---|------|------|
| **Q1** | `adminManage/index.js` | 新增 `action: 'getQuickQuestions'` + `action: 'updateQuickQuestions'` |
| **Q2** | `src/utils/api.ts` | 新增 `getQuickQuestions()` |
| **Q3** | `src/pages/admin/components/panels/QuickQuestionsPanel.vue` | **新建**，增删改开关排序 |
| **Q4** | `src/pages/admin/admin.vue` | 侧边栏 + 引入新面板 |
| **Q5** | `src/pages/index/index.vue` | `quickQuestionOptions` 改为从 API 取，hardcoded fallback |
| **Q6** | `src/pages/quick-read/quick-read.vue` | `questionOptions` 改为从 API 取，hardcoded fallback |

---

## 5. 验证矩阵

### 5.1 老娄风格

| # | 测试场景 | 预期 |
|---|---------|------|
| T1 | 切换到老娄风格 → 保存 → 刷新"我"页面 | 风格保持为老娄，不回退 |
| T2 | 老娄风格下记录互动 → 触发 AI 分析 | 输出四段【老娄诊断】【你的人性课】【你给我听着】【老娄最后送你一句话】 |
| T3 | 首页信号卡片展示老娄分析结果 | 四段正常渲染，非降级纯文本 |
| T4 | 时间线展开事件详情 | 老娄四段正常渲染 |
| T5 | 切回温柔陪伴风格 → 记录互动 | 恢复小咪四段式，不受老娄影响 |
| T6 | 历史记录（小咪标签存的）在老娄风格下查看 | 自动识别旧标签，正常展示 |
| T7 | 未成年人 + 老娄风格 → 记录互动 | Persona 强制切为 careful_guardian，输出仍为小咪四段 |
| T8 | Admin 面板编辑老娄 prompt → 保存 | 不丢失、不回退 |
| T9 | Admin 面板查看 persona 配置列表 | 老娄出现在 6 种风格中 |
| T10 | 模型返回的对象、字符串、旧标题、新标题、缺失标题 | 全部正确解析或 fallback |
| T11 | 原有 5 种风格各测一条 | 无回归 |
| T12 | 输出安全检查 | grep 确认无"留着当免费保姆""先搞大肚子""打出来的媳妇"等红线内容 |

### 5.2 快速提问

| # | 测试场景 | 预期 |
|---|---------|------|
| T13 | Admin 添加问题 → 首页快速记录 | 新问题出现 |
| T14 | Admin 禁用问题 → 首页 | 该问题消失 |
| T15 | Admin 改排序 → 首页 | 顺序正确 |
| T16 | API 挂了 | fallback 到 hardcoded 默认列表，不影响用户 |

---

## 6. 文件汇总

### 老娄风格（12 文件）

```
_shared/persona-config.js          ← STYLE_KEYS + resolvePersona 加 effectiveStyleKey
_shared/lao-lou-prompt.js          ← 新建
_shared/ai-event.js                ← normalizeRawReply 加参数 + prompt 动态化
adminManage/index.js               ← PERSONA_STYLE_KEYS +1
getAISettings/index.js             ← PERSONA_STYLE_KEYS +1
updateAISettings/index.js          ← PERSONA_STYLE_KEYS +1
userProfile/index.js               ← AI_STYLES Set +1
generateAssessmentAI/index.js      ← prompt 动态化（待核实）
src/utils/api.ts                   ← AIStyleValue 类型 +1
src/utils/reply-labels.js          ← 新建，前端标签映射表
src/pages/me/me.vue                ← aiStyleOptions +1
src/pages/index/index.vue          ← 三处 labels 动态化
src/pages/timeline/timeline.vue    ← 两处 labels 动态化
```

### 快速提问（6 文件）

```
adminManage/index.js               ← getQuickQuestions + updateQuickQuestions
src/utils/api.ts                   ← getQuickQuestions()
src/pages/admin/components/panels/QuickQuestionsPanel.vue  ← 新建
src/pages/admin/admin.vue          ← 侧边栏入口
src/pages/index/index.vue          ← quickQuestionOptions 从 API 取
src/pages/quick-read/quick-read.vue ← questionOptions 从 API 取
```

---

## 7. 工时估算

| 阶段 | 工时 |
|------|------|
| 后端共享层（S1-S2） | 1h |
| 后端白名单（S3-S6） | 30min |
| ai-event.js 核心链（S7-S11） | 2h |
| generateAssessmentAI（S12） | 30min |
| 前端（S13-S16） | 1.5h |
| 历史兼容（S17-S18） | 30min |
| 同步 + 部署 | 30min |
| 快速提问（Q1-Q6） | 1.5h |
| 验证矩阵 T1-T16 | 2h |
| **合计** | **~10h** |

---

## 8. 开发顺序

1. **S1-S2**（共享层）→ `npm run sync:shared` 验证
2. **S3-S6**（白名单）→ 逐个部署验证
3. **S7-S11**（ai-event 核心链）→ 单元测试
4. **S13**（前端 reply-labels.js）→ 单元测试
5. **S15-S16**（前端页面）→ `npm run dev:h5` 验证
6. **S17-S18**（历史兼容）→ 用旧数据验证
7. **Q1-Q6**（快速提问）→ Admin 面板验证
8. 全量部署 → 跑 T1-T16 测试矩阵
