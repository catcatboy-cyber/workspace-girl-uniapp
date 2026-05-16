const cloudbase = require('@cloudbase/node-sdk')
const crypto = require('crypto')
const { recalculateAssessmentFromEvent } = require('./_shared/event-recalculate')
const { compareAssessments, buildTrendTimelineRecords } = require('./_shared/trend')
const { requireAuthenticatedUserId, buildAuthErrorResponse, getOwnedCase } = require('./_shared/auth')
const { recordTokenUsage } = require('./_shared/token-usage')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const _ = db.command
const GLOBAL_AI_SETTINGS_ID = 'settings_global_ai'

function normalizeDoc(res) {
  if (Array.isArray(res?.data)) return res.data[0] || null
  return res?.data || null
}

function randomHex(n) {
  return crypto.randomBytes(n).toString('hex')
}

function toTime(value) {
  if (!value) return 0
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeSubjectRole(value) {
  return ['target', 'self', 'both', 'unknown'].includes(value) ? value : 'target'
}

function normalizeSubjectRoleConfidence(value) {
  return ['user_selected', 'confirmed'].includes(value) ? value : 'user_selected'
}

function toISOStringOrUndefined(value) {
  if (!value) return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

async function getAISettings(userId) {
  const globalDocRes = await db.collection('system_settings').doc(GLOBAL_AI_SETTINGS_ID).get().catch(() => null)
  let settings = normalizeDoc(globalDocRes)

  if (!settings) {
    const globalScopeRes = await db.collection('system_settings')
      .where({ scope: 'global', key: 'ai' })
      .limit(1)
      .get()
    settings = globalScopeRes.data && globalScopeRes.data.length > 0 ? globalScopeRes.data[0] : null
  }

  if (!settings) {
    const userSettingsRes = await db.collection('system_settings')
      .where({ userId })
      .limit(1)
      .get()
    settings = userSettingsRes.data && userSettingsRes.data.length > 0 ? userSettingsRes.data[0] : null
  }

  return settings
}

async function getSelfProfile(userId) {
  const result = await db.collection('users').doc(userId).get().catch(() => null)
  const user = normalizeDoc(result)
  return user?.selfProfile || null
}

function compactTimelineItem(item) {
  return {
    id: item._id || item.id,
    title: item.title,
    type: item.type,
    subjectRole: normalizeSubjectRole(item.subjectRole),
    subjectRoleConfidence: normalizeSubjectRoleConfidence(item.subjectRoleConfidence),
    dateLabel: item.dateLabel || '',
    description: item.description || '',
    semanticTags: item.semanticTags,
    occurrenceAt: toISOStringOrUndefined(item.occurrenceAt),
    createdAt: toISOStringOrUndefined(item.createdAt)
  }
}

function setValue(value) {
  if (value && typeof value === 'object') return _.set(value)
  if (value === null) return _.set(null)
  return value
}

function buildAssessmentUpdate(recalculated) {
  const update = {}
  for (const [key, value] of Object.entries(recalculated)) {
    if (key === '_id' || key === 'caseId') continue
    update[key] = setValue(value)
  }
  update.aiPending = false
  update.aiFailed = Boolean(recalculated.aiFailed)
  update.aiGeneratedAt = _.set(new Date())
  return update
}

function mapError(error) {
  if (error?.message === 'ASSESSMENT_NOT_FOUND') return '评估记录不存在'
  if (error?.message === 'EVENT_NOT_FOUND') return '触发事件不存在'
  if (error?.message === 'PREVIOUS_ASSESSMENT_NOT_FOUND') return '缺少上一版评估，暂时无法生成 AI 反馈'
  return error?.message || 'AI 即时反馈生成失败'
}

exports.main = async (event = {}) => {
  const startedAt = Date.now()
  const traceId = `gai_${startedAt}_${randomHex(3)}`
  const markPerf = (stage, extra = {}) => {
    console.log('[generateAssessmentAI perf]', JSON.stringify({
      traceId,
      stage,
      elapsedMs: Date.now() - startedAt,
      ...extra
    }))
  }

  try {
    markPerf('start')
    const userId = await requireAuthenticatedUserId(app, event)
    const caseId = typeof event.caseId === 'string' ? event.caseId.trim() : ''
    const assessmentId = typeof event.assessmentId === 'string' ? event.assessmentId.trim() : ''
    const recordId = typeof event.recordId === 'string' ? event.recordId.trim() : ''
    if (!caseId || !assessmentId) return { success: false, message: '缺少档案或评估ID' }

    const ownedCase = await getOwnedCase(db, caseId, userId)
    if (ownedCase.error) return ownedCase.error
    const caseDoc = ownedCase.caseDoc
    markPerf('case_loaded')

    const assessment = normalizeDoc(await db.collection('assessments').doc(assessmentId).get())
    if (!assessment || assessment.caseId !== caseId) throw new Error('ASSESSMENT_NOT_FOUND')
    markPerf('assessment_loaded')

    const triggerEventId = recordId || assessment.triggerEventId
    const eventDoc = normalizeDoc(await db.collection('timeline_records').doc(triggerEventId).get())
    if (!eventDoc || eventDoc.caseId !== caseId) throw new Error('EVENT_NOT_FOUND')
    const triggerEvent = compactTimelineItem(eventDoc)
    markPerf('event_loaded')

    const [{ data: timelineItems }, { data: assessmentItems }, aiSettings, selfProfile] = await Promise.all([
      db.collection('timeline_records').where({ caseId }).orderBy('occurrenceAt', 'desc').get(),
      db.collection('assessments').where({ caseId }).orderBy('createdAt', 'asc').get(),
      getAISettings(userId),
      getSelfProfile(userId)
    ])
    markPerf('context_loaded', {
      timelineCount: Array.isArray(timelineItems) ? timelineItems.length : 0,
      assessmentCount: Array.isArray(assessmentItems) ? assessmentItems.length : 0,
      aiEnabled: Boolean(aiSettings?.aiEnabled)
    })

    const assessments = Array.isArray(assessmentItems) ? assessmentItems : []
    const previous = assessment.previousAssessmentId
      ? assessments.find((item) => (item._id || item.assessmentId) === assessment.previousAssessmentId)
      : assessments
        .filter((item) => (item._id || item.assessmentId) !== assessmentId && toTime(item.createdAt) < toTime(assessment.createdAt))
        .sort((a, b) => toTime(a.createdAt) - toTime(b.createdAt))
        .pop()
    if (!previous) throw new Error('PREVIOUS_ASSESSMENT_NOT_FOUND')

    const recentTimeline = (timelineItems || [])
      .filter((item) => item.type !== 'assessment' && item.type !== 'trend')
      .map(compactTimelineItem)
    const currentTimelineIndex = recentTimeline.findIndex((item) => item.id === triggerEvent.id)
    if (currentTimelineIndex > 0) {
      const [current] = recentTimeline.splice(currentTimelineIndex, 1)
      recentTimeline.unshift(current)
    }

    let recalculated = null
    try {
      recalculated = await recalculateAssessmentFromEvent({
        previous,
        event: triggerEvent,
        assessmentId,
        recentTimeline: recentTimeline.slice(0, 8),
        caseProfile: caseDoc.profile,
        selfProfile,
        aiSettings,
        traceId
      })
    } catch (error) {
      markPerf('ai_failed_use_rules', { message: error instanceof Error ? error.message : String(error) })
      recalculated = await recalculateAssessmentFromEvent({
        previous,
        event: triggerEvent,
        assessmentId,
        recentTimeline: recentTimeline.slice(0, 8),
        caseProfile: caseDoc.profile,
        selfProfile,
        aiSettings: { aiEnabled: false, aiFallbackToRules: true },
        traceId
      })
      recalculated.aiFailed = true
      recalculated.explanation = {
        ...(recalculated.explanation || {}),
        cautions: [
          'AI 生成超时或返回格式不完整，本次先显示规则兜底结果。',
          ...((recalculated.explanation?.cautions || []).slice(0, 2))
        ]
      }
    }
    markPerf('ai_recalculated', { aiUsed: Boolean(recalculated.aiUsed) })
    if (recalculated.aiUsed) {
      const tokenRecord = await recordTokenUsage(db, {
        userId,
        caseId,
        recordId: triggerEvent.id,
        assessmentId,
        feature: 'eventAssessment',
        provider: recalculated.aiProvider,
        model: recalculated.aiModel,
        usage: recalculated.tokenUsage
      })
      markPerf('token_recorded', {
        recordCreated: Boolean(tokenRecord?.recordCreated),
        usageAvailable: Boolean(tokenRecord?.usageAvailable),
        totalTokens: Number(tokenRecord?.totalTokens || 0),
        provider: tokenRecord?.provider || '',
        model: tokenRecord?.model || '',
        errorMessage: tokenRecord?.errorMessage || ''
      })
    }

    const trend = compareAssessments(previous, recalculated)
    const autoRecords = buildTrendTimelineRecords({
      assessmentIndex: assessments.filter((item) => (item._id || item.assessmentId) !== assessmentId).length + 1,
      intentBucket: recalculated.intentBucket,
      riskBucket: recalculated.riskBucket,
      evidenceLevel: recalculated.evidenceLevel,
      intentDelta: trend.intentDelta,
      riskDelta: trend.riskDelta,
      warningText: trend.warningText
    })
    await db.collection('assessments').doc(assessmentId).update(buildAssessmentUpdate(recalculated))
    await db.collection('timeline_records').doc(triggerEvent.id).update({
      title: recalculated.triggerEventTitle || triggerEvent.title,
      type: recalculated.triggerEventType || triggerEvent.type,
      aiUsed: Boolean(recalculated.aiUsed),
      eventUnderstanding: _.set({
        summary: recalculated.explanation?.headline || recalculated.triggerEventTitle || '',
        usedAI: Boolean(recalculated.aiUsed)
      })
    })
    for (const autoRecord of autoRecords) {
      await db.collection('timeline_records').doc(autoRecord.id).set({
        caseId,
        title: autoRecord.title,
        type: autoRecord.type,
        dateLabel: autoRecord.dateLabel,
        description: autoRecord.description,
        occurrenceAt: new Date(autoRecord.occurrenceAt),
        createdAt: new Date(autoRecord.createdAt)
      })
    }
    markPerf('updated', { intentDelta: trend.intentDelta, riskDelta: trend.riskDelta })

    return {
      success: true,
      assessmentId,
      recordId: triggerEvent.id,
      aiUsed: Boolean(recalculated.aiUsed),
      latestResult: recalculated,
      trend
    }
  } catch (error) {
    markPerf('error', { message: error instanceof Error ? error.message : String(error) })
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('generateAssessmentAI error:', error)
    return { success: false, message: mapError(error) }
  }
}
