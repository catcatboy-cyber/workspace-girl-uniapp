const crypto = require('crypto')
const cloudbase = require('@cloudbase/node-sdk')
const { requestImageSafetyCheck } = require('./_shared/content-security')
const { requireAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')
const { storeAvatarSecurityProof } = require('./_shared/avatar-security')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const CHECK_COLLECTION = 'content_security_checks'
const PENDING_TTL_MS = 30 * 60 * 1000
const RESULT_TTL_MS = 24 * 60 * 60 * 1000
const ALLOWED_SCENES = new Set(['image', 'avatar', 'timeline', 'custom_pet'])
let checkCollectionReady = false

async function ensureCheckCollection() {
  if (checkCollectionReady) return
  try {
    await db.createCollection(CHECK_COLLECTION)
  } catch (error) {
    const message = String(error?.message || '').toLowerCase()
    if (!message.includes('already') && !message.includes('exist') && error?.code !== 'DATABASE_COLLECTION_ALREADY_EXISTS') {
      throw error
    }
  }
  checkCollectionReady = true
}

function getDocumentData(result) {
  if (Array.isArray(result?.data)) return result.data[0] || null
  return result?.data || null
}

function createCheckId(userId, fileID) {
  return crypto.createHash('sha256')
    .update(`${String(userId || '').trim()}\n${String(fileID || '').trim()}`)
    .digest('hex')
    .slice(0, 48)
}

function resolveScene(fileID, requestedScene) {
  const requested = String(requestedScene || '').trim()
  if (ALLOWED_SCENES.has(requested)) return requested
  return /(?:^|\/)avatars\//.test(String(fileID || '')) ? 'avatar' : 'image'
}

async function getUser(userId) {
  const result = await db.collection('users').doc(userId).get()
  return getDocumentData(result)
}

async function getCheck(checkId) {
  try {
    const result = await db.collection(CHECK_COLLECTION).doc(checkId).get()
    return getDocumentData(result)
  } catch (_) {
    return null
  }
}

function publicCheckResult(check) {
  const status = String(check?.status || '')
  if (status === 'pass') return { pass: true, pending: false, code: 'OK', checkId: check._id || '' }
  if (status === 'rejected') return { pass: false, pending: false, code: 'CONTENT_RISK', checkId: check._id || '' }
  if (status === 'pending' || status === 'submitting') {
    return { pass: false, pending: true, code: 'SECURITY_CHECK_PENDING', checkId: check._id || '' }
  }
  return { pass: false, pending: false, code: check?.code || 'SECURITY_CHECK_UNAVAILABLE', checkId: check?._id || '' }
}

async function startImageCheck(userId, event) {
  await ensureCheckCollection()
  const fileID = String(event.fileID || '').trim()
  if (!fileID.startsWith('cloud://')) {
    return { pass: false, pending: false, code: 'INVALID_FILE' }
  }

  const scene = resolveScene(fileID, event.scene)
  const checkId = createCheckId(userId, fileID)
  const existing = await getCheck(checkId)
  const nowMs = Date.now()

  if (existing && existing.userId === userId && existing.fileID === fileID) {
    if (existing.status === 'pass' && Number(existing.expiresAtMs || 0) > nowMs) {
      if (scene === 'avatar') await storeAvatarSecurityProof(db, userId, fileID, nowMs)
      return { ...publicCheckResult({ ...existing, _id: checkId }), traceId: existing.traceId || '' }
    }
    if (existing.status === 'rejected' && Number(existing.expiresAtMs || 0) > nowMs) {
      return { ...publicCheckResult({ ...existing, _id: checkId }), traceId: existing.traceId || '' }
    }
    if ((existing.status === 'pending' || existing.status === 'submitting') && Number(existing.expiresAtMs || 0) > nowMs) {
      return { ...publicCheckResult({ ...existing, _id: checkId }), traceId: existing.traceId || '' }
    }
  }

  const user = await getUser(userId)
  const openid = String(user?.openid || '').trim()
  if (!openid) return { pass: false, pending: false, code: 'AUTH_REQUIRED' }

  const submitting = {
    userId,
    openid,
    fileID,
    scene,
    status: 'submitting',
    code: 'SECURITY_CHECK_PENDING',
    traceId: '',
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
    expiresAtMs: nowMs + PENDING_TTL_MS
  }
  await db.collection(CHECK_COLLECTION).doc(checkId).set(submitting)

  const requestResult = await requestImageSafetyCheck(fileID, { openid, scene })
  if (!requestResult.accepted || !requestResult.traceId) {
    const failed = {
      status: 'failed',
      code: requestResult.code || 'SECURITY_CHECK_UNAVAILABLE',
      updatedAtMs: Date.now(),
      expiresAtMs: Date.now() + RESULT_TTL_MS
    }
    await db.collection(CHECK_COLLECTION).doc(checkId).update(failed).catch(() => {})
    return { pass: false, pending: false, code: failed.code, checkId }
  }

  await db.collection(CHECK_COLLECTION).doc(checkId).update({
    status: 'pending',
    code: 'SECURITY_CHECK_PENDING',
    traceId: requestResult.traceId,
    updatedAtMs: Date.now(),
    expiresAtMs: Date.now() + PENDING_TTL_MS
  })

  return {
    pass: false,
    pending: true,
    code: 'SECURITY_CHECK_PENDING',
    checkId,
    traceId: requestResult.traceId
  }
}

async function getImageCheckResult(userId, event) {
  await ensureCheckCollection()
  const checkId = String(event.checkId || '').trim()
  if (!checkId) return { pass: false, pending: false, code: 'INVALID_CHECK_ID' }
  const check = await getCheck(checkId)
  if (!check || check.userId !== userId) {
    return { pass: false, pending: false, code: 'INVALID_CHECK_ID' }
  }
  if ((check.status === 'pending' || check.status === 'submitting') && Number(check.expiresAtMs || 0) <= Date.now()) {
    return { pass: false, pending: false, code: 'SECURITY_CHECK_UNAVAILABLE', checkId }
  }
  return { ...publicCheckResult({ ...check, _id: checkId }), traceId: check.traceId || '' }
}

exports.main = async (event = {}) => {
  let userId = ''
  try {
    userId = await requireAuthenticatedUserId(app, event)
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return { pass: false, pending: false, code: 'AUTH_REQUIRED' }
    console.error('contentSecCheck auth error:', error)
    return { pass: false, pending: false, code: 'SECURITY_CHECK_UNAVAILABLE' }
  }

  try {
    const action = String(event.action || '').trim()
    if (action === 'checkImage') return await startImageCheck(userId, event)
    if (action === 'getImageCheckResult') return await getImageCheckResult(userId, event)
    return { pass: false, pending: false, code: 'UNSUPPORTED_ACTION' }
  } catch (error) {
    console.error('contentSecCheck failed:', error)
    return { pass: false, pending: false, code: 'SECURITY_CHECK_UNAVAILABLE' }
  }
}

module.exports._test = {
  CHECK_COLLECTION,
  PENDING_TTL_MS,
  RESULT_TTL_MS,
  createCheckId,
  resolveScene,
  publicCheckResult
}
