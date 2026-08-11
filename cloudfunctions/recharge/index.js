const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')
const { ensureBillingSettings } = require('./_shared/billing')
const { fulfillPayment } = require('./_shared/payment-fulfillment')
const { createJsapiOrder, createPayParams, queryOrderByOutTradeNo,
  verifyCallbackSignature, decryptResource } = require('./_shared/wxpay-v3')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()

const RECHARGE_ORDERS = 'recharge_orders'
const ENABLE_LEGACY_PAY_CALLBACK = String(process.env.ENABLE_LEGACY_PAY_CALLBACK || '').toLowerCase() === 'true'

function isPayDebug() {
  return String(process.env.PAY_DEBUG || '').trim() === 'true'
}
function payLog(...args) {
  if (isPayDebug()) console.log(...args)
}

// 管理员的 ADMIN_EMAILS 环境变量（与 adminManage 保持一致）
function normalizeList(val) {
  if (typeof val === 'string') return val.split(',').map(v => v.trim().toLowerCase()).filter(Boolean)
  if (Array.isArray(val)) return val.map(v => String(v).trim().toLowerCase()).filter(Boolean)
  return []
}

async function requireAdmin(event) {
  const userId = await requireAuthenticatedUserId(app, event)
  const adminEmails = normalizeList(process.env.ADMIN_EMAILS)
  try {
    const { data } = await db.collection('users').doc(userId).get()
    const user = (data && data.length > 0) ? data[0] : null
    if (!user) {
      const err = new Error('ADMIN_REQUIRED')
      err.code = 'ADMIN_REQUIRED'
      throw err
    }
    if (user.isAdmin === true || user.role === 'admin') return { userId, user }
    if (user.email && adminEmails.includes(user.email.toLowerCase())) return { userId, user }
    const err = new Error('ADMIN_REQUIRED')
    err.code = 'ADMIN_REQUIRED'
    throw err
  } catch (e) {
    if (e.code === 'ADMIN_REQUIRED' || e.message === 'ADMIN_REQUIRED') throw e
    const err = new Error('ADMIN_REQUIRED')
    err.code = 'ADMIN_REQUIRED'
    throw err
  }
}

// action: getRechargePlans — 获取启用的充值档位（无需登录）
async function getRechargePlans(event) {
  const billing = await ensureBillingSettings(db)
  const tiers = (billing.rechargeTiers || []).filter(t => t.enabled !== false).map(t => ({
    id: t.id,
    name: t.name,
    priceFen: t.priceFen,
    amountYuan: (t.priceFen / 100).toFixed(2),
    grantTokens: t.grantTokens || Math.floor(t.priceFen / 100 * (billing.tokensPerYuan || 100000)) + (t.bonusTokens || 0),
    bonusTokens: t.bonusTokens || 0,
    grantCalls: t.grantTokens || t.grantCalls || 0,  // 兼容
    tagline: t.tagline || ''
  }))
  return { success: true, tiers, tokensPerYuan: billing.tokensPerYuan || 100000, useVirtualPay: billing.useVirtualPay === true }
}

// action: createRechargeOrder — 创建充值订单（pending 状态）
async function createRechargeOrder(event) {
  const userId = await requireAuthenticatedUserId(app, event)
  const billing = await ensureBillingSettings(db)
  const planId = String(event.planId || '').trim()
  if (!planId) return { success: false, message: '缺少 planId' }

  const tier = (billing.rechargeTiers || []).find(t => t.id === planId)
  if (!tier) return { success: false, message: '档位不存在' }
  if (tier.enabled === false) return { success: false, message: '该档位已下架' }

  const amountFen = Number(tier.priceFen) || 0
  const amountYuan = (amountFen / 100).toFixed(2)
  const grantTokens = tier.grantTokens || (Math.floor(amountFen / 100 * (billing.tokensPerYuan || 100000)) + (tier.bonusTokens || 0))
  const grantCalls = (tier.grantCalls || 0) + (tier.bonusCalls || 0)
  const now = new Date()

  const order = {
    userId,
    planId: tier.id,
    planName: tier.name,
    amountFen,
    amountYuan,
    grantTokens,
    bonusTokens: tier.bonusTokens || 0,
    grantCalls,
    bonusCalls: tier.bonusCalls || 0,
    status: 'pending',
    createdAt: now,
    updatedAt: now
  }
  const result = await db.collection(RECHARGE_ORDERS).add(order)
  order._id = result.id || result._id
  return { success: true, order }
}

// action: adminConfirmRecharge — 管理员确认充值到账（过渡方案，后续微信支付回调替代）
async function adminConfirmRecharge(event) {
  const { userId } = await requireAdmin(event)
  const orderId = String(event.orderId || '').trim()
  if (!orderId) return { success: false, message: '缺少 orderId' }

  const { data } = await db.collection(RECHARGE_ORDERS).doc(orderId).get()
  const order = (data && data.length > 0) ? data[0] : null
  if (!order) return { success: false, message: '订单不存在' }
  if (order.status !== 'pending') return { success: false, message: `订单状态为 "${order.status}"，无法确认` }

  const fulfilled = await fulfillPayment(db, {
    ...order,
    _id: orderId,
    productType: order.productType || 'recharge'
  }, `admin:${userId}`)

  return { success: true, order: fulfilled }
}

