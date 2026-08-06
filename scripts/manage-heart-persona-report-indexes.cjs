const path = require('node:path')
const { spawnSync } = require('node:child_process')

const projectRoot = path.resolve(__dirname, '..')
const cli = path.join(projectRoot, 'node_modules', '@cloudbase', 'cli', 'bin', 'cloudbase')
const mode = process.argv[2] || 'audit-indexes'
const envId = process.argv[3] || 'cloud1-d0gvhqu2c8a2b61fd'

const plans = [
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

if (!['audit-collections', 'create-collections', 'audit-indexes', 'create-indexes'].includes(mode)) {
  throw new Error('Usage: audit-collections|create-collections|audit-indexes|create-indexes [envId]')
}
const commands = plans.map((plan) => ({
  TableName: plan.collection,
  CommandType: 'COMMAND',
  Command: JSON.stringify(mode === 'audit-collections'
    ? { count: plan.collection, query: {} }
    : mode === 'create-collections'
      ? { create: plan.collection }
      : mode === 'audit-indexes'
        ? { listIndexes: plan.collection }
        : { createIndexes: plan.collection, indexes: plan.indexes })
}))

const result = spawnSync(process.execPath, [cli, 'db', 'nosql', 'execute', '-e', envId, '--json', '--command', JSON.stringify(commands)], {
  cwd: projectRoot,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe']
})
if (result.stdout) process.stdout.write(result.stdout)
if (result.stderr) process.stderr.write(result.stderr)
if (result.error) throw result.error
process.exitCode = result.status ?? 1
