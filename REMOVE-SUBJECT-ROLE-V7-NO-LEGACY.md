# 去掉 subjectRole 手动选择 — 实现方案 v7（不考虑旧数据）

## Context

承接 v1-v6。本轮核心简化：**不迁移、不回填、不重新推断旧记录。** 直接启用新协议。

这里的“不考虑旧数据”只表示不保证旧记录重新获得准确的主体判断，**不表示允许旧账号升级后报错**。旧账号使用新版前后端时必须满足：

- 首页、档案页、时间线可以正常打开；
- 旧记录缺少 `inputSubjectRole`、`subjectRoleSource` 时允许按 `undefined` 读取；
- 数据库残留的 `subjectRoleConfidence` 由新版代码忽略，不要求清库；
- 旧记录已有合法 `subjectRole` 时继续使用原值；缺失或非法值在读取/重算边界归一为 `unknown`；
- 新增记录只走新协议，旧记录不做批量迁移；
- 删除历史记录触发重算时不得丢失剩余记录的主体字段。

---

## 0. 数据模型

```
inputSubjectRole       subjectRole            subjectRoleSource
─────────────────     ────────────────        ──────────────────────
前端发送               后端强制生成             后端状态

'unspecified'         'target'               'ai_inferred'
'both'                'self'                 'fallback_unknown'
                       'both'                 'pending'
                       'unknown'
```

---

## 1. 核心架构：提示词所有权

**DB promptModules.eventAssessment.rules 是唯一所有者。**

关键认识：`buildPromptMessages()`（`ai-prompt-config.js:112`）**已经自动把 DB 的 rules 注入 prompt**。代码不需要再读同一份数据追加。

### 1.1 三层分工

| 层 | 来源 | 内容 |
|----|------|------|
| **DB rules** | `promptModules.eventAssessment.businessPrompt.rules` | 主体识别规则（管理员可改）→ 由 `buildPromptMessages` 自动注入 |
| **代码 fallback** | `DEFAULT_SUBJECT_RULES` | DB 为空时的兜底 → 由 `buildSubjectPrompt` 注入 contextLines |
| **代码标记** | `buildSubjectPrompt` | both 模式追加"这是聊天记录" |

**关键：DB 有规则时代码不重复注入。只当 DB 为空时才补默认值。**

### 1.2 DB 默认规则（部署时写入，从现有代码提取一条不丢）

```
规则1：请自行从原文区分三层信息——
  ① 对方实际做了什么/说了什么（只有这层能影响意向分和风险分）
  ② 用户自己做了什么/说了什么（作为背景参考，不直接作为对方信号）
  ③ 用户的感受/猜测/情绪（仅供参考，不进入对方评分）

规则2：不要把用户的穿着、化妆、准备、情绪、表达当成对方释放的信号。
  "我主动问对方/我问他/我问她/我问对方"表示用户主动向关系对象提问，
  不能写成对方主动问用户。
  只有"对方问我/他问我/她问我/问我"才表示关系对象主动问用户。

规则3：如果原文无法确定行为主体，请弱化权重。
  除非文本明确写出对方回应、承诺、兑现、回避或失约，
  否则不要提高或降低对方意向/风险。

规则4：仅根据用户提供的事实、事件上下文和画像字段判断；
  不要编造没有出现的行为、承诺、情绪或关系状态。
```

**Admin 保存校验**：规则必须包含三条关键约束（区分对方/用户/感受 + 只有对方行为可改分 + 主体不明时弱化），否则拒绝保存并提示。

### 1.3 代码只做 fallback + 结构性标记

以下实现只保留在 canonical `cloudfunctions/_shared/subject-role-prompt.js`，并导出 `DEFAULT_SUBJECT_RULES`、`getSubjectRulesFromDB`、`buildSubjectPrompt`。`ai-event.js`、`event-understanding.js`、`adminManage` 只导入调用，不各自复制一份。

