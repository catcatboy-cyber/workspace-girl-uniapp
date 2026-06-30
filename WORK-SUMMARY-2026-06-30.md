# 今日工作总结

日期：2026-06-30

项目：workspace-girl-uniapp / 微信小程序 Crush Master

---

## 1. Landing 广告页 + 新用户引导体系

### 1.1 方案
- 将 `login.vue` 改造为 brutalist 风格 Landing 页（小咪头像 + app 介绍 + 功能说明）
- 入口设为 pages.json 第一位，成为新用户第一屏
- 「关闭」按钮 + 「下次不再弹出」checkbox（勾了才持久化，不勾下次还显示）
- 老用户自动跳首页

### 1.2 画像引导延伸
- `self-profile.vue` 的 onboarding 从 5 步扩展到 7 步（Q5 欢迎 + Q6 导览 CTA）
- 进度条动态化：`totalOnboardingSteps = questions.length`
- 选 CTA 后 storage 存 `onboardingAction`，首页自动打开对应表单
- 首页 `applyPendingOnboardingAction()` 读取 action 并打开 AssessmentForm

### 1.3 App.vue 精简
- 删除手动隐私弹窗（微信原生已覆盖）
- 删除 `silentWechatLogin` 中的 `shouldCompleteSelfProfile` redirect（移到 landing 页按钮逻辑）
- 修复 `silentWechatLogin` 老用户跳过导致 CloudBase auth 过期的问题——改为每次冷启动都调 `wechatLogin`

### 1.4 相关修复
- 关于页隐私政策文案更新：删除「微信头像和昵称」（未收集）、更新为真实数据项
- 新用户首次进入时小咪气泡追加「点我试试~」提示

---

## 2. "我们" 页面渐进解锁系统

### 2.1 进度条改造
- `ProgressMilestone` 里程碑从 `0/3/7/14/30` 改为 `0/3/7/14/30`
- Hint 文案：`再记 N 条解锁「X」`
- 进度百分比 `count/30 * 100`

### 2.2 卡片解锁 + 锁定样式
- 5 张卡片按阈值排序：雷达(始终) → 矩阵(始终) → 场景(3) → 天平(7) → 趋势(14) → 信号(14) → 月度(30)
- 锁定卡片保持标题框架，内容显示 `🔒 记录 N 条事件后解锁 · 已记录 X 条`
- 场景卡片解锁条件移除 `sceneBubbles.length > 0` 硬要求，记录数够了就解锁，无数据时显示「已解锁，但本月记录暂未识别到场景标签」
- 月度复盘按钮移入卡片内部，锁定时不可见

### 2.3 记录计数修复
- case-detail `userTimelineRecords` 过滤条件补充 `weekly_review` 和 `monthly_review` 类型
- 修复前这两种系统记录被错误计入 `timelineCount`，导致进度虚高

---

## 3. 场景气泡图修复

### 3.1 坐标轴方向
- 纵轴：`少`↓ → `多`↑（修正反直觉设计）
- 横轴：`线下/关系推进` → 右，`线上/日常互动` → 左

### 3.2 气泡定位重写
- 改为按类型（线上/线下）分配 X 坐标，按数量（count）分配 Y 坐标
- 线上 → x=100，线下 → x=280
- 数量越多越靠上（多↑少↓）
- 同类型气泡纵向错开 18rpx 防止重叠
- 最大气泡 94rpx（之前 118rpx 导致相邻重叠）

---

## 4. Token 卡片计算审计

### 4.1 TotalLimit 修复
- `totalLimit` 之前错误地加了 `extraTokens`（月度限额 + 加油包），导致「已用/上限」显示异常
- 修复为只显示月度限额 `monthlyTokensLimit`
- 标签改为「月已用/月限额」避免误解

### 4.2 三池计算链确认
- Token 可用 = `max(0, 月限额 - 月已用) + 加油包` ✅
- 本月套餐 = `max(0, 月限额 - 月已用)` ✅
- 加油包 = `extraTokens` ✅
- 月已用/月限额 = `月已用 / 月限额` ✅
- Ultra unlimited → `∞` ✅

### 4.3 订阅升级账本修复
- `fulfillSubscription` 写入 `amount: upgradeTokens`（套餐月额度），`balanceAfter` 计算为月剩余+加油包
- 前端 `mapLedgerType` 新增 `source === 'sub'` → 「升级套餐」标签
- Token 卡片三种数字字号统一降级为 `stat-num-sub-v2` (28rpx, 700) 防止溢出

---

## 5. 支付链路安全审计与修复

### 5.1 密钥保护
- `cloudbaserc.json` 加入 `.gitignore`，`git rm --cached` 取消 git 跟踪
- 商户私钥和 APIv3 Key 已在云函数环境变量中配置，不轮换（未上架）

### 5.2 日志脱敏
- `wxpay-v3.js` 所有非错误日志改为 `isPayDebug()` 守卫，上线后默认关闭
- `recharge/index.js` 所有 `[PAYDBG]` 日志改为 `payLog()` 守卫

### 5.3 支付确认修复
- `confirmPayment`：`paid && fulfillmentStatus !== 'succeeded'` → 重新补偿 `fulfillPayment`
- `fulfillPayment`：增加三态机（pending→succeeded→failed），失败时记录错误
- 前端 `token-recharge.vue` 和 `subscription.vue`：即时确认 + 轮询均检查 `fulfillmentStatus === 'succeeded'`，未完成显示「到账处理中」
- `unifiedOrder`：删除前端传入 `openid` 路径，只从 DB 查

