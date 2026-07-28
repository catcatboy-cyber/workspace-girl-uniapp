const crypto = require('crypto')
const cloudbase = require('@cloudbase/node-sdk')
const { normalizeMediaCheckCallback } = require('./_shared/content-security')
const { storeAvatarSecurityProof } = require('./_shared/avatar-security')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const CHECK_COLLECTION = 'content_security_checks'
const RESULT_TTL_MS = 24 * 60 * 60 * 1000
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

function textResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
    body: String(body || '')
  }
}

function getQuery(event) {
  if (event?.queryStringParameters && typeof event.queryStringParameters === 'object') {
    return event.queryStringParameters
  }
  if (event?.queryString && typeof event.queryString === 'object') return event.queryString
  if (typeof event?.queryString === 'string') return Object.fromEntries(new URLSearchParams(event.queryString))
  const rawQuery = String(event?.rawQueryString || '').trim()
  return rawQuery ? Object.fromEntries(new URLSearchParams(rawQuery)) : {}
}

function verifyMessageSignature(token, query) {
  const signature = String(query?.signature || '').trim()
  const timestamp = String(query?.timestamp || '').trim()
  const nonce = String(query?.nonce || '').trim()
  if (!token || !signature || !timestamp || !nonce) return false
  const expected = crypto.createHash('sha1').update([token, timestamp, nonce].sort().join('')).digest('hex')
  const left = Buffer.from(expected)
  const right = Buffer.from(signature)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

function parseBody(event) {
  let body = event?.body
  if (event?.isBase64Encoded && typeof body === 'string') body = Buffer.from(body, 'base64').toString('utf8')
  if (body && typeof body === 'object') return body
  try {
    return JSON.parse(String(body || '{}'))
  } catch (_) {
    return null
  }
}

async function findCheckByTraceId(traceId) {
  await ensureCheckCollection()
  const result = await db.collection(CHECK_COLLECTION).where({ traceId }).limit(1).get()
  return Array.isArray(result?.data) ? result.data[0] || null : null
}

async function applyMediaCheckResult(payload) {
  const normalized = normalizeMediaCheckCallback(payload)
  if (!normalized.valid) return { ok: false, code: normalized.code }

  const check = await findCheckByTraceId(normalized.traceId)
  if (!check?._id) {
    console.warn('contentSecCallback trace_id not found:', normalized.traceId)
    return { ok: true, code: 'CHECK_NOT_FOUND' }
  }

  const nowMs = Date.now()
  if (normalized.status === 'pass' && check.scene === 'avatar') {
    await storeAvatarSecurityProof(db, check.userId, check.fileID, nowMs)
  }

  await db.collection(CHECK_COLLECTION).doc(check._id).update({
    status: normalized.status,
    code: normalized.code,
    suggest: normalized.suggest || '',
    label: normalized.label,
    callbackErrCode: normalized.errCode,
    updatedAtMs: nowMs,
    checkedAtMs: nowMs,
    expiresAtMs: nowMs + RESULT_TTL_MS
  })

  return { ok: true, code: normalized.code, status: normalized.status }
}

exports.main = async (event = {}) => {
  const method = String(event.httpMethod || event.requestContext?.http?.method || '').toUpperCase()
  if (!method) return textResponse(400, 'HTTP only')

  const token = String(process.env.WECHAT_MESSAGE_TOKEN || '').trim()
  if (!token) {
    console.error('contentSecCallback missing WECHAT_MESSAGE_TOKEN')
    return textResponse(503, 'callback unavailable')
  }

  const query = getQuery(event)
  if (!verifyMessageSignature(token, query)) return textResponse(403, 'invalid signature')

  if (method === 'GET') {
    const echo = String(query.echostr || '').trim()
    return echo ? textResponse(200, echo) : textResponse(400, 'missing echostr')
  }
  if (method !== 'POST') return textResponse(405, 'method not allowed')

  const payload = parseBody(event)
  const eventName = String(payload?.Event || payload?.event || '').trim()
  if (!payload || eventName !== 'wxa_media_check') return textResponse(400, 'invalid event')

  try {
    await applyMediaCheckResult(payload)
    return textResponse(200, 'success')
  } catch (error) {
    console.error('contentSecCallback failed:', error)
    return textResponse(500, 'failed')
  }
}

module.exports._test = {
  getQuery,
  verifyMessageSignature,
  parseBody,
  applyMediaCheckResult
}
