# AI 提示词简化与语义归一化开发计划

## 1. 目标

将当前多层重复提示词和多套语义协议收束为：

```text
一次 AI 调用
  → 一份规范化语义事实
  → 代码校验枚举
  → 代码派生展示标签和评分
  → 写入数据库
```

最终职责划分：

- AI 负责理解自然语言；
- 代码不再根据“吃饭、邀请、拒绝、失约”等中文关键词判断语义；
- 代码负责枚举校验、格式转换、评分计算和安全兜底；
- 人格风格只影响用户文案，不影响主体和事实判断；
- `subjectRole`、`semanticTags` 和评分必须来自同一份规范化语义结果。

### 1.1 已冻结的 V1 决策

以下内容属于本计划的正式实现决策，开发人员不得自行改选方案：

1. 正常新增记录只调用一次 `eventAssessment` AI；
2. AI 返回 `NormalizedEventV1.event + copy`；
3. AI 不返回 `eventType` 和数值评分；
4. `eventType` 由代码唯一生成；
5. 数值评分使用 `SCORING_POLICY_V1`；
6. semanticTags 只从规范化 event 投影，不读取原文关键词；
7. 新协议、评分、投影和写库必须原子发布；
8. AI 或协议失败统一 `unknown + note + 三项零分`；
9. 失败时丢弃 AI copy，使用固定保守文案；
10. timeline 保存不可变 `analysisSnapshot`，删除记录后只重放 snapshot；
11. DB 只保存业务开关和简短任务，不保存协议、评分表或安全规则；
12. `schemaVersion=1`、`policyVersion=1`。

## 2. 当前代码和线上 DB 审计结果

### 2.1 当前实际提示词组成

一次 `eventAssessment` 调用目前会拼接：

1. 代码安全护栏 3 条；
2. DB 中的角色、任务和 10 条业务规则；
3. 人格风格和建议强度；
4. 代码固定输出要求；
5. actor 判断说明；
6. `eventInsight` 枚举说明；
7. `ALWAYS_ON_SUBJECT_RULES` 5 条；
8. 评分框架约 7 条；
9. 当前评分、双方画像、最近事件和本次事件。

相关代码：

- [cloudfunctions/_shared/ai-prompt-config.js](/C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/cloudfunctions/_shared/ai-prompt-config.js)
- [cloudfunctions/_shared/subject-role-prompt.js](/C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/cloudfunctions/_shared/subject-role-prompt.js)
- [cloudfunctions/_shared/ai-event.js:479](/C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/cloudfunctions/_shared/ai-event.js:479)

### 2.2 线上 DB 当前运行参数

线上 `system_settings/settings_global_ai` 当前保存：

```text
eventMaxTokens = 1400
eventContextLimit = 7
eventTemperature = 0.5

eventUnderstandingMaxTokens = 300
eventUnderstandingTemperature = 0.2

aiFallbackToRules = true
```

### 2.3 线上 eventAssessment 业务配置

DB 当前保存：

- 一段较长的关系顾问角色描述；
- 一段同时要求事件判断、反馈、建议和观察点的任务；
- 10 条主体、互动、承诺、依据、事实和感受判断规则；
- `outputSchema` 和 `outputNotes` 为空。

这些 DB 规则与代码中的：

- `SAFETY_GUARDRAILS`；
- `DEFAULT_SUBJECT_RULES`；
- `ALWAYS_ON_SUBJECT_RULES`；
- eventAssessment 评分框架；
- `ai-event.js` 固定输出说明；

存在明显语义重复。

### 2.4 eventUnderstanding 当前状态

线上 DB 的 `eventUnderstanding` 当前为：

```text
enabled = true
role = 空
task = 空
rules = 空
outputNotes = 空
```

但代码会把 `eventAssessment.rules` 跨模块注入，因此实际 prompt 不为空。

同时，生产新增时间线时又固定传入：

```js
settings: { aiEnabled: false, aiFallbackToRules: true }
```

位置：

[cloudfunctions/createTimeline/index.js:291](/C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/cloudfunctions/createTimeline/index.js:291)

因此它目前属于“配置启用、生产关闭、代码仍保留完整实现”的半废弃状态。

### 2.5 DB 中的历史配置残留

线上设置文档同时保存：

- `promptModules` 新配置；
- `promptConfig` 旧配置；
- `promptAdminView` 只读快照；
- 部分点路径形式的旧字段残留。

当 `promptModules` 存在时，旧 `promptConfig` 不参与当前模型调用，但它仍包含：

- 旧三段 `rawReply`；
- 旧 `eventInsight` 结构；
- 已废弃的 `actionAdvice`；
- 本周、近14天、本月等历史表述。

这些残留会让后台配置和审计产生误判，应在新代码稳定后清理。

## 3. 总体设计

### 3.1 推荐链路

```text
用户输入原文
  ↓
createTimeline 创建 pending 记录
  ↓
generateAssessmentAI 单次调用模型
  ↓
模型返回 NormalizedEventV1
  ├─ event：客观语义
  └─ copy：用户文案
  ↓
后端校验 event 枚举
  ↓
后端派生 subjectRole / semanticTags / scores / rawReply
  ↓
一次性写入 assessment 和 timeline_record
```

### 3.2 不重新启用独立 eventUnderstanding AI

当前正常新增链路已经只调用一次 `eventAssessment` AI。

为了速度和一致性，不应重新启用第二次 `eventUnderstanding` 调用。应把它需要的：

- 场景；
- 主体；
- 互动；
- 承诺；
- 依据；
- 行为信号；

合并进 `NormalizedEventV1`。

批量补标签功能可以作为独立维护工具保留，但不得参与新记录正常链路。

### 3.3 时间线必须保存可重放的分析快照

`deleteTimeline` 当前会重建剩余评估。如果时间线只保存 `subjectRole/semanticTags`，将无法恢复 `strength`、完整 signals 和当时使用的评分政策，删除一条记录后历史分数可能被重新解释。

因此 AI 成功后必须在对应 `timeline_record` 保存：

```json
{
  "analysisSnapshot": {
    "schemaVersion": 1,
    "policyVersion": 1,
    "event": {},
    "score": {
      "intentDelta": 7,
      "riskDelta": -2,
      "evidenceDelta": 1
    },
    "eventType": "positive",
    "categories": ["initiative"]
  }
}
```

