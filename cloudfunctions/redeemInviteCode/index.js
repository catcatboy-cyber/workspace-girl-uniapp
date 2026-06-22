/**
 * 邀请码兑换云函数 — v1.2 走新结算体系
 */
const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')
const { settleReward } = require('./_shared/referral-settlement')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()

exports.main = async (event) => {
  try {
    const userId = await requireAuthenticatedUserId(app, event)
    const inviteCode = String(event.inviteCode || '').trim()

    if (!inviteCode || inviteCode.length < 3) {
      return { success: false, message: '邀请码无效' }
    }

    // 查邀请人
    const inviter = await db.collection('users')
      .where({ inviteCode }).limit(1).get()
    if (inviter.data.length === 0) {
      return { success: false, message: '邀请码不存在' }
    }

    const result = await settleReward(db, userId, inviter.data[0]._id, inviteCode, '', 'invite_code')
    return result
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('redeemInviteCode error:', error)
    return { success: false, message: '兑换邀请码失败' }
  }
}
