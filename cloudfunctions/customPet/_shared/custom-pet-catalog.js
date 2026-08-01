const REQUESTS_COLLECTION = 'custom_pet_requests'
const DEFAULT_TEMP_URL_MAX_AGE_SECONDS = 60 * 60
const MAX_DELIVERED_PETS = 100

function createCatalogError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function clampLimit(value) {
  return Math.min(50, Math.max(1, Number.parseInt(value, 10) || 20))
}

function getTempUrlMaxAgeSeconds(value = process.env.CUSTOM_PET_TEMP_URL_MAX_AGE_SECONDS) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return DEFAULT_TEMP_URL_MAX_AGE_SECONDS
  return Math.min(86400, Math.max(300, parsed))
}

function extractDate(value) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function encodeCursor(record) {
  const createdAt = extractDate(record?.createdAt)
  const id = String(record?._id || '').trim()
  if (!createdAt || !id) return null
  return Buffer.from(JSON.stringify({ v: 1, createdAt: createdAt.toISOString(), id }), 'utf8').toString('base64url')
}

function decodeCursor(value) {
  if (!value) return null
  try {
    const decoded = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'))
    const createdAt = extractDate(decoded?.createdAt)
    const id = String(decoded?.id || '').trim()
    if (decoded?.v !== 1 || !createdAt || !id) throw new Error('invalid cursor')
    return { createdAt, id }
  } catch {
    throw createCatalogError('INVALID_CURSOR', '分页游标无效，请重新加载')
  }
}

function buildRequestWhere(command, userId, cursor) {
  if (!cursor) return { userId }
  if (!command?.and || !command?.or || !command?.lt) {
    throw createCatalogError('QUERY_CAPABILITY_UNAVAILABLE', '数据库分页能力不可用')
  }
  return command.and([
    { userId },
    command.or([
      { createdAt: command.lt(cursor.createdAt) },
      { createdAt: cursor.createdAt, _id: command.lt(cursor.id) }
    ])
  ])
}

async function resolveTempUrls(app, fileIDs, maxAge) {
  const unique = [...new Set((fileIDs || []).filter((fileID) => typeof fileID === 'string' && fileID.startsWith('cloud://')))]
  if (!unique.length) return new Map()
  const result = await app.getTempFileURL({
    fileList: unique.map((fileID) => ({ fileID, maxAge }))
  })
  return new Map((result?.fileList || [])
    .filter((file) => file.fileID && file.tempFileURL && (!file.code || file.code === 'SUCCESS'))
    .map((file) => [file.fileID, file.tempFileURL]))
}

async function listMyRequests({ db, command, app, event = {}, userId }) {
  const limit = clampLimit(event.limit)
  const cursor = decodeCursor(event.cursor)
  const where = buildRequestWhere(command, userId, cursor)
  const { data } = await db.collection(REQUESTS_COLLECTION)
    .where(where)
    .orderBy('createdAt', 'desc')
    .orderBy('_id', 'desc')
    .limit(limit)
    .get()
  const requests = data || []
  const referenceFileIDs = requests.flatMap((request) => Array.isArray(request.referenceImages) ? request.referenceImages : [])
  let fileMap = new Map()
  try {
    fileMap = await resolveTempUrls(app, referenceFileIDs, getTempUrlMaxAgeSeconds())
  } catch (error) {
    console.error('customPet listMyRequests temp URL error:', error)
  }

  return {
    success: true,
    requests: requests.map((request) => ({
      requestId: request._id,
      nickname: request.nickname || '',
      description: request.description || '',
      status: request.status || 'pending',
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      referenceImageURLs: (Array.isArray(request.referenceImages) ? request.referenceImages : [])
        .map((fileID) => fileMap.get(fileID) || '')
        .filter(Boolean)
    })),
    nextCursor: requests.length === limit ? encodeCursor(requests[requests.length - 1]) : null
  }
}

function hasCompleteDelivery(request) {
  const pet = request?.deliveredPet
  return request?.status === 'delivered' && pet && pet.id && pet.version &&
    pet.avatarFileID && pet.spritesheetFileID && pet.manifestFileID && pet.manifest
}

function normalizeDisplayName(value) {
  const name = String(value || '').trim().slice(0, 40)
  return name || '定制宠物'
}

function compareDeliveredRequests(left, right) {
  const leftTime = extractDate(left?.createdAt)?.getTime() || 0
  const rightTime = extractDate(right?.createdAt)?.getTime() || 0
  if (leftTime !== rightTime) return rightTime - leftTime
  return String(right?._id || '').localeCompare(String(left?._id || ''))
}

