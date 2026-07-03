# 微信小程序虚拟支付迁移方案

## Context

微信要求小程序内虚拟商品（Token 充值、套餐订阅）必须接入官方「小程序虚拟支付」能力。当前项目使用普通微信支付 V3（JSAPI），需要迁移。

**关键截止**：2026 年 4 月 1 日起全终端强制合规。

---

## 一、现状 vs 目标

| | 当前（微信支付 V3） | 目标（虚拟支付） |
|---|---|---|
| 商户体系 | 普通商户号（mchid） | 虚拟支付专用 OfferID |
| 签名密钥 | 商户 APIv3 Key + 私钥 | AppKey（HMAC-SHA256） |
| 前端调起 | `wx.requestPayment` | `uni.requestVirtualPayment` |
| 下单接口 | `/v3/pay/transactions/jsapi` | `/xpay/*` 系列 |
| 回调 | `WXPAY_NOTIFY_URL` | 虚拟支付发货回调 URL |
| 费率 | ~0.6% | 安卓~1% / iOS 12% |

---

## 二、迁移步骤

### 第 1 步：开通虚拟支付商户

在小程序后台 `mp.weixin.qq.com` → 支付与交易 → 虚拟支付：
1. 签署虚拟支付协议
2. 获取 **OfferID**（支付应用 ID）和 **AppKey**
3. 配置代币比例（推荐 1元=100代币，与现有 Token 体系 1:1 映射）
4. 配置发货回调 URL（必须 HTTPS）：`https://你的域名/cloudfunctions/recharge/virtualPaymentCallback`
5. 开启 iOS 支付开关

### 第 2 步：服务端改造

**删/改**：
- `cloudfunctions/recharge/_shared/wxpay-v3.js` → 大部分废弃（保留 `queryOrderByOutTradeNo` 用于过渡期查单）
- `cloudfunctions/recharge/index.js` → 新增虚拟支付 action

**新增云函数 action**：

```javascript
// action: createVirtualPayOrder — 创建虚拟支付订单
async function createVirtualPayOrder(event) {
  const userId = await requireAuthenticatedUserId(app, event)
  const productType = String(event.productType || '').trim()
  // ... 计算金额 ...

  const outTradeNo = `VP${Date.now()}${Math.random().toString(36).slice(2,8)}`
  const offerId = process.env.VIRTUAL_PAY_OFFER_ID
  const appKey = process.env.VIRTUAL_PAY_APP_KEY

  // 构建 signData（微信虚拟支付要求的参数）
  const signData = {
    offer_id: offerId,
    out_trade_no: outTradeNo,
    buy_quantity: 1,
    currency_type: 'CNY',
    env: isSandbox ? 1 : 0,
    attach: JSON.stringify({ userId, productType, planId: event.productId })
  }
  // 道具直购模式需额外传 product_id 和 goods_price
  if (productType === 'subscription') {
    signData.product_id = event.productId  // 在微信后台配置的道具 ID
    signData.goods_price = amountFen       // 单位：分
  }

  // 计算签名
  const signDataStr = Object.keys(signData).sort().map(k => `${k}=${signData[k]}`).join('&')
  const paySig = crypto.createHmac('sha256', appKey)
    .update(`requestVirtualPayment&${signDataStr}`).digest('hex')
  
  // 用户态签名（用 session_key）
  const sessionKey = await getSessionKey(userId)
  const signature = crypto.createHmac('sha256', sessionKey)
    .update(signDataStr).digest('hex')

  // 保存订单到 DB
  const order = {
    userId, outTradeNo, productType,
    amountFen, amountYuan, grantTokens,
    status: 'pending', createdAt: new Date()
  }
  await db.collection('virtual_pay_orders').add(order)

  return {
    success: true,
    offerId, paySig, signature,
    signData: signDataStr,
    outTradeNo, mode: productType === 'recharge' ? 'short_series_coin' : 'short_series_goods'
  }
}

// action: virtualPaymentCallback — HTTP 触发器，接收微信发货通知
async function virtualPaymentCallback(event) {
  // 1. 验签
  // 2. 根据 outTradeNo 更新订单状态
  // 3. 调用 fulfillPayment 发货
}
```

