const cloudbase = require('@cloudbase/node-sdk')
const crypto = require('crypto')
const { requireAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const _ = db.command

function normalizeModels(models, existingModels) {
  if (!Array.isArray(models)) return null

  return models.map((model, index) => {
    const existingModel = existingModels.find((item) => item.id === model.id) || {}
    const id = model.id || existingModel.id || (index === 0 ? 'default' : `model_${index + 1}`)

    return {
      id,
      name: model.name || existingModel.name || '默认模型',
      provider: model.provider || existingModel.provider || 'openai-compatible',
      baseUrl: model.baseUrl || existingModel.baseUrl || 'https://api.openai.com/v1',
      model: model.model || existingModel.model || 'gpt-4o-mini',
      apiKey: model.apiKey || existingModel.apiKey || ''
    }
  })
}

function normalizeLegacyModelInput(event, existingModels) {
  const hasLegacyFields = [
    event.aiProvider,
    event.aiApiKey,
    event.aiBaseUrl,
    event.aiModel
  ].some((value) => typeof value !== 'undefined')

  if (!hasLegacyFields) return null

  const existingModel = existingModels.find((item) => item.id === 'default') || existingModels[0] || {}

  return [{
    id: existingModel.id || 'default',
    name: existingModel.name || '默认模型',
    provider: event.aiProvider || existingModel.provider || 'openai-compatible',
    baseUrl: event.aiBaseUrl || existingModel.baseUrl || 'https://api.openai.com/v1',
    model: event.aiModel || existingModel.model || 'gpt-4o-mini',
    apiKey: event.aiApiKey || existingModel.apiKey || ''
  }]
}

function getDefaultModel(models, defaultModelId) {
  if (!Array.isArray(models) || models.length === 0) return null
  return models.find((item) => item.id === defaultModelId) || models[0]
}

exports.main = async (event) => {
  const {
    models,
    defaultModelId,
    aiEnabled,
    aiFallbackToRules
  } = event
  try {
    const userId = await requireAuthenticatedUserId(app)

    const now = new Date()

    // 获取当前设置
    const { data } = await db.collection('system_settings')
      .where({ userId })
      .limit(1)
      .get()

    const existingSettings = data && data.length > 0 ? data[0] : null
    const existingModels = Array.isArray(existingSettings?.aiModels) ? existingSettings.aiModels : []

    const update = {
      updatedAt: now,
      settingsVersion: 2  // 版本2：支持多模型
    }

    if (typeof aiEnabled !== 'undefined') update.aiEnabled = !!aiEnabled
    if (typeof aiFallbackToRules !== 'undefined') update.aiFallbackToRules = !!aiFallbackToRules

    const normalizedModels = normalizeModels(models, existingModels) || normalizeLegacyModelInput(event, existingModels)
    if (normalizedModels) {
      update.aiModels = normalizedModels
    }

    if (defaultModelId !== undefined) {
      update.aiDefaultModelId = defaultModelId
    } else if (normalizedModels?.length && !existingSettings?.aiDefaultModelId) {
      update.aiDefaultModelId = normalizedModels[0].id
    }

    const syncedDefaultModel = getDefaultModel(
      normalizedModels || existingModels,
      update.aiDefaultModelId || existingSettings?.aiDefaultModelId
    )
    if (syncedDefaultModel) {
      update.aiProvider = syncedDefaultModel.provider || 'openai-compatible'
      update.aiBaseUrl = syncedDefaultModel.baseUrl || 'https://api.openai.com/v1'
      update.aiModel = syncedDefaultModel.model || 'gpt-4o-mini'
      update.aiApiKey = syncedDefaultModel.apiKey || ''
    }

    if (!data || data.length === 0) {
      const newId = `settings_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
      await db.collection('system_settings').add({
        _id: newId,
        userId,
        settingsVersion: 2,
        aiEnabled: false,
        aiFallbackToRules: true,
        aiModels: [
          {
            id: 'default',
            name: '默认模型',
            provider: 'openai-compatible',
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-4o-mini',
            apiKey: ''
          }
        ],
        aiDefaultModelId: 'default',
        ...update
      })
    } else {
      await db.collection('system_settings').doc(data[0]._id).update(update)
    }

    return { success: true }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('updateAISettings error:', error)
    return { success: false, message: '更新AI设置失败' }
  }
}
