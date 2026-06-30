# 微信小程序支付链路审计报告

审计日期：2026-06-27
审计范围：「我」页面 → Token 卡片 → 「买加油包」「升级套餐」两个支付入口
审计结论：**存在确认 Bug，提示「支付处理中，稍后自动生效/到账」是设计缺陷导致的常态表现，不是偶发**

---

## 一、支付链路全景

两个入口（`买加油包` / `升级套餐`）走的是同一套支付架构，只是 `productType` 不同：

| 入口 | 前端文件 | productType | 轮询窗口 |
|---|---|---|---|
| 买加油包 | `src/pages/token-recharge/token-recharge.vue` | `recharge` | 5 次 ≈ 4.8s |
| 升级套餐 | `src/pages/subscription/subscription.vue` | `subscription` | 8 次 ≈ 11.7s |

### 前端 5 步流程（两个页面几乎逐行一致）

```text
1. createPaymentOrder()        → 云函数 recharge / action=createPaymentOrder
                                  服务端查配置算价，写 recharge_orders 表（status=pending）
                                  ⚠️ 不调用微信支付统一下单 API

2. wx.cloud.callHTTPFunction() → 集成中心模板 CrushRadar-uty6nxqu-demo-scfweb
   path: /wx-pay/wxpay_order      传 {out_trade_no, amount.total, description}
                                  返回 {timeStamp, nonceStr, paySign, package}

3. wx.requestPayment()         → 唤起微信支付
                                  success 回调 = 用户已付款的同步信号

4. waitForPaidOrder()          → 循环 N 次调用 queryPaymentOrder({orderNo})

5. 状态判断
   ├─ 某次返回 status==='paid' → 显示「支付成功！已充值/升级」
   └─ N 次都没查到 paid       → 显示「支付处理中，稍后自动生效/到账」← 你看到的就是这条
```

### 云函数侧 3 个关键入口（`cloudfunctions/recharge/index.js`）

| action | 作用 | 是否调用微信支付 API |
|---|---|---|
| `createPaymentOrder` | 写本地订单（pending） | ❌ 不调用 |
| `queryPaymentOrder` | 查本地订单状态 | ❌ **不调用微信查单 API**（核心 Bug） |
| `paymentCallback` | 处理微信异步回调，改 paid + 发货 | 由集成中心触发 |

---

## 二、核心 Bug：`queryPaymentOrder` 只查本地库，从不主动查微信支付

### 代码定位

`cloudfunctions/recharge/index.js` 第 302-323 行：

```js
async function queryPaymentOrder(event) {
  const userId = await requireAuthenticatedUserId(app, event)
  // ...查出 order...
  if (!order) return { success: false, message: '订单不存在' }

  if (order.status === 'paid' && ['recharge', 'subscription'].includes(order.productType)) {
    order = await fulfillPayment(db, order, order.transactionId || `query:${userId}`)
  }
  return { success: true, order }
}
```

### 问题分析

订单状态从 `pending` → `paid` **只能由 `paymentCallback` 触发**，而 `paymentCallback` 依赖微信支付服务器的异步回调（notify）。

但微信支付异步回调有这些特性：
- **延迟通常 3-15 秒**，高峰期更久
- **可能失败、丢失、重试**
- 不是实时的

而前端的轮询窗口只有 **4.8s（加油包）/ 11.7s（升级套餐）**。一旦异步回调在窗口外到达，前端必然显示「支付处理中」。

更要命的是：**`queryPaymentOrder` 看到订单 `pending` 时什么都不做**，既不主动查微信支付，也不触发发货。它只是在「订单已经是 paid」时做一次冗余的 `fulfillPayment`（此时 `paymentCallback` 早发货过了，靠幂等保护兜底）。

**真正需要发货的场景（用户已付款、本地还是 pending）反而被忽略了。**

### 正确做法

`queryPaymentOrder` 在订单 `pending` 时，应主动调用微信支付查单 API（集成中心模板的 `/wx-pay/wxpay_query` 之类路径，传 `out_trade_no`），若微信侧返回已支付，则本地同步状态 + 调用 `fulfillPayment` 发货。

伪代码：

```js
if (order.status === 'pending') {
  // 主动查微信支付
  const wxResult = await callHTTPFunction({ path: '/wx-pay/wxpay_query', data: { out_trade_no: order.orderNo } })
  if (wxResult.trade_state === 'SUCCESS') {
    // 本地同步：发货 + 改 paid
    order = await fulfillPayment(db, order, wxResult.transaction_id)
  }
}
```

---

## 三、最大嫌疑：集成中心回调可能未正确配置/未到达

`paymentCallback` 的触发条件：

```js
// recharge/index.js 第 365 行
if (event.event_type === 'TRANSACTION.SUCCESS' && event.resource) {
  return await paymentCallback(event)
}
```

这要求 CloudBase 集成中心把微信支付的 `TRANSACTION.SUCCESS` 事件路由到 `recharge` 云函数。这个路由配置**在 CloudBase 控制台的集成中心里，不在代码仓库里**，无法从代码侧确认。

**如果集成中心回调未配置 / 路径错 / 函数名错 / 签名失败**，那么：
- `paymentCallback` 永远不会被触发
- 订单状态永远停留在 `pending`
- 前端永远显示「支付处理中，稍后自动生效」

