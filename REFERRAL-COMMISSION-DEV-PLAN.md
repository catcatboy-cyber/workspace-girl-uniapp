# 用户分享激励与充值分佣开发方案

> 状态：待开发
> 目标：复用现有邀请关系，为邀请人的有效付费好友生成可审计、可幂等、可撤销的充值佣金。

## 1. 业务范围

邀请人 A 分享测试题或结果，被邀请人 B 通过带邀请码的分享链路进入并绑定关系。B 完成以下任一种有效付费后，A 获得佣金：

| 付费渠道 | 当前订单集合 | 当前产品识别 | 分佣接入点 |
|---|---|---|---|
| 套餐 | `recharge_orders` | `productType=subscription` | `_shared/payment-fulfillment.js` |
| 加油包 | `recharge_orders` | `productType=recharge` | `_shared/payment-fulfillment.js` |
| 道具/报告解锁 | `archetype_report_orders` | `status=fulfilled` | `archetype-report-access.js` |

第一版默认规则：三类产品均参与、按实付金额百分比计算、支付成功后冻结 7 天，冻结期结束转为可用佣金。后台可分别关闭某个产品渠道。

## 2. 不变的邀请关系

- 关系来源仍以 `referral_claims` 为准，`_id=inviteeUserId`，一个被邀请人只能绑定一个邀请人。
- 现有一次性邀请奖励继续由 `processReferralJobs` 处理，不与充值佣金共用奖励流水 ID。
- 无邀请码、无有效 claim、自邀、关系冲突、人工标记风险的订单不分佣。
- 历史订单默认不追溯，只处理功能启用时间之后的支付成功事件。

## 3. 分享归因补齐

统一使用 `src/utils/share.js` 的 `appendReferralParams()` 生成分享路径，必须携带：

```text
inviteCode + channel + scene + shareId
```

需要逐项审计并补齐：

1. 测试题入口分享。
2. 测试结果页分享。
3. `heart-persona-share` 等二次分享页，禁止无条件回退到无邀请码的 `sharePath()`。
4. 朋友圈分享：`buildSafeTimelineShare()` 需要传入从路径中提取出的 query。
5. 所有分享入口在邀请码未准备好时保持门控，不生成无归因链接。

被邀请人打开链接后，由 `landing.ts` 缓存参数；登录/注册时将邀请码提交给现有 `wechatLogin/register/redeemInviteCode` 链路。

## 4. 数据模型

### 4.1 `referral_commissions`

每个有效订单最多一条，建议 `_id=commission_${source}_${orderId}`：

```js
{
  _id,
  source: 'recharge_order' | 'archetype_report_order',
  orderId,
  inviterUserId,
  inviteeUserId,
  productType: 'subscription' | 'recharge' | 'prop',
  paidAmountFen,
  commissionRateBps,
  commissionFen,
  status: 'pending' | 'available' | 'reversed' | 'blocked',
  availableAt,
  paidAt,
  refundedAt,
  ruleVersion,
  configSnapshot,
  transactionId,
  createdAt,
  updatedAt
}
```

### 4.2 `commission_accounts`

```js
{
  _id: inviterUserId,
  pendingFen,
  availableFen,
  withdrawnFen,
  reversedFen,
  totalEarnedFen,
  updatedAt
}
```

### 4.3 `commission_ledger`

记录入账、解冻、退款冲正、提现。每条流水使用固定 `businessId` 幂等，禁止以前端余额或流水列表计算账户余额。

## 5. 后台配置

在 `settings_subscription.referral` 下新增：

```js
commission: {
  enabled: false,
  payoutPaused: false,
  mode: 'all_orders', // all_orders | first_order
  rateBps: 1000,      // 10%
  settlementDays: 7,
  includeSubscription: true,
  includeRecharge: true,
  includeProp: true,
  maxCommissionFenPerOrder: 10000,
  maxCommissionFenPerInviterMonth: 100000,
  effectiveFrom: null,
  ruleVersion: 1
}
```

配置变更只影响新订单；佣金记录必须保存规则快照。`payoutPaused` 只暂停转可用/提现，不影响充值和订单发货。

后台新增：

- 分佣概览：邀请人数、付费好友数、订单实付额、待结算、可用、已提现。
- 分佣明细：订单、被邀请人脱敏信息、产品、实付金额、比例、佣金、状态。
- 异常处理：重试、冻结、撤销、人工补发、提现登记，并记录管理员和原因。

