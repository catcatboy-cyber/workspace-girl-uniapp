'use strict'

const ANNOUNCEMENTS = 'system_announcements'
let collectionReady = false

async function ensureCollection(db) {
  if (collectionReady) return
  try {
    await db.createCollection(ANNOUNCEMENTS)
  } catch (error) {
    const message = String(error?.message || '').toLowerCase()
    if (!message.includes('already') && !message.includes('exist') && error?.code !== 'DATABASE_COLLECTION_ALREADY_EXISTS') {
      throw error
    }
  }
  collectionReady = true
}

function normalizeAnnouncement(input = {}) {
  const id = String(input._id || '').trim()
  return {
    _id: id,
    title: String(input.title || '').trim().slice(0, 100),
    content: String(input.content || '').trim().slice(0, 1000),
    targetType: input.targetType === 'user' ? 'user' : 'all',
    targetUserId: input.targetType === 'user' ? String(input.targetUserId || '').trim() : '',
    status: input.status === 'disabled' ? 'disabled' : 'active',
    expiresAt: input.expiresAt instanceof Date ? input.expiresAt : input.expiresAt ? new Date(input.expiresAt) : null,
    createdAt: input.createdAt instanceof Date ? input.createdAt : input.createdAt ? new Date(input.createdAt) : null,
    createdBy: String(input.createdBy || '').trim(),
    updatedAt: input.updatedAt instanceof Date ? input.updatedAt : input.updatedAt ? new Date(input.updatedAt) : null
  }
}

function firstDoc(response) {
  const data = response?.data
  if (Array.isArray(data)) return data[0] || null
  return data && typeof data === 'object' ? data : null
}

async function readDoc(dbLike, collection, id) {
  return firstDoc(await dbLike.collection(collection).doc(id).get())
}

/**
 * 发布公告（幂等：同 id 覆盖）
 * 校验：标题/内容必填；targetType=user 时 targetUserId 必填
 */
async function createAnnouncement(db, event = {}, adminUserId = '') {
  const title = String(event.title || '').trim()
  const content = String(event.content || '').trim()
  const targetType = event.targetType === 'user' ? 'user' : 'all'
  const targetUserId = String(event.targetUserId || '').trim()
  if (!title) return { success: false, message: '公告标题必填' }
  if (!content) return { success: false, message: '公告内容必填' }
  if (targetType === 'user' && !targetUserId) return { success: false, message: '指定用户公告必须填写用户ID' }
  await ensureCollection(db)

  const now = new Date()
  const doc = {
    title,
    content,
    targetType,
    targetUserId: targetType === 'user' ? targetUserId : '',
    status: event.status === 'disabled' ? 'disabled' : 'active',
    expiresAt: event.expiresAt ? new Date(event.expiresAt) : null,
    createdAt: now,
    createdBy: adminUserId,
    updatedAt: now
  }
  let id = String(event.announcementId || '').trim()
  if (id) {
    const existing = await readDoc(db, ANNOUNCEMENTS, id)
    if (!existing) return { success: false, message: '公告不存在' }
    doc.createdAt = existing.createdAt || now
    await db.collection(ANNOUNCEMENTS).doc(id).update({
      title: doc.title,
      content: doc.content,
      targetType: doc.targetType,
      targetUserId: doc.targetUserId,
      status: doc.status,
      expiresAt: doc.expiresAt,
      updatedAt: doc.updatedAt
    })
  } else {
    const result = await db.collection(ANNOUNCEMENTS).add(doc)
    id = result.id || result._id
  }
  return { success: true, announcement: { ...doc, _id: id } }
}

async function updateAnnouncementStatus(db, event = {}, adminUserId = '') {
  const id = String(event.announcementId || '').trim()
  if (!id) return { success: false, message: '缺少公告ID' }
  const status = event.status === 'active' ? 'active' : event.status === 'disabled' ? 'disabled' : ''
  if (!status) return { success: false, message: '状态必须是 active 或 disabled' }
  const existing = await readDoc(db, ANNOUNCEMENTS, id)
  if (!existing) return { success: false, message: '公告不存在' }
  await db.collection(ANNOUNCEMENTS).doc(id).update({ status, updatedAt: new Date(), updatedBy: adminUserId })
  return { success: true, announcementId: id, status }
}

async function removeAnnouncement(db, event = {}) {
  const id = String(event.announcementId || '').trim()
  if (!id) return { success: false, message: '缺少公告ID' }
  const existing = await readDoc(db, ANNOUNCEMENTS, id)
  if (!existing) return { success: false, message: '公告不存在' }
  await db.collection(ANNOUNCEMENTS).doc(id).remove()
  return { success: true, announcementId: id }
}

async function listAnnouncements(db, event = {}) {
  const page = Math.max(1, Number(event.page) || 1)
  const pageSize = Math.max(1, Math.min(100, Number(event.pageSize) || 20))
  const where = {}
  if (event.status && event.status !== 'all') where.status = String(event.status)
  let query = db.collection(ANNOUNCEMENTS)
  if (Object.keys(where).length) query = query.where(where)
  const count = await query.count()
  const { data = [] } = await query.orderBy('createdAt', 'desc').skip((page - 1) * pageSize).limit(pageSize).get()
  return {
    success: true,
    announcements: (data || []).map((item) => normalizeAnnouncement(item)),
    total: Number(count?.total || 0),
    page,
    pageSize
  }
}

/**
 * 用户端获取当前可见公告：
 * - status active 且未过期（expiresAt 为空或未来）
 * - targetType=all 全员可见；targetType=user 仅目标用户可见（需登录态 userId）
 */
async function getActiveAnnouncements(db, userId = '') {
  const now = new Date()
  const { data = [] } = await db.collection(ANNOUNCEMENTS)
    .where({ status: 'active' })
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get()
  const visible = (data || []).filter((item) => {
    if (item.expiresAt && new Date(item.expiresAt).getTime() <= now.getTime()) return false
    if (item.targetType === 'user') {
      return Boolean(userId) && String(item.targetUserId || '') === String(userId)
    }
    return true
  })
  return visible.map((item) => ({
    id: item._id,
    title: item.title,
    content: item.content,
    createdAt: item.createdAt
  }))
}

module.exports = {
  ANNOUNCEMENTS,
  createAnnouncement,
  updateAnnouncementStatus,
  removeAnnouncement,
  listAnnouncements,
  getActiveAnnouncements,
  normalizeAnnouncement
}
