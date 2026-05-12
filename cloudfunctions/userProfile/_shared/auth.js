async function requireAuthenticatedUserId(app, event = {}) {
  const userInfo = await app.auth().getUserInfo()

  const candidates = [
    event?.userId,
    userInfo?.customUserId,
    userInfo?.uid,
    userInfo?.userInfo?.customUserId,
    userInfo?.userInfo?.uid,
    userInfo?.user?.customUserId,
    userInfo?.user?.uid
  ]

  let userId = ''
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      userId = value.trim()
      break
    }
  }

  if (!userId) {
    console.warn('requireAuthenticatedUserId failed, userInfo:', JSON.stringify(userInfo))
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

module.exports = {
  requireAuthenticatedUserId,
  buildAuthErrorResponse
}
