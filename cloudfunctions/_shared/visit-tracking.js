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
    console.log('[visit] anonymous recorded', { shareId: shareId?.slice(0, 12), channel })
    return { success: true }
  } catch (err) {
    console.warn('[visit] anonymous failed:', err?.message || err)
    return { success: false }
  }
}

async function trackLoginVisit(db, { shareId, visitorUserId, isNewUser, openid }) {
  try {
    await db.collection('share_visits').add({
      shareId: shareId || '',
      channel: '',
      scene: '',
      inviteCode: '',
      path: '',
      visitorUserId: visitorUserId || '',
      openidHash: hashOpenid(openid),
      isNewUser: Boolean(isNewUser),
      loginSuccess: true,
      createdAt: new Date()
    })
    console.log('[visit] login recorded', { shareId: shareId?.slice(0, 12), visitorUserId: visitorUserId?.slice(0, 20), isNewUser })
    return { success: true }
  } catch (err) {
    console.warn('[visit] login failed:', err?.message || err)
    return { success: false }
  }
}

module.exports = { trackAnonymousVisit, trackLoginVisit }
