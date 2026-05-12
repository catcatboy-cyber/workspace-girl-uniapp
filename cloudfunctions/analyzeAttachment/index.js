const cloudbase = require('@cloudbase/node-sdk')
const cloud = require('wx-server-sdk')
const { requireAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')
const { AI_REQUEST_TIMEOUT_MS, postChatCompletions, parseJSONContent } = require('./_shared/ai-http')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const GLOBAL_AI_SETTINGS_ID = 'settings_global_ai'

function normalizeDoc(res) {
  if (Array.isArray(res?.data)) return res.data[0] || null
  return res?.data || null
}

async function getAISettings(userId) {
  const globalDocRes = await db.collection('system_settings').doc(GLOBAL_AI_SETTINGS_ID).get().catch(() => null)
  let settings = normalizeDoc(globalDocRes)
  if (!settings) {
    const globalScopeRes = await db.collection('system_settings')
      .where({ scope: 'global', key: 'ai' })
      .limit(1)
      .get()
    settings = globalScopeRes.data?.[0] || null
  }
  if (!settings) {
    const userSettingsRes = await db.collection('system_settings').where({ userId }).limit(1).get()
    settings = userSettingsRes.data?.[0] || null
  }
  return settings
}

function normalizeSettings(settings) {
  if (settings?.settingsVersion === 2 && Array.isArray(settings?.aiModels)) {
    const defaultId = settings.aiDefaultModelId || 'default'
    const model = settings.aiModels.find((item) => item.id === defaultId) || settings.aiModels[0] || {}
    return {
      enabled: Boolean(settings.aiEnabled),
      provider: String(model.provider || 'openai-compatible').trim(),
      apiKey: String(model.apiKey || '').trim(),
      baseUrl: String(model.baseUrl || 'https://api.openai.com/v1').trim(),
      model: String(model.model || 'gpt-4o-mini').trim()
    }
  }
  return {
    enabled: Boolean(settings?.aiEnabled),
    provider: String(settings?.aiProvider || 'openai-compatible').trim(),
    apiKey: String(settings?.aiApiKey || '').trim(),
    baseUrl: String(settings?.aiBaseUrl || 'https://api.openai.com/v1').trim(),
    model: String(settings?.aiModel || 'gpt-4o-mini').trim()
  }
}

async function getTempUrl(fileID) {
  const result = await cloud.getTempFileURL({ fileList: [fileID] })
  return result.fileList?.[0]?.tempFileURL || ''
}

function normalizeAnalysis(parsed) {
  const extractedText = typeof parsed.extractedText === 'string' ? parsed.extractedText.trim() : ''
  const isChatRecord = Boolean(parsed.isChatRecord)
  return {
    isChatRecord,
    extractedText: isChatRecord ? extractedText : '',
    suggestedTitle: typeof parsed.suggestedTitle === 'string' ? parsed.suggestedTitle.slice(0, 30) : '',
    summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 200) : '',
    confidence: ['low', 'medium', 'high'].includes(parsed.confidence) ? parsed.confidence : 'medium'
  }
}

exports.main = async (event = {}) => {
  try {
    const userId = await requireAuthenticatedUserId(app, event)
    const fileID = String(event.fileID || '').trim()
    const mediaType = String(event.mediaType || '').trim()
    if (!fileID) return { success: false, message: '缺少附件 fileID' }
    if (mediaType !== 'image') return { success: false, message: '当前仅支持图片识别' }

    const settings = normalizeSettings(await getAISettings(userId))
    if (!settings.enabled || !settings.apiKey) {
      return { success: true, analysis: { isChatRecord: false, extractedText: '', summary: 'AI 未开启，图片已作为附件保存。', confidence: 'low' } }
    }

    const imageUrl = await getTempUrl(fileID)
    if (!imageUrl) return { success: false, message: '无法读取图片临时地址' }

    const prompt = [
      '你是聊天截图识别助手。请判断图片是否是聊天记录截图。',
      '如果是聊天记录，请尽量按原顺序提取可读文字，保留说话人/时间/关键语气，不要编造看不清的内容。',
      '如果不是聊天记录，不要提取正文，只简短说明图片内容。',
      '只输出 JSON：{"isChatRecord":boolean,"extractedText":"...","suggestedTitle":"...","summary":"...","confidence":"low|medium|high"}'
    ].join('\n')

    const response = await postChatCompletions({
      provider: settings.provider,
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      model: settings.model,
      timeoutMs: AI_REQUEST_TIMEOUT_MS,
      responseFormat: { type: 'json_object' },
      maxTokens: 1200,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }
      ]
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      console.error('analyzeAttachment AI error:', response.status, text.slice(0, 300))
      return { success: true, analysis: { isChatRecord: false, extractedText: '', summary: '图片已保存，AI 暂时无法识别。', confidence: 'low' } }
    }

    const data = await response.json()
    const raw = data?.choices?.[0]?.message?.content || ''
    return { success: true, analysis: normalizeAnalysis(parseJSONContent(raw)) }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('analyzeAttachment error:', error)
    return { success: false, message: '附件识别失败' }
  }
}
