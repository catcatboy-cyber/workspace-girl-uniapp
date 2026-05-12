const cloudbase = require('@cloudbase/node-sdk')
const cloud = require('wx-server-sdk')
const crypto = require('crypto')

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

function extractOpenId(event) {
  try {
    const ctx = cloud.getWXContext()
    return ctx.OPENID || ctx.FROM_OPENID || event?.openid || ''
  } catch (error) {
    console.warn('getWXContext failed:', error)
    return event?.openid || ''
  }
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

async function createWechatUser({ openid, phone }) {
  const userId = `user_${Date.now()}_${randomHex(4)}`
  const now = new Date()
  await db.collection('users').add({
    _id: userId,
    openid,
    phone,
    email: '',
    selfProfile: null,
    loginType: 'wechat_phone',
    createdAt: now,
    updatedAt: now,
    seedFromLegacy: false
  })
  return {
    _id: userId,
    openid,
    phone,
    email: '',
    selfProfile: null,
    loginType: 'wechat_phone'
  }
}

exports.main = async (event = {}) => {
  const code = String(event.code || '').trim()

  if (!code) {
    return { success: false, message: '缺少手机号授权 code' }
  }

  try {
    const openid = extractOpenId(event)
    if (!openid) {
      return { success: false, message: '无法获取微信用户身份，请在微信小程序中重试' }
    }

    const { phone } = await getPhoneNumber(code)
    const now = new Date()

    let user = await findUserByOpenId(openid)
    if (user) {
      await updateUser(user._id, {
        phone,
        loginType: user.loginType || 'wechat_phone',
        lastLoginAt: now
      })
    } else {
      user = await findUserByPhone(phone)
      if (user) {
        await updateUser(user._id, {
          openid,
          phone,
          loginType: user.loginType || 'wechat_phone',
          lastLoginAt: now
        })
      } else {
        user = await createWechatUser({ openid, phone })
      }
    }

    const phoneMasked = maskPhone(phone)
    return {
      success: true,
      userId: user._id,
      email: user.email || '',
      phone,
      phoneMasked,
      displayName: user.email || `微信用户 ${phoneMasked}`,
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
    return { success: false, message: '微信登录失败，请稍后重试或使用邮箱登录' }
  }
}
