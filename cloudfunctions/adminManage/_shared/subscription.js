/**
 * Dom-Crush 平台 Token 订阅体系 — 共享模块 v3.2
 *
 * 设计原则：
 * - 不改动现有 billing.js / token-usage.js，纯新增
 * - 用户用"平台 Token"，后台配兑换倍率
 * - 消耗 = AI实际token × 兑换倍率
 * - 回退方式：删掉 AI 函数中的新增调用即可
 */

const SYSTEM_SETTINGS = 'system_settings'
const USERS = 'users'
const SUBSCRIPTION_DOC_ID = 'settings_subscription'
const CALL_USAGE = 'call_usage_records'

// ─── 默认配置 ───────────────────────────────────────────

const DEFAULT_SUBSCRIPTION_CONFIG = {
  _id: SUBSCRIPTION_DOC_ID,
  scope: 'global',
  key: 'subscription',
  configVersion: 3,

  trial: {
    enabled: true,
    durationDays: 7,
    extendOnReferral: 3,
    features: ['记录', '时间轴', '规则分析', '即时反馈', '事件理解', '周复盘', '附件识别', '星象速写', '小咪帮你说（单轮）'],
    excludedFeatures: ['小咪多轮策略', '自定义宠物', '自定义AI风格']
  },

  plans: {
    free: {
      name: '免费版',
      monthlyTokens: 30000,
      maxCrushes: 1,
      features: ['记录', '时间轴', '规则分析', '即时反馈', '事件理解', '周复盘', '附件识别'],
      excludedFeatures: ['星象速写', '小咪帮你说', '自定义宠物', '自定义AI风格', '小咪多轮策略']
    },
    pro: {
      name: 'Pro',
      priceYuan: 19,
      priceYuanAnnual: 168,
      priceYuanStudent: 12,
      priceYuanStudentAnnual: 99,
      monthlyTokens: 300000,
      maxCrushes: 3,
      features: ['免费版全部', '星象速写', '小咪帮你说（单轮）'],
      excludedFeatures: ['小咪多轮策略', '自定义宠物', '自定义AI风格']
    },
    ultra: {
      name: '无限版',
      priceYuan: 39,
      priceYuanAnnual: 298,
      priceYuanStudent: 25,
      priceYuanStudentAnnual: 199,
      monthlyTokens: -1,   // -1 = 不限
      maxCrushes: -1,
      features: ['Pro全部', '小咪多轮策略', '自定义宠物', '自定义AI风格'],
      excludedFeatures: []
    }
  },

  referral: {
    enabled: true,
    inviterRewardTokens: 3000,
    inviterTrialExtendDays: 3,
    inviteeRewardTokens: 5000,
    inviteeRewardLabel: '好友邀请奖励',
    weeklyInviteCap: 5,
    requireFirstEvent: true
  }
}

// ─── 配置管理 ───────────────────────────────────────────

/**
 * 确保 settings_subscription 文档存在，不存在则用默认值创建
 * 参考 _shared/billing.js 的 ensureBillingSettings 模式
 */
