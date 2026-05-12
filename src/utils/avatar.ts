import app, { ENV_ID } from './cloudbase'

export function isCloudAvatar(value?: string | null): boolean {
  return typeof value === 'string' && value.trim().startsWith('cloud://')
}

function safeDecodePath(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function normalizeAvatarValue(value?: string | null): string {
  const avatar = String(value || '').trim()
  if (!avatar || isCloudAvatar(avatar)) {
    return avatar
  }

  const urlMatch = avatar.match(/^https?:\/\/([^/?#]+)(\/[^?#]*)?(?:[?#].*)?$/i)
  const host = urlMatch?.[1] || ''
  const bucket = host.endsWith('.tcb.qcloud.la')
    ? host.slice(0, -'.tcb.qcloud.la'.length)
    : ''

  if (bucket && urlMatch?.[2]) {
    const cloudPath = safeDecodePath(urlMatch[2].replace(/^\/+/, ''))
    if (cloudPath) {
      return `cloud://${ENV_ID}.${bucket}/${cloudPath}`
    }
  }

  return avatar
}

export function createAvatarCloudPath(filePath: string): string {
  const normalizedPath = String(filePath || '').trim()
  const match = normalizedPath.match(/(\.[A-Za-z0-9]+)(?:\?|$)/)
  const ext = match?.[1]?.toLowerCase() || '.jpg'
  const random = Math.random().toString(36).slice(2, 10)
  return `avatars/${Date.now()}-${random}${ext}`
}

export async function resolveAvatarSrc(value?: string | null): Promise<string> {
  const avatar = normalizeAvatarValue(value)
  if (!avatar || !isCloudAvatar(avatar)) {
    return avatar
  }

  // #ifdef MP-WEIXIN
  // 微信小程序的 <image> 可以直接使用云存储 fileID。
  // 不转换成临时签名 URL，避免 tempFileURL 过期或权限变化后出现 403。
  return avatar
  // #endif

  // #ifndef MP-WEIXIN
  return app.getTempFileURL({
    fileList: [avatar]
  })
    .then(({ fileList }) => fileList?.[0]?.tempFileURL || avatar)
    .catch((error) => {
      console.warn('resolveAvatarSrc failed:', error)
      return avatar
    })
  // #endif
}
