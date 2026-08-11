const crypto = require('crypto')
const cloudbase = require('@cloudbase/node-sdk')
const { XMLParser } = require('fast-xml-parser')
const { normalizeMediaCheckCallback } = require('./_shared/content-security')
const { storeAvatarSecurityProof } = require('./_shared/avatar-security')
const { getOrderByTradeNo, fulfillReportOrder, applyRefundNotification, normalizePaymentConfig } = require('./_shared/archetype-report-access')
const { fulfillPayment } = require('./_shared/payment-fulfillment')
const { getSubscriptionConfig } = require('./_shared/subscription')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const CHECK_COLLECTION = 'content_security_checks'
const RECHARGE_ORDERS = 'recharge_orders'
const RESULT_TTL_MS = 24 * 60 * 60 * 1000
let checkCollectionReady = false

async function ensureCheckCollection() {
  if (checkCollectionReady) return
  try {
    await db.createCollection(CHECK_COLLECTION)
  } catch (error) {
    const message = String(error?.message || '').toLowerCase()
    if (!message.includes('already') && !message.includes('exist') && error?.code !== 'DATABASE_COLLECTION_ALREADY_EXISTS') {
      throw error
    }
  }
  checkCollectionReady = true
}

function textResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
    body: String(body || '')
  }
}

function structuredResponse(statusCode, body, contentType) {
  return { statusCode, headers: { 'content-type': contentType }, body }
}

function getQuery(event) {
  if (event?.queryStringParameters && typeof event.queryStringParameters === 'object') {
    return event.queryStringParameters
  }
  if (event?.queryString && typeof event.queryString === 'object') return event.queryString
  if (typeof event?.queryString === 'string') return Object.fromEntries(new URLSearchParams(event.queryString))
  const rawQuery = String(event?.rawQueryString || '').trim()
  return rawQuery ? Object.fromEntries(new URLSearchParams(rawQuery)) : {}
}

