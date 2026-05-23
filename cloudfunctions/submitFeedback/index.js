const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event = {}) => {
  const { content, contact } = event
  let userId = event.userId || event.authUserId || ''
  const { OPENID } = cloud.getWXContext()

  if (!content || typeof content !== 'string' || !content.trim()) {
    return { success: false, message: '反馈内容不能为空' }
  }

  const doc = {
    openid: OPENID || '',
    userId: userId || '',
    content: content.trim().slice(0, 1000),
    contact: (contact || '').trim().slice(0, 200) || '',
    createdAt: new Date(),
    resolved: false,
    rewardTokens: 0
  }

  try {
    await db.collection('system_feedback').add({ data: doc })
    return { success: true }
  } catch (error) {
    if (error?.errCode === -502005 || String(error?.message || '').includes('not exist')) {
      try {
        await db.createCollection('system_feedback')
        await db.collection('system_feedback').add({ data: doc })
        return { success: true }
      } catch (retryError) {
        console.error('submitFeedback create+retry error:', retryError)
        return { success: false, message: retryError?.message || '提交失败' }
      }
    }
    console.error('submitFeedback error:', error)
    return { success: false, message: error?.message || '提交失败' }
  }
}