### 第 3 步：前端改造

**使用 `uni.requestVirtualPayment`**：

`src/pages/token-recharge/token-recharge.vue` 和 `src/pages/subscription/subscription.vue`：

```javascript
// 替换原来的 wx.requestPayment 流程
async function doVirtualPay(productType, productId) {
  // 1. 调用云函数获取签名
  const res = await callFunction({
    name: 'recharge',
    data: {
      action: 'createVirtualPayOrder',
      productType,
      productId,
      planKey,      // subscription 时
      billingCycle  // subscription 时
    }
  })
  if (!res.result?.success) {
    showError(res.result?.message || '创建订单失败')
    return
  }

  const { offerId, paySig, signature, signData, outTradeNo, mode } = res.result

  // 2. 调起虚拟支付
  uni.requestVirtualPayment({
    mode,             // 'short_series_coin' | 'short_series_goods'
    paySig,
    signature,
    signData: {
      offerId,
      buyQuantity: 1,
      env: 0,         // 0=正式, 1=沙箱
      currencyType: 'CNY',
      outTradeNo,
      attach: JSON.stringify({ userId: getCurrentUserId() }),
      // 道具模式额外参数
      ...(mode === 'short_series_goods' ? {
        productId: res.result.productId,
        goodsPrice: res.result.amountFen
      } : {})
    },
    success: async (payRes) => {
      // 3. 支付成功 → 轮询确认发货
      await pollFulfillment(outTradeNo)
      showSuccess('支付成功')
      loadData()
    },
    fail: (err) => {
      if (err.errCode === -1) return  // 用户取消
      showError('支付失败: ' + (err.errMsg || '未知错误'))
    }
  })
}
```

### 第 4 步：过渡期兼容

保留旧的 `wx.requestPayment` 路径 30 天作为回退，通过环境变量 `USE_VIRTUAL_PAY=true` 切换。

### 第 5 步：数据库变更

新增集合 `virtual_pay_orders`：
```
{
  _id, userId, outTradeNo, productType,
  amountFen, amountYuan, grantTokens,
  status: 'pending'|'paid'|'refunded',
  fulfillmentStatus: 'pending'|'succeeded'|'failed',
  transactionId, // 微信返回的交易单号
  createdAt, updatedAt
}
```

---

## 三、关键差异对照

| 操作 | 旧（微信支付 V3） | 新（虚拟支付） |
|------|-------------------|---------------|
| 前端调起 | `wx.requestPayment({ timeStamp, nonceStr, package, signType, paySign })` | `uni.requestVirtualPayment({ mode, paySig, signature, signData })` |
| 服务端签名 | RSA-SHA256 商户私钥签名 | HMAC-SHA256 用 AppKey 签名 |
| 下单 | `POST /v3/pay/transactions/jsapi` | 虚拟支付模式下**无需服务端下单**，只需生成签名 |
| 查单 | `GET /v3/pay/transactions/out-trade-no/{out_trade_no}` | `POST /xpay/query_order` |
| 回调验签 | Wechatpay-Signature + 证书 | AppKey HMAC 校验 |
| 退款 | `POST /v3/refund/domestic/refunds` | `POST /xpay/refund_order` |

## 四、费用影响

| | 旧费率 | 新费率 |
|---|---|---|
| 安卓/鸿蒙 | ~0.6% | ~1% |
| iOS | ~0.6% | 12%（苹果抽成） |
| 结算周期 | T+7 | T+3 |

**提价建议**：iOS 端 Token 价格上调 ~12% 以覆盖苹果抽成，或统一提价后安卓端给折扣。

## 五、风险

1. **代币比例不可逆**：发布后无法修改。建议 1元=100代币（与现有 Token 体系对齐）
2. **沙箱环境独立**：`env=1` 时使用的道具/代币与正式环境是两套，测试时需在后台分别配置
3. **回调可能延迟**：虚拟支付回调有最多 30 分钟延迟，前端需加轮询兜底
4. **iOS 审核**：苹果对虚拟商品定价有审核要求
5. **旧订单处理**：迁移前已创建但未支付的普通支付订单需手动处理或过期作废
