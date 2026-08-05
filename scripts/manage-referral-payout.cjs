#!/usr/bin/env node
/**
 * 邀请奖励后台发奖开关（只改 referral.payoutPaused 单个字段）
 *
 * Usage:
 *   node scripts/manage-referral-payout.cjs status [envId]
 *   node scripts/manage-referral-payout.cjs pause  [envId]
 *   node scripts/manage-referral-payout.cjs resume [envId]
 *
 * pause 只暂停后台发奖，不影响注册、登录和记录创建。
 */
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const projectRoot = path.resolve(__dirname, '..')
const cli = path.join(projectRoot, 'node_modules', '@cloudbase', 'cli', 'bin', 'cloudbase')
const mode = process.argv[2] || 'status'
const envId = process.argv[3] || 'cloud1-d0gvhqu2c8a2b61fd'

const COLLECTION = 'system_settings'
const DOC_ID = 'settings_subscription'

function runDbCommand(commandType, command) {
  const payload = JSON.stringify([{
    TableName: COLLECTION,
    CommandType: commandType,
    Command: JSON.stringify(command)
  }])

  const result = spawnSync(process.execPath, [
    cli, 'db', 'nosql', 'execute', '-e', envId, '--json', '--command', payload
  ], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 32 * 1024 * 1024
  })

  if (result.error) throw result.error
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || '')
    throw new Error(`cloudbase db nosql execute failed (${result.status})`)
  }
  return result.stdout || ''
}

function parseJson(output) {
  const trimmed = String(output || '').trim()
  const firstBrace = trimmed.indexOf('{')
  const firstBracket = trimmed.indexOf('[')
  let start = -1
  if (firstBrace >= 0 && firstBracket >= 0) start = Math.min(firstBrace, firstBracket)
  else start = Math.max(firstBrace, firstBracket)
  if (start < 0) return null
  try {
    return JSON.parse(trimmed.slice(start))
  } catch (_) {
    return null
  }
}

function extractDocs(parsed) {
  const data = parsed?.data || parsed?.Data || parsed
  if (Array.isArray(data?.results?.[0])) return data.results[0]
  const first = Array.isArray(data) ? data[0] : data
  for (const candidate of [first?.data, first?.Data, first?.Result, first?.result]) {
    if (Array.isArray(candidate)) return candidate
    if (typeof candidate === 'string') {
      const nested = parseJson(candidate)
      if (Array.isArray(nested)) return nested
      if (Array.isArray(nested?.data)) return nested.data
      if (Array.isArray(nested?.cursor?.firstBatch)) return nested.cursor.firstBatch
    }
    if (Array.isArray(candidate?.cursor?.firstBatch)) return candidate.cursor.firstBatch
  }
  if (Array.isArray(first?.cursor?.firstBatch)) return first.cursor.firstBatch
  return []
}

function readReferralConfig() {
  const out = runDbCommand('QUERY', {
    find: COLLECTION,
    filter: { _id: DOC_ID },
    limit: 1
  })
  const docs = extractDocs(parseJson(out))
  const doc = docs[0] || null
  return doc ? (doc.referral || {}) : null
}

function setPayoutPaused(paused) {
  runDbCommand('UPDATE', {
    update: COLLECTION,
    updates: [{
      q: { _id: DOC_ID },
      u: { $set: { 'referral.payoutPaused': paused } }
    }]
  })
}

function printStatus(label) {
  const referral = readReferralConfig()
  if (!referral) {
    console.log(JSON.stringify({ success: false, message: 'settings_subscription 不存在' }, null, 2))
    process.exitCode = 1
    return
  }
  console.log(JSON.stringify({
    success: true,
    action: label,
    env: envId,
    referral: {
      enabled: referral.enabled,
      payoutPaused: referral.payoutPaused === true,
      requireFirstEvent: referral.requireFirstEvent !== false,
      inviterRewardTokens: referral.inviterRewardTokens,
      inviteeRewardTokens: referral.inviteeRewardTokens,
      weeklyInviteCap: referral.weeklyInviteCap
    }
  }, null, 2))
}

if (mode === 'status') {
  printStatus('status')
} else if (mode === 'pause') {
  setPayoutPaused(true)
  printStatus('pause')
} else if (mode === 'resume') {
  setPayoutPaused(false)
  printStatus('resume')
} else {
  console.error(`Unknown mode: ${mode}`)
  process.exitCode = 2
}
