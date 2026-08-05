# 关系女主角开发计划

> 本文保留产品讨论过程，不再作为开发模型的唯一输入。DeepSeek 实施请只使用：[关系女主角 V1 开发交接规格](C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/RELATION-HEROINE-DEEPSEEK-HANDOFF-2026-08-01.md)。

> 后续增量以[关系主角男女题库与人物改名开发计划](C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/RELATION-ARCHETYPE-GENDERED-DEV-PLAN-2026-08-03.md)为准：关系女性与关系男性题库均已发布 `1.0.0`；旧的无性别女性 V1 仅作内容来源和历史版本说明。

> 原功能名：婚姻原型  
> 推荐正式名：**关系女主角**  
> 副标题：测测你或 TA，更像哪位现实关系人物  
> 日期：2026-08-01

> 执行状态：**内容讨论稿已实施；男女题库增量已实施并发布**
> 视觉参考：现有页面的轻量入口样式；V1 不改造首页 Banner。
> 本文中的文件名、功能键、默认权限、接口字段和验收标准均为 V1 固定要求，开发时不得自行替换。

## 1. 已确认的产品要求

- 必须登录后才能开始测试。
- 支持“测自己”和“测当前 Crush”两种模式。
- “测当前 Crush”只使用项目现有活动 Crush，不允许在测试页选择、更换或不绑定 Crush。
- 结果输出当前女主角的相似度百分比。
- 保留专业分层流程：`6 题筛选 + 15 题人物专测 + 3 道情景验证`。
- 三位女主角使用完全独立的专属题库、评分维度和结果文案。
- 使用真实人物名称；人物、题目、选项、评分和报告均由版本化题库管理。
- 产品需要好玩、可分享，但测试过程要有专业感和内容深度。
- 功能只接入现有订阅配置的 `features/excludedFeatures`，不新增 `featureSwitches`、独立全局开关或另一套权限系统。
- 默认权限：试用期开放、免费版关闭、Pro 开放、Ultra 开放；管理员之后可在订阅面板自行调整。
- 入口不新增首页 Banner：当前 Crush 从“我们”页/Crush 详情页进入，自测从“你的桃花人设”进入。

## 2. 命名方案

### 推荐名称：关系女主角

推荐理由：

- 比“婚姻原型”轻松，不会让用户以为是医学或心理诊断。
- 当前三位人物都是女性，“女主角”有明确记忆点和分享感。
- 专属题库强化了“进入不同人物故事线”的体验。
- 后续可以持续增加新的现实人物和专属测试。

推荐入口文案：

```text
关系女主角
测测你或 TA，更像哪位现实关系人物
6 题定位 · 15 题专测 · 3 道情景验证
```

备选名称：`关系主角局`、`她的关系人设`、`你是哪位关系女主`。

## 3. 产品结构

V1 保留两层测试：

### 第一层：6 题快速定位

- 只负责判断用户当前更适合测哪一位女主角。
- 不产生最终相似度。
- 推荐后允许用户改选其他人物。
- 点击人物卡时可以跳过快筛，直接进入该人物专测。

### 第二层：人物专属测试

每位人物拥有：

- 15 道五级量表题。
- 3 个独立评分维度，每维 5 题。
- 3 道专属情景题。
- 独立的结果解释、风险观察点和行动建议。
- 独立的相似度百分比。

用户测完一位人物后，只得到与该人物的相似度。若想比较其他人物，需要进入另一套专属测试。这样才能体现“题目不同、判断依据不同”的专业感。

## 4. 用户流程

```text
“我们”页 / Crush 详情 / “你的桃花人设” / 分享落地
  -> 点击“关系女主角”
  -> 未登录：跳登录，成功后 redirect 回测试
  -> 已登录：checkFeatureAccess(FEATURE_RELATION_HEROINE)
  -> 选择“测自己”或“测当前 Crush”
  -> 测当前 Crush：锁定进入页面时的 activeCaseId
  -> 没有 activeCaseId：提示先去首页滑动或 Crushes 页面选择
  -> 选择当前关系阶段（不计分）
  -> 6 题快速定位
  -> 推荐女主角，可查看推荐原因或改选人物
  -> 进入该人物的 15 道专属题
  -> 完成 3 道专属情景题
  -> 输出人物相似度 + 三维画像 + 情景验证
  -> 自动保存结果
  -> 分享 / 重测 / 测另外两位女主角
```

直接点击人物卡时：

```text
人物预览 -> “测测我/TA像不像她” -> 15 题专测 -> 3 道情景题 -> 结果
```

页面状态固定为：`access-checking`、`mode-select`、`missing-current-crush`、`stage-select`、`screener`、`person-select`、`quiz`、`scenario`、`saving`、`result`、`locked`、`error`。检查权限和保存期间按钮必须禁用；网络失败保留答案并显示重试；答题中返回需确认“退出并保留草稿 / 继续答题”。

### 当前 Crush 锁定规则

```ts
const lockedCaseId = mode === 'target'
  ? String(options.caseId || getActiveCaseId() || '').trim()
  : ''
```

- `mode=self`：不读取、不保存 `caseId`。
- `mode=target`：`lockedCaseId` 必填，加载后通过 `getCaseDetail(lockedCaseId)` 校验归属并获取姓名、头像快照。
- 测试页顶部只读显示“正在测试：{Crush 名称}”，不出现下拉框、切换按钮或“不绑定档案”。
- 测试过程中不调用 `setActiveCaseId`，也不监听活动 Crush 变化。
- 用户要更换对象，必须退出测试，到首页左右滑动或 `Crushes` 页面调用现有 `setActiveCaseId`，再重新进入测试。
- 从“我们”页或 Crush 详情页进入 target 模式时传入当前 `caseId`。

