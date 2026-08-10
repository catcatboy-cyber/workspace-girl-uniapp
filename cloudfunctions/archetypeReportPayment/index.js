'use strict'

const crypto = require('crypto')
const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId } = require('./_shared/auth')
const {
  resolveReportAccess,
  getOrderByTradeNo,
  fulfillReportOrder
} = require('./_shared/archetype-report-access')
const {
  paymentError,
  generateOutTradeNo,
  buildPaymentResponse,
  exchangeSessionKey,
  queryOrder,
  notifyProvideGoods,
  validateQueriedOrder,
  validatePaymentConfiguration
} = require('./_shared/heart-persona-virtual-pay')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()

function error(code, message, extras = {}) {
  return { success: false, code, message, ...extras }
}

function firstDoc(response) {
  const data = response?.data
  return Array.isArray(data) ? data[0] || null : data || null
}

async function getOwnedResult(resultId, userId) {
  const response = await db.collection('archetype_results').doc(resultId).get().catch(() => null)
  const result = firstDoc(response)
  return result && String(result.userId || '') === userId ? result : null
}

async function getUser(userId) {
  return firstDoc(await db.collection('users').doc(userId).get().catch(() => null))
}

function hashRequest(userId, resultId, clientRequestId) {
  return crypto.createHash('sha256').update(`${userId}|${resultId}|${clientRequestId}`, 'utf8').digest('hex')
}

function validClientRequestId(value) {
  return /^[A-Za-z0-9_-]{8,128}$/.test(String(value || '').trim())
}

function validWxOrderCandidate(value) {
  const raw = String(value || '').trim()
  return !raw || /^[A-Za-z0-9_-]{8,64}$/.test(raw)
}

function publicStatus(order) {
  if (['paid', 'fulfilling'].includes(order?.status)) return 'processing'
  return order?.status || 'pending'
}

function isDuplicateKeyError(error) {
  const code = String(error?.code || error?.errCode || '').toLowerCase()
  const message = String(error?.message || error?.errMsg || '').toLowerCase()
  return code.includes('duplicate') || code === '11000' || message.includes('duplicate') || message.includes('e11000') || message.includes('unique')
}

function assertExistingOrderMatches(order, userId, resultId, payment) {
  if (String(order.userId || '') !== userId || String(order.resultId || '') !== resultId) {
    throw paymentError('ORDER_VALIDATION_FAILED', '幂等订单归属不一致')
  }
  const matches = [
    String(order.productId || '') === String(payment.productId || ''),
    String(order.offerIdSnapshot || '') === String(payment.offerId || ''),
    Number(order.origPriceFen) === 199,
    Number(order.quantity) === 1,
    String(order.currencyType || '') === 'CNY',
    Number(order.env) === Number(payment.env)
  ]
  if (!matches.every(Boolean)) throw paymentError('ORDER_VALIDATION_FAILED', '幂等订单支付配置不一致')
}

