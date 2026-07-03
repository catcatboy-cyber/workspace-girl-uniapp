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

/**
 * 获取当前用户的邀请码（从 storage 读取）
 */
export function getMyInviteCode() {
  try {
    const user = uni.getStorageSync('currentUser')
    const code = user?.inviteCode || ''
    return code
  } catch {
    return ''
  }
}

/**
 * 给分享 path 追加归因参数（inviteCode、channel、shareId）
 * 不传 userId，保护隐私
 */
export function appendReferralParams(path, channel, scene) {
  const params = []
  const inviteCode = getMyInviteCode()
  if (inviteCode) params.push(`inviteCode=${encodeURIComponent(inviteCode)}`)
  if (channel) params.push(`channel=${encodeURIComponent(channel)}`)
  if (scene) params.push(`scene=${encodeURIComponent(scene)}`)
  params.push(`shareId=${encodeURIComponent(generateShareId())}`)
  const sep = path.includes('?') ? '&' : '?'
  return path + sep + params.join('&')
}
