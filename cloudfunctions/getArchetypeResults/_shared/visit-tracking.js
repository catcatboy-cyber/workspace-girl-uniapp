/**
 * 分享访问记录模块
 * 使用方式：const { trackAnonymousVisit, trackLoginVisit } = require('./_shared/visit-tracking')
 */

const crypto = require('crypto')

function hashOpenid(openid) {
  if (!openid) return ''
  return crypto.createHash('sha256').update(openid).digest('hex').slice(0, 16)
}

async function trackAnonymousVisit(db, { shareId, channel, scene, inviteCode, path, openid }) {
  try {
    await db.collection('share_visits').add({
      shareId: shareId || '',
      channel: channel || '',
      scene: scene || '',
      inviteCode: inviteCode || '',
      path: path || '',
      visitorUserId: '',
      openidHash: hashOpenid(openid),
      isNewUser: false,
      loginSuccess: false,
      createdAt: new Date()
    })
    return { success: true }
  } catch (err) {
    void err
    return { success: false }
  }
}

async function trackLoginVisit(db, { shareId, channel, scene, inviteCode, visitorUserId, isNewUser, openid }) {
  try {
    await db.collection('share_visits').add({
      shareId: shareId || '',
      channel: channel || '',
      scene: scene || '',
      inviteCode: inviteCode || '',
      path: '',
      visitorUserId: visitorUserId || '',
      openidHash: hashOpenid(openid),
      isNewUser: Boolean(isNewUser),
      loginSuccess: true,
      createdAt: new Date()
    })
    return { success: true }
  } catch (err) {
    void err
    return { success: false }
  }
}

module.exports = { trackAnonymousVisit, trackLoginVisit }
