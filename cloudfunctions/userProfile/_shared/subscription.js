/**
 * Crush Master 平台 Token 订阅体系 — 共享模块 v3.2
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

function normalizeLedgerSource(source) {
  const value = String(source || '').trim()
  if (!value) return { source: 'manual', sourceId: '' }
  const colonIndex = value.indexOf(':')
  if (colonIndex > 0) {
    return { source: value.slice(0, colonIndex), sourceId: value.slice(colonIndex + 1) }
  }
  for (const prefix of ['recharge', 'sub']) {
    const marker = `${prefix}_`
    if (value.startsWith(marker) && value.length > marker.length) {
      return { source: prefix, sourceId: value.slice(marker.length) }
    }
  }
  return { source: value, sourceId: '' }
}

function getUserExtraTokens(user) {
  return Number(user?.extraTokens || 0)
}

async function getTokenBalanceAfter(db, userId, fallback = 0) {
  try {
    const { data } = await db.collection(USERS).doc(userId).get()
    const user = data && data.length > 0 ? data[0] : null
    if (user) return getUserExtraTokens(user)
  } catch (_) {}
  return fallback
}

const FEATURE_ALIASES = {
  '小咪帮你说': ['小咪帮你说（单轮）'],
  '小咪帮你说（单轮）': ['小咪帮你说'],
  '自定义AI风格': ['自定义 AI 风格'],
  '自定义 AI 风格': ['自定义AI风格'],
  '时间轴': ['时间线'],
  '时间线': ['时间轴']
}

function featureListIncludes(list, featureKey) {
  if (!Array.isArray(list)) return false
  const key = String(featureKey || '').trim()
  const aliases = new Set([key, ...(FEATURE_ALIASES[key] || [])])
  return list.some(item => aliases.has(String(item || '').trim()))
}

// ─── 默认配置 ───────────────────────────────────────────

const DEFAULT_SUBSCRIPTION_CONFIG = {
  _id: SUBSCRIPTION_DOC_ID,
  scope: 'global',
  key: 'subscription',
  configVersion: 4,

  trial: {
    enabled: true,
    durationDays: 7,
    extendOnReferral: 3,
    features: ['记录', '时间轴', '规则分析', '即时反馈', '事件理解', '周复盘', '附件识别', '小咪帮你说（单轮）', '命理桃花'],
    excludedFeatures: ['小咪多轮策略', '自定义宠物', '自定义AI风格']
  },

  plans: {
    free: {
      name: '免费版',
      monthlyTokens: 30000,
      maxCrushes: 1,
      features: ['记录', '时间轴', '规则分析', '即时反馈', '事件理解', '周复盘', '附件识别', '小咪帮你说（单轮）'],
      excludedFeatures: ['自定义宠物', '自定义AI风格', '小咪多轮策略', '命理桃花']
    },
    pro: {
      name: 'Pro',
      priceYuan: 19,
      priceYuanAnnual: 168,
      priceYuanStudent: 12,
      priceYuanStudentAnnual: 99,
      monthlyTokens: 300000,
      maxCrushes: 3,
      features: ['免费版全部', '命理桃花'],
      excludedFeatures: ['小咪多轮策略', '自定义宠物', '自定义AI风格']
    },
    ultra: {
      name: 'Ultra',
      priceYuan: 39,
      priceYuanAnnual: 298,
      priceYuanStudent: 25,
      priceYuanStudentAnnual: 199,
      monthlyTokens: -1,
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
      // 版本升级时：用代码默认值刷新系统管理的字段，保留用户自定义字段
      if (existing.configVersion !== DEFAULT_SUBSCRIPTION_CONFIG.configVersion) {
        const def = DEFAULT_SUBSCRIPTION_CONFIG
        // trial: 刷新 features / excludedFeatures，保留 durationDays 等用户设置
        if (existing.trial) {
          existing.trial.features = [...def.trial.features]
          existing.trial.excludedFeatures = [...def.trial.excludedFeatures]
        }
        // plans: 刷新 features / excludedFeatures / monthlyTokens / maxCrushes，保留价格/名称
        for (const pk of ['free', 'pro', 'ultra']) {
          const plan = existing.plans?.[pk]
          const defPlan = def.plans?.[pk]
          if (!plan || !defPlan) continue
          plan.features = [...defPlan.features]
          plan.excludedFeatures = [...defPlan.excludedFeatures]
          plan.monthlyTokens = defPlan.monthlyTokens
          plan.maxCrushes = defPlan.maxCrushes
        }
        existing.configVersion = DEFAULT_SUBSCRIPTION_CONFIG.configVersion
        needsUpdate = true
      }
      if (existing.referral) {
        set(existing.referral, 'inviterRewardTokens', (existing.referral.inviterRewardCalls || 3) * 1000)
        set(existing.referral, 'inviteeRewardTokens', (existing.referral.inviteeRewardCalls || 5) * 1000)
      }
      if (needsUpdate) {
        try {
          const { _id, scope, key, ...patch } = existing
          await db.collection(SYSTEM_SETTINGS).doc(SUBSCRIPTION_DOC_ID).update(patch)
        } catch (e) {
          void e
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

// ─── planExpiresAt 过期检查 ──────────────────────────

/**
 * 获取用户的有效套餐（考虑 planExpiresAt 过期）。
 * 付费套餐 + planExpiresAt 已过期 → 降级为 'free'。
 * planExpiresAt 为 null 的 legacy 用户不受影响。
 */
