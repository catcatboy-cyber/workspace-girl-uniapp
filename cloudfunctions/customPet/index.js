const cloudbase = require('@cloudbase/node-sdk')
const cloud = require('wx-server-sdk')
const { requireVerifiedAuthenticatedUserId, buildAuthErrorResponse } = require('./_shared/auth')
const { checkFeatureAccess } = require('./_shared/subscription')
const { isCustomPetCatalogEnabled, listMyDeliveredPets, listMyRequests } = require('./_shared/custom-pet-catalog')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const authDb = app.database()
const db = cloud.database()
const command = db.command

const REQUESTS_COLLECTION = 'custom_pet_requests'

async function submitRequest(event) {
  const { nickname, description, referenceImages } = event
  const { OPENID } = cloud.getWXContext()
  let userId = ''
  try {
    userId = await requireVerifiedAuthenticatedUserId(app)
    const access = await checkFeatureAccess(authDb, userId, '自定义宠物')
    if (!access.allowed) {
      return {
        success: false,
        code: 'FEATURE_NOT_AVAILABLE',
        message: access.reason || '当前套餐不支持自定义宠物，请升级套餐。'
      }
    }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('customPet access check error:', error)
    return { success: false, message: '功能权限检查失败' }
  }

  if (!nickname || !nickname.trim()) return { success: false, message: '请填写宠物昵称' }
  if (!description || !description.trim()) return { success: false, message: '请填写定制说明' }

  const doc = {
    openid: OPENID || '',
    userId,
    nickname: nickname.trim(),
    description: description.trim(),
    referenceImages: Array.isArray(referenceImages) ? referenceImages : [],
    status: 'pending',
    deliveredPet: null,
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
    console.error('customPet submit error:', error)
    return { success: false, message: error?.message || '提交失败' }
  }
}

exports.main = async (event = {}) => {
  const action = event.action
  if (action === 'submit') return submitRequest(event)

  if (action === 'listMyRequests' || action === 'listMyDeliveredPets') {
    try {
      const userId = await requireVerifiedAuthenticatedUserId(app)
      if (action === 'listMyRequests') return await listMyRequests({ db, command, app, event, userId })
      if (!await isCustomPetCatalogEnabled(db)) {
        return { success: true, catalogEnabled: false, pets: [], warnings: [] }
      }
      return { ...(await listMyDeliveredPets({ db, app, userId })), catalogEnabled: true }
    } catch (error) {
      const authError = buildAuthErrorResponse(error)
      if (authError) return authError
      console.error(`customPet ${action} error:`, error)
      return { success: false, code: error?.code || 'CUSTOM_PET_READ_FAILED', message: error?.message || '读取定制宠物失败' }
    }
  }

  return { success: false, message: `Unknown action: ${action}` }
}
