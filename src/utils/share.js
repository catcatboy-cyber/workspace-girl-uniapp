export const SAFE_SHARE_TITLE = '关系信号记录助手'
export const SAFE_SHARE_PATH = '/pages/index/index'

export function buildSafeShareMessage() {
  return {
    title: SAFE_SHARE_TITLE,
    path: SAFE_SHARE_PATH
  }
}

export function buildSafeTimelineShare() {
  return {
    title: SAFE_SHARE_TITLE,
    query: ''
  }
}
