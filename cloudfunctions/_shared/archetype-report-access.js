'use strict'

const { checkFeatureAccess, getSubscriptionConfig } = require('./subscription')
const {
  FEATURE_RELATION,
  FEATURE_CELEBRITY,
  FEATURE_CHARACTER,
  normalizeSubjectGender
} = require('./archetype-bank')

const KINDS = new Set(['relation_archetype', 'crush_celebrity', 'dimension_character'])

function featureKeyForResult(kind, subjectGender) {
  const normalizedKind = String(kind || '').trim()
  if (normalizedKind === 'relation_archetype') {
    const gender = normalizeSubjectGender(subjectGender)
    if (!['female', 'male'].includes(gender)) return ''
    return FEATURE_RELATION
  }
  if (normalizedKind === 'crush_celebrity') return FEATURE_CELEBRITY
  if (normalizedKind === 'dimension_character') return FEATURE_CHARACTER
  return ''
}

function normalizePaymentConfig(config) {
  const raw = config?.heartPersonaReportPayment || {}
  const allowedFeatures = Array.isArray(raw.allowedFeatures)
    ? raw.allowedFeatures.map((item) => String(item || '').trim()).filter(Boolean)
    : []
  return {
    enabled: raw.enabled === true,
    answerBeforePayEnabled: raw.answerBeforePayEnabled === true,
    priceFen: Number(raw.priceFen),
    sandboxProductId: String(raw.sandboxProductId || '').trim(),
    productionProductId: String(raw.productionProductId || '').trim(),
    allowedFeatures,
    refundRevokesPurchase: raw.refundRevokesPurchase !== false
  }
}

function isPermanentlyUnlocked(result) {
  return result?.reportAccess?.purchaseState === 'unlocked'
}

async function resolveQuizAccess(db, userId, kind, subjectGender) {
  const featureKey = featureKeyForResult(kind, subjectGender)
  if (!featureKey) return { allowed: false, subscriptionAllowed: false, funnelAllowed: false, featureKey, code: 'INVALID_ARGUMENT' }

  const [subscription, config] = await Promise.all([
    checkFeatureAccess(db, userId, featureKey),
    getSubscriptionConfig(db)
  ])
  const payment = normalizePaymentConfig(config)
  const funnelAllowed = payment.enabled && payment.answerBeforePayEnabled && payment.allowedFeatures.includes(featureKey)
  return {
    allowed: subscription?.allowed === true || funnelAllowed,
    subscriptionAllowed: subscription?.allowed === true,
    funnelAllowed,
    featureKey,
    payment,
    reason: subscription?.reason || ''
  }
}

async function resolveReportAccess(db, userId, result) {
  const featureKey = featureKeyForResult(result?.kind, result?.subjectGender)
  if (!featureKey) return { accessLevel: 'preview', subscriptionAllowed: false, permanentResultUnlock: false, featureKey: '' }
  const [subscription, config] = await Promise.all([
    checkFeatureAccess(db, userId, featureKey),
    getSubscriptionConfig(db)
  ])
  const payment = normalizePaymentConfig(config)
  const subscriptionAllowed = subscription?.allowed === true
  const permanentResultUnlock = isPermanentlyUnlocked(result)
  const canPurchase = !subscriptionAllowed && !permanentResultUnlock && payment.enabled && payment.allowedFeatures.includes(featureKey)
  return {
    accessLevel: subscriptionAllowed || permanentResultUnlock ? 'full' : 'preview',
    subscriptionAllowed,
    permanentResultUnlock,
    canPurchase,
    featureKey,
    payment
  }
}

function firstDoc(response) {
  const data = response?.data
  return Array.isArray(data) ? data[0] || null : data || null
}

async function getOrderByTradeNo(dbLike, outTradeNo) {
  const response = await dbLike.collection('archetype_report_orders').where({ outTradeNo }).limit(1).get()
  return firstDoc(response)
}

async function ensureRefundTask(transaction, order, now) {
  const existing = await transaction.collection('archetype_report_refund_tasks').where({ orderId: order._id }).limit(1).get()
  if (firstDoc(existing)) return
  await transaction.collection('archetype_report_refund_tasks').add({
    orderId: order._id,
    outTradeNo: order.outTradeNo,
    userId: order.userId,
    resultId: order.resultId,
    reason: 'duplicate_paid',
    status: 'pending',
    amountFen: order.origPriceFen,
    createdAt: now,
    updatedAt: now,
    handledBy: '',
    handledAt: null,
    handleNote: '',
    auditTrail: []
  })
}

