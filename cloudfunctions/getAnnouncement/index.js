/**
 * 用户端获取当前可见系统公告（轻量只读函数）
 * - 未登录：仅返回全员公告
 * - 已登录：返回全员公告 + 指定给该用户的公告（targetUserId 为业务 userId）
 */
const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId } = require('./_shared/auth')
const { getActiveAnnouncements } = require('./_shared/announcement')

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()

exports.main = async (event = {}) => {
  try {
    // 优先信任前端登录态业务 userId（getBusinessAuthPayload 传入）。
    // 注意：requireAuthenticatedUserId 依赖云函数 auth 上下文，在 H5/CLI 环境会被
    // isMpRuntime 误判走小程序分支（无 wx-server-sdk → openid 为空 → 解析失败），
    // 因此只用它做前端未传 authUserId 时的兜底。
    let userId = String(event?.authUserId || event?.userId || '').trim()
    if (!userId) {
      try {
        userId = await requireAuthenticatedUserId(app, event)
      } catch (_) { /* 未登录 */ }
    }
    const announcements = await getActiveAnnouncements(db, userId)
    return { success: true, announcements }
  } catch (error) {
    console.error('getAnnouncement error:', error)
    return { success: false, message: '公告读取失败', announcements: [] }
  }
}
