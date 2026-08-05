'use strict'

const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId } = require('./_shared/auth')
const { checkFeatureAccess } = require('./_shared/subscription')
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
    const access = await checkFeatureAccess(db, userId, featureKey)
    if (!access?.allowed) return error('FEATURE_NOT_AVAILABLE', '当前套餐未开放此功能')
    const caseId = String(event.caseId || '').trim()
    if (mode === 'self' && caseId) return error('INVALID_ARGUMENT', 'self 模式不得提交 caseId')
    if (mode === 'target' && !caseId) return error('CASE_NOT_FOUND', '请先选择当前 Crush')
    const caseDoc = mode === 'target' ? await requireOwnedCase(caseId, userId) : null
    if (mode === 'target' && !caseDoc) return error('CASE_NOT_FOUND', 'Crush 不存在或无权访问')

    let subjectGender
    if (kind === 'relation_archetype') {
      const claimedGender = normalizeSubjectGender(event.subjectGender)
      if (!['female', 'male'].includes(claimedGender)) return error('GENDER_REQUIRED', '请选择本次要测的关系主角性别')
      const userDoc = mode === 'self' ? await getUser(userId) : null
      const profileGender = normalizeSubjectGender(mode === 'self' ? userDoc?.selfProfile?.gender : caseDoc?.profile?.gender)
      if (profileGender !== 'unknown' && profileGender !== claimedGender) {
        return error('GENDER_MISMATCH', '被测对象性别与所选题库不一致')
      }
      subjectGender = profileGender === 'unknown' ? claimedGender : profileGender
    } else {
      const userDoc = mode === 'self' ? await getUser(userId) : null
      subjectGender = normalizeSubjectGender(mode === 'self' ? userDoc?.selfProfile?.gender : caseDoc?.profile?.gender)
      if (!['female', 'male'].includes(subjectGender)) return error('PROFILE_GENDER_REQUIRED', mode === 'self' ? '请先补全自己的画像性别再来测' : '请先补全当前 Crush 画像中的性别信息再来测')
    }

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
      ...(mode === 'target' ? {
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
      createdAt: now,
      updatedAt: now
    }
    const saved = await db.collection(RESULTS).add(result)
    result._id = saved?.id || saved?._id || ''
    return { success: true, result }
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
