const path = require('node:path')
const { spawnSync } = require('node:child_process')

const projectRoot = path.resolve(__dirname, '..')
const cli = process.env.HEART_PERSONA_CLOUDBASE_CLI || path.join(projectRoot, 'node_modules', '@cloudbase', 'cli', 'bin', 'cloudbase')
const mode = process.argv[2] || 'audit-indexes'
const envId = process.argv[3] || 'cloud1-d0gvhqu2c8a2b61fd'

const plans = [
  {
    collection: 'archetype_result_shares',
    indexes: [
      { key: { resultShareId: 1 }, name: 'archetype_result_shares_result_share_id_unique', unique: true },
      { key: { ownerUserId: 1, createdAt: -1 }, name: 'archetype_result_shares_owner_created' },
      { key: { status: 1, updatedAt: -1 }, name: 'archetype_result_shares_status_updated' }
    ]
  },
  {
    collection: 'archetype_report_orders',
    indexes: [
      { key: { outTradeNo: 1 }, name: 'archetype_report_orders_out_trade_no_unique', unique: true },
      { key: { requestKey: 1 }, name: 'archetype_report_orders_request_key_unique', unique: true },
      { key: { userId: 1, resultId: 1, createdAt: -1 }, name: 'archetype_report_orders_user_result_created' },
      { key: { status: 1, updatedAt: -1 }, name: 'archetype_report_orders_status_updated' },
      { key: { transactionId: 1 }, name: 'archetype_report_orders_transaction' },
      { key: { wxOrderIdVerified: 1 }, name: 'archetype_report_orders_wx_order' },
      { key: { wxRefundId: 1 }, name: 'archetype_report_orders_wx_refund' }
    ]
  },
  {
    collection: 'archetype_report_refund_tasks',
    indexes: [
      { key: { orderId: 1 }, name: 'archetype_report_refund_tasks_order_unique', unique: true },
      { key: { status: 1, createdAt: -1 }, name: 'archetype_report_refund_tasks_status_created' },
      { key: { userId: 1, resultId: 1 }, name: 'archetype_report_refund_tasks_user_result' }
    ]
  }
]

const validModes = new Set(['audit-collections', 'create-collections', 'audit-indexes', 'create-indexes'])
const namespaceMissingPatterns = [
  /NamespaceNotFound/i,
  /ns does not exist/i,
  /collection[^\r\n]*does not exist/i,
  /集合[^\r\n]*不存在/i
]
const alreadyExistsPatterns = [
  /NamespaceExists/i,
  /already exists/i,
  /IndexOptionsConflict/i,
  /IndexKeySpecsConflict/i,
  /集合[^\r\n]*已存在/i,
  /索引[^\r\n]*已存在/i
]

function buildPayload(collection, command) {
  return JSON.stringify([{
    TableName: collection,
    CommandType: 'COMMAND',
    Command: JSON.stringify(command)
  }])
}

function runCommand(collection, command) {
  const result = spawnSync(process.execPath, [
    cli,
    'db',
    'nosql',
    'execute',
    '-e', envId,
    '--json',
    '--command', buildPayload(collection, command)
  ], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })

  if (result.error) throw result.error
  return {
    status: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  }
}

function outputOf(result) {
  return `${result.stdout}\n${result.stderr}`
}

function matchesAny(value, patterns) {
  return patterns.some((pattern) => pattern.test(value))
}

function isNamespaceMissing(result) {
  return matchesAny(outputOf(result), namespaceMissingPatterns)
}

function isAlreadyExists(result) {
  return matchesAny(outputOf(result), alreadyExistsPatterns)
}

function printResult(result) {
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
}

function parseNestedJson(value) {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed || !['{', '['].includes(trimmed[0])) return value
  try {
    return parseNestedJson(JSON.parse(trimmed))
  } catch (error) {
    return value
  }
}

function parseOutputJson(rawOutput) {
  const candidates = [rawOutput.trim(), ...rawOutput.split(/\r?\n/).map((line) => line.trim())]
  const parsed = []
  for (const candidate of candidates) {
    if (!candidate || !['{', '['].includes(candidate[0])) continue
    try {
      parsed.push(JSON.parse(candidate))
    } catch (error) {
      // The CLI can emit progress text around its JSON payload; line-level candidates handle that case.
    }
  }
  return parsed
}

function extractNames(rawOutput, acceptedKeys) {
  const names = new Set()
  const parsed = parseOutputJson(rawOutput)

  const visit = (input) => {
    const value = parseNestedJson(input)
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (!value || typeof value !== 'object') return

    for (const [key, child] of Object.entries(value)) {
      if (acceptedKeys.has(key) && typeof child === 'string') {
        names.add(child)
      }
      visit(child)
    }
  }

  parsed.forEach(visit)
  return names
}

function extractIndexNames(rawOutput) {
  return extractNames(rawOutput, new Set(['name', 'Name', 'indexName', 'IndexName']))
}

