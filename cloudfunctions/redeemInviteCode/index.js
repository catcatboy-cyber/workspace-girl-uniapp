/**
 * 邀请码兑换云函数 — 只提交邀请意图，不在线结算
 */
const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')
const { normalizeInviteCode } = require('./_shared/referral-settlement')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()

const REPLACEABLE_REJECT_REASONS = ['EMPTY_INVITE_CODE', 'INVALID_INVITE_CODE', 'SELF_REFERRAL']

exports.main = async (event) => {
  try {
    const userId = await requireAuthenticatedUserId(app, event)
    const inviteCode = normalizeInviteCode(event.inviteCode)

    if (!inviteCode || inviteCode.length < 3) {
      return { success: false, code: 'INVALID_FORMAT', message: '邀请码无效' }
    }

    const { data: userRows } = await db.collection('users').doc(userId).get()
    const user = userRows && userRows[0]
    if (!user) {
      return { success: false, message: '用户不存在' }
    }

    if (user.invitedBy) {
      return { success: false, code: 'ALREADY_BOUND', message: '已绑定邀请关系，无法更换邀请码' }
    }

    let claim = null
    try {
      const { data } = await db.collection('referral_claims').doc(userId).get()
      claim = data && data[0] ? data[0] : null
    } catch (_) {}

    if (claim) {
      if (claim.status === 'rewarded' || claim.status === 'manual_resolved') {
        return { success: false, code: 'ALREADY_REWARDED', message: '邀请奖励已处理，无法更换邀请码' }
      }
      if (claim.status === 'rejected') {
        if (!REPLACEABLE_REJECT_REASONS.includes(claim.statusReason)) {
          return { success: false, code: claim.statusReason || 'REJECTED', message: '当前邀请状态不可更换邀请码' }
        }
      } else {
        return { success: false, code: 'CLAIM_IN_PROGRESS', message: '邀请处理进行中，请稍后再试' }
      }
    }

    const now = new Date()
    await db.collection('users').doc(userId).update({
      landingInviteCode: inviteCode,
      referralAttemptStatus: 'unprocessed',
      referralAttemptCode: inviteCode,
      referralIntentVersion: db.command.inc(1),
      referralIntentAt: now,
      referralNextRunAt: now,
      referralAttemptMessage: '',
      updatedAt: now
    })

    return {
      success: true,
      code: 'REFERRAL_ACCEPTED',
      message: '邀请码已提交，奖励将在后台处理'
    }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('redeemInviteCode error:', error)
    return { success: false, message: '邀请码提交失败，请稍后重试' }
  }
}
