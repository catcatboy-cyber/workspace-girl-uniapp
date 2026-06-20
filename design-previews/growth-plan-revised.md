# Crush Master 拉新体系修订方案 v1.1

## 核心结论

原 v1.0 的方向成立：拉新链路应该从“先登录、先建档、先做题”改成“先给价值，再引导建档”。但 v1.0 范围过大，四条渠道、静默登录、默认 Crush、分享归因、Token 奖励和隐私匿名化一起做，工程风险偏高。

修订后的策略是：**第一阶段只跑通渠道 2「一句话解读」MVP**。先验证内容获客到建档转化，再扩桃花人设卡、我们看板卡片、桃花匹配度分享。

## v1.0 需要修正的点

| 问题 | 修订方案 |
| --- | --- |
| 四条渠道同时开发，范围过大 | 第一阶段只做 quick-read，一条链路跑通后再扩渠道 |
| 默认 Crush 页面加载即创建，容易污染档案 | 只在用户点击“持续追踪”或提交第一条记录时创建 |
| 一句话解读复用 createTimeline 不合适 | 新增 quickRead 云函数，允许 pre-case 体验 |
| 分享链接裸传 inviterId 有隐私风险 | 优先使用 inviteCode + shareId，服务端解析归因 |
| 匿名化只写在前端生成图逻辑里不够 | 分享快照必须服务端脱敏和校验 |
| Token 奖励过早上线会引入刷量风险 | MVP 只记录归因，奖励体系第二阶段再做 |

## 第一阶段 MVP 流程

```text
内容平台 / 分享图
  -> /pages/quick-read/quick-read?scene=flirt&ref=xiaohongshu&inviteCode=XXXX&shareId=YYYY
  -> App.vue 尝试静默登录，不弹登录页
  -> 用户输入一句聊天或事件
  -> quickRead 云函数返回：意向指数、风险指数、解读、怎么回
  -> CTA：想持续追踪？
  -> getOrCreateDefaultCase({ source: 'quick_read', name: 'TA' })
  -> 可选补本人画像 ProfileInline
  -> 进入“我们”页或快速记录第一条事件
```

## 第一阶段开发范围

### 1. 静默登录

位置：`src/App.vue`、`src/utils/api.ts`

- MP-WEIXIN 下启动时调用 `wx.login()`。
- 使用现有 `wechatLogin('', { loginCode })` 换取/创建业务用户。
- 成功后写入 `userId`、`currentUser` 等现有缓存。
- 失败时不打断落地页，只记录 `silentLoginFailed`，等用户触发需要云能力的动作时给“重试登录”。
- 不强制手机号，不跳 `pages/login/login`。

### 2. Landing Context 工具

新增：`src/utils/landing.ts`

统一解析并缓存：

- `scene`
- `ref`
- `channel`
- `inviteCode`
- `shareId`

用途：quick-read、taohua-share、后续 card-share 都复用同一份来源上下文，避免每个页面各自解析 URL。

### 3. quickRead 云函数

新增：`cloudfunctions/quickRead`

输入：

- `text`：用户输入的一句话或短事件
- `scene`：内容场景，如 `flirt`、`commit`、`slow`
- `landingContext`：来源参数

输出：

- `intentScore`：意向指数
- `riskScore`：风险指数
- `summary`：一句话判断
- `analysis`：解读正文
- `replySuggestion`：建议怎么回
- `nextAction`：下一步建议

要求：

- 不依赖 `caseId`。
- 不写入 timeline。
- 有服务端频控：按 openid、IP、shareId、设备缓存限制免费调用。
- AI 失败时返回规则兜底，不让页面空白。

### 4. quick-read 页面

新增：`src/pages/quick-read/quick-read.vue`

页面原则：

- 第一屏就是输入框和“免费分析”按钮。
- 不做介绍型落地页。
- `scene` 只影响标题、示例提示和 prompt 偏向。
- 结果出来后展示 CTA：“想持续追踪这段关系？”

首批 scene：

