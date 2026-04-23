const cloudbase = require('@cloudbase/node-sdk')
const {
  AI_REQUEST_TIMEOUT_MS,
  postChatCompletions,
  getAIErrorMessage
} = require('./_shared/ai-http')
const { requireAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()

function pickString(value, fallback) {
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }
  return fallback
}

exports.main = async (event) => {
  try {
    const userId = await requireAuthenticatedUserId(app)

    const { data } = await db.collection('system_settings')
      .where({ userId })
      .limit(1)
      .get()

    const savedSettings = data && data.length > 0 ? data[0] : null
    const apiKeyInput = typeof event.aiApiKey === 'string' ? event.aiApiKey.trim() : ''

    const settings = {
      provider: pickString(event.aiProvider, pickString(savedSettings?.aiProvider, 'openai-compatible')),
      apiKey: apiKeyInput || pickString(savedSettings?.aiApiKey, ''),
      baseUrl: pickString(event.aiBaseUrl, pickString(savedSettings?.aiBaseUrl, 'https://api.openai.com/v1')),
      model: pickString(event.aiModel, pickString(savedSettings?.aiModel, 'gpt-4o-mini'))
    }

    if (!settings.apiKey) {
      return { success: false, message: '请先填写 API Key' }
    }

    const response = await postChatCompletions({
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      model: settings.model,
      timeoutMs: AI_REQUEST_TIMEOUT_MS,
      messages: [
        { role: 'system', content: '你是一个用于测试 API 连通性的助手。' },
        { role: 'user', content: '请用一句中文回复“连接成功”，并补 12 个字以内的说明。' }
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

    const payload = await response.json()
    const summary = typeof payload?.choices?.[0]?.message?.content === 'string'
      ? payload.choices[0].message.content.trim().slice(0, 120)
      : '模型已响应'

    return {
      success: true,
      message: '连接成功',
      provider: settings.provider,
      model: payload?.model || settings.model,
      summary
    }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('testAIConnection error:', error)
    return {
      success: false,
      message: getAIErrorMessage(error, AI_REQUEST_TIMEOUT_MS)
    }
  }
}
