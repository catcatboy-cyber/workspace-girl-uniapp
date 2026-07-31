# AI 语义归一化重构审计

## 结论

本轮重构方向正确：主要的正则主体推断链路已经删除，`normalizeEventInsight` 不再根据中文关键词覆盖 AI 的主体、互动、承诺和证据判断。

但当前实现还不能验收为“完全由 AI 负责语义归一化”。实际链路仍存在：

- 生产新增记录时，事件理解 AI 被显式关闭；
- AI 语义标签可能被代码重新构造并覆盖；
- AI 失败时，部分场景仍使用关键词规则评分；
- 回归测试仍停留在旧版规则推断协议；
- `rule_inferred` 仍残留在协议、默认配置和后台文案中。

因此当前真实架构仍是：

```text
AI 判断 + 代码格式归一 + 代码评分护栏 + 规则兜底 + 语义标签重建
```

还不是：

```text
AI 判断 + 枚举/格式归一 + 安全护栏
```

## P0：AI 语义标签没有稳定进入最终写库结果

### 1. 生产链路关闭了事件理解 AI

`createTimeline` 调用 `inferTimelineRecord` 时固定传入：

```js
settings: { aiEnabled: false, aiFallbackToRules: true }
```

位置：

[cloudfunctions/createTimeline/index.js:291](/C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/cloudfunctions/createTimeline/index.js:291)

结果是正常新增记录时，`eventUnderstanding` 永远不会调用模型，只会执行 `fallbackSemanticTags()` 的关键词规则。

### 2. 后续又用代码重建语义标签

`generateAssessmentAI` 在评估完成后调用：

[cloudfunctions/generateAssessmentAI/index.js:494](/C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/cloudfunctions/generateAssessmentAI/index.js:494)

```js
buildResolvedSemanticTags(...)
```

该函数仍依赖大量中文关键词规则：

[cloudfunctions/_shared/event-understanding.js:146](/C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/cloudfunctions/_shared/event-understanding.js:146)

[cloudfunctions/_shared/event-understanding.js:220](/C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/cloudfunctions/_shared/event-understanding.js:220)

随后写回：

[cloudfunctions/generateAssessmentAI/index.js:521](/C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/cloudfunctions/generateAssessmentAI/index.js:521)

```js
timelineUpdate.semanticTags = refreshedSemanticTags
timelineUpdate.semanticTagsSource = 'subject_role_resolved'
```

因此，即使 AI 正确返回了 `meal`、`target_initiated`、`meal_invitation` 等语义，后续仍可能被代码重建结果覆盖。

## P0：eventAssessment 没有读取 AI 返回的 semanticTags

`analyzeTimelineEvent` 的必需输出字段没有包含 `semanticTags`：

[cloudfunctions/_shared/ai-event.js:494](/C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/cloudfunctions/_shared/ai-event.js:494)

后续解析结果时也没有读取 `parsed.semanticTags`。

因此当前链路实际是：

```text
eventUnderstanding AI semanticTags
    ↓
生产新增时 AI 被关闭
    ↓
fallbackSemanticTags 规则结果
    ↓
generateAssessmentAI 再次用代码重建
    ↓
AI semanticTags 没有稳定写入最终记录
```

这是当前最严重的架构问题。

## P1：AI 失败时并非始终“零分 + note”

`fallbackAnalysis` 对 `unknown` 主体会保守处理，但对已经存在的 `target/self/both` 仍会执行规则分类和评分：

[cloudfunctions/_shared/ai-event.js:349](/C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/cloudfunctions/_shared/ai-event.js:349)

[cloudfunctions/_shared/ai-event.js:385](/C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/cloudfunctions/_shared/ai-event.js:385)

例如命中“拒绝”“主动”“见面”等关键词时，仍会修改 `intentDelta`、`riskDelta` 和 `eventType`。

事件理解失败时也会回退到：

[cloudfunctions/_shared/event-understanding.js:286](/C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/cloudfunctions/_shared/event-understanding.js:286)

```js
fallbackSemanticTags(params)
```

真实行为是：

```text
AI 失败 + 主体 unknown  → 保守 note
AI 失败 + 已有主体      → 规则分类和规则评分
AI 失败 + 事件理解      → 关键词语义标签
```

这可以作为明确的产品策略，但不能再描述为“AI 失败统一零分兜底”。

## P1：normalizeEventInsight 仍可能信任已有 subjectRole

当 AI 没有返回合法 `actor` 时，`normalizeEventInsight` 会使用事件已有的 `subjectRole`：

[cloudfunctions/_shared/ai-event.js:116](/C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/cloudfunctions/_shared/ai-event.js:116)

```js
const fallbackActor = event.subjectRole
```

这意味着 AI 没有判断成功时，旧状态可能继续影响新判断。

新建记录因为 `createTimeline` 初始固定为 `unknown/pending`，风险较小；但重新评估、历史记录和后台预览路径仍可能复用已有主体。

如果目标是“AI 不返回主体就不猜”，这里应统一回退 `unknown`，而不是回退存储主体。

