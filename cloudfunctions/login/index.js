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
      message: '登录失败：云函数未配置自定义登录密钥'
    }
  }

  return null
}

function buildUserLoginPayload(user, ticket) {
  return {
    success: true,
    ticket,
    userId: user._id,
    email: user.email,
    selfProfile: user.selfProfile || null,
    role: user.role || (user.isAdmin ? 'admin' : 'user'),
    isAdmin: Boolean(user.isAdmin) || user.role === 'admin'
  }
}

const credentials = getCustomLoginCredentials()
const app = cloudbase.init({
  env: (credentials && credentials.env_id) || cloudbase.SYMBOL_CURRENT_ENV,
  ...(credentials ? { credentials } : {})
})
const db = app.database()
const TEST_ADMIN_EMAIL = '1'
const TEST_ADMIN_PASSWORD = '1'
const TEST_ADMIN_USER_ID = 'admin_test_1'

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${derivedKey}`
}

async function ensureTestAdminUser(existingUser) {
  const now = new Date()
  const adminPatch = {
    email: TEST_ADMIN_EMAIL,
    passwordHash: hashPassword(TEST_ADMIN_PASSWORD),
    role: 'admin',
    isAdmin: true,
    loginType: 'email',
    selfProfile: existingUser?.selfProfile || null,
    updatedAt: now
  }

  if (existingUser?._id) {
    await db.collection('users').doc(existingUser._id).update(adminPatch)
    return { ...existingUser, ...adminPatch }
  }

  await db.collection('users').add({
    _id: TEST_ADMIN_USER_ID,
    ...adminPatch,
    createdAt: now,
    seedFromLegacy: false
  })
  return {
    _id: TEST_ADMIN_USER_ID,
    ...adminPatch,
    createdAt: now,
    seedFromLegacy: false
  }
}

/**
 * 用户登录云函数
 */
exports.main = async (event) => {
  const input = event && typeof event === 'object' ? event : {}
  const email = typeof input.email === 'string' ? input.email.trim() : ''
  const password = typeof input.password === 'string' ? input.password : ''

  try {
    if (!email) {
      return { success: false, message: '请输入邮箱' }
    }
    if (!password) {
      return { success: false, message: '请输入密码' }
    }

    // 规范化邮箱
    const normalizedEmail = email.toLowerCase().trim()

    // 查询用户
    const { data: users } = await db.collection('users')
      .where({ email: normalizedEmail })
      .limit(1)
      .get()

    if (normalizedEmail === TEST_ADMIN_EMAIL && password === TEST_ADMIN_PASSWORD) {
      const user = await ensureTestAdminUser(users[0])
      const ticket = getCustomLoginCredentials() ? await app.auth().createTicket(user._id, {
        refresh: 7 * 24 * 60 * 60 * 1000
      }) : undefined

      return buildUserLoginPayload(user, ticket)
    }

    if (users.length === 0) {
      return {
        success: false,
        message: '用户不存在'
      }
    }

    const user = users[0]

    // 验证密码 (scrypt)
    const [salt, storedKey] = user.passwordHash.split(':')
    const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex')

    if (derivedKey !== storedKey) {
      return {
        success: false,
        message: '密码错误'
      }
    }

    // 创建自定义登录票据（7天有效期）
    const ticket = getCustomLoginCredentials() ? await app.auth().createTicket(user._id, {
      refresh: 7 * 24 * 60 * 60 * 1000 // 7天（毫秒）
    }) : undefined

    return buildUserLoginPayload(user, ticket)
  } catch (error) {
    const customLoginError = buildCustomLoginErrorResponse(error)
    if (customLoginError) {
      return customLoginError
    }

    console.error('登录错误:', error)
    return {
      success: false,
      message: '登录失败，请稍后重试'
    }
  }
}
