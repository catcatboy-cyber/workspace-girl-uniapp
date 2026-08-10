'use strict'

const crypto = require('crypto')
const https = require('https')

let tokenCache = { token: '', expiresAt: 0 }

function paymentError(code, message, extras = {}) {
  return Object.assign(new Error(message || code), { code, ...extras })
}

function getEnvironment() {
  return String(process.env.HEART_PERSONA_VPAY_ENV || '').trim() === '1' ? 1 : 0
}

function getOfferId() {
  return String(process.env.VIRTUAL_PAY_OFFER_ID || '').trim()
}

function getAppKey(env = getEnvironment()) {
  return String((env === 1 ? process.env.VIRTUAL_PAY_SANDBOX_KEY : process.env.VIRTUAL_PAY_APP_KEY) || '').trim()
}

function isEnabled() {
  return String(process.env.USE_VIRTUAL_PAY || '').trim() === 'true'
}

function serializeObject(value) {
  const sorted = {}
  Object.keys(value || {}).sort().forEach((key) => { sorted[key] = value[key] })
  return JSON.stringify(sorted)
}

function signHmac(appKey, prefix, body) {
  if (!appKey) throw paymentError('PAYMENT_NOT_CONFIGURED', '虚拟支付 AppKey 未配置')
  return crypto.createHmac('sha256', appKey).update(`${prefix}&${body}`, 'utf8').digest('hex')
}

function signUser(body, sessionKey) {
  if (!sessionKey) throw paymentError('SESSION_KEY_EXCHANGE_FAILED', '无法取得有效 session_key')
  return crypto.createHmac('sha256', sessionKey).update(body, 'utf8').digest('hex')
}

function generateOutTradeNo() {
  return `HPR${Date.now().toString(36)}${crypto.randomBytes(5).toString('hex')}`.slice(0, 32)
}

function generateRefundOrderId(outTradeNo) {
  const tradeNo = String(outTradeNo || '').trim()
  if (!tradeNo) throw paymentError('INVALID_ARGUMENT', '缺少退款对应的支付单号')
  return `HPRR${crypto.createHash('sha256').update(tradeNo, 'utf8').digest('hex').slice(0, 28)}`
}

function buildGoodsSignData(order) {
  return {
    offerId: order.offerIdSnapshot,
    buyQuantity: 1,
    env: Number(order.env),
    currencyType: 'CNY',
    productId: order.productId,
    goodsPrice: Number(order.origPriceFen),
    outTradeNo: order.outTradeNo,
    attach: order.attach
  }
}

function buildPaymentResponse(order, sessionKey) {
  const signData = serializeObject(buildGoodsSignData(order))
  return {
    mode: 'short_series_goods',
    paySig: signHmac(getAppKey(order.env), 'requestVirtualPayment', signData),
    signature: signUser(signData, sessionKey),
    signData,
    outTradeNo: order.outTradeNo,
    orderStatus: order.status,
    reused: false
  }
}

function getJsonByHttps(options) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let raw = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { raw += chunk })
      res.on('end', () => {
        let json = null
        if (raw.trim()) {
          try { json = JSON.parse(raw) } catch (_) {}
        }
        resolve({ statusCode: Number(res.statusCode || 0), raw, json })
      })
    })
    req.on('error', reject)
    req.setTimeout(7000, () => req.destroy(paymentError('WECHAT_QUERY_FAILED', '微信接口请求超时')))
    if (options.body) req.write(options.body)
    req.end()
  })
}

async function getAccessToken(request = getJsonByHttps) {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) return tokenCache.token
  const appid = String(process.env.WXPAY_APPID || process.env.WECHAT_APPID || '').trim()
  const secret = String(process.env.WECHAT_APP_SECRET || '').trim()
  if (!appid || !secret) throw paymentError('PAYMENT_NOT_CONFIGURED', '微信 AppID 或 Secret 未配置')
  const path = `/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}`
  const response = await request({ hostname: 'api.weixin.qq.com', port: 443, method: 'GET', path })
  if (!response?.json?.access_token) throw paymentError('WECHAT_QUERY_FAILED', '获取微信 access_token 失败', { response: response?.json || response?.raw || '' })
  tokenCache = { token: response.json.access_token, expiresAt: Date.now() + Math.max(60, Number(response.json.expires_in || 7200) - 300) * 1000 }
  return tokenCache.token
}

