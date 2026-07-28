function readNumber(value, ...keys) {
  for (const key of keys) {
    const raw = value?.[key]
    if (raw === undefined || raw === null || raw === '') continue
    const number = Number(raw)
    if (Number.isFinite(number)) return number
  }
  return null
}

function readString(value, ...keys) {
  for (const key of keys) {
    const text = String(value?.[key] || '').trim()
    if (text) return text
  }
  return ''
}

function normalizeMediaCheckCallback(payload = {}) {
  const traceId = readString(payload, 'trace_id', 'traceId')
  const errCode = readNumber(payload, 'errcode', 'errCode', 'code')
  const suggest = readString(payload?.result, 'suggest').toLowerCase()
  const label = readNumber(payload?.result, 'label')

  if (!traceId) return { valid: false, code: 'INVALID_CALLBACK' }
  if (errCode !== 0) {
    return { valid: true, traceId, status: 'failed', code: 'SECURITY_CHECK_UNAVAILABLE', errCode, suggest, label }
  }
  if (suggest === 'pass') {
    return { valid: true, traceId, status: 'pass', code: 'OK', errCode, suggest, label }
  }
  if (suggest === 'risky' || suggest === 'review') {
    return { valid: true, traceId, status: 'rejected', code: 'CONTENT_RISK', errCode, suggest, label }
  }
  return { valid: true, traceId, status: 'failed', code: 'SECURITY_CHECK_UNAVAILABLE', errCode, suggest, label }
}

module.exports = { normalizeMediaCheckCallback }
