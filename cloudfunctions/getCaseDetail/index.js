const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId, buildAuthErrorResponse, getOwnedCase } = require('./_shared/auth')
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()

function normalizeDoc(res) {
  if (Array.isArray(res?.data)) return res.data[0] || null
  return res?.data || null
}

function toTime(value) {
  if (!value) return 0
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

async function fetchAllPages(createQuery, pageSize = 100) {
  const all = []
  let offset = 0
  while (true) {
    const { data = [] } = await createQuery()
      .skip(offset)
      .limit(pageSize)
      .get()
    all.push(...data)
    if (data.length < pageSize) break
    offset += data.length
  }
  return all
}

exports.main = async (event) => {
  const { caseId } = event
  try {
    const userId = await requireAuthenticatedUserId(app, event)
    if (!caseId) return { success: false, message: '缺少档案ID' }

    const { caseDoc, error: caseError } = await getOwnedCase(db, caseId, userId)
    if (caseError) return caseError

    const latestResultPromise = caseDoc.latestResultId
      ? db.collection('assessments').doc(caseDoc.latestResultId).get().catch(() => null)
      : Promise.resolve(null)

    const [latestResultRes, allAssessments, timeline] = await Promise.all([
      latestResultPromise,
      fetchAllPages(() => db.collection('assessments')
        .where({ caseId })
        .orderBy('createdAt', 'desc')),
      fetchAllPages(() => db.collection('timeline_records')
        .where({ caseId })
        .orderBy('occurrenceAt', 'desc'))
    ])

    const assessmentById = new Map()
    const latestResultDoc = normalizeDoc(latestResultRes)
    if (latestResultDoc?.caseId === caseId) {
      assessmentById.set(latestResultDoc._id || latestResultDoc.assessmentId, latestResultDoc)
    }
    ;(allAssessments || []).forEach((item) => {
      assessmentById.set(item._id || item.assessmentId, item)
    })

    const assessments = Array.from(assessmentById.values())
      .sort((a, b) => toTime(a.createdAt) - toTime(b.createdAt))

    const latestResult = caseDoc.latestResultId
      ? assessmentById.get(caseDoc.latestResultId) || assessments[assessments.length - 1] || null
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
