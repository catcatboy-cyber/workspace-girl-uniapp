function isMpRuntime() {
  return Boolean(process.env.WX_CONTEXT_KEYS || process.env.TENCENTCLOUD_RUNENV)
}

function getTrustedOpenId() {
  try {
    const cloud = require('wx-server-sdk')
    const ctx = cloud?.getWXContext ? cloud.getWXContext() : null
    const openid = String(ctx?.OPENID || ctx?.FROM_OPENID || '').trim()
    if (openid) return openid
  } catch (_) {
    // Non-mini-program and test contexts may not package wx-server-sdk.
  }

  return ''
}

async function findUserIdByOpenId(db, openid) {
  if (!openid) return ''
  const { data } = await db.collection('users').where({ openid }).limit(1).get()
  const user = Array.isArray(data) ? data[0] : null
  return String(user?._id || '').trim()
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

  if (isMpRuntime()) {
    const openid = getTrustedOpenId()
    const db = app.database()
    const mappedUserId = await findUserIdByOpenId(db, openid)
    if (mappedUserId) candidates.push(mappedUserId)
  } else {
    candidates.push(event?.authUserId)
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
