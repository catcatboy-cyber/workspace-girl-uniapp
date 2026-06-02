const crypto = require('crypto')
const cloudbase = require('@cloudbase/node-sdk')
const cloud = require('wx-server-sdk')
const { requireAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()

const VOICE_USAGE_COLLECTION = 'voice_usage'

const ASR_HOST = 'asr.tencentcloudapi.com'
const ASR_ENDPOINT = `https://${ASR_HOST}`
const ASR_SERVICE = 'asr'
const ASR_VERSION = '2019-06-14'
const ASR_ACTION = 'SentenceRecognition'
const ASR_REGION = 'ap-guangzhou'

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex')
}

function hmacSha256(key, value) {
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest()
}

function getCredential() {
  const secretId = String(process.env.TENCENT_SECRET_ID || process.env.TENCENTCLOUD_SECRETID || '').trim()
  const secretKey = String(process.env.TENCENT_SECRET_KEY || process.env.TENCENTCLOUD_SECRETKEY || '').trim()
  if (!secretId || !secretKey) {
    const error = new Error('缺少腾讯云 ASR 密钥环境变量 TENCENT_SECRET_ID / TENCENT_SECRET_KEY')
    error.code = 'MISSING_ASR_CREDENTIAL'
    throw error
  }
  return { secretId, secretKey }
}

function getVoiceFormat(fileName, fallback = 'mp3') {
  const ext = String(fileName || '').split('?')[0].split('.').pop().toLowerCase()
  if (['mp3', 'wav', 'm4a', 'aac', 'pcm', 'ogg-opus', 'speex'].includes(ext)) return ext
  return fallback
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

async function getTempUrl(fileID) {
  const result = await cloud.getTempFileURL({ fileList: [fileID] })
  return result.fileList?.[0]?.tempFileURL || ''
}

async function callTencentSentenceRecognition(payload) {
  const { secretId, secretKey } = getCredential()
  const timestamp = Math.floor(Date.now() / 1000)
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
  const body = JSON.stringify(payload)

  const canonicalRequest = [
    'POST',
    '/',
    '',
    `content-type:application/json\nhost:${ASR_HOST}\n`,
    'content-type;host',
    sha256(body)
  ].join('\n')

  const credentialScope = `${date}/${ASR_SERVICE}/tc3_request`
  const stringToSign = [
    'TC3-HMAC-SHA256',
    String(timestamp),
    credentialScope,
    sha256(canonicalRequest)
  ].join('\n')

  const secretDate = hmacSha256(`TC3${secretKey}`, date)
  const secretService = hmacSha256(secretDate, ASR_SERVICE)
  const secretSigning = hmacSha256(secretService, 'tc3_request')
  const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign, 'utf8').digest('hex')
  const authorization = `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=content-type;host, Signature=${signature}`

  const response = await fetch(ASR_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
      Host: ASR_HOST,
      'X-TC-Action': ASR_ACTION,
      'X-TC-Region': ASR_REGION,
      'X-TC-Version': ASR_VERSION,
      'X-TC-Timestamp': String(timestamp)
    },
    body
  })

  const data = await response.json().catch(() => ({}))
  const result = data.Response || {}
  if (!response.ok || result.Error) {
    const message = result.Error?.Message || `腾讯云 ASR 返回 ${response.status}`
    const error = new Error(message)
    error.code = result.Error?.Code || 'ASR_REQUEST_FAILED'
    throw error
  }
  return result
}

exports.main = async (event = {}) => {
  try {
    const userId = await requireAuthenticatedUserId(app, event)
    const fileID = String(event.fileID || '').trim()
    const fileName = String(event.fileName || '').trim()
    const durationMs = Number(event.durationMs || 0)
    if (!fileID) return { success: false, message: '缺少语音 fileID' }
    if (durationMs > 65000) return { success: false, message: '语音最长支持 60 秒' }

    const url = await getTempUrl(fileID)
    if (!url) return { success: false, message: '无法读取语音临时地址' }

    const payload = {
      ProjectId: 0,
      SubServiceType: 2,
      EngSerViceType: String(event.engine || '16k_zh'),
      SourceType: 0,
      Url: url,
      VoiceFormat: getVoiceFormat(fileName, 'mp3'),
      UsrAudioKey: `speech_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
    }

    const result = await callTencentSentenceRecognition(payload)
    const text = normalizeText(result.Result)
    if (!text) return { success: false, message: '没有识别到语音文字' }

    try {
      await db.collection(VOICE_USAGE_COLLECTION).add({
        userId,
        durationMs,
        fileID,
        requestId: result.RequestId || '',
        createdAt: new Date()
      })
    } catch (writeErr) {
      console.warn('voice_usage 写入失败:', writeErr?.message || writeErr)
    }

    return {
      success: true,
      text,
      durationMs,
      requestId: result.RequestId || ''
    }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('speechToText error:', error)
    return { success: false, message: error?.message || '语音识别失败', code: error?.code || '' }
  }
}