### 关系阶段与动态题目

开始答题前先选择一个不计分的阶段：

1. 还没在一起：刚认识、朋友或暧昧。
2. 刚开始交往。
3. 稳定交往。
4. 长期共同生活或婚姻。

阶段只改变题目场景，不改变维度含义、权重和相似度阈值。6 题快筛以通用行为为主，仅允许轻量换词；每位人物的 15 题由 `10 道通用人格题 + 5 道同 ID 的阶段情景变体` 组成；3 道情景验证题全部按阶段切换。用户返回修改阶段时，已回答的阶段题和情景题必须清空，通用题可保留。

同一特质的不同阶段写法示例：

```text
还没在一起：约见面一直没人定时间，TA通常会怎么做？
刚开始交往：周末活动细节一直没定，TA通常会怎么做？
稳定交往：两个人的共同安排迟迟没定，TA通常会怎么做？
长期关系：现实问题迟迟没人处理，TA通常会怎么做？
```

### Self 与 Crush 题本决策

结论：**题目文字不同，测量维度和评分不变。**

- 6 题快筛、15 题专测、3 道情景题都要同时配置 self/target 两套文案。
- 两套题本保持相同的题目 id、人物归属、维度、正反向标记、选项分值和情景典型答案，因此使用同一套相似度阈值。
- self 题本可以询问自己的感受、念头和动机。
- target 题本只能询问当前 Crush 的公开表达、长期行为和实际选择；不能要求用户直接判断 TA 未表达过的内心状态。
- target 证据不足时选择独立选项 U“无法判断 / 没观察到”，该题不参与分数，并在结果页标注观察覆盖度。不能把未知答案按中点 3 分处理。
- 两种模式结果不能混写：标题分别为“你与……”和“当前 Crush 与……”。历史页按 `mode` 筛选。

必须按以下方式改写，而不是简单替换代词：

| self 题意 | target 可观察版本 |
| --- | --- |
| 我不止一次认真想过离开 | 当前 Crush 曾不止一次明确谈过离开，或为分开做过实际准备 |
| 阻碍我离开的主要原因是孩子、经济或责任 | 当前 Crush 谈到继续关系的理由时，经常提到孩子、经济、家庭责任或现实成本 |
| 我仍会怀疑类似伤害再次发生 | 当前 Crush 在关系恢复后仍会反复确认细节、检查承诺是否兑现，或表现出明显警惕 |
| 我已经降低对伴侣的期待 | 当前 Crush 很少再要求伴侣改变，遇到重要事情更倾向自己处理 |
| 我仍期待创造共同体验 | 当前 Crush 仍会主动安排相处、靠近伴侣或创造新的共同体验 |

开发任务包含完整编写并校对 6+45+9 条 `textTarget`，规则测试必须确认每个 self 题目都有对应 target 文案且不与 self 文案完全相同。

## 5. 首发人物与专属维度

### 5.1 冉莹颖式关系风格

记忆点：高能力兜底、现实掌舵、长期自己扛。

| 维度 | 含义 | 题号 |
| --- | --- | --- |
| 主导与兜底 | 决策、危机处理、责任接管 | Q1-Q5 |
| 期待与分离 | 失望、离开念头、现实阻力 | Q6-Q10 |
| 自我与体面 | 情绪压抑、关系定义、外部评价 | Q11-Q15 |

### 5.2 佟晨洁式关系风格

记忆点：清醒观察、边界明确、在稳定和心动之间做选择。

| 维度 | 含义 | 题号 |
| --- | --- | --- |
| 情感温度 | 亲密感、心动、关系活力 | Q1-Q5 |
| 边界独立 | 自我空间、独立能力、需求表达 | Q6-Q10 |
| 决策清醒度 | 观察、协商、继续或离开的准备 | Q11-Q15 |

### 5.3 谢杏芳式关系风格

记忆点：经历伤害后仍尝试修复，重视家庭稳定与长期承诺。

| 维度 | 含义 | 题号 |
| --- | --- | --- |
| 伤害残留 | 失望、触发、信任恢复程度 | Q1-Q5 |
| 修复投入 | 原谅、观察行动、继续尝试 | Q6-Q10 |
| 稳定与体面 | 家庭完整、外界评价、长期维持 | Q11-Q15 |

人物 key、显示名、封面、题库、维度名、报告和是否启用均从已发布题库版本读取。

### 5.4 后台题库与发布机制

题目必须做成后台可编辑的题库，不能把生产题目永久写死在 Vue 或单个 TypeScript 文件中。后台允许修改题干、self/target 两套文案、选项、维度、反向题标记、权重、关系阶段版本、情景题和结果文案。

采用“草稿 → 校验 → 发布 → 归档/回滚”的版本流程：

1. 管理员在 `关系女主角` 题库面板编辑草稿，草稿不影响用户答题。
2. 发布前由服务端校验题目数量、唯一 ID、self/target 文案、选项分值、每个维度覆盖度、阶段变体完整性和报告字段；校验不通过禁止发布。
3. 发布生成不可变的 `contentVersion`，新测试只读取当前 published 版本；正在进行的测试继续使用进入时加载的版本。
4. 结果必须保存 `contentVersion`、`questionSnapshotHash` 和答案。后续改题不会重新解释历史答案；回滚只是重新发布旧版本的副本。
5. 后台可随时保存和发布，但不能编辑已发布版本本身。紧急下线使用题库版本状态，不得借此新增套餐权限字段。

