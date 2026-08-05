export const SAFE_SHARE_TITLE = 'Crush Master｜读懂关系信号'
export const SAFE_SHARE_PATH = '/pages/index/index'
export const SAFE_SHARE_IMAGE = 'cloud://cloud1-d0gvhqu2c8a2b61fd.636c-cloud1-d0gvhqu2c8a2b61fd-1442786291/assets/share-card.png'
export const TAOHUA_SHARE_IMAGE = 'cloud://cloud1-d0gvhqu2c8a2b61fd.636c-cloud1-d0gvhqu2c8a2b61fd-1442786291/assets/share-taohua-persona.png'

export function buildSafeShareMessage(overrides = {}) {
  return {
    title: overrides.title || SAFE_SHARE_TITLE,
    path: overrides.path || SAFE_SHARE_PATH,
    imageUrl: overrides.imageUrl || SAFE_SHARE_IMAGE
  }
}

export function buildSafeTimelineShare(overrides = {}) {
  return {
    title: overrides.title || SAFE_SHARE_TITLE,
    query: overrides.query || '',
    imageUrl: overrides.imageUrl || SAFE_SHARE_IMAGE
  }
}

/**
 * 生成分享 ID（唯一标识一次分享动作）
 */
export function generateShareId() {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function scopedInviteCodeKey(userId) {
  return `myInviteCode:${userId}`
}

function readCurrentUser() {
  try {
    return uni.getStorageSync('currentUser') || null
  } catch {
    return null
  }
}

function readCurrentUserId() {
  try {
    return String(uni.getStorageSync('userId') || readCurrentUser()?.id || '').trim()
  } catch {
    return ''
  }
}

/**
 * 按 userId 缓存邀请码，禁止跨账号串码
 */
export function cacheMyInviteCode(userId, inviteCode) {
  const id = String(userId || '').trim()
  const code = String(inviteCode || '').trim().toUpperCase()
  if (!id || !code) return
  try {
    uni.setStorageSync(scopedInviteCodeKey(id), code)
  } catch {
    /* ignore */
  }
}

export function clearMyInviteCodeCache(userId) {
  const id = String(userId || '').trim()
  if (!id) return
  try {
    uni.removeStorageSync(scopedInviteCodeKey(id))
  } catch {
    /* ignore */
  }
}

/**
 * 读取顺序：
 * 与当前账号绑定的显式 extra.inviteCode + extra.userId
 * → 当前 currentUser 且 ID 匹配时的 inviteCode
 * → myInviteCode:${userId}
 * → ''
 */
export function getMyInviteCode(extra = {}) {
  try {
    const currentUserId = readCurrentUserId()
    const requestedUserId = String(extra?.userId || '').trim()
    const explicit = String(extra?.inviteCode || '').trim()
    // 登录态下，显式邀请码必须同时绑定当前 userId，避免账号切换后串用旧码。
    if (explicit) {
      if (currentUserId && requestedUserId !== currentUserId) return ''
      return explicit.toUpperCase()
    }

    const userId = String(requestedUserId || currentUserId || '').trim()
    const user = readCurrentUser()
    if (userId && user?.id && String(user.id) === userId && user.inviteCode) {
      return String(user.inviteCode).trim().toUpperCase()
    }

    if (userId) {
      const cached = String(uni.getStorageSync(scopedInviteCodeKey(userId)) || '').trim()
      if (cached) return cached.toUpperCase()
    }
    return ''
  } catch {
    return ''
  }
}

export function isInviteCodeReady(extra = {}) {
  return Boolean(getMyInviteCode(extra))
}

export function isReferralShareBlocked(extra = {}) {
  return Boolean(readCurrentUserId()) && !isInviteCodeReady(extra)
}

const inviteCodeInflight = new Map()

/**
 * 确保当前用户邀请码已缓存；账号切换时丢弃旧请求结果
 */
export async function ensureInviteCodeCached(fetcher) {
  const userId = readCurrentUserId()
  if (!userId) return ''

  const existing = getMyInviteCode({ userId })
  if (existing) return existing

  if (inviteCodeInflight.has(userId)) {
    return inviteCodeInflight.get(userId)
  }

  const task = (async () => {
    try {
      if (typeof fetcher !== 'function') return ''
      const code = String((await fetcher(userId)) || '').trim().toUpperCase()
      // 请求返回前若账号已切换，丢弃旧账号结果
      if (readCurrentUserId() !== userId) return ''
      if (code) cacheMyInviteCode(userId, code)
      return code
    } catch {
      return ''
    } finally {
      inviteCodeInflight.delete(userId)
    }
  })()

  inviteCodeInflight.set(userId, task)
  return task
}

function setShareMenuVisible(visible) {
  const method = visible ? uni.showShareMenu : uni.hideShareMenu
  if (typeof method !== 'function') return
  try {
    method.call(uni, { menus: ['shareAppMessage', 'shareTimeline'] })
  } catch {
    /* ignore unsupported platforms */
  }
}

/**
 * 登录用户必须先取得自己的邀请码再开放系统分享菜单；失败时保持隐藏且不打扰用户。
 * 未登录访问者仍可使用普通分享。
 */
export async function prepareReferralShareMenu(fetcher) {
  const userId = readCurrentUserId()
  if (!userId) {
    setShareMenuVisible(true)
    return true
  }

  if (!isInviteCodeReady({ userId })) setShareMenuVisible(false)
  const inviteCode = await ensureInviteCodeCached(fetcher)
  const ready = readCurrentUserId() === userId && Boolean(inviteCode || getMyInviteCode({ userId }))
  setShareMenuVisible(ready)
  return ready
}

/**
 * 给分享 path 追加归因参数（inviteCode、channel、scene、shareId）
 * 邀请码未 ready 时不拼 inviteCode，调用方应门控分享入口
 */
export function appendReferralParams(path, channel, scene, extra = {}) {
  if (isReferralShareBlocked(extra)) return ''
  const params = []
  const inviteCode = getMyInviteCode(extra)
  if (inviteCode) params.push(`inviteCode=${encodeURIComponent(inviteCode)}`)
  if (channel) params.push(`channel=${encodeURIComponent(channel)}`)
  if (scene) params.push(`scene=${encodeURIComponent(scene)}`)
  params.push(`shareId=${encodeURIComponent(generateShareId())}`)
  const sep = path.includes('?') ? '&' : '?'
  return path + sep + params.join('&')
}