## 6. 结算流程

```text
支付成功并完成原业务发货
  -> 写入佣金任务/事件（不阻塞用户主链路）
  -> worker 按订单来源处理
  -> 校验 referral_claims 与分佣配置
  -> 事务创建 referral_commissions + commission_ledger + 更新 commission_accounts
  -> 7 天后解冻为 available
  -> 退款：pending 取消，available 生成负向冲正
```

`recharge_orders` 在 `_shared/payment-fulfillment.js` 成功后触发；`archetype_report_orders` 在 `fulfillReportOrder()` 变为 `fulfilled` 后触发。两条链路最终调用同一个共享的 `createCommissionForPaidOrder()`，但保留各自的订单校验和退款入口。

## 7. 用户端

新增“我的邀请”页面：

- Hero 显示可用佣金。
- 三个指标：累计邀请、已充值好友、累计奖励。
- “立即邀请”主按钮，邀请码未就绪时不可分享并给出明确状态。
- Tab：邀请好友、奖励明细。
- 明细状态展示：待结算、已到账、已撤销。
- 金额统一显示元，服务端传分；好友昵称和头像脱敏。

## 8. 开发阶段

### P0：账务与归因

- 增加三个集合及索引。
- 实现两条支付链路的佣金事件接入。
- 实现固定 ID 幂等、事务、冻结、退款冲正。
- 补齐测试题、结果页、二次分享、朋友圈邀请码参数。

### P1：查询与运营

- 新增用户端 `getMyReferralCommission`、`listMyReferralCommission`。
- 新增后台概览、明细、异常处理、提现登记。
- 增加产品渠道和首次/全量订单开关。

### P2：灰度与提现

- 灰度开启并核对三类订单。
- 增加月度上限、风险账户冻结。
- 根据业务量接入自动提现。

## 9. 验收与测试

- 同一订单重复支付回调、主动查单、worker 重试只产生一条佣金。
- 套餐、加油包、道具各完成一笔支付，均能生成正确佣金。
- 无邀请关系、自邀、失效邀请码不产生佣金。
- 冻结期内退款和冻结期后退款均能正确冲正，账户余额不出现负数异常。
- 修改后台比例不影响已生成记录。
- 所有测试分享入口解析后都能看到 `inviteCode`，朋友圈和二次分享不能丢失。
- 用户端统计与佣金流水、后台统计三方一致。

## 10. 可直接开发的文件级任务

### 10.1 后端共享模块

新增 `cloudfunctions/_shared/referral-commission.js`，只负责佣金领域逻辑，导出：

```js
getCommissionConfig(db)
normalizeCommissionConfig(input)
enqueueCommissionJob(db, payload)
processDueCommissionJobs(db, options)
processOneCommissionJob(db, job, options)
createCommissionForPaidOrder(db, job, options)
releaseDueCommissions(db, options)
reverseCommissionForRefund(db, payload, options)
getUserCommissionSummary(db, userId)
listUserCommissionLedger(db, userId, options)
```

不要在该模块内调用微信、AI 或前端 API。所有金额使用整数分；`rateBps` 的计算公式为：

```js
commissionFen = Math.floor(paidAmountFen * rateBps / 10000)
```

### 10.2 充值/套餐接入

修改 `cloudfunctions/_shared/payment-fulfillment.js`：

1. 保持现有充值发货和套餐发货逻辑不变。
2. `fulfillmentStatus` 更新为 `succeeded` 后调用：

```js
await enqueueCommissionJob(db, {
  source: 'recharge_order',
  orderId: orderId,
  orderType: order.productType,
  transactionId
})
```

3. 入队失败只记录日志，不回滚用户已获得的充值/套餐权益；worker 通过扫描 `paid + fulfillmentStatus=succeeded` 且缺少 job 的订单补建任务。
4. 在 `cloudfunctions/recharge/index.js` 的 `confirmPayment`、`queryOrder`、支付回调路径中均依赖 `fulfillPayment`，禁止重复添加佣金代码。

### 10.3 道具接入

修改 `cloudfunctions/archetypeReportPayment/_shared/archetype-report-access.js` 的 `fulfillReportOrder()`：