function getRequestAccessType(request, userId) {
  if (String(request?.userId || '') === userId) return 'owner'
  if (Array.isArray(request?.authorizedUserIds) && request.authorizedUserIds.includes(userId)) return 'authorized'
  return request?.isPublic === true ? 'public' : null
}

async function listAccessibleDeliveredRequests({ db, userId }) {
  const ownerQuery = db.collection(REQUESTS_COLLECTION)
    .where({ userId, status: 'delivered' })
    .orderBy('createdAt', 'desc')
    .limit(MAX_DELIVERED_PETS + 1)

  const all = db.command?.all
  if (typeof all !== 'function') {
    throw createCatalogError('QUERY_CAPABILITY_UNAVAILABLE', '数据库数组查询能力不可用')
  }
  const authorizedQuery = db.collection(REQUESTS_COLLECTION)
    .where({ authorizedUserIds: all.call(db.command, [userId]) })
    .limit(MAX_DELIVERED_PETS + 1)
  const publicQuery = db.collection(REQUESTS_COLLECTION)
    .where({ isPublic: true })
    .limit(MAX_DELIVERED_PETS + 1)

  const [ownedResult, authorizedResult, publicResult] = await Promise.all([
    ownerQuery.get(),
    authorizedQuery.get(),
    publicQuery.get()
  ])
  const byId = new Map()
  for (const request of [...(publicResult.data || []), ...(authorizedResult.data || []), ...(ownedResult.data || [])]) {
    if (hasCompleteDelivery(request)) byId.set(request._id, request)
  }
  const requests = [...byId.values()].sort(compareDeliveredRequests)
  if (requests.length > MAX_DELIVERED_PETS) {
    throw createCatalogError('CATALOG_LIMIT_EXCEEDED', '定制宠物数量超过目录上限，请联系管理员')
  }
  return requests
}

async function isCustomPetCatalogEnabled(db) {
  try {
    const result = await db.collection('system_settings').doc('settings_custom_pet').get()
    const data = Array.isArray(result?.data) ? result.data[0] : result?.data
    return data?.catalogEnabled === true
  } catch {
    return false
  }
}

async function listMyDeliveredPets({ db, app, userId }) {
  const requests = await listAccessibleDeliveredRequests({ db, userId })
  const fileIDs = requests.flatMap((request) => [request.deliveredPet.avatarFileID, request.deliveredPet.spritesheetFileID])
  const maxAge = getTempUrlMaxAgeSeconds()
  let fileMap = new Map()
  try {
    fileMap = await resolveTempUrls(app, fileIDs, maxAge)
  } catch (error) {
    console.error('customPet listMyDeliveredPets temp URL error:', error)
  }

  const warnings = []
  const now = Date.now()
  const urlExpiresAt = now + Math.max(0, maxAge - 60) * 1000
  const pets = requests.map((request) => {
    const pet = request.deliveredPet
    const accessType = getRequestAccessType(request, userId)
    const avatarURL = fileMap.get(pet.avatarFileID) || ''
    const spritesheetURL = fileMap.get(pet.spritesheetFileID) || ''
    if (!avatarURL || !spritesheetURL) {
      warnings.push({ petId: pet.id, code: 'TEMP_URL_UNAVAILABLE' })
    }
    return {
      id: pet.id,
      version: pet.version,
      ...(accessType === 'public' ? {} : { requestId: request._id }),
      accessType,
      displayName: normalizeDisplayName(pet.displayName || request.nickname),
      description: accessType === 'public'
        ? '公共宠物，使用时需通过套餐权限检查'
        : accessType === 'authorized'
          ? '已授权给你的定制宠物'
          : '你的专属定制宠物',
      renderer: 'spritesheet',
      avatarURL,
      spritesheetURL,
      urlExpiresAt,
      avatarFileID: pet.avatarFileID,
      spritesheetFileID: pet.spritesheetFileID,
      manifestFileID: pet.manifestFileID,
      manifest: pet.manifest
    }
  })

  return { success: true, pets, warnings }
}

module.exports = {
  DEFAULT_TEMP_URL_MAX_AGE_SECONDS,
  MAX_DELIVERED_PETS,
  buildRequestWhere,
  clampLimit,
  decodeCursor,
  encodeCursor,
  getTempUrlMaxAgeSeconds,
  getRequestAccessType,
  hasCompleteDelivery,
  isCustomPetCatalogEnabled,
  listAccessibleDeliveredRequests,
  listMyDeliveredPets,
  listMyRequests,
  normalizeDisplayName,
  resolveTempUrls
}
