'use strict'

const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId } = require('./_shared/auth')
const { checkFeatureAccess } = require('./_shared/subscription')
const { FEATURE_RELATION, FEATURE_CELEBRITY, FEATURE_CHARACTER, normalizeSubjectGender, findBank } = require('./_shared/archetype-bank')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()

function error(code, message) {
  return { success: false, code, message }
}

exports.main = async (event = {}) => {
  try {
    const userId = await requireAuthenticatedUserId(app, event)
    const featureKey = String(event.featureKey || '').trim()
    if (![FEATURE_RELATION, FEATURE_CELEBRITY, FEATURE_CHARACTER].includes(featureKey)) return error('INVALID_ARGUMENT', '未知题库功能')
    const subjectGender = featureKey === FEATURE_RELATION ? normalizeSubjectGender(event.subjectGender) : undefined
    if (featureKey === FEATURE_RELATION && !['female', 'male'].includes(subjectGender)) return error('GENDER_REQUIRED', '请选择被测对象性别')
    const access = await checkFeatureAccess(db, userId, featureKey)
    if (!access?.allowed) return error('FEATURE_NOT_AVAILABLE', '当前套餐未开放此功能')
    const contentVersion = String(event.contentVersion || '').trim()
    const bank = contentVersion
      ? await findBank(db, { featureKey, subjectGender, contentVersion })
      : await findBank(db, { featureKey, subjectGender, status: 'published' })
    if (!bank || (contentVersion ? !['published', 'archived'].includes(bank.status) : bank.status !== 'published')) {
      return error('CONTENT_NOT_PUBLISHED', contentVersion ? '指定题库版本不存在或不可读取' : '题库尚未发布')
    }
    return {
      success: true,
      bank: {
        featureKey: bank.featureKey,
        ...(featureKey === FEATURE_RELATION ? { subjectGender: bank.subjectGender, displayTitle: bank.displayTitle || (bank.subjectGender === 'male' ? '关系男主角' : '关系女主角') } : {}),
        contentVersion: bank.contentVersion,
        checksum: bank.checksum,
        content: bank.content,
        publishedAt: bank.publishedAt || null
      }
    }
  } catch (cause) {
    const code = cause?.code === 'UNAUTHENTICATED' ? 'AUTH_REQUIRED' : cause?.code || 'LOAD_FAILED'
    return error(code, code === 'AUTH_REQUIRED' ? '请先登录' : '读取题库失败')
  }
}