重建规则：

1. `deleteTimeline` 只重放已存储 `analysisSnapshot`；
2. 不重新调用 AI；
3. 不使用当前评分政策重新解释旧 snapshot；
4. 不从 description 关键词重新生成分数；
5. snapshot 缺失时使用 `note + 三项零分`，记录 `LEGACY_EVENT_SEMANTICS_MISSING`；
6. 用户文案和 semanticTags 不需要参与分数重放。

这样即使未来 `policyVersion` 升级，历史记录仍按创建时的评分快照重建，不会因为删除另一条记录而漂移。

## 4. NormalizedEventV1 协议

### 4.1 推荐输出

```json
{
  "schemaVersion": 1,
  "event": {
    "actor": "target",
    "interaction": "promised",
    "commitmentStatus": "promised",
    "commitmentType": "meal_invitation",
    "evidenceType": "fact",
    "scene": ["meal"],
    "signals": ["initiative"],
    "strength": "medium"
  },
  "copy": {
    "title": "他提出请你吃饭",
    "summary": "这是对方主动提出的线下邀约。",
    "reason": "对方明确提出邀约",
    "answer": "这次属于对方主动释放推进信号。",
    "targetMind": "他至少有进一步接触的意愿。",
    "nextStep": "可以自然回应，同时观察他是否主动确定时间地点。",
    "caution": "提出邀约不等于已经兑现，重点看后续落实。",
    "petLine": "这次是他主动，接下来就看会不会落实啦。",
    "petMood": "cheerful"
  }
}
```

### 4.2 event 字段枚举

```text
actor:
target | self | both | unknown

interaction:
initiated | responded | rejected | delayed |
promised | fulfilled | observed | unclear

commitmentStatus:
none | promised | fulfilled | broken | unclear

commitmentType:
meal_invitation | movie_invitation | meet_invitation |
chat_followup | gift_or_help | other | none

evidenceType:
fact | feeling | mixed | unclear

strength:
weak | medium | strong

signals:
initiative | investment | progression | consistency |
avoidance | coldness | verifiability | instability

scene:
offline_meet | movie | meal | coffee_tea | walk | chat | gift |
phone_call | online_chat | shopping | activity | study | work |
travel | game | sport | music | pet | food | group_social

petMood:
cheerful | cautious | encouraging | neutral | warning
```

数组限制：

```text
scene 最多 2 项，去重
signals 最多 4 项，去重
```

`signals` 定义：

| signal | 使用条件 |
|---|---|
| initiative | 对方存在明确主动发起或主动推进 |
| investment | 对方投入了明确时间、精力、帮助或资源 |
| progression | 互动产生了可观察的关系推进 |
| consistency | 说法和行动一致，或连续行为保持稳定 |
| avoidance | 明确回避、拖延、绕开回应或不落实 |
| coldness | 明显冷淡、持续不回应或突然中断联系 |
| verifiability | 本次属于对既有说法、承诺或事实的核验 |
| instability | 行为、态度或节奏反复变化 |

没有明确依据时返回空数组，不得为了填满字段而添加 signal。

`eventType` 不再由 AI 返回。它由代码根据规范语义和最终评分唯一生成，避免 AI 判断和后端计算出现两个来源。

### 4.3 多动作事件的主结果原则

一条原文包含多个动作时，`interaction` 只表示“对当前关系判断影响最大的最终动作”，其他信息放入 `signals` 和用户文案，不允许把多个互动值拼成非法字符串。

主结果优先级：

```text
commitmentStatus=broken
  > interaction=rejected
  > interaction=delayed
  > interaction=fulfilled
  > interaction=promised
  > interaction=responded
  > interaction=initiated
  > interaction=observed
  > interaction=unclear
```

同一条记录中存在多个独立动作时：

1. 优先选择最后发生、已经形成结果的动作；
2. 若发生顺序不清，选择对风险或推进影响更大的动作；
3. `interaction` 和 `commitmentStatus` 必须描述同一个主结果；
4. 其他动作只能进入 `signals`、`copy.reason` 或 `copy.caution`；
5. 不得为了保留所有动作而返回互相矛盾的主字段。

示例：

```text
“他先答应周末见，后来又说不来了”
→ interaction=delayed
→ commitmentStatus=broken

“他拒绝进一步交往，但说以后可以做朋友”
→ interaction=rejected
→ commitmentStatus=none
→ 朋友承诺只进入 copy，不计为关系推进承诺
```

### 4.4 客观层和文案层隔离

必须在 prompt 中明确：

```text
人格、语气和建议强度只允许影响 copy。
不得影响 event.actor、interaction、commitmentStatus、evidenceType、scene 和 strength。
```

防止“闺蜜直给”“痞气幽默”“大胆推进”等人格设置影响客观主体和评分。

### 4.5 字段必填、长度和错误等级

语义核心字段必须全部存在且合法：

```text
schemaVersion
event.actor
event.interaction
event.commitmentStatus
event.commitmentType
event.evidenceType
event.strength
```

语义核心字段缺失、非法或主结果组合冲突属于致命错误，整条结果进入第 7.4 节安全兜底。

以下字段可恢复处理，不得因为文案问题丢掉合法语义和评分：

| 字段 | 处理 |
|---|---|
| event.scene | 非数组时变为空数组；过滤非法项；去重；最多 2 项 |
| event.signals | 非数组时变为空数组；过滤非法项；去重；最多 4 项 |
| copy.title | 清洗并截断 30 字；空值使用原文安全标题 |
| copy.summary | 清洗并截断 100 字；空值使用固定简短说明 |
| copy.reason | 清洗并截断 30 字；空值为空字符串 |
| copy.answer | 清洗并截断 160 字；空值使用 copy.summary |
| copy.targetMind | 清洗并截断 160 字；空值使用保守固定句 |
| copy.nextStep | 清洗并截断 160 字；空值使用保守固定句 |
| copy.caution | 清洗并截断 160 字；空值使用保守固定句 |
| copy.petLine | 清洗并截断 50 字；空值使用 copy.summary |
| copy.petMood | 非法值改为 neutral |

错误码至少包括：

```text
NORMALIZED_EVENT_JSON_INVALID
NORMALIZED_EVENT_VERSION_UNSUPPORTED
NORMALIZED_EVENT_REQUIRED_FIELD_MISSING
NORMALIZED_EVENT_ENUM_INVALID
SEMANTIC_COMBINATION_INVALID
AI_REQUEST_FAILED
AI_RESPONSE_EMPTY
```

