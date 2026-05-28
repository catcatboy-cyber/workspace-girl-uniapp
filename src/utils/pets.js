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

// CloudBase cloud storage file IDs.
// After uploading pet assets to CloudBase storage, update these IDs.
// Xiaomi is bundled locally; Doggo is cloud-hosted.
const CLOUD_PET_CONFIG = {
  doggo: {
    spritesheetFileID: 'cloud://cloud1-d8gqh3f5g49993a5a.636c-cloud1-d8gqh3f5g49993a5a-1419212433/pets/doggo/spritesheet.webp',
    manifestFileID: 'cloud://cloud1-d8gqh3f5g49993a5a.636c-cloud1-d8gqh3f5g49993a5a-1419212433/pets/doggo/manifest.json'
  }
}

export const petOptions = [
  {
    id: 'xiaomi',
    displayName: '小咪',
    description: '默认陪伴助手，适合轻松提醒和帮你说。',
    renderer: 'spritesheet',
    avatarPath: '/static/pets/xiaomi/avatar.png',
    spritesheetPath: '/static/pets/xiaomi/spritesheet.webp',
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
    spritesheetPath: '/static/pets/xiaomi/spritesheet.webp',
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
  if (petId === 'doggo') return CLOUD_PET_CONFIG.doggo
  return null
}

export function isCloudPet(petId) {
  return !!getCloudConfig(petId)
}

export function getLocalPetDir(petId) {
  try {
    return `${wx.env.USER_DATA_PATH}/pets/${petId}`
  } catch {
    return `_pets/${petId}`
  }
}

export function isPetCachedLocally(petId) {
  const cloudCfg = getCloudConfig(petId)
  if (!cloudCfg) return true // non-cloud pets are always "cached" (bundled)
  try {
    const fs = wx.getFileSystemManager()
    const spritesheetPath = `${getLocalPetDir(petId)}/spritesheet.webp`
    fs.accessSync(spritesheetPath)
    return true
  } catch {
    return false
  }
}

export function getCachedSpritesheetPath(petId) {
  if (!getCloudConfig(petId)) return getPetById(petId).spritesheetPath
  if (isPetCachedLocally(petId)) {
    return `${getLocalPetDir(petId)}/spritesheet.webp`
  }
  return null
}

export function getResolvedSpritesheetPath(petId) {
  const cached = getCachedSpritesheetPath(petId)
  if (cached) return cached
  // Cloud pet without local cache — use xiaomi as placeholder until download completes
  if (isCloudPet(petId)) return getPetById('xiaomi').spritesheetPath
  return getPetById(petId).spritesheetPath
}

export async function downloadPetAssets(petId) {
  const cloudCfg = getCloudConfig(petId)
  if (!cloudCfg) return true
  if (!cloudCfg.spritesheetFileID || !cloudCfg.manifestFileID) {
    console.warn('[pets] Cloud file IDs not configured for', petId)
    return false
  }

  const dir = getLocalPetDir(petId)
  const fs = wx.getFileSystemManager()
  try { fs.mkdirSync(dir, true) } catch {}

  const files = [
    { fileID: cloudCfg.spritesheetFileID, name: 'spritesheet.webp' },
    { fileID: cloudCfg.manifestFileID, name: 'manifest.json' }
  ]

  for (const f of files) {
    await new Promise((resolve, reject) => {
      wx.cloud.downloadFile({
        fileID: f.fileID,
        success: (res) => {
          try {
            fs.copyFileSync(res.tempFilePath, `${dir}/${f.name}`)
            resolve(true)
          } catch (e) {
            reject(e)
          }
        },
        fail: reject
      })
    })
  }

  uni.setStorageSync(`pet_cache_ver_${petId}`, Date.now())
  return true
}
