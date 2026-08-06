'use strict'

const assert = require('assert')
const crypto = require('crypto')
const callback = require('../cloudfunctions/contentSecCallback/index')._test

const json = callback.parseRequestBody({ body: JSON.stringify({ MsgType: 'event', Event: 'xpay_goods_deliver_notify', GoodsInfo: { ProductId: '0001' } }) })
assert.equal(json.format, 'json')
assert.equal(json.payload.Event, 'xpay_goods_deliver_notify')

const xml = callback.parseRequestBody({ body: '<xml><MsgType>event</MsgType><Event>xpay_goods_deliver_notify</Event><GoodsInfo><ProductId>0001</ProductId></GoodsInfo></xml>' })
assert.equal(xml.format, 'xml')
assert.equal(xml.payload.GoodsInfo.ProductId, '0001')

const order = { openidSnapshot: 'openid', env: 1, productId: '0001', origPriceFen: 199, attach: 'secret', transactionId: '', mchOrderNo: '' }
const payload = { MsgType: 'event', Event: 'xpay_goods_deliver_notify', OpenId: 'openid', Env: '1', GoodsInfo: { ProductId: '0001', Quantity: '1', OrigPrice: '199', ActualPrice: '199', Attach: 'secret' }, WeChatPayInfo: { PaidTime: '1', TransactionId: 'tx', MchOrderNo: 'mch' } }
assert.equal(callback.validateDeliveryPayload(payload, order).valid, true)
assert.equal(callback.validateDeliveryPayload({ ...payload, OpenId: 'other' }, order).valid, false)
assert.match(callback.paymentCallbackResponse('xml', 0, 'success').body, /<ErrCode>0<\/ErrCode>/)
assert.match(callback.paymentCallbackResponse('xml', 0, 'success').body, /<!\[CDATA\[success\]\]>/)
assert.deepEqual(JSON.parse(callback.paymentCallbackResponse('json', 0, 'success').body), { ErrCode: 0, ErrMsg: 'success' })

const token = 'token'
const query = { timestamp: '1', nonce: '2' }
query.signature = crypto.createHash('sha1').update([token, query.timestamp, query.nonce].sort().join('')).digest('hex')
assert.equal(callback.verifyMessageSignature(token, query), true)
console.log('content security callback router tests passed')
