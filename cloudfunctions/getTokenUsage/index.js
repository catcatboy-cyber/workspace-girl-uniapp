const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const TOKEN_USAGE_COLLECTION = 'token_usage_records'

function toISO(value) {
  if (!value) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value.toDate === 'function') return value.toDate().toISOString()
  if (typeof value === 'string') return value
  return ''
}

function normalizeRecord(item) {
  return {
    id: item._id || '',
    feature: item.feature || 'unknown',
    provider: item.provider || '',
    model: item.model || '',
    caseId: item.caseId || '',
    promptTokens: Number(item.promptTokens || 0),
    completionTokens: Number(item.completionTokens || 0),
    totalTokens: Number(item.totalTokens || 0),
    usageAvailable: item.usageAvailable !== false,
    createdAt: toISO(item.createdAt)
  }
}

exports.main = async (event = {}) => {
  try {
    const userId = await requireAuthenticatedUserId(app, event)
    const limit = Math.min(100, Math.max(10, Number(event.limit || 50)))
    const { data } = await db.collection(TOKEN_USAGE_COLLECTION)
      .where({ userId })
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()

    const records = (data || []).map(normalizeRecord)
    const summary = records.reduce((acc, item) => {
      acc.promptTokens += item.promptTokens
      acc.completionTokens += item.completionTokens
      acc.totalTokens += item.totalTokens
      acc.callCount += 1
      if (!item.usageAvailable) acc.unavailableCount += 1
      return acc
    }, {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      callCount: 0,
      unavailableCount: 0
    })

    return { success: true, summary, records }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('getTokenUsage error:', error)
    return { success: false, message: '读取 token 消费失败' }
  }
}
