const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const COLLECTION = 'voice_usage'

exports.main = async (event = {}) => {
  try {
    const userId = await requireAuthenticatedUserId(app, event)
    const limit = Math.min(200, Math.max(10, Number(event.limit || 50)))

    const { data } = await db.collection(COLLECTION)
      .where({ userId })
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()

    const records = (data || []).map((item) => ({
      id: item._id || '',
      durationMs: Number(item.durationMs || 0),
      createdAt: item.createdAt ? (item.createdAt instanceof Date ? item.createdAt.toISOString() : String(item.createdAt)) : ''
    }))

    const totalCount = records.length
    const totalDurationMs = records.reduce((sum, r) => sum + r.durationMs, 0)

    return { success: true, totalCount, totalDurationMs, records }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('getVoiceUsage error:', error)
    return { success: false, message: '读取语音记录失败' }
  }
}
