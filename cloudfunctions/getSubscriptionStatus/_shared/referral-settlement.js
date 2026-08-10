/**
 * 邀请奖励异步结算（后台 worker / 管理员补偿）
 * 主链路（register/login/wechatLogin/createTimeline）禁止调用本模块的结算函数。
 */

const { getSubscriptionConfig } = require('./subscription')

const USERS = 'users'
const CLAIMS = 'referral_claims'
const CALL_USAGE = 'call_usage_records'
const TIMELINE = 'timeline_records'
const CASES = 'cases'

const SCHEMA_VERSION = 3
const MAX_ATTEMPTS = 5
const LEASE_MS = 2 * 60 * 1000
const RECOVER_BATCH = 50
const CLAIM_BATCH = 20
const MAX_MANUAL_COMPENSATION_TOKENS = 1000000
const BACKOFF_MS = [
  60 * 1000,
  5 * 60 * 1000,
  30 * 60 * 1000,
  2 * 60 * 60 * 1000,
  12 * 60 * 60 * 1000
]

const ACTIVE_CLAIM_STATUSES = ['pending_relation', 'waiting_first_event', 'retry']
const SETTLEMENT_READY_STATUSES = ['retry']
const REPLACEABLE_REJECT_REASONS = ['EMPTY_INVITE_CODE', 'INVALID_INVITE_CODE', 'SELF_REFERRAL']

let nowProvider = () => new Date()

function setNowProvider(fn) {
  nowProvider = typeof fn === 'function' ? fn : () => new Date()
}

function now() {
  return new Date(nowProvider())
}

function normalizeInviteCode(value) {
  return String(value || '').trim().toUpperCase()
}

function inviterGrantId(inviteeUserId) {
  return `referral_inviter_${inviteeUserId}`
}

function inviteeGrantId(inviteeUserId) {
  return `referral_invitee_${inviteeUserId}`
}

function normalizeRepairSides(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map((side) => String(side || '').trim()).filter((side) => side === 'inviter' || side === 'invitee'))].sort()
}

function isValidCompensationAmount(value) {
  return Number.isFinite(value) && value >= 0 && value <= MAX_MANUAL_COMPENSATION_TOKENS
}

function isMatchingReferralGrant(grant, side, inviterUserId, inviteeUserId) {
  if (!grant) return true
  const expectedUserId = side === 'inviter' ? inviterUserId : inviteeUserId
  return grant.userId === expectedUserId &&
    grant.source === `referral_${side}` &&
    grant.sourceId === inviteeUserId
}

function sanitizeErrorCode(error) {
  const raw = String(error?.code || error?.message || error || 'UNKNOWN')
  return raw.replace(/[^\w.:-]/g, '_').slice(0, 120)
}

function getShanghaiWeekStart(input) {
  const offset = 8 * 60 * 60 * 1000
  const shifted = new Date(new Date(input).getTime() + offset)
  const mondayOffset = (shifted.getUTCDay() + 6) % 7
  shifted.setUTCDate(shifted.getUTCDate() - mondayOffset)
  shifted.setUTCHours(0, 0, 0, 0)
  return new Date(shifted.getTime() - offset)
}

function calculateBackoff(attemptNumber) {
  const index = Math.max(0, Math.min(BACKOFF_MS.length - 1, attemptNumber - 1))
  return new Date(now().getTime() + BACKOFF_MS[index])
}

function logWorker(event, payload = {}) {
  console.log('[referral-worker]', JSON.stringify({ event, ...payload, at: now().toISOString() }))
}

function buildReferralIntentFields({
  inviteCode = '',
  channel = '',
  scene = '',
  shareId = '',
  intentVersion = 1
} = {}) {
  const code = normalizeInviteCode(inviteCode)
  const ts = now()
  if (!code) {
    return {
      landingInviteCode: '',
      landingChannel: channel || '',
      landingScene: scene || '',
      landingShareId: shareId || '',
      referralAttemptStatus: 'none',
      referralAttemptCode: '',
      referralIntentVersion: 0,
      referralIntentAt: null,
      referralNextRunAt: null,
      referralAttemptMessage: ''
    }
  }
  return {
    landingInviteCode: code,
    landingChannel: channel || '',
    landingScene: scene || '',
    landingShareId: shareId || '',
    referralAttemptStatus: 'unprocessed',
    referralAttemptCode: code,
    referralIntentVersion: intentVersion,
    referralIntentAt: ts,
    referralNextRunAt: ts,
    referralAttemptMessage: ''
  }
}

async function readDoc(db, collection, id) {
  const result = await db.collection(collection).doc(id).get()
  const data = result?.data
  if (Array.isArray(data)) return data.length > 0 ? data[0] : null
  return data && typeof data === 'object' ? data : null
}

async function updateUserAttempt(db, userId, patch) {
  await db.collection(USERS).doc(userId).update({
    ...patch,
    updatedAt: now()
  })
}

async function getReferralConfig(db) {
  const config = await getSubscriptionConfig(db)
  const referral = config?.referral || {}
  return {
    enabled: referral.enabled === true,
    payoutPaused: referral.payoutPaused === true,
    inviterRewardTokens: Number(referral.inviterRewardTokens ?? 50),
    inviteeRewardTokens: Number(referral.inviteeRewardTokens ?? 100),
    inviterTrialExtendDays: Number(referral.inviterTrialExtendDays ?? 3),
    requireFirstEvent: referral.requireFirstEvent !== false,
    weeklyInviteCap: Number(referral.weeklyInviteCap ?? 100)
  }
}

