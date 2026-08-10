#!/usr/bin/env node
/**
 * 邀请奖励相关索引管理
 *
 * Usage:
 *   node scripts/manage-referral-indexes.cjs audit-indexes [envId]
 *   node scripts/manage-referral-indexes.cjs audit-collections [envId]
 *   node scripts/manage-referral-indexes.cjs create-collections [envId]
 *   node scripts/manage-referral-indexes.cjs create-indexes [envId]
 *   node scripts/manage-referral-indexes.cjs create-invite-code-index [envId] --confirmed-clean
 *
 * 注意：users.inviteCode 唯一索引不在此脚本内创建，必须先完成重复码审计。
 */
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const projectRoot = path.resolve(__dirname, '..')
const cli = path.join(projectRoot, 'node_modules', '@cloudbase', 'cli', 'bin', 'cloudbase')
const mode = process.argv[2] || 'audit-indexes'
const envId = process.argv[3] || 'cloud1-d0gvhqu2c8a2b61fd'

const INDEX_PLAN = [
  {
    collection: 'users',
    indexes: [
      { key: { referralAttemptStatus: 1, referralNextRunAt: 1 }, name: 'users_referral_attempt_due' }
    ]
  },
  {
    collection: 'referral_claims',
    indexes: [
      { key: { status: 1, nextRunAt: 1 }, name: 'referral_claims_status_due' },
      { key: { inviterUserId: 1, rewardedAt: 1 }, name: 'referral_claims_inviter_rewarded' },
      { key: { inviterUserId: 1, updatedAt: -1 }, name: 'referral_claims_inviter_updated' }
    ]
  },
  {
    collection: 'timeline_records',
    indexes: [
      { key: { userId: 1, createdAt: 1 }, name: 'timeline_records_user_created' }
    ]
  },
  {
    collection: 'referral_commission_jobs',
    indexes: [
      { key: { status: 1, nextRunAt: 1 }, name: 'referral_commission_jobs_status_due' },
      { key: { leaseUntil: 1 }, name: 'referral_commission_jobs_lease' }
    ]
  },
  {
    collection: 'referral_commissions',
    indexes: [
      { key: { inviterUserId: 1, createdAt: -1 }, name: 'referral_commissions_inviter_created' },
      { key: { inviterUserId: 1, status: 1, createdAt: -1 }, name: 'referral_commissions_inviter_status_created' },
      { key: { inviteeUserId: 1, status: 1 }, name: 'referral_commissions_invitee_status' },
      { key: { source: 1, orderId: 1 }, name: 'referral_commissions_source_order' }
    ]
  },
  {
    collection: 'commission_accounts',
    indexes: []
  },
  {
    collection: 'commission_ledger',
    indexes: [
      { key: { userId: 1, createdAt: -1 }, name: 'commission_ledger_user_created' },
      { key: { userId: 1, businessId: 1 }, name: 'commission_ledger_user_business' }
    ]
  },
  {
    collection: 'commission_review_tasks',
    indexes: [
      { key: { status: 1, createdAt: -1 }, name: 'commission_review_status_created' }
    ]
  },
  {
    collection: 'commission_reversal_jobs',
    indexes: [
      { key: { status: 1, nextRunAt: 1 }, name: 'commission_reversal_jobs_status_due' }
    ]
  },
  {
    collection: 'commission_scan_progress',
    indexes: []
  }
]

const validModes = new Set(['audit-collections', 'create-collections', 'audit-indexes', 'create-indexes', 'create-invite-code-index'])
const alreadyExistsPatterns = [/NamespaceExists/i, /already exists/i, /IndexOptionsConflict/i, /IndexKeySpecsConflict/i, /collection[^\r\n]*exists/i, /index[^\r\n]*exists/i]

function runCommand(collection, command) {
  const payload = JSON.stringify([{
    TableName: collection,
    CommandType: 'COMMAND',
    Command: JSON.stringify(command)
  }])

  const result = spawnSync(process.execPath, [
    cli,
    'db',
    'nosql',
    'execute',
    '-e', envId,
    '--json',
    '--command', payload
  ], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })

  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.error) throw result.error
  return result.status ?? 1
}

