const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId, buildAuthErrorResponse, getOwnedCase } = require('./_shared/auth')
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const _ = db.command

exports.main = async (event) => {
  const { caseId } = event
  try {
    const userId = await requireAuthenticatedUserId(app, event)
    if (!caseId) return { success: false, message: '缺少档案ID' }

    const { error: caseError } = await getOwnedCase(db, caseId, userId)
    if (caseError) return caseError

    const { data: timeline } = await db.collection('timeline_records')
      .where({ caseId })
      .orderBy('occurrenceAt', 'desc')
      .get()

    return { success: true, timeline }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('getTimeline error:', error)
    return { success: false, message: '获取时间线失败' }
  }
}
