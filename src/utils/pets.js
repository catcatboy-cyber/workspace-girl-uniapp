const sharedPetStates = {
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

const sharedRowMap = {
  idle: 0,
  'running-right': 1,
  'running-left': 2,
  waving: 3,
  jumping: 4,
  failed: 5,
  waiting: 6,
  running: 7,
  review: 8
}

const CLOUD_ENV_ID = 'cloud1-d0gvhqu2c8a2b61fd'
const CATALOG_KEY_PREFIX = 'deliveredPetCatalog:'
const SELECTED_KEY_PREFIX = 'selectedPetId:'
const LEGACY_SELECTED_KEY = 'selectedPetId'
const URL_EXPIRY_SKEW_MS = 60 * 1000
const PET_ID_PATTERN = /^[A-Za-z0-9_-]{1,96}$/
let petCloudInitialized = false

// CloudBase cloud storage file IDs. Spritesheets are cached under
// wx.env.USER_DATA_PATH on first use in the mini program.
const CLOUD_PET_CONFIG = {
  xiaomi: {
    spritesheetFileID: 'cloud://cloud1-d0gvhqu2c8a2b61fd.636c-cloud1-d0gvhqu2c8a2b61fd-1442786291/pets/xiaomi/spritesheet.webp',
    manifestFileID: 'cloud://cloud1-d0gvhqu2c8a2b61fd.636c-cloud1-d0gvhqu2c8a2b61fd-1442786291/pets/xiaomi/manifest.json'
  },
  doggo: {
    spritesheetFileID: 'cloud://cloud1-d0gvhqu2c8a2b61fd.636c-cloud1-d0gvhqu2c8a2b61fd-1442786291/pets/doggo/spritesheet.webp',
    manifestFileID: 'cloud://cloud1-d0gvhqu2c8a2b61fd.636c-cloud1-d0gvhqu2c8a2b61fd-1442786291/pets/doggo/manifest.json'
  }
}

export const petOptions = [
  {
    id: 'xiaomi',
    displayName: '小咪',
    description: '默认陪伴宠物，适合轻松提醒和帮你说。点击陪伴宠物，教你如何和 TA 聊天。',
    renderer: 'spritesheet',
    avatarPath: '/static/pets/xiaomi/avatar.png',
    spritesheetPath: '',
    cellWidth: 192,
    cellHeight: 208,
    columns: 8,
    rows: 9,
    rowMap: sharedRowMap,
    states: sharedPetStates,
    isCustom: false,
    version: 'builtin-v1'
  },
  {
    id: 'doggo',
    displayName: 'Doggo',
    description: '友好的小狗陪伴助手，圆脸垂耳，会摇尾巴。',
    renderer: 'spritesheet',
    avatarPath: '/static/pets/doggo/avatar.png',
    spritesheetPath: '',
    cellWidth: 192,
    cellHeight: 208,
    columns: 8,
    rows: 9,
    rowMap: sharedRowMap,
    states: sharedPetStates,
    isCustom: false,
    version: 'builtin-v1'
  }
]

function getStoredUserId() {
  try { return String(uni.getStorageSync('userId') || '').trim() } catch { return '' }
}

function selectedKey(userId) {
  const uid = String(userId || '').trim()
  return uid ? `${SELECTED_KEY_PREFIX}${uid}` : LEGACY_SELECTED_KEY
}

function catalogKey(userId) {
  return `${CATALOG_KEY_PREFIX}${String(userId || '').trim()}`
}

function isSafePetId(value) {
  return PET_ID_PATTERN.test(String(value || '').trim())
}

function normalizePositiveInt(value, fallback) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function normalizeStates(value = {}) {
  const states = {}
  for (const [name, fallback] of Object.entries(sharedPetStates)) {
    const source = value?.[name] || {}
    states[name] = {
      frames: normalizePositiveInt(source.frames, fallback.frames),
      fps: normalizePositiveInt(source.fps, fallback.fps),
      loop: typeof source.loop === 'boolean' ? source.loop : fallback.loop
    }
  }
  return states
}

function normalizeRowMap(value = {}) {
  const rowMap = {}
  for (const [name, fallback] of Object.entries(sharedRowMap)) {
    const row = Number(value?.[name])
    rowMap[name] = Number.isInteger(row) && row >= 0 ? row : fallback
  }
  return rowMap
}

function normalizeDeliveredPet(value) {
  if (!value || typeof value !== 'object') return null
  const id = String(value.id || '').trim()
  const requestId = String(value.requestId || '').trim()
  const version = String(value.version || 'v1').trim()
  if (!id.startsWith('custom_') || !isSafePetId(id) || !requestId || !version) return null

  const manifest = value.manifest && typeof value.manifest === 'object' ? value.manifest : value
  const spritesheetFileID = String(value.spritesheetFileID || '').trim()
  const manifestFileID = String(value.manifestFileID || '').trim()
  if (!spritesheetFileID || !manifestFileID) return null

  const urlExpiresAt = Number(value.urlExpiresAt || 0)
  const avatarURL = String(value.avatarURL || '').trim()
  const avatarFileID = String(value.avatarFileID || '').trim()
  return {
    id,
    requestId,
    version,
    displayName: String(value.displayName || '定制宠物').trim() || '定制宠物',
    description: String(value.description || '你的专属定制宠物').trim() || '你的专属定制宠物',
    renderer: 'spritesheet',
    avatarPath: avatarURL || avatarFileID || petOptions[0].avatarPath,
    avatarURL,
    avatarFileID,
    spritesheetURL: String(value.spritesheetURL || '').trim(),
    spritesheetFileID,
    manifestFileID,
    urlExpiresAt: Number.isFinite(urlExpiresAt) ? urlExpiresAt : 0,
    spritesheetPath: '',
    cellWidth: normalizePositiveInt(manifest.cellWidth, 192),
    cellHeight: normalizePositiveInt(manifest.cellHeight, 208),
    columns: normalizePositiveInt(manifest.columns, 8),
    rows: normalizePositiveInt(manifest.rows, 9),
    rowMap: normalizeRowMap(manifest.rowMap),
    states: normalizeStates(manifest.states),
    isCustom: true
  }
}

export function normalizeBuiltInPetId(value) {
  const id = String(value || '').trim()
  return id === 'xiaomi' || id === 'doggo' ? id : null
}

// Backward-compatible final resolver. Intermediate storage and cache helpers do
// not call this function, so a valid custom ID is never silently rewritten.
export function normalizePetId(value, userId = getStoredUserId()) {
  const builtIn = normalizeBuiltInPetId(value)
  if (builtIn) return builtIn
  const id = String(value || '').trim()
  return getCachedDeliveredPets(userId).some((pet) => pet.id === id) ? id : 'xiaomi'
}

export function getCachedDeliveredPets(userId = getStoredUserId()) {
  const uid = String(userId || '').trim()
  if (!uid) return []
  try {
    const raw = uni.getStorageSync(catalogKey(uid))
    const values = Array.isArray(raw) ? raw : Array.isArray(raw?.pets) ? raw.pets : []
    return values.map(normalizeDeliveredPet).filter(Boolean)
  } catch {
    return []
  }
}

export function setCachedDeliveredPets(userId, pets) {
  const uid = String(userId || '').trim()
  if (!uid) return []
  const normalized = (Array.isArray(pets) ? pets : [])
    .map(normalizeDeliveredPet)
    .filter(Boolean)
    .filter(hasUsableWebResources)
  const urlExpiresAt = normalized.reduce((min, pet) => {
    if (!pet.urlExpiresAt) return min
    return min ? Math.min(min, pet.urlExpiresAt) : pet.urlExpiresAt
  }, 0)
  uni.setStorageSync(catalogKey(uid), { pets: normalized, updatedAt: Date.now(), urlExpiresAt })
  return normalized
}

export function clearCachedDeliveredPets(userId = getStoredUserId()) {
  const uid = String(userId || '').trim()
  if (!uid) return
  try { uni.removeStorageSync(catalogKey(uid)) } catch {}
}

export function getAvailablePets(userId = getStoredUserId()) {
  return [...petOptions, ...getCachedDeliveredPets(userId)]
}

export function getAvailablePetById(userId, value) {
  const id = String(value || '').trim()
  return getAvailablePets(userId).find((pet) => pet.id === id) || petOptions[0]
}

export function getPetById(value, userId = getStoredUserId()) {
  return getAvailablePetById(userId, value)
}

export function getSelectedPetId(userId = getStoredUserId()) {
  const uid = String(userId || '').trim()
  try {
    const key = selectedKey(uid)
    const selected = String(uni.getStorageSync(key) || '').trim()
    if (selected) return selected

    if (uid) {
      const legacy = normalizeBuiltInPetId(uni.getStorageSync(LEGACY_SELECTED_KEY))
      if (legacy) {
        uni.setStorageSync(key, legacy)
        uni.removeStorageSync(LEGACY_SELECTED_KEY)
        return legacy
      }
    }
  } catch {}
  return 'xiaomi'
}

export function setSelectedPetId(id, userId = getStoredUserId()) {
  const uid = String(userId || '').trim()
  const rawId = String(id || '').trim()
  if (!getAvailablePets(uid).some((pet) => pet.id === rawId)) return false
  try {
    uni.setStorageSync(selectedKey(uid), rawId)
    return true
  } catch {
    return false
  }
}

export function clearSelectedPetId(userId = getStoredUserId()) {
  try { uni.removeStorageSync(selectedKey(userId)) } catch {}
}

export function clearPetUserState(userId = getStoredUserId()) {
  clearCachedDeliveredPets(userId)
  clearSelectedPetId(userId)
}

export async function refreshDeliveredPetCatalog(userId, loader) {
  const uid = String(userId || '').trim()
  if (!uid || typeof loader !== 'function') return []
  const response = await loader()
  const result = response?.result || response || {}
  if (!result.success) throw new Error(result.message || '读取定制宠物失败')
  return setCachedDeliveredPets(uid, result.pets || [])
}

function resolvePet(petOrId, userId = getStoredUserId()) {
  return petOrId && typeof petOrId === 'object' ? petOrId : getPetById(petOrId, userId)
}

function getCloudConfig(petOrId, userId = getStoredUserId()) {
  const pet = resolvePet(petOrId, userId)
  const builtIn = CLOUD_PET_CONFIG[pet?.id]
  if (builtIn) return builtIn
  if (pet?.spritesheetFileID && pet?.manifestFileID) {
    return { spritesheetFileID: pet.spritesheetFileID, manifestFileID: pet.manifestFileID }
  }
  return null
}

function hasConfiguredCloudFiles(petOrId, userId = getStoredUserId()) {
  const cfg = getCloudConfig(petOrId, userId)
  return Boolean(cfg?.spritesheetFileID && cfg?.manifestFileID)
}

export function isCloudPet(petOrId, userId = getStoredUserId()) {
  return hasConfiguredCloudFiles(petOrId, userId)
}

function isMiniProgramFileSystemAvailable() {
  return typeof wx !== 'undefined' && Boolean(wx?.getFileSystemManager && wx?.env?.USER_DATA_PATH)
}

function safePathPart(value, fallback) {
  const part = String(value || '').trim()
  return PET_ID_PATTERN.test(part) ? part : fallback
}

function safeUserPathPart(value) {
  const userId = String(value || '').trim()
  if (!userId) return 'anonymous'
  if (PET_ID_PATTERN.test(userId)) return userId
  return `u_${Array.from(userId).map((char) => char.codePointAt(0).toString(16).padStart(6, '0')).join('')}`
}

export function getLocalPetDir(petOrId, userId = getStoredUserId()) {
  const pet = resolvePet(petOrId, userId)
  const petId = safePathPart(pet?.id, 'xiaomi')
  if (!isMiniProgramFileSystemAvailable()) return `_pets/${petId}`
  if (pet?.isCustom) {
    const uid = safeUserPathPart(userId)
    const version = safePathPart(pet.version, 'v1')
    return `${wx.env.USER_DATA_PATH}/pets/${uid}/${petId}/${version}`
  }
  return `${wx.env.USER_DATA_PATH}/pets/${petId}`
}

function hasUsableWebResources(pet) {
  if (!pet?.spritesheetURL || !pet?.avatarURL) return false
  return !pet.urlExpiresAt || Number(pet.urlExpiresAt) > Date.now() + URL_EXPIRY_SKEW_MS
}

export function isPetCachedLocally(petOrId, userId = getStoredUserId()) {
  const pet = resolvePet(petOrId, userId)
  if (!hasConfiguredCloudFiles(pet, userId)) return true
  if (!isMiniProgramFileSystemAvailable()) return hasUsableWebResources(pet)
  try {
    const fs = wx.getFileSystemManager()
    const dir = getLocalPetDir(pet, userId)
    fs.accessSync(`${dir}/spritesheet.webp`)
    fs.accessSync(`${dir}/manifest.json`)
    return true
  } catch {
    return false
  }
}

export function getCachedSpritesheetPath(petOrId, userId = getStoredUserId()) {
  const pet = resolvePet(petOrId, userId)
  if (!hasConfiguredCloudFiles(pet, userId)) return pet?.spritesheetPath || ''
  if (!isMiniProgramFileSystemAvailable()) return hasUsableWebResources(pet) ? pet.spritesheetURL : null
  if (isPetCachedLocally(pet, userId)) return `${getLocalPetDir(pet, userId)}/spritesheet.webp`
  return null
}

export function getResolvedSpritesheetPath(petOrId, userId = getStoredUserId()) {
  return getCachedSpritesheetPath(petOrId, userId) || resolvePet(petOrId, userId)?.spritesheetPath || ''
}

function ensureDir(fs, dirPath) {
  try { fs.accessSync(dirPath); return } catch {}
  try { fs.mkdirSync(dirPath, true) } catch (error) {
    try { fs.accessSync(dirPath) } catch { throw error }
  }
}

function persistTempFile(fs, tempFilePath, destPath) {
  if (!tempFilePath) throw new Error('download tempFilePath is empty')
  try { fs.unlinkSync(destPath) } catch {}
  if (typeof fs.saveFileSync === 'function') fs.saveFileSync(tempFilePath, destPath)
  else fs.copyFileSync(tempFilePath, destPath)
}

function downloadHttpFile(url) {
  return new Promise((resolve, reject) => {
    wx.downloadFile({
      url,
      success: (res) => {
        if (res.statusCode && res.statusCode >= 400) return reject(new Error(`http download failed with status ${res.statusCode}`))
        resolve(res.tempFilePath)
      },
      fail: reject
    })
  })
}

function buildManifestSnapshot(pet) {
  return {
    name: pet.id,
    renderer: 'spritesheet',
    cellWidth: pet.cellWidth,
    cellHeight: pet.cellHeight,
    columns: pet.columns,
    rows: pet.rows,
    rowMap: pet.rowMap,
    states: pet.states
  }
}

function ensurePetCloudReady() {
  if (petCloudInitialized) return
  if (typeof wx !== 'undefined' && wx?.cloud?.init) {
    wx.cloud.init({ env: CLOUD_ENV_ID, traceUser: true })
    petCloudInitialized = true
  }
}

export async function downloadPetAssets(petOrId, userId = getStoredUserId()) {
  const pet = resolvePet(petOrId, userId)
  const cloudCfg = getCloudConfig(pet, userId)
  if (!cloudCfg || !hasConfiguredCloudFiles(pet, userId)) return false

  // H5/browser: the backend returns authorized temporary URLs. Browser HTTP
  // cache replaces the mini-program persistent file cache.
  if (!isMiniProgramFileSystemAvailable()) return hasUsableWebResources(pet)

  const fs = wx.getFileSystemManager()
  ensurePetCloudReady()
  const root = wx.env.USER_DATA_PATH
  const dir = getLocalPetDir(pet, userId)
  ensureDir(fs, `${root}/pets`)
  if (pet?.isCustom) {
    const safeUserId = safeUserPathPart(userId)
    ensureDir(fs, `${root}/pets/${safeUserId}`)
    ensureDir(fs, `${root}/pets/${safeUserId}/${safePathPart(pet.id, 'custom')}`)
  }
  ensureDir(fs, dir)

  const files = [
    { fileID: cloudCfg.spritesheetFileID, name: 'spritesheet.webp' },
    { fileID: cloudCfg.manifestFileID, name: 'manifest.json' }
  ]

  if (pet?.isCustom) {
    if (!hasUsableWebResources(pet) || typeof wx.downloadFile !== 'function') return false
    const tempFilePath = await downloadHttpFile(pet.spritesheetURL)
    persistTempFile(fs, tempFilePath, `${dir}/spritesheet.webp`)
    fs.writeFileSync(`${dir}/manifest.json`, JSON.stringify(buildManifestSnapshot(pet)), 'utf8')
    uni.setStorageSync(`pet_cache_ver_${userId}_${pet.id}`, pet.version || Date.now())
    return true
  }

  for (const file of files) {
    const tempFilePath = await new Promise((resolve, reject) => {
      wx.cloud.downloadFile({
        fileID: file.fileID,
        config: { env: CLOUD_ENV_ID },
        success: (res) => {
          if (res.statusCode && res.statusCode >= 400) return reject(new Error(`cloud download failed with status ${res.statusCode}`))
          resolve(res.tempFilePath)
        },
        fail: reject
      })
    })
    persistTempFile(fs, tempFilePath, `${dir}/${file.name}`)
  }

  uni.setStorageSync(`pet_cache_ver_${userId || 'builtin'}_${pet.id}`, pet.version || Date.now())
  return true
}
