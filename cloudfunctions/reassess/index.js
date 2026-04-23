const cloudbase = require('@cloudbase/node-sdk')
const crypto = require('crypto')
const { evaluateAssessment } = require('./_shared/engine')
const { compareAssessments, buildTrendTimelineRecords } = require('./_shared/trend')
const { requireAuthenticatedUserId, buildAuthErrorResponse, getOwnedCase } = require('./_shared/auth')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()

function randomHex(n) {
  return crypto.randomBytes(n).toString('hex')
}

async function rollbackReassessment(params) {
  const { caseId, caseDoc, assessmentId, autoRecordIds } = params

  for (const autoRecordId of autoRecordIds) {
    await db.collection('timeline_records').doc(autoRecordId).remove().catch(() => {})
  }

  if (assessmentId) {
    await db.collection('assessments').doc(assessmentId).remove().catch(() => {})
  }

  if (caseDoc?._id === caseId) {
    await db.collection('cases').doc(caseId).update({
      latestResultId: caseDoc.latestResultId || '',
      updatedAt: caseDoc.updatedAt || new Date()
    }).catch(() => {})
  }
}

exports.main = async (event) => {
  const { caseId, answers, source, triggerEventId, triggerEventTitle } = event
  let caseDoc = null
  let assessmentId = ''
  const autoRecordIds = []

  try {
    const userId = await requireAuthenticatedUserId(app)
    if (!caseId) return { success: false, message: '缺少档案ID' }

    const ownedCase = await getOwnedCase(db, caseId, userId)
    if (ownedCase.error) return ownedCase.error
    caseDoc = ownedCase.caseDoc

    const previousResult = caseDoc.latestResultId
      ? (await db.collection('assessments').doc(caseDoc.latestResultId).get()).data?.[0] || null
      : null

    assessmentId = `assessment_${Date.now()}_${randomHex(4)}`
    const now = new Date()

    const result = evaluateAssessment({
      assessmentId,
      answers: answers || [],
      extractedTextSignals: []
    })

    const doc = {
      _id: assessmentId,
      caseId,
      source: source || 'manual_reassessment',
      createdAt: now,
      ...result
    }
    if (triggerEventId) doc.triggerEventId = triggerEventId
    if (triggerEventTitle) doc.triggerEventTitle = triggerEventTitle

    await db.collection('assessments').add(doc)

    const assessmentsRes = await db.collection('assessments')
      .where({ caseId })
      .orderBy('createdAt', 'asc')
      .get()

    const trend = compareAssessments(previousResult, doc)
    const autoRecords = buildTrendTimelineRecords({
      assessmentIndex: assessmentsRes.data.length,
      intentBucket: doc.intentBucket,
      riskBucket: doc.riskBucket,
      evidenceLevel: doc.evidenceLevel,
      intentDelta: trend.intentDelta,
      riskDelta: trend.riskDelta,
      warningText: trend.warningText
    })

    for (const autoRecord of autoRecords) {
      autoRecordIds.push(autoRecord.id)
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

    await db.collection('cases').doc(caseId).update({
      latestResultId: assessmentId,
      updatedAt: now
    })

    return { success: true, assessmentId }
  } catch (error) {
    if (assessmentId || autoRecordIds.length > 0) {
      await rollbackReassessment({
        caseId,
        caseDoc,
        assessmentId,
        autoRecordIds
      })
    }

    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('reassess error:', error)
    return { success: false, message: '重新评估失败' }
  }
}
