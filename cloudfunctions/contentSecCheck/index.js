const cloudbase = require('@cloudbase/node-sdk')
const { checkImageSafety } = require('./_shared/content-security')
const { requireAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })

/**
 * 内容安全检查云函数
 *
 * 入参:
 *   action: 'checkImage'   （检测图片）
 *   fileID: string          （云存储 fileID）
 *
 * 返回:
 *   pass: boolean           （true=安全, false=违规）
 */
exports.main = async (event = {}) => {
  const { action, fileID } = event

  try {
    // 需要登录态（防止匿名滥用）
    await requireAuthenticatedUserId(app, event)
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    // 其他鉴权错误降级放行
    console.error('contentSecCheck auth error:', error)
    return { pass: true }
  }

  if (action === 'checkImage') {
    if (!fileID || typeof fileID !== 'string') {
      return { pass: false, message: '缺少 fileID' }
    }
    return await checkImageSafety(fileID)
  }

  return { pass: false, message: '不支持的操作' }
}
