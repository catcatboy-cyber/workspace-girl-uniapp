const { requireAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')

async function requireVerifiedAuthenticatedUserId(app) {
  // Deliberately omit the event so client-supplied authUserId is never trusted.
  return requireAuthenticatedUserId(app)
}

function buildCustomPetAuthErrorResponse(error) {
  const response = buildAuthErrorResponse(error)
  if (!response) return null
  return { ...response, code: response.code || 'UNAUTHORIZED' }
}

module.exports = {
  requireVerifiedAuthenticatedUserId,
  buildAuthErrorResponse: buildCustomPetAuthErrorResponse
}