// action: createSubscriptionUpgrade — 创建套餐升级订单（过渡阶段 pending，后续接入微信支付）
async function createSubscriptionUpgrade(event) {
  const userId = await requireAuthenticatedUserId(app, event)
  const planKey = String(event.planKey || '').trim()
  const billingCycle = String(event.billingCycle || 'monthly').trim()
  const priceVariant = String(event.priceVariant || 'standard').trim()
  if (!planKey) return { success: false, message: '缺少 planKey' }
  if (!['pro', 'ultra'].includes(planKey)) return { success: false, message: '不支持的套餐类型' }
  if (!['monthly', 'annual'].includes(billingCycle)) return { success: false, message: '不支持的计费周期' }
  if (!['standard', 'student'].includes(priceVariant)) return { success: false, message: '不支持的价格类型' }

  const { getSubscriptionConfig } = require('./_shared/subscription')
  const config = await getSubscriptionConfig(db)
  const planConfig = config.plans[planKey]
  if (!planConfig) return { success: false, message: '套餐配置不存在' }

  // 检查用户当前套餐
  let user
  try {
    const { data } = await db.collection('users').doc(userId).get()
    if (!data || data.length === 0) return { success: false, message: '用户不存在' }
    user = data[0]
  } catch (_) {
    return { success: false, message: '查询用户失败' }
  }

  if (user.plan === planKey) return { success: false, message: `你当前已是 ${planConfig.name} 套餐，无需升级` }

  const toAmount = (value, fallback) => {
    const n = Number(value)
    if (Number.isFinite(n) && n >= 0) return n
    const f = Number(fallback)
    return Number.isFinite(f) && f >= 0 ? f : 0
  }
  const standardMonthly = toAmount(planConfig.priceYuan, 0)
  const standardAnnual = toAmount(planConfig.priceYuanAnnual, standardMonthly * 12)
  const studentMonthly = toAmount(planConfig.priceYuanStudent, standardMonthly)
  const studentAnnual = toAmount(planConfig.priceYuanStudentAnnual, standardAnnual || studentMonthly * 12)
  const amountYuan = priceVariant === 'student'
    ? (billingCycle === 'annual' ? studentAnnual : studentMonthly)
    : (billingCycle === 'annual' ? standardAnnual : standardMonthly)
  const priceLabel = `${priceVariant === 'student' ? '学生价' : '标准价'} · ${billingCycle === 'annual' ? '年付' : '月付'}`

  const now = new Date()
  const order = {
    userId,
    type: 'subscription_upgrade',
    planKey,
    planName: planConfig.name,
    fromPlan: user.plan || 'free',
    billingCycle,
    priceVariant,
    priceLabel,
    amountYuan,
    amountFen: Math.round(amountYuan * 100),
    status: 'pending',
    createdAt: now,
    updatedAt: now
  }
  const result = await db.collection(RECHARGE_ORDERS).add(order)
  order._id = result.id || result._id

  return {
    success: true,
    order,
    message: `已创建 ${planConfig.name} 升级订单，等待支付确认`
  }
}

// action: confirmPayment — 前端 wx.requestPayment 成功后的即时确认
// 必须通过微信 V3 查单验证支付真实发生，防止绕过客户端直接调用云函数
async function confirmPayment(event) {
  const userId = await requireAuthenticatedUserId(app, event)
  const orderNo = String(event.orderNo || '').trim()
  if (!orderNo) return { success: false, message: '缺少 orderNo' }

  const { data } = await db.collection(RECHARGE_ORDERS).where({ orderNo, userId }).limit(1).get()
  const order = (data && data.length > 0) ? data[0] : null
  payLog('[PAYDBG][confirm] orderNo=%s hit=%s status=%s', orderNo, !!order, order?.status)
  if (!order) return { success: false, message: '订单不存在' }
  // 已支付且已成功发货 → 直接返回（幂等）
  if (order.status === 'paid' && order.fulfillmentStatus === 'succeeded') {
    return { success: true, order, alreadyPaid: true }
  }
  // 已支付但发货失败/未完成 → 重新补偿发货
  if (order.status === 'paid') {
    payLog('[PAYDBG][confirm] 已支付但未完成发货 orderNo=%s fulfillmentStatus=%s → 重新补偿', orderNo, order.fulfillmentStatus)
    try {
      const fulfilled = await fulfillPayment(db, order, order.transactionId || 'repair')
      return { success: true, order: fulfilled }
    } catch (e) {
      return { success: false, message: '支付已完成，发货补偿失败：' + (e?.message || '未知错误') }
    }
  }
  if (order.status !== 'pending') return { success: false, message: `订单状态为 "${order.status}"，无法确认` }

  // 服务端微信 V3 查单验证支付真实发生（防止绕过客户端伪造请求）
  const wxResult = await queryOrderByOutTradeNo(orderNo)
  payLog('[PAYDBG][confirm] wxQuery result=%j', wxResult)
  if (wxResult && wxResult.trade_state === 'SUCCESS' && wxResult.transaction_id) {
    const fulfilled = await fulfillPayment(db, order, wxResult.transaction_id)
    payLog('[PAYDBG][confirm] fulfilled orderNo=%s productType=%s', orderNo, fulfilled.productType)
    return { success: true, order: fulfilled }
  }

  // 微信侧未确认支付 → 让前端走轮询兜底
  payLog('[PAYDBG][confirm] 微信侧未确认支付 orderNo=%s wxTradeState=%s', orderNo, wxResult?.trade_state)
  return { success: true, order, pendingVerification: true, message: '支付确认中，请稍候...' }
}

