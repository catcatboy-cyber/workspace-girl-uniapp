const cloudbase = require('@cloudbase/node-sdk')
const cloud = require('wx-server-sdk')
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

function buildWechatProfilePatch(profile, user = {}, force = false) {
  const patch = {}
  if (profile.nickName && (force || !String(user.nickName || '').trim())) {
    patch.nickName = profile.nickName
  }
  if (profile.nickName && (force || !String(user.nickname || '').trim())) {
    patch.nickname = profile.nickName
  }
  if (profile.avatarUrl && (force || !String(user.avatarUrl || '').trim())) {
    patch.avatarUrl = profile.avatarUrl
  }
  return patch
}

function resolveDisplayName(user, phoneMasked) {
  return user.nickName || user.nickname || user.email || (phoneMasked ? `微信用户 ${phoneMasked}` : '微信用户')
}

function extractOpenId(event) {
  try {
    const ctx = cloud.getWXContext()
    return ctx.OPENID || ctx.FROM_OPENID || event?.openid || ''
  } catch (error) {
    console.warn('getWXContext failed:', error)
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

async function getOpenIdByLoginCode(loginCode) {
  const code = String(loginCode || '').trim()
  if (!code) return ''

  const appid = String(
    process.env.WECHAT_APPID ||
    process.env.WX_APPID ||
    process.env.MP_APPID ||
    process.env.APPID ||
    'wx0df17e80b6843702'
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
    const error = new Error('WECHAT_APP_SECRET_MISSING')
    error.code = 'WECHAT_APP_SECRET_MISSING'
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
    console.warn('jscode2session failed:', JSON.stringify(result))
    return ''
  }
  return String(result?.openid || '').trim()
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
    console.warn('wechat phone response without phone:', JSON.stringify(result))
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

async function updateUser(userId, patch) {
  await db.collection('users').doc(userId).update({
    ...patch,
    updatedAt: new Date()
  })
}

async function createWechatUser({ openid, phone = '', profile, inviteCodeParam = '' }) {
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
  subFields.extraTokens = 0

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

  let referralResult = null
  if (inviteCodeParam && typeof inviteCodeParam === 'string') {
    try {
      referralResult = await redeemInviteCode(db, inviteCodeParam.trim(), userId)
    } catch (err) {
      console.warn('wechatLogin redeem invite failed (non-fatal):', err?.message || err)
    }
  }
  return {
    _id: userId,
    openid,
    phone,
    email: '',
    ...profilePatch,
    selfProfile: null,
    loginType: 'wechat_phone',
    referral: referralResult
  }
}

exports.main = async (event = {}) => {
  const code = String(event.code || '').trim()
  const inviteCodeParam = String(event.inviteCode || event.invite_code || '').trim()
  const profile = normalizeWechatProfile(event)

  try {
    const openid = extractOpenId(event) || await getOpenIdByLoginCode(event?.loginCode)
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

    let user = await findUserByOpenId(openid)
    if (user) {
      const profilePatch = buildWechatProfilePatch(profile, user)
      const patch = {
        ...phonePatch,
        loginType: user.loginType || 'wechat_phone',
        lastLoginAt: now,
        ...profilePatch
      }
      await updateUser(user._id, patch)
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
        await updateUser(user._id, patch)
        user = { ...user, ...patch }
      } else {
        user = await createWechatUser({ openid, phone, profile, inviteCodeParam })
        // 新用户首次赠送额度
        try {
          const { grantFirstGift } = require('./_shared/billing')
          await grantFirstGift(db, user._id)
        } catch (err) {
          console.warn('grant first gift failed (non-fatal):', err.message)
        }
      }
    }

    const effectivePhone = phone || user.phone || ''
    const phoneMasked = effectivePhone ? maskPhone(effectivePhone) : ''
    return {
      success: true,
      userId: user._id,
      email: user.email || '',
      phone: effectivePhone,
      phoneMasked,
      nickName: user.nickName || user.nickname || '',
      avatarUrl: user.avatarUrl || '',
      displayName: resolveDisplayName(user, phoneMasked),
      loginType: user.loginType || 'wechat_phone',
      selfProfile: user.selfProfile || null
    }
  } catch (error) {
    console.error('wechatLogin error:', error)
    if (error?.code === 'WECHAT_PHONE_OPENAPI_UNAVAILABLE') {
      return { success: false, message: '当前云函数环境不支持手机号换取接口' }
    }
    if (error?.code === 'PHONE_NOT_RETURNED') {
      return { success: false, message: '未能获取手机号，请重新授权' }
    }
    if (error?.code === 'WECHAT_APP_SECRET_MISSING') {
      return { success: false, message: '微信登录配置缺少 AppSecret，请配置云函数环境变量 WECHAT_APP_SECRET' }
    }
    return { success: false, message: '微信登录失败，请稍后重试或使用邮箱登录' }
  }
}
