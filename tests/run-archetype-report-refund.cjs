'use strict'

const assert = require('assert')
const { applyRefundNotification, finalizeOrderRefund } = require('../cloudfunctions/_shared/archetype-report-access')
const { processDueReversalJobs } = require('../cloudfunctions/_shared/referral-commission')

class MemoryDb {
  constructor(seed) { this.tables = Object.fromEntries(Object.entries(seed).map(([name, rows]) => [name, rows.map((row) => ({ ...row }))])) }
  // 模拟 @cloudbase/node-sdk 的 db.command：set 整体替换（含 null -> 对象）、lte/lt/gte/gt/in 比较
  get command() {
    return {
      set: (value) => ({ __cmd: 'set', __value: value }),
      lte: (value) => ({ __cmd: 'lte', __value: value }),
      lt: (value) => ({ __cmd: 'lt', __value: value }),
      gte: (value) => ({ __cmd: 'gte', __value: value }),
      gt: (value) => ({ __cmd: 'gt', __value: value }),
      in: (values) => ({ __cmd: 'in', __value: values })
    }
  }
  collection(name) {
    if (!this.tables[name]) this.tables[name] = []
    const table = this.tables[name]
    const match = (actual, expected) => {
      if (expected && typeof expected === 'object' && expected.__cmd) {
        if (expected.__cmd === 'lte') return actual <= expected.__value
        if (expected.__cmd === 'lt') return actual < expected.__value
        if (expected.__cmd === 'gte') return actual >= expected.__value
        if (expected.__cmd === 'gt') return actual > expected.__value
        if (expected.__cmd === 'in') return Array.isArray(expected.__value) && expected.__value.includes(actual)
        return false
      }
      return actual === expected
    }
    return {
      where: (filter) => {
        const get = async () => ({ data: table.filter((row) => Object.entries(filter).every(([key, value]) => match(row[key], value))) })
        return { get, limit: () => ({ get }) }
      },
      doc: (id) => ({
        get: async () => ({ data: table.filter((row) => row._id === id) }),
        update: async (patch) => {
          const row = table.find((item) => item._id === id)
          for (const [key, value] of Object.entries(patch)) {
            row[key] = (value && typeof value === 'object' && value.__cmd === 'set') ? value.__value : value
          }
          return {}
        },
        set: async (record) => { const index = table.findIndex((item) => item._id === id); const row = { ...record, _id: id }; if (index >= 0) table[index] = row; else table.push(row); return {} }
      }),
      add: async (record) => { const row = { _id: `${name}-${table.length + 1}`, ...record }; table.push(row); return { id: row._id } }
    }
  }
  runTransaction(fn) { return fn(this) }
}

const seed = {
  // lastRefundNotification: null 复现生产订单初始状态（回归：db.command.set 必须能覆盖 null 字段）
  archetype_report_orders: [{ _id: 'o1', outTradeNo: 'HPR1', openidSnapshot: 'openid', origPriceFen: 199, resultId: 'r1', status: 'fulfilled', wxRefundId: '', lastRefundNotification: null }],
  archetype_results: [{ _id: 'r1', userId: 'u1', reportAccess: { purchaseState: 'unlocked', purchaseOrderId: 'o1', purchasedAt: new Date('2026-08-01') } }],
  archetype_report_refund_tasks: [{ _id: 't1', orderId: 'o1', status: 'pending' }],
  referral_commissions: [{ _id: 'commission_archetype_report_order_o1', inviterUserId: 'inviter', inviteeUserId: 'u1', productType: 'prop', orderId: 'o1', commissionFen: 19, commissionRateBps: 1000, paidAmountFen: 199, status: 'pending' }],
  commission_accounts: [{ _id: 'inviter', pendingFen: 19, availableFen: 0, reversedFen: 0 }],
  commission_ledger: [],
  commission_review_tasks: []
}

