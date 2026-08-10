#!/usr/bin/env node
/**
 * 现金分佣启停与状态查询（读写 referral.commission.payoutPaused，与 worker/后台提现读取的路径一致）
 *
 * Usage:
 *   node scripts/manage-referral-commission-payout.cjs status [envId]
 *   node scripts/manage-referral-commission-payout.cjs pause  [envId]
 *   node scripts/manage-referral-commission-payout.cjs resume [envId]
 *
 * pause 后只读复核云端配置（回读 referral.commission），确保生效：
 *   - worker（releaseDueCommissions）读 config.payoutPaused，暂停后不再解冻佣金；
 *   - 后台提现（markReferralCommissionWithdrawn）读同一配置，暂停后拒绝登记。
 *
 * 注意：旧邀请奖励的启停仍使用 scripts/manage-referral-payout.cjs（referral.payoutPaused），
 * 两者是独立的开关，不要混用。
 */
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const projectRoot = path.resolve(__dirname, '..')
const cli = path.join(projectRoot, 'node_modules', '@cloudbase', 'cli', 'bin', 'cloudbase')
const mode = process.argv[2] || 'status'
const envId = process.argv[3] || 'cloud1-d0gvhqu2c8a2b61fd'

const COLLECTION = 'system_settings'
const DOC_ID = 'settings_subscription'
// 现金分佣配置路径：referral.commission（getCommissionConfig 读取的路径）
const CONFIG_PATH = 'referral.commission'

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

function readCommissionConfig() {
  const out = runDbCommand('QUERY', {
    find: COLLECTION,
    filter: { _id: DOC_ID },
    limit: 1
  })
  const docs = extractDocs(parseJson(out))
  const doc = docs[0] || null
  return doc?.referral?.commission || null
}

function setPayoutPaused(paused) {
  runDbCommand('UPDATE', {
    update: COLLECTION,
    updates: [{
      q: { _id: DOC_ID },
      u: { $set: { [`${CONFIG_PATH}.payoutPaused`]: paused } }
    }]
  })
}

function unwrapNumber(value) {
  if (value && typeof value === 'object') {
    if (value.$numberLong != null) return Number(value.$numberLong)
    if (value.$numberInt != null) return Number(value.$numberInt)
    if (value.$numberDouble != null) return Number(value.$numberDouble)
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function formatDate(value) {
  if (!value) return null
  // 兼容 mongo 扩展 JSON（{$date: {...}} / {$numberLong: 毫秒} 可多层嵌套）与 Date/字符串
  let guard = 0
  while (value && typeof value === 'object' && guard++ < 3) {
    if (value.$date != null) value = value.$date
    else if (value.$numberLong != null) value = Number(value.$numberLong)
    else break
  }
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? JSON.stringify(value) : date.toISOString()
}

function printStatus(label) {
  const config = readCommissionConfig()
  if (!config) {
    console.log(JSON.stringify({ success: false, message: 'referral.commission 配置不存在（可能从未启用现金分佣）' }, null, 2))
    process.exitCode = 1
    return
  }
  console.log(JSON.stringify({
    success: true,
    action: label,
    env: envId,
    path: CONFIG_PATH,
    commission: {
      enabled: config.enabled === true,
      payoutPaused: config.payoutPaused === true,
      effectiveFrom: formatDate(config.effectiveFrom),
      // 缺失字段按 normalizeCommissionConfig 的默认值显示（rateBps=1000, settlementDays=7, ruleVersion=1）
      ruleVersion: unwrapNumber(config.ruleVersion) ?? 1,
      rateBps: unwrapNumber(config.rateBps) ?? 1000,
      settlementDays: unwrapNumber(config.settlementDays) ?? 7
    }
  }, null, 2))
}

if (mode === 'status') {
  printStatus('status')
} else if (mode === 'pause') {
  setPayoutPaused(true)
  // pause 后只读复核云端配置，确保已生效
  printStatus('pause')
} else if (mode === 'resume') {
  setPayoutPaused(false)
  printStatus('resume')
} else {
  console.error(`Unknown mode: ${mode}`)
  process.exitCode = 2
}
