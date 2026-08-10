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

  let commissionConfigSnapshot = null
  try {
    const { getCommissionConfig } = require('./referral-commission')
    commissionConfigSnapshot = await getCommissionConfig(db)
  } catch (error) {
    console.error('[referral-commission] report config snapshot failed', error)
  }

  const fulfillResult = await db.runTransaction(async (transaction) => {
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
    const actualPriceFen = Number.isInteger(Number(evidence.actualPriceFen)) ? Number(evidence.actualPriceFen) : Number(order.actualPriceFen || 0)
    const paidAt = evidence.paidAt || order.paidAt || now
    const transactionId = String(evidence.transactionId || order.transactionId || '')
    await transaction.collection('archetype_report_orders').doc(order._id).update({
      status: 'fulfilled',
      fulfillmentSource: String(source || ''),
      duplicatePaid,
      actualPriceFen,
      mchOrderNo: String(evidence.mchOrderNo || order.mchOrderNo || ''),
      transactionId,
      wxOrderIdVerified: String(evidence.wxOrderIdVerified || order.wxOrderIdVerified || ''),
      paidAt,
      fulfilledAt: now,
      lastErrorCode: '',
      lastErrorMessage: '',
      updatedAt: now
    })
    if (!duplicatePaid && actualPriceFen > 0) {
      const { buildJob, omitDocumentId } = require('./referral-commission')
      const job = buildJob({
        source: 'archetype_report_order',
        orderId: order._id,
        orderType: 'prop',
        userId: order.userId,
        paidAmountFen: actualPriceFen,
        paidAt,
        transactionId,
        commissionConfigSnapshot
      })
      const existingJob = firstDoc(await transaction.collection('referral_commission_jobs').doc(job._id).get())
      if (!existingJob) await transaction.collection('referral_commission_jobs').doc(job._id).set(omitDocumentId(job))
    }
    return { fulfilled: true, alreadyFulfilled: false, duplicatePaid, orderId: order._id, resultId: order.resultId }
  })
  return fulfillResult
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
  const mchRefundId = String(payload?.MchRefundId || payload?.mchRefundId || '').trim()
  if (order.refundOrderId && mchRefundId && String(order.refundOrderId) !== mchRefundId) {
    throw Object.assign(new Error('退款单号不一致'), { code: 'REFUND_VALIDATION_FAILED' })
  }
  if (order.wxOrderIdVerified && (!wxOrderId || String(order.wxOrderIdVerified) !== wxOrderId)) {
    throw Object.assign(new Error('退款微信订单号不一致'), { code: 'REFUND_VALIDATION_FAILED' })
  }
  const refundFeeFen = Number(payload?.RefundFee ?? payload?.refundFee)
  const notification = {
    wxRefundId,
    wxOrderId,
    mchRefundId,
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
      refundRequestStatus: 'failed',
      refundFeeFen,
      refundStartAt: notification.refundStartAt,
      refundRetCode: retCode,
      refundRetMessage: notification.retMsg,
      refundRetryTimes: notification.retryTimes,
      // 订单创建时 lastRefundNotification 初始为 null，事务/普通 update 对 null 字段做对象合并会
      // PathNotViable（Cannot create field ... in element {lastRefundNotification: null}），必须整体 set
      lastRefundNotification: db.command.set(notification),
      updatedAt: new Date()
    })
    return { refunded: false, retCode }
  }

  // 微信通知确认退款成功：统一走 finalizeOrderRefund 落库（回调与后台主动查单共用同一套事务逻辑）
  return finalizeOrderRefund(db, {
    outTradeNo,
    wxRefundId,
    mchRefundId: notification.mchRefundId,
    wxOrderId,
    refundFeeFen,
    retCode,
    retMsg: notification.retMsg,
    refundStartAt: notification.refundStartAt,
    refundSucceededAt: notification.refundSucceededAt,
    wxpayRefundTransactionId: notification.wxpayRefundTransactionId,
    retryTimes: notification.retryTimes,
    revokePurchase: options.refundRevokesPurchase !== false,
    source: 'wechat_notify'
  })
}

