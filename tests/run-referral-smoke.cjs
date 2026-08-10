/**
 * 邀请奖励异步结算冒烟测试
 * 运行: node tests/run-referral-smoke.cjs
 */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('path')
const Module = require('node:module')
const esbuild = require('esbuild')

const { createFakeCloudbase, installCloudbaseMock, setCurrentFakeCloudbase, clearCloudFunctionCache } = require('./support/fake-cloudbase.cjs')
const projectRoot = path.resolve(__dirname, '..')
installCloudbaseMock()

function loadShared() {
  clearCloudFunctionCache(projectRoot)
  return require(path.join(projectRoot, 'cloudfunctions', '_shared', 'referral-settlement.js'))
}

function loadFunction(name) {
  clearCloudFunctionCache(projectRoot)
  return require(path.join(projectRoot, 'cloudfunctions', name, 'index.js')).main
}

function loadShareModule(fakeUni) {
  const filename = path.join(projectRoot, 'src', 'utils', 'share.js')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = esbuild.transformSync(source, { loader: 'js', format: 'cjs', target: 'node18' })
  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = Module._nodeModulePaths(path.dirname(filename))
  const previousUni = global.uni
  global.uni = fakeUni
  loaded._compile(code, filename)
  return {
    exports: loaded.exports,
    restore() {
      global.uni = previousUni
    }
  }
}

let passed = 0
let failed = 0

async function runCase(name, fn) {
  try {
    await fn()
    passed += 1
    console.log(`  \x1b[32m✓\x1b[0m ${name}`)
  } catch (e) {
    failed += 1
    console.error(`  \x1b[31m✗\x1b[0m ${name}\n    ${e.message}`)
    process.exitCode = 1
  }
}

function seedUser(store, id, overrides = {}) {
  store.getCollection('users').set(id, {
    _id: id,
    email: `${id}@test.com`,
    plan: 'free',
    extraTokens: 0,
    inviteCode: '',
    invitedBy: null,
    referralCount: 0,
    referralWeekStart: null,
    referralWeekCount: 0,
    monthlyTokensUsed: 0,
    monthlyTokensReset: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    ...overrides
  })
}

function seedReferralConfig(store, referral = {}) {
  store.getCollection('system_settings').set('settings_subscription', {
    _id: 'settings_subscription',
    scope: 'global',
    key: 'subscription',
    configVersion: 6,
    trial: { enabled: true, durationDays: 7, features: [], excludedFeatures: [] },
    plans: {
      free: { name: '免费版', monthlyTokens: 30000, features: [], excludedFeatures: [] },
      pro: { name: 'Pro', monthlyTokens: 300000, features: [], excludedFeatures: [] },
      ultra: { name: 'Ultra', monthlyTokens: -1, features: [], excludedFeatures: [] }
    },
    referral: {
      enabled: true,
      inviterRewardTokens: 50,
      inviteeRewardTokens: 100,
      inviterTrialExtendDays: 3,
      requireFirstEvent: true,
      weeklyInviteCap: 100,
      payoutPaused: false,
      ...referral
    }
  })
}

function seedClaim(store, claimId, overrides = {}) {
  const inviteeUserId = overrides.inviteeUserId || 'u_invitee_claim'
  store.getCollection('referral_claims').set(claimId, {
    _id: claimId,
    schemaVersion: 3,
    inviteeUserId,
    inviterUserId: 'u_inviter_claim',
    inviteCode: 'CLAIM1',
    intentVersion: 1,
    status: 'retry',
    statusReason: '',
    requireFirstEvent: false,
    firstEventAt: null,
    inviterTokens: 50,
    inviteeTokens: 100,
    inviterTrialExtendDays: 0,
    weeklyInviteCap: 100,
    configCapturedAt: new Date('2026-08-02T00:00:00.000Z'),
    attempts: 0,
    nextRunAt: new Date(0),
    leaseOwner: 'worker-test',
    leaseUntil: new Date('2026-08-02T10:00:00.000Z'),
    createdAt: new Date('2026-08-02T00:00:00.000Z'),
    updatedAt: new Date('2026-08-02T00:00:00.000Z'),
    ...overrides
  })
}

function dump(store, name) {
  return [...store.getCollection(name).values()]
}

function listVueFiles(root) {
  const files = []
  const pending = ['']
  while (pending.length > 0) {
    const relativeDir = pending.pop()
    const absoluteDir = path.join(root, relativeDir)
    for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
      const relativePath = path.join(relativeDir, entry.name)
      if (entry.isDirectory()) pending.push(relativePath)
      else if (entry.isFile() && entry.name.endsWith('.vue')) files.push(relativePath)
    }
  }
  return files
}