async function ensureSubscriptionConfig(db) {
  try {
    const { data } = await db.collection(SYSTEM_SETTINGS).doc(SUBSCRIPTION_DOC_ID).get()
    if (data && data.length > 0) {
      const existing = data[0]
      // 自动补全新字段（向后兼容旧版配置，每次读取时检查）
      let needsUpdate = false
      const set = (obj, key, defaultVal) => { if (obj[key] === undefined || obj[key] === null) { obj[key] = defaultVal; needsUpdate = true } }
      set(existing, 'configVersion', DEFAULT_SUBSCRIPTION_CONFIG.configVersion)
      // 删除已迁移到 billing 的冗余字段
      if (existing.tokenExchangeRate !== undefined) { delete existing.tokenExchangeRate; needsUpdate = true }
      if (existing.featureEstTokens !== undefined) { delete existing.featureEstTokens; needsUpdate = true }
      if (existing.welcomeTokens !== undefined) { delete existing.welcomeTokens; needsUpdate = true }
      if (existing.welcomeCalls !== undefined) { delete existing.welcomeCalls; needsUpdate = true }
      for (const key of ['free', 'pro', 'ultra']) {
        const plan = existing.plans?.[key]
        if (!plan) continue
        // 优先用 monthlyTokens，没有则从 monthlyCalls 换算
        if (plan.monthlyTokens === undefined || plan.monthlyTokens === null) {
          const oldVal = plan.monthlyCalls
          plan.monthlyTokens = (oldVal === -1 || oldVal === undefined) ? -1 : (oldVal || 0) * 1500
          needsUpdate = true
        }
        // 删除旧字段避免混淆
        if (plan.monthlyCalls !== undefined) {
          delete plan.monthlyCalls
          needsUpdate = true
        }
      }
      if (existing.referral) {
        set(existing.referral, 'inviterRewardTokens', (existing.referral.inviterRewardCalls || 3) * 1000)
        set(existing.referral, 'inviteeRewardTokens', (existing.referral.inviteeRewardCalls || 5) * 1000)
        if (existing.referral.inviterRewardCalls !== undefined) { delete existing.referral.inviterRewardCalls; needsUpdate = true }
        if (existing.referral.inviteeRewardCalls !== undefined) { delete existing.referral.inviteeRewardCalls; needsUpdate = true }
      }
      if (existing.welcomeCalls !== undefined) { delete existing.welcomeCalls; needsUpdate = true }
      if (needsUpdate) {
        try {
          const { _id, scope, key, ...patch } = existing
          await db.collection(SYSTEM_SETTINGS).doc(SUBSCRIPTION_DOC_ID).update(patch)
          console.log('subscription config auto-migrated to v3.2')
        } catch (e) {
          console.warn('subscription config migration failed:', e.message)
        }
      }
      return existing
    }
  } catch (_) {}
  const doc = { ...DEFAULT_SUBSCRIPTION_CONFIG }
  await db.collection(SYSTEM_SETTINGS).add(doc)
  return doc
}

/**
 * 读取订阅配置（带缓存建议，由调用方决定是否缓存）
 */
async function getSubscriptionConfig(db) {
  return ensureSubscriptionConfig(db)
}

// ─── 用户订阅字段初始化 ─────────────────────────────────

/**
 * 生成 6 位邀请码
 */