// action: unifiedOrder — 统一下单（一站式：创建DB订单 + 微信V3下单 + 生成支付参数）
// 替代旧的两段式: createPaymentOrder + callHTTPFunction 到集成中心模板
// 产品/价格全部服务端计算，不信任前端传价
async function unifiedOrder(event) {
  const userId = await requireAuthenticatedUserId(app, event)
  const productType = String(event.productType || '').trim()
  if (!productType) return { success: false, message: '缺少 productType' }

  // openid 仅从已认证用户的 DB 记录获取，不接受客户端传入
  let openid = ''
  try {
    const { data: userData } = await db.collection('users').doc(userId).get()
    openid = (userData && userData.length > 0) ? (userData[0].openid || '') : ''
  } catch (_) {}
  if (!openid) return { success: false, message: '缺少微信 openid，请在小程序中重试' }

  const appid = String(process.env.WXPAY_APPID || '').trim()
  const mchid = String(process.env.WXPAY_MCHID || '').trim()
  const notifyUrl = String(process.env.WXPAY_NOTIFY_URL || '').trim()
  if (!appid || !mchid || !notifyUrl) {
    return { success: false, message: '支付系统配置未完成（APPID/MCHID/NOTIFY_URL）' }
  }

  let order

  if (productType === 'recharge') {
    const billing = await ensureBillingSettings(db)
    const planId = String(event.productId || '').trim()
    if (!planId) return { success: false, message: '缺少 productId' }
    const tier = (billing.rechargeTiers || []).find(t => t.id === planId)
    if (!tier) return { success: false, message: '档位不存在' }
    if (tier.enabled === false) return { success: false, message: '该档位已下架' }

    const amountFen = Number(tier.priceFen) || 0
    const grantTokens = tier.grantTokens || (Math.floor(amountFen / 100 * (billing.tokensPerYuan || 100000)) + (tier.bonusTokens || 0))
    payLog('[PAYDBG][unifiedOrder] recharge tier=%s amountFen=%s grantTokens=%s', planId, amountFen, grantTokens)
    const now = new Date()
    order = {
      userId, openid,
      productType: 'recharge', planId: tier.id, planName: tier.name,
      productName: tier.name, amountFen, amountYuan: (amountFen / 100).toFixed(2),
      grantTokens, bonusTokens: tier.bonusTokens || 0,
      status: 'pending', createdAt: now, updatedAt: now
    }
  } else if (productType === 'subscription') {
    const { getSubscriptionConfig } = require('./_shared/subscription')
    const config = await getSubscriptionConfig(db)
    const planKey = String(event.planKey || '').trim()
    const billingCycle = String(event.billingCycle || 'monthly').trim()
    const priceVariant = String(event.priceVariant || 'standard').trim()
    if (!planKey) return { success: false, message: '缺少 planKey' }
    if (!['pro', 'ultra'].includes(planKey)) return { success: false, message: '不支持的套餐类型' }
    if (!['monthly', 'annual'].includes(billingCycle)) return { success: false, message: '不支持的计费周期' }
    if (!['standard', 'student'].includes(priceVariant)) return { success: false, message: '不支持的价格类型' }

    const planConfig = config.plans[planKey]
    if (!planConfig) return { success: false, message: '套餐配置不存在' }

    const toAmount = (value, fallback) => {
      const n = Number(value); if (Number.isFinite(n) && n > 0) return n
      const f = Number(fallback); return Number.isFinite(f) && f > 0 ? f : 0
    }
    const standardMonthly = toAmount(planConfig.priceYuan, 19)
    const standardAnnual = toAmount(planConfig.priceYuanAnnual, 168)
    const studentMonthly = toAmount(planConfig.priceYuanStudent, 12)
    const studentAnnual = toAmount(planConfig.priceYuanStudentAnnual, 99)
    const amountYuan = priceVariant === 'student'
      ? (billingCycle === 'annual' ? studentAnnual : studentMonthly)
      : (billingCycle === 'annual' ? standardAnnual : standardMonthly)

    if (!amountYuan || amountYuan <= 0) {
      return { success: false, message: `套餐 ${planConfig.name} 的价格未配置` }
    }

    const amountFen = Math.round(amountYuan * 100)
    const now = new Date()
    order = {
      userId, openid,
      productType: 'subscription', type: 'subscription_upgrade',
      planKey, planName: planConfig.name,
      productName: `${planConfig.name} · ${priceVariant === 'student' ? '学生' : '标准'} · ${billingCycle === 'annual' ? '年付' : '月付'}`,
      billingCycle, priceVariant,
      priceLabel: `${priceVariant === 'student' ? '学生价' : '标准价'} · ${billingCycle === 'annual' ? '年付' : '月付'}`,
      fromPlan: '', grantPlan: planKey,
      grantDurationDays: billingCycle === 'annual' ? 365 : 30,
      amountFen, amountYuan: amountYuan.toFixed(2),
      status: 'pending', createdAt: now, updatedAt: now
    }

    try {
      const { data: userData } = await db.collection('users').doc(userId).get()
      const user = (userData && userData.length > 0) ? userData[0] : null
      if (user) order.fromPlan = user.plan || 'free'
    } catch (_) { /* non-fatal */ }
  } else {
    return { success: false, message: '不支持的商品类型' }
  }

  // 生成订单号
  const orderNo = `PAY${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`
  order.orderNo = orderNo

  // 写 DB
  const addResult = await db.collection(RECHARGE_ORDERS).add(order)
  order._id = addResult.id || addResult._id
  payLog('[PAYDBG][unifiedOrder] DB订单已创建 orderNo=%s _id=%s', orderNo, order._id)

  // 调微信 V3 统一下单
  const wxResult = await createJsapiOrder({
    appid, mchid, openid,
    description: order.productName.substring(0, 127),
    out_trade_no: orderNo,
    amount: { total: order.amountFen, currency: 'CNY' },
    notify_url: notifyUrl
  })

  if (!wxResult.success || !wxResult.prepay_id) {
    await db.collection(RECHARGE_ORDERS).doc(order._id).update({
      status: 'failed',
      failReason: 'wechat_unified_order_failed',
      updatedAt: new Date()
    }).catch(() => {})
    return { success: false, message: '统一下单失败，请稍后重试' }
  }

  const payParams = createPayParams(wxResult.prepay_id)
  order.prepay_id = wxResult.prepay_id
  payLog('[PAYDBG][unifiedOrder] 完成 orderNo=%s prepay_id=%s', orderNo, wxResult.prepay_id)
  return { success: true, order, payParams }
}

