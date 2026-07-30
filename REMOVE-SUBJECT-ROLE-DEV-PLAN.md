# 去掉 subjectRole 手动选择 — 实现方案 v6

## Context

同前。本轮核心架构决策：**所有主体识别规则以 DB 为准，代码只做结构性拼接。** 保证不重复、不丢失现有提示词。

---

## 0. 数据模型

```
inputSubjectRole       subjectRole            subjectRoleSource
─────────────────     ────────────────        ──────────────────────
前端发送（新协议）     后端强制生成             后端状态

'unspecified'         'target'               'ai_inferred'
'both'                'self'                 'fallback_unknown'
                       'both'                 'legacy'
                       'unknown'              'pending'
```

---

## 1. 核心架构：提示词所有权

### 1.1 唯一所有者

| 所有者 | 内容 | 可修改方式 |
|--------|------|-----------|
| **DB promptModules.eventAssessment** | 主体识别规则、主宾语示例、"只有对方行为才能改分"、评分依据 | Admin 面板随时改 |
| **代码 buildSubjectPrompt()** | 结构性拼接：both 模式追加"这是聊天记录"；旧记录注入 `subjectRole` 历史标注 | 部署 |

**规则：DB 有就用 DB，DB 为空则代码 fallback 默认值。**

### 1.2 不丢失现有提示词 — 完整迁出清单

当前硬编码在四个位置。全部提取，整合为一份 DB 规则：

| 来源 | 行号 | 内容摘要 | 处理 |
|------|------|---------|------|
| `_shared/ai-event.js` | 117-127 | describeSubjectRole 四个分支（self/both/unknown/target） | **删除代码，内容整合入 DB** |
| `_shared/event-understanding.js` | 43-54 | 同上副本 | **删除代码** |
| `adminManage/index.js` | 630-640 | 同上副本 | **删除代码** |
| `_shared/ai-event.js` | 459 | 独立 contextLine："我主动问对方…表示用户主动…不是对方主动" | **删除代码，内容整合入 DB** |
| `_shared/event-understanding.js` | 286 | 同上副本 | **删除代码** |

**整合后的 DB 默认规则**（从以上 5 处提取，一条不丢）：

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

### 1.3 代码只做结构性拼接

```javascript
function buildSubjectPrompt(inputSubjectRole, subjectRole) {
  // 从 DB 读取主体规则（DB 为空则用上面默认值）
  const rules = getSubjectRulesFromDB() || DEFAULT_SUBJECT_RULES

  // both 模式追加聊天标记
  if (inputSubjectRole === 'both') {
    return rules + '\n这是微信对话记录。请拆分双方各自说了什么。'
  }

  // 旧记录注入 subjectRole 历史标注（仅供参考，不指令 AI 怎么读）
  if (inputSubjectRole === undefined && subjectRole) {
    return rules + `\n历史标注的主体类型: ${subjectRole}（仅供参考，请以原文为准）`
  }

  return rules
}
```

**关键：旧记录的 `subjectRole` 降级为"历史标注仅供参考"，不再是指令。**

### 1.4 DB 默认值写入

部署时通过云函数初始化或 Admin 面板手动操作，将 1.2 节整合后的规则写入 `promptModules.eventAssessment.rules`。同时清理 DB 中旧的重复杂规则（"必须区分对方、用户、双方""不要把'我觉得他喜欢我'当作对方主动"等——这些已被整合进新规则）。

---

## 2. 改动清单

### 2.1 前端 `src/pages/index/index.vue`

| # | 改动 |
|---|------|
| **F1** | 删除 `subjectRoleOptions` 和三个 role-chip 按钮 |
| **F2** | `quickSubjectRole` → `quickInputSubjectRole`，类型 `'unspecified' \| 'both'`，默认 `'unspecified'` |
| **F3** | 删除 `quickSubjectRoleConfidence` 变量和所有引用 |
| **F4** | 新增 `chatDetectionDismissed: string` |
| **F5** | `inferInputSubjectRole(text)`：检测微信聊天格式。`chatDetectionDismissed === text` 时跳过 |
| **F6** | `onQuickDescInput` 中调 `inferInputSubjectRole`，both 时自动切 |
| **F7** | 合并提示区：只 both 时显示"已识别为聊天记录 · [不是聊天记录]" |
| **F8** | 昵称输入区仅 `quickInputSubjectRole === 'both'` 时渲染 |
| **F9** | `quickDescPlaceholder` 统一占位文案 |
| **F10** | 发送时只传 `inputSubjectRole`，不传 subjectRole/source/confidence |
| **F11** | 本地乐观记录：`{ subjectRole: 'unknown', inputSubjectRole, subjectRoleSource: 'pending' }` |
| **F12** | 提交后重置 |

