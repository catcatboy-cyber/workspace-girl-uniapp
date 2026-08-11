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

// ── 充值/套餐（现金单）发货推送验单 ──
const fakeUsersDb = { collection: () => ({ doc: () => ({ get: async () => ({ data: [{ openid: 'openid1' }] }) }) }) }
const rcOrder = { _id: 'rc1', userId: 'u1', productType: 'recharge', planId: 'p9_9', amountFen: 290, sandbox: true }
const rcAttach = JSON.stringify({ userId: 'u1', productType: 'recharge', planId: 'p9_9' })
const rcPayload = { MsgType: 'event', Event: 'xpay_goods_deliver_notify', OpenId: 'openid1', Env: '1', GoodsInfo: { ProductId: 'p9_9', Quantity: '290', OrigPrice: '290', ActualPrice: '290', Attach: rcAttach }, WeChatPayInfo: { PaidTime: '1780000000', TransactionId: 'tx-1' } }

async function runRechargeValidationTests() {
  assert.equal((await callback.validateRechargeDeliveryPayload(rcPayload, rcOrder, fakeUsersDb)).valid, true, '充值发货推送 happy path')
  assert.equal((await callback.validateRechargeDeliveryPayload({ ...rcPayload, Env: '0' }, rcOrder, fakeUsersDb)).valid, false, 'Env 不匹配必须失败')
  assert.equal((await callback.validateRechargeDeliveryPayload({ ...rcPayload, OpenId: 'other' }, rcOrder, fakeUsersDb)).valid, false, 'OpenId 不匹配必须失败')
  assert.equal((await callback.validateRechargeDeliveryPayload({ ...rcPayload, GoodsInfo: { ...rcPayload.GoodsInfo, ActualPrice: '999' } }, rcOrder, fakeUsersDb)).valid, false, '金额被篡改必须失败')
  assert.equal((await callback.validateRechargeDeliveryPayload({ ...rcPayload, GoodsInfo: { ...rcPayload.GoodsInfo, Attach: 'tampered' } }, rcOrder, fakeUsersDb)).valid, false, 'Attach 不匹配必须失败')

  // 套餐订单：attach 按 planKey/billingCycle 重建
  const subOrder = { userId: 'u2', productType: 'subscription', planKey: 'pro', billingCycle: 'monthly', amountFen: 1900, sandbox: true }
  const subAttach = JSON.stringify({ userId: 'u2', productType: 'subscription', planKey: 'pro', billingCycle: 'monthly' })
  const subPayload = { ...rcPayload, GoodsInfo: { ...rcPayload.GoodsInfo, Quantity: '1900', OrigPrice: '1900', ActualPrice: '1900', Attach: subAttach } }
  assert.equal((await callback.validateRechargeDeliveryPayload(subPayload, subOrder, fakeUsersDb)).valid, true, '套餐发货推送 happy path')

  // 用户 openid 查询失败时跳过 OpenId 校验，不阻断
  const brokenDb = { collection: () => ({ doc: () => ({ get: async () => { throw new Error('no db') } }) }) }
  assert.equal((await callback.validateRechargeDeliveryPayload({ ...rcPayload, OpenId: 'anything' }, rcOrder, brokenDb)).valid, true, '用户 openid 缺失时 OpenId 校验降级')

  // 已履约订单校验 transactionId 一致性
  const fulfilledOrder = { ...rcOrder, transactionId: 'tx-1' }
  assert.equal((await callback.validateRechargeDeliveryPayload(rcPayload, fulfilledOrder, fakeUsersDb)).valid, true, '已履约订单 transactionId 一致')
  assert.equal((await callback.validateRechargeDeliveryPayload({ ...rcPayload, WeChatPayInfo: { ...rcPayload.WeChatPayInfo, TransactionId: 'tx-EVIL' } }, fulfilledOrder, fakeUsersDb)).valid, false, '已履约订单 transactionId 被篡改必须失败')
}

runRechargeValidationTests().catch((e) => { console.error(e); process.exitCode = 1 })

console.log('content security callback router tests passed')
