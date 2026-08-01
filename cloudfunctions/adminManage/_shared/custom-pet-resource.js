const crypto = require('crypto')

const REQUIRED_STATES = ['idle', 'running-right', 'running-left', 'waving', 'jumping', 'failed', 'waiting', 'running', 'review']
const DEFAULT_STATES = {
  idle: { frames: 6, fps: 6, loop: true },
  waiting: { frames: 6, fps: 6, loop: true },
  review: { frames: 6, fps: 6, loop: true },
  jumping: { frames: 5, fps: 8, loop: false },
  failed: { frames: 8, fps: 6, loop: true },
  waving: { frames: 4, fps: 6, loop: true },
  running: { frames: 6, fps: 8, loop: true },
  'running-left': { frames: 8, fps: 8, loop: true },
  'running-right': { frames: 8, fps: 8, loop: true }
}
const FILE_LIMITS = {
  manifest: 256 * 1024,
  spritesheet: 5 * 1024 * 1024,
  avatar: 1024 * 1024
}

function buildExpectedPetId(requestId) {
  const id = String(requestId || '').trim()
  if (!id) throw new Error('缺少 requestId')
  return `custom_${crypto.createHash('sha256').update(id).digest('hex').slice(0, 24)}`
}

function normalizeVersion(value, fallback = 'v1') {
  const version = String(value || fallback).trim()
  if (!/^v[1-9]\d{0,8}$/.test(version)) throw new Error('资源版本格式无效，请使用 v1、v2 等递增版本')
  return version
}

function versionNumber(value) {
  const version = normalizeVersion(value)
  return Number.parseInt(version.slice(1), 10)
}

function normalizeLegacyVersion(value) {
  const version = String(value || 'legacy-v1').trim()
  if (version !== 'legacy-v1') throw new Error('旧资源版本必须为 legacy-v1')
  return version
}

function storageRoot(value = process.env.CUSTOM_PET_STORAGE_ROOT) {
  const root = String(value || '').trim().replace(/\/+$/, '')
  if (!/^cloud:\/\/[A-Za-z0-9._-]+$/.test(root)) {
    throw new Error('缺少或无效的 CUSTOM_PET_STORAGE_ROOT')
  }
  return root
}

function buildResourceFileIDs({ requestId, version = 'v1', legacyPetId = '', legacy = false, root = undefined }) {
  const petId = legacy ? String(legacyPetId || '').trim() : buildExpectedPetId(requestId)
  if (!/^[A-Za-z0-9_-]{1,96}$/.test(petId)) throw new Error('Pet ID 格式无效')
  const normalizedVersion = legacy ? normalizeLegacyVersion(version) : normalizeVersion(version)
  const base = legacy
    ? `${storageRoot(root)}/pets/custom/${petId}`
    : `${storageRoot(root)}/pets/custom/${petId}/${normalizedVersion}`
  return {
    petId,
    version: normalizedVersion,
    avatarFileID: `${base}/avatar.png`,
    spritesheetFileID: `${base}/spritesheet.webp`,
    manifestFileID: `${base}/manifest.json`
  }
}

function assertFileInfo(info, label, maxSize, allowedMime) {
  if (!info || (info.code && !['SUCCESS', '0'].includes(String(info.code).toUpperCase()))) {
    throw new Error(`${label} 不存在或无法读取`)
  }
  const size = Number(info.size)
  if (!Number.isFinite(size) || size <= 0) throw new Error(`${label} 文件为空或缺少大小信息`)
  if (size > maxSize) throw new Error(`${label} 超过大小限制`)
  const mime = String(info.contentType || info.mime || '').toLowerCase()
  if (mime && mime !== 'application/octet-stream' && !allowedMime.some((item) => mime.includes(item))) {
    throw new Error(`${label} 文件类型不正确`)
  }
}

function positiveInt(value, label, max = 4096) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > max) throw new Error(`manifest.${label} 无效`)
  return parsed
}