```javascript
// getSubjectRulesFromDB 必须正确处理 { zh, en }[] 格式
function getSubjectRulesFromDB(settings) {
  const module = normalizeBusinessPrompt(settings, 'eventAssessment')
  if (!module?.rules?.length) return ''
  return module.rules
    .map(item => typeof item === 'string' ? item : (item.zh || item.en || ''))
    .filter(Boolean)
    .join('\n')
}

function buildSubjectPrompt(inputSubjectRole, settings, activeModuleKey = 'eventAssessment') {
  const dbRules = getSubjectRulesFromDB(settings)
  const parts = []

  // eventAssessment 的 DB rules 会被 buildPromptMessages 自动注入，不能再拼一次。
  // 其他模块不会自动获得 eventAssessment.rules，需要从唯一所有者跨模块注入一次。
  if (!dbRules) {
    parts.push(Array.isArray(DEFAULT_SUBJECT_RULES)
      ? DEFAULT_SUBJECT_RULES.join('\n')
      : String(DEFAULT_SUBJECT_RULES || ''))
  } else if (activeModuleKey !== 'eventAssessment') {
    parts.push(dbRules)
  }

  // both 模式追加聊天标记（始终由代码追加）
  if (inputSubjectRole === 'both') {
    parts.push('这是微信对话记录。请拆分双方各自说了什么。')
  }

  return parts.join('\n')
}
```

**最终 prompt 中主体规则只出现一次**：

- `eventAssessment`：DB 有 → 由 `buildPromptMessages` 放在业务规则区；DB 无 → helper 在运行时上下文区放 fallback；
- `eventUnderstanding` 等其他模块：不会自动获得 `eventAssessment.rules`，由 helper 从唯一所有者跨模块放入运行时上下文区；
- `both` 标记始终由 helper 追加。

---

## 2. 改动清单

### 2.1 前端 `src/pages/index/index.vue`

| # | 改动 |
|---|------|
| **F1** | 删除 `subjectRoleOptions` 和三个 role-chip 按钮 |
| **F2** | `quickSubjectRole` → `quickInputSubjectRole`，类型 `'unspecified' \| 'both'`，默认 `'unspecified'` |
| **F3** | 删除 `quickSubjectRoleConfidence` 变量和所有引用 |
| **F4** | 新增 `chatDetectionDismissed: string` |
| **F5** | `inferInputSubjectRole(text)`：检测微信聊天格式（`\n` + 时间戳）。`chatDetectionDismissed === text` 时跳过 |
| **F6** | `onQuickDescInput` 中调 `inferInputSubjectRole`，both 时自动切 |
| **F7** | 合并提示区：只 both 时显示"已识别为聊天记录 · [不是聊天记录]" |
| **F8** | 昵称输入区仅 `quickInputSubjectRole === 'both'` 时渲染 |
| **F9** | `quickDescPlaceholder` 统一占位文案 |
| **F10** | 发送时只传 `inputSubjectRole` |
| **F11** | 本地乐观记录：`{ subjectRole: 'unknown', inputSubjectRole, subjectRoleSource: 'pending' }` |
| **F12** | 提交后重置 |

### 2.2 前端 `src/pages/quick-read/quick-read.vue`

| # | 改动 |
|---|------|
| **F13** | 删除 `subjectRole: 'target'` 和 `subjectRoleConfidence: 'confirmed'`，改为 `inputSubjectRole: 'unspecified'` |

### 2.3 前端 `src/utils/api.ts`

| # | 改动 |
|---|------|
| **F14** | `createTimeline` 参数新增 `inputSubjectRole: 'unspecified' \| 'both'`（**必填**） |
| **F15** | 从 `createTimeline` 参数类型删除 `subjectRole`、`subjectRoleConfidence`；调用方、本地乐观记录、重置逻辑和缓存中的 `subjectRoleConfidence` 由 F3/F13 一并清除 |
| **F16** | `normalizeTimelineRecord()` 做只读归一：合法 `subjectRole` 原样保留，缺失/非法值转为 `unknown`；新字段缺失时保留为 `undefined`。这不写回数据库，只保证旧账号打开安全 |

### 2.4 后端 `createTimeline/index.js`

