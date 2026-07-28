/**
 * 微信内容安全 2.0：图片/音频使用 security.mediaCheckAsync。
 *
 * mediaCheckAsync 只受理任务，最终结论由 wxa_media_check 消息异步推送。
 * 调用方必须在收到 pass 结论前保持内容未发布状态。
 */
const MEDIA_TYPE_IMAGE = 2
const MEDIA_CHECK_VERSION = 2

const SCENE_NUMBERS = Object.freeze({
  image: 1,
  avatar: 1,
  custom_pet: 1,
  timeline: 4
})

let cachedCloud = null

function getCloud() {
  if (!cachedCloud) {
    try {
      const wxCloud = require('wx-server-sdk')
      wxCloud.init({ env: wxCloud.DYNAMIC_CURRENT_ENV })
      cachedCloud = wxCloud
    } catch (error) {
      console.error('content security sdk unavailable:', error)
      cachedCloud = null
    }
  }
  return cachedCloud
}

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

function getSceneNumber(scene) {
  return SCENE_NUMBERS[String(scene || '').trim()] || SCENE_NUMBERS.image
}

function rejected(code) {
  return { accepted: false, code }
}

async function resolveMediaUrl(cloud, fileID) {
  if (!cloud?.getTempFileURL) return ''
  const result = await cloud.getTempFileURL({ fileList: [fileID] })
  const item = Array.isArray(result?.fileList) ? result.fileList[0] : null
  const status = readNumber(item, 'status', 'errCode', 'errcode')
  if (status !== null && status !== 0) return ''
  return readString(item, 'tempFileURL', 'tempFileUrl', 'download_url', 'downloadUrl')
}

async function requestImageSafetyCheck(fileID, options = {}) {
  const normalizedFileID = String(fileID || '').trim()
  const openid = String(options.openid || '').trim()
  if (!normalizedFileID.startsWith('cloud://')) return rejected('INVALID_FILE')
  if (!openid) return rejected('AUTH_REQUIRED')

  const cloud = options.cloud || getCloud()
  if (!cloud?.openapi?.security?.mediaCheckAsync) {
    return rejected('SECURITY_CHECK_UNAVAILABLE')
  }

  let mediaUrl = ''
  try {
    mediaUrl = await resolveMediaUrl(cloud, normalizedFileID)
  } catch (error) {
    console.error('content security getTempFileURL failed:', error)
    return rejected('SECURITY_CHECK_UNAVAILABLE')
  }
  if (!mediaUrl) return rejected('INVALID_FILE')

  try {
    const result = await cloud.openapi.security.mediaCheckAsync({
      mediaUrl,
      mediaType: MEDIA_TYPE_IMAGE,
      version: MEDIA_CHECK_VERSION,
      scene: getSceneNumber(options.scene),
      openid
    })
    const errCode = readNumber(result, 'errCode', 'errcode', 'code')
    const traceId = readString(result, 'traceId', 'trace_id')
    if (errCode === 0 && traceId) {
      return { accepted: true, pending: true, code: 'SECURITY_CHECK_PENDING', traceId }
    }
    console.error('content security mediaCheckAsync unexpected result:', { errCode, hasTraceId: Boolean(traceId) })
    return rejected('SECURITY_CHECK_UNAVAILABLE')
  } catch (error) {
    console.error('content security mediaCheckAsync failed:', error)
    return rejected('SECURITY_CHECK_UNAVAILABLE')
  }
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

module.exports = {
  MEDIA_TYPE_IMAGE,
  MEDIA_CHECK_VERSION,
  SCENE_NUMBERS,
  getSceneNumber,
  requestImageSafetyCheck,
  normalizeMediaCheckCallback
}
