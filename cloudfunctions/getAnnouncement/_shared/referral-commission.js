'use strict'

const { getSubscriptionConfig } = require('./subscription')

const JOBS = 'referral_commission_jobs'
const COMMISSIONS = 'referral_commissions'
const ACCOUNTS = 'commission_accounts'
const LEDGER = 'commission_ledger'
const CLAIMS = 'referral_claims'
const USERS = 'users'
const RECHARGE_ORDERS = 'recharge_orders'
const REPORT_ORDERS = 'archetype_report_orders'
const REVERSAL_JOBS = 'commission_reversal_jobs'
const REVIEW_TASKS = 'commission_review_tasks'
const SCAN_PROGRESS = 'commission_scan_progress'

const MAX_ATTEMPTS = 8
const REVERSAL_MAX_ATTEMPTS = 8
const JOB_LEASE_MS = 2 * 60 * 1000
const DEFAULT_BATCH = { recover: 50, process: 20, release: 100, reversal: 20 }
const BACKOFF_MS = [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000]
// P1-4：COMMISSION_NOT_FOUND 不再是终态——退款可能先于佣金创建（分佣 job 尚未处理），
// 冲正任务必须退避重试等待 worker 建佣金，8 次后转人工复核，否则佣金会永久漏冲
const TERMINAL_REVERSAL_REASONS = ['ZERO_REVERSAL', 'INVALID_REFUND']

let nowProvider = () => new Date()

function now() { return new Date(nowProvider()) }
function setNowProvider(fn) { nowProvider = typeof fn === 'function' ? fn : () => new Date() }
function asDate(value, fallback = null) {
  if (!value) return fallback
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? fallback : date
}
function asInt(value, fallback = 0) {
  const number = Number(value)
  return Number.isInteger(number) ? number : fallback
}
function normalizeId(value) { return String(value || '').trim() }
function omitDocumentId(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const { _id, ...data } = value
  return data
}
function firstDoc(response) {
  const data = response?.data
  if (Array.isArray(data)) return data[0] || null
  return data && typeof data === 'object' ? data : null
}
async function readDoc(dbLike, collection, id) {
  return firstDoc(await dbLike.collection(collection).doc(id).get())
}
/**
 * 分页遍历集合全部数据（skip + limit 游标推进，不设固定上限）。
 * 用于财务统计聚合，避免固定 1000 条截断导致用户/后台统计失真。
 */
async function scanAll(dbLike, collectionName, where = null, pageSize = 1000) {
  const rows = []
  let offset = 0
  for (;;) {
    let query = dbLike.collection(collectionName)
    if (where) query = query.where(where)
    const { data = [] } = await query.skip(offset).limit(pageSize).get()
    rows.push(...data)
    if (data.length < pageSize) break
    offset += pageSize
  }
  return rows
}
function jobId(source, orderId) { return `job_${source}_${orderId}` }
function commissionId(source, orderId) { return `commission_${source}_${orderId}` }
function ledgerId(businessId) { return `ledger_${businessId}` }
function reversalLedgerId(commissionIdValue) { return `ledger_reverse_${commissionIdValue}` }
function normalizeStatus(value) { return String(value || '').trim().toLowerCase() }

function normalizeCommissionConfig(input = {}) {
  const raw = input?.commission && typeof input.commission === 'object' ? input.commission : input
  const rateBps = Math.max(0, Math.min(5000, asInt(raw.rateBps, 1000)))
  const settlementDays = Math.max(0, Math.min(30, asInt(raw.settlementDays, 7)))
  return {
    enabled: raw.enabled === true,
    payoutPaused: raw.payoutPaused === true,
    mode: raw.mode === 'first_order' ? 'first_order' : 'all_orders',
    rateBps,
    settlementDays,
    includeSubscription: raw.includeSubscription !== false,
    includeRecharge: raw.includeRecharge !== false,
    includeProp: raw.includeProp !== false,
    maxCommissionFenPerOrder: Math.max(0, asInt(raw.maxCommissionFenPerOrder, 10000)),
    maxCommissionFenPerInviterMonth: Math.max(0, asInt(raw.maxCommissionFenPerInviterMonth, 100000)),
    effectiveFrom: asDate(raw.effectiveFrom),
    ruleVersion: Math.max(1, asInt(raw.ruleVersion, 1))
  }
}

async function getCommissionConfig(db) {
  const config = await getSubscriptionConfig(db)
  return normalizeCommissionConfig(config?.referral?.commission || {})
}

function isIncluded(config, orderType) {
  if (orderType === 'subscription') return config.includeSubscription
  if (orderType === 'recharge') return config.includeRecharge
  if (orderType === 'prop') return config.includeProp
  return false
}

function calculateCommissionFen(paidAmountFen, rateBps, cap = 0) {
  const amount = asInt(paidAmountFen, -1)
  const rate = asInt(rateBps, -1)
  if (amount < 0 || rate < 0 || rate > 5000) return 0
  const calculated = Math.floor(amount * rate / 10000)
  return cap > 0 ? Math.min(calculated, cap) : calculated
}

