const path = require('node:path')
const { spawnSync } = require('node:child_process')

const projectRoot = path.resolve(__dirname, '..')
const cli = path.join(projectRoot, 'node_modules', '@cloudbase', 'cli', 'bin', 'cloudbase')
const mode = process.argv[2] || 'audit-indexes'
const envId = process.argv[3] || 'cloud1-d0gvhqu2c8a2b61fd'

const indexDefinitions = [
  {
    key: { userId: 1, createdAt: -1 },
    name: 'custom_pet_user_created_desc'
  },
  {
    key: { userId: 1, status: 1, createdAt: -1 },
    name: 'custom_pet_user_status_created_desc'
  },
  {
    key: { status: 1, createdAt: -1 },
    name: 'custom_pet_status_created_desc'
  }
]

function buildMongoCommand() {
  if (mode === 'audit-indexes') return { listIndexes: 'custom_pet_requests' }
  if (mode === 'audit-legacy') {
    return {
      count: 'custom_pet_requests',
      query: {
        status: 'delivered',
        $or: [
          { deliveredPet: { $exists: false } },
          { deliveredPet: null }
        ]
      }
    }
  }
  if (mode === 'create-indexes') {
    return { createIndexes: 'custom_pet_requests', indexes: indexDefinitions }
  }
  if (mode === 'audit-config') {
    return { find: 'system_settings', filter: { _id: 'settings_custom_pet' }, limit: 1 }
  }
  if (mode === 'enable-catalog' || mode === 'disable-catalog') {
    return {
      update: 'system_settings',
      updates: [{
        q: { _id: 'settings_custom_pet' },
        u: {
          $set: {
            catalogEnabled: mode === 'enable-catalog',
            updatedAt: new Date().toISOString()
          }
        },
        upsert: true
      }]
    }
  }
  throw new Error(`Unknown mode: ${mode}`)
}

const tableName = mode.includes('config') || mode.includes('catalog') ? 'system_settings' : 'custom_pet_requests'
const commandType = mode.includes('catalog') ? 'UPDATE' : mode === 'audit-config' ? 'QUERY' : 'COMMAND'
const payload = JSON.stringify([{
  TableName: tableName,
  CommandType: commandType,
  Command: JSON.stringify(buildMongoCommand())
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
process.exitCode = result.status ?? 1
