const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId, buildAuthErrorResponse, getOwnedCase } = require('./_shared/auth')
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()

exports.main = async (event) => {
  const { caseId } = event
  // let transaction = null
  try {
    const userId = await requireAuthenticatedUserId(app)
    if (!caseId) return { success: false, message: '缺少档案ID' }

    // 先验证权限（事务外）
    const { error: caseError } = await getOwnedCase(db, caseId, userId)
    if (caseError) return caseError

    // 禁用事务以避免超时，改为普通删除
    const assessmentsRes = await db.collection('assessments')
      .where({ caseId })
      .get()
    const timelineRes = await db.collection('timeline_records')
      .where({ caseId })
      .get()

    for (const assessment of assessmentsRes.data || []) {
      await db.collection('assessments').doc(assessment._id).remove()
    }

    for (const record of timelineRes.data || []) {
      await db.collection('timeline_records').doc(record._id).remove()
    }

    await db.collection('cases').doc(caseId).remove()

    return { success: true }
  } catch (error) {
    // if (transaction) {
    //   await transaction.rollback().catch(() => {})
    // }

    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('deleteCase error:', error)
    return { success: false, message: '删除档案失败' }
  }
}
