const RECHARGE_ORDERS = 'recharge_orders'

function isPayDebug() {
  return String(process.env.PAY_DEBUG || '').trim() === 'true'
}

function payLog(...args) {
  if (isPayDebug()) console.log(...args)
}

async function grantRechargeTokens(db, order, orderId) {
  const grantTokens = Number(order.grantTokens || 0)
  if (!order.userId || grantTokens <= 0) return

  const legacySource = `recharge_${orderId}`
  const { data: existingLegacyGrant } = await db.collection('call_usage_records')
    .where({ userId: order.userId, type: 'grant', source: legacySource })
    .limit(1)
    .get()
  if (existingLegacyGrant && existingLegacyGrant.length > 0) return

  const { data: existingGrant } = await db.collection('call_usage_records')
    .where({ userId: order.userId, type: 'grant', source: 'recharge', sourceId: orderId })
    .limit(1)
    .get()
  if (existingGrant && existingGrant.length > 0) return

  const { addExtraTokens } = require('./subscription')
  const result = await addExtraTokens(db, order.userId, grantTokens, legacySource)
  if (!result?.success) {
    throw new Error(result?.message || 'recharge grant failed')
  }
}

async function fulfillSubscription(db, order, now) {
  const grantSource = `sub_${order._id}`
  const { data: existingGrant } = await db.collection('call_usage_records')
    .where({ userId: order.userId, type: 'grant', source: grantSource })
    .limit(1)
    .get()
  if (existingGrant && existingGrant.length > 0) return

  const { data: userData } = await db.collection('users').doc(order.userId).get()
  const user = (userData && userData.length > 0) ? userData[0] : null
  if (!user) throw new Error('user not found')

  const durationDays = order.grantDurationDays || 30
  let newExpiresAt

  if (user.plan === order.grantPlan && user.planExpiresAt) {
    const current = new Date(user.planExpiresAt)
    if (durationDays >= 365) {
      current.setFullYear(current.getFullYear() + 1)
    } else {
      current.setMonth(current.getMonth() + 1)
    }
    newExpiresAt = current
  } else {
    const start = new Date()
    if (durationDays >= 365) {
      start.setFullYear(start.getFullYear() + 1)
    } else {
      start.setMonth(start.getMonth() + 1)
    }
    newExpiresAt = start
  }

  await db.collection('users').doc(order.userId).update({
    plan: order.grantPlan,
    planExpiresAt: newExpiresAt.toISOString(),
    trialEndsAt: null,
    updatedAt: now
  })

  // 查询升级后套餐的月度 Token 配额，写入账本
  let upgradeTokens = 0
  let balanceAfter = user?.extraTokens || 0
  try {
    const { getSubscriptionConfig } = require('./subscription')
    const config = await getSubscriptionConfig(db)
    const planCfg = config.plans?.[order.grantPlan]
    if (planCfg) {
      upgradeTokens = planCfg.monthlyTokens || planCfg.monthlyCalls || 0
      // 余额 = 新月额剩余 + 加油包余额
      balanceAfter = Math.max(0, upgradeTokens - (user?.monthlyTokensUsed || 0)) + (user?.extraTokens || 0)
    }
  } catch (_) {}

  await db.collection('call_usage_records').add({
    userId: order.userId,
    type: 'grant',
    source: grantSource,
    sourceId: order._id || '',
    amount: upgradeTokens,
    amountTokens: upgradeTokens,
    balanceAfter,
    remark: `升级套餐: ${order.grantPlan || ''}（月额 ${(upgradeTokens / 1000).toFixed(0)}K）`,
    createdAt: now
  })
}

async function fulfillPayment(db, order, transactionId) {
  const now = new Date()
  const orderId = order._id
  // [PAYDBG] transactionId 形参兼用作“发货来源”标识：回调传真实微信单号；管理员传 admin:<uid>；主动查单传 query:<uid>
  payLog('[PAYDBG][fulfill] enter orderId=%s orderNo=%s productType=%s src/txn=%s', orderId, order.orderNo, order.productType, transactionId)

  const { data: current } = await db.collection(RECHARGE_ORDERS).doc(orderId).get()
  const latest = (current && current.length > 0) ? current[0] : null
  if (!latest) throw new Error('order not found')
  const alreadyPaid = latest.status === 'paid'
  if (alreadyPaid && latest.fulfillmentStatus === 'succeeded') {
    payLog('[PAYDBG][fulfill] idempotent-hit: already fulfilled, skip orderId=%s', orderId)
    return { ...latest, alreadyPaid: true }
  }

  if (!alreadyPaid) {
    payLog('[PAYDBG][fulfill] mark paid orderId=%s prevStatus=%s amountFen=%s', orderId, latest.status, latest.amountFen)
    await db.collection(RECHARGE_ORDERS).doc(orderId).update({
      status: 'paid',
      paidAt: now,
      transactionId: transactionId || '',
      fulfillmentStatus: 'pending',
      fulfillmentUpdatedAt: now,
      updatedAt: now
    })
  } else {
    payLog('[PAYDBG][fulfill] already-paid repair mode orderId=%s - re-running grant/idempotency check', orderId)
    await db.collection(RECHARGE_ORDERS).doc(orderId).update({
      fulfillmentStatus: 'pending',
      fulfillmentUpdatedAt: now,
      updatedAt: now
    }).catch(() => {})
  }

  const merged = { ...latest, ...order, status: 'paid', paidAt: latest.paidAt || now }

  try {
    if (order.productType === 'recharge') {
      await grantRechargeTokens(db, order, orderId)
      payLog('[PAYDBG][fulfill] recharge granted orderId=%s grantTokens=%s userId=%s', orderId, order.grantTokens, order.userId)
    } else if (order.productType === 'subscription') {
      await fulfillSubscription(db, order, now)
      payLog('[PAYDBG][fulfill] subscription fulfilled orderId=%s grantPlan=%s', orderId, order.grantPlan)
    }

    await db.collection(RECHARGE_ORDERS).doc(orderId).update({
      fulfillmentStatus: 'succeeded',
      fulfilledAt: now,
      fulfillmentError: '',
      fulfillmentUpdatedAt: now,
      updatedAt: now
    })

    return {
      ...merged,
      fulfillmentStatus: 'succeeded',
      fulfilledAt: now,
      alreadyPaid
    }
  } catch (error) {
    const message = String(error?.message || error || '').slice(0, 300)
    await db.collection(RECHARGE_ORDERS).doc(orderId).update({
      fulfillmentStatus: 'failed',
      fulfillmentError: message,
      fulfillmentUpdatedAt: new Date(),
      updatedAt: new Date()
    }).catch(() => {})
    throw error
  }
}

module.exports = { fulfillPayment }