只有致命错误将 `aiUsed` 设为 false。单个 copy 字段缺失或被截断不影响 `aiUsed` 和语义评分，但需要记录 `normalizationWarnings`。

## 5. semanticTags 生成策略

### 5.1 删除原文关键词重建

停止使用原文关键词决定：

- scene；
- behavior；
- outcome；
- risk；
- initiator；
- response；
- commitment。

应删除或停用：

```js
fallbackSemanticTags(description)
buildResolvedSemanticTags(description, eventInsight)
```

### 5.2 完整投影规范

只允许代码从 AI 已归一化的字段派生冗余展示字段。必须由唯一函数负责：

```js
projectSemanticTagsFromNormalizedEvent(normalizedEvent, source)
```

#### scene

```text
semanticTags.scene = 通过枚举校验后的 event.scene
```

不得根据 description 重新识别场景。

#### behavior

主体基础标签：

| actor | behavior |
|---|---|
| target | target_side |
| self | self_side |
| both | both_interaction |
| unknown | 空数组 |

主动标签追加规则：

| 条件 | 追加 behavior |
|---|---|
| actor=target 且 interaction=initiated/promised | target_initiated |
| actor=self 且 interaction=initiated/promised | self_initiated |
| actor=both | 不额外猜测，由 both_interaction 表达 |

#### outcome

| 条件 | outcome |
|---|---|
| interaction=promised 或 commitmentStatus=promised | planned |
| interaction=fulfilled 或 commitmentStatus=fulfilled | fulfilled |
| interaction=delayed 或 commitmentStatus=broken | cancelled_delayed |
| 其他 | 空数组 |

同一个 outcome 只保留一次。

#### risk

| 条件 | risk |
|---|---|
| interaction=rejected | rejected + risk_event |
| interaction=delayed | vague_delay + risk_event |
| commitmentStatus=broken | risk_event |
| signals 包含 coldness | cold |
| signals 包含 avoidance/instability 且尚无具体风险标签 | risk_event |
| 其他 | 空数组 |

#### initiator

| 条件 | initiator |
|---|---|
| interaction=initiated/promised 且 actor=target/self/both | actor |
| 其他 | unknown |

不得因为行为主体是 target，就自动断言整个互动由 target 发起。

#### response

| 条件 | response |
|---|---|
| interaction=rejected | rejected |
| interaction=delayed | pending |
| interaction=promised/fulfilled | accepted |
| interaction=responded 且 commitmentStatus=promised/fulfilled | accepted |
| interaction=responded | unclear |
| interaction=initiated | pending |
| interaction=observed/unclear | none |

#### commitment

```text
exists = commitmentStatus 为 promised/fulfilled/broken
type = exists ? event.commitmentType : none
promisedBy = exists 且 actor 合法 ? actor : unknown
fulfilled = commitmentStatus === fulfilled
```

重要约束：

```text
commitment.type 只能读取 event.commitmentType。
不得用 scene=meal 推导 meal_invitation。
“一起吃了饭”有 meal 场景，但不一定存在吃饭邀约或承诺。
```

#### source

```text
AI 合法结果      → ai
用户手工标签     → user
AI 失败安全兜底  → fallback
```

### 5.3 signals 到 categories 的映射

现有评分快照通过 `categories` 更新 `signalSummary`，因此必须保留确定性映射：

| event.signals | analysis.categories |
|---|---|
| initiative | initiative |
| investment | investment |
| progression | progression |
| consistency | consistency |
| avoidance | avoidance |
| coldness | avoidance |
| verifiability | verifiability |
| instability | instability |

AI 不再单独返回 `categories`。代码对 `signals` 做枚举校验、去重后完成一对一投影。

### 5.4 source 统一

建议统一为：

```text
semanticTagsSource=ai
semanticTagsSource=user
semanticTagsSource=fallback
```

删除：

```text
subject_role_resolved
rule_inferred
```

## 6. 完整评分规范

### 6.1 设计原则

AI 不再直接决定任意 `intentDelta/riskDelta/evidenceDelta` 数字。

AI 只返回：

```text
actor
interaction
commitmentStatus
evidenceType
strength
```

代码按照固定评分规范计算结果。

不采用手写 `interaction × commitmentStatus × evidenceType × strength` 的数百行结果表，而采用可组合的分维度评分表。只要计算顺序固定，它就能完整、无歧义地覆盖全部组合。

评分公式：

```text
原始意向 = interaction.intent + commitmentStatus.intent
原始风险 = interaction.risk + commitmentStatus.risk

最终意向 = round(原始意向 × evidenceFactor × strengthFactor × actorFactor)
最终风险 = round(原始风险 × evidenceFactor × strengthFactor × actorFactor)

最终证据 = evidenceDelta(evidenceType, strength)
```

最后统一执行：

```text
intentDelta  clamp 到 -20 ~ +20
riskDelta    clamp 到 -20 ~ +20
evidenceDelta clamp 到 0 ~ 2
```

### 6.2 interaction 基础分

| interaction | intent 基础分 | risk 基础分 | 含义 |
|---|---:|---:|---|
| initiated | +6 | -2 | 对方主动发起互动或推进 |
| responded | +3 | -1 | 对方给出明确回应，但主动性弱于发起 |
| rejected | -8 | +10 | 明确拒绝或否定推进 |
| delayed | -4 | +7 | 拖延、回避、推迟或不落实 |
| promised | +5 | -1 | 明确作出承诺，尚未兑现 |
| fulfilled | +6 | -2 | 当前动作属于兑现，兑现状态还会额外加分 |
| observed | 0 | 0 | 仅记录客观现象，不直接判断关系影响 |
| unclear | 0 | 0 | 互动性质无法确定 |

### 6.3 commitmentStatus 修正分

| commitmentStatus | intent 修正 | risk 修正 | 含义 |
|---|---:|---:|---|
| none | 0 | 0 | 没有承诺 |
| promised | +2 | -1 | 已明确承诺，但还要继续观察落实 |
| fulfilled | +4 | -4 | 承诺已经兑现 |
| broken | -5 | +10 | 承诺未兑现或明确落空 |
| unclear | 0 | 0 | 无法判断承诺状态 |

