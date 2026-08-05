# 关系女主角 V1｜DeepSeek 开发交接规格

> 当前状态（2026-08-05）：**V1 工程基线已实施**。男女题库、被测对象性别解析、显示标题和未知性别的一次性选择，以[关系主角男女题库与人物改名开发计划](C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/RELATION-ARCHETYPE-GENDERED-DEV-PLAN-2026-08-03.md)为准；下方“尚未上线”只描述原始交接时点。

> 状态：**V1 工程基线已实施；后续实现以本文件和 2026-08-03 男女题库增量计划共同为准。**
> 前提：题库尚未上线，不存在旧题库、旧草稿、旧测试结果迁移。首发只需初始化并发布 `relation_heroine@1.0.0`。

> 线上复核（2026-08-05）：`getArchetypeQuestionBank`、`saveArchetypeResult`、`getArchetypeResults` 已部署；无性别旧版本已归档，女性和男性 `1.0.0` 题库均已发布，题库复合索引已建立。本文的“尚未上线”只描述原始交接时点，不得作为当前部署状态。

## 1. 产品定义

“关系女主角”不是婚姻危机诊断，也不是判断用户是否该分手。它测试用户本人或当前 Crush 是否具有某位现实人物所代表的稳定相处风格，帮助用户判断“这种人设我喜欢还是想避开”。

首发三种风格：

| key | 展示名 | 好玩标签 | 核心维度 |
| --- | --- | --- | --- |
| `ran_yingying` | 冉莹颖型 | 掌舵大女主 | 主动掌舵、责任兜底、高标准掌控 |
| `tong_chenjie` | 佟晨洁型 | 清醒边界派 | 独立边界、清醒观察、需求表达与止损 |
| `xie_xingfang` | 谢杏芳型 | 长期守护者 | 长期承诺、容错修复、稳定维护 |

结果必须同时写“让人心动的地方”和“需要留意的地方”，不得把任何人物写成绝对正确或绝对负面。

## 2. V1 固定范围

- 必须登录后使用。
- `mode=self` 测自己；`mode=target` 测当前 Crush。
- target 锁定 `options.caseId || getActiveCaseId()`；测试页不可选择、切换或解绑 Crush。
- 切换 Crush 必须退出测试，在首页 swiper 或 `pages/cases/cases` 完成。
- 开始前选择关系阶段，阶段不计分。
- 流程固定为 `6 题快筛 → 选择/确认人物 → 15 题专测 → 3 道情景验证 → 相似度结果`。
- 15 题由 `10 道通用题 + 5 道阶段题` 组成。
- target 所有计分题和情景题增加 `U=无法判断/没观察到`；U 不计分。
- 套餐只使用现有 `features/excludedFeatures`。默认 Trial/Pro/Ultra 开放，Free 关闭。
- V1 不做首页 Banner、不新增 tabBar、不调用 AI 临时生成题目或结果。

## 3. 入口与页面

### 3.1 入口

1. [Crush 详情页](C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/src/pages/case-detail/case-detail.vue)：“桃花匹配度”入口之后、“关系雷达”之前增加卡片 `测测 TA 像哪位关系女主角`，跳转：

```text
/pages/relation-heroine/relation-heroine?mode=target&caseId={caseId}
```

2. [命理桃花页](C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/src/pages/taohua/taohua.vue)“你的桃花人设”区增加轻量入口 `测测我的关系女主角`，跳转：

```text
/pages/relation-heroine/relation-heroine?mode=self
```

3. [桃花人设结果页](C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/src/pages/taohua-persona-result/taohua-persona-result.vue)底部增加同一 self 入口。

入口可见不代表有权限：未登录先登录并 redirect；登录后调用 `checkFeatureAccess('关系女主角')`；Free 显示现有订阅升级入口。

### 3.2 新页面

```text
pages/relation-heroine/relation-heroine.vue
pages/relation-heroine-result/relation-heroine-result.vue
pages/relation-heroine-history/relation-heroine-history.vue
```

答题页状态机：

```text
access-checking -> mode-select -> target-check -> stage-select -> screener
-> person-select -> quiz -> scenario -> submitting -> result
```

补充状态：`locked`、`missing-current-crush`、`insufficient-observation`、`error`。任何异步提交期间按钮禁用，防止重复提交。

## 4. 关系阶段

```ts
type RelationshipStageKey =
  | 'pre_relationship'
  | 'early_dating'
  | 'steady_relationship'
  | 'long_term'
```

| key | 用户文案 |
| --- | --- |
| `pre_relationship` | 还没在一起：刚认识、朋友或暧昧 |
| `early_dating` | 刚开始交往 |
| `steady_relationship` | 稳定交往 |
| `long_term` | 长期共同生活或婚姻 |

阶段只改变 5 道阶段题和 3 道情景题的场景，不改变题目 ID、维度、正反向、分值和阈值。用户更改阶段时清空阶段题与情景题答案，保留通用题答案。

