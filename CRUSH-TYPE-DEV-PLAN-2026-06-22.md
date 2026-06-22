# Crush 类型标签体系开发计划

> 日期：2026-06-22
> 目标：把现有评分、风险、证据和信号标签，包装成用户一眼能看懂、愿意分享、愿意长期追踪的「Crush 类型」。

## 一、背景判断

当前系统已经具备底层判断能力：

- `intentScore`：意向分
- `consistencyRiskScore`：风险分
- `evidenceLevel`：证据等级
- `primaryLabels`：核心风险/证据标签
- `signalSummary`：主动、投入、推进、一致性、回避、可验证、不稳定等底层维度
- `eventInsight / semanticTags`：单条事件的主动、回应、承诺、兑现、拖延等结构化信号

问题不在模型能力，而在用户展示层：

- `E1/E2/E3`、`primaryLabels`、`nextAction` 等系统标签对普通用户不够直观。
- Hero 上缺少一个能快速概括当前关系状态的主标签。
- 分享页和 quickRead 缺少「我测出来是什么型」这样的传播钩子。

因此本次不重写底层模型，只新增一个用户侧命名层：

```ts
deriveCrushType(latestResult, timelineStats?)
```

## 二、产品目标

1. 首页、档案卡、详情页 Hero 一眼显示当前 Crush 类型。
2. quickRead 结果也输出同一套类型标签。
3. 分享落地页保留朋友快照，同时增加「测测我的 TA」三步轻表单，把看热闹用户转成自己的 quickRead。
4. 原有系统标签不再作为主展示内容，降级为「判断依据」。
5. 分享文案可直接使用类型标签，例如：

```text
我测出来是「暧昧观望型」，你帮我看看准不准？
小咪说 TA 是「嘴甜行动少型」，这像不像他？
```

## 三、非目标

- 不改现有评分算法。
- 不让 AI 自由生成类型，避免每次结果漂移。
- 不删除底层字段，只调整前台展示层级。
- 不第一版做复杂历史类型曲线，只保留后续扩展空间。

## 四、v1 类型集合

第一版控制在 8 个，覆盖主要场景：

| key | 用户展示 | 一句话解释 |
| --- | --- | --- |
| `insufficient_evidence` | 证据不足型 | 信息还不够，不适合直接下结论。 |
| `ambiguous_observer` | 暧昧观望型 | 有好感或回应，但推进还不够明确。 |
| `warming_stable` | 稳定升温型 | 互动在变清晰，风险暂时不高。 |
| `serious_progressor` | 认真推进型 | 不只说，也开始用行动推进关系。 |
| `sweet_talker_low_action` | 嘴甜行动少型 | 话说得好听，但兑现和行动偏弱。 |
| `hot_cold` | 忽冷忽热型 | 热度波动明显，稳定性不足。 |
| `low_cost_flirt` | 低成本暧昧型 | 有暧昧氛围，但实际投入不够。 |
| `friend_boundary` | 朋友边界型 | 互动舒服，但暧昧推进信号不足。 |

## 五、类型推导优先级

类型必须稳定、可解释，所以按优先级规则映射。

### 输入字段

```ts
type CrushTypeInput = {
  intentScore?: number
  consistencyRiskScore?: number
  evidenceLevel?: 'E1' | 'E2' | 'E3' | 'E4' | 'E5'
  primaryLabels?: string[]
  signalSummary?: {
    initiative?: number
    investment?: number
    progression?: number
    consistency?: number
    avoidance?: number
    verifiability?: number
    instability?: number
    evidence_strength?: number
  }
  timelineStats?: {
    totalCount?: number
    targetCommittedCount?: number
    fulfilledCount?: number
    cancelledDelayedCount?: number
    targetInitiatedCount?: number
    selfInitiatedCount?: number
  }
}
```

### 规则草案

1. 证据不足优先：

```ts
if evidenceLevel in E1/E2 or primaryLabels includes "证据不足"
  -> 证据不足型
```

2. 明确风险标签优先：

```ts
if primaryLabels includes "口头热情，行动不足"
  -> 嘴甜行动少型

if primaryLabels includes "节奏明显不稳定"
  -> 忽冷忽热型
```

