'use strict'
/**
 * 种子用户专项测试：
 * - isSeedUser：白名单内 true / 外 false / 未登录 false
 * - addSeedUser：添加/更新/缺 userId；removeSeedUser
 * - referralCommission getSeedUserStatus action（fake-cloudbase 全链路）
 * - adminManage 管理 action
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
  const seedUser = require('../cloudfunctions/_shared/seed-user')

  // 空名单：非种子
  assert.equal(await seedUser.isSeedUser(db, 'u1'), false, '空名单非种子')
  assert.equal(await seedUser.isSeedUser(db, ''), false, '空 userId 非种子')

  // 添加
  const added = await seedUser.addSeedUser(db, { userId: 'seed-1', note: '种子用户1' }, 'admin-1')
  assert.equal(added.success, true)
  assert.equal(await seedUser.isSeedUser(db, 'seed-1'), true, '白名单内为种子')
  assert.equal(await seedUser.isSeedUser(db, 'other-1'), false, '白名单外非种子')

  // 缺 userId
  assert.equal((await seedUser.addSeedUser(db, { note: 'x' }, 'admin-1')).success, false, '缺 userId 拒绝')

  // 更新（同 id 再添加 → 更新 note）
  const updated = await seedUser.addSeedUser(db, { userId: 'seed-1', note: '改备注' }, 'admin-1')
  assert.equal(updated.success, true)
  assert.equal(updated.message.includes('更新'), true)
  const listed = await seedUser.listSeedUsers(db, {})
  assert.equal(listed.success, true)
  const found = listed.users.find((u) => u.userId === 'seed-1')
  assert.equal(found.note, '改备注')

  // 移除
  const removed = await seedUser.removeSeedUser(db, { userId: 'seed-1' })
  assert.equal(removed.success, true)
  assert.equal(await seedUser.isSeedUser(db, 'seed-1'), false, '移除后非种子')
  assert.equal((await seedUser.removeSeedUser(db, { userId: 'seed-1' })).success, false, '重复移除拒绝')

  // ── referralCommission getSeedUserStatus ──
  const rcFake = createFakeCloudbase()
  setCurrentFakeCloudbase(rcFake)
  seed(rcFake.__store, 'commission_seed_users', 'rc-seed', { note: 'x', enabled: true, createdAt: new Date() })
  clearCloudFunctionCache(projectRoot)
  const rcMain = require(path.join(projectRoot, 'cloudfunctions/referralCommission/index.js')).main
  // authUserId 传入（H5 模式）
  const seedStatus = await rcMain({ action: 'getSeedUserStatus', authUserId: 'rc-seed' })
  assert.equal(seedStatus.success, true)
  assert.equal(seedStatus.isSeedUser, true, '种子用户返回 true')
  const nonSeedStatus = await rcMain({ action: 'getSeedUserStatus', authUserId: 'rc-other' })
  assert.equal(nonSeedStatus.success, true)
  assert.equal(nonSeedStatus.isSeedUser, false, '非种子用户返回 false')

  // ── adminManage 管理 action ──
  const adminFake = createFakeCloudbase()
  setCurrentFakeCloudbase(adminFake)
  seed(adminFake.__store, 'users', 'admin-1', { email: 'admin@example.com', isAdmin: true })
  adminFake.__setAuthUser('admin-1')
  clearCloudFunctionCache(projectRoot)
  const main = require(path.join(projectRoot, 'cloudfunctions/adminManage/index.js')).main
  const adminAdd = await main({ action: 'addSeedUser', userId: 'admin-seed-1', note: '后台添加' })
  assert.equal(adminAdd.success, true)
  const adminList = await main({ action: 'listSeedUsers', page: 1, pageSize: 10 })
  assert.equal(adminList.success, true)
  assert.ok(adminList.users.some((u) => u.userId === 'admin-seed-1'), '后台列表可见')
  const adminRemove = await main({ action: 'removeSeedUser', userId: 'admin-seed-1' })
  assert.equal(adminRemove.success, true)
  const adminListAfter = await main({ action: 'listSeedUsers', page: 1, pageSize: 10 })
  assert.ok(!adminListAfter.users.some((u) => u.userId === 'admin-seed-1'), '后台移除后不可见')

  console.log('seed user tests passed')
}

main().catch((error) => { console.error(error); process.exit(1) })
