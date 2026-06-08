/**
 * 次数消费明细查询
 */
const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')
const { getCallUsageHistory } = require('./_shared/subscription')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()

exports.main = async (event) => {
  try {
    const userId = await requireAuthenticatedUserId(app, event)
    const limit = Math.min(Number(event.limit) || 100, 200)
    const result = await getCallUsageHistory(db, userId, limit)
    return { success: true, ...result }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('getCallUsageHistory error:', error)
    return { success: false, message: '查询失败' }
  }
}