| scene | 标题方向 | 适合内容来源 |
| --- | --- | --- |
| `general` | 三步判断：主动、回应、兑现 | 通用内容 |
| `commit` | 他说下次约你，但一直不定时间 | 小红书/视频号 |
| `flirt` | 主动聊天但不约见面，是暧昧还是养鱼 | 小红书/抖音 |
| `slow` | 真慢热还是没那么喜欢 | 小红书 |

### 5. getOrCreateDefaultCase

新增位置建议：`src/utils/onboarding.ts` 或 `src/utils/api.ts`

行为：

- 先查当前用户是否已有 case。
- 没有才创建 `{ name: 'TA', profile: {}, source: 'quick_read', isDefault: true }`。
- 只在用户明确点击 CTA 后执行。
- 如果套餐或 Crush 数量限制不允许创建，要给可理解的提示，不静默失败。

## 隐私和风控规则

| 风险 | 规则 | 实现位置 |
| --- | --- | --- |
| 分享者隐私泄露 | 分享图和落地页只使用脱敏 snapshot | 服务端生成/校验 snapshot |
| URL 暴露身份 | 链接带 inviteCode/shareId，不带 userId、caseId、openid | 分享工具函数 |
| 免费 AI 被刷 | openid/IP/shareId 频控，异常降级规则解读 | quickRead 云函数 |
| 默认档案污染 | 默认档案加 `isDefault/source`，用户编辑后转普通档案 | getOrCreateDefaultCase |
| 奖励套利 | MVP 只记录归因，先不上多动作奖励 | referral_events |

## 后续渠道扩展顺序

| 优先级 | 渠道 | 开发策略 | 上线条件 |
| --- | --- | --- | --- |
| P1 | 桃花人设卡分享 | 改造 `taohua-share`，未登录用户直接测自己，不再跳登录页 | 静默登录稳定，ProfileInline 可用 |
| P2 | 我们看板卡片分享 | 只分享卡片结构和趋势形状，服务端生成匿名 snapshot | 隐私快照表完成 |
| P3 | 桃花匹配度分享 | 复用 `taohua` 页，但双方画像必填，链路更长，放后面 | 桃花人设转化数据可接受 |
| P4 | 全渠道 Token 奖励 | 从现有 inviteCode 扩展为 action-based referral event | 确认免费体验没有明显刷量 |

## 开发批次

### 第 1 批：登录与来源上下文

- `App.vue` 增加静默登录。
- 新增 `landingContext` 工具。
- 分享 URL 统一追加 `inviteCode`、`channel`、`shareId`。

### 第 2 批：quick-read 闭环

- 新增 `quickRead` 云函数。
- 新增 `pages/quick-read/quick-read`。
- 新增结果组件 `QuickReadResult.vue`。
- 结果 CTA 接 `getOrCreateDefaultCase`。

### 第 3 批：桃花分享改造

- `taohua-share` 未登录不再跳登录页。
- `ProfileInline` 支持必填和可跳过两种模式。
- 分享文案和图片接入归因参数。

### 第 4 批：留存增强

- `ProgressMilestone` 接入“我们”页。
- 记录后更新 `lastRecordDate`。
- 宠物状态只做轻量文案和样式联动。

## 验收标准

1. 微信扫码打开 quick-read，不出现登录页，输入一句话可得到结果。
2. 静默登录失败时，页面给出重试入口，不影响用户阅读分享快照。
3. 点击“持续追踪”后才创建默认 Crush，并进入“我们”页。
4. 分享链接中没有 `userId`、`caseId`、`openid` 等敏感标识。
5. `quickRead` 调用有服务端频控和错误兜底。
6. 后台能看到 `channel`、`scene`、`ref`、`shareId` 的基础转化数据。

## 不建议第一阶段做的内容

- 不做四条渠道同时上线。
- 不做复杂 Token 奖励矩阵。
- 不做看板卡片分享的完整生成图系统。
- 不做桃花匹配度分享链路。
- 不把 ProfileInline 做成大而全表单。

第一阶段的唯一目标是验证：**用户从内容平台进入后，是否愿意输入一句话，并在得到结果后创建持续追踪档案。**