建议数据模型（CloudBase 集合 `archetype_question_banks`，一条文档为一个功能的一套版本）：

```ts
type ArchetypeQuestionBank = {
  featureKey: '关系女主角'
  contentVersion: string
  status: 'draft' | 'published' | 'archived'
  stageKeys: string[]
  archetypes: RelationHeroineConfig[]
  screener: ScreenerQuestion[]
  updatedBy: string
  updatedAt: string
  publishedAt?: string
  checksum: string
}
```

管理员写操作复用现有 `adminManage` 云函数，新增 action：`getArchetypeQuestionBank`、`saveArchetypeQuestionDraft`、`validateArchetypeQuestionDraft`、`publishArchetypeQuestionBank`、`rollbackArchetypeQuestionBank`；普通用户只通过只读 `getArchetypeQuestionBank` 云函数取得 published 版本。只有管理员可写，客户端和保存结果接口只能读取 published 版本。`relation-heroine-content.ts` 保留为类型定义、种子数据和离线测试 fixture，不再作为线上唯一题目来源。

后台面板最少提供：按人物/阶段筛选、self/target 并排编辑、选项与权重编辑、手机预览、完整性校验、版本差异、发布记录和一键回滚。只改文案也必须发布新版本；改分值、权重或典型答案时，还必须先通过规则测试与固定答案回归。

## 6. 六题快速定位

### S1 当前关系中最让你在意的问题是？

- A. 很多事情最后都要靠我，长期下来特别累。→ 冉莹颖
- B. 关系没有大问题，但越来越不像爱人。→ 佟晨洁
- C. 经历过伤害，选择继续后还是很难真正放下。→ 谢杏芳

### S2 在关系里，你或 TA 更像哪种角色？

- A. 实际掌舵者，重要事情通常由我/TA 推动。→ 冉莹颖
- B. 清醒的观察者，始终保留自己的判断和空间。→ 佟晨洁
- C. 关系维系者，希望尽量把这段关系修复好。→ 谢杏芳

### S3 对伴侣目前最接近哪种感受？

- A. 已经不太指望对方，重要的事自己来更放心。→ 冉莹颖
- B. 仍然能沟通，但很难再感到心动和亲密。→ 佟晨洁
- C. 仍愿意给机会，但过去的伤口没有真正消失。→ 谢杏芳

### S4 如果现实阻力明天全部消失，第一反应会是？

- A. 可能终于可以认真考虑离开。→ 冉莹颖
- B. 会和对方谈清楚，再决定关系是否继续。→ 佟晨洁
- C. 还是更想留下，看能不能继续修复。→ 谢杏芳

### S5 最大的委屈更接近？

- A. 我做了很多，却很少有人真正看见。→ 冉莹颖
- B. 关系还在，但情感温度已经不在了。→ 佟晨洁
- C. 我已经选择原谅，为什么还是不断被过去刺痛。→ 谢杏芳

### S6 最像下面哪句话？

- A. “如果我不扛，这个家可能就没人扛了。”→ 冉莹颖
- B. “没有严重问题，就一定代表应该继续吗？”→ 佟晨洁
- C. “我想守住这段关系，但也想知道伤口什么时候能好。”→ 谢杏芳

### 筛选规则

- 得票最高者作为推荐人物。
- 两人并列时展示双候选和差异说明，由用户选择。
- 三人并列时不强行推荐，直接进入人物选择页。
- 筛选结果不参与最终相似度。
- target 快筛每题额外提供 U“无法判断 / 没观察到”，U 不给任何人物计票。
- target 快筛少于 4 道有效答案时不做自动推荐，直接进入人物选择页并提示“观察信息较少，请自行选择想测试的人物”。

## 7. 专属题库

统一选项：

```text
A 非常符合
B 比较符合
C 中立 / 不确定
D 不太符合
E 完全不符合
```

target 模式额外提供：

```text
U 无法判断 / 没观察到
```

两种模式使用平行题本：题号、维度、正反向和 A-E 评分完全相同，但 `textSelf` 与 `textTarget` 分开配置。Crush 版不能只做字符串替换；涉及离开念头、内心期待、伤害感受等不可直接观察内容时，必须改写成“表达过什么、长期做了什么、如何处理关系”的可观察行为。U 不计分。

### 7.1 冉莹颖专属 15 题

#### 主导与兜底 Q1-Q5

1. 家庭或关系里的重要决策，通常需要我主动推动，事情才会真正往前走。
2. 遇到经济、孩子、家人或突发危机时，我的第一反应通常是自己先想办法解决。
3. 我经常觉得，与其等伴侣处理，不如自己完成更快也更放心。
4. 在关系里，我常常像管理者，需要提醒、安排、检查或收拾残局。
5. 我担心一旦自己放手，生活中的很多事情会立刻失去秩序。

#### 期待与分离 Q6-Q10

6. 我曾经很想改变伴侣，后来因为反复失望而逐渐降低期待。
7. 我不止一次认真想过离开，只是一直没有真正采取行动。
8. 阻碍我离开的主要原因，更接近孩子、经济、家庭责任或生活成本，而不只是感情。
9. 即使关系缺少亲密和心动，只要现实整体稳定，我也可以继续维持。
10. （反向）如果长期不快乐，即使现实代价很高，我也能比较果断地开始改变现状。

