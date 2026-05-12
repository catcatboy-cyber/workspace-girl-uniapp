export const ENV_ID = 'cloud1-d8gqh3f5g49993a5a'

const CLOUD_AUTH_STORAGE_KEYS = [
  `user_info_${ENV_ID}`
]

function removeLocalStorageKey(key: string) {
  try {
    uni.removeStorageSync(key)
  } catch {}
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`${label} timeout after ${ms}ms`)
      resolve(undefined)
    }, ms)
  })

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) {
      clearTimeout(timer)
    }
  })
}

// #ifdef MP-WEIXIN
declare const wx: any

let wxCloudInitialized = false

function ensureWxCloudReady() {
  if (wxCloudInitialized) return
  if (!wx?.cloud) {
    throw new Error('微信云开发能力不可用，请在微信开发者工具中启用云开发')
  }
  console.log('[cloudbase] init wx cloud env:', ENV_ID)
  wx.cloud.init({
    env: ENV_ID,
    traceUser: true
  })
  wxCloudInitialized = true
}

function getStoredUserId(): string {
  return String(uni.getStorageSync('userId') || '').trim()
}

export const app = {
  callFunction(options: { name: string; data?: Record<string, any> }) {
    ensureWxCloudReady()
    const userId = getStoredUserId()
    console.log(`[cloudbase] callFunction ${options.name} start`)
    return wx.cloud.callFunction({
      name: options.name,
      config: {
        env: ENV_ID
      },
      data: userId
        ? { ...(options.data || {}), userId }
        : (options.data || {})
    }).then((result: any) => {
      console.log(`[cloudbase] callFunction ${options.name} success`)
      return result
    }).catch((error: any) => {
      console.error(`[cloudbase] callFunction ${options.name} failed:`, error)
      throw error
    })
  },

  uploadFile(options: { cloudPath: string; filePath: string }) {
    ensureWxCloudReady()
    return wx.cloud.uploadFile({
      ...options,
      config: {
        env: ENV_ID
      }
    }).catch((error: any) => {
      console.error('[cloudbase] uploadFile failed:', error)
      throw error
    })
  },

  getTempFileURL(options: { fileList: string[] }) {
    ensureWxCloudReady()
    return wx.cloud.getTempFileURL({
      ...options,
      config: {
        env: ENV_ID
      }
    }).catch((error: any) => {
      console.error('[cloudbase] getTempFileURL failed:', error)
      throw error
    })
  },

  database() {
    ensureWxCloudReady()
    return wx.cloud.database()
  }
}

export const auth = {
  async getLoginState() {
    const userId = getStoredUserId()
    return userId ? { user: { customUserId: userId, uid: userId } } : null
  },

  async signOut() {
    return undefined
  },

  anonymousAuthProvider() {
    return {
      async signIn() {
        return undefined
      }
    }
  }
}

export const db = {
  collection(name: string) {
    return app.database().collection(name)
  }
}
export const storage = app.uploadFile.bind(app)

export async function resetCloudAuthState(options: { clearBusinessUser?: boolean } = {}) {
  const { clearBusinessUser = true } = options
  CLOUD_AUTH_STORAGE_KEYS.forEach(removeLocalStorageKey)

  if (clearBusinessUser) {
    removeLocalStorageKey('userId')
    removeLocalStorageKey('userEmail')
    removeLocalStorageKey('userPhone')
  }
}

export function ensureCloudAuthReady(): Promise<void> {
  return Promise.resolve()
}

export const callFunction = (async (...args: any[]) => {
  return app.callFunction(args[0])
}) as any

export const collections = {} as any

export default app
// #endif

// #ifndef MP-WEIXIN
import cloudbase from '@cloudbase/js-sdk'

const cloudbaseApp = cloudbase.init({
  env: ENV_ID
})

export const app = cloudbaseApp
export const auth = cloudbaseApp.auth({ persistence: 'local' })
export const db = cloudbaseApp.database()
export const storage = cloudbaseApp.uploadFile.bind(cloudbaseApp)

export async function resetCloudAuthState(options: { clearBusinessUser?: boolean } = {}) {
  const { clearBusinessUser = true } = options

  CLOUD_AUTH_STORAGE_KEYS.forEach(removeLocalStorageKey)

  if (clearBusinessUser) {
    removeLocalStorageKey('userId')
    removeLocalStorageKey('userEmail')
    removeLocalStorageKey('userPhone')
  }

  await withTimeout(auth.signOut(), 1500, 'CloudBase signOut').catch((error) => {
    console.warn('CloudBase signOut failed:', error)
  })
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

const _rawCallFunction = cloudbaseApp.callFunction.bind(cloudbaseApp)
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

export const collections = {
  users: db.collection('users'),
  cases: db.collection('cases'),
  assessments: db.collection('assessments'),
  timelineRecords: db.collection('timeline_records'),
  systemSettings: db.collection('system_settings')
}

export default cloudbaseApp
// #endif