async function fulfillReportOrder(db, { outTradeNo, source, paymentEvidence = {} }) {
  const tradeNo = String(outTradeNo || '').trim()
  if (!tradeNo) throw Object.assign(new Error('缺少 outTradeNo'), { code: 'INVALID_ARGUMENT' })
  if (typeof db.runTransaction !== 'function') throw Object.assign(new Error('数据库事务不可用'), { code: 'TRANSACTION_UNAVAILABLE' })

  return db.runTransaction(async (transaction) => {
    const order = await getOrderByTradeNo(transaction, tradeNo)
    if (!order) throw Object.assign(new Error('订单不存在'), { code: 'ORDER_NOT_FOUND' })
    if (order.status === 'fulfilled') return { fulfilled: true, alreadyFulfilled: true, duplicatePaid: order.duplicatePaid === true, order }
    if (['refunded', 'closed', 'exception'].includes(order.status)) {
      throw Object.assign(new Error(`订单状态 ${order.status} 不允许发货`), { code: 'ORDER_STATE_INVALID' })
    }

    const resultResponse = await transaction.collection('archetype_results').doc(order.resultId).get()
    const result = firstDoc(resultResponse)
    if (!result || String(result.userId || '') !== String(order.userId || '')) {
      await transaction.collection('archetype_report_orders').doc(order._id).update({
        status: 'exception',
        lastErrorCode: 'RESULT_OWNERSHIP_MISMATCH',
        lastErrorMessage: '订单与结果归属不一致',
        updatedAt: new Date()
      })
      throw Object.assign(new Error('订单与结果归属不一致'), { code: 'ORDER_VALIDATION_FAILED' })
    }

    const now = new Date()
    await transaction.collection('archetype_report_orders').doc(order._id).update({ status: 'fulfilling', updatedAt: now })
    const existingOrderId = String(result?.reportAccess?.purchaseOrderId || '')
    const duplicatePaid = result?.reportAccess?.purchaseState === 'unlocked' && existingOrderId && existingOrderId !== String(order._id)
    if (duplicatePaid) {
      await ensureRefundTask(transaction, order, now)
    } else {
      await transaction.collection('archetype_results').doc(order.resultId).update({
        reportAccess: {
          purchaseState: 'unlocked',
          purchaseOrderId: order._id,
          purchasedAt: now,
          revokedAt: null,
          revokeReason: ''
        },
        updatedAt: now
      })
    }

    const evidence = paymentEvidence && typeof paymentEvidence === 'object' ? paymentEvidence : {}
    await transaction.collection('archetype_report_orders').doc(order._id).update({
      status: 'fulfilled',
      fulfillmentSource: String(source || ''),
      duplicatePaid,
      actualPriceFen: Number.isInteger(Number(evidence.actualPriceFen)) ? Number(evidence.actualPriceFen) : order.actualPriceFen,
      mchOrderNo: String(evidence.mchOrderNo || order.mchOrderNo || ''),
      transactionId: String(evidence.transactionId || order.transactionId || ''),
      wxOrderIdVerified: String(evidence.wxOrderIdVerified || order.wxOrderIdVerified || ''),
      paidAt: evidence.paidAt || order.paidAt || now,
      fulfilledAt: now,
      lastErrorCode: '',
      lastErrorMessage: '',
      updatedAt: now
    })
    return { fulfilled: true, alreadyFulfilled: false, duplicatePaid, orderId: order._id, resultId: order.resultId }
  })
}