组合后的典型基准结果：

| interaction + commitmentStatus | 基准 intent | 基准 risk |
|---|---:|---:|
| initiated + none | +6 | -2 |
| responded + none | +3 | -1 |
| promised + promised | +7 | -2 |
| fulfilled + fulfilled | +10 | -6 |
| delayed + promised | -2 | +6 |
| delayed + broken | -9 | +17 |
| rejected + none | -8 | +10 |
| rejected + broken | -13 | +20（截断后） |
| observed + none | 0 | 0 |
| unclear + unclear | 0 | 0 |

### 6.4 evidenceType 系数和证据增量

| evidenceType | 分数系数 evidenceFactor | evidenceDelta | 规则 |
|---|---:|---:|---|
| fact | 1.0 | weak/medium=1，strong=2 | 明确发生过的行为或明确说过的话 |
| mixed | 0.5 | 1 | 同时包含事实和用户推测，只按事实部分低权重计入 |
| feeling | 0 | 0 | 用户感受、猜测和情绪不得改变对方评分 |
| unclear | 0 | 0 | 依据不清时不改分 |

该规则保证：

```text
“我觉得他喜欢我”即使模型错误地给出 positive，
只要 evidenceType=feeling，最终三项评分仍为 0。
```

### 6.5 strength 系数

| strength | strengthFactor | 使用标准 |
|---|---:|---|
| weak | 0.6 | 一次轻微动作、信息含糊但仍有明确事实 |
| medium | 1.0 | 普通明确事件，默认值 |
| strong | 1.4 | 明确、重要、可验证，或对关系推进/风险影响显著 |

`strength` 只能控制同类事件的影响幅度，不能改变事件方向。

例如：

```text
rejected 永远不能因为 strength 不同变成正向；
fulfilled 永远不能因为 strength 不同变成高风险；
feeling 永远不能因为 strength=strong 获得评分。
```

### 6.6 actor 系数和最终保护

| actor | actorFactor | 最终处理 |
|---|---:|---|
| target | 1.0 | 完整保留对方行为影响 |
| both | 0.75 | 只保留双方事件中对方部分的影响，避免把用户动作重复计分 |
| self | 0 | 三项归零，`eventType=note` |
| unknown | 0 | 三项归零，`eventType=note` |

当 `actor=both` 时，prompt 必须要求：

```text
interaction、commitmentStatus 和 strength 描述双方事件中“对方部分”的主要影响，
用户自己的行为不得计入 strength。
```

### 6.7 固定计算顺序

开发时必须严格按以下顺序执行，不能由各调用方自行组合：

1. 校验 actor、interaction、commitmentStatus、commitmentType、evidenceType、strength 六个核心枚举；
2. actor 为 self/unknown 时立即返回 `note + 三项零分`；
3. 仅对 actor=target/both 检查语义组合是否冲突；
4. 查 interaction 基础分；
5. 加 commitmentStatus 修正分；
6. 乘 evidenceFactor；
7. 乘 strengthFactor；
8. 乘 actorFactor；
9. 使用 JavaScript `Math.round` 取整；
10. clamp 到字段允许范围；
11. 独立计算 evidenceDelta；
12. 根据固定优先级生成 `eventType`；
13. 投影 `semanticTags`、`categories` 和展示标签。

必须由单一函数负责：

```js
calculateEventScore(normalizedEvent)
```

不得在 `createTimeline`、`generateAssessmentAI`、`reassess` 或前端分别实现评分副本。

`eventType` 唯一生成规则：

| 优先级 | 条件 | eventType |
|---:|---|---|
| 1 | actor=self/unknown | note |
| 2 | commitmentStatus=broken | risk |
| 3 | interaction=rejected/delayed | risk |
| 4 | signals 包含 verifiability，且未命中风险条件 | verification |
| 5 | 最终 intentDelta > 0 且 riskDelta <= 0 | positive |
| 6 | 其他 | note |

AI 不得返回 `eventType`，后端不得接受 AI 的同名字段作为覆盖值。

### 6.8 非法和矛盾组合处理

仅对 actor=target/both 使用以下允许矩阵。矩阵外组合视为主结果字段冲突：

| interaction | 允许的 commitmentStatus |
|---|---|
| initiated | none、unclear |
| responded | none、promised、unclear |
| rejected | none、broken、unclear |
| delayed | none、promised、broken、unclear |
| promised | promised |
| fulfilled | fulfilled |
| observed | none、unclear |
| unclear | none、unclear |

额外一致性约束：

```text
commitmentStatus=none/unclear → commitmentType 必须为 none
commitmentStatus=promised/fulfilled/broken → commitmentType 不能为 none，
无法确定具体类型时使用 other
```

actor=self/unknown 在枚举合法后直接执行保护层，不因 interaction/commitmentStatus 组合触发语义降级。这保证 self/unknown 的全部组合始终为 `note + 三项零分`。

发现非法组合时不得自行用代码猜测正确语义。处理方式：

```text
eventType=note
actor=unknown
interaction=unclear
commitmentStatus=unclear
intentDelta=0
riskDelta=0
evidenceDelta=0
semanticTagsSource=fallback
validationError=SEMANTIC_COMBINATION_INVALID
```

第一版不自动重试 AI，避免增加响应时间。应记录结构化日志，供后续统计模型错误率。

### 6.9 完整计算示例

#### 示例 A：他要请我吃饭

```text
actor=target
interaction=promised
commitmentStatus=promised
evidenceType=fact
strength=medium

intent = (5 + 2) × 1.0 × 1.0 × 1.0 = +7
risk   = (-1 - 1) × 1.0 × 1.0 × 1.0 = -2
evidenceDelta = 1
```

#### 示例 B：他明确拒绝见面

```text
actor=target
interaction=rejected
commitmentStatus=none
evidenceType=fact
strength=strong

intent = (-8 + 0) × 1.0 × 1.4 × 1.0 = -11
risk   = (10 + 0) × 1.0 × 1.4 × 1.0 = +14
evidenceDelta = 2
```

#### 示例 C：我觉得他喜欢我

```text
actor=self
interaction=observed
commitmentStatus=none
evidenceType=feeling
strength=strong

actor=self → 立即全零
```

#### 示例 D：我约他，他答应了

