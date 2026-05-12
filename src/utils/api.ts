/**
 * API 灏佽灞?
 * 灏佽鎵€鏈変簯鍑芥暟璋冪敤
 */
import app, { callFunction, auth, storage } from './cloudbase'
import { resetCloudAuthState } from './cloudbase'
import { normalizeAvatarValue, resolveAvatarSrc } from './avatar'

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

async function normalizeCase(caseItem: any) {
  if (!caseItem || typeof caseItem !== 'object') return caseItem

  const timeline = Array.isArray(caseItem.timeline)
    ? caseItem.timeline.map(normalizeTimelineRecord)
    : []

  const profile = caseItem.profile && typeof caseItem.profile === 'object'
    ? { ...caseItem.profile }
    : caseItem.profile

  if (profile?.avatar) {
    profile.avatar = normalizeAvatarValue(profile.avatar)
    const avatarUrl = await resolveAvatarSrc(profile.avatar)
    profile.avatarUrl = avatarUrl || profile.avatar
  } else if (profile?.avatarUrl) {
    delete profile.avatarUrl
  }

  return {
    ...caseItem,
    caseId: caseItem.caseId || caseItem._id,
    profile,
    timeline
  }
}

function normalizeProfilePayload(profile: any) {
  if (!profile || typeof profile !== 'object') return profile
  return {
    ...profile,
    avatar: normalizeAvatarValue(profile.avatar)
  }
}

async function clearLocalAuthState() {
  await resetCloudAuthState()
}

function safeSetStorage(key: string, value: string) {
  try {
    uni.setStorageSync(key, value)
  } catch (error) {
    console.warn(`[api] setStorage ${key} failed:`, error)
  }
}

function safeSetStorageAny(key: string, value: any) {
  try {
    uni.setStorageSync(key, value)
  } catch (error) {
    console.warn(`[api] setStorage ${key} failed:`, error)
  }
}