async function main() {
  await runCase('transaction document object response is supported', async () => {
    const fake = createFakeCloudbase()
    fake.__setTransactionDocumentShape('object')
    setCurrentFakeCloudbase(fake)
    const db = fake.init().database()
    seedUser(fake.__store, 'u_inviter_tx', { inviteCode: 'TX001', extraTokens: 0 })
    seedUser(fake.__store, 'u_invitee_tx', { inviteCode: 'TX002', extraTokens: 0 })
    seedClaim(fake.__store, 'claim-tx', {
      inviteeUserId: 'u_invitee_tx',
      inviterUserId: '',
      inviteCode: 'TX001',
      status: 'pending_relation',
      nextRunAt: new Date(0)
    })

    const { bindReferralRelationInTransaction } = loadShared()
    const result = await bindReferralRelationInTransaction(db, {
      claimId: 'claim-tx',
      inviteeUserId: 'u_invitee_tx',
      inviterUserId: 'u_inviter_tx',
      inviteCode: 'TX001',
      intentVersion: 1,
      configSnapshot: {
        requireFirstEvent: false,
        inviterRewardTokens: 50,
        inviteeRewardTokens: 100,
        inviterTrialExtendDays: 3,
        weeklyInviteCap: 100
      }
    })

    assert.equal(result.ok, true)
    assert.equal(fake.__store.getCollection('referral_claims').get('claim-tx').inviterUserId, 'u_inviter_tx')
    assert.equal(fake.__store.getCollection('users').get('u_invitee_tx').invitedBy, 'u_inviter_tx')
  })

  console.log('=== 邀请奖励异步结算冒烟测试 ===\n')

  console.log('1. 主链路只写意图，不在线发奖')
  await runCase('T1 带码注册只写 unprocessed 意图', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)
    seedReferralConfig(fake.__store)
    seedUser(fake.__store, 'u_inviter_reg', { inviteCode: 'REG001', extraTokens: 0 })

    const register = loadFunction('register')
    const result = await register({
      email: `reg_${Date.now()}@test.com`,
      password: 'Password1!',
      inviteCode: 'reg001'
    })

    assert.equal(result.success, true)
    assert.ok(result.inviteCode)
    assert.equal(result.referral, undefined)

    const users = dump(fake.__store, 'users')
    const invitee = users.find((u) => u._id === result.userId)
    assert.equal(invitee.referralAttemptStatus, 'unprocessed')
    assert.equal(invitee.referralAttemptCode, 'REG001')
    assert.equal(dump(fake.__store, 'referral_claims').length, 0)
    assert.equal(invitee.extraTokens, invitee.extraTokens)
    assert.equal(
      dump(fake.__store, 'call_usage_records').filter((r) => String(r.source || '').startsWith('referral_')).length,
      0
    )
  })

  await runCase('T2 奖励路径故障时注册仍成功', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)
    seedReferralConfig(fake.__store)
    // 即使 claims 写入会失败，注册本身也不碰 claims
    fake.__failNext('collection.add:referral_claims', 'claims down')

    const register = loadFunction('register')
    const result = await register({
      email: `reg_fail_${Date.now()}@test.com`,
      password: 'Password1!',
      inviteCode: 'ANYCODE'
    })
    assert.equal(result.success, true)
    const invitee = fake.__store.getCollection('users').get(result.userId)
    assert.equal(invitee.referralAttemptStatus, 'unprocessed')
  })

  await runCase('T3 登录返回 inviteCode 且不结算', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)
    seedReferralConfig(fake.__store)
    const email = `login_${Date.now()}@test.com`
    const password = 'Password1!'
    const register = loadFunction('register')
    const created = await register({ email, password, inviteCode: '' })
    assert.equal(created.success, true)

    const login = loadFunction('login')
    const result = await login({ email, password })
    assert.equal(result.success, true)
    assert.equal(result.inviteCode, created.inviteCode)
    assert.equal(dump(fake.__store, 'referral_claims').length, 0)
  })

  console.log('\n2. worker 恢复与首事件门槛')
  await runCase('T4 requireFirstEvent=true 且无事件 → waiting', async () => {
    const fake = createFakeCloudbase()
    const db = fake.init().database()
    seedReferralConfig(fake.__store)
    seedUser(fake.__store, 'u_inviter_w', { inviteCode: 'WAIT01', extraTokens: 0 })
    seedUser(fake.__store, 'u_invitee_w', {
      inviteCode: 'SELFW1',
      referralAttemptStatus: 'unprocessed',
      referralAttemptCode: 'WAIT01',
      referralIntentVersion: 1,
      referralNextRunAt: new Date(0),
      landingInviteCode: 'WAIT01'
    })

    const { recoverReferralIntents, processDueReferralClaims, setNowProvider } = loadShared()
    setNowProvider(() => new Date('2026-08-02T08:00:00.000Z'))
    await recoverReferralIntents(db)
    await processDueReferralClaims(db)

    const claim = fake.__store.getCollection('referral_claims').get('u_invitee_w')
    assert.ok(claim)
    assert.equal(claim.status, 'waiting_first_event')
    assert.equal(claim.inviterUserId, 'u_inviter_w')
    assert.equal(fake.__store.getCollection('users').get('u_inviter_w').extraTokens, 0)
    setNowProvider(() => new Date())
  })

  await runCase('T5 createTimeline 写 userId 且不结算', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)
    seedReferralConfig(fake.__store)
    const userId = 'u_tl_user'
    const caseId = 'case_tl_1'
    fake.__setAuthUser(userId)
    seedUser(fake.__store, userId, { inviteCode: 'TL0001', extraTokens: 1000 })
    fake.__store.getCollection('cases').set(caseId, {
      _id: caseId,
      userId,
      latestResultId: 'assess_old',
      updatedAt: new Date()
    })
    fake.__store.getCollection('assessments').set('assess_old', {
      _id: 'assess_old',
      caseId,
      createdAt: new Date()
    })

    const createTimeline = loadFunction('createTimeline')
    const result = await createTimeline({
      caseId,
      title: '测试事件',
      type: 'chat',
      description: 'hello',
      dateLabel: '今天'
    })
    assert.equal(result.success, true)
    const records = dump(fake.__store, 'timeline_records')
    assert.ok(records.some((r) => r.userId === userId))
    assert.equal(dump(fake.__store, 'referral_claims').length, 0)
  })

  await runCase('T6 首事件后 worker 发双方奖励', async () => {
    const fake = createFakeCloudbase()
    const db = fake.init().database()
    seedReferralConfig(fake.__store, { requireFirstEvent: true, inviterRewardTokens: 50, inviteeRewardTokens: 100 })
    seedUser(fake.__store, 'u_inviter_r', { inviteCode: 'REW001', extraTokens: 10, plan: 'free', trialEndsAt: null })
    seedUser(fake.__store, 'u_invitee_r', {
      inviteCode: 'SELFR1',
      referralAttemptStatus: 'unprocessed',
      referralAttemptCode: 'REW001',
      referralIntentVersion: 1,
      referralNextRunAt: new Date(0),
      landingInviteCode: 'REW001',
      extraTokens: 5
    })
    fake.__store.getCollection('timeline_records').set('tl_1', {
      _id: 'tl_1',
      userId: 'u_invitee_r',
      caseId: 'c1',
      createdAt: new Date('2026-08-02T07:00:00.000Z')
    })

    const settlement = loadShared()
    settlement.setNowProvider(() => new Date('2026-08-02T08:00:00.000Z'))
    await settlement.recoverReferralIntents(db)
    const processed = await settlement.processDueReferralClaims(db)
    assert.ok(processed.rewarded >= 1)

    const claim = fake.__store.getCollection('referral_claims').get('u_invitee_r')
    assert.equal(claim.status, 'rewarded')
    assert.equal(fake.__store.getCollection('users').get('u_inviter_r').extraTokens, 60)
    assert.equal(fake.__store.getCollection('users').get('u_invitee_r').extraTokens, 105)
    assert.ok(fake.__store.getCollection('call_usage_records').has('referral_inviter_u_invitee_r'))
    assert.ok(fake.__store.getCollection('call_usage_records').has('referral_invitee_u_invitee_r'))
    settlement.setNowProvider(() => new Date())
  })

  await runCase('T7 requireFirstEvent=false 仍由 worker 发奖', async () => {
    const fake = createFakeCloudbase()
    const db = fake.init().database()
    seedReferralConfig(fake.__store, { requireFirstEvent: false })
    seedUser(fake.__store, 'u_inviter_nf', { inviteCode: 'NOF001', extraTokens: 0 })
    seedUser(fake.__store, 'u_invitee_nf', {
      referralAttemptStatus: 'unprocessed',
      referralAttemptCode: 'NOF001',
      referralIntentVersion: 1,
      referralNextRunAt: new Date(0),
      landingInviteCode: 'NOF001',
      extraTokens: 0
    })

    const settlement = loadShared()
    await settlement.recoverReferralIntents(db)
    await settlement.processDueReferralClaims(db)
    assert.equal(fake.__store.getCollection('referral_claims').get('u_invitee_nf').status, 'rewarded')
    assert.equal(fake.__store.getCollection('users').get('u_inviter_nf').extraTokens, 50)
  })

  console.log('\n3. 幂等、回滚与失败')
  await runCase('T8 worker 重复执行不双发', async () => {
    const fake = createFakeCloudbase()
    const db = fake.init().database()
    seedReferralConfig(fake.__store, { requireFirstEvent: false })
    seedUser(fake.__store, 'u_inviter_id', { inviteCode: 'IDM001', extraTokens: 0 })
    seedUser(fake.__store, 'u_invitee_id', {
      referralAttemptStatus: 'unprocessed',
      referralAttemptCode: 'IDM001',
      referralIntentVersion: 1,
      referralNextRunAt: new Date(0),
      landingInviteCode: 'IDM001',
      extraTokens: 0
    })
    const settlement = loadShared()
    await settlement.recoverReferralIntents(db)
    await settlement.processDueReferralClaims(db)
    await settlement.processDueReferralClaims(db)
    assert.equal(fake.__store.getCollection('users').get('u_inviter_id').extraTokens, 50)
    assert.equal(fake.__store.getCollection('users').get('u_invitee_id').extraTokens, 100)
    assert.equal(dump(fake.__store, 'call_usage_records').filter((r) => String(r.source || '').startsWith('referral_')).length, 2)
  })

  await runCase('T9 流水写失败则事务回滚', async () => {
    const fake = createFakeCloudbase()
    const db = fake.init().database()
    seedReferralConfig(fake.__store, { requireFirstEvent: false })
    seedUser(fake.__store, 'u_inviter_tx', { inviteCode: 'TX0001', extraTokens: 0 })
    seedUser(fake.__store, 'u_invitee_tx', {
      referralAttemptStatus: 'unprocessed',
      referralAttemptCode: 'TX0001',
      referralIntentVersion: 1,
      referralNextRunAt: new Date(0),
      landingInviteCode: 'TX0001',
      extraTokens: 0
    })
    const settlement = loadShared()
    await settlement.recoverReferralIntents(db)
    // 在结算阶段让流水 add 失败
    fake.__failNext('tx.collection.add:call_usage_records', 'grant write failed')
    await settlement.processDueReferralClaims(db)

    assert.equal(fake.__store.getCollection('users').get('u_inviter_tx').extraTokens, 0)
    assert.equal(fake.__store.getCollection('users').get('u_invitee_tx').extraTokens, 0)
    assert.equal(dump(fake.__store, 'call_usage_records').length, 0)
    const claim = fake.__store.getCollection('referral_claims').get('u_invitee_tx')
    assert.equal(claim.status, 'retry')
  })

  await runCase('P1 结算事务拒绝并发改状态/邀请人/意图版本的旧 claim', async () => {
    const variants = [
      { patch: { status: 'rejected' }, reason: 'STATUS_CHANGED' },
      { patch: { inviterUserId: 'u_other_inviter' }, reason: 'STALE_CLAIM' },
      { patch: { intentVersion: 2 }, reason: 'STALE_CLAIM' }
    ]

    for (const variant of variants) {
      const fake = createFakeCloudbase()
      const db = fake.init().database()
      seedUser(fake.__store, 'u_inviter_claim', { extraTokens: 10 })
      seedUser(fake.__store, 'u_other_inviter', { extraTokens: 20 })
      seedUser(fake.__store, 'u_invitee_claim', { extraTokens: 5 })
      seedClaim(fake.__store, 'claim-stale')
      const stale = { ...fake.__store.getCollection('referral_claims').get('claim-stale') }
      Object.assign(fake.__store.getCollection('referral_claims').get('claim-stale'), variant.patch)

      const { settleClaimInTransaction } = loadShared()
      const result = await settleClaimInTransaction(db, stale)
      assert.equal(result.ok, false)
      assert.equal(result.reason, variant.reason)
      assert.equal(fake.__store.getCollection('users').get('u_inviter_claim').extraTokens, 10)
      assert.equal(fake.__store.getCollection('users').get('u_invitee_claim').extraTokens, 5)
      assert.equal(dump(fake.__store, 'call_usage_records').length, 0)
    }
  })

  await runCase('P1 人工补偿可修复 inviter 已发、invitee 缺失的旧 claim', async () => {
    const fake = createFakeCloudbase()
    const db = fake.init().database()
    seedUser(fake.__store, 'u_inviter_claim', { extraTokens: 60 })
    seedUser(fake.__store, 'u_invitee_claim', { extraTokens: 5 })
    seedClaim(fake.__store, 'legacy-claim-id', { status: 'needs_review' })
    fake.__store.getCollection('call_usage_records').set('referral_inviter_u_invitee_claim', {
      _id: 'referral_inviter_u_invitee_claim',
      userId: 'u_inviter_claim',
      source: 'referral_inviter',
      sourceId: 'u_invitee_claim',
      amountTokens: 50
    })

    const { compensateClaimManually } = loadShared()
    const result = await compensateClaimManually(db, {
      claimId: 'legacy-claim-id',
      adminUserId: 'admin-1',
      confirmText: '确认补偿 invitee',
      inviterUserId: 'u_inviter_claim',
      inviteeUserId: 'u_invitee_claim',
      inviterTokens: 50,
      inviteeTokens: 100,
      repairSides: ['invitee'],
      reason: 'one-sided repair'
    })

    assert.equal(result.success, true)
    assert.equal(fake.__store.getCollection('users').get('u_inviter_claim').extraTokens, 60)
    assert.equal(fake.__store.getCollection('users').get('u_invitee_claim').extraTokens, 105)
    assert.ok(fake.__store.getCollection('call_usage_records').has('referral_invitee_u_invitee_claim'))
    const claim = fake.__store.getCollection('referral_claims').get('legacy-claim-id')
    assert.equal(claim.status, 'manual_resolved')
    assert.deepEqual(claim.manualAction.repairSides, ['invitee'])
    assert.equal(claim.manualAction.beforeBalances.invitee, 5)
    assert.equal(claim.manualAction.afterBalances.invitee, 105)
  })

  await runCase('P1 人工补偿可修复 inviter 缺失且重复点击不双发', async () => {
    const fake = createFakeCloudbase()
    const db = fake.init().database()
    seedUser(fake.__store, 'u_inviter_claim', { extraTokens: 10 })
    seedUser(fake.__store, 'u_invitee_claim', { extraTokens: 105 })
    seedClaim(fake.__store, 'claim-partial-inviter', { status: 'needs_review' })
    fake.__store.getCollection('call_usage_records').set('referral_invitee_u_invitee_claim', {
      _id: 'referral_invitee_u_invitee_claim',
      userId: 'u_invitee_claim',
      source: 'referral_invitee',
      sourceId: 'u_invitee_claim',
      amountTokens: 100
    })

    const payload = {
      claimId: 'claim-partial-inviter',
      adminUserId: 'admin-1',
      confirmText: '确认补偿 inviter',
      inviterUserId: 'u_inviter_claim',
      inviteeUserId: 'u_invitee_claim',
      inviterTokens: 50,
      inviteeTokens: 100,
      repairSides: ['inviter'],
      reason: 'one-sided repair'
    }
    const { compensateClaimManually } = loadShared()
    const first = await compensateClaimManually(db, payload)
    const second = await compensateClaimManually(db, payload)
    assert.equal(first.success, true)
    assert.equal(second.success, true)
    assert.equal(second.idempotent, true)
    assert.equal(fake.__store.getCollection('users').get('u_inviter_claim').extraTokens, 60)
    assert.equal(fake.__store.getCollection('users').get('u_invitee_claim').extraTokens, 105)
    assert.equal(dump(fake.__store, 'call_usage_records').length, 2)
  })

  await runCase('P1 人工补偿拒绝非法金额和错误 repairSides', async () => {
    const invalidPayloads = [
      { inviterTokens: -1, inviteeTokens: 100, repairSides: ['inviter', 'invitee'] },
      { inviterTokens: Number.NaN, inviteeTokens: 100, repairSides: ['inviter', 'invitee'] },
      { inviterTokens: 50, inviteeTokens: Number.POSITIVE_INFINITY, repairSides: ['inviter', 'invitee'] },
      { inviterTokens: 1000001, inviteeTokens: 100, repairSides: ['inviter', 'invitee'] },
      { inviterTokens: 50, inviteeTokens: 100, repairSides: ['invitee'] }
    ]

    for (const invalid of invalidPayloads) {
      const fake = createFakeCloudbase()
      const db = fake.init().database()
      seedUser(fake.__store, 'u_inviter_claim', { extraTokens: 10 })
      seedUser(fake.__store, 'u_invitee_claim', { extraTokens: 5 })
      seedClaim(fake.__store, 'claim-invalid', { status: 'needs_review' })
      const { compensateClaimManually } = loadShared()
      const result = await compensateClaimManually(db, {
        claimId: 'claim-invalid',
        adminUserId: 'admin-1',
        confirmText: '确认补偿双方',
        inviterUserId: 'u_inviter_claim',
        inviteeUserId: 'u_invitee_claim',
        reason: 'invalid input test',
        ...invalid
      })
      assert.equal(result.success, false)
      assert.equal(fake.__store.getCollection('users').get('u_inviter_claim').extraTokens, 10)
      assert.equal(fake.__store.getCollection('users').get('u_invitee_claim').extraTokens, 5)
      assert.equal(dump(fake.__store, 'call_usage_records').length, 0)
    }
  })

  await runCase('P1 结算拒绝异常奖励快照、绑定冲突和固定流水身份冲突', async () => {
    {
      const fake = createFakeCloudbase()
      const db = fake.init().database()
      seedUser(fake.__store, 'u_inviter_claim', { extraTokens: 10 })
      seedUser(fake.__store, 'u_invitee_claim', { extraTokens: 5 })
      seedClaim(fake.__store, 'claim-bad-amount', { inviterTokens: Number.POSITIVE_INFINITY })
      const claim = fake.__store.getCollection('referral_claims').get('claim-bad-amount')
      const { settleClaimInTransaction } = loadShared()
      const result = await settleClaimInTransaction(db, { ...claim })
      assert.equal(result.reason, 'INVALID_REWARD_AMOUNT')
      assert.equal(dump(fake.__store, 'call_usage_records').length, 0)
    }

    for (const conflict of ['binding', 'grant']) {
      const fake = createFakeCloudbase()
      const db = fake.init().database()
      seedUser(fake.__store, 'u_inviter_claim', { extraTokens: 10 })
      seedUser(fake.__store, 'u_invitee_claim', {
        extraTokens: 5,
        invitedBy: conflict === 'binding' ? 'u_someone_else' : null
      })
      seedClaim(fake.__store, `claim-${conflict}`, { status: 'needs_review' })
      if (conflict === 'grant') {
        fake.__store.getCollection('call_usage_records').set('referral_inviter_u_invitee_claim', {
          _id: 'referral_inviter_u_invitee_claim',
          userId: 'wrong-user',
          source: 'referral_inviter',
          sourceId: 'u_invitee_claim',
          amountTokens: 50
        })
      }
      const { compensateClaimManually } = loadShared()
      const result = await compensateClaimManually(db, {
        claimId: `claim-${conflict}`,
        adminUserId: 'admin-1',
        confirmText: '确认冲突场景',
        inviterUserId: 'u_inviter_claim',
        inviteeUserId: 'u_invitee_claim',
        inviterTokens: 50,
        inviteeTokens: 100,
        repairSides: conflict === 'grant' ? ['invitee'] : ['inviter', 'invitee'],
        reason: 'conflict test'
      })
      assert.equal(result.success, false)
      assert.equal(fake.__store.getCollection('users').get('u_inviter_claim').extraTokens, 10)
      assert.equal(fake.__store.getCollection('users').get('u_invitee_claim').extraTokens, 5)
    }
  })

  await runCase('P1 登录用户邀请码未就绪时隐藏菜单且不暴露分享路径', async () => {
    const storage = new Map([
      ['userId', 'u_share'],
      ['currentUser', { id: 'u_share', inviteCode: '' }]
    ])
    const calls = []
    let resolveInviteCode
    const deferred = new Promise((resolve) => { resolveInviteCode = resolve })
    const fakeUni = {
      getStorageSync(key) { return storage.get(key) || '' },
      setStorageSync(key, value) { storage.set(key, value) },
      removeStorageSync(key) { storage.delete(key) },
      hideShareMenu(options) { calls.push({ type: 'hide', options }) },
      showShareMenu(options) { calls.push({ type: 'show', options }) }
    }
    const loaded = loadShareModule(fakeUni)
    try {
      const share = loaded.exports
      const preparing = share.prepareReferralShareMenu(async () => deferred)
      assert.equal(share.isReferralShareBlocked(), true)
      assert.equal(share.appendReferralParams('/pages/index/index', 'invite'), '')
      assert.equal(calls.filter((item) => item.type === 'hide').length, 1)
      assert.equal(calls.filter((item) => item.type === 'show').length, 0)

      resolveInviteCode('share01')
      const ready = await preparing
      assert.equal(ready, true)
      assert.equal(share.isReferralShareBlocked(), false)
      assert.match(share.appendReferralParams('/pages/index/index', 'invite'), /inviteCode=SHARE01/)
      assert.equal(calls.filter((item) => item.type === 'show').length, 1)

      storage.set('userId', 'u_other')
      storage.set('currentUser', { id: 'u_other', inviteCode: '' })
      assert.equal(share.isReferralShareBlocked({ inviteCode: 'SHARE01' }), true)
      assert.equal(share.appendReferralParams('/pages/index/index', 'invite', '', { inviteCode: 'SHARE01' }), '')

      const pagesRoot = path.join(projectRoot, 'src', 'pages')
      const referralSharePages = listVueFiles(pagesRoot)
        .filter((file) => fs.readFileSync(path.join(pagesRoot, file), 'utf8').includes('onShareAppMessage'))
      for (const page of referralSharePages) {
        const source = fs.readFileSync(path.join(pagesRoot, page), 'utf8')
        assert.match(source, /prepareCurrentUserReferralShare/)
        assert.match(source, /isReferralShareBlocked/)
      }

      const referralTimelinePages = listVueFiles(pagesRoot)
        .filter((file) => fs.readFileSync(path.join(pagesRoot, file), 'utf8').includes('onShareTimeline'))
      for (const page of referralTimelinePages) {
        const source = fs.readFileSync(path.join(pagesRoot, page), 'utf8')
        assert.match(source, /appendReferralParams/)
        assert.doesNotMatch(source, /buildSafeTimelineShare\(\)\s*\)/)
      }

      const analysisSheet = fs.readFileSync(path.join(projectRoot, 'src', 'components', 'AnalysisSheet.vue'), 'utf8')
      const indexPage = fs.readFileSync(path.join(pagesRoot, 'index', 'index.vue'), 'utf8')
      assert.match(analysisSheet, /shareReady/)
      assert.match(indexPage, /:share-ready="referralShareReady"/)
    } finally {
      loaded.restore()
    }
  })

  await runCase('P2-2 匿名/静默登录中/邀请码未加载不生成无归因分享链接', async () => {
    const fakeUniFor = (storage) => ({
      getStorageSync(key) { return storage.get(key) || '' },
      setStorageSync(key, value) { storage.set(key, value) },
      removeStorageSync(key) { storage.delete(key) }
    })
    // 1) 匿名：无任何本地身份
    let storage = new Map()
    let loaded = loadShareModule(fakeUniFor(storage))
    try {
      const share = loaded.exports
      assert.equal(share.isReferralShareBlocked(), true, '匿名状态视为 blocked')
      assert.equal(share.appendReferralParams('/pages/index/index', 'invite', 'referral_page'), '', '匿名状态不生成分享 path')
    } finally { loaded.restore() }

    // 2) 静默登录中：userId 已写入但身份信息未落库
    storage = new Map([['userId', 'u_silent']])
    loaded = loadShareModule(fakeUniFor(storage))
    try {
      const share = loaded.exports
      assert.equal(share.isReferralShareBlocked(), true, '静默登录中视为 blocked')
      assert.equal(share.appendReferralParams('/pages/index/index', 'invite', 'referral_page'), '')
    } finally { loaded.restore() }

    // 3) 登录完成但邀请码未加载
    storage = new Map([['userId', 'u_silent'], ['currentUser', { id: 'u_silent', inviteCode: '' }]])
    loaded = loadShareModule(fakeUniFor(storage))
    try {
      const share = loaded.exports
      assert.equal(share.isReferralShareBlocked(), true, '邀请码未就绪视为 blocked')
      assert.equal(share.appendReferralParams('/pages/index/index', 'invite', 'referral_page'), '')
    } finally { loaded.restore() }

    // 4) 邀请码准备完成 → 生成带 inviteCode 的归因链接
    storage = new Map([['userId', 'u_silent'], ['currentUser', { id: 'u_silent', inviteCode: 'CODE42' }]])
    loaded = loadShareModule(fakeUniFor(storage))
    try {
      const share = loaded.exports
      assert.equal(share.isReferralShareBlocked(), false, '邀请码就绪后可分享')
      assert.match(share.appendReferralParams('/pages/index/index', 'invite', 'referral_page'), /inviteCode=CODE42/)
    } finally { loaded.restore() }
  })

  await runCase('T11 连续失败进入 failed', async () => {
    const fake = createFakeCloudbase()
    const db = fake.init().database()
    seedReferralConfig(fake.__store, { requireFirstEvent: false })
    seedUser(fake.__store, 'u_inviter_f', { inviteCode: 'FAIL01', extraTokens: 0 })
    seedUser(fake.__store, 'u_invitee_f', {
      referralAttemptStatus: 'unprocessed',
      referralAttemptCode: 'FAIL01',
      referralIntentVersion: 1,
      referralNextRunAt: new Date(0),
      landingInviteCode: 'FAIL01',
      extraTokens: 0
    })
    const settlement = loadShared()
    await settlement.recoverReferralIntents(db)
    for (let i = 0; i < 5; i += 1) {
      fake.__failNext('transaction.commit', 'commit boom')
      // 确保 claim 可调度
      const claim = fake.__store.getCollection('referral_claims').get('u_invitee_f')
      claim.nextRunAt = new Date(0)
      claim.leaseUntil = null
      await settlement.processDueReferralClaims(db)
    }
    assert.equal(fake.__store.getCollection('referral_claims').get('u_invitee_f').status, 'failed')
  })

  console.log('\n4. 边界与 redeem')
  await runCase('T15 自邀请 / 无效码', async () => {
    const fake = createFakeCloudbase()
    const db = fake.init().database()
    seedReferralConfig(fake.__store, { requireFirstEvent: false })
    seedUser(fake.__store, 'u_self', {
      inviteCode: 'SELF99',
      referralAttemptStatus: 'unprocessed',
      referralAttemptCode: 'SELF99',
      referralIntentVersion: 1,
      referralNextRunAt: new Date(0),
      landingInviteCode: 'SELF99'
    })
    const settlement = loadShared()
    await settlement.recoverReferralIntents(db)
    await settlement.processDueReferralClaims(db)
    assert.equal(fake.__store.getCollection('referral_claims').get('u_self').status, 'rejected')
    assert.equal(fake.__store.getCollection('referral_claims').get('u_self').statusReason, 'SELF_REFERRAL')

    seedUser(fake.__store, 'u_bad', {
      referralAttemptStatus: 'unprocessed',
      referralAttemptCode: 'NOPE00',
      referralIntentVersion: 1,
      referralNextRunAt: new Date(0),
      landingInviteCode: 'NOPE00'
    })
    await settlement.recoverReferralIntents(db)
    await settlement.processDueReferralClaims(db)
    assert.equal(fake.__store.getCollection('referral_claims').get('u_bad').statusReason, 'INVALID_INVITE_CODE')
  })

  await runCase('redeemInviteCode 只提交意图', async () => {
    const fake = createFakeCloudbase()
    setCurrentFakeCloudbase(fake)
    seedReferralConfig(fake.__store)
    seedUser(fake.__store, 'u_inviter_rd', { inviteCode: 'RDM001' })
    fake.__setAuthUser('u_redeemer')
    seedUser(fake.__store, 'u_redeemer', { inviteCode: 'RDSELF' })

    const redeem = loadFunction('redeemInviteCode')
    const result = await redeem({ inviteCode: 'rdm001' })
    assert.equal(result.success, true)
    assert.equal(result.code, 'REFERRAL_ACCEPTED')
    const user = fake.__store.getCollection('users').get('u_redeemer')
    assert.equal(user.referralAttemptStatus, 'unprocessed')
    assert.equal(user.referralAttemptCode, 'RDM001')
    assert.equal(dump(fake.__store, 'referral_claims').length, 0)
    assert.equal(dump(fake.__store, 'call_usage_records').length, 0)
  })

  await runCase('T14 北京时间周起点', async () => {
    const { getShanghaiWeekStart } = loadShared()
    // 2026-08-02 是周日 UTC+8；周一应为 2026-07-27 00:00 CST = 2026-07-26 16:00Z
    const weekStart = getShanghaiWeekStart(new Date('2026-08-02T10:00:00+08:00'))
    assert.equal(weekStart.toISOString(), '2026-07-26T16:00:00.000Z')
  })

  console.log(`\n═══════════════════════════════════════`)
  console.log(`  ${passed} passed, ${failed} failed`)
  console.log(`═══════════════════════════════════════`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Runner error:', err)
  process.exit(1)
})