// action: queryOrder — 主动查单（替代旧 activeWeChatQuery + 集成中心）
// 前端轮询兜底 + 手动查单均可使用
// 微信终态（CLOSED/PAYERROR/REVOKED）会同步到 DB，防止订单永远 pending
async function queryOrder(event) {
  const userId = await requireAuthenticatedUserId(app, event)
  const orderNo = String(event.orderNo || '').trim()
  if (!orderNo) return { success: false, message: '缺少 orderNo' }

  // 先查 DB
  const { data } = await db.collection(RECHARGE_ORDERS).where({ orderNo, userId }).limit(1).get()
  const order = (data && data.length > 0) ? data[0] : null
  if (!order) return { success: false, message: '订单不存在' }

  if (order.status === 'paid' && order.fulfillmentStatus !== 'succeeded') {
    try {
      const fulfilled = await fulfillPayment(db, order, order.transactionId || `repair:${order._id || orderNo}`)
      return { success: true, order: fulfilled }
    } catch (_) {
      return { success: true, order }
    }
  }

  // 已终态直接返回
  if (order.status === 'paid' || order.status === 'failed' || order.status === 'expired') {
    return { success: true, order }
  }

  // 调微信 V3 查单
  const wxResult = await queryOrderByOutTradeNo(orderNo)
  payLog('[PAYDBG][queryOrder] orderNo=%s wxResult=%j', orderNo, wxResult)

  if (wxResult && wxResult.trade_state === 'SUCCESS' && wxResult.transaction_id) {
    const fulfilled = await fulfillPayment(db, order, wxResult.transaction_id)
    return { success: true, order: fulfilled }
  }

  // 微信终态同步到 DB（防止订单永远 pending）
  const TERMINAL_STATES = ['CLOSED', 'PAYERROR', 'REVOKED']
  if (wxResult && TERMINAL_STATES.includes(wxResult.trade_state) && order.status === 'pending') {
    payLog('[PAYDBG][queryOrder] 微信终态同步 orderNo=%s trade_state=%s → DB status=expired', orderNo, wxResult.trade_state)
    await db.collection(RECHARGE_ORDERS).doc(order._id).update({
      status: 'expired',
      failReason: `wechat_${wxResult.trade_state.toLowerCase()}`,
      updatedAt: new Date()
    }).catch(() => {})
    return { success: true, order: { ...order, status: 'expired' } }
  }

  // 未支付或查单失败，返回当前 DB 状态
  return { success: true, order }
}

