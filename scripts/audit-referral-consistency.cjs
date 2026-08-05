#!/usr/bin/env node
/**
 * 邀请奖励一致性只读审计（默认 --dry-run）
 *
 * Usage:
 *   node scripts/audit-referral-consistency.cjs --env <envId> --dry-run
 *   node scripts/audit-referral-consistency.cjs --env <envId> --apply-metadata
 *
 * --apply-metadata 只修复关系/状态/统计元数据，禁止加减 Token、禁止延长试用期。
 */
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const DEFAULT_ENV = 'cloud1-d0gvhqu2c8a2b61fd'
const PAGE_SIZE = 100

function usage() {
  console.log(`Usage:
  node scripts/audit-referral-consistency.cjs --env <envId> --dry-run
  node scripts/audit-referral-consistency.cjs --env <envId> --apply-metadata
`)
}

function parseArgs(argv) {
  const args = { _: [], 'dry-run': false, 'apply-metadata': false }
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i]
    if (item.startsWith('--')) {
      const key = item.slice(2)
      const next = argv[i + 1]
      if (key === 'dry-run' || key === 'apply-metadata') {
        args[key] = true
      } else if (!next || next.startsWith('--')) {
        args[key] = true
      } else {
        args[key] = next
        i += 1
      }
    } else {
      args._.push(item)
    }
  }
  return args
}

function runCli(cliArgs) {
  const result = spawnSync('cmd.exe', ['/c', 'npx.cmd', 'cloudbase', ...cliArgs], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
    maxBuffer: 64 * 1024 * 1024
  })
  if (result.status !== 0) {
    throw new Error(`cloudbase ${cliArgs.join(' ')} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`)
  }
  return result.stdout || ''
}

function parseCliJson(output) {
  const trimmed = String(output || '').trim()
  if (!trimmed) return null
  const firstBrace = trimmed.indexOf('{')
  const firstBracket = trimmed.indexOf('[')
  let start = -1
  if (firstBrace >= 0 && firstBracket >= 0) start = Math.min(firstBrace, firstBracket)
  else start = Math.max(firstBrace, firstBracket)
  if (start < 0) return null
  return JSON.parse(trimmed.slice(start))
}

function dbCommand(env, tableName, commandType, commandObject) {
  const payload = JSON.stringify([{
    TableName: tableName,
    CommandType: commandType,
    Command: JSON.stringify(commandObject)
  }])
  return parseCliJson(runCli(['db', 'nosql', 'execute', '-e', env, '--json', '--command', payload]))
}

function extractDbDocuments(parsed) {
  const data = parsed?.data || parsed?.Data || parsed
  const first = Array.isArray(data) ? data[0] : data
  if (Array.isArray(data?.results?.[0])) return data.results[0]
  const candidates = [
    first?.data,
    first?.Data,
    first?.Result,
    first?.result,
    first?.Response?.Data
  ]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate
    if (typeof candidate === 'string') {
      try {
        const parsedCandidate = JSON.parse(candidate)
        if (Array.isArray(parsedCandidate)) return parsedCandidate
        if (Array.isArray(parsedCandidate?.data)) return parsedCandidate.data
        if (Array.isArray(parsedCandidate?.cursor?.firstBatch)) return parsedCandidate.cursor.firstBatch
      } catch (_) {}
    }
    if (Array.isArray(candidate?.cursor?.firstBatch)) return candidate.cursor.firstBatch
  }
  if (Array.isArray(first?.cursor?.firstBatch)) return first.cursor.firstBatch
  return []
}

function dumpCollection(env, name) {
  const docs = []
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const parsed = dbCommand(env, name, 'QUERY', {
      find: name,
      filter: {},
      skip,
      limit: PAGE_SIZE
    })
    const page = extractDbDocuments(parsed)
    docs.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return docs
}

function grantId(side, inviteeUserId) {
  return `referral_${side}_${inviteeUserId}`
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase()
}

function isRewardedStatus(status) {
  return status === 'rewarded' || status === 'manual_resolved'
}

