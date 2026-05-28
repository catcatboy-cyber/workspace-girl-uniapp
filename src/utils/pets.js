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

export const petOptions = [
  {
    id: 'xiaomi',
    displayName: '小咪',
    description: '默认陪伴助手，适合轻松提醒和帮你说。',
    basePath: '/static/pets/xiaomi/frames',
    states: sharedPetStates
  },
  {
    id: 'doggo',
    displayName: 'Doggo',
    description: '友好的小狗陪伴助手，圆脸垂耳，会摇尾巴。',
    basePath: '/static/pets/doggo/frames',
    renderer: 'spritesheet',
    spritesheetPath: '/static/pets/doggo/spritesheet.webp',
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
