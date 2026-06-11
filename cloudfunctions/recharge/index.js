const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')
const { ensureBillingSettings, ensureTokenAccount } = require('./_shared/billing')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()

const RECHARGE_ORDERS = 'recharge_orders'
const TOKEN_ACCOUNTS = 'token_accounts'

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
  return { success: true, tiers, tokensPerYuan: billing.tokensPerYuan || 100000 }
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
  const grantTokens = Math.floor(amountFen / 100 * (billing.tokensPerYuan || 100000)) + (tier.bonusTokens || 0)
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

  const now = new Date()
  const account = await ensureTokenAccount(db, order.userId)
  const newBalance = (account.balanceTokens || 0) + order.grantTokens
  const newPurchased = (account.purchasedTokens || 0) + order.grantTokens

  // 幂等保护：检查是否已有同订单的流水记录
  const { data: existingLedger } = await db.collection('token_ledger_records')
    .where({ relatedOrderId: orderId, type: 'recharge' }).limit(1).get()
  if (existingLedger && existingLedger.length > 0) return { success: true, order, alreadyConfirmed: true }

  // 更新订单状态
  await db.collection(RECHARGE_ORDERS).doc(orderId).update({
    status: 'paid',
    paidAt: now,
    confirmedBy: userId,
    updatedAt: now
  })

  // 更新账户余额
  await db.collection(TOKEN_ACCOUNTS).doc(account._id).update({
    balanceTokens: newBalance,
    purchasedTokens: newPurchased,
    updatedAt: now
  })

  // 写入流水
  await db.collection('token_ledger_records').add({
    userId: order.userId,
    type: 'recharge',
    amountTokens: order.grantTokens,
    balanceAfter: newBalance,
    relatedOrderId: orderId,
    remark: `充值 ${order.planName} · ¥${order.amountYuan}`,
    createdAt: now
  })

  // 新次数体系：给用户加额外次数（加油包次数，不过期）
  const grantCalls = order.grantCalls || 0
  if (order.grantTokens > 0) {
    try {
      const { addExtraTokens } = require('./_shared/subscription')
      await addExtraTokens(db, order.userId, order.grantTokens, `recharge_${order.planId}`)
    } catch (err) {
      console.warn('addExtraTokens on recharge failed (non-fatal):', err.message)
    }
  }

  return { success: true, order: { ...order, status: 'paid', paidAt: now } }
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

exports.main = async (event = {}) => {
  try {
    const action = String(event.action || '').trim()

    if (action === 'getRechargePlans') return await getRechargePlans(event)
    if (action === 'createRechargeOrder') return await createRechargeOrder(event)
    if (action === 'createSubscriptionUpgrade') return await createSubscriptionUpgrade(event)
    if (action === 'adminConfirmRecharge') return await adminConfirmRecharge(event)

    return { success: false, message: '未知操作' }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    if (error?.code === 'ADMIN_REQUIRED' || error?.message === 'ADMIN_REQUIRED') {
      return { success: false, message: '仅管理员可执行此操作', code: 'ADMIN_REQUIRED' }
    }
    console.error('recharge error:', error)
    return { success: false, message: '操作失败' }
  }
}
