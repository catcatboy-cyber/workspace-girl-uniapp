'use strict'
/**
 * 充值/套餐（代币现金单）支付退款闭环测试：
 * - ① 发货推送 handleGoodsDelivery：验单 → fulfillPayment（token 到账 + 分佣入队 + fulfillmentSource=push）
 * - ④ 退款推送 handleRechargeRefundNotify：RetCode=0 → settleRechargeRefund（refunded + 扣 token + 冲正 job）；幂等；RetCode≠0 → failed
 * - 结算幂等：settleRechargeRefund 重复调用返回 duplicate；套餐订单回退 plan
 */
const assert = require('node:assert/strict')
const path = require('path')
const { createFakeCloudbase, setCurrentFakeCloudbase, installCloudbaseMock, clearCloudFunctionCache } = require('./support/fake-cloudbase.cjs')

installCloudbaseMock()

const projectRoot = path.resolve(__dirname, '..')

function loadCallbackTest() {
  clearCloudFunctionCache(projectRoot)
  return require(path.join(projectRoot, 'cloudfunctions/contentSecCallback/index.js'))._test
}

function seed(store, collection, id, value) {
  store.getCollection(collection).set(id, { _id: id, ...value })
}

function buildRechargeAttach(order) {
  return order.productType === 'subscription'
    ? JSON.stringify({ userId: order.userId, productType: 'subscription', planKey: order.planKey, billingCycle: order.billingCycle })
    : JSON.stringify({ userId: order.userId, productType: 'recharge', planId: order.planId })
}

function buildDeliveryPayload(order, overrides = {}) {
  const attach = buildRechargeAttach(order)
  return {
    MsgType: 'event',
    Event: 'xpay_goods_deliver_notify',
    OutTradeNo: order.outTradeNo,
    OpenId: 'openid1',
    Env: order.sandbox ? '1' : '0',
    GoodsInfo: { ProductId: order.planId || '0001', Quantity: String(order.amountFen), OrigPrice: String(order.amountFen), ActualPrice: String(order.amountFen), Attach: attach },
    WeChatPayInfo: { PaidTime: '1780000000', TransactionId: 'tx-callback-1', MchOrderNo: 'mch-callback-1' },
    ...overrides
  }
}