## 5. 统一选项与计分

self：

| key | 文案 | value |
| --- | --- | --- |
| A | 非常像我 | 5 |
| B | 比较像我 | 4 |
| C | 一般 / 看情况 | 3 |
| D | 不太像我 | 2 |
| E | 完全不像我 | 1 |

target：

| key | 文案 | value |
| --- | --- | --- |
| A | 非常像 TA | 5 |
| B | 比较像 TA | 4 |
| C | 一般 / 看情况 | 3 |
| D | 不太像 TA | 2 |
| E | 完全不像 TA | 1 |
| U | 无法判断 / 没观察到 | `null` |

反向题使用 `6 - value`；U 不进入分子或分母。每维至少 3 道有效答案，总计至少 9/15 道有效答案，否则返回 `INSUFFICIENT_OBSERVATION`。观察覆盖度按有效题数判定：13-15 为 `high`，11-12 为 `medium`，9-10 为 `low`。

```ts
dimensionScore = round((sum(adjustedValue) - validCount) / (validCount * 4) * 100)
similarity = round(sum(dimensionScore * dimensionWeight))
```

三维默认权重均为 `1/3`。最终限制在 `0..100`。情景题只输出验证语，不改变相似度。

## 6. 六题快筛（不参与相似度）

每题三个选项分别给 R/T/X 一票。target 另有 U，不投票。少于 4 个有效答案时不自动推荐；并列时展示并列候选，由用户选择。

| id | textSelf / textTarget | R 冉莹颖型 | T 佟晨洁型 | X 谢杏芳型 |
| --- | --- | --- | --- | --- |
| S01 | 大家都在等一个人拍板时，你通常会？ / 大家都在等一个人拍板时，TA通常会？ | 直接分工并推动 | 先看信息和边界再决定 | 先稳住大家再慢慢协调 |
| S02 | 约会或共同安排迟迟定不下来时，你通常会？ / TA通常会？ | 主动把时间地点定下来 | 明确自己能接受什么 | 多配合对方，尽量让安排落地 |
| S03 | 对方让你失望一次时，你更接近？ / TA更接近？ | 先补位解决，再提高要求 | 观察是否持续，必要时拉开距离 | 看后续行动，愿意给修复机会 |
| S04 | 关系里出现分歧时，你通常会？ / TA通常会？ | 提方案并推进一个结果 | 把需求和底线说清楚 | 控制情绪，优先维护长期关系 |
| S05 | 朋友会怎样形容你处理感情？ / 别人更可能怎样形容 TA？ | 能扛事，也比较强势 | 清醒独立，不容易失去自己 | 能忍耐，也愿意守住关系 |
| S06 | 下面哪句话最像你？ / 哪句话最像 TA？ | “事情总得有人推进。” | “喜欢归喜欢，边界也要清楚。” | “一次问题不代表整段关系没救。” |

## 7. 首发 45 道专测题

以下文字就是 V1 种子数据，不允许开发模型自行发挥。`textSelf` 与 `textTarget` 必须分别保存。每个人物 Q01-Q10 为通用题；Q11-Q15 使用第 8 节阶段文本。

### 7.1 冉莹颖型：掌舵大女主

维度：`take_charge` Q01-Q05、`responsibility` Q06-Q10、`standards_control` Q11-Q15。

| id | textSelf | textTarget | reverse |
| --- | --- | --- | --- |
| RQ01 | 大家讨论很久还没结论时，我会主动给出方案。 | 大家讨论很久还没结论时，TA会主动给出方案。 | false |
| RQ02 | 约人见面或做事时，我习惯尽快把时间地点定下来。 | 约人见面或做事时，TA习惯尽快把时间地点定下来。 | false |
| RQ03 | 突然出状况时，我通常先安排谁做什么。 | 突然出状况时，TA通常先安排谁做什么。 | false |
| RQ04 | 意见不一致时，我会推动大家选一个方案继续往前。 | 意见不一致时，TA会推动大家选一个方案继续往前。 | false |
| RQ05 | 重要事情一直没有结论时，我也可以继续等别人推进。 | 重要事情一直没有结论时，TA也可以继续等别人推进。 | true |
| RQ06 | 身边的人掉链子时，我常会先补位，免得事情砸掉。 | 身边的人掉链子时，TA常会先补位，免得事情砸掉。 | false |
| RQ07 | 答应过别人的事，我会想办法做到，不轻易找借口。 | 答应过别人的事，TA会想办法做到，不轻易找借口。 | false |
| RQ08 | 亲近的人遇到麻烦，我很容易把它当成自己的事。 | 亲近的人遇到麻烦，TA很容易把它当成自己的事。 | false |
| RQ09 | 有问题时，我更习惯先处理，情绪可以之后再说。 | 有问题时，TA更习惯先处理，情绪可以之后再说。 | false |
| RQ10 | 亲近的人遇到麻烦时，我通常会等对方求助，不会马上接手。 | 亲近的人遇到麻烦时，TA通常会等对方求助，不会马上接手。 | true |

