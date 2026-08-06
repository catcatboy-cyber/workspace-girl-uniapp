const crypto = require('crypto')
const cloudbase = require('@cloudbase/node-sdk')
const { XMLParser } = require('fast-xml-parser')
const { normalizeMediaCheckCallback } = require('./_shared/content-security')
const { storeAvatarSecurityProof } = require('./_shared/avatar-security')
const { getOrderByTradeNo, fulfillReportOrder, applyRefundNotification, normalizePaymentConfig } = require('./_shared/archetype-report-access')
const { getSubscriptionConfig } = require('./_shared/subscription')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const CHECK_COLLECTION = 'content_security_checks'
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

async function handleGoodsDelivery(payload) {
  const outTradeNo = String(payload?.OutTradeNo || '').trim()
  const order = outTradeNo ? await getOrderByTradeNo(db, outTradeNo) : null
  if (!order) return { ok: false, code: 'ORDER_NOT_FOUND' }
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
      const result = await handleRefundNotify(payload)
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
  callbackDigest,
  applyMediaCheckResult,
  handleGoodsDelivery,
  handleRefundNotify
}