### 2.2 前端 `src/pages/quick-read/quick-read.vue`

| # | 改动 |
|---|------|
| **F13** | `subjectRole: 'target'` 改为 `inputSubjectRole: 'unspecified'`（426 行） |

### 2.3 前端 `src/utils/api.ts`

| # | 改动 |
|---|------|
| **F14** | `createTimeline` 参数新增 `inputSubjectRole?: 'unspecified' \| 'both'` |

### 2.4 后端 `createTimeline/index.js`

| # | 改动 |
|---|------|
| **B1** | 新增 `normalizeInputSubjectRole(v)`：`'unspecified' \| 'both'`，fallback `'unspecified'` |
| **B2** | `normalizeSubjectRole(v)` 不变（**不加 unspecified**） |
| **B3** | 新增 `normalizeSubjectRoleSource(v)`：`'pending' \| 'ai_inferred' \| 'fallback_unknown' \| 'legacy'` |
| **B4** | 协议识别：`hasInputSubjectRole` → 强制 `subjectRole='unknown', source='pending'`，不存 confidence；旧协议保留旧字段 + source 补充为 `'legacy'` |
| **B5** | `inferTimelineRecord` 传入 `inputSubjectRole`、`subjectRoleSource` |

### 2.5 后端 `generateAssessmentAI/index.js`

| # | 改动 |
|---|------|
| **B6** | `compactTimelineItem()` 读取 `inputSubjectRole`、`subjectRoleSource` |
| **B7** | prompt 注入：调用 `buildSubjectPrompt(inputSubjectRole, subjectRole)` — 从 DB 读规则 |
| **B8** | AI 成功 + actor 有效 → `subjectRole=actor, source='ai_inferred'` |
| **B9** | AI 失败 → `subjectRole='unknown', source='fallback_unknown'` |
| **B10** | 474 行更新 timeline_records：subjectRole + subjectRoleSource |

### 2.6 后端 `_shared/ai-event.js`

| # | 改动 |
|---|------|
| **B11** | 新增 `buildSubjectPrompt(inputSubjectRole, subjectRole)` — 从 DB 读规则 + 结构性拼接 |
| **B12** | **删除** describeSubjectRole（117-127 行），职责移交 DB + buildSubjectPrompt |
| **B13** | **删除** 459 行独立 contextLine（"主体宾语校验…"），内容已整合入 DB 规则 |
| **B14** | 评分保护检查 `eventInsight.actor`：actor=self → 三项归零；actor=unknown → 低权重 |
| **B15** | `hasExplicitTargetReaction()` 在 actor=self 时直接返回 false |
| **B16** | `fallbackAnalysis()`：新记录 + 未确认（`isNewRecord && isUnresolved`）→ neutralFallback；已确认的新记录按最终 subjectRole 执行 fallback |

### 2.7 后端 `_shared/event-understanding.js`

| # | 改动 |
|---|------|
| **B17** | `buildSubjectPrompt` 同 B11（共享模块） |
| **B18** | **删除** describeSubjectRole（43-54 行） |
| **B19** | **删除** 286 行独立 contextLine |
| **B20** | initiator：subjectRole 为 unknown → `'unknown'` |
| **B21** | promisedBy：subjectRole 为 unknown → `'unknown'` |
| **B22** | isWeakContext：subjectRole 为 unknown → true |
| **B23** | `inferTimelineRecord` 接收 `inputSubjectRole`、`subjectRoleSource` |

### 2.8 后端 `adminManage/index.js`

