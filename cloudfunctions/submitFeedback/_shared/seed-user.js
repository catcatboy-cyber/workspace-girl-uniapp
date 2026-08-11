'use strict'

const SEED_USERS = 'commission_seed_users'
let collectionReady = false

async function ensureCollection(db) {
  if (collectionReady) return
  try {
    await db.createCollection(SEED_USERS)
  } catch (error) {
    const message = String(error?.message || '').toLowerCase()
    if (!message.includes('already') && !message.includes('exist') && error?.code !== 'DATABASE_COLLECTION_ALREADY_EXISTS') {
      throw error
    }
  }
  collectionReady = true
}

function firstDoc(response) {
  const data = response?.data
  if (Array.isArray(data)) return data[0] || null
  return data && typeof data === 'object' ? data : null
}

/**
 * 是否种子用户（me 页【我的邀请】卡片可见性白名单）
 */
async function isSeedUser(db, userId) {
  const id = String(userId || '').trim()
  if (!id) return false
  try {
    const doc = await firstDoc(await db.collection(SEED_USERS).doc(id).get())
    return Boolean(doc && doc.enabled !== false)
  } catch (_) {
    return false
  }
}

async function listSeedUsers(db, event = {}) {
  await ensureCollection(db)
  const page = Math.max(1, Number(event.page) || 1)
  const pageSize = Math.max(1, Math.min(100, Number(event.pageSize) || 20))
  const query = db.collection(SEED_USERS)
  const count = await query.count()
  const { data = [] } = await query.orderBy('createdAt', 'desc').skip((page - 1) * pageSize).limit(pageSize).get()
  return {
    success: true,
    users: (data || []).map((item) => ({
      userId: item._id,
      note: String(item.note || ''),
      enabled: item.enabled !== false,
      createdAt: item.createdAt || null,
      createdBy: String(item.createdBy || '')
    })),
    total: Number(count?.total || 0),
    page,
    pageSize
  }
}

async function addSeedUser(db, event = {}, adminUserId = '') {
  await ensureCollection(db)
  const userId = String(event.userId || '').trim()
  if (!userId) return { success: false, message: '缺少用户ID' }
  const note = String(event.note || '').trim().slice(0, 200)
  const now = new Date()
  const existing = await firstDoc(await db.collection(SEED_USERS).doc(userId).get())
  if (existing) {
    await db.collection(SEED_USERS).doc(userId).update({ note, enabled: true, updatedAt: now, updatedBy: adminUserId })
    return { success: true, userId, message: '已更新种子用户' }
  }
  await db.collection(SEED_USERS).doc(userId).set({
    note,
    enabled: true,
    createdAt: now,
    createdBy: adminUserId,
    updatedAt: now
  })
  return { success: true, userId, message: '已添加种子用户' }
}

async function removeSeedUser(db, event = {}) {
  const userId = String(event.userId || '').trim()
  if (!userId) return { success: false, message: '缺少用户ID' }
  const existing = await firstDoc(await db.collection(SEED_USERS).doc(userId).get())
  if (!existing) return { success: false, message: '该用户不在种子名单中' }
  await db.collection(SEED_USERS).doc(userId).remove()
  return { success: true, userId }
}

module.exports = {
  SEED_USERS,
  isSeedUser,
  listSeedUsers,
  addSeedUser,
  removeSeedUser
}