1. 订单状态由 `fulfilling` 变为 `fulfilled` 的同一事务内，创建或确认 `referral_commission_jobs` 文档。
2. 佣金任务只保存 `source=archetype_report_order`、`orderId`、`actualPriceFen`、`paidAt`、`transactionId`，不直接更新邀请人余额。
3. 对重复支付、重复解锁、退款任务保持现有行为；重复订单只允许一条佣金任务。
4. `archetype_report_orders.status` 必须为 `fulfilled` 才可分佣，`paid`、`closed`、`exception` 均不可分佣。

### 10.4 定时 worker

修改 `cloudfunctions/processReferralJobs/index.js`，在现有邀请奖励处理之后增加两个阶段：

```text
recoverCommissionJobs()       // 从已完成订单补建缺失任务
processDueCommissionJobs()    // pending/retry 任务结算
releaseDueCommissions()       // availableAt <= now 的佣金解冻
```

建议单次上限：恢复任务 50 条、处理任务 20 条、解冻 100 条；每个 job 使用 `leaseOwner/leaseUntil`，租约过期后可重试。错误使用 `attempts` 和指数退避，超过 8 次进入 `needs_review`，不能静默丢弃。

### 10.5 用户端云函数与 API

新增 `cloudfunctions/referralCommission/index.js`，支持：

| action | 入参 | 返回 |
|---|---|---|
| `getSummary` | 无 | `summary`、`configText` |
| `listLedger` | `cursor?`、`limit?`、`status?` | `items`、`nextCursor` |
| `listInvitees` | `cursor?`、`limit?`、`paidOnly?` | 脱敏邀请人列表、`nextCursor` |

所有 action 通过 `requireAuthenticatedUserId` 获取当前用户，不接受客户端传入的 `userId`。

在 `src/utils/api.ts` 增加：

```ts
getMyReferralCommissionSummary()
listMyReferralCommissionLedger(params?: { cursor?: string; limit?: number; status?: string })
listMyReferralInvitees(params?: { cursor?: string; limit?: number; paidOnly?: boolean })
```

响应固定为 `{ success, message?, ...data }`；空数据返回空数组和 `nextCursor=null`，不要让前端处理 null 集合。

### 10.6 用户页面

新增 `src/pages/referral/referral.vue`，并在 `pages.json` 注册。页面加载顺序：

1. 先显示骨架占位。
2. 并行请求 summary、invitees、ledger 首页。
3. 任何单个列表失败只显示该区块错误，不阻塞其它区块。
4. 下拉刷新清空 cursor 后重新请求；列表触底使用 cursor 分页。

在 `src/pages/me/me.vue` 增加入口，入口显示 `availableFen` 转元后的金额，不读取本地缓存作为财务数据。

### 10.7 后台 action 与 API

扩展 `cloudfunctions/adminManage/index.js`：

| action | 权限 | 说明 |
|---|---|---|
| `getReferralCommissionConfig` | admin | 读取配置 |
| `updateReferralCommissionConfig` | admin | 校验范围后更新配置并递增 `ruleVersion` |
| `listReferralCommissions` | admin | 按状态、产品、日期、用户分页 |
| `getReferralCommissionOverview` | admin | 聚合概览 |
| `retryReferralCommissionJob` | admin | 仅允许 `retry/needs_review` |
| `reverseReferralCommission` | admin | 必须提供 `confirmText` 和 reason |
| `markReferralCommissionWithdrawn` | admin | 记录打款凭证和金额 |

`updateReferralCommissionConfig` 校验：比例 `0..5000`、冻结天数 `0..30`、单笔上限和月上限为非负整数；不允许客户端写入 `ruleVersion`。

在 `src/utils/api.ts` 增加同名 admin helper，并在现有后台邀请奖励页面增加“充值分佣” Tab，不新建第二套管理员鉴权。

## 11. 数据库索引与初始化

在 `cloudfunctions/initDb` 或现有索引初始化脚本中增加：

```text
referral_commission_jobs: status + nextRunAt
referral_commission_jobs: leaseUntil
referral_commissions: inviterUserId + createdAt
referral_commissions: inviterUserId + status + createdAt
referral_commissions: inviteeUserId + status
referral_commissions: source + orderId
commission_ledger: userId + createdAt
commission_ledger: userId + businessId
```

