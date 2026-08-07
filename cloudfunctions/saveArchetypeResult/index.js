'use strict'

const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId } = require('./_shared/auth')
const { resolveQuizAccess } = require('./_shared/archetype-report-access')
const {
  FEATURE_RELATION,
  FEATURE_CELEBRITY,
  FEATURE_CHARACTER,
  normalizeSubjectGender,
  findBank,
  checksumContent
} = require('./_shared/archetype-bank')
const { scoreRelationArchetype } = require('./_shared/relation-archetype-score')
const { scoreCrushCelebrity } = require('./_shared/crush-celebrity-score')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const RESULTS = 'archetype_results'
const SHARES = 'archetype_result_shares'

function error(code, message, extras = {}) {
  return { success: false, code, message, ...extras }
}

async function requireOwnedCase(caseId, userId) {
  if (!caseId) return null
  const result = await db.collection('cases').doc(caseId).get().catch(() => null)
  const data = result?.data
  const doc = Array.isArray(data) ? data[0] : data
  if (!doc || String(doc.userId || '') !== userId) return null
  return doc
}

async function getUser(userId) {
  const result = await db.collection('users').doc(userId).get().catch(() => null)
  const data = result?.data
  return Array.isArray(data) ? data[0] || null : data || null
}

function firstDoc(response) {
  const data = response?.data
  return Array.isArray(data) ? data[0] || null : data || null
}

function validResultShareId(value) {
  return /^hps_[A-Za-z0-9_-]{24,80}$/.test(String(value || '').trim())
}

async function requireActiveShare(resultShareId, kind) {
  if (!validResultShareId(resultShareId)) return { status: 'missing' }
  const share = firstDoc(await db.collection(SHARES).where({ resultShareId, status: 'active' }).limit(1).get().catch(() => null))
  if (!share) return { status: 'missing' }
  if (String(share.kind || '') !== kind) return { status: 'kind_mismatch' }
  const source = firstDoc(await db.collection(RESULTS).doc(String(share.resultId || '')).get().catch(() => null))
  if (!source || String(source.userId || '') !== String(share.ownerUserId || '') || source.kind !== kind) return { status: 'missing' }
  return { status: 'active', share, source }
}