;(async () => {
  const db = new MemoryDb(seed)
  const payload = { MchOrderId: 'HPR1', OpenId: 'openid', WxRefundId: 'wr1', MchRefundId: 'mr1', RefundFee: 199, RetCode: 0, RetMsg: 'ok', RefundStartTimestamp: 1, RefundSuccTimestamp: 2, WxpayRefundTransactionId: 'rtx', RetryTimes: 0 }
  const first = await applyRefundNotification(db, payload, { refundRevokesPurchase: true })
  assert.equal(first.refunded, true)
  // 回归：lastRefundNotification 初始为 null 时，db.command.set 必须能整体替换为对象（原生产 PathNotViable 场景）
  assert.equal(db.tables.archetype_report_orders[0].lastRefundNotification.wxRefundId, 'wr1')
  assert.equal(db.tables.archetype_report_orders[0].lastRefundNotification.retCode, 0)
  assert.equal(db.tables.archetype_report_orders[0].status, 'refunded')
  assert.equal(db.tables.archetype_results[0].reportAccess.purchaseState, 'revoked')
  assert.equal(db.tables.archetype_report_refund_tasks[0].status, 'refunded')
  assert.equal(first.commissionReversal.status, 'reversed')
  assert.equal(db.tables.referral_commissions[0].status, 'reversed')
  assert.equal(db.tables.commission_accounts[0].pendingFen, 0)
  assert.equal(db.tables.commission_ledger[0].amountFen, -19)
  const duplicate = await applyRefundNotification(db, payload, { refundRevokesPurchase: true })
  assert.equal(duplicate.duplicate, true)

  const mismatchDb = new MemoryDb(seed)
  mismatchDb.tables.archetype_report_orders[0].wxOrderIdVerified = 'wx-order-1'
  await assert.rejects(
    () => applyRefundNotification(mismatchDb, { ...payload, WxRefundId: 'wr-mismatch', WxOrderId: 'wx-order-2' }, { refundRevokesPurchase: true }),
    (error) => error.code === 'REFUND_VALIDATION_FAILED'
  )

  const failedDb = new MemoryDb(seed)
  const failed = await applyRefundNotification(failedDb, { ...payload, WxRefundId: 'wr2', RetCode: 1 }, { refundRevokesPurchase: true })
  assert.equal(failed.refunded, false)
  assert.equal(failedDb.tables.archetype_results[0].reportAccess.purchaseState, 'unlocked')
  assert.equal(failedDb.tables.archetype_report_orders[0].wxRefundId, '')
  assert.equal(failedDb.tables.archetype_report_orders[0].lastRefundNotification.wxRefundId, 'wr2')
  assert.equal(failedDb.tables.archetype_report_orders[0].lastRefundNotification.retCode, 1)

  // 后台主动查单同步退款（finalizeOrderRefund，wxRefundId 用 query: 占位）
  const queryDb = new MemoryDb(seed)
  const queryResult = await finalizeOrderRefund(queryDb, {
    outTradeNo: 'HPR1',
    wxRefundId: 'query:HPR1:abc123',
    mchRefundId: 'HPRR-refund-order',
    refundFeeFen: 199,
    retCode: 0,
    retMsg: 'admin query refund status=5',
    refundSucceededAt: new Date(),
    source: 'admin_query:admin-1'
  })
  assert.equal(queryResult.refunded, true)
  assert.equal(queryDb.tables.archetype_report_orders[0].status, 'refunded')
  assert.equal(queryDb.tables.archetype_report_orders[0].refundRequestStatus, 'refunded')
  assert.equal(queryDb.tables.archetype_report_orders[0].lastRefundNotification.wxRefundId, 'query:HPR1:abc123')
  assert.equal(queryDb.tables.archetype_report_orders[0].lastRefundNotification.source, 'admin_query:admin-1')
  assert.equal(queryDb.tables.archetype_results[0].reportAccess.purchaseState, 'revoked')
  assert.equal(queryDb.tables.archetype_report_refund_tasks[0].status, 'refunded')
  // 幂等：重复调用不重复处理
  const queryDup = await finalizeOrderRefund(queryDb, { outTradeNo: 'HPR1', wxRefundId: 'query:HPR1:abc123', refundFeeFen: 199 })
  assert.equal(queryDup.duplicate, true)

  // P0-1 回归：首次佣金冲正失败 → 订单已 refunded + 补偿 job 留存 → worker 重试最终冲正成功
  const flaky = new MemoryDb(seed)
  let reversalCalls = 0
  const flakyDb = {
    ...flaky,
    command: flaky.command,
    collection: (name) => flaky.collection(name),
    runTransaction: async (fn) => {
      reversalCalls += 1
      // 第 1 次 = 退款落库事务（放行）；第 2 次 = 事务外冲正（模拟瞬时失败）；第 3 次起恢复
      if (reversalCalls === 2) throw new Error('simulated reversal failure')
      return flaky.runTransaction(fn)
    }
  }
  const p01 = await finalizeOrderRefund(flakyDb, { outTradeNo: 'HPR1', wxRefundId: 'query:P01', refundFeeFen: 199, retCode: 0, source: 'wechat_notify' })
  assert.equal(p01.refunded, true)
  assert.equal(flaky.tables.archetype_report_orders[0].status, 'refunded')
  assert.equal(flaky.tables.referral_commissions[0].status, 'pending')  // 冲正失败，佣金仍 pending
  assert.ok(p01.commissionReversal && p01.commissionReversal.success === false)
  const reversalJob = flaky.tables.commission_reversal_jobs[0]
  assert.ok(reversalJob, '退款事务内必须写入冲正补偿 job')
  assert.equal(reversalJob.status, 'pending')
  assert.equal(reversalJob.commissionId, 'commission_archetype_report_order_o1')
  const retried = await processDueReversalJobs(flakyDb, { limit: 10 })
  assert.equal(retried.succeeded, 1)
  assert.equal(flaky.tables.commission_reversal_jobs[0].status, 'done')
  assert.equal(flaky.tables.referral_commissions[0].status, 'reversed')
  assert.equal(flaky.tables.commission_accounts[0].pendingFen, 0)

  // 重复通知补写 job（幂等，不覆盖已 done 状态）
  const dupAgain = await finalizeOrderRefund(flakyDb, { outTradeNo: 'HPR1', wxRefundId: 'query:P01', refundFeeFen: 199, retCode: 0 })
  assert.equal(dupAgain.duplicate, true)
  assert.equal(flaky.tables.commission_reversal_jobs[0].status, 'done')
  console.log('archetype report refund tests passed')
})().catch((error) => { console.error(error); process.exit(1) })
