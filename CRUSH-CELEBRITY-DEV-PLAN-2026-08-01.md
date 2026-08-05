# Crush 名人图鉴开发计划

> 本文第 5-8 节保留为首发内容基准；DeepSeek 工程实施请使用：[Crush 名人图鉴 V1 开发交接规格](C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/CRUSH-CELEBRITY-DEEPSEEK-HANDOFF-2026-08-01.md)。

> 后续增量以[名人与次元角色图鉴开发计划](C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/DIMENSION-CHARACTER-AND-CELEBRITY-GENDER-DEV-PLAN-2026-08-04.md)为准：名人题库已升级为按被测对象性别筛选的 `1.1.0`，旧的无性别 `1.0.0` 仅作历史版本。

> 原功能名：Crush 名人 / 历史人物匹配  
> 推荐正式名：**Crush 名人图鉴**  
> 副标题：12 道题，看看 TA 像哪位古今人物  
> 日期：2026-08-01

> 执行状态：**内容基准已实施；性别增量已实施并发布 `1.1.0`**
> 视觉参考：现有页面的轻量入口样式；V1 不改造首页 Banner。
> V1 固定首发 48 位人物：历史、近代、当代各 16 位。本文中的题目得分矩阵、人物向量、功能键和接口字段不得由开发模型自行改写。

## 1. 已确认的产品要求

- 必须登录才能测试。
- 结果表达为人物相似度百分比。
- 真实人物和展示内容由版本化题库管理；V1 不包含虚构文学人物。
- 题目需要重写和扩充，不能继续使用当前失衡权重。
- 定位是轻量、好玩、适合分享的人物风格测试，支持“测自己”和“测当前 Crush”。
- target 模式只使用项目现有活动 Crush，不允许在测试页选择、更换或不绑定 Crush。
- 功能只接入现有订阅配置的 `features/excludedFeatures`，不新增 `featureSwitches`、次数限制或另一套权限系统。
- 默认权限：试用期开放、免费版关闭、Pro 开放、Ultra 开放；管理员之后可自行配置。
- 入口不新增首页 Banner：当前 Crush 从“我们”页/Crush 详情页进入，自测从“你的桃花人设”进入。

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
  -> 选择“测自己”或“测当前 Crush”
  -> 测当前 Crush：锁定进入页面时的 activeCaseId
  -> 没有 activeCaseId：提示先去首页滑动或 Crushes 页面选择
  -> 浏览 48 位人物图鉴（历史/近代/当代）
  -> 12 道题
  -> 五维标准化
  -> 计算全部已启用人物相似度
  -> 展示最像人物、第二相似人物、五维画像
  -> 自动保存 / 分享 / 重测 / 查看人物图鉴
```

人物 chip 的行为统一为“打开人物预览”，不能预设或影响测试结果。

页面状态固定为：`access-checking`、`mode-select`、`missing-current-crush`、`gallery`、`quiz`、`saving`、`result`、`locked`、`error`。检查权限和保存期间按钮必须禁用；网络失败保留答案并允许重试；答题中返回需确认“退出并保留草稿 / 继续答题”。

### 当前 Crush 锁定规则

```ts
const lockedCaseId = mode === 'target'
  ? String(options.caseId || getActiveCaseId() || '').trim()
  : ''