这与用户描述的「两个功能都提示支付处理中」高度吻合。**这是必须第一时间去控制台排查的点。**

排查方法：
1. 登录 CloudBase 控制台 → 环境 `cloud1-d0gvhqu2c8a2b61fd` → 集成中心 → 微信支付
2. 确认 notify 回调目标函数是 `recharge`
3. 确认事件类型是 `TRANSACTION.SUCCESS`
4. 在「日志」里搜 `recharge` 云函数，过滤 `event_type` 字段，看有没有回调进来
5. 数据库 `recharge_orders` 表里有没有任何 `status: paid` 的记录（如果一条都没有，回调几乎肯定没通）

---

## 四、其他发现

### 4.1 退款字段 Bug（已修复，复核确认）

`payment-fulfillment.js` 第 4 行使用 `order.grantTokens`，与 6 月 26 日工作总结说的修复一致。✅

### 4.2 `queryPaymentOrder` 发货逻辑本末倒置

```js
// 只有 status==='paid' 才发货，但 paid 说明已经发过了
if (order.status === 'paid' && ...) {
  order = await fulfillPayment(...)
}
```

逻辑反了。应该是「pending 但微信侧已支付」时发货。当前逻辑只是靠幂等兜底重复发货，没有解决核心问题。

### 4.3 `fulfillPayment` 缺少事务保护

`payment-fulfillment.js` 第 65-104 行：先查订单状态，再发货，再 update 状态。并发场景（用户疯狂点 + 回调同时到达 + 查单同时触发）下靠幂等兜底，但 `fulfillSubscription` 更新 `users.plan` 和 `planExpiresAt` 时没有乐观锁，并发下可能时序错乱。

### 4.4 金额信任链不完整

前端把服务端返回的 `result.order.amountFen` 转手传给集成中心下单：

```js
// token-recharge.vue 第 132 行
data: {
  description: result.order.productName,
  out_trade_no: result.order.orderNo,
  amount: { total: result.order.amountFen, currency: 'CNY' }
}
```

服务端虽然算价写库了，但下单金额实际是前端转交的。若集成中心模板直接信任 `amount.total` 而不回查订单，存在中间人篡改风险。建议集成中心侧按 `out_trade_no` 回查 `recharge_orders.amountFen`。

### 4.5 轮询窗口偏短

- 加油包：`800ms + 1s×4 = 4.8s`
- 升级套餐：`1200ms + 1.5s×7 = 11.7s`

微信支付回调 3-15s 延迟很常见，加油包的 4.8s 几乎注定超时。即便回调正常，加油包也大概率显示「支付处理中」。

### 4.6 `openid` 未校验归属

`createPaymentOrder` 接收前端传的 `event.openid`，没有校验是否是当前登录用户的 openid。影响有限（微信支付会校验 openid 与小程序绑定），但建议服务端从微信上下文取。

### 4.7 环境硬编码

```js
// token-recharge.vue 第 125 行
config: { env: 'cloud1-d0gvhqu2c8a2b61fd' },
```

`subscription.vue` 第 289 行同样硬编码。建议提取到配置文件。

---

## 五、修复优先级

### P0（上架前必须修复）

1. **排查集成中心回调配置**（第三节）
   - 这是「支付处理中」的最大嫌疑，必须先确认回调链路是否打通
   - 检查 `recharge_orders` 表是否有 `status: paid` 记录

2. **`queryPaymentOrder` 增加主动查微信支付逻辑**（第二节）
   - 订单 `pending` 时调用集成中心查单 API
   - 微信侧已支付则本地同步发货
   - 这是根治「支付处理中」提示的方案

### P1（强烈建议）

3. **前端轮询优化**
   - 加油包轮询次数 5 → 10，窗口 4.8s → 12s
   - 或在 `wx.requestPayment` success 后立即主动查单一次

4. **`queryPaymentOrder` 发货逻辑修正**
   - 改为「pending + 微信侧已支付」时发货
   - 而不是「paid 时冗余发货」

5. **`fulfillPayment` 加事务/乐观锁**
   - 防并发重复发货

### P2（加固）

6. 金额服务端回查（集成中心侧）
7. `openid` 服务端校验
8. `env` 提取为配置
9. 前端提示文案统一（一个写「到账」一个写「生效」）

---

## 六、给非技术同学的总结

**为什么会出现「支付处理中」？**

用户付完钱后，微信不会立刻告诉我们的服务器「这个订单付了」。它走的是异步通知，可能有几秒到十几秒延迟，偶尔还会丢。

我们的代码在用户付完钱后，只等了 5 秒（加油包）/ 12 秒（升级套餐）就放弃了，而且**这 5-12 秒里只是傻傻地查自己的数据库**，从不去主动问微信「这笔订单到底付了没」。

如果微信的异步通知没在这 5-12 秒内到达，就会显示「支付处理中」。

**更严重的可能性**：如果 CloudBase 集成中心的微信支付回调根本没配好，那么微信的通知永远到不了我们的服务器，订单永远是 pending，前端永远显示「支付处理中」。这个必须去控制台确认。

**修复方向**：付完钱后主动问微信查单，查到已支付就立刻发货，不再依赖异步通知。同时去控制台确认回调链路打通。