async function exchangeSessionKey(loginCode, request = getJsonByHttps) {
  const code = String(loginCode || '').trim()
  if (!code) throw paymentError('LOGIN_CODE_REQUIRED', '缺少 wx.login code')
  const appid = String(process.env.WXPAY_APPID || process.env.WECHAT_APPID || '').trim()
  const secret = String(process.env.WECHAT_APP_SECRET || '').trim()
  if (!appid || !secret) throw paymentError('PAYMENT_NOT_CONFIGURED', '微信 AppID 或 Secret 未配置')
  const path = `/sns/jscode2session?appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`
  const response = await request({ hostname: 'api.weixin.qq.com', port: 443, method: 'GET', path })
  const sessionKey = String(response?.json?.session_key || '').trim()
  const openid = String(response?.json?.openid || '').trim()
  if (!sessionKey || !openid) throw paymentError('SESSION_KEY_EXCHANGE_FAILED', '无法换取有效微信身份', { response: response?.json || response?.raw || '' })
  return { sessionKey, openid }
}

async function postSigned(path, bodyObject, request = getJsonByHttps) {
  const body = serializeObject(bodyObject)
  const env = Number(bodyObject.env)
  const paySig = signHmac(getAppKey(env), path, body)
  const accessToken = await getAccessToken(request)
  const buffer = Buffer.from(body, 'utf8')
  return request({
    hostname: 'api.weixin.qq.com',
    port: 443,
    method: 'POST',
    path: `${path}?access_token=${encodeURIComponent(accessToken)}&pay_sig=${paySig}`,
    body,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': buffer.length
    }
  })
}

async function queryOrder({ outTradeNo, openid, env, wxOrderId = '', request }) {
  const body = wxOrderId
    ? { openid, env: Number(env), wx_order_id: wxOrderId }
    : { openid, env: Number(env), order_id: outTradeNo }
  const response = await postSigned('/xpay/query_order', body, request)
  if (!response?.json) throw paymentError('WECHAT_QUERY_FAILED', '微信查单返回无效', { raw: response?.raw || '' })
  return response.json
}

async function notifyProvideGoods({ outTradeNo, env, request }) {
  const response = await postSigned('/xpay/notify_provide_goods', { order_id: outTradeNo, env: Number(env) }, request)
  if (response.statusCode < 200 || response.statusCode >= 300) throw paymentError('WECHAT_NOTIFY_FAILED', '微信发货通知失败', { statusCode: response.statusCode })
  if (response.json && Number(response.json.errcode || 0) !== 0) {
    throw paymentError('WECHAT_NOTIFY_FAILED', response.json.errmsg || '微信发货通知失败', { response: response.json })
  }
  return { success: true }
}

async function refundVirtualOrder({
  outTradeNo,
  openid,
  env,
  refundOrderId,
  leftFee,
  refundFee,
  bizMeta = '',
  refundReason = '5',
  requestFrom = '1',
  request
}) {
  const body = {
    openid: String(openid || '').trim(),
    order_id: String(outTradeNo || '').trim(),
    refund_order_id: String(refundOrderId || '').trim(),
    left_fee: Number(leftFee),
    refund_fee: Number(refundFee),
    biz_meta: String(bizMeta || '').slice(0, 1024),
    refund_reason: String(refundReason),
    req_from: String(requestFrom),
    env: Number(env)
  }
  if (!body.openid || !body.order_id) throw paymentError('INVALID_ARGUMENT', '退款订单身份不完整')
  if (!/^[A-Za-z0-9_-]{8,32}$/.test(body.refund_order_id)) throw paymentError('INVALID_ARGUMENT', '退款单号格式无效')
  if (!Number.isInteger(body.left_fee) || body.left_fee <= 0) throw paymentError('INVALID_ARGUMENT', '剩余可退金额无效')
  if (!Number.isInteger(body.refund_fee) || body.refund_fee <= 0 || body.refund_fee > body.left_fee) throw paymentError('INVALID_ARGUMENT', '退款金额无效')
  if (!['0', '1', '2', '3', '4', '5'].includes(body.refund_reason)) throw paymentError('INVALID_ARGUMENT', '退款原因无效')
  if (!['1', '2', '3'].includes(body.req_from)) throw paymentError('INVALID_ARGUMENT', '退款来源无效')
  if (![0, 1].includes(body.env)) throw paymentError('INVALID_ARGUMENT', '退款环境无效')

  const response = await postSigned('/xpay/refund_order', body, request)
  if (response.statusCode < 200 || response.statusCode >= 300 || !response?.json) {
    throw paymentError('WECHAT_REFUND_FAILED', '微信退款请求失败', { statusCode: response?.statusCode, raw: response?.raw || '' })
  }
  const errcode = Number(response.json.errcode || 0)
  if (errcode !== 0 && errcode !== 268490014) {
    throw paymentError('WECHAT_REFUND_FAILED', response.json.errmsg || '微信退款请求失败', { response: response.json })
  }
  return { ...response.json, accepted: true, alreadyProcessing: errcode === 268490014 }
}