```

- `mode=self`：不读取、不保存 `caseId`。
- `mode=target`：`lockedCaseId` 必填，通过 `getCaseDetail` 校验归属并获取只读姓名、头像。
- 测试页顶部显示“正在测试：{Crush 名称}”，不得出现对象选择器、切换按钮或“不绑定档案”。
- 页面加载后锁定 caseId，不调用 `setActiveCaseId`，也不跟随外部活动对象变化。
- 更换对象必须退出，到首页左右滑动或 `Crushes` 页面完成切换，再重新进入。
- 从“我们”页/Crush 详情入口进入时传入当前详情 `caseId`。

### Self 与 Crush 题本决策

结论：**题目文字不同，但观察指标、得分矩阵和人物匹配算法完全相同。**

- self 版询问“我通常怎么做”，target 版询问“当前 Crush 长期怎么做”。
- Q1-Q12 的 id 和第 8.1 节选项得分矩阵不变，保证两个模式使用同一把尺子。
- 每个选项都直接配置 `textSelf` 和 `textTarget`，不能在页面运行时批量替换“我/TA”。
- target 模式额外提供 U“无法判断 / 没观察到”。U 不参与任何维度平均值，不能强迫用户猜一个最接近答案。
- 结果标题分别为“你的名人风格”和“当前 Crush 的名人风格”，历史记录按 `mode` 区分。

示例：

| self | target |
| --- | --- |
| 我想见对方时，会直接给出时间地点 | TA想见我时，会直接给出时间地点 |
| 对方情绪低落时，我会先陪伴再询问需要 | 我情绪低落时，TA会先陪伴再询问需要 |
| 我和其他可能暧昧对象的边界很清楚 | TA和其他可能暧昧对象的边界很清楚 |

规则测试必须确认 12 道题的 A-D 选项都同时存在 self/target 文案，target 另有 12 个 U 选项；两个模式对相同语义的 A-D 答案计算出的五维结果一致。

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

### 6.1 两种模式的题目主语

题目配置同时保存 `textSelf` 和 `textTarget`，不能在页面运行时用简单字符串替换“TA/我”，避免语义错误。以下 Q1-Q12 正文是 `target` 版本；`self` 版本固定为：

| 题号 | `textSelf` |
| --- | --- |
| Q1 | 你和喜欢的人聊天时，通常是谁先开始？ |
| Q2 | 你想见对方时通常怎么做？ |
| Q3 | 你答应对方的事情，最后通常怎样？ |
| Q4 | 对方情绪低落时，你更像哪种反应？ |
| Q5 | 你表达好感的方式更接近？ |
| Q6 | 对方拒绝你一次邀约或请求时，你会？ |
| Q7 | 在朋友或公开场合，你对对方的态度？ |
| Q8 | 对方说过的小事，你记得怎么样？ |
| Q9 | 你和其他可能暧昧对象的边界怎样？ |
| Q10 | 谈到你们的未来时，你会？ |
| Q11 | 你的互动热度通常稳定吗？ |
| Q12 | 你觉得自己带给对方的感觉更接近？ |

`self` 模式 A-D 选项保持与 target 版相同的行为含义，但将“TA”改为“我”、将“我”改为“对方”。这些文本必须直接写入配置并加入快照测试，不能在模板中临时替换。target 模式每题追加 U“无法判断 / 没观察到”，self 模式不显示 U。

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

### 7.1 V1 固定人物池

V1 首发 48 位真实人物，历史、近代、当代各 16 位。页面按时代筛选，测试结果默认对全部 `enabled=true` 人物计算。

五维列顺序：`主动推进 initiative / 情绪温度 warmth / 兑现度 reliability / 浪漫表达 romance / 边界清晰 boundary`，取值均为 0-100。

#### 历史人物

| key | 人物 | 主动 | 温度 | 兑现 | 浪漫 | 边界 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `wu_zetian` | 武则天 | 95 | 45 | 88 | 35 | 90 |
| `xiang_yu` | 项羽 | 92 | 72 | 45 | 85 | 40 |
| `zhao_yun` | 赵云 | 70 | 72 | 95 | 45 | 92 |
| `zhuge_liang` | 诸葛亮 | 65 | 58 | 96 | 35 | 88 |
| `li_qingzhao` | 李清照 | 52 | 88 | 70 | 92 | 68 |
| `wang_yangming` | 王阳明 | 72 | 62 | 92 | 38 | 90 |
| `su_shi` | 苏轼 | 68 | 90 | 74 | 88 | 66 |
| `li_bai` | 李白 | 78 | 82 | 42 | 98 | 38 |
| `hua_mulan` | 花木兰 | 82 | 64 | 94 | 35 | 92 |
| `wang_zhaojun` | 王昭君 | 58 | 78 | 88 | 62 | 85 |
| `tang_bohu` | 唐伯虎 | 75 | 80 | 48 | 96 | 42 |
| `cao_cao` | 曹操 | 96 | 52 | 84 | 48 | 72 |
| `du_fu` | 杜甫 | 55 | 90 | 92 | 72 | 80 |
| `xin_qiji` | 辛弃疾 | 88 | 70 | 86 | 66 | 82 |
| `shangguan_waner` | 上官婉儿 | 85 | 60 | 90 | 58 | 88 |
| `lanling_wang` | 兰陵王 | 76 | 55 | 90 | 60 | 86 |

#### 近代人物

| key | 人物 | 主动 | 温度 | 兑现 | 浪漫 | 边界 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `zhang_ailing` | 张爱玲 | 42 | 60 | 68 | 82 | 92 |
| `lin_huiyin` | 林徽因 | 72 | 82 | 84 | 90 | 82 |
| `xu_zhimo` | 徐志摩 | 85 | 86 | 42 | 100 | 35 |
| `hu_shi` | 胡适 | 68 | 65 | 90 | 52 | 88 |
| `song_qingling` | 宋庆龄 | 78 | 72 | 96 | 45 | 94 |
| `lu_xun` | 鲁迅 | 82 | 48 | 90 | 35 | 95 |
| `qian_zhongshu` | 钱钟书 | 55 | 62 | 88 | 70 | 90 |
| `yang_jiang` | 杨绛 | 58 | 82 | 98 | 62 | 94 |
| `lu_xiaoman` | 陆小曼 | 78 | 80 | 38 | 95 | 40 |
| `liang_sicheng` | 梁思成 | 70 | 68 | 95 | 55 | 88 |
| `bing_xin` | 冰心 | 60 | 92 | 86 | 68 | 86 |
| `mei_lanfang` | 梅兰芳 | 74 | 75 | 96 | 82 | 92 |
| `xiao_hong` | 萧红 | 62 | 85 | 52 | 88 | 58 |
| `shen_congwen` | 沈从文 | 56 | 88 | 80 | 90 | 72 |
| `zhang_xueliang` | 张学良 | 88 | 75 | 45 | 88 | 48 |
| `zhou_enlai` | 周恩来 | 90 | 85 | 100 | 58 | 98 |

#### 当代人物

| key | 人物 | 主动 | 温度 | 兑现 | 浪漫 | 边界 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `wang_fei` | 王菲 | 50 | 55 | 72 | 88 | 98 |
| `zhou_xun` | 周迅 | 72 | 95 | 65 | 96 | 62 |
| `liu_dehua` | 刘德华 | 78 | 82 | 98 | 70 | 94 |
| `zhou_jielun` | 周杰伦 | 68 | 65 | 88 | 92 | 86 |
| `zhang_manyu` | 张曼玉 | 55 | 75 | 85 | 82 | 95 |
| `liang_chaowei` | 梁朝伟 | 38 | 72 | 92 | 78 | 96 |
| `shu_qi` | 舒淇 | 70 | 88 | 82 | 86 | 88 |
| `gong_li` | 巩俐 | 88 | 62 | 94 | 65 | 96 |
| `mo_wenwei` | 莫文蔚 | 72 | 86 | 92 | 90 | 90 |
| `chen_yixun` | 陈奕迅 | 78 | 96 | 72 | 90 | 70 |
| `michelle_yeoh` | 杨紫琼 | 92 | 75 | 98 | 58 | 98 |
| `tang_wei` | 汤唯 | 60 | 82 | 84 | 88 | 90 |
| `takeshi_kaneshiro` | 金城武 | 35 | 68 | 88 | 75 | 98 |
| `leslie_cheung` | 张国荣 | 82 | 98 | 78 | 100 | 74 |
| `brigitte_lin` | 林青霞 | 84 | 72 | 90 | 78 | 96 |
| `cai_kangyong` | 蔡康永 | 58 | 96 | 92 | 72 | 94 |

以上向量是 V1 固定基线。校准时只能在独立提交中对单项做不超过 `±5` 的调整，并附模拟前后分布；不得为了让某人物更常出现而增加隐藏权重或随机偏置。

### 7.2 配置结构

人物数据统一配置：

```ts
type CrushCelebrityPerson = {
  key: string
  name: string
  era: 'history' | 'modern' | 'contemporary'
  typeLabel?: string
  subtitle: string
  coverUrl: string
  profile: {
    initiative: number
    warmth: number
    reliability: number
    romance: number
    boundary: number
  }
  summary?: string
  shareCopy?: string
  enabled: boolean
  sortOrder: number
  contentVersion: string
}
```

人物 `enabled=false` 后不出现在图鉴，也不参与结果计算。人物增删不应要求修改页面代码。

### 7.3 V1 确定性结果文案

为了避免开发模型临时创作 48 套人物评价，V1 使用固定生成规则；配置中有人工文案时优先使用，没有时使用下列规则。

维度短语：

| 维度 | 高分短语 | 低分观察短语 |
| --- | --- | --- |
| initiative | 主动推进，不喜欢关系长期停在原地 | 更习惯等待明确信号后再行动 |
| warmth | 情绪回应直接，容易让人感到被在意 | 表达温度较克制，需要从行动中观察 |
| reliability | 重视承诺和持续行动 | 容易受状态影响，需要观察是否长期兑现 |
| romance | 擅长制造心动和表达好感 | 更偏实际，不一定主动营造浪漫氛围 |
| boundary | 关系立场和边界比较清楚 | 互动范围可能较模糊，需要关注关系定义 |

生成规则：

1. `typeLabel`：人物向量最高的两个维度对应短标签组合，如“兑现边界型”“温度浪漫型”。
2. `summary`：`{人物名}型的核心特征是：{最高维度高分短语}；同时，{第二高维度高分短语}。`
3. `whyMatched`：取用户与人物绝对差值最小的 3 个维度，输出 `你们在「{维度展示名}」上的表现最接近，差值 {diff} 分。`
4. `watchSignals`：取人物最低的 2 个维度，输出相应“低分观察短语”。
5. `shareCopy`：`我在 Crush 名人图鉴里测出{主体}像「{人物名}」{similarity}%，第二像「{第二人物名}」{secondarySimilarity}%。`

主体：`mode=self` 使用“自己”，`mode=target` 使用“TA”。文案生成必须是纯函数，相同输入永远返回相同文本。

## 8. 相似度算法

### 8.1 题目选项得分矩阵

每个选项直接贡献 0-100 的维度分。最终维度分等于该维度所有有效贡献的算术平均值并四舍五入，不再从 50 分开始做加减。

缩写：`I=initiative`、`W=warmth`、`R=reliability`、`O=romance`、`B=boundary`。表格中未列出的维度不参与该题平均值。

| 题号 | A | B | C | D |
| --- | --- | --- | --- | --- |
| Q1 | I100 | I75 | I50 | I15 |
| Q2 | I100/R95/O70 | I70/R75/O60 | I45/R25/O45 | I10/R15/O10 |
| Q3 | R100 | R80 | R35 | R5 |
| Q4 | W100/R90 | W65/R95 | W90/R35 | W15/R15 |
| Q5 | W75/O70/B95 | W90/O40/B85 | W75/O100/B20 | W65/O35/B35 |
| Q6 | W85/B100 | W70/B75 | W25/B35 | W20/B5 |
| Q7 | W85/O65/B95 | W65/O50/B80 | W80/O60/B30 | W20/O15/B45 |
| Q8 | W100/R95 | W70/R75 | W75/R35 | W20/R15 |
| Q9 | B100 | B75 | B25 | B5 |
| Q10 | I100/R95 | I65/R75 | I70/R25 | I10/R15 |
| Q11 | W90/R95/O60 | W75/R80/O45 | W85/R25/O90 | W25/R30/O20 |
| Q12 | I70/W65/R100/O35/B90 | I55/W100/R80/O50/B85 | I80/W85/R35/O100/B25 | I15/W25/R30/O35/B20 |

实现数据结构：

```ts
type CelebrityQuestionOption = {
  key: 'A' | 'B' | 'C' | 'D' | 'U'
  text: string
  scores: Partial<Record<CelebrityDimensionKey, number>>
}
```

U 的 `scores` 必须为空对象。所有题目必须配置唯一 id `CQ01-CQ12`。缺题、多题、未知 option key 或某维度没有任何有效贡献时直接返回 `INVALID_ARGUMENT`，不得用默认 50 分兜底。

target 模式最低证据要求：

- 12 题中至少 8 题选择 A-D。
- 每个维度至少获得 2 个有效题目贡献。
- 未达到要求时返回 `INSUFFICIENT_OBSERVATION`，不生成名人百分比。
- 覆盖度：11-12 为高、9-10 为中、8 为较低。

### 8.2 人物相似度

```ts
const weights = {
  initiative: 0.2,
  warmth: 0.2,
  reliability: 0.2,
  romance: 0.2,
  boundary: 0.2
}

