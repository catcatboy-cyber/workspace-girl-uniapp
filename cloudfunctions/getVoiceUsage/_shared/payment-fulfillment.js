/**
 * 支付发货模块 — 微信支付回调与管理员手动补单共用
 *
 * fulfillPayment(db, order, transactionId):
 *   幂等发货：已 paid 直接返回；productType=recharge → 加 token；
 *   productType=subscription → 开会员/续期（自然月）。
 *
 * 复用现有：
 *   ensureTokenAccount  — _shared/billing.js
 *   addExtraTokens       — _shared/subscription.js
 */

const TOKEN_ACCOUNTS = 'token_accounts'
const RECHARGE_ORDERS = 'recharge_orders'

async function fulfillPayment(db, order, transactionId) {
  const now = new Date()
  const orderId = order._id

  // 幂等检查：已 paid 直接返回成功
  const { data: current } = await db.collection(RECHARGE_ORDERS).doc(orderId).get()
  const latest = (current && current.length > 0) ? current[0] : null
  if (!latest) throw new Error('订单不存在')
  if (latest.status === 'paid') return { ...latest, alreadyPaid: true }

  // 更新订单状态
  await db.collection(RECHARGE_ORDERS).doc(orderId).update({
    status: 'paid',
    paidAt: now,
    transactionId: transactionId || '',
    updatedAt: now
  })

  const merged = { ...order, status: 'paid', paidAt: now }

  if (order.productType === 'recharge') {
    // 加油包发货
    const { ensureTokenAccount } = require('./billing')
    const account = await ensureTokenAccount(db, order.userId)

    // 幂等：已有同订单流水则跳过
    const { data: existingLedger } = await db.collection('token_ledger_records')
      .where({ relatedOrderId: orderId, type: 'recharge' }).limit(1).get()
    if (!existingLedger || existingLedger.length === 0) {
      const grantTokens = order.grantTokens || 0
      const newBalance = (account.balanceTokens || 0) + grantTokens
      const newPurchased = (account.purchasedTokens || 0) + grantTokens

      await db.collection(TOKEN_ACCOUNTS).doc(account._id).update({
        balanceTokens: newBalance,
        purchasedTokens: newPurchased,
        updatedAt: now
      })

      await db.collection('token_ledger_records').add({
        userId: order.userId,
        type: 'recharge',
        amountTokens: grantTokens,
        balanceAfter: newBalance,
        relatedOrderId: orderId,
        remark: `微信支付充值 ${order.planName || order.productName || ''} · ¥${order.amountYuan || (order.amountFen / 100).toFixed(2)}`,
        createdAt: now
      })
    }

    // 同步 users.extraTokens
    if (order.grantTokens > 0) {
      try {
        const { addExtraTokens } = require('./subscription')
        await addExtraTokens(db, order.userId, order.grantTokens, `recharge_${orderId}`)
      } catch (err) {
        console.warn('addExtraTokens on recharge (non-fatal):', err.message)
      }
    }
  } else if (order.productType === 'subscription') {
    // 会员发货
    const { data: userData } = await db.collection('users').doc(order.userId).get()
    const user = (userData && userData.length > 0) ? userData[0] : null
    if (!user) throw new Error('用户不存在')

    const durationDays = order.grantDurationDays || 30
    let newExpiresAt

    if (user.plan === order.grantPlan && user.planExpiresAt) {
      // 同套餐续费：从当前到期时间顺延
      const current = new Date(user.planExpiresAt)
      if (durationDays >= 365) {
        current.setFullYear(current.getFullYear() + 1)
      } else {
        current.setMonth(current.getMonth() + 1)  // 自然月
      }
      newExpiresAt = current
    } else {
      // 新套餐或升级：从当前时间开始
      const start = new Date()
      if (durationDays >= 365) {
        start.setFullYear(start.getFullYear() + 1)
      } else {
        start.setMonth(start.getMonth() + 1)
      }
      newExpiresAt = start
    }

    // 支付会员后清除试用期（否则 adminManage 列表 trialEndsAt 优先，永久显示"试用期"）
    await db.collection('users').doc(order.userId).update({
      plan: order.grantPlan,
      planExpiresAt: newExpiresAt.toISOString(),
      trialEndsAt: null,
      updatedAt: now
    })
  }

  return merged
}

module.exports = { fulfillPayment }