// action: paymentCallback — 微信支付回调
// 支持两个入口：
//   路径A（新-自研）：HTTP 触发器直达 → event.httpMethod + event.body → 自己验签解密
//   路径B（兼容）：集成中心转发 → event.event_type === 'TRANSACTION.SUCCESS'
// rawCallbackBody: 仅路径A使用，路径B传 null
async function paymentCallback(event, rawCallbackBody) {
  let outTradeNo, transactionId, totalFee

  // ── 路径 A：HTTP 触发器直达（自研） ──
  if (rawCallbackBody) {
    const headers = event.headers || {}
    payLog('[PAYDBG][callback] HTTP直连 headers keys=%j body前200=%s',
      Object.keys(headers), String(rawCallbackBody).slice(0, 200))

    // 验签
    if (!verifyCallbackSignature(headers, rawCallbackBody)) {
      payLog('[PAYDBG][callback] 验签失败')
      return { code: 'FAIL', message: '验签失败' }
    }

    // 解析 body
    let callbackJSON
    try { callbackJSON = JSON.parse(rawCallbackBody) } catch (e) {
      payLog('[PAYDBG][callback] JSON解析失败: %s', e.message)
      return { code: 'FAIL', message: '无效的请求体' }
    }

    // 解密 resource
    const decrypted = decryptResource(callbackJSON.resource || {})
    if (!decrypted) {
      payLog('[PAYDBG][callback] 解密失败')
      return { code: 'FAIL', message: '解密失败' }
    }

    outTradeNo = String(decrypted.out_trade_no || '').trim()
    transactionId = String(decrypted.transaction_id || '').trim()
    totalFee = Number(decrypted.amount?.total || 0)
    payLog('[PAYDBG][callback] ✅ 验签解密成功 outTradeNo=%s txnId=%s totalFee=%s',
      outTradeNo, transactionId, totalFee)
  }
  // ── 路径 B：集成中心转发（兼容旧回调通道） ──
  else if (event.event_type === 'TRANSACTION.SUCCESS' && event.resource) {
    if (!ENABLE_LEGACY_PAY_CALLBACK) {
      payLog('[PAYDBG][callback] legacy callback disabled')
      return { code: 'FAIL', message: 'legacy callback disabled' }
    }
    outTradeNo = String(event.resource.out_trade_no || '').trim()
    transactionId = String(event.resource.transaction_id || '').trim()
    totalFee = Number(event.resource.amount?.total || 0)
    payLog('[PAYDBG][callback] 集成中心转发 outTradeNo=%s txnId=%s', outTradeNo, transactionId)
  } else {
    return { success: false, message: '无效的支付回调来源' }
  }

  if (!outTradeNo) return { success: false, message: '缺少 outTradeNo' }

  payLog('[PAYDBG][callback] parsed outTradeNo=%s transactionId=%s totalFee=%s', outTradeNo, transactionId, totalFee)

  const { data } = await db.collection(RECHARGE_ORDERS).where({ orderNo: outTradeNo }).limit(1).get()
  const order = (data && data.length > 0) ? data[0] : null
  payLog('[PAYDBG][callback] order lookup hit=%s status=%s amountFen=%s', !!order, order?.status, order?.amountFen)
  if (!order) return { success: false, message: '订单不存在' }

  // 金额校验
  if (totalFee && totalFee !== order.amountFen) {
    if (isPayDebug()) {
      console.warn(`paymentCallback: amount mismatch expected=${order.amountFen} got=${totalFee} outTradeNo=${outTradeNo}`)
    } else {
      console.warn('paymentCallback: amount mismatch')
    }
    await db.collection(RECHARGE_ORDERS).doc(order._id).update({
      status: 'failed',
      updatedAt: new Date()
    })
    return { success: false, message: '金额不匹配' }
  }

  // 发货
  const fulfilled = await fulfillPayment(db, order, transactionId)

  return { success: true, order: fulfilled }
}

// action: repairOrder — 修复已支付但发货遗漏的订单（grant/entitlement 由 fulfillPayment 幂等保护）
async function repairOrder(event) {
  const userId = await requireAuthenticatedUserId(app, event)
  const orderNo = String(event.orderNo || '').trim()
  const orderId = String(event.orderId || '').trim()

  let order = null
  if (orderNo) {
    // 虚拟支付订单存 outTradeNo，普通支付订单存 orderNo —— 两者都试
    let found = await db.collection(RECHARGE_ORDERS).where({ outTradeNo: orderNo, userId }).limit(1).get()
    if (!found.data || found.data.length === 0) {
      found = await db.collection(RECHARGE_ORDERS).where({ orderNo, userId }).limit(1).get()
    }
    order = (found.data && found.data.length > 0) ? found.data[0] : null
  } else if (orderId) {
    const { data } = await db.collection(RECHARGE_ORDERS).doc(orderId).get()
    order = (data && data.length > 0) ? data[0] : null
    if (order && order.userId !== userId) order = null
  }
  if (!order) return { success: false, message: '订单不存在' }
  if (order.status !== 'paid') return { success: false, message: '仅已支付订单可修复' }

  payLog('[PAYDBG][repair] repair orderId=%s orderNo=%s productType=%s', order._id, order.orderNo || order.outTradeNo, order.productType)
  const repaired = await fulfillPayment(db, order, `repair:${order._id || orderNo}`)
  return { success: true, order: repaired }
}

// ── 虚拟支付 ──