distance = sqrt(sum(weights[d] * (user[d] - person[d]) ** 2))
similarity = round(clamp(100 - distance, 0, 100))
```

由于五维范围均为 0-100 且权重和为 1，理论最大距离为 100，不再引入含义不明的 `maxDistance` 常量。

结果示例：

```text
TA 最像诸葛亮 86%
慢热、观察很久，但认定之后会持续投入

第二相似：赵云 78%
```

- 所有启用人物的相似度独立计算，不要求相加等于 100%。
- 最高与第二名都达到 60%，且差值 `<= 3%` 时展示“双原型组合”；否则只展示第一人物。
- 用户不看到算法距离，只看到百分比。
- 图鉴详情可以显示“你的 TA 与此人物相似度 72%”。
- 结果页默认展示前 5 名，首屏突出第一名和第二名。

稳定排序规则：`similarity desc` → `sortOrder asc` → `key asc`。不得用随机数处理同分。

### 8.3 上线校准要求

- 使用固定随机种子运行至少 20 万组随机答案模拟。
- 48 位人物都必须存在至少一套可成为最高结果的 golden answers；校准脚本使用搜索生成并固化到测试 fixture。
- 任一人物随机第一名占比不得高于 12%，前 5 名人物合计不得高于 45%。
- 每个时代至少有 10 位人物在随机模拟中成为过第一名。
- 每个人物至少固化 1 套 golden answers；高频前 10 位人物各准备 3 套。
- 相同答案在 Node、H5、微信小程序中结果一致。
- 校准只能调整第 7 节人物向量单项 `±5`，必须保存调整前后分布报告；不能加入人物专属隐藏加分、随机扰动或按时代轮流出结果。

新增 `tests/run-crush-celebrity-calibration.cjs`，输出 JSON 报告到系统临时目录，不把大体积模拟文件提交仓库。

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
  _id?: string
  userId: string
  caseId?: string // mode=target 必填；mode=self 不得存在
  kind: 'crush_celebrity'
  mode: 'self' | 'target'
  primaryPersonKey: string
  secondaryPersonKey?: string
  similarities: Record<string, number>
  dimensions: Record<string, number>
  answeredCount: number
  unknownCount: number
  observationConfidence: 'high' | 'medium' | 'low'
  answers: Array<{ questionId: string; optionKey: 'A' | 'B' | 'C' | 'D' | 'U' }>
  contentVersion: string
  questionSnapshotHash: string
  algorithmVersion: string
  createdAt: Date
  updatedAt: Date
}
```

