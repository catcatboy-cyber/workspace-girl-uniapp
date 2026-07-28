const cloudbase = require('@cloudbase/node-sdk')
const cloud = require('wx-server-sdk')

// sys_settings 缓存（同一次云函数调用内复用）
let _showAILabelCache = undefined
async function getShowAILabel(db) {
  if (_showAILabelCache !== undefined) return _showAILabelCache
  try {
    const { data } = await db.collection('system_settings').doc('settings_ai').get().catch(() => null)
    const doc = (data && data.length > 0) ? data[0] : null
    _showAILabelCache = doc ? doc.showAILabel !== 0 : true
  } catch { _showAILabelCache = true }
  return _showAILabelCache
}
const crypto = require('crypto')
const https = require('https')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()

function randomHex(n) {
  return crypto.randomBytes(n).toString('hex')
}

function maskPhone(phone) {
  const value = String(phone || '')
  if (value.length < 7) return value
  return `${value.slice(0, 3)}****${value.slice(-4)}`
}

function maskEmail(email) {
  const value = String(email || '').trim()
  const [name, domain] = value.split('@')
  if (!name || !domain) return ''
  return `${name.slice(0, 2)}***@${domain}`
}

function safeError(error) {
  return {
    code: error?.code || error?.errCode || '',
    message: String(error?.message || error || '').slice(0, 200)
  }
}

function cleanString(value, maxLength) {
  const text = String(value || '').trim()
  if (!text) return ''
  return text.slice(0, maxLength)
}

function normalizeWechatProfile(event) {
  const userInfo = event?.userInfo && typeof event.userInfo === 'object' ? event.userInfo : {}
  const nickName = cleanString(event.nickName || event.nickname || userInfo.nickName || userInfo.nickname, 50)
  const avatarUrl = cleanString(event.avatarUrl || userInfo.avatarUrl, 500)
  return { nickName, avatarUrl }
}

// 登录接口不承担头像上传。用户自定义 cloud:// 头像必须先通过内容安全检测，
// 再由 userProfile 云函数写入；这里仅接受随包发布的内置头像。
const ALLOWED_AVATAR_PREFIXES = []
const ALLOWED_AVATAR_PATTERNS = [/^\/static\/avatars\//]

function isAllowedAvatarUrl(url) {
  if (!url) return true
  if (ALLOWED_AVATAR_PREFIXES.some(p => url.startsWith(p))) return true
  if (ALLOWED_AVATAR_PATTERNS.some(r => r.test(url))) return true
  return false
}

function buildWechatProfilePatch(profile, user = {}, force = false) {
  const patch = {}
  if (profile.nickName && (force || !String(user.nickName || '').trim())) {
    patch.nickName = profile.nickName
  }
  if (profile.nickName && (force || !String(user.nickname || '').trim())) {
    patch.nickname = profile.nickName
  }
  // 登录阶段拒绝微信 HTTPS 头像和客户端伪造的 cloud:// 地址，防止绕过检测。
  if (profile.avatarUrl && (force || !String(user.avatarUrl || '').trim())) {
    if (isAllowedAvatarUrl(profile.avatarUrl)) {
      patch.avatarUrl = profile.avatarUrl
    }
    // 如果 profile.avatarUrl 是 HTTPS URL（如 thirdwx.qlogo.cn），静默跳过
  }
  return patch
}

function resolveDisplayName(user, phoneMasked) {
  return user.nickName || user.nickname
    || (user.selfProfile && user.selfProfile.nickname)
    || user.email
    || (phoneMasked ? `微信用户 ${phoneMasked}` : '微信用户')
}

function extractOpenId(event) {
  try {
    const ctx = cloud.getWXContext()
    return ctx.OPENID || ctx.FROM_OPENID || event?.openid || ''
  } catch (error) {
    console.warn('getWXContext failed:', safeError(error))
    return event?.openid || ''
  }
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}')
          if (res.statusCode && res.statusCode >= 400) {
            const error = new Error(`HTTP_${res.statusCode}`)
            error.response = parsed
            reject(error)
            return
          }
          resolve(parsed)
        } catch (error) {
          reject(error)
        }
      })
    })
    req.setTimeout(5000, () => {
      req.destroy(new Error('JSCODE2SESSION_TIMEOUT'))
    })
    req.on('error', reject)
  })
}

function safeWechatError(result) {
  return {
    errcode: result?.errcode ?? result?.errorCode ?? result?.result?.errcode ?? '',
    errmsg: result?.errmsg ?? result?.errMsg ?? result?.result?.errmsg ?? ''
  }
}