async function main() {
  // ── ① 发货推送：充值订单全流程 ──
  const fake = createFakeCloudbase()
  setCurrentFakeCloudbase(fake)
  seed(fake.__store, 'system_settings', 'settings_subscription', {
    referral: { commission: { enabled: true, rateBps: 1000, settlementDays: 7, mode: 'all_orders' } }
  })
  seed(fake.__store, 'users', 'u1', { openid: 'openid1', extraTokens: 0, plan: 'free' })
  seed(fake.__store, 'users', 'u1-inviter', {})
  seed(fake.__store, 'referral_claims', 'u1', { inviteeUserId: 'u1', inviterUserId: 'u1-inviter', status: 'rewarded' })
  const order = {
    _id: 'rc-order-1', userId: 'u1', outTradeNo: 'RCtest001', productType: 'recharge',
    planId: 'p9_9', planName: '基础包', amountFen: 290, grantTokens: 300000,
    status: 'pending', channel: 'virtual_pay', sandbox: true, createdAt: new Date()
  }
  seed(fake.__store, 'recharge_orders', 'rc-order-1', order)
  const callback = loadCallbackTest()
  const delivered = await callback.handleGoodsDelivery(buildDeliveryPayload(order))
  assert.equal(delivered.ok, true, '充值发货推送处理成功')
  const paidOrder = fake.__store.getCollection('recharge_orders').get('rc-order-1')
  assert.equal(paidOrder.status, 'paid')
  assert.equal(paidOrder.fulfillmentStatus, 'succeeded')
  assert.equal(paidOrder.fulfillmentSource, 'push', '回调发货标记 fulfillmentSource=push')
  assert.equal(paidOrder.transactionId, 'tx-callback-1')
  assert.equal(fake.__store.getCollection('users').get('u1').extraTokens, 300000, 'token 到账')
  assert.equal(fake.__store.getCollection('referral_commission_jobs').has('job_recharge_order_rc-order-1'), true, '分佣 job 入队')
  // 重复推送幂等：不重复发 token
  const duplicate = await callback.handleGoodsDelivery(buildDeliveryPayload(order))
  assert.equal(duplicate.ok, true)
  assert.equal(duplicate.duplicate, true)
  assert.equal(fake.__store.getCollection('users').get('u1').extraTokens, 300000, '重复推送不重复发 token')
  // 验单失败：金额被篡改 → 拒绝，订单保持 pending 并记录错误
  const tampered = await callback.handleGoodsDelivery(buildDeliveryPayload(order, { GoodsInfo: { ...buildDeliveryPayload(order).GoodsInfo, ActualPrice: '999' } }))
  assert.equal(tampered.ok, false)
  assert.equal(tampered.code, 'ORDER_VALIDATION_FAILED')

  // ── ④ 退款推送：RetCode=0 → 结算落库 ──
  const refundNotify = {
    MsgType: 'event', Event: 'xpay_refund_notify', OpenId: 'openid1',
    WxRefundId: 'wr-1', MchRefundId: 'refund-rc-1', WxOrderId: 'wx-1', MchOrderId: 'RCtest001',
    RefundFee: '290', RetCode: '0', RetMsg: '', RefundSuccTimestamp: '1780000100', RetryTimes: '0'
  }
  const refunded = await callback.handleRechargeRefundNotify(refundNotify)
  assert.equal(refunded.ok, true)
  assert.equal(refunded.code, 'REFUNDED')
  const refundedOrder = fake.__store.getCollection('recharge_orders').get('rc-order-1')
  assert.equal(refundedOrder.status, 'refunded')
  assert.equal(refundedOrder.refundRequestStatus, 'refunded')
  assert.equal(fake.__store.getCollection('users').get('u1').extraTokens, 0, '退款扣回 token')
  assert.ok(fake.__store.getCollection('commission_reversal_jobs').has('reversal_commission_recharge_order_rc-order-1'), '冲正补偿 job 写入')
  // 重复退款通知幂等
  const refundDup = await callback.handleRechargeRefundNotify(refundNotify)
  assert.equal(refundDup.ok, true)
  assert.equal(refundDup.code, 'REFUNDED_DUPLICATE')
  // 已退款订单收到 RetCode≠0 的过期重试通知 → 幂等返回，不改变状态
  const staleFailed = await callback.handleRechargeRefundNotify({ ...refundNotify, WxRefundId: 'wr-2', RefundFee: '290', RetCode: '1', RetMsg: '余额不足' })
  assert.equal(staleFailed.ok, true)
  assert.equal(staleFailed.code, 'REFUNDED_DUPLICATE')

  // ── RetCode≠0（退款失败）→ 订单标记 failed，不结算 ──
  const failFake = createFakeCloudbase()
  setCurrentFakeCloudbase(failFake)
  seed(failFake.__store, 'users', 'u3', { openid: 'openid3', extraTokens: 800 })
  seed(failFake.__store, 'recharge_orders', 'rc-fail-1', {
    _id: 'rc-fail-1', userId: 'u3', outTradeNo: 'RCfail001', productType: 'recharge',
    planId: 'p9_9', amountFen: 290, grantTokens: 300000, status: 'paid',
    refundRequestStatus: 'processing', refundOrderId: 'refund-fail-1',
    channel: 'virtual_pay', sandbox: true, paidAt: new Date(), createdAt: new Date()
  })
  const failCallback = loadCallbackTest()
  const failedNotify = await failCallback.handleRechargeRefundNotify({
    MsgType: 'event', Event: 'xpay_refund_notify', OpenId: 'openid3',
    WxRefundId: 'wr-fail-1', MchRefundId: 'refund-fail-1', MchOrderId: 'RCfail001',
    RefundFee: '290', RetCode: '1', RetMsg: '余额不足', RetryTimes: '0'
  })
  assert.equal(failedNotify.ok, true)
  assert.equal(failedNotify.code, 'REFUND_NOT_SUCCEEDED')
  const failedOrder = failFake.__store.getCollection('recharge_orders').get('rc-fail-1')
  assert.equal(failedOrder.status, 'paid', 'RetCode≠0 不结算')
  assert.equal(failedOrder.refundRequestStatus, 'failed')
  assert.equal(failedOrder.lastRefundNotification.retCode, 1, 'lastRefundNotification 整体替换落库')
  assert.equal(failFake.__store.getCollection('users').get('u3').extraTokens, 800, '退款失败不扣 token')

  // ── 退款推送：套餐订单 → 回退 plan ──
  const subFake = createFakeCloudbase()
  setCurrentFakeCloudbase(subFake)
  seed(subFake.__store, 'users', 'u2', { openid: 'openid2', plan: 'pro', planExpiresAt: '2026-12-01T00:00:00.000Z', extraTokens: 500 })
  seed(subFake.__store, 'referral_claims', 'u2', { inviteeUserId: 'u2', inviterUserId: 'u2-inviter', status: 'rewarded' })
  seed(subFake.__store, 'recharge_orders', 'sub-order-1', {
    _id: 'sub-order-1', userId: 'u2', outTradeNo: 'SUBtest01', productType: 'subscription',
    planKey: 'pro', planName: 'Pro', billingCycle: 'monthly', fromPlan: 'free', grantPlan: 'pro',
    amountFen: 1900, grantTokens: 1000, grantDurationDays: 30,
    status: 'paid', channel: 'virtual_pay', sandbox: true, paidAt: new Date(), createdAt: new Date()
  })
  const subCallback = loadCallbackTest()
  const subRefund = await subCallback.handleRechargeRefundNotify({
    MsgType: 'event', Event: 'xpay_refund_notify', OpenId: 'openid2',
    WxRefundId: 'wr-sub-1', MchRefundId: 'refund-sub-1', MchOrderId: 'SUBtest01',
    RefundFee: '1900', RetCode: '0', RetMsg: '', RetryTimes: '0'
  })
  assert.equal(subRefund.ok, true)
  assert.equal(subRefund.code, 'REFUNDED')
  const subUser = subFake.__store.getCollection('users').get('u2')
  assert.equal(subUser.plan, 'free', '套餐退款回退 plan')
  assert.equal(subUser.planExpiresAt, null)
  assert.equal(subUser.extraTokens, 0, '套餐退款扣回 token')

  // ── P1-6：旧订单退款不得覆盖用户后续购买的新套餐 ──
  const staleFake = createFakeCloudbase()
  setCurrentFakeCloudbase(staleFake)
  seed(staleFake.__store, 'users', 'u5', { openid: 'openid5', plan: 'ultra', planExpiresAt: '2027-01-01T00:00:00.000Z', extraTokens: 800 })
  seed(staleFake.__store, 'recharge_orders', 'stale-sub-1', {
    _id: 'stale-sub-1', userId: 'u5', outTradeNo: 'SUBstale01', productType: 'subscription',
    planKey: 'pro', planName: 'Pro', billingCycle: 'monthly', fromPlan: 'free', grantPlan: 'pro',
    amountFen: 1900, grantTokens: 1000, grantDurationDays: 30,
    status: 'paid', channel: 'virtual_pay', sandbox: true, paidAt: new Date(), createdAt: new Date()
  })
  const staleCb = loadCallbackTest()
  const staleRefund = await staleCb.handleRechargeRefundNotify({
    MsgType: 'event', Event: 'xpay_refund_notify', OpenId: 'openid5',
    WxRefundId: 'wr-stale-1', MchRefundId: 'refund-stale-1', MchOrderId: 'SUBstale01',
    RefundFee: '1900', RetCode: '0', RetMsg: '', RetryTimes: '0'
  })
  assert.equal(staleRefund.ok, true)
  const staleUser = staleFake.__store.getCollection('users').get('u5')
  assert.equal(staleUser.plan, 'ultra', '用户当前套餐是后续订单授予的，旧 pro 单退款不降级')
  assert.equal(staleUser.planExpiresAt, '2027-01-01T00:00:00.000Z', '不清空后续套餐有效期')

  // ── P2：退款通知校验强化 ──
  const p2Fake = createFakeCloudbase()
  setCurrentFakeCloudbase(p2Fake)
  seed(p2Fake.__store, 'users', 'u6', { openid: 'openid6', extraTokens: 100 })
  seed(p2Fake.__store, 'recharge_orders', 'rc-p2-1', {
    _id: 'rc-p2-1', userId: 'u6', outTradeNo: 'RCp2001', productType: 'recharge',
    planId: 'p9_9', amountFen: 290, grantTokens: 300000, status: 'paid',
    refundRequestStatus: 'processing', refundOrderId: 'refund-p2-1', wxOrderId: 'wx-p2-1',
    channel: 'virtual_pay', sandbox: true, paidAt: new Date(), createdAt: new Date()
  })
  const p2Cb = loadCallbackTest()
  const baseNotify = {
    MsgType: 'event', Event: 'xpay_refund_notify', OpenId: 'openid6',
    WxRefundId: 'wr-p2-1', MchRefundId: 'refund-p2-1', WxOrderId: 'wx-p2-1', MchOrderId: 'RCp2001',
    RefundFee: '290', RetCode: '0', RetMsg: '', RetryTimes: '0'
  }
  const partialFee = await p2Cb.handleRechargeRefundNotify({ ...baseNotify, WxRefundId: 'wr-p2-2', RefundFee: '100' })
  assert.equal(partialFee.ok, false, '部分退款金额（≠订单金额）拒绝')
  assert.equal(partialFee.code, 'REFUND_VALIDATION_FAILED')
  const badMch = await p2Cb.handleRechargeRefundNotify({ ...baseNotify, WxRefundId: 'wr-p2-3', MchRefundId: 'other-refund' })
  assert.equal(badMch.ok, false, 'MchRefundId 不匹配拒绝')
  const badWx = await p2Cb.handleRechargeRefundNotify({ ...baseNotify, WxRefundId: 'wr-p2-4', WxOrderId: 'wx-evil' })
  assert.equal(badWx.ok, false, 'WxOrderId 不匹配拒绝')
  assert.equal(p2Fake.__store.getCollection('recharge_orders').get('rc-p2-1').status, 'paid', '校验失败不结算')

  // ── ① 发货推送：套餐（subscription）订单全流程 → 升级 plan ──
  const subDeliverFake = createFakeCloudbase()
  setCurrentFakeCloudbase(subDeliverFake)
  seed(subDeliverFake.__store, 'system_settings', 'settings_subscription', {
    referral: { commission: { enabled: true, rateBps: 1000, settlementDays: 7, mode: 'all_orders' } },
    plans: { pro: { name: 'Pro', monthlyTokens: 300000 } }
  })
  seed(subDeliverFake.__store, 'users', 'u4', { openid: 'openid4', extraTokens: 0, plan: 'free' })
  seed(subDeliverFake.__store, 'users', 'u4-inviter', {})
  seed(subDeliverFake.__store, 'referral_claims', 'u4', { inviteeUserId: 'u4', inviterUserId: 'u4-inviter', status: 'rewarded' })
  const subDeliverOrder = {
    _id: 'sub-deliver-1', userId: 'u4', outTradeNo: 'SUBdeliver01', productType: 'subscription',
    planKey: 'pro', planName: 'Pro', billingCycle: 'monthly', fromPlan: 'free', grantPlan: 'pro',
    amountFen: 1900, grantTokens: 1000, grantDurationDays: 30,
    status: 'pending', channel: 'virtual_pay', sandbox: true, createdAt: new Date()
  }
  seed(subDeliverFake.__store, 'recharge_orders', 'sub-deliver-1', subDeliverOrder)
  const subDeliverCb = loadCallbackTest()
  const subDelivered = await subDeliverCb.handleGoodsDelivery(buildDeliveryPayload(subDeliverOrder, { OpenId: 'openid4' }))
  assert.equal(subDelivered.ok, true, '套餐发货推送处理成功')
  const subDeliveredOrder = subDeliverFake.__store.getCollection('recharge_orders').get('sub-deliver-1')
  assert.equal(subDeliveredOrder.status, 'paid')
  assert.equal(subDeliveredOrder.fulfillmentStatus, 'succeeded')
  assert.equal(subDeliveredOrder.fulfillmentSource, 'push')
  assert.equal(subDeliverFake.__store.getCollection('users').get('u4').plan, 'pro', '套餐回调发货升级 plan')

  // ── ⑤ 投诉/风控推送落库 ──
  const eventFake = createFakeCloudbase()
  setCurrentFakeCloudbase(eventFake)
  const eventCb = loadCallbackTest()
  const complaint = await eventCb.recordXpayEvent({
    Event: 'xpay_complaint_notify', OpenId: 'openid9', ComplaintId: 'c-1', WxOrderId: 'wx-9', MchOrderId: 'RCx9',
    ComplaintDetail: '用户投诉内容', ComplaintTime: '1780000000', RetryTimes: '0'
  })
  assert.equal(complaint.ok, true)
  const events = eventFake.__store.getCollection('xpay_event_records')
  assert.equal(events.size, 1, '投诉推送落库')
  const record = events.get([...events.keys()][0])
  assert.equal(record.event, 'xpay_complaint_notify')
  assert.equal(record.complaintId, 'c-1')
  assert.equal(record.complaintDetail, '用户投诉内容')
  const risk = await eventCb.recordXpayEvent({
    Event: 'xpay_wxpay_callback_notify', BusinessCode: 'biz-1', BusinessState: 'punishment', EventType: 'punishment', Remark: '管控'
  })
  assert.equal(risk.ok, true)
  assert.equal(events.size, 2, '风控推送落库')

  // ── P1-7：并发发货只发放一次（条件更新抢占 + 幂等）──
  const conFake = createFakeCloudbase()
  setCurrentFakeCloudbase(conFake)
  seed(conFake.__store, 'users', 'u7', { openid: 'openid7', extraTokens: 0, plan: 'free' })
  seed(conFake.__store, 'recharge_orders', 'rc-con-1', {
    _id: 'rc-con-1', userId: 'u7', outTradeNo: 'RCcon001', productType: 'recharge',
    planId: 'p9_9', amountFen: 290, grantTokens: 300000, status: 'pending',
    channel: 'virtual_pay', sandbox: true, createdAt: new Date()
  })
  const conCb = loadCallbackTest()
  const [first, second] = await Promise.all([
    conCb.handleGoodsDelivery(buildDeliveryPayload({ ...order, _id: 'rc-con-1', outTradeNo: 'RCcon001', userId: 'u7' }, { OpenId: 'openid7' })),
    conCb.handleGoodsDelivery(buildDeliveryPayload({ ...order, _id: 'rc-con-1', outTradeNo: 'RCcon001', userId: 'u7' }, { OpenId: 'openid7' }))
  ])
  assert.equal(conFake.__store.getCollection('users').get('u7').extraTokens, 300000, '并发发货 token 只发放一次')
  const conOrder = conFake.__store.getCollection('recharge_orders').get('rc-con-1')
  assert.equal(conOrder.fulfillmentStatus, 'succeeded')

  console.log('recharge refund tests passed')
}

main().catch((error) => { console.error(error); process.exit(1) })