function extractCollectionNames(rawOutput) {
  return extractNames(rawOutput, new Set(['name', 'Name', 'collectionName', 'CollectionName']))
}

function auditCollection(collection, { quietMissing = false } = {}) {
  const result = runCommand(collection, { listCollections: 1, filter: { name: collection }, nameOnly: true })
  if (result.status !== 0) {
    printResult(result)
    return { ...result, missing: false }
  }
  if (parseOutputJson(result.stdout).length === 0) {
    console.error(`[heart-persona-report] unable to parse collection audit response: ${collection}`)
    printResult(result)
    return { ...result, status: 1, missing: false }
  }
  const exists = extractCollectionNames(result.stdout).has(collection)
  if (exists || !quietMissing) printResult(result)
  if (!exists && !quietMissing) console.error(`[heart-persona-report] collection missing: ${collection}`)
  return { ...result, status: exists ? 0 : 1, missing: !exists }
}

function auditIndexes(plan) {
  const result = runCommand(plan.collection, { listIndexes: plan.collection })
  printResult(result)
  return result
}

function createCollections() {
  let failed = false

  for (const plan of plans) {
    console.error(`\n[heart-persona-report] inspect collection ${plan.collection}`)
    const audit = auditCollection(plan.collection, { quietMissing: true })
    if (audit.status === 0) {
      console.error(`[heart-persona-report] collection exists, skipped: ${plan.collection}`)
      continue
    }
    if (!audit.missing) {
      failed = true
      continue
    }

    console.error(`[heart-persona-report] create collection ${plan.collection}`)
    const created = runCommand(plan.collection, { create: plan.collection })
    if (created.status === 0 || isAlreadyExists(created)) {
      if (created.status === 0) printResult(created)
      const verification = auditCollection(plan.collection, { quietMissing: true })
      if (verification.status === 0) {
        console.error(`[heart-persona-report] collection ready: ${plan.collection}`)
        continue
      }
      console.error(`[heart-persona-report] collection still missing after create: ${plan.collection}`)
      failed = true
      continue
    }
    printResult(created)
    failed = true
  }

  return failed ? 1 : 0
}

function createIndexes() {
  let failed = false

  for (const plan of plans) {
    console.error(`\n[heart-persona-report] inspect indexes ${plan.collection}`)
    const audit = runCommand(plan.collection, { listIndexes: plan.collection })
    if (audit.status !== 0) {
      printResult(audit)
      failed = true
      continue
    }

    const existingNames = extractIndexNames(audit.stdout)
    let missingIndexes = plan.indexes.filter((index) => !existingNames.has(index.name))
    if (missingIndexes.length === 0) {
      console.error(`[heart-persona-report] all indexes exist, skipped: ${plan.collection}`)
      continue
    }

    if (existingNames.size === 0) {
      console.error(`[heart-persona-report] unable to parse index audit response: ${plan.collection}`)
      printResult(audit)
      failed = true
      continue
    }

    let ready = false
    for (let attempt = 0; attempt < 2 && missingIndexes.length > 0; attempt += 1) {
      console.error(`[heart-persona-report] create ${missingIndexes.length} missing index(es): ${missingIndexes.map((item) => item.name).join(', ')}`)
      const created = runCommand(plan.collection, {
        createIndexes: plan.collection,
        indexes: missingIndexes
      })
      if (created.status !== 0 && !isAlreadyExists(created)) {
        printResult(created)
        break
      }
      if (created.status === 0) printResult(created)

      const verification = runCommand(plan.collection, { listIndexes: plan.collection })
      if (verification.status !== 0) {
        printResult(verification)
        break
      }
      const verifiedNames = extractIndexNames(verification.stdout)
      missingIndexes = plan.indexes.filter((index) => !verifiedNames.has(index.name))
      ready = missingIndexes.length === 0
    }

    if (ready) {
      console.error(`[heart-persona-report] indexes ready: ${plan.collection}`)
    } else {
      console.error(`[heart-persona-report] indexes still missing after verification: ${missingIndexes.map((item) => item.name).join(', ')}`)
      failed = true
    }
  }

  return failed ? 1 : 0
}

function runAudit(commandFactory) {
  let failed = false
  for (const plan of plans) {
    console.error(`\n[heart-persona-report] ${mode} ${plan.collection}`)
    const result = commandFactory(plan)
    if (result.status !== 0) failed = true
  }
  return failed ? 1 : 0
}

function main() {
  if (!validModes.has(mode)) {
    throw new Error('Usage: audit-collections|create-collections|audit-indexes|create-indexes [envId]')
  }

  if (mode === 'create-collections') return createCollections()
  if (mode === 'create-indexes') return createIndexes()
  if (mode === 'audit-collections') return runAudit((plan) => auditCollection(plan.collection))
  return runAudit(auditIndexes)
}

if (require.main === module) {
  process.exitCode = main()
}

module.exports = {
  extractCollectionNames,
  extractIndexNames,
  isAlreadyExists,
  isNamespaceMissing
}
