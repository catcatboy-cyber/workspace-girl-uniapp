const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const REQUESTS_COLLECTION = 'custom_pet_requests'

exports.main = async (event = {}) => {
  const { action, nickname, description, referenceImages } = event
  const userId = event.userId || event.authUserId || ''
  const { OPENID } = cloud.getWXContext()

  if (action === 'submit') {
    if (!nickname || !nickname.trim()) {
      return { success: false, message: '请填写宠物昵称' }
    }
    if (!description || !description.trim()) {
      return { success: false, message: '请填写定制说明' }
    }

    const doc = {
      openid: OPENID || '',
      userId: userId || '',
      nickname: nickname.trim(),
      description: description.trim(),
      referenceImages: Array.isArray(referenceImages) ? referenceImages : [],
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    try {
      await db.collection(REQUESTS_COLLECTION).add({ data: doc })
      return { success: true }
    } catch (error) {
      if (error?.errCode === -502005 || String(error?.message || '').includes('not exist')) {
        try {
          await db.createCollection(REQUESTS_COLLECTION)
          await db.collection(REQUESTS_COLLECTION).add({ data: doc })
          return { success: true }
        } catch (retryError) {
          console.error('customPet create+retry error:', retryError)
          return { success: false, message: retryError?.message || '提交失败' }
        }
      }
      console.error('customPet error:', error)
      return { success: false, message: error?.message || '提交失败' }
    }
  }

  return { success: false, message: `Unknown action: ${action}` }
}