#### 自我与体面 Q11-Q15

11. 即使很委屈，我也常提醒自己成年人不能只凭情绪做决定。
12. 我更容易把长期关系理解为需要经营和负责的现实项目。
13. 我会在意关系变化对孩子、家人、事业或外界评价造成的影响。
14. 外人可能觉得我很能干、很稳定，但很少有人知道我在关系里有多疲惫。
15. （反向）我能够自然地向伴侣求助，也相信对方可以稳定分担重要责任。

### 7.2 冉莹颖专属情景题

#### RS1

共同债务和孩子安排都很复杂，感情已经明显变淡。此时更接近的第一反应是：

- A. 先计算分开的现实影响，必要时降低情感期待、维持合作。
- B. 只要不爱了，就应该尽快离开。
- C. 先要求对方重新投入感情，再决定其他问题。

#### RS2

家里出现重大麻烦，伴侣再次逃避处理：

- A. 先把问题处理好，之后再失望和重新评估关系。
- B. 拒绝接手，让对方自己承担全部后果。
- C. 不断争吵，希望对方因为压力而改变。

#### RS3

你已经认真想过离开，但外界都觉得你的生活很不错：

- A. 不会立刻撕破现状，会先准备资源、时机和后续安排。
- B. 完全不在意其他影响，当下就做决定。
- C. 因为别人觉得不错，所以怀疑是不是自己要求太高。

### 7.3 佟晨洁专属 15 题

#### 情感温度 Q1-Q5

1. 我和伴侣仍能正常沟通，但相处越来越像室友或合作伙伴。
2. 关系中没有特别严重的冲突，却很少再出现心动、期待和亲密感。
3. 即使一起完成很多日常事务，我仍会觉得情感上没有真正靠近。
4. 想到和伴侣未来继续保持现在的状态，我感到的更多是平静而不是期待。
5. （反向）我仍经常主动想靠近伴侣，并期待创造新的共同体验。

#### 边界独立 Q6-Q10

6. 我有相对独立的经济能力、生活安排或社交空间，不会把全部生活寄托在伴侣身上。
7. 我比较清楚自己在长期关系中真正需要什么，也知道哪些状态不能长期接受。
8. 即使结束关系，我也能想象并安排好一个人的生活。
9. 我不希望因为“别人都这样过”而放弃对亲密和真实感受的要求。
10. （反向）无论关系变成什么样，只要没有重大背叛，我都会默认继续下去。

#### 决策清醒度 Q11-Q15

11. 面对关系问题，我更愿意把真实情况谈清楚，而不是用体面掩盖。
12. 如果最终分开，我希望双方能冷静协商，而不是互相攻击或报复。
13. 我不会只因为孩子、年龄或外界评价，就认定一段关系必须继续。
14. 我会重点观察伴侣是否真正行动，而不是只听对方说“以后会改变”。
15. 如果关系长期没有改善，我愿意给自己设定一个明确的观察期限或决策节点。

### 7.4 佟晨洁专属情景题

#### TS1

你们没有争吵，生活配合也正常，但已经很久没有亲密和心动：

- A. 认真谈一次双方的真实感受，并讨论关系是否需要改变。
- B. 没有严重问题就继续，不必想太多。
- C. 先制造一次浪漫约会，之后不再讨论这个问题。

#### TS2

伴侣说“长期关系本来就会变淡，大家都一样”：

- A. 认可平淡存在，但仍会追问双方是否愿意重新投入。
- B. 接受这个说法，不再表达自己的情感需要。
- C. 立刻认定关系已经结束。

#### TS3

双方确认感情明显消退，但都没有原则性过错：

- A. 设定一段观察和调整期，再根据行动决定继续或分开。
- B. 因为没有人犯错，所以关系必须继续。
- C. 当场结束，不需要任何过渡和协商。

### 7.5 谢杏芳专属 15 题

#### 伤害残留 Q1-Q5

1. 关系中曾发生过让我非常痛苦、失望或失去安全感的事情。
2. 我虽然选择继续，但某些细节仍会让我突然想起过去的伤害。
3. 对方现在表现正常时，我仍可能怀疑类似的事情会不会再次发生。
4. 外人看起来关系已经恢复，只有我知道信任并没有完全回来。
5. （反向）我现在已经能平静谈起那件事，不再明显影响日常判断和情绪。

#### 修复投入 Q6-Q10

6. 我愿意继续关系，很大程度上是因为我相信人可以通过长期行动重新建立信任。
7. 比起一次道歉，我更在意对方之后是否持续透明、负责和兑现承诺。
8. 即使修复过程很慢，只要能看到真实变化，我仍愿意继续尝试。
9. 我担心如果没有认真修复过就离开，将来可能会后悔自己没有给关系机会。
10. （反向）只要发生严重伤害，我就不会再考虑任何形式的原谅或修复。

#### 稳定与体面 Q11-Q15

11. 家庭完整、孩子感受和多年共同生活，在我的决定中占很大分量。
12. 我不希望一次伤害彻底否定两个人过去所有的共同经历。
13. 我很少向外界完整讲述关系中的痛苦，也不希望被别人议论。
14. 为了不让家人或孩子担心，我会控制自己在外面的情绪表现。
15. 即使爱情已经发生变化，我仍会重视承诺、责任和关系长期稳定。

