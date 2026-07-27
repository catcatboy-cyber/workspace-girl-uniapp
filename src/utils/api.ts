/**
 * API 封装层
 * 封装所有云函数调用
 */
import app, { callFunction, auth, storage, ensureCloudAuthReady } from './cloudbase'
import { resetCloudAuthState } from './cloudbase'
import { normalizeAvatarValue, resolveAvatarSrc } from './avatar'
import { feedPet } from './helpers'
import { normalizeSelfIdentity } from './identity'

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
    const avatarUrl = await resolveAvatarSrc(profile.avatar).catch(() => '')
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

function getReadableErrorMessage(error: any, fallback = '网络错误，请稍后重试') {
  const candidates = [
    error?.error_description,
    error?.message,
    error?.msg,
    error?.code,
    error?.error,
    error?.errMsg
  ]

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return fallback
}

export function formatLoginError(error: any) {
  return getReadableErrorMessage(error)
}

function safeSetStorage(key: string, value: string) {
  try {
    uni.setStorageSync(key, value)
  } catch (error) {
    void error
  }
}

function safeSetStorageAny(key: string, value: any) {
  try {
    uni.setStorageSync(key, value)
  } catch (error) {
    void error
  }
}

function cacheSelfProfile(profile: any) {
  if (!profile || typeof profile !== 'object') return
  const normalized = { ...profile, identity: normalizeSelfIdentity(profile.identity) }
  safeSetStorageAny('selfProfile', normalized)
}

function resolveLoginDisplayName(result: any) {
  return String(result?.displayName || result?.nickName || result?.nickname || result?.email || '').trim()
}

function cacheLoginUser(result: any) {
  if (!result || typeof result !== 'object') return
  const displayName = resolveLoginDisplayName(result)
  const nickName = String(result.nickName || result.nickname || '').trim()
  const avatarUrl = String(result.avatarUrl || '').trim()
  safeSetStorage('userId', result.userId || '')
  safeSetStorage('userEmail', result.email || '')
  safeSetStorage('userDisplayName', displayName)
  safeSetStorage('userNickName', nickName)
  safeSetStorage('userAvatarUrl', avatarUrl)
  safeSetStorage('userRole', result.role || (result.isAdmin ? 'admin' : 'user'))
  safeSetStorageAny('userIsAdmin', Boolean(result.isAdmin || result.role === 'admin'))
  safeSetStorageAny('currentUser', {
    id: result.userId || '',
    email: result.email || '',
    phone: result.phoneMasked || result.phone || '',
    displayName,
    nickName,
    avatarUrl,
    role: result.role || (result.isAdmin ? 'admin' : 'user'),
    isAdmin: Boolean(result.isAdmin || result.role === 'admin'),
    inviteCode: result.inviteCode || ''
  })
  cacheSelfProfile(result.selfProfile)
}

function getBusinessAuthPayload() {
  const userId = getCurrentUserId()
  return userId ? { userId, authUserId: userId } : {}
}

/**
 * 检查云函数返回结果，如果是 Token 不足则弹窗引导充值/升级。
 */