结果存入独立 `archetype_results` 集合，不覆盖 `latestResult`、`crushType` 或事件分析。

### 9.4 云函数与客户端 API 契约

复用关系女主角使用的两个云函数：

```text
saveArchetypeResult
getArchetypeResults
```

`saveArchetypeResult` 入参：

```ts
{
  kind: 'crush_celebrity'
  mode: 'self' | 'target'
  caseId?: string // mode=target 必填；mode=self 不得传
  answers: Array<{ questionId: string; optionKey: 'A' | 'B' | 'C' | 'D' | 'U' }>
  contentVersion: string
  questionSnapshotHash: string
  authUserId: string
}
```

服务端处理顺序：

1. 使用 `_shared/auth.requireAuthenticatedUserId` 获取可信 userId。
2. 调用 `_shared/subscription.checkFeatureAccess(db, userId, FEATURE_CRUSH_CELEBRITY)`。
3. `mode=target` 时要求 `caseId` 非空并验证该 case 属于当前用户；`mode=self` 时传入 caseId 返回 `INVALID_ARGUMENT`。
4. 按 `contentVersion` 读取对应的已发布或已归档不可变题库，校验 12 个唯一题目 id、选项值、观察覆盖度和快照 hash；self 模式禁止 U。只有版本不存在、hash 不匹配或版本损坏时才返回 `CONTENT_VERSION_MISMATCH`，不能因为后台刚发布了新版本而拒绝旧版本提交。
5. 在服务端重新计算五维和全部已启用人物相似度；禁止相信客户端上传的 dimensions、personKey 或 similarity。
6. 写入 `archetype_results` 并返回完整结果。

