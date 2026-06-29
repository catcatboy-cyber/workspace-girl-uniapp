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
  // 幂等检查：此订单的订阅是否已发放
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

  await db.collection('call_usage_records').add({
    userId: order.userId,
    type: 'grant',
    source: grantSource,
    amount: 0,
    remark: `subscription: ${order.grantPlan || ''}`,
    createdAt: now
  })
}

async function fulfillPayment(db, order, transactionId) {
  const now = new Date()
  const orderId = order._id
  console.log('[PAYDBG][fulfill] enter orderId=%s orderNo=%s productType=%s src/txn=%s', orderId, order.orderNo, order.productType, transactionId)

  const { data: current } = await db.collection(RECHARGE_ORDERS).doc(orderId).get()
  const latest = (current && current.length > 0) ? current[0] : null
  if (!latest) throw new Error('order not found')

  const alreadyPaid = latest.status === 'paid'

  if (!alreadyPaid) {
    console.log('[PAYDBG][fulfill] mark paid orderId=%s prevStatus=%s amountFen=%s', orderId, latest.status, latest.amountFen)
    await db.collection(RECHARGE_ORDERS).doc(orderId).update({
      status: 'paid',
      paidAt: now,
      transactionId: transactionId || '',
      updatedAt: now
    })
  } else {
    console.log('[PAYDBG][fulfill] already-paid repair mode orderId=%s — re-running grant/idempotency check', orderId)
  }

  const merged = { ...order, status: 'paid', paidAt: latest.paidAt || now }

  if (order.productType === 'recharge') {
    await grantRechargeTokens(db, order, orderId)
    console.log('[PAYDBG][fulfill] recharge granted orderId=%s grantTokens=%s userId=%s', orderId, order.grantTokens, order.userId)
  } else if (order.productType === 'subscription') {
    await fulfillSubscription(db, order, now)
    console.log('[PAYDBG][fulfill] subscription fulfilled orderId=%s grantPlan=%s', orderId, order.grantPlan)
  }

  if (alreadyPaid) {
    return { ...merged, alreadyPaid: true }
  }

  return merged
}

module.exports = { fulfillPayment }
