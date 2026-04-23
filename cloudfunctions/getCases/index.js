const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const _ = db.command

exports.main = async (event) => {
  try {
    const userId = await requireAuthenticatedUserId(app)

    const { data: cases } = await db.collection('cases')
      .where({ userId })
      .orderBy('updatedAt', 'desc')
      .get()

    const caseIds = cases.map((item) => item._id).filter(Boolean)

    if (caseIds.length > 0) {
      // 按创建时间正序返回，前端可直接用 assessments[length-1] 获取最新评估
      const { data: assessments } = await db.collection('assessments')
        .where({ caseId: _.in(caseIds) })
        .orderBy('createdAt', 'asc')
        .get()

      const { data: timelineRecords } = await db.collection('timeline_records')
        .where({ caseId: _.in(caseIds) })
        .orderBy('occurrenceAt', 'desc')
        .get()

      const assessmentsByCaseId = new Map()
      const assessmentById = new Map()
      const timelineByCaseId = new Map()

      assessments.forEach((item) => {
        assessmentById.set(item._id, item)
        const list = assessmentsByCaseId.get(item.caseId) || []
        list.push(item)
        assessmentsByCaseId.set(item.caseId, list)
      })

      timelineRecords.forEach((item) => {
        const list = timelineByCaseId.get(item.caseId) || []
        list.push(item)
        timelineByCaseId.set(item.caseId, list)
      })

      cases.forEach((item) => {
        const caseAssessments = assessmentsByCaseId.get(item._id) || []
        item.assessments = caseAssessments
        item.timeline = timelineByCaseId.get(item._id) || []
        item.latestResult = item.latestResultId
          ? assessmentById.get(item.latestResultId) || caseAssessments[caseAssessments.length - 1] || null
          : caseAssessments[caseAssessments.length - 1] || null
      })
    } else {
      cases.forEach((item) => {
        item.latestResult = null
        item.assessments = []
        item.timeline = []
      })
    }

    return { success: true, cases }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('getCases error:', error)
    return { success: false, message: '获取档案列表失败' }
  }
}