async function createVirtualPayOrder(event) {
  const userId = await requireAuthenticatedUserId(app, event)
  const productType = String(event.productType || '').trim()
  const sandbox = event.sandbox === true || String(event.sandbox).toLowerCase() === 'true'

  const vp = require('./_shared/virtual-pay')
  const billing = await ensureBillingSettings(db)
  if (!billing.useVirtualPay && !sandbox) return { success: false, message: '虚拟支付尚未启用' }

  // 获取用户 session_key 用于用户态签名。
  // 虚拟支付 signature 要求 session_key「有效/新鲜」，DB 存量的可能已过期（→ SIGNATURE_INVALID）。
  // 优先用本次前端传来的 loginCode 现换最新 session_key，失败再回退 DB。
  let sessionKey = ''
  const loginCode = String(event.loginCode || '').trim()
  if (loginCode) {
    try { sessionKey = await vp.getSessionKeyByCode(loginCode) } catch (_) {}
  }
  if (sessionKey) {
    // 换到新鲜 session_key —— 顺便刷新 DB，供其它场景使用
    try { await db.collection('users').doc(userId).update({ sessionKey, updatedAt: new Date() }) } catch (_) {}
  } else {
    try {
      const { data: userData } = await db.collection('users').doc(userId).get()
      sessionKey = (userData && userData.length > 0) ? (userData[0].sessionKey || '') : ''
    } catch (_) {}
  }
  payLog('[VPAY] sessionKey source=%s len=%s', (loginCode && sessionKey) ? 'fresh(jscode2session)' : 'db', sessionKey.length)

  let order, mode, signDataObj

  if (productType === 'recharge') {
    // ── 代币充值 ──
    const billing = await ensureBillingSettings(db)
    const planId = String(event.productId || '').trim()
    if (!planId) return { success: false, message: '缺少 productId' }
    const tier = (billing.rechargeTiers || []).find(t => t.id === planId)
    if (!tier) return { success: false, message: '档位不存在' }
    if (tier.enabled === false) return { success: false, message: '该档位已下架' }

    const amountFen = Number(tier.priceFen) || 0
    const grantTokens = tier.grantTokens || (Math.floor(amountFen / 100 * (billing.tokensPerYuan || 100000)) + (tier.bonusTokens || 0))
    const outTradeNo = vp.generateOutTradeNo('RC')

    order = {
      userId, outTradeNo, productType: 'recharge',
      planId: tier.id, planName: tier.name,
      amountFen, amountYuan: (amountFen / 100).toFixed(2),
      grantTokens, bonusTokens: tier.bonusTokens || 0,
      status: 'pending', channel: 'virtual_pay',
      sandbox, createdAt: new Date(), updatedAt: new Date()
    }
    mode = 'short_series_coin'
    signDataObj = vp.buildSignData({
      outTradeNo, buyQuantity: amountFen, sandbox,
      attach: JSON.stringify({ userId, productType, planId })
    })

  } else if (productType === 'subscription') {
    // ── 道具直购（套餐升级） ──
    const planKey = String(event.planKey || '').trim()
    const billingCycle = String(event.billingCycle || 'monthly').trim()
    const priceVariant = String(event.priceVariant || 'standard').trim()
    if (!planKey) return { success: false, message: '缺少 planKey' }

    const { getSubscriptionConfig } = require('./_shared/subscription')
    const config = await getSubscriptionConfig(db)
    const planConfig = config.plans[planKey]
    if (!planConfig) return { success: false, message: '套餐配置不存在' }

    const toAmount = (v, f) => { const n = Number(v); return (Number.isFinite(n) && n > 0) ? n : (Number.isFinite(Number(f)) ? Number(f) : 0) }
    const standardMonthly = toAmount(planConfig.priceYuan, 19)
    const standardAnnual = toAmount(planConfig.priceYuanAnnual, 168)
    const studentMonthly = toAmount(planConfig.priceYuanStudent, 12)
    const studentAnnual = toAmount(planConfig.priceYuanStudentAnnual, 99)
    const amountYuan = priceVariant === 'student'
      ? (billingCycle === 'annual' ? studentAnnual : studentMonthly)
      : (billingCycle === 'annual' ? standardAnnual : standardMonthly)
    if (!amountYuan || amountYuan <= 0) return { success: false, message: '套餐价格未配置' }

    const amountFen = Math.round(amountYuan * 100)
    const outTradeNo = vp.generateOutTradeNo('SUB')

    // P1-5：创建订单时快照用户当前套餐（fromPlan），退款回退需要它；与 unifiedOrder 行为对齐
    let fromPlan = ''
    try {
      const { data: userData } = await db.collection('users').doc(userId).get()
      const user = (userData && userData.length > 0) ? userData[0] : null
      if (user) fromPlan = user.plan || 'free'
    } catch (_) { /* non-fatal */ }

    order = {
      userId, outTradeNo, productType: 'subscription',
      planKey, planName: planConfig.name, billingCycle, priceVariant,
      amountFen, amountYuan,
      fromPlan, grantPlan: planKey,
      grantDurationDays: billingCycle === 'annual' ? 365 : 30,
      status: 'pending', channel: 'virtual_pay',
      sandbox, createdAt: new Date(), updatedAt: new Date()
    }
    mode = 'short_series_coin'
    signDataObj = vp.buildSignData({
      outTradeNo, buyQuantity: amountFen, sandbox,
      attach: JSON.stringify({ userId, productType, planKey, billingCycle })
    })

  } else {
    return { success: false, message: '不支持的产品类型' }
  }

  // 保存订单
  const result = await db.collection(RECHARGE_ORDERS).add(order)
  order._id = result.id || result._id

  // 生成签名 —— signData 序列化成「字段排序后的 JSON 字符串」，
  // paySig / signature / 前端传参三者使用同一份字符串（逐字节一致）
  const signDataStr = vp.serializeSignData(signDataObj)
  const paySig = vp.signPaySig(signDataStr, sandbox ? 1 : 0)
  const signature = sessionKey ? vp.signUserSig(signDataStr, sessionKey) : ''
  payLog('[VPAY] sign sessionKey.len=%s signData=%s paySig(32)=%s sig(32)=%s',
    sessionKey.length, signDataStr.slice(0, 120), paySig.slice(0, 32), signature.slice(0, 32))

  payLog('[VPAY] order created outTradeNo=%s amount=%s mode=%s sandbox=%s',
    order.outTradeNo, order.amountFen, mode, sandbox)

  return {
    success: true,
    offerId: vp.OFFER_ID,
    paySig,
    signature,
    signData: signDataStr,   // 排序后的 JSON 字符串，前端原样传给 requestVirtualPayment
    outTradeNo: order.outTradeNo,
    mode,
    order
  }
}