| # | 改动 |
|---|------|
| **B1** | 新增 `normalizeInputSubjectRole(v)`：`'unspecified' \| 'both'`，fallback `'unspecified'` |
| **B2** | 客户端传入的 `subjectRole` 完全忽略；读取已有记录时使用 `normalizeStoredSubjectRole(v)`，合法值保留，缺失/非法值 fallback `'unknown'`（不加 unspecified） |
| **B3** | `subjectRole` 强制 `'unknown'`，`subjectRoleSource` 强制 `'pending'` |
| **B4** | 删除 `normalizeSubjectRoleConfidence()` 函数（67 行）+ 所有读写（169/213/222/267/279/368/420 行） |
| **B5** | `inferTimelineRecord` 传入 `inputSubjectRole`、`subjectRoleSource` |

### 2.5 后端 `generateAssessmentAI/index.js`

| # | 改动 |
|---|------|
| **B6** | 删除 `normalizeSubjectRoleConfidence()` 函数（40 行）+ compactTimelineItem 删该字段 |
| **B7** | `compactTimelineItem()` 读取 `inputSubjectRole` + `subjectRoleSource`；其中 stored subjectRole 的 normalizer 从非法值 fallback target 改为 fallback unknown |
| **B8** | 保证 `triggerEvent`、`recentTimeline` 将 `subjectRole`、`inputSubjectRole`、`subjectRoleSource` 传入共享重算链路；本文件不自行重复拼 prompt |
| **B9** | AI 成功且 `eventInsight.actor` 是 `target/self/both/unknown` 之一 → 原样持久化 actor，`source='ai_inferred'`；AI 明确返回 unknown 也属于成功推断 |
| **B10** | AI 请求失败、解析失败或 actor 非法/缺失 → `subjectRole='unknown', source='fallback_unknown'` |
| **B11** | 更新 timeline_records：subjectRole + subjectRoleSource |

### 2.6 后端 `deleteTimeline/index.js`

删除一条记录会清空并重建该档案的评估和时间线，因此这里必须显式保留主体字段。仅在部署列表里写 `deleteTimeline` 不足以完成改造。

| # | 改动 |
|---|------|
| **B12** | `recentTimeline` 映射增加 `subjectRole`、`inputSubjectRole`、`subjectRoleSource` |
| **B13** | 传给 `recalculateAssessmentFromEvent` 的 `event` 增加 `subjectRole`、`inputSubjectRole`、`subjectRoleSource` |
| **B14** | 重建旧记录时：合法 `subjectRole` 保留；缺失/非法值归一为 `unknown`；缺失 `inputSubjectRole`、`subjectRoleSource` 不抛错，也不能仅因字段缺失就把合法旧 `subjectRole` 中性化 |

建议使用统一的读取归一函数，避免 `deleteTimeline` 和 `generateAssessmentAI` 判断不一致：

```javascript
function normalizeStoredSubjectRole(value) {
  return ['target', 'self', 'both', 'unknown'].includes(value) ? value : 'unknown'
}

function normalizeOptionalInputSubjectRole(value) {
  return ['unspecified', 'both'].includes(value) ? value : undefined
}

function normalizeOptionalSubjectRoleSource(value) {
  return ['pending', 'ai_inferred', 'fallback_unknown'].includes(value) ? value : undefined
}
```

`recentTimeline` 和当前 `event` 两处都使用同一映射片段：

```javascript
subjectRole: normalizeStoredSubjectRole(item.subjectRole),
inputSubjectRole: normalizeOptionalInputSubjectRole(item.inputSubjectRole),
subjectRoleSource: normalizeOptionalSubjectRoleSource(item.subjectRoleSource)
```

当前事件对象中的 `item` 替换为 `manualEvent`。不得通过 `Boolean(inputSubjectRole)`、`hasInputSubjectRole` 或字段是否存在来判断新旧记录。

### 2.7 后端 `_shared/ai-event.js`

