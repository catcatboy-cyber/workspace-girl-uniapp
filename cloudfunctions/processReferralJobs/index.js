/**
 * 邀请奖励后台 worker
 * 仅由定时触发器或管理员内部调用，不向普通客户端暴露发奖能力。
 */
const cloudbase = require('@cloudbase/node-sdk')
const {
  recoverReferralIntents,
  processDueReferralClaims
} = require('./_shared/referral-settlement')
const {
  recoverCommissionJobs,
  processDueCommissionJobs,
  releaseDueCommissions,
  processDueReversalJobs
} = require('./_shared/referral-commission')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()

const WORKER_BUDGET_MS = 55_000

exports.main = async (event = {}) => {
  const startedAt = Date.now()
  const deadline = startedAt + WORKER_BUDGET_MS
  const workerId = `processReferralJobs_${startedAt.toString(36)}`

  try {
    const recovered = await recoverReferralIntents(db, { limit: 50 })
    const processed = await processDueReferralClaims(db, {
      limit: 20,
      deadline,
      workerId
    })
    const recoveredCommission = await recoverCommissionJobs(db, { limit: 50 })
    const processedCommission = await processDueCommissionJobs(db, {
      limit: 20,
      deadline,
      workerId
    })
    const releasedCommission = await releaseDueCommissions(db, { limit: 100, deadline })
    const processedReversal = await processDueReversalJobs(db, { limit: 20, deadline })

    const result = {
      success: true,
      recovered: recovered.recovered || 0,
      rewarded: processed.rewarded || 0,
      waiting: processed.waiting || 0,
      retried: processed.retried || 0,
      failed: processed.failed || 0,
      rejected: processed.rejected || 0,
      needs_review: processed.needs_review || 0,
      paused: processed.paused || 0,
      commissionRecovered: recoveredCommission.recovered || 0,
      commissionSucceeded: processedCommission.succeeded || 0,
      commissionRetried: processedCommission.retry || 0,
      commissionNeedsReview: processedCommission.needs_review || 0,
      commissionReleased: releasedCommission.released || 0,
      reversalProcessed: processedReversal.scanned || 0,
      reversalSucceeded: processedReversal.succeeded || 0,
      reversalRetried: processedReversal.retry || 0,
      reversalFailed: processedReversal.failed || 0,
      elapsedMs: Date.now() - startedAt
    }
    console.log('[referral-worker]', JSON.stringify({ event: 'batch_done', ...result }))
    return result
  } catch (error) {
    const message = String(error?.message || error || 'UNKNOWN').slice(0, 200)
    console.error('[referral-worker]', JSON.stringify({
      event: 'batch_error',
      error: message,
      elapsedMs: Date.now() - startedAt
    }))
    return {
      success: false,
      message: 'processReferralJobs failed',
      elapsedMs: Date.now() - startedAt
    }
  }
}
