# 工作总结 — 2026-05-23

## 概述

时间轴三 tab 重构、周复盘/侧写全数据记录、后台反馈系统、token 审计修复、语音录音优化、静默刷新指示器、AI 语义标签懒加载方案 A。

## 一、首页优化

### 语音录入
- 按钮加图标：🎤 / ⏹ / 🔄
- 录音时音波动画 + 倒计时嵌入按钮内：`⏹ ▎▍▌▋ 0:45`
- 60s 到 0 自动停止

### 图片上传
- 文件名从 `tmp_xxx` 改为 `IMG_20260523_150230.jpg` 时间戳格式
- 长文件名 CSS `text-overflow: ellipsis` 截断

---

## 二、时间轴三 tab 重构

| Tab | 内容 |
|---|---|
| 关键事件 | 纯事件记录，含 subjectRole 标签（对方/自己/互动），侧写不在此显示 |
| 周复盘 | 本周复盘 + 本周侧写，含全数据（趋势/统计/关键变化/下周重点/避免误判/sections） |
| 评估历史 | 评估卡片 + 本次侧写完整展示（标题+摘要+sections，含属相星座分析） |

### 侧写归类
- 本次侧写 `feature: 'sideRead'` → 仅评估历史卡片
- 本周侧写 `feature: 'weeklySideRead'` → 周复盘 tab
- 关键事件不含任何侧写

### 周复盘 tab 数据
- 云函数写全量字段：trendLabel / eventCount / assessmentCount / intentDelta / riskDelta / keyChanges / keyEvents / nextWeekFocus / avoidMisread / sections
- `occurrenceAt` 修正为生成时刻（非周末日期）
- 云函数 `data:` wrapper 移除（@cloudbase/node-sdk 不需要）

### subjectRole 标签修复
- 旧记录无 subjectRole 不再显示"对方"
- 区分三种：对方 / 自己 / 双方互动

---

## 三、我的页面 & 独立页面

### 新增菜单
- 系统轨迹 → `/pages/system-tracks/system-tracks`
- 判断说明 → `/pages/explain/explain`
- 系统反馈 → `/pages/feedback/feedback`
- 关于 → `/pages/about/about`（v1.0.0）

### Token 消费明细页
- 新增"充值记录" tab，显示额度变动（赠送/充值/调整）

### 其他
- "刷新"按钮同时刷新余额 + 使用统计
- 按钮 CSS `min-width: 100rpx` 修文字截断

---

## 四、后台反馈系统

### 云函数
- `submitFeedback` — 存储 userId + openid，自动建集合
- `adminManage` — `listFeedbacks` + `resolveFeedback` action

### 后台界面
- "反馈管理" tab：用户标识/联系方式/内容/时间
- 采纳按钮 + 奖励 token 输入框
- 无 userId 时支持手动输入用户 ID
- 采纳后自动加余额 + 写 ledger
- 失败显示红色提示

### 用户反查
- 优先 `fb.userId` → 其次 `fb.openid` 查 users 表 → 支持手动填入

---

## 五、Token 审计与修复

### `data:` wrapper 修复（@cloudbase/node-sdk 不需要）
- `resolveFeedback` ledger 写入
- `weeklyReview` 两处 timeline 写入
- `generateSideRead` timeline 写入

### 账目对齐
- `petLines` `reply` action — 加 checkBalance + recordTokenUsage
- `petLines` `tagLines` action — 每批加余额检查 + token 记录
- `adminManualRecharge` 扣减时 purchasedTokens 同步递减
- `createTimeline` 移除死代码 checkBalance
- `adminManage/_shared/billing.js` 导出 checkBalance
- `resolveFeedback` if 块缺失 `}` 语法错误修复

---

## 六、其他修复

### 周复盘按钮智能禁用
- `case-detail.vue`：无新事件时灰色"暂无新事件"
- 有新事件才可点"重新生成本周复盘"

### 静默刷新指示器
- timeline / case-detail / weekly-review 三个页面
- 切 tab 触发 silent load 时顶部红色滑动细线
- 首次加载不显示（全屏 loading），后续静默刷新才显示

### 时间轴案例切换
- `timeline.vue` onShow 加 activeCaseId 变更检测

---

## 七、AI 语义标签方案 A（已实现）

### 设计
- 打开时间轴时异步懒加载，不阻塞 UI
- 未打标事件批量送 AI（最多 30 条），专用提示词只输出 JSON 标签
- 结果存 `timeline_records.semanticTags` + `semanticTagsSource: 'ai'`
- 用户标签 `'user'` 不可覆盖
- temperature 0.1, max_tokens 600

### 文件
| 文件 | 改动 |
|---|---|
| `cloudfunctions/generateAssessmentAI/_shared/event-tagger.js` | **新建** — 提示词 + 解析 |
| `cloudfunctions/generateAssessmentAI/index.js` | 新增 `batchTagEvents` action |
| `src/utils/api.ts` | 新增 `batchTagEvents(caseId)` |
| `src/pages/timeline/timeline.vue` | loadData 后调 `syncSemanticTags` |

### 开发计划
`SEMANTIC-TAG-DEV-PLAN.md` — 完整标签体系、提示词、数据流说明

---

## 部署状态

- 前端 H5 + 微信小程序已构建
- 云函数已部署：`generateAssessmentAI`、`weeklyReview`、`generateSideRead`、`adminManage`、`submitFeedback`、`petLines`、`createTimeline`
- `system_feedback` 集合已创建

## Git 状态

未提交，改动分散在多文件中。
