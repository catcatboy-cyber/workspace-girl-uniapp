'use strict'

const assert = require('assert')
const { applyRefundNotification } = require('../cloudfunctions/_shared/archetype-report-access')

class MemoryDb {
  constructor(seed) { this.tables = Object.fromEntries(Object.entries(seed).map(([name, rows]) => [name, rows.map((row) => ({ ...row }))])) }
  collection(name) {
    if (!this.tables[name]) this.tables[name] = []
    const table = this.tables[name]
    return {
      where: (filter) => {
        const get = async () => ({ data: table.filter((row) => Object.entries(filter).every(([key, value]) => row[key] === value)) })
        return { get, limit: () => ({ get }) }
      },
      doc: (id) => ({
        get: async () => ({ data: table.filter((row) => row._id === id) }),
        update: async (patch) => { const row = table.find((item) => item._id === id); Object.assign(row, patch); return {} }
      }),
      add: async (record) => { const row = { _id: `${name}-${table.length + 1}`, ...record }; table.push(row); return { id: row._id } }
    }
  }
  runTransaction(fn) { return fn(this) }
}

const seed = {
  archetype_report_orders: [{ _id: 'o1', outTradeNo: 'HPR1', openidSnapshot: 'openid', origPriceFen: 199, resultId: 'r1', status: 'fulfilled', wxRefundId: '' }],
  archetype_results: [{ _id: 'r1', userId: 'u1', reportAccess: { purchaseState: 'unlocked', purchaseOrderId: 'o1', purchasedAt: new Date('2026-08-01') } }],
  archetype_report_refund_tasks: [{ _id: 't1', orderId: 'o1', status: 'pending' }]
}

;(async () => {
  const db = new MemoryDb(seed)
  const payload = { MchOrderId: 'HPR1', OpenId: 'openid', WxRefundId: 'wr1', MchRefundId: 'mr1', RefundFee: 199, RetCode: 0, RetMsg: 'ok', RefundStartTimestamp: 1, RefundSuccTimestamp: 2, WxpayRefundTransactionId: 'rtx', RetryTimes: 0 }
  const first = await applyRefundNotification(db, payload, { refundRevokesPurchase: true })
  assert.equal(first.refunded, true)
  assert.equal(db.tables.archetype_report_orders[0].status, 'refunded')
  assert.equal(db.tables.archetype_results[0].reportAccess.purchaseState, 'revoked')
  assert.equal(db.tables.archetype_report_refund_tasks[0].status, 'refunded')
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
  console.log('archetype report refund tests passed')
})().catch((error) => { console.error(error); process.exit(1) })
