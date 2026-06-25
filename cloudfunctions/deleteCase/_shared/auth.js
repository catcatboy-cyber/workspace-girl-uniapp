function isMpRuntime() {
  return Boolean(process.env.WX_CONTEXT_KEYS || process.env.TENCENTCLOUD_RUNENV)
}

async function requireAuthenticatedUserId(app, event = {}) {
  const userInfo = await app.auth().getUserInfo()

  const candidates = [
    userInfo?.customUserId,
    userInfo?.uid,
    userInfo?.userInfo?.customUserId,
    userInfo?.userInfo?.uid,
    userInfo?.user?.customUserId,
    userInfo?.user?.uid
  ]

  // In WeChat cloud functions the business user id is carried explicitly.
  // H5 admin-sensitive calls must not trust arbitrary client-provided ids.
  if (isMpRuntime()) {
    candidates.push(event?.userId)
  }

  let userId = ''
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      userId = value.trim()
      break
    }
  }

  if (!userId) {
    const error = new Error('UNAUTHENTICATED')
    error.code = 'UNAUTHENTICATED'
    throw error
  }

  return userId
}

function buildAuthErrorResponse(error) {
  if (error?.code === 'UNAUTHENTICATED' || error?.message === 'UNAUTHENTICATED') {
    return { success: false, message: '请先登录' }
  }

  return null
}

async function getOwnedCase(db, caseId, userId) {
  const caseRes = await db.collection('cases').doc(caseId).get()

  let caseDoc = null
  if (Array.isArray(caseRes?.data)) {
    caseDoc = caseRes.data.length > 0 ? caseRes.data[0] : null
  } else if (caseRes?.data && typeof caseRes.data === 'object') {
    caseDoc = caseRes.data
  }

  if (!caseDoc) {
    return { error: { success: false, message: '档案不存在' } }
  }

  if (caseDoc.userId !== userId) {
    return { error: { success: false, message: '无权访问' } }
  }

  return { caseDoc }
}

module.exports = {
  requireAuthenticatedUserId,
  buildAuthErrorResponse,
  getOwnedCase
}
