const RECHARGE_ORDERS = 'recharge_orders'

async function grantRechargeTokens(db, order, orderId) {
  const grantTokens = Number(order.grantTokens || 0)
  if (!order.userId || grantTokens <= 0) return

  const source = `recharge_${orderId}`
  const { data: existingGrant } = await db.collection('call_usage_records')
    .where({ userId: order.userId, type: 'grant', source })
    .limit(1)
    .get()

  if (existingGrant && existingGrant.length > 0) return

  const { addExtraTokens } = require('./subscription')
  const result = await addExtraTokens(db, order.userId, grantTokens, source)
  if (!result?.success) {
    throw new Error(result?.message || 'recharge grant failed')
  }
}

async function fulfillSubscription(db, order, now) {
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
}

async function fulfillPayment(db, order, transactionId) {
  const now = new Date()
  const orderId = order._id

  const { data: current } = await db.collection(RECHARGE_ORDERS).doc(orderId).get()
  const latest = (current && current.length > 0) ? current[0] : null
  if (!latest) throw new Error('order not found')
  if (latest.status === 'paid') return { ...latest, alreadyPaid: true }

  await db.collection(RECHARGE_ORDERS).doc(orderId).update({
    status: 'paid',
    paidAt: now,
    transactionId: transactionId || '',
    updatedAt: now
  })

  const merged = { ...order, status: 'paid', paidAt: now }

  if (order.productType === 'recharge') {
    await grantRechargeTokens(db, order, orderId)
  } else if (order.productType === 'subscription') {
    await fulfillSubscription(db, order, now)
  }

  return merged
}

module.exports = { fulfillPayment }