| # | 改动 |
|---|------|
| **B15** | 从 canonical `subject-role-prompt.js` 导入并调用 `buildSubjectPrompt(inputSubjectRole, settings, 'eventAssessment')`；本模块的 DB rules 已自动注入，helper 不得重复返回它们 |
| **B16** | **删除** `describeSubjectRole`（117-127 行） |
| **B17** | **删除** 459 行独立 contextLine（"主体宾语校验…"） |
| **B18** | 评分保护：只看 `eventInsight.actor`。actor=self → 三项归零；actor=unknown → 低权重 |
| **B19** | `hasExplicitTargetReaction()` 在 actor=self 时直接返回 false |
| **B20** | `fallbackAnalysis(event)` 内部计算 `isUnresolved`：未确认 → neutral downgrade；已确认 → 按 subjectRole；不得把布尔值当作 event 传入 |

### 2.8 后端 `_shared/event-understanding.js`

| # | 改动 |
|---|------|
| **B21** | 从 canonical `subject-role-prompt.js` 导入并调用 `buildSubjectPrompt(inputSubjectRole, settings, 'eventUnderstanding')`；helper 从 `eventAssessment.rules` 唯一所有者跨模块注入一次 |
| **B22** | **删除** `describeSubjectRole`（43-54 行） |
| **B23** | **删除** 286 行独立 contextLine |
| **B24** | 文件内两处 subjectRole 归一的非法值 fallback 从 `target` 改为 `unknown`；initiator 在 unknown 时返回 `'unknown'` |
| **B25** | promisedBy：subjectRole 为 unknown → `'unknown'` |
| **B26** | isWeakContext：subjectRole 为 unknown → true |

### 2.9 后端 `adminManage/index.js`

| # | 改动 |
|---|------|
| **B27** | 从同步后的 `./_shared/subject-role-prompt` 导入 `buildSubjectPrompt`，预览链路必须传入当前预览的 `activeModuleKey`，分别模拟 eventAssessment 自动注入和跨模块注入 |
| **B28** | **删除** `describeSubjectRole`（630-640 行） |
| **B29** | 预览事件改为：`inputSubjectRole: 'unspecified'`、`subjectRole: 'unknown'`、`subjectRoleSource: 'pending'` |
| **B30** | `normalizePromptAdminView`：`guardrails`/`runtimeContext`/`outputContract` 全部派生；同步更新 `PROMPT_FIXED_GUARDRAILS` 和 `getRuntimePreview()` 中的 subjectRole/inputSubjectRole/subjectRoleSource 字段说明 + 四段 rawReply 结构 |

### 2.10 旧的 AI 设置函数

`src/utils/api.ts` 仍保留 `getAISettings`、`updateAISettings` 接口。若对应云函数继续部署或仍可能被调用，不能让它们保留另一套过期的 `promptAdminView` / runtime preview 生成逻辑。

| # | 改动 |
|---|------|
| **B31** | 新建 canonical `cloudfunctions/_shared/prompt-admin-view.js`，集中导出管理视图、固定 guardrails、runtime preview、字段说明和四段 `rawReply` contract 的派生函数；`adminManage`、`getAISettings`、`updateAISettings` 全部改为调用该 helper，并删除各自重复实现 |

### 2.11 下游消费者

| # | 文件 | 改动 |
|---|------|------|
| **B32** | `src/utils/insights.js:1136` | 对方侧白名单：`role === 'target' \|\| role === 'both'`；undefined/非法值同 unknown，不能算对方侧 |
| **B33** | `src/utils/insights.js:1413` | subjectRole 为 unknown/undefined/非法值 → 通用建议，不再 fallback 为 target |
| **B34** | `src/pages/timeline/timeline.vue:36` | 只有 `target/self/both` 才渲染主体标签；unknown/undefined/非法值不渲染空标签框 |

---

## 3. 核心伪代码

### buildSubjectPrompt

