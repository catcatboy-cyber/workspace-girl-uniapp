export const SAFE_SHARE_TITLE = 'Crush Master｜读懂关系信号'
export const SAFE_SHARE_PATH = '/pages/index/index'
export const SAFE_SHARE_IMAGE = '/static/share-card.png'

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