```text
actor=both
interaction=responded
commitmentStatus=promised
evidenceType=fact
strength=medium

intent = (3 + 2) × 1.0 × 1.0 × 0.75 = +4
risk   = (-1 - 1) × 1.0 × 1.0 × 0.75 = -1
evidenceDelta = 1
```

#### 示例 E：他说好周末见，但后来没来

```text
actor=target
interaction=delayed
commitmentStatus=broken
evidenceType=fact
strength=strong

intent = (-4 - 5) × 1.0 × 1.4 × 1.0 = -13
risk   = (7 + 10) × 1.0 × 1.4 × 1.0 = +24 → clamp 为 +20
evidenceDelta = 2
```

### 6.10 原子切换

新协议、投影函数和评分函数必须在同一版本完成，不能先切换 prompt、后补评分。

同一发布单元必须同时包含：

```text
NormalizedEventV1 schema
normalizeNormalizedEventV1
calculateEventScore
deriveEventType
projectSemanticTagsFromNormalizedEvent
buildRawReplyFromCopy
新 assessment 字段映射
```

V1 不保留旧 AI 响应解析器：

1. 只有 `schemaVersion === 1` 才进入新协议；
2. 缺少版本、返回旧字段或夹带旧数值时，不尝试猜测或转换；
3. 统一记录 `NORMALIZED_EVENT_VERSION_UNSUPPORTED` 并进入安全零分兜底；
4. 新 prompt 不再要求 AI 返回任何数值；
5. 云函数发布时，已经开始运行的旧实例继续按旧代码完成，不由新代码接管其中途响应；
6. 如需回滚，回滚完整云函数版本，不在同一运行版本维护两套业务协议。

禁止出现“新 prompt 已上线，但 `calculateEventScore` 尚未上线”的中间状态。

### 6.11 V1 正式评分政策确认

本计划第 6.2～6.6 节的基础分、修正分和系数确定为 `SCORING_POLICY_V1`：

```text
policyVersion=1
bothFactor=0.75
weakFactor=0.6
mediumFactor=1.0
strongFactor=1.4
```

DeepSeek 必须按表实现，不得自行调整数值、增加例外或根据原文关键词修正分数。以后修改任何评分值必须提升 `policyVersion` 并补充迁移说明和回归期望。

## 7. rawReply 重构

### 7.1 当前问题

当前要求 AI 在一个字符串里严格输出四个标题，每段两三句：

```text
小咪先回答你的问题
对方可能在想
下一步可以这样推进
留个心眼
```

这会增加：

- prompt 长度；
- 输出 Token；
- 标题格式错误概率；
- 前端解析复杂度。

### 7.2 新方案

AI 分字段返回：

```json
{
  "answer": "...",
  "targetMind": "...",
  "nextStep": "...",
  "caution": "..."
}
```

后端统一拼装现有 `rawReply` 文本，保持前端兼容：

```text
小咪先回答你的问题：{answer}

对方可能在想：{targetMind}

下一步可以这样推进：{nextStep}

留个心眼：{caution}
```

### 7.3 新协议到现有 assessment/timeline 字段的完整映射

为了保留现有页面和评估功能，统一由适配函数完成映射：

```js
buildAnalysisFromNormalizedEvent(normalizedEvent)
```

| 现有字段 | 新来源/生成方式 |
|---|---|
| eventInsight.actor | `event.actor` |
| eventInsight.interaction | `event.interaction` |
| eventInsight.commitmentStatus | `event.commitmentStatus` |
| eventInsight.evidenceType | `event.evidenceType` |
| subjectRole | `event.actor` |
| subjectRoleSource | 新协议合法且 AI 成功为 `ai_inferred`，否则 `fallback_unknown` |
| triggerEventTitle/eventTitle | `copy.title`，空值时使用安全截断后的原文 |
| triggerEventType/eventType | `deriveEventType(event, score)` |
| intentDelta/riskDelta/evidenceDelta | `calculateEventScore(event)` |
| categories | `projectCategoriesFromSignals(event.signals)` |
| semanticTags | `projectSemanticTagsFromNormalizedEvent(event)` |
| semanticTagsSource | `ai/user/fallback` |
| semanticSchemaVersion | 固定写入 `1` |
| scoringPolicyVersion | 固定写入 `1` |
| timelineRecord.analysisSnapshot | 保存 `schemaVersion + policyVersion + event + score + eventType + categories`，供删除记录后确定性重放 |
| summary | `copy.summary` |
| rationale | `[copy.reason]`，空值时为空数组 |
| rawReply | `buildRawReplyFromCopy(copy)` |
| petLine | `copy.petLine` |
| petMood | 校验后的 `copy.petMood`，非法时为 `neutral` |
| currentStatus.tags | 从 `event.signals + eventType` 投影，最多 3 项 |
| currentStatus.summary | `copy.summary` |
| currentStatus.caution | `copy.caution` |
| currentStatus.phase/degree | 不再生成；读取端继续容忍旧字段 |
| actionAdvice | 不再生成，保持 `null` |
| aiProvidedEventInsight | 新协议 schema 和 event 校验全部通过时为 true |
| aiUsed | 模型调用成功且新协议校验通过时为 true |
| validationError | 成功时删除/不写；失败时写入固定错误码 |
| normalizationWarnings | 有可恢复清洗时写入字符串数组，最多 5 项 |
| aiProvider/aiModel/tokenUsage | 沿用请求元数据 |
| explanation.headline | `copy.summary` |
| explanation.bullets | `[copy.reason]` |
| explanation.petLine | `copy.petLine` |
| explanation.petMood | `copy.petMood` |
| explanation.cautions | `copy.caution` 加一条固定可变性提醒，最多 2 条 |

`currentStatus.tags` 固定投影：

```text
eventType=risk         → 风险信号
eventType=positive     → 正向推进
eventType=verification → 待验证
actor=self             → 我的记录
actor=unknown          → 主体不确定
signals 中其他合法值   → 使用代码固定中文映射，去重后最多 3 项
```

### 7.4 AI 失败和协议非法时的完整兜底

任何请求失败、JSON 解析失败、枚举非法或主结果组合非法时：

