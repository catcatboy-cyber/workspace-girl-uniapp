const assert = require('node:assert/strict')
const { createFakeCloudbase } = require('./support/fake-cloudbase.cjs')

function seed(store, collection, id, value) {
  store.getCollection(collection).set(id, { _id: id, ...value })
}

async function main() {
  const fake = createFakeCloudbase()
  const db = fake.init().database()
  const commission = require('../cloudfunctions/_shared/referral-commission')
  const baseTime = new Date('2026-08-08T00:00:00.000Z')
  commission.setNowProvider(() => baseTime)
  seed(fake.__store, 'system_settings', 'settings_subscription', {
    referral: { commission: { enabled: true, rateBps: 1000, settlementDays: 7, mode: 'all_orders', maxCommissionFenPerOrder: 10000, maxCommissionFenPerInviterMonth: 100000 } }
  })
  seed(fake.__store, 'users', 'inviter', { nickname: '邀请人' })
  seed(fake.__store, 'users', 'invitee', { nickname: '好友' })
  seed(fake.__store, 'referral_claims', 'invitee', { inviteeUserId: 'invitee', inviterUserId: 'inviter', status: 'rewarded' })

  const queued = await commission.enqueueCommissionJob(db, {
    source: 'recharge_order', orderId: 'order-1', orderType: 'recharge', userId: 'invitee', paidAmountFen: 9900, paidAt: baseTime, transactionId: 'txn-1'
  })
  assert.equal(queued.success, true)
  assert.equal(queued.queued, true)
  const duplicateQueue = await commission.enqueueCommissionJob(db, {
    source: 'recharge_order', orderId: 'order-1', orderType: 'recharge', userId: 'invitee', paidAmountFen: 9999, paidAt: baseTime, transactionId: 'txn-duplicate'
  })
  assert.equal(duplicateQueue.duplicate, true)
  seed(fake.__store, 'system_settings', 'settings_subscription', {
    referral: { commission: { enabled: true, rateBps: 2000, settlementDays: 7, mode: 'all_orders', maxCommissionFenPerOrder: 10000, maxCommissionFenPerInviterMonth: 100000 } }
  })

  const processed = await commission.processDueCommissionJobs(db, { limit: 20 })
  assert.equal(processed.succeeded, 1)
  const created = fake.__store.getCollection('referral_commissions').get('commission_recharge_order_order-1')
  assert.equal(created.commissionFen, 990)
  assert.equal(fake.__store.getCollection('commission_accounts').get('inviter').pendingFen, 990)
  assert.equal(fake.__store.getCollection('commission_ledger').size, 1)

  const beforeRelease = await commission.releaseDueCommissions(db)
  assert.equal(beforeRelease.released, 0)
  commission.setNowProvider(() => new Date('2026-08-16T00:00:00.000Z'))
  const released = await commission.releaseDueCommissions(db)
  assert.equal(released.released, 1)
  assert.equal(fake.__store.getCollection('commission_accounts').get('inviter').availableFen, 990)
  assert.equal(created.status, 'pending')
  assert.equal(fake.__store.getCollection('referral_commissions').get(created._id).status, 'available')

  const summary = await commission.getUserCommissionSummary(db, 'inviter')
  assert.equal(summary.summary.inviteCount, 1)
  assert.equal(summary.summary.paidInviteCount, 1)
  assert.equal(summary.summary.availableFen, 990)
  const ledger = await commission.listUserCommissionLedger(db, 'inviter', { limit: 10 })
  assert.equal(ledger.items.length, 1)
  assert.equal(ledger.items[0].status, 'available')

  const reversed = await commission.reverseCommissionForRefund(db, { commissionId: created._id, refundAmountFen: 9900, reason: 'manual refund' })
  assert.equal(reversed.status, 'reversed')
  assert.equal(fake.__store.getCollection('commission_accounts').get('inviter').availableFen, 0)
  assert.equal(fake.__store.getCollection('commission_ledger').size, 3)
  const reversedLedger = await commission.listUserCommissionLedger(db, 'inviter', { limit: 10 })
  assert.equal(reversedLedger.items.length, 1)
  assert.equal(reversedLedger.items[0].commissionFen, -990)

  const recoveryFake = createFakeCloudbase()
  const recoveryDb = recoveryFake.init().database()
  seed(recoveryFake.__store, 'system_settings', 'settings_subscription', {
    referral: { commission: { enabled: true, rateBps: 1000, settlementDays: 7 } }
  })
  seed(recoveryFake.__store, 'recharge_orders', 'bad-order', { status: 'paid', fulfillmentStatus: 'succeeded', productType: 'recharge', userId: 'invitee', amountFen: 0 })
  const recovery = await commission.recoverCommissionJobs(recoveryDb, { limit: 10 })
  assert.equal(recovery.recovered, 1)
  assert.equal(recoveryFake.__store.getCollection('referral_commission_jobs').get('job_recharge_order_bad-order').status, 'needs_review')

  const reportFake = createFakeCloudbase()
  const reportDb = reportFake.init().database()
  seed(reportFake.__store, 'system_settings', 'settings_subscription', {
    referral: { commission: { enabled: true, rateBps: 1000, settlementDays: 7 } },
    heartPersonaReportPayment: { enabled: true, priceFen: 199 }
  })
  seed(reportFake.__store, 'archetype_report_orders', 'report-order', { outTradeNo: 'REPORT-1', userId: 'report-invitee', resultId: 'report-result', status: 'pending', origPriceFen: 199, actualPriceFen: 199 })
  seed(reportFake.__store, 'archetype_results', 'report-result', { _id: 'report-result', userId: 'report-invitee', reportAccess: { purchaseState: 'preview' } })
  seed(reportFake.__store, 'users', 'report-inviter', {})
  seed(reportFake.__store, 'users', 'report-invitee', {})
  seed(reportFake.__store, 'referral_claims', 'report-invitee', { inviteeUserId: 'report-invitee', inviterUserId: 'report-inviter', status: 'rewarded' })
  const reportAccess = require('../cloudfunctions/_shared/archetype-report-access')
  const reportFulfilled = await reportAccess.fulfillReportOrder(reportDb, { outTradeNo: 'REPORT-1', source: 'test', paymentEvidence: { actualPriceFen: 199, transactionId: 'report-txn' } })
  assert.equal(reportFulfilled.fulfilled, true)
  const reportJob = reportFake.__store.getCollection('referral_commission_jobs').get('job_archetype_report_order_report-order')
  assert.equal(reportJob.paidAmountFen, 199)
  assert.equal(reportJob.commissionConfigSnapshot.rateBps, 1000)

  const config = commission.normalizeCommissionConfig({ rateBps: 5000, settlementDays: 30, mode: 'first_order' })
  assert.deepEqual({ rateBps: config.rateBps, settlementDays: config.settlementDays, mode: config.mode }, { rateBps: 5000, settlementDays: 30, mode: 'first_order' })
  assert.equal(commission.calculateCommissionFen(999, 1000), 99)
  assert.equal(commission.calculateCommissionFen(999, 1000, 50), 50)

  const firstOrderFake = createFakeCloudbase()
  const firstOrderDb = firstOrderFake.init().database()
  seed(firstOrderFake.__store, 'system_settings', 'settings_subscription', {
    referral: { commission: { enabled: true, rateBps: 1000, settlementDays: 7, mode: 'first_order', maxCommissionFenPerOrder: 10000, maxCommissionFenPerInviterMonth: 100000 } }
  })
  seed(firstOrderFake.__store, 'users', 'first-inviter', {})
  seed(firstOrderFake.__store, 'users', 'first-invitee', {})
  seed(firstOrderFake.__store, 'referral_claims', 'first-invitee', { inviteeUserId: 'first-invitee', inviterUserId: 'first-inviter', status: 'rewarded' })
  // P1-2 后 createCommissionForPaidOrder 要求 job 自带配置快照（禁止 worker 猜当前配置）
  const firstSnapshot = await commission.getCommissionConfig(firstOrderDb)
  const first = await commission.createCommissionForPaidOrder(firstOrderDb, commission.buildJob({ source: 'recharge_order', orderId: 'first-1', orderType: 'recharge', userId: 'first-invitee', paidAmountFen: 1000, commissionConfigSnapshot: firstSnapshot }))
  const second = await commission.createCommissionForPaidOrder(firstOrderDb, commission.buildJob({ source: 'recharge_order', orderId: 'first-2', orderType: 'recharge', userId: 'first-invitee', paidAmountFen: 1000, commissionConfigSnapshot: firstSnapshot }))
  assert.equal(first.created, true)
  assert.equal(second.reason, 'FIRST_ORDER_ALREADY_SETTLED')

  const capFake = createFakeCloudbase()
  const capDb = capFake.init().database()
  seed(capFake.__store, 'system_settings', 'settings_subscription', {
    referral: { commission: { enabled: true, rateBps: 1000, settlementDays: 7, mode: 'all_orders', maxCommissionFenPerOrder: 10000, maxCommissionFenPerInviterMonth: 1000 } }
  })
  seed(capFake.__store, 'users', 'cap-inviter', {})
  seed(capFake.__store, 'users', 'cap-invitee', {})
  seed(capFake.__store, 'referral_claims', 'cap-invitee', { inviteeUserId: 'cap-invitee', inviterUserId: 'cap-inviter', status: 'rewarded' })
  const capSnapshot = await commission.getCommissionConfig(capDb)
  const underCap = await commission.createCommissionForPaidOrder(capDb, commission.buildJob({ source: 'recharge_order', orderId: 'cap-1', orderType: 'recharge', userId: 'cap-invitee', paidAmountFen: 6000, commissionConfigSnapshot: capSnapshot }))
  const overCap = await commission.createCommissionForPaidOrder(capDb, commission.buildJob({ source: 'recharge_order', orderId: 'cap-2', orderType: 'recharge', userId: 'cap-invitee', paidAmountFen: 6000, commissionConfigSnapshot: capSnapshot }))
  assert.equal(underCap.created, true)
  assert.equal(overCap.reason, 'MONTHLY_CAP')

  const pausedFake = createFakeCloudbase()
  const pausedDb = pausedFake.init().database()
  seed(pausedFake.__store, 'system_settings', 'settings_subscription', {
    referral: { commission: { enabled: true, payoutPaused: true, rateBps: 1000, settlementDays: 0 } }
  })
  seed(pausedFake.__store, 'commission_accounts', 'paused-inviter', { pendingFen: 100, availableFen: 0 })
  seed(pausedFake.__store, 'referral_commissions', 'paused-commission', { inviterUserId: 'paused-inviter', commissionFen: 100, status: 'pending', availableAt: baseTime })
  const paused = await commission.releaseDueCommissions(pausedDb)
  assert.equal(paused.paused, true)
  assert.equal(pausedFake.__store.getCollection('commission_accounts').get('paused-inviter').pendingFen, 100)

  const blockedFake = createFakeCloudbase()
  const blockedDb = blockedFake.init().database()
  seed(blockedFake.__store, 'commission_accounts', 'blocked-inviter', { pendingFen: 0, availableFen: 20, reversedFen: 0 })
  seed(blockedFake.__store, 'referral_commissions', 'blocked-commission', { inviterUserId: 'blocked-inviter', commissionFen: 100, commissionRateBps: 1000, paidAmountFen: 1000, productType: 'recharge', orderId: 'blocked-order', status: 'available' })
  const blocked = await commission.reverseCommissionForRefund(blockedDb, { commissionId: 'blocked-commission', refundAmountFen: 1000 })
  const blockedDuplicate = await commission.reverseCommissionForRefund(blockedDb, { commissionId: 'blocked-commission', refundAmountFen: 1000 })
  assert.equal(blocked.status, 'blocked')
  assert.equal(blocked.recoveryFen, 80)
  assert.equal(blockedDuplicate.duplicate, true)
  assert.equal(blockedFake.__store.getCollection('commission_accounts').get('blocked-inviter').availableFen, 0)
  assert.equal(blockedFake.__store.getCollection('commission_accounts').get('blocked-inviter').payoutBlocked, true)
  assert.equal(blockedFake.__store.getCollection('commission_review_tasks').size, 1)

  // P0-2 回归：恢复扫描用持久化复合游标，跨批次不重不漏（60 充值 + 60 报告 > 每类 25/轮预算）
  const recoverFake = createFakeCloudbase()
  const recoverDb = recoverFake.init().database()
  seed(recoverFake.__store, 'system_settings', 'settings_subscription', {
    referral: { commission: { enabled: true, rateBps: 1000, settlementDays: 7, mode: 'all_orders', maxCommissionFenPerOrder: 10000, maxCommissionFenPerInviterMonth: 100000 } }
  })
  for (let i = 0; i < 60; i++) {
    // index 24 与 25 使用相同 paidAt，验证游标时间边界的同值批次不重不漏
    const ts = new Date(baseTime.getTime() + (i >= 25 ? 24 : i) * 60000)
    seed(recoverFake.__store, 'recharge_orders', `rc-${String(i).padStart(3, '0')}`, {
      status: 'paid', fulfillmentStatus: 'succeeded', productType: 'recharge', userId: `u-rc-${i}`, amountFen: 1000 + i, paidAt: ts, transactionId: `tx-rc-${i}`
    })
    seed(recoverFake.__store, 'archetype_report_orders', `rp-${String(i).padStart(3, '0')}`, {
      status: 'fulfilled', userId: `u-rp-${i}`, actualPriceFen: 199, paidAt: ts
    })
  }
  const round1 = await commission.recoverCommissionJobs(recoverDb, { limit: 50 })
  assert.equal(round1.scanned, 50)
  assert.equal(round1.recovered, 50)
  const round2 = await commission.recoverCommissionJobs(recoverDb, { limit: 50 })
  assert.equal(round2.scanned, 50)
  assert.equal(round2.recovered, 50) // 前 25 条已有 job，游标仍推进到第 50 条
  const round3 = await commission.recoverCommissionJobs(recoverDb, { limit: 50 })
  assert.equal(round3.scanned, 20)
  assert.equal(round3.recovered, 20)
  const jobs = recoverFake.__store.getCollection('referral_commission_jobs')
  assert.equal(jobs.size, 120, '60 充值 + 60 报告订单全部补建 job')
  const progress = recoverFake.__store.getCollection('commission_scan_progress')
  assert.equal(progress.size, 2, '两类订单各自持久化扫描进度')
  assert.equal(progress.get('scan_recharge_order').lastId, 'rc-059')
  assert.equal(progress.get('scan_archetype_report_order').lastId, 'rp-059')
  // 幂等：再跑一轮不重复建 job，游标不再前进
  const round4 = await commission.recoverCommissionJobs(recoverDb, { limit: 50 })
  assert.equal(round4.scanned, 0)
  assert.equal(round4.recovered, 0)
  assert.equal(jobs.size, 120)

  // P1-2 回归：支付时配置快照读取失败 → needs_review + CONFIG_SNAPSHOT_UNAVAILABLE，禁止按未来配置结算
  const snapshotFake = createFakeCloudbase()
  const snapshotDb = snapshotFake.init().database()
  seed(snapshotFake.__store, 'system_settings', 'settings_subscription', {
    referral: { commission: { enabled: true, rateBps: 1000, settlementDays: 7 } }
  })
  seed(snapshotFake.__store, 'users', 'snap-inviter', {})
  seed(snapshotFake.__store, 'referral_claims', 'snap-invitee', { inviteeUserId: 'snap-invitee', inviterUserId: 'snap-inviter', status: 'rewarded' })
  const brokenDb = {
    ...snapshotDb,
    collection: (name) => name === 'system_settings'
      ? { doc: () => ({ get: async () => { throw new Error('simulated config read failure') } }) }
      : snapshotDb.collection(name)
  }
  const queuedNoSnapshot = await commission.enqueueCommissionJob(brokenDb, {
    source: 'recharge_order', orderId: 'snap-order-1', orderType: 'recharge', userId: 'snap-invitee', paidAmountFen: 9900, paidAt: baseTime, transactionId: 'snap-txn-1'
  })
  assert.equal(queuedNoSnapshot.queued, true)
  const noSnapshotJob = snapshotFake.__store.getCollection('referral_commission_jobs').get('job_recharge_order_snap-order-1')
  assert.equal(noSnapshotJob.status, 'needs_review')
  assert.equal(noSnapshotJob.statusReason, 'CONFIG_SNAPSHOT_UNAVAILABLE')
  assert.equal(noSnapshotJob.commissionConfigSnapshot, null)

  // 防御：历史遗留 pending job 缺快照 → worker 直接转 needs_review，不猜当前配置、不建佣金
  seed(snapshotFake.__store, 'referral_commission_jobs', 'job_recharge_order_snap-order-legacy', {
    source: 'recharge_order', orderId: 'snap-order-legacy', orderType: 'recharge', inviteeUserId: 'snap-invitee', paidAmountFen: 9900, paidAt: baseTime,
    commissionId: 'commission_recharge_order_snap-order-legacy', commissionConfigSnapshot: null,
    status: 'pending', attempts: 0, nextRunAt: baseTime, leaseOwner: '', leaseUntil: null
  })
  const processedLegacy = await commission.processDueCommissionJobs(snapshotDb, { limit: 20 })
  assert.equal(processedLegacy.needs_review, 1)
  const legacyJob = snapshotFake.__store.getCollection('referral_commission_jobs').get('job_recharge_order_snap-order-legacy')
  assert.equal(legacyJob.status, 'needs_review')
  assert.equal(legacyJob.statusReason, 'CONFIG_SNAPSHOT_UNAVAILABLE')
  assert.equal(snapshotFake.__store.getCollection('referral_commissions').size, 0)

  // P2-1 回归：用户统计不再受 1000 条上限影响（1200 条 commission、300 个付费好友，reversed 不计入）
  const bigFake = createFakeCloudbase()
  const bigDb = bigFake.init().database()
  seed(bigFake.__store, 'system_settings', 'settings_subscription', {
    referral: { commission: { enabled: true, rateBps: 1000, settlementDays: 7, mode: 'all_orders' } }
  })
  seed(bigFake.__store, 'users', 'big-inviter', {})
  for (let i = 0; i < 1200; i++) {
    // 每个好友 4 条记录：3 条 pending/available + 1 条 reversed（reversed 不应计入 paidInviteCount）
    const inviteeId = `big-invitee-${i % 300}`
    const status = i >= 900 ? 'reversed' : (i >= 300 && i < 600 ? 'available' : 'pending')
    seed(bigFake.__store, 'referral_commissions', `big-commission-${i}`, {
      inviterUserId: 'big-inviter', inviteeUserId: inviteeId, commissionFen: 100, paidAmountFen: 1000, status
    })
  }
  const bigSummary = await commission.getUserCommissionSummary(bigDb, 'big-inviter')
  assert.equal(bigSummary.summary.paidInviteCount, 300, '超过 1000 条后已付费好友数不截断')
  // P2-3 回归：rule 返回实际参与产品与退款说明（页面按 include* 动态生成文案）
  assert.equal(bigSummary.rule.includeSubscription, true)
  assert.equal(bigSummary.rule.includeRecharge, true)
  assert.equal(bigSummary.rule.includeProp, true)
  assert.match(bigSummary.rule.refundNote, /撤销/)
  const excludedFake = createFakeCloudbase()
  const excludedDb = excludedFake.init().database()
  seed(excludedFake.__store, 'system_settings', 'settings_subscription', {
    referral: { commission: { enabled: true, rateBps: 1000, settlementDays: 7, mode: 'all_orders', includeRecharge: false } }
  })
  const excludedSummary = await commission.getUserCommissionSummary(excludedDb, 'big-inviter')
  assert.equal(excludedSummary.rule.includeRecharge, false, '配置关闭的产品如实返回 false')

  commission.setNowProvider(() => new Date())
  console.log('referral commission tests passed')
}

main().catch((error) => { console.error(error); process.exit(1) })
