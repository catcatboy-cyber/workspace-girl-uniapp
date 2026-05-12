const cloudbase = require('@cloudbase/node-sdk')

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

function getDefaultSettings() {
  return {
    _id: GLOBAL_AI_SETTINGS_ID,
    scope: 'global',
    key: 'ai',
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
    aiDefaultModelId: 'default'
  }
}

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
      apiKey: typeof model.apiKey === 'string' && model.apiKey && !model.apiKey.startsWith('***')
        ? model.apiKey
        : (existingModel.apiKey || '')
    }
  })
}

function getDefaultModel(models, defaultModelId) {
  if (!Array.isArray(models) || models.length === 0) return null
  return models.find((item) => item.id === defaultModelId) || models[0]
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

  return userId
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

exports.main = async (event) => {
  const {
    models,
    defaultModelId,
    aiEnabled,
    aiFallbackToRules
  } = event

  try {
    const adminUserId = await requireAdminUserId()
    const now = new Date()
    const existingSettings = await getGlobalAISettingsRaw()
    const baseSettings = existingSettings || getDefaultSettings()
    const existingModels = Array.isArray(baseSettings.aiModels) ? baseSettings.aiModels : []
    const normalizedModels = normalizeModels(models, existingModels) || existingModels
    const finalDefaultModelId = defaultModelId || baseSettings.aiDefaultModelId || normalizedModels[0]?.id || 'default'
    const syncedDefaultModel = getDefaultModel(normalizedModels, finalDefaultModelId)

    const update = {
      scope: 'global',
      key: 'ai',
      updatedAt: now,
      updatedBy: adminUserId,
      settingsVersion: 2,
      aiEnabled: !!aiEnabled,
      aiFallbackToRules: aiFallbackToRules !== false,
      aiModels: normalizedModels,
      aiDefaultModelId: finalDefaultModelId
    }

    if (syncedDefaultModel) {
      update.aiProvider = syncedDefaultModel.provider || 'openai-compatible'
      update.aiBaseUrl = syncedDefaultModel.baseUrl || 'https://api.openai.com/v1'
      update.aiModel = syncedDefaultModel.model || 'gpt-4o-mini'
      update.aiApiKey = syncedDefaultModel.apiKey || ''
    }

    if (!existingSettings) {
      await db.collection('system_settings').add({
        _id: GLOBAL_AI_SETTINGS_ID,
        createdAt: now,
        ...update
      })
    } else {
      await db.collection('system_settings').doc(existingSettings._id).update(update)
    }

    return { success: true }
  } catch (error) {
    if (error?.code === 'UNAUTHENTICATED') {
      return { success: false, message: '请先登录管理员账号' }
    }
    if (error?.code === 'ADMIN_REQUIRED') {
      return { success: false, message: '当前账号没有后台管理权限' }
    }
    console.error('updateAISettings error:', error)
    return { success: false, message: '更新AI设置失败' }
  }
}
