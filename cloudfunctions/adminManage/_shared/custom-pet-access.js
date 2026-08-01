const REQUESTS_COLLECTION = 'custom_pet_requests'
const USERS_COLLECTION = 'users'
const MAX_AUTHORIZED_USERS = 20

function createAccessError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function normalizeDoc(result) {
  if (Array.isArray(result?.data)) return result.data[0] || null
  return result?.data || null
}

function normalizeAuthorizedUserIds(value, ownerUserId = '') {
  const owner = String(ownerUserId || '').trim()
  const result = []
  const seen = new Set()

  for (const raw of Array.isArray(value) ? value : []) {
    const userId = String(raw || '').trim()
    if (!userId || userId === owner || seen.has(userId)) continue
    if (userId.length > 128 || userId.includes('/') || /[\u0000-\u001f\u007f]/.test(userId)) {
      throw createAccessError('INVALID_USER_ID', `账号 ID 格式无效：${userId.slice(0, 32)}`)
    }
    seen.add(userId)
    result.push(userId)
  }

  if (result.length > MAX_AUTHORIZED_USERS) {
    throw createAccessError('AUTHORIZED_USER_LIMIT_EXCEEDED', `单只宠物最多绑定 ${MAX_AUTHORIZED_USERS} 个额外账号`)
  }
  return result
}

async function assertUsersExist(db, userIds) {
  const missing = []
  await Promise.all(userIds.map(async (userId) => {
    const user = normalizeDoc(await db.collection(USERS_COLLECTION).doc(userId).get())
    if (!user) missing.push(userId)
  }))
  if (missing.length) {
    throw createAccessError('USER_NOT_FOUND', `账号不存在：${missing.sort().join(', ')}`)
  }
}

async function updateCustomPetAuthorizedUsers({
  db,
  requestId,
  authorizedUserIds,
  addCurrentAdmin = false,
  adminUserId
}) {
  const normalizedRequestId = String(requestId || '').trim()
  const normalizedAdminUserId = String(adminUserId || '').trim()
  if (!normalizedRequestId) throw createAccessError('REQUEST_ID_REQUIRED', '缺少 requestId')
  if (!normalizedAdminUserId) throw createAccessError('ADMIN_USER_REQUIRED', '无法识别当前管理员账号')

  const request = normalizeDoc(await db.collection(REQUESTS_COLLECTION).doc(normalizedRequestId).get())
  if (!request) throw createAccessError('REQUEST_NOT_FOUND', '定制宠物请求不存在')
  if (request.status !== 'delivered' || !request.deliveredPet?.id) {
    throw createAccessError('PET_NOT_DELIVERED', '只有已交付宠物可以绑定账号')
  }

  const requested = Array.isArray(authorizedUserIds)
    ? authorizedUserIds
    : (Array.isArray(request.authorizedUserIds) ? request.authorizedUserIds : [])
  const nextIds = normalizeAuthorizedUserIds(
    addCurrentAdmin ? [...requested, normalizedAdminUserId] : requested,
    request.userId
  )
  await assertUsersExist(db, nextIds)

  const previousIds = normalizeAuthorizedUserIds(request.authorizedUserIds, request.userId)
  const unchanged = previousIds.length === nextIds.length && previousIds.every((id, index) => id === nextIds[index])
  if (!unchanged) {
    await db.collection(REQUESTS_COLLECTION).doc(normalizedRequestId).update({
      authorizedUserIds: nextIds,
      authorizedUsersUpdatedAt: new Date(),
      authorizedUsersUpdatedBy: normalizedAdminUserId,
      updatedAt: new Date()
    })
  }

  return {
    success: true,
    idempotent: unchanged,
    requestId: normalizedRequestId,
    petId: request.deliveredPet.id,
    authorizedUserIds: nextIds
  }
}

async function updateCustomPetPublic({ db, requestId, isPublic, adminUserId }) {
  const normalizedRequestId = String(requestId || '').trim()
  const normalizedAdminUserId = String(adminUserId || '').trim()
  if (!normalizedRequestId) throw createAccessError('REQUEST_ID_REQUIRED', '缺少 requestId')
  if (!normalizedAdminUserId) throw createAccessError('ADMIN_USER_REQUIRED', '无法识别当前管理员账号')
  if (typeof isPublic !== 'boolean') throw createAccessError('INVALID_PUBLIC_STATE', '公共宠物状态必须是布尔值')

  const request = normalizeDoc(await db.collection(REQUESTS_COLLECTION).doc(normalizedRequestId).get())
  if (!request) throw createAccessError('REQUEST_NOT_FOUND', '定制宠物请求不存在')
  if (request.status !== 'delivered' || !request.deliveredPet?.id) {
    throw createAccessError('PET_NOT_DELIVERED', '只有已交付宠物可以设为公共宠物')
  }

  const unchanged = request.isPublic === isPublic
  if (!unchanged) {
    await db.collection(REQUESTS_COLLECTION).doc(normalizedRequestId).update({
      isPublic,
      publicStateUpdatedAt: new Date(),
      publicStateUpdatedBy: normalizedAdminUserId,
      updatedAt: new Date()
    })
  }

  return {
    success: true,
    idempotent: unchanged,
    requestId: normalizedRequestId,
    petId: request.deliveredPet.id,
    isPublic
  }
}

module.exports = {
  MAX_AUTHORIZED_USERS,
  normalizeAuthorizedUserIds,
  updateCustomPetAuthorizedUsers,
  updateCustomPetPublic
}