// action: confirmVirtualPay — 前端支付成功后验证并发货
async function confirmVirtualPay(event) {
  const vp = require('./_shared/virtual-pay')
  const userId = await requireAuthenticatedUserId(app, event)
  const outTradeNo = String(event.outTradeNo || '').trim()
  const wxOrderId = String(event.wxOrderId || '').trim()
  if (!outTradeNo) return { success: false, message: '缺少 outTradeNo' }

  const { data } = await db.collection(RECHARGE_ORDERS).where({ outTradeNo, userId }).limit(1).get()
  const order = (data && data.length > 0) ? data[0] : null
  if (!order) return { success: false, message: '订单不存在' }
  if (order.status === 'paid' && order.fulfillmentStatus === 'succeeded') {
    return { success: true, order, alreadyPaid: true }
  }
  if (order.status === 'paid') {
    // 已支付但发货未完成 → 补偿发货
    payLog('[VPAY] re-fulfilling order outTradeNo=%s', outTradeNo)
    const fulfilled = await fulfillPayment(db, { ...order, _id: order._id }, outTradeNo)
    return { success: true, order: fulfilled }
  }
  if (order.status !== 'pending') return { success: false, message: `订单状态为 "${order.status}"` }

  // 存储 wxOrderId 到订单记录（后续补单/查单可用）
  if (wxOrderId && !order.wxOrderId) {
    await db.collection(RECHARGE_ORDERS).doc(order._id).update({ wxOrderId, updatedAt: new Date() }).catch(() => {})
  }
  const effectiveWxOrderId = wxOrderId || order.wxOrderId || ''
  // 服务端向微信查单确认支付真实发生
  const isSandbox = order.sandbox === true
  // 获取用户 openid 用于查单
  let userOpenid = ''
  try {
    const { data: userData } = await db.collection('users').doc(userId).get()
    userOpenid = (userData && userData.length > 0) ? (userData[0].openid || '') : ''
  } catch (_) {}

  let wxQuery = null
  try {
    wxQuery = await vp.queryVirtualOrder(outTradeNo, userOpenid, isSandbox ? 1 : 0, effectiveWxOrderId)
    payLog('[VPAY] queryOrder FULL response outTradeNo=%s %j', outTradeNo, wxQuery)
  } catch (e) {
    payLog('[VPAY] queryOrder FAILED outTradeNo=%s err=%s', outTradeNo, e?.message || String(e))
  }
  // 判定「已支付」：虚拟支付 query_order 成功返回 { errcode:0, order:{ status, paid_time, order_fee, wx_order_id... } }
  // 注意：没有普通微信支付的 trade_state 字段。用 errcode===0 && paid_time>0 判定，比猜 status 枚举鲁棒。
  const qOrder = (wxQuery && wxQuery.order && typeof wxQuery.order === 'object') ? wxQuery.order : null
  const paidTime = qOrder ? Number(qOrder.paid_time || 0) : 0
  const isPaid = !!wxQuery && Number(wxQuery.errcode || 0) === 0 && qOrder && paidTime > 0
  payLog('[VPAY] queryOrder verdict outTradeNo=%s errcode=%s status=%s paid_time=%s isPaid=%s',
    outTradeNo, wxQuery?.errcode, qOrder?.status, paidTime, isPaid)

  if (!isPaid) {
    // 沙箱环境查单接口可能不通，允许降级通过
    if (isSandbox && (!wxQuery || wxQuery.errcode == null || Number(wxQuery.errcode) !== 0)) {
      payLog('[VPAY] sandbox queryOrder unavailable/failed, skipping verification')
    } else {
      return { success: false, message: '微信侧未确认支付，请稍后重试', wxErrcode: wxQuery?.errcode, wxStatus: qOrder?.status }
    }
  }
  // ── 一致性校验（防御式）──
  // 校验查单响应 order 里「确实返回」的字段与订单是否一致：
  //   字段存在但不符 → 拒绝发货并标记订单异常（防串单/改价/复用单号）
  //   字段缺失      → 告警但不阻断
  if (qOrder) {
    const q = qOrder
    const pick = (...keys) => { for (const k of keys) if (q[k] != null) return q[k]; return undefined }
    const mismatches = []

    // 金额：虚拟支付返回 order_fee（分）
    const qAmount = pick('order_fee', 'paid_fee', 'total_fee', 'total_amount')
    if (qAmount != null) {
      if (Number(qAmount) !== Number(order.amountFen)) mismatches.push(`amount:${qAmount}vs${order.amountFen}`)
    } else {
      payLog('[VPAY] consistency: amount field not found in queryOrder response (skipped) outTradeNo=%s', outTradeNo)
    }

    const qOffer = pick('offer_id', 'offerId')
    if (qOffer != null && String(qOffer) !== String(vp.OFFER_ID)) mismatches.push(`offer_id:${qOffer}`)

    if (order.productType === 'subscription' && order.productId != null) {
      const qProd = pick('product_id', 'productId')
      if (qProd != null && String(qProd) !== String(order.productId)) mismatches.push(`product_id:${qProd}`)
    }

    if (mismatches.length > 0) {
      payLog('[VPAY] consistency MISMATCH outTradeNo=%s %j (wxQuery=%j)', outTradeNo, mismatches, wxQuery)
      await db.collection(RECHARGE_ORDERS).doc(order._id).update({
        status: 'failed', failReason: 'vpay-consistency: ' + mismatches.join(';'), updatedAt: new Date()
      }).catch(() => {})
      return { success: false, message: '订单校验未通过，请联系客服', mismatches }
    }
  }

  // 微信确认已支付 → 标记为已支付并发货
  await db.collection(RECHARGE_ORDERS).doc(order._id).update({ status: 'paid', paidAt: new Date(), updatedAt: new Date() })
  const fulfilled = await fulfillPayment(db, { ...order, _id: order._id, status: 'paid' }, outTradeNo)

  return { success: true, order: fulfilled }
}

