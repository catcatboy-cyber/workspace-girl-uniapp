/**
 * 邀请奖励后台 worker
 * 仅由定时触发器或管理员内部调用，不向普通客户端暴露发奖能力。
 */
const cloudbase = require('@cloudbase/node-sdk')
const {
  recoverReferralIntents,
  processDueReferralClaims
} = require('./_shared/referral-settlement')

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
