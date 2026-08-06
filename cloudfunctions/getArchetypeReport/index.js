'use strict'

const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId } = require('./_shared/auth')
const { findBank, FEATURE_RELATION, FEATURE_CELEBRITY, FEATURE_CHARACTER } = require('./_shared/archetype-bank')
const { resolveReportAccess } = require('./_shared/archetype-report-access')
const { buildPreviewReport, buildFullReport } = require('./_shared/archetype-report-projection')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()

function error(code, message) {
  return { success: false, code, message }
}

function featureForKind(kind) {
  if (kind === 'relation_archetype') return FEATURE_RELATION
  if (kind === 'crush_celebrity') return FEATURE_CELEBRITY
  if (kind === 'dimension_character') return FEATURE_CHARACTER
  return ''
}

exports.main = async (event = {}) => {
  try {
    const userId = await requireAuthenticatedUserId(app, event)
    const resultId = String(event.resultId || '').trim()
    if (!resultId) return error('INVALID_ARGUMENT', '缺少 resultId')
    const response = await db.collection('archetype_results').doc(resultId).get().catch(() => null)
    const data = response?.data
    const result = Array.isArray(data) ? data[0] : data
    if (!result || String(result.userId || '') !== userId) return error('RESULT_NOT_FOUND', '测试结果不存在')
    const featureKey = featureForKind(result.kind)
    if (!featureKey) return error('INVALID_RESULT', '测试结果类型无效')
    const bank = await findBank(db, {
      featureKey,
      subjectGender: result.subjectGender,
      contentVersion: result.contentVersion
    })
    if (!bank) return error('CONTENT_NOT_FOUND', '结果对应题库不存在')
    const access = await resolveReportAccess(db, userId, result)
    return {
      success: true,
      report: access.accessLevel === 'full'
        ? buildFullReport(result, bank.content, access)
        : buildPreviewReport(result, bank.content, access)
    }
  } catch (cause) {
    const code = cause?.code === 'UNAUTHENTICATED' ? 'AUTH_REQUIRED' : cause?.code || 'LOAD_FAILED'
    return error(code, code === 'AUTH_REQUIRED' ? '请先登录' : '读取测试报告失败')
  }
}