function normalizeManifest(value, petId) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('manifest 必须是 JSON 对象')
  if (String(value.name || '').trim() !== petId) throw new Error('manifest.name 与 Pet ID 不一致')
  if (value.renderer !== 'spritesheet') throw new Error('manifest.renderer 必须为 spritesheet')

  const columns = positiveInt(value.columns, 'columns', 32)
  const rows = positiveInt(value.rows, 'rows', 32)
  const rowMap = {}
  for (const name of REQUIRED_STATES) {
    const row = Number(value.rowMap?.[name])
    if (!Number.isInteger(row) || row < 0 || row >= rows) throw new Error(`manifest.rowMap.${name} 无效`)
    rowMap[name] = row
  }

  const states = {}
  for (const name of REQUIRED_STATES) {
    const source = value.states?.[name] || DEFAULT_STATES[name]
    const frames = positiveInt(source.frames, `states.${name}.frames`, columns)
    const fps = positiveInt(source.fps, `states.${name}.fps`, 60)
    states[name] = { frames, fps, loop: typeof source.loop === 'boolean' ? source.loop : DEFAULT_STATES[name].loop }
  }

  return {
    name: petId,
    renderer: 'spritesheet',
    cellWidth: positiveInt(value.cellWidth, 'cellWidth'),
    cellHeight: positiveInt(value.cellHeight, 'cellHeight'),
    columns,
    rows,
    rowMap,
    states
  }
}

function contentToBuffer(content) {
  if (Buffer.isBuffer(content)) return content
  if (typeof content === 'string') return Buffer.from(content)
  if (content instanceof Uint8Array) return Buffer.from(content)
  throw new Error('manifest 下载内容为空')
}

function normalizeDisplayName(value) {
  const displayName = String(value || '').trim().slice(0, 40)
  return displayName || '定制宠物'
}

async function validateAndBuildDeliveredPet({ app, requestId, displayName, version = 'v1', legacyPetId = '', legacy = false, root = undefined }) {
  if (!app?.getFileInfo || !app?.downloadFile) throw new Error('云存储校验能力不可用')
  const files = buildResourceFileIDs({ requestId, version, legacyPetId, legacy, root })
  const fileIDs = [files.manifestFileID, files.spritesheetFileID, files.avatarFileID]
  const infoResult = await app.getFileInfo({ fileList: fileIDs })
  const infoMap = new Map((infoResult?.fileList || []).map((item) => [item.fileID || item.cloudId, item]))

  assertFileInfo(infoMap.get(files.manifestFileID), 'manifest.json', FILE_LIMITS.manifest, ['json', 'text/plain'])
  assertFileInfo(infoMap.get(files.spritesheetFileID), 'spritesheet.webp', FILE_LIMITS.spritesheet, ['image/webp'])
  assertFileInfo(infoMap.get(files.avatarFileID), 'avatar.png', FILE_LIMITS.avatar, ['image/png'])

  const download = await app.downloadFile({ fileID: files.manifestFileID })
  const buffer = contentToBuffer(download?.fileContent)
  if (buffer.length > FILE_LIMITS.manifest) throw new Error('manifest.json 超过大小限制')

  let parsed
  try { parsed = JSON.parse(buffer.toString('utf8')) } catch { throw new Error('manifest.json 不是合法 JSON') }
  const manifest = normalizeManifest(parsed, files.petId)

  return {
    id: files.petId,
    version: files.version,
    displayName: normalizeDisplayName(displayName),
    avatarFileID: files.avatarFileID,
    spritesheetFileID: files.spritesheetFileID,
    manifestFileID: files.manifestFileID,
    manifest,
    validatedAt: new Date()
  }
}

function documentData(result) {
  if (Array.isArray(result?.data)) return result.data[0] || null
  return result?.data && typeof result.data === 'object' ? result.data : null
}

function timestampsEqual(left, right) {
  if (!left && !right) return true
  const a = new Date(left).getTime()
  const b = new Date(right).getTime()
  return Number.isFinite(a) && Number.isFinite(b) && a === b
}

function isSameDelivery(request, petId, version) {
  return request?.status === 'delivered' && request?.deliveredPet?.id === petId && request?.deliveredPet?.version === version
}

function deliveryError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