### 5.4 消费记录
- `grantRechargeTokens` 双幂等检查（旧格式 `recharge_xxx` + 新格式 `source + sourceId`）
- `generateAssessmentAI` 幂等：`assessment.aiUsed` 为 true 直接返回
- 前端 `runAssessmentAI` 幂等：`latestResult.aiUsed` 为 true 跳过

---

## 6. 消费明细显示优化

- Token 充值页面：充值记录不显示订单号 remark，只显示类型标签
- `mapLedgerType` 修复 `source === 'recharge'` 匹配（之前只匹配 `recharge_` 前缀）
- `mapFeature` 新增 `initial_assessment_text`、`petReplyStrategy`、`petReply` 映射
- 订阅升级账本余额修正

---

## 7. 分享链接修复

- case-detail 分享链接从 `/pages/case-detail/case-detail?caseId=xxx` 改为 `/pages/index/index`
- 接收者不再因访问他人 caseId 而报「无权访问」

---

## 8. 快速记录增强

### 8.1 对话记录分析
- `describeSubjectRole('both')` prompt 增强：AI 自动识别微信/QQ 对话格式并解析双方
- 选「互动」时出现昵称映射栏（我的昵称 / TA的昵称），填入后传给 AI prompt
- AI 用昵称映射识别对话双方，正确归属信号

### 8.2 自动检测优化
- `inferSubjectRole` 简化：仅多行+时间戳格式自动判 `both`，普通描述只在对方/自己之间选
- `onQuickDescInput` 检测对话格式并自动切到互动模式

### 8.3 UI 调整
- 角色选择（对方/自己/互动）移到输入框上方
- placeholder 随角色动态变化
- 昵称映射栏移到输入框上方
- `:value` + `@input` 替代 `v-model` 修复微信粘贴截断 bug
- `min-height: 360rpx`、`max-height: 640rpx`、`maxlength: 6000`

---

## 9. 交互细节

### 9.1 下拉刷新
- 5 个主页全部启用 `enablePullDownRefresh` + `onPullDownRefresh`

### 9.2 TOKEN 到账动画
- 新建 `TokenCoinOverlay.vue` 金币动画组件
- 充值成功时弹金币（数字滚动 + 粒子环绕 + 弹跳入场）
- 订阅升级成功时弹金币显示套餐月配额

### 9.3 分享提醒
- 试用期或 Token<20000 时，小咪每天最多 1 次、50% 概率提醒分享赚 Token
- 延迟 4 秒展示，显示 6 秒后恢复

### 9.4 桃花卡片优化
- 背景改为暖色渐变，`cursor: pointer`
- 点击「查看完整命理分析」时检测画像是否完善，未完善弹窗引导

### 9.5 其他
- 反馈页面顶部增加「反馈被采纳，奖励 Token」醒目提示卡片
- 复评页增加「⚠️ 重新分析说明」橙色警告卡片
- 「我」页面系统说明等 4 个入口合并为一张卡片，统一样式
- 事件流卡片「发生时间/记录于」移至底部
- 充值记录标签修复 + 订阅升级显示套餐月配额

---

## 10. 修改文件汇总

| 文件 | 改动 |
|------|------|
| `src/App.vue` | 删隐私弹窗、删画像 redirect、恢复静默登录每次执行 |
| `src/pages.json` | landing 页移首位 + 5 页 enablePullDownRefresh |
| `src/pages/login/login.vue` | 完全重写为 Landing 广告页 |
| `src/pages/self-profile/self-profile.vue` | 7 步扩展 + 进度动态化 |
| `src/pages/index/index.vue` | 快速记录重构 + 昵称映射 + 对话检测 + placeholder + 分享提醒 |
| `src/pages/case-detail/case-detail.vue` | 卡片渐进解锁 + 气泡图重写 + 记录过滤修复 + 分享路径修复 |
| `src/pages/me/me.vue` | Token 计算修复 + 系统说明合并 + 下拉刷新 |
| `src/pages/token-recharge/token-recharge.vue` | 金币动画 + fulfillmentStatus 检查 |
| `src/pages/subscription/subscription.vue` | 金币动画 + fulfillmentStatus 检查 |
| `src/pages/token-usage/token-usage.vue` | featuer 映射 + ledger 类型映射 |
| `src/pages/timeline/timeline.vue` | 事件流布局调整 + 下拉刷新 |
| `src/pages/cases/cases.vue` | 下拉刷新 |
| `src/pages/about/about.vue` | 隐私政策更新 |
| `src/pages/reassess/reassess.vue` | 重新分析警告 |
| `src/pages/feedback/feedback.vue` | 反馈奖励提示 |
| `src/components/ProgressMilestone.vue` | 里程碑重构 |
| `src/components/TokenCoinOverlay.vue` | 新建金币动画组件 |
| `cloudfunctions/_shared/payment-fulfillment.js` | 日志守卫 + 发货三态机 + 订阅余额修正 |
| `cloudfunctions/_shared/subscription.js` | normalizeLedgerSource + 消费记录完整字段 |
| `cloudfunctions/recharge/index.js` | 日志守卫 + confirmPayment 补偿 + openid 安全 |
| `cloudfunctions/recharge/_shared/wxpay-v3.js` | 日志脱敏 |
| `cloudfunctions/generateAssessmentAI/index.js` | 幂等保护 |
| `cloudfunctions/createTimeline/_shared/event-understanding.js` | 对话分析 prompt + 昵称映射 |
| `cloudfunctions/createTimeline/index.js` | chatSelfName/chatTargetName 传递 |
| `scripts/sync-shared.js` | 提示语修正 |
| `.gitignore` | 添加 cloudbaserc.json |