### 7.2 佟晨洁型：清醒边界派

维度：`independent_boundary` TQ01-TQ05、`clear_observation` TQ06-TQ10、`needs_exit` TQ11-TQ15。

| id | textSelf | textTarget | reverse |
| --- | --- | --- | --- |
| TQ01 | 即使很喜欢一个人，我也会保留自己的生活安排。 | 即使很喜欢一个人，TA也会保留自己的生活安排。 | false |
| TQ02 | 我需要独处或不方便时，会直接说出来。 | TA需要独处或不方便时，会直接说出来。 | false |
| TQ03 | 我不会因为关系亲近，就默认对方可以越过我的边界。 | TA不会因为关系亲近，就默认别人可以越过自己的边界。 | false |
| TQ04 | 我能接受两个人亲密，但不必事事绑定在一起。 | TA能接受两个人亲密，但不必事事绑定在一起。 | false |
| TQ05 | 为了配合喜欢的人，我经常临时放弃自己的重要安排。 | 为了配合喜欢的人，TA经常临时放弃自己的重要安排。 | true |
| TQ06 | 比起一时说得好听，我更看对方之后有没有持续做到。 | 比起一时说得好听，TA更看别人之后有没有持续做到。 | false |
| TQ07 | 我会留意一个人对不同人的态度是否一致。 | TA会留意一个人对不同人的态度是否一致。 | false |
| TQ08 | 有心动时，我也会观察现实上是否真的合适。 | 有心动时，TA也会观察现实上是否真的合适。 | false |
| TQ09 | 我不会因为别人都说“不错”，就忽略自己的真实感受。 | TA不会因为别人都说“不错”，就忽略自己的真实感受。 | false |
| TQ10 | 发现话和行动对不上时，我还是会替对方找理由继续相信。 | 发现话和行动对不上时，TA还是会替对方找理由继续相信。 | true |

### 7.3 谢杏芳型：长期守护者

维度：`long_commitment` XQ01-XQ05、`repair_tolerance` XQ06-XQ10、`stable_maintenance` XQ11-XQ15。

| id | textSelf | textTarget | reverse |
| --- | --- | --- | --- |
| XQ01 | 我看重一个人长期是否稳定，而不只看一时热烈。 | TA看重一个人长期是否稳定，而不只看一时热烈。 | false |
| XQ02 | 确认一段重要关系后，我不会因为一次不愉快就轻易放弃。 | 确认一段重要关系后，TA不会因为一次不愉快就轻易放弃。 | false |
| XQ03 | 做关系决定时，我会把过去的投入和整体相处一起考虑。 | 做关系决定时，TA会把过去的投入和整体相处一起考虑。 | false |
| XQ04 | 我愿意为长期稳定调整一些自己的习惯。 | TA愿意为长期稳定调整一些自己的习惯。 | false |
| XQ05 | 关系刚进入低谷时，我很容易马上想结束。 | 关系刚进入低谷时，TA很容易马上想结束。 | true |
| XQ06 | 对方犯错后，如果有持续行动，我愿意重新观察。 | 别人犯错后，如果有持续行动，TA愿意重新观察。 | false |
| XQ07 | 发生冲突时，我会等情绪缓一点再谈清楚。 | 发生冲突时，TA会等情绪缓一点再谈清楚。 | false |
| XQ08 | 我能区分“一次做错”和“这个人一直不可靠”。 | TA能区分“一次做错”和“这个人一直不可靠”。 | false |
| XQ09 | 修复关系时，我更看后续行动，不只听一句道歉。 | 修复关系时，TA更看后续行动，不只听一句道歉。 | false |
| XQ10 | 对方犯错后，即使持续改变，我也很少愿意再观察。 | 别人犯错后，即使持续改变，TA也很少愿意再观察。 | true |

## 8. 五道阶段题

每个人物下列 5 个 ID 固定对应本人物第三维度，全部 `reverse=false`。每个单元格格式为 `textSelf｜textTarget`。

### 8.1 冉莹颖型 RQ11-RQ15（高标准掌控）