若环境不支持唯一索引，必须依赖固定文档 `_id` 和事务内再次读取实现幂等；不能只用查询后 add。

## 12. 任务状态机

`referral_commission_jobs`：

```text
pending -> processing(lease) -> succeeded
pending -> retry -> processing
retry -> needs_review       // attempts > 8
```

`referral_commissions`：

```text
pending -> available
pending -> reversed         // 冻结期内退款
available -> reversed       // 解冻后退款，写负向流水
pending/available -> blocked // 风控或人工冻结
```

禁止使用持久化 `processing` 作为最终状态；worker 崩溃依靠 `leaseUntil` 恢复。

## 13. 核心伪代码

```js
async function createCommissionForPaidOrder(db, job) {
  const config = await getCommissionConfig(db)
  if (!config.enabled || !isIncluded(config, job.orderType)) return reject('DISABLED_OR_EXCLUDED')

  const claim = await getRewardedClaimByInvitee(db, job.inviteeUserId)
  if (!claim || !claim.inviterUserId || claim.inviterUserId === job.inviteeUserId) return reject('NO_VALID_RELATION')

  const amountFen = getVerifiedPaidAmount(job) // recharge_orders.amountFen / report.actualPriceFen
  const commissionFen = Math.floor(amountFen * config.rateBps / 10000)
  if (commissionFen <= 0) return reject('ZERO_COMMISSION')

  return db.runTransaction(async (tx) => {
    const existing = await tx.collection('referral_commissions').doc(job.commissionId).get()
    if (existing) return { duplicate: true }
    if (config.mode === 'first_order') await lockFirstCommissionOnClaim(tx, claim, job)
    await tx.collection('referral_commissions').doc(job.commissionId).set(buildCommission(job, config, commissionFen))
    await tx.collection('commission_ledger').doc(`ledger_${job.commissionId}`).set(buildPendingLedger(job, commissionFen))
    await incrementCommissionAccount(tx, claim.inviterUserId, commissionFen)
    return { created: true }
  })
}
```

事务内只允许固定文档读写，不做 where 查询、外部请求、循环扫描或 AI 调用。

## 14. 测试清单（DeepSeek 实现后必须执行）

### 单元测试

- 金额计算：1 分、99 分、1990 分、上限金额、比例 0/5000。
- `_id` 幂等：同 job 并发执行只一条 commission 和 ledger。
- 首次充值模式：同一 invitee 的第二笔订单不分佣。
- 退款状态转换和负向流水。
- 配置快照和规则版本。

### 集成测试

- `recharge_orders + recharge` 成功发货后生成佣金。
- `recharge_orders + subscription` 成功发货后生成佣金。
- `archetype_report_orders + fulfilled` 后生成佣金。
- `paid` 但未 fulfilled、`closed`、`exception` 不生成佣金。
- 回调、主动查单、worker 重试三路并发不重复。

### 分享归因测试

- 测试题入口好友分享包含邀请码。
- 测试结果页好友分享包含邀请码。
- `heart-persona-share` 二次分享包含邀请码且无 fallback 丢参。
- 朋友圈分享 query 包含邀请码。
- 邀请码未就绪时分享入口被门控。
- 被邀请人打开、登录、注册后 `referral_claims` 正确绑定。

### 验收命令

```powershell
npm.cmd run test:referral
npm.cmd run test:regression
npm.cmd run build:mp-weixin
```

部署前必须先在测试环境打开 `commission.enabled=false` 验证数据链路，再改为 true 做小额真实支付灰度。

## 15. `referral_commission_jobs` 完整字段

```js
{
  _id: `job_${source}_${orderId}`,
  source: 'recharge_order' | 'archetype_report_order',
  orderId,
  orderType: 'recharge' | 'subscription' | 'prop',
  userId: inviteeUserId,
  inviteeUserId,
  paidAmountFen: 0,
  paidAt: null,
  transactionId: '',
  commissionId: `commission_${source}_${orderId}`,
  status: 'pending',
  statusReason: '',
  attempts: 0,
  nextRunAt: now,
  leaseOwner: '',
  leaseUntil: null,
  lastErrorCode: '',
  lastErrorMessage: '',
  createdAt: now,
  updatedAt: now
}
```

任务金额是支付成功时的服务端快照，worker 不读取前端传入的金额。恢复任务时：

