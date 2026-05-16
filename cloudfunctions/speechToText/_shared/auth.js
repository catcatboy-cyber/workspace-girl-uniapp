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