async function getOpenIdByLoginCode(loginCode) {
  const code = String(loginCode || '').trim()
  if (!code) return { openid: '', sessionKey: '' }

  const appid = String(
    process.env.WECHAT_APPID ||
    process.env.WX_APPID ||
    process.env.MP_APPID ||
    process.env.APPID ||
    ''
  ).trim()
  const secret = String(
    process.env.WECHAT_APP_SECRET ||
    process.env.WECHAT_SECRET ||
    process.env.WX_APP_SECRET ||
    process.env.WX_APPSECRET ||
    process.env.WX_SECRET ||
    process.env.MP_APP_SECRET ||
    process.env.APPSECRET ||
    ''
  ).trim()

  if (!appid || !secret) {
    console.warn('wechatLogin missing appid/appsecret env for loginCode fallback')
    const error = new Error('WECHAT_APP_CONFIG_MISSING')
    error.code = 'WECHAT_APP_CONFIG_MISSING'
    throw error
  }

  const params = new URLSearchParams({
    appid,
    secret,
    js_code: code,
    grant_type: 'authorization_code'
  })
  const result = await requestJson(`https://api.weixin.qq.com/sns/jscode2session?${params.toString()}`)
  if (result?.errcode) {
    console.warn('jscode2session failed:', safeWechatError(result))
    return { openid: '', sessionKey: '' }
  }
  return { openid: String(result?.openid || '').trim(), sessionKey: String(result?.session_key || '').trim() }
}

function extractPhoneInfo(result) {
  return result?.phoneInfo || result?.phone_info || result?.result?.phoneInfo || result?.result?.phone_info || null
}

async function getPhoneNumber(code) {
  if (!cloud?.openapi?.phonenumber?.getPhoneNumber) {
    const error = new Error('WECHAT_PHONE_OPENAPI_UNAVAILABLE')
    error.code = 'WECHAT_PHONE_OPENAPI_UNAVAILABLE'
    throw error
  }

  const result = await cloud.openapi.phonenumber.getPhoneNumber({ code })
  const phoneInfo = extractPhoneInfo(result)
  const phone = phoneInfo?.purePhoneNumber || phoneInfo?.phoneNumber || phoneInfo?.phone_number || ''
  if (!phone) {
    console.warn('wechat phone response without phone:', safeWechatError(result))
    const error = new Error('PHONE_NOT_RETURNED')
    error.code = 'PHONE_NOT_RETURNED'
    throw error
  }
  return {
    phone,
    phoneInfo
  }
}

async function findUserByOpenId(openid) {
  if (!openid) return null
  const { data } = await db.collection('users')
    .where({ openid })
    .limit(1)
    .get()
  return data[0] || null
}

async function findUserByPhone(phone) {
  if (!phone) return null
  const { data } = await db.collection('users')
    .where({ phone })
    .limit(1)
    .get()
  return data[0] || null
}

async function updateUser(userId, patch, sessionKey = '') {
  const updateData = { ...patch, updatedAt: new Date() }
  if (sessionKey) updateData.sessionKey = sessionKey
  await db.collection('users').doc(userId).update(updateData)
}

async function createWechatUser({ openid, phone = '', profile, inviteCodeParam = '', landingChannel = '', landingScene = '', landingRef = '', landingShareId = '', landingInviteCode = '', sessionKey = '' }) {
  const userId = `user_${Date.now()}_${randomHex(4)}`
  const now = new Date()
  const profilePatch = buildWechatProfilePatch(profile, {}, true)

  // 生成邀请码和订阅字段
  const { generateInviteCode, getDefaultUserSubscriptionFields, getSubscriptionConfig, redeemInviteCode } = require('./_shared/subscription')
  const inviteCode = generateInviteCode(userId)
  const subFields = getDefaultUserSubscriptionFields()

  // 读取试用期配置
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
      subFields.extraTokens = billing.welcomeTokens ?? 1000000
    }
  } catch (_) {}

  await db.collection('users').add({
    _id: userId,
    openid,
    phone,
    email: '',
    ...profilePatch,
    selfProfile: null,
    loginType: 'wechat_phone',
    createdAt: now,
    updatedAt: now,
    seedFromLegacy: false,
    landingChannel: landingChannel || '',
    landingScene: landingScene || '',
    landingRef: landingRef || '',
    landingShareId: landingShareId || '',
    landingInviteCode: landingInviteCode || '',
    sessionKey: sessionKey || '',
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
    referralWeekCount: subFields.referralWeekCount
  })

  return {
    _id: userId,
    openid,
    phone,
    email: '',
    ...profilePatch,
    selfProfile: null,
    loginType: 'wechat_phone'
  }
}