function buildPendingClaim({
  inviteeUserId,
  inviteCode,
  intentVersion,
  shareId,
  channel,
  scene
}) {
  const ts = now()
  return {
    _id: inviteeUserId,
    schemaVersion: SCHEMA_VERSION,
    inviteeUserId,
    inviterUserId: '',
    inviteCode,
    intentVersion: Number(intentVersion || 1),
    shareId: shareId || '',
    channel: channel || '',
    scene: scene || '',
    status: 'pending_relation',
    statusReason: '',
    requireFirstEvent: true,
    inviterTokens: 0,
    inviteeTokens: 0,
    inviterTrialExtendDays: 0,
    weeklyInviteCap: 0,
    configCapturedAt: null,
    inviterGrantId: inviterGrantId(inviteeUserId),
    inviteeGrantId: inviteeGrantId(inviteeUserId),
    attempts: 0,
    nextRunAt: ts,
    lastAttemptAt: null,
    lastErrorCode: '',
    leaseOwner: '',
    leaseUntil: null,
    firstEventAt: null,
    rewardWeekStart: null,
    rewardedAt: null,
    createdAt: ts,
    updatedAt: ts,
    manualAction: null
  }
}

async function markUserClaimed(db, userId) {
  await updateUserAttempt(db, userId, {
    referralAttemptStatus: 'claimed',
    referralAttemptMessage: ''
  })
}

async function markUserRejected(db, userId, reason) {
  await updateUserAttempt(db, userId, {
    referralAttemptStatus: 'rejected',
    referralAttemptMessage: reason,
    referralNextRunAt: null
  })
}

async function delayUserRetry(db, userId, errorCode) {
  await updateUserAttempt(db, userId, {
    referralNextRunAt: calculateBackoff(1),
    referralAttemptMessage: sanitizeErrorCode(errorCode)
  })
}

async function hasEitherGrant(db, inviteeUserId) {
  const inviter = await readDoc(db, CALL_USAGE, inviterGrantId(inviteeUserId))
  const invitee = await readDoc(db, CALL_USAGE, inviteeGrantId(inviteeUserId))
  return { inviter, invitee, any: Boolean(inviter || invitee), both: Boolean(inviter && invitee) }
}

async function resetRejectedClaimInTransaction(db, {
  inviteeUserId,
  inviteCode,
  intentVersion,
  shareId,
  channel,
  scene
}) {
  const transaction = await db.startTransaction()
  try {
    const claim = await readDoc(transaction, CLAIMS, inviteeUserId)
    const user = await readDoc(transaction, USERS, inviteeUserId)
    if (!claim || !user) {
      await transaction.rollback()
      return { ok: false, reason: 'MISSING_DOCS' }
    }
    if (claim.status !== 'rejected' || !REPLACEABLE_REJECT_REASONS.includes(claim.statusReason)) {
      await transaction.rollback()
      return { ok: false, reason: 'NOT_REPLACEABLE' }
    }
    if (user.invitedBy) {
      await transaction.rollback()
      return { ok: false, reason: 'ALREADY_BOUND' }
    }
    if (Number(user.referralIntentVersion || 0) <= Number(claim.intentVersion || 0)) {
      await transaction.rollback()
      return { ok: false, reason: 'STALE_INTENT' }
    }
    const grants = await hasEitherGrant(transaction, inviteeUserId)
    if (grants.any) {
      await transaction.rollback()
      return { ok: false, reason: 'GRANT_EXISTS' }
    }

    const next = buildPendingClaim({
      inviteeUserId,
      inviteCode,
      intentVersion,
      shareId,
      channel,
      scene
    })
    const { _id, ...resetPatch } = next
    await transaction.collection(CLAIMS).doc(inviteeUserId).update({
      ...resetPatch,
      createdAt: claim.createdAt || next.createdAt
    })
    await transaction.commit()
    return { ok: true }
  } catch (error) {
    try { await transaction.rollback() } catch (_) {}
    throw error
  }
}

async function recoverOneIntent(db, user) {
  const userId = user._id
  const code = normalizeInviteCode(user.referralAttemptCode || user.landingInviteCode)
  try {
    if (!code) {
      await markUserRejected(db, userId, 'EMPTY_INVITE_CODE')
      return 'rejected'
    }

    const existing = await readDoc(db, CLAIMS, userId)
    if (!existing) {
      try {
        await db.collection(CLAIMS).add(buildPendingClaim({
          inviteeUserId: userId,
          inviteCode: code,
          intentVersion: Number(user.referralIntentVersion || 1),
          shareId: user.landingShareId || '',
          channel: user.landingChannel || '',
          scene: user.landingScene || ''
        }))
      } catch (error) {
        if (!String(error?.code || error?.message || '').includes('DOCUMENT_EXISTS')) {
          throw error
        }
      }
      await markUserClaimed(db, userId)
      return 'recovered'
    }

    if (existing.status === 'rejected' && REPLACEABLE_REJECT_REASONS.includes(existing.statusReason)) {
      const reset = await resetRejectedClaimInTransaction(db, {
        inviteeUserId: userId,
        inviteCode: code,
        intentVersion: Number(user.referralIntentVersion || 1),
        shareId: user.landingShareId || '',
        channel: user.landingChannel || '',
        scene: user.landingScene || ''
      })
      if (reset.ok) {
        await markUserClaimed(db, userId)
        return 'recovered'
      }
    }

    // 已有 claim：不覆盖邀请码/邀请人/金额/状态，只把 user 标 claimed
    await markUserClaimed(db, userId)
    return 'claimed_existing'
  } catch (error) {
    logWorker('recover_intent_error', { userId, error: sanitizeErrorCode(error) })
    try { await delayUserRetry(db, userId, error) } catch (_) {}
    return 'error'
  }
}

