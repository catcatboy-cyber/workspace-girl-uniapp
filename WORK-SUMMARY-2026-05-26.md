# 工作总结 — 2026-05-26

## 概述

小咪帮你说全面重构：多轮策略引擎、AI 模型故障转移、提示词后台可配置、文本截断修复、品牌更名。

---

## 一、小咪帮你说 · 多轮对话策略引擎

### 帮你说（回复模式）
- 新增 `replyStrategy` action：AI 分析对方说的话，生成 2 种多轮剧本
  - **反转撩**：先否定/调侃 → 对方有情绪 → 翻转成甜蜜
  - **引导拉近**：埋钩子激发好奇 → 试探亲密 → 引导见面
- 每轮含 `say`（话术）+ `note`（意图）+ `expectReactions`（预判对方回复）
- 前端 PetSpeakSheet 新增策略展示区，橙色卡片，step-by-step 展开

### 撩一下（主动模式）v3
- 从关键词随机匹配 → AI 语义生成，5 种策略库：
  - 反转撩（contrast）、引导拉近（progressive）、直球夸赞（direct）、幽默破冰（humor）、文艺情话（literary）
- AI 根据用户意图自动选最合适的 2 种生成
- seed 精选匹配：高分关键词命中直接展示，按策略去重
- 主语视角约束：始终以"我"为第一人称，前半段必须是主动发起的问句

### 主语/视角修正
- 提示词明确：`|` 前是"我"对 TA 说的话，`|` 后是 TA 回复后"我"接着说的
- 前半段不能像回答别人问题，必须能独立作为对话起点
- 人称统一用"我"和"你"，不要第三人称

---

## 二、AI 模型自动故障转移 + 总额度

### 多模型轮询
- `resolveAvailableModels`：按优先级排序（默认模型第一），跳过无 key 或超额的
- `tryWithModelFallback`：依次尝试每个模型，成功返回，全失败则兜底
- petLines `generateQAByAIV3` + `generateReplyPair` 已接入

### 总额度配额
- 每个模型新增 `quota`（总额度，0=不限）+ `tokensUsed`（已消耗）
- AI 调用成功后 `recordModelTokenUsage` 原子增量更新
- 超额度自动跳到下一个模型

### 后台 UI
- 模型卡片新增"总额度（tokens）"输入 + 已消耗实时显示
- `adminManage normalizeModels` 保存 quota，保留已有 tokensUsed

---

## 三、提示词后台可配置

### 小咪帮你说配置
- `system_settings` 新增 `petSpeakConfig` 字段，4 个子模块：
  - `qaStrategy`（撩一下策略）
  - `replyActive`（主动问对方）
  - `reply`（对方说了什么）
  - `replyStrategy`（多轮策略）
- 每个子模块可编辑 system prompt + temperature + max tokens
- 云函数读配置，留空用硬编码兜底
- 后台横向 4 tab 胶囊布局，切换自动保存草稿
- `adminManage updateAISettings` 保存 petSpeakConfig

### 主动/回复提示词拆分
- 原来 `reply` 一个配置同时用于主动和回复模式
- 拆成 `replyActive`（用户想主动表达）+ `reply`（对方说了什么）
- `generateReplyPair` 按 scene 自动选择

---

## 四、文本截断上限修复

### 核心问题
`normalizeSideRead` 等函数有硬编码 `clean()` 截断，管理员改提示词让 AI 生成更丰富内容，但代码层直接截掉。

### 修改清单

| 云函数 | 字段 | 改前 | 改后 |
|---|---|---|---|
| generateSideRead | title | 24 | 36 |
| generateSideRead | summary | 120 | 300 |
| generateSideRead | sections.text | 150 | 400 |
| generateSideRead | sections 数量 | 2 | 3 |
| weeklyReview | title | 24/40 | 36/60 |
| weeklyReview | summary | 120/220 | 300/400 |
| weeklyReview | sections.text | 120/150 | 400 |
| weeklyReview | sections 数量 | 2 | 3 |
| generateAssessmentAI | summary | 100 | 200 |
| generateAssessmentAI | caution | 100 | 200 |
| generateAssessmentAI | petLine | 100 | 200 |

---

## 五、种子数据（话术数据库）

### 语义统一
- 1001 条 QA 全部转为自问自答格式（规则清理 443 条 + 手动修正 11 条）
- 去掉嵌入的对方预期回复 + → 标记

### 扩充
- 从 46 条 → 251 条 → 1001 条一问一答
- 覆盖谐音双关/搞笑反转/甜蜜必杀/场景日常/幽默欠揍/文艺深情

### 策略打标
- 1001 条全部标上策略标签：direct(676) / progressive(163) / humor(75) / contrast(71) / literary(16)
- `pickTopSeedMatches` 按策略去重，保证多样性

---

## 六、品牌更名
- 关系评估 → Dom-Crush
- 所有页面 nav title、登录页、首页 hero tag 统一更新
- 登录页标题设计：72rpx italic + 黄色高亮 + 黑色阴影

---

## 七、其他修复

- **generateAssessmentAI recordTokenUsage**：从 `billing.js` 错误导入 → 改为从 `token-usage.js` 导入
- **录完记一笔判定不刷新**：`runAssessmentAI` 错误分支补 `loadData()`
- **getPhoneNumber TypeError**：升级微信基础库 3.15.2→3.7.0 + 按钮加 `@error` handler
- **微信开发者工具网络超时**：SCF API 不可达时改用本地脚本处理数据
- **前端 PetSpeakSheet 重构**：QA 策略卡片改为语调选择（幽默/暧昧/真诚/文艺）

---

## 部署状态

- 已部署云函数：petLines、adminManage、generateSideRead、weeklyReview、generateAssessmentAI
- 前端 H5 + 微信小程序已构建
- 已 git commit：`f25c8d1`，40 files，+2856/-873

## 待验证（真机/开发者工具）

1. 后台"小咪帮你说"tab 4 个子模块可编辑 + 保存生效
2. 模型额度超限后自动切换下一个
3. 主动问对方 → 多策略 QA 卡片
4. 对方说了什么 → 对话策略 + 语调选择
5. 侧写/周复盘内容不被截断
