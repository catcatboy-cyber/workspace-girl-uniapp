# 时间轴 AI 语义标签 开发计划

## 目标

替代前端关键词匹配，让时间轴统计准确识别跨事件逻辑（承诺→兑现、计划→取消等）。标签存数据库，永久缓存。

## 设计原则

- 用户确认的标签优先，AI 只补漏不覆盖
- 不阻塞界面：时间轴先显示，标签后台异步加载
- 标签存 `timeline_records.semanticTags` + `semanticTagsSource`，永久有效

## 标签体系

| 维度 | 标签 | 说明 |
|---|---|---|
| scene | offline_meet | 线下见面 |
| scene | movie | 电影 |
| scene | meal | 吃饭 |
| scene | coffee_tea | 咖啡奶茶 |
| scene | walk_shop | 散步逛街 |
| scene | chat | 线上聊天 |
| scene | group_social | 多人社交 |
| scene | trip | 旅行 |
| behavior | target_initiated | 对方主动 |
| behavior | self_initiated | 我主动 |
| behavior | both_interaction | 双方互动 |
| outcome | planned | 已计划/承诺 |
| outcome | fulfilled | 已兑现 |
| outcome | cancelled_delayed | 取消/拖延 |
| outcome | pending | 待确认 |
| outcome | rejected | 被拒 |
| risk | cold | 冷淡/消失 |
| risk | vague_delay | 含糊拖延 |
| risk | risk_event | 风险事件 |

## 提示词

```
你是关系事件标签分类器。只输出 JSON，不输出任何解释文字。

标签词表：
- scene: offline_meet | movie | meal | coffee_tea | walk_shop | chat | group_social | trip
- behavior: target_initiated | self_initiated | both_interaction
- outcome: planned | fulfilled | cancelled_delayed | pending | rejected
- risk: cold | vague_delay | risk_event

关键规则：
1. 如果前一条事件有 planned（计划/承诺），后一条描述了对应行为，标记为 fulfilled
2. 如果前一条有计划但后续无对应事件，不强行标记
3. 只根据事件描述判断，不猜测
4. 每条事件可以同时有 scene、behavior、outcome、risk 标签
5. 同一维度可以有多个标签（如 scene 同时有 meal 和 chat）

输入格式：
{events: [{index, title, type, description, occurrenceAt}]}

输出格式：
{"results": [{index, scene: [], behavior: [], outcome: [], risk: []}]}

示例：
输入：
[
  {index: 0, title: "他说周末请吃饭", type: "note", description: "他说周末请我吃火锅"},
  {index: 1, title: "一起吃了火锅", type: "positive", description: "今天和他一起吃了火锅"}
]

输出：
{"results": [
  {index: 0, scene: ["meal"], behavior: ["target_initiated"], outcome: ["planned"], risk: []},
  {index: 1, scene: ["meal"], behavior: ["both_interaction"], outcome: ["fulfilled"], risk: []}
]}
```

## AI 参数

| 参数 | 值 |
|---|---|
| temperature | 0.1 |
| max_tokens | 600 |
| 每次送入事件数 | 最多 30 条 |
| 响应时间估算 | 2-3 秒 |

## 数据流

```
用户打开时间轴
  → loadData() 加载 caseDetail（含所有 timeline）
  → 页面立即渲染（不阻塞）
  → 检查 manualTimeline 中是否有未打标事件（无 semanticTags 或 semanticTagsSource != 'user'）
  → 有 → 异步调用 batchTagEvents(caseId)
    → 云函数查询该 case 下未打标事件（最近 30 条）
    → 构造提示词，调用 AI
    → 解析 JSON，逐条 update 写回 timeline_records
    → 返回 { success, tagged }
  → 前端收到结果 → 刷新 caseFile.timeline → buildTimelineStats 自动更新
```

## 用户标签保护

- `semanticTagsSource: 'user'` → AI 绝不覆盖
- `semanticTagsSource: 'ai'` → AI 可刷新
- 新增字段 `semanticTagsSource`，默认 `null`

## 实现步骤

### 1. 云函数

- `cloudfunctions/generateAssessmentAI/index.js`：新增 action `'batchTagEvents'`
- 新建 `cloudfunctions/generateAssessmentAI/_shared/event-tagger.js`：提示词构建 + AI 调用封装

### 2. 前端

- `src/utils/api.ts`：新增 `batchTagEvents(caseId)`
- `src/pages/timeline/timeline.vue`：
  - `loadData` 完成后调 `syncSemanticTags()`
  - `syncSemanticTags` 异步调用 API，不设 loading
  - 返回后合并标签到本地数据
- `src/utils/insights.js`：
  - `getTimelineRecordTags` 已有优先读 `semanticTags` 的逻辑，无需改动

### 3. 数据库

- `timeline_records` 已有 `semanticTags` 字段，无需迁移
- 新增 `semanticTagsSource` 字段（`'user'` / `'ai'` / `null`）

## 验证

1. 打开时间轴 → 关键事件立即显示 → 2-3 秒后标签同步完成，统计更新
2. 再次打开 → 不调 AI，直接显示缓存的统计
3. 录入新事件后打开 → 只增量打标新事件
4. 跨事件逻辑：承诺→兑现被正确标记