### 7.6 谢杏芳专属情景题

#### XS1

伴侣曾经严重伤害你，现在道歉并希望重新开始：

- A. 可以给机会，但需要明确的修复计划和持续行动。
- B. 只要道歉就立刻恢复信任，不再提过去。
- C. 不管之后做什么，都不可能再考虑继续。

#### XS2

修复过程中，对方已经努力一段时间，但你仍会被过去触发：

- A. 承认伤害仍在，同时继续观察对方是否稳定行动。
- B. 责怪自己不够大度，强迫自己马上忘记。
- C. 认定所有努力都没有意义，立刻结束关系。

#### XS3

家人都希望你维持关系，但你仍然很痛苦：

- A. 把家庭意见作为因素之一，但重新确认自己的底线和修复条件。
- B. 只要家人希望继续，就不再考虑自己的感受。
- C. 完全拒绝听取任何人的意见。

## 8. 相似度与情景验证

### 8.1 15 题相似度

- A=5、B=4、C=3、D=2、E=1。
- 反向题使用 A=1、B=2、C=3、D=4、E=5。
- self 模式原始分范围 15-75。
- target 模式的 U 答案不计入维度平均值。

```ts
dimensionSimilarity = Math.round(((dimensionAverageScore - 1) / 4) * 100)
similarity = Math.round((dimension1 + dimension2 + dimension3) / 3)
```

self 模式每维固定 5 题，上述算法与 `(rawScore - 15) / 60 * 100` 等价。统一使用维度平均算法，避免客户端和服务端维护两套公式。

target 模式生成结果的最低证据要求：

- 15 题中至少 10 题为 A-E。
- 每个维度至少有 3 题为 A-E。
- 未达到要求时不生成相似度，返回 `INSUFFICIENT_OBSERVATION`，提示继续观察后再测。
- 覆盖度：`answeredCount / 15`。14-15 为高、12-13 为中、10-11 为较低。

结果示例：

```text
你与冉莹颖式关系风格相似度 82%

主导与兜底 91%
期待与分离 76%
自我与体面 79%
```

建议结果等级：

| 相似度 | 展示 |
| --- | --- |
| 80-100% | 高度相似 |
| 60-79% | 明显相似 |
| 40-59% | 部分相似 |
| 0-39% | 相似度较低 |

### 8.2 情景验证

情景题不直接修改相似度，单独输出验证结果：

V1 九道情景题的典型人物反应均为选项 `A`，配置中仍必须显式写入 `typicalOptionKey: 'A'`，不能在评分函数中默认所有第一项都是典型答案。

- 3 题中 3 题选择人物典型反应：`情景高度吻合`。
- 3 题中 2 题吻合：`情景进一步支持`。
- 3 题中 1 题吻合：`部分情景吻合`。
- 0 题吻合：`实际决策方式与该人物存在明显差异`。

target 情景题额外允许 U“无法判断”。U 不计入分母；至少完成 2 道有效情景题才输出验证档位，否则显示“情景信息不足”。

这样既保留百分比的直观性，也避免用 3 道情景题随意拉高或拉低分数。

### 8.3 跨人物比较

- 不同人物使用不同题库，因此单次结果不伪装成三人横向精确排名。
- 用户完成两位或三位测试后，历史页可以展示各自相似度。
- 比较页必须标注“不同人物使用不同判断维度，百分比用于各自测试内参考”。

### 8.4 固定报告内容

报告不得调用 AI 临时生成。以下内容写入后台题库并随 `contentVersion` 发布；`relation-heroine-content.ts` 只保留种子与测试 fixture。

统一等级文案：

| 相似度 | 标题模板 | 解释模板 |
| --- | --- | --- |
| 80-100 | 高度相似 | 你的长期行为选择与“{人物显示名}”的核心关系风格高度接近。 |
| 60-79 | 明显相似 | 你在多个关键维度上呈现出“{人物显示名}”的典型倾向，但仍保留自己的处理方式。 |
| 40-59 | 部分相似 | 你只在部分情境中接近“{人物显示名}”，这不是你稳定而全面的关系模式。 |
| 0-39 | 相似度较低 | 你的主要关系选择与“{人物显示名}”存在明显差异，可以把结果作为对照参考。 |

人物固定报告：

| 人物 | 核心总结 | 优势表达 | 风险观察 | 行动建议 |
| --- | --- | --- | --- | --- |
| 冉莹颖式 | 你倾向成为关系中的实际推动者和兜底者，面对问题时先解决，再处理自己的感受。 | 有执行力、责任感强、危机中稳定，能让生活继续运转。 | 长期包办可能让伴侣更加被动，也容易把“我能处理”变成“只能我处理”。 | 列出三件必须共同承担的事务；明确一次可执行的分工；练习在问题发生时先提出需求而不是立即接管。 |
| 佟晨洁式 | 你重视真实感受、个人边界和清醒判断，不愿只因为关系没有大错就忽略情感温度。 | 自我感清楚、能观察行动、较少被体面和惯性完全绑住。 | 过度观察可能延长悬而未决的状态，也可能用理性代替真实表达。 | 进行一次具体关系对话；约定可观察的改变；给观察期设置明确日期和判断条件。 |
| 谢杏芳式 | 你重视承诺、家庭稳定和修复机会，即使经历伤害，也更愿意观察长期行动后再决定。 | 有耐心、能容纳复杂感受、不会只凭一次情绪否定全部关系。 | 原谅如果没有修复条件，可能变成单方面忍耐；外部期待也可能遮住自己的底线。 | 写下信任修复的三项条件；区分道歉和持续行动；每月检查痛苦是否下降、边界是否被尊重。 |

