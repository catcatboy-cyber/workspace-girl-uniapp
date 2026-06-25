const cloudbase = require('@cloudbase/node-sdk')
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()
const { trackAnonymousVisit, trackLoginVisit } = require('./_shared/visit-tracking')

async function findUserIdByOpenId(openid) {
  if (!openid) return ''
  const { data } = await db.collection('users')
    .where({ openid })
    .limit(1)
    .get()
  return data[0]?._id || ''
}

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
    if (!openid) return { success: false, code: 'UNAUTHENTICATED', message: '请先登录' }
    const visitorUserId = await findUserIdByOpenId(openid)
    if (!visitorUserId) return { success: false, code: 'USER_NOT_FOUND', message: '璇峰厛鐧诲綍' }
    return await trackLoginVisit(db, {
      shareId: event.shareId,
      channel: event.channel,
      scene: event.scene,
      inviteCode: event.inviteCode,
      visitorUserId,
      isNewUser: event.isNewUser,
      openid
    })
  }

  return { success: false, message: '未知操作' }
}
