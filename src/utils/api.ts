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
    isAdmin: Boolean(result.isAdmin || result.role === 'admin')
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
      title: 'Token 不足',
      content: `本月套餐剩余 ${monthlyRemaining} Token，加油包剩余 ${extraTokens} Token。本次预估消耗 ${required} Token。`,
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
      content: result.message || '次数已用完，请升级套餐或购买加油包。',
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
      title: '额度不足',
      content: `当前可用 ${balance} token，本次预估消耗 ${required} token。请充值后再试。`,
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

// ==================== 璁よ瘉鐩稿叧 ====================

/**
 * 鐢ㄦ埛鐧诲綍
 */
export async function login(email: string, password: string) {
  await clearLocalAuthState()
  await ensureAnonymousAuth()

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
      console.warn('票据登录失败，继续使用业务登录态:', e)
    }

    cacheLoginUser(res.result)

    const verified = await verifyTicketLogin(res.result.userId)
    if (!verified) {
      console.warn('CloudBase 登录态未及时生效，已使用业务登录态继续')
    }
  } else if (res.result.success) {
    cacheLoginUser(res.result)
  }

  return res.result
}

/**
 * 鐢ㄦ埛娉ㄥ唽
 */
export async function wechatLogin(code = '', profile: { nickName?: string; nickname?: string; avatarUrl?: string; loginCode?: string; inviteCode?: string } = {}) {
  await clearLocalAuthState()
  const phoneCode = String(code || '').trim()
  const nickName = String(profile.nickName || profile.nickname || '').trim()
  const avatarUrl = String(profile.avatarUrl || '').trim()
  const loginCode = String(profile.loginCode || '').trim()
  const inviteCode = String(profile.inviteCode || '').trim()

  const res = await app.callFunction({
    name: 'wechatLogin',
    data: {
      ...(phoneCode ? { code: phoneCode } : {}),
      ...(loginCode ? { loginCode } : {}),
      ...(nickName ? { nickName } : {}),
      ...(avatarUrl ? { avatarUrl } : {}),
      ...(inviteCode ? { inviteCode } : {})
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
  await ensureAnonymousAuth()

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
      console.warn('票据登录失败，继续使用业务登录态:', e)
    }

    cacheLoginUser(res.result)

    const verified = await verifyTicketLogin(res.result.userId)
    if (!verified) {
      console.warn('CloudBase 登录态未及时生效，已使用业务登录态继续')
    }
  } else if (res.result.success) {
    cacheLoginUser(res.result)
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
  uni.removeStorageSync('userDisplayName')
  uni.removeStorageSync('userNickName')
  uni.removeStorageSync('userAvatarUrl')
  uni.removeStorageSync('userRole')
  uni.removeStorageSync('userIsAdmin')
  uni.removeStorageSync('currentUser')
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
    throw new Error(res.result?.message || '获取档案详情失败')
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

export async function generatePetReplyPair(scene: string, content: string, tone?: string) {
  const res = await callFunction({
    name: 'petLines',
    data: { action: 'replyPair', scene, content, tone, ...getBusinessAuthPayload() }
  })
  return res.result
}

export async function generatePetReplyBundle(scene: string, content: string) {
  const res = await callFunction({
    name: 'petLines',
    data: { action: 'replyBundle', scene, content, ...getBusinessAuthPayload() }
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

export async function adminConfirmRecharge(orderId: string) {
  const res = await callFunction({
    name: 'recharge',
    data: { action: 'adminConfirmRecharge', orderId, ...getBusinessAuthPayload() }
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
export async function queryTaohua(zodiac: string, sign: string) {
  const res = await callFunction({
    name: 'queryTaohua',
    data: { zodiac, sign, ...getBusinessAuthPayload() }
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
    throw Object.assign(new Error(res.result?.message || '生成近14天星象速写失败'), res.result || {})
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
 * 娴嬭瘯 AI 杩炴帴锛堟敮鎸侀€氳繃 modelId 娴嬭瘯鎸囧畾妯″瀷锛?
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