| id | pre_relationship | early_dating | steady_relationship | long_term |
| --- | --- | --- | --- | --- |
| RQ11 | 约见面一直没人定细节时，我会直接给出完整安排｜约见面一直没人定细节时，TA会直接给出完整安排 | 周末约会还没定时，我会把时间地点都安排好｜周末约会还没定时，TA会把时间地点都安排好 | 共同计划拖着没定时，我会接手推进｜共同计划拖着没定时，TA会接手推进 | 家里现实安排迟迟没人处理时，我会接手推进｜家里现实安排迟迟没人处理时，TA会接手推进 |
| RQ12 | 对方临时改约时，我会追问原因并重新定好时间｜别人临时改约时，TA会追问原因并重新定好时间 | 对方反复迟到时，我会明确要求以后怎么做｜对象反复迟到时，TA会明确要求以后怎么做 | 对方反复忘记约定时，我会设下清楚规则｜对象反复忘记约定时，TA会设下清楚规则 | 对方反复忘记家庭安排时，我会建立固定规则｜对象反复忘记家庭安排时，TA会建立固定规则 |
| RQ13 | 一起做事时，如果对方效率太低，我会直接接手｜一起做事时，如果别人效率太低，TA会直接接手 | 准备约会或旅行时，对方做得太慢我会接手｜准备约会或旅行时，对方做得太慢TA会接手 | 共同任务进度太慢时，我会接手关键部分｜共同任务进度太慢时，TA会接手关键部分 | 家庭事务进度太慢时，我会接手关键部分｜家庭事务进度太慢时，TA会接手关键部分 |
| RQ14 | 对方做法和我不同但结果还可以时，我也很难完全不管｜别人做法和TA不同但结果还可以时，TA也很难完全不管 | 对象用自己的方式安排事情时，我常会提醒细节｜对象用自己的方式安排事情时，TA常会提醒细节 | 对象负责一件重要事情时，我会持续确认进度｜对象负责一件重要事情时，TA会持续确认进度 | 对象负责家庭重要事项时，我会持续确认进度｜对象负责家庭重要事项时，TA会持续确认进度 |
| RQ15 | 我不太放心把重要结果完全交给别人决定｜TA不太放心把重要结果完全交给别人决定 | 刚交往时，我也希望重要安排按可控方式进行｜刚交往时，TA也希望重要安排按可控方式进行 | 关系中的重要决定，我希望自己有较大决定权｜关系中的重要决定，TA希望自己有较大决定权 | 家庭的重要决定，我希望自己有较大决定权｜家庭的重要决定，TA希望自己有较大决定权 |

### 8.2 佟晨洁型 TQ11-TQ15（需求表达与止损）

| id | pre_relationship | early_dating | steady_relationship | long_term |
| --- | --- | --- | --- | --- |
| TQ11 | 暧昧让我不舒服时，我会直接问清彼此想法｜暧昧让TA不舒服时，TA会直接问清彼此想法 | 相处方式让我不舒服时，我会明确说出需求｜相处方式让TA不舒服时，TA会明确说出需求 | 长期不满出现时，我会选合适时间认真谈｜长期不满出现时，TA会选合适时间认真谈 | 共同生活的问题反复出现时，我会正式讨论改变方案｜共同生活的问题反复出现时，TA会正式讨论改变方案 |
| TQ12 | 对方一直含糊关系时，我不会无限等下去｜别人一直含糊关系时，TA不会无限等下去 | 对方回避承诺时，我会给自己一个观察期限｜对象回避承诺时，TA会给自己一个观察期限 | 关键问题一直没改变时，我会重新评估关系｜关键问题一直没改变时，TA会重新评估关系 | 长期核心问题没改变时，我会评估分开所需准备｜长期核心问题没改变时，TA会评估分开所需准备 |
| TQ13 | 对方越过边界后，我会明确告诉TA哪里不可以｜别人越过边界后，TA会明确告诉对方哪里不可以 | 对象越过边界后，我会说清后果｜对象越过边界后，TA会说清后果 | 同一边界被反复突破时，我会采取实际行动｜同一边界被反复突破时，TA会采取实际行动 | 长期边界被反复突破时，我会调整相处或生活安排｜长期边界被反复突破时，TA会调整相处或生活安排 |
| TQ14 | 即使很心动，发现核心价值观不合我也会降温｜即使很心动，TA发现核心价值观不合也会降温 | 刚交往就发现核心不合时，我不会假装没事｜刚交往就发现核心不合时，TA不会假装没事 | 相爱但长期不适合时，我会面对这个事实｜相爱但长期不适合时，TA会面对这个事实 | 有很多共同投入但长期不适合时，我仍会正视问题｜有很多共同投入但长期不适合时，TA仍会正视问题 |
| TQ15 | 我不会为了维持暧昧而压住所有真实需求｜TA不会为了维持暧昧而压住所有真实需求 | 我不会为了显得好相处而长期忍住需求｜TA不会为了显得好相处而长期忍住需求 | 我会把真正需要的相处方式讲清楚｜TA会把真正需要的相处方式讲清楚 | 我会把共同生活中不能妥协的需求讲清楚｜TA会把共同生活中不能妥协的需求讲清楚 |

### 8.3 谢杏芳型 XQ11-XQ15（稳定维护）

