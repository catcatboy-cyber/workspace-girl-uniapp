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
