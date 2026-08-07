import { getCurrentUserId, trackLoginVisit, wechatLogin } from './api'
import { captureLandingContext, readLandingContext } from './landing'
import { setAILabel } from './labels'

const SILENT_LOGIN_TRIED_KEY = 'silentLoginTried'
const SILENT_LOGIN_DONE_KEY = 'silentLoginDone'

let silentLoginInFlight: Promise<string | null> | null = null

export function ensureSilentWechatLogin(force = false): Promise<string | null> {
  if (!force && getCurrentUserId()) return Promise.resolve(getCurrentUserId())
  if (!silentLoginInFlight) {
    silentLoginInFlight = runSilentWechatLogin().finally(() => {
      silentLoginInFlight = null
    })
  }
  return silentLoginInFlight
}

async function runSilentWechatLogin(): Promise<string | null> {
  try { uni.setStorageSync(SILENT_LOGIN_TRIED_KEY, true) } catch {}

  try {
    const wxApi = (globalThis as any)?.wx
    if (!wxApi?.login) return getCurrentUserId()

    const launchOptions = uni.getLaunchOptionsSync?.() || ({} as any)
    if (launchOptions?.query) captureLandingContext(launchOptions.query)

    const loginCode = await new Promise<string>((resolve) => {
      wxApi.login({
        success(result: any) { resolve(result?.code || '') },
        fail() { resolve('') }
      })
    })
    if (!loginCode) return getCurrentUserId()

    const context = readLandingContext()
    const result = await wechatLogin('', {
      loginCode,
      channel: context.channel,
      scene: context.scene,
      ref: context.ref,
      shareId: context.shareId,
      inviteCode: context.inviteCode
    })
    if (result?.success) {
      trackLoginVisit({
        shareId: context.shareId,
        visitorUserId: result.userId,
        isNewUser: result.isNewUser || false
      }).catch(() => {})
      setAILabel(result.showAILabel !== false)
    }
    return getCurrentUserId()
  } catch {
    return getCurrentUserId()
  } finally {
    try { uni.setStorageSync(SILENT_LOGIN_DONE_KEY, true) } catch {}
  }
}
