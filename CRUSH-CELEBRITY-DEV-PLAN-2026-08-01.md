# Crush 名人图鉴开发计划

> 原功能名：Crush 名人 / 历史人物匹配  
> 推荐正式名：**Crush 名人图鉴**  
> 副标题：12 道题，看看 TA 像哪位古今人物  
> 日期：2026-08-01

## 1. 已确认的产品要求

- 必须登录才能测试。
- 结果表达为人物相似度百分比。
- 真实人物、文学人物和展示内容由配置管理。
- 题目需要重写和扩充，不能继续使用当前失衡权重。
- 定位是轻量、好玩、适合分享的 Crush 人物测试。
- 功能权限接入后台订阅配置。

## 2. 命名方案

### 推荐名称：Crush 名人图鉴

推荐理由：

- 保留产品最重要的 Crush 关键词，用户一眼知道是在测 TA。
- “图鉴”天然适合多人原型、人物卡、收集和后续扩容。
- 不限定“历史人物”，可以容纳古典文学人物和其他配置人物。
- 分享文案自然：“我在 Crush 名人图鉴里测出 TA 像诸葛亮 86%。”

推荐页面文案：

```text
Crush 名人图鉴
12 道题，看看 TA 像哪位古今人物
输出五维关系画像和人物相似度
```

备选名称：

| 名称 | 特点 | 不足 |
| --- | --- | --- |
| TA 是哪位名人 | 最直白 | 品牌感较弱 |
| Crush 人物志 | 有内容栏目感 | 测试感不强 |
| 心动名人局 | 更活泼 | “测 TA”表达不够明确 |
| TA 的古人皮肤 | 社交感强 | 容易显得过度玩梗 |

本文后续统一使用“Crush 名人图鉴”。

## 3. 当前算法必须重做

当前原型从五维 50 分开始做少量加减，用户维度集中在中间区域。20 万次随机答题模拟结果：

| 人物 | 成为第一名的比例 |
| --- | ---: |
| 诸葛亮 | 89.16% |
| 贾宝玉 | 9.65% |
| 林黛玉 | 1.19% |
| 其余 5 人 | 0% |

因此 V1 不能沿用当前权重和人物 profile，必须重新设计理论区间、人物向量和相似度换算。

## 4. 用户流程

```text
首页“好玩测试” / Crush 详情 / “我”页 / 分享落地
  -> 点击“Crush 名人图鉴”
  -> 未登录：跳登录页，登录后 redirect 回测试
  -> 已登录：checkFeatureAccess('Crush名人图鉴')
  -> 选择现有 Crush，或选择“不绑定档案”
  -> 浏览 8 位人物图鉴
  -> 12 道题
  -> 五维标准化
  -> 计算 8 位人物相似度
  -> 展示最像人物、第二相似人物、五维画像
  -> 自动保存 / 分享 / 重测 / 查看人物图鉴
```

人物 chip 的行为统一为“打开人物预览”，不能预设或影响测试结果。

## 5. 五个关系维度

| key | 展示名 | 含义 |
| --- | --- | --- |
| `initiative` | 主动推进 | 主动聊天、邀约、定义关系和推进下一步 |
| `warmth` | 情绪温度 | 关心、回应、共情和互动热度 |
| `reliability` | 兑现度 | 承诺、守时、持续行动和关键时刻表现 |
| `romance` | 浪漫表达 | 情话、仪式感、氛围和示好能力 |
| `boundary` | 边界清晰 | 对暧昧范围、他人距离和关系立场的清晰程度 |

当前“主导性”改成“主动推进”，“靠谱度”改成“兑现度”，更贴近用户可观察的行为。

## 6. 首版完整题目草案

### Q1 你们的聊天通常是谁先开始？

- A. 大多数时候都是 TA 主动找我。
- B. TA 主动稍多，但我也会主动。
- C. 基本五五开。
- D. 主要是我主动，TA 很少发起。

### Q2 TA 想见你时通常怎么做？

- A. 直接给出时间、地点，很快把见面定下来。
- B. 会先问我有没有空，再一起商量。
- C. 经常说“下次见”，但很少落实具体时间。
- D. 基本不主动提见面。

### Q3 TA 答应过你的事情，最后通常怎样？

- A. 基本都能按约定完成。
- B. 大部分做到，变动时会提前解释。
- C. 要提醒很多次才会做。
- D. 经常不了了之或装作没说过。

### Q4 你情绪低落时，TA 更像哪种反应？

