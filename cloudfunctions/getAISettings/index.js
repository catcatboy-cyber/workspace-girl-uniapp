const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const _ = db.command

function redactKey(key) {
  if (!key || typeof key !== 'string') return ''
  if (key.length <= 4) return '***'
  return '***' + key.slice(-4)
}

function syncLegacyFieldsFromDefaultModel(settings) {
  if (!settings || !Array.isArray(settings.aiModels) || settings.aiModels.length === 0) return settings

  const defaultModel = settings.aiModels.find((m) => m.id === settings.aiDefaultModelId) || settings.aiModels[0]
  if (!defaultModel) return settings

  settings.aiProvider = defaultModel.provider || 'openai-compatible'
  settings.aiBaseUrl = defaultModel.baseUrl || 'https://api.openai.com/v1'
  settings.aiModel = defaultModel.model || 'gpt-4o-mini'
  settings.aiApiKey = defaultModel.apiKey ? redactKey(defaultModel.apiKey) : ''
  return settings
}

// 将旧版单模型格式迁移到多模型格式
function migrateToV2(settings) {
  if (!settings) return null

  const clone = { ...settings }

  if (clone.settingsVersion === 2 || clone.aiModels) {
    // 已经是新版
    if (clone.aiModels) {
      clone.aiModels = clone.aiModels.map((m) => ({
        ...m,
        apiKey: m.apiKey ? redactKey(m.apiKey) : ''
      }))
    }
    return syncLegacyFieldsFromDefaultModel(clone)
  }

  // 旧版格式 → 迁移
  const models = [{
    id: 'default',
    name: '默认模型',
    provider: clone.aiProvider || 'openai-compatible',
    baseUrl: clone.aiBaseUrl || 'https://api.openai.com/v1',
    model: clone.aiModel || 'gpt-4o-mini',
    apiKey: clone.aiApiKey || ''
  }]

  clone.settingsVersion = 2
  clone.aiModels = models
  clone.aiDefaultModelId = 'default'

  // 保留旧字段用于兼容
  delete clone.aiProvider
  delete clone.aiBaseUrl
  delete clone.aiModel
  delete clone.aiApiKey

  clone.aiModels = clone.aiModels.map((m) => ({
    ...m,
    apiKey: m.apiKey ? redactKey(m.apiKey) : ''
  }))

  return syncLegacyFieldsFromDefaultModel(clone)
}

exports.main = async (event) => {
  try {
    const userId = await requireAuthenticatedUserId(app)

    const { data } = await db.collection('system_settings')
      .where({ userId })
      .limit(1)
      .get()

    if (!data || data.length === 0) {
      return { success: true, settings: null }
    }

    const settings = migrateToV2({ ...data[0] })

    return { success: true, settings }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('getAISettings error:', error)
    return { success: false, message: '获取AI设置失败' }
  }
}
