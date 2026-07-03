/**
 * 用户订阅状态查询（需认证）
 * 返回用户当前的 plan、试用期、次数余额
 * 参考 getTokenAccount 的认证模式
 */
const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')
const {
  getSubscriptionConfig,
  getDefaultUserSubscriptionFields,
  getMonthStart,
  generateInviteCode,
  checkFeatureAccess,
  getEffectivePlan,
  ensurePlanDowngraded
} = require('./_shared/subscription')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const USERS = 'users'

exports.main = async (event) => {
  try {
    const userId = await requireAuthenticatedUserId(app, event)
    const action = String(event.action || '').trim()

    // 功能访问检查（命理桃花等）
    if (action === 'checkFeature') {
      const featureKey = String(event.featureKey || '').trim()
      if (!featureKey) return { success: false, message: '缺少 featureKey' }
      const result = await checkFeatureAccess(db, userId, featureKey)
      return { success: true, ...result }
    }

    const config = await getSubscriptionConfig(db)
    const now = new Date()

    // 读取用户
    let user
    try {
      const { data } = await db.collection(USERS).doc(userId).get()
      if (!data || data.length === 0) {
        return { success: false, message: '用户不存在' }
      }
      user = data[0]
    } catch (err) {
      return { success: false, message: '查询用户失败' }
    }

    // 懒迁移存量用户
    if (user.plan === undefined || user.plan === null) {
      const defaultFields = getDefaultUserSubscriptionFields(user.invitedBy || null)
      const invCode = generateInviteCode(userId)

      await db.collection(USERS).doc(userId).update({
        plan: 'free',
        trialEndsAt: null,
        planExpiresAt: null,
        monthlyTokensReset: defaultFields.monthlyTokensReset,
        monthlyTokensUsed: 0,
        extraTokens: 0,
        inviteCode: user.inviteCode || invCode,
        invitedBy: user.invitedBy || null,
        referralCount: user.referralCount || 0,
        referralWeekStart: user.referralWeekStart || defaultFields.referralWeekStart,
        referralWeekCount: user.referralWeekCount || 0
      })

      user.plan = 'free'
      user.trialEndsAt = null
      user.monthlyTokensReset = defaultFields.monthlyTokensReset
      user.monthlyTokensUsed = 0
      user.extraTokens = 0
      user.inviteCode = invCode
      user.referralCount = 0
      user.referralWeekStart = defaultFields.referralWeekStart
      user.referralWeekCount = 0
    }

    // 处理跨月重置
    const monthStart = getMonthStart(now)
    let monthlyTokensUsed = user.monthlyTokensUsed || 0
    if (!user.monthlyTokensReset || new Date(user.monthlyTokensReset) < monthStart) {
      await db.collection(USERS).doc(userId).update({
        monthlyTokensUsed: 0,
        monthlyTokensReset: monthStart
      })
      monthlyTokensUsed = 0
    }

    const effectivePlan = getEffectivePlan(user)
    await ensurePlanDowngraded(db, user, userId, effectivePlan)

    const planConfig = config.plans[effectivePlan] || config.plans.free
    let extraTokens = user.extraTokens || 0

    // 试用期（day 计数仍保留，但不再无限；token 走正常扣费）
    let isTrial = false
    let trialDaysLeft = 0
    if (user.trialEndsAt) {
      const trialEnd = new Date(user.trialEndsAt)
      if (now < trialEnd) {
        isTrial = true
        trialDaysLeft = Math.ceil((trialEnd - now) / (24 * 60 * 60 * 1000))
      }
    }

    // 试用期不叠加 free 月额 —— 只靠 welcomeTokens 赠送额度
    const monthlyLimit = isTrial ? 0 : planConfig.monthlyTokens

    // 老试用用户迁移：extraTokens 为 0 → 补上 welcomeTokens
    if (isTrial && extraTokens === 0) {
      try {
        const billingRes = await db.collection('system_settings').doc('settings_billing').get().catch(() => null)
        const billing = billingRes?.data?.[0] || {}
        if (billing.firstGiftEnabled !== false) {
          extraTokens = billing.welcomeTokens ?? 100000
        }
      } catch (_) {}
      if (extraTokens > 0) {
        await db.collection('users').doc(userId).update({ extraTokens })
      }
    }

    let totalAvailable
    if (monthlyLimit === -1) {
      totalAvailable = -1
    } else {
      totalAvailable = Math.max(0, monthlyLimit - monthlyTokensUsed) + extraTokens
    }

    return {
      success: true,
      subscription: {
        plan: effectivePlan,
        planName: planConfig.name,
        isTrial,
        trialDaysLeft,
        trialEndsAt: user.trialEndsAt || null,
        planExpiresAt: user.planExpiresAt || null,
        monthlyTokensUsed,
        monthlyTokensLimit: monthlyLimit,
        monthlyRemaining: (monthlyLimit === -1) ? -1 : Math.max(0, monthlyLimit - monthlyTokensUsed),
        extraTokens,
        totalAvailable,
        maxCrushes: planConfig.maxCrushes,
        inviteCode: user.inviteCode || '',
        referralCount: user.referralCount || 0
      }
    }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('getSubscriptionStatus error:', error)
    return { success: false, message: '读取订阅状态失败' }
  }
}