成功返回：

```ts
{ success: true, result: CrushCelebrityResult }
```

固定错误码：`AUTH_REQUIRED`、`FEATURE_NOT_AVAILABLE`、`INVALID_ARGUMENT`、`INSUFFICIENT_OBSERVATION`、`CONTENT_VERSION_MISMATCH`、`CASE_NOT_FOUND`、`SAVE_FAILED`。

`getArchetypeResults` 使用：

```ts
{
  kind: 'crush_celebrity'
  caseId?: string
  limit?: number // 默认 20，最大 50
  authUserId: string
}
```

只返回当前用户结果，按 `createdAt desc` 排序。客户端在 `src/utils/api.ts` 复用 `saveArchetypeResult(payload)` 和 `getArchetypeResults(params)`。

草稿 key：`archetype_draft:crush_celebrity:{userId}:{mode}:{caseId|self}:{contentVersion}`。提交成功后删除；恢复时按草稿的 `contentVersion` 读取原题库，原版本仍存在时继续答题，只有版本不存在、hash 不匹配或结构损坏时才废弃草稿。

## 10. 后台订阅配置

### 10.1 唯一权限机制

不得新增 `featureSwitches`、`visible/enabled`、测试次数限制或独立权限表。继续使用：

```ts
checkFeatureAccess(FEATURE_CRUSH_CELEBRITY)
```