| id | pre_relationship | early_dating | steady_relationship | long_term |
| --- | --- | --- | --- | --- |
| XQ11 | 有小误会时，我愿意主动把话说开｜有小误会时，TA愿意主动把话说开 | 刚交往有摩擦时，我愿意一起找相处办法｜刚交往有摩擦时，TA愿意一起找相处办法 | 关系进入平淡期时，我会主动创造共同体验｜关系进入平淡期时，TA会主动创造共同体验 | 共同生活变得重复时，我会主动维持仪式和连接｜共同生活变得重复时，TA会主动维持仪式和连接 |
| XQ12 | 对方一次没做好时，我会先看后续表现｜别人一次没做好时，TA会先看后续表现 | 对象犯一次错并认真改时，我愿意继续观察｜对象犯一次错并认真改时，TA愿意继续观察 | 对象犯错后有持续改变时，我愿意参与修复｜对象犯错后有持续改变时，TA愿意参与修复 | 对象犯错后有持续改变时，我愿意给长期修复机会｜对象犯错后有持续改变时，TA愿意给长期修复机会 |
| XQ13 | 别人议论我们时，我会先和当事人确认｜别人议论他们时，TA会先和当事人确认 | 外界不看好时，我会先看两个人真实相处｜外界不看好时，TA会先看两个人真实相处 | 外界意见很多时，我会优先保护双方体面｜外界意见很多时，TA会优先保护双方体面 | 家人或外界施压时，我会先守住关系内部的沟通｜家人或外界施压时，TA会先守住关系内部的沟通 |
| XQ14 | 对方压力大而暂时冷淡时，我愿意多观察一阵｜别人压力大而暂时冷淡时，TA愿意多观察一阵 | 对象处在低谷时，我愿意在合理范围内陪伴｜对象处在低谷时，TA愿意在合理范围内陪伴 | 对象处在低谷时，我愿意承担一部分现实压力｜对象处在低谷时，TA愿意承担一部分现实压力 | 家庭遇到低谷时，我愿意和对象一起扛一段时间｜家庭遇到低谷时，TA愿意和对象一起扛一段时间 |
| XQ15 | 一次争执后，我不会马上否定之前所有相处｜一次争执后，TA不会马上否定之前所有相处 | 一次争执后，我会看能否建立更好的规则｜一次争执后，TA会看能否建立更好的规则 | 严重分歧后，我会综合长期表现再决定｜严重分歧后，TA会综合长期表现再决定 | 重大分歧后，我会把共同投入和未来改变一起考虑｜重大分歧后，TA会把共同投入和未来改变一起考虑 |

## 9. 情景验证题

每个人物 3 个情景 ID，各阶段使用对应场景。种子文件必须实际保存 `textSelf={场景}，你通常会：`、`textTarget={场景}，TA通常会：`；表中选项是不含主语的行为短语，因此 self/target 共用同一选项文本，不在页面运行时替换字符串。target 额外追加 U，典型答案均为 A。

### 9.1 冉莹颖型

| id | 四阶段场景（依次为未在一起 / 刚交往 / 稳定交往 / 长期） | A 典型 | B | C |
| --- | --- | --- | --- | --- |
| RS1 | 一次见面一直定不下来 / 周末安排一直定不下来 / 共同旅行一直没人推进 / 家里一项重要安排迟迟没人处理 | 直接列方案、定时间并分工 | 继续等对方安排 | 暂时取消，不再处理 |
| RS2 | 一起做事的人突然掉链子 / 对象临时忘了重要约定 / 对象负责的任务出了问题 / 家庭重要事务出了问题 | 先补位解决，再谈责任 | 当场指责但不接手 | 完全不管结果 |
| RS3 | 对方做法很慢但还没出错 / 对象安排约会不够周全 / 对象负责的重要事进度缓慢 / 对象处理家庭事项进度缓慢 | 接手关键部分并重新安排 | 全程等待，不提要求 | 直接放弃这件事 |

### 9.2 佟晨洁型

| id | 四阶段场景 | A 典型 | B | C |
| --- | --- | --- | --- | --- |
| TS1 | 暧昧很久不表态 / 刚交往但相处规则含糊 / 稳定关系中需求长期没回应 / 共同生活问题反复没改变 | 说清需求并给出观察期限 | 什么都不说继续等 | 用冷淡让对方猜 |
| TS2 | 对方第一次越过边界 / 对象查看隐私或干涉安排 / 同一边界再次被突破 / 长期边界持续被突破 | 明确边界和后果并观察行动 | 为了和气当没发生 | 立刻公开羞辱对方 |
| TS3 | 很心动但发现核心不合 / 刚交往发现长期目标不同 / 相爱但关键价值观长期冲突 / 共同投入很多但核心方向不同 | 正视不合并做现实评估 | 只要喜欢就忽略问题 | 完全听外界替自己决定 |

### 9.3 谢杏芳型