async function recoverReferralIntents(db, { limit = RECOVER_BATCH } = {}) {
  const ts = now()
  const { data = [] } = await db.collection(USERS)
    .where({
      referralAttemptStatus: 'unprocessed',
      referralNextRunAt: db.command.lte(ts)
    })
    .limit(limit)
    .get()

  let recovered = 0
  for (const user of data) {
    const result = await recoverOneIntent(db, user)
    if (result === 'recovered' || result === 'claimed_existing') recovered += 1
  }
  return { recovered, scanned: data.length }
}

async function tryAcquireLease(db, claim, owner) {
  const ts = now()
  if (claim.leaseUntil && new Date(claim.leaseUntil).getTime() > ts.getTime()) {
    return false
  }
  try {
    await db.collection(CLAIMS).doc(claim._id).update({
      leaseOwner: owner,
      leaseUntil: new Date(ts.getTime() + LEASE_MS),
      updatedAt: ts
    })
    return true
  } catch (error) {
    logWorker('lease_failed', { claimId: claim._id, error: sanitizeErrorCode(error) })
    return false
  }
}

async function clearLease(db, claimId, patch = {}) {
  try {
    await db.collection(CLAIMS).doc(claimId).update({
      leaseOwner: '',
      leaseUntil: null,
      updatedAt: now(),
      ...patch
    })
  } catch (_) {}
}

async function mirrorUserTerminalStatus(db, claim) {
  const status = claim.status
  if (!['rewarded', 'rejected', 'failed', 'manual_resolved', 'needs_review'].includes(status)) return
  try {
    const user = await readDoc(db, USERS, claim.inviteeUserId)
    if (!user) return
    if (Number(user.referralIntentVersion || 0) !== Number(claim.intentVersion || 0) && user.referralAttemptStatus === 'unprocessed') {
      return
    }
    await updateUserAttempt(db, claim.inviteeUserId, {
      referralAttemptStatus: status === 'manual_resolved' ? 'rewarded' : status,
      referralAttemptMessage: claim.statusReason || '',
      referralNextRunAt: null
    })
  } catch (error) {
    logWorker('mirror_user_failed', { claimId: claim._id, error: sanitizeErrorCode(error) })
  }
}

async function markClaim(db, claimId, patch) {
  const next = {
    ...patch,
    updatedAt: now()
  }
  await db.collection(CLAIMS).doc(claimId).update(next)
  return { ...(await readDoc(db, CLAIMS, claimId)), ...next, _id: claimId }
}

async function bindReferralRelationInTransaction(db, {
  claimId,
  inviteeUserId,
  inviterUserId,
  inviteCode,
  intentVersion,
  configSnapshot
}) {
  const transaction = await db.startTransaction()
  try {
    const claim = await readDoc(transaction, CLAIMS, claimId)
    const invitee = await readDoc(transaction, USERS, inviteeUserId)
    if (!claim || !invitee) {
      await transaction.rollback()
      return { ok: false, reason: 'MISSING_DOCS' }
    }
    if (claim.status !== 'pending_relation') {
      await transaction.rollback()
      return { ok: false, reason: 'STATUS_CHANGED', claim }
    }
    if (Number(claim.intentVersion || 0) !== Number(intentVersion || 0)) {
      await transaction.rollback()
      return { ok: false, reason: 'INTENT_CHANGED' }
    }
    if (invitee.invitedBy && invitee.invitedBy !== inviterUserId) {
      await transaction.rollback()
      return { ok: false, reason: 'INVITER_CONFLICT', conflictInviterId: invitee.invitedBy }
    }

    const ts = now()
    await transaction.collection(CLAIMS).doc(claimId).update({
      inviterUserId,
      inviteCode,
      requireFirstEvent: configSnapshot.requireFirstEvent,
      inviterTokens: configSnapshot.inviterRewardTokens,
      inviteeTokens: configSnapshot.inviteeRewardTokens,
      inviterTrialExtendDays: configSnapshot.inviterTrialExtendDays,
      weeklyInviteCap: configSnapshot.weeklyInviteCap,
      configCapturedAt: ts,
      status: configSnapshot.requireFirstEvent ? 'waiting_first_event' : 'retry',
      statusReason: '',
      nextRunAt: ts,
      updatedAt: ts
    })
    await transaction.collection(USERS).doc(inviteeUserId).update({
      invitedBy: inviterUserId,
      invitedByCode: inviteCode,
      updatedAt: ts
    })
    await transaction.commit()
    return { ok: true }
  } catch (error) {
    try { await transaction.rollback() } catch (_) {}
    return { ok: false, reason: 'TX_ERROR', error }
  }
}

async function findFirstEvent(db, inviteeUserId) {
  try {
    const direct = await db.collection(TIMELINE).where({ userId: inviteeUserId }).limit(1).get()
    if (direct.data && direct.data.length > 0) {
      return direct.data[0]
    }
  } catch (_) {}

  try {
    const { data: cases = [] } = await db.collection(CASES).where({ userId: inviteeUserId }).limit(20).get()
    for (const caseDoc of cases) {
      const { data: records = [] } = await db.collection(TIMELINE).where({ caseId: caseDoc._id }).limit(1).get()
      if (records.length > 0) return records[0]
    }
  } catch (_) {}
  return null
}

