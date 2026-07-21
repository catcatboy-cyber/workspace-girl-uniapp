const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')
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

async function getCaseDashboardData(caseId, latestResultId) {
  const latestResultPromise = latestResultId
    ? db.collection('assessments').doc(latestResultId).get().catch(() => null)
    : Promise.resolve(null)

  const [latestResultRes, recentAssessmentsRes, timelineRes] = await Promise.all([
    latestResultPromise,
    db.collection('assessments')
      .where({ caseId })
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get(),
    db.collection('timeline_records')
      .where({ caseId })
      .orderBy('occurrenceAt', 'desc')
      .limit(50)
      .get()
  ])

  const assessmentById = new Map()
  const latestResultDoc = normalizeDoc(latestResultRes)
  if (latestResultDoc?.caseId === caseId) {
    assessmentById.set(latestResultDoc._id || latestResultDoc.assessmentId, latestResultDoc)
  }

  ;(recentAssessmentsRes.data || []).forEach((item) => {
    assessmentById.set(item._id || item.assessmentId, item)
  })

  const assessments = Array.from(assessmentById.values())
    .sort((a, b) => toTime(a.createdAt) - toTime(b.createdAt))

  const latestResult = latestResultId
    ? assessmentById.get(latestResultId) || assessments[assessments.length - 1] || null
    : assessments[assessments.length - 1] || null

  return {
    assessments,
    timeline: timelineRes.data || [],
    latestResult
  }
}

async function getCaseListData(caseId, latestResultId) {
  const latestResultPromise = latestResultId
    ? db.collection('assessments').doc(latestResultId).get().catch(() => null)
    : Promise.resolve(null)

  const [latestResultRes, recentAssessmentsRes, recentTimelineRes, timelineCountRes] = await Promise.all([
    latestResultPromise,
    db.collection('assessments')
      .where({ caseId })
      .orderBy('createdAt', 'desc')
      .limit(2)
      .get(),
    db.collection('timeline_records')
      .where({ caseId })
      .orderBy('occurrenceAt', 'desc')
      .limit(8)
      .get(),
    db.collection('timeline_records')
      .where({ caseId })
      .count()
      .catch(() => ({ total: 0 }))
  ])

  const assessmentById = new Map()
  const latestResultDoc = normalizeDoc(latestResultRes)
  if (latestResultDoc?.caseId === caseId) {
    assessmentById.set(latestResultDoc._id || latestResultDoc.assessmentId, latestResultDoc)
  }

  ;(recentAssessmentsRes.data || []).forEach((item) => {
    assessmentById.set(item._id || item.assessmentId, item)
  })

  const assessments = Array.from(assessmentById.values())
    .sort((a, b) => toTime(a.createdAt) - toTime(b.createdAt))

  return {
    assessments,
    timeline: recentTimelineRes.data || [],
    timelineCount: Number(timelineCountRes.total || 0),
    latestResult: latestResultId
      ? assessmentById.get(latestResultId) || assessments[assessments.length - 1] || null
      : assessments[assessments.length - 1] || null
  }
}

// ── v6: 首页 Swiper 滑动批量预加载 ──
async function getHomeData(cases, detailCaseId) {
  if (!cases || cases.length === 0) return {}

  const caseIds = cases.map(c => c._id).filter(Boolean)
  const detailId = caseIds.includes(detailCaseId) ? detailCaseId : caseIds[0]
  const nonDetailCases = cases.filter(c => c._id !== detailId)

  const detailDashboard = await getCaseDashboardData(detailId,
    cases.find(c => c._id === detailId)?.latestResultId)

  const lookbackStart = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)

  const monthTimelineRes = await db.collection('timeline_records')
    .where({
      caseId: db.command.in(caseIds),
      occurrenceAt: db.command.gte(lookbackStart)
    })
    .orderBy('occurrenceAt', 'desc')
    .limit(1000)
    .get()

  const assessmentsByCase = {}
  if (nonDetailCases.length > 0) {
    const entries = await Promise.all(
      nonDetailCases.map(async c => {
        const res = await db.collection('assessments')
          .where({ caseId: c._id })
          .orderBy('createdAt', 'desc')
          .limit(2)
          .get()
        return [c._id, res.data || []]
      })
    )
    for (const [id, list] of entries) {
      assessmentsByCase[id] = list
    }
  }

  const timelineByCase = {}
  for (const r of (monthTimelineRes.data || [])) {
    (timelineByCase[r.caseId] = timelineByCase[r.caseId] || []).push(r)
  }

  function sortAsc(list) {
    return (list || []).sort((a, b) => toTime(a.createdAt) - toTime(b.createdAt))
  }

  const result = {}
  for (const c of cases) {
    const id = c._id
    const recentTimeline = timelineByCase[id] || []
    if (id === detailId) {
      result[id] = { ...detailDashboard, recentTimeline }
    } else {
      const assessments = sortAsc(assessmentsByCase[id] || [])
      const latestAssessment = c.latestResultId
        ? assessments.find(a => a._id === c.latestResultId) || assessments[assessments.length - 1] || null
        : assessments[assessments.length - 1] || null
      result[id] = { assessments, latestResult: latestAssessment, recentTimeline }
    }
  }
  return result
}

exports.main = async (event) => {
  try {
    const userId = await requireAuthenticatedUserId(app, event)
    const mode = String(event?.mode || 'full')
    const detailCaseId = String(event?.detailCaseId || '').trim()

    const { data: cases } = await db.collection('cases')
      .where({ userId })
      .orderBy('updatedAt', 'desc')
      .get()

    const caseIds = cases.map((item) => item._id).filter(Boolean)

    if (mode === 'home') {
      const homeData = await getHomeData(cases, detailCaseId)
      cases.forEach((item) => {
        const data = homeData[item._id] || {}
        item.assessments = data.assessments || []
        item.timeline = data.timeline || []
        item.latestResult = data.latestResult || null
        item.recentTimeline = data.recentTimeline || []
      })
    } else if (mode === 'full') {
      const detailCaseIds = caseIds
      const caseDataEntries = await Promise.all(
        cases
          .filter((item) => detailCaseIds.includes(item._id))
          .map(async (item) => [item._id, await getCaseDashboardData(item._id, item.latestResultId)])
      )
      const caseDataById = new Map(caseDataEntries)
      cases.forEach((item) => {
        const data = caseDataById.get(item._id) || {}
        item.assessments = data.assessments || []
        item.timeline = data.timeline || []
        item.latestResult = data.latestResult || null
      })
    } else if (mode === 'list') {
      const caseDataEntries = await Promise.all(
        cases.map(async (item) => [item._id, await getCaseListData(item._id, item.latestResultId)])
      )
      const caseDataById = new Map(caseDataEntries)
      cases.forEach((item) => {
        const data = caseDataById.get(item._id) || {}
        item.assessments = data.assessments || []
        item.timeline = data.timeline || []
        item.timelineCount = data.timelineCount || 0
        item.latestResult = data.latestResult || null
      })
    } else {
      cases.forEach((item) => {
        item.latestResult = null
        item.assessments = []
        item.timeline = []
        item.timelineCount = 0
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