export function handleInsufficientBalance(result: any): boolean {
  // v3.2 Token 体系：TOKEN_INSUFFICIENT
  if (result?.code === 'TOKEN_INSUFFICIENT') {
    const monthlyRemaining = (result.monthlyRemaining || 0).toLocaleString()
    const extraTokens = (result.extraTokens || 0).toLocaleString()
    const required = (result.required || 0).toLocaleString()

    uni.showModal({
      title: 'Crush Credits 不足',
      content: `本月套餐剩余 ${monthlyRemaining} Crush Credits，加油包剩余 ${extraTokens} Crush Credits。本次预估消耗 ${required} Crush Credits。`,
      confirmText: '去充值',
      cancelText: '取消',
      success(res: any) {
        if (res.confirm) {
          uni.navigateTo({ url: '/pages/token-recharge/token-recharge' })
        }
      }
    })
    return true
  }

  // 兼容旧 QUOTA_EXCEEDED
  if (result?.code === 'QUOTA_EXCEEDED') {
    uni.showModal({
      title: '次数不足',
      content: result.message || '次数已用完，请购买月卡或 Crush Credits 加油包。',
      confirmText: '去充值',
      cancelText: '取消',
      success(res: any) {
        if (res.confirm) uni.navigateTo({ url: '/pages/token-recharge/token-recharge' })
      }
    })
    return true
  }

  // 旧 token 体系：INSUFFICIENT_BALANCE（保留兼容）
  if (result?.code === 'INSUFFICIENT_BALANCE') {
    const balance = (result.balance || 0).toLocaleString()
    const required = (result.required || 0).toLocaleString()
    uni.showModal({
      title: 'Crush Credits 不足',
      content: `当前可用 ${balance} Crush Credits，本次预估消耗 ${required} Crush Credits。请充值后再试。`,
      confirmText: '去充值',
      cancelText: '取消',
      success(res: any) {
        if (res.confirm) {
          uni.navigateTo({ url: '/pages/token-recharge/token-recharge' })
        }
      }
    })
    return true
  }
  return false
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
  // #ifndef MP-WEIXIN
  await ensureCloudAuthReady()
  // #endif

  const res = await app.callFunction({
    name: 'login',
    data: { email, password }
  })

  // #ifdef MP-WEIXIN
  if (res.result.success) {
    cacheLoginUser(res.result)
    return res.result
  }
  // #endif

  if (res.result.success && res.result.ticket) {
    try {
      await signInWithCustomTicketCompat(res.result.ticket)
    } catch (e) {
      void e
    }

    cacheLoginUser(res.result)

    const verified = await verifyTicketLogin(res.result.userId)
    if (!verified) {
      // Business login state is already cached; CloudBase auth will retry on later calls.
    }
  } else if (res.result.success) {
    cacheLoginUser(res.result)
  }

  return res.result
}

/**
 * 微信登录（也处理注册）
 */
export async function wechatLogin(code = '', profile: { nickName?: string; nickname?: string; avatarUrl?: string; loginCode?: string; inviteCode?: string; channel?: string; scene?: string; ref?: string; shareId?: string } = {}) {
  await clearLocalAuthState()
  const phoneCode = String(code || '').trim()
  const nickName = String(profile.nickName || profile.nickname || '').trim()
  const avatarUrl = String(profile.avatarUrl || '').trim()
  const loginCode = String(profile.loginCode || '').trim()
  const inviteCode = String(profile.inviteCode || '').trim()
  const landingChannel = String(profile.channel || '').trim()
  const landingScene = String(profile.scene || '').trim()
  const landingRef = String(profile.ref || '').trim()
  const landingShareId = String(profile.shareId || '').trim()

  const res = await app.callFunction({
    name: 'wechatLogin',
    data: {
      ...(phoneCode ? { code: phoneCode } : {}),
      ...(loginCode ? { loginCode } : {}),
      ...(nickName ? { nickName } : {}),
      ...(avatarUrl ? { avatarUrl } : {}),
      ...(inviteCode ? { inviteCode } : {}),
      ...(landingChannel ? { channel: landingChannel } : {}),
      ...(landingScene ? { scene: landingScene } : {}),
      ...(landingRef ? { ref: landingRef } : {}),
      ...(landingShareId ? { shareId: landingShareId } : {})
    }
  })

  if (res.result?.success) {
    cacheLoginUser(res.result)
    if (!res.result.email && res.result.displayName) {
      safeSetStorage('userEmail', res.result.displayName)
    }
    if (res.result.phoneMasked) {
      safeSetStorage('userPhone', res.result.phoneMasked)
    }
  }

  return res.result
}