exports.main = async (event = {}) => {
  try {
    const userId = await requireAuthenticatedUserId(app, event)
    const kind = String(event.kind || '').trim()
    const featureKey = kind === 'relation_archetype'
      ? FEATURE_RELATION
      : kind === 'crush_celebrity'
        ? FEATURE_CELEBRITY
        : kind === 'dimension_character'
          ? FEATURE_CHARACTER
        : ''
    if (!featureKey) return error('INVALID_ARGUMENT', 'kind 无效')
    const mode = event.mode === 'self' ? 'self' : event.mode === 'target' ? 'target' : ''
    if (!mode) return error('INVALID_ARGUMENT', 'mode 无效')
    const entryMode = event.entryMode === 'share_quick' ? 'share_quick' : 'standard'
    const caseId = String(event.caseId || '').trim()
    const resultShareId = String(event.resultShareId || '').trim()
    let sourceShare = null
    if (entryMode === 'share_quick') {
      if (caseId) return error('QUICK_CASE_FORBIDDEN', '分享快速测试不得提交 caseId')
      sourceShare = await requireActiveShare(resultShareId, kind)
      if (sourceShare.status === 'kind_mismatch') return error('SHARE_KIND_MISMATCH', '分享来源与测试类型不一致')
      if (sourceShare.status !== 'active') return error('SHARE_NOT_FOUND', '分享结果不存在或已失效')
    } else {
      if (mode === 'self' && caseId) return error('INVALID_ARGUMENT', 'self 模式不得提交 caseId')
      if (mode === 'target' && !caseId) return error('CASE_NOT_FOUND', '请先选择当前 Crush')
    }
    const caseDoc = entryMode === 'standard' && mode === 'target' ? await requireOwnedCase(caseId, userId) : null
    if (entryMode === 'standard' && mode === 'target' && !caseDoc) return error('CASE_NOT_FOUND', 'Crush 不存在或无权访问')

    let subjectGender
    if (entryMode === 'share_quick') {
      subjectGender = normalizeSubjectGender(event.subjectGender)
      if (!['female', 'male'].includes(subjectGender)) return error('GENDER_REQUIRED', '请选择本次测试对象的性别')
    } else if (kind === 'relation_archetype') {
      const claimedGender = normalizeSubjectGender(event.subjectGender)
      if (!['female', 'male'].includes(claimedGender)) return error('GENDER_REQUIRED', '请选择本次要测的关系主角性别')
      const userDoc = mode === 'self' ? await getUser(userId) : null
      const profileGender = normalizeSubjectGender(mode === 'self' ? userDoc?.selfProfile?.gender : caseDoc?.profile?.gender)
      if (!['female', 'male'].includes(profileGender)) {
        return error('PROFILE_GENDER_REQUIRED', mode === 'self' ? '请先补全自己的画像性别信息再来测' : '请先补全当前 Crush 画像中的性别信息再来测')
      }
      if (profileGender !== 'unknown' && profileGender !== claimedGender) {
        return error('GENDER_MISMATCH', '被测对象性别与所选题库不一致')
      }
      subjectGender = profileGender
    } else {
      const userDoc = mode === 'self' ? await getUser(userId) : null
      subjectGender = normalizeSubjectGender(mode === 'self' ? userDoc?.selfProfile?.gender : caseDoc?.profile?.gender)
      if (!['female', 'male'].includes(subjectGender)) return error('PROFILE_GENDER_REQUIRED', mode === 'self' ? '请先补全自己的画像性别再来测' : '请先补全当前 Crush 画像中的性别信息再来测')
    }

    const access = await resolveQuizAccess(db, userId, kind, subjectGender)
    if (!access?.allowed) return error('FEATURE_NOT_AVAILABLE', '当前套餐未开放此功能')

    const contentVersion = String(event.contentVersion || '').trim()
    if (!contentVersion) return error('INVALID_ARGUMENT', '缺少 contentVersion')
    const bank = await findBank(db, { featureKey, subjectGender, contentVersion })
    if (!bank || bank.status !== 'published') return error('CONTENT_VERSION_MISMATCH', '题库版本不存在或未发布')
    if (bank.checksum !== checksumContent(bank.content)) return error('CONTENT_VERSION_MISMATCH', '题库校验失败')

    const calculated = kind === 'relation_archetype'
      ? scoreRelationArchetype(bank.content, {
          mode,
          stageKey: event.stageKey,
          personKey: event.personKey,
          answers: event.answers,
          scenarioAnswers: event.scenarioAnswers
        })
      : scoreCrushCelebrity(bank.content, { mode, subjectGender, answers: event.answers })

    const relationArchetype = kind === 'relation_archetype'
      ? bank.content?.archetypes?.find((item) => item.key === calculated.personKey)
      : null

    const now = new Date()
    const result = {
      userId,
      kind,
      subjectGender,
      mode,
      entryMode,
      ...(entryMode === 'share_quick' ? {
        sourceResultShareId: resultShareId,
        sourceResultId: sourceShare.source._id || sourceShare.share.resultId,
        subjectType: mode === 'target' ? 'temporary_target' : 'self',
        subjectLabel: mode === 'target' ? 'TA' : '你'
      } : {}),
      ...(entryMode === 'standard' && mode === 'target' ? {
        caseId,
        caseSnapshot: {
          name: caseDoc?.profile?.nickname || caseDoc?.profile?.name || caseDoc?.name || '当前 Crush',
          avatar: caseDoc?.profile?.avatar || ''
        }
      } : {}),
      ...(kind === 'relation_archetype' ? {
        stageKey: String(event.stageKey || ''),
        personSnapshot: relationArchetype ? {
          key: relationArchetype.key,
          name: relationArchetype.name,
          label: relationArchetype.label || ''
        } : undefined,
        algorithmVersion: 'relation-archetype-v2'
      } : {
        algorithmVersion: kind === 'dimension_character' ? 'dimension-character-v1' : 'crush-celebrity-v2'
      }),
      ...calculated,
      contentVersion,
      reportAccess: {
        purchaseState: 'locked',
        purchaseOrderId: null,
        purchasedAt: null,
        revokedAt: null,
        revokeReason: ''
      },
      createdAt: now,
      updatedAt: now
    }
    const saved = await db.collection(RESULTS).add(result)
    const resultId = saved?.id || saved?._id || ''
    return { success: true, resultId, kind }
  } catch (cause) {
    const code = cause?.code === 'UNAUTHENTICATED' ? 'AUTH_REQUIRED' : cause?.code || 'SAVE_FAILED'
    const known = {
      AUTH_REQUIRED: '请先登录',
      INVALID_ARGUMENT: cause?.message || '提交内容无效',
      INSUFFICIENT_OBSERVATION: cause?.message || '观察信息不足'
      ,PROFILE_GENDER_REQUIRED: cause?.message || '请先补全画像性别'
    }
    return error(code, known[code] || '保存测试结果失败')
  }
}
