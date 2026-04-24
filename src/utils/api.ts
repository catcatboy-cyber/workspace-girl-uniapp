/**
 * API 封装层
 * 封装所有云函数调用
 */
import app, { callFunction, auth, storage } from './cloudbase'
import { resetCloudAuthState } from './cloudbase'

function toTimestamp(value: any): number | null {
  if (!value) return null
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? null : parsed
}

function formatTimelineDisplayDate(value: any): string {
  const timestamp = toTimestamp(value)
  if (timestamp === null) return '时间未说明'

  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
}

function normalizeTimelineRecord(record: any) {
  if (!record || typeof record !== 'object') return record

  const fallbackDate = formatTimelineDisplayDate(record.occurrenceAt || record.createdAt)
  return {
    ...record,
    id: record.id || record._id,
    date: typeof record.date === 'string' && record.date.trim()
      ? record.date
      : typeof record.dateLabel === 'string' && record.dateLabel.trim()
        ? record.dateLabel.trim()
        : fallbackDate,
    dateLabel: typeof record.dateLabel === 'string' && record.dateLabel.trim()
      ? record.dateLabel.trim()
      : fallbackDate
  }
}

function normalizeCase(caseItem: any) {
  if (!caseItem || typeof caseItem !== 'object') return caseItem

  const timeline = Array.isArray(caseItem.timeline)
    ? caseItem.timeline.map(normalizeTimelineRecord)
    : []

  return {
    ...caseItem,
    caseId: caseItem.caseId || caseItem._id,
    timeline
  }
}

async function clearLocalAuthState() {
  await resetCloudAuthState()
}

async function ensureAnonymousAuth() {
  try {
    const loginState = await auth.getLoginState()
    if (loginState) return
  } catch {
    // ignore
  }
  try {
    await (auth as any).anonymousAuthProvider().signIn()
  } catch (error) {
    console.warn('anonymous sign-in failed:', error)
  }
}

async function signInWithCustomTicketCompat(ticket: string) {
  const authAny = auth as any

  if (typeof authAny?.customAuthProvider === 'function') {
    const provider = authAny.customAuthProvider()
    if (provider && typeof provider.signIn === 'function') {
      await provider.signIn(ticket)
      return
    }
  }

  if (authAny?.setCustomSignFunc && authAny?.oauthInstance?.authApi?.signInWithCustomTicket) {
    authAny.setCustomSignFunc(() => Promise.resolve(ticket))
    await authAny.oauthInstance.authApi.signInWithCustomTicket()
    return
  }

  if (typeof authAny?.signInWithTicket === 'function') {
    await authAny.signInWithTicket(ticket)
    return
  }

  if (typeof authAny?.signInWithCustomTicket === 'function') {
    const result = await authAny.signInWithCustomTicket(() => Promise.resolve(ticket))
    if ((result as any)?.error) {
      throw (result as any).error
    }
    return
  }

  throw new Error('当前 SDK 不支持自定义票据登录')
}

async function verifyTicketLogin(expectedUserId: string, maxRetries = 10): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const loginState: any = await auth.getLoginState()
      const user = loginState?.user || {}
      const customUserId =
        user.uid ||
        user.customUserId ||
        user.userId ||
        loginState?.customUserId ||
        ''
      if (customUserId) {
        return customUserId === expectedUserId
      }
    } catch {
      // ignore
    }
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  return false
}

// ==================== 认证相关 ====================

/**
 * 用户登录
 */
export async function login(email: string, password: string) {
  await clearLocalAuthState()
  await ensureAnonymousAuth()

  const res = await app.callFunction({
    name: 'login',
    data: { email, password }
  })

  if (res.result.success && res.result.ticket) {
    try {
      await signInWithCustomTicketCompat(res.result.ticket)
    } catch (e) {
      console.error('票据登录失败:', e)
      return { success: false, message: '登录凭证校验失败，请重试' }
    }

    const verified = await verifyTicketLogin(res.result.userId)
    if (!verified) {
      console.error('登录态校验未通过')
      return { success: false, message: '登录态未生效，请重试' }
    }

    uni.setStorageSync('userId', res.result.userId)
    uni.setStorageSync('userEmail', res.result.email)
  }

  return res.result
}

/**
 * 用户注册
 */
export async function register(email: string, password: string) {
  await clearLocalAuthState()
  await ensureAnonymousAuth()

  const res = await app.callFunction({
    name: 'register',
    data: { email, password }
  })

  if (res.result.success && res.result.ticket) {
    try {
      await signInWithCustomTicketCompat(res.result.ticket)
    } catch (e) {
      console.error('票据登录失败:', e)
      return { success: false, message: '登录凭证校验失败，请重试' }
    }

    const verified = await verifyTicketLogin(res.result.userId)
    if (!verified) {
      console.error('登录态校验未通过')
      return { success: false, message: '登录态未生效，请重试' }
    }

    uni.setStorageSync('userId', res.result.userId)
    uni.setStorageSync('userEmail', res.result.email)
  }

  return res.result
}