function runCommandDetailed(collection, command) {
  const payload = JSON.stringify([{
    TableName: collection,
    CommandType: 'COMMAND',
    Command: JSON.stringify(command)
  }])
  const result = spawnSync(process.execPath, [
    cli, 'db', 'nosql', 'execute', '-e', envId, '--json', '--command', payload
  ], { cwd: projectRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  if (result.error) throw result.error
  return { status: result.status ?? 1, stdout: result.stdout || '', stderr: result.stderr || '' }
}

function outputOf(result) { return `${result.stdout}\n${result.stderr}` }
function isAlreadyExists(result) { return alreadyExistsPatterns.some((pattern) => pattern.test(outputOf(result))) }
function printResult(result) {
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
}

function auditCollection(collection) {
  const result = runCommandDetailed(collection, { listCollections: 1, filter: { name: collection }, nameOnly: true })
  if (result.status !== 0) {
    printResult(result)
    return { status: result.status, missing: false }
  }
  const exists = new RegExp(`"(?:name|Name)"\\s*:\\s*"${collection}"`).test(result.stdout)
  if (!exists) console.error(`[referral-indexes] collection missing: ${collection}`)
  return { status: exists ? 0 : 1, missing: !exists }
}

function createCollections() {
  let failed = false
  for (const plan of INDEX_PLAN) {
    console.error(`\n[referral-indexes] inspect collection ${plan.collection}`)
    const audit = auditCollection(plan.collection)
    if (audit.status === 0) {
      console.error(`[referral-indexes] collection exists, skipped: ${plan.collection}`)
      continue
    }
    if (!audit.missing) { failed = true; continue }
    console.error(`[referral-indexes] create collection ${plan.collection}`)
    const created = runCommandDetailed(plan.collection, { create: plan.collection })
    if (created.status !== 0 && !isAlreadyExists(created)) {
      printResult(created)
      failed = true
      continue
    }
    if (created.status === 0) printResult(created)
    const verification = auditCollection(plan.collection)
    if (verification.status !== 0) {
      console.error(`[referral-indexes] collection still missing after create: ${plan.collection}`)
      failed = true
    }
  }
  return failed ? 1 : 0
}

function runAudit(modeName) {
  let failed = false
  for (const plan of INDEX_PLAN) {
    console.error(`\n[referral-indexes] ${modeName} ${plan.collection}`)
    const result = modeName === 'audit-collections'
      ? auditCollection(plan.collection)
      : runCommandDetailed(plan.collection, { listIndexes: plan.collection })
    printResult(result)
    if (result.status !== 0) failed = true
  }
  return failed ? 1 : 0
}

function extractIndexNames(rawOutput) {
  const names = new Set()
  const pattern = /"(?:name|Name)"\s*:\s*"([^"]+)"/g
  let match
  while ((match = pattern.exec(rawOutput || ''))) names.add(match[1])
  return names
}

function createIndexes() {
  let failed = false
  for (const plan of INDEX_PLAN) {
    console.error(`\n[referral-indexes] inspect indexes ${plan.collection}`)
    const audit = runCommandDetailed(plan.collection, { listIndexes: plan.collection })
    if (audit.status !== 0) {
      printResult(audit)
      failed = true
      continue
    }
    const existing = extractIndexNames(audit.stdout)
    const missing = plan.indexes.filter((index) => !existing.has(index.name))
    if (missing.length === 0) {
      console.error(`[referral-indexes] all indexes exist, skipped: ${plan.collection}`)
      continue
    }
    const created = runCommandDetailed(plan.collection, { createIndexes: plan.collection, indexes: missing })
    if (created.status !== 0 && !isAlreadyExists(created)) {
      printResult(created)
      failed = true
      continue
    }
    if (created.status === 0) printResult(created)
    const verification = runCommandDetailed(plan.collection, { listIndexes: plan.collection })
    const verified = extractIndexNames(verification.stdout)
    const stillMissing = plan.indexes.filter((index) => !verified.has(index.name))
    if (verification.status !== 0 || stillMissing.length > 0) {
      printResult(verification)
      console.error(`[referral-indexes] indexes still missing after verification: ${stillMissing.map((index) => index.name).join(', ')}`)
      failed = true
    } else {
      console.error(`[referral-indexes] indexes ready: ${plan.collection}`)
    }
  }
  return failed ? 1 : 0
}

let exitCode = 0
if (!validModes.has(mode)) {
  throw new Error('Usage: audit-collections|create-collections|audit-indexes|create-indexes|create-invite-code-index [envId]')
}
if (mode === 'audit-collections') {
  process.exitCode = runAudit(mode)
  return
}
if (mode === 'create-collections') {
  process.exitCode = createCollections()
  return
}
if (mode === 'create-indexes') {
  process.exitCode = createIndexes()
  return
}
if (mode === 'create-invite-code-index') {
  if (!process.argv.includes('--confirmed-clean')) {
    console.error('[referral-indexes] refuse: run duplicate-code audit and pass --confirmed-clean')
    process.exitCode = 2
    return
  }
  process.exitCode = runCommand('users', {
    createIndexes: 'users',
    indexes: [{ key: { inviteCode: 1 }, name: 'users_invite_code_unique', unique: true }]
  })
  return
}
for (const plan of INDEX_PLAN) {
  console.error(`\n[referral-indexes] ${mode} ${plan.collection}`)
  const command = mode === 'create-indexes'
    ? { createIndexes: plan.collection, indexes: plan.indexes }
    : { listIndexes: plan.collection }
  const status = runCommand(plan.collection, command)
  if (status !== 0) exitCode = status
}

process.exitCode = exitCode