async function settleClaimInTransaction(db, claim) {
  const claimId = String(claim?._id || '').trim()
  if (!claimId) return { ok: false, reason: 'INVALID_CLAIM_ID' }

  const expectedInviteeUserId = String(claim.inviteeUserId || '').trim()
  const expectedInviterUserId = String(claim.inviterUserId || '').trim()
  const expectedIntentVersion = Number(claim.intentVersion || 0)
  const transaction = await db.startTransaction()
  try {
    const freshClaim = await readDoc(transaction, CLAIMS, claimId)
    if (!freshClaim) {
      await transaction.rollback()
      return { ok: false, reason: 'MISSING_DOCS' }
    }

    if (freshClaim.status === 'rewarded' || freshClaim.status === 'manual_resolved') {
      await transaction.rollback()
      return { ok: true, idempotent: true, status: freshClaim.status }
    }

    if (!SETTLEMENT_READY_STATUSES.includes(freshClaim.status)) {
      await transaction.rollback()
      return { ok: false, reason: 'STATUS_CHANGED', status: freshClaim.status }
    }

    const inviteeUserId = String(freshClaim.inviteeUserId || '').trim()
    const inviterUserId = String(freshClaim.inviterUserId || '').trim()
    if (
      freshClaim._id !== claimId ||
      !inviteeUserId ||
      !inviterUserId ||
      inviteeUserId !== expectedInviteeUserId ||
      inviterUserId !== expectedInviterUserId ||
      Number(freshClaim.intentVersion || 0) !== expectedIntentVersion
    ) {
      await transaction.rollback()
      return { ok: false, reason: 'STALE_CLAIM' }
    }
    if (!freshClaim.configCapturedAt) {
      await transaction.rollback()
      return { ok: false, reason: 'CLAIM_NOT_READY' }
    }
    if (freshClaim.requireFirstEvent && !freshClaim.firstEventAt) {
      await transaction.rollback()
      return { ok: false, reason: 'STATUS_CHANGED', status: 'waiting_first_event' }
    }

    const inviter = await readDoc(transaction, USERS, inviterUserId)
    const invitee = await readDoc(transaction, USERS, inviteeUserId)
    if (!inviter || !invitee) {
      await transaction.rollback()
      return { ok: false, reason: 'MISSING_DOCS' }
    }

    if (invitee.invitedBy && invitee.invitedBy !== inviterUserId) {
      await transaction.rollback()
      return { ok: false, reason: 'INVITER_CONFLICT', conflictInviterId: invitee.invitedBy }
    }

    const inviterTokens = Number(freshClaim.inviterTokens || 0)
    const inviteeTokens = Number(freshClaim.inviteeTokens || 0)
    if (!isValidCompensationAmount(inviterTokens) || !isValidCompensationAmount(inviteeTokens)) {
      await transaction.rollback()
      return { ok: false, reason: 'INVALID_REWARD_AMOUNT' }
    }
    const inviterGrant = await readDoc(transaction, CALL_USAGE, inviterGrantId(inviteeUserId))
    const inviteeGrant = await readDoc(transaction, CALL_USAGE, inviteeGrantId(inviteeUserId))
    if (
      !isMatchingReferralGrant(inviterGrant, 'inviter', inviterUserId, inviteeUserId) ||
      !isMatchingReferralGrant(inviteeGrant, 'invitee', inviterUserId, inviteeUserId)
    ) {
      await transaction.rollback()
      return { ok: false, reason: 'GRANT_CONFLICT' }
    }
    const inviterDone = inviterTokens <= 0 || Boolean(inviterGrant)
    const inviteeDone = inviteeTokens <= 0 || Boolean(inviteeGrant)
    if (inviterDone && inviteeDone && (inviterGrant || inviteeGrant)) {
      const ts = now()
      await transaction.collection(CLAIMS).doc(claimId).update({
        status: 'rewarded',
        statusReason: 'RECONCILED_BOTH_GRANTS',
        rewardedAt: freshClaim.rewardedAt || ts,
        updatedAt: ts,
        leaseOwner: '',
        leaseUntil: null
      })
      await transaction.commit()
      return { ok: true, idempotent: true, status: 'rewarded' }
    }
    if ((Boolean(inviterGrant) && !inviteeDone) || (Boolean(inviteeGrant) && !inviterDone)) {
      await transaction.rollback()
      return { ok: false, reason: 'PARTIAL_GRANT_FOUND' }
    }

    const weekStart = getShanghaiWeekStart(now())
    const inviterWeekStart = inviter.referralWeekStart ? new Date(inviter.referralWeekStart) : null
    let weeklyCount = Number(inviter.referralWeekCount || 0)
    if (!inviterWeekStart || inviterWeekStart.getTime() < weekStart.getTime()) {
      weeklyCount = 0
    }
    const weeklyCap = Number(freshClaim.weeklyInviteCap ?? 100)
    if (weeklyCap >= 0 && weeklyCount >= weeklyCap) {
      const ts = now()
      await transaction.collection(CLAIMS).doc(claimId).update({
        status: 'rejected',
        statusReason: 'WEEKLY_CAP_REACHED',
        updatedAt: ts,
        leaseOwner: '',
        leaseUntil: null
      })
      await transaction.commit()
      return { ok: true, status: 'rejected', reason: 'WEEKLY_CAP_REACHED' }
    }
    const trialExtendDays = Number(freshClaim.inviterTrialExtendDays || 0)
    const ts = now()
    const inviterBalance = Number(inviter.extraTokens || 0) + (inviterTokens > 0 ? inviterTokens : 0)
    const inviteeBalance = Number(invitee.extraTokens || 0) + (inviteeTokens > 0 ? inviteeTokens : 0)

    const inviterPatch = {
      referralCount: db.command.inc(1),
      referralWeekStart: weekStart,
      referralWeekCount: weeklyCount + 1,
      updatedAt: ts
    }
    if (inviterTokens > 0) inviterPatch.extraTokens = db.command.inc(inviterTokens)
    if (inviter.plan === 'free' && trialExtendDays > 0) {
      const currentTrialEnd = inviter.trialEndsAt ? new Date(inviter.trialEndsAt) : ts
      const baseTime = currentTrialEnd > ts ? currentTrialEnd : ts
      inviterPatch.trialEndsAt = new Date(baseTime.getTime() + trialExtendDays * 24 * 60 * 60 * 1000)
    }
    await transaction.collection(USERS).doc(inviterUserId).update(inviterPatch)

    const inviteePatch = {
      invitedBy: inviterUserId,
      invitedByCode: freshClaim.inviteCode || '',
      updatedAt: ts
    }
    if (inviteeTokens > 0) inviteePatch.extraTokens = db.command.inc(inviteeTokens)
    await transaction.collection(USERS).doc(inviteeUserId).update(inviteePatch)

    if (inviterTokens > 0) {
      await transaction.collection(CALL_USAGE).add({
        _id: inviterGrantId(inviteeUserId),
        userId: inviterUserId,
        type: 'grant',
        source: 'referral_inviter',
        sourceId: inviteeUserId,
        amount: inviterTokens,
        amountTokens: inviterTokens,
        balanceAfter: inviterBalance,
        remark: `referral_inviter:${inviteeUserId}`,
        createdAt: ts
      })
    }
    if (inviteeTokens > 0) {
      await transaction.collection(CALL_USAGE).add({
        _id: inviteeGrantId(inviteeUserId),
        userId: inviteeUserId,
        type: 'grant',
        source: 'referral_invitee',
        sourceId: inviteeUserId,
        amount: inviteeTokens,
        amountTokens: inviteeTokens,
        balanceAfter: inviteeBalance,
        remark: `referral_invitee:${inviteeUserId}`,
        createdAt: ts
      })
    }

    await transaction.collection(CLAIMS).doc(claimId).update({
      status: 'rewarded',
      statusReason: '',
      rewardedAt: ts,
      rewardWeekStart: weekStart,
      updatedAt: ts,
      leaseOwner: '',
      leaseUntil: null
    })

    await transaction.commit()
    return { ok: true, status: 'rewarded' }
  } catch (error) {
    try { await transaction.rollback() } catch (_) {}
    return { ok: false, reason: 'TX_ERROR', error }
  }
}

