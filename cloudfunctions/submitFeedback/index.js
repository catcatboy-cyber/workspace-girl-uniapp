const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function safeError(error) {
  return {
    code: error?.code || error?.errCode || '',
    message: String(error?.message || error || '').slice(0, 200)
  }
}

async function findUserIdByOpenId(openid) {
  if (!openid) return ''
  const { data } = await db.collection('users')
    .where({ openid })
    .limit(1)
    .get()
  return data[0]?._id || ''
}

exports.main = async (event = {}) => {
  const { content, contact } = event
  const { OPENID } = cloud.getWXContext()

  if (!content || typeof content !== 'string' || !content.trim()) {
    return { success: false, message: '反馈内容不能为空' }
  }

  if (!OPENID) {
    return { success: false, code: 'UNAUTHENTICATED', message: '请先登录' }
  }

  let doc = null
  try {
    const userId = await findUserIdByOpenId(OPENID)
    doc = {
      openid: OPENID || '',
      userId: userId || '',
      content: content.trim().slice(0, 1000),
      contact: (contact || '').trim().slice(0, 200) || '',
      createdAt: new Date(),
      resolved: false,
      rewardTokens: 0
    }

    await db.collection('system_feedback').add({ data: doc })
    return { success: true }
  } catch (error) {
    if (error?.errCode === -502005 || String(error?.message || '').includes('not exist')) {
      try {
        await db.createCollection('system_feedback')
        await db.collection('system_feedback').add({ data: doc })
        return { success: true }
      } catch (retryError) {
        console.error('submitFeedback create+retry error:', safeError(retryError))
        return { success: false, message: '提交失败，请稍后重试' }
      }
    }
    console.error('submitFeedback error:', safeError(error))
    return { success: false, message: '提交失败，请稍后重试' }
  }
}
