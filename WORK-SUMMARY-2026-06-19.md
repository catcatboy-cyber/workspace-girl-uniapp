# 2026-06-19 工作总结

## 一、回滚与重启

- 回滚昨天全部代码到 `aff95d6`（6/17 状态），重新部署 4 个云函数
- 审计报告揭示了双配置双奖励体系、warm-start 丢邀请、非原子更新等 8 个问题
- 采纳 Codex v1.1 修订方案：分批次，先跑通渠道 2 一条线

## 二、第 1 批：静默登录 + 来源上下文

| 文件 | 改动 |
|------|------|
| `src/App.vue` | `onLaunch` 静默微信登录（`wx.login` → `wechatLogin`），`onShow` 捕获来源参数 |
| `src/utils/landing.ts`（新） | 统一 `captureLandingContext` / `readLandingContext`，解析 scene/ref/channel/inviteCode/shareId |
| `src/utils/share.js` | 新增 `appendReferralParams()` 用 inviteCode+shareId+channel 替代裸传 userId |
| `src/pages/index/index.vue` | 删除临时 quick-read 入口（已不需要） |

## 三、第 2 批：quickRead 闭环

| 文件 | 改动 |
|------|------|
| `cloudfunctions/quickRead`（新） | 独立云函数，不依赖 caseId，AI + 8 种场景规则兜底，内存频控（每窗口 5 次） |
| `src/pages/quick-read/quick-read.vue`（新） | 纯落地页：有快照→展示 A 的分析 KPIs/信号/子弹/小咪解读 + CTA；无快照→通用 Hero + CTA |
| `src/utils/api.ts` | 新增 `quickRead()` 和 `getOrCreateDefaultCase()`（CTA 点击后才建默认 Crush） |
| `pages.json` + `cloudbaserc.json` | 注册路由和云函数 |

### 分享链路
```
A 今日页「本次分析」→ 分享按钮 → path 带 intent/risk/signal/bullets/action + inviteCode/shareId/channel
  → B 点击 → 静默登录 → quick-read 落地页 → 看快照 → CTA「开始追踪」
  → self-profile onboarding → 默认 Crush → 进入「今日」
```

## 四、index.vue 本次分析分享

- 「本次分析」卡片右上角加 share-2 分享按钮
- `onShareAppMessage`：intent + risk + signal + bullets（前2条）+ action（≤150字）+ `appendReferralParams`
- `shareTitle` 自动生成吸引人文案：高意向低风险→"TA 是真心的吗？"，中意向高风险→"TA 是暧昧还是养鱼？"

## 五、后台

- 重新实现 `adminManage` 的 `deleteUser` action（清 users/cases/assessments/timeline/login_logs 等）
- `api.ts` 新增 `adminDeleteUser()`，admin.vue 加删除按钮 + 确认弹窗

## 六、待解决

- B 用户链路冷启动登录未验证通过（加了 debug 日志等待测试）
- quickRead 云函数 AI 调用待确认可用
- 渠道 3/4 及后续批次未开始

## 七、关键教训

1. **改模块前先读已有代码** — 不重蹈 `rewardInviter` 与 `redeemInviteCode` 双轨的覆辙
2. **分批次、先跑通一条线** — 不要同时开四条渠道
3. **每次确认方案再动手** — 用户反复强调的原则
