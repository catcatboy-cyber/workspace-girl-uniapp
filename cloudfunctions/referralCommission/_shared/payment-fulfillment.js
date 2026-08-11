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

  // 防御：缺 grantPlan 的订单不得把用户 plan 写成 undefined
  if (!order.grantPlan) throw new Error('subscription order missing grantPlan')

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
  if (latest.status === 'paid' && latest.fulfillmentStatus === 'succeeded') {
    payLog('[PAYDBG][fulfill] idempotent-hit: already fulfilled, skip orderId=%s', orderId)
    return { ...latest, alreadyPaid: true }
  }

  // P1-7：并发发货（回调/前端确认/后台查单同时到达）用条件更新原子抢占发放权：
  //  ① 首次：pending → paid + processing（只有一个调用成功，其他调用 updated=0）；
  //  ② 已 paid 未完成：claim 发放权（fulfillmentStatus in pending/failed，或 processing 超时 10 分钟回收）；
  //  ③ 落败方不执行发放，返回当前状态（grant 由唯一胜方完成，杜绝重复发放）。
  const claimFirst = await db.collection(RECHARGE_ORDERS)
    .where({ _id: orderId, status: 'pending' })
    .update({
      status: 'paid',
      paidAt: now,
      transactionId: transactionId || '',
      fulfillmentStatus: 'processing',
      fulfillmentUpdatedAt: now,
      updatedAt: now
    })
  let grantOwner = Number(claimFirst?.updated || 0) > 0
  if (!grantOwner) {
    // 第一步：pending/failed 直接 claim（这些状态说明发放未完成，无超时条件）
    const claimRepair1 = await db.collection(RECHARGE_ORDERS)
      .where({ _id: orderId, status: 'paid', fulfillmentStatus: db.command.in(['pending', 'failed']) })
      .update({ fulfillmentStatus: 'processing', fulfillmentUpdatedAt: now, updatedAt: now })
    grantOwner = Number(claimRepair1?.updated || 0) > 0
  }
  if (!grantOwner) {
    // 第二步：旧订单无 fulfillmentStatus 字段（repair/历史订单）视为未完成可回收
    const claimLegacy = await db.collection(RECHARGE_ORDERS)
      .where({ _id: orderId, status: 'paid', fulfillmentStatus: db.command.exists(false) })
      .update({ fulfillmentStatus: 'processing', fulfillmentUpdatedAt: now, updatedAt: now })
    grantOwner = Number(claimLegacy?.updated || 0) > 0
  }
  if (!grantOwner) {
    // 第三步：processing 仅超时 10 分钟才可回收（避免打断正常发放）
    const staleCutoff = new Date(now.getTime() - 10 * 60 * 1000)
    const claimRepair2 = await db.collection(RECHARGE_ORDERS)
      .where({
        _id: orderId,
        status: 'paid',
        fulfillmentStatus: 'processing',
        fulfillmentUpdatedAt: db.command.lte(staleCutoff)
      })
      .update({ fulfillmentStatus: 'processing', fulfillmentUpdatedAt: now, updatedAt: now })
    grantOwner = Number(claimRepair2?.updated || 0) > 0
  }
  if (!grantOwner) {
    // 发放权在别处（processing 进行中或刚完成）→ 不重复发放
    payLog('[PAYDBG][fulfill] concurrent owner active, skip orderId=%s', orderId)
    const { data: finalData } = await db.collection(RECHARGE_ORDERS).doc(orderId).get()
    const final = (finalData && finalData.length > 0) ? finalData[0] : null
    return final ? { ...final, concurrent: true } : { ...latest, concurrent: true }
  }
  payLog('[PAYDBG][fulfill] repair claim acquired orderId=%s', orderId)

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

    try {
      const { enqueueCommissionJob } = require('./referral-commission')
      await enqueueCommissionJob(db, {
        source: 'recharge_order',
        orderId,
        orderType: order.productType,
        userId: order.userId,
        paidAmountFen: Number(latest.amountFen || order.amountFen || 0),
        paidAt: latest.paidAt || now,
        transactionId: transactionId || latest.transactionId || ''
      })
    } catch (commissionError) {
      console.error('[referral-commission] recharge enqueue failed', commissionError)
    }

    return {
      ...merged,
      fulfillmentStatus: 'succeeded',
      fulfilledAt: now,
      alreadyPaid: false
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

async function runTransaction(db, callback) {
  if (typeof db.runTransaction === 'function') return db.runTransaction(callback)
  if (typeof db.startTransaction !== 'function') throw Object.assign(new Error('TRANSACTION_UNAVAILABLE'), { code: 'TRANSACTION_UNAVAILABLE' })
  const transaction = await db.startTransaction()
  try {
    const result = await callback(transaction)
    await transaction.commit()
    return result
  } catch (error) {
    try { await transaction.rollback() } catch (_) {}
    throw error
  }
}

/**
 * 充值/套餐退款到账后的统一落库（幂等）：
 * 事务内（仅 doc 级操作，CloudBase 事务不支持 collection.add）标记 refunded + 回退套餐 + 扣回 token；
 * 事务外补记账（审计用途，失败不阻断）+ 登记冲正补偿 job（幂等，失败由 worker 重试）。
 * 供退款回调（contentSecCallback）、后台查单对账与线下退款标记（adminManage）共用。
 */
async function settleRechargeRefund(db, order, options = {}) {
  const orderId = String(order._id || '').trim()
  if (!orderId) return { success: false, reason: 'INVALID_ORDER' }
  const settled = await runTransaction(db, async (tx) => {
    const { data: currentData } = await tx.collection(RECHARGE_ORDERS).doc(orderId).get()
    const current = Array.isArray(currentData) ? currentData[0] : currentData
    if (!current) return { success: false, reason: 'ORDER_NOT_FOUND' }
    if (current.status === 'refunded') return { success: true, duplicate: true, order: current }
    if (current.status !== 'paid') return { success: false, reason: `ORDER_STATE_${current.status}` }

    const now = new Date()
    await tx.collection(RECHARGE_ORDERS).doc(orderId).update({
      status: 'refunded',
      refundedAt: now,
      refundRequestStatus: 'refunded',
      refundSettledAt: now,
      refundReason: String(options.reason || ''),
      updatedAt: now
    })

    const { data: userData } = await tx.collection('users').doc(current.userId).get()
    const user = Array.isArray(userData) ? userData[0] : userData

    // 退款时回退套餐升级（P1-6：仅当用户当前套餐正是本订单授予的才回退，
    // 避免旧订单退款覆盖用户后续购买的新套餐；从 pro 升 ultra 后退 pro 单不降级）
    const isSubscription = current.productType === 'subscription' || current.type === 'subscription_upgrade'
    if (isSubscription && user && String(user.plan || '') === String(current.grantPlan || '')) {
      await tx.collection('users').doc(current.userId).update({
        plan: current.fromPlan || 'free',
        planExpiresAt: null,
        updatedAt: now
      }).catch(() => {})
    }

    // 扣除已发放的 Token（充值与订阅升级都可能发放；用户已消耗部分无法追回）
    // 注意：事务内不使用 command.inc（CloudBase 事务对操作符支持有限），
    // 事务隔离保证读-算-写原子性，与道具线 finalizeOrderRefund 同模式
    const refundTokens = Number(current.grantTokens || 0)
    let deduction = 0
    if (refundTokens > 0 && user) {
      const currentExtraTokens = Number(user?.extraTokens || 0)
      deduction = Math.min(currentExtraTokens, refundTokens)
      if (deduction > 0) {
        await tx.collection('users').doc(current.userId).update({
          extraTokens: currentExtraTokens - deduction
        })
      }
    }
    return { success: true, order: { ...current, status: 'refunded', refundedAt: now }, userId: current.userId, planName: current.planName || current.productName || '', deduction, refundTokens }
  }).catch((error) => ({
    success: false,
    reason: String(error?.message || error?.code || 'SETTLE_FAILED').slice(0, 120)
  }))
  if (!settled.success) return settled

  // 事务外补记账（审计用途；CloudBase 事务不支持 collection.add，失败不阻断结算）
  if (settled.refundTokens > 0) {
    try {
      await db.collection('call_usage_records').add({
        userId: settled.userId,
        type: 'adjust',
        source: 'refund',
        amount: -settled.deduction,
        relatedOrderId: orderId,
        remark: `refund: ${settled.planName || ''}`,
        createdAt: new Date()
      })
    } catch (error) {
      console.error('[payment-fulfillment] refund ledger record failed', error)
    }
  }

  let commissionReversal = null
  try {
    const { enqueueCommissionReversal } = require('./referral-commission')
    commissionReversal = await enqueueCommissionReversal(db, {
      source: 'recharge_order',
      orderId,
      refundAmountFen: Number(order.amountFen || 0),
      reason: String(options.reason || 'refund')
    })
  } catch (error) {
    console.error('[referral-commission] recharge refund reversal failed', error)
    commissionReversal = { success: false, reason: 'REVERSAL_FAILED' }
  }

  return { ...settled, commissionReversal }
}

/**
 * P1-3：自动退款对账（worker 每分钟触发）——
 * 扫描退款任务在途（refundRequestStatus=processing）且距上次复核超过 minAgeMs 的订单，
 * query_order 确认最终状态：已退款(5/8) → settleRechargeRefund 结算；异常(7) → 标记 anomaly；
 * 仍在退款中 → 跳过等下次。弥补退款通知丢失/停止重试后无人手动查单的缺口。
 */
async function reconcileProcessingRefunds(db, options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100)
  const minAgeMs = Number(options.minAgeMs) || 5 * 60 * 1000
  const cutoff = new Date(Date.now() - minAgeMs)
  const { data = [] } = await db.collection(RECHARGE_ORDERS)
    .where({ refundRequestStatus: 'processing' })
    .limit(limit)
    .get()
  const stats = { scanned: data.length, settled: 0, stillProcessing: 0, failed: 0, anomaly: 0 }
  for (const order of data) {
    if (options.deadline && Date.now() >= options.deadline) break
    // 距上次复核不足 minAgeMs 跳过（query_order 有频率限制 268490015）
    const lastCheck = order.lastQueryAt || order.refundAcceptedAt || order.updatedAt
    if (lastCheck && new Date(lastCheck).getTime() > cutoff.getTime()) {
      stats.stillProcessing++
      continue
    }
    let openid = ''
    try {
      const { data: userData } = await db.collection('users').doc(order.userId).get()
      const user = Array.isArray(userData) ? userData[0] : userData
      openid = user?.openid || ''
    } catch (_) {}
    if (!openid) {
      stats.failed++
      continue
    }
    const env = order.sandbox === true ? 1 : 0
    try {
      const { queryOrder } = require('./heart-persona-virtual-pay')
      const queried = await queryOrder({ outTradeNo: order.outTradeNo, openid, env, wxOrderId: order.wxOrderId || '' })
      const q = queried?.order
      const wxStatus = Number(q?.status)
      await db.collection(RECHARGE_ORDERS).doc(order._id).update({
        lastQueryStatus: wxStatus,
        lastQueryAt: new Date(),
        updatedAt: new Date()
      }).catch(() => {})
      if ([5, 8].includes(wxStatus)) {
        const settled = await settleRechargeRefund(db, order, { reason: 'worker_refund_reconcile' })
        if (settled.success) stats.settled++
        else stats.failed++
      } else if (wxStatus === 7) {
        await db.collection(RECHARGE_ORDERS).doc(order._id).update({
          refundRequestStatus: 'anomaly',
          refundRequestError: `微信退款异常 status=${wxStatus}`,
          updatedAt: new Date()
        }).catch(() => {})
        stats.anomaly++
      } else {
        stats.stillProcessing++
      }
    } catch (error) {
      stats.failed++
    }
  }
  return stats
}

module.exports = { fulfillPayment, settleRechargeRefund, reconcileProcessingRefunds }