function audit(env, applyMetadata) {
  console.error(`[audit-referral] env=${env} mode=${applyMetadata ? 'apply-metadata' : 'dry-run'}`)
  console.error('[audit-referral] loading users / referral_claims / call_usage_records ...')

  const users = dumpCollection(env, 'users')
  const claims = dumpCollection(env, 'referral_claims')
  const usage = dumpCollection(env, 'call_usage_records')

  const userById = new Map(users.map((u) => [u._id, u]))
  const claimById = new Map(claims.map((c) => [c._id || c.inviteeUserId, c]))
  const grantsById = new Map()
  for (const row of usage) {
    if (row && row._id) grantsById.set(row._id, row)
  }

  const inviteCodeBuckets = new Map()
  const emptyInviteCodes = []
  for (const user of users) {
    const code = normalizeCode(user.inviteCode)
    if (!code) {
      emptyInviteCodes.push(user._id)
      continue
    }
    if (!inviteCodeBuckets.has(code)) inviteCodeBuckets.set(code, [])
    inviteCodeBuckets.get(code).push(user._id)
  }
  const duplicateInviteCodes = [...inviteCodeBuckets.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([code, ids]) => ({ code, userIds: ids }))

  const oldSchemaClaims = claims.filter((c) => Number(c.schemaVersion || 0) < 3)
  const rewardedMissingGrant = []
  const grantWithoutClaim = []
  const invitedByConflicts = []
  const partialGrants = []
  const rewardedNoGrants = []

  for (const claim of claims) {
    const inviteeUserId = claim.inviteeUserId || claim._id
    const inviterGrant = grantsById.get(grantId('inviter', inviteeUserId))
      || usage.find((r) => r.source === 'referral_inviter' && (r.sourceId === inviteeUserId || String(r.remark || '').includes(inviteeUserId)))
    const inviteeGrant = grantsById.get(grantId('invitee', inviteeUserId))
      || usage.find((r) => r.source === 'referral_invitee' && (r.userId === inviteeUserId || r.sourceId === inviteeUserId))

    const hasInviter = Boolean(inviterGrant)
    const hasInvitee = Boolean(inviteeGrant)
    if (hasInviter !== hasInvitee) {
      partialGrants.push({
        claimId: claim._id,
        inviteeUserId,
        hasInviterGrant: hasInviter,
        hasInviteeGrant: hasInvitee,
        status: claim.status
      })
    }

    if (isRewardedStatus(claim.status)) {
      if (!hasInviter || !hasInvitee) {
        if (!hasInviter && !hasInvitee) {
          rewardedNoGrants.push({ claimId: claim._id, inviteeUserId, status: claim.status })
        } else {
          rewardedMissingGrant.push({
            claimId: claim._id,
            inviteeUserId,
            hasInviterGrant: hasInviter,
            hasInviteeGrant: hasInvitee
          })
        }
      }
    }

    const invitee = userById.get(inviteeUserId)
    if (invitee && invitee.invitedBy && claim.inviterUserId && invitee.invitedBy !== claim.inviterUserId) {
      invitedByConflicts.push({
        inviteeUserId,
        userInvitedBy: invitee.invitedBy,
        claimInviterUserId: claim.inviterUserId,
        claimStatus: claim.status
      })
    }
  }

  for (const row of usage) {
    if (!row || (row.source !== 'referral_inviter' && row.source !== 'referral_invitee')) continue
    const inviteeUserId = row.sourceId || (String(row.remark || '').split(':')[1] || '')
    if (!inviteeUserId) continue
    if (!claimById.has(inviteeUserId)) {
      grantWithoutClaim.push({
        grantId: row._id || null,
        source: row.source,
        inviteeUserId,
        userId: row.userId
      })
    }
  }

  const rewardedByInviter = new Map()
  for (const claim of claims) {
    if (!isRewardedStatus(claim.status) || !claim.inviterUserId) continue
    rewardedByInviter.set(claim.inviterUserId, (rewardedByInviter.get(claim.inviterUserId) || 0) + 1)
  }
  const referralCountDrift = []
  for (const [inviterUserId, rewardedCount] of rewardedByInviter.entries()) {
    const user = userById.get(inviterUserId)
    const stored = Number(user?.referralCount || 0)
    if (stored !== rewardedCount) {
      referralCountDrift.push({ inviterUserId, storedReferralCount: stored, rewardedClaims: rewardedCount })
    }
  }

  const report = {
    env,
    mode: applyMetadata ? 'apply-metadata' : 'dry-run',
    generatedAt: new Date().toISOString(),
    totals: {
      users: users.length,
      claims: claims.length,
      referralGrants: usage.filter((r) => r.source === 'referral_inviter' || r.source === 'referral_invitee').length
    },
    emptyInviteCodes: {
      count: emptyInviteCodes.length,
      sample: emptyInviteCodes.slice(0, 50)
    },
    duplicateInviteCodes: {
      count: duplicateInviteCodes.length,
      items: duplicateInviteCodes.slice(0, 50)
    },
    oldSchemaClaims: {
      count: oldSchemaClaims.length,
      sample: oldSchemaClaims.slice(0, 50).map((c) => ({
        id: c._id,
        schemaVersion: c.schemaVersion || 0,
        status: c.status
      }))
    },
    rewardedMissingGrant: {
      count: rewardedMissingGrant.length,
      items: rewardedMissingGrant.slice(0, 100)
    },
    rewardedNoGrants: {
      count: rewardedNoGrants.length,
      items: rewardedNoGrants.slice(0, 100)
    },
    partialGrants: {
      count: partialGrants.length,
      items: partialGrants.slice(0, 100)
    },
    grantWithoutClaim: {
      count: grantWithoutClaim.length,
      items: grantWithoutClaim.slice(0, 100)
    },
    invitedByConflicts: {
      count: invitedByConflicts.length,
      items: invitedByConflicts.slice(0, 100)
    },
    referralCountDrift: {
      count: referralCountDrift.length,
      items: referralCountDrift.slice(0, 100)
    },
    applied: []
  }

  if (applyMetadata) {
    console.error('[audit-referral] apply-metadata: only reconcile claim status / invitedBy / referralCount metadata')
    // 双方流水都存在 → claim 对账为 rewarded（不改余额）
    for (const claim of claims) {
      const inviteeUserId = claim.inviteeUserId || claim._id
      const inviterGrant = grantsById.get(grantId('inviter', inviteeUserId))
      const inviteeGrant = grantsById.get(grantId('invitee', inviteeUserId))
      if (inviterGrant && inviteeGrant && claim.status !== 'rewarded' && claim.status !== 'manual_resolved') {
        dbCommand(env, 'referral_claims', 'UPDATE', {
          update: 'referral_claims',
          updates: [{
            q: { _id: claim._id },
            u: {
              $set: {
                status: 'rewarded',
                statusReason: 'RECONCILED_BOTH_GRANTS',
                updatedAt: new Date()
              }
            }
          }]
        })
        report.applied.push({ type: 'claim_rewarded_reconcile', claimId: claim._id })
      } else if ((inviterGrant && !inviteeGrant) || (!inviterGrant && inviteeGrant)) {
        if (claim.status !== 'needs_review') {
          dbCommand(env, 'referral_claims', 'UPDATE', {
            update: 'referral_claims',
            updates: [{
              q: { _id: claim._id },
              u: {
                $set: {
                  status: 'needs_review',
                  statusReason: 'PARTIAL_GRANT_FOUND',
                  updatedAt: new Date()
                }
              }
            }]
          })
          report.applied.push({ type: 'claim_needs_review_partial', claimId: claim._id })
        }
      } else if (isRewardedStatus(claim.status) && !inviterGrant && !inviteeGrant) {
        dbCommand(env, 'referral_claims', 'UPDATE', {
          update: 'referral_claims',
          updates: [{
            q: { _id: claim._id },
            u: {
              $set: {
                status: 'needs_review',
                statusReason: 'REWARDED_WITHOUT_GRANTS',
                updatedAt: new Date()
              }
            }
          }]
        })
        report.applied.push({ type: 'claim_needs_review_no_grants', claimId: claim._id })
      }
    }

    for (const item of referralCountDrift) {
      dbCommand(env, 'users', 'UPDATE', {
        update: 'users',
        updates: [{
          q: { _id: item.inviterUserId },
          u: { $set: { referralCount: item.rewardedClaims, updatedAt: new Date() } }
        }]
      })
      report.applied.push({
        type: 'user_referralCount_reconcile',
        userId: item.inviterUserId,
        from: item.storedReferralCount,
        to: item.rewardedClaims
      })
    }
  }

  const outDir = path.join(ROOT, 'audit', 'referral')
  fs.mkdirSync(outDir, { recursive: true })
  const outFile = path.join(outDir, `referral-consistency-${env}-${Date.now()}.json`)
  fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  console.log(JSON.stringify({
    success: true,
    outFile,
    summary: {
      emptyInviteCodes: report.emptyInviteCodes.count,
      duplicateInviteCodes: report.duplicateInviteCodes.count,
      oldSchemaClaims: report.oldSchemaClaims.count,
      rewardedMissingGrant: report.rewardedMissingGrant.count,
      rewardedNoGrants: report.rewardedNoGrants.count,
      partialGrants: report.partialGrants.count,
      grantWithoutClaim: report.grantWithoutClaim.count,
      invitedByConflicts: report.invitedByConflicts.count,
      referralCountDrift: report.referralCountDrift.count,
      applied: report.applied.length
    }
  }, null, 2))
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const env = args.env || DEFAULT_ENV
  if (!args['dry-run'] && !args['apply-metadata']) {
    usage()
    process.exit(2)
  }
  if (args['apply-metadata'] && env !== DEFAULT_ENV) {
    console.error('[audit-referral] refuse apply-metadata on non-default env without explicit confirmation path')
  }
  audit(env, Boolean(args['apply-metadata']))
}

main()