async function deliverCustomPetRequest({ db, app, requestId, version = 'v1', adminNote = '', allowRedelivery = false }) {
  if (!db?.collection || !db?.startTransaction) throw deliveryError('TRANSACTION_UNAVAILABLE', '数据库事务能力不可用')
  const normalizedRequestId = String(requestId || '').trim()
  if (!normalizedRequestId) throw deliveryError('INVALID_REQUEST_ID', '缺少 requestId')
  const normalizedVersion = normalizeVersion(version)
  const expectedPetId = buildExpectedPetId(normalizedRequestId)
  const initialResult = await db.collection('custom_pet_requests').doc(normalizedRequestId).get()
  const initial = documentData(initialResult)
  if (!initial) throw deliveryError('REQUEST_NOT_FOUND', '定制宠物请求不存在')

  if (isSameDelivery(initial, expectedPetId, normalizedVersion)) {
    return { success: true, idempotent: true, expectedPetId, deliveredPet: initial.deliveredPet }
  }

  const redelivery = initial.status === 'delivered'
  if (redelivery) {
    if (!allowRedelivery) throw deliveryError('REDELIVERY_CONFIRMATION_REQUIRED', '已交付请求必须使用“重新交付”操作')
    const previousVersion = String(initial.deliveredPet?.version || '')
    if (/^v[1-9]\d{0,8}$/.test(previousVersion) && versionNumber(normalizedVersion) <= versionNumber(previousVersion)) {
      throw deliveryError('VERSION_NOT_INCREMENTED', `新版本必须高于 ${previousVersion}`)
    }
  } else if (initial.status !== 'in_progress') {
    throw deliveryError('INVALID_DELIVERY_STATE', '只有制作中的请求可以交付')
  }

  const deliveredPet = await validateAndBuildDeliveredPet({
    app,
    requestId: normalizedRequestId,
    displayName: initial.nickname,
    version: normalizedVersion
  })

  const transaction = await db.startTransaction()
  try {
    const currentResult = await transaction.collection('custom_pet_requests').doc(normalizedRequestId).get()
    const current = documentData(currentResult)
    if (!current) throw deliveryError('REQUEST_NOT_FOUND', '定制宠物请求不存在')

    if (isSameDelivery(current, expectedPetId, normalizedVersion)) {
      await transaction.rollback()
      return { success: true, idempotent: true, expectedPetId, deliveredPet: current.deliveredPet }
    }

    const expectedState = redelivery ? 'delivered' : 'in_progress'
    if (current.status !== expectedState || !timestampsEqual(current.updatedAt, initial.updatedAt)) {
      throw deliveryError('DELIVERY_CONFLICT', '请求已被其他管理员修改，请刷新后重试')
    }
    if (redelivery && current.deliveredPet?.version !== initial.deliveredPet?.version) {
      throw deliveryError('DELIVERY_CONFLICT', '交付版本已发生变化，请刷新后重试')
    }

    const now = new Date()
    await transaction.collection('custom_pet_requests').doc(normalizedRequestId).update({
      deliveredPet,
      deliveredPetId: deliveredPet.id,
      deliveredResourceVersion: deliveredPet.version,
      status: 'delivered',
      deliveredAt: now,
      updatedAt: now,
      ...(String(adminNote || '').trim() ? { adminNote: String(adminNote).trim() } : {})
    })
    await transaction.commit()
    return { success: true, idempotent: false, expectedPetId, deliveredPet }
  } catch (error) {
    try { await transaction.rollback() } catch {}
    throw error
  }
}

async function backfillDeliveredPetRecords({ app, requests, dryRun = true, persist }) {
  const candidates = (Array.isArray(requests) ? requests : [])
    .filter((request) => request?.status === 'delivered' && !request.deliveredPet && request.deliveredPetId)
  const results = []

  for (const request of candidates) {
    try {
      const deliveredPet = await validateAndBuildDeliveredPet({
        app,
        requestId: request._id,
        displayName: request.nickname,
        version: 'legacy-v1',
        legacyPetId: request.deliveredPetId,
        legacy: true
      })
      if (!dryRun) {
        if (typeof persist !== 'function') throw new Error('迁移持久化方法不可用')
        await persist(request, deliveredPet)
      }
      results.push({ requestId: request._id, success: true, petId: deliveredPet.id })
    } catch (error) {
      results.push({ requestId: request._id, success: false, message: error?.message || '回填失败' })
    }
  }

  return {
    dryRun,
    total: candidates.length,
    succeeded: results.filter((item) => item.success).length,
    failed: results.filter((item) => !item.success).length,
    results
  }
}

module.exports = {
  FILE_LIMITS,
  REQUIRED_STATES,
  buildExpectedPetId,
  buildResourceFileIDs,
  deliverCustomPetRequest,
  normalizeManifest,
  normalizeDisplayName,
  normalizeVersion,
  storageRoot,
  versionNumber,
  backfillDeliveredPetRecords,
  validateAndBuildDeliveredPet
}