```text
subjectRole=unknown
subjectRoleSource=fallback_unknown
semanticTagsSource=fallback
eventType=note
intentDelta=0
riskDelta=0
evidenceDelta=0
categories=[]
semanticTags={scene:[],behavior:[],outcome:[],risk:[],initiator:unknown,response:none,commitment:{exists:false,type:none,promisedBy:unknown,fulfilled:false},source:fallback}
aiUsed=false
aiProvidedEventInsight=false
validationError=<结构化错误码>
```

失败结果也必须写入可重放的零分快照：

```text
analysisSnapshot.schemaVersion=1
analysisSnapshot.policyVersion=1
analysisSnapshot.event={actor:unknown,interaction:unclear,commitmentStatus:unclear,commitmentType:none,evidenceType:unclear,scene:[],signals:[],strength:weak}
analysisSnapshot.score={intentDelta:0,riskDelta:0,evidenceDelta:0}
analysisSnapshot.eventType=note
analysisSnapshot.categories=[]
```

失败时不得继续使用 AI 返回的 `copy`，统一生成保守文案：

```text
title = 原文安全截断标题
summary = 这条记录暂时没有完成语义判断，先作为普通记录保存。
answer = 这次暂时无法稳定判断是谁释放了什么信号。
targetMind = 现有信息不足，先不替对方下结论。
nextStep = 可以继续记录后续明确发生的回应或行动。
caution = 不要把暂时无法判断理解成正向或负向结论。
petLine = 这条先记下来，等有更明确的行动再判断。
petMood = neutral
```

## 8. 精简后的固定提示词

推荐固定系统提示：

```text
你是关系事件语义归一化器。只依据原文识别动作发出者、互动、承诺、依据和场景，不补充未出现的事实。

按动作发出者判断主体：“我邀请他”是 self，“他邀请我”是 target；双方均有明确动作是 both；无法判断才是 unknown。用户自己的行为、感受和猜测不是对方信号。

多动作事件只返回影响最大的最终主结果，interaction 和 commitmentStatus 必须描述同一个主结果，其他信息放入 signals 或 copy。

严格返回 NormalizedEventV1 JSON。不要返回 eventType 或任何评分数值。人格和建议强度只影响 copy，不得影响 event。
```

运行时只附加：

```text
schema={固定枚举协议}
context={必要画像、最近事件}
currentEvent={本次原文}
```

## 9. DB eventAssessment 清理方案

### 9.1 当前 10 条规则去留

| 当前内容 | 处理 |
|---|---|
| “判断每条记录时，必须先区分” | 删除 |
| 主体四分类 | 移入 JSON schema |
| 互动性质分类 | 移入 JSON schema |
| 承诺状态分类 | 移入 JSON schema |
| 依据类型分类 | 移入 JSON schema |
| 对方动作/用户动作/感受三层区分 | 合并进固定语义原则 |
| “我问他”和“他问我”详细说明 | 压缩为一句主宾语规则和两个例子 |
| 主体不明时弱化权重 | 移到代码评分层 |
| 不编造事实 | 已在固定安全护栏中，DB 删除 |
| “我觉得他喜欢我”不是主动 | 合并进固定语义原则 |

### 9.2 DB 最终只保留

建议 `eventAssessment` 最终只保存：

```json
{
  "enabled": true,
  "businessPrompt": {
    "enabled": true,
    "nameZh": "即时反馈",
    "nameEn": "",
    "roleZh": "",
    "roleEn": "",
    "taskZh": "把本次关系事件归一化，并用指定陪伴风格给出简短、具体的反馈。",
    "taskEn": "",
    "rules": [],
    "outputSchema": {},
    "outputNotes": []
  }
}
```

继续沿用当前 `promptModules.*.businessPrompt` 数据结构，不新增 `businessNoteZh` 等平行字段。主体协议、输出 schema、评分规则和安全规则不得由 DB 自由修改。

### 9.3 清理历史字段

新代码部署并验证后，清理：

- `promptConfig`；
- DB 中持久化的 `promptAdminView`；
- 点路径形式的旧配置残留；
- `eventAssessment.rules` 旧规则；
- `eventUnderstanding` 空业务配置；
- `rule_inferred` 相关说明；
- 旧三段 `rawReply` 和旧 `actionAdvice` 文档。

清理前必须备份 `settings_global_ai` 文档。

### 9.4 aiFallbackToRules 处理

`aiFallbackToRules` 的“规则兜底”语义与新架构冲突。V1 处理方式：

1. 后端不再根据该字段启用中文关键词分析；
2. 无论旧值为 true/false，AI 请求或协议失败都使用第 7.4 节中性兜底；
3. 后台不再提供“规则兜底”开关；
4. DB 清理阶段删除 `aiFallbackToRules`；
5. 如需展示失败策略，使用只读文案 `aiFailureMode=neutral`，不需要新增可编辑 DB 字段。

## 10. 后台配置页面调整

### 10.1 可编辑内容

每个模块只保留：

- 启用/停用；
- 一句任务说明；
- 可选业务补充说明；
- 人格文案；
- 温度、最大输出 Token、上下文数量。

### 10.2 只读内容

后台只读展示：

- 实际固定安全原则；
- 当前 `NormalizedEventV1` schema；
- 实际注入的上下文字段；
- 评分表版本；
- 最终有效 prompt 预览。

只读内容应由代码实时生成，不写入 DB。

## 11. 运行参数调整

当前线上：

```text
eventMaxTokens=1400
eventContextLimit=7
eventTemperature=0.5
```

首版建议：

```text
eventMaxTokens=800
eventContextLimit=3
eventTemperature=0.2
```

理由：

- 结构化语义需要低温度；
- 最近 7 条事件容易分散模型对当前事件的注意力；
- 文案拆分为短字段后不再需要 1400 Token；
- 输出缩短比单纯删除几条规则更能改善速度。

实际参数应通过日志统计再微调，不以单次测试决定。

## 12. 其他模块精简计划

### 12.1 attachmentAnalysis

当前 7 条规则压缩为 3 条：

```text
1. 判断是否为聊天截图；
2. 只提取清晰可见内容并保持顺序；
3. 不编造，不扩散完成任务不需要的隐私。
```

继续使用固定 JSON schema。

### 12.2 monthlyReview

实际程序现在是本月复盘，但 DB 和部分旧文档仍混有：

- 本周；
- 近14天；
- 本月；
- 下周；
- 下月。

应统一业务语义为“本月复盘/下月观察”，现有字段名需要兼容时可暂时保留，但后台说明和实际 prompt 必须一致。