3. 高风险 + 有暧昧/回应，但投入不足：

```ts
if intentScore >= 50 and riskScore >= 60
  -> 低成本暧昧型
```

4. 高意向低风险：

```ts
if intentScore >= 70 and riskScore < 45 and fulfilledCount > 0
  -> 认真推进型

if intentScore >= 60 and riskScore < 45
  -> 稳定升温型
```

5. 中间状态：

```ts
if intentScore >= 45 and intentScore < 65
  -> 暧昧观望型
```

6. 低意向低风险：

```ts
if intentScore < 45 and riskScore < 55
  -> 朋友边界型
```

7. 默认兜底：

```ts
-> 暧昧观望型
```

## 六、展示层调整

### Hero 主信息

Hero 最多展示三层：

```text
TA 当前是：嘴甜行动少型
甜度 68 · 风险 57
小咪建议：先看 TA 会不会把「下次」变成具体时间。
```

### 原标签降级

| 原字段 | 调整后位置 |
| --- | --- |
| `primaryLabels` | 放入「为什么这么判断」 |
| `evidenceLevel` | 改为自然语言证据说明 |
| `nextAction` | 改为自然语言下一步建议 |
| `signalSummary` | 不直接展示，只参与类型推导 |
| `intentScore/riskScore` | 保留为辅助数字，不做主标题 |

### 判断依据文案

把系统词翻译成用户词：

| 系统标签 | 用户文案 |
| --- | --- |
| 口头热情，行动不足 | 说得多，落地少 |
| 节奏明显不稳定 | 热度来回波动 |
| 关键问题难验证 | 关键说法还没被行动证明 |
| 单向投入 | 更多是你在推动 |
| 证据不足 | 现在还不能只靠感觉下结论 |

## 七、开发批次

### 第 1 批：规则与工具函数

新增：

- `src/utils/crush-type.ts`

导出：

```ts
deriveCrushType(input)
mapEvidenceLabel(level)
mapNextActionText(nextAction, crushType?)
buildCrushTypeReasons(input, crushType)
```

验收：

- 8 个类型均有稳定映射。
- 缺字段时不报错。
- 规则结果不依赖 AI 随机输出。

### 第 2 批：首页 Hero 接入

改动：

- `src/pages/index/index.vue`

展示：

- 当前 Crush 类型
- 一句解释
- 意向/风险辅助数字
- 自然语言下一步建议

处理：

- 原有 `primaryLabels` 不再放在 Hero 主视觉里。
- 如无 `latestResult`，展示「证据不足型」或「先记录第一条真实互动」。

验收：

- 用户进入首页第一眼能看到类型。
- 原评分仍可查看，但不抢主标题。

### 第 3 批：Case 列表和详情页接入

改动：

- `src/pages/cases/cases.vue`
- `src/pages/case-detail/case-detail.vue`

展示：

- Case 卡片显示类型 badge。
- 详情页 Hero 显示类型 + 解释。

验收：

- 多个 Crush 时，用户能一眼比较不同对象状态。
- 类型在列表、详情、首页保持一致。

### 第 4 批：quickRead 输出类型

改动：

- `cloudfunctions/quickRead/index.js`
- `src/pages/quick-read/quick-read.vue`
- `src/utils/api.ts`

新增「测测我的 TA」轻表单：

```text
分享快照页
  -> CTA：测测我的 TA
  -> Step 1 选择场景
  -> Step 2 填一句事实
  -> Step 3 选择困惑
  -> quickRead 返回 Crush 类型 + 意向/风险 + 小咪建议
  -> CTA：保存并持续追踪
```

三步字段：

| 步骤 | 字段 | 首批选项 |
| --- | --- | --- |
| 1 | `scene` | 聊天回复 / 约见推进 / 忽冷忽热 / 前任暧昧 / 见面后变化 |
| 2 | `text` | 用户填写：TA 做了什么？原话是什么？ |
| 3 | `question` | 他喜欢我吗 / 我该不该主动 / 他是不是养鱼 / 怎么回复 |

交互原则：