三维解释直接使用各人物第 5 节的维度定义，并按维度百分比套用：`80+ 强倾向`、`60-79 明显倾向`、`40-59 中等`、`0-39 较弱`。不得为相同分数随机生成不同结论。

分享文案固定模板：

```text
我测出的关系女主角是「{人物显示名}」，相似度 {similarity}% 。
6题定位 + 15题专测 + 3道情景验证，你也来测测。
```

## 9. 登录与结果保存

### 9.1 登录守卫

```ts
if (!getCurrentUserId()) {
  uni.navigateTo({
    url: `/pages/login/login?redirect=${encodeURIComponent(currentQuizPath)}`
  })
  return
}
```

页面加载后再次调用 `checkFeatureAccess('关系女主角')`。

### 9.2 自动保存

```ts
type RelationHeroineResult = {
  _id?: string
  userId: string
  caseId?: string // mode=target 必填；mode=self 不得存在
  kind: 'relation_heroine'
  mode: 'self' | 'target'
  stageKey: RelationshipStageKey
  personKey: 'ran_yingying' | 'tong_chenjie' | 'xie_xingfang'
  similarity: number
  dimensionScores: Record<string, number>
  rawScore?: number // 仅 self 模式保留
  answeredCount: number
  unknownCount: number
  observationConfidence: 'high' | 'medium' | 'low'
  scenarioVerification: string
  answers: Array<{
    questionId: string
    optionKey: 'A' | 'B' | 'C' | 'D' | 'E' | 'U'
    value: 1 | 2 | 3 | 4 | 5 | null
  }>
  scenarioAnswers: Array<{ questionId: string; optionKey: 'A' | 'B' | 'C' | 'U' }>
  contentVersion: string
  questionSnapshotHash: string
  algorithmVersion: string
  createdAt: Date
  updatedAt: Date
}
```

结果存入独立 `archetype_results`，不覆盖现有 `latestResult` 和 `crushType`。

### 9.3 云函数与客户端 API 契约

新增两个云函数：

```text
saveArchetypeResult
getArchetypeResults
```

`saveArchetypeResult` 入参：

```ts
{
  kind: 'relation_heroine'
  mode: 'self' | 'target'
  caseId?: string // mode=target 必填；mode=self 不得传
  stageKey: RelationshipStageKey
  personKey: string
  answers: Array<{
    questionId: string
    optionKey: 'A' | 'B' | 'C' | 'D' | 'E' | 'U'
  }>
  scenarioAnswers: Array<{ questionId: string; optionKey: 'A' | 'B' | 'C' | 'U' }>
  contentVersion: string
  questionSnapshotHash: string
  authUserId: string
}
```

服务端必须按以下顺序处理：

1. 使用现有 `_shared/auth` 的 `requireAuthenticatedUserId` 校验登录，禁止信任客户端传入的 `userId`。
2. 调用 `_shared/subscription.checkFeatureAccess(db, userId, FEATURE_RELATION_HEROINE)`。
3. `mode=target` 时要求 `caseId` 非空并验证该 case 属于当前用户；`mode=self` 时若传入 caseId 返回 `INVALID_ARGUMENT`。
4. 按 `contentVersion` 读取对应的已发布或已归档不可变题库，校验 stage、人物、题目数量、题目 id、选项、观察覆盖度和快照 hash；self 模式禁止 U。分值由服务端根据该版本的 optionKey、reverse 和模式推导，禁止客户端上传分值。只有版本不存在、hash 不匹配或版本损坏时才返回 `CONTENT_VERSION_MISMATCH`，不能因为后台刚发布了新版本而拒绝旧版本提交。
5. 使用服务端共享评分模块重新计算结果，禁止直接保存客户端上传的 similarity。
6. 写入 `archetype_results`，返回完整标准化结果。

成功返回：

```ts
{ success: true, result: RelationHeroineResult }
```

固定错误码：`AUTH_REQUIRED`、`FEATURE_NOT_AVAILABLE`、`INVALID_ARGUMENT`、`INSUFFICIENT_OBSERVATION`、`CONTENT_VERSION_MISMATCH`、`CASE_NOT_FOUND`、`SAVE_FAILED`。

`getArchetypeResults` 入参：

```ts
{
  kind: 'relation_heroine'
  caseId?: string
  personKey?: string
  limit?: number // 默认 20，最大 50
  authUserId: string
}
```

只返回当前用户数据，按 `createdAt desc` 排序。

`src/utils/api.ts` 新增：

```ts
saveArchetypeResult(payload)
getArchetypeResults(params)
```

两者均使用现有 `callFunction` 和 `getBusinessAuthPayload()`。

集合索引：

```text
archetype_results: userId + kind + createdAt(desc)
archetype_results: userId + kind + caseId + createdAt(desc)
```

答题草稿仅保存在本地：`archetype_draft:relation_heroine:{userId}:{mode}:{caseId|self}:{personKey}:{contentVersion}`。提交成功后删除；恢复时按草稿的 `contentVersion` 读取原题库，原版本仍存在时继续答题，只有版本不存在、hash 不匹配或结构损坏时才废弃草稿。

