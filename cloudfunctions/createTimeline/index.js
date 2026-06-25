const cloudbase = require('@cloudbase/node-sdk')
const crypto = require('crypto')
const { buildTimelineRecordTitle, classifyTimelineEvent, inferTimelineRecord } = require('./_shared/event-understanding')
const { requireAuthenticatedUserId, buildAuthErrorResponse, getOwnedCase } = require('./_shared/auth')
const { checkFeatureAccess, finalizePendingReferral } = require('./_shared/subscription')
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const GLOBAL_AI_SETTINGS_ID = 'settings_global_ai'

function normalizeDoc(res) {
  if (Array.isArray(res?.data)) return res.data[0] || null
  return res?.data || null
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

function randomHex(n) {
  return crypto.randomBytes(n).toString('hex')
}

function shortId(value) {
  const text = String(value || '')
  return text ? text.slice(-10) : ''
}

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime())
}

function toISOStringOrUndefined(value) {
  if (!value) return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

function normalizeSubjectRole(value) {
  return ['target', 'self', 'both', 'unknown'].includes(value) ? value : 'target'
}

function normalizeSubjectRoleConfidence(value) {
  return ['user_selected', 'confirmed'].includes(value) ? value : 'user_selected'
}

function buildBaselineAssessment() {
  return {
    assessmentId: '',
    source: 'baseline_profile_only',
    version: 'v0.1',
    intentScore: 50,
    intentBucket: 'medium',
    consistencyRiskScore: 50,
    riskBucket: 'medium',
    evidenceLevel: 'E1',
    confidenceLevel: 'low',
    primaryLabels: ['证据不足'],
    nextAction: 'observe',
    signalSummary: {
      initiative: 0,
      investment: 0,
      progression: 0,
      consistency: 0,
      avoidance: 0,
      verifiability: 0,
      instability: 0,
      evidence_strength: 0
    },
    explanation: {
      headline: '先从第一条真实互动开始判断。',
      bullets: [],
      cautions: ['当前档案还没有初评结果，本次记录会作为第一条分析依据。']
    }
  }
}

function sanitizeAttachment(item) {
  if (!item || typeof item !== 'object') return null
  const type = ['image', 'audio'].includes(item.type) ? item.type : ''
  const fileID = typeof item.fileID === 'string' ? item.fileID.trim() : ''
  if (!type || !fileID) return null

  const analysis = item.analysis && typeof item.analysis === 'object'
    ? {
        isChatRecord: Boolean(item.analysis.isChatRecord),
        extractedText: typeof item.analysis.extractedText === 'string' ? item.analysis.extractedText.slice(0, 4000) : '',
        suggestedTitle: typeof item.analysis.suggestedTitle === 'string' ? item.analysis.suggestedTitle.slice(0, 30) : '',
        summary: typeof item.analysis.summary === 'string' ? item.analysis.summary.slice(0, 500) : '',
        confidence: ['low', 'medium', 'high'].includes(item.analysis.confidence) ? item.analysis.confidence : 'medium'
      }
    : undefined

  const attachment = {
    type,
    fileID,
    name: typeof item.name === 'string' ? item.name.slice(0, 80) : '',
    size: Number.isFinite(Number(item.size)) ? Number(item.size) : 0
  }
  if (Number.isFinite(Number(item.duration))) attachment.duration = Number(item.duration)
  if (analysis) attachment.analysis = analysis
  return attachment
}

function sanitizeAttachments(value) {
  if (!Array.isArray(value)) return []
  return value
    .slice(0, 6)
    .map(sanitizeAttachment)
    .filter(Boolean)
}

function sanitizeUserQuestion(value) {
  const allowed = {
    like: '他喜欢我吗',
    initiative: '我该不该主动',
    fishing: '他是不是在养鱼',
    reply: '这句话怎么回',
    advance: '现在怎么推进',
    overthinking: '我是不是想多了'
  }
  const source = value && typeof value === 'object' ? value : {}
  const key = typeof source.key === 'string' ? source.key.trim() : ''
  if (allowed[key]) return { key, label: allowed[key] }
  if (key === 'custom') {
    const label = String(source.label || '').replace(/\s+/g, ' ').trim().slice(0, 40)
    if (label) return { key: 'custom', label }
  }
  return { key: 'like', label: allowed.like }
}

function mapCreateTimelineError(error) {
  if (error?.message === 'LATEST_RESULT_REQUIRED' || error?.message === 'LATEST_RESULT_NOT_FOUND') {
    return '当前档案缺少有效评估结果，请先重新评估后再记录时间线'
  }

  if (error?.message === 'STALE_CASE_VERSION') {
    return '档案刚刚被其他操作更新，请刷新后重试'
  }

  return '保存失败，评估未完成，请重试'
}

exports.main = async (event) => {
  const { caseId, description, occurrenceAt, dateLabel, subjectRole, subjectRoleConfidence } = event
  let transaction = null
  const perfStart = Date.now()
  const traceId = `ct_${perfStart}_${randomHex(3)}`
  const markPerf = (stage, extra = {}) => {
    console.log('[createTimeline perf]', JSON.stringify({
      traceId,
      stage,
      elapsedMs: Date.now() - perfStart,
      ...extra
    }))
  }

  try {
    markPerf('start')
    const userId = await requireAuthenticatedUserId(app, event)
    markPerf('auth_ok')
    if (!caseId) return { success: false, message: '缺少档案ID' }

    const safeDescription = typeof description === 'string' ? description.trim() : ''
    if (!safeDescription) {
      return { success: false, message: '描述不能为空' }
    }

    const timelineAccess = await checkFeatureAccess(db, userId, '时间轴')
    if (!timelineAccess.allowed) {
      return {
        success: false,
        code: 'FEATURE_NOT_AVAILABLE',
        message: timelineAccess.reason || '当前套餐不支持时间轴功能'
      }
    }

    const ownedCase = await getOwnedCase(db, caseId, userId)
    if (ownedCase.error) return ownedCase.error
    const caseDoc = ownedCase.caseDoc
    markPerf('case_loaded')

    const recordId = `timeline_${Date.now()}_${randomHex(4)}`
    const assessmentId = `assessment_${Date.now()}_${randomHex(4)}`
    const now = new Date()
    const parsedOccurrenceAt = occurrenceAt ? new Date(occurrenceAt) : now
    const occursAt = isValidDate(parsedOccurrenceAt) ? parsedOccurrenceAt : now
    const safeSubjectRole = normalizeSubjectRole(subjectRole)
    const safeSubjectRoleConfidence = normalizeSubjectRoleConfidence(subjectRoleConfidence)
    const safeUserQuestion = sanitizeUserQuestion(event.userQuestion)
    const safeAttachments = sanitizeAttachments(event.attachments)

    const draftRecord = {
      id: recordId,
      title: buildTimelineRecordTitle(safeDescription) || '关系记录',
      type: classifyTimelineEvent(safeDescription),
      subjectRole: safeSubjectRole,
      subjectRoleConfidence: safeSubjectRoleConfidence,
      userQuestion: safeUserQuestion,
      dateLabel: dateLabel || '',
      description: safeDescription,
      attachments: safeAttachments,
      occurrenceAt: occursAt,
      createdAt: now
    }

    let previous = null
    if (caseDoc.latestResultId) {
      const latestResultRes = await db.collection('assessments').doc(caseDoc.latestResultId).get()
      previous = latestResultRes.data && latestResultRes.data.length > 0 ? latestResultRes.data[0] : null
    }
    if (!previous) {
      const fallbackRes = await db.collection('assessments')
        .where({ caseId })
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get()
      previous = fallbackRes.data && fallbackRes.data.length > 0 ? fallbackRes.data[0] : null
      if (previous) {
        console.warn('latestResultId missing, fallback to latest assessment:', caseDoc.latestResultId, previous._id || previous.assessmentId)
      }
    }
    if (!previous) {
      previous = buildBaselineAssessment()
    }
    markPerf('previous_assessment_loaded')

    const { data: timelineItems } = await db.collection('timeline_records')
      .where({ caseId })
      .orderBy('occurrenceAt', 'desc')
      .get()
    markPerf('timeline_loaded', { count: Array.isArray(timelineItems) ? timelineItems.length : 0 })

    const recentTimeline = (timelineItems || [])
      .filter((item) => item.type !== 'assessment' && item.type !== 'trend')
      .map((item) => ({
        id: item._id || item.id,
        title: item.title,
        type: item.type,
        subjectRole: normalizeSubjectRole(item.subjectRole),
        subjectRoleConfidence: normalizeSubjectRoleConfidence(item.subjectRoleConfidence),
        userQuestion: sanitizeUserQuestion(item.userQuestion),
        dateLabel: item.dateLabel || '',
        description: item.description || '',
        occurrenceAt: toISOStringOrUndefined(item.occurrenceAt),
        createdAt: toISOStringOrUndefined(item.createdAt)
      }))
    recentTimeline.unshift({
      id: draftRecord.id,
      title: draftRecord.title,
      type: draftRecord.type,
      subjectRole: draftRecord.subjectRole,
      subjectRoleConfidence: draftRecord.subjectRoleConfidence,
      userQuestion: draftRecord.userQuestion,
      dateLabel: draftRecord.dateLabel,
      description: draftRecord.description,
      occurrenceAt: toISOStringOrUndefined(draftRecord.occurrenceAt),
      createdAt: toISOStringOrUndefined(draftRecord.createdAt)
    })
    const trimmedRecentTimeline = recentTimeline
      .slice(0, 8)

    const understoodEvent = await inferTimelineRecord({
      description: safeDescription,
      subjectRole: draftRecord.subjectRole,
      recentTimeline: trimmedRecentTimeline,
      caseProfile: caseDoc.profile,
      settings: { aiEnabled: false, aiFallbackToRules: true }
    })
    markPerf('event_understood', { usedAI: Boolean(understoodEvent.usedAI) })
    const understoodRecord = {
      ...draftRecord,
      title: understoodEvent.eventTitle || draftRecord.title,
      type: understoodEvent.eventType || draftRecord.type,
      semanticTags: understoodEvent.semanticTags,
      eventUnderstanding: {
        summary: understoodEvent.summary || '',
        usedAI: Boolean(understoodEvent.usedAI)
      }
    }
    trimmedRecentTimeline[0] = {
      ...trimmedRecentTimeline[0],
      title: understoodRecord.title,
      type: understoodRecord.type,
      semanticTags: understoodRecord.semanticTags
    }

    const aiUsed = false
    const finalRecord = understoodRecord

    const {
      _id: _previousDocId,
      caseId: _previousCaseId,
      ...previousSnapshot
    } = previous

    const pendingAssessment = {
      ...previousSnapshot,
      assessmentId,
      createdAt: now,
      source: 'ai_pending',
      triggerEventId: recordId,
      triggerEventTitle: finalRecord.title,
      triggerEventType: finalRecord.type,
      userQuestion: finalRecord.userQuestion,
      rawReply: '',
      actionAdvice: null,
      eventInsight: null,
      sideReadAdvice: null,
      currentStatus: null,
      aiUsed: false,
      aiPending: true,
      aiFailed: false,
      previousAssessmentId: previous._id || previous.assessmentId || caseDoc.latestResultId,
      explanation: {
        headline: 'AI 正在分析这次记录。',
        bullets: [],
        cautions: ['后台正在生成即时反馈，完成后会自动更新。']
      }
    }

    // 开启事务，仅用于数据库写入
    transaction = await db.startTransaction()
    markPerf('transaction_started')

    // 事务内验证 case 归属和版本
    const transactionalCase = await getOwnedCase(transaction, caseId, userId)
    if (transactionalCase.error) throw new Error(transactionalCase.error.message || 'CASE_ACCESS_DENIED')
    if (transactionalCase.caseDoc.latestResultId !== caseDoc.latestResultId) {
      throw new Error('STALE_CASE_VERSION')
    }

    // 事务内写入所有数据
    await transaction.collection('timeline_records').add({
      _id: recordId,
      caseId,
      title: finalRecord.title,
      type: finalRecord.type,
      subjectRole: finalRecord.subjectRole,
      subjectRoleConfidence: finalRecord.subjectRoleConfidence,
      userQuestion: finalRecord.userQuestion,
      dateLabel: finalRecord.dateLabel,
      description: finalRecord.description,
      attachments: finalRecord.attachments,
      semanticTags: finalRecord.semanticTags,
      eventUnderstanding: finalRecord.eventUnderstanding,
      occurrenceAt: finalRecord.occurrenceAt,
      createdAt: finalRecord.createdAt,
      aiUsed
    })

    await transaction.collection('assessments').add({
      ...pendingAssessment,
      _id: assessmentId,
      caseId
    })

    await transaction.collection('cases').doc(caseId).update({
      updatedAt: now,
      latestResultId: assessmentId
    })

    await transaction.commit()
    transaction = null
    markPerf('committed')

    try {
      await finalizePendingReferral(db, userId)
    } catch (err) {
      console.warn('finalizePendingReferral failed (non-fatal):', err?.message || err)
    }

    console.log('[createTimeline trace]', JSON.stringify({
      traceId,
      stage: 'return_pending',
      userIdTail: shortId(userId),
      caseIdTail: shortId(caseId),
      recordIdTail: shortId(recordId),
      assessmentIdTail: shortId(assessmentId),
      aiPending: true,
      aiUsed,
      eventType: finalRecord.type
    }))

    return {
      success: true,
      recordId,
      assessmentId,
      aiUsed,
      aiPending: true,
      subjectRole: finalRecord.subjectRole,
      subjectRoleConfidence: finalRecord.subjectRoleConfidence,
      userQuestion: finalRecord.userQuestion,
      eventType: finalRecord.type,
      eventTitle: finalRecord.title
    }
  } catch (error) {
    markPerf('error', { message: error instanceof Error ? error.message : String(error) })
    if (transaction) {
      await transaction.rollback().catch(() => {})
    }

    const authError = buildAuthErrorResponse(error)
    if (authError) return authError

    console.error('createTimeline error:', error)
    return { success: false, message: mapCreateTimelineError(error) }
  }
}
