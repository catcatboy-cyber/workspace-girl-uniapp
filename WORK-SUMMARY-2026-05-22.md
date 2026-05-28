# 工作总结 — 2026-05-22

## 概述

完成三大块工作：AI 超时基建调整、即时反馈格式与可观测性优化、小米帮你说完整功能（数据采集→标记→AI 场景化生成→前端交互）。

## 一、AI 超时调整

云函数 30s → 60s，HTTP 超时 15s → 45s，覆盖全部 6 个 AI 调用函数。

| 云函数 | 旧超时 | 新超时 | 旧 HTTP | 新 HTTP |
|---|---|---|---|---|
| generateAssessmentAI | 30s | 60s | 15s | 45s |
| createTimeline | 30s | 60s | 15s | 45s |
| generateSideRead | 25s | 60s | 18s | 45s |
| weeklyReview | 30s | 60s | 15s | 45s |
| analyzeAttachment | 25s | 60s | 15s | 45s |
| testAIConnection | 15s | 60s | 15s | 45s |

## 二、即时反馈修复

### 2.1 AI 参与标识

首页 `index.vue`：在"你接下来怎么做"下方加 badge，实时显示本次结果来源。
- 绿色 badge「AI 参与」— AI 成功返回
- 橙色 badge「规则兜底」— AI 超时/未启用/回退

### 2.2 rawReply 格式修复

**问题**：AI 返回的三段式结构（对方可能的心理/你下一步怎么做/重点观察什么）格式不稳定，有时标题+冒号正常换行，有时用斜杠连在一起。

**修复**：
- 提示词 `ai-event.js:389` 给出显式模板 `标题：内容` 格式
- 前端 `index.vue` parser 加斜杠格式兜底

## 三、小米帮你说（PetSpeak）

### 3.1 数据采集

| 来源 | 分类 | 数量 | 风格 |
|---|---|---|---|
| api.lovelive.tools | humor（幽默）| 500 条 | 土味情话、撩人、搞笑 |
| v1.hitokoto.cn | literary（文艺）| 500 条 | 诗词、文学、深情 |

脚本 `scripts/crawl-pet-lines.js` 可重新跑扩充。

### 3.2 AI 话术标记

1000 条话术全部 AI 打标，25 个固定场景标签：

| 高频标签 | 数量 |
|---|---|
| 文艺 | 703 |
| 表白 | 276 |
| 日常 | 248 |
| 暧昧 | 233 |
| 幽默 | 166 |
| 想念 | 135 |

脚本 `cloudfunctions/petLines` action `tagLines` 可按需重新标记。

### 3.3 核心功能

云函数 `petLines` 新增 `replyPair` action：

```
输入：scene（active=主动发起 / reply=回复对方）+ content
流程：提取关键词 → 从 1000 条中筛 tag 匹配的候选 → 随机取 6 条
     → AI 结合场景 + 参考话术 → 生成幽默版 + 文艺版各一句
     → 余额检查 + token 消费记录
输出：{ reply, alternative, inspirations, tokensUsed }
```

### 3.4 前端交互

- 入口：首页 pet bar 点击小米头像 → 底部弹窗
- 双 Tab：主动问对方 / 对方说了什么
- 输出：幽默版（推荐）+ 文艺版（备选），各自独立复制
- 换一种说法：重新生成（每次消耗 token）
- 余额不足：弹窗引导充值（复用 `handleInsufficientBalance`）

新增/修改文件：
```
src/components/PetSpeakSheet.vue  ← 新建
src/utils/api.ts                  ← +generatePetReplyPair()
src/pages/index/index.vue         ← 集成组件 + 入口
```

### 3.5 回复格式优化

- 推荐 = 幽默版（俏皮有趣接地气）
- 备选 = 文艺版（有文采有韵味）
- prompt 允许 AI 在完美匹配时直接用原句，不硬改写

## Git 状态

petLines 云函数和前端组件均为新增文件，未提交。

## 四、小米宠物（小咪）完整开发

### 4.1 资源与组件
- `src/static/pets/xiaomi/` — 9 状态 × 帧 PNG + manifest.json
- 宠物底部固定悬浮栏，`position:fixed`，透明背景 + 白底冒泡（含三角尾巴）
- 帧动画：`setInterval` 驱动，状态切换自动重置，页面卸载清理定时器

### 4.2 AI 个性化播报（P3）
- 提示词新增 `petLine`（≤50 字第一人称）+ `petMood`（情绪枚举）
- 前端宠物台词优先取 `petLine`，兜底 `bullets[0]` → 固定文案
- 宠物改名：小米 → 小咪

### 4.3 运行时配置修复
- `ai-event.js` 的 `normalizeSettings()` 原不读 `runtimeConfig`，导致 `eventMaxTokens`/`eventTemperature`/`eventContextLimit` 无效
- 已修复：读 `runtimeConfig` 并传参 + 后台补 `eventUnderstandingTemperature` 字段

### 4.4 数据缓存优化
- 所有 tab 页面用 `dataVersion` 替代 `dataReady`：index 数据变更时 bump 版本号，其他页面切回时比较后静默刷新
- 首次加载显示 loading，后续静默更新不闪白屏
- `loadData()` 加 `silent` 模式

### 4.5 样式与数据修复
- case-detail "关键拐点"字体过大 → 补 CSS `font-size:22rpx`
- 周复盘加 `dataVersion` + `silent` 模式
- token 统计：me 页 limit 50→100，每次进"我的"强制刷新 token 数据
- `headline` 字段删除后前端改用 `petLine` / `bullets[0]`

## 五、明日待跟踪

### 5.1 周复盘 AI 虚报事件数量
- AI 的 rawReply 说"本周只有一次互动"，但时间轴里实际有多条用户记录
- 根因：大概率是 AI 随口编的，不是程序过滤掉了（`assessment`/`trend` 类型排除正常）
- 待办：在周复盘提示词里加约束，禁止 AI 猜测事件数量

### 5.2 Token 统计验证
- 已修：me 页 `getTokenUsage` limit 50→100，每次 onShow 强制刷新
- 待观察：明天确认"我的"页和消费明细页数字是否一致
- 已知差异：累计消费（全历史×倍数）vs 模型 token（最近100条原始值）是两个概念

### 5.3 关注项
- PetSpeakSheet "可以这样说" 的 `petLines` 云函数已修复语法错误并部署，明天确认功能正常
- 用户反馈"关系"页标题显示"暂无评估结果"→已修，改为读 `petLine`

## 部署状态

全部云函数已部署、H5 + 微信小程序已构建。
