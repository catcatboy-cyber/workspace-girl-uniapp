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

function toISO(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

function redactKey(key) {
  if (!key || typeof key !== 'string') return ''
  if (key.length <= 4) return '***'
  return `***${key.slice(-4)}`
}

function redactSettings(settings) {
  if (!settings) return null
  const clone = { ...settings }
  if (Array.isArray(clone.aiModels)) {
    clone.aiModels = clone.aiModels.map((model) => ({
      ...model,
      apiKey: model.apiKey ? redactKey(model.apiKey) : '',
      hasApiKey: Boolean(model.apiKey)
    }))
  }
  if (clone.aiApiKey) {
    clone.aiApiKey = redactKey(clone.aiApiKey)
  }
  return clone
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
    const existing = existingModels.find((item) => item.id === model.id) || {}
    return {
      id: model.id || existing.id || (index === 0 ? 'default' : `model_${index + 1}`),
      name: model.name || existing.name || '默认模型',
      provider: model.provider || existing.provider || 'openai-compatible',
      baseUrl: model.baseUrl || existing.baseUrl || 'https://api.openai.com/v1',
      model: model.model || existing.model || 'gpt-4o-mini',
      apiKey: typeof model.apiKey === 'string' && model.apiKey && !model.apiKey.startsWith('***')
        ? model.apiKey
        : (existing.apiKey || '')
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

async function getUserById(userId) {
  const res = await db.collection('users').doc(userId).get()
  return normalizeDoc(res)
}

async function requireAdminUser() {
  const userId = await getStrictAuthUserId()
  const user = await getUserById(userId)
  const adminEmails = normalizeList(process.env.ADMIN_EMAILS)
  const email = String(user?.email || '').trim().toLowerCase()
  const isAdmin = Boolean(user?.isAdmin) || user?.role === 'admin' || adminEmails.includes(email)

  if (!isAdmin) {
    const error = new Error('ADMIN_REQUIRED')
    error.code = 'ADMIN_REQUIRED'
    throw error
  }

  return { userId, user }
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

async function getOverview() {
  const [usersRes, casesRes, settings] = await Promise.all([
    db.collection('users').limit(100).get(),
    db.collection('cases').limit(1000).get(),
    getGlobalAISettingsRaw()
  ])

  const cases = casesRes.data || []
  const caseCountByUser = cases.reduce((map, item) => {
    const userId = item.userId || ''
    if (userId) map[userId] = (map[userId] || 0) + 1
    return map
  }, {})

  const users = (usersRes.data || []).map((user) => ({
    id: user._id,
    email: user.email || '',
    phone: user.phone || '',
    loginType: user.loginType || (user.phone ? 'wechat_phone' : 'email'),
    role: user.role || (user.isAdmin ? 'admin' : 'user'),
    isAdmin: Boolean(user.isAdmin) || user.role === 'admin',
    caseCount: caseCountByUser[user._id] || 0,
    createdAt: toISO(user.createdAt),
    updatedAt: toISO(user.updatedAt),
    lastLoginAt: toISO(user.lastLoginAt)
  }))

  return {
    success: true,
    users,
    stats: {
      userCount: users.length,
      caseCount: cases.length,
      aiEnabled: Boolean(settings?.aiEnabled)
    },
    aiSettings: redactSettings(settings || getDefaultSettings())
  }
}

async function getUserDetail(event) {
  const userId = String(event.userId || '').trim()
  if (!userId) return { success: false, message: '缺少用户 ID' }

  const [user, casesRes] = await Promise.all([
    getUserById(userId),
    db.collection('cases').where({ userId }).limit(100).get()
  ])

  if (!user) return { success: false, message: '用户不存在' }

  const cases = casesRes.data || []
  const caseIds = cases.map((item) => item._id)
  const [timelineGroups, assessmentGroups] = await Promise.all([
    Promise.all(caseIds.map((caseId) => db.collection('timeline_records').where({ caseId }).limit(100).get())),
    Promise.all(caseIds.map((caseId) => db.collection('assessments').where({ caseId }).limit(100).get()))
  ])

  return {
    success: true,
    user: {
      id: user._id,
      email: user.email || '',
      phone: user.phone || '',
      loginType: user.loginType || '',
      role: user.role || (user.isAdmin ? 'admin' : 'user'),
      createdAt: toISO(user.createdAt),
      updatedAt: toISO(user.updatedAt),
      lastLoginAt: toISO(user.lastLoginAt)
    },
    cases: cases.map((item, index) => ({
      id: item._id,
      name: item.name || item.profile?.name || '未命名对象',
      createdAt: toISO(item.createdAt),
      updatedAt: toISO(item.updatedAt),
      latestResultId: item.latestResultId || '',
      timelineCount: (timelineGroups[index].data || []).length,
      assessmentCount: (assessmentGroups[index].data || []).length
    }))
  }
}

async function updateAISettings(event, adminUserId) {
  const existing = await getGlobalAISettingsRaw()
  const base = existing || getDefaultSettings()
  const existingModels = Array.isArray(base.aiModels) ? base.aiModels : []
  const normalizedModels = normalizeModels(event.models, existingModels) || existingModels
  const defaultModelId = event.defaultModelId || base.aiDefaultModelId || normalizedModels[0]?.id || 'default'
  const defaultModel = getDefaultModel(normalizedModels, defaultModelId)
  const now = new Date()

  const update = {
    scope: 'global',
    key: 'ai',
    settingsVersion: 2,
    aiEnabled: Boolean(event.aiEnabled),
    aiFallbackToRules: event.aiFallbackToRules !== false,
    aiModels: normalizedModels,
    aiDefaultModelId: defaultModelId,
    aiProvider: defaultModel?.provider || 'openai-compatible',
    aiBaseUrl: defaultModel?.baseUrl || 'https://api.openai.com/v1',
    aiModel: defaultModel?.model || 'gpt-4o-mini',
    aiApiKey: defaultModel?.apiKey || '',
    updatedAt: now,
    updatedBy: adminUserId
  }

  if (!existing) {
    await db.collection('system_settings').add({
      _id: GLOBAL_AI_SETTINGS_ID,
      createdAt: now,
      ...update
    })
  } else {
    await db.collection('system_settings').doc(existing._id).update(update)
  }

  const saved = await getGlobalAISettingsRaw()
  return { success: true, aiSettings: redactSettings(saved) }
}

exports.main = async (event = {}) => {
  try {
    const { userId } = await requireAdminUser()
    const action = String(event.action || '').trim()

    if (action === 'getOverview') return await getOverview()
    if (action === 'getUserDetail') return await getUserDetail(event)
    if (action === 'updateAISettings') return await updateAISettings(event, userId)

    return { success: false, message: '未知后台操作' }
  } catch (error) {
    if (error?.code === 'UNAUTHENTICATED' || error?.message === 'UNAUTHENTICATED') {
      return { success: false, message: '请先登录管理员账号', code: 'UNAUTHENTICATED' }
    }
    if (error?.code === 'ADMIN_REQUIRED' || error?.message === 'ADMIN_REQUIRED') {
      return { success: false, message: '当前账号没有后台管理权限', code: 'ADMIN_REQUIRED' }
    }
    console.error('adminManage error:', error)
    return { success: false, message: '后台操作失败' }
  }
}