- A. 先陪我，再问需要安慰还是解决问题。
- B. 不太会说，但会用实际行动帮忙。
- C. 会说很多暖心的话，实际行动不一定跟上。
- D. 容易回避情绪话题，简单问候后就消失。

### Q5 TA 表达好感的方式更接近？

- A. 直接说清楚，不太让我猜。
- B. 很少说，但会持续照顾细节。
- C. 很会营造暧昧和心动感，却不明确关系。
- D. 对我很好，但和普通朋友的界线不明显。

### Q6 当你拒绝 TA 一次邀约或请求时，TA 会？

- A. 尊重我的选择，之后自然地再找合适机会。
- B. 会问原因，但不会逼迫我。
- C. 明显变冷，让我猜 TA 是不是生气了。
- D. 继续追问或施压，希望我改变答案。

### Q7 在朋友或公开场合，TA 对你的态度？

- A. 会自然地照顾和维护我，态度很明确。
- B. 私下亲近，公开场合比较克制。
- C. 和所有人都很热情，看不出我是否特别。
- D. 会刻意保持距离，不愿让别人误会。

### Q8 TA 对你说过的小事记得怎么样？

- A. 很多细节都记得，还会在之后主动提起。
- B. 重要的事记得，日常小事偶尔忘。
- C. 当时回应很热烈，过后经常不记得。
- D. 很少表现出对我生活细节的了解。

### Q9 TA 和其他可能暧昧对象的边界怎样？

- A. 边界很清楚，也愿意主动让我安心。
- B. 大体清楚，但有些关系需要我询问才解释。
- C. 对很多人都亲近，认为自己只是性格好。
- D. 经常回避这个话题，关系状态很模糊。

### Q10 TA 谈到你们的未来时？

- A. 会主动讨论具体安排，并开始为它行动。
- B. 我提起时会认真回应，但较少主动规划。
- C. 会描述很好听的未来，却很少有下一步。
- D. 经常转移话题，不愿谈关系走向。

### Q11 TA 的互动热度通常稳定吗？

- A. 比较稳定，不会无缘无故突然消失。
- B. 忙的时候会变少，但会解释并恢复联系。
- C. 热的时候非常热，冷的时候像换了一个人。
- D. 整体偏淡，很少出现明显热度。

### Q12 用一句话形容 TA 带给你的感觉？

- A. 稳，重要时候可以相信。
- B. 暖，和 TA 相处很舒服。
- C. 会撩，很容易让人心动。
- D. 难猜，总是不知道下一步在哪里。

## 7. 人物原型配置

首发仍可使用原型中的 8 位人物：

- 武则天
- 项羽
- 赵云
- 诸葛亮
- 贾宝玉
- 段正淳
- 林黛玉
- 柳下惠

人物数据统一配置：

```ts
type CrushCelebrityPerson = {
  key: string
  name: string
  subtitle: string
  coverUrl: string
  profile: {
    initiative: number
    warmth: number
    reliability: number
    romance: number
    boundary: number
  }
  summary: string
  whyMatched: string[]
  watchSignals: string[]
  shareCopy: string
  enabled: boolean
  sortOrder: number
}
```

人物 `enabled=false` 后不出现在图鉴，也不参与结果计算。人物增删不应要求修改页面代码。

## 8. 相似度算法

### 8.1 五维标准化

每个维度根据该维度所有题目的理论最大和最小值转换为 0-100：

```ts
normalized = (raw - theoreticalMin) / (theoreticalMax - theoreticalMin) * 100
```

### 8.2 人物相似度

```ts
distance = sqrt(sum(weight[d] * (user[d] - person[d]) ** 2))
similarity = round(clamp(100 - distance / maxDistance * 100, 0, 100))
```

结果示例：

```text
TA 最像诸葛亮 86%
慢热、观察很久，但认定之后会持续投入

第二相似：赵云 78%
```

- 8 个相似度独立计算，不要求相加等于 100%。
- 最高与第二名差 <= 3% 时，展示“双原型组合”。
- 用户不看到算法距离，只看到百分比。
- 图鉴详情可以显示“你的 TA 与此人物相似度 72%”。

### 8.3 上线校准要求

- 10 万次以上随机组合模拟。
- 8 位人物都必须能成为最高相似结果。
- 任一人物随机第一名占比不得高于 35%。
- 每个人物至少准备 3 套 golden answers。
- 相同答案在 Node、H5、微信小程序中结果一致。

## 9. 登录、权限和保存

### 9.1 功能键