exports.main = async (event = {}) => {
  const code = String(event.code || '').trim()
  const inviteCodeParam = String(event.inviteCode || event.invite_code || '').trim()
  const landingChannel = String(event.channel || '').trim()
  const landingScene = String(event.scene || '').trim()
  const landingRef = String(event.ref || '').trim()
  const landingShareId = String(event.shareId || '').trim()
  const landingInviteCode = String(event.inviteCode || event.invite_code || '').trim().toUpperCase()
  const profile = normalizeWechatProfile(event)

  try {
    const extracted = extractOpenId(event) || ''
    // 优先用 loginCode 换 session_key（虚拟支付用户态签名所需）
    let sessionKey = ''
    let openid = extracted
    if (event?.loginCode) {
      const jscodeResult = await getOpenIdByLoginCode(event.loginCode)
      if (jscodeResult.openid) openid = jscodeResult.openid
      sessionKey = jscodeResult.sessionKey || ''
    }
    if (!openid) {
      return { success: false, message: '无法获取微信用户身份，请在微信小程序中重试' }
    }

    let phone = ''
    if (code) {
      const phoneResult = await getPhoneNumber(code)
      phone = phoneResult.phone
    }
    const now = new Date()
    const phonePatch = phone ? { phone } : {}

    let isNewUser = false
    let user = await findUserByOpenId(openid)
    if (user) {
      const profilePatch = buildWechatProfilePatch(profile, user)
      const patch = {
        ...phonePatch,
        loginType: user.loginType || 'wechat_phone',
        lastLoginAt: now,
        ...profilePatch
      }
      await updateUser(user._id, patch, sessionKey)
      user = { ...user, ...patch }
    } else {
      user = await findUserByPhone(phone)
      if (user) {
        const profilePatch = buildWechatProfilePatch(profile, user)
        const patch = {
          openid,
          ...phonePatch,
          loginType: user.loginType || 'wechat_phone',
          lastLoginAt: now,
          ...profilePatch
        }
        await updateUser(user._id, patch, sessionKey)
        user = { ...user, ...patch }
      } else {
        user = await createWechatUser({ openid, phone, profile, inviteCodeParam, landingChannel, landingScene, landingRef, landingShareId, landingInviteCode, sessionKey })
        isNewUser = true
      }
    }

    const effectivePhone = phone || user.phone || ''
    const phoneMasked = effectivePhone ? maskPhone(effectivePhone) : ''

    // 异步记录登录日志（不阻塞登录流程）
    db.collection('login_logs').add({
      userId: user._id,
      email: maskEmail(user.email),
      phone: phoneMasked,
      loginType: 'wechat',
      platform: 'miniprogram',
      createdAt: new Date(),
    }).catch((err) => {
      err = safeError(err)
      console.error('[wechatLogin] 记录登录日志失败:', err)
    })

    // 新用户邀请奖励结算
    let referral = null
    if (isNewUser && inviteCodeParam) {
      try {
        const inviter = await db.collection('users')
          .where({ inviteCode: inviteCodeParam }).limit(1).get()
        if (inviter.data.length > 0 && inviter.data[0]._id !== user._id) {
          const { settleReward } = require('./_shared/referral-settlement')
          referral = await settleReward(db, user._id, inviter.data[0]._id,
            inviteCodeParam, landingShareId, landingChannel)
        }
      } catch (err) {
        err = safeError(err)
        console.error('[wechatLogin] settlement failed:', err?.message || err, err?.stack?.slice(0,200))
      }
    }

    return {
      success: true,
      userId: user._id,
      email: user.email || '',
      phone: effectivePhone,
      phoneMasked,
      nickName: user.nickName || user.nickname || '',
      avatarUrl: user.avatarUrl || (user.selfProfile && user.selfProfile.avatarUrl) || '',
      displayName: resolveDisplayName(user, phoneMasked),
      loginType: user.loginType || 'wechat_phone',
      selfProfile: user.selfProfile || null,
      inviteCode: user.inviteCode || '',
      isNewUser,
      referral: referral && referral.success ? { inviteeReward: referral.inviteeReward } : undefined,
      showAILabel: await getShowAILabel(db)
    }
  } catch (error) {
    error = safeError(error)
    console.error('wechatLogin error:', error)
    if (error?.code === 'WECHAT_PHONE_OPENAPI_UNAVAILABLE') {
      return { success: false, message: '当前云函数环境不支持手机号换取接口' }
    }
    if (error?.code === 'PHONE_NOT_RETURNED') {
      return { success: false, message: '未能获取手机号，请重新授权' }
    }
    if (error?.code === 'WECHAT_APP_CONFIG_MISSING') {
      return { success: false, message: '微信登录配置缺少 AppSecret，请配置云函数环境变量 WECHAT_APP_SECRET' }
    }
    return { success: false, message: '微信登录失败，请稍后重试或使用邮箱登录' }
  }
}
