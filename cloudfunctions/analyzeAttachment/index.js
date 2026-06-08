const cloudbase = require('@cloudbase/node-sdk')
const cloud = require('wx-server-sdk')
const { requireAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')
const { AI_REQUEST_TIMEOUT_MS, postChatCompletions, parseJSONContent } = require('./_shared/ai-http')
const { recordTokenUsage } = require('./_shared/token-usage')
const { checkBalance } = require('./_shared/billing')
const { checkFeatureAccess, checkTokenBalance, consumeTokens } = require('./_shared/subscription')
const { buildPromptMessages } = require('./_shared/ai-prompt-config')

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
      model: String(model.model || 'gpt-4o-mini').trim(),
      runtimeConfig: settings.runtimeConfig && typeof settings.runtimeConfig === 'object' ? settings.runtimeConfig : {},
      promptConfig: settings.promptConfig && typeof settings.promptConfig === 'object' ? settings.promptConfig : {},
      promptModules: settings.promptModules && typeof settings.promptModules === 'object' ? settings.promptModules : {}
    }
  }
  return {
    enabled: Boolean(settings?.aiEnabled),
    provider: String(settings?.aiProvider || 'openai-compatible').trim(),
    apiKey: String(settings?.aiApiKey || '').trim(),
    baseUrl: String(settings?.aiBaseUrl || 'https://api.openai.com/v1').trim(),
    model: String(settings?.aiModel || 'gpt-4o-mini').trim(),
    runtimeConfig: settings?.runtimeConfig && typeof settings.runtimeConfig === 'object' ? settings.runtimeConfig : {},
    promptConfig: settings?.promptConfig && typeof settings.promptConfig === 'object' ? settings.promptConfig : {},
    promptModules: settings?.promptModules && typeof settings.promptModules === 'object' ? settings.promptModules : {}
  }
}

function clampRuntimeNumber(value, fallback, min, max, integer = false) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const clamped = Math.min(max, Math.max(min, parsed))
  return integer ? Math.round(clamped) : Number(clamped.toFixed(2))
}

function getRuntimeConfig(settings = {}) {
  const source = settings.runtimeConfig && typeof settings.runtimeConfig === 'object' ? settings.runtimeConfig : {}
  return {
    attachmentMaxTokens: clampRuntimeNumber(source.attachmentMaxTokens, 1200, 400, 2400, true),
    attachmentTemperature: clampRuntimeNumber(source.attachmentTemperature, 0.1, 0, 1)
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

    const rawSettings = await getAISettings(userId)
    const settings = normalizeSettings(rawSettings)
    const runtimeConfig = getRuntimeConfig(rawSettings)
    if (!settings.enabled || !settings.apiKey) {
      return { success: true, analysis: { isChatRecord: false, extractedText: '', summary: 'AI 未开启，图片已作为附件保存。', confidence: 'low' } }
    }

    const imageUrl = await getTempUrl(fileID)
    if (!imageUrl) return { success: false, message: '无法读取图片临时地址' }

    const promptMessages = buildPromptMessages({
      moduleKey: 'attachmentAnalysis',
      settings,
      contextLines: [
        'Input: one image attachment URL is provided as image_url content.'
      ]
    })
    if (!promptMessages) {
      return { success: true, analysis: { isChatRecord: false, extractedText: '', summary: 'Attachment prompt is disabled in admin.', confidence: 'low' } }
    }
    const prompt = promptMessages.map((item) => item.content).join('\n\n')

    // Token门控
    const accessAA = await checkFeatureAccess(db, userId, '附件识别')
    if (!accessAA.allowed) return { success: false, code: 'FEATURE_NOT_AVAILABLE', message: accessAA.reason }
    const tokAA = await checkTokenBalance(db, userId, 1000)
    if (!tokAA.ok) return { success: false, code: tokAA.code, message: tokAA.message, ...tokAA }

    const balCheck = await checkBalance(db, userId, runtimeConfig.attachmentMaxTokens)
    if (!balCheck.ok) {
      return { success: false, message: '余额不足，请充值', code: 'INSUFFICIENT_BALANCE', balance: balCheck.balance, required: balCheck.required }
    }

    const response = await postChatCompletions({
      provider: settings.provider,
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      model: settings.model,
      timeoutMs: AI_REQUEST_TIMEOUT_MS,
      responseFormat: { type: 'json_object' },
      maxTokens: runtimeConfig.attachmentMaxTokens,
      temperature: runtimeConfig.attachmentTemperature,
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
    await recordTokenUsage(db, {
      userId,
      feature: 'attachmentAnalysis',
      provider: settings.provider,
      model: settings.model,
      usage: data?.usage
    })
    return { success: true, analysis: normalizeAnalysis(parseJSONContent(raw)) }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('analyzeAttachment error:', error)
    return { success: false, message: '附件识别失败' }
  }
}

