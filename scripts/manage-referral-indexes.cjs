#!/usr/bin/env node
/**
 * 邀请奖励相关索引管理
 *
 * Usage:
 *   node scripts/manage-referral-indexes.cjs audit-indexes [envId]
 *   node scripts/manage-referral-indexes.cjs create-indexes [envId]
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
      { key: { inviterUserId: 1, rewardedAt: 1 }, name: 'referral_claims_inviter_rewarded' }
    ]
  },
  {
    collection: 'timeline_records',
    indexes: [
      { key: { userId: 1, createdAt: 1 }, name: 'timeline_records_user_created' }
    ]
  }
]

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

let exitCode = 0
for (const plan of INDEX_PLAN) {
  console.error(`\n[referral-indexes] ${mode} ${plan.collection}`)
  const command = mode === 'create-indexes'
    ? { createIndexes: plan.collection, indexes: plan.indexes }
    : { listIndexes: plan.collection }
  const status = runCommand(plan.collection, command)
  if (status !== 0) exitCode = status
}

process.exitCode = exitCode