function expectedEnvType(env) {
  return Number(env) === 1 ? 2 : 1
}

function validateQueriedOrder(order, localOrder) {
  const responseOrder = order?.order
  if (Number(order?.errcode) !== 0 || !responseOrder) return { valid: false, code: 'WECHAT_QUERY_FAILED', status: null }
  const status = Number(responseOrder.status)
  const checks = [
    Number(responseOrder.order_type) === 0,
    String(responseOrder.order_id || '') === String(localOrder.outTradeNo),
    Number(responseOrder.env_type) === expectedEnvType(localOrder.env),
    Number(responseOrder.order_fee) === Number(localOrder.origPriceFen)
  ]
  if (!checks.every(Boolean)) return { valid: false, code: 'ORDER_VALIDATION_FAILED', status }
  if ([2, 3, 4].includes(status)) {
    if (!Number.isFinite(Number(responseOrder.paid_fee)) || Number(responseOrder.paid_fee) < 0 || Number(responseOrder.paid_fee) > Number(localOrder.origPriceFen)) {
      return { valid: false, code: 'ORDER_VALIDATION_FAILED', status }
    }
    if (!Number.isFinite(Number(responseOrder.paid_time)) || Number(responseOrder.paid_time) <= 0) {
      return { valid: false, code: 'ORDER_VALIDATION_FAILED', status }
    }
  }
  return { valid: true, status, order: responseOrder }
}

function validatePaymentConfiguration(payment) {
  const env = getEnvironment()
  if (!isEnabled() || payment?.enabled !== true) throw paymentError('PAYMENT_DISABLED', '单次报告支付未开启')
  if (Number(payment?.priceFen) !== 199 || !Number.isInteger(Number(payment?.priceFen))) throw paymentError('PAYMENT_NOT_CONFIGURED', '报告价格配置必须为 199 分')
  const productId = env === 1 ? payment.sandboxProductId : payment.productionProductId
  if (!productId) throw paymentError('PRODUCT_NOT_CONFIGURED', '当前环境道具未配置')
  if (env === 1 && productId !== '0001') throw paymentError('PRODUCT_NOT_CONFIGURED', '沙箱道具必须为 0001')
  if (env === 0 && productId === '0001') throw paymentError('PRODUCT_NOT_CONFIGURED', '现网不得使用沙箱道具 0001')
  const offerId = getOfferId()
  if (!offerId || !getAppKey(env)) throw paymentError('PAYMENT_NOT_CONFIGURED', '虚拟支付基础配置不完整')
  return { env, productId, offerId, priceFen: 199 }
}

module.exports = {
  paymentError,
  getEnvironment,
  getOfferId,
  getAppKey,
  isEnabled,
  serializeObject,
  generateOutTradeNo,
  generateRefundOrderId,
  buildGoodsSignData,
  buildPaymentResponse,
  exchangeSessionKey,
  queryOrder,
  notifyProvideGoods,
  refundVirtualOrder,
  validateQueriedOrder,
  validatePaymentConfiguration,
  _test: { getJsonByHttps, postSigned, expectedEnvType, resetToken: () => { tokenCache = { token: '', expiresAt: 0 } } }
}
