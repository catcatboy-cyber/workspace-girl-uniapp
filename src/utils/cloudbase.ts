/**
 * CloudBase SDK 初始化配置
 * 用于连接腾讯云开发环境
 */
import cloudbase from '@cloudbase/js-sdk'

// CloudBase 环境 ID
export const ENV_ID = 'catboy-d0gg4yc4ief533dea'

// 初始化 CloudBase
const app = cloudbase.init({
  env: ENV_ID
})

// 导出认证模块
export const auth = app.auth({ persistence: 'local' })

// 导出数据库模块
export const db = app.database()

// 导出云存储模块
export const storage = app.uploadFile.bind(app)

const CLOUD_AUTH_STORAGE_KEYS = [
  `user_info_${ENV_ID}`
]

function removeLocalStorageKey(key: string) {
  try {
    uni.removeStorageSync(key)
  } catch {}

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key)
    }
  } catch {}
}

export async function resetCloudAuthState(options: { clearBusinessUser?: boolean } = {}) {
  const { clearBusinessUser = true } = options

  await auth.signOut().catch(() => {})
  CLOUD_AUTH_STORAGE_KEYS.forEach(removeLocalStorageKey)

  if (clearBusinessUser) {
    removeLocalStorageKey('userId')
    removeLocalStorageKey('userEmail')
  }
}

function getStoredUserId(): string {
  return String(uni.getStorageSync('userId') || '').trim()
}

function extractCustomUserId(loginState: any): string {
  const user = loginState?.user || {}
  const candidates = [
    user.uid,
    user.customUserId,
    user.userId,
    loginState?.customUserId,
    loginState?.user?.customUserId,
    loginState?.credential?.customUserId
  ]

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForUserLoginState(retries = 8, intervalMs = 200) {
  let loginState = await auth.getLoginState()
  for (let index = 0; index < retries; index += 1) {
    if (extractCustomUserId(loginState)) {
      return loginState
    }
    await delay(intervalMs)
    loginState = await auth.getLoginState()
  }
  console.warn('waitForUserLoginState timeout after', retries * intervalMs, 'ms, loginState:', loginState)
  return loginState
}

// 云函数调用前置条件：
// 1. 已登录用户：等待真实登录态恢复，绝不降级成匿名
// 2. 游客：才允许匿名登录
let _authReady: Promise<void> | null = null
export function ensureCloudAuthReady(): Promise<void> {
  if (!_authReady) {
    _authReady = (async () => {
      const storedUserId = getStoredUserId()
      const hasStoredUser = Boolean(storedUserId)

      let loginState = null
      try {
        loginState = hasStoredUser
          ? await waitForUserLoginState()
          : await auth.getLoginState()
      } catch (err) {
        console.error('ensureCloudAuthReady: getLoginState failed', err)
        await resetCloudAuthState({ clearBusinessUser: false })
      }

      const customUserId = extractCustomUserId(loginState)
      if (customUserId) {
        console.log('ensureCloudAuthReady: authenticated as', customUserId)
        return
      }

      if (hasStoredUser) {
        console.warn('ensureCloudAuthReady: stored userId exists but no CloudBase login state, clearing auth')
        await resetCloudAuthState()
        const error = new Error('登录状态已失效，请重新登录')
        ;(error as any).code = 'AUTH_SESSION_REQUIRED'
        throw error
      }

      console.log('ensureCloudAuthReady: no stored user, signing in anonymously')
      if (!loginState) {
        await auth.anonymousAuthProvider().signIn()
      }
    })().finally(() => {
      _authReady = null
    })
  }
  return _authReady
}

// 包装 callFunction，自动确保已登录
const _rawCallFunction = app.callFunction.bind(app)
export const callFunction: typeof _rawCallFunction = (async (...args: any[]) => {
  try {
    await ensureCloudAuthReady()
  } catch (error: any) {
    if (error?.code === 'AUTH_SESSION_REQUIRED') {
      uni.reLaunch({ url: '/pages/login/login' })
    }
    throw error
  }
  return _rawCallFunction(...args)
}) as any

// 数据库集合快捷访问
export const collections = {
  users: db.collection('users'),
  cases: db.collection('cases'),
  assessments: db.collection('assessments'),
  timelineRecords: db.collection('timeline_records'),
  systemSettings: db.collection('system_settings')
}

// 导出 CloudBase 实例（用于高级操作）
export default app