| id | 四阶段场景 | A 典型 | B | C |
| --- | --- | --- | --- | --- |
| XS1 | 一次误会让互动冷下来 / 第一次严重争执 / 稳定关系出现低谷 / 长期关系经历重大冲突 | 等情绪稳定后沟通并看后续行动 | 马上否定全部关系 | 表面没事但拒绝再沟通 |
| XS2 | 对方一次失约后认真补救 / 对象犯错后持续改正 / 信任受损后对方持续修复 / 长期关系受伤后对方持续修复 | 给有限机会并观察改变 | 只听道歉立即当没事 | 无论如何永不再信任 |
| XS3 | 外界议论两人不合适 / 朋友不看好刚开始的关系 / 外界对关系有很多评价 / 家人和现实压力影响长期关系 | 先保护内部沟通，再综合现实决定 | 完全听外界决定 | 为维护体面拒绝讨论问题 |

有效情景至少 2 题。3/3 为“情景高度吻合”，2/3 为“情景进一步支持”，1/3 为“部分情景吻合”，0/3 为“实际处理方式与该风格差异明显”；不足 2 题显示“观察信息不足”。

## 10. 结果页固定结构

1. `你/当前 Crush 与「{人物}型」相似度 {n}%`。
2. 三维进度条和每维一句可观察解释。
3. `让人心动的地方`。
4. `需要留意的地方`，使用“可能/容易”，不做诊断。
5. `你做判断时可以观察`：列出该用户答案中得分最高和最低的各 2 个行为证据。
6. 情景验证语和 target 观察覆盖度。
7. 分享、重测、测另一人物；target 结果页不能切换 Crush。

| 人物 | 让人心动的地方 | 需要留意的地方 |
| --- | --- | --- |
| 冉莹颖型 | 主动、能扛事、关键时刻有行动力 | 标准过高时可能替别人做决定，让人有被管理感 |
| 佟晨洁型 | 清醒、有边界、不会在喜欢里失去自己 | 观察期过长或止损过快时，可能让人感到距离感 |
| 谢杏芳型 | 稳定、重承诺、愿意给关系修复空间 | 容错过高时可能延迟面对反复发生的问题 |

维度解释固定为：

| dimensionKey | 高分解释 | 低分解释 |
| --- | --- | --- |
| `take_charge` | 遇到模糊局面时更愿意拍板并推进 | 更习惯等待共识或由别人发起 |
| `responsibility` | 关键时刻倾向补位、兑现和收尾 | 更重视各自负责，不会轻易替人兜底 |
| `standards_control` | 对过程和结果都有较强标准与掌控感 | 更能接受别人按自己的方式处理 |
| `independent_boundary` | 亲密中仍能保留安排、空间和边界 | 更容易为了关系压缩自己的空间 |
| `clear_observation` | 更看长期行动与一致性，不被一时表达带走 | 更容易相信当下感受或替不一致找理由 |
| `needs_exit` | 能说清需求，并在反复不合时采取行动 | 更容易等待、回避表达或延后决定 |
| `long_commitment` | 重视长期稳定，不因一次波动否定全部 | 更看重当下体验，关系低谷时更快抽离 |
| `repair_tolerance` | 愿意根据持续行动给出有限修复机会 | 受伤后较难重新开放观察 |
| `stable_maintenance` | 会主动维护连接、体面和共同稳定 | 更倾向让关系自然发展，不主动维系 |

相似度等级：80-100 高度相似；60-79 明显相似；40-59 部分相似；0-39 相似度较低。报告为后台固定文案组合，不调用 AI。

## 11. 后台题库

### 11.1 集合与首发初始化

`cloudfunctions/initDb/index.js` 的 `COLLECTIONS` 新增：

```text
archetype_question_banks
archetype_results
```

V1 无迁移。新增管理员 action `seedArchetypeQuestionBanks`：仅当 `featureKey=关系女主角` 不存在任何文档时，写入一条 `status=draft`、`contentVersion=1.0.0` 的完整种子；重复调用返回 `ALREADY_SEEDED`，不得覆盖管理员编辑。

```ts
type RelationQuestion = {
  id: string
  dimensionKey: string
  textSelf: string
  textTarget: string
  reverse: boolean
}

type RelationScenario = {
  id: string
  textSelf: string
  textTarget: string
  options: Array<{ key: 'A'|'B'|'C'; text: string }>
  typicalOptionKey: 'A'
}

type RelationHeroineArchetype = {
  key: 'ran_yingying'|'tong_chenjie'|'xie_xingfang'
  name: string
  label: string
  enabled: boolean
  dimensions: Array<{ key: string; name: string; weight: number; highText: string; lowText: string }>
  universalQuestions: RelationQuestion[] // 固定 10
  stageQuestions: Record<RelationshipStageKey, RelationQuestion[]> // 每阶段固定 5
  scenarios: Record<RelationshipStageKey, RelationScenario[]> // 每阶段固定 3
  resultCopy: { attraction: string; caution: string }
}

type RelationHeroineContent = {
  stages: Array<{ key: RelationshipStageKey; label: string }>
  screener: Array<{
    id: string
    textSelf: string
    textTarget: string
    options: Array<{ key: 'R'|'T'|'X'; textSelf: string; textTarget: string; voteFor: string }>
  }>
  archetypes: RelationHeroineArchetype[]
}

type QuestionBankDocument = {
  _id: string
  featureKey: '关系女主角'
  contentVersion: string // 首发为 1.0.0
  status: 'draft' | 'published' | 'archived'
  revision: number
  content: RelationHeroineContent
  checksum: string
  createdBy: string
  updatedBy: string
  createdAt: Date
  updatedAt: Date
  publishedAt?: Date
}
```

