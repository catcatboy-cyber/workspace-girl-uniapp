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

const CLOUD_ENV_ID = 'cloud1-d0gvhqu2c8a2b61fd'
let petCloudInitialized = false

// CloudBase cloud storage file IDs.
// Spritesheets are cached under wx.env.USER_DATA_PATH on first use.
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
    description: '默认陪伴助手，适合轻松提醒和帮你说。',
    renderer: 'spritesheet',
    avatarPath: '/static/pets/xiaomi/avatar.png',
    spritesheetPath: '',
    cellWidth: 192,
    cellHeight: 208,
    columns: 8,
    rows: 9,
    rowMap: {
      idle: 0,
      'running-right': 1,
      'running-left': 2,
      waving: 3,
      jumping: 4,
      failed: 5,
      waiting: 6,
      running: 7,
      review: 8
    },
    states: sharedPetStates
  },
  {
    id: 'doggo',
    displayName: 'Doggo',
    description: '友好的小狗陪伴助手，圆脸垂耳，会摇尾巴。',
    renderer: 'spritesheet',
    // Cloud-hosted spritesheet — downloadPetAssets() on first use.
    // Avatar kept locally (48KB) for the pet picker; spritesheet falls back to xiaomi until cloud download completes.
    avatarPath: '/static/pets/doggo/avatar.png',
    spritesheetPath: '',
    cellWidth: 192,
    cellHeight: 208,
    columns: 8,
    rows: 9,
    rowMap: {
      idle: 0,
      'running-right': 1,
      'running-left': 2,
      waving: 3,
      jumping: 4,
      failed: 5,
      waiting: 6,
      running: 7,
      review: 8
    },
    states: sharedPetStates
  }
]

export function normalizePetId(value) {
  return value === 'doggo' ? 'doggo' : 'xiaomi'
}

export function getPetById(value) {
  const id = normalizePetId(value)
  return petOptions.find(pet => pet.id === id) || petOptions[0]
}

export function getSelectedPetId() {
  try {
    return normalizePetId(uni.getStorageSync('selectedPetId'))
  } catch {
    return 'xiaomi'
  }
}

export function setSelectedPetId(id) {
  uni.setStorageSync('selectedPetId', normalizePetId(id))
}

// ---- Cloud download & local cache ----

function getCloudConfig(petId) {
  if (petId === 'xiaomi') return CLOUD_PET_CONFIG.xiaomi
  if (petId === 'doggo') return CLOUD_PET_CONFIG.doggo
  return null
}

function hasConfiguredCloudFiles(petId) {
  const cfg = getCloudConfig(petId)
  return Boolean(cfg?.spritesheetFileID && cfg?.manifestFileID)
}

export function isCloudPet(petId) {
  return hasConfiguredCloudFiles(petId)
}

export function getLocalPetDir(petId) {
  try {
    return `${wx.env.USER_DATA_PATH}/pets/${petId}`
  } catch {
    return `_pets/${petId}`
  }
}

export function isPetCachedLocally(petId) {
  if (!hasConfiguredCloudFiles(petId)) return true // non-cloud pets are always "cached" (bundled)
  try {
    const fs = wx.getFileSystemManager()
    const dir = getLocalPetDir(petId)
    fs.accessSync(`${dir}/spritesheet.webp`)
    fs.accessSync(`${dir}/manifest.json`)
    return true
  } catch {
    return false
  }
}

export function getCachedSpritesheetPath(petId) {
  if (!hasConfiguredCloudFiles(petId)) return getPetById(petId).spritesheetPath
  if (isPetCachedLocally(petId)) {
    return `${getLocalPetDir(petId)}/spritesheet.webp`
  }
  return null
}

export function getResolvedSpritesheetPath(petId) {
  const cached = getCachedSpritesheetPath(petId)
  if (cached) return cached
  return getPetById(petId).spritesheetPath
}

function ensureDir(fs, dirPath) {
  try {
    fs.accessSync(dirPath)
    return
  } catch {}
  try {
    fs.mkdirSync(dirPath, true)
  } catch (e) {
    // mkdirSync throws if the dir already exists; only rethrow if it's still missing.
    try { fs.accessSync(dirPath) } catch { throw e }
  }
}

function persistTempFile(fs, tempFilePath, destPath) {
  if (!tempFilePath) throw new Error('download tempFilePath is empty')
  try { fs.unlinkSync(destPath) } catch {}
  // saveFileSync is purpose-built to persist temp files (http://tmp on DevTools,
  // wxfile://tmp on device); copyFileSync cannot read those temp paths.
  if (typeof fs.saveFileSync === 'function') {
    fs.saveFileSync(tempFilePath, destPath)
  } else {
    fs.copyFileSync(tempFilePath, destPath)
  }
}

function ensurePetCloudReady() {
  if (petCloudInitialized) return
  try {
    if (wx?.cloud?.init) {
      wx.cloud.init({ env: CLOUD_ENV_ID, traceUser: true })
      petCloudInitialized = true
    }
  } catch {}
}

export async function downloadPetAssets(petId) {
  const cloudCfg = getCloudConfig(petId)
  if (!cloudCfg || !hasConfiguredCloudFiles(petId)) return false

  const fs = wx.getFileSystemManager()
  ensurePetCloudReady()
  const root = (() => { try { return wx.env.USER_DATA_PATH } catch { return '' } })()
  const dir = getLocalPetDir(petId)
  // Create each level explicitly — saveFileSync requires the target dir to exist.
  if (root) ensureDir(fs, `${root}/pets`)
  ensureDir(fs, dir)

  const files = [
    { fileID: cloudCfg.spritesheetFileID, name: 'spritesheet.webp' },
    { fileID: cloudCfg.manifestFileID, name: 'manifest.json' }
  ]

  for (const f of files) {
    const tempFilePath = await new Promise((resolve, reject) => {
      wx.cloud.downloadFile({
        fileID: f.fileID,
        config: { env: CLOUD_ENV_ID },
        success: (res) => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`cloud download failed with status ${res.statusCode}`))
            return
          }
          resolve(res.tempFilePath)
        },
        fail: reject
      })
    })
    persistTempFile(fs, tempFilePath, `${dir}/${f.name}`)
  }

  uni.setStorageSync(`pet_cache_ver_${petId}`, Date.now())
  return true
}
