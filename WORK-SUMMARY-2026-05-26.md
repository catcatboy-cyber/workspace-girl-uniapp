# 工作总结 — 2026-05-26

## 概述

小咪帮你说全面重构：多轮策略引擎、四语气单卡交互、AI 模型故障转移、提示词后台可配置、文本截断修复、品牌更名；首页陪伴宠物新增 Doggo 与换宠物功能。

---

## 一、小咪帮你说 · 多轮对话策略引擎

### 帮你说（回复模式）
- 新增 `replyStrategy` action：AI 分析对方说的话，生成 2 种多轮剧本
  - **反转**：先否定/调侃 → 对方有情绪 → 翻转成甜蜜
  - **引导拉近**：埋钩子激发好奇 → 试探亲密 → 引导见面
- 每轮含 `say`（话术）+ `note`（意图）+ `expectReactions`（预判对方回复）
- 前端 PetSpeakSheet 新增策略展示区，橙色卡片，step-by-step 展开

### 撩一下（主动模式）
- 主动模式不再使用旧的 QA 两段式卡片，改为复用回复模式同款策略卡片和 `strategies/turns` 数据结构
- `replyStrategy` 支持 `scene=active`：根据“用户想主动表达什么”生成 2 种多轮策略
  - **反转**：轻松反转开场 → 翻转成夸赞或明确邀约
  - **引导拉近**：低压力抛话题 → 根据可能回应继续拉近 → 可选引导见面/下一次互动
- 前端统一展示：策略 tab、Step、意图说明、话术气泡、复制按钮、对方可能反应标签

### 主语/视角修正
- 提示词明确：`|` 前是"我"对 TA 说的话，`|` 后是 TA 回复后"我"接着说的
- 前半段不能像回答别人问题，必须能独立作为对话起点
- 人称统一用"我"和"你"，不要第三人称

### 四语气单卡交互
- 结果区从“双卡片：幽默版 + 文艺版”改为“一次只显示一个结果”
- 新增语气切换：
  - 幽默轻松
  - 暧昧轻撩
  - 真诚直接
  - 委婉文艺
- 默认语气：
  - 主动问对方：暧昧轻撩
  - 对方说了什么：真诚直接
- `replyPair` 返回结构升级为 `variants`，一次生成四种语气
- `换一句` 只刷新当前选中的语气，减少界面复杂度
- 暧昧轻撩提示词加入边界：不要性暗示、不要逼表态、不要装可怜、不要情绪勒索

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
- 用户可见名称统一：`contrast` 显示为“反转”，不再使用“反差撩/反差”

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
- **前端 PetSpeakSheet 重构**：旧 QA 策略卡片改为语气选择 + 同款多轮策略卡片

---

## 八、陪伴宠物 Doggo 与换宠物功能

### Doggo 资源接入
- 使用 `pet-runs/pup-dog` 作为最终 Doggo 资源来源
- 已确认 `qa/review.json` 和 `final/validation.json` 均为 `ok: true`，无 errors/warnings
- 已检查 contact sheet：idle、running、waving、jumping、failed、waiting、review 视觉一致，可接入
- 将 `pet-runs/pup-dog/frames` 复制到：
  - `src/static/pets/doggo/frames`
- 新增：
  - `src/static/pets/doggo/manifest.json`

### 我的页换宠物
- “我的”页新增“陪伴形象”卡片
- 支持选择：
  - 小咪
  - Doggo
- 选择结果写入本地 `selectedPetId`
- 首页 `onShow` 读取 `selectedPetId`，切换底部陪伴助手资源
- 气泡前缀跟随宠物名：
  - `小咪：...`
  - `Doggo：...`
- `PetSpeakSheet` 弹窗标题跟随宠物名：
  - `小咪帮你说`
  - `Doggo帮你说`

### 微信开发者工具兼容修复
- 初版新增 `src/utils/pets.ts` 后，微信开发者工具运行时报：
  - `module 'utils/pets.js' is not defined`
- 处理过程：
  - 先尝试合并到 `helpers.ts`
  - 因开发者工具旧缓存仍 require `utils/pets.js`，最终新增普通 JS 兼容模块 `src/utils/pets.js`
  - 首页和“我的”页显式从 `@/utils/pets.js` 导入
  - 构建后确认 `dist/build/mp-weixin/utils/pets.js` 存在

