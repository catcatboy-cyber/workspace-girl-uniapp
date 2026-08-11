'use strict'
/**
 * 后台提现登记集成测试（P1-1 回归）：
 * - 管理员鉴权：普通用户被拒（ADMIN_REQUIRED）
 * - 正常提现：account 扣减 + ledger 写入在同一事务内成功，payload 不带 _id
 * - 重复 businessId：幂等，不重复扣款
 * - 余额不足 / 冻结账户 / 分佣暂停：事务回滚，account 不变
 */
const assert = require('node:assert/strict')
const path = require('path')
const { createFakeCloudbase, setCurrentFakeCloudbase, clearCloudFunctionCache, installCloudbaseMock } = require('./support/fake-cloudbase.cjs')

installCloudbaseMock()

const projectRoot = path.resolve(__dirname, '..')

function loadAdminMain() {
  clearCloudFunctionCache(projectRoot)
  return require(path.join(projectRoot, 'cloudfunctions/adminManage/index.js')).main
}

function seed(store, collection, id, value) {
  store.getCollection(collection).set(id, { _id: id, ...value })
}

async function main() {
  const fake = createFakeCloudbase()
  setCurrentFakeCloudbase(fake)

  seed(fake.__store, 'users', 'admin-1', { email: 'admin@example.com', isAdmin: true })
  seed(fake.__store, 'users', 'normal-1', { email: 'normal@example.com', isAdmin: false })
  seed(fake.__store, 'system_settings', 'settings_subscription', {
    referral: { commission: { enabled: true, payoutPaused: false, rateBps: 1000, settlementDays: 7 } }
  })
  seed(fake.__store, 'commission_accounts', 'inviter-1', { availableFen: 500, withdrawnFen: 0, reversedFen: 0 })
  seed(fake.__store, 'commission_accounts', 'frozen-1', { availableFen: 500, withdrawnFen: 0, payoutBlocked: true })
  fake.__setAuthUser('admin-1')

  const main = loadAdminMain()

  // 1. 正常提现：account 扣减 + ledger 写入，payload 不再带 _id
  const ok = await main({ action: 'markReferralCommissionWithdrawn', userId: 'inviter-1', amountFen: 200, proof: 'transfer-001', businessId: 'biz-001' })
  assert.equal(ok.success, true)
  const account = fake.__store.getCollection('commission_accounts').get('inviter-1')
  assert.equal(account.availableFen, 300)
  assert.equal(account.withdrawnFen, 200)
  const ledger = fake.__store.getCollection('commission_ledger')
  const record = ledger.get('ledger_withdraw_biz-001')
  assert.ok(record, '提现流水必须写入 ledger_withdraw_<businessId>')
  assert.equal(record.type, 'withdrawal')
  assert.equal(record.amountFen, -200)
  assert.equal(record.status, 'withdrawn')
  assert.equal(record.adminUserId, 'admin-1')

  // 2. 重复 businessId：幂等返回，不重复扣款
  const dup = await main({ action: 'markReferralCommissionWithdrawn', userId: 'inviter-1', amountFen: 200, proof: 'transfer-001', businessId: 'biz-001' })
  assert.equal(dup.success, true)
  assert.equal(dup.duplicate, true)
  assert.equal(fake.__store.getCollection('commission_accounts').get('inviter-1').availableFen, 300)

  // 3. 余额不足：事务回滚，account 不变
  const insufficient = await main({ action: 'markReferralCommissionWithdrawn', userId: 'inviter-1', amountFen: 9999, proof: 'transfer-002', businessId: 'biz-002' })
  assert.equal(insufficient.success, false)
  assert.match(String(insufficient.message), /余额不足/)
  assert.equal(fake.__store.getCollection('commission_accounts').get('inviter-1').availableFen, 300)
  assert.equal(fake.__store.getCollection('commission_ledger').has('ledger_withdraw_transfer-002'), false)

  // 4. 冻结账户：拒绝，account 不变
  const frozen = await main({ action: 'markReferralCommissionWithdrawn', userId: 'frozen-1', amountFen: 100, proof: 'transfer-003', businessId: 'biz-003' })
  assert.equal(frozen.success, false)
  assert.match(String(frozen.message), /风控冻结/)
  assert.equal(fake.__store.getCollection('commission_accounts').get('frozen-1').availableFen, 500)

  // 5. 分佣暂停：拒绝
  seed(fake.__store, 'system_settings', 'settings_subscription', {
    referral: { commission: { enabled: true, payoutPaused: true, rateBps: 1000, settlementDays: 7 } }
  })
  const paused = await main({ action: 'markReferralCommissionWithdrawn', userId: 'inviter-1', amountFen: 100, proof: 'transfer-004', businessId: 'biz-004' })
  assert.equal(paused.success, false)
  assert.match(String(paused.message), /暂停/)
  assert.equal(fake.__store.getCollection('commission_accounts').get('inviter-1').availableFen, 300)

  // 6. 普通用户无管理权限
  fake.__setAuthUser('normal-1')
  const denied = await main({ action: 'markReferralCommissionWithdrawn', userId: 'inviter-1', amountFen: 100, proof: 'transfer-005', businessId: 'biz-005' })
  assert.equal(denied.code, 'ADMIN_REQUIRED')
  assert.equal(fake.__store.getCollection('commission_accounts').get('inviter-1').availableFen, 300)

  // 7. P1-2 回归：后台重试缺快照 job → 管理员显式写入当前配置；已有快照 job 不被覆盖
  fake.__setAuthUser('admin-1')
  seed(fake.__store, 'referral_commission_jobs', 'job_snap_missing', {
    source: 'recharge_order', orderId: 'snap-missing', orderType: 'recharge', inviteeUserId: 'inviter-1', paidAmountFen: 9900, paidAt: new Date(),
    commissionConfigSnapshot: null, status: 'needs_review', statusReason: 'CONFIG_SNAPSHOT_UNAVAILABLE', attempts: 0, nextRunAt: null
  })
  seed(fake.__store, 'referral_commission_jobs', 'job_snap_has', {
    source: 'recharge_order', orderId: 'snap-has', orderType: 'recharge', inviteeUserId: 'inviter-1', paidAmountFen: 9900, paidAt: new Date(),
    commissionConfigSnapshot: { enabled: true, rateBps: 500 }, status: 'retry', attempts: 2, nextRunAt: null
  })
  const retryMissing = await main({ action: 'retryReferralCommissionJob', jobId: 'job_snap_missing' })
  assert.equal(retryMissing.success, true)
  const missingJob = fake.__store.getCollection('referral_commission_jobs').get('job_snap_missing')
  assert.equal(missingJob.status, 'retry')
  assert.equal(missingJob.commissionConfigSnapshot.rateBps, 1000, '缺快照 job 重试时由管理员显式写入当前配置')
  const retryHas = await main({ action: 'retryReferralCommissionJob', jobId: 'job_snap_has' })
  assert.equal(retryHas.success, true)
  const hasJob = fake.__store.getCollection('referral_commission_jobs').get('job_snap_has')
  assert.equal(hasJob.commissionConfigSnapshot.rateBps, 500, '已有快照 job 重试时快照不被覆盖')

  // P2-1 回归：后台金额概览不再受 1000 条上限影响（40 账户 + 1200 条 commission）
  for (let i = 0; i < 40; i++) {
    seed(fake.__store, 'commission_accounts', `overview-account-${i}`, { pendingFen: 100, availableFen: 200, withdrawnFen: 0, totalEarnedFen: 300 })
  }
  for (let i = 0; i < 1200; i++) {
    seed(fake.__store, 'referral_commissions', `overview-commission-${i}`, {
      inviterUserId: `overview-account-${i % 40}`, inviteeUserId: `overview-invitee-${i % 250}`,
      paidAmountFen: 1000 + (i % 7), status: i >= 900 ? 'reversed' : (i >= 300 && i < 600 ? 'available' : 'pending')
    })
  }
  const overview = await main({ action: 'getReferralCommissionOverview' })
  assert.equal(overview.success, true)
  assert.equal(overview.overview.paidInviteCount, 250, '超过 1000 条后已付费好友数不截断')
  assert.equal(overview.overview.paidAmountFen, 1200 * 1000 + 3594, '超过 1000 条后支付金额合计不截断')
  assert.equal(overview.overview.pendingFen, 40 * 100)
  assert.equal(overview.overview.availableFen, 40 * 200 + 300 + 500, '含此前提现用例的 inviter-1/frozen-1 账户')
  assert.equal(overview.overview.withdrawnFen, 200)
  assert.equal(overview.overview.inviterCount, 42)
  assert.equal(overview.overview.commissionCount, 1200)

  // ── 充值/套餐退款与对账（闭环 ②③）──
  // 线下退款标记：manual=true → 直接结算（refunded + 扣 token + 冲正 job）
  seed(fake.__store, 'users', 'refund-user', { openid: '', extraTokens: 5000, plan: 'free' })
  seed(fake.__store, 'recharge_orders', 'rc-refund-1', {
    _id: 'rc-refund-1', userId: 'refund-user', outTradeNo: 'RCrefund001', productType: 'recharge',
    planId: 'p9_9', amountFen: 290, grantTokens: 300000, status: 'paid',
    channel: 'virtual_pay', sandbox: true, paidAt: new Date(), createdAt: new Date()
  })
  const manualRefund = await main({ action: 'refundOrder', orderId: 'rc-refund-1', manual: true, reason: '线下已退' })
  assert.equal(manualRefund.success, true)
  assert.equal(manualRefund.manual, true)
  assert.equal(fake.__store.getCollection('recharge_orders').get('rc-refund-1').status, 'refunded')
  assert.equal(fake.__store.getCollection('users').get('refund-user').extraTokens, 5000 - 300000 < 0 ? 0 : 5000 - 300000, 'token 扣回（不足时扣到 0）')
  assert.ok(fake.__store.getCollection('commission_reversal_jobs').has('reversal_commission_recharge_order_rc-refund-1'), '冲正补偿 job 写入')
  // 重复线下标记：已退款订单被拒（settle 层幂等已在 run-recharge-refund 覆盖）
  const manualDup = await main({ action: 'refundOrder', orderId: 'rc-refund-1', manual: true })
  assert.equal(manualDup.success, false)
  assert.match(String(manualDup.message || ''), /退款/)

  // 微信退款发起：用户缺 openid → OPENID_MISSING + manualOption
  seed(fake.__store, 'users', 'refund-noid', { openid: '', extraTokens: 100, plan: 'free' })
  seed(fake.__store, 'recharge_orders', 'rc-noid-1', {
    _id: 'rc-noid-1', userId: 'refund-noid', outTradeNo: 'RCnoid001', productType: 'recharge',
    planId: 'p9_9', amountFen: 290, grantTokens: 300000, status: 'paid',
    channel: 'virtual_pay', sandbox: true, paidAt: new Date(), createdAt: new Date()
  })
  const noOpenid = await main({ action: 'refundOrder', orderId: 'rc-noid-1' })
  assert.equal(noOpenid.success, false)
  assert.equal(noOpenid.code, 'OPENID_MISSING')
  assert.equal(noOpenid.manualOption, true)
  assert.equal(fake.__store.getCollection('recharge_orders').get('rc-noid-1').status, 'paid', 'OPENID_MISSING 不改变支付状态')

  // 微信退款发起：有 openid 但微信查单失败（测试环境无网络）→ failed + retryable，订单状态不被破坏
  seed(fake.__store, 'users', 'refund-user2', { openid: 'openid-2', extraTokens: 100, plan: 'free' })
  seed(fake.__store, 'recharge_orders', 'rc-refund-2', {
    _id: 'rc-refund-2', userId: 'refund-user2', outTradeNo: 'RCrefund002', productType: 'recharge',
    planId: 'p9_9', amountFen: 290, grantTokens: 300000, status: 'paid', fulfillmentStatus: 'succeeded',
    channel: 'virtual_pay', sandbox: true, paidAt: new Date(), createdAt: new Date()
  })
  const wxRefundFail = await main({ action: 'refundOrder', orderId: 'rc-refund-2' })
  assert.equal(wxRefundFail.success, false)
  assert.equal(wxRefundFail.retryable, true)
  const afterFail = fake.__store.getCollection('recharge_orders').get('rc-refund-2')
  assert.equal(afterFail.status, 'paid', '微信退款失败不改变支付状态')
  assert.equal(afterFail.refundRequestStatus, 'failed')
  assert.ok(afterFail.refundRequestError, '记录失败原因')

  // 查单对账：缺 openid → OPENID_MISSING
  const queryNoOpenid = await main({ action: 'queryRechargeOrderPayment', orderId: 'rc-noid-1', reason: '对账' })
  assert.equal(queryNoOpenid.success, false)
  assert.equal(queryNoOpenid.code, 'OPENID_MISSING')
  // 查单对账：有 openid 但微信查单失败 → WECHAT_QUERY_FAILED，不破坏状态
  seed(fake.__store, 'users', 'refund-user3', { openid: 'openid-3', extraTokens: 100, plan: 'free' })
  seed(fake.__store, 'recharge_orders', 'rc-query-1', {
    _id: 'rc-query-1', userId: 'refund-user3', outTradeNo: 'RCquery001', productType: 'recharge',
    planId: 'p9_9', amountFen: 290, grantTokens: 300000, status: 'pending',
    channel: 'virtual_pay', sandbox: true, createdAt: new Date()
  })
  const queryFail = await main({ action: 'queryRechargeOrderPayment', orderId: 'rc-query-1', reason: '对账' })
  assert.equal(queryFail.success, false)
  assert.equal(queryFail.code, 'WECHAT_QUERY_FAILED')
  assert.equal(fake.__store.getCollection('recharge_orders').get('rc-query-1').status, 'pending', '查单失败不破坏状态')
  // 查单对账：已履约订单 → alreadyPaid
  const queryAlreadyPaid = await main({ action: 'queryRechargeOrderPayment', orderId: 'rc-refund-2', reason: '对账' })
  assert.equal(queryAlreadyPaid.success, true)
  assert.equal(queryAlreadyPaid.alreadyPaid, true)
  // 退款在途 + 已发货 → 不得短路 alreadyPaid，必须查微信（无网络 → WECHAT_QUERY_FAILED 而非 alreadyPaid）
  seed(fake.__store, 'recharge_orders', 'rc-refund-2', {
    _id: 'rc-refund-2', userId: 'refund-user2', outTradeNo: 'RCrefund002', productType: 'recharge',
    planId: 'p9_9', amountFen: 290, grantTokens: 300000, status: 'paid', fulfillmentStatus: 'succeeded',
    refundRequestStatus: 'processing', refundOrderId: 'refund-rc-2',
    channel: 'virtual_pay', sandbox: true, paidAt: new Date(), createdAt: new Date()
  })
  const queryRefundInFlight = await main({ action: 'queryRechargeOrderPayment', orderId: 'rc-refund-2', reason: '对账' })
  assert.equal(queryRefundInFlight.success, false, '退款在途不短路 alreadyPaid')
  assert.equal(queryRefundInFlight.code, 'WECHAT_QUERY_FAILED', '退款在途必须真正查微信')
  // 查单对账：缺少原因 → 拒绝
  const queryNoReason = await main({ action: 'queryRechargeOrderPayment', orderId: 'rc-query-1' })
  assert.equal(queryNoReason.success, false)

  console.log('admin withdrawal tests passed')
}

main().catch((error) => { console.error(error); process.exit(1) })
