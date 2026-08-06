'use strict'

const assert = require('assert')
process.env.HEART_PERSONA_VPAY_ENV = '1'
process.env.USE_VIRTUAL_PAY = 'true'
process.env.VIRTUAL_PAY_OFFER_ID = 'offer-test'
process.env.VIRTUAL_PAY_SANDBOX_KEY = 'sandbox-secret'
process.env.WXPAY_APPID = 'appid'
process.env.WECHAT_APP_SECRET = 'secret'

const helper = require('../cloudfunctions/_shared/heart-persona-virtual-pay')

const configured = helper.validatePaymentConfiguration({ enabled: true, priceFen: 199, sandboxProductId: '0001', productionProductId: '' })
assert.deepEqual(configured, { env: 1, productId: '0001', offerId: 'offer-test', priceFen: 199 })
assert.throws(() => helper.validatePaymentConfiguration({ enabled: true, priceFen: 200, sandboxProductId: '0001' }), /199/)

const order = { offerIdSnapshot: 'offer-test', env: 1, productId: '0001', origPriceFen: 199, outTradeNo: 'HPR12345678', attach: 'a'.repeat(32), status: 'pending' }
const payment = helper.buildPaymentResponse(order, 'session-secret')
assert.equal(payment.mode, 'short_series_goods')
assert.equal(JSON.parse(payment.signData).productId, '0001')
assert.equal(JSON.parse(payment.signData).goodsPrice, 199)
assert.equal(JSON.parse(payment.signData).buyQuantity, 1)
assert.equal(helper.validatePaymentConfiguration({ enabled: true, priceFen: 199, sandboxProductId: '0001' }).productId, '0001')

const paymentModulePath = require.resolve('../cloudfunctions/archetypeReportPayment/index.js')
const paymentModule = require(paymentModulePath)
const paymentFunctionTest = paymentModule._test
assert.equal(paymentFunctionTest.isDuplicateKeyError({ code: 11000 }), true)
assert.equal(paymentFunctionTest.isDuplicateKeyError({ message: 'E11000 duplicate key error' }), true)
const reusableOrder = { ...order, userId: 'u1', resultId: 'r1', quantity: 1, currencyType: 'CNY' }
assert.doesNotThrow(() => paymentFunctionTest.assertExistingOrderMatches(reusableOrder, 'u1', 'r1', { productId: '0001', offerId: 'offer-test', env: 1 }))
assert.throws(() => paymentFunctionTest.assertExistingOrderMatches({ ...reusableOrder, origPriceFen: 200 }, 'u1', 'r1', { productId: '0001', offerId: 'offer-test', env: 1 }), /配置不一致/)

helper._test.resetToken()
const calls = []
const request = async (options) => {
  calls.push(options)
  if (options.method === 'GET') return { statusCode: 200, json: { access_token: 'token', expires_in: 7200 }, raw: '' }
  return { statusCode: 200, json: { errcode: 0, order: { order_type: 0, status: 2, order_id: 'HPR12345678', env_type: 2, order_fee: 199, paid_fee: 199, paid_time: 1 } }, raw: '' }
}

;(async () => {
  const queried = await helper.queryOrder({ outTradeNo: 'HPR12345678', openid: 'openid', env: 1, request })
  assert.equal(queried.errcode, 0)
  const post = calls.find((item) => item.method === 'POST')
  const body = JSON.parse(post.body)
  assert.deepEqual(Object.keys(body).sort(), ['env', 'openid', 'order_id'])
  assert.equal(Object.prototype.hasOwnProperty.call(body, 'offer_id'), false)
  assert.equal(post.headers['Content-Length'], Buffer.byteLength(post.body))

  const valid = helper.validateQueriedOrder(queried, { outTradeNo: 'HPR12345678', env: 1, origPriceFen: 199 })
  assert.equal(valid.valid, true)
  for (const status of [0, 1, 6]) {
    const responseOrder = { order_type: 0, status, order_id: 'HPR12345678', env_type: 2, order_fee: 199 }
    const response = { errcode: 0, order: responseOrder }
    const checked = helper.validateQueriedOrder(response, { outTradeNo: 'HPR12345678', env: 1, origPriceFen: 199 })
    assert.equal([2, 3, 4].includes(checked.status), false)
    assert.equal(checked.valid, true)
  }
  assert.equal(helper.validateQueriedOrder({ errcode: 0, order: { ...queried.order, status: 2, paid_fee: undefined } }, { outTradeNo: 'HPR12345678', env: 1, origPriceFen: 199 }).valid, false)
  assert.equal(helper.validateQueriedOrder({ errcode: -1, errmsg: 'failed' }, order).valid, false)
  console.log('archetype report payment tests passed')
})().catch((error) => { console.error(error); process.exit(1) })