export async function register(email: string, password: string, inviteCode?: string) {
  await clearLocalAuthState()
  // #ifndef MP-WEIXIN
  await ensureCloudAuthReady()
  // #endif

  const data: Record<string, any> = { email, password }
  if (inviteCode) data.inviteCode = inviteCode

  const res = await app.callFunction({
    name: 'register',
    data
  })

  // #ifdef MP-WEIXIN
  if (res.result.success) {
    cacheLoginUser(res.result)
    return res.result
  }
  // #endif

  if (res.result.success && res.result.ticket) {
    try {
      await signInWithCustomTicketCompat(res.result.ticket)
    } catch (e) {
      void e
    }

    cacheLoginUser(res.result)

    const verified = await verifyTicketLogin(res.result.userId)
    if (!verified) {
      // Business login state is already cached; CloudBase auth will retry on later calls.
    }
  } else if (res.result.success) {
    cacheLoginUser(res.result)
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
  uni.removeStorageSync('userPhone')
  uni.removeStorageSync('userDisplayName')
  uni.removeStorageSync('userNickName')
  uni.removeStorageSync('userAvatarUrl')
  uni.removeStorageSync('userRole')
  uni.removeStorageSync('userIsAdmin')
  uni.removeStorageSync('currentUser')
  uni.removeStorageSync('selfProfile')
}

/**
 * 获取当前用户 ID
 */
export function getCurrentUserId(): string | null {
  try {
    return uni.getStorageSync('userId') || null
  } catch (error) {
    void error
    return null
  }
}

export type AIStyleValue =
  | 'gentle_bestie'
  | 'calm_strategist'
  | 'playful_flirty'
  | 'direct_sharp'
  | 'careful_guardian'

export type AIBoldnessValue = 'conservative' | 'balanced' | 'bold'

export type SelfProfile = {
  gender?: string
  ageRange?: string
  identity?: string
  zodiac?: string
  constellation?: string
  aiStyle?: AIStyleValue
  aiBoldness?: AIBoldnessValue
  mbtiCode?: string
  nickname?: string
  avatarUrl?: string
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

// ==================== 案例管理 ====================

/**
 * 获取案例列表
 */
/** 分享访问记录：匿名 visit（fire-and-forget） */
export async function trackAnonymousVisit(params: { shareId?: string; channel?: string; scene?: string; inviteCode?: string; path?: string }) {
  try {
    await callFunction({ name: 'trackShareVisit', data: { action: 'anonymous', ...params } })
  } catch {}
}

/** 分享访问记录：登录后补写 */
export async function trackLoginVisit(params: { shareId?: string; channel?: string; scene?: string; inviteCode?: string; visitorUserId?: string; isNewUser?: boolean }) {
  try {
    await callFunction({ name: 'trackShareVisit', data: { action: 'login', ...params } })
  } catch {}
}

/** 快速解读：不依赖 caseId */
export async function quickRead(text: string, scene?: string, options?: { question?: string; ageRange?: string }) {
  const data: Record<string, any> = { text, ...(options || {}), ...getBusinessAuthPayload() }
  if (scene) data.scene = scene
  const res = await callFunction({
    name: 'quickRead',
    data
  })
  return res.result
}

/** 获取或创建默认 Crush（CTA 点击后才调用） */
export async function getOrCreateDefaultCase() {
  const cases = await getCases()
  if (cases.length === 0) {
    const result = await createCase({
      name: 'TA', answers: [],
      profile: { gender: null, age: null, zodiac: null, constellation: null, avatar: null }
    })
    if (result?.success) return result.case || result
    return null
  }
  return cases[0]
}

export async function getCases(_userId?: string, options?: {
  mode?: 'full' | 'home' | 'list' | 'count'
  detailCaseId?: string
}) {
  const res = await callFunction({
    name: 'getCases',
    data: options || {}
  })
  return Promise.all((res.result.cases || []).map(normalizeCase))
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
  payload.profile = normalizeProfilePayload(payload.profile)
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
  return await normalizeCase(res.result.case)
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
  payload.profile = normalizeProfilePayload(payload.profile)
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
  attachments?: any[]
  subjectRole?: 'target' | 'self' | 'both' | 'unknown' | string
  subjectRoleConfidence?: 'user_selected' | 'confirmed' | string
  userQuestion?: { key: string; label: string } | null
  occurrenceAt: string
}) {
  const { userId: _userId, ...payload } = data
  const res = await callFunction({
    name: 'createTimeline',
    data: payload
  })
  if (res.result?.success) {
    try {
      feedPet('record')
      // P2: 加时间戳用于 TTL 过期判断
      uni.setStorageSync('justRecorded', { ts: Date.now() })
    } catch {}
  }
  return res.result
}

export async function generateAssessmentAI(data: {
  caseId: string
  assessmentId: string
  recordId?: string
}) {
  const res = await callFunction({
    name: 'generateAssessmentAI',
    data
  })
  return res.result
}

export async function batchTagEvents(caseId: string) {
  const res = await callFunction({
    name: 'generateAssessmentAI',
    data: { action: 'batchTagEvents', caseId }
  })
  return res.result
}

export async function generateReplyStrategy(content: string, scene?: string) {
  const res = await callFunction({
    name: 'petLines',
    data: { action: 'replyStrategy', content, scene, ...getBusinessAuthPayload() }
  })
  return res.result
}

export async function generatePetReplyPair(scene: string, content: string, tone?: string, caseId?: string) {
  const res = await callFunction({
    name: 'petLines',
    data: { action: 'replyPair', scene, content, tone, caseId: caseId || '', ...getBusinessAuthPayload() }
  })
  return res.result
}

export async function generatePetReplyBundle(scene: string, content: string, caseId?: string) {
  const res = await callFunction({
    name: 'petLines',
    data: { action: 'replyBundle', scene, content, caseId: caseId || '', ...getBusinessAuthPayload() }
  })
  return res.result
}

export async function loadPetChatHistory(caseId?: string) {
  const res = await callFunction({
    name: 'petLines',
    data: { action: 'loadHistory', caseId: caseId || '', ...getBusinessAuthPayload() }
  })
  return res.result
}

export async function petChatMessage(data: {
  sessionId: string
  text: string
  messages?: Array<{ role: 'user' | 'pet'; text: string }>
  caseId?: string
  mode?: 'chat' | 'reply' | 'initiate' | 'strategy'
}) {
  const res = await callFunction({
    name: 'petLines',
    data: { action: 'chatMessage', ...data, caseId: data.caseId || '', ...getBusinessAuthPayload() }
  })
  return res.result
}

export async function pickQALines(content: string) {
  const res = await callFunction({
    name: 'petLines',
    data: { action: 'pickQA', content, ...getBusinessAuthPayload() }
  })
  return res.result
}

export async function pickQALinesV2(content: string) {
  const res = await callFunction({
    name: 'petLines',
    data: { action: 'pickQA_v2', content, ...getBusinessAuthPayload() }
  })
  return res.result
}

export async function pickQALinesV3(content: string) {
  const res = await callFunction({
    name: 'petLines',
    data: { action: 'pickQA_v3', content, ...getBusinessAuthPayload() }
  })
  return res.result
}

export async function generateSideRead(data: {
  caseId: string
}) {
  const res = await callFunction({
    name: 'generateSideRead',
    data
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
  source?: string
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

export async function speechToText(data: {
  fileID: string
  fileName?: string
  durationMs?: number
}) {
  const res = await callFunction({
    name: 'speechToText',
    data
  })
  return res.result
}

export async function getTokenUsage(limit = 50) {
  const res = await callFunction({
    name: 'getTokenUsage',
    data: { limit, ...getBusinessAuthPayload() }
  })
  return res.result
}

export async function getVoiceUsage(limit = 50) {
  const res = await callFunction({
    name: 'getVoiceUsage',
    data: { limit, ...getBusinessAuthPayload() }
  })
  return res.result
}

export async function getTokenAccount(action?: string) {
  const res = await callFunction({
    name: 'getTokenAccount',
    data: { action: action || 'getAccount', ...getBusinessAuthPayload() }
  })
  return res.result
}

export async function getTokenLedger(limit = 50) {
  const res = await callFunction({
    name: 'getCallUsageHistory',
    data: { action: 'all', limit, ...getBusinessAuthPayload() }
  })
  return res.result
}

export async function getRechargePlans() {
  const res = await callFunction({
    name: 'recharge',
    data: { action: 'getRechargePlans', ...getBusinessAuthPayload() }
  })
  return res.result
}

export async function createRechargeOrder(planId: string) {
  const res = await callFunction({
    name: 'recharge',
    data: { action: 'createRechargeOrder', planId, ...getBusinessAuthPayload() }
  })
  return res.result
}

export async function createSubscriptionPayment(
  planKey: string,
  options?: { billingCycle?: 'monthly' | 'annual'; priceVariant?: 'standard' | 'student' }
) {
  const res = await callFunction({
    name: 'recharge',
    data: { action: 'createSubscriptionUpgrade', planKey, ...(options || {}), ...getBusinessAuthPayload() }
  })
  return res.result
}

/** 统一下单（自研）— 一站式：创建DB订单 + 微信V3下单 + 生成支付参数 */
export async function unifiedOrder(params: {
  productType: 'recharge' | 'subscription'
  productId?: string
  planKey?: string
  billingCycle?: 'monthly' | 'annual'
  priceVariant?: 'standard' | 'student'
}) {
  const res = await callFunction({
    name: 'recharge',
    data: { action: 'unifiedOrder', ...params, ...getBusinessAuthPayload() }
  })
  return res.result
}

/** 主动查单（自研）— 微信 V3 查单，用于轮询兜底 */
export async function queryOrder(params: { orderNo: string }) {
  const res = await callFunction({
    name: 'recharge',
    data: { action: 'queryOrder', ...params, ...getBusinessAuthPayload() }
  })
  return res.result
}

export async function confirmPayment(options: { orderNo: string }) {
  const res = await callFunction({
    name: 'recharge',
    data: { action: 'confirmPayment', ...options, ...getBusinessAuthPayload() }
  })
  return res.result
}

export async function adminConfirmRecharge(orderId: string) {
  const res = await callFunction({
    name: 'recharge',
    data: { action: 'adminConfirmRecharge', orderId, ...getBusinessAuthPayload() }
  })
  return res.result
}

/** 虚拟支付：创建订单 + 获取签名 */
export async function createVirtualPayOrder(params: {
  productType: 'recharge' | 'subscription'
  productId?: string
  planKey?: string; billingCycle?: string; priceVariant?: string
  sandbox?: boolean
}) {
  // 虚拟支付用户态签名需要「新鲜」的 session_key —— 支付前重新 wx.login 拿 code，
  // 后端用它现换最新 session_key 来签 signature（DB 存量的可能已过期 → SIGNATURE_INVALID）
  let loginCode = ''
  // #ifdef MP-WEIXIN
  loginCode = await new Promise<string>((resolve) => {
    // @ts-ignore wx 为微信小程序全局
    wx.login({ success: (r: any) => resolve(r?.code || ''), fail: () => resolve('') })
  })
  // #endif
  const res = await callFunction({
    name: 'recharge',
    data: { action: 'createVirtualPayOrder', ...params, loginCode, ...getBusinessAuthPayload() }
  })
  return res.result
}

/** 虚拟支付：确认发货 */
export async function confirmVirtualPay(outTradeNo: string, wxOrderId?: string) {
  const res = await callFunction({
    name: 'recharge',
    data: { action: 'confirmVirtualPay', outTradeNo, wxOrderId: wxOrderId || '', ...getBusinessAuthPayload() }
  })
  return res.result
}

export async function adminManualRecharge(targetUserId: string, amountTokens: number, remark?: string) {
  const res = await callFunction({
    name: 'adminManage',
    data: {
      action: 'adminManualRecharge',
      targetUserId,
      amountTokens,
      remark: remark || '',
      ...getBusinessAuthPayload()
    }
  })
  return res.result
}

export async function adminGetOrders(params: { status?: string; page?: number; pageSize?: number } = {}) {
  const res = await callFunction({
    name: 'adminManage',
    data: {
      action: 'listOrders',
      status: params.status || '',
      page: params.page || 1,
      pageSize: params.pageSize || 20,
      ...getBusinessAuthPayload()
    }
  })
  return res.result
}

export async function adminRefundOrder(orderId: string) {
  const res = await callFunction({
    name: 'adminManage',
    data: { action: 'refundOrder', orderId, ...getBusinessAuthPayload() }
  })
  return res.result
}

export async function adminGetTokenLedger(userId: string, limit = 50) {
  const res = await callFunction({
    name: 'adminManage',
    data: { action: 'getTokenLedger', targetUserId: userId, limit, ...getBusinessAuthPayload() }
  })
  return res.result
}

// ==================== 订阅体系（平台 Token） ====================

/** 公开读取订阅配置（套餐/试用/奖励），无需登录 */
export async function getSubscriptionConfig() {
  const res = await callFunction({
    name: 'getSubscriptionConfig',
    data: {}
  })
  return res.result
}

/** 登录后读取用户订阅状态（plan / Token 余额） */
export async function getSubscriptionStatus() {
  const res = await callFunction({
    name: 'getSubscriptionStatus',
    data: { ...getBusinessAuthPayload() }
  })
  return res.result
}

/** 检查某个功能是否对当前用户可用 */
export async function checkFeatureAccess(featureKey: string) {
  const res = await callFunction({
    name: 'getSubscriptionStatus',
    data: { action: 'checkFeature', featureKey, ...getBusinessAuthPayload() }
  })
  return res.result
}

/** AI增强双人桃花解读 */
export async function generatePairRead(caseId: string) {
  const res = await callFunction({
    name: 'generatePairRead',
    data: { caseId, ...getBusinessAuthPayload() }
  })
  return res.result
}

/** 获取平台 Token 消费明细（已乘倍率） */
export async function queryTaohua(zodiac: string, sign: string, gender?: string, mbtiCode?: string) {
  const res = await callFunction({
    name: 'queryTaohua',
    data: { zodiac, sign, gender, mbtiCode, ...getBusinessAuthPayload() }
  })
  return res.result
}

export async function getConsumeHistory(limit = 100) {
  const res = await callFunction({
    name: 'getCallUsageHistory',
    data: { action: 'consume', limit, ...getBusinessAuthPayload() }
  })
  return res.result
}

/** 兑换邀请码 */
export async function redeemInviteCode(inviteCode: string) {
  const res = await callFunction({
    name: 'redeemInviteCode',
    data: { inviteCode, ...getBusinessAuthPayload() }
  })
  return res.result
}

/** Admin: 获取所有用户 Token 消耗汇总（平台 Token + 模型 Token） */
export async function adminGetUsersTokenConsumption(limit = 500) {
  const res = await callFunction({
    name: 'adminManage',
    data: { action: 'getUsersTokenConsumption', limit, ...getBusinessAuthPayload() }
  })
  return res.result
}

/** Admin: 单用户 Token 消费明细 */
export async function adminGetUserTokenDetails(userId: string, limit = 200) {
  const res = await callFunction({
    name: 'adminManage',
    data: { action: 'getUserTokenDetails', targetUserId: userId, limit, ...getBusinessAuthPayload() }
  })
  return res.result
}

/** Admin: 邀请奖励列表 */
export async function adminListReferralClaims() {
  const res = await callFunction({
    name: 'adminManage',
    data: { action: 'listReferralClaims', ...getBusinessAuthPayload() }
  })
  return res.result
}

/** Admin: 删除用户及其所有关联数据 */
export async function adminDeleteUser(targetUserId: string) {
  const res = await callFunction({
    name: 'adminManage',
    data: { action: 'deleteUser', targetUserId, ...getBusinessAuthPayload() }
  })
  return res.result
}

/** Admin: 读取订阅配置 */
export async function adminGetSubscriptionConfig() {
  const res = await callFunction({
    name: 'adminManage',
    data: { action: 'getSubscriptionConfig', ...getBusinessAuthPayload() }
  })
  return res.result
}

/** Admin: 更新订阅配置 */
export async function adminUpdateSubscriptionConfig(data: Record<string, any>) {
  const res = await callFunction({
    name: 'adminManage',
    data: { action: 'updateSubscriptionConfig', ...data, ...getBusinessAuthPayload() }
  })
  return res.result
}

/** Admin: 编辑用户信息（套餐/试用期/Token/权限等） */
export async function adminUpdateUser(userId: string, patch: Record<string, any>) {
  const res = await callFunction({
    name: 'adminManage',
    data: { action: 'adminUpdateUser', ...getBusinessAuthPayload(), userId, ...patch }
  })
  return res.result
}

/** Admin: 手动给用户加 Token */
export async function adminGrantExtraCalls(targetUserId: string, amount: number, remark?: string) {
  const res = await callFunction({
    name: 'adminManage',
    data: {
      action: 'adminGrantExtraCalls',
      targetUserId,
      amount,
      remark: remark || '',
      ...getBusinessAuthPayload()
    }
  })
  return res.result
}

// ==================== 月度复盘 ====================

export async function getMonthlyReviews(_userId: string, caseId: string) {
  const res = await callFunction({
    name: 'weeklyReview',
    data: { action: 'list', caseId }
  })
  if (!res.result?.success) {
    throw new Error(res.result?.message || '获取月度复盘失败')
  }
  return res.result
}

export async function generateMonthlyReview(_userId: string, caseId: string, monthStart?: string) {
  const res = await callFunction({
    name: 'weeklyReview',
    data: { action: 'generate', caseId, monthStart }
  })
  if (!res.result?.success) {
    throw Object.assign(new Error(res.result?.message || '生成月度复盘失败'), res.result || {})
  }
  return res.result
}

export async function generateMonthlySideRead(_userId: string, caseId: string, monthStart?: string) {
  const res = await callFunction({
    name: 'weeklyReview',
    data: { action: 'generateSideRead', caseId, monthStart }
  })
  if (!res.result?.success) {
    throw Object.assign(new Error(res.result?.message || '生成星座侧写失败'), res.result || {})
  }
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

export type AIPromptModuleConfig = {
  enabled: boolean
  goal: string
  rules: string[]
  extraPrompt: string
}

export type AIPromptConfig = {
  eventAssessment: AIPromptModuleConfig
  eventUnderstanding: AIPromptModuleConfig
  weeklyReview: AIPromptModuleConfig
  sideRead: AIPromptModuleConfig
  attachmentAnalysis: AIPromptModuleConfig
}

export type AIPersonaItemConfig = {
  labelZh: string
  labelEn: string
  promptZh: string
  promptEn: string
}

export type AIPersonaConfig = {
  styles: Record<string, AIPersonaItemConfig>
  boldness: Record<string, AIPersonaItemConfig>
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
  promptConfig?: Partial<AIPromptConfig>
  promptModules?: Record<string, any>
  personaConfig?: Partial<AIPersonaConfig>
  runtimeConfig?: Record<string, number>
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
    data: { action: 'getOverview', ...getBusinessAuthPayload() }
  })
  return res.result
}

export async function adminGetUserDetail(userId: string) {
  const res = await callFunction({
    name: 'adminManage',
    data: { action: 'getUserDetail', targetUserId: userId, ...getBusinessAuthPayload() }
  })
  return res.result
}

export async function adminUpdateAISettings(data: {
  aiEnabled: boolean
  aiFallbackToRules: boolean
  models: AIModelConfig[]
  defaultModelId: string
  promptConfig?: Partial<AIPromptConfig>
  promptModules?: Record<string, any>
  personaConfig?: Partial<AIPersonaConfig>
  runtimeConfig?: Record<string, number>
}) {
  const res = await callFunction({
    name: 'adminManage',
    data: {
      action: 'updateAISettings',
      ...getBusinessAuthPayload(),
      ...data
    }
  })
  return res.result
}

export async function adminGetBillingSettings() {
  const res = await callFunction({
    name: 'adminManage',
    data: { action: 'getBillingSettings', ...getBusinessAuthPayload() }
  })
  return res.result
}

export async function adminUpdateBillingSettings(data: Record<string, any>) {
  const res = await callFunction({
    name: 'adminManage',
    data: {
      action: 'updateBillingSettings',
      ...getBusinessAuthPayload(),
      ...data
    }
  })
  return res.result
}

/**
 * 测试 AI 连接（支持通过 modelId 测试指定模型）
 */
export async function adminListFeedbacks() {
  return callFunction({ name: 'adminManage', data: { action: 'listFeedbacks', ...getBusinessAuthPayload() } }).then((res: any) => res.result)
}

export async function adminResolveFeedback(feedbackId: string, rewardTokens: number, targetUserId?: string) {
  return callFunction({
    name: 'adminManage',
    data: { action: 'resolveFeedback', feedbackId, rewardTokens, targetUserId, ...getBusinessAuthPayload() }
  }).then((res: any) => res.result)
}

export async function adminListCustomPetRequests() {
  return callFunction({ name: 'adminManage', data: { action: 'listCustomPetRequests', ...getBusinessAuthPayload() } }).then((res: any) => res.result)
}

export async function adminUpdateCustomPetRequest(requestId: string, data: { status: string; adminNote?: string; deliveredPetId?: string }) {
  return callFunction({
    name: 'adminManage',
    data: { action: 'updateCustomPetRequest', requestId, ...getBusinessAuthPayload(), ...data }
  }).then((res: any) => res.result)
}

export async function adminPreviewPrompt(data: {
  moduleKey?: string
  caseId?: string
  recordContent: string
  draftSettings?: Record<string, any>
}) {
  const res = await callFunction({
    name: 'adminManage',
    data: {
      action: 'previewPrompt',
      ...getBusinessAuthPayload(),
      ...data
    }
  })
  return res.result
}

export async function getLoginLogs(params?: {
  userId?: string
  email?: string
  loginType?: string
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}) {
  const auth = getBusinessAuthPayload()
  return callFunction({ name: 'getLoginLogs', data: { ...(params || {}), authUserId: auth.authUserId } }).then((res: any) => res.result)
}

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

// ==================== 内容安全 ====================

/**
 * 检测图片内容安全（调用微信 msgSecCheck）
 * 应在图片上传到云存储后、业务使用前调用。
 * @returns pass=true 表示安全，pass=false 表示违规
 */
export async function contentSecCheck(fileID: string): Promise<{ pass: boolean }> {
  try {
    const res = await callFunction({
      name: 'contentSecCheck',
      data: { action: 'checkImage', fileID }
    })
    return res.result || { pass: true }
  } catch {
    // API 不可用时降级放行
    return { pass: true }
  }
}

// ==================== 云存储 ====================

/**
 * 上传文件到云存储
 */
export async function uploadFile(filePath: any, cloudPath: string) {
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
