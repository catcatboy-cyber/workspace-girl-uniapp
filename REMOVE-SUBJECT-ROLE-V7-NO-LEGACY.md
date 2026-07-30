# 去掉 subjectRole 手动选择 — 实现方案 v7（不考虑旧数据）

## Context

同 v1-v6。本轮核心简化：**不考虑旧数据兼容。** 直接改协议，旧记录通过"subjectRole 降级为仅供参考"自然过渡。

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

function buildSubjectPrompt(inputSubjectRole, settings) {
  const dbRules = getSubjectRulesFromDB(settings)
  const parts = []

  // DB 没配规则时才补代码默认值（避免与 buildPromptMessages 自动注入重复）
  if (!dbRules) {
    parts.push(DEFAULT_SUBJECT_RULES)
  }

  // both 模式追加聊天标记（始终由代码追加）
  if (inputSubjectRole === 'both') {
    parts.push('这是微信对话记录。请拆分双方各自说了什么。')
  }

  return parts.join('\n')
}
```

**最终 prompt 中主体规则只出现一次**：DB 有 → 在业务规则区；DB 无 → 在运行时上下文区。both 标记始终追加。

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
| **F13** | `subjectRole: 'target'` 改为 `inputSubjectRole: 'unspecified'` |

### 2.3 前端 `src/utils/api.ts`

| # | 改动 |
|---|------|
| **F14** | `createTimeline` 参数新增 `inputSubjectRole: 'unspecified' \| 'both'`（**必填**） |
| **F15** | 删除本地记录、提交参数、重置、缓存中的 `subjectRoleConfidence` 字段 |

### 2.4 后端 `createTimeline/index.js`

| # | 改动 |
|---|------|
| **B1** | 新增 `normalizeInputSubjectRole(v)`：`'unspecified' \| 'both'`，fallback `'unspecified'` |
| **B2** | `normalizeSubjectRole(v)` 不变（不加 unspecified） |
| **B3** | `subjectRole` 强制 `'unknown'`，`subjectRoleSource` 强制 `'pending'` |
| **B4** | 删除 `normalizeSubjectRoleConfidence()` 函数（67 行）+ 所有读写（169/213/222/267/279/368/420 行） |
| **B5** | `inferTimelineRecord` 传入 `inputSubjectRole`、`subjectRoleSource` |

### 2.5 后端 `generateAssessmentAI/index.js`

| # | 改动 |
|---|------|
| **B6** | 删除 `normalizeSubjectRoleConfidence()` 函数（40 行）+ compactTimelineItem 删该字段 |
| **B7** | `compactTimelineItem()` 读取 `inputSubjectRole` + `subjectRoleSource` |
| **B8** | 调用 `buildSubjectPrompt(inputSubjectRole)` |
| **B9** | AI 成功 + actor 有效 → `subjectRole=actor, source='ai_inferred'` |
| **B10** | AI 失败 → `subjectRole='unknown', source='fallback_unknown'` |
| **B11** | 更新 timeline_records：subjectRole + subjectRoleSource |

### 2.6 后端 `_shared/ai-event.js`

| # | 改动 |
|---|------|
| **B11** | 新增 `buildSubjectPrompt(inputSubjectRole, settings)` |
| **B12** | **删除** `describeSubjectRole`（117-127 行） |
| **B13** | **删除** 459 行独立 contextLine（"主体宾语校验…"） |
| **B14** | 评分保护：只看 `eventInsight.actor`。actor=self → 三项归零；actor=unknown → 低权重 |
| **B15** | `hasExplicitTargetReaction()` 在 actor=self 时直接返回 false |
| **B16** | `fallbackAnalysis(isUnresolved)`：未确认 → neutral downgrade；已确认 → 按 subjectRole |

### 2.7 后端 `_shared/event-understanding.js`

| # | 改动 |
|---|------|
| **B17** | `buildSubjectPrompt` 同 B11 |
| **B18** | **删除** `describeSubjectRole`（43-54 行） |
| **B19** | **删除** 286 行独立 contextLine |
| **B20** | initiator：subjectRole 为 unknown → `'unknown'` |
| **B21** | promisedBy：subjectRole 为 unknown → `'unknown'` |
| **B22** | isWeakContext：subjectRole 为 unknown → true |

### 2.8 后端 `adminManage/index.js`

| # | 改动 |
|---|------|
| **B23** | `buildSubjectPrompt` 同 B11 |
| **B24** | **删除** `describeSubjectRole`（630-640 行） |
| **B25** | 预览事件改为：`inputSubjectRole: 'unspecified'`、`subjectRole: 'unknown'`、`subjectRoleSource: 'pending'` |
| **B26** | `normalizePromptAdminView`：`guardrails`/`runtimeContext`/`outputContract` 全部派生；同步更新 `PROMPT_FIXED_GUARDRAILS` 和 `getRuntimePreview()` 中的 subjectRole/inputSubjectRole/subjectRoleSource 字段说明 + 四段 rawReply 结构 |

### 2.9 下游消费者

| # | 文件 | 改动 |
|---|------|------|
| **B27** | `src/utils/insights.js:1136` | 对方侧白名单：`role === 'target' \|\| role === 'both'` |
| **B28** | `src/utils/insights.js:1413` | subjectRole 为 unknown → 通用建议 |
| **B29** | `src/pages/timeline/timeline.vue:36` | unknown → `v-if` 不渲染标签框 |

---

## 3. 核心伪代码

### buildSubjectPrompt

```javascript
function buildSubjectPrompt(inputSubjectRole, settings) {
  const rules = getSubjectRulesFromDB(settings) || DEFAULT_SUBJECT_RULES
  if (inputSubjectRole === 'both') {
    return rules + '\n这是微信对话记录。请拆分双方各自说了什么。'
  }
  return rules
}
```

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
const isUnresolved =
  event.subjectRole === 'unknown' ||
  event.subjectRoleSource === 'pending' ||
  event.subjectRoleSource === 'fallback_unknown'

if (isUnresolved) {
  return neutralFallback()  // eventType='note', 评分不变, actor='unknown'
}
// 已确认：按 subjectRole 执行 fallback
```