function generateInviteCode(userId) {
  // 基于 userId 的 hash 生成确定性但看起来随机的邀请码
  let hash = 0
  const str = String(userId || '')
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  // 去掉容易混淆的 0/O/1/I
  let code = ''
  let val = Math.abs(hash)
  for (let i = 0; i < 6; i++) {
    code += chars[val % chars.length]
    val = Math.floor(val / chars.length)
  }
  // 保证 6 位，不够补随机
  while (code.length < 6) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

/**
 * 获取周起始时间（周一 00:00）
 */
function getWeekStart(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * 获取月起始时间（1号 00:00）
 */
function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/**
 * 返回新用户默认 subscription 字段
 */
function getDefaultUserSubscriptionFields(invitedBy = null) {
  const now = new Date()
  return {
    plan: 'free',
    trialEndsAt: null,
    planExpiresAt: null,
    monthlyTokensReset: getMonthStart(now),
    monthlyTokensUsed: 0,
    extraTokens: 0,
    inviteCode: '',
    invitedBy: invitedBy || null,
    referralCount: 0,
    referralWeekStart: getWeekStart(now),
    referralWeekCount: 0
  }
}

// ─── 用户懒迁移辅助 ──────────────────────────────────

async function ensureUserSubscriptionFields(db, user, userId) {
  if (user.plan !== undefined && user.plan !== null) return user

  const defaultFields = getDefaultUserSubscriptionFields(user.invitedBy || null)
  const patch = {
    plan: 'free',
    trialEndsAt: null,
    planExpiresAt: null,
    monthlyTokensReset: defaultFields.monthlyTokensReset,
    monthlyTokensUsed: 0,
    extraTokens: 0,
    inviteCode: user.inviteCode || generateInviteCode(userId),
    invitedBy: user.invitedBy || null,
    referralCount: 0,
    referralWeekStart: defaultFields.referralWeekStart,
    referralWeekCount: 0
  }
  await db.collection(USERS).doc(userId).update(patch)
  Object.assign(user, patch)
  return user
}

// ─── Token 门控 v3.2 ─────────────────────────────────

/**
 * 调用前：预估检查（不扣减）
 * @returns { ok: boolean, balance?: { monthly, extra }, required?: number }
 */
async function checkTokenBalance(db, userId, estTokens) {
  if (!userId) return { ok: false, code: 'NO_USER', message: '请先登录' }

  let user
  try {
    const { data } = await db.collection(USERS).doc(userId).get()
    if (!data || data.length === 0) return { ok: false, code: 'NO_USER', message: '用户不存在' }
    user = data[0]
  } catch (_) {
    return { ok: false, code: 'DB_ERROR', message: '查询用户失败' }
  }

  await ensureUserSubscriptionFields(db, user, userId)

  // 试用期 → 不限制
  if (user.trialEndsAt && new Date() < new Date(user.trialEndsAt)) {
    return { ok: true, source: 'trial' }
  }
  // Ultra → 不限制
  if (user.plan === 'ultra') {
    return { ok: true, source: 'ultra' }
  }

  const config = await getSubscriptionConfig(db)
  const planConfig = config.plans[user.plan || 'free'] || config.plans.free
  const monthlyLimit = planConfig.monthlyTokens
  if (monthlyLimit === -1) return { ok: true, source: 'monthly_unlimited' }

  const now = new Date()
  const monthStart = getMonthStart(now)
  let monthlyUsed = user.monthlyTokensUsed || 0

  // 跨月重置
  if (!user.monthlyTokensReset || new Date(user.monthlyTokensReset) < monthStart) {
    await db.collection(USERS).doc(userId).update({ monthlyTokensUsed: 0, monthlyTokensReset: monthStart })
    monthlyUsed = 0
  }

  const monthlyRemaining = monthlyLimit - monthlyUsed
  const extraRemaining = user.extraTokens || 0
  const totalRemaining = monthlyRemaining + extraRemaining
  const required = Math.ceil((estTokens || 1000) * (config.tokenExchangeRate || 1))

  if (totalRemaining < required) {
    return {
      ok: false,
      code: 'TOKEN_INSUFFICIENT',
      message: 'Token 余额不足',
      monthlyTokensUsed: monthlyUsed,
      monthlyTokensLimit: monthlyLimit,
      monthlyRemaining,
      extraTokens: extraRemaining,
      required,
      actions: [
        { type: 'upgrade', label: user.plan === 'free' ? '升级 Pro（300,000 Token/月）' : '升级无限版（不限）' },
        { type: 'recharge', label: '买个加油包' }
      ]
    }
  }

  return { ok: true, source: 'monthly', monthlyRemaining, extraTokens: extraRemaining, required }
}

/**
 * 调用后：实际扣减平台 Token
 * @param {number} actualModelTokens - AI 返回的实际 token 数（prompt + completion）
 */
async function consumeTokens(db, userId, actualModelTokens, feature) {
  if (!userId || !actualModelTokens || actualModelTokens <= 0) return { deducted: 0 }

  let user
  try {
    const { data } = await db.collection(USERS).doc(userId).get()
    if (!data || data.length === 0) return { deducted: 0 }
    user = data[0]
  } catch (_) {
    return { deducted: 0 }
  }

  // 试用期或 Ultra → 不扣
  if (user.trialEndsAt && new Date() < new Date(user.trialEndsAt)) return { deducted: 0, source: 'trial' }
  if (user.plan === 'ultra') return { deducted: 0, source: 'ultra' }

  // 从 billing 读取模型倍率（按 modelId 匹配，fallback 到通配 *）
  let rate = 1
  try {
    const billingRes = await db.collection(SYSTEM_SETTINGS).doc('settings_billing').get().catch(() => null)
    const billing = billingRes?.data?.[0] || {}
    const pricing = (billing.modelPricing || []).find(p => p.enabled !== false && (p.modelId === '*' || p.modelId === (feature || '*')))
    if (pricing?.costMultiplier) rate = Number(pricing.costMultiplier)
  } catch (_) {}
  const toConsume = Math.ceil(actualModelTokens * rate)
  if (toConsume <= 0) return { deducted: 0 }

  // 先扣月度，不够扣 extra
  const monthStart = getMonthStart(new Date())
  let monthlyUsed = user.monthlyTokensUsed || 0
  if (!user.monthlyTokensReset || new Date(user.monthlyTokensReset) < monthStart) {
    monthlyUsed = 0
    await db.collection(USERS).doc(userId).update({ monthlyTokensUsed: 0, monthlyTokensReset: monthStart })
  }

  const planConfig = config.plans[user.plan || 'free'] || config.plans.free
  const monthlyLimit = planConfig.monthlyTokens === -1 ? Infinity : (planConfig.monthlyTokens || 0)
  const monthlyRemaining = Math.max(0, monthlyLimit - monthlyUsed)

  let fromMonthly = 0
  let fromExtra = 0

  if (monthlyRemaining > 0) {
    fromMonthly = Math.min(toConsume, monthlyRemaining)
    await db.collection(USERS).doc(userId).update({ monthlyTokensUsed: db.command.inc(fromMonthly) })
  }

  const stillNeed = toConsume - fromMonthly
  if (stillNeed > 0 && (user.extraTokens || 0) > 0) {
    fromExtra = Math.min(stillNeed, user.extraTokens || 0)
    await db.collection(USERS).doc(userId).update({ extraTokens: db.command.inc(-fromExtra) })
  }

  // 记录消费明细
  try {
    await db.collection(CALL_USAGE).add({
      userId,
      type: 'consume',
      feature: feature || 'unknown',
      source: fromMonthly > 0 ? 'monthly' : 'extra',
      modelTokens: actualModelTokens,
      platformTokens: toConsume,
      exchangeRate: rate,
      fromMonthly,
      fromExtra,
      month: new Date().toISOString().slice(0, 7),
      createdAt: new Date()
    })
  } catch (_) {}

  return { deducted: fromMonthly + fromExtra, fromMonthly, fromExtra, platformTokens: toConsume, rate }
}

// ─── 功能访问检查 ───────────────────────────────────────

async function checkFeatureAccess(db, userId, featureKey) {
  if (!userId) return { allowed: false, reason: '请先登录' }

  let user
  try {
    const { data } = await db.collection(USERS).doc(userId).get()
    if (!data || data.length === 0) return { allowed: false, reason: '用户不存在' }
    user = data[0]
  } catch (_) {
    return { allowed: false, reason: '查询用户失败' }
  }

  const config = await getSubscriptionConfig(db)

  if (user.trialEndsAt && new Date() < new Date(user.trialEndsAt)) {
    const trialCfg = config.trial || {}
    if (trialCfg.excludedFeatures && trialCfg.excludedFeatures.includes(featureKey)) {
      return { allowed: false, reason: `试用期暂不支持此功能（${featureKey}）` }
    }
    return { allowed: true }
  }

  const planConfig = config.plans[user.plan || 'free'] || config.plans.free
  if (planConfig.excludedFeatures && planConfig.excludedFeatures.includes(featureKey)) {
    return { allowed: false, reason: `${planConfig.name}不支持此功能，请升级套餐` }
  }

  return { allowed: true }
}

// ─── 额外 Token 管理 ───────────────────────────────────

async function addExtraTokens(db, userId, amount, remark) {
  if (!userId || !amount || amount <= 0) return { success: false, message: '参数无效' }
  try {
    await db.collection(USERS).doc(userId).update({ extraTokens: db.command.inc(amount) })
    await db.collection(CALL_USAGE).add({ userId, type: 'grant', source: remark || 'manual', amount, createdAt: new Date() })
    return { success: true, amount }
  } catch (err) {
    console.error('addExtraTokens error:', err)
    return { success: false, message: '增加Token失败' }
  }
}

// 兼容旧名
const addExtraCalls = addExtraTokens

/**
 * 获取用户的次数消费记录
 *
 * @param {object} db
 * @param {string} userId
 * @param {number} limit - 返回记录数上限
 * @returns {object} { records: [], summary: {} }
 */
async function getCallUsageHistory(db, userId, limit = 100) {
  if (!userId) return { records: [], summary: { totalCallsThisMonth: 0 } }

  const currentMonth = new Date().toISOString().slice(0, 7)

  try {
    const { data: records } = await db.collection(CALL_USAGE)
      .where({ userId, type: 'consume' })
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()

    const thisMonthRecords = (records || []).filter(r => r.month === currentMonth)

    return {
      records: records || [],
      summary: {
        totalCallsThisMonth: thisMonthRecords.length,
        byFeature: thisMonthRecords.reduce((acc, r) => {
          acc[r.feature] = (acc[r.feature] || 0) + 1
          return acc
        }, {}),
        bySource: thisMonthRecords.reduce((acc, r) => {
          acc[r.source] = (acc[r.source] || 0) + 1
          return acc
        }, {})
      }
    }
  } catch (err) {
    console.error('getCallUsageHistory error:', err)
    return { records: [], summary: { totalCallsThisMonth: 0 } }
  }
}

// ─── 邀请码相关 ─────────────────────────────────────────

/**
 * 兑换邀请码
 * 被邀请人注册后调用，双方获得奖励
 *
 * @param {object} db
 * @param {string} inviteCode - 邀请人的邀请码
 * @param {string} inviteeUserId - 被邀请人 userId
 * @returns {object} { success: boolean }
 */
async function redeemInviteCode(db, inviteCode, inviteeUserId) {
  if (!inviteCode || !inviteeUserId) {
    return { success: false, message: '参数无效' }
  }

  const config = await getSubscriptionConfig(db)
  const referral = config.referral || {}

  if (!referral.enabled) {
    return { success: false, message: '邀请活动已结束' }
  }

  // 查找邀请人
  let inviter
  try {
    const { data } = await db.collection(USERS)
      .where({ inviteCode: inviteCode.toUpperCase().trim() })
      .limit(1)
      .get()
    if (!data || data.length === 0) {
      return { success: false, message: '邀请码无效' }
    }
    inviter = data[0]
  } catch (err) {
    return { success: false, message: '查询邀请码失败' }
  }

  // 不能自己邀请自己
  if (inviter._id === inviteeUserId) {
    return { success: false, message: '不能邀请自己' }
  }

  // 检查邀请人周上限
  const now = new Date()
  const weekStart = getWeekStart(now)
  const referralWeekStart = inviter.referralWeekStart ? new Date(inviter.referralWeekStart) : null
  let weeklyCount = inviter.referralWeekCount || 0

  if (!referralWeekStart || referralWeekStart < weekStart) {
    weeklyCount = 0
  }

  const weeklyCap = referral.weeklyInviteCap || 5
  if (weeklyCount >= weeklyCap) {
    return { success: false, message: `本周邀请已达上限（${weeklyCap}人）` }
  }

  // 检查有效邀请条件：被邀请人需创建 Crush 并记录 ≥1 条事件
  if (referral.requireFirstEvent) {
    // 注册时调用，此时还未创建 crush，先记录 invitedBy，奖励在首次事件后发放
    return {
      success: true,
      pending: true,
      message: '邀请关系已记录，完成首次记录后双方获得奖励',
      inviterId: inviter._id
    }
  }

  // 发放奖励
  const inviterReward = referral.inviterRewardTokens || 3000
  const inviteeReward = referral.inviteeRewardTokens || 5000
  const trialExtend = referral.inviterTrialExtendDays || 3

  // 邀请人奖励
  await addExtraTokens(db, inviter._id, inviterReward, 'referral_inviter')
  await db.collection(USERS).doc(inviter._id).update({
    referralCount: db.command.inc(1),
    referralWeekStart: weekStart,
    referralWeekCount: weeklyCount + 1
  })

  if (inviter.plan === 'free' && trialExtend > 0) {
    const currentTrialEnd = inviter.trialEndsAt ? new Date(inviter.trialEndsAt) : now
    const baseTime = currentTrialEnd > now ? currentTrialEnd : now
    const newTrialEnd = new Date(baseTime.getTime() + trialExtend * 24 * 60 * 60 * 1000)
    await db.collection(USERS).doc(inviter._id).update({
      trialEndsAt: newTrialEnd
    })
  }

  // 被邀请人奖励
  await addExtraTokens(db, inviteeUserId, inviteeReward, 'referral_invitee')

  return {
    success: true,
    inviterReward,
    inviteeReward,
    trialExtended: trialExtend > 0 && inviter.plan === 'free'
  }
}

/**
 * 完成首次事件后触发邀请奖励发放（如果之前是 pending 状态）
 */
async function finalizePendingReferral(db, userId) {
  if (!userId) return

  let user
  try {
    const { data } = await db.collection(USERS).doc(userId).get()
    if (!data || data.length === 0) return
    user = data[0]
  } catch (_) {
    return
  }

  if (!user.invitedBy) return

  // 检查是否已经发过奖励（通过 call_usage_records 检查）
  const { data: existing } = await db.collection(CALL_USAGE)
    .where({ userId, type: 'grant', source: 'referral_invitee' })
    .limit(1)
    .get()

  if (existing && existing.length > 0) return  // 已发放过

  // 现在发放奖励
  const config = await getSubscriptionConfig(db)
  const referral = config.referral || {}

  const inviterReward = referral.inviterRewardTokens || 3000
  const inviteeReward = referral.inviteeRewardTokens || 5000
  const trialExtend = referral.inviterTrialExtendDays || 3

  await addExtraTokens(db, userId, inviteeReward, 'referral_invitee')
  await addExtraTokens(db, user.invitedBy, inviterReward, 'referral_inviter')

  const now = new Date()
  const weekStart = getWeekStart(now)

  // 更新邀请人计数
  try {
    const { data: inviterData } = await db.collection(USERS).doc(user.invitedBy).get()
    const inviter = (inviterData && inviterData.length > 0) ? inviterData[0] : null
    if (inviter) {
      const inviterWeekStart = inviter.referralWeekStart ? new Date(inviter.referralWeekStart) : null
      let inviterWeekCount = inviter.referralWeekCount || 0
      if (!inviterWeekStart || inviterWeekStart < weekStart) inviterWeekCount = 0

      await db.collection(USERS).doc(user.invitedBy).update({
        referralCount: db.command.inc(1),
        referralWeekStart: weekStart,
        referralWeekCount: inviterWeekCount + 1
      })

      // 试用期延长
      if (inviter.plan === 'free' && trialExtend > 0) {
        const currentTrialEnd = inviter.trialEndsAt ? new Date(inviter.trialEndsAt) : now
        const baseTime = currentTrialEnd > now ? currentTrialEnd : now
        const newTrialEnd = new Date(baseTime.getTime() + trialExtend * 24 * 60 * 60 * 1000)
        await db.collection(USERS).doc(user.invitedBy).update({
          trialEndsAt: newTrialEnd
        })
      }
    }
  } catch (err) {
    console.warn('finalizePendingReferral inviter update failed:', err.message)
  }
}

module.exports = {
  // 配置
  ensureSubscriptionConfig,
  getSubscriptionConfig,
  DEFAULT_SUBSCRIPTION_CONFIG,

  // 用户初始化
  getDefaultUserSubscriptionFields,
  generateInviteCode,
  getWeekStart,
  getMonthStart,

  // v3.2 核心门控
  checkTokenBalance,
  consumeTokens,
  checkFeatureAccess,

  // 兼容旧接口
  checkAndConsumeCall: async (db, userId) => {
    // 旧 checkAndConsumeCall → 改为只检查不扣减（兼容已有调用）
    const result = await checkTokenBalance(db, userId, 1000)
    return {
      allowed: result.ok,
      code: result.ok ? undefined : result.code,
      message: result.ok ? undefined : result.message,
      source: result.source,
      monthlyRemaining: result.monthlyRemaining,
      extraCalls: result.extraTokens,
      monthlyCallsUsed: result.monthlyTokensUsed,
      monthlyCallsLimit: result.monthlyTokensLimit,
      actions: result.actions
    }
  },

  // Token 管理
  addExtraTokens,
  addExtraCalls,  // 兼容旧名
  getCallUsageHistory,

  // 邀请
  redeemInviteCode,
  finalizePendingReferral
}