首发文档 `_id` 固定为 `archetype_bank_relation_heroine_1_0_0`，`revision=1`。以后文档 ID 使用 `archetype_bank_relation_heroine_{semver下划线形式}`。`checksum` 固定为对 `content` 做递归 key 排序后的 JSON 字符串计算 SHA-256 hex；时间、revision、操作者和 status 不进入 checksum。客户端不自行生成 checksum。

索引：普通复合索引 `featureKey + status`；唯一复合索引 `featureKey + contentVersion`。首发发布前不存在旧版本兼容任务；仍保存 `contentVersion`，方便以后后台改题时新建 `1.0.1`。

### 11.2 管理面板

[后台页](C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/src/pages/admin/admin.vue)“运营工具”增加 `题库管理` tab，挂载 `ArchetypeQuestionBankPanel.vue`。面板包含：功能切换、人物筛选、阶段筛选、self/target 并排编辑、题目/选项/权重编辑、手机预览、保存草稿、校验、首次发布。

V1 必做 action（全部复用 `adminManage`，由现有 `requireAdminUser()` 保护）：

```text
getArchetypeQuestionBank
seedArchetypeQuestionBanks
createArchetypeQuestionDraft
saveArchetypeQuestionDraft
validateArchetypeQuestionDraft
publishArchetypeQuestionBank
```

`createArchetypeQuestionDraft({ featureKey, nextVersion })` 在首次发布后把当前 published 内容复制为新 draft；`nextVersion` 必须是未使用的合法 semver。`save` 必须提交 `expectedRevision`；不一致返回 `REVISION_CONFLICT`，防止两个后台页面互相覆盖。published 文档不可直接编辑。发布必须在数据库事务中再次校验 revision 和 checksum，再把原 published 标记为 archived、把当前 draft 标记为 published，保证同一 feature 同时最多一个 published。V1 不要求制作旧数据迁移或结果回填。

管理员 action 契约固定为：

| action | 必填输入 | 成功返回 |
| --- | --- | --- |
| `getArchetypeQuestionBank` | `featureKey`, `status?`, `contentVersion?` | `{ success:true, bank }` |
| `seedArchetypeQuestionBanks` | `featureKey` | `{ success:true, seeded:true, bank }` 或 `ALREADY_SEEDED` |
| `createArchetypeQuestionDraft` | `featureKey`, `nextVersion` | `{ success:true, bank }` |
| `saveArchetypeQuestionDraft` | `bankId`, `expectedRevision`, `content` | `{ success:true, revision, checksum, updatedAt }` |
| `validateArchetypeQuestionDraft` | `bankId`, `expectedRevision` | `{ success:true, valid, errors[], checksum }` |
| `publishArchetypeQuestionBank` | `bankId`, `expectedRevision`, `checksum` | `{ success:true, contentVersion, publishedAt }` |

字段错误统一为 `{ path, code, message }`；管理接口错误码固定包含 `UNAUTHENTICATED`、`ADMIN_REQUIRED`、`BANK_NOT_FOUND`、`ALREADY_SEEDED`、`VERSION_EXISTS`、`REVISION_CONFLICT`、`VALIDATION_FAILED`、`CHECKSUM_MISMATCH`、`PUBLISH_CONFLICT`。

发布校验必须返回逐项错误，至少包括：6 道快筛；3 人物；每人 3 维；每人 10 通用题；四阶段各 5 题；四阶段各 3 情景；通用题 ID 全局唯一；同一阶段内阶段题/情景 ID 唯一；四阶段必须重复使用同一组 Q11-Q15 和 S1-S3 ID；self/target 非空且不相同；U 只用于 target；权重和为 1；结果文案完整；checksum 可重算。

## 12. 客户端与云函数契约

只读 `getArchetypeQuestionBank` 返回当前 published 内容；未首次发布返回 `CONTENT_NOT_PUBLISHED`。客户端不直接读取数据库。

`saveArchetypeResult` 入参：