- 不是开放聊天框，不做泛 AI 对话。
- 先测事件，后补画像。
- 不要求用户先完成 self-profile。
- 如需要安全判断，可在 Step 1 或 Step 3 增加轻量年龄选项：`18 岁以下 / 18 岁以上`。
- 用户点击「保存并持续追踪」后，再进入 self-profile 或默认 Crush 建档流程。

策略：

- quickRead 输入扩展为 `scene/text/question/ageRange?`。
- quickRead 返回 `intentScore/riskScore/evidenceLevel/primaryLabels/signalSummary/crushType` 所需的轻量字段。
- 前端复用 `deriveCrushType()` 得出类型。
- 不让 quickRead 单独生成另一套类型名。

展示：

```text
小咪测出：暧昧观望型
有回应和好感，但推进还不够明确。
```

CTA：

```text
保存后可以继续追踪 TA 会不会从「观望」变成「认真推进」。
```

验收：

- 分享落地页和 quickRead 结果使用同一套类型语言。
- 分享落地页底部有「测测我的 TA」入口，并能完成三步轻表单。
- 三步轻表单提交后能得到 Crush 类型结果。
- quickRead 不创建 case，只有用户点击保存/追踪后才进入建档。

### 第 5 批：分享文案升级

改动：

- `src/utils/share.js`
- `src/pages/index/index.vue` 的 `onShareAppMessage`

分享标题优先使用类型：

```text
我测出来是「暧昧观望型」，你帮我看看准不准？
小咪说 TA 是「嘴甜行动少型」，这像不像他？
```

分享 path 增加：

- `crushTypeKey`
- `crushTypeLabel`
- `crushTypeSummary`

注意：

- 仍然不传 `userId/caseId/openid`。
- 长文解释只传脱敏摘要。

验收：

- 分享落地页能展示分享者的匿名类型快照。
- 不暴露用户身份和档案 ID。

### 第 6 批：后台与数据观察

改动：

- `src/pages/admin/admin.vue` 或相关面板

统计：

- quickRead 结果类型分布
- 分享快照类型分布
- 不同类型的 CTA 点击率
- 不同类型的新用户建档率

验收：

- 能看到哪类标签最容易传播。
- 能判断「嘴甜行动少型」「暧昧观望型」是否带来更高转化。

## 八、建议文件结构

```text
src/utils/crush-type.ts
src/components/CrushTypeBadge.vue
src/components/CrushTypeHero.vue
```

第一版可以只做工具函数，不急着抽组件。等首页、case 列表、详情页都接入后，再视重复程度抽组件。

## 九、测试计划

### 单元测试

新增：

```text
tests/run-crush-type-rules.cjs
```

覆盖：

- 证据不足型
- 嘴甜行动少型
- 忽冷忽热型
- 低成本暧昧型
- 认真推进型
- 稳定升温型
- 暧昧观望型
- 朋友边界型
- 缺字段兜底

### 手工测试

1. 首页有 latestResult：Hero 显示类型。
2. 首页无 latestResult：不报错，提示先记录。
3. Case 列表多个对象：每张卡类型正确。
4. 分享快照：标题和落地页显示类型。
5. quickRead：输入轻事件后显示类型，不自动建档。

## 十、上线顺序建议

推荐先上线：

1. `deriveCrushType` 工具函数
2. 首页 Hero
3. 分享标题
4. quickRead
5. Case 列表/详情页
6. 后台统计

原因：

- 首页 Hero 是留存价值最明显的位置。
- 分享标题是传播价值最明显的位置。
- quickRead 是拉新转化入口。
- 后台统计可以稍后补，不阻塞用户侧验证。

## 十一、最终验收标准

1. 用户打开首页 3 秒内能看懂当前 Crush 状态。
2. 原有系统标签不再作为主标签干扰用户。
3. 类型结果在首页、列表、详情、分享、quickRead 中保持一致。
4. 分享标题能自然表达「我测出来是什么型」。
5. 底层评分和证据逻辑不被破坏。

## 当前结论

Crush 类型不是新模型，而是现有判断能力的产品化表达。第一版应优先做稳定规则映射和 Hero 展示，把复杂标签藏到「为什么这么判断」里，让用户先看到一句能理解、能记住、能分享的结论。