function verifyMessageSignature(token, query) {
  const signature = String(query?.signature || '').trim()
  const timestamp = String(query?.timestamp || '').trim()
  const nonce = String(query?.nonce || '').trim()
  if (!token || !signature || !timestamp || !nonce) return false
  const expected = crypto.createHash('sha1').update([token, timestamp, nonce].sort().join('')).digest('hex')
  const left = Buffer.from(expected)
  const right = Buffer.from(signature)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

function parseBody(event) {
  let body = event?.body
  if (event?.isBase64Encoded && typeof body === 'string') body = Buffer.from(body, 'base64').toString('utf8')
  if (body && typeof body === 'object') return body
  try {
    return JSON.parse(String(body || '{}'))
  } catch (_) {
    return null
  }
}

function parseRequestBody(event) {
  let body = event?.body
  if (event?.isBase64Encoded && typeof body === 'string') body = Buffer.from(body, 'base64').toString('utf8')
  if (body && typeof body === 'object') return { payload: body, format: 'json' }
  const raw = String(body || '').trim()
  if (!raw) return { payload: null, format: 'json' }
  if (raw.startsWith('<')) {
    try {
      const parsed = new XMLParser({ ignoreAttributes: false, parseTagValue: false, trimValues: true }).parse(raw)
      return { payload: parsed?.xml || parsed, format: 'xml' }
    } catch (_) {
      return { payload: null, format: 'xml' }
    }
  }
  try { return { payload: JSON.parse(raw), format: 'json' } } catch (_) { return { payload: null, format: 'json' } }
}

function paymentCallbackResponse(format, errCode, errMsg) {
  if (format === 'xml') {
    const safeMessage = String(errMsg || '').split(']]>').join(']]]]><![CDATA[>')
    const body = `<xml><ErrCode>${Number(errCode)}</ErrCode><ErrMsg><![CDATA[${safeMessage}]]></ErrMsg></xml>`
    return structuredResponse(Number(errCode) === 0 ? 200 : 500, body, 'application/xml; charset=utf-8')
  }
  return structuredResponse(Number(errCode) === 0 ? 200 : 500, JSON.stringify({ ErrCode: Number(errCode), ErrMsg: String(errMsg || '') }), 'application/json; charset=utf-8')
}

function callbackDigest(payload) {
  const summary = {
    event: payload?.Event || payload?.event || '',
    outTradeNo: payload?.OutTradeNo || payload?.MchOrderId || '',
    transactionId: payload?.WeChatPayInfo?.TransactionId || payload?.WxpayRefundTransactionId || '',
    wxRefundId: payload?.WxRefundId || ''
  }
  return crypto.createHash('sha256').update(JSON.stringify(summary), 'utf8').digest('hex')
}

function validateDeliveryPayload(payload, order) {
  const goods = payload?.GoodsInfo || {}
  const pay = payload?.WeChatPayInfo || {}
  const actualPrice = Number(goods.ActualPrice)
  const failures = []
  if (String(payload?.MsgType || '').toLowerCase() !== 'event') failures.push('MsgType')
  if (String(payload?.Event || '') !== 'xpay_goods_deliver_notify') failures.push('Event')
  if (String(payload?.OpenId || '') !== String(order?.openidSnapshot || '')) failures.push('OpenId')
  if (Number(payload?.Env) !== Number(order?.env)) failures.push('Env')
  if (String(goods.ProductId || '') !== String(order?.productId || '')) failures.push('ProductId')
  if (Number(goods.Quantity) !== 1) failures.push('Quantity')
  if (Number(goods.OrigPrice) !== Number(order?.origPriceFen)) failures.push('OrigPrice')
  if (!Number.isInteger(actualPrice) || actualPrice < 0 || actualPrice > Number(order?.origPriceFen)) failures.push('ActualPrice')
  if (String(goods.Attach || '') !== String(order?.attach || '')) failures.push('Attach')
  if (Number(pay.PaidTime) <= 0) failures.push('PaidTime')
  if (order?.transactionId && String(order.transactionId) !== String(pay.TransactionId || '')) failures.push('TransactionId')
  if (order?.mchOrderNo && String(order.mchOrderNo) !== String(pay.MchOrderNo || '')) failures.push('MchOrderNo')
  return { valid: failures.length === 0, failures, goods, pay, actualPrice }
}

/**
 * 现金单统一查单：道具（archetype_report_orders）→ 充值/套餐（recharge_orders）。
 * 微信对现金单（道具直购与代币充值）支付成功后均推送 xpay_goods_deliver_notify，
 * 两条线的回调都从这里分流处理。
 */
async function findCashOrderByTradeNo(dbLike, outTradeNo) {
  const report = await getOrderByTradeNo(dbLike, outTradeNo)
  if (report) return { order: report, kind: 'report' }
  const response = await dbLike.collection(RECHARGE_ORDERS).where({ outTradeNo }).limit(1).get()
  const order = (response.data && response.data.length > 0) ? response.data[0] : null
  return order ? { order, kind: 'recharge' } : null
}

/**
 * 充值/套餐（代币 short_series_coin）订单发货推送验单。
 * 严格项：事件类型/Env/金额（ActualPrice、OrigPrice）/Attach（按订单字段确定性重建）/PaidTime/TransactionId（已履约订单）。
 * 宽松项（仅记录不阻断）：OpenId（用户 openid 缺失时跳过）、Quantity/ProductId（代币模式语义取决于商户后台代币配置）。
 */
async function validateRechargeDeliveryPayload(payload, order, dbLike = db) {
  const goods = payload?.GoodsInfo || {}
  const pay = payload?.WeChatPayInfo || {}
  const actualPrice = Number(goods.ActualPrice)
  const failures = []
  const warnings = []
  if (String(payload?.MsgType || '').toLowerCase() !== 'event') failures.push('MsgType')
  if (String(payload?.Event || '') !== 'xpay_goods_deliver_notify') failures.push('Event')
  if (Number(payload?.Env) !== (order.sandbox === true ? 1 : 0)) failures.push('Env')
  if (!Number.isInteger(actualPrice) || actualPrice !== Number(order.amountFen)) failures.push('ActualPrice')
  if (Number(goods.OrigPrice) !== Number(order.amountFen)) failures.push('OrigPrice')
  const expectedAttach = order.productType === 'subscription'
    ? JSON.stringify({ userId: order.userId, productType: 'subscription', planKey: order.planKey, billingCycle: order.billingCycle })
    : JSON.stringify({ userId: order.userId, productType: 'recharge', planId: order.planId })
  if (String(goods.Attach || '') !== expectedAttach) failures.push('Attach')
  if (Number(pay.PaidTime) <= 0) failures.push('PaidTime')
  if (order.transactionId && String(order.transactionId) !== String(pay.TransactionId || '')) failures.push('TransactionId')
  try {
    const { data: userData } = await dbLike.collection('users').doc(order.userId).get()
    const user = (userData && userData.length > 0) ? userData[0] : null
    if (user?.openid && String(payload?.OpenId || '') !== String(user.openid)) failures.push('OpenId')
  } catch (_) { /* 查不到用户 openid 时跳过 OpenId 校验，避免误伤 */ }
  if (goods.Quantity != null && Number(goods.Quantity) !== Number(order.amountFen)) warnings.push(`Quantity:${goods.Quantity}vs${order.amountFen}`)
  if (goods.ProductId && order.planId && String(goods.ProductId) !== String(order.planId)) warnings.push(`ProductId:${goods.ProductId}vs${order.planId}`)
  return { valid: failures.length === 0, failures, warnings, goods, pay, actualPrice }
}

/**
 * 充值/套餐发货推送处理：验单 → fulfillPayment（发 token/升套餐 + 分佣入队，幂等）→ 回包 0。
 * 验单失败保持订单 pending 并记录错误（微信会按 2/4/8... 重试，最多 15 次），由后台查单对账兜底。
 */
async function handleRechargeDelivery(payload, order) {
  const validation = await validateRechargeDeliveryPayload(payload, order)
  const digest = callbackDigest(payload)
  if (!validation.valid) {
    await db.collection(RECHARGE_ORDERS).doc(order._id).update({
      lastErrorCode: 'ORDER_VALIDATION_FAILED',
      lastErrorMessage: `callback mismatch: ${validation.failures.join(',')}`,
      callbackDigest: digest,
      updatedAt: new Date()
    }).catch(() => {})
    return { ok: false, code: 'ORDER_VALIDATION_FAILED' }
  }
  if (validation.warnings.length > 0) {
    console.warn('contentSecCallback recharge delivery warnings:', validation.warnings.join(';'))
  }
  if (order.status === 'paid' && order.fulfillmentStatus === 'succeeded') {
    await db.collection(RECHARGE_ORDERS).doc(order._id).update({ callbackDigest: digest, updatedAt: new Date() }).catch(() => {})
    return { ok: true, code: 'OK', duplicate: true }
  }
  await fulfillPayment(db, { ...order, _id: order._id }, String(validation.pay.TransactionId || '') || `push:${order._id}`)
  await db.collection(RECHARGE_ORDERS).doc(order._id).update({
    callbackDigest: digest,
    fulfillmentSource: 'push',
    updatedAt: new Date()
  }).catch(() => {})
  return { ok: true, code: 'OK' }
}

async function handleGoodsDelivery(payload) {
  const outTradeNo = String(payload?.OutTradeNo || '').trim()
  const found = outTradeNo ? await findCashOrderByTradeNo(db, outTradeNo) : null
  if (!found) return { ok: false, code: 'ORDER_NOT_FOUND' }
  if (found.kind === 'recharge') return await handleRechargeDelivery(payload, found.order)
  const order = found.order
  const validation = validateDeliveryPayload(payload, order)
  if (!validation.valid) {
    await db.collection('archetype_report_orders').doc(order._id).update({
      status: 'exception',
      lastErrorCode: 'ORDER_VALIDATION_FAILED',
      lastErrorMessage: `callback mismatch: ${validation.failures.join(',')}`,
      callbackDigest: callbackDigest(payload),
      updatedAt: new Date()
    })
    return { ok: false, code: 'ORDER_VALIDATION_FAILED' }
  }
  const paidAt = new Date(Number(validation.pay.PaidTime) * 1000)
  await fulfillReportOrder(db, {
    outTradeNo,
    source: 'push',
    paymentEvidence: {
      actualPriceFen: validation.actualPrice,
      mchOrderNo: validation.pay.MchOrderNo,
      transactionId: validation.pay.TransactionId,
      paidAt
    }
  })
  await db.collection('archetype_report_orders').doc(order._id).update({ callbackDigest: callbackDigest(payload), updatedAt: new Date() })
  return { ok: true, code: 'OK' }
}

async function handleRefundNotify(payload) {
  const config = normalizePaymentConfig(await getSubscriptionConfig(db))
  const result = await applyRefundNotification(db, payload, { refundRevokesPurchase: config.refundRevokesPurchase })
  return { ok: true, code: result.refunded ? 'REFUNDED' : 'REFUND_NOT_SUCCEEDED', result }
}

/**
 * 充值/套餐退款推送（xpay_refund_notify）：退款完成后微信推送。
 * RetCode=0 → settleRechargeRefund 统一落库（回退套餐/扣 token/冲正佣金，幂等）；
 * RetCode≠0 → 记录失败状态（微信会按 2/4/8... 重试，最多 15 次）。
 */
async function handleRechargeRefundNotify(payload) {
  const outTradeNo = String(payload?.MchOrderId || payload?.mchOrderId || '').trim()
  const wxRefundId = String(payload?.WxRefundId || payload?.wxRefundId || '').trim()
  const retCode = Number(payload?.RetCode ?? payload?.retCode)
  if (!outTradeNo || !wxRefundId) return { ok: false, code: 'REFUND_VALIDATION_FAILED' }

  const response = await db.collection(RECHARGE_ORDERS).where({ outTradeNo }).limit(1).get()
  const order = (response.data && response.data.length > 0) ? response.data[0] : null
  if (!order) return { ok: false, code: 'ORDER_NOT_FOUND' }

  const notification = {
    wxRefundId,
    mchRefundId: String(payload?.MchRefundId || payload?.mchRefundId || ''),
    wxOrderId: String(payload?.WxOrderId || payload?.wxOrderId || ''),
    refundFeeFen: Number(payload?.RefundFee ?? payload?.refundFee),
    retCode,
    retMsg: String(payload?.RetMsg || payload?.retMsg || '').slice(0, 300),
    refundSucceededAt: payload?.RefundSuccTimestamp || payload?.refundSuccTimestamp || null,
    wxpayRefundTransactionId: String(payload?.WxpayRefundTransactionId || payload?.wxpayRefundTransactionId || ''),
    retryTimes: Number(payload?.RetryTimes || payload?.retryTimes || 0),
    receivedAt: new Date()
  }

  if (order.status === 'refunded') {
    // 幂等：已退款订单重复通知仅记录
    await db.collection(RECHARGE_ORDERS).doc(order._id).update({
      lastRefundNotification: db.command.set(notification),
      updatedAt: new Date()
    }).catch(() => {})
    return { ok: true, code: 'REFUNDED_DUPLICATE' }
  }

  // OpenId 校验（用户 openid 缺失时降级跳过）
  try {
    const { data: userData } = await db.collection('users').doc(order.userId).get()
    const user = (userData && userData.length > 0) ? userData[0] : null
    if (user?.openid && String(payload?.OpenId || '') !== String(user.openid)) return { ok: false, code: 'REFUND_VALIDATION_FAILED' }
  } catch (_) {}

  const refundFeeFen = Number(payload?.RefundFee ?? payload?.refundFee)
  // P2：当前业务仅支持全额退款（refundOrder 强制 leftFee === amountFen），
  // 退款通知金额必须等于订单金额，部分退款/金额不符一律拒绝，避免错误撤销整单权益
  if (!Number.isInteger(refundFeeFen) || refundFeeFen !== Number(order.amountFen || 0)) {
    return { ok: false, code: 'REFUND_VALIDATION_FAILED' }
  }
  // P2：已保存退款单号时，通知的 MchRefundId 必须一致（为空也拒绝——无法关联退款任务）
  if (order.refundOrderId && String(order.refundOrderId) !== String(notification.mchRefundId || '')) {
    return { ok: false, code: 'REFUND_VALIDATION_FAILED' }
  }
  // P2：已保存微信订单号时，通知的 WxOrderId 必须一致
  if (order.wxOrderId && String(order.wxOrderId) !== String(notification.wxOrderId || '')) {
    return { ok: false, code: 'REFUND_VALIDATION_FAILED' }
  }

  if (retCode !== 0) {
    await db.collection(RECHARGE_ORDERS).doc(order._id).update({
      refundRequestStatus: 'failed',
      refundRetCode: retCode,
      refundRetMessage: notification.retMsg,
      refundRetryTimes: notification.retryTimes,
      lastRefundNotification: db.command.set(notification),
      updatedAt: new Date()
    }).catch(() => {})
    return { ok: true, code: 'REFUND_NOT_SUCCEEDED' }
  }

  const { settleRechargeRefund } = require('./_shared/payment-fulfillment')
  const settled = await settleRechargeRefund(db, order, { reason: 'wechat_refund_notify' })
  await db.collection(RECHARGE_ORDERS).doc(order._id).update({
    lastRefundNotification: db.command.set(notification),
    updatedAt: new Date()
  }).catch(() => {})
  if (!settled.success) {
    // 结算失败必须回错误码：微信会按 2/4/8... 重试（最多 15 次），期间可能自愈；同时后台查单对账兜底
    return { ok: false, code: `REFUND_SETTLE_FAILED:${settled.reason || 'UNKNOWN'}` }
  }
  return { ok: true, code: 'REFUNDED' }
}

let xpayEventsReady = false
async function ensureXpayEventsCollection() {
  if (xpayEventsReady) return
  try {
    await db.createCollection('xpay_event_records')
  } catch (error) {
    const message = String(error?.message || '').toLowerCase()
    if (!message.includes('already') && !message.includes('exist') && error?.code !== 'DATABASE_COLLECTION_ALREADY_EXISTS') {
      throw error
    }
  }
  xpayEventsReady = true
}

/**
 * 投诉/风控推送（xpay_complaint_notify / xpay_wxpay_callback_notify）落库记录。
 * 合规事件：即使不处理业务也必须留痕，回包 0 停止重试。
 */
async function recordXpayEvent(payload) {
  const eventName = String(payload?.Event || payload?.event || '')
  const record = {
    event: eventName,
    openId: String(payload?.OpenId || payload?.openId || ''),
    receivedAt: new Date()
  }
  if (eventName === 'xpay_complaint_notify') {
    record.complaintId = String(payload?.ComplaintId || payload?.complaintId || '')
    record.wxOrderId = String(payload?.WxOrderId || payload?.wxOrderId || '')
    record.mchOrderId = String(payload?.MchOrderId || payload?.mchOrderId || '')
    record.complaintDetail = String(payload?.ComplaintDetail || payload?.complaintDetail || '').slice(0, 500)
    record.complaintTime = payload?.ComplaintTime || payload?.complaintTime || null
    record.retryTimes = Number(payload?.RetryTimes || payload?.retryTimes || 0)
  } else if (eventName === 'xpay_wxpay_callback_notify') {
    record.businessCode = String(payload?.BusinessCode || payload?.businessCode || '')
    record.businessState = String(payload?.BusinessState || payload?.businessState || '')
    record.eventType = String(payload?.EventType || payload?.eventType || '')
    record.businessTime = String(payload?.BusinessTime || payload?.businessTime || '')
    record.remark = String(payload?.Remark || payload?.remark || '').slice(0, 500)
  }
  try {
    await ensureXpayEventsCollection()
    await db.collection('xpay_event_records').add(record)
  } catch (error) {
    console.error('contentSecCallback recordXpayEvent failed:', error)
  }
  return { ok: true }
}

async function findCheckByTraceId(traceId) {
  await ensureCheckCollection()
  const result = await db.collection(CHECK_COLLECTION).where({ traceId }).limit(1).get()
  return Array.isArray(result?.data) ? result.data[0] || null : null
}

async function applyMediaCheckResult(payload) {
  const normalized = normalizeMediaCheckCallback(payload)
  if (!normalized.valid) return { ok: false, code: normalized.code }

  const check = await findCheckByTraceId(normalized.traceId)
  if (!check?._id) {
    console.warn('contentSecCallback trace_id not found:', normalized.traceId)
    return { ok: true, code: 'CHECK_NOT_FOUND' }
  }

  const nowMs = Date.now()
  if (normalized.status === 'pass' && check.scene === 'avatar') {
    await storeAvatarSecurityProof(db, check.userId, check.fileID, nowMs)
  }

  await db.collection(CHECK_COLLECTION).doc(check._id).update({
    status: normalized.status,
    code: normalized.code,
    suggest: normalized.suggest || '',
    label: normalized.label,
    callbackErrCode: normalized.errCode,
    updatedAtMs: nowMs,
    checkedAtMs: nowMs,
    expiresAtMs: nowMs + RESULT_TTL_MS
  })

  return { ok: true, code: normalized.code, status: normalized.status }
}

exports.main = async (event = {}) => {
  const method = String(event.httpMethod || event.requestContext?.http?.method || '').toUpperCase()
  if (!method) return textResponse(400, 'HTTP only')

  const token = String(process.env.WECHAT_MESSAGE_TOKEN || '').trim()
  if (!token) {
    console.error('contentSecCallback missing WECHAT_MESSAGE_TOKEN')
    return textResponse(503, 'callback unavailable')
  }

  const query = getQuery(event)
  if (!verifyMessageSignature(token, query)) return textResponse(403, 'invalid signature')
  if (String(query.encrypt_type || '').toLowerCase() === 'aes' || query.msg_signature) {
    console.error('contentSecCallback ENCRYPTED_CALLBACK_UNSUPPORTED')
    return textResponse(400, 'encrypted callback unsupported')
  }

  if (method === 'GET') {
    const echo = String(query.echostr || '').trim()
    return echo ? textResponse(200, echo) : textResponse(400, 'missing echostr')
  }
  if (method !== 'POST') return textResponse(405, 'method not allowed')

  const parsed = parseRequestBody(event)
  const payload = parsed.payload
  const eventName = String(payload?.Event || payload?.event || '').trim()
  if (!payload) return textResponse(400, 'invalid event')

  try {
    if (eventName === 'wxa_media_check') {
      await applyMediaCheckResult(payload)
      return textResponse(200, 'success')
    }
    if (eventName === 'xpay_goods_deliver_notify') {
      const result = await handleGoodsDelivery(payload)
      return paymentCallbackResponse(parsed.format, result.ok ? 0 : 1, result.ok ? 'success' : result.code)
    }
    if (eventName === 'xpay_refund_notify') {
      let result
      try {
        result = await handleRefundNotify(payload)
      } catch (error) {
        // 道具线查不到订单（ORDER_NOT_FOUND）→ 尝试充值/套餐线
        if (error?.code === 'ORDER_NOT_FOUND') {
          result = await handleRechargeRefundNotify(payload)
        } else {
          throw error
        }
      }
      return paymentCallbackResponse(parsed.format, result.ok ? 0 : 1, result.ok ? 'success' : result.code)
    }
    if (eventName === 'xpay_complaint_notify' || eventName === 'xpay_wxpay_callback_notify') {
      // 合规事件留痕落库，回包 0 停止微信重试
      const result = await recordXpayEvent(payload)
      return paymentCallbackResponse(parsed.format, result.ok ? 0 : 1, result.ok ? 'success' : result.code)
    }
    console.warn('contentSecCallback ignored verified event:', eventName || 'unknown')
    return parsed.format === 'xml' ? paymentCallbackResponse('xml', 0, 'success') : textResponse(200, 'success')
  } catch (error) {
    console.error('contentSecCallback failed:', error)
    if (eventName.startsWith('xpay_')) return paymentCallbackResponse(parsed.format, 1, error?.code || 'failed')
    return textResponse(500, 'failed')
  }
}

module.exports._test = {
  getQuery,
  verifyMessageSignature,
  parseBody,
  parseRequestBody,
  paymentCallbackResponse,
  validateDeliveryPayload,
  validateRechargeDeliveryPayload,
  callbackDigest,
  applyMediaCheckResult,
  handleGoodsDelivery,
  handleRefundNotify,
  handleRechargeRefundNotify,
  recordXpayEvent
}