exports.main = async (event = {}) => {
  try {
    // ── HTTP 触发器检测（自研回调入口） ──
    // CloudBase HTTP 访问服务将请求路由到云函数时，event 会包含 httpMethod 字段
    if (event.httpMethod) {
      payLog('[PAYDBG][main] HTTP trigger method=%s path=%s keys=%j',
        event.httpMethod, event.path, Object.keys(event))
      // POST 请求一律走支付回调处理（安全验证由 paymentCallback 的验签+解密保证）
      if (event.httpMethod === 'POST') {
        return await paymentCallback(event, event.body)
      }
      return { code: 'FAIL', message: 'Only POST is accepted' }
    }

    // [PAYDBG] 最入口诊断：抓”回调到底有没有进来 + 真实结构”。前端调用带凭证，仅打印 keys；无 action 的（疑似回调）完整打印。
    if (event && event.action) {
      payLog('[PAYDBG][main] front-call action=%s keys=%j', event.action, Object.keys(event))
    } else {
      payLog('[PAYDBG][main] NO-ACTION event (疑似支付回调), raw=%j', event)
    }

    // 集成中心微信支付回调自动识别（event_type 而非 action）— 兼容旧通道
    if (event.event_type === 'TRANSACTION.SUCCESS' && event.resource) {
      payLog('[PAYDBG][main] >>> 命中 TRANSACTION.SUCCESS 回调分支（兼容）')
      return await paymentCallback(event, null)
    }

    const action = String(event.action || '').trim()

    if (action === 'getRechargePlans') return await getRechargePlans(event)
    if (action === 'createRechargeOrder') return await createRechargeOrder(event)
    if (action === 'createSubscriptionUpgrade') return await createSubscriptionUpgrade(event)
    if (action === 'adminConfirmRecharge') return await adminConfirmRecharge(event)
    if (action === 'unifiedOrder') return await unifiedOrder(event)
    if (action === 'queryOrder') return await queryOrder(event)
    if (action === 'confirmPayment') return await confirmPayment(event)
    if (action === 'repairOrder') return await repairOrder(event)
    if (action === 'createVirtualPayOrder') return await createVirtualPayOrder(event)
    if (action === 'confirmVirtualPay') return await confirmVirtualPay(event)
    return { success: false, message: '未知操作' }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    if (error?.code === 'ADMIN_REQUIRED' || error?.message === 'ADMIN_REQUIRED') {
      return { success: false, message: '仅管理员可执行此操作', code: 'ADMIN_REQUIRED' }
    }
    console.error('recharge error:', error)
    const errMsg = error?.message || String(error || '')
    return { success: false, message: '操作失败: ' + errMsg.slice(0, 120) }
  }
}
