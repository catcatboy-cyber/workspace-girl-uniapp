# 工作总结 — 2026-05-20

## 概述

完成 Token 额度系统的全部四期工程：Phase 1 账本赠送、Phase 2 后台配置、Phase 3 充值框架、Phase 4 余额阻断体验补齐。

---

## Phase 1：账本 + 赠送 + 扣费（上午）

- 业务单位「额度 token」，与模型真实 token 解耦
- 扣费公式：`ceil(真实token × 模型倍率)`
- 新用户首次赠送 100 万额度，幂等防重复
- 余额不足时为 `block` 模式
- 改动文件：`billing.js`、`token-usage.js`、`register`、`wechatLogin`、`initDb`、`api.ts`、`me.vue`

## Phase 2：后台充值配置模块（下午）

- `adminManage` 新增 `getBillingSettings` / `updateBillingSettings`，含范围校验
- `admin.vue` 新增「Token 额度」Tab：首次赠送、兑换比例、充值档位列表、模型倍率配置、扣费策略
- `billing.js` 补全 `firstGiftEnabled` 开关

## Phase 3：充值页面 + 订单系统 + 额度流水（下午-傍晚）

- **新文件**：`cloudfunctions/recharge/`（getRechargePlans / createRechargeOrder / adminConfirmRecharge）+ `pages/token-recharge/token-recharge.vue`
- **改造文件**：`adminManage` +getTokenLedger / +adminManualRecharge（支持负数扣减）、`initDb` +recharge_orders、`api.ts` +6 个函数、`token-usage.vue` 双 Tab（模型用量 + 额度流水）、`me.vue` 充值按钮、`pages.json` / `cloudbaserc.json` 注册

## Phase 4：余额阻断 + 体验补齐（晚间）

- **核心修复**：`insufficientBalanceMode: 'block'` 之前不真正阻断（AI 照常执行），现在所有 AI 云函数调用前都会做余额预检查
- `billing.js` 新增 `checkBalance(db, userId, estimatedCost)`
- 5 个 AI 云函数增加预检查：`weeklyReview`（2处）、`generateAssessmentAI`、`generateSideRead`、`analyzeAttachment`、`createTimeline`
- `createTimeline` 和 `generateSideRead` 接入 `recordTokenUsage`（之前缺失）
- `api.ts` 新增 `handleInsufficientBalance()` 公共弹窗函数
- 管理端手动充值支持负数 → 可调减 token 做测试

## 修复的关键 Bug

| 问题 | 修复 |
|------|------|
| `await` 重复声明导致构建失败 | 删除重复的 `async` |
| Token 余额始终显示 0 | 前端未发送 `getBusinessAuthPayload()`；云函数 auth.js 只在微信环境接受 event.userId |
| 云函数 `Cannot find module '@cloudbase/node-sdk'` | `recharge` 缺少 `package.json` |
| 云函数 `Cannot find module '../_shared/billing'` | CloudBase 部署不同步父目录；改为 `./_shared/billing` 并复制文件 |
| `ReferenceError: state is not defined` | `buildObjectStatusCard` 漏改 `state`/`weather` → `vibe` |
| 充值页显示"暂无可用档位" | `getRechargePlans` 要求认证但 CLI 调用无上下文，去掉认证 |

## 部署状态

所有云函数已部署（共 10+ 个），`dist/build/mp-weixin` 已重建。系统可用。

## 待验证（明日 2026-05-21）

Phase 4 余额阻断功能已完成但未端到端验证：
- [ ] 管理员后台将自己的余额调减至 100 → 触发 AI 调用 → 应弹出「额度不足」弹窗
- [ ] 弹窗点击「去充值」→ 应跳转充值页
- [ ] 充值到账后再次 AI 调用 → 应正常执行并扣费
- [ ] `createTimeline` 调用后在额度流水中出现 consume 记录
- [ ] 各 AI 功能（周复盘、即时反馈、侧写、附件识别）余额充足时正常

## 待定（依赖微信支付商户号）

- 微信支付 API 接入
- 支付回调处理
