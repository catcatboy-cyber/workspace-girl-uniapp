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

    // source: 'ledger' 读取旧系统 token_ledger_records（有真实倍率扣减）
    if (String(event.source) === 'ledger') {
      const { data: records } = await db.collection('token_ledger_records')
        .where({ userId, type: 'consume' })
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get()
      return { success: true, records: records || [] }
    }

    const action = String(event.action || 'consume')
    let types = null
    if (action === 'ledger' || action === 'all') {
      types = 'all'
    } else {
      types = 'consume'
    }

    const result = await getCallUsageHistory(db, userId, limit, types)
    return { success: true, ...result }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('getCallUsageHistory error:', error)
    return { success: false, message: '查询失败' }
  }
}