function getEffectivePlan(user) {
  const storedPlan = String(user.plan || 'free').trim()
  if (!storedPlan || storedPlan === 'free') return 'free'
  // 付费套餐：检查过期
  if (user.planExpiresAt) {
    const expiresAt = new Date(user.planExpiresAt)
    if (!isNaN(expiresAt.getTime()) && expiresAt < new Date()) {
      return 'free'
    }
  }
  // planExpiresAt 为 null → legacy/管理员手动设置，保留原套餐
  return storedPlan
}

/**
 * 懒降级：如果有效套餐为 free 但数据库中仍标记为付费套餐，更新 DB
 */
async function ensurePlanDowngraded(db, user, userId, effectivePlan) {
  if (effectivePlan === 'free' && user.plan && user.plan !== 'free') {
    try {
      await db.collection(USERS).doc(userId).update({
        plan: 'free',
        planExpiresAt: null,
        updatedAt: new Date()
      })
    } catch (_) {}
  }
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

  const effectivePlan = getEffectivePlan(user)
  await ensurePlanDowngraded(db, user, userId, effectivePlan)

  const config = await getSubscriptionConfig(db)
  const planConfig = config.plans[effectivePlan] || config.plans.free

  // 套餐配置为无限（monthlyTokens = -1）→ 不限制
  if (planConfig && planConfig.monthlyTokens === -1) {
    return { ok: true, source: 'unlimited' }
  }
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
  let estimatedRate = 1
  try {
    const billingRes = await db.collection(SYSTEM_SETTINGS).doc('settings_billing').get().catch(() => null)
    const billing = billingRes?.data?.[0] || {}
    const pricing = (billing.modelPricing || []).find(p => p.enabled !== false && p.modelId === '*')
    if (pricing?.costMultiplier) estimatedRate = Number(pricing.costMultiplier)
  } catch (_) {}
  const required = Math.ceil((estTokens || 1000) * estimatedRate)

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
        { type: 'upgrade', label: user.plan === 'free' ? '升级 Pro（300,000 Token/月）' : '升级 Ultra（不限）' },
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
async function consumeTokens(db, userId, actualModelTokens, feature, model, usage) {
  // usage: { promptTokens, completionTokens, totalTokens }
  if (!userId || !actualModelTokens || actualModelTokens <= 0) return { deducted: 0 }

  let user
  try {
    const { data } = await db.collection(USERS).doc(userId).get()
    if (!data || data.length === 0) return { deducted: 0 }
    user = data[0]
  } catch (_) {
    return { deducted: 0 }
  }

  // 读取订阅配置
  const effectivePlan = getEffectivePlan(user)
  const config = await getSubscriptionConfig(db)
  const planConfig = config.plans[effectivePlan] || config.plans.free

  // 套餐配置为无限（monthlyTokens = -1）→ 不扣
  if (planConfig && planConfig.monthlyTokens === -1) return { deducted: 0, source: user.plan === 'ultra' ? 'ultra' : 'unlimited' }

  // 从 billing 读取模型倍率（按 modelId 匹配，fallback 到通配 *）
  let rate = 1
  try {
    const billingRes = await db.collection(SYSTEM_SETTINGS).doc('settings_billing').get().catch(() => null)
    const billing = billingRes?.data?.[0] || {}
    const pricing = (billing.modelPricing || []).find(p => p.enabled !== false && (p.modelId === model || p.modelId === '*'))
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

  const deducted = fromMonthly + fromExtra
  const monthlyUsedAfter = monthlyUsed + fromMonthly
  const monthlyRemainingAfter = monthlyLimit === Infinity ? -1 : Math.max(0, monthlyLimit - monthlyUsedAfter)
  const extraBalanceAfter = Math.max(0, (user.extraTokens || 0) - fromExtra)
  const balanceAfter = monthlyRemainingAfter === -1 ? -1 : monthlyRemainingAfter + extraBalanceAfter

  // 记录消费明细
  try {
    await db.collection(CALL_USAGE).add({
      userId,
      type: 'consume',
      feature: feature || 'unknown',
      source: fromMonthly > 0 ? 'monthly' : 'extra',
      model: model || '',
      modelTokens: actualModelTokens,
      inputTokens: (usage && usage.promptTokens) ? usage.promptTokens : 0,
      outputTokens: (usage && usage.completionTokens) ? usage.completionTokens : 0,
      rawTotalTokens: (usage && usage.totalTokens) ? usage.totalTokens : actualModelTokens,
      platformTokens: toConsume,
      amountTokens: -deducted,
      balanceAfter,
      exchangeRate: rate,
      fromMonthly,
      fromExtra,
      month: new Date().toISOString().slice(0, 7),
      createdAt: new Date()
    })
  } catch (_) {}

  return { deducted, fromMonthly, fromExtra, platformTokens: toConsume, amountTokens: -deducted, balanceAfter, rate }
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
    if (featureListIncludes(trialCfg.excludedFeatures, featureKey)) {
      return { allowed: false, reason: `试用期暂不支持此功能（${featureKey}）` }
    }
    return { allowed: true }
  }

  const effectivePlan = getEffectivePlan(user)
  const planConfig = config.plans[effectivePlan] || config.plans.free
  if (featureListIncludes(planConfig.excludedFeatures, featureKey)) {
    return { allowed: false, reason: `${planConfig.name}不支持此功能，请升级套餐` }
  }

  return { allowed: true }
}

// ─── 额外 Token 管理 ───────────────────────────────────

async function addExtraTokens(db, userId, amount, remark) {
  if (!userId || !amount || amount <= 0) return { success: false, message: '参数无效' }
  try {
    const { source, sourceId } = normalizeLedgerSource(remark)
    await db.collection(USERS).doc(userId).update({ extraTokens: db.command.inc(amount) })
    const balanceAfter = await getTokenBalanceAfter(db, userId, amount)
    await db.collection(CALL_USAGE).add({
      userId,
      type: 'grant',
      source: source || remark || 'manual',
      sourceId,
      amount,
      amountTokens: amount,
      balanceAfter,
      remark: remark || '',
      createdAt: new Date()
    })
    return { success: true, amount, amountTokens: amount, balanceAfter }
  } catch (err) {
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
async function getCallUsageHistory(db, userId, limit = 100, types = null) {
  const emptySummary = {
    totalCallsThisMonth: 0,
    monthlyTokensUsed: 0,
    recentRecordsTokens: 0,
    recentRecordsCount: 0,
    byFeature: {},
    bySource: {}
  }
  if (!userId) return { records: [], summary: emptySummary }

  const currentMonth = new Date().toISOString().slice(0, 7)

  try {
    let monthlyTokensUsed = 0
    const userRes = await db.collection(USERS).doc(userId).get().catch(() => null)
    const user = userRes?.data?.[0]
    if (user) {
      const monthStart = getMonthStart(new Date())
      monthlyTokensUsed = Number(user.monthlyTokensUsed || 0)
      if (!user.monthlyTokensReset || new Date(user.monthlyTokensReset) < monthStart) {
        monthlyTokensUsed = 0
        await db.collection(USERS).doc(userId).update({
          monthlyTokensUsed: 0,
          monthlyTokensReset: monthStart
        }).catch(() => null)
      }
    }

    const whereClause = { userId }
    if (types) {
      // types 可以是字符串（单类型）或数组（多类型），或特殊值 'all'（不过滤）
      if (types === 'all') {
        // 不过滤 type
      } else if (Array.isArray(types)) {
        whereClause.type = db.command.in(types)
      } else {
        whereClause.type = types
      }
    } else {
      whereClause.type = 'consume'
    }
    const { data: records } = await db.collection(CALL_USAGE)
      .where(whereClause)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()

    const thisMonthRecords = (records || []).filter(r => r.month === currentMonth)
    const recentRecordsTokens = (records || []).reduce((sum, r) => {
      const platformTokens = Number(r.platformTokens)
      if (Number.isFinite(platformTokens) && platformTokens > 0) return sum + platformTokens
      return sum + Math.abs(Number(r.amountTokens || r.amount || r.totalTokens || 0))
    }, 0)

    return {
      records: records || [],
      summary: {
        monthlyTokensUsed,
        recentRecordsTokens,
        recentRecordsCount: (records || []).length,
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
    void err
    return { records: [], summary: emptySummary }
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

  const weeklyCap = Number(referral.weeklyInviteCap ?? 5)
  if (weeklyCount >= weeklyCap) {
    return { success: false, message: `本周邀请已达上限（${weeklyCap}人）` }
  }

  // 注册即送 —— 直接发放双方奖励
  const inviterReward = Number(referral.inviterRewardTokens ?? 3000)
  const inviteeReward = Number(referral.inviteeRewardTokens ?? 5000)

  // 邀请人奖励
  if (inviterReward > 0) {
    await addExtraTokens(db, inviter._id, inviterReward, 'referral_inviter')
  }
  await db.collection(USERS).doc(inviter._id).update({
    referralCount: db.command.inc(1),
    referralWeekStart: weekStart,
    referralWeekCount: weeklyCount + 1
  })

  // 被邀请人奖励（标记邀请关系）
  await db.collection(USERS).doc(inviteeUserId).update({
    invitedBy: inviter._id,
    invitedByCode: inviteCode.toUpperCase().trim()
  })
  if (inviteeReward > 0) await addExtraTokens(db, inviteeUserId, inviteeReward, 'referral_invitee')

  return {
    success: true,
    inviterReward,
    inviteeReward
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
  if (!referral.enabled) return

  let inviterId = user.invitedBy
  let inviter = null
  try {
    const { data: inviterData } = await db.collection(USERS).doc(inviterId).get()
    inviter = (inviterData && inviterData.length > 0) ? inviterData[0] : null
  } catch (_) {}

  if (!inviter) {
    try {
      const { data: inviterByCode } = await db.collection(USERS)
        .where({ inviteCode: String(user.invitedBy || '').toUpperCase().trim() })
        .limit(1)
        .get()
      inviter = (inviterByCode && inviterByCode.length > 0) ? inviterByCode[0] : null
      if (inviter?._id) {
        inviterId = inviter._id
        await db.collection(USERS).doc(userId).update({ invitedBy: inviterId })
      }
    } catch (_) {}
  }
  if (!inviter?._id) return

  const inviterWeekStart = inviter.referralWeekStart ? new Date(inviter.referralWeekStart) : null
  let inviterWeekCount = inviter.referralWeekCount || 0
  const weekStart = getWeekStart(new Date())
  if (!inviterWeekStart || inviterWeekStart < weekStart) inviterWeekCount = 0
  const weeklyCap = Number(referral.weeklyInviteCap ?? 5)
  if (weeklyCap >= 0 && inviterWeekCount >= weeklyCap) return

  const inviterReward = Number(referral.inviterRewardTokens ?? 3000)
  const inviteeReward = Number(referral.inviteeRewardTokens ?? 5000)
  const trialExtend = Number(referral.inviterTrialExtendDays ?? 3)

  if (inviteeReward > 0) await addExtraTokens(db, userId, inviteeReward, 'referral_invitee')
  if (inviterReward > 0) await addExtraTokens(db, inviterId, inviterReward, 'referral_inviter')

  const now = new Date()

  // 更新邀请人计数
  try {
    if (inviter) {
      await db.collection(USERS).doc(inviterId).update({
        referralCount: db.command.inc(1),
        referralWeekStart: weekStart,
        referralWeekCount: inviterWeekCount + 1
      })

      // 试用期延长
      if (inviter.plan === 'free' && trialExtend > 0) {
        const currentTrialEnd = inviter.trialEndsAt ? new Date(inviter.trialEndsAt) : now
        const baseTime = currentTrialEnd > now ? currentTrialEnd : now
        const newTrialEnd = new Date(baseTime.getTime() + trialExtend * 24 * 60 * 60 * 1000)
        await db.collection(USERS).doc(inviterId).update({
          trialEndsAt: newTrialEnd
        })
      }
    }
  } catch (err) {
    void err
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
  getEffectivePlan,
  ensurePlanDowngraded,

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
