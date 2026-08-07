'use strict'

const crypto = require('node:crypto')
const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId } = require('./_shared/auth')
const { findBank, FEATURE_RELATION, FEATURE_CELEBRITY, FEATURE_CHARACTER } = require('./_shared/archetype-bank')
const { resolveReportAccess } = require('./_shared/archetype-report-access')
const { buildPreviewReport, buildFullReport, buildSharedReportPreview } = require('./_shared/archetype-report-projection')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const RESULTS = 'archetype_results'
const SHARES = 'archetype_result_shares'
const SUPPORTED_KINDS = new Set(['relation_archetype', 'crush_celebrity', 'dimension_character'])

function error(code, message) {
  return { success: false, code, message }
}

function featureForKind(kind) {
  if (kind === 'relation_archetype') return FEATURE_RELATION
  if (kind === 'crush_celebrity') return FEATURE_CELEBRITY
  if (kind === 'dimension_character') return FEATURE_CHARACTER
  return ''
}

function firstDoc(response) {
  const data = response?.data
  return Array.isArray(data) ? data[0] || null : data || null
}

function shareDocId(userId, resultId) {
  return crypto.createHash('sha256').update(`heart-persona-share|${userId}|${resultId}`).digest('hex')
}

function newResultShareId() {
  return `hps_${crypto.randomBytes(24).toString('base64url')}`
}

function validResultShareId(value) {
  return /^hps_[A-Za-z0-9_-]{24,80}$/.test(String(value || '').trim())
}

async function getResult(resultId) {
  return firstDoc(await db.collection(RESULTS).doc(resultId).get().catch(() => null))
}

async function prepareShare(userId, resultId) {
  if (!resultId) return error('INVALID_ARGUMENT', '缺少 resultId')
  const result = await getResult(resultId)
  if (!result || String(result.userId || '') !== userId) return error('RESULT_NOT_FOUND', '测试结果不存在')
  if (!SUPPORTED_KINDS.has(String(result.kind || ''))) return error('INVALID_RESULT', '测试结果类型无效')
  if (typeof db.runTransaction !== 'function') return error('TRANSACTION_UNAVAILABLE', '数据库事务不可用')

  const documentId = shareDocId(userId, resultId)
  const run = () => db.runTransaction(async (transaction) => {
    const current = firstDoc(await transaction.collection(SHARES).doc(documentId).get().catch(() => null))
    if (current?.status === 'active' && validResultShareId(current.resultShareId)) {
      return { resultShareId: current.resultShareId, kind: result.kind }
    }
    const now = new Date()
    const resultShareId = newResultShareId()
    if (current) {
      await transaction.collection(SHARES).doc(documentId).update({
        resultShareId,
        status: 'active',
        kind: result.kind,
        updatedAt: now,
        revokedAt: null,
        revokeReason: ''
      })
    } else {
      await transaction.collection(SHARES).doc(documentId).set({
        resultShareId,
        ownerUserId: userId,
        resultId,
        kind: result.kind,
        status: 'active',
        createdAt: now,
        updatedAt: now,
        revokedAt: null,
        revokeReason: ''
      })
    }
    return { resultShareId, kind: result.kind }
  })

  try {
    return { success: true, data: await run() }
  } catch (cause) {
    const committed = firstDoc(await db.collection(SHARES).doc(documentId).get().catch(() => null))
    if (committed?.status === 'active' && validResultShareId(committed.resultShareId)) {
      return { success: true, data: { resultShareId: committed.resultShareId, kind: result.kind } }
    }
    throw cause
  }
}

async function getSharedPreview(resultShareId) {
  if (!validResultShareId(resultShareId)) return error('SHARE_NOT_FOUND', '分享结果不存在或已失效')
  const share = firstDoc(await db.collection(SHARES).where({ resultShareId, status: 'active' }).limit(1).get().catch(() => null))
  if (!share) return error('SHARE_NOT_FOUND', '分享结果不存在或已失效')
  const result = await getResult(String(share.resultId || ''))
  if (!result || String(result.userId || '') !== String(share.ownerUserId || '') || result.kind !== share.kind) {
    return error('SHARE_NOT_FOUND', '分享结果不存在或已失效')
  }
  const featureKey = featureForKind(result.kind)
  const bank = await findBank(db, { featureKey, subjectGender: result.subjectGender, contentVersion: result.contentVersion })
  if (!bank) return error('CONTENT_NOT_FOUND', '结果对应题库不存在')
  const [owner, access] = await Promise.all([
    db.collection('users').doc(String(share.ownerUserId || '')).get().then(firstDoc).catch(() => null),
    resolveReportAccess(db, String(share.ownerUserId || ''), result)
  ])
  return {
    success: true,
    share: {
      resultShareId,
      ...buildSharedReportPreview(result, bank.content, owner, access)
    }
  }
}

exports.main = async (event = {}) => {
  try {
    const userId = await requireAuthenticatedUserId(app, event)
    const action = String(event.action || 'getOwnedReport').trim()
    if (action === 'prepareShare') return prepareShare(userId, String(event.resultId || '').trim())
    if (action === 'getSharedPreview') return getSharedPreview(String(event.resultShareId || '').trim())
    if (action !== 'getOwnedReport') return error('INVALID_ARGUMENT', 'action 无效')
    const resultId = String(event.resultId || '').trim()
    if (!resultId) return error('INVALID_ARGUMENT', '缺少 resultId')
    const result = await getResult(resultId)
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