async function markRetryOrFailed(db, claim, errorCode) {
  const attempts = Number(claim.attempts || 0) + 1
  const status = attempts >= MAX_ATTEMPTS ? 'failed' : 'retry'
  const updated = await markClaim(db, claim._id, {
    status,
    attempts: db.command.inc(1),
    lastAttemptAt: now(),
    lastErrorCode: sanitizeErrorCode(errorCode),
    nextRunAt: status === 'failed' ? null : calculateBackoff(attempts),
    leaseOwner: '',
    leaseUntil: null
  })
  if (status === 'failed') await mirrorUserTerminalStatus(db, updated)
  return status
}

async function processOneReferralClaim(db, claim, { workerId = 'worker' } = {}) {
  if (!ACTIVE_CLAIM_STATUSES.includes(claim.status)) {
    return { result: 'skipped' }
  }
  if (claim.nextRunAt && new Date(claim.nextRunAt).getTime() > now().getTime()) {
    return { result: 'skipped' }
  }

  const leased = await tryAcquireLease(db, claim, workerId)
  if (!leased) return { result: 'skipped' }

  try {
    let current = await readDoc(db, CLAIMS, claim._id) || claim
    const config = await getReferralConfig(db)

    // B. 解析邀请关系
    if (current.status === 'pending_relation' || !current.inviterUserId) {
      if (config.enabled !== true && !current.configCapturedAt) {
        const updated = await markClaim(db, current._id, {
          status: 'rejected',
          statusReason: 'REFERRAL_DISABLED',
          leaseOwner: '',
          leaseUntil: null
        })
        await mirrorUserTerminalStatus(db, updated)
        return { result: 'rejected' }
      }

      const code = normalizeInviteCode(current.inviteCode)
      const { data: inviters = [] } = await db.collection(USERS)
        .where({ inviteCode: code })
        .limit(2)
        .get()

      if (inviters.length === 0) {
        const updated = await markClaim(db, current._id, {
          status: 'rejected',
          statusReason: 'INVALID_INVITE_CODE',
          leaseOwner: '',
          leaseUntil: null
        })
        await mirrorUserTerminalStatus(db, updated)
        return { result: 'rejected' }
      }
      if (inviters.length > 1) {
        const updated = await markClaim(db, current._id, {
          status: 'needs_review',
          statusReason: 'DUPLICATE_INVITE_CODE',
          leaseOwner: '',
          leaseUntil: null
        })
        await mirrorUserTerminalStatus(db, updated)
        return { result: 'needs_review' }
      }

      const inviter = inviters[0]
      if (inviter._id === current.inviteeUserId) {
        const updated = await markClaim(db, current._id, {
          status: 'rejected',
          statusReason: 'SELF_REFERRAL',
          leaseOwner: '',
          leaseUntil: null
        })
        await mirrorUserTerminalStatus(db, updated)
        return { result: 'rejected' }
      }

      const bind = await bindReferralRelationInTransaction(db, {
        claimId: current._id,
        inviteeUserId: current.inviteeUserId,
        inviterUserId: inviter._id,
        inviteCode: code,
        intentVersion: current.intentVersion,
        configSnapshot: {
          requireFirstEvent: config.requireFirstEvent,
          inviterRewardTokens: config.inviterRewardTokens,
          inviteeRewardTokens: config.inviteeRewardTokens,
          inviterTrialExtendDays: config.inviterTrialExtendDays,
          weeklyInviteCap: config.weeklyInviteCap
        }
      })

      if (!bind.ok) {
        if (bind.reason === 'INVITER_CONFLICT') {
          const updated = await markClaim(db, current._id, {
            status: 'needs_review',
            statusReason: 'INVITER_CONFLICT',
            leaseOwner: '',
            leaseUntil: null
          })
          await mirrorUserTerminalStatus(db, updated)
          return { result: 'needs_review' }
        }
        await markRetryOrFailed(db, current, bind.error || bind.reason || 'BIND_FAILED')
        return { result: 'retried' }
      }
      current = await readDoc(db, CLAIMS, current._id)
    }

    // C. 首事件
    if (current.requireFirstEvent) {
      const firstEvent = await findFirstEvent(db, current.inviteeUserId)
      if (!firstEvent) {
        await markClaim(db, current._id, {
          status: 'waiting_first_event',
          nextRunAt: new Date(now().getTime() + 60 * 1000),
          leaseOwner: '',
          leaseUntil: null
        })
        return { result: 'waiting' }
      }
      const firstEventAt = firstEvent.createdAt || firstEvent.occurrenceAt || now()
      await markClaim(db, current._id, {
        firstEventAt,
        status: current.status === 'waiting_first_event' ? 'retry' : current.status,
        updatedAt: now()
      })
      current = await readDoc(db, CLAIMS, current._id)
    }

    // D. 发奖前判断
    const latestConfig = await getReferralConfig(db)
    if (latestConfig.payoutPaused === true) {
      await markClaim(db, current._id, {
        status: 'retry',
        nextRunAt: new Date(now().getTime() + 60 * 1000),
        leaseOwner: '',
        leaseUntil: null,
        lastErrorCode: 'PAYOUT_PAUSED'
      })
      return { result: 'paused' }
    }

    if (current.status === 'rewarded' || current.status === 'manual_resolved') {
      await clearLease(db, current._id)
      return { result: 'rewarded', idempotent: true }
    }
    if (['rejected', 'failed', 'needs_review'].includes(current.status)) {
      await clearLease(db, current._id)
      return { result: current.status }
    }

    const settle = await settleClaimInTransaction(db, current)
    if (settle.ok) {
      const updated = await readDoc(db, CLAIMS, current._id)
      await mirrorUserTerminalStatus(db, updated)
      return { result: settle.status || 'rewarded', idempotent: Boolean(settle.idempotent) }
    }

    if (
      settle.reason === 'INVITER_CONFLICT' ||
      settle.reason === 'PARTIAL_GRANT_FOUND' ||
      settle.reason === 'CLAIM_NOT_READY' ||
      settle.reason === 'INVALID_REWARD_AMOUNT' ||
      settle.reason === 'GRANT_CONFLICT'
    ) {
      const updated = await markClaim(db, current._id, {
        status: 'needs_review',
        statusReason: settle.reason,
        leaseOwner: '',
        leaseUntil: null
      })
      await mirrorUserTerminalStatus(db, updated)
      return { result: 'needs_review' }
    }

    if (settle.reason === 'STALE_CLAIM' || settle.reason === 'STATUS_CHANGED') {
      const latest = await readDoc(db, CLAIMS, current._id)
      if (!latest) return { result: 'skipped' }
      if (latest.status === 'waiting_first_event') {
        await clearLease(db, latest._id)
        return { result: 'waiting' }
      }
      if (latest.status === 'rewarded' || latest.status === 'manual_resolved') {
        await mirrorUserTerminalStatus(db, latest)
        return { result: 'rewarded', idempotent: true }
      }
      if (['rejected', 'failed', 'needs_review'].includes(latest.status)) {
        await mirrorUserTerminalStatus(db, latest)
        return { result: latest.status }
      }
      await clearLease(db, latest._id)
      return { result: 'skipped' }
    }

    await markRetryOrFailed(db, current, settle.error || settle.reason || 'SETTLE_FAILED')
    return { result: 'retried' }
  } catch (error) {
    logWorker('process_claim_error', { claimId: claim._id, error: sanitizeErrorCode(error) })
    await markRetryOrFailed(db, claim, error)
    return { result: 'retried' }
  }
}

