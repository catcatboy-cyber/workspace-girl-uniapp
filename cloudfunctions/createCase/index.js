const cloudbase = require('@cloudbase/node-sdk')
const crypto = require('crypto')
const { evaluateAssessment } = require('./_shared/engine')
const { requireAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const _ = db.command

function randomHex(n) {
  return crypto.randomBytes(n).toString('hex')
}

exports.main = async (event) => {
  const { name, answers, profile } = event
  try {
    const userId = await requireAuthenticatedUserId(app, event)
    if (!name || typeof name !== 'string' || !name.trim()) {
      return { success: false, message: '名称不能为空' }
    }

    const caseId = `case_${Date.now()}_${randomHex(4)}`
    const assessmentId = `assessment_${Date.now()}_${randomHex(4)}`
    const now = new Date()

    const result = evaluateAssessment({
      assessmentId,
      answers: answers || [],
      extractedTextSignals: []
    })

    await db.collection('assessments').add({
      _id: assessmentId,
      caseId,
      source: 'initial_questionnaire',
      createdAt: now,
      ...result
    })

    await db.collection('cases').add({
      _id: caseId,
      userId,
      name: name.trim(),
      profile: profile || {},
      createdAt: now,
      updatedAt: now,
      latestResultId: assessmentId
    })

    return { success: true, caseId, assessmentId }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('createCase error:', error)
    return { success: false, message: '创建档案失败' }
  }
}