```ts
export const FEATURE_CRUSH_CELEBRITY = 'Crush名人图鉴'
```

集中放入 `src/utils/feature-keys.ts`。

### 9.2 登录与权限顺序

1. 检查 `getCurrentUserId()`。
2. 未登录跳登录页，并传 redirect。
3. 登录后调用 `checkFeatureAccess(FEATURE_CRUSH_CELEBRITY)`。
4. 套餐不支持时展示升级入口。
5. 页面加载和结果保存云函数都再次校验权限。

### 9.3 自动保存

```ts
type CrushCelebrityResult = {
  userId: string
  caseId?: string
  kind: 'crush_celebrity'
  primaryPersonKey: string
  secondaryPersonKey?: string
  similarities: Record<string, number>
  dimensions: Record<string, number>
  contentVersion: string
  algorithmVersion: string
  createdAt: Date
}
```

结果存入独立 `archetype_results` 集合，不覆盖 `latestResult`、`crushType` 或事件分析。

## 10. 后台订阅配置

在现有订阅配置中加入“Crush名人图鉴”：

- 后台 `ALL_FEATURES`
- 试用期功能列表
- 免费版功能/排除列表
- Pro 功能/排除列表
- Ultra 功能/排除列表

默认建议所有登录用户可用，便于拉新和分享；运营可以在后台改为特定套餐。

新增全局配置：

```ts
featureSwitches: {
  'Crush名人图鉴': {
    enabled: true,
    visible: true
  }
}
```

后台提供：

- “显示入口”开关。
- “启用功能”开关。
- 试用/免费/Pro/Ultra 可用 chip。
- 人物内容管理可作为后续独立面板，不和订阅权限混在一起。

## 11. 入口与发现路径

### 11.1 首页

与“关系女主角”共同放在首页 Crush 主卡之后的“好玩测试”模块中。卡片文案：

```text
Crush 名人图鉴
12 道题，看看 TA 像哪位古今人物
```

首页是最重要的发现入口。

### 11.2 Crush 详情

这是转化质量最高的入口。在 [Crush 详情页](C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/src/pages/case-detail/case-detail.vue) 增加：

```text
测测 TA 像哪位名人
```

点击后自动带当前 `caseId`，省略选择 Crush 步骤。

### 11.3 “我”页和分享页

- “我”页增加持久的“好玩测试”卡片。
- 分享落地页展示分享者的脱敏人物结果和“我也测测”。
- 不新增 tabBar。

## 12. 文件规划

```text
src/pages/
  archetype-hub/archetype-hub.vue
  crush-celebrity/crush-celebrity.vue
  crush-celebrity-result/crush-celebrity-result.vue
  crush-celebrity-person/crush-celebrity-person.vue

src/components/
  ArchetypeQuizProgress.vue
  ArchetypeOptionList.vue
  PersonArchetypeCard.vue
  SimilarityBars.vue
  CelebrityPersonPreview.vue

src/utils/
  feature-keys.ts
  crush-celebrity-content.js
  crush-celebrity-score.js
  archetype-storage.js

cloudfunctions/
  saveArchetypeResult/index.js
  getArchetypeResults/index.js
```

## 13. 实施阶段

1. **题库和算法，2 天**：配置 12 题权重、8 人向量、模拟审计、golden answers。
2. **登录和订阅，1-1.5 天**：登录 redirect、功能键、全局开关、套餐权限、云函数校验。
3. **答题和图鉴，2-3 天**：人物预览、选择 Crush、12 题、进度恢复、图鉴详情。
4. **结果和分享，2 天**：相似度、双原型、五维画像、自动保存、分享回流。
5. **入口和回归，1-1.5 天**：首页、Crush 详情、“我”页、多端构建和真机。

预计 V1：8-10 个开发人日。

## 14. 验收标准

- 未登录不能进入测试，登录后能返回原测试路径。
- 后台可以控制全局启用、入口可见性和各套餐权限。
- 人物 chip 只打开预览，不会改变测试结果。
- 8 位人物都能成为最高相似结果，不再出现诸葛亮长期占 89% 的情况。
- 结果展示主人物百分比、第二人物百分比和五维画像。
- 绑定 Crush 和不绑定 Crush 均能完成测试。
- 保存结果不影响现有 Crush 类型和 AI 分析。
- 首页、Crush 详情和“我”页入口均受后台 `visible` 配置控制。
- `npm run test:regression`、`npm run build:h5`、`npm run build:mp-weixin` 通过。

