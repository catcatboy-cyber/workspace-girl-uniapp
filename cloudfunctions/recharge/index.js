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
    grantTokens: Math.floor(t.priceFen / 100 * (billing.tokensPerYuan || 100000)) + (t.bonusTokens || 0),
    bonusTokens: t.bonusTokens || 0
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
  const now = new Date()

  const order = {
    userId,
    planId: tier.id,
    planName: tier.name,
    amountFen,
    amountYuan,
    grantTokens,
    bonusTokens: tier.bonusTokens || 0,
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

  return { success: true, order: { ...order, status: 'paid', paidAt: now } }
}

exports.main = async (event = {}) => {
  try {
    const action = String(event.action || '').trim()

    if (action === 'getRechargePlans') return await getRechargePlans(event)
    if (action === 'createRechargeOrder') return await createRechargeOrder(event)
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
