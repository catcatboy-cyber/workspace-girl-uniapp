const cloudbase = require('@cloudbase/node-sdk')
const cloud = require('wx-server-sdk')
const { requireAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')
const { AI_REQUEST_TIMEOUT_MS, postChatCompletions, parseJSONContent } = require('./_shared/ai-http')
const { recordTokenUsage } = require('./_shared/token-usage')
const { checkFeatureAccess, checkTokenBalance } = require('./_shared/subscription')
const { buildPromptMessages } = require('./_shared/ai-prompt-config')
const { findVisionModel } = require('./vision-model')
const {
  MAX_WECHAT_SCREENSHOTS,
  FIXED_WECHAT_CHAT_PROMPT,
  normalizeWechatAnalysis
} = require('./wechat-chat-analysis')

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

function normalizeSettings(settings, selectedModel = null) {
  if (settings?.settingsVersion === 2 && Array.isArray(settings?.aiModels)) {
    const defaultId = settings.aiDefaultModelId || 'default'
    const model = selectedModel || settings.aiModels.find((item) => item.id === defaultId) || settings.aiModels[0] || {}
    return {
      enabled: Boolean(settings.aiEnabled),
      provider: String(model.provider || '').trim(),
      apiKey: String(model.apiKey || '').trim(),
      baseUrl: String(model.baseUrl || '').trim(),
      model: String(model.model || '').trim(),
      supportsVision: model.supportsVision === true,
      runtimeConfig: settings.runtimeConfig && typeof settings.runtimeConfig === 'object' ? settings.runtimeConfig : {},
      promptConfig: settings.promptConfig && typeof settings.promptConfig === 'object' ? settings.promptConfig : {},
      promptModules: settings.promptModules && typeof settings.promptModules === 'object' ? settings.promptModules : {}
    }
  }
  return {
    enabled: Boolean(settings?.aiEnabled),
    provider: String(settings?.aiProvider || '').trim(),
    apiKey: String(settings?.aiApiKey || '').trim(),
    baseUrl: String(settings?.aiBaseUrl || '').trim(),
    model: String(settings?.aiModel || '').trim(),
    supportsVision: false,
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

function normalizeFileIDs(event = {}) {
  const source = Array.isArray(event.fileIDs) ? event.fileIDs : [event.fileID]
  const seen = new Set()
  return source
    .map((item) => String(item || '').trim())
    .filter((item) => {
      if (!item || seen.has(item)) return false
      seen.add(item)
      return true
    })
}

async function getTempUrls(fileIDs) {
  const result = await cloud.getTempFileURL({ fileList: fileIDs })
  const fileList = Array.isArray(result.fileList) ? result.fileList : []
  const urlByFileID = new Map(fileList.map((item) => [item.fileID, item.tempFileURL || '']))
  return fileIDs.map((fileID, index) => urlByFileID.get(fileID) || fileList[index]?.tempFileURL || '')
}

exports.main = async (event = {}) => {
  try {
    const userId = await requireAuthenticatedUserId(app, event)
    const fileIDs = normalizeFileIDs(event)
    const mediaType = String(event.mediaType || '').trim()
    const mode = String(event.mode || 'wechat_chat_screenshot').trim()
    if (fileIDs.length === 0) return { success: false, message: '缺少截图 fileID' }
    if (fileIDs.length > MAX_WECHAT_SCREENSHOTS) return { success: false, message: `最多识别 ${MAX_WECHAT_SCREENSHOTS} 张截图` }
    if (mediaType !== 'image') return { success: false, message: '当前仅支持图片识别' }
    if (mode !== 'wechat_chat_screenshot') return { success: false, message: '当前仅支持微信聊天截图识别' }

    const rawSettings = await getAISettings(userId)
    const visionModel = findVisionModel(rawSettings)
    if (!visionModel) {
      return { success: false, code: 'VISION_MODEL_NOT_CONFIGURED', message: '请在 AI 设置中至少勾选一个视觉模型后再识别微信截图' }
    }
    const settings = normalizeSettings(rawSettings, visionModel)
    const runtimeConfig = getRuntimeConfig(rawSettings)
    if (!settings.enabled || !settings.apiKey) {
      return { success: false, code: 'VISION_MODEL_NOT_CONFIGURED', message: '视觉模型未开启或未配置 API Key，请检查 AI 设置' }
    }

    const imageUrls = await getTempUrls(fileIDs)
    if (imageUrls.some((url) => !url)) return { success: false, message: '无法读取部分截图的临时地址' }

    const promptMessages = buildPromptMessages({
      moduleKey: 'attachmentAnalysis',
      settings,
      contextLines: [
        `Input: ${imageUrls.length} WeChat screenshot candidate(s) are provided as image_url content.`
      ],
      systemExtra: '该调用只执行微信一对一聊天截图 OCR 与说话人方向识别，不执行关系判断或图片摘要。'
    })
    if (!promptMessages) {
      return { success: false, code: 'ATTACHMENT_PROMPT_DISABLED', message: '微信聊天截图识别暂未开放' }
    }
    const systemPrompt = promptMessages.find((item) => item.role === 'system')?.content || ''
    const businessPrompt = promptMessages.filter((item) => item.role !== 'system').map((item) => item.content).join('\n\n')

    // Token门控
    const accessAA = await checkFeatureAccess(db, userId, '附件识别')
    if (!accessAA.allowed) return { success: false, code: 'FEATURE_NOT_AVAILABLE', message: accessAA.reason }
    const tokAA = await checkTokenBalance(db, userId, {
      featureKey: 'attachmentAnalysis',
      modelId: settings.model,
      fallbackTokens: 1000
    })
    if (!tokAA.ok) return { success: false, code: tokAA.code, message: tokAA.message, ...tokAA }

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
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        {
          role: 'user',
          content: [
            { type: 'text', text: [businessPrompt, FIXED_WECHAT_CHAT_PROMPT].filter(Boolean).join('\n\n') },
            ...imageUrls.flatMap((url, index) => [
              { type: 'text', text: `截图编号 ${index + 1}，输出 imageIndex=${index}` },
              { type: 'image_url', image_url: { url } }
            ])
          ]
        }
      ]
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      console.error('analyzeAttachment AI error:', response.status, text.slice(0, 300))
      return { success: false, code: 'ATTACHMENT_AI_FAILED', message: '微信聊天截图识别失败，请稍后重试' }
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
    const analysis = normalizeWechatAnalysis(parseJSONContent(raw), imageUrls.length)
    if (analysis.exceedsTextLimit) {
      return { success: false, code: 'ATTACHMENT_TEXT_TOO_LONG', message: '聊天记录过长，请减少截图后分批导入' }
    }
    return { success: true, analysis }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('analyzeAttachment error:', error)
    return { success: false, message: '附件识别失败' }
  }
}