async function prepareOrder(event, userId) {
  const resultId = String(event.resultId || '').trim()
  const clientRequestId = String(event.clientRequestId || '').trim()
  const loginCode = String(event.loginCode || '').trim()
  if (!resultId || !validClientRequestId(clientRequestId)) throw paymentError('INVALID_ARGUMENT', '订单请求参数无效')
  if (!loginCode) throw paymentError('LOGIN_CODE_REQUIRED', '请重新获取登录凭据')

  const result = await getOwnedResult(resultId, userId)
  if (!result) throw paymentError('RESULT_NOT_FOUND', '测试结果不存在')
  const access = await resolveReportAccess(db, userId, result)
  if (access.subscriptionAllowed) throw paymentError('REPORT_ALREADY_AVAILABLE', '当前套餐已包含完整报告')
  if (access.permanentResultUnlock) throw paymentError('REPORT_ALREADY_UNLOCKED', '本次报告已经解锁')
  if (!access.payment.allowedFeatures.includes(access.featureKey)) throw paymentError('PAYMENT_DISABLED', '当前测试暂不支持单次解锁')
  const payment = validatePaymentConfiguration(access.payment)

  const user = await getUser(userId)
  const openidSnapshot = String(user?.openid || '').trim()
  if (!openidSnapshot) throw paymentError('AUTH_REQUIRED', '当前账号缺少微信身份信息')
  const requestKey = hashRequest(userId, resultId, clientRequestId)
  const existingResponse = await db.collection('archetype_report_orders').where({ requestKey }).limit(1).get()
  let order = firstDoc(existingResponse)
  let reused = false
  if (order) {
    assertExistingOrderMatches(order, userId, resultId, payment)
    if (String(order.userId) !== userId || String(order.resultId) !== resultId) throw paymentError('ORDER_VALIDATION_FAILED', '幂等订单归属异常')
    if (order.status !== 'pending') throw paymentError('ORDER_CLOSED', '该支付尝试已结束，请重新支付')
    reused = true
  } else {
    const now = new Date()
    const record = {
      outTradeNo: generateOutTradeNo(),
      clientRequestId,
      requestKey,
      userId,
      openidSnapshot,
      resultId,
      kind: result.kind,
      subjectGender: result.subjectGender,
      featureKey: access.featureKey,
      offerIdSnapshot: payment.offerId,
      productId: payment.productId,
      quantity: 1,
      currencyType: 'CNY',
      env: payment.env,
      origPriceFen: 199,
      actualPriceFen: null,
      attach: crypto.randomBytes(16).toString('hex'),
      status: 'pending',
      fulfillmentSource: null,
      duplicatePaid: false,
      mchOrderNo: '',
      clientWxOrderIdCandidate: '',
      wxOrderIdVerified: '',
      transactionId: '',
      paidAt: null,
      fulfilledAt: null,
      refundedAt: null,
      refundRequestStatus: '',
      refundOrderId: '',
      requestedRefundFen: null,
      refundRequestedAt: null,
      refundAcceptedAt: null,
      refundRequestedBy: '',
      refundRequestReason: '',
      refundRequestError: '',
      refundApiResponse: null,
      wxRefundId: '',
      mchRefundId: '',
      refundFeeFen: null,
      refundRetCode: null,
      refundRetMessage: '',
      refundStartAt: null,
      refundSucceededAt: null,
      wxpayRefundTransactionId: '',
      refundRetryTimes: 0,
      lastRefundNotification: null,
      queryAttempts: 0,
      lastQueryAt: null,
      lastQueryStatus: null,
      lastErrorCode: '',
      lastErrorMessage: '',
      callbackDigest: '',
      auditTrail: [],
      createdAt: now,
      updatedAt: now
    }
    try {
      const saved = await db.collection('archetype_report_orders').add(record)
      order = { ...record, _id: saved?.id || saved?._id || '' }
    } catch (cause) {
      if (!isDuplicateKeyError(cause)) throw cause
      const duplicateResponse = await db.collection('archetype_report_orders').where({ requestKey }).limit(1).get()
      order = firstDoc(duplicateResponse)
      if (!order) throw paymentError('ORDER_CREATE_FAILED', '订单创建冲突，请重试')
      assertExistingOrderMatches(order, userId, resultId, payment)
      if (order.status !== 'pending') throw paymentError('ORDER_CLOSED', '该支付尝试已结束，请重新支付')
      reused = true
    }
  }

  const session = await exchangeSessionKey(loginCode)
  if (session.openid !== openidSnapshot) throw paymentError('SESSION_KEY_EXCHANGE_FAILED', '登录身份与当前账号不一致')
  const response = buildPaymentResponse(order, session.sessionKey)
  response.reused = reused
  return { success: true, data: response }
}

async function requireOwnedOrder(outTradeNo, userId) {
  const order = await getOrderByTradeNo(db, String(outTradeNo || '').trim())
  if (!order) throw paymentError('ORDER_NOT_FOUND', '订单不存在')
  if (String(order.userId || '') !== userId) throw paymentError('ORDER_NOT_OWNED', '订单不存在')
  return order
}

async function getOrderStatus(event, userId) {
  const order = await requireOwnedOrder(event.outTradeNo, userId)
  return {
    success: true,
    data: {
      outTradeNo: order.outTradeNo,
      status: publicStatus(order),
      reportAvailable: order.status === 'fulfilled',
      resultId: order.resultId
    }
  }
}

function explicitNotFound(response) {
  if (Number(response?.errcode) === 0) return false
  const message = String(response?.errmsg || '').toLowerCase()
  return message.includes('not found') || message.includes('不存在') || message.includes('order not exist')
}