## 10. 入口与发现路径

### 当前 Crush 入口

在 [Crush 详情页](C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/src/pages/case-detail/case-detail.vue) 的“桃花匹配度”提示附近增加：

```text
测测 TA 像哪位关系女主角
```

点击后自动带当前 `caseId`，进入 target 模式并锁定对象。测试页不显示切换、解绑或重新选择 Crush 的控件；更换对象必须返回首页 swiper 或 `Crushes` 页面完成。

### 自测入口

在 [你的桃花人设](C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/src/pages/taohua/taohua.vue) 和结果页增加：

```text
测测我的关系女主角
```

点击进入 `mode=self`，不读取也不保存 `caseId`。未登录统一跳转登录并携带 redirect；套餐判断仍使用 `features/excludedFeatures`。

### 场景入口

- 本人画像页：“测测我的关系女主”。
- Crush 详情页：“测测 TA 的关系女主角”，默认测当前 Crush 并锁定当前 caseId。
- 人物结果页：“继续测另外一位女主角”。
- 分享落地页：“我也测测”。

### 持久入口

在 [“我”页](C:/Users/Administrator/.openclaw/workspace-innergirl/workspace-girl-uniapp/src/pages/me/me.vue) 宠物模块之后、界面设置之前增加“好玩测试”卡片。不新增 tabBar。

V1 必做入口是“我们”页的当前 Crush 场景入口和“你的桃花人设”的自测入口；不新增 tabBar，不改造首页 Banner。

## 11. 后台订阅与套餐权限

### 功能键

```ts
export const FEATURE_RELATION_HEROINE = '关系女主角'
```

集中放入 `src/utils/feature-keys.ts`。

### 唯一权限机制

不得新增 `featureSwitches`、`visible/enabled`、次数限制或独立权限表。继续使用现有：

```ts
checkFeatureAccess(FEATURE_RELATION_HEROINE)
```

服务端访问判断以 `excludedFeatures` 为准；`features` 用于后台展示套餐能力。功能加入以下位置：

- `src/pages/admin/components/panels/SubscriptionPanel.vue` 的 `ALL_FEATURES`。
- `cloudfunctions/_shared/subscription.js`。
- 所有已有的 `cloudfunctions/*/_shared/subscription.js` 同步副本，使用仓库现有同步脚本处理，不能手工漏改。

默认数组变更：

| 套餐 | `features` | `excludedFeatures` | 默认结果 |
| --- | --- | --- | --- |
| Trial | 加入 `关系女主角` | 移除 `关系女主角` | 开放 |
| Free | 不加入 `关系女主角` | 加入 `关系女主角` | 关闭 |
| Pro | 加入 `关系女主角` | 移除 `关系女主角` | 开放 |
| Ultra | 加入 `关系女主角` | 移除 `关系女主角` | 开放 |

`configVersion` 可以因默认数据迁移递增，但不得借此增加新权限字段。现有线上配置不会因版本号自动覆盖数组，因此部署后必须在订阅管理面板保存一次上述默认值，并验证 `getSubscriptionStatus?action=checkFeature` 的四种套餐结果。

后台验收：管理员能在试用期、免费、Pro、Ultra 面板中独立勾选或排除“关系女主角”；保存并刷新后配置不丢失。

## 12. 文件规划

```text
src/pages/
  archetype-hub/archetype-hub.vue
  relation-heroine/relation-heroine.vue
  relation-heroine-result/relation-heroine-result.vue
  relation-heroine-history/relation-heroine-history.vue

src/components/
  ScreenerQuiz.vue
  ArchetypeQuizProgress.vue
  ArchetypeOptionList.vue
  ScenarioQuiz.vue
  PersonArchetypeCard.vue
  SimilarityBars.vue

src/utils/
  feature-keys.ts
  relation-heroine-content.ts # 类型、种子与测试 fixture
  relation-heroine-score.ts
  archetype-storage.ts

src/pages/admin/components/panels/
  ArchetypeQuestionBankPanel.vue

cloudfunctions/
  getArchetypeQuestionBank/index.js
  adminManage/index.js # 新增题库草稿、校验、发布和回滚 actions
  saveArchetypeResult/index.js
  saveArchetypeResult/_shared/auth.js
  saveArchetypeResult/_shared/subscription.js
  saveArchetypeResult/_shared/relation-heroine-score.js
  getArchetypeResults/index.js
  getArchetypeResults/_shared/auth.js
  getArchetypeResults/_shared/subscription.js

tests/
  run-relation-heroine-rules.cjs
```

`src/pages.json` 固定增加：

```json
{
  "path": "pages/archetype-hub/archetype-hub",
  "style": { "navigationBarTitleText": "好玩测试" }
},
{
  "path": "pages/relation-heroine/relation-heroine",
  "style": { "navigationBarTitleText": "关系女主角" }
},
{
  "path": "pages/relation-heroine-result/relation-heroine-result",
  "style": { "navigationBarTitleText": "测试结果" }
},
{
  "path": "pages/relation-heroine-history/relation-heroine-history",
  "style": { "navigationBarTitleText": "测试记录" }
}
```

页面参数：

```text
/pages/relation-heroine/relation-heroine?mode=self
/pages/relation-heroine/relation-heroine?mode=target&caseId=xxx
/pages/relation-heroine/relation-heroine?mode=self&personKey=ran_yingying
/pages/relation-heroine-result/relation-heroine-result?id=结果文档ID
```