---

## 4. 文件汇总

| # | 文件 | 改动量 |
|---|------|--------|
| F1-F12 | `src/pages/index/index.vue` | 删 ~40 行，重写 ~45 行 |
| F13 | `src/pages/quick-read/quick-read.vue` | 1 行 |
| F14 | `src/utils/api.ts` | 1 行 |
| B1-B5 | `cloudfunctions/createTimeline/index.js` | ~15 行 |
| B6-B10 | `cloudfunctions/generateAssessmentAI/index.js` | ~15 行 |
| B11-B16 | `cloudfunctions/_shared/ai-event.js` | ~20 行（含删除） |
| B17-B22 | `cloudfunctions/_shared/event-understanding.js` | ~10 行（含删除） |
| B23-B26 | `cloudfunctions/adminManage/index.js` | ~10 行（含删除） |
| B27-B29 | `src/utils/insights.js` + `src/pages/timeline/timeline.vue` | ~5 行 |

**9 个文件，~120 行改动（含删除）。**

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
8. 数据库写入四条默认规则 + Admin 保存校验
9. Admin 保存 → 重建 promptAdminView → 检查实际 prompt
10. npm run build:mp-weixin
```

**先部署代码，再改数据库**。如果先改 DB，旧代码仍会附加原有的 describeSubjectRole 指令，造成短暂双重注入。

---

## 6. 验证

| # | 测试 | 验收标准 |
|---|------|---------|
| T1 | 新记录 → createTimeline | subjectRole='unknown', source='pending' |
| T2 | AI 返回 actor=self | subjectRole→'self'，评分归零 |
| T3 | AI 返回 actor=target | subjectRole→'target'，保留评分 |
| T4 | AI 失败 + unresolved | source='fallback_unknown'，安全降级 |
| T5 | 已确认记录 → 重算 → AI 失败 | 按 subjectRole fallback，不误判 |
| T6 | both prompt | DB 规则 + "聊天记录"标记 |
| T7 | unspecified prompt | 仅 DB 规则 |
| T8 | DB 规则为空 | fallback 到 DEFAULT_SUBJECT_RULES |
| T9 | prompt 主体宾语示例 | 只出现 1 次 |
| T10 | 下游 unknown | 不算对方侧 |
| T11 | timeline unknown | 不渲染标签框 |
| T12 | 撤销聊天检测 | 失焦不重复识别 |

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
| T2/T11/T12 旧兼容测试 | 不需要 |