服务端以 `excludedFeatures` 判断是否可用；`features` 用于后台套餐能力展示。

将 `Crush名人图鉴` 加入：

- `src/pages/admin/components/panels/SubscriptionPanel.vue` 的 `ALL_FEATURES`。
- `cloudfunctions/_shared/subscription.js` 和所有同步副本。

默认数组：

| 套餐 | `features` | `excludedFeatures` | 默认结果 |
| --- | --- | --- | --- |
| Trial | 加入 `Crush名人图鉴` | 移除 `Crush名人图鉴` | 开放 |
| Free | 不加入 `Crush名人图鉴` | 加入 `Crush名人图鉴` | 关闭 |
| Pro | 加入 `Crush名人图鉴` | 移除 `Crush名人图鉴` | 开放 |
| Ultra | 加入 `Crush名人图鉴` | 移除 `Crush名人图鉴` | 开放 |

`configVersion` 可以因默认数组迁移递增，但不得增加权限字段。现有线上配置不会自动覆盖，部署后须在订阅面板保存一次默认值并逐套餐调用 `getSubscriptionStatus?action=checkFeature` 验证。

### 10.2 后台人物与题库内容

人物、题目和报告应进入同一套后台内容库，不能把 48 位人物和题目永久写死在客户端。后台可编辑人物资料、时代标签、维度向量、题干、self/target 文案、选项、分值、golden answers、排序和结果文案；订阅权限仍然只由 `features/excludedFeatures` 控制，不能把内容发布状态当成套餐权限。

采用“草稿 → 校验 → 发布 → 归档/回滚”的版本流程。发布前服务端必须校验 12 道题、唯一 `CQ` ID、self/target 文案、A-D/U 选项、五维覆盖度、48 位人物时代数量、向量范围、golden answers 和校准报告。发布生成不可变 `contentVersion`；新测试读取新版本，进行中的测试和历史结果继续绑定原版本。

建议使用 CloudBase 集合 `archetype_question_banks`，一条文档代表 `Crush 名人图鉴` 的一个完整版本：

```ts
type CelebrityQuestionBank = {
  featureKey: 'Crush名人图鉴'
  contentVersion: string
  status: 'draft' | 'published' | 'archived'
  people: CelebrityPerson[]
  questions: CelebrityQuestion[]
  goldenAnswers: Record<string, Record<string, string>>
  updatedBy: string
  updatedAt: string
  publishedAt?: string
  checksum: string
}
```