配置结构必须以数据驱动，页面中不得按人物写三套条件分支：

```ts
type RelationHeroineConfig = {
  key: string
  name: string
  shortStyle: string
  enabled: boolean
  coverUrl: string
  dimensions: Array<{ key: string; name: string; description: string }>
  universalQuestions: Array<{
    id: string
    dimensionKey: string
    textSelf: string
    textTarget: string
    reverse: boolean
  }>
  stageQuestionVariants: Record<RelationshipStageKey, Array<{
    id: string
    dimensionKey: string
    textSelf: string
    textTarget: string
    reverse: boolean
  }>>
  scenarioVariants: Record<RelationshipStageKey, Array<{
    id: string
    textSelf: string
    textTarget: string
    typicalOptionKey: string
    options: Array<{ key: string; text: string }>
  }>>
  report: {
    coreSummary: string
    strengthText: string
    riskText: string
    actionItems: string[]
    shareTemplate: string
  }
  contentVersion: string
}
```

客户端和云函数评分逻辑必须来自同一组测试向量。若因云函数部署边界需要复制文件，使用现有共享文件同步机制，并由测试比较两端结果，禁止维护两套不同算法。

## 13. 测试计划

建议新增 `tests/run-relation-heroine-rules.cjs`，覆盖：

- 6 题全 A/B/C 与所有平局组合。
- 三套题库各 15 题、3 个维度、3 道情景题的完整性。
- 每套题库均包含 10 道通用题、四阶段各 5 道同 ID 变体和四阶段各 3 道情景题；阶段切换不改变维度和权重。
- 三套题目 id 不重复。
- 正向题和反向题计分。
- 15、39、40、59、60、79、80、100% 等边界。
- 情景验证四档结果。
- 切换人物后不复用上一套答案。
- 测自己和测当前 Crush 的平行题本、caseId 和保存字段。
- target 模式缺少 caseId、伪造他人 caseId、测试页尝试切换 Crush。
- target 的 U 选项、每维最低有效题数、总体覆盖度和 `INSUFFICIENT_OBSERVATION`。
- 后台套餐配置、功能访问、登录 redirect。
- 题库管理员鉴权、草稿隔离、发布校验、并发发布保护、历史版本提交和回滚。
- 不新增首页 Banner；两类场景入口均能完成登录回跳和套餐校验。
- 题库草稿不会影响线上；校验失败不能发布；发布后新测试使用新版本，旧结果仍可按旧版本解释。
- Trial/Pro/Ultra 允许，Free 拒绝；后台修改后立即按新配置生效。
- 云函数忽略客户端伪造的 similarity，并按 answers 重新计算。
- 非本人 caseId 无法保存 target 结果。

工程验证：

- `node tests/run-relation-heroine-rules.cjs`
- `npm run test:regression`
- `npm run build:h5`
- `npm run build:mp-weixin`
- 微信真机完成快筛推荐、直接人物入口、测自己、测当前 Crush 四条路径。

### DeepSeek 固定实施顺序

1. 先完成 `feature-keys.ts`、订阅面板和默认权限，不开发页面。
2. 完成题库集合、后台草稿/校验/发布/回滚、评分函数和规则测试，先让 `node tests/run-relation-heroine-rules.cjs` 通过。
3. 完成云函数和 API，使用固定 answers 验证客户端/服务端结果一致。
4. 完成答题页、结果页和草稿恢复。
5. 最后接入“我们”页、Crush 详情和“你的桃花人设”入口。
6. 执行回归构建并提供变更文件清单、测试输出和未完成项。

禁止事项：不接入 AI 生成报告；不增加测试次数限制；不修改现有 `latestResult`、`crushType`；不新建另一套套餐表；不把题库硬编码在 Vue 模板中。

## 14. 实施阶段与工作量

1. **题库与报告内容，3-4 天**：45 道专属题、9 道情景题、反向题、结果文案和版本配置。
2. **评分与规则测试，1.5-2 天**：相似度、维度分、情景验证、边界测试。
3. **登录和订阅，1-1.5 天**：登录 redirect、现有套餐权限和服务端校验。
4. **页面流程，3-4 天**：快筛、人物选择、三套答题、情景题、草稿恢复和防连点。
5. **结果、历史和分享，2-3 天**：自动保存、结果页、跨人物历史、分享回流。
6. **入口和回归，1-1.5 天**：首页、本人画像、Crush 详情、“我”页、多端构建和真机。

预计 V1：12-16 个开发人日。

## 15. 验收标准

- 未登录用户不能进入第一题，登录后正确返回原路径。
- 快筛只做推荐，不影响专属测试相似度。
- 三位女主角的 15+3 题目、维度和报告完全独立。
- 直接点击人物卡可以跳过快筛进入该人物专测。
- 结果展示人物相似度、三维分数和独立情景验证。
- 完成其他人物测试后可以在历史页查看各自百分比。
- 后台可通过现有 `features/excludedFeatures` 分别配置试用/免费/Pro/Ultra 权限。
- 测当前 Crush 必须锁定已有 activeCaseId，结果不覆盖现有 AI 分析和 Crush 类型。
- 测试页不能选择、更换或取消绑定 Crush；更换必须返回首页滑动或进入 Crushes 页面。
- “我们”页/Crush 详情和“你的桃花人设”入口始终可发现，点击后的可用性由登录状态和套餐权限控制。
- H5、微信小程序构建、规则测试和真机流程全部通过。

