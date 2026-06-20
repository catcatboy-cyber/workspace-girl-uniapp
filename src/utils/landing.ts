/**
 * 来源上下文工具
 * 统一解析并缓存分享落地页的 URL 参数：scene、ref、channel、inviteCode、shareId
 */

export interface LandingContext {
  scene: string
  ref: string
  channel: string
  inviteCode: string
  shareId: string
}

const CTX_KEY = 'landingContext'

/** 从页面 options 解析并缓存来源上下文 */
export function captureLandingContext(options: Record<string, any>) {
  if (!options || typeof options !== 'object') return
  const ctx = readLandingContext()
  let changed = false

  const set = (key: keyof LandingContext, val: string) => {
    if (val && ctx[key] !== val) { ctx[key] = val; changed = true }
  }

  set('scene', String(options?.scene || '').trim())
  set('ref', String(options?.ref || '').trim())
  set('channel', String(options?.channel || '').trim())
  set('inviteCode', String(options?.inviteCode || options?.invite_code || '').trim().toUpperCase())
  set('shareId', String(options?.shareId || options?.share_id || '').trim())

  if (changed) {
    try { uni.setStorageSync(CTX_KEY, ctx); console.log('[landing] captureLandingContext saved:', JSON.stringify(ctx)) } catch {}
  }
}

/** 读取缓存来源上下文 */
export function readLandingContext(): LandingContext {
  try {
    const cached = uni.getStorageSync(CTX_KEY)
    console.log('[landing] readLandingContext:', JSON.stringify(cached || {}))
    if (cached && typeof cached === 'object') {
      return {
        scene: cached.scene || '',
        ref: cached.ref || '',
        channel: cached.channel || '',
        inviteCode: cached.inviteCode || '',
        shareId: cached.shareId || ''
      }
    }
  } catch {}
  return { scene: '', ref: '', channel: '', inviteCode: '', shareId: '' }
}

/** 清除缓存 */
export function clearLandingContext() {
  try { uni.removeStorageSync(CTX_KEY) } catch {}
}

/** 生成 shareId（A 分享时前端生成，唯一标识一次分享） */
export function generateShareId(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
