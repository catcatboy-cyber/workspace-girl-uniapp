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
  if (isMpRuntime()) {
    candidates.push(event?.userId)
  }
  if (typeof event?.userId === 'string' && event.userId.trim()) candidates.push(event.userId)
  if (typeof event?.authUserId === 'string' && event.authUserId.trim()) candidates.push(event.authUserId)
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  const error = new Error('UNAUTHENTICATED')
  error.code = 'UNAUTHENTICATED'
  throw error
}

function buildAuthErrorResponse(error) {
  if (error?.code === 'UNAUTHENTICATED' || error?.message === 'UNAUTHENTICATED') {
    return { success: false, message: '请先登录' }
  }
  return null
}

module.exports = {
  requireAuthenticatedUserId,
  buildAuthErrorResponse
}
