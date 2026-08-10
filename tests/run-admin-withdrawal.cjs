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

  console.log('admin withdrawal tests passed')
}

main().catch((error) => { console.error(error); process.exit(1) })
