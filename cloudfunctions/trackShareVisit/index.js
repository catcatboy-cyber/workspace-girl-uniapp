const cloudbase = require('@cloudbase/node-sdk')
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const { trackAnonymousVisit, trackLoginVisit } = require('./_shared/visit-tracking')

exports.main = async (event = {}) => {
  const action = String(event.action || 'anonymous').trim()

  // 服务端获取 openid
  let openid = ''
  try {
    const wxCloud = require('wx-server-sdk')
    wxCloud.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
    const ctx = wxCloud.getWXContext()
    openid = ctx.OPENID || ''
  } catch (_) {}

  if (action === 'anonymous') {
    return await trackAnonymousVisit(db, {
      shareId: event.shareId,
      channel: event.channel,
      scene: event.scene,
      inviteCode: event.inviteCode,
      path: event.path,
      openid
    })
  }

  if (action === 'login') {
    return await trackLoginVisit(db, {
      shareId: event.shareId,
      channel: event.channel,
      scene: event.scene,
      inviteCode: event.inviteCode,
      visitorUserId: event.visitorUserId,
      isNewUser: event.isNewUser,
      openid
    })
  }

  return { success: false, message: '未知操作' }
}