### 12.3 sideRead

角色、任务和规则压缩为：

```text
结合已有生肖/星座和当前真实事件生成简短参考；不把星象当作事实，不编造缺失信息。
```

输出 schema 固定在代码中。

## 13. 实施步骤

### 13.1 文件级改动清单

| 文件 | 必须修改的职责 |
|---|---|
| `cloudfunctions/_shared/normalized-event.js` | 新建；集中定义 schema、枚举、主结果校验、评分表、`deriveEventType`、categories 投影、semanticTags 投影、rawReply 拼装和安全兜底 |
| `cloudfunctions/_shared/ai-event.js` | 改为只请求和解析 `NormalizedEventV1`；删除 AI 数值、eventType、旧 rawReply 字符串要求和旧响应兼容入口 |
| `cloudfunctions/_shared/event-recalculate.js` | 调用 `buildAnalysisFromNormalizedEvent`，保持现有 assessment、signalSummary、nextAction 和 nextRecordFocus 链路 |
| `cloudfunctions/_shared/event-understanding.js` | 删除正常新增链路中的关键词 semanticTags 重建职责；批量旧记录工具如需保留必须与新记录链路隔离 |
| `cloudfunctions/_shared/subject-role-prompt.js` | 删除重复的 DB 主体规则拼接、`DEFAULT_SUBJECT_RULES`、`ALWAYS_ON_SUBJECT_RULES` 和 AI 评分框架；仅保留新固定语义原则需要的最小辅助逻辑 |
| `cloudfunctions/_shared/ai-prompt-config.js` | 精简实际安全护栏；将“回退到规则结果”改成“回退到保守 unknown/note”；不得注入旧协议 |
| `cloudfunctions/_shared/prompt-admin-view.js` | 更新 `NormalizedEventV1`、运行时上下文、source 和评分政策只读说明；删除 `rule_inferred` |
| `cloudfunctions/createTimeline/index.js` | pending 记录不再通过 description 关键词生成 semanticTags；初始使用空标签和 pending 状态 |
| `cloudfunctions/generateAssessmentAI/index.js` | 删除 `buildResolvedSemanticTags`；统一写入新主体、标签、评分、文案、source、validationError 和可重放 `analysisSnapshot`；batchTag 必须跳过 subjectRoleSource=pending 的新记录 |
| `cloudfunctions/deleteTimeline/index.js` | 删除当前 `aiEnabled:false` 规则重算路径；只重放 timeline 已保存的 `analysisSnapshot.score/categories/eventType`，snapshot 缺失时安全零分 |
| `cloudfunctions/adminManage/index.js` | 后台预览使用实时协议；更新可编辑项、只读项和 DB 清理逻辑 |
| `cloudfunctions/getAISettings/index.js` | 返回实时 promptAdminView，不读取 DB 中的旧快照作为事实来源 |
| `cloudfunctions/updateAISettings/index.js` | 保存精简业务配置；不再写入旧 `promptConfig`、旧协议文案和 `rule_inferred` |
| `src/utils/api.ts` | 更新 `subjectRoleSource`、`semanticTagsSource` 和相关返回类型 |
| `src/pages/index/index.vue` | 删除 `rule_inferred` 类型/文案；确认新 currentStatus 和 rawReply 保持兼容 |
| `src/pages/timeline/timeline.vue` | 更新 source 判断；保持用户手工 semanticTags 优先；`syncSemanticTags` 跳过 pending/正在分析的新记录，避免触发第二次 AI 调用 |
| `src/pages/admin/admin.vue` | 简化提示词编辑区，显示实时固定协议和评分版本 |
| `tests/run-regression.cjs` | 删除旧正则推断和旧评分断言，加入协议、投影、评分、写库和失败链路测试 |

### 13.2 阶段一：先完成纯函数和测试，不切生产

1. 新建 `normalized-event.js`；
2. 定义 `NormalizedEventV1` 常量和所有枚举；
3. 实现 `normalizeNormalizedEventV1`；
4. 实现主结果允许矩阵校验；
5. 实现 `calculateEventScore` 和 `deriveEventType`；
6. 实现 `projectCategoriesFromSignals`；
7. 实现 `projectSemanticTagsFromNormalizedEvent`；
8. 实现 `buildRawReplyFromCopy`；
9. 实现 `buildAnalysisFromNormalizedEvent` 和统一失败结果；
10. 实现 `buildAnalysisSnapshot` 和 `replayAnalysisSnapshot`；
11. 完成纯函数单元测试和全组合测试。

这一阶段不得修改线上 prompt 或 DB。

### 13.3 阶段二：完成调用和写库的原子切换

1. 修改 eventAssessment 固定 prompt；
2. 模型只返回 `schemaVersion + event + copy`；
3. 接入严格 `schemaVersion=1` 解析器，旧格式直接安全兜底；
4. `event-recalculate` 接入统一适配结果；
5. `generateAssessmentAI` 删除 `buildResolvedSemanticTags`；
6. `createTimeline` 删除关键词初始 semanticTags；
7. 同时启用 `calculateEventScore`、`deriveEventType` 和完整字段映射；
8. timeline 记录写入不可变 `analysisSnapshot`；
9. `deleteTimeline` 改为 snapshot 重放；
10. 前后端 batchTag/syncSemanticTags 均跳过 pending 记录；
11. 用户手工 semanticTags 继续优先保留；
12. AI 或协议失败统一走第 7.4 节兜底；
13. 确认新记录只调用一次语义分析模型。

该阶段必须作为一个发布单元，不允许拆成“先改 prompt、后改评分”。

### 13.4 阶段三：回归和灰度

1. 自动遍历全部枚举组合；
2. 验证 target/both 允许矩阵；
3. 验证 self/unknown 所有枚举组合始终为零；
4. 验证 feeling/unclear 所有组合不改分；
5. 验证 semanticTags 全字段投影；
6. 验证 signalSummary、nextAction、nextRecordFocus 未断链；
7. 验证删除任意记录后按 snapshot 重放，剩余事件的单条增量不变；
8. 验证 snapshot 缺失时零分且不触发关键词规则；
9. 验证首页、时间线、评估历史和后台详情；
10. 对比输入 Token、输出 Token、解析率、失败率和响应时间；
11. 灰度期间记录版本错误和协议错误，不写两套结果。