```ts
{
  kind: 'relation_heroine',
  mode: 'self' | 'target',
  caseId?: string,
  stageKey: RelationshipStageKey,
  personKey: string,
  answers: Array<{ questionId: string; optionKey: 'A'|'B'|'C'|'D'|'E'|'U' }>,
  scenarioAnswers: Array<{ questionId: string; optionKey: 'A'|'B'|'C'|'U' }>,
  contentVersion: string, // 从当前 published 题库读取，首发为 1.0.0
  authUserId: string
}
```

服务端顺序：鉴权 → 套餐权限 → target case 所有权 → 读取指定 published 题库 → 校验阶段、ID、选项和有效题数 → 服务端重算 → 保存。禁止相信客户端上传的分数或相似度。

结果保存 `kind/mode/caseId/stageKey/personKey/answers/scenarioAnswers/similarity/dimensionScores/answeredCount/unknownCount/observationConfidence/contentVersion/algorithmVersion/createdAt`。`algorithmVersion` 固定为 `relation-heroine-v1`。self 不得保存 caseId；结果不修改现有 `latestResult`、`crushType` 或 AI 分析。

本地草稿 key：

```text
archetype_draft:relation_heroine:{userId}:{mode}:{caseId|self}:{personKey}:{contentVersion}
```

## 13. 权限配置

功能键固定为 `关系女主角`，加入 `SubscriptionPanel.vue`、`cloudfunctions/_shared/subscription.js` 和同步副本。默认：Trial/Pro/Ultra 的 `features` 包含且 `excludedFeatures` 不包含；Free 的 `excludedFeatures` 包含。不得增加 `featureSwitches`、次数限制或独立权限表。

当前仓库订阅 `configVersion=5`。两个测试同批开发时，只提升一次到 `6`，并在同一默认配置变更中同时加入 `关系女主角` 和 `Crush名人图鉴`，不得两个分支各自覆盖。现有线上 `settings_subscription` 不会自动合并新数组项，部署后管理员必须在订阅面板逐套餐保存一次预期值，再调用 `getSubscriptionStatus?action=checkFeature` 验证四种套餐。

## 14. 文件清单

```text
src/pages/relation-heroine/relation-heroine.vue
src/pages/relation-heroine-result/relation-heroine-result.vue
src/pages/relation-heroine-history/relation-heroine-history.vue
src/pages/admin/components/panels/ArchetypeQuestionBankPanel.vue
src/components/archetype/ArchetypeOptionList.vue
src/components/archetype/ArchetypeQuizProgress.vue
src/utils/archetype-types.ts
src/utils/archetype-storage.ts
src/utils/feature-keys.ts
cloudfunctions/_shared/relation-heroine-score.js
cloudfunctions/_shared/relation-heroine-v1.json
cloudfunctions/getArchetypeQuestionBank/index.js
cloudfunctions/saveArchetypeResult/index.js
cloudfunctions/getArchetypeResults/index.js
tests/run-relation-heroine-rules.cjs
```

`pages.json` 注册三个页面。`src/utils/api.ts` 增加普通用户三个 API 和管理员六个 action wrapper。规范种子只维护在 `cloudfunctions/_shared/relation-heroine-v1.json`，通过现有 `npm run sync:shared` 同步到云函数；客户端从云端读取，不复制第二份题库。

## 15. DeepSeek 实施顺序

1. 新增集合、共享类型/种子、纯评分函数和规则测试。
2. 新增后台 action、题库面板，完成 seed → edit → validate → publish。
3. 新增只读题库、保存结果、历史查询云函数，验证服务端重算。
4. 接入功能键和四种套餐默认权限。
5. 实现答题状态机、阶段切题、草稿、结果页。
6. 接入三个轻量入口，不改首页 Banner。
7. 运行共享同步、规则测试、回归构建和微信真机验收。

## 16. 必过测试与验收

- seed 只执行一次，重复调用不覆盖；未发布客户端不可开测。
- 非管理员不能读草稿、保存、校验或发布；revision 冲突不能覆盖。
- 三人物各 10 通用 + 四阶段各 5 阶段题 + 四阶段各 3 情景完整。
- self/target 文案完整；target 有 U，self 无 U；U 不计分。
- 四阶段切换只换场景，不换 ID、维度、权重；换阶段会清空阶段答案。
- target 无 caseId、伪造他人 caseId均被拒绝；页面不存在切换 Crush 控件。
- 15/39/40/59/60/79/80/100 等边界文案正确；客户端伪造 similarity 无效。
- Trial/Pro/Ultra 可用，Free 拒绝，后台改套餐后即时生效。
- `npm run sync:shared:dry`、`node tests/run-relation-heroine-rules.cjs`、`npm run test:regression`、`npm run build:h5`、`npm run build:mp-weixin` 通过。
- 微信真机跑通：self 四阶段各一次；target 四阶段各一次；缺少当前 Crush；观察不足；保存与历史查看。

交付时 DeepSeek 必须附：变更文件清单、题库校验输出、规则测试输出、H5/微信构建输出、未完成项。以上任一验收项未通过，不得标记完成。