管理员写操作复用现有 `adminManage` 云函数，新增 action：`getArchetypeQuestionBank`、`saveArchetypeQuestionDraft`、`validateArchetypeQuestionDraft`、`publishArchetypeQuestionBank`、`rollbackArchetypeQuestionBank`；普通用户只通过只读 `getArchetypeQuestionBank` 云函数取得 published 版本。只有管理员可写，客户端和云函数评分只能读取 published 版本。`crush-celebrity-content.ts` 保留为类型定义、首发种子数据和离线 fixture，不再作为线上唯一内容来源。

后台面板最少提供：按时代/人物/题号筛选、self/target 并排编辑、选项得分与人物向量编辑、手机预览、版本差异、校验报告、发布记录和一键回滚。只改文案也发布新版本；改得分矩阵、人物向量或启用人物时，必须重新运行 20 万组模拟和 golden answers 校准，通过后才能发布。

## 11. 入口与发现路径

### 11.1 当前 Crush 入口

在 [Crush 详情页](C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/src/pages/case-detail/case-detail.vue) 的“桃花匹配度”提示附近增加：

```text
测测 TA 像哪位古今名人
```

点击后自动带当前 `caseId`，进入 target 模式并锁定对象。测试页不显示切换、解绑或重新选择 Crush 的控件；更换对象必须返回首页 swiper 或 `Crushes` 页面完成。

### 11.2 自测入口

在 [你的桃花人设](C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/src/pages/taohua/taohua.vue) 和结果页增加：

```text
我像哪位古今名人？
```

点击进入 `mode=self`，不读取也不保存 `caseId`。未登录统一跳转登录并携带 redirect；名人图鉴权限与命理桃花权限独立，仍使用 `FEATURE_CRUSH_CELEBRITY`。

### 11.3 “我”页和分享页

- “我”页增加持久的“好玩测试”卡片。
- 分享落地页展示分享者的脱敏人物结果和“我也测测”。
- 不新增 tabBar。

V1 只新增场景入口和自测入口，不新增 tabBar，不改造首页 Banner。

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
  crush-celebrity-content.ts # 类型、种子与测试 fixture
  crush-celebrity-score.ts
  archetype-storage.ts

src/pages/admin/components/panels/
  ArchetypeQuestionBankPanel.vue

cloudfunctions/
  getArchetypeQuestionBank/index.js
  adminManage/index.js # 新增题库草稿、校验、发布和回滚 actions
  saveArchetypeResult/index.js
  saveArchetypeResult/_shared/auth.js
  saveArchetypeResult/_shared/subscription.js
  saveArchetypeResult/_shared/crush-celebrity-score.js
  getArchetypeResults/index.js
  getArchetypeResults/_shared/auth.js
  getArchetypeResults/_shared/subscription.js

tests/
  run-crush-celebrity-rules.cjs
  run-crush-celebrity-calibration.cjs
