const cloudbase = require('@cloudbase/node-sdk')
const {
  AI_REQUEST_TIMEOUT_MS,
  postChatCompletions,
  getAIErrorMessage
} = require('./_shared/ai-http')
const { buildAuthErrorResponse } = require('./_shared/auth')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const GLOBAL_AI_SETTINGS_ID = 'settings_global_ai'

function normalizeList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

function normalizeDoc(res) {
  if (Array.isArray(res?.data)) return res.data[0] || null
  return res?.data || null
}

async function getStrictAuthUserId() {
  const userInfo = await app.auth().getUserInfo()
  const candidates = [
    userInfo?.customUserId,
    userInfo?.uid,
    userInfo?.userInfo?.customUserId,
    userInfo?.userInfo?.uid,
    userInfo?.user?.customUserId,
    userInfo?.user?.uid
  ]

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }

  const error = new Error('UNAUTHENTICATED')
  error.code = 'UNAUTHENTICATED'
  throw error
}

async function requireAdminUserId() {
  const userId = await getStrictAuthUserId()
  const userRes = await db.collection('users').doc(userId).get()
  const user = normalizeDoc(userRes)
  const adminEmails = normalizeList(process.env.ADMIN_EMAILS)
  const email = String(user?.email || '').trim().toLowerCase()
  const isAdmin = Boolean(user?.isAdmin) || user?.role === 'admin' || adminEmails.includes(email)

  if (!isAdmin) {
    const error = new Error('ADMIN_REQUIRED')
    error.code = 'ADMIN_REQUIRED'
    throw error
  }
}

async function getGlobalAISettingsRaw() {
  const byDoc = await db.collection('system_settings').doc(GLOBAL_AI_SETTINGS_ID).get().catch(() => null)
  const doc = normalizeDoc(byDoc)
  if (doc) return doc

  const byScope = await db.collection('system_settings')
    .where({ scope: 'global', key: 'ai' })
    .limit(1)
    .get()
  if (byScope.data && byScope.data.length > 0) return byScope.data[0]

  return null
}

function buildNonJsonResponseMessage(responseText, baseUrl, status) {
  const trimmed = String(responseText || '').trim()
  const preview = trimmed.replace(/\s+/g, ' ').slice(0, 120)
  const looksLikeHtml = /^<!doctype html\b/i.test(trimmed) || /^<html[\s>]/i.test(trimmed) || /^</.test(trimmed)

  if (looksLikeHtml) {
    return `AI 接口返回了 HTML 页面（HTTP ${status}），请检查 Base URL 是否填写成了官网页面而不是 API 地址：${baseUrl}`
  }

  if (!preview) {
    return `AI 接口返回了空响应（HTTP ${status}），请检查 Base URL 和模型服务状态。`
  }

  return `AI 接口返回的不是 JSON（HTTP ${status}）：${preview}`
}

exports.main = async (event) => {
  try {
    await requireAdminUserId()

    const savedSettings = await getGlobalAISettingsRaw()

    // 新版：通过 modelId 在 aiModels 中查找
    const modelId = event.modelId
    let apiKey = ''
    let baseUrl = ''
    let modelName = ''
    let provider = ''

    if (modelId && savedSettings?.aiModels) {
      const matched = savedSettings.aiModels.find((m) => m.id === modelId)
      if (matched) {
        provider = matched.provider || 'openai-compatible'
        apiKey = matched.apiKey || ''
        baseUrl = matched.baseUrl || 'https://api.openai.com/v1'
        modelName = matched.model || 'gpt-4o-mini'
      }
    }

    // 如果没找到指定模型或没有 modelId，使用 event 中的参数（兼容旧版/单次测试）
    if (!apiKey) {
      provider = typeof event.aiProvider === 'string' ? event.aiProvider.trim() : (savedSettings?.aiProvider || 'openai-compatible')
      apiKey = typeof event.aiApiKey === 'string' ? event.aiApiKey.trim() : (savedSettings?.aiApiKey || '')
      baseUrl = typeof event.aiBaseUrl === 'string' && event.aiBaseUrl.trim() ? event.aiBaseUrl.trim() : (savedSettings?.aiBaseUrl || 'https://api.openai.com/v1')
      modelName = typeof event.aiModel === 'string' && event.aiModel.trim() ? event.aiModel.trim() : (savedSettings?.aiModel || 'gpt-4o-mini')
    }

    if (!apiKey) {
      return { success: false, message: '请先填写 API Key' }
    }

    const response = await postChatCompletions({
      provider,
      apiKey,
      baseUrl,
      model: modelName,
      timeoutMs: AI_REQUEST_TIMEOUT_MS,
      messages: [
        { role: 'system', content: '你是一个用于测试 API 连通性的助手。' },
        { role: 'user', content: '请用一句中文回复"连接成功"，并补 12 个字以内的说明。' }
      ],
      temperature: 0.2,
      maxTokens: 80
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      return {
        success: false,
        message: `AI 接口返回 ${response.status}${errorText ? ` / ${errorText.slice(0, 120)}` : ''}`
      }
    }

    let payload = null

    if (typeof response.text === 'function') {
      const responseText = await response.text().catch(() => '')

      try {
        payload = responseText ? JSON.parse(responseText) : null
      } catch {
        return {
          success: false,
          message: buildNonJsonResponseMessage(responseText, baseUrl, response.status)
        }
      }
    } else {
      payload = await response.json()
    }

    const summary = typeof payload?.choices?.[0]?.message?.content === 'string'
      ? payload.choices[0].message.content.trim().slice(0, 120)
      : '模型已响应'

    return {
      success: true,
      message: '连接成功',
      provider,
      model: payload?.model || modelName,
      modelId,
      summary
    }
  } catch (error) {
    if (error?.code === 'ADMIN_REQUIRED') {
      return { success: false, message: '当前账号没有后台管理权限' }
    }
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('testAIConnection error:', error)
    return {
      success: false,
      message: getAIErrorMessage(error, AI_REQUEST_TIMEOUT_MS)
    }
  }
}
