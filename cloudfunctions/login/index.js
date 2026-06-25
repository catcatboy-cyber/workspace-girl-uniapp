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
      message: '登录失败：云函数未配置自定义登录密钥'
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

function buildUserLoginPayload(user, ticket) {
  // 异步记录登录日志（不阻塞登录流程）
  const logData = {
    userId: user._id,
    email: maskEmail(user.email),
    loginType: 'email',
    platform: 'h5', // email 登录仅限 H5/后台
    createdAt: new Date(),
  }
  db.collection('login_logs').add(logData).catch((err) => {
    err = safeError(err)
    console.error('[login] 记录登录日志失败:', err)
  })

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
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const LOGIN_RATE_LIMIT_MAX = 10
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const loginAttempts = new Map()

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${derivedKey}`
}

function maskEmail(email) {
  const value = String(email || '').trim()
  const [name, domain] = value.split('@')
  if (!name || !domain) return ''
  return `${name.slice(0, 2)}***@${domain}`
}

function checkLoginRateLimit(key) {
  const now = Date.now()
  const start = now - LOGIN_RATE_LIMIT_WINDOW_MS
  const list = (loginAttempts.get(key) || []).filter(ts => ts > start)
  loginAttempts.set(key, list)
  return list.length < LOGIN_RATE_LIMIT_MAX
}

function recordLoginFailure(key) {
  const list = loginAttempts.get(key) || []
  list.push(Date.now())
  loginAttempts.set(key, list)
}

function clearLoginFailures(key) {
  loginAttempts.delete(key)
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
    if (!EMAIL_RE.test(normalizedEmail)) {
      return { success: false, message: '邮箱或密码错误' }
    }

    const rateLimitKey = normalizedEmail
    if (!checkLoginRateLimit(rateLimitKey)) {
      return { success: false, code: 'RATE_LIMITED', message: '尝试次数过多，请稍后再试' }
    }

    // 查询用户
    const { data: users } = await db.collection('users')
      .where({ email: normalizedEmail })
      .limit(1)
      .get()

    if (users.length === 0) {
      recordLoginFailure(rateLimitKey)
      return { success: false, message: '邮箱或密码错误' }
    }

    const user = users[0]

    // 验证密码 (scrypt)
    const [salt, storedKey] = user.passwordHash.split(':')
    const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex')

    if (derivedKey !== storedKey) {
      recordLoginFailure(rateLimitKey)
      return { success: false, message: '邮箱或密码错误' }
    }

    // 创建自定义登录票据（7天有效期）
    const ticket = getCustomLoginCredentials() ? await app.auth().createTicket(user._id, {
      refresh: 7 * 24 * 60 * 60 * 1000 // 7天（毫秒）
    }) : undefined

    clearLoginFailures(rateLimitKey)
    return buildUserLoginPayload(user, ticket)
  } catch (error) {
    error = safeError(error)
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