- `recharge_order` 读取 `recharge_orders.amountFen`，且要求 `status=paid`、`fulfillmentStatus=succeeded`。
- `archetype_report_order` 读取 `archetype_report_orders.actualPriceFen`，且要求 `status=fulfilled`。
- 缺少金额、金额小于等于 0、订单用户不一致时进入 `needs_review`，不能猜测价格。

## 16. 关系和首次付费判定

`getRewardedClaimByInvitee()` 只能读取 `_id=inviteeUserId` 的 `referral_claims`，接受状态：`rewarded`、`manual_resolved`。`pending_relation`、`waiting_first_event`、`retry` 不代表关系已完成，不分佣。

`mode=first_order` 时，在同一事务内读取 claim 并更新：

```js
commissionFirstOrderId: orderId,
commissionFirstPaidAt: paidAt
```

只有字段为空时允许继续；已经写入其它订单 ID 时返回 `FIRST_ORDER_ALREADY_SETTLED`。这两个字段不得由普通用户接口修改。

## 17. 用户接口响应样例

`getSummary`：

```json
{
  "success": true,
  "summary": {
    "inviteCount": 12,
    "paidInviteCount": 5,
    "totalEarnedFen": 3980,
    "pendingFen": 1200,
    "availableFen": 2780,
    "withdrawnFen": 0,
    "reversedFen": 0
  },
  "rule": {
    "enabled": true,
    "rateBps": 1000,
    "rateText": "10%",
    "settlementDays": 7,
    "mode": "all_orders"
  }
}
```

`listLedger` 每项至少返回：`id`、`productLabel`、`paidAmountFen`、`commissionFen`、`status`、`statusText`、`availableAt`、`createdAt`。不要返回被邀请人的邮箱、openid 或完整用户 ID。

## 18. 开发执行顺序

DeepSeek 必须按以下顺序提交，每一步通过测试后再进入下一步：

1. **只读勘察**：阅读 `AGENTS.md`、本方案、`referral-settlement.js`、`payment-fulfillment.js`、`archetype-report-access.js`、`processReferralJobs/index.js`，列出实际导出函数和数据库 API 差异。
2. **共享模块与测试**：先实现金额、配置、状态机、固定 ID 幂等测试，不接支付入口。
3. **充值/套餐接入**：接入 `fulfillPayment`，补 `recharge` 和 `subscription` 两类集成测试。
4. **道具接入**：接入 `fulfillReportOrder`，验证报告解锁和退款任务不被破坏。
5. **worker 恢复能力**：实现缺失 job 扫描、租约、退避和解冻。
6. **用户查询接口**：实现用户云函数、`api.ts` 封装和脱敏响应。
7. **后台接口**：实现配置、查询、重试、撤销、提现登��� action，并补管理员鉴权测试。
8. **用户页面**：新增页面、入口、加载/空态/失败/分页状态，遵循 `AGENTS.md` 的 Campus Pop Token。
9. **分享参数修复**：逐个修改分享入口并加 URL 参数测试，特别检查 `|| sharePath()` 和空 `buildSafeTimelineShare()`。
10. **灰度部署**：先关闭配置部署，再开启测试环境，最后小比例生产灰度。

每一步的提交应保持可回滚；不得把未完成的佣金逻辑直接合并进生产支付回调。

## 19. 不允许的实现方式

- 不在前端计算佣金或提交 `inviterUserId`。
- 不在支付回调里直接 `users.balance += commission`。
- 不复用 `call_usage_records` 作为现金佣金流水。
- 不通过 `users.referralCount` 推断付费人数或佣金额。
- 不用“查询不存在后 add”代替固定 ID/事务幂等。
- 不因佣金入队失败而回滚已完成的充值、套餐或道具权益。
- 不修改现有 `referral_claims` 的一次性邀请奖励金额和结算状态含义。

## 20. 回滚方案

1. 将 `settings_subscription.referral.commission.enabled` 设为 `false`，停止新佣金创建。
2. 保留已经生成的 commission/job/ledger 数据，不删除、不重算。
3. 充值、套餐、道具原业务继续正常发货。
4. 如发现重复或错误佣金，只能通过 `reverseReferralCommission` 生成冲正流水，禁止直接改余额。
5. 修复后从 `referral_commission_jobs.status in (retry, needs_review)` 继续处理。