/**
 * 用户登出
 */
export async function logout() {
  await auth.signOut()

  // 清除本地存储
  uni.removeStorageSync('userId')
  uni.removeStorageSync('userEmail')
}

/**
 * 获取当前用户 ID
 */
export function getCurrentUserId(): string | null {
  return uni.getStorageSync('userId') || null
}

// ==================== 案例管理 ====================

/**
 * 获取案例列表
 */
export async function getCases(_userId?: string) {
  const res = await callFunction({
    name: 'getCases',
    data: {}
  })
  return (res.result.cases || []).map(normalizeCase)
}

/**
 * 创建案例
 */
export async function createCase(data: {
  userId?: string
  name: string
  answers: any[]
  profile: any
}) {
  const { userId: _userId, ...payload } = data
  const res = await callFunction({
    name: 'createCase',
    data: payload
  })
  return res.result
}

/**
 * 获取案例详情
 */
export async function getCaseDetail(_userId: string, caseId: string) {
  const res = await callFunction({
    name: 'getCaseDetail',
    data: { caseId }
  })
  if (!res.result?.success) {
    throw new Error(res.result?.message || '获取档案详情失败')
  }
  return normalizeCase(res.result.case)
}

/**
 * 删除案例
 */
export async function deleteCase(_userId: string, caseId: string) {
  const res = await callFunction({
    name: 'deleteCase',
    data: { caseId }
  })
  return res.result
}

/**
 * 更新案例画像
 */
export async function updateCaseProfile(data: {
  userId?: string
  caseId: string
  name?: string
  profile: any
}) {
  const { userId: _userId, ...payload } = data
  const res = await callFunction({
    name: 'updateCaseProfile',
    data: payload
  })
  return res.result
}

// ==================== 时间线管理 ====================

/**
 * 获取时间线记录
 */
export async function getTimeline(_userId: string, caseId: string) {
  const res = await callFunction({
    name: 'getTimeline',
    data: { caseId }
  })
  return (res.result.timeline || []).map(normalizeTimelineRecord)
}

/**
 * 创建时间线记录
 */
export async function createTimeline(data: {
  userId?: string
  caseId: string
  title?: string
  type?: string
  description: string
  occurrenceAt: string
}) {
  const { userId: _userId, ...payload } = data
  const res = await callFunction({
    name: 'createTimeline',
    data: payload
  })
  return res.result
}

/**
 * 删除时间线记录
 */
export async function deleteTimeline(_userId: string, caseId: string, recordId: string) {
  const res = await callFunction({
    name: 'deleteTimeline',
    data: { caseId, recordId }
  })
  return res.result
}

/**
 * 重新评估
 */
export async function reassess(data: {
  userId?: string
  caseId: string
  answers: any[]
}) {
  const { userId: _userId, ...payload } = data
  const res = await callFunction({
    name: 'reassess',
    data: payload
  })
  return res.result
}

// ==================== AI 设置 ====================

export type AIModelConfig = {
  id: string
  name: string
  provider: string
  baseUrl: string
  model: string
  apiKey: string
}

/**
 * 获取 AI 设置
 */
export async function getAISettings(_userId?: string) {
  const res = await callFunction({
    name: 'getAISettings',
    data: {}
  })
  return res.result.settings
}

/**
 * 更新 AI 设置（新版本，支持多模型）
 */
export async function updateAISettings(data: {
  userId?: string
  aiEnabled: boolean
  aiFallbackToRules: boolean
  models: AIModelConfig[]
  defaultModelId: string
}) {
  const { userId: _userId, ...payload } = data
  const res = await callFunction({
    name: 'updateAISettings',
    data: payload
  })
  return res.result
}

/**
 * 测试 AI 连接（支持通过 modelId 测试指定模型）
 */
export async function testAIConnection(data: {
  userId?: string
  modelId?: string
  aiProvider?: string
  aiApiKey?: string
  aiBaseUrl?: string
  aiModel?: string
}) {
  const { userId: _userId, ...payload } = data
  const res = await callFunction({
    name: 'testAIConnection',
    data: payload
  })
  return res.result
}

// ==================== 云存储 ====================

/**
 * 上传文件到云存储
 */
export async function uploadFile(filePath: string, cloudPath: string) {
  const result = await storage({
    cloudPath,
    filePath
  })
  return result.fileID
}

/**
 * 获取文件临时 URL
 */
export async function getTempFileURL(fileID: string) {
  const { fileList } = await app.getTempFileURL({
    fileList: [fileID]
  })
  return fileList[0]?.tempFileURL || ''
}
