'use strict'

const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId } = require('./_shared/auth')
const { normalizeSubjectGender } = require('./_shared/archetype-bank')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()

exports.main = async (event = {}) => {
  try {
    const userId = await requireAuthenticatedUserId(app, event)
    const kind = String(event.kind || '').trim()
    if (!['relation_archetype', 'crush_celebrity', 'dimension_character'].includes(kind)) {
      return { success: false, code: 'INVALID_ARGUMENT', message: 'kind 无效' }
    }
    const resultId = String(event.resultId || '').trim()
    if (resultId) {
      const response = await db.collection('archetype_results').doc(resultId).get().catch(() => null)
      const data = response?.data
      const result = Array.isArray(data) ? data[0] : data
      if (!result || String(result.userId || '') !== userId || result.kind !== kind) {
        return { success: true, results: [] }
      }
      return { success: true, results: [result] }
    }
    const where = { userId, kind }
    if (kind === 'relation_archetype') {
      const subjectGender = normalizeSubjectGender(event.subjectGender)
      if (!['female', 'male'].includes(subjectGender)) {
        return { success: false, code: 'GENDER_REQUIRED', message: '关系主角记录列表必须指定性别' }
      }
      where.subjectGender = subjectGender
    }
    const caseId = String(event.caseId || '').trim()
    const personKey = String(event.personKey || '').trim()
    if (caseId) where.caseId = caseId
    if (personKey && kind === 'relation_archetype') where.personKey = personKey
    const limit = Math.max(1, Math.min(50, Number(event.limit) || 20))
    const response = await db.collection('archetype_results').where(where).orderBy('createdAt', 'desc').limit(limit).get()
    return { success: true, results: Array.isArray(response?.data) ? response.data : [] }
  } catch (cause) {
    const code = cause?.code === 'UNAUTHENTICATED' ? 'AUTH_REQUIRED' : 'LOAD_FAILED'
    return { success: false, code, message: code === 'AUTH_REQUIRED' ? '请先登录' : '读取测试记录失败' }
  }
}
