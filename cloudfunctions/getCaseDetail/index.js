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

    const { caseDoc, error: caseError } = await getOwnedCase(db, caseId, userId)
    if (caseError) return caseError

    // 按创建时间正序返回，前端可直接用 assessments[length-1] 获取最新评估
    const { data: assessments } = await db.collection('assessments')
      .where({ caseId })
      .orderBy('createdAt', 'asc')
      .get()

    const { data: timeline } = await db.collection('timeline_records')
      .where({ caseId })
      .orderBy('occurrenceAt', 'desc')
      .get()

    const latestResult = caseDoc.latestResultId
      ? assessments.find((item) => item._id === caseDoc.latestResultId) || assessments[assessments.length - 1] || null
      : assessments[assessments.length - 1] || null

    return {
      success: true,
      case: { ...caseDoc, caseId: caseDoc._id, latestResult, assessments, timeline }
    }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('getCaseDetail error:', error)
    return { success: false, message: '获取档案详情失败' }
  }
}
