const cloudbase = require('@cloudbase/node-sdk')
const crypto = require('crypto')

function normalizePrivateKey(value) {
  if (typeof value !== 'string') return ''
  return value.replace(/\\n/g, '\n').trim()
}

function getCustomLoginCredentials() {
  const envId = String(process.env.TCB_CUSTOM_LOGIN_ENV_ID || process.env.env_id || '').trim()
  const privateKeyId = String(process.env.TCB_CUSTOM_LOGIN_PRIVATE_KEY_ID || process.env.private_key_id || '').trim()
  const privateKey = normalizePrivateKey(process.env.TCB_CUSTOM_LOGIN_PRIVATE_KEY || process.env.private_key)

  if (!envId || !privateKeyId || !privateKey) {
    return null
  }

  return {
    env_id: envId,
    private_key_id: privateKeyId,
    private_key: privateKey
  }
}

function ensureCustomLoginConfigured() {
  if (getCustomLoginCredentials()) return

  const error = new Error('CUSTOM_LOGIN_NOT_CONFIGURED')
  error.code = 'CUSTOM_LOGIN_NOT_CONFIGURED'
  throw error
}

function buildCustomLoginErrorResponse(error) {
  if (error?.code === 'CUSTOM_LOGIN_NOT_CONFIGURED' || error?.message === 'CUSTOM_LOGIN_NOT_CONFIGURED') {
    return {
      success: false,
      message: '注册失败：云函数未配置自定义登录密钥'
    }
  }

  return null
}

function safeError(error) {
  return {
    code: error?.code || error?.errCode || '',
    message: String(error?.message || error || '').slice(0, 200)
  }
}

const credentials = getCustomLoginCredentials()
const app = cloudbase.init({
  env: (credentials && credentials.env_id) || cloudbase.SYMBOL_CURRENT_ENV,
  ...(credentials ? { credentials } : {})
})
const db = app.database()
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * 用户注册云函数
 */
exports.main = async (event) => {
  const { email, password } = event

  try {
    if (typeof password !== 'string' || password.length < 8) {
      return {
        success: false,
        message: '密码至少需要8位'
      }
    }

    if (typeof email !== 'string') {
      return { success: false, message: '请输入有效邮箱' }
    }

    // 规范化邮箱
    const normalizedEmail = email.toLowerCase().trim()
    if (!EMAIL_RE.test(normalizedEmail)) {
      return { success: false, message: '请输入有效邮箱' }
    }

    // 检查邮箱是否已存在
    const { data: existingUsers } = await db.collection('users')
      .where({ email: normalizedEmail })
      .limit(1)
      .get()

    if (existingUsers.length > 0) {
      return {
        success: false,
        message: '该邮箱已被注册'
      }
    }

    // 生成密码哈希 (scrypt)
    const salt = crypto.randomBytes(16).toString('hex')
    const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex')
    const passwordHash = `${salt}:${derivedKey}`

    // 创建用户
    const userId = `user_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
    const now = new Date()

    // 生成邀请码
    const { generateInviteCode, getDefaultUserSubscriptionFields, getSubscriptionConfig } = require('./_shared/subscription')
    const inviteCode = generateInviteCode(userId)
    const subFields = getDefaultUserSubscriptionFields()

    // 读取配置获取试用天数
    let trialDurationDays = 0
    try {
      const config = await getSubscriptionConfig(db)
      if (config.trial?.enabled && config.trial?.durationDays > 0) {
        trialDurationDays = config.trial.durationDays
      }
    } catch (_) {}

    subFields.inviteCode = inviteCode
    subFields.trialEndsAt = trialDurationDays > 0
      ? new Date(now.getTime() + trialDurationDays * 24 * 60 * 60 * 1000)
      : null

    // 注册赠送Token → 读 billing 的 welcomeTokens
    try {
      const billingRes = await db.collection('system_settings').doc('settings_billing').get().catch(() => null)
      const billing = billingRes?.data?.[0] || {}
      if (billing.firstGiftEnabled !== false) {
        const welcomeTokens = billing.welcomeTokens ?? 1000000
        subFields.extraTokens = welcomeTokens
      }
    } catch (_) {}

    const { normalizeInviteCode, buildReferralIntentFields } = require('./_shared/referral-settlement')
    const regInviteCode = normalizeInviteCode(event.inviteCode)
    const referralIntent = buildReferralIntentFields({
      inviteCode: regInviteCode,
      channel: String(event.channel || '').trim(),
      scene: String(event.scene || '').trim(),
      shareId: String(event.shareId || '').trim(),
      intentVersion: 1
    })

    await db.collection('users').add({
      _id: userId,
      email: normalizedEmail,
      passwordHash,
      selfProfile: null,
      createdAt: now,
      seedFromLegacy: false,
      plan: subFields.plan,
      trialEndsAt: subFields.trialEndsAt,
      planExpiresAt: subFields.planExpiresAt,
      monthlyTokensReset: subFields.monthlyTokensReset,
      monthlyTokensUsed: subFields.monthlyTokensUsed,
      extraTokens: subFields.extraTokens,
      inviteCode: subFields.inviteCode,
      invitedBy: subFields.invitedBy,
      referralCount: subFields.referralCount,
      referralWeekStart: subFields.referralWeekStart,
      referralWeekCount: subFields.referralWeekCount,
      ...referralIntent
    })

    // 首次赠送写 call_usage_records，前端"充值记录"可查
    if (subFields.extraTokens > 0) {
      try {
        await db.collection('call_usage_records').add({
          userId,
          type: 'grant',
          source: 'welcome',
          amountTokens: subFields.extraTokens,
          balanceAfter: subFields.extraTokens,
          remark: '新用户首次赠送',
          createdAt: now
        })
      } catch (_) {}
    }

    // 创建自定义登录票据（7天有效期）
    const ticket = getCustomLoginCredentials() ? await app.auth().createTicket(userId, {
      refresh: 7 * 24 * 60 * 60 * 1000 // 7天（毫秒）
    }) : undefined

    return {
      success: true,
      ticket,
      userId,
      email: normalizedEmail,
      inviteCode: subFields.inviteCode || '',
      selfProfile: null
    }
  } catch (error) {
    error = safeError(error)
    const customLoginError = buildCustomLoginErrorResponse(error)
    if (customLoginError) {
      return customLoginError
    }

    console.error('注册错误:', error)
    return {
      success: false,
      message: '注册失败，请稍后重试'
    }
  }
}