function cacheSelfProfile(profile: any) {
  if (!profile || typeof profile !== 'object') return
  safeSetStorageAny('selfProfile', profile)
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

  throw new Error('褰撳墠 SDK 涓嶆敮鎸佽嚜瀹氫箟绁ㄦ嵁鐧诲綍')
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

// ==================== 璁よ瘉鐩稿叧 ====================

/**
 * 鐢ㄦ埛鐧诲綍
 */
export async function login(email: string, password: string) {
  console.log('[api] login start')
  await clearLocalAuthState()
  await ensureAnonymousAuth()

  console.log('[api] login call cloud function')
  const res = await app.callFunction({
    name: 'login',
    data: { email, password }
  })
  console.log('[api] login cloud function returned', res?.result)

  // #ifdef MP-WEIXIN
  if (res.result.success) {
    safeSetStorage('userId', res.result.userId)
    safeSetStorage('userEmail', res.result.email)
    cacheSelfProfile(res.result.selfProfile)
    return res.result
  }
  // #endif

  if (res.result.success && res.result.ticket) {
    try {
      await signInWithCustomTicketCompat(res.result.ticket)
    } catch (e) {
      console.error('绁ㄦ嵁鐧诲綍澶辫触:', e)
      return { success: false, message: '鐧诲綍鍑瘉鏍￠獙澶辫触锛岃閲嶈瘯' }
    }

    const verified = await verifyTicketLogin(res.result.userId)
    if (!verified) {
      console.error('鐧诲綍鎬佹牎楠屾湭閫氳繃')
      return { success: false, message: '鐧诲綍鎬佹湭鐢熸晥锛岃閲嶈瘯' }
    }

    safeSetStorage('userId', res.result.userId)
    safeSetStorage('userEmail', res.result.email)
    cacheSelfProfile(res.result.selfProfile)
  }

  return res.result
}

/**
 * 鐢ㄦ埛娉ㄥ唽
 */
export async function wechatLogin(code: string) {
  console.log('[api] wechatLogin start')
  await clearLocalAuthState()

  const res = await app.callFunction({
    name: 'wechatLogin',
    data: { code }
  })
  console.log('[api] wechatLogin cloud function returned', res?.result)

  if (res.result?.success) {
    safeSetStorage('userId', res.result.userId)
    safeSetStorage('userEmail', res.result.email || res.result.displayName || '')
    cacheSelfProfile(res.result.selfProfile)
    if (res.result.phoneMasked) {
      safeSetStorage('userPhone', res.result.phoneMasked)
    }
  }

  return res.result
}

export async function register(email: string, password: string) {
  console.log('[api] register start')
  await clearLocalAuthState()
  await ensureAnonymousAuth()

  console.log('[api] register call cloud function')
  const res = await app.callFunction({
    name: 'register',
    data: { email, password }
  })
  console.log('[api] register cloud function returned', res?.result)

  // #ifdef MP-WEIXIN
  if (res.result.success) {
    safeSetStorage('userId', res.result.userId)
    safeSetStorage('userEmail', res.result.email)
    cacheSelfProfile(res.result.selfProfile)
    return res.result
  }
  // #endif

  if (res.result.success && res.result.ticket) {
    try {
      await signInWithCustomTicketCompat(res.result.ticket)
    } catch (e) {
      console.error('绁ㄦ嵁鐧诲綍澶辫触:', e)
      return { success: false, message: '鐧诲綍鍑瘉鏍￠獙澶辫触锛岃閲嶈瘯' }
    }

    const verified = await verifyTicketLogin(res.result.userId)
    if (!verified) {
      console.error('鐧诲綍鎬佹牎楠屾湭閫氳繃')
      return { success: false, message: '鐧诲綍鎬佹湭鐢熸晥锛岃閲嶈瘯' }
    }

    safeSetStorage('userId', res.result.userId)
    safeSetStorage('userEmail', res.result.email)
    cacheSelfProfile(res.result.selfProfile)
  }

  return res.result
}

/**
 * 鐢ㄦ埛鐧诲嚭
 */
export async function logout() {
  await auth.signOut()

  // 娓呴櫎鏈湴瀛樺偍
  uni.removeStorageSync('userId')
  uni.removeStorageSync('userEmail')
  uni.removeStorageSync('userPhone')
  uni.removeStorageSync('selfProfile')
}

/**
 * 鑾峰彇褰撳墠鐢ㄦ埛 ID
 */
export function getCurrentUserId(): string | null {
  try {
    return uni.getStorageSync('userId') || null
  } catch (error) {
    console.warn('[api] getCurrentUserId storage read failed:', error)
    return null
  }
}

export type SelfProfile = {
  gender?: string
  ageRange?: string
  identity?: string
  zodiac?: string
  constellation?: string
  completedAt?: string
  updatedAt?: string
}

export function hasUsableSelfProfile(profile: any): boolean {
  if (!profile || typeof profile !== 'object') return false
  return Boolean(profile.gender && profile.ageRange && profile.identity)
}

export function isSelfProfileSkipped(userId?: string | null): boolean {
  const uid = String(userId || getCurrentUserId() || '').trim()
  if (!uid) return false
  try {
    return Boolean(uni.getStorageSync(`selfProfileSkipped:${uid}`))
  } catch {
    return false
  }
}

export function markSelfProfileSkipped(userId?: string | null) {
  const uid = String(userId || getCurrentUserId() || '').trim()
  if (!uid) return
  try {
    uni.setStorageSync(`selfProfileSkipped:${uid}`, true)
  } catch {}
}

export function getCachedSelfProfile(): SelfProfile | null {
  try {
    const profile = uni.getStorageSync('selfProfile')
    return profile && typeof profile === 'object' ? profile : null
  } catch {
    return null
  }
}

export function shouldCompleteSelfProfile(resultOrProfile?: any): boolean {
  const userId = resultOrProfile?.userId || getCurrentUserId()
  const profile = resultOrProfile?.selfProfile || resultOrProfile || getCachedSelfProfile()
  return !hasUsableSelfProfile(profile) && !isSelfProfileSkipped(userId)
}

export async function getSelfProfile() {
  const res = await callFunction({
    name: 'userProfile',
    data: { action: 'get' }
  })
  if (res.result?.success) {
    cacheSelfProfile(res.result.selfProfile)
  }
  return res.result
}

export async function updateSelfProfile(profile: SelfProfile) {
  const res = await callFunction({
    name: 'userProfile',
    data: { action: 'update', profile }
  })
  if (res.result?.success) {
    cacheSelfProfile(res.result.selfProfile)
  }
  return res.result
}

// ==================== 妗堜緥绠＄悊 ====================

/**
 * 鑾峰彇妗堜緥鍒楄〃
 */
export async function getCases(_userId?: string) {
  const res = await callFunction({
    name: 'getCases',
    data: {}
  })
  return Promise.all((res.result.cases || []).map(normalizeCase))
}

/**
 * 鍒涘缓妗堜緥
 */
export async function createCase(data: {
  userId?: string
  name: string
  answers: any[]
  profile: any
}) {
  const { userId: _userId, ...payload } = data
  payload.profile = normalizeProfilePayload(payload.profile)
  const res = await callFunction({
    name: 'createCase',
    data: payload
  })
  return res.result
}

/**
 * 鑾峰彇妗堜緥璇︽儏
 */
export async function getCaseDetail(_userId: string, caseId: string) {
  const res = await callFunction({
    name: 'getCaseDetail',
    data: { caseId }
  })
  if (!res.result?.success) {
    throw new Error(res.result?.message || '鑾峰彇妗ｆ璇︽儏澶辫触')
  }
  return await normalizeCase(res.result.case)
}

/**
 * 鍒犻櫎妗堜緥
 */
export async function deleteCase(_userId: string, caseId: string) {
  const res = await callFunction({
    name: 'deleteCase',
    data: { caseId }
  })
  return res.result
}

/**
 * 鏇存柊妗堜緥鐢诲儚
 */
export async function updateCaseProfile(data: {
  userId?: string
  caseId: string
  name?: string
  profile: any
}) {
  const { userId: _userId, ...payload } = data
  payload.profile = normalizeProfilePayload(payload.profile)
  const res = await callFunction({
    name: 'updateCaseProfile',
    data: payload
  })
  return res.result
}

// ==================== 鏃堕棿绾跨鐞?====================

/**
 * 鑾峰彇鏃堕棿绾胯褰?
 */
export async function getTimeline(_userId: string, caseId: string) {
  const res = await callFunction({
    name: 'getTimeline',
    data: { caseId }
  })
  return (res.result.timeline || []).map(normalizeTimelineRecord)
}

/**
 * 鍒涘缓鏃堕棿绾胯褰?
 */
export async function createTimeline(data: {
  userId?: string
  caseId: string
  title?: string
  type?: string
  description: string
  attachments?: any[]
  subjectRole?: 'target' | 'self' | 'both' | 'unknown' | string
  subjectRoleConfidence?: 'user_selected' | 'confirmed' | string
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
 * 鍒犻櫎鏃堕棿绾胯褰?
 */
export async function deleteTimeline(_userId: string, caseId: string, recordId: string) {
  const res = await callFunction({
    name: 'deleteTimeline',
    data: { caseId, recordId }
  })
  return res.result
}

/**
 * 閲嶆柊璇勪及
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

export async function analyzeAttachment(data: {
  fileID: string
  mediaType: 'image' | string
}) {
  const res = await callFunction({
    name: 'analyzeAttachment',
    data
  })
  return res.result
}

// ==================== 周复盘 ====================

export async function getWeeklyReviews(_userId: string, caseId: string) {
  const res = await callFunction({
    name: 'weeklyReview',
    data: { action: 'list', caseId }
  })
  if (!res.result?.success) {
    throw new Error(res.result?.message || '获取周复盘失败')
  }
  return res.result
}

export async function generateWeeklyReview(_userId: string, caseId: string, weekStart?: string) {
  const res = await callFunction({
    name: 'weeklyReview',
    data: { action: 'generate', caseId, weekStart }
  })
  if (!res.result?.success) {
    throw new Error(res.result?.message || '生成周复盘失败')
  }
  return res.result
}

// ==================== AI 璁剧疆 ====================

export type AIModelConfig = {
  id: string
  name: string
  provider: string
  baseUrl: string
  model: string
  apiKey: string
}

/**
 * 鑾峰彇 AI 璁剧疆
 */
export async function getAISettings(_userId?: string) {
  const res = await callFunction({
    name: 'getAISettings',
    data: {}
  })
  return res.result.settings
}

/**
 * 鏇存柊 AI 璁剧疆锛堟柊鐗堟湰锛屾敮鎸佸妯″瀷锛?
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

export async function adminGetOverview() {
  const res = await callFunction({
    name: 'adminManage',
    data: { action: 'getOverview' }
  })
  return res.result
}

export async function adminGetUserDetail(userId: string) {
  const res = await callFunction({
    name: 'adminManage',
    data: { action: 'getUserDetail', userId }
  })
  return res.result
}

export async function adminUpdateAISettings(data: {
  aiEnabled: boolean
  aiFallbackToRules: boolean
  models: AIModelConfig[]
  defaultModelId: string
}) {
  const res = await callFunction({
    name: 'adminManage',
    data: {
      action: 'updateAISettings',
      ...data
    }
  })
  return res.result
}

/**
 * 娴嬭瘯 AI 杩炴帴锛堟敮鎸侀€氳繃 modelId 娴嬭瘯鎸囧畾妯″瀷锛?
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

// ==================== 浜戝瓨鍌?====================

/**
 * 涓婁紶鏂囦欢鍒颁簯瀛樺偍
 */
export async function uploadFile(filePath: any, cloudPath: string) {
  const result = await storage({
    cloudPath,
    filePath
  })
  return result.fileID
}

/**
 * 鑾峰彇鏂囦欢涓存椂 URL
 */
export async function getTempFileURL(fileID: string) {
  const { fileList } = await app.getTempFileURL({
    fileList: [fileID]
  })
  return fileList[0]?.tempFileURL || ''
}