async function reconcileOrder(event, userId) {
  let order = await requireOwnedOrder(event.outTradeNo, userId)
  if (order.status === 'fulfilled') return getOrderStatus(event, userId)
  if (order.status === 'closed') throw paymentError('ORDER_CLOSED', '订单已关闭')
  if (order.status === 'refunded') throw paymentError('REFUNDED', '订单已退款')
  const nowMs = Date.now()
  const lastQueryMs = order.lastQueryAt ? new Date(order.lastQueryAt).getTime() : 0
  if (lastQueryMs && nowMs - lastQueryMs < 2000) throw paymentError('ORDER_PENDING', '订单确认中')
  if (Number(order.queryAttempts || 0) >= 15) throw paymentError('WECHAT_QUERY_FAILED', '查单次数已达上限，请稍后刷新')

  const candidate = String(event.clientWxOrderIdCandidate || '').trim()
  if (!validWxOrderCandidate(candidate)) throw paymentError('INVALID_ARGUMENT', '微信订单候选值格式无效')
  const queryPatch = {
    queryAttempts: Number(order.queryAttempts || 0) + 1,
    lastQueryAt: new Date(),
    updatedAt: new Date(),
    ...(candidate ? { clientWxOrderIdCandidate: candidate } : {})
  }
  await db.collection('archetype_report_orders').doc(order._id).update(queryPatch)
  order = { ...order, ...queryPatch }

  let response
  try {
    response = await queryOrder({ outTradeNo: order.outTradeNo, openid: order.openidSnapshot, env: order.env })
    if (explicitNotFound(response) && (candidate || order.clientWxOrderIdCandidate)) {
      const wxOrderId = candidate || order.clientWxOrderIdCandidate
      const candidateResponse = await queryOrder({ outTradeNo: order.outTradeNo, openid: order.openidSnapshot, env: order.env, wxOrderId })
      if (String(candidateResponse?.order?.order_id || '') === order.outTradeNo) {
        response = candidateResponse
        await db.collection('archetype_report_orders').doc(order._id).update({ wxOrderIdVerified: wxOrderId, updatedAt: new Date() })
        order.wxOrderIdVerified = wxOrderId
      }
    }
  } catch (cause) {
    await db.collection('archetype_report_orders').doc(order._id).update({
      lastErrorCode: cause?.code || 'WECHAT_QUERY_FAILED',
      lastErrorMessage: String(cause?.message || '微信查单失败').slice(0, 300),
      updatedAt: new Date()
    })
    throw paymentError('WECHAT_QUERY_FAILED', '微信查单失败，未解锁报告')
  }

  const validation = validateQueriedOrder(response, order)
  if (!validation.valid) {
    const code = validation.code || 'ORDER_VALIDATION_FAILED'
    const patch = {
      lastQueryStatus: validation.status,
      lastErrorCode: code,
      lastErrorMessage: String(response?.errmsg || code).slice(0, 300),
      updatedAt: new Date()
    }
    if (code === 'ORDER_VALIDATION_FAILED') patch.status = 'exception'
    await db.collection('archetype_report_orders').doc(order._id).update(patch)
    throw paymentError(code, code === 'WECHAT_QUERY_FAILED' ? '微信查单失败，未解锁报告' : '订单校验失败，未解锁报告')
  }

  const status = validation.status
  await db.collection('archetype_report_orders').doc(order._id).update({ lastQueryStatus: status, lastErrorCode: '', lastErrorMessage: '', updatedAt: new Date() })
  if ([0, 1].includes(status)) throw paymentError('ORDER_PENDING', '订单尚未支付')
  if (status === 6) {
    await db.collection('archetype_report_orders').doc(order._id).update({ status: 'closed', updatedAt: new Date() })
    throw paymentError('ORDER_CLOSED', '订单已关闭')
  }
  if ([5, 8].includes(status)) throw paymentError('REFUNDED', '订单已退款，等待退款通知确认')
  if (![2, 3, 4].includes(status)) throw paymentError('WECHAT_QUERY_FAILED', '订单状态暂不可发货')

  const wxOrder = validation.order
  const evidence = {
    actualPriceFen: Number(wxOrder.paid_fee),
    paidAt: new Date(Number(wxOrder.paid_time) * 1000),
    wxOrderIdVerified: order.wxOrderIdVerified || ''
  }
  await db.collection('archetype_report_orders').doc(order._id).update({ status: 'paid', paidAt: evidence.paidAt, actualPriceFen: evidence.actualPriceFen, updatedAt: new Date() })
  await fulfillReportOrder(db, { outTradeNo: order.outTradeNo, source: 'poll', paymentEvidence: evidence })
  if ([2, 3].includes(status)) {
    try {
      await notifyProvideGoods({ outTradeNo: order.outTradeNo, env: order.env })
    } catch (cause) {
      await db.collection('archetype_report_orders').doc(order._id).update({
        lastErrorCode: cause?.code || 'WECHAT_NOTIFY_FAILED',
        lastErrorMessage: String(cause?.message || '').slice(0, 300),
        updatedAt: new Date()
      })
    }
  }
  return getOrderStatus(event, userId)
}

exports.main = async (event = {}) => {
  try {
    const userId = await requireAuthenticatedUserId(app, event)
    const action = String(event.action || '').trim()
    if (action === 'prepareOrder') return await prepareOrder(event, userId)
    if (action === 'getOrderStatus') return await getOrderStatus(event, userId)
    if (action === 'reconcileOrder') return await reconcileOrder(event, userId)
    return error('INVALID_ACTION', '未知操作')
  } catch (cause) {
    const code = cause?.code === 'UNAUTHENTICATED' ? 'AUTH_REQUIRED' : cause?.code || 'PAYMENT_FAILED'
    return error(code, code === 'AUTH_REQUIRED' ? '请先登录' : cause?.message || '支付操作失败')
  }
}

module.exports._test = {
  hashRequest,
  validClientRequestId,
  validWxOrderCandidate,
  publicStatus,
  explicitNotFound,
  isDuplicateKeyError,
  assertExistingOrderMatches
}