### 13.5 阶段四：DB 和后台清理

1. 导出并备份 `system_settings/settings_global_ai`；
2. 确认新代码已部署且能够读取旧 DB 配置；
3. 更新 DB 为精简 `promptModules.eventAssessment`；
4. 删除旧 `promptConfig`；
5. 删除持久化 `promptAdminView` 快照和点路径旧残留；
6. 删除 `eventUnderstanding` 空业务配置；
7. 后台改为实时生成只读协议预览；
8. 确认实际 prompt 与后台有效预览逐段一致。

### 13.6 阶段五：同步和部署

1. 只修改 canonical `cloudfunctions/_shared` 文件；
2. 执行 `npm run sync:shared`；
3. 校验所有云函数 `_shared` 副本 hash 一致；
4. 运行关键文件语法检查；
5. 运行完整回归；
6. 构建 H5 和小程序；
7. 首批部署：`createTimeline`、`generateAssessmentAI`、`deleteTimeline`；
8. 后台协议同步部署：`adminManage`、`getAISettings`、`updateAISettings`；
9. 部署后用固定真实样例验证写库结果；
10. 确认稳定后固化版本指标和错误率基线。

### 13.7 回滚方案

代码回滚和 DB 回滚必须相互独立：

```text
代码发布失败但 DB 未清理
→ 回滚云函数即可，旧 DB 仍兼容

DB 已清理后需要回滚旧代码
→ 先恢复 settings_global_ai 备份，再回滚云函数
```

禁止在新代码尚未验证前删除 DB 旧规则。部署日志必须记录代码版本、`schemaVersion` 和 `policyVersion`。

## 14. 必测样例

| 原文 | actor | interaction | commitmentStatus | commitmentType | evidenceType | strength |
|---|---|---|---|---|---|---|
| 他要请我吃饭 | target | promised | promised | meal_invitation | fact | medium |
| 我要请他吃饭 | self | promised | promised | meal_invitation | fact | medium |
| 他邀请我去惠州玩 | target | initiated | none | none | fact | medium |
| 我邀请他去惠州玩 | self | initiated | none | none | fact | medium |
| 他拒绝和我见面 | target | rejected | none | none | fact | strong |
| 我拒绝和他见面 | self | rejected | none | none | fact | strong |
| 我觉得他喜欢我 | self | observed | none | none | feeling | weak |
| 我担心他不喜欢我 | self | observed | none | none | feeling | weak |
| 我约他，他答应了 | both | responded | promised | meet_invitation | fact | medium |
| 说好周末见，但他没来 | target | delayed | broken | meet_invitation | fact | strong |
| 这事感觉怪怪的 | self | observed | none | none | feeling | weak |
| 他先答应周末见，后来说不来了 | target | delayed | broken | meet_invitation | fact | strong |
| 他拒绝交往，但说以后可以做朋友 | target | rejected | none | none | fact | strong |

还应增加：

- 微信双方对话；
- 多动作复杂句；
- 含姓名的聊天；
- 省略主语；
- 反问句；
- 否定句；
- 俗语和网络新梗；
- AI 缺字段；
- AI 返回非法枚举；
- AI 超时和 Token 不足。

## 15. 验收标准

必须同时满足：

1. 新增记录只进行一次语义分析 AI 调用；
2. AI 返回严格、可解析的 `NormalizedEventV1`；
3. `subjectRole`、`semanticTags` 和评分来自同一份 `event`；
4. AI 不返回 `eventType` 和任何评分数值；
5. `eventType` 只由 `deriveEventType` 生成；
6. AI 语义结果不再被 description 关键词代码覆盖；
7. actor=self 时三项评分归零；
8. actor=unknown 时使用 `note + 零分`；
9. AI 失败时不猜主体、不使用中文关键词评分、不继续展示失败结果中的 copy；
10. 用户手工标签不被 AI 覆盖；
11. `commitment.type` 只来自 `event.commitmentType`，不从 scene 推断；
12. categories 只由 signals 投影，现有 signalSummary 链路不断；
13. currentStatus、rawReply、explanation、petLine 和 petMood 均按第 7.3 节映射；
14. `rule_inferred` 不再出现在新协议、后台文案和前端类型中；
15. DB 不再同时保存新旧两套业务提示词；
16. 后台有效 prompt 预览与实际调用内容一致；
17. 完整回归测试通过；
18. 记录修改前后输入 Token、输出 Token、解析成功率和响应时间；
19. 主体方向、事实/感受、主结果和承诺测试集达到验收预期；
20. 自动遍历 `actor × interaction × commitmentStatus × evidenceType × strength` 全组合，无未覆盖分支；
21. self/unknown 的所有枚举合法组合始终为 `note + 三项零分`；
22. feeling/unclear 的所有组合始终不得改变意向、风险和证据；
23. target/both 的所有允许组合符合固定计算顺序和 clamp 规则；
24. target/both 的矩阵外组合均安全降级并记录 validationError；
25. `schemaVersion=1`、`policyVersion=1` 被写入结构化日志或评估记录，便于审计和回滚；
26. 每条新时间线记录保存完整 `analysisSnapshot`；
27. 删除记录后的重建只重放 snapshot，不调用 AI、不重新套用当前评分政策；
28. snapshot 缺失时使用 `LEGACY_EVENT_SEMANTICS_MISSING + note + 三项零分`；
29. pending 记录不会被前端 syncSemanticTags 或后端 batchTag 触发第二次模型调用。

## 16. 不在本次范围内

- 不修改用户历史时间线数据；
- 不重新解释旧记录；
- 不恢复中文正则主体推断；
- 不把 DB 自由文本当作数据协议；
- 不在新旧代码未兼容前直接清空线上 DB 规则；
- 不在未验证回归和线上 prompt 前直接全量部署。

## 17. 最终建议

推荐采用：

```text
单次 eventAssessment AI
+ NormalizedEventV1
+ 代码语义投影
+ 代码评分表
+ 结构化 copy
+ 精简 DB 配置
```

这比单纯删掉几句提示词更重要。它能同时解决：

- prompt 重复；
- 主体判断不一致；
- semanticTags 被覆盖；
- AI 数值评分漂移；
- rawReply 格式脆弱；
- DB 新旧配置混杂；
- 后台预览与真实调用不一致；
- Token 和响应时间偏高。