```

`src/pages.json` 增加：

```json
{
  "path": "pages/crush-celebrity/crush-celebrity",
  "style": { "navigationBarTitleText": "Crush 名人图鉴" }
},
{
  "path": "pages/crush-celebrity-result/crush-celebrity-result",
  "style": { "navigationBarTitleText": "名人匹配结果" }
},
{
  "path": "pages/crush-celebrity-person/crush-celebrity-person",
  "style": { "navigationBarTitleText": "人物图鉴" }
}
```

页面参数：

```text
/pages/crush-celebrity/crush-celebrity?mode=self
/pages/crush-celebrity/crush-celebrity?mode=target&caseId=xxx
/pages/crush-celebrity-person/crush-celebrity-person?personKey=wu_zetian
/pages/crush-celebrity-result/crush-celebrity-result?id=结果文档ID
```

题目配置：

```ts
type CelebrityQuestion = {
  id: `CQ${string}`
  textSelf: string
  textTarget: string
  optionsSelf: CelebrityQuestionOption[]
  optionsTarget: CelebrityQuestionOption[]
}
```

人物封面 V1 使用本地可替换头像卡，不引用远程图片，资源目录固定为 `static/archetypes/celebrities/`。缺少正式肖像时使用姓名首字卡，不能用破图或网络占位图阻塞页面。

客户端和云函数评分必须通过同一组 fixture 验证。因云函数部署需要复制共享文件时，使用仓库现有共享同步机制，禁止各自维护不同向量。

## 13. 实施阶段

1. **权限与公共结构，1-1.5 天**：功能键、现有订阅数组、路由和通用答题组件。
2. **题库后台和算法，3-4 天**：题库集合、管理员草稿/校验/发布/回滚、12 题得分矩阵、48 人向量、纯函数评分和稳定排序。
3. **模拟校准，1.5-2 天**：20 万组模拟、golden answers、分布报告和必要的 `±5` 向量微调。
4. **云函数和保存，1.5-2 天**：登录、套餐校验、case 所有权、服务端重算、历史查询。
5. **答题和图鉴，3-4 天**：self/target、锁定当前 Crush、12 题、草稿恢复、三时代图鉴和人物详情。
6. **结果和分享，2 天**：前五名、双原型、五维画像、确定性文案、分享回流。
7. **入口和回归，1-1.5 天**：“我们”页、Crush 详情、“你的桃花人设”、多端构建和真机。

预计 V1：13-18 个开发人日。

### 13.1 DeepSeek 固定实施顺序

1. 只实现 `crush-celebrity-content.ts`、`crush-celebrity-score.ts` 和规则测试。
2. 运行模拟校准，先证明 48 人分布达标，再开发 UI。
3. 实现云函数和客户端 API，验证服务端会拒绝伪造 similarity。
4. 实现 self/target 答题流程、草稿恢复和结果页。
5. 实现三时代图鉴和人物预览。
6. 最后接入“我们”页、Crush 详情和“你的桃花人设”入口。
7. 提交变更文件清单、模拟摘要、测试输出和未完成项。

禁止事项：不使用 AI 临时生成结果；不随机指定人物；不按时代轮流出结果；不新增测试次数限制；不修改现有 `latestResult`、`crushType`；不新建权限表；不把 48 人写成 Vue 条件分支。

### 13.2 测试命令

```text
node tests/run-crush-celebrity-rules.cjs
node tests/run-crush-celebrity-calibration.cjs
npm run test:regression
npm run build:h5
npm run build:mp-weixin
```

规则测试至少覆盖：

- 12 题完整性、唯一 id、self/target 文案和选项数量。
- 五维平均值、边界值、稳定排序和双原型阈值。
- 48 人 key 唯一、三时代各 16 人、向量范围 0-100。
- `enabled=false` 后人物从图鉴和计算中同时移除。
- self 模式不保存 caseId；target 模式验证 case 所有权。
- target 模式 U 选项、最低有效题数、每维最低贡献数和观察覆盖度。
- Trial/Pro/Ultra 允许，Free 拒绝；管理员修改后按配置生效。
- 题库管理员鉴权、草稿隔离、发布校验、并发发布保护、历史版本提交和回滚。
- 评分矩阵或人物向量变化时，没有 20 万组模拟报告不得发布。
- Node、H5、微信小程序固定答案结果一致。

## 14. 验收标准

- 未登录不能进入测试，登录后能返回原测试路径。
- 后台可通过现有 `features/excludedFeatures` 分别配置试用、免费、Pro、Ultra 权限。
- 后台可编辑题目和人物内容，草稿不影响线上；发布后新测试使用新版本，旧草稿和旧结果仍绑定原版本。
- 默认 Trial/Pro/Ultra 开放，Free 关闭。
- 不新增首页 Hero Banner；入口位于“我们”页/Crush 详情和“你的桃花人设”。
- 人物 chip 只打开预览，不会改变测试结果。
- 图鉴包含历史、近代、当代各 16 人，共 48 人。
- 48 位人物都有可复现的最高匹配 golden answers，模拟分布满足第 8.3 节。
- 结果展示主人物百分比、第二人物百分比、前五排行和五维画像。
- 测自己和测当前 Crush 均能完成；target 模式必须有当前 caseId。
- 测试页不能选择、更换或取消绑定 Crush；切换对象只能回首页滑动或进入 Crushes 页面。
- 保存结果不影响现有 Crush 类型和 AI 分析。
- 云函数根据 answers 重新计算，客户端伪造结果无效。
- Free 点击入口后显示套餐未开放；Trial/Pro/Ultra 可以开始。
- `npm run test:regression`、`npm run build:h5`、`npm run build:mp-weixin` 通过。

