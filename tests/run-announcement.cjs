'use strict'
/**
 * 系统公告专项测试：
 * - createAnnouncement：全员/指定用户/缺标题/缺用户ID/幂等更新
 * - getActiveAnnouncements：全员可见、指定用户仅目标可见、未登录仅全员、过期/停用不展示
 * - updateAnnouncementStatus / removeAnnouncement
 * - adminManage 公告 action 走 fake-cloudbase 全链路
 */
const assert = require('node:assert/strict')
const path = require('path')
const { createFakeCloudbase, setCurrentFakeCloudbase, installCloudbaseMock, clearCloudFunctionCache } = require('./support/fake-cloudbase.cjs')

installCloudbaseMock()

const projectRoot = path.resolve(__dirname, '..')

function seed(store, collection, id, value) {
  store.getCollection(collection).set(id, { _id: id, ...value })
}

async function main() {
  const fake = createFakeCloudbase()
  const db = fake.init().database()
  const ann = require('../cloudfunctions/_shared/announcement')

  // 创建全员公告
  const allResult = await ann.createAnnouncement(db, { title: '系统维护通知', content: '今晚 2 点维护', targetType: 'all' }, 'admin-1')
  assert.equal(allResult.success, true)
  assert.ok(allResult.announcement._id)
  const allId = allResult.announcement._id

  // 创建指定用户公告
  const userResult = await ann.createAnnouncement(db, { title: '专属福利', content: '你中奖了', targetType: 'user', targetUserId: 'u-target' }, 'admin-1')
  assert.equal(userResult.success, true)
  const userId = userResult.announcement._id

  // 缺标题/缺内容
  assert.equal((await ann.createAnnouncement(db, { content: 'x', targetType: 'all' })).success, false, '缺标题拒绝')
  assert.equal((await ann.createAnnouncement(db, { title: 'x', targetType: 'all' })).success, false, '缺内容拒绝')
  assert.equal((await ann.createAnnouncement(db, { title: 'x', content: 'x', targetType: 'user' })).success, false, '指定用户缺用户ID拒绝')

  // 已过期公告
  const expired = await ann.createAnnouncement(db, { title: '过期', content: 'x', targetType: 'all', expiresAt: new Date(Date.now() - 1000) }, 'admin-1')
  // 已停用公告
  const disabled = await ann.createAnnouncement(db, { title: '停用', content: 'x', targetType: 'all', status: 'disabled' }, 'admin-1')

  // 可见性：未登录用户只看到全员（不含指定、过期、停用）
  const anonymous = await ann.getActiveAnnouncements(db, '')
  const anonIds = anonymous.map((a) => a.id)
  assert.ok(anonIds.includes(allId), '未登录可见全员公告')
  assert.ok(!anonIds.includes(userId), '未登录不可见指定用户公告')
  assert.ok(!anonIds.includes(expired.announcement._id), '过期公告不展示')
  assert.ok(!anonIds.includes(disabled.announcement._id), '停用公告不展示')

  // 可见性：目标用户看到全员 + 指定
  const target = await ann.getActiveAnnouncements(db, 'u-target')
  const targetIds = target.map((a) => a.id)
  assert.ok(targetIds.includes(allId), '目标用户可见全员公告')
  assert.ok(targetIds.includes(userId), '目标用户可见自己的公告')

  // 可见性：其他用户看不到指定公告
  const other = await ann.getActiveAnnouncements(db, 'u-other')
  assert.ok(!other.map((a) => a.id).includes(userId), '非目标用户不可见指定公告')

  // 停用
  const disabledResult = await ann.updateAnnouncementStatus(db, { announcementId: allId, status: 'disabled' }, 'admin-1')
  assert.equal(disabledResult.success, true)
  const afterDisable = await ann.getActiveAnnouncements(db, '')
  assert.ok(!afterDisable.map((a) => a.id).includes(allId), '停用后不展示')
  // 重新启用
  await ann.updateAnnouncementStatus(db, { announcementId: allId, status: 'active' }, 'admin-1')
  const afterEnable = await ann.getActiveAnnouncements(db, '')
  assert.ok(afterEnable.map((a) => a.id).includes(allId), '启用后恢复展示')

  // 幂等更新（同 id 覆盖）
  const updated = await ann.createAnnouncement(db, { announcementId: allId, title: '系统维护通知(改)', content: '改到明晚', targetType: 'all' }, 'admin-1')
  assert.equal(updated.success, true)
  const listResult = await ann.listAnnouncements(db, {})
  const found = listResult.announcements.find((a) => a._id === allId)
  assert.equal(found.title, '系统维护通知(改)', '同 id 更新覆盖')

  // 删除
  const removed = await ann.removeAnnouncement(db, { announcementId: userId })
  assert.equal(removed.success, true)
  const afterRemove = await ann.getActiveAnnouncements(db, 'u-target')
  assert.ok(!afterRemove.map((a) => a.id).includes(userId), '删除后不展示')

  // ── adminManage 全链路 ──
  const adminFake = createFakeCloudbase()
  setCurrentFakeCloudbase(adminFake)
  seed(adminFake.__store, 'users', 'admin-1', { email: 'admin@example.com', isAdmin: true })
  fake.__setAuthUser && adminFake.__setAuthUser('admin-1')
  clearCloudFunctionCache(projectRoot)
  const main = require(path.join(projectRoot, 'cloudfunctions/adminManage/index.js')).main
  const created = await main({ action: 'createAnnouncement', title: '后台发布', content: '来自后台', targetType: 'all' })
  assert.equal(created.success, true)
  const listed = await main({ action: 'listAnnouncements', page: 1, pageSize: 10 })
  assert.equal(listed.success, true)
  assert.ok(listed.announcements.some((a) => a.title === '后台发布'), '后台列表可见')
  const toggled = await main({ action: 'updateAnnouncementStatus', announcementId: created.announcement._id, status: 'disabled' })
  assert.equal(toggled.success, true)
  assert.equal(toggled.status, 'disabled')
  const removedAdmin = await main({ action: 'removeAnnouncement', announcementId: created.announcement._id })
  assert.equal(removedAdmin.success, true)

  console.log('announcement tests passed')
}

main().catch((error) => { console.error(error); process.exit(1) })