| # | 改动 |
|---|------|
| **B24** | `buildSubjectPrompt` 同 B11（共享模块） |
| **B25** | **删除** describeSubjectRole（630-640 行） |
| **B26** | 预览事件（724 行）改为：`inputSubjectRole: 'unspecified'`、`subjectRole: 'unknown'`、`subjectRoleSource: 'pending'` |
| **B27** | `normalizePromptAdminView`：`guardrails`/`runtimeContext`/`outputContract` 全部派生，不使用数据库旧值 |
| **B28** | `getAISettings`/`updateAISettings` 中 `PROMPT_FIXED_GUARDRAILS` 更新字段说明（加 inputSubjectRole/subjectRoleSource） |

### 2.9 下游消费者

| # | 文件 | 改动 |
|---|------|------|
| **B29** | `src/utils/insights.js:1136` | 白名单：`role === 'target' \|\| role === 'both'` |
| **B30** | `src/utils/insights.js:1413` | subjectRole 为 unknown → 通用建议 |
| **B31** | `src/pages/timeline/timeline.vue:36` | subjectRole 为 unknown → `v-if` 不渲染标签框 |

### 2.10 DB 操作

| # | 操作 |
|---|------|
| **DB1** | 将 1.2 节整合后的四条规则写入 `promptModules.eventAssessment.rules`（替换旧规则） |
| **DB2** | 操作前备份当前 `promptModules.eventAssessment` |
| **DB3** | 保存后触发 promptAdminView 重建 |

---

## 3. 核心伪代码

### B4：协议识别

```javascript
const hasInputSubjectRole =
  Object.prototype.hasOwnProperty.call(event, 'inputSubjectRole')

if (hasInputSubjectRole) {
  inputSubjectRole = normalizeInputSubjectRole(event.inputSubjectRole)
  subjectRole = 'unknown'
  subjectRoleSource = 'pending'
  // subjectRoleConfidence 不持久化
} else {
  subjectRole = normalizeSubjectRole(event.subjectRole)
  subjectRoleSource = 'legacy'
  subjectRoleConfidence = normalizeSubjectRoleConfidence(event.subjectRoleConfidence)
}
```

### B11：buildSubjectPrompt

```javascript
// 从 DB 读，为空则用默认值
function getSubjectRules(settings) {
  const module = normalizeBusinessPrompt(settings, 'eventAssessment')
  if (module?.rules?.length) {
    return module.rules.map(r => r.zh).filter(Boolean).join('\n')
  }
  return DEFAULT_SUBJECT_RULES  // 1.2 节整合的四条规则
}

function buildSubjectPrompt(inputSubjectRole, subjectRole, settings) {
  const rules = getSubjectRules(settings)

  if (inputSubjectRole === 'both') {
    return rules + '\n这是微信对话记录。请拆分双方各自说了什么。'
  }

  if (inputSubjectRole === undefined && subjectRole) {
    return rules + `\n历史标注的主体类型: ${subjectRole}（仅供参考，请以原文为准）`
  }

  return rules
}
```

### B16：fallback 安全降级

```javascript
function fallbackAnalysis(event) {
  const isNewRecord = event.inputSubjectRole !== undefined
  const isUnresolved =
    event.subjectRole === 'unknown' ||
    event.subjectRoleSource === 'pending' ||
    event.subjectRoleSource === 'fallback_unknown'

  if (isNewRecord && isUnresolved) {
    return {
      eventType: 'note',
      intentDelta: 0, riskDelta: 0, evidenceDelta: 0,
      eventInsight: { actor: 'unknown' },
      summary: '信息不足，不产生评分变化',
      labels: []
    }
  }
  // 已确认的新记录 → 按最终 subjectRole 执行旧 fallback 逻辑
  // 旧记录 → 保持原逻辑不变
}
```

### B27：promptAdminView 全部派生

```javascript
// normalizePromptAdminView 中
modules[key] = {
  key,
  title: current.title || fallback.title,
  description: current.description || fallback.description,
  // 以下全部派生，不使用数据库旧值
  guardrails: fallback.guardrails,
  runtimeContext: fallback.runtimeContext,
  outputContract: fallback.outputContract,
  effectivePreview: fallback.effectivePreview
}
```

---

## 4. 前端纠错入口

```html
<view v-if="quickInputSubjectRole === 'both'" class="both-notice">
  <text>已识别为聊天记录</text>
  <text class="both-undo" @click="dismissChatDetection">不是聊天记录</text>
</view>
```