## P1：回归测试当前未通过

实际执行：

```text
npm.cmd run test:regression
```

结果失败。

### 失败一：旧测试仍期待代码自动推断中文主体

测试仍期待“他拒绝和我见面”自动得到：

```text
actor=target
interaction=rejected
evidenceType=fact
```

位置：

[tests/run-regression.cjs:56](/C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/tests/run-regression.cjs:56)

当前实现返回 `unknown/unclear/unclear`，这与新架构目标一致，但测试没有更新。

### 失败二：Token 不足测试仍期待旧规则风险结果

测试仍期待无 Token 时得到 `risk` 和规则评分，当前实现返回 `note`。

另外，测试仍调用已经删除的：

```js
reconcileAnalysisWithExplicitRules(...)
```

位置：

[tests/run-regression.cjs:92](/C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/tests/run-regression.cjs:92)

[tests/run-regression.cjs:103](/C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/tests/run-regression.cjs:103)

因此目前不能声称仓库回归测试通过。

## P1：`rule_inferred` 没有清理干净

仍残留于：

- [cloudfunctions/_shared/subject-role-prompt.js:105](/C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/cloudfunctions/_shared/subject-role-prompt.js:105)
- [cloudfunctions/_shared/prompt-admin-view.js:64](/C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/cloudfunctions/_shared/prompt-admin-view.js:64)
- [cloudfunctions/updateAISettings/index.js:90](/C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/cloudfunctions/updateAISettings/index.js:90)
- [src/utils/api.ts:49](/C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/src/utils/api.ts:49)
- `src/pages/index/index.vue`
- 回归测试和后台文案

尤其是 `updateAISettings` 默认配置仍向后台写入 `rule_inferred`，会让新环境继续出现旧协议提示。

若新协议只保留：

```text
pending
ai_inferred
fallback_unknown
```

就应全链路统一。

## P2：semanticTagsSource 命名与目标架构冲突

当前写入：

```text
semanticTagsSource=subject_role_resolved
```

这个名称表示语义标签是根据主体角色重新解析的，不是 AI 原始输出。

建议语义约定统一为：

```text
ai       AI 生成并通过结构校验
user     用户手工标签
fallback 失败兜底结果
```

## 数据库提示词重复性审计

当前没有发现 `eventAssessment.rules` 在同一个 prompt 中被机械重复拼接：

- `buildPromptMessages` 负责注入 DB 业务规则；
- `buildSubjectPrompt` 检测到 DB 已有规则时，不会在 `eventAssessment` 中再次拼接同一份规则。

相关位置：

[cloudfunctions/_shared/subject-role-prompt.js:57](/C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/cloudfunctions/_shared/subject-role-prompt.js:57)

[cloudfunctions/_shared/ai-prompt-config.js:121](/C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/cloudfunctions/_shared/ai-prompt-config.js:121)

但存在明显的“语义重复”：

1. DB `eventAssessment.rules`；
2. `ALWAYS_ON_SUBJECT_RULES`；
3. `PROMPT_FIXED_GUARDRAILS`；
4. `SAFETY_GUARDRAILS`；
5. `eventAssessment` 固定评分规则。

这些规则不一定是相同字符串，但存在大量重叠。旧 DB 规则如果仍包含“按明确句式校正”“代码规则兜底”“主体规则优先”等旧表述，可能与当前 AI 主导设计冲突。

另外，`eventUnderstanding` 会主动复用 `eventAssessment.rules`，因此数据库旧规则也会进入事件理解 prompt。这不是字面重复，但会造成模块职责混杂。

## 已确认正常的部分

- `normalizeEventInsight` 已删除 `inferExplicit*` 和 `reconcileAnalysisWithExplicitRules`；
- `fallbackAnalysis` 对 unknown 主体确实不会猜主体；
- actor=self 和 actor=unknown 的评分安全护栏仍生效；
- canonical `_shared/ai-event.js` 与各云函数副本内容一致；
- 关键 JS 文件语法检查通过。

云函数是否已经部署成功属于外部环境状态，单凭本地代码无法确认。

## 达到验收标准前必须完成

1. 删除或停用 `buildResolvedSemanticTags` 的语义重建逻辑；
2. 让生产链路真正调用事件理解 AI，或把 `semanticTags` 纳入 eventAssessment AI 输出并解析写库；
3. 明确 AI 失败时是否允许规则评分，代码、文档、测试必须一致；
4. 重写回归测试，删除对正则推断和已删除 API 的断言；
5. 全面移除 `rule_inferred` 的新协议残留；
6. 将 `semanticTagsSource` 改成能够表达 AI、用户和兜底来源的值；
7. 清理 DB 规则与固定提示词之间的旧规则和重复规则。

## 最终判断

本轮修改已经消除了最危险的正则主体纠正链路，但当前仍是“AI 判断 + 规则重建 + 规则兜底”的混合实现。

在上述 P0 和 P1 问题修复前，不建议把它标记为“AI 唯一语义判断”版本。