/**
 * 退款成功统一落库（幂等）：
 * - 事务内：报告权益撤销（可选）、订单 status/refundRequestStatus -> refunded、退款任务 -> refunded
 * - 事务外：佣金反转
 * 供微信退款回调（applyRefundNotification）与后台主动查单（adminQueryArchetypeReportRefund）共用。
 * 注意：lastRefundNotification 创建时初始为 null，必须 db.command.set 整体替换，否则事务内
 * 对 null 字段做对象合并会 PathNotViable（Cannot create field ... in element {lastRefundNotification: null}）。
 */
async function finalizeOrderRefund(db, {
  outTradeNo,
  wxRefundId,
  mchRefundId = '',
  wxOrderId = '',
  refundFeeFen,
  retCode = 0,
  retMsg = '',
  refundStartAt = null,
  refundSucceededAt = null,
  wxpayRefundTransactionId = '',
  retryTimes = 0,
  revokePurchase = true,
  source = 'wechat_notify'
}) {
  const refundResult = await db.runTransaction(async (transaction) => {
    const current = await getOrderByTradeNo(transaction, outTradeNo)
    if (!current) throw Object.assign(new Error('退款订单不存在'), { code: 'ORDER_NOT_FOUND' })
    if (current.status === 'refunded' && current.wxRefundId === wxRefundId) {
      // 重复通知：补写冲正补偿 job（幂等，存在不覆盖），确保首次冲正失败时由 worker 兜底重试
      try {
        const { writeReversalJob } = require('./referral-commission')
        await writeReversalJob(transaction, { source: 'archetype_report_order', orderId: current._id, refundAmountFen: refundFeeFen, reason: 'wechat_refund' })
      } catch (error) {
        console.error('[archetype-report-access] duplicate refund writeReversalJob failed', error)
      }
      return { refunded: true, duplicate: true }
    }
    const now = new Date()
    const notification = {
      wxRefundId,
      wxOrderId,
      mchRefundId,
      refundFeeFen,
      retCode,
      retMsg,
      refundStartAt,
      refundSucceededAt,
      wxpayRefundTransactionId,
      retryTimes,
      receivedAt: now,
      source
    }
    const resultResponse = await transaction.collection('archetype_results').doc(current.resultId).get()
    const result = firstDoc(resultResponse)
    if (revokePurchase !== false && String(result?.reportAccess?.purchaseOrderId || '') === String(current._id)) {
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
      refundRequestStatus: 'refunded',
      refundedAt: now,
      wxRefundId,
      ...(wxOrderId && !current.wxOrderIdVerified ? { wxOrderIdVerified: wxOrderId } : {}),
      mchRefundId,
      refundFeeFen,
      refundRetCode: retCode,
      refundRetMessage: retMsg,
      refundStartAt,
      refundSucceededAt: refundSucceededAt || now,
      wxpayRefundTransactionId,
      refundRetryTimes: retryTimes,
      lastRefundNotification: db.command.set({ ...notification, refundSucceededAt: refundSucceededAt || now }),
      updatedAt: now
    })
    const tasks = await transaction.collection('archetype_report_refund_tasks').where({ orderId: current._id }).get()
    for (const task of (tasks?.data || [])) {
      await transaction.collection('archetype_report_refund_tasks').doc(task._id).update({ status: 'refunded', updatedAt: now, handledAt: now })
    }
    // 事务内写冲正补偿 job（幂等）：即使事务外立即冲正失败，worker 也能按固定 ID 兜底重试，避免永久漏冲
    try {
      const { writeReversalJob } = require('./referral-commission')
      await writeReversalJob(transaction, { source: 'archetype_report_order', orderId: current._id, refundAmountFen: refundFeeFen, reason: 'wechat_refund' })
    } catch (error) {
      console.error('[archetype-report-access] finalize refund writeReversalJob failed', error)
    }
    return { refunded: true, duplicate: false, orderId: current._id, resultId: current.resultId }
  })
  if (refundResult.refunded && !refundResult.duplicate) {
    try {
      const { reverseCommissionForRefund } = require('./referral-commission')
      refundResult.commissionReversal = await reverseCommissionForRefund(db, {
        source: 'archetype_report_order',
        orderId: refundResult.orderId,
        refundAmountFen: refundFeeFen,
        reason: 'wechat_refund'
      })
    } catch (error) {
      console.error('[referral-commission] report refund reversal failed', error)
      refundResult.commissionReversal = { success: false, reason: 'REVERSAL_FAILED' }
    }
  }
  return refundResult
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
  applyRefundNotification,
  finalizeOrderRefund
}