```javascript
function dismissChatDetection() {
  quickInputSubjectRole.value = 'unspecified'
  chatDetectionDismissed.value = quickDesc.value
}
```

---

## 5. 文件汇总

| # | 文件 | 改动量 |
|---|------|--------|
| F1-F12 | `src/pages/index/index.vue` | 删 ~40 行，重写 ~45 行 |
| F13 | `src/pages/quick-read/quick-read.vue` | 1 行 |
| F14 | `src/utils/api.ts` | 1 行 |
| B1-B5 | `cloudfunctions/createTimeline/index.js` | 新增 3 函数 + 协议识别 ~20 行 |
| B6-B10 | `cloudfunctions/generateAssessmentAI/index.js` | ~20 行 |
| B11-B16 | `cloudfunctions/_shared/ai-event.js` | ~25 行（含删除 117-127 + 459） |
| B17-B23 | `cloudfunctions/_shared/event-understanding.js` | ~15 行（含删除 43-54 + 286） |
| B24-B28 | `cloudfunctions/adminManage/index.js` | ~18 行（含删除 630-640） |
| B29-B31 | `src/utils/insights.js` + `src/pages/timeline/timeline.vue` | ~6 行 |
| DB1-DB3 | 数据库 | 备份 + 写入新规则 + 重建预览 |

---

## 6. 部署

```
1. 修改 canonical cloudfunctions/_shared/
2. npm run sync:shared
3. npm run sync:shared:dry
4. DB1: 备份 promptModules.eventAssessment
5. DB2: 写入整合后的四条规则
6. DB3: 保存 → 重建 promptAdminView
7. tcb fn deploy createTimeline
8. tcb fn deploy generateAssessmentAI
9. tcb fn deploy adminManage
10. tcb fn deploy deleteTimeline
11. npm run build:mp-weixin
12. Admin 面板 → 确认 prompt 预览中主体宾语示例只出现一次
```

---

## 7. 验证矩阵

| # | 测试 | 验收标准 |
|---|------|---------|
| T1 | 新客户端 → createTimeline | 后端强制 subjectRole='unknown', source='pending' |
| T2 | 旧客户端（不传 inputSubjectRole） | 走旧协议，source='legacy' |
| T3 | 客户端伪造字段 | 后端忽略，强制覆盖 |
| T4 | AI 返回 actor=self | subjectRole→'self'，评分三项归零 |
| T5 | AI 返回 actor=target | subjectRole→'target'，保留评分 |
| T6 | AI 失败 + unspecified + unresolved | source='fallback_unknown'，安全降级 |
| T7 | AI 失败 + both + unresolved | 同上 |
| T8 | 已确认新记录 → deleteTimeline 重算 → AI 失败 | 按最终 subjectRole fallback，不因 inputSubjectRole 仍存在而误判 |
| T9 | both prompt | DB 规则 + "这是微信对话记录" |
| T10 | unspecified prompt | 仅 DB 规则 |
| T11 | 旧记录 prompt | DB 规则 + "历史标注的主体类型: self（仅供参考）" |
| T12 | 旧 self 记录重算 | 仍用旧的 subjectRole 保护评分 |
| T13 | DB 规则为空 | fallback 到 DEFAULT_SUBJECT_RULES |
| T14 | prompt 主体宾语示例 | 只出现一次，在 DB 规则中 |
| T15 | Admin 预览 | 显示 DB 规则 + 新四段结构 + inputSubjectRole 上下文 |
| T16 | Admin 保存后 | guardrails/runtimeContext/outputContract 全部重建 |
| T17 | 下游 unknown | 不算对方侧（白名单） |
| T18 | timeline unknown | 不渲染标签框 |
| T19 | 撤销聊天检测 | 切回 unspecified，失焦不重复识别 |
| T20 | 两个入口一致 | 首页 + quick-read |
| T21 | sync:shared:dry | 无遗漏 |

---

## 8. 自动化测试

新增 `tests/run-subject-role-flow.cjs`，接入 `test:regression`。

覆盖：
- 新旧协议识别
- 字段伪造被覆盖
- AI 成功/失败 → actor 更新
- fallback 降级：unresolved → neutral；已确认 → 按 subjectRole
- 评分保护：actor=self 归零
- 下游白名单
- prompt 中主体宾语示例只出现一次
- DB 规则为空 → fallback 生效