async function processDueReferralClaims(db, { limit = CLAIM_BATCH, deadline = null, workerId = 'worker' } = {}) {
  const ts = now()
  const { data = [] } = await db.collection(CLAIMS)
    .where({
      status: db.command.in(ACTIVE_CLAIM_STATUSES),
      nextRunAt: db.command.lte(ts)
    })
    .limit(limit)
    .get()

  const stats = {
    rewarded: 0,
    waiting: 0,
    retried: 0,
    failed: 0,
    rejected: 0,
    needs_review: 0,
    paused: 0,
    skipped: 0
  }

  for (const claim of data) {
    if (deadline && Date.now() >= deadline) break
    const { result } = await processOneReferralClaim(db, claim, { workerId })
    if (result === 'rewarded') stats.rewarded += 1
    else if (result === 'waiting') stats.waiting += 1
    else if (result === 'retried') stats.retried += 1
    else if (result === 'failed') stats.failed += 1
    else if (result === 'rejected') stats.rejected += 1
    else if (result === 'needs_review') stats.needs_review += 1
    else if (result === 'paused') stats.paused += 1
    else stats.skipped += 1
  }

  return { ...stats, scanned: data.length }
}

async function reconcileLegacyClaim(db, claimId) {
  const claim = await readDoc(db, CLAIMS, claimId)
  if (!claim) return { success: false, message: 'claim 不存在' }
  const grants = await hasEitherGrant(db, claim.inviteeUserId)
  if (grants.both) {
    const updated = await markClaim(db, claimId, {
      status: 'rewarded',
      statusReason: 'RECONCILED_BOTH_GRANTS',
      rewardedAt: claim.rewardedAt || now(),
      leaseOwner: '',
      leaseUntil: null
    })
    await mirrorUserTerminalStatus(db, updated)
    return { success: true, status: 'rewarded' }
  }
  if (grants.any) {
    const updated = await markClaim(db, claimId, {
      status: 'needs_review',
      statusReason: 'PARTIAL_GRANT_FOUND',
      leaseOwner: '',
      leaseUntil: null
    })
    await mirrorUserTerminalStatus(db, updated)
    return { success: true, status: 'needs_review' }
  }
  if (claim.status === 'rewarded') {
    const updated = await markClaim(db, claimId, {
      status: 'needs_review',
      statusReason: 'REWARDED_WITHOUT_GRANTS',
      leaseOwner: '',
      leaseUntil: null
    })
    await mirrorUserTerminalStatus(db, updated)
    return { success: true, status: 'needs_review' }
  }
  return { success: true, status: claim.status, message: '无需对账变更' }
}