```javascript
function buildSubjectPrompt(inputSubjectRole, settings, activeModuleKey = 'eventAssessment') {
  const dbRules = getSubjectRulesFromDB(settings)
  const parts = []

  // eventAssessment.rules 仅在 activeModuleKey=eventAssessment 时由
  // buildPromptMessages 自动注入；其他模块需要从唯一所有者跨模块注入。
  if (!dbRules) {
    parts.push(Array.isArray(DEFAULT_SUBJECT_RULES)
      ? DEFAULT_SUBJECT_RULES.join('\n')
      : String(DEFAULT_SUBJECT_RULES || ''))
  } else if (activeModuleKey !== 'eventAssessment') {
    parts.push(dbRules)
  }

  if (inputSubjectRole === 'both') {
    parts.push('这是微信对话记录。请拆分双方各自说了什么。')
  }

  return parts.join('\n')
}
```

禁止调用方在 helper 之外再次拼 DB rules。`eventAssessment` 由 `buildPromptMessages` 自动注入一次；其他模块由 helper 从 `eventAssessment.rules` 跨模块注入一次；DB 缺失时才使用代码 fallback。

### createTimeline 协议

```javascript
const inputSubjectRole = normalizeInputSubjectRole(event.inputSubjectRole)
const subjectRole = 'unknown'
const subjectRoleSource = 'pending'
// subjectRoleConfidence 不持久化
```

### 评分保护

```javascript
const actor = analysis.eventInsight?.actor
if (actor === 'self') {
  return { intentDelta: 0, riskDelta: 0, evidenceDelta: 0 }
}
if (actor === 'unknown') { /* 低权重 */ }
```

### fallback 降级

```javascript
function fallbackAnalysis(event) {
  const role = normalizeStoredSubjectRole(event.subjectRole)
  const isUnresolved =
    role === 'unknown' ||
    event.subjectRoleSource === 'pending' ||
    event.subjectRoleSource === 'fallback_unknown'

  if (isUnresolved) {
    return neutralFallback()  // eventType='note', 评分不变, actor='unknown'
  }

  // 已确认：将归一后的 role 写回本地 event，继续执行当前函数既有的
  // self/target/both 分类与评分分支，不需要新增第二套 fallback 函数。
  event = { ...event, subjectRole: role }
  // ...保留现有 resolved fallback 主体...
}
```

特别注意：旧记录缺少 `subjectRoleSource` 时，`undefined` 本身不代表 unresolved。只要旧记录的 `subjectRole` 是合法的 `target/self/both`，规则重算仍按该值执行。

---

## 4. 文件汇总

| # | 文件 | 改动量 |
|---|------|--------|
| F1-F12 | `src/pages/index/index.vue` | 删 ~40 行，重写 ~45 行 |
| F13 | `src/pages/quick-read/quick-read.vue` | ~3 行 |
| F14-F16 | `src/utils/api.ts` | ~10 行 |
| B1-B5 | `cloudfunctions/createTimeline/index.js` | ~15 行 |
| B6-B11 | `cloudfunctions/generateAssessmentAI/index.js` | ~20 行 |
| B12-B14 | `cloudfunctions/deleteTimeline/index.js` | ~12 行 |
| 1.3 | `cloudfunctions/_shared/subject-role-prompt.js` | 新增主体规则 fallback 与聊天结构标记的唯一实现 |
| B15-B20 | `cloudfunctions/_shared/ai-event.js` | ~25 行（含删除） |
| B21-B26 | `cloudfunctions/_shared/event-understanding.js` | ~12 行（含删除） |
| B27-B30 | `cloudfunctions/adminManage/index.js` | ~15 行（含删除） |
| B31 | `cloudfunctions/_shared/prompt-admin-view.js` + `cloudfunctions/getAISettings/index.js` + `cloudfunctions/updateAISettings/index.js` | 集中并删除重复派生逻辑 |
| B32-B34 | `src/utils/insights.js` + `src/pages/timeline/timeline.vue` | ~8 行 |

**15 个 canonical/业务源文件；执行 `sync:shared` 后会同步更新各云函数的 `_shared` 副本。以实际 diff 为准，不以估算行数作为验收条件。**

---

## 5. 部署