### 动画状态审计
- 当前已触发状态：
  - `idle`：默认待机/返回待机
  - `waiting`：记一笔后 AI 即时反馈分析中
  - `review`：AI 成功但非风险/非意向上升；侧写生成中
  - `jumping`：意向上升；侧写成功
  - `failed`：风险、额度不足、AI 错误
- 当前资源有但业务未触发：
  - `waving`
  - `running`
  - `running-left`
  - `running-right`
- 闪烁原因初步判断：当前用 `<image :src>` 每帧切 PNG，状态重启/首轮缓存会导致微信小程序短暂闪烁
- 后续方案讨论：
  - 低成本：减少重复重启动画、预加载常用帧
  - 长期：改为 `spritesheet.webp` 裁切渲染，减少多 PNG 切换

---

## 部署状态

- 已部署云函数：petLines、adminManage、generateSideRead、weeklyReview、generateAssessmentAI
- 前端 H5 + 微信小程序已构建
- 已 git commit：`f25c8d1`，40 files，+2856/-873

## 待验证（真机/开发者工具）

1. 后台"小咪帮你说"tab 4 个子模块可编辑 + 保存生效
2. 模型额度超限后自动切换下一个
3. 主动问对方 → 四语气单卡 + 撩一下策略
4. 对方说了什么 → 四语气单卡 + 对话策略
5. 侧写/周复盘内容不被截断
6. “我的”页切换 Doggo 后，首页底部宠物、气泡前缀、帮你说标题同步切换
7. 微信开发者工具清缓存后不再出现 `utils/pets.js is not defined`

---

## 今日收尾补充：Doggo spritesheet 与包体积方案

### Doggo spritesheet 试验
- 已将 `pet-runs/pup-dog/final/spritesheet.webp` 接入到 `src/static/pets/doggo/spritesheet.webp`。
- `src/utils/pets.js` 中 Doggo 新增 spritesheet 元数据：`renderer`、`spritesheetPath`、单帧尺寸、图集行列、状态行映射。
- 首页底部宠物条已按配置分支渲染：
  - Doggo 使用 spritesheet + viewport 裁切。
  - 小咪继续使用原逐帧 PNG。
- 动画状态、气泡、弹窗触发逻辑未改，只替换 Doggo 的取帧方式。

### 构建验证
- `npm.cmd run build:mp-weixin`：通过。
- `npm.cmd run build:h5`：通过。
- 小程序构建产物中已确认包含 `dist/build/mp-weixin/static/pets/doggo/spritesheet.webp`。
- `dist/build/mp-weixin/utils/pets.js` 中已确认 Doggo spritesheet 配置被打入。

### 当前包体积审计
- 当前 `dist/build/mp-weixin` 总体积约 `6.82MB`。
- 当前宠物资源体积：
  - `doggo` 约 `3.73MB`。
  - `xiaomi` 约 `2.51MB`。
- Doggo 当前同时包含新的 `spritesheet.webp` 和旧的 `frames` PNG 帧：
  - `spritesheet.webp` 约 `1.65MB`。
  - 旧 PNG 帧约 `2.08MB`。
- 因此 Doggo 虽然运行时已走 spritesheet，但旧 PNG 帧还在包内，暂时没有完成真正缩包。

### 包体积优化结论
- 用户在小程序里“选择某个宠物后废弃另一个”，不能减少已经发布的小程序包体积。
- 真正能缩包的做法是：构建/上传前就不要把未内置的宠物资源放进主包。
- 短期建议：只保留 Doggo 作为唯一内置宠物。
  - 保留 `doggo/spritesheet.webp`。
  - 删除 `doggo/frames`。
  - 删除或不打包 `xiaomi/frames`。
  - “我的”里的换宠物入口可先隐藏或改成“当前陪伴形象”。
  - 预计可减少约 `4.5MB` 静态资源。
- 长期方案：云端宠物包。
  - 主包只带一个默认宠物。
  - 其他宠物放云存储/CDN。
  - 用户切换时下载对应 spritesheet，并做本地缓存、版本号、失败回退。

### 今日结束状态
- Doggo spritesheet 方案已落地，用户反馈效果可以。
- 下一步若继续压小程序包体积，建议先决定：Doggo 是否作为唯一内置宠物，还是保留换宠物能力并转向云端宠物包。