async function retryClaimManually(db, claimId) {
  const claim = await readDoc(db, CLAIMS, claimId)
  if (!claim) return { success: false, message: 'claim 不存在' }
  if (!['retry', 'failed'].includes(claim.status)) {
    return { success: false, message: '仅允许 retry/failed 重新排队' }
  }
  await markClaim(db, claimId, {
    status: 'retry',
    nextRunAt: now(),
    leaseOwner: '',
    leaseUntil: null,
    lastErrorCode: '',
    statusReason: 'MANUAL_RETRY'
  })
  return { success: true }
}

async function compensateClaimManuallyStrict(db, {
  claimId,
  adminUserId,
  confirmText,
  inviterUserId,
  inviteeUserId,
  inviterTokens,
  inviteeTokens,
  repairSides,
  reason = ''
}) {
  if (!confirmText || String(confirmText).trim().length < 2) {
    return { success: false, message: '必须提供确认文本' }
  }

  const normalizedClaimId = String(claimId || '').trim()
  const normalizedInviterUserId = String(inviterUserId || '').trim()
  const normalizedInviteeUserId = String(inviteeUserId || '').trim()
  const normalizedSides = normalizeRepairSides(repairSides)
  const inviterAmount = Number(inviterTokens)
  const inviteeAmount = Number(inviteeTokens)
  if (!normalizedClaimId || !normalizedInviterUserId || !normalizedInviteeUserId) {
    return { success: false, message: '缺少 claimId/inviterUserId/inviteeUserId' }
  }
  if (!Array.isArray(repairSides) || normalizedSides.length !== repairSides.length || normalizedSides.length === 0) {
    return { success: false, message: 'repairSides 必须明确指定 inviter/invitee' }
  }
  if (!isValidCompensationAmount(inviterAmount) || !isValidCompensationAmount(inviteeAmount)) {
    return { success: false, message: '补偿金额非法' }
  }

  const transaction = await db.startTransaction()
  let updatedClaim = null
  try {
    const claim = await readDoc(transaction, CLAIMS, normalizedClaimId)
    if (!claim) {
      await transaction.rollback()
      return { success: false, message: 'claim 不存在' }
    }
    if (claim.inviteeUserId !== normalizedInviteeUserId || claim.inviterUserId !== normalizedInviterUserId) {
      await transaction.rollback()
      return { success: false, message: 'inviter/invitee 与 claim 不一致' }
    }

    const inviter = await readDoc(transaction, USERS, normalizedInviterUserId)
    const invitee = await readDoc(transaction, USERS, normalizedInviteeUserId)
    const inviterGrant = await readDoc(transaction, CALL_USAGE, inviterGrantId(normalizedInviteeUserId))
    const inviteeGrant = await readDoc(transaction, CALL_USAGE, inviteeGrantId(normalizedInviteeUserId))
    if (!inviter || !invitee) {
      await transaction.rollback()
      return { success: false, message: '用户不存在' }
    }
    if (invitee.invitedBy && invitee.invitedBy !== normalizedInviterUserId) {
      await transaction.rollback()
      return { success: false, message: '被邀请人已绑定其他邀请人' }
    }
    if (
      !isMatchingReferralGrant(inviterGrant, 'inviter', normalizedInviterUserId, normalizedInviteeUserId) ||
      !isMatchingReferralGrant(inviteeGrant, 'invitee', normalizedInviterUserId, normalizedInviteeUserId)
    ) {
      await transaction.rollback()
      return { success: false, message: '固定奖励流水身份冲突' }
    }

    const expectedInviterAmount = Number(claim.inviterTokens || 0)
    const expectedInviteeAmount = Number(claim.inviteeTokens || 0)
    if (!isValidCompensationAmount(expectedInviterAmount) || !isValidCompensationAmount(expectedInviteeAmount)) {
      await transaction.rollback()
      return { success: false, message: 'claim 奖励金额非法' }
    }
    const missingSides = []
    if (expectedInviterAmount > 0 && !inviterGrant) missingSides.push('inviter')
    if (expectedInviteeAmount > 0 && !inviteeGrant) missingSides.push('invitee')
    missingSides.sort()

    if (claim.status === 'manual_resolved' && missingSides.length === 0) {
      await transaction.rollback()
      return { success: true, status: 'manual_resolved', idempotent: true }
    }
    if (!['failed', 'needs_review'].includes(claim.status)) {
      await transaction.rollback()
      return { success: false, message: '仅允许 failed/needs_review 人工补偿' }
    }
    if (normalizedSides.join(',') !== missingSides.join(',')) {
      await transaction.rollback()
      return { success: false, message: `repairSides 与当前缺失边不一致: ${missingSides.join(',') || 'none'}` }
    }
    if (
      (normalizedSides.includes('inviter') && inviterAmount !== expectedInviterAmount) ||
      (normalizedSides.includes('invitee') && inviteeAmount !== expectedInviteeAmount)
    ) {
      await transaction.rollback()
      return { success: false, message: '补偿金额与 claim 快照不一致' }
    }

    const ts = now()
    const beforeBalances = {
      inviter: Number(inviter.extraTokens || 0),
      invitee: Number(invitee.extraTokens || 0)
    }
    const afterBalances = { ...beforeBalances }

    if (normalizedSides.includes('inviter')) {
      const weekStart = getShanghaiWeekStart(ts)
      const inviterWeekStart = inviter.referralWeekStart ? new Date(inviter.referralWeekStart) : null
      const weeklyCount = !inviterWeekStart || inviterWeekStart.getTime() < weekStart.getTime()
        ? 0
        : Number(inviter.referralWeekCount || 0)
      const inviterPatch = {
        referralCount: db.command.inc(1),
        referralWeekStart: weekStart,
        referralWeekCount: weeklyCount + 1,
        updatedAt: ts
      }
      if (inviterAmount > 0) inviterPatch.extraTokens = db.command.inc(inviterAmount)
      const trialExtendDays = Number(claim.inviterTrialExtendDays || 0)
      if (inviter.plan === 'free' && trialExtendDays > 0) {
        const currentTrialEnd = inviter.trialEndsAt ? new Date(inviter.trialEndsAt) : ts
        const baseTime = currentTrialEnd > ts ? currentTrialEnd : ts
        inviterPatch.trialEndsAt = new Date(baseTime.getTime() + trialExtendDays * 24 * 60 * 60 * 1000)
      }
      await transaction.collection(USERS).doc(normalizedInviterUserId).update(inviterPatch)
      afterBalances.inviter += inviterAmount
      await transaction.collection(CALL_USAGE).add({
        _id: inviterGrantId(normalizedInviteeUserId),
        userId: normalizedInviterUserId,
        type: 'grant',
        source: 'referral_inviter',
        sourceId: normalizedInviteeUserId,
        amount: inviterAmount,
        amountTokens: inviterAmount,
        balanceAfter: afterBalances.inviter,
        remark: `referral_inviter:${normalizedInviteeUserId}:manual`,
        manualClaimId: normalizedClaimId,
        manualAdminUserId: String(adminUserId || ''),
        createdAt: ts
      })
    }

    if (normalizedSides.includes('invitee')) {
      await transaction.collection(USERS).doc(normalizedInviteeUserId).update({
        extraTokens: db.command.inc(inviteeAmount),
        invitedBy: normalizedInviterUserId,
        invitedByCode: claim.inviteCode || '',
        updatedAt: ts
      })
      afterBalances.invitee += inviteeAmount
      await transaction.collection(CALL_USAGE).add({
        _id: inviteeGrantId(normalizedInviteeUserId),
        userId: normalizedInviteeUserId,
        type: 'grant',
        source: 'referral_invitee',
        sourceId: normalizedInviteeUserId,
        amount: inviteeAmount,
        amountTokens: inviteeAmount,
        balanceAfter: afterBalances.invitee,
        remark: `referral_invitee:${normalizedInviteeUserId}:manual`,
        manualClaimId: normalizedClaimId,
        manualAdminUserId: String(adminUserId || ''),
        createdAt: ts
      })
    }

    const manualAction = {
      adminUserId: String(adminUserId || ''),
      confirmText: String(confirmText).slice(0, 200),
      reason: String(reason || '').slice(0, 200),
      repairSides: normalizedSides,
      missingSidesBefore: missingSides,
      amounts: { inviter: inviterAmount, invitee: inviteeAmount },
      grantIds: {
        inviter: inviterGrantId(normalizedInviteeUserId),
        invitee: inviteeGrantId(normalizedInviteeUserId)
      },
      beforeBalances,
      afterBalances,
      at: ts
    }
    await transaction.collection(CLAIMS).doc(normalizedClaimId).update({
      status: 'manual_resolved',
      statusReason: reason || 'MANUAL_COMPENSATION',
      manualAction,
      rewardedAt: claim.rewardedAt || ts,
      updatedAt: ts,
      leaseOwner: '',
      leaseUntil: null
    })
    await transaction.commit()
    updatedClaim = {
      ...claim,
      status: 'manual_resolved',
      statusReason: reason || 'MANUAL_COMPENSATION',
      manualAction
    }
  } catch (error) {
    try { await transaction.rollback() } catch (_) {}
    return { success: false, message: sanitizeErrorCode(error) }
  }

  await mirrorUserTerminalStatus(db, updatedClaim)
  return { success: true, status: 'manual_resolved', repairedSides: normalizedSides }
}

async function compensateClaimManually(db, {
  claimId,
  adminUserId,
  confirmText,
  inviterUserId,
  inviteeUserId,
  inviterTokens,
  inviteeTokens,
  repairSides,
  reason = ''
}) {
  return compensateClaimManuallyStrict(db, {
    claimId,
    adminUserId,
    confirmText,
    inviterUserId,
    inviteeUserId,
    inviterTokens,
    inviteeTokens,
    repairSides,
    reason
  })
}

module.exports = {
  normalizeInviteCode,
  buildReferralIntentFields,
  getShanghaiWeekStart,
  setNowProvider,
  recoverReferralIntents,
  processDueReferralClaims,
  processOneReferralClaim,
  bindReferralRelationInTransaction,
  settleClaimInTransaction,
  reconcileLegacyClaim,
  retryClaimManually,
  compensateClaimManually,
  inviterGrantId,
  inviteeGrantId
}
