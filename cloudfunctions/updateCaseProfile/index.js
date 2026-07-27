const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId, buildAuthErrorResponse, getOwnedCase } = require('./_shared/auth')
const { normalizeCaseProfilePatch } = require('./_shared/case-profile')
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const _ = db.command

exports.main = async (event) => {
  const { caseId, name, profile } = event
  try {
    const userId = await requireAuthenticatedUserId(app, event)
    if (!caseId) return { success: false, message: '缺少档案ID' }

    const { caseDoc, error: caseError } = await getOwnedCase(db, caseId, userId)
    if (caseError) return caseError

    const update = { updatedAt: new Date() }
    if (typeof name === 'string' && name.trim()) {
      update.name = name.trim()
    }
    if (profile && typeof profile === 'object') {
      const patch = normalizeCaseProfilePatch(profile)
      const merged = { ...(caseDoc.profile || {}) }
      for (const k of Object.keys(patch)) {
        merged[k] = patch[k]
      }
      update.profile = merged
    }

    await db.collection('cases').doc(caseId).update(update)
    return { success: true }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('updateCaseProfile error:', error)
    return { success: false, message: '更新档案失败' }
  }
}
