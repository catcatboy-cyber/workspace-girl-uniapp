'use strict'

const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const {
  extractCollectionNames,
  extractIndexNames,
  isAlreadyExists,
  isNamespaceMissing
} = require('../scripts/manage-heart-persona-report-indexes.cjs')

const cloudbaseResponse = JSON.stringify({
  data: {
    results: [[
      { key: { _id: { $numberInt: '1' } }, name: '_id_' },
      { key: { resultShareId: { $numberInt: '1' } }, name: 'archetype_result_shares_result_share_id_unique', unique: true }
    ]]
  }
})
const nestedResponse = JSON.stringify({
  data: JSON.stringify({ cursor: { firstBatch: [{ IndexName: 'nested_index' }] } })
})
const collectionsResponse = JSON.stringify({
  data: {
    results: [[{ name: 'archetype_report_orders', type: 'collection' }]]
  }
})
const missingCollectionResponse = JSON.stringify({ data: { results: [[]] } })

assert.deepStrictEqual(
  [...extractIndexNames(cloudbaseResponse)].sort(),
  ['_id_', 'archetype_result_shares_result_share_id_unique']
)
assert(extractIndexNames(nestedResponse).has('nested_index'))
assert.deepStrictEqual([...extractCollectionNames(collectionsResponse)], ['archetype_report_orders'])
assert.strictEqual(extractCollectionNames(missingCollectionResponse).size, 0)
assert.strictEqual(isNamespaceMissing({ stdout: 'NamespaceNotFound: ns does not exist', stderr: '' }), true)
assert.strictEqual(isAlreadyExists({ stdout: '', stderr: 'IndexOptionsConflict: already exists' }), true)
assert.strictEqual(isAlreadyExists({ stdout: '', stderr: 'E11000 duplicate key error' }), false)

const managerSource = fs.readFileSync(path.resolve(__dirname, '../scripts/manage-heart-persona-report-indexes.cjs'), 'utf8')
assert(managerSource.includes('listCollections: 1'), 'collection existence must use listCollections because count succeeds for missing namespaces')
assert(!managerSource.includes('{ count: collection'), 'missing collections must not be detected with count')
assert(managerSource.includes('collection still missing after create'), 'collection creation must be verified')

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'heart-persona-index-manager-'))
const fakeCliPath = path.join(tempRoot, 'fake-cloudbase-cli.cjs')
const statePath = path.join(tempRoot, 'state.json')
const logPath = path.join(tempRoot, 'calls.log')
const managerPath = path.resolve(__dirname, '../scripts/manage-heart-persona-report-indexes.cjs')

fs.writeFileSync(fakeCliPath, `'use strict'
const fs = require('node:fs')
const statePath = process.env.HEART_PERSONA_FAKE_STATE
const logPath = process.env.HEART_PERSONA_FAKE_LOG
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
const commandIndex = process.argv.indexOf('--command')
const payload = JSON.parse(process.argv[commandIndex + 1])[0]
const command = JSON.parse(payload.Command)
const collection = payload.TableName
let result
if (command.listCollections) {
  result = state.collections.includes(collection) ? [{ name: collection, type: 'collection' }] : []
} else if (command.create) {
  if (!state.collections.includes(collection)) state.collections.push(collection)
  if (!state.indexes[collection]) state.indexes[collection] = ['_id_']
  result = { ok: 1 }
} else if (command.listIndexes) {
  if (!state.collections.includes(collection)) {
    process.stderr.write('NamespaceNotFound: ns does not exist')
    process.exit(1)
  }
  result = (state.indexes[collection] || ['_id_']).map((name) => ({ name }))
} else if (command.createIndexes) {
  const names = command.indexes.map((item) => item.name)
  state.indexes[collection] = [...new Set([...(state.indexes[collection] || ['_id_']), ...names])]
  result = { ok: 1 }
} else {
  process.stderr.write('unsupported fake command')
  process.exit(2)
}
fs.writeFileSync(statePath, JSON.stringify(state))
fs.appendFileSync(logPath, JSON.stringify({ collection, command }) + '\\n')
process.stdout.write(JSON.stringify({ data: { results: [result] } }))
`)

const orderIndexes = [
  '_id_',
  'archetype_report_orders_out_trade_no_unique',
  'archetype_report_orders_request_key_unique',
  'archetype_report_orders_user_result_created',
  'archetype_report_orders_status_updated',
  'archetype_report_orders_transaction',
  'archetype_report_orders_wx_order',
  'archetype_report_orders_wx_refund'
]
const refundIndexes = [
  '_id_',
  'archetype_report_refund_tasks_order_unique',
  'archetype_report_refund_tasks_status_created',
  'archetype_report_refund_tasks_user_result'
]
fs.writeFileSync(statePath, JSON.stringify({
  collections: ['archetype_report_orders', 'archetype_report_refund_tasks'],
  indexes: {
    archetype_report_orders: orderIndexes,
    archetype_report_refund_tasks: refundIndexes
  }
}))

const fakeEnv = {
  ...process.env,
  HEART_PERSONA_CLOUDBASE_CLI: fakeCliPath,
  HEART_PERSONA_FAKE_STATE: statePath,
  HEART_PERSONA_FAKE_LOG: logPath
}
const runManager = (mode) => spawnSync(process.execPath, [managerPath, mode, 'test-env'], {
  cwd: path.resolve(__dirname, '..'),
  env: fakeEnv,
  encoding: 'utf8'
})

let integration = runManager('create-collections')
assert.strictEqual(integration.status, 0, integration.stderr)
let state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
assert(state.collections.includes('archetype_result_shares'))
let calls = fs.readFileSync(logPath, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse)
assert.deepStrictEqual(calls.filter((item) => item.command.create).map((item) => item.collection), ['archetype_result_shares'])

integration = runManager('create-collections')
assert.strictEqual(integration.status, 0, integration.stderr)
calls = fs.readFileSync(logPath, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse)
assert.deepStrictEqual(calls.filter((item) => item.command.create).map((item) => item.collection), ['archetype_result_shares'])

integration = runManager('create-indexes')
assert.strictEqual(integration.status, 0, integration.stderr)
state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
assert.deepStrictEqual(state.indexes.archetype_result_shares.sort(), [
  '_id_',
  'archetype_result_shares_owner_created',
  'archetype_result_shares_result_share_id_unique',
  'archetype_result_shares_status_updated'
].sort())
assert.deepStrictEqual(state.indexes.archetype_report_orders, orderIndexes)
assert.deepStrictEqual(state.indexes.archetype_report_refund_tasks, refundIndexes)
calls = fs.readFileSync(logPath, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse)
assert.deepStrictEqual(calls.filter((item) => item.command.createIndexes).map((item) => item.collection), ['archetype_result_shares'])

integration = runManager('create-indexes')
assert.strictEqual(integration.status, 0, integration.stderr)
calls = fs.readFileSync(logPath, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse)
assert.deepStrictEqual(calls.filter((item) => item.command.createIndexes).map((item) => item.collection), ['archetype_result_shares'])

fs.rmSync(tempRoot, { recursive: true, force: true })

console.log('heart persona index manager tests passed')
