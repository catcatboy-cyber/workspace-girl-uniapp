const cloudbase = require('@cloudbase/node-sdk')
const crypto = require('crypto')
const { isSystemTimelineRecord, compareAssessments, buildTrendTimelineRecords } = require('./_shared/trend')
const { recalculateAssessmentFromEvent } = require('./_shared/event-recalculate')
const { requireAuthenticatedUserId, buildAuthErrorResponse, getOwnedCase } = require('./_shared/auth')

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

function randomHex(n) {
  return crypto.randomBytes(n).toString('hex')
}

function toTime(value) {
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

function toISOStringOrUndefined(value) {
  if (!value) return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

function sortByCreatedAtAsc(list) {
  return list.slice().sort((left, right) => {
    const delta = toTime(left.createdAt) - toTime(right.createdAt)
    if (delta !== 0) return delta
    return toTime(left.occurrenceAt) - toTime(right.occurrenceAt)
  })
}

async function insertSystemTimelineRecords(caseId, autoRecords) {
  for (const autoRecord of autoRecords) {
    await db.collection('timeline_records').add({
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
}

async function restoreCaseSnapshot(snapshot) {
  await db.collection('assessments').where({ caseId: snapshot.caseId }).remove()
  await db.collection('timeline_records').where({ caseId: snapshot.caseId }).remove()

  for (const assessment of snapshot.assessments) {
    await db.collection('assessments').add(assessment)
  }

  for (const record of snapshot.timeline) {
    await db.collection('timeline_records').add(record)
  }

  await db.collection('cases').doc(snapshot.caseId).update({
    latestResultId: snapshot.caseDoc.latestResultId || '',
    updatedAt: snapshot.caseDoc.updatedAt || new Date()
  })
}

exports.main = async (event) => {
  const { caseId, recordId } = event

  try {
    const userId = await requireAuthenticatedUserId(app, event)
    if (!caseId) return { success: false, message: '缺少档案ID' }
    if (!recordId) return { success: false, message: '缺少记录ID' }

    const ownedCase = await getOwnedCase(db, caseId, userId)
    if (ownedCase.error) return ownedCase.error
    const caseDoc = ownedCase.caseDoc

    const assessmentsRes = await db.collection('assessments')
      .where({ caseId })
      .orderBy('createdAt', 'asc')
      .get()
    const timelineRes = await db.collection('timeline_records')
      .where({ caseId })
      .orderBy('createdAt', 'asc')
      .get()

    const snapshot = {
      caseId,
      caseDoc,
      assessments: assessmentsRes.data || [],
      timeline: timelineRes.data || []
    }

    const record = snapshot.timeline.find((item) => item._id === recordId)
    if (!record) {
      return { success: false, message: '记录不存在' }
    }
    if (record.caseId !== caseId) {
      return { success: false, message: '记录不属于该档案' }
    }
    if (isSystemTimelineRecord(record)) {
      return { success: false, message: '系统生成记录不允许删除' }
    }

    const baseAssessments = sortByCreatedAtAsc(
      snapshot.assessments.filter((item) => item.source !== 'event_recalculation')
    )
    if (baseAssessments.length === 0) {
      return { success: false, message: '当前档案缺少基础评估，无法删除该记录' }
    }

    const remainingManualTimeline = sortByCreatedAtAsc(
      snapshot.timeline.filter((item) => !isSystemTimelineRecord(item) && item._id !== recordId)
    )

    const aiSettings = await getAISettings(userId)

    try {
      await db.collection('assessments').where({ caseId }).remove()
      await db.collection('timeline_records').where({ caseId }).remove()

      for (const assessment of baseAssessments) {
        await db.collection('assessments').add(assessment)
      }

      for (const manualRecord of remainingManualTimeline) {
        await db.collection('timeline_records').add(manualRecord)
      }

      let currentResult = baseAssessments[0]
      let assessmentCount = 1

      const operations = [
        ...remainingManualTimeline.map((item) => ({
          kind: 'event',
          createdAt: toTime(item.createdAt),
          item
        })),
        ...baseAssessments.slice(1).map((item) => ({
          kind: 'assessment',
          createdAt: toTime(item.createdAt),
          item
        }))
      ].sort((left, right) => left.createdAt - right.createdAt)

      const processedManualTimeline = []

      for (const operation of operations) {
        const previousResult = currentResult

        if (operation.kind === 'assessment') {
          currentResult = operation.item
          assessmentCount += 1
        } else {
          const manualEvent = operation.item
          const recentTimeline = sortByCreatedAtAsc([...processedManualTimeline, manualEvent])
            .slice(-8)
            .map((item) => ({
              id: item._id || item.id,
              title: item.title,
              type: item.type,
              dateLabel: item.dateLabel || '',
              description: item.description || '',
              occurrenceAt: toISOStringOrUndefined(item.occurrenceAt),
              createdAt: toISOStringOrUndefined(item.createdAt)
            }))

          const nextAssessmentId = `assessment_${Date.now()}_${randomHex(4)}`
          const recalculated = await recalculateAssessmentFromEvent({
            previous: currentResult,
            event: {
              id: manualEvent._id || manualEvent.id,
              title: manualEvent.title,
              type: manualEvent.type,
              dateLabel: manualEvent.dateLabel || '',
              description: manualEvent.description || '',
              occurrenceAt: manualEvent.occurrenceAt,
              createdAt: manualEvent.createdAt
            },
            assessmentId: nextAssessmentId,
            recentTimeline,
            caseProfile: caseDoc.profile,
            aiSettings
          })

          const assessmentDoc = {
            _id: nextAssessmentId,
            caseId,
            ...recalculated
          }
          await db.collection('assessments').add(assessmentDoc)

          currentResult = assessmentDoc
          assessmentCount += 1
          processedManualTimeline.push(manualEvent)
        }

        const trend = compareAssessments(previousResult, currentResult)
        const autoRecords = buildTrendTimelineRecords({
          assessmentIndex: assessmentCount,
          intentBucket: currentResult.intentBucket,
          riskBucket: currentResult.riskBucket,
          evidenceLevel: currentResult.evidenceLevel,
          intentDelta: trend.intentDelta,
          riskDelta: trend.riskDelta,
          warningText: trend.warningText
        })
        await insertSystemTimelineRecords(caseId, autoRecords)
      }

      await db.collection('cases').doc(caseId).update({
        latestResultId: currentResult._id,
        updatedAt: new Date()
      })

      return {
        success: true,
        latestResultId: currentResult._id
      }
    } catch (rebuildError) {
      await restoreCaseSnapshot(snapshot)
      throw rebuildError
    }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('deleteTimeline error:', error)
    return { success: false, message: '删除时间线记录失败' }
  }
}
