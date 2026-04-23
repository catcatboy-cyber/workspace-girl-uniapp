const cloudbase = require('@cloudbase/node-sdk')
const crypto = require('crypto')
const { recalculateAssessmentFromEvent } = require('./_shared/event-recalculate')
const { compareAssessments, buildTrendTimelineRecords } = require('./_shared/trend')
const { buildTimelineRecordTitle, classifyTimelineEvent } = require('./_shared/event-understanding')
const { requireAuthenticatedUserId, buildAuthErrorResponse, getOwnedCase } = require('./_shared/auth')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()

function randomHex(n) {
  return crypto.randomBytes(n).toString('hex')
}

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime())
}

function toISOStringOrUndefined(value) {
  if (!value) return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
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
  const { caseId, description, occurrenceAt, dateLabel } = event
  let transaction = null

  try {
    const userId = await requireAuthenticatedUserId(app)
    if (!caseId) return { success: false, message: '缺少档案ID' }

    const safeDescription = typeof description === 'string' ? description.trim() : ''
    if (!safeDescription) {
      return { success: false, message: '描述不能为空' }
    }

    const ownedCase = await getOwnedCase(db, caseId, userId)
    if (ownedCase.error) return ownedCase.error
    const caseDoc = ownedCase.caseDoc

    if (!caseDoc.latestResultId) {
      return { success: false, message: '当前档案缺少有效评估结果，请先重新评估后再记录时间线' }
    }

    const recordId = `timeline_${Date.now()}_${randomHex(4)}`
    const assessmentId = `assessment_${Date.now()}_${randomHex(4)}`
    const now = new Date()
    const parsedOccurrenceAt = occurrenceAt ? new Date(occurrenceAt) : now
    const occursAt = isValidDate(parsedOccurrenceAt) ? parsedOccurrenceAt : now

    const draftRecord = {
      id: recordId,
      title: buildTimelineRecordTitle(safeDescription) || '关系记录',
      type: classifyTimelineEvent(safeDescription),
      dateLabel: dateLabel || '',
      description: safeDescription,
      occurrenceAt: occursAt,
      createdAt: now
    }

    const latestResultRes = await db.collection('assessments').doc(caseDoc.latestResultId).get()
    const previous = latestResultRes.data && latestResultRes.data.length > 0 ? latestResultRes.data[0] : null
    if (!previous) {
      throw new Error('LATEST_RESULT_NOT_FOUND')
    }

    const { data: timelineItems } = await db.collection('timeline_records')
      .where({ caseId })
      .orderBy('occurrenceAt', 'desc')
      .get()

    const recentTimeline = (timelineItems || [])
      .filter((item) => item.type !== 'assessment' && item.type !== 'trend')
      .map((item) => ({
        id: item._id || item.id,
        title: item.title,
        type: item.type,
        dateLabel: item.dateLabel || '',
        description: item.description || '',
        occurrenceAt: toISOStringOrUndefined(item.occurrenceAt),
        createdAt: toISOStringOrUndefined(item.createdAt)
      }))
    recentTimeline.unshift({
      id: draftRecord.id,
      title: draftRecord.title,
      type: draftRecord.type,
      dateLabel: draftRecord.dateLabel,
      description: draftRecord.description,
      occurrenceAt: toISOStringOrUndefined(draftRecord.occurrenceAt),
      createdAt: toISOStringOrUndefined(draftRecord.createdAt)
    })
    const trimmedRecentTimeline = recentTimeline
      .slice(0, 8)

    const settingsRes = await db.collection('system_settings')
      .where({ userId })
      .limit(1)
      .get()
    const aiSettings = settingsRes.data && settingsRes.data.length > 0 ? settingsRes.data[0] : null

    const recalculated = await recalculateAssessmentFromEvent({
      previous,
      event: draftRecord,
      assessmentId,
      recentTimeline: trimmedRecentTimeline,
      caseProfile: caseDoc.profile,
      aiSettings
    })

    const aiUsed = recalculated.explanation?.headline?.startsWith('AI 研判后：') || false
    const finalRecord = {
      ...draftRecord,
      title: recalculated.triggerEventTitle || draftRecord.title,
      type: recalculated.triggerEventType || draftRecord.type
    }

    // 预计算趋势记录（在事务外完成）
    const { data: assessments } = await db.collection('assessments')
      .where({ caseId })
      .orderBy('createdAt', 'asc')
      .get()

    const trend = compareAssessments(previous, recalculated)
    const autoRecords = buildTrendTimelineRecords({
      assessmentIndex: assessments.length + 1, // +1 因为新评估还未写入
      intentBucket: recalculated.intentBucket,
      riskBucket: recalculated.riskBucket,
      evidenceLevel: recalculated.evidenceLevel,
      intentDelta: trend.intentDelta,
      riskDelta: trend.riskDelta,
      warningText: trend.warningText
    })

    // 开启事务，仅用于数据库写入
    transaction = await db.startTransaction()

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
      dateLabel: finalRecord.dateLabel,
      description: finalRecord.description,
      occurrenceAt: finalRecord.occurrenceAt,
      createdAt: finalRecord.createdAt
    })

    await transaction.collection('assessments').add({
      _id: assessmentId,
      caseId,
      ...recalculated
    })

    for (const autoRecord of autoRecords) {
      await transaction.collection('timeline_records').add({
        _id: autoRecord.id,
        caseId,
        title: autoRecord.title,
        type: autoRecord.type,
        dateLabel: autoRecord.dateLabel,
        description: autoRecord.description,
        occurrenceAt: new Date(autoRecord.occurrenceAt),
        createdAt: new Date(autoRecord.createdAt)
      })
    }

    await transaction.collection('cases').doc(caseId).update({
      updatedAt: now,
      latestResultId: assessmentId
    })

    await transaction.commit()
    transaction = null

    return {
      success: true,
      recordId,
      assessmentId,
      aiUsed,
      eventType: finalRecord.type,
      eventTitle: finalRecord.title
    }
  } catch (error) {
    if (transaction) {
      await transaction.rollback().catch(() => {})
    }

    const authError = buildAuthErrorResponse(error)
    if (authError) return authError

    console.error('createTimeline error:', error)
    return { success: false, message: mapCreateTimelineError(error) }
  }
}