```
1. 备份数据库 promptModules.eventAssessment
2. 修改 canonical cloudfunctions/_shared/
3. npm run sync:shared && npm run sync:shared:dry
4. tcb fn deploy createTimeline          ← 逐个部署
5. tcb fn deploy generateAssessmentAI
6. tcb fn deploy deleteTimeline
7. tcb fn deploy adminManage
8. tcb fn deploy getAISettings
9. tcb fn deploy updateAISettings
10. 数据库写入四条默认规则 + Admin 保存校验
11. Admin 保存 → 重建 promptAdminView → 检查实际 prompt
12. npm run build:mp-weixin
```

**先部署代码，再改数据库**。如果先改 DB，旧代码仍会附加原有的 describeSubjectRole 指令，造成短暂双重注入。

每个云函数部署后先做一次最小调用验证，再部署下一个。不得假设 CLI 支持一次传入多个函数名；除非先用当前 CLI 版本验证过该语法。

---

## 6. 验证

| # | 测试 | 验收标准 |
|---|------|---------|
| T1 | 新记录 → createTimeline | subjectRole='unknown', source='pending' |
| T2 | AI 返回 actor=self | subjectRole→'self'，评分归零 |
| T3 | AI 返回 actor=target | subjectRole→'target'，保留评分 |
| T4 | AI 请求/解析失败或 actor 非法 | subjectRole='unknown'、source='fallback_unknown'，安全降级 |
| T4.1 | AI 成功返回 actor=unknown | subjectRole='unknown'、source='ai_inferred'；按不明确主体低权重处理，不误标为 AI 失败 |
| T5 | AI 已解析的新记录 → deleteTimeline 重算 → AI 不可用 | 按已保存的 subjectRole fallback；不得仅因仍有 inputSubjectRole 就中性化 |
| T6 | eventAssessment + both prompt | DB 规则只在业务规则区出现 1 次，运行时只追加“聊天记录”标记 |
| T7 | eventUnderstanding + unspecified prompt | eventAssessment DB 主体规则跨模块注入运行时上下文 1 次 |
| T8 | DB 规则为空 | fallback 到 DEFAULT_SUBJECT_RULES |
| T9 | eventAssessment/eventUnderstanding/Admin 实际 prompt | 每个 prompt 的主体规则均只出现 1 次 |
| T10 | 下游 unknown | 不算对方侧 |
| T11 | timeline unknown | 不渲染标签框 |
| T12 | 撤销聊天检测 | 失焦不重复识别 |
| T13 | 旧账号打开首页、档案页、时间线 | 旧记录缺少 inputSubjectRole/subjectRoleSource 时正常加载，无前端异常、无云函数异常 |
| T14 | 旧记录主体显示 | 合法 target/self/both 沿用原值；缺失/非法 subjectRole 按 unknown 处理且不显示空标签框 |
| T15 | 旧账号继续新增记录 | 新记录使用新三字段协议；旧记录不迁移、不回填 |
| T16 | 旧账号删除一条历史记录 | 重算不报错；剩余记录的三个主体字段不被映射层丢弃；合法旧 subjectRole 不被误中性化 |
| T17 | 旧库残留 subjectRoleConfidence | 新版直接忽略，不要求清理字段，不影响打开和新增记录 |
| T18 | Admin/getAISettings/updateAISettings 预览一致性 | 三个入口返回相同 guardrails、runtime 字段说明和四段 rawReply contract |

---

## 7. v6 → v7 简化了什么

| 删除 | 原因 |
|------|------|
| `hasInputSubjectRole` 协议识别 | 统一新协议，不区分新旧 |
| `describeSubjectRole` 保留旧四分支 | 直接删除 3 份副本 |
| `subjectRoleConfidence` 所有逻辑 | 新协议不存此字段 |
| `subjectRoleSource: 'legacy'` | 不需要 |
| `buildSubjectPrompt` 旧记录分支 | 不注入"历史标注仅供参考" |
| `fallbackAnalysis` 新旧分叉 | 一套逻辑 |
| `normalizeSubjectRoleConfidence` | 直接删函数 |
| 旧数据迁移、回填和重新推断任务 | 不需要；仅保留“旧账号不崩溃”的读取与操作冒烟测试 |