function getProductLabel(orderType) {
  if (orderType === 'subscription') return '套餐'
  if (orderType === 'recharge') return '加油包'
  if (orderType === 'prop') return '道具解锁'
  return '支付订单'
}
function getMonthStart(input) {
  const date = asDate(input, now())
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function buildJob(payload = {}) {
  const source = normalizeId(payload.source)
  const orderId = normalizeId(payload.orderId)
  const orderType = normalizeId(payload.orderType)
  const ts = asDate(payload.createdAt, now())
  return {
    _id: jobId(source, orderId),
    source,
    orderId,
    orderType,
    userId: normalizeId(payload.userId || payload.inviteeUserId),
    inviteeUserId: normalizeId(payload.inviteeUserId || payload.userId),
    paidAmountFen: asInt(payload.paidAmountFen, 0),
    paidAt: asDate(payload.paidAt, ts),
    transactionId: normalizeId(payload.transactionId),
    commissionConfigSnapshot: payload.commissionConfigSnapshot && typeof payload.commissionConfigSnapshot === 'object'
      ? { ...payload.commissionConfigSnapshot }
      : null,
    commissionId: commissionId(source, orderId),
    status: payload.status || 'pending',
    statusReason: String(payload.statusReason || ''),
    attempts: 0,
    nextRunAt: payload.status === 'needs_review' ? null : ts,
    leaseOwner: '',
    leaseUntil: null,
    lastErrorCode: String(payload.lastErrorCode || ''),
    lastErrorMessage: String(payload.lastErrorMessage || ''),
    createdAt: ts,
    updatedAt: ts
  }
}

async function enqueueCommissionJob(db, payload = {}) {
  let commissionConfigSnapshot = payload.commissionConfigSnapshot || null
  let snapshotFailed = false
  if (!commissionConfigSnapshot) {
    try { commissionConfigSnapshot = await getCommissionConfig(db) } catch (error) {
      console.error('[referral-commission] config snapshot failed', error)
      snapshotFailed = true
    }
  }
  // 支付时取不到配置快照：禁止建普通 pending job（worker 不得用未来配置结算历史订单），
  // 转 needs_review 等人工复核（后台重试时由管理员显式选择当前配置）
  const job = buildJob({
    ...payload,
    commissionConfigSnapshot,
    ...(snapshotFailed ? {
      status: 'needs_review',
      statusReason: 'CONFIG_SNAPSHOT_UNAVAILABLE',
      lastErrorCode: 'CONFIG_SNAPSHOT_UNAVAILABLE',
      lastErrorMessage: '支付时无法取得佣金配置快照，等待人工复核后重试'
    } : {})
  })
  if (!job.source || !job.orderId || !job.inviteeUserId || job.paidAmountFen <= 0) {
    return { success: false, queued: false, reason: 'INVALID_JOB_PAYLOAD' }
  }
  const existing = await readDoc(db, JOBS, job._id)
  if (existing) return { success: true, queued: false, duplicate: true, job: existing }
  try {
    await db.collection(JOBS).doc(job._id).set(omitDocumentId(job))
    return { success: true, queued: true, job }
  } catch (error) {
    const duplicate = await readDoc(db, JOBS, job._id)
    if (duplicate) return { success: true, queued: false, duplicate: true, job: duplicate }
    console.error('[referral-commission] enqueue failed', error)
    return { success: false, queued: false, reason: 'ENQUEUE_FAILED' }
  }
}

async function getRewardedClaimByInvitee(dbLike, inviteeUserId) {
  const claim = await readDoc(dbLike, CLAIMS, inviteeUserId)
  if (!claim) return null
  if (!['rewarded', 'manual_resolved'].includes(normalizeStatus(claim.status))) return null
  if (!normalizeId(claim.inviterUserId) || normalizeId(claim.inviterUserId) === normalizeId(inviteeUserId)) return null
  return claim
}

async function runTransaction(db, callback) {
  if (typeof db.runTransaction === 'function') return db.runTransaction(callback)
  if (typeof db.startTransaction !== 'function') throw Object.assign(new Error('TRANSACTION_UNAVAILABLE'), { code: 'TRANSACTION_UNAVAILABLE' })
  const transaction = await db.startTransaction()
  try {
    const result = await callback(transaction)
    await transaction.commit()
    return result
  } catch (error) {
    try { await transaction.rollback() } catch (_) {}
    throw error
  }
}

function buildPendingLedger(commission, ts) {
  return {
    _id: ledgerId(commission._id),
    businessId: commission._id,
    type: 'commission_pending',
    userId: commission.inviterUserId,
    commissionId: commission._id,
    amountFen: commission.commissionFen,
    status: 'pending',
    productType: commission.productType,
    paidAmountFen: commission.paidAmountFen,
    orderId: commission.orderId,
    availableAt: commission.availableAt,
    createdAt: ts
  }
}

function buildCommission(job, claim, config, commissionFen, ts) {
  return {
    _id: job.commissionId,
    source: job.source,
    orderId: job.orderId,
    inviterUserId: claim.inviterUserId,
    inviteeUserId: job.inviteeUserId,
    productType: job.orderType,
    paidAmountFen: job.paidAmountFen,
    commissionRateBps: config.rateBps,
    commissionFen,
    status: 'pending',
    availableAt: new Date(ts.getTime() + config.settlementDays * 24 * 60 * 60 * 1000),
    paidAt: job.paidAt || ts,
    refundedAt: null,
    ruleVersion: config.ruleVersion,
    configSnapshot: { ...config },
    transactionId: job.transactionId,
    createdAt: ts,
    updatedAt: ts
  }
}

async function createCommissionForPaidOrder(db, job, options = {}) {
  // 禁止 worker 为历史订单猜测当前配置：job 无快照时直接返回 CONFIG_SNAPSHOT_UNAVAILABLE，
  // 由人工复核（后台重试时显式写入当前配置快照）决定是否按现行规则补结
  const snapshot = job.commissionConfigSnapshot ? normalizeCommissionConfig(job.commissionConfigSnapshot) : null
  const config = options.config || snapshot
  if (!config) return { success: false, reason: 'CONFIG_SNAPSHOT_UNAVAILABLE' }
  if (!config.enabled) return { success: false, reason: 'DISABLED' }
  if (!isIncluded(config, job.orderType)) return { success: false, reason: 'EXCLUDED_PRODUCT' }
  if (config.effectiveFrom && asDate(job.paidAt, now()) < config.effectiveFrom) return { success: false, reason: 'BEFORE_EFFECTIVE' }
  // P1-4：源订单已退款时不得创建佣金（退款先于分佣 job 处理的场景）——订单已退款，佣金无意义
  if (job.orderId) {
    const sourceOrderCollection = job.source === 'recharge_order' ? RECHARGE_ORDERS : REPORT_ORDERS
    const sourceOrder = await readDoc(db, sourceOrderCollection, job.orderId)
    if (sourceOrder && normalizeStatus(sourceOrder.status) === 'refunded') {
      return { success: false, reason: 'ORDER_REFUNDED' }
    }
  }
  const paidAmountFen = asInt(job.paidAmountFen, 0)
  if (paidAmountFen <= 0) return { success: false, reason: 'INVALID_AMOUNT' }
  const claim = await getRewardedClaimByInvitee(db, job.inviteeUserId)
  if (!claim) return { success: false, reason: 'NO_VALID_RELATION' }
  const commissionFen = calculateCommissionFen(paidAmountFen, config.rateBps, config.maxCommissionFenPerOrder)
  if (commissionFen <= 0) return { success: false, reason: 'ZERO_COMMISSION' }

  try {
    return await runTransaction(db, async (tx) => {
      const existing = await readDoc(tx, COMMISSIONS, job.commissionId)
      if (existing) return { success: true, created: false, duplicate: true, commission: existing }
      const currentClaim = await getRewardedClaimByInvitee(tx, job.inviteeUserId)
      if (!currentClaim || currentClaim.inviterUserId !== claim.inviterUserId) return { success: false, reason: 'RELATION_CHANGED' }
      if (config.mode === 'first_order') {
        const invitee = await readDoc(tx, USERS, job.inviteeUserId)
        if (!invitee) return { success: false, reason: 'USER_NOT_FOUND' }
        if (invitee.commissionFirstOrderId && invitee.commissionFirstOrderId !== job.orderId) return { success: false, reason: 'FIRST_ORDER_ALREADY_SETTLED' }
      }
      const ts = now()
      const commission = buildCommission(job, currentClaim, config, commissionFen, ts)
      const account = await readDoc(tx, ACCOUNTS, currentClaim.inviterUserId)
      const currentPending = asInt(account?.pendingFen, 0)
      const monthStart = getMonthStart(ts)
      const accountMonth = asDate(account?.commissionMonthStart)
      const monthEarned = accountMonth && accountMonth.getTime() === monthStart.getTime() ? asInt(account?.monthEarnedFen, 0) : 0
      if (config.maxCommissionFenPerInviterMonth > 0 && monthEarned + commissionFen > config.maxCommissionFenPerInviterMonth) {
        return { success: false, reason: 'MONTHLY_CAP' }
      }
      const nextAccount = {
        ...account,
        _id: currentClaim.inviterUserId,
        pendingFen: currentPending + commissionFen,
        availableFen: asInt(account?.availableFen, 0),
        withdrawnFen: asInt(account?.withdrawnFen, 0),
        reversedFen: asInt(account?.reversedFen, 0),
        totalEarnedFen: asInt(account?.totalEarnedFen, 0) + commissionFen,
        commissionMonthStart: monthStart,
        monthEarnedFen: monthEarned + commissionFen,
        updatedAt: ts
      }
      await tx.collection(COMMISSIONS).doc(commission._id).set(omitDocumentId(commission))
      await tx.collection(LEDGER).doc(ledgerId(commission._id)).set(omitDocumentId(buildPendingLedger(commission, ts)))
      await tx.collection(ACCOUNTS).doc(currentClaim.inviterUserId).set(omitDocumentId(nextAccount))
      if (config.mode === 'first_order') {
        await tx.collection(USERS).doc(job.inviteeUserId).update({ commissionFirstOrderId: job.orderId, commissionFirstPaidAt: job.paidAt || ts, updatedAt: ts })
      }
      return { success: true, created: true, commission }
    })
  } catch (error) {
    return { success: false, reason: String(error?.code || error?.message || 'CREATE_FAILED') }
  }
}

async function claimJobLease(db, job, workerId) {
  const current = await readDoc(db, JOBS, job._id)
  if (!current) return null
  const ts = now()
  const leaseUntil = asDate(current.leaseUntil)
  if (leaseUntil && leaseUntil > ts && current.leaseOwner && current.leaseOwner !== workerId) return null
  if (!['pending', 'retry', 'processing'].includes(normalizeStatus(current.status))) return null
  await db.collection(JOBS).doc(job._id).update({ status: 'processing', leaseOwner: workerId, leaseUntil: new Date(ts.getTime() + JOB_LEASE_MS), updatedAt: ts })
  return { ...current, status: 'processing', leaseOwner: workerId }
}

async function finishJob(db, job, patch) {
  await db.collection(JOBS).doc(job._id).update({ ...patch, leaseOwner: '', leaseUntil: null, updatedAt: now() })
}

async function processOneCommissionJob(db, job, options = {}) {
  const workerId = options.workerId || `commission_${Date.now().toString(36)}`
  const leased = await claimJobLease(db, job, workerId)
  if (!leased) return { result: 'skipped' }
  try {
    const result = await createCommissionForPaidOrder(db, leased)
    if (result.success || ['DISABLED', 'EXCLUDED_PRODUCT', 'NO_VALID_RELATION', 'ZERO_COMMISSION', 'MONTHLY_CAP', 'BEFORE_EFFECTIVE', 'ORDER_REFUNDED'].includes(result.reason)) {
      await finishJob(db, leased, { status: 'succeeded', statusReason: result.duplicate ? 'DUPLICATE' : result.reason || 'CREATED', lastErrorCode: '', lastErrorMessage: '' })
      return { result: 'succeeded', commission: result.commission }
    }
    if (result.reason === 'CONFIG_SNAPSHOT_UNAVAILABLE') {
      // 快照缺失不重试（配置不会自动恢复），直接转人工复核
      await finishJob(db, leased, { status: 'needs_review', statusReason: 'CONFIG_SNAPSHOT_UNAVAILABLE', lastErrorCode: 'CONFIG_SNAPSHOT_UNAVAILABLE', lastErrorMessage: '缺少配置快照，等待人工复核' })
      return { result: 'needs_review' }
    }
    const attempts = asInt(leased.attempts, 0) + 1
    if (attempts > MAX_ATTEMPTS) {
      await finishJob(db, leased, { status: 'needs_review', statusReason: result.reason || 'PROCESS_FAILED', attempts, lastErrorCode: result.reason || 'PROCESS_FAILED' })
      return { result: 'needs_review' }
    }
    const delay = BACKOFF_MS[Math.min(BACKOFF_MS.length - 1, attempts - 1)]
    await finishJob(db, leased, { status: 'retry', statusReason: result.reason || 'PROCESS_FAILED', attempts, nextRunAt: new Date(now().getTime() + delay), lastErrorCode: result.reason || 'PROCESS_FAILED' })
    return { result: 'retry' }
  } catch (error) {
    const attempts = asInt(leased.attempts, 0) + 1
    const exhausted = attempts > MAX_ATTEMPTS
    await finishJob(db, leased, { status: exhausted ? 'needs_review' : 'retry', statusReason: 'WORKER_ERROR', attempts, nextRunAt: exhausted ? null : new Date(now().getTime() + BACKOFF_MS[Math.min(BACKOFF_MS.length - 1, attempts - 1)]), lastErrorCode: String(error?.code || 'WORKER_ERROR'), lastErrorMessage: String(error?.message || error).slice(0, 300) })
    return { result: exhausted ? 'needs_review' : 'retry' }
  }
}

async function processDueCommissionJobs(db, options = {}) {
  const limit = Math.min(Math.max(asInt(options.limit, DEFAULT_BATCH.process), 1), 100)
  const ts = now()
  const query = db.collection(JOBS).where({ status: db.command.in(['pending', 'retry', 'processing']), nextRunAt: db.command.lte(ts) }).limit(limit)
  const { data = [] } = await query.get()
  const stats = { scanned: data.length, succeeded: 0, retry: 0, needs_review: 0, skipped: 0 }
  for (const job of data) {
    if (options.deadline && Date.now() >= options.deadline) break
    const result = await processOneCommissionJob(db, job, options)
    if (result.result === 'succeeded') stats.succeeded++
    else if (result.result === 'retry') stats.retry++
    else if (result.result === 'needs_review') stats.needs_review++
    else stats.skipped++
  }
  return stats
}

function scanProgressId(source) { return `scan_${source}` }

function sortPaidAsc(list) {
  return [...list].sort((left, right) => {
    const a = left.paidAt instanceof Date ? left.paidAt.getTime() : Number(left.paidAt) || 0
    const b = right.paidAt instanceof Date ? right.paidAt.getTime() : Number(right.paidAt) || 0
    if (a !== b) return a - b
    return String(left._id).localeCompare(String(right._id))
  })
}

/**
 * 按持久化游标（paidAt + _id 复合）扫描一类已完成订单。
 * 两段查询（paidAt > 游标时间；paidAt == 游标时间且 _id > 游标 id）后代码合并排序，
 * 不依赖 or/and 逻辑指令与多字段排序链，保证跨批次不重不漏。
 */
async function scanRecoverOrders(db, source, eachLimit) {
  const progress = await readDoc(db, SCAN_PROGRESS, scanProgressId(source))
  const baseFilter = source === 'recharge_order'
    ? { status: 'paid', fulfillmentStatus: 'succeeded' }
    : { status: 'fulfilled' }
  const collection = source === 'recharge_order' ? RECHARGE_ORDERS : REPORT_ORDERS
  const results = []
  if (progress?.lastPaidAt != null) {
    const after = await db.collection(collection).where({ ...baseFilter, paidAt: db.command.gt(progress.lastPaidAt) }).orderBy('paidAt', 'asc').limit(eachLimit).get()
    results.push(...(after.data || []))
  }
  const remaining = eachLimit - results.length
  if (remaining > 0) {
    if (progress?.lastPaidAt != null && progress?.lastId) {
      // 游标时间边界上的同值批次：_id 继续推进
      const same = await db.collection(collection).where({ ...baseFilter, paidAt: progress.lastPaidAt, _id: db.command.gt(progress.lastId) }).orderBy('_id', 'asc').limit(remaining).get()
      results.push(...(same.data || []))
    } else {
      const initial = await db.collection(collection).where(baseFilter).orderBy('paidAt', 'asc').limit(eachLimit).get()
      results.push(...(initial.data || []))
    }
  }
  const ordered = sortPaidAsc(results).slice(0, eachLimit)
  const last = ordered[ordered.length - 1]
  const cursor = last ? { paidAt: last.paidAt, _id: last._id } : null
  return { orders: ordered, cursor }
}

async function saveScanProgress(db, source, cursor, scanned) {
  if (!cursor) return
  const id = scanProgressId(source)
  const existing = await readDoc(db, SCAN_PROGRESS, id)
  const ts = now()
  const patch = {
    source,
    lastPaidAt: cursor.paidAt,
    lastId: String(cursor._id || ''),
    scannedTotal: asInt(existing?.scannedTotal, 0) + scanned,
    updatedAt: ts
  }
  if (existing) await db.collection(SCAN_PROGRESS).doc(id).update(patch)
  else await db.collection(SCAN_PROGRESS).doc(id).set(omitDocumentId({ _id: id, ...patch, createdAt: ts }))
}

/**
 * 恢复扫描：两类订单分别用持久化复合游标（paidAt + _id）扫描并推进进度，
 * 不再合并后截断——充值候选再满也不会饿死报告订单，跨批次不漏建 job。
 */
async function recoverCommissionJobs(db, options = {}) {
  const limit = Math.min(Math.max(asInt(options.limit, DEFAULT_BATCH.recover), 1), 100)
  const config = options.config || await getCommissionConfig(db)
  if (!config.enabled) return { scanned: 0, recovered: 0, disabled: true }
  const eachLimit = Math.max(1, Math.floor(limit / 2))
  let scanned = 0
  let recovered = 0
  for (const source of ['recharge_order', 'archetype_report_order']) {
    const { orders, cursor } = await scanRecoverOrders(db, source, eachLimit)
    scanned += orders.length
    for (const order of orders) {
      const payload = source === 'recharge_order'
        ? { source, orderId: order._id, orderType: order.productType, userId: order.userId, paidAmountFen: order.amountFen, paidAt: order.paidAt, transactionId: order.transactionId }
        : { source, orderId: order._id, orderType: 'prop', userId: order.userId, paidAmountFen: order.actualPriceFen, paidAt: order.paidAt, transactionId: order.transactionId }
      const existing = await readDoc(db, JOBS, jobId(payload.source, payload.orderId))
      if (existing) continue
      const amountFen = asInt(payload.paidAmountFen, 0)
      const invalidSnapshot = !payload.orderId || !payload.userId || amountFen <= 0
      const result = invalidSnapshot
        ? await (async () => {
            const job = buildJob({
              ...payload,
              paidAmountFen: amountFen,
              commissionConfigSnapshot: config,
              status: 'needs_review',
              statusReason: 'INVALID_ORDER_SNAPSHOT',
              lastErrorCode: 'INVALID_ORDER_SNAPSHOT',
              lastErrorMessage: '订单缺少可验证的用户或支付金额快照'
            })
            if (!job.orderId) return { queued: false }
            await db.collection(JOBS).doc(job._id).set(omitDocumentId(job))
            return { queued: true }
          })()
        : await enqueueCommissionJob(db, { ...payload, commissionConfigSnapshot: config })
      if (result.queued) recovered++
    }
    await saveScanProgress(db, source, cursor, orders.length)
  }
  return { scanned, recovered }
}

async function releaseDueCommissions(db, options = {}) {
  const limit = Math.min(Math.max(asInt(options.limit, DEFAULT_BATCH.release), 1), 200)
  const config = options.config || await getCommissionConfig(db)
  if (config.payoutPaused) return { scanned: 0, released: 0, paused: true }
  const ts = now()
  const { data = [] } = await db.collection(COMMISSIONS).where({ status: 'pending', availableAt: db.command.lte(ts) }).limit(limit).get()
  let released = 0
  for (const item of data) {
    const result = await runTransaction(db, async (tx) => {
      const commission = await readDoc(tx, COMMISSIONS, item._id)
      if (!commission || commission.status !== 'pending' || asDate(commission.availableAt, new Date(8640000000000000)) > ts) return false
      const account = await readDoc(tx, ACCOUNTS, commission.inviterUserId)
      if (account?.payoutBlocked === true) return false
      const pending = asInt(account?.pendingFen, 0)
      const amount = asInt(commission.commissionFen, 0)
      if (pending < amount) return false
      const nextAccount = { ...account, _id: commission.inviterUserId, pendingFen: pending - amount, availableFen: asInt(account?.availableFen, 0) + amount, updatedAt: ts }
      await tx.collection(COMMISSIONS).doc(commission._id).update({ status: 'available', updatedAt: ts })
      await tx.collection(LEDGER).doc(`ledger_release_${commission._id}`).set({ businessId: `release_${commission._id}`, type: 'commission_release', userId: commission.inviterUserId, commissionId: commission._id, amountFen: amount, status: 'available', productType: commission.productType, paidAmountFen: commission.paidAmountFen, orderId: commission.orderId, availableAt: commission.availableAt, createdAt: ts })
      await tx.collection(ACCOUNTS).doc(commission.inviterUserId).set(omitDocumentId(nextAccount))
      return true
    }).catch(() => false)
    if (result) released++
  }
  return { scanned: data.length, released }
}

async function reverseCommissionForRefund(db, payload = {}, options = {}) {
  const source = normalizeId(payload.source)
  const orderId = normalizeId(payload.orderId)
  const id = payload.commissionId || commissionId(source, orderId)
  const refundFen = asInt(payload.refundAmountFen, 0)
  if (!id || refundFen <= 0) return { success: false, reason: 'INVALID_REFUND' }
  return runTransaction(db, async (tx) => {
    const existingReversal = await readDoc(tx, LEDGER, reversalLedgerId(id))
    if (existingReversal) return { success: true, duplicate: true, status: existingReversal.status, commissionRefundFen: Math.abs(asInt(existingReversal.amountFen, 0)), recoveryFen: asInt(existingReversal.recoveryFen, 0) }
    const commission = await readDoc(tx, COMMISSIONS, id)
    if (!commission) return { success: false, reason: 'COMMISSION_NOT_FOUND' }
    if (commission.status === 'reversed' || commission.status === 'blocked') return { success: true, duplicate: true, status: commission.status }
    const account = await readDoc(tx, ACCOUNTS, commission.inviterUserId)
    const pending = asInt(account?.pendingFen, 0)
    const available = asInt(account?.availableFen, 0)
    const commissionRefundFen = Math.min(asInt(commission.commissionFen, 0), Math.floor(refundFen * asInt(commission.commissionRateBps, 0) / 10000))
    if (commissionRefundFen <= 0) return { success: false, reason: 'ZERO_REVERSAL' }
    const amountFromPending = Math.min(pending, commissionRefundFen)
    const remaining = commissionRefundFen - amountFromPending
    const amountFromAvailable = Math.min(available, remaining)
    const recoveryFen = remaining - amountFromAvailable
    const ts = now()
    const next = { ...account, _id: commission.inviterUserId, pendingFen: pending - amountFromPending, availableFen: available - amountFromAvailable, reversedFen: asInt(account?.reversedFen, 0) + commissionRefundFen, payoutBlocked: recoveryFen > 0 ? true : account?.payoutBlocked === true, blockedReason: recoveryFen > 0 ? 'INSUFFICIENT_FUNDS' : String(account?.blockedReason || ''), recoveryFen: asInt(account?.recoveryFen, 0) + recoveryFen, updatedAt: ts }
    await tx.collection(COMMISSIONS).doc(id).update({ status: recoveryFen > 0 ? 'blocked' : 'reversed', refundedAt: ts, recoveryFen, updatedAt: ts })
    await tx.collection(LEDGER).doc(reversalLedgerId(id)).set({ businessId: `reverse_${id}`, type: 'commission_reversal', userId: commission.inviterUserId, commissionId: id, amountFen: -commissionRefundFen, status: recoveryFen > 0 ? 'blocked' : 'reversed', recoveryFen, productType: commission.productType, paidAmountFen: commission.paidAmountFen, orderId: commission.orderId, reason: String(payload.reason || 'refund'), createdAt: ts })
    await tx.collection(ACCOUNTS).doc(commission.inviterUserId).set(omitDocumentId(next))
    if (recoveryFen > 0) await tx.collection('commission_review_tasks').doc(`review_${id}`).set({ commissionId: id, status: 'pending', recoveryFen, reason: 'INSUFFICIENT_FUNDS', createdAt: ts, updatedAt: ts })
    return { success: true, status: recoveryFen > 0 ? 'blocked' : 'reversed', commissionRefundFen, recoveryFen }
  })
}

function reversalJobId(commissionIdValue) { return `reversal_${commissionIdValue}` }

function buildReversalJob(payload = {}) {
  const ts = payload.createdAt || now()
  const commissionIdValue = normalizeId(payload.commissionId)
  return {
    _id: reversalJobId(commissionIdValue),
    commissionId: commissionIdValue,
    source: normalizeId(payload.source),
    orderId: normalizeId(payload.orderId),
    refundAmountFen: asInt(payload.refundAmountFen, 0),
    reason: String(payload.reason || 'refund'),
    status: 'pending',
    attempts: 0,
    nextRunAt: ts,
    lastErrorCode: '',
    lastErrorMessage: '',
    createdAt: ts,
    updatedAt: ts
  }
}

/**
 * 幂等写入冲正补偿 job。只写不存在的 job；已存在则保留其状态（可能已被 worker 处理中/完成），
 * 避免把 done/processing 重置回 pending。
 */
async function writeReversalJob(dbLike, payload = {}) {
  const commissionIdValue = normalizeId(payload.commissionId || commissionId(payload.source, payload.orderId))
  if (!commissionIdValue) return { queued: false, reason: 'INVALID_COMMISSION_ID' }
  const existing = await readDoc(dbLike, REVERSAL_JOBS, reversalJobId(commissionIdValue))
  if (existing) return { queued: false, existing: true, status: existing.status, commissionId: commissionIdValue }
  const job = buildReversalJob({ ...payload, commissionId: commissionIdValue })
  await dbLike.collection(REVERSAL_JOBS).doc(job._id).set(omitDocumentId(job))
  return { queued: true, status: 'pending', commissionId: commissionIdValue }
}

async function finishReversalJob(db, commissionIdValue, patch = {}) {
  const jobIdValue = reversalJobId(commissionIdValue)
  const existing = await readDoc(db, REVERSAL_JOBS, jobIdValue)
  if (!existing) return
  await db.collection(REVERSAL_JOBS).doc(jobIdValue).update({ ...patch, updatedAt: now() })
}

async function scheduleReversalRetry(db, job, error = null) {
  if (!job) return 'retry'
  const attempts = asInt(job.attempts, 0) + 1
  const message = String(error?.message || error?.errMsg || error || '佣金冲正失败').slice(0, 300)
  if (attempts > REVERSAL_MAX_ATTEMPTS) {
    await finishReversalJob(db, job.commissionId, {
      status: 'failed',
      attempts,
      lastErrorCode: error?.code || 'REVERSAL_FAILED',
      lastErrorMessage: message
    })
    await db.collection(REVIEW_TASKS).doc(`review_reversal_${job.commissionId}`).set({
      commissionId: job.commissionId,
      status: 'pending',
      recoveryFen: asInt(job.refundAmountFen, 0),
      reason: 'REVERSAL_JOB_EXHAUSTED',
      createdAt: now(),
      updatedAt: now()
    }).catch(() => {})
    return 'failed'
  }
  const delay = BACKOFF_MS[Math.min(BACKOFF_MS.length - 1, attempts - 1)]
  await finishReversalJob(db, job.commissionId, {
    status: 'pending',
    attempts,
    nextRunAt: new Date(now().getTime() + delay),
    lastErrorCode: error?.code || 'REVERSAL_FAILED',
    lastErrorMessage: message
  })
  return 'retry'
}

async function processOneReversalJob(db, job) {
  try {
    const result = await reverseCommissionForRefund(db, {
      commissionId: job.commissionId,
      source: job.source,
      orderId: job.orderId,
      refundAmountFen: job.refundAmountFen,
      reason: job.reason
    })
    if (result.success || result.duplicate || TERMINAL_REVERSAL_REASONS.includes(result.reason)) {
      await finishReversalJob(db, job.commissionId, {
        status: 'done',
        statusReason: result.duplicate ? 'DUPLICATE' : result.reason ? `${result.status || ''} ${result.reason}`.trim() : 'reversed',
        lastErrorCode: '',
        lastErrorMessage: ''
      })
      return 'succeeded'
    }
    return await scheduleReversalRetry(db, job, Object.assign(new Error(result.reason || 'REVERSAL_FAILED'), { code: result.reason }))
  } catch (error) {
    return await scheduleReversalRetry(db, job, error)
  }
}

/**
 * worker 处理到期冲正补偿 job：幂等调用 reverseCommissionForRefund，
 * 失败按 BACKOFF_MS 退避重试，超过 REVERSAL_MAX_ATTEMPTS 转 failed + 人工复核任务。
 */
async function processDueReversalJobs(db, options = {}) {
  const limit = Math.min(Math.max(asInt(options.limit, DEFAULT_BATCH.reversal), 1), 100)
  const ts = now()
  const { data = [] } = await db.collection(REVERSAL_JOBS).where({ status: 'pending', nextRunAt: db.command.lte(ts) }).limit(limit).get()
  const stats = { scanned: data.length, succeeded: 0, retry: 0, failed: 0 }
  for (const job of data) {
    if (options.deadline && Date.now() >= options.deadline) break
    const result = await processOneReversalJob(db, job)
    if (result === 'succeeded') stats.succeeded++
    else if (result === 'failed') stats.failed++
    else stats.retry++
  }
  return stats
}

/**
 * 退款时登记冲正补偿 job 并立即尝试一次冲正；失败后 job 留在队列由 worker 幂等重试。
 * 供充值/套餐后台退款（refundOrder）与报告退款（finalizeOrderRefund 事务外）共用。
 */
async function enqueueCommissionReversal(db, payload = {}) {
  const commissionIdValue = normalizeId(payload.commissionId || commissionId(payload.source, payload.orderId))
  let written
  try {
    written = await writeReversalJob(db, { ...payload, commissionId: commissionIdValue })
  } catch (error) {
    // job 写入失败：退款已完成但无补偿凭据，必须返回可操作信号，禁止静默吞掉
    console.error('[referral-commission] reversal job write failed', error)
    return { success: false, queued: false, reason: 'REVERSAL_JOB_WRITE_FAILED', commissionId: commissionIdValue, message: String(error?.message || error).slice(0, 300) }
  }
  if (written.existing) return { success: false, queued: false, reason: 'ALREADY_QUEUED', status: written.status }
  try {
    const result = await reverseCommissionForRefund(db, { ...payload, commissionId: commissionIdValue })
    if (result.success || result.duplicate || TERMINAL_REVERSAL_REASONS.includes(result.reason)) {
      await finishReversalJob(db, commissionIdValue, { status: 'done', statusReason: result.duplicate ? 'DUPLICATE' : result.status || result.reason || 'reversed' })
      return { success: true, ...result }
    }
    const job = await readDoc(db, REVERSAL_JOBS, reversalJobId(commissionIdValue))
    await scheduleReversalRetry(db, job, Object.assign(new Error(result.reason || 'REVERSAL_FAILED'), { code: result.reason }))
    return { success: false, ...result }
  } catch (error) {
    const job = await readDoc(db, REVERSAL_JOBS, reversalJobId(commissionIdValue))
    if (job) await scheduleReversalRetry(db, job, error)
    return { success: false, reason: 'REVERSAL_IMMEDIATE_FAILED', message: String(error?.message || error).slice(0, 300) }
  }
}

async function getUserCommissionSummary(db, userId) {
  const config = await getCommissionConfig(db)
  const account = await readDoc(db, ACCOUNTS, userId)
  const [commissionRows, inviteeCount] = await Promise.all([
    scanAll(db, COMMISSIONS, { inviterUserId: userId }),
    db.collection(CLAIMS).where({ inviterUserId: userId }).count()
  ])
  const paidInviteeIds = new Set(commissionRows.filter(item => ['pending', 'available'].includes(item.status)).map(item => item.inviteeUserId).filter(Boolean))
  return {
    summary: {
      inviteCount: Number(inviteeCount?.total || 0),
      paidInviteCount: paidInviteeIds.size,
      totalEarnedFen: asInt(account?.totalEarnedFen, 0),
      netEarnedFen: Math.max(0, asInt(account?.totalEarnedFen, 0) - asInt(account?.reversedFen, 0)),
      pendingFen: asInt(account?.pendingFen, 0),
      availableFen: asInt(account?.availableFen, 0),
      withdrawnFen: asInt(account?.withdrawnFen, 0),
      reversedFen: asInt(account?.reversedFen, 0)
    },
    // P2-3：服务端返回实际参与产品与退款说明，页面按 include* 动态生成规则文案
    rule: {
      enabled: config.enabled,
      rateBps: config.rateBps,
      rateText: `${config.rateBps / 100}%`,
      settlementDays: config.settlementDays,
      mode: config.mode,
      includeSubscription: config.includeSubscription,
      includeRecharge: config.includeRecharge,
      includeProp: config.includeProp,
      refundNote: '退款订单将撤销对应的奖励。'
    }
  }
}

function normalizeLimit(value, fallback = 20) { return Math.min(Math.max(asInt(value, fallback), 1), 100) }
async function listUserCommissionLedger(db, userId, options = {}) {
  const limit = normalizeLimit(options.limit)
  const where = { inviterUserId: userId }
  if (options.status) where.status = String(options.status)
  const cursorDate = asDate(options.cursor)
  if (cursorDate) where.createdAt = db.command.lt(cursorDate)
  else if (options.cursor) where._id = db.command.lt(String(options.cursor))
  let query = db.collection(COMMISSIONS).where(where)
  query = query.orderBy('createdAt', 'desc').limit(limit + 1)
  const { data = [] } = await query.get()
  const items = data.slice(0, limit).map(item => {
    const reversed = item.status === 'reversed' || item.status === 'blocked'
    return { id: item._id, productLabel: getProductLabel(item.productType), paidAmountFen: item.paidAmountFen || 0, commissionFen: reversed ? -Math.abs(asInt(item.commissionFen, 0)) : asInt(item.commissionFen, 0), status: item.status, statusText: item.status === 'available' ? '已到账' : item.status === 'reversed' ? '已撤销' : item.status === 'blocked' ? '待复核' : '待结算', availableAt: item.availableAt || null, createdAt: item.createdAt }
  })
  const lastCreatedAt = asDate(data[limit - 1]?.createdAt)
  return { items, nextCursor: data.length > limit && lastCreatedAt ? lastCreatedAt.toISOString() : null }
}

async function listUserCommissionInvitees(db, userId, options = {}) {
  const limit = normalizeLimit(options.limit)
  const where = { inviterUserId: userId }
  const cursorDate = asDate(options.cursor)
  if (cursorDate) where.updatedAt = db.command.lt(cursorDate)
  else if (options.cursor) where._id = db.command.lt(String(options.cursor))
  const query = db.collection(CLAIMS).where(where)
  const { data = [] } = await query.orderBy('updatedAt', 'desc').limit(limit + 1).get()
  const items = []
  for (const claim of data.slice(0, limit)) {
    const user = await readDoc(db, USERS, claim.inviteeUserId)
    const commissions = await db.collection(COMMISSIONS).where({ inviteeUserId: claim.inviteeUserId, inviterUserId: userId }).limit(20).get()
    const validCommissions = (commissions.data || []).filter(item => ['pending', 'available'].includes(item.status))
    if (options.paidOnly && !validCommissions.length) continue
    items.push({ id: claim.inviteeUserId, nickname: String(user?.nickname || user?.nickName || '好友').slice(0, 1) + '同学', joinedAt: claim.createdAt || null, status: validCommissions.length ? 'paid' : claim.status, paid: Boolean(validCommissions.length), totalCommissionFen: validCommissions.reduce((sum, item) => sum + asInt(item.commissionFen, 0), 0) })
  }
  const lastUpdatedAt = asDate(data[limit - 1]?.updatedAt || data[limit - 1]?.createdAt)
  return { items, nextCursor: data.length > limit && lastUpdatedAt ? lastUpdatedAt.toISOString() : null }
}

module.exports = {
  JOBS, COMMISSIONS, ACCOUNTS, LEDGER,
  setNowProvider,
  normalizeCommissionConfig,
  omitDocumentId,
  getCommissionConfig,
  scanAll,
  calculateCommissionFen,
  buildJob,
  enqueueCommissionJob,
  recoverCommissionJobs,
  processDueCommissionJobs,
  processOneCommissionJob,
  createCommissionForPaidOrder,
  releaseDueCommissions,
  reverseCommissionForRefund,
  writeReversalJob,
  enqueueCommissionReversal,
  processDueReversalJobs,
  getUserCommissionSummary,
  listUserCommissionLedger,
  listUserCommissionInvitees,
  getProductLabel,
  jobId,
  commissionId
}
