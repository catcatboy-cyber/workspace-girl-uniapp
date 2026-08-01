/**
 * 邀请码 / 推荐奖励 冒烟测试
 * 运行: node tests/run-referral-smoke.cjs
 *
 * 覆盖场景:
 *   1. 新用户带 inviteCode → 只生成一条 referral_claims
 *   2. 重复 redeemInviteCode → 不重复加 Token
 *   3. call_usage_records.source 格式 (referral_inviter / referral_invitee)
 *   4. 老用户点分享 → 只新增 share_visits，不新增 claim、不加 Token
 *   5. 自邀请拦截
 *   6. 无效邀请码报错
 */
const assert = require('node:assert/strict')
const path = require('path')

const { createFakeCloudbase, installCloudbaseMock, setCurrentFakeCloudbase, clearCloudFunctionCache } = require('./support/fake-cloudbase.cjs')
const projectRoot = path.resolve(__dirname, '..')
installCloudbaseMock()

function loadFunction(name) {
  clearCloudFunctionCache(projectRoot)
  return require(path.join(projectRoot, 'cloudfunctions', name, 'index.js')).main
}

let passed = 0, failed = 0

async function runCase(name, fn) {
  try { await fn(); passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`) }
  catch (e) { failed++; console.error(`  \x1b[31m✗\x1b[0m ${name}\n    ${e.message}`); process.exitCode = 1 }
}

// 辅助：创建用户
function seedUser(store, id, overrides = {}) {
  store.getCollection('users').set(id, {
    _id: id,
    email: `${id}@test.com`,
    plan: 'free',
    extraTokens: 0,
    inviteCode: '',
    invitedBy: null,
    referralCount: 0,
    monthlyTokensUsed: 0,
    monthlyTokensReset: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    ...overrides
  })
}

// 辅助：获取集合所有记录
function dumpCollection(store, name) {
  return [...store.getCollection(name).values()]
}

// ─── Main ─────────────────────────────────────────────
async function main() {
  console.log('=== 邀请码 / 推荐奖励 冒烟测试 ===\n')

  // ── 1. 新用户带 inviteCode → 只生成一条 referral_claims ──
  console.log('1. 新用户带 inviteCode 登录 → 只生成一条 referral_claims')
  await runCase('settleReward 成功创建一条 claim', async () => {
    const fake = createFakeCloudbase()
    const db = fake.init().database()
    const { settleReward } = require(path.join(projectRoot, 'cloudfunctions', '_shared', 'referral-settlement.js'))

    const inviterId = 'u_inviter_1'
    const inviteeId = 'u_invitee_1'
    const inviteCode = 'ABC123'

    seedUser(fake.__store, inviterId, { inviteCode })
    seedUser(fake.__store, inviteeId)

    const result = await settleReward(db, inviteeId, inviterId, inviteCode, 's_test1', 'test')

    assert.equal(result.success, true)
    assert.equal(result.inviteeUserId, inviteeId)
    assert.ok(result.inviterReward > 0)
    assert.ok(result.inviteeReward > 0)

    // 验证只有 1 条 claim
    const claims = dumpCollection(fake.__store, 'referral_claims')
    assert.equal(claims.length, 1)
    assert.equal(claims[0].inviteeUserId, inviteeId)
    assert.equal(claims[0].inviterUserId, inviterId)
    assert.equal(claims[0].inviteCode, inviteCode)
    assert.equal(claims[0].status, 'rewarded')
    assert.equal(claims[0].channel, 'test')
  })

  // ── 2. 重复调用 → 不重复加 Token ──
  console.log('\n2. 重复调用 redeemInviteCode → 不重复加 Token')
  await runCase('第二次 settleReward 被幂等拦截', async () => {
    const fake = createFakeCloudbase()
    const db = fake.init().database()
    const { settleReward } = require(path.join(projectRoot, 'cloudfunctions', '_shared', 'referral-settlement.js'))

    const inviterId = 'u_inviter_2'
    const inviteeId = 'u_invitee_2'
    const inviteCode = 'XYZ789'

    seedUser(fake.__store, inviterId, { inviteCode, extraTokens: 0 })
    seedUser(fake.__store, inviteeId, { extraTokens: 0 })

    // 第一次：成功
    const r1 = await settleReward(db, inviteeId, inviterId, inviteCode, 's_test2', 'test')
    assert.equal(r1.success, true)

    // 记录第一次后的 extraTokens
    const inviterAfter1 = fake.__store.getCollection('users').get(inviterId).extraTokens
    const inviteeAfter1 = fake.__store.getCollection('users').get(inviteeId).extraTokens
    assert.ok(inviterAfter1 > 0, `inviter should have tokens, got ${inviterAfter1}`)
    assert.ok(inviteeAfter1 > 0, `invitee should have tokens, got ${inviteeAfter1}`)

    // 第二次：应被拦截
    const r2 = await settleReward(db, inviteeId, inviterId, inviteCode, 's_test2b', 'test')
    assert.equal(r2.success, false)
    assert.ok(r2.message.includes('已被邀请过'), `expected '已被邀请过', got '${r2.message}'`)

    // 验证 Token 未二次增加
    const inviterAfter2 = fake.__store.getCollection('users').get(inviterId).extraTokens
    const inviteeAfter2 = fake.__store.getCollection('users').get(inviteeId).extraTokens
    assert.equal(inviterAfter2, inviterAfter1, `inviter tokens doubled: ${inviterAfter1} → ${inviterAfter2}`)
    assert.equal(inviteeAfter2, inviteeAfter1, `invitee tokens doubled: ${inviteeAfter1} → ${inviteeAfter2}`)

    // 验证只有 1 条 claim
    const claims = dumpCollection(fake.__store, 'referral_claims')
    assert.equal(claims.length, 1)
  })

  // ── 3. call_usage_records.source 格式 ──
  console.log('\n3. call_usage_records.source 格式验证')
  await runCase('邀请奖励来源拆分为 source + sourceId', async () => {
    const fake = createFakeCloudbase()
    const db = fake.init().database()
    const { settleReward } = require(path.join(projectRoot, 'cloudfunctions', '_shared', 'referral-settlement.js'))

    const inviterId = 'u_inviter_3'
    const inviteeId = 'u_invitee_3'

    seedUser(fake.__store, inviterId, { inviteCode: 'CODE3A' })
    seedUser(fake.__store, inviteeId)

    await settleReward(db, inviteeId, inviterId, 'CODE3A', '', 'test')

    const records = dumpCollection(fake.__store, 'call_usage_records')
    const grantRecords = records.filter(r => r.type === 'grant')
    assert.ok(grantRecords.length >= 2, `expected >= 2 grant records, got ${grantRecords.length}`)

    const hasInviterGrant = grantRecords.some(r => r.source === 'referral_inviter' && r.sourceId === inviteeId)
    const hasInviteeGrant = grantRecords.some(r => r.source === 'referral_invitee' && r.sourceId === inviteeId)

    assert.ok(hasInviterGrant, `missing inviter grant for sourceId='${inviteeId}'. Found: ${grantRecords.map(r => `${r.source}:${r.sourceId || ''}`).join(', ')}`)
    assert.ok(hasInviteeGrant, `missing invitee grant for sourceId='${inviteeId}'. Found: ${grantRecords.map(r => `${r.source}:${r.sourceId || ''}`).join(', ')}`)
  })

  // ── 4. 老用户点分享 → 只新增 share_visits ──
  console.log('\n4. 老用户点分享 → 只新增 share_visits，不新增 claim、不加 Token')
  await runCase('trackLoginVisit 只写 share_visits 不影响 claims/tokens', async () => {
    const fake = createFakeCloudbase()
    const db = fake.init().database()
    const { trackLoginVisit } = require(path.join(projectRoot, 'cloudfunctions', '_shared', 'visit-tracking.js'))

    const userId = 'u_existing'
    seedUser(fake.__store, userId, { inviteCode: 'SHARE01', extraTokens: 500 })

    // 记录调用前状态
    const tokensBefore = fake.__store.getCollection('users').get(userId).extraTokens
    const claimsBefore = dumpCollection(fake.__store, 'referral_claims').length
    const visitsBefore = dumpCollection(fake.__store, 'share_visits').length

    // 调用 trackLoginVisit（模拟老用户点分享后被访问）
    const result = await trackLoginVisit(db, {
      shareId: 's_test_share_001',
      channel: 'invite',
      scene: 'group',
      inviteCode: 'SHARE01',
      visitorUserId: 'u_visitor',
      isNewUser: true
    })

    assert.equal(result.success, true)

    // 验证 share_visits 新增 1 条
    const visitsAfter = dumpCollection(fake.__store, 'share_visits')
    assert.equal(visitsAfter.length, visitsBefore + 1)
    const newVisit = visitsAfter[visitsAfter.length - 1]
    assert.equal(newVisit.shareId, 's_test_share_001')
    assert.equal(newVisit.channel, 'invite')
    assert.equal(newVisit.visitorUserId, 'u_visitor')
    assert.equal(newVisit.isNewUser, true)
    assert.equal(newVisit.loginSuccess, true)

    // 验证 referral_claims 无变化
    const claimsAfter = dumpCollection(fake.__store, 'referral_claims').length
    assert.equal(claimsAfter, claimsBefore, `claims changed: ${claimsBefore} → ${claimsAfter}`)

    // 验证用户 Token 无变化
    const tokensAfter = fake.__store.getCollection('users').get(userId).extraTokens
    assert.equal(tokensAfter, tokensBefore, `tokens changed: ${tokensBefore} → ${tokensAfter}`)
  })

  await runCase('trackAnonymousVisit 也不影响 claims/tokens', async () => {
    const fake = createFakeCloudbase()
    const db = fake.init().database()
    const { trackAnonymousVisit } = require(path.join(projectRoot, 'cloudfunctions', '_shared', 'visit-tracking.js'))

    const userId = 'u_existing_anon'
    seedUser(fake.__store, userId, { inviteCode: 'SHARE02', extraTokens: 1000 })

    const claimsBefore = dumpCollection(fake.__store, 'referral_claims').length
    const tokensBefore = fake.__store.getCollection('users').get(userId).extraTokens

    const result = await trackAnonymousVisit(db, {
      shareId: 's_anon_001',
      channel: 'invite',
      scene: 'timeline',
      inviteCode: 'SHARE02',
      path: '/pages/index/index'
    })

    assert.equal(result.success, true)

    const visits = dumpCollection(fake.__store, 'share_visits')
    assert.ok(visits.length >= 1)

    const claimsAfter = dumpCollection(fake.__store, 'referral_claims').length
    assert.equal(claimsAfter, claimsBefore)

    const tokensAfter = fake.__store.getCollection('users').get(userId).extraTokens
    assert.equal(tokensAfter, tokensBefore)
  })

  // ── 5. 自邀请拦截 ──
  console.log('\n5. 边界：自邀请拦截')
  await runCase('inviterUserId === inviteeUserId → 不创建 claim', async () => {
    const fake = createFakeCloudbase()
    const db = fake.init().database()
    const { settleReward } = require(path.join(projectRoot, 'cloudfunctions', '_shared', 'referral-settlement.js'))

    const userId = 'u_self_invite'
    seedUser(fake.__store, userId, { inviteCode: 'SELF00' })

    const result = await settleReward(db, userId, userId, 'SELF00', '', 'test')
    assert.equal(result.success, false)
    assert.ok(result.message.includes('自邀请'), `expected '自邀请', got '${result.message}'`)

    // 确认没有 claim 被创建
    const claims = dumpCollection(fake.__store, 'referral_claims')
    assert.equal(claims.length, 0, `expected 0 claims, got ${claims.length}`)

    // 确认 Token 未增加
    const userAfter = fake.__store.getCollection('users').get(userId)
    assert.equal(userAfter.extraTokens, 0, `expected 0 extraTokens, got ${userAfter.extraTokens}`)
  })

  // ── 6. 无效邀请码 / redeemInviteCode 云函数 ──
  console.log('\n6. redeemInviteCode 云函数 — 无效邀请码 & 鉴权')
  await runCase('无认证调用返回"请先登录"', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    const redeemInviteCode = loadFunction('redeemInviteCode')
    // 不设置 auth → 应返回未登录
    const result = await redeemInviteCode({ inviteCode: 'ABC123' })
    assert.equal(result.success, false)
    assert.equal(result.message, '请先登录')
  })

  await runCase('无效邀请码（inviter 不存在）→ 报错', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)
    fake.__setAuthUser('u_nobody')

    seedUser(fake.__store, 'u_nobody')

    const redeemInviteCode = loadFunction('redeemInviteCode')
    const result = await redeemInviteCode({ inviteCode: 'NOTFOUND' })
    assert.equal(result.success, false)
    assert.equal(result.message, '邀请码不存在')
  })

  await runCase('通过 redeemInviteCode 正常兑换', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)

    const inviterId = 'u_inviter_fn'
    const inviteeId = 'u_invitee_fn'
    const inviteCode = 'FNCODE'

    fake.__setAuthUser(inviteeId)
    seedUser(fake.__store, inviterId, { inviteCode })
    seedUser(fake.__store, inviteeId)

    const redeemInviteCode = loadFunction('redeemInviteCode')
    const result = await redeemInviteCode({ inviteCode })

    assert.equal(result.success, true)
    assert.ok(result.inviterReward > 0)
    assert.ok(result.inviteeReward > 0)

    // 二次调用被拒
    const result2 = await redeemInviteCode({ inviteCode })
    assert.equal(result2.success, false)
    assert.ok(result2.message.includes('已被邀请过'))
  })

  // ── Summary ──
  console.log(`\n═══════════════════════════════════════`)
  console.log(`  ${passed} passed, ${failed} failed`)
  console.log(`═══════════════════════════════════════`)
}

main().catch(err => {
  console.error('Runner error:', err)
  process.exit(1)
})
