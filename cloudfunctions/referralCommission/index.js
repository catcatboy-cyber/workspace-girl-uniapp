'use strict'

const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')
const {
  getUserCommissionSummary,
  listUserCommissionLedger,
  listUserCommissionInvitees
} = require('./_shared/referral-commission')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()

exports.main = async (event = {}) => {
  try {
    const userId = await requireAuthenticatedUserId(app, event)
    const action = String(event.action || 'getSummary').trim()
    if (action === 'getSummary') {
      const data = await getUserCommissionSummary(db, userId)
      return { success: true, ...data }
    }
    if (action === 'listLedger') {
      const data = await listUserCommissionLedger(db, userId, {
        cursor: event.cursor,
        limit: event.limit,
        status: event.status
      })
      return { success: true, ...data }
    }
    if (action === 'listInvitees') {
      const data = await listUserCommissionInvitees(db, userId, {
        cursor: event.cursor,
        limit: event.limit,
        paidOnly: event.paidOnly === true
      })
      return { success: true, ...data }
    }
    return { success: false, message: '未知操作' }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('[referralCommission]', error)
    return { success: false, message: '邀请奖励读取失败' }
  }
}