async function applyRefundNotification(db, payload, options = {}) {
  const outTradeNo = String(payload?.MchOrderId || payload?.mchOrderId || '').trim()
  const wxRefundId = String(payload?.WxRefundId || payload?.wxRefundId || '').trim()
  const wxOrderId = String(payload?.WxOrderId || payload?.wxOrderId || '').trim()
  const retCode = Number(payload?.RetCode ?? payload?.retCode)
  if (!outTradeNo || !wxRefundId) throw Object.assign(new Error('退款凭据不完整'), { code: 'REFUND_VALIDATION_FAILED' })
  const existing = await db.collection('archetype_report_orders').where({ wxRefundId }).limit(1).get()
  const duplicate = firstDoc(existing)
  if (duplicate) return { refunded: duplicate.status === 'refunded', duplicate: true }
  const order = await getOrderByTradeNo(db, outTradeNo)
  if (!order) throw Object.assign(new Error('退款订单不存在'), { code: 'ORDER_NOT_FOUND' })
  if (String(payload?.OpenId || payload?.openid || '') !== String(order.openidSnapshot || '')) {
    throw Object.assign(new Error('退款 OpenId 不一致'), { code: 'REFUND_VALIDATION_FAILED' })
  }
  if (order.wxOrderIdVerified && (!wxOrderId || String(order.wxOrderIdVerified) !== wxOrderId)) {
    throw Object.assign(new Error('退款微信订单号不一致'), { code: 'REFUND_VALIDATION_FAILED' })
  }
  const refundFeeFen = Number(payload?.RefundFee ?? payload?.refundFee)
  const notification = {
    wxRefundId,
    wxOrderId,
    mchRefundId: String(payload?.MchRefundId || payload?.mchRefundId || ''),
    refundFeeFen,
    retCode,
    retMsg: String(payload?.RetMsg || payload?.retMsg || ''),
    refundStartAt: payload?.RefundStartTimestamp || payload?.refundStartTimestamp || null,
    refundSucceededAt: payload?.RefundSuccTimestamp || payload?.refundSuccTimestamp || null,
    wxpayRefundTransactionId: String(payload?.WxpayRefundTransactionId || payload?.wxpayRefundTransactionId || ''),
    retryTimes: Number(payload?.RetryTimes || payload?.retryTimes || 0),
    receivedAt: new Date()
  }
  if (!Number.isInteger(refundFeeFen) || refundFeeFen < 0 || refundFeeFen > Number(order.origPriceFen)) {
    throw Object.assign(new Error('退款金额无效'), { code: 'REFUND_VALIDATION_FAILED' })
  }
  if (retCode !== 0) {
    await db.collection('archetype_report_orders').doc(order._id).update({
      refundFeeFen,
      refundStartAt: notification.refundStartAt,
      refundRetCode: retCode,
      refundRetMessage: notification.retMsg,
      refundRetryTimes: notification.retryTimes,
      lastRefundNotification: notification,
      updatedAt: new Date()
    })
    return { refunded: false, retCode }
  }

  return db.runTransaction(async (transaction) => {
    const current = await getOrderByTradeNo(transaction, outTradeNo)
    if (!current) throw Object.assign(new Error('退款订单不存在'), { code: 'ORDER_NOT_FOUND' })
    if (current.status === 'refunded' && current.wxRefundId === wxRefundId) return { refunded: true, duplicate: true }
    const now = new Date()
    const resultResponse = await transaction.collection('archetype_results').doc(current.resultId).get()
    const result = firstDoc(resultResponse)
    if (options.refundRevokesPurchase !== false && String(result?.reportAccess?.purchaseOrderId || '') === String(current._id)) {
      await transaction.collection('archetype_results').doc(current.resultId).update({
        reportAccess: {
          purchaseState: 'revoked',
          purchaseOrderId: current._id,
          purchasedAt: result?.reportAccess?.purchasedAt || null,
          revokedAt: now,
          revokeReason: 'wechat_refund'
        },
        updatedAt: now
      })
    }
    await transaction.collection('archetype_report_orders').doc(current._id).update({
      status: 'refunded',
      refundedAt: now,
      wxRefundId,
      ...(wxOrderId && !current.wxOrderIdVerified ? { wxOrderIdVerified: wxOrderId } : {}),
      mchRefundId: notification.mchRefundId,
      refundFeeFen,
      refundRetCode: retCode,
      refundRetMessage: notification.retMsg,
      refundStartAt: notification.refundStartAt,
      refundSucceededAt: notification.refundSucceededAt || now,
      wxpayRefundTransactionId: notification.wxpayRefundTransactionId,
      refundRetryTimes: notification.retryTimes,
      lastRefundNotification: { ...notification, refundSucceededAt: notification.refundSucceededAt || now },
      updatedAt: now
    })
    const tasks = await transaction.collection('archetype_report_refund_tasks').where({ orderId: current._id }).get()
    for (const task of (tasks?.data || [])) {
      await transaction.collection('archetype_report_refund_tasks').doc(task._id).update({ status: 'refunded', updatedAt: now, handledAt: now })
    }
    return { refunded: true, duplicate: false, orderId: current._id, resultId: current.resultId }
  })
}

module.exports = {
  KINDS,
  featureKeyForResult,
  normalizePaymentConfig,
  isPermanentlyUnlocked,
  resolveQuizAccess,
  resolveReportAccess,
  getOrderByTradeNo,
  fulfillReportOrder,
  applyRefundNotification
}
