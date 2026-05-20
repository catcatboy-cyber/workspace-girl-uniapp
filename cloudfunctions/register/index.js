const cloudbase = require('@cloudbase/node-sdk')
const crypto = require('crypto')

function normalizePrivateKey(value) {
  if (typeof value !== 'string') return ''
  return value.replace(/\\n/g, '\n').trim()
}

function getCustomLoginCredentials() {
  const envId = String(process.env.TCB_CUSTOM_LOGIN_ENV_ID || '').trim()
  const privateKeyId = String(process.env.TCB_CUSTOM_LOGIN_PRIVATE_KEY_ID || '').trim()
  const privateKey = normalizePrivateKey(process.env.TCB_CUSTOM_LOGIN_PRIVATE_KEY)

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

const credentials = getCustomLoginCredentials()
const app = cloudbase.init({
  env: (credentials && credentials.env_id) || cloudbase.SYMBOL_CURRENT_ENV,
  ...(credentials ? { credentials } : {})
})
const db = app.database()

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

    // 规范化邮箱
    const normalizedEmail = email.toLowerCase().trim()

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

    await db.collection('users').add({
      _id: userId,
      email: normalizedEmail,
      passwordHash,
      selfProfile: null,
      createdAt: now,
      seedFromLegacy: false
    })

    // 首次赠送额度（幂等，不会重复赠送）
    try {
      const { grantFirstGift } = require('./_shared/billing')
      await grantFirstGift(db, userId)
    } catch (err) {
      console.warn('grant first gift failed (non-fatal):', err.message)
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
      selfProfile: null
    }
  } catch (error) {
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
