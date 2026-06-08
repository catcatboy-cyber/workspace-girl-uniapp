/**
 * 邀请码兑换云函数
 * 注册时被邀请人调用，双方获得奖励
 */
const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')
const { redeemInviteCode } = require('./_shared/subscription')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()

exports.main = async (event) => {
  try {
    const userId = await requireAuthenticatedUserId(app, event)
    const { inviteCode } = event

    if (!inviteCode || typeof inviteCode !== 'string' || inviteCode.trim().length < 3) {
      return { success: false, message: '邀请码无效' }
    }

    const result = await redeemInviteCode(db, inviteCode.trim(), userId)
    return result
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('redeemInviteCode error:', error)
    return { success: false, message: '兑换邀请码失败' }
  }
}
